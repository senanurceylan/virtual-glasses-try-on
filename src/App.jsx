import { useMemo, useRef, useState } from 'react';
import { CameraStage } from './components/CameraStage.jsx';
import { FaceShapePanel } from './components/FaceShapePanel.jsx';
import { PlacementPanel } from './components/PlacementPanel.jsx';
import { StabilityPanel } from './components/StabilityPanel.jsx';
import { StatusBar } from './components/StatusBar.jsx';
import { TrackingPanel } from './components/TrackingPanel.jsx';
import { DEFAULT_FRAME_ID } from './core/frameStyles.js';
import { DEFAULT_PARAMS } from './core/oneEuroFilter.js';
import { PerfMonitor } from './core/perfMonitor.js';
import { useCamera } from './hooks/useCamera.js';
import { useFaceLandmarker } from './hooks/useFaceLandmarker.js';
import { useFaceTracking } from './hooks/useFaceTracking.js';
import { useGlassesModel } from './hooks/useGlassesModel.js';
import { useGlassesScene } from './hooks/useGlassesScene.js';
import { DEFAULT_STYLE } from './render/landmarkOverlay.js';

// Gözlük denerken yüz noktaları varsayılan olarak kapalı; panelden açılabilir.
const INITIAL_OVERLAY = { ...DEFAULT_STYLE, showPoints: false, showContours: false, showBox: false };

/** Sahnenin üstünde gösterilecek uyarıyı seçer (yoksa null). */
function stageNotice(model, faceVisible) {
  if (model.status === 'loading') return { tone: 'info', title: 'Yüz modeli yükleniyor…' };
  if (model.status === 'error') return { tone: 'error', title: 'Model yüklenemedi', text: model.error };
  if (!faceVisible) {
    return {
      tone: 'warn',
      title: 'Yüz algılanamadı',
      text: 'Kameraya doğru bakın, yüzünüzün tamamen kadrajda ve iyi aydınlatılmış olduğundan emin olun.',
    };
  }
  return null;
}

export default function App() {
  const camera = useCamera();
  const model = useFaceLandmarker();
  const perf = useMemo(() => new PerfMonitor({ windowSize: 60 }), []);
  const overlayCanvasRef = useRef(null);
  const glassesCanvasRef = useRef(null);
  const threeCanvasRef = useRef(null);
  const [overlayStyle, setOverlayStyle] = useState(INITIAL_OVERLAY);
  const [view, setView] = useState({
    mode: '2d',
    showGlasses: true,
    showGeometry: false,
    showOccluders: false,
    stabilize: true,
    filterParams: { ...DEFAULT_PARAMS },
  });
  const scene3D = useGlassesScene(threeCanvasRef, view.mode === '3d');
  const [glassesId, setGlassesId] = useState(DEFAULT_FRAME_ID);
  const { model: glassesModel, glasses } = useGlassesModel(glassesId);
  const running = camera.status === 'ready';

  const { faceVisible, placementRef, stabilityRef, faceShapeRef } = useFaceTracking({
    videoRef: camera.videoRef,
    overlayCanvasRef,
    glassesCanvasRef,
    sceneRef: scene3D.sceneRef,
    landmarkerRef: model.landmarkerRef,
    perf,
    enabled: running && model.status === 'ready',
    options: { overlay: overlayStyle, glasses, ...view },
  });

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-icon" aria-hidden>👓</span>
          <div>
            <h1>Sanal Gözlük Deneme</h1>
            <p>Gerçek zamanlı yüz takibi ile gözlük deneme</p>
          </div>
        </div>
        {running && (
          <button className="btn btn--ghost" onClick={camera.stop}>
            Kamerayı kapat
          </button>
        )}
      </header>

      <main className="app-main">
        <CameraStage
          videoRef={camera.videoRef}
          status={camera.status}
          error={camera.error}
          info={camera.info}
          onRetry={camera.start}
          notice={stageNotice(model, faceVisible)}
        >
          <canvas ref={glassesCanvasRef} className="stage-canvas" />
          <canvas ref={threeCanvasRef} className="stage-canvas" />
          <canvas ref={overlayCanvasRef} className="stage-canvas" />
        </CameraStage>

        <aside className="side-panel">
          <FaceShapePanel faceShapeRef={faceShapeRef} selectedId={glassesId} onSelect={setGlassesId} />
          <PlacementPanel
            placementRef={placementRef}
            glasses={glassesModel}
            view={view}
            onViewChange={setView}
            scene3D={scene3D}
          />
          <StabilityPanel placementRef={placementRef} stabilityRef={stabilityRef} view={view} onViewChange={setView} />
          <TrackingPanel
            model={model}
            faceVisible={faceVisible}
            running={running}
            style={overlayStyle}
            onStyleChange={setOverlayStyle}
          />
        </aside>
      </main>

      <StatusBar perf={perf} cameraInfo={camera.info} running={running} />
    </div>
  );
}
