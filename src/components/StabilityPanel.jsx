import { useEffect, useRef, useState } from 'react';
import { DEFAULT_PARAMS } from '../core/oneEuroFilter.js';

const REFRESH_MS = 200;

const SLIDERS = [
  { key: 'minCutoff', label: 'minCutoff', unit: 'Hz', min: 0.1, max: 5, step: 0.1, hint: 'düşük → durağan yüzde daha az titreme' },
  { key: 'beta', label: 'beta', unit: '', min: 0, max: 10, step: 0.1, hint: 'yüksek → hızlı harekette daha az gecikme' },
  { key: 'dCutoff', label: 'dCutoff', unit: 'Hz', min: 0.1, max: 5, step: 0.1, hint: 'hız tahmininin yumuşatılması' },
];

const signed = (v, digits = 1) => `${v >= 0 ? '+' : ''}${v.toFixed(digits)}`;
const pct = (v) => `${Math.round(v * 100)} %`;

/**
 * Stabilizasyon paneli: One Euro filtresini aç/kapa, parametre ayarı ve
 * ham ↔ filtrelenmiş değerlerin karşılaştırması (sayısal + son 5 sn grafik).
 * "Titreme" = kareden kareye değişimin RMS'i; baş sabitken filtrenin etkisini doğrudan gösterir.
 */
export function StabilityPanel({ placementRef, stabilityRef, view, onViewChange }) {
  const [p, setP] = useState(null);
  const [snap, setSnap] = useState(null);

  useEffect(() => {
    const id = setInterval(() => {
      setP(placementRef.current);
      setSnap(stabilityRef.current.snapshot());
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [placementRef, stabilityRef]);

  const params = view.filterParams;
  const setParam = (key) => (e) => onViewChange({ ...view, filterParams: { ...params, [key]: Number(e.target.value) } });
  const changed = SLIDERS.some(({ key }) => params[key] !== DEFAULT_PARAMS[key]);

  const rows = p ? compareRows(p) : [];

  return (
    <div className="panel-body">
      <div className="toggles toggles--flat">
        <label className="toggle">
          <input
            type="checkbox"
            checked={view.stabilize}
            onChange={(e) => onViewChange({ ...view, stabilize: e.target.checked })}
          />
          <span>One Euro filtresi (titreme azaltma)</span>
        </label>
      </div>

      <div className="sliders">
        {SLIDERS.map((s) => (
          <label key={s.key} className="slider" title={s.hint}>
            <span className="slider-head">
              <span>{s.label}</span>
              <span className="mono">
                {params[s.key].toFixed(1)} {s.unit}
              </span>
            </span>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={params[s.key]}
              disabled={!view.stabilize}
              onChange={setParam(s.key)}
            />
          </label>
        ))}
        {changed && (
          <button className="btn btn--ghost btn--small" onClick={() => onViewChange({ ...view, filterParams: { ...DEFAULT_PARAMS } })}>
            Varsayılana dön
          </button>
        )}
      </div>

      <h3 className="subhead">Canlı titreme (son ~3 sn, kareden kareye RMS)</h3>
      {snap && snap.samples > 5 ? (
        <dl className="kv kv--3">
          <div className="kv-row kv-head">
            <dt />
            <dd>ham</dd>
            <dd>filtreli</dd>
            <dd>azalma</dd>
          </div>
          <JitterRow label="Konum" unit="px" s={snap.position} />
          <JitterRow label="Eğim (roll)" unit="°" s={snap.roll} />
        </dl>
      ) : (
        <p className="muted">Yüz algılandığında ölçüm başlar.</p>
      )}
      {snap?.history.length > 1 && <HistoryChart history={snap.history} />}
      <p className="muted small">Başınızı sabit tutun: azalma oranı filtrenin bastırdığı titremedir. Hareket ederken fark gecikmeyi gösterir.</p>

      <h3 className="subhead">Ham ↔ filtrelenmiş</h3>
      {rows.length ? (
        <dl className="kv kv--3">
          <div className="kv-row kv-head">
            <dt />
            <dd>ham</dd>
            <dd>filtreli</dd>
            <dd>fark</dd>
          </div>
          {rows.map(([label, raw, filt, digits]) => (
            <div key={label} className="kv-row">
              <dt>{label}</dt>
              <dd>{raw.toFixed(digits)}</dd>
              <dd>{filt.toFixed(digits)}</dd>
              <dd>{signed(filt - raw, digits)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="muted">Yüz algılandığında değerler burada görünür.</p>
      )}
    </div>
  );
}

/** Ekranda görüldüğü gibi (aynalı x) ham ve filtrelenmiş değerler. */
function compareRows(p) {
  const r = p.raw.metrics;
  const f = p.metrics;
  const deg = (rad) => (-rad * 180) / Math.PI;
  const rows = [
    ['Merkez x (px)', p.width - r.center.x, p.width - f.center.x, 1],
    ['Merkez y (px)', r.center.y, f.center.y, 1],
    ['Gözler arası (px)', r.distance3D, f.distance3D, 1],
    ['Eğim θ (°)', deg(r.angle), deg(f.angle), 2],
  ];
  if (p.pose && p.raw.pose) {
    for (const [k, name] of [
      ['yaw', 'Yaw (°)'],
      ['pitch', 'Pitch (°)'],
      ['roll', 'Roll 3D (°)'],
    ]) {
      rows.push([name, p.raw.pose.angles[k], p.pose.angles[k], 2]);
    }
  }
  return rows;
}

function JitterRow({ label, unit, s }) {
  return (
    <div className="kv-row">
      <dt>{label}</dt>
      <dd>
        {s.raw.toFixed(2)} {unit}
      </dd>
      <dd>
        {s.filtered.toFixed(2)} {unit}
      </dd>
      <dd className={s.reduction > 0.3 ? 'is-good' : ''}>{pct(s.reduction)}</dd>
    </div>
  );
}

/** Son kareler: merkez x ve eğim, ham (soluk) ve filtrelenmiş (renkli). Her eksen kendi aralığına ölçeklenir. */
export function HistoryChart({ history }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (history.length < 2) return;

    const css = getComputedStyle(canvas);
    const accent = css.getPropertyValue('--accent').trim() || '#5b8cff';
    const ok = css.getPropertyValue('--ok').trim() || '#3ddc97';
    const muted = css.getPropertyValue('--muted').trim() || '#8b95a3';
    const half = h / 2;

    const lane = (top, rawKey, filtKey, color, label) => {
      const values = history.flatMap((s) => [s[rawKey], s[filtKey]]);
      const mid = (Math.max(...values) + Math.min(...values)) / 2;
      const span = Math.max(Math.max(...values) - Math.min(...values), rawKey === 'rawX' ? 4 : 0.5);
      const y = (v) => top + half / 2 - ((v - mid) / span) * (half - 12);
      const x = (i) => (i / (history.length - 1)) * w;
      const line = (key, stroke, width) => {
        ctx.beginPath();
        history.forEach((s, i) => (i ? ctx.lineTo(x(i), y(s[key])) : ctx.moveTo(x(i), y(s[key]))));
        ctx.strokeStyle = stroke;
        ctx.lineWidth = width;
        ctx.stroke();
      };
      ctx.globalAlpha = 0.45;
      line(rawKey, muted, 1);
      ctx.globalAlpha = 1;
      line(filtKey, color, 2);
      ctx.fillStyle = muted;
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(label, 4, top + 11);
    };
    lane(0, 'rawX', 'filtX', accent, 'merkez x');
    lane(half, 'rawRoll', 'filtRoll', ok, 'eğim');
  }, [history]);

  return (
    <div className="history">
      <canvas ref={ref} className="history-canvas" />
      <div className="history-legend">
        <span>
          <i className="swatch swatch--raw" /> ham
        </span>
        <span>
          <i className="swatch swatch--filt" /> filtreli
        </span>
      </div>
    </div>
  );
}
