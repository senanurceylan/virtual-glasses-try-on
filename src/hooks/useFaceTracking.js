import { useEffect, useMemo, useRef, useState } from 'react';
import { landmarkRegions } from '../core/algorithmLayers.js';
import { detectFrame, FACE_CONTOURS, FACE_TESSELATION } from '../core/faceLandmarker.js';
import { FacePresence } from '../core/facePresence.js';
import { FaceShapeEstimator } from '../core/faceShapeEstimator.js';
import { createMonotonicClock } from '../core/landmarkUtils.js';
import { computePlacement } from '../core/placementPipeline.js';
import { StabilityMonitor } from '../core/stabilityMonitor.js';
import { CHEEK_POINTS, FOREHEAD_POINTS, skinCoverage } from '../core/skinCheck.js';
import { PlacementStabilizer } from '../core/stabilizer.js';
import { drawAlgorithmLabels, drawAlgorithmOverlay } from '../render/algorithmOverlay.js';
import { drawGlasses, drawPlacementGeometry } from '../render/glassesRenderer.js';
import { drawLandmarkOverlay, syncCanvasSize } from '../render/landmarkOverlay.js';
import { createPixelSampler } from '../render/pixelSampler.js';
import { useFrameLoop } from './useFrameLoop.js';

/**
 * Kare başına işlem hattı:
 *   video karesi
 *     → [Tespit]       MediaPipe: 478 yüz noktası + 4×4 kafa pozu matrisi
 *     → [Yerleştirme]  ham ölçüm (göz merkezleri, mesafe, açı, matristen dönme)
 *                      → One Euro stabilizasyonu (açıksa)
 *                      → 2D afin matris / 3D poz (ikisi de filtrelenmiş ölçümden)
 *     → [Çizim]        2D gözlük canvas'ı ya da nokta/geometri katmanı
 *     → [Algoritma]    yalnızca Algoritma Modu açıkken: işlem adımlarının görselleştirmesi
 *                      (aynalı canvas'a çizgiler, aynalanmamış canvas'a etiketler ve eksenler).
 *                      Kapalıyken hiçbir ek çizim ya da hesap yapılmaz.
 *     → [3D çizim]     Three.js (yalnızca 3D modda)
 *     → [Yüz şekli]    oranlar + çok kareli tahmin (her 10 karede bir alın ten kontrolü)
 *     → yüz var/yok durumu
 *
 * React state yalnızca yüz görünürlüğü değiştiğinde güncellenir; son yerleştirme
 * verisi `placementRef`, ham/filtreli titreme ölçümü `stabilityRef`, yüz şekli durumu
 * `faceShapeRef` ile paneller tarafından periyodik okunur.
 *
 * captureRef: ekran görüntüsü isteği (fonksiyon). Kare çizildikten hemen sonra, aynı
 * görevde katmanlarla çağrılır; böylece WebGL çizimi henüz temizlenmemiştir.
 *
 * options: { mode: '2d'|'3d', overlay, showGlasses, showGeometry, showOccluders,
 *            stabilize, filterParams: {minCutoff, beta, dCutoff},
 *            glasses: {image, anchors} | null,
 *            algorithm: {enabled, layers} (Algoritma Modu) }
 */
export function useFaceTracking({
  videoRef,
  overlayCanvasRef,
  glassesCanvasRef,
  labelCanvasRef,
  sceneRef,
  landmarkerRef,
  perf,
  enabled,
  options,
  captureRef,
}) {
  const clock = useMemo(() => createMonotonicClock(), []);
  const presence = useMemo(() => new FacePresence(), []);
  const [faceVisible, setFaceVisible] = useState(false);
  const visibleRef = useRef(false);
  const stabilizer = useMemo(() => new PlacementStabilizer(), []);
  const stability = useMemo(() => new StabilityMonitor(), []);
  const faceShape = useMemo(() => new FaceShapeEstimator(), []);
  const faceShapeRef = useRef(faceShape);
  const samplerRef = useRef(null);
  const frameCountRef = useRef(0);
  const placementRef = useRef(null); // computePlacement() çıktısı
  const stabilityRef = useRef(stability);
  const algoAssets = useMemo(() => ({ regions: landmarkRegions(FACE_CONTOURS), tesselation: FACE_TESSELATION }), []);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useFrameLoop(videoRef, perf, enabled, (video, now) => {
    const landmarker = landmarkerRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    const glassesCanvas = glassesCanvasRef.current;
    if (!landmarker || !overlayCanvas || !glassesCanvas || !video.videoWidth) return;

    const width = video.videoWidth;
    const height = video.videoHeight;
    syncCanvasSize(overlayCanvas, width, height);
    syncCanvasSize(glassesCanvas, width, height);
    const opts = optionsRef.current;
    const algo = opts.algorithm?.enabled ? opts.algorithm : null;
    const scene = opts.mode === '3d' ? sceneRef.current : null;

    const { faces, matrices } = perf.measure('Tespit', () => detectFrame(landmarker, video, clock(now)));
    const face = faces[0] ?? null;
    const matrix = matrices[0] ?? null;

    const placement = perf.measure('Yerleştirme', () =>
      computePlacement({
        face,
        matrix,
        width,
        height,
        anchors: opts.glasses?.anchors,
        stabilizer,
        timeSec: now / 1000, // gerçek kare zamanı: filtre FPS değişse de aynı davranır
      }),
    );
    placementRef.current = placement;
    stability.update(placement);

    perf.measure('Çizim', () => {
      // 2D gözlük yalnızca 2D modda; 3D modda bu katman boş kalır.
      const transform2D = opts.showGlasses && !scene ? placement?.transform : null;
      drawGlasses(glassesCanvas.getContext('2d'), opts.glasses?.image, transform2D);

      if (algo) return; // Algoritma Modu aynı canvas'ı kendi çizer
      const octx = overlayCanvas.getContext('2d');
      drawLandmarkOverlay(octx, face, FACE_CONTOURS, opts.overlay);
      if (opts.showGeometry && placement) drawPlacementGeometry(octx, placement.metrics);
    });

    const labelCanvas = labelCanvasRef?.current;
    if (algo && labelCanvas) {
      perf.measure('Algoritma', () => {
        syncCanvasSize(labelCanvas, width, height);
        const image = opts.glasses?.image;
        const frame = {
          face,
          placement,
          glassesSize: image ? { width: image.naturalWidth || image.width, height: image.naturalHeight || image.height } : null,
        };
        drawAlgorithmOverlay(overlayCanvas.getContext('2d'), frame, algo.layers, algoAssets);
        drawAlgorithmLabels(labelCanvas.getContext('2d'), frame, algo.layers);
      });
    }

    if (scene) {
      perf.measure('3D çizim', () => {
        scene.setSize(width, height);
        scene.setStyle(opts.glasses?.style);
        scene.setOccluderDebug(Boolean(opts.showOccluders));
        scene.update(face, opts.showGlasses ? placement?.pose : null);
        scene.render();
      });
    }

    const capture = captureRef?.current;
    if (capture) {
      captureRef.current = null;
      capture({
        layers: { video, glassesCanvas, threeCanvas: scene?.renderer.domElement ?? null, overlayCanvas },
        mode: scene ? '3d' : '2d', // 3D başlatılamadıysa 2D çizilir
        width,
        height,
      });
    }

    perf.measure('Yüz şekli', () => {
      // Alın görünürlüğü piksel okuma gerektirdiği için seyrek yapılır.
      if (face && frameCountRef.current++ % 10 === 0) {
        samplerRef.current ??= createPixelSampler();
        const px = samplerRef.current(video, face, { forehead: FOREHEAD_POINTS, cheeks: CHEEK_POINTS });
        if (px) faceShape.setForeheadCoverage(skinCoverage(px.forehead, px.cheeks));
      }
      faceShape.update(face, placement?.raw.pose?.angles ?? null, width, height);
    });

    const visible = presence.update(face !== null);
    if (visible !== visibleRef.current) {
      visibleRef.current = visible;
      setFaceVisible(visible);
    }
  });

  // Filtre ayarları: açma/kapama durumu sıfırlar, parametreler anında uygulanır.
  const { stabilize = true, filterParams } = options;
  useEffect(() => {
    stabilizer.setEnabled(stabilize);
    stability.reset();
  }, [stabilize, stabilizer, stability]);
  useEffect(() => {
    if (filterParams) stabilizer.setParams(filterParams);
  }, [filterParams, stabilizer]);

  // Algoritma Modu kapanınca etiket katmanını temizle ve süre kaydını sil
  // (nokta katmanı bir sonraki karede normal çizimle yeniden çizilir).
  const algoEnabled = Boolean(options.algorithm?.enabled);
  useEffect(() => {
    if (algoEnabled) return;
    const canvas = labelCanvasRef?.current;
    canvas?.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    perf.drop('Algoritma');
  }, [algoEnabled, labelCanvasRef, perf]);

  // 3D moddan çıkınca 3D canvas'ı temizle (2D gözlük bir sonraki karede çizilir).
  const mode = options.mode;
  useEffect(() => {
    if (mode !== '3d') sceneRef.current?.clear();
  }, [mode, sceneRef]);

  // Döngü durunca (kamera kapandı vb.) eski çizimleri ve durumu temizle.
  useEffect(() => {
    if (enabled) return;
    for (const canvas of [overlayCanvasRef.current, glassesCanvasRef.current, labelCanvasRef?.current]) {
      canvas?.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    }
    sceneRef.current?.clear();
    presence.reset();
    stabilizer.reset();
    stability.reset();
    faceShape.reset();
    placementRef.current = null;
    visibleRef.current = false;
    setFaceVisible(false);
  }, [enabled, overlayCanvasRef, glassesCanvasRef, labelCanvasRef, sceneRef, presence, stabilizer, stability, faceShape]);

  return { faceVisible, placementRef, stabilityRef, faceShapeRef, presence };
}
