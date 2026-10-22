import { useMemo, useRef, useState } from 'react';
import { CameraStage } from './components/CameraStage.jsx';
import { StatusBar } from './components/StatusBar.jsx';
import { TrackingPanel } from './components/TrackingPanel.jsx';
import { PerfMonitor } from './core/perfMonitor.js';
import { useCamera } from './hooks/useCamera.js';
import { useFaceLandmarker } from './hooks/useFaceLandmarker.js';
import { useFaceTracking } from './hooks/useFaceTracking.js';
import { DEFAULT_STYLE } from './render/landmarkOverlay.js';

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
  const canvasRef = useRef(null);
  const [overlayStyle, setOverlayStyle] = useState(DEFAULT_STYLE);
  const running = camera.status === 'ready';

  const { faceVisible } = useFaceTracking({
    videoRef: camera.videoRef,
    canvasRef,
    landmarkerRef: model.landmarkerRef,
    perf,
    enabled: running && model.status === 'ready',
    style: overlayStyle,
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
          <canvas ref={canvasRef} className="stage-canvas" />
        </CameraStage>

        <aside className="side-panel">
          <TrackingPanel
            model={model}
            faceVisible={faceVisible}
            running={running}
            style={overlayStyle}
            onStyleChange={setOverlayStyle}
          />
          <section className="card">
            <h2>Gözlükler</h2>
            <p className="muted">Gözlük modelleri Aşama 2'de eklenecek.</p>
          </section>
          <section className="card">
            <h2>Yüz şekli</h2>
            <p className="muted">Yüz şekli tahmini Aşama 5'te eklenecek.</p>
          </section>
        </aside>
      </main>

      <StatusBar perf={perf} cameraInfo={camera.info} running={running} />
    </div>
  );
}
