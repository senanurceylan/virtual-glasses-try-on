import { useEffect, useState } from 'react';

const REFRESH_MS = 250;

function fmt(n, digits = 1) {
  return Number.isFinite(n) ? n.toFixed(digits) : '–';
}

/**
 * FPS ve aşama sürelerini gösterir. Kare döngüsünü React'e bağlamamak için
 * PerfMonitor'u saniyede 4 kez okur (her karede yeniden render yok).
 */
export function StatusBar({ perf, cameraInfo, running }) {
  const [snap, setSnap] = useState(() => perf.snapshot());

  useEffect(() => {
    const id = setInterval(() => setSnap(perf.snapshot()), REFRESH_MS);
    return () => clearInterval(id);
  }, [perf]);

  const stages = Object.entries(snap.stages);

  return (
    <footer className="status-bar">
      <Metric label="FPS" value={running ? fmt(snap.fps) : '–'} highlight />
      <Metric label="Kare süresi" value={running ? `${fmt(snap.frameMs.avg, 2)} ms` : '–'} />
      {stages.map(([name, s]) => (
        <Metric key={name} label={name} value={`${fmt(s.avg, 2)} ms`} />
      ))}
      <span className="status-spacer" />
      <Metric
        label="Kamera"
        value={cameraInfo ? `${cameraInfo.width}×${cameraInfo.height} @ ${fmt(cameraInfo.frameRate, 0)} fps` : '–'}
      />
    </footer>
  );
}

function Metric({ label, value, highlight }) {
  return (
    <span className={`metric${highlight ? ' metric--highlight' : ''}`}>
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
    </span>
  );
}
