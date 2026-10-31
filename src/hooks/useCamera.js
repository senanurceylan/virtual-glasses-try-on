import { useEffect, useMemo, useRef, useState } from 'react';
import { attachStream, openCameraStream, stopCamera } from '../core/camera.js';
import { createCameraController } from '../core/cameraController.js';

/**
 * Kamerayı yönetir (durumlar için bkz. core/cameraController.js).
 * Sayfa açılınca kamerayı otomatik başlatır, bileşen kapanınca durdurur.
 * `start` / `stop` kullanıcı düğmelerine bağlanır; durdurulan kamera yeniden başlatılabilir.
 */
export function useCamera() {
  const videoRef = useRef(null);
  const [state, setState] = useState({ status: 'idle', error: null, errorName: null, info: null });

  const controller = useMemo(
    () =>
      createCameraController({
        open: () => openCameraStream(),
        attach: (stream) => attachStream(videoRef.current, stream),
        release: (stream) => stopCamera(stream, videoRef.current),
        onChange: setState,
      }),
    [],
  );

  useEffect(() => {
    controller.start();
    return () => controller.stop();
  }, [controller]);

  return { videoRef, ...state, start: controller.start, stop: controller.stop };
}
