import { useCallback, useMemo, useRef, useState } from 'react';
import { CameraStage } from './components/CameraStage.jsx';
import { Collapsible } from './components/Collapsible.jsx';
import { FaceShapePanel } from './components/FaceShapePanel.jsx';
import { GlassesCatalog } from './components/GlassesCatalog.jsx';
import { PlacementPanel } from './components/PlacementPanel.jsx';
import { SnapshotDialog } from './components/SnapshotDialog.jsx';
import { StabilityPanel } from './components/StabilityPanel.jsx';
import { StageHud } from './components/StageHud.jsx';
import { StageToolbar } from './components/StageToolbar.jsx';
import { StatusBar } from './components/StatusBar.jsx';
import { LayersPanel, ModelInfo, trackingStatus } from './components/TrackingPanel.jsx';
import { DEFAULT_FRAME_ID } from './core/frameStyles.js';
import { DEFAULT_PARAMS } from './core/oneEuroFilter.js';
import { PerfMonitor } from './core/perfMonitor.js';
import { useCamera } from './hooks/useCamera.js';
import { useFaceLandmarker } from './hooks/useFaceLandmarker.js';
import { useFaceShapeState } from './hooks/useFaceShapeState.js';
import { useFaceTracking } from './hooks/useFaceTracking.js';
import { useGlassesModel } from './hooks/useGlassesModel.js';
import { useGlassesScene } from './hooks/useGlassesScene.js';
import { useSnapshot } from './hooks/useSnapshot.js';
import { DEFAULT_STYLE } from './render/landmarkOverlay.js';
import { snapshotFileName } from './render/snapshot.js';

// Gözlük denerken yüz noktaları varsayılan olarak kapalı; teknik panelden açılabilir.
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
  const { captureRef, capture } = useSnapshot();
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
    captureRef,
  });
  const faceShape = useFaceShapeState(faceShapeRef);

  // Ekran görüntüsü: bir sonraki karede katmanlar birleştirilir, önizleme açılır.
  const [snapshot, setSnapshot] = useState(null);
  const [snapState, setSnapState] = useState({ busy: false, error: null });
  const takeSnapshot = useCallback(async () => {
    setSnapState({ busy: true, error: null });
    try {
      const shot = await capture({ showGlasses: view.showGlasses });
      setSnapshot({ ...shot, modelName: glassesModel.name, fileName: snapshotFileName(glassesModel.name) });
      setSnapState({ busy: false, error: null });
    } catch (err) {
      setSnapState({ busy: false, error: err.message });
    }
  }, [capture, view.showGlasses, glassesModel.name]);
  const closeSnapshot = useCallback(() => setSnapshot(null), []);

  const status = trackingStatus({ model, running, faceVisible });
  const mode = view.mode === '3d' && scene3D.status !== 'error' ? '3d' : '2d';

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-icon" aria-hidden>
            👓
          </span>
          <div>
            <h1>Sanal Gözlük Deneme</h1>
            <p>Gerçek zamanlı yüz takibi, yüz şekli analizi ve gözlük önerileri</p>
          </div>
        </div>
        <div className="header-actions">
          <div className={`status-pill status-pill--${status.tone}`} role="status">
            <span className="status-dot" />
            {status.text}
          </div>
          {running || camera.status === 'starting' ? (
            <button className="btn btn--ghost" onClick={camera.stop}>
              ⏹ Kamerayı durdur
            </button>
          ) : (
            <button className="btn" onClick={camera.start}>
              ▶ Kamerayı başlat
            </button>
          )}
        </div>
      </header>

      <main className="layout">
        <div className="layout-main">
          <CameraStage
            videoRef={camera.videoRef}
            status={camera.status}
            error={camera.error}
            errorName={camera.errorName}
            info={camera.info}
            onStart={camera.start}
            notice={stageNotice(model, faceVisible)}
            hud={<StageHud perf={perf} mode={mode} />}
            toolbar={
              <StageToolbar
                mode={view.mode}
                onModeChange={(m) => setView((v) => ({ ...v, mode: m }))}
                showGlasses={view.showGlasses}
                onShowGlassesChange={(on) => setView((v) => ({ ...v, showGlasses: on }))}
                onSnapshot={takeSnapshot}
                canSnapshot={running}
                busy={snapState.busy}
                scene3D={scene3D}
              />
            }
          >
            <canvas ref={glassesCanvasRef} className="stage-canvas" />
            <canvas ref={threeCanvasRef} className="stage-canvas" />
            <canvas ref={overlayCanvasRef} className="stage-canvas" />
          </CameraStage>
          {snapState.error && (
            <p className="error-text" role="alert">
              {snapState.error}
            </p>
          )}

          <GlassesCatalog recommendations={faceShape.recommendations} selectedId={glassesId} onSelect={setGlassesId} />
        </div>

        <aside className="layout-side">
          <FaceShapePanel view={faceShape} selectedId={glassesId} onSelect={setGlassesId} />

          <section className="card card--tech" aria-labelledby="tech-title">
            <h2 id="tech-title">Teknik ayrıntılar</h2>
            <p className="muted small">Algoritmaları göstermek için açılır paneller.</p>
            <Collapsible title="Algoritma katmanları" hint="noktalar, geometri">
              <LayersPanel style={overlayStyle} onStyleChange={setOverlayStyle} view={view} onViewChange={setView} />
            </Collapsible>
            <Collapsible title="Stabilizasyon (One Euro)" hint={view.stabilize ? 'açık' : 'kapalı'}>
              <StabilityPanel placementRef={placementRef} stabilityRef={stabilityRef} view={view} onViewChange={setView} />
            </Collapsible>
            <Collapsible title="Yerleştirme hesapları" hint={mode.toUpperCase()}>
              <PlacementPanel placementRef={placementRef} mode={mode} />
            </Collapsible>
            <Collapsible title="Model bilgisi">
              <ModelInfo model={model} faceVisible={faceVisible} />
            </Collapsible>
          </section>
        </aside>
      </main>

      <StatusBar perf={perf} cameraInfo={camera.info} running={running} />
      <SnapshotDialog snapshot={snapshot} onClose={closeSnapshot} />
    </div>
  );
}
