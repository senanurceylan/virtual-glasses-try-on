import { useEffect, useMemo, useState } from 'react';
import { FRAME_STYLES } from '../core/frameStyles.js';
import { recommendFrames } from '../core/recommendations.js';

const REFRESH_MS = 300;

/**
 * Yüz şekli tahmincisinin durumunu periyodik okur ve önerileri hesaplar.
 * Hem yüz analizi paneli hem gözlük kataloğu ("Önerilen" rozetleri) aynı sonucu kullanır.
 *
 * @returns {{ state, shown, stale, recommendations }}
 *   shown : gösterilecek sonuç (güncel ya da son geçerli)
 *   stale : gösterilen sonuç güncel ölçüm değil (ör. baş dönük, ağız açık)
 */
export function useFaceShapeState(faceShapeRef) {
  const [state, setState] = useState(() => ({ ...faceShapeRef.current.state }));

  useEffect(() => {
    const id = setInterval(() => setState({ ...faceShapeRef.current.state }), REFRESH_MS);
    return () => clearInterval(id);
  }, [faceShapeRef]);

  return useFaceShapeView(state);
}

/** Durumdan görünüm verisi (React'e bağlı ama polling'den bağımsız; testlerde doğrudan kullanılır). */
export function useFaceShapeView(state) {
  const shown = state?.result ?? state?.last ?? null;
  const stale = Boolean(shown && !state?.result);
  // Öneriler oranlar anlamlı ölçüde değişince yeniden hesaplanır (kartlar titremesin).
  const ratiosKey = shown ? Object.values(shown.ratios).map((v) => v.toFixed(2)).join() : '';
  const recommendations = useMemo(
    () => (shown ? recommendFrames(shown.ratios, FRAME_STYLES, 3) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ratiosKey],
  );
  return { state, shown, stale, recommendations };
}
