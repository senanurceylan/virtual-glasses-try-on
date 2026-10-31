const PERMISSION_HELP = [
  'Adres çubuğunun solundaki kamera / kilit simgesine tıklayın ve kameraya "İzin ver" deyin.',
  'macOS: Sistem Ayarları → Gizlilik ve Güvenlik → Kamera bölümünde tarayıcınızı açın.',
  'Ardından "Tekrar dene" düğmesine basın (gerekirse sayfayı yenileyin).',
];

/**
 * Kamera sahnesi: video ve üstüne binen canvas katmanları (children).
 * Ayna görüntüsü için tüm `.stage-layers` kapsayıcısı yatayda çevrilir;
 * böylece canvas katmanları videoyla aynı koordinatlarda kalır.
 * `notice`, `hud` ve `toolbar` aynalanmamış katmanda gösterilir (yazı ters görünmesin diye).
 *
 * Durumlar: idle (kamera kapalı) · starting (açılıyor) · error (izin vb.) · ready.
 */
export function CameraStage({ videoRef, status, error, errorName, info, onStart, notice, hud, toolbar, children }) {
  const aspect = info?.width && info?.height ? `${info.width} / ${info.height}` : '16 / 9';
  const permissionDenied = errorName === 'NotAllowedError' || errorName === 'SecurityError';

  return (
    <div className="stage" style={{ aspectRatio: aspect }}>
      <div className="stage-layers">
        <video ref={videoRef} className="stage-video" playsInline muted />
        {children}
      </div>

      {status === 'ready' && hud}
      {status === 'ready' && notice && (
        <div className={`stage-notice stage-notice--${notice.tone ?? 'info'}`} role="status">
          {notice.title && <strong>{notice.title}</strong>}
          {notice.text && <span>{notice.text}</span>}
        </div>
      )}
      {status === 'ready' && toolbar}

      {status === 'starting' && (
        <div className="stage-message" role="status">
          <div className="spinner" />
          <p>Kamera açılıyor…</p>
          <p className="muted small">Tarayıcı izin isterse "İzin ver"i seçin.</p>
        </div>
      )}

      {status === 'error' && (
        <div className="stage-message stage-message--error" role="alert">
          <strong>{permissionDenied ? 'Kamera izni verilmedi' : 'Kamera açılamadı'}</strong>
          {!permissionDenied && <p>{error}</p>}
          {permissionDenied && (
            <ol className="help-list">
              {PERMISSION_HELP.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ol>
          )}
          <button className="btn" onClick={onStart}>
            Tekrar dene
          </button>
        </div>
      )}

      {status === 'idle' && (
        <div className="stage-message">
          <strong>Kamera kapalı</strong>
          <p className="muted small">Görüntü yalnızca bu tarayıcıda işlenir; hiçbir yere gönderilmez.</p>
          <button className="btn" onClick={onStart}>
            Kamerayı başlat
          </button>
        </div>
      )}
    </div>
  );
}
