import { useCallback, useRef } from 'react';
import { captureToBlob, snapshotLayers } from '../render/snapshot.js';

const TIMEOUT_MS = 1500;

/**
 * Ekran görüntüsü isteği. `capture()` bir sonraki kare çizildiğinde katmanları
 * birleştirir ve PNG Blob döndürür. Görüntü tarayıcıda kalır, sunucuya gönderilmez.
 * @returns {{ captureRef, capture: (opts) => Promise<{blob, width, height, mode}> }}
 */
export function useSnapshot() {
  const captureRef = useRef(null);

  const capture = useCallback(
    ({ showGlasses = true, includeOverlay = false } = {}) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          captureRef.current = null;
          reject(new Error('Kamera görüntüsü alınamadı (kamera çalışıyor mu?).'));
        }, TIMEOUT_MS);
        captureRef.current = ({ layers, mode, width, height }) => {
          clearTimeout(timer);
          captureToBlob(snapshotLayers(layers, { mode, showGlasses, includeOverlay }), width, height)
            .then((blob) => resolve({ blob, width, height, mode }))
            .catch(reject);
        };
      }),
    [],
  );

  return { captureRef, capture };
}
