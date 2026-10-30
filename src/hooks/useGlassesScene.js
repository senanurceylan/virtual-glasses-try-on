import { useEffect, useRef, useState } from 'react';
import { FACE_TESSELATION } from '../core/faceLandmarker.js';
import { trianglesFromTesselation } from '../core/faceMesh.js';
import { GlassesScene } from '../render/three/GlassesScene.js';

/**
 * 3D sahneyi ilk kez 3D mod istendiğinde oluşturur (2D kullanan için WebGL maliyeti yok).
 * Durum: 'idle' → 'ready' | 'error'. Hata olursa uygulama 2D modda çalışmaya devam eder.
 */
export function useGlassesScene(canvasRef, wanted) {
  const sceneRef = useRef(null);
  const [state, setState] = useState({ status: 'idle', error: null });

  useEffect(() => {
    if (!wanted || sceneRef.current || !canvasRef.current) return;
    try {
      sceneRef.current = new GlassesScene(canvasRef.current, trianglesFromTesselation(FACE_TESSELATION));
      setState({ status: 'ready', error: null });
    } catch (err) {
      console.error(err);
      setState({ status: 'error', error: `3D görünüm başlatılamadı (WebGL): ${err?.message ?? err}` });
    }
  }, [wanted, canvasRef]);

  useEffect(
    () => () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    },
    [],
  );

  return { sceneRef, ...state };
}
