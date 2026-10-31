import { useEffect, useMemo, useRef } from 'react';
import { ModeComparison } from '../core/modeComparison.js';

const SAMPLE_MS = 500;

/**
 * Algoritma Modu açık/kapalı FPS ve kare süresi karşılaştırması.
 * Kamera çalışırken her 0,5 sn'de bir PerfMonitor örneği alır; React durumu
 * güncellemez (panel açıkken kendi zamanlayıcısıyla okur).
 */
export function useModeComparison(perf, running, algoOn) {
  const comparison = useMemo(() => new ModeComparison(), []);
  const onRef = useRef(algoOn);
  onRef.current = algoOn;

  useEffect(() => {
    if (!running) return undefined;
    comparison.pause(); // kamera yeniden açıldı: ilk örnekler ısınma sayılır
    const id = setInterval(() => comparison.sample(onRef.current, perf.snapshot(), performance.now()), SAMPLE_MS);
    return () => clearInterval(id);
  }, [running, perf, comparison]);

  return comparison;
}
