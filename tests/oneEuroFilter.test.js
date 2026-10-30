import { describe, expect, it } from 'vitest';
import {
  AngleOneEuroFilter,
  DEFAULT_PARAMS,
  OneEuroFilter,
  QuaternionOneEuroFilter,
  smoothingFactor,
  wrapToPi,
} from '../src/core/oneEuroFilter.js';
import { frameTimes, gaussian, IPD, simulateRamp, simulateStatic, simulateStep } from './filterSim.js';

const params = DEFAULT_PARAMS;

describe('smoothingFactor', () => {
  it('α = r/(r+1), r = 2π·fc·Δt', () => {
    const r = 2 * Math.PI * 1 * (1 / 30);
    expect(smoothingFactor(1, 1 / 30)).toBeCloseTo(r / (r + 1));
  });

  it('kare aralığı uzadıkça α büyür (düşük FPS’te her karede daha çok güncellenir)', () => {
    expect(smoothingFactor(1, 1 / 15)).toBeGreaterThan(smoothingFactor(1, 1 / 60));
  });
});

describe('OneEuroFilter — temel davranış', () => {
  it('ilk değeri olduğu gibi döndürür', () => {
    expect(new OneEuroFilter().filter(42, 0)).toBe(42);
  });

  it('sabit girdide sabit kalır', () => {
    const f = new OneEuroFilter();
    for (const t of frameTimes(30, 2)) expect(f.filter(5, t)).toBe(5);
  });

  it('aynı ya da geri giden zaman damgasında durumu değiştirmez', () => {
    const f = new OneEuroFilter();
    f.filter(0, 0);
    const a = f.filter(10, 0.033);
    expect(f.filter(99, 0.033)).toBe(a);
    expect(f.filter(99, 0.01)).toBe(a);
  });

  it('reset sonrası ilk değer ham değerdir (eski konumdan kayma yok)', () => {
    const f = new OneEuroFilter();
    for (const t of frameTimes(30, 1)) f.filter(100, t);
    f.reset();
    expect(f.filter(500, 1.5)).toBe(500);
  });

  it('parametreler sonradan değiştirilebilir', () => {
    const f = new OneEuroFilter();
    f.setParams({ beta: 0 });
    expect(f.params).toEqual({ ...DEFAULT_PARAMS, beta: 0 });
  });
});

describe('titreme azaltma (sabit yüz + yapay landmark gürültüsü, σ = 1 px)', () => {
  it('30 FPS’te konum sapmasını en az %60, kareden kareye titremeyi en az %80 azaltır', () => {
    const r = simulateStatic({ fps: 30, sigma: 1, params });
    expect(r.errorReduction).toBeGreaterThan(0.6);
    expect(r.deltaReduction).toBeGreaterThan(0.8);
  });

  it('gürültü büyüklüğünden bağımsız olarak oransal azaltma sağlar (σ = 0.5 / 1 / 2 px)', () => {
    const reductions = [0.5, 1, 2].map((sigma) => simulateStatic({ fps: 30, sigma, params }).deltaReduction);
    for (const r of reductions) expect(r).toBeGreaterThan(0.8);
  });
});

describe('hızlı hareket ve gecikme', () => {
  it('ani sıçramada (1 IPD) 30 FPS’te %90’a en geç 3 karede ulaşır, aşma yapmaz', () => {
    const r = simulateStep({ fps: 30, params });
    expect(r.t90).toBeLessThanOrEqual(3 / 30 + 1e-9);
    expect(r.overshoot).toBeCloseTo(0);
  });

  it('beta sayesinde düz alçak geçiren filtreden (beta = 0) en az 4 kat hızlı tepki verir', () => {
    const oneEuro = simulateStep({ fps: 30, params });
    const lowPass = simulateStep({ fps: 30, params: { ...params, beta: 0 } });
    expect(lowPass.t90 / oneEuro.t90).toBeGreaterThan(4);
  });

  it('hızlı baş hareketinde (3 IPD/s) sürekli gecikme 25 ms’nin altında', () => {
    expect(simulateRamp({ fps: 30, params }).lagMs).toBeLessThan(25);
  });

  it('gürültülü sıçramada da yeni konuma 150 ms içinde ulaşır', () => {
    expect(simulateStep({ fps: 30, params, sigma: 1 }).t90).toBeLessThan(0.15);
  });
});

describe('farklı FPS değerleri (15 / 30 / 60)', () => {
  const fpsList = [15, 30, 60];

  it('her FPS’te titremeyi azaltır; yüksek FPS’te saniye başına daha çok örnek olduğu için azalma artar', () => {
    const r = fpsList.map((fps) => simulateStatic({ fps, sigma: 1, params }).deltaReduction);
    expect(r[0]).toBeGreaterThan(0.7);
    expect(r[1]).toBeGreaterThan(r[0]);
    expect(r[2]).toBeGreaterThan(r[1]);
  });

  it('düz alçak geçiren kısım (beta = 0) gerçek kare süresini kullanır: gecikme her FPS’te 1/(2π·fc) ≈ 159 ms', () => {
    const lag = fpsList.map((fps) => simulateRamp({ fps, params: { ...params, beta: 0 } }).lagMs);
    for (const l of lag) expect(l).toBeCloseTo(1000 / (2 * Math.PI * params.minCutoff), 0);
  });

  it('hızlı harekette gecikme FPS’ten büyük ölçüde bağımsız (15 / 30 / 60 FPS farkı < 6 ms)', () => {
    const lag = fpsList.map((fps) => simulateRamp({ fps, params }).lagMs);
    expect(Math.max(...lag) - Math.min(...lag)).toBeLessThan(6);
  });

  it('ani sıçramada %90 süresi her FPS’te en fazla 2 kare', () => {
    for (const fps of fpsList) expect(simulateStep({ fps, params }).t90).toBeLessThanOrEqual(2 / fps + 1e-9);
  });

  it('düzensiz kare aralıklarında (±%25 oynama) da kararlı kalır', () => {
    const f = new OneEuroFilter(params);
    const noise = gaussian(5);
    let last = 0;
    for (const t of frameTimes(30, 5, { jitter: 0.5 })) last = f.filter(640 + noise(), t, IPD);
    expect(Math.abs(last - 640)).toBeLessThan(1);
  });
});

describe('AngleOneEuroFilter — açı sürekliliği', () => {
  it('wrapToPi açıyı [−π, π] aralığına getirir', () => {
    expect(Math.abs(wrapToPi(3 * Math.PI))).toBeCloseTo(Math.PI);
    expect(wrapToPi(2 * Math.PI + 0.3)).toBeCloseTo(0.3);
    expect(wrapToPi(-0.5)).toBeCloseTo(-0.5);
  });

  it('±180° sınırını geçerken 360°’lik sıçrama yapmaz', () => {
    const f = new AngleOneEuroFilter(params);
    const deg = (d) => (d * Math.PI) / 180;
    const outputs = [];
    let t = 0;
    for (const a of [170, 175, 179, -179, -175, -170]) outputs.push(f.filter(deg(a), (t += 1 / 30)));
    for (let i = 1; i < outputs.length; i++) expect(Math.abs(outputs[i] - outputs[i - 1])).toBeLessThan(deg(10));
  });
});

describe('QuaternionOneEuroFilter — 3D dönme', () => {
  const yawQuat = (deg) => {
    const h = (deg * Math.PI) / 360;
    return [0, Math.sin(h), 0, Math.cos(h)];
  };
  const angleBetween = (a, b) =>
    2 * Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3])));

  it('q ve −q (aynı dönme) arasında geçişte sıçrama olmaz', () => {
    const f = new QuaternionOneEuroFilter(params);
    const q = yawQuat(30);
    f.filter(q, 0);
    const out = f.filter(q.map((v) => -v), 1 / 30);
    expect(angleBetween(out, q)).toBeCloseTo(0);
  });

  it('dönme gürültüsünü (σ ≈ 0.5°) azaltır', () => {
    const f = new QuaternionOneEuroFilter(params);
    const noise = gaussian(11);
    const rawErr = [];
    const filtErr = [];
    for (const t of frameTimes(30, 5)) {
      const raw = yawQuat(20 + 0.5 * noise());
      const out = f.filter(raw, t);
      if (t > 1) {
        rawErr.push(angleBetween(raw, yawQuat(20)));
        filtErr.push(angleBetween(out, yawQuat(20)));
      }
    }
    const rms = (a) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);
    expect(1 - rms(filtErr) / rms(rawErr)).toBeGreaterThan(0.6);
  });

  it('ani 30° baş dönüşüne 3 kare içinde %90 yaklaşır', () => {
    const f = new QuaternionOneEuroFilter(params);
    for (const t of frameTimes(30, 1)) f.filter(yawQuat(0), t);
    let out;
    for (let i = 1; i <= 3; i++) out = f.filter(yawQuat(30), 1 + i / 30);
    expect(angleBetween(out, yawQuat(30))).toBeLessThan((3 * Math.PI) / 180);
  });

  it('birim kuaterniyon döndürür', () => {
    const f = new QuaternionOneEuroFilter(params);
    f.filter(yawQuat(0), 0);
    const out = f.filter(yawQuat(40), 0.05);
    expect(Math.hypot(...out)).toBeCloseTo(1);
  });
});
