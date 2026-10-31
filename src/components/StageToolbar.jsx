const MODES = [
  { value: '2d', label: '2D', title: 'PNG görsel, afin dönüşüm' },
  { value: '3d', label: '3D', title: 'Three.js modeli, kafa pozu ve occlusion' },
];

/**
 * Kamera üstündeki araç çubuğu: 2D/3D geçişi, gözlüğü göster/gizle, Algoritma Modu ve ekran görüntüsü.
 * Aynalanmamış katmanda durur (yazılar düz okunur).
 */
export function StageToolbar({
  mode,
  onModeChange,
  showGlasses,
  onShowGlassesChange,
  algorithm = false,
  onAlgorithmChange,
  onSnapshot,
  canSnapshot,
  busy,
  scene3D,
}) {
  return (
    <div className="stage-toolbar" role="toolbar" aria-label="Görünüm araçları">
      <div className="segmented segmented--compact" role="radiogroup" aria-label="Görünüm modu">
        {MODES.map((m) => (
          <label key={m.value} className={mode === m.value ? 'is-active' : ''} title={m.title}>
            <input type="radio" name="stage-mode" value={m.value} checked={mode === m.value} onChange={() => onModeChange(m.value)} />
            {m.label}
          </label>
        ))}
      </div>

      <label className="toolbar-toggle" title="Gözlüğü göster / gizle">
        <input type="checkbox" checked={showGlasses} onChange={(e) => onShowGlassesChange(e.target.checked)} />
        <span>Gözlük</span>
      </label>

      {onAlgorithmChange && (
        <label className="toolbar-toggle" title="İşlem adımlarını kamera üzerinde göster">
          <input type="checkbox" checked={algorithm} onChange={(e) => onAlgorithmChange(e.target.checked)} />
          <span>Algoritma</span>
        </label>
      )}

      <button
        type="button"
        className="btn btn--small"
        onClick={onSnapshot}
        disabled={!canSnapshot || busy}
        title={canSnapshot ? 'Seçili gözlükle ekran görüntüsü al' : 'Önce kamerayı başlatın'}
      >
        {busy ? 'Hazırlanıyor…' : '📷 Ekran görüntüsü'}
      </button>

      {mode === '3d' && scene3D.status === 'error' && (
        <span className="toolbar-error" role="alert">
          3D başlatılamadı, 2D gösteriliyor
        </span>
      )}
    </div>
  );
}
