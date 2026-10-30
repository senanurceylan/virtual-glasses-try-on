import { useEffect, useState } from 'react';
import { GLASSES, loadImage } from '../render/glassesCatalog.js';

const cache = new Map(); // id → Promise<HTMLImageElement>

/**
 * Seçili gözlük modelinin görselini yükler. Model değişince yeni görsel yüklenene kadar
 * önceki gözlük gösterilmeye devam eder (geçişte boş kare olmaz). İlk yüklemede `glasses` null'dır.
 */
export function useGlassesModel(id) {
  const model = GLASSES.find((g) => g.id === id) ?? GLASSES[0];
  const [state, setState] = useState({ glasses: null, error: null });

  useEffect(() => {
    let cancelled = false;
    if (!cache.has(model.id)) cache.set(model.id, loadImage(model.src));
    cache
      .get(model.id)
      .then((image) => !cancelled && setState({ glasses: { ...model, image }, error: null }))
      .catch((err) => {
        cache.delete(model.id);
        if (!cancelled) setState((s) => ({ ...s, error: err.message }));
      });
    return () => {
      cancelled = true;
    };
  }, [model]);

  return { model, ...state };
}
