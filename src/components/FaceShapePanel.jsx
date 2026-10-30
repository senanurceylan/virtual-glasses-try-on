import { useEffect, useMemo, useState } from 'react';
import { explainRatios } from '../core/faceShape.js';
import { ESTIMATOR_DEFAULTS } from '../core/faceShapeEstimator.js';
import { FRAME_STYLES } from '../core/frameStyles.js';
import { recommendFrames } from '../core/recommendations.js';
import { GLASSES } from '../render/glassesCatalog.js';

const REFRESH_MS = 300;
const pct = (v) => `%${Math.round(v * 100)}`;

/**
 * Yüz şekli paneli: çok kareli tahminin durumu, kullanılan oranlar, olasılıklar
 * ve en uygun üç çerçeve önerisi ("Dene" ile kamerada denenir).
 * Sonuç kesin bir teşhis değil, yaklaşık geometrik tahmindir.
 */
export function FaceShapePanel({ faceShapeRef, selectedId, onSelect }) {
  const [state, setState] = useState(() => ({ ...faceShapeRef.current.state }));

  useEffect(() => {
    const id = setInterval(() => setState({ ...faceShapeRef.current.state }), REFRESH_MS);
    return () => clearInterval(id);
  }, [faceShapeRef]);

  const shown = state?.result ?? state?.last ?? null; // geçici sorunlarda son tahmin soluk gösterilir
  const stale = Boolean(shown && !state?.result);
  const ratiosKey = shown ? Object.values(shown.ratios).map((v) => v.toFixed(2)).join() : '';
  // Öneriler oranlar anlamlı ölçüde değişince yeniden hesaplanır (kartlar titremesin).
  const recommendations = useMemo(
    () => (shown ? recommendFrames(shown.ratios, FRAME_STYLES, 3) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ratiosKey],
  );

  return (
    <section className="card">
      <h2>Yüz şekli</h2>
      <StatusLine state={state} />

      {stale && (
        <p className="stale-note">
          Aşağıdaki sonuç <strong>son geçerli tahmindir, güncel ölçüm değildir.</strong> Koşullar sağlanınca ölçüm
          kendiliğinden devam eder.
        </p>
      )}
      {shown && (
        <div className={stale ? 'is-stale' : ''}>
          <ShapeResult result={shown} />
          <h3 className="subhead">Önerilen çerçeveler</h3>
          <div className="rec-list">
            {recommendations.map((r, i) => (
              <RecommendationCard key={r.id} rank={i + 1} rec={r} active={r.id === selectedId} onTry={() => onSelect(r.id)} />
            ))}
          </div>
          <p className="muted small">
            Öneriler yaygın estetik ilkelere (denge ve karşıtlık) dayanır; kesin kurallar değildir. Beğendiğiniz
            her çerçeveyi deneyebilirsiniz.
          </p>
        </div>
      )}

      <h3 className="subhead">Tüm çerçeveler</h3>
      <div className="frame-grid">
        {GLASSES.map((g) => (
          <button
            key={g.id}
            className={`frame-chip ${g.id === selectedId ? 'is-active' : ''}`}
            onClick={() => onSelect(g.id)}
            title={g.description}
          >
            <img src={g.src} alt="" />
            <span>{g.name}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function StatusLine({ state }) {
  if (!state) return null;
  const tone = state.status === 'ready' ? 'ok' : state.status === 'collecting' ? 'info' : 'warn';
  return (
    <div className={`shape-status shape-status--${tone}`}>
      <span>{state.message}</span>
      {state.status === 'collecting' && (
        <div className="progress" aria-label="Ölçüm ilerlemesi">
          <div style={{ width: `${state.progress * 100}%` }} />
        </div>
      )}
      {state.mouth !== null && state.mouth !== undefined && (
        <span className="muted small">
          Ağız açıklığı: {state.mouth.toFixed(3)} (uyarı &gt; {ESTIMATOR_DEFAULTS.mouthEnter}, devam &lt;{' '}
          {ESTIMATOR_DEFAULTS.mouthExit})
        </span>
      )}
      {state.forehead !== null && state.forehead !== undefined && (
        <span className="muted small">Alın görünürlüğü (ten benzerliği): {pct(state.forehead)}</span>
      )}
    </div>
  );
}

function ShapeResult({ result }) {
  const { classification: c } = result;
  const [first, second] = c.ranking;
  const confident = c.probability >= 0.6 && c.margin >= 0.3;
  const rows = explainRatios(result.ratios);

  return (
    <>
      <div className="shape-result">
        <span className="shape-label">Yaklaşık tahmin</span>
        <strong className="shape-name">
          {confident ? first.name : `${first.name} / ${second.name}`}
        </strong>
        <span className="muted small">
          {confident
            ? `Benzerlik ${pct(first.probability)} · ${result.samples} kare`
            : `İki şekil arasında: ${first.name} ${pct(first.probability)}, ${second.name} ${pct(second.probability)}`}
        </span>
      </div>

      <div className="prob-bars">
        {c.ranking.map((r) => (
          <div key={r.shape} className="prob-row">
            <span>{r.name}</span>
            <div className="prob-track">
              <div style={{ width: `${r.probability * 100}%` }} />
            </div>
            <span className="mono">{pct(r.probability)}</span>
          </div>
        ))}
      </div>

      <h3 className="subhead">Kullanılan oranlar (medyan)</h3>
      <dl className="kv kv--3">
        <div className="kv-row kv-head">
          <dt />
          <dd>siz</dd>
          <dd>ortalama</dd>
          <dd>yorum</dd>
        </div>
        {rows.map((r) => (
          <div key={r.key} className="kv-row">
            <dt>{r.label}</dt>
            <dd>
              {r.value.toFixed(r.digits)}
              {r.unit}
            </dd>
            <dd>
              {r.average.toFixed(r.digits)}
              {r.unit}
            </dd>
            <dd className={r.level ? 'is-good' : ''}>{r.text}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

function RecommendationCard({ rank, rec, active, onTry }) {
  const glasses = GLASSES.find((g) => g.id === rec.id);
  return (
    <article className={`rec-card ${active ? 'is-active' : ''}`}>
      <img src={glasses.src} alt="" className="rec-thumb" />
      <div className="rec-body">
        <div className="rec-head">
          <strong>
            {rank}. {rec.name}
          </strong>
          <span className="rec-score">{rec.score}/100</span>
        </div>
        <ul>
          {rec.reasons.map((t) => (
            <li key={t}>{t}</li>
          ))}
          {rec.cautions.map((t) => (
            <li key={t} className="muted">
              Dikkat: {t}
            </li>
          ))}
        </ul>
        <button className="btn btn--small" onClick={onTry} disabled={active}>
          {active ? 'Deneniyor' : 'Dene'}
        </button>
      </div>
    </article>
  );
}
