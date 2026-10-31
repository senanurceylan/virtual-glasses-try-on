import { useEffect, useMemo, useState } from 'react';
import { ALGO_LAYERS, CRITICAL_POINTS, LAYER_PRESETS, describeTransform, landmarkRegions, REGION_INFO, regionCounts } from '../core/algorithmLayers.js';
import { FACE_CONTOURS } from '../core/faceLandmarker.js';
import { CANONICAL, FEATURES } from '../core/faceShape.js';
import { MODEL_IPD_CM } from '../core/headPose.js';
import { AXIS_COLORS, SHAPE_LINES } from '../render/algorithmOverlay.js';
import { Collapsible } from './Collapsible.jsx';
import { HistoryChart } from './StabilityPanel.jsx';

const REFRESH_MS = 250;

// İşaret yuvarlanmış değerden alınır: −0.00001 → "+0.0" (−0.0 yazılmaz)
const signed = (v, digits = 1) => {
  const r = Number(v.toFixed(digits));
  return `${r >= 0 ? '+' : '−'}${Math.abs(r).toFixed(digits)}`;
};
const fmt = (v, digits = 1) => (Number.isFinite(v) ? v.toFixed(digits) : '–');

export const FILTER_INFO = [
  { key: 'minCutoff', unit: 'Hz', text: 'Baş hareketsizken kesim frekansı. Küçüldükçe titreme daha çok bastırılır, gecikme artar.' },
  { key: 'beta', unit: '', text: 'Hıza bağlı artış: fc = minCutoff + beta·|ẋ̂|. Büyüdükçe hızlı harekette gecikme azalır.' },
  { key: 'dCutoff', unit: 'Hz', text: 'Hız (ẋ) tahmininin yumuşatma frekansı; beta terimini kararlı tutar.' },
];

/**
 * Algoritma Modu paneli: katman seçimi ve her işlem adımının canlı değerleri ile
 * kısa açıklaması. İçerik yalnızca mod açıkken çizilir ve değerler periyodik okunur;
 * mod kapalıyken kare döngüsüne ya da React'e ek yük yoktur.
 *
 * @param algo           { enabled, layers }
 * @param mode           etkin görünüm modu ('2d' | '3d')
 * @param comparison     ModeComparison (açık ↔ kapalı FPS)
 */
export function AlgorithmPanel({ algo, onAlgoChange, view, onViewChange, mode, perf, comparison, placementRef, stabilityRef, faceShapeRef }) {
  const setLayer = (key) => (e) => onAlgoChange({ ...algo, layers: { ...algo.layers, [key]: e.target.checked } });

  return (
    <section className={`card card--algo${algo.enabled ? ' is-on' : ''}`} aria-labelledby="algo-title">
      <div className="algo-head">
        <h2 id="algo-title">Algoritma Modu</h2>
        <label className="switch">
          <input type="checkbox" checked={algo.enabled} onChange={(e) => onAlgoChange({ ...algo, enabled: e.target.checked })} />
          <span>{algo.enabled ? 'Açık' : 'Kapalı'}</span>
        </label>
      </div>

      {!algo.enabled ? (
        <p className="muted small">
          Açıldığında kamera üzerinde işlem adımları canlı gösterilir: yüz noktaları, göz geometrisi, kafa pozu, One Euro
          filtresi ve yüz şekli ölçüleri. Kapalıyken ek çizim ya da hesap yapılmaz.
        </p>
      ) : (
        <>
          <Collapsible title="Katmanlar" hint="kamera üstü" defaultOpen>
            <div className="toggles toggles--flat">
              {ALGO_LAYERS.map(({ key, label }) => (
                <label key={key} className="toggle">
                  <input
                    type="checkbox"
                    checked={algo.layers[key]}
                    disabled={key === 'depth' && !algo.layers.points}
                    onChange={setLayer(key)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <div className="preset-row">
              {LAYER_PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  className="btn btn--ghost btn--small"
                  onClick={() => onAlgoChange({ ...algo, layers: { ...p.layers } })}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Collapsible>
          <AlgorithmSteps
            view={view}
            onViewChange={onViewChange}
            mode={mode}
            perf={perf}
            comparison={comparison}
            placementRef={placementRef}
            stabilityRef={stabilityRef}
            faceShapeRef={faceShapeRef}
          />
        </>
      )}
    </section>
  );
}

/** Canlı değerler: tek bir zamanlayıcıyla tüm adımlar için okunur. */
function useLiveData({ perf, comparison, placementRef, stabilityRef, faceShapeRef }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    const read = () => {
      const est = faceShapeRef.current;
      setData({
        placement: placementRef.current,
        stability: stabilityRef.current.snapshot(),
        shape: { state: est.state, gates: est.gates, measurement: est.measurement },
        perf: perf.snapshot(),
        comparison: comparison.summary(),
      });
    };
    read();
    const id = setInterval(read, REFRESH_MS);
    return () => clearInterval(id);
  }, [perf, comparison, placementRef, stabilityRef, faceShapeRef]);
  return data;
}

function AlgorithmSteps({ view, onViewChange, mode, ...refs }) {
  const data = useLiveData(refs);
  const p = data?.placement ?? null;
  return (
    <div className="algo-steps">
      <Collapsible title="1 · Yüz noktaları" hint="478 nokta" defaultOpen>
        <LandmarkStep />
      </Collapsible>
      <Collapsible title="2 · 2D yerleştirme" hint="öteleme · dönme · ölçek" defaultOpen>
        <PlacementStep p={p} />
      </Collapsible>
      <Collapsible title="3 · 3D kafa pozu" hint="yaw · pitch · roll">
        <PoseStep p={p} mode={mode} view={view} onViewChange={onViewChange} />
      </Collapsible>
      <Collapsible title="4 · One Euro filtresi" hint={view.stabilize ? 'açık' : 'kapalı'}>
        <FilterStep stability={data?.stability} view={view} onViewChange={onViewChange} />
      </Collapsible>
      <Collapsible title="5 · Yüz şekli" hint="deneysel">
        <ShapeStep shape={data?.shape} />
      </Collapsible>
      <Collapsible title="6 · Performans" hint="açık ↔ kapalı">
        <PerfStep perf={data?.perf} comparison={data?.comparison} />
      </Collapsible>
    </div>
  );
}

const NO_FACE = <p className="muted small">Yüz algılandığında değerler burada görünür.</p>;

function LandmarkStep() {
  const counts = useMemo(() => regionCounts(landmarkRegions(FACE_CONTOURS)), []);
  return (
    <div className="panel-body">
      <p className="small">
        MediaPipe Face Landmarker her karede 468 yüz + 10 iris noktası verir. Her nokta normalize (x, y) ve göreli
        derinlik z içerir; piksel konumu (x·W, y·H) olarak hesaplanır.
      </p>
      <ul className="legend-list">
        {REGION_INFO.map((r) => (
          <li key={r.key}>
            <i className="dot" style={{ background: r.color }} />
            {r.label} <span className="muted">({counts[r.key]})</span>
          </li>
        ))}
        <li>
          <i className="dot dot--ring" />
          Kritik noktalar: {CRITICAL_POINTS.join(', ')}
        </li>
      </ul>
      <p className="muted small">
        Gözlük yalnızca dört göz köşesine dayanır: sağ göz 33 (dış) – 133 (iç), sol göz 362 (iç) – 263 (dış). Göz merkezi
        iki köşenin orta noktasıdır. Burun bölgesi yaklaşık bir nokta listesidir (MediaPipe bu sürümde burun konturu
        vermez).
      </p>
    </div>
  );
}

function PlacementStep({ p }) {
  if (!p) return <div className="panel-body">{NO_FACE}</div>;
  const m = p.metrics;
  const t = describeTransform(p.transform, m);
  const anchorDistance = p.transform ? m.distance2D / p.transform.scaleX : null;
  return (
    <div className="panel-body">
      <dl className="kv">
        <Row k="Sağ göz merkezi" v={`(${Math.round(p.width - m.right.x)}, ${Math.round(m.right.y)})`} />
        <Row k="Sol göz merkezi" v={`(${Math.round(p.width - m.left.x)}, ${Math.round(m.left.y)})`} />
        <Row k="Gözler arası d₂D / d₃D" v={`${fmt(m.distance2D)} / ${fmt(m.distance3D)} px`} />
        <Row k="Eğim θ (ekranda)" v={`${signed((-m.angle * 180) / Math.PI, 2)}°`} />
        {t && <Row k="Ölçek sx, sy" v={`${t.scaleX.toFixed(3)}, ${t.scaleY.toFixed(3)}`} />}
        {anchorDistance && <Row k="Görseldeki göz aralığı" v={`${fmt(anchorDistance, 0)} px`} />}
      </dl>
      {t && <MatrixView matrix={t.matrix} />}
      <ol className="math-steps small">
        <li>
          <b>Referans çizgisi:</b> Δ = L − R, d = √(Δx² + Δy²), θ = atan2(Δy, Δx). Yatay kesikli çizgi θ = 0'dır.
        </li>
        <li>
          <b>Ölçek:</b> sx = d₂D / d<sub>görsel</sub>, sy = d₃D / d<sub>görsel</sub>. Kafa yana dönünce d₂D küçülür, gözlük
          yatayda daralır; d₃D (z dahil) dikey ölçeği korur.
        </li>
        <li>
          <b>Dönme:</b> a = sx·cos θ, b = sx·sin θ, c = −sy·sin θ, d = sy·cos θ.
        </li>
        <li>
          <b>Öteleme:</b> e, f görseldeki göz orta noktasını yüzdeki göz merkezine (kırmızı artı) taşır.
        </li>
        <li>
          Canvas: x′ = a·x + c·y + e, y′ = b·x + d·y + f (setTransform). Mavi kesikli dörtgen, dönüştürülmüş görselin
          sınırıdır.
        </li>
      </ol>
    </div>
  );
}

function MatrixView({ matrix: [a, b, c, d, e, f] }) {
  const cell = (v, digits = 3) => <td>{v.toFixed(digits)}</td>;
  return (
    <table className="matrix" aria-label="2D afin matris">
      <tbody>
        <tr>
          {cell(a)}
          {cell(c)}
          {cell(e, 1)}
        </tr>
        <tr>
          {cell(b)}
          {cell(d)}
          {cell(f, 1)}
        </tr>
        <tr className="muted">
          <td>0</td>
          <td>0</td>
          <td>1</td>
        </tr>
      </tbody>
    </table>
  );
}

function PoseStep({ p, mode, view, onViewChange }) {
  const pose = p?.pose;
  return (
    <div className="panel-body">
      {pose ? (
        <dl className="kv">
          <Row k="Yaw (kendi soluna +)" v={`${signed(pose.angles.yaw)}°`} />
          <Row k="Pitch (aşağı +)" v={`${signed(pose.angles.pitch)}°`} />
          <Row k="Roll (sağ omza +)" v={`${signed(pose.angles.roll)}°`} />
          <Row k="Roll – göz çizgisinden" v={`${signed(pose.eyeRoll)}°`} />
          <Row k="Ölçek" v={`${pose.pxPerCm.toFixed(2)} px/cm`} />
        </dl>
      ) : (
        NO_FACE
      )}
      <ul className="legend-list legend-list--row">
        {Object.entries(AXIS_COLORS).map(([axis, color]) => (
          <li key={axis}>
            <i className="dot" style={{ background: color }} />
            {axis.toUpperCase()}
          </li>
        ))}
      </ul>
      <ol className="math-steps small">
        <li>
          <b>Dönme:</b> MediaPipe 4×4 matrisi ayrıştırılır (decompose), dönme kısmı kuaterniyon olarak{' '}
          <code>glasses.quaternion</code>'a verilir. Euler 'YXZ': yaw (y), pitch (x), roll (z).
        </li>
        <li>
          <b>Konum:</b> göz merkezi pikseli dünyaya (X = x, Y = −y) çevrilip <code>glasses.position</code> olur.
        </li>
        <li>
          <b>Ölçek:</b> px/cm = d₃D / {MODEL_IPD_CM} cm (ortalama göz bebeği mesafesi) → <code>glasses.scale</code>.
          Ortografik kamera piksel ölçeğinde kurulduğu için model 2D ile aynı noktaya düşer.
        </li>
        <li>Eksenler bu konum ve dönmeyle çizilir; X kırmızı, Y yeşil, Z mavi (yüzün baktığı yön).</li>
      </ol>
      <label className="toggle">
        <input
          type="checkbox"
          checked={view.showOccluders}
          disabled={mode !== '3d'}
          onChange={(e) => onViewChange({ ...view, showOccluders: e.target.checked })}
        />
        <span>Occlusion maskelerini göster {mode !== '3d' && '(yalnızca 3D)'}</span>
      </label>
      <p className="muted small">
        Occlusion: yüz ağı ve kafa hacmi gözlükten önce yalnızca derinlik tamponuna çizilir (renk yazılmaz). Arkalarında
        kalan sap parçaları derinlik testinden geçemez ve gizlenir. Açıkken maskeler renkli (yüz mavi, kafa kırmızı)
        gösterilir.
      </p>
    </div>
  );
}

function FilterStep({ stability, view, onViewChange }) {
  return (
    <div className="panel-body">
      <label className="toggle">
        <input type="checkbox" checked={view.stabilize} onChange={(e) => onViewChange({ ...view, stabilize: e.target.checked })} />
        <span>One Euro filtresi açık</span>
      </label>
      <p className="small">
        Kamera üzerinde gri halkalar <b>ham</b> göz merkezleri, yeşil noktalar <b>filtreli</b> değerlerdir. Filtre kapalıyken
        ikisi üst üste düşer; açıkken baş sabitken halkalar titrer, noktalar durağan kalır.
      </p>
      <p className="small mono">
        α = r / (r + 1), r = 2π·fc·Δt · x̂ = x̂ₖ₋₁ + α·(x − x̂ₖ₋₁)
      </p>
      <dl className="kv">
        {FILTER_INFO.map((f) => (
          <div key={f.key} className="kv-row kv-row--stack">
            <dt>
              {f.key} = {view.filterParams[f.key].toFixed(1)} {f.unit}
            </dt>
            <dd className="muted small">{f.text}</dd>
          </div>
        ))}
      </dl>
      {stability && stability.samples > 5 ? (
        <dl className="kv">
          <Row
            k="Konum titremesi (RMS)"
            v={`${stability.position.raw.toFixed(2)} → ${stability.position.filtered.toFixed(2)} px (−${Math.round(stability.position.reduction * 100)} %)`}
          />
          <Row
            k="Eğim titremesi (RMS)"
            v={`${stability.roll.raw.toFixed(2)} → ${stability.roll.filtered.toFixed(2)}° (−${Math.round(stability.roll.reduction * 100)} %)`}
          />
        </dl>
      ) : (
        NO_FACE
      )}
      {stability?.history.length > 1 && <HistoryChart history={stability.history} />}
      <p className="muted small">Parametreler "Stabilizasyon (One Euro)" panelinden ayarlanır; Algoritma Modu filtreyi değiştirmez.</p>
    </div>
  );
}

function ShapeStep({ shape }) {
  const m = shape?.measurement;
  return (
    <div className="panel-body">
      <p className="experimental" role="note">
        <b>Deneysel:</b> sınıflandırma eşikleri kanonik yüz modeline göre seçilmiştir, gerçek yüz verisiyle doğrulanmamıştır.
      </p>
      <ul className="legend-list">
        {SHAPE_LINES.map((l) => (
          <li key={l.key}>
            <i className="dot" style={{ background: l.color }} />
            {l.label}
          </li>
        ))}
        <li>
          <i className="dot" style={{ background: '#ff6b9a' }} />
          Çene köşesi açısı (234–172–152)
        </li>
      </ul>
      <p className="small">
        Tüm genişlikler <b>elmacık genişliğine</b> (234 ↔ 454) bölünür. Böylece kameraya uzaklık ve çözünürlük sonucu
        etkilemez. Genişlikler 3D, açı 2D ölçülür.
      </p>
      {m ? (
        <table className="ratio-table">
          <thead>
            <tr>
              <th>Oran</th>
              <th>Bu kare</th>
              <th>Medyan</th>
              <th>Ortalama yüz</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(FEATURES).map(([k, f]) => (
              <tr key={k}>
                <td title={f.label}>{k}</td>
                <td>{m.ratios[k].toFixed(f.digits)}</td>
                <td>{shape.state.result ? shape.state.result.ratios[k].toFixed(f.digits) : '–'}</td>
                <td className="muted">{CANONICAL[k].toFixed(f.digits)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        NO_FACE
      )}
      <h3 className="subhead">Örnek kabul koşulları</h3>
      {shape?.gates ? (
        <ul className="gate-list">
          {shape.gates.map((g) => (
            <li key={g.key} className={g.ok ? 'is-ok' : 'is-fail'}>
              <span aria-hidden>{g.ok ? '✓' : '✗'}</span> {g.label}
              {g.value !== null && <span className="muted mono"> · {gateValue(g)}</span>}
            </li>
          ))}
        </ul>
      ) : (
        NO_FACE
      )}
      {shape && (
        <p className="muted small">
          Durum: {shape.state.message} İlk sağlanmayan koşul örneği reddeder; geçerli örneklerin medyanı (en az 30, en çok 60
          kare) sınıflandırılır.
        </p>
      )}
    </div>
  );
}

function gateValue(g) {
  if (g.key === 'pose') return `en büyük açı ${g.value.toFixed(0)}°`;
  if (g.key === 'too-far') return `${g.value.toFixed(0)} px`;
  if (g.key === 'mouth') return `açıklık ${g.value.toFixed(3)}`;
  if (g.key === 'implausible') return `açı farkı ${g.value.toFixed(0)}°`;
  if (g.key === 'forehead') return `ten oranı ${g.value.toFixed(2)}`;
  return String(g.value);
}

function PerfStep({ perf, comparison }) {
  if (!perf) return null;
  const algoMs = perf.stages.Algoritma?.avg;
  const col = (c) => (c ? [c.fps.toFixed(1), c.frameMs.toFixed(2), `${c.samples}`] : ['–', '–', '0']);
  const off = col(comparison.off);
  const on = col(comparison.on);
  return (
    <div className="panel-body">
      <dl className="kv">
        <Row k="FPS" v={perf.fps.toFixed(1)} />
        <Row k="Kare işlem süresi" v={`${perf.frameMs.avg.toFixed(2)} ms`} />
        <Row k="Algoritma çizimi" v={algoMs !== undefined ? `${algoMs.toFixed(2)} ms` : '–'} />
      </dl>
      <table className="ratio-table">
        <thead>
          <tr>
            <th />
            <th>FPS</th>
            <th>Kare (ms)</th>
            <th>Örnek</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Mod kapalı</td>
            {off.map((v, i) => (
              <td key={i}>{v}</td>
            ))}
          </tr>
          <tr>
            <td>Mod açık</td>
            {on.map((v, i) => (
              <td key={i}>{v}</td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="muted small">
        Karşılaştırma bu oturumda biriktirilir (her 0,5 sn bir örnek; mod değişiminden sonraki 1,5 sn atılır). İki satırın
        dolması için modu bir süre kapalı, bir süre açık kullanın. FPS kameranın kare hızıyla sınırlıdır; asıl maliyet kare
        işlem süresinde görülür.
      </p>
      {comparison.deltaMs !== null && (
        <p className="small">
          Fark: <b>{signed(comparison.deltaMs, 2)} ms</b> / kare
        </p>
      )}
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="kv-row">
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}
