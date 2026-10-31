import { explainRatios } from '../core/faceShape.js';
import { ESTIMATOR_DEFAULTS } from '../core/faceShapeEstimator.js';
import { GLASSES } from '../render/glassesCatalog.js';
import { Collapsible } from './Collapsible.jsx';

const pct = (v) => `%${Math.round(v * 100)}`;

const GUIDE = [
  'Kameradan yaklaşık 50–70 cm uzakta durun; yüzünüz görüntünün ortasında olsun.',
  'Başınızı düz tutun, doğrudan kameraya bakın (sağa, sola, yukarı, aşağı çevirmeyin).',
  'Ağzınızı kapalı tutun, yüzünüzü rahat bırakın.',
  'Saçınızı alnınızdan çekin; alın ve çene hattı görünür olsun.',
  'Işık önden ve eşit gelsin; arkanızda güçlü ışık (pencere) olmasın.',
  'Ölçüm birkaç saniye sürer; ilerleme çubuğu dolana kadar sabit durun.',
];

/**
 * Yüz analizi paneli: ölçüm durumu ve ilerleme, yaklaşık yüz şekli, olasılıklar,
 * oranlar, en uygun üç çerçeve ("Dene") ve ölçüm yönergeleri.
 * Sonuç kesin bir teşhis değil, yaklaşık geometrik tahmindir.
 *
 * @param view  useFaceShapeState() çıktısı: { state, shown, stale, recommendations }
 */
export function FaceShapePanel({ view, selectedId, onSelect }) {
  const { state, shown, stale, recommendations } = view;

  return (
    <section className="card card--analysis" aria-labelledby="analysis-title">
      <h2 id="analysis-title">Yüz analizi</h2>
      <StatusLine state={state} />

      {stale && (
        <p className="stale-note">
          Aşağıdaki sonuç <strong>son geçerli tahmindir, güncel ölçüm değildir.</strong> Koşullar sağlanınca ölçüm
          kendiliğinden devam eder.
        </p>
      )}

      {shown ? (
        <div className={stale ? 'is-stale' : ''}>
          <ShapeResult result={shown} />

          <h3 className="subhead">Size önerilen çerçeveler</h3>
          <div className="rec-list">
            {recommendations.map((r, i) => (
              <RecommendationCard key={r.id} rank={i + 1} rec={r} active={r.id === selectedId} onTry={() => onSelect(r.id)} />
            ))}
          </div>
          <p className="muted small">
            Öneriler yaygın estetik ilkelere (denge ve karşıtlık) dayanır; kesin kurallar değildir. Beğendiğiniz her
            çerçeveyi katalogdan deneyebilirsiniz.
          </p>

          <Collapsible title="Kullanılan yüz oranları" hint="medyan">
            <RatioTable result={shown} />
          </Collapsible>
        </div>
      ) : (
        <p className="muted small">
          Yüz şekli, yüzünüzdeki 478 noktadan hesaplanan oranlarla tahmin edilir. Aşağıdaki yönergelere uyarak kameraya
          bakın; tahmin birkaç saniye içinde burada görünür.
        </p>
      )}

      <Collapsible title="Doğru ölçüm için" defaultOpen={!shown}>
        <ul className="guide-list">
          {GUIDE.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
      </Collapsible>

      <p className="disclaimer">
        Yüzdeler, yüz oranlarınızın her şeklin tanımına <strong>ne kadar benzediğini</strong> gösterir; doğrulanmış bir
        doğruluk oranı değildir. Sonuç tıbbi ya da kesin bir değerlendirme değil, yaklaşık geometrik bir tahmindir.
      </p>
    </section>
  );
}

function StatusLine({ state }) {
  if (!state) return null;
  const tone = state.status === 'ready' ? 'ok' : state.status === 'collecting' ? 'info' : 'warn';
  return (
    <div className={`shape-status shape-status--${tone}`} role="status">
      <span>{state.message}</span>
      {state.status === 'collecting' && (
        <div className="progress" role="progressbar" aria-label="Ölçüm ilerlemesi" aria-valuenow={Math.round(state.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div style={{ width: `${state.progress * 100}%` }} />
        </div>
      )}
      {state.mouth !== null && state.mouth !== undefined && state.status === 'mouth' && (
        <span className="muted small">
          Ağız açıklığı: {state.mouth.toFixed(3)} (uyarı &gt; {ESTIMATOR_DEFAULTS.mouthEnter}, devam &lt;{' '}
          {ESTIMATOR_DEFAULTS.mouthExit})
        </span>
      )}
      {state.forehead !== null && state.forehead !== undefined && state.status === 'forehead' && (
        <span className="muted small">Alın görünürlüğü (ten benzerliği): {pct(state.forehead)}</span>
      )}
    </div>
  );
}

function ShapeResult({ result }) {
  const { classification: c } = result;
  const [first, second] = c.ranking;
  const confident = c.probability >= 0.6 && c.margin >= 0.3;

  return (
    <>
      <div className="shape-result">
        <span className="shape-label">Yaklaşık yüz şekli</span>
        <strong className="shape-name">{confident ? first.name : `${first.name} / ${second.name}`}</strong>
        <span className="muted small">
          {confident
            ? `Prototipe benzerlik ${pct(first.probability)} · ${result.samples} kare`
            : `İki şekil arasında: ${first.name} ${pct(first.probability)}, ${second.name} ${pct(second.probability)}`}
        </span>
      </div>

      <div className="prob-bars" aria-label="Şekillere benzerlik">
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
    </>
  );
}

function RatioTable({ result }) {
  const rows = explainRatios(result.ratios);
  return (
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
          <span className="rec-score" title="Öneri puanı (0–100)">
            {rec.score}/100
          </span>
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
