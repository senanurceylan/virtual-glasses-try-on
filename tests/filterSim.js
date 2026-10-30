// One Euro filtresi için tekrarlanabilir simülasyonlar (testler ve ölçüm scripti ortak kullanır).
//
// Senaryolar (piksel konumu; birim = gözler arası mesafe, IPD = 120 px):
//   static : sabit yüz + Gauss gürültüsü → titreme ne kadar azalıyor?
//   step   : ani sıçrama (1 IPD) → filtre yeni konuma ne kadar sürede ulaşıyor?
//   ramp   : sabit hızla hareket (3 IPD/s ≈ hızlı baş hareketi) → sürekli gecikme (ms)
// Gürültü tohumlu (seeded) üretilir; her çalıştırmada aynı sayı dizisi çıkar.

import { OneEuroFilter } from '../src/core/oneEuroFilter.js';

export const IPD = 120;

/** Tohumlu rastgele sayı üreteci (mulberry32) + Box–Muller ile Gauss gürültüsü. */
export function gaussian(seed = 1) {
  let a = seed >>> 0;
  const uniform = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return () => {
    const u = Math.max(uniform(), 1e-12);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * uniform());
  };
}

const rms = (a) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);

/** Kare zamanları (s); jitter > 0 ise kare aralıkları rastgele ±jitter oranında oynar. */
export function frameTimes(fps, duration, { jitter = 0, seed = 7 } = {}) {
  const rand = gaussian(seed);
  const out = [];
  let t = 0;
  while (t <= duration) {
    out.push(t);
    t += (1 / fps) * (1 + jitter * Math.max(-0.9, Math.min(0.9, rand() * 0.5)));
  }
  return out;
}

/**
 * Sabit sinyal + gürültü. Filtre ısındıktan sonra (warmup) ölçer:
 *   error  : gerçek değerden sapmanın RMS'i (konum titremesi)
 *   delta  : kareden kareye değişimin RMS'i (ekranda görülen "titreme")
 */
export function simulateStatic({ fps = 30, sigma = 1, duration = 6, warmup = 1, params, seed = 1, unit = IPD }) {
  const noise = gaussian(seed);
  const filter = new OneEuroFilter(params);
  const truth = 640;
  const raw = [];
  const filt = [];
  for (const t of frameTimes(fps, duration)) {
    const x = truth + sigma * noise();
    const y = filter.filter(x, t, unit);
    if (t >= warmup) {
      raw.push(x);
      filt.push(y);
    }
  }
  const err = (a) => rms(a.map((v) => v - truth));
  const delta = (a) => rms(a.slice(1).map((v, i) => v - a[i]));
  return {
    rawError: err(raw),
    filtError: err(filt),
    rawDelta: delta(raw),
    filtDelta: delta(filt),
    errorReduction: 1 - err(filt) / err(raw),
    deltaReduction: 1 - delta(filt) / delta(raw),
  };
}

/**
 * Ani sıçrama: t = 1 s'de değer `size` kadar değişir. Sonuçlar:
 *   t50, t90 : filtrenin sıçramanın %50 / %90'ına ulaşma süresi (s)
 *   overshoot: aşma (bir One Euro filtresinde 0 olmalı)
 */
export function simulateStep({ fps = 30, size = IPD, duration = 3, params, sigma = 0, seed = 3, unit = IPD }) {
  const noise = gaussian(seed);
  const filter = new OneEuroFilter(params);
  const stepAt = 1;
  let t50 = null;
  let t90 = null;
  let max = -Infinity;
  for (const t of frameTimes(fps, duration)) {
    const truth = t >= stepAt ? size : 0;
    const y = filter.filter(truth + sigma * noise(), t, unit);
    if (t >= stepAt) {
      max = Math.max(max, y);
      if (t50 === null && y >= 0.5 * size) t50 = t - stepAt;
      if (t90 === null && y >= 0.9 * size) t90 = t - stepAt;
    }
  }
  return { t50, t90, overshoot: Math.max(0, max - size) };
}

/** Sabit hızla hareket: son 1 saniyedeki ortalama gecikme (ms) = (gerçek − filtreli) / hız. */
export function simulateRamp({ fps = 30, speed = 3 * IPD, duration = 3, params, unit = IPD }) {
  const filter = new OneEuroFilter(params);
  const lags = [];
  for (const t of frameTimes(fps, duration)) {
    const truth = speed * t;
    const y = filter.filter(truth, t, unit);
    if (t >= duration - 1) lags.push(((truth - y) / speed) * 1000);
  }
  return { lagMs: lags.reduce((s, v) => s + v, 0) / lags.length, lagPx: (lags.at(-1) / 1000) * speed };
}
