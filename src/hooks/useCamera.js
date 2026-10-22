import { useCallback, useEffect, useRef, useState } from 'react';
import { attachStream, describeCameraError, openCameraStream, stopCamera } from '../core/camera.js';

/**
 * Kamerayı yönetir. Durumlar: 'idle' → 'starting' → 'ready' | 'error'.
 * Sayfa açılınca kamerayı otomatik başlatır, bileşen kapanınca durdurur.
 *
 * `generation` sayacı: start() beklerken stop() çağrılırsa (ör. React StrictMode
 * effect'i iki kez çalıştırdığında) geç gelen akış hemen kapatılır, açık kalmaz.
 */
export function useCamera() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const generation = useRef(0);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null); // { width, height, frameRate }

  const start = useCallback(async () => {
    const video = videoRef.current;
    if (!video || streamRef.current) return;
    const gen = ++generation.current;
    setStatus('starting');
    setError(null);
    try {
      const stream = await openCameraStream();
      if (gen !== generation.current) {
        stopCamera(stream);
        return;
      }
      streamRef.current = stream;
      setInfo(await attachStream(video, stream));
      setStatus('ready');
    } catch (err) {
      if (gen !== generation.current) return;
      setError(describeCameraError(err));
      setStatus('error');
    }
  }, []);

  const stop = useCallback(() => {
    generation.current++;
    stopCamera(streamRef.current, videoRef.current);
    streamRef.current = null;
    setStatus('idle');
  }, []);

  useEffect(() => {
    start();
    return stop;
  }, [start, stop]);

  return { videoRef, status, error, info, start, stop };
}
