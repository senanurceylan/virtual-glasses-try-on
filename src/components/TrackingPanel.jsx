import { LANDMARK_COUNT } from '../core/landmarkUtils.js';

const OVERLAY_TOGGLES = [
  { key: 'showPoints', label: '478 yüz noktası' },
  { key: 'colorByDepth', label: 'Noktaları derinliğe göre renklendir (z)' },
  { key: 'showContours', label: 'Konturlar (göz, kaş, dudak, iris)' },
  { key: 'showBox', label: 'Yüz sınır kutusu' },
];

/** Yüz takibi modelinin bilgileri. */
export function ModelInfo({ model, faceVisible }) {
  return (
    <div className="panel-body">
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
    </div>
  );
}

/**
 * Algoritma katmanları: yüz noktaları, konturlar, yerleştirme geometrisi ve
 * (3D modda) occlusion maskeleri. Sunumda algoritmayı göstermek için açılır.
 */
export function LayersPanel({ style, onStyleChange, view, onViewChange }) {
  const setView = (key) => (e) => onViewChange({ ...view, [key]: e.target.checked });
  return (
    <div className="panel-body">
      <div className="toggles toggles--flat">
        {OVERLAY_TOGGLES.map(({ key, label }) => (
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
        <label className="toggle">
          <input type="checkbox" checked={view.showGeometry} onChange={setView('showGeometry')} />
          <span>Yerleştirme geometrisi (göz merkezleri, eğim açısı)</span>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={view.showOccluders} disabled={view.mode !== '3d'} onChange={setView('showOccluders')} />
          <span>Occlusion maskeleri (yalnızca 3D: yüz ağı, kafa)</span>
        </label>
      </div>
    </div>
  );
}

/** Yüz takibinin kısa durumu (başlıkta gösterilir). */
export function trackingStatus({ model, running, faceVisible }) {
  if (model.status === 'loading') return { text: 'Model yükleniyor…', tone: 'muted' };
  if (model.status === 'error') return { text: 'Model hatası', tone: 'error' };
  if (!running) return { text: 'Kamera kapalı', tone: 'muted' };
  if (faceVisible) return { text: 'Yüz algılandı', tone: 'ok' };
  return { text: 'Yüz aranıyor', tone: 'warn' };
}
