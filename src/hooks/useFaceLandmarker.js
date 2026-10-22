import { useEffect, useRef, useState } from 'react';
import { createFaceLandmarker } from '../core/faceLandmarker.js';

/**
 * Face Landmarker modelini bir kez yükler.
 * Durum: 'loading' → 'ready' | 'error'. Yükleme süresi ve kullanılan
 * hızlandırıcı (GPU/CPU) raporlama için döndürülür.
 */
export function useFaceLandmarker() {
  const landmarkerRef = useRef(null);
  const [state, setState] = useState({ status: 'loading', delegate: null, loadMs: null, error: null });

  useEffect(() => {
    let cancelled = false;
    const t0 = performance.now();

    createFaceLandmarker()
      .then(({ landmarker, delegate }) => {
        if (cancelled) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;
        setState({ status: 'ready', delegate, loadMs: performance.now() - t0, error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        setState({
          status: 'error',
          delegate: null,
          loadMs: null,
          error: `Yüz modeli yüklenemedi: ${err?.message ?? err}. "npm run model" komutunu çalıştırdığınızdan emin olun.`,
        });
      });

    return () => {
      cancelled = true;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, []);

  return { landmarkerRef, ...state };
}
