import { useEffect, useMemo, useRef, useState } from 'react';
import { detectFaces, FACE_CONTOURS } from '../core/faceLandmarker.js';
import { FacePresence } from '../core/facePresence.js';
import { createMonotonicClock } from '../core/landmarkUtils.js';
import { drawLandmarkOverlay, syncCanvasSize } from '../render/landmarkOverlay.js';
import { useFrameLoop } from './useFrameLoop.js';

/**
 * Kare başına işlem hattı:
 *   video karesi → [Tespit] MediaPipe 478 nokta → [Çizim] canvas → yüz var/yok durumu
 *
 * Her adımın süresi PerfMonitor'a "Tespit" ve "Çizim" adıyla kaydedilir.
 * React state yalnızca yüz görünürlüğü değiştiğinde güncellenir.
 * En son tespit edilen yüz `lastFaceRef` ile sonraki aşamalara açılır.
 */
export function useFaceTracking({ videoRef, canvasRef, landmarkerRef, perf, enabled, style }) {
  const clock = useMemo(() => createMonotonicClock(), []);
  const presence = useMemo(() => new FacePresence(), []);
  const [faceVisible, setFaceVisible] = useState(false);
  const visibleRef = useRef(false);
  const lastFaceRef = useRef(null);
  const ctxRef = useRef(null);
  const styleRef = useRef(style);
  styleRef.current = style;

  useFrameLoop(videoRef, perf, enabled, (video, now) => {
    const landmarker = landmarkerRef.current;
    const canvas = canvasRef.current;
    if (!landmarker || !canvas || !video.videoWidth) return;

    if (!ctxRef.current) ctxRef.current = canvas.getContext('2d');
    syncCanvasSize(canvas, video.videoWidth, video.videoHeight);

    const faces = perf.measure('Tespit', () => detectFaces(landmarker, video, clock(now)));
    const face = faces[0] ?? null;
    lastFaceRef.current = face;

    perf.measure('Çizim', () => drawLandmarkOverlay(ctxRef.current, face, FACE_CONTOURS, styleRef.current));

    const visible = presence.update(face !== null);
    if (visible !== visibleRef.current) {
      visibleRef.current = visible;
      setFaceVisible(visible);
    }
  });

  // Döngü durunca (kamera kapandı vb.) eski çizimi ve durumu temizle.
  useEffect(() => {
    if (enabled) return;
    const canvas = canvasRef.current;
    canvas?.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    presence.reset();
    lastFaceRef.current = null;
    visibleRef.current = false;
    setFaceVisible(false);
  }, [enabled, canvasRef, presence]);

  return { faceVisible, lastFaceRef, presence };
}
