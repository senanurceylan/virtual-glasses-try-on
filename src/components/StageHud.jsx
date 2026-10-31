import { useEffect, useState } from 'react';

const REFRESH_MS = 500;

/** Kamera üstünde küçük FPS göstergesi (ayrıntılar alttaki performans çubuğunda). */
export function StageHud({ perf, mode }) {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFps(perf.snapshot().fps), REFRESH_MS);
    return () => clearInterval(id);
  }, [perf]);
  const tone = fps >= 24 ? 'ok' : fps >= 15 ? 'warn' : 'error';
  return (
    <div className="stage-hud" aria-hidden>
      <span className={`hud-chip hud-chip--${tone}`}>{Number.isFinite(fps) ? fps.toFixed(0) : '–'} FPS</span>
      <span className="hud-chip">{mode.toUpperCase()}</span>
    </div>
  );
}
