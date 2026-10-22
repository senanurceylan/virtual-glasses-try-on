/**
 * Kamera sahnesi: video ve üstüne binen canvas katmanları (children).
 * Ayna görüntüsü için tüm `.stage-layers` kapsayıcısı yatayda çevrilir;
 * böylece canvas katmanları videoyla aynı koordinatlarda kalır.
 * `notice` aynalanmamış katmanda gösterilir (yazı ters görünmesin diye).
 */
export function CameraStage({ videoRef, status, error, info, onRetry, notice, children }) {
  const aspect = info?.width && info?.height ? `${info.width} / ${info.height}` : '16 / 9';

  return (
    <div className="stage" style={{ aspectRatio: aspect }}>
      <div className="stage-layers">
        <video ref={videoRef} className="stage-video" playsInline muted />
        {children}
      </div>

      {status === 'ready' && notice && (
        <div className={`stage-notice stage-notice--${notice.tone ?? 'info'}`} role="status">
          {notice.title && <strong>{notice.title}</strong>}
          {notice.text && <span>{notice.text}</span>}
        </div>
      )}

      {status === 'starting' && (
        <div className="stage-message">
          <div className="spinner" />
          <p>Kamera açılıyor…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="stage-message stage-message--error">
          <p>{error}</p>
          <button className="btn" onClick={onRetry}>
            Tekrar dene
          </button>
        </div>
      )}

      {status === 'idle' && (
        <div className="stage-message">
          <p>Kamera kapalı</p>
          <button className="btn" onClick={onRetry}>
            Kamerayı aç
          </button>
        </div>
      )}
    </div>
  );
}
