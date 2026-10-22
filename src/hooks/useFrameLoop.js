import { useEffect, useRef } from 'react';

/**
 * Her yeni kamera karesinde `onFrame(video, timestampMs)` çağırır.
 *
 * Mümkünse requestVideoFrameCallback kullanılır: yalnızca kameradan gerçekten
 * yeni bir kare geldiğinde tetiklenir, aynı kare iki kez işlenmez.
 * Desteklemeyen tarayıcıda requestAnimationFrame + currentTime kontrolüne düşer.
 *
 * Her karenin toplam süresi ve FPS `perf` (PerfMonitor) ile ölçülür.
 * onFrame her render'da değişebilir; ref'te tutulduğu için döngü yeniden kurulmaz.
 */
export function useFrameLoop(videoRef, perf, enabled, onFrame) {
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  useEffect(() => {
    const video = videoRef.current;
    if (!enabled || !video) return undefined;

    let handle = null;
    let stopped = false;
    const useVfc = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
    let lastVideoTime = -1;

    const process = (timestamp) => {
      perf.frameStart();
      onFrameRef.current?.(video, timestamp);
      perf.frameEnd();
    };

    const tickVfc = (now) => {
      if (stopped) return;
      process(now);
      handle = video.requestVideoFrameCallback(tickVfc);
    };

    const tickRaf = (now) => {
      if (stopped) return;
      if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        process(now);
      }
      handle = requestAnimationFrame(tickRaf);
    };

    perf.reset();
    handle = useVfc ? video.requestVideoFrameCallback(tickVfc) : requestAnimationFrame(tickRaf);

    return () => {
      stopped = true;
      if (useVfc) video.cancelVideoFrameCallback(handle);
      else cancelAnimationFrame(handle);
    };
  }, [videoRef, perf, enabled]);
}
