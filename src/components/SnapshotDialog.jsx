import { useEffect, useMemo } from 'react';

/**
 * Ekran görüntüsü önizlemesi. Görüntü tarayıcı belleğinde (Blob URL) durur;
 * "İndir" yalnızca kullanıcının bilgisayarına kaydeder, hiçbir sunucuya gönderilmez.
 */
export function SnapshotDialog({ snapshot, onClose }) {
  const url = useMemo(() => (snapshot ? URL.createObjectURL(snapshot.blob) : null), [snapshot]);

  useEffect(() => {
    if (!url) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      URL.revokeObjectURL(url);
    };
  }, [url, onClose]);

  if (!snapshot) return null;

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="snap-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="snap-title">Ekran görüntüsü</h2>
        <img src={url} alt={`${snapshot.modelName} gözlükle ekran görüntüsü`} className="dialog-image" />
        <p className="muted small">
          {snapshot.modelName} · {snapshot.mode.toUpperCase()} · {snapshot.width}×{snapshot.height} px. Görüntü yalnızca
          bu tarayıcıda oluşturuldu; hiçbir sunucuya gönderilmedi.
        </p>
        <div className="dialog-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Kapat
          </button>
          <a className="btn" href={url} download={snapshot.fileName}>
            İndir
          </a>
        </div>
      </div>
    </div>
  );
}
