import { useEffect, useState } from 'react';
import { GLASSES, loadImage } from '../render/glassesCatalog.js';

/** Seçili gözlük modelinin görselini yükler. Dönen `glasses` yüklenene kadar null'dır. */
export function useGlassesModel(id) {
  const model = GLASSES.find((g) => g.id === id) ?? GLASSES[0];
  const [state, setState] = useState({ glasses: null, error: null });

  useEffect(() => {
    let cancelled = false;
    setState({ glasses: null, error: null });
    loadImage(model.src)
      .then((image) => !cancelled && setState({ glasses: { ...model, image }, error: null }))
      .catch((err) => !cancelled && setState({ glasses: null, error: err.message }));
    return () => {
      cancelled = true;
    };
  }, [model]);

  return { model, ...state };
}
