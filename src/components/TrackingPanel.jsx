import { LANDMARK_COUNT } from '../core/landmarkUtils.js';

const TOGGLES = [
  { key: 'showPoints', label: '478 nokta' },
  { key: 'colorByDepth', label: 'Derinliğe göre renk (z)' },
  { key: 'showContours', label: 'Konturlar (göz, kaş, dudak, iris)' },
  { key: 'showBox', label: 'Yüz sınır kutusu' },
];

/** Yüz takibinin durumu ve çizim katmanlarının aç/kapa ayarları. */
export function TrackingPanel({ model, faceVisible, running, style, onStyleChange }) {
  let status;
  if (model.status === 'loading') status = { text: 'Model yükleniyor…', tone: 'muted' };
  else if (model.status === 'error') status = { text: 'Model hatası', tone: 'error' };
  else if (!running) status = { text: 'Kamera bekleniyor', tone: 'muted' };
  else if (faceVisible) status = { text: 'Yüz algılandı', tone: 'ok' };
  else status = { text: 'Yüz aranıyor', tone: 'warn' };

  return (
    <section className="card">
      <h2>Yüz takibi</h2>
      <div className={`status-pill status-pill--${status.tone}`}>
        <span className="status-dot" />
        {status.text}
      </div>

      <dl className="kv">
        <dt>Model</dt>
        <dd>MediaPipe Face Landmarker</dd>
        <dt>Nokta sayısı</dt>
        <dd>{faceVisible ? LANDMARK_COUNT : '–'}</dd>
        <dt>Hızlandırıcı</dt>
        <dd>{model.delegate ?? '–'}</dd>
        <dt>Model yükleme</dt>
        <dd>{model.loadMs ? `${Math.round(model.loadMs)} ms` : '–'}</dd>
      </dl>

      <div className="toggles">
        {TOGGLES.map(({ key, label }) => (
          <label key={key} className="toggle">
            <input
              type="checkbox"
              checked={style[key]}
              disabled={key === 'colorByDepth' && !style.showPoints}
              onChange={(e) => onStyleChange({ ...style, [key]: e.target.checked })}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </section>
  );
}
