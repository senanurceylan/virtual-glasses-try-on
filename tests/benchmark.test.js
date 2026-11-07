// Ölçüm altyapısı (Aşama 8): kaydedici, istatistikler, dışa aktarma ve panel.
// Buradaki sayılar SENTETİK veriyle algoritmanın doğru hesapladığını gösterir;
// gerçek kamera performansı hakkında bilgi vermez.
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { benchmarkNotice, BenchmarkPanel } from '../src/components/BenchmarkPanel.jsx';
import { ALGO_LAYERS, DEFAULT_ALGO } from '../src/core/algorithmLayers.js';
import {
  ALL_LAYERS_ON,
  BenchmarkRecorder,
  compareResults,
  COMPARISONS,
  estimateLag,
  jitterStats,
  percentile,
  SCENARIOS,
  summarize,
  toCSV,
  toMarkdown,
} from '../src/core/benchmark.js';
import { EYE_LANDMARKS } from '../src/core/eyeGeometry.js';
import { PerfMonitor } from '../src/core/perfMonitor.js';
import { computePlacement } from '../src/core/placementPipeline.js';
import { PlacementStabilizer } from '../src/core/stabilizer.js';
import { scenarioState } from '../src/hooks/useBenchmark.js';
import { gaussian } from './filterSim.js';
import { syntheticFace } from './helpers.js';

const W = 1280;
const H = 720;
const ANCHORS = { right: { x: 330, y: 200 }, left: { x: 870, y: 200 } };
const DT = 1000 / 30;

/** Göz orta noktası (cx, cy), göz arası 120 px olan yapay yüz. */
function eyeFace(cx, cy) {
  const f = syntheticFace();
  const set = (i, x, y) => (f[i] = { x: x / W, y: y / H, z: 0 });
  set(EYE_LANDMARKS.rightOuter, cx - 80, cy);
  set(EYE_LANDMARKS.rightInner, cx - 40, cy);
  set(EYE_LANDMARKS.leftInner, cx + 40, cy);
  set(EYE_LANDMARKS.leftOuter, cx + 80, cy);
  return f;
}

/** Elle kare dizisi: raw/filt x dizileri, aralık DT. */
const frames = (rawXs, filtXs = rawXs, { face = () => true } = {}) =>
  rawXs.map((x, i) => ({
    interval: DT,
    duration: 5,
    stages: {},
    face: face(i),
    raw: { x, y: 360 },
    filt: { x: filtXs[i], y: 360 },
    ipd: 120,
  }));

describe('percentile', () => {
  it('doğrusal ara değerli yüzdelik', () => {
    const a = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(a, 0.95)).toBeCloseTo(95.05);
    expect(percentile(a, 0.5)).toBeCloseTo(50.5);
    expect(percentile([7], 0.95)).toBe(7);
    expect(percentile([], 0.95)).toBeNaN();
  });
});

describe('PerfMonitor dinleyicisi', () => {
  it('her kare sonunda aralık, süre ve aşama sürelerini verir', () => {
    let t = 0;
    const perf = new PerfMonitor({ now: () => t });
    const got = [];
    perf.setListener((frame, now) => got.push({ ...frame, now }));
    for (let i = 0; i < 3; i++) {
      perf.frameStart();
      perf.record('Tespit', 4 + i);
      t += 6;
      perf.frameEnd();
      t += 27;
    }
    expect(got).toHaveLength(3);
    expect(got[0].interval).toBeNull();
    expect(got[1].interval).toBe(33);
    expect(got[2]).toMatchObject({ interval: 33, duration: 6, stages: { Tespit: 6 } });
  });

  it('reset dinleyiciyi silmez; null ile kapanır ve ek kayıt tutulmaz', () => {
    const perf = new PerfMonitor({ now: () => 0 });
    let n = 0;
    perf.setListener(() => n++);
    perf.reset();
    perf.frameStart();
    perf.frameEnd();
    perf.setListener(null);
    perf.frameStart();
    perf.record('Tespit', 1);
    expect(perf.current).toBeNull();
    perf.frameEnd();
    expect(n).toBe(1);
  });
});

describe('BenchmarkRecorder', () => {
  it('ısınma karelerini atar, kayıt süresi dolunca biter', () => {
    const rec = new BenchmarkRecorder({ warmupMs: 1000, durationMs: 2000 });
    rec.start(0);
    let t = 0;
    while (rec.phase !== 'done' && t < 10000) {
      t += DT;
      rec.observePlacement(null);
      rec.observeFrame({ interval: DT, duration: 5, stages: { Tespit: 3 } }, t);
    }
    // ısınma ~30 kare atılır, kayıt ~60 kare (2 sn × 30 FPS)
    expect(rec.frames.length).toBeGreaterThanOrEqual(60);
    expect(rec.frames.length).toBeLessThanOrEqual(62);
    expect(t).toBeLessThan(3100);
    expect(rec.frames[0].face).toBe(false);
  });

  it('ilerleme evreye göre hesaplanır; başlamadan kare kaydetmez', () => {
    const rec = new BenchmarkRecorder({ warmupMs: 1000, durationMs: 2000 });
    rec.observeFrame({ interval: DT, duration: 1, stages: {} }, 0);
    expect(rec.frames).toHaveLength(0);
    rec.start(0);
    expect(rec.progress(250)).toMatchObject({ phase: 'warmup', fraction: 0.25, remainingMs: 750 });
  });
});

describe('titreme ve gecikme', () => {
  it('ham titreşim, sabit filtreli değer: azalma %100', () => {
    const raw = Array.from({ length: 40 }, (_, i) => 640 + (i % 2 ? 1 : -1));
    const j = jitterStats(frames(raw, raw.map(() => 640)));
    expect(j.rawPx).toBeCloseTo(2);
    expect(j.filteredPx).toBe(0);
    expect(j.reduction).toBe(1);
    expect(j.rawPctIpd).toBeCloseTo((2 / 120) * 100);
  });

  it('yüz kaybolan karelerin iki yanı arasında sıçrama sayılmaz', () => {
    const raw = Array.from({ length: 20 }, (_, i) => (i < 10 ? 100 : 900));
    const j = jitterStats(frames(raw, raw, { face: (i) => i !== 10 }));
    expect(j.rawPx).toBe(0);
  });

  it('filtreli dizi 3 kare geride ise gecikme 3 kare (100 ms)', () => {
    const x = (i) => 640 + 150 * Math.sin((2 * Math.PI * i) / 30);
    const raw = Array.from({ length: 120 }, (_, i) => x(i));
    const filt = raw.map((_, i) => x(i - 3));
    const lag = estimateLag(frames(raw, filt));
    expect(lag.frames).toBeCloseTo(3, 1);
    expect(lag.ms).toBeCloseTo(100, 0);
    expect(lag.reliable).toBe(true);
  });

  it('baş hareketsizken gecikme güvenilmez olarak işaretlenir', () => {
    const noise = gaussian(5);
    const raw = Array.from({ length: 120 }, () => 640 + noise());
    expect(estimateLag(frames(raw)).reliable).toBe(false);
  });

  it('gerçek One Euro filtresi: sabit başta titreme azalır, harekette gecikme küçüktür', () => {
    const run = (motion, stabilize) => {
      const stabilizer = new PlacementStabilizer();
      stabilizer.setEnabled(stabilize);
      const rec = new BenchmarkRecorder({ warmupMs: 1000, durationMs: 6000 });
      rec.start(0);
      const noise = gaussian(11);
      for (let t = 0; rec.phase !== 'done'; t += DT) {
        const cx = 640 + (motion ? 120 * Math.sin((2 * Math.PI * t) / 2000) : 0) + noise();
        const p = computePlacement({ face: eyeFace(cx, 360 + noise()), matrix: null, width: W, height: H, anchors: ANCHORS, stabilizer, timeSec: t / 1000 });
        rec.observePlacement(p);
        rec.observeFrame({ interval: DT, duration: 5, stages: {} }, t);
      }
      return summarize(rec.frames);
    };
    const still = run(false, true);
    expect(still.jitter.reduction).toBeGreaterThan(0.5);
    const off = run(false, false);
    expect(off.jitter.reduction).toBe(0); // filtre kapalı: filtreli = ham
    const moving = run(true, true);
    expect(moving.lag.reliable).toBe(true);
    expect(moving.lag.ms).toBeGreaterThan(0);
    expect(moving.lag.ms).toBeLessThan(100);
  });
});

describe('summarize ve karşılaştırma', () => {
  const mk = (fps, ms, extra = {}) =>
    Array.from({ length: 30 }, (_, i) => ({
      interval: 1000 / fps,
      duration: ms + (i === 29 ? 10 : 0),
      stages: { Tespit: 4, ...extra },
      face: i < 27,
      raw: { x: 640 + (i % 2), y: 360 },
      filt: { x: 640, y: 360 },
      ipd: 120,
    }));

  it('FPS, kare süresi, p95, aşamalar ve yüz oranı', () => {
    const s = summarize(mk(30, 8, { Algoritma: 0.2 }));
    expect(s.fps).toBeCloseTo(30);
    expect(s.frameMs.mean).toBeCloseTo(8 + 10 / 30);
    expect(s.frameMs.p95).toBeGreaterThanOrEqual(8);
    expect(s.stages.Tespit.mean).toBe(4);
    expect(s.stages.Algoritma.mean).toBeCloseTo(0.2);
    expect(s.faceRate).toBeCloseTo(0.9);
  });

  const results = [
    { scenario: SCENARIOS[0], effectiveMode: '2d', summary: summarize(mk(30, 8)) },
    { scenario: SCENARIOS[1], effectiveMode: '2d', summary: summarize(mk(29, 9, { Algoritma: 0.3 })) },
  ];

  it('karşılaştırma farkları; eksik senaryolar "ölçülmedi"', () => {
    const c = compareResults(results);
    const algo = c.find((x) => x.id === 'algo');
    expect(algo.available).toBe(true);
    expect(algo.frameMs.delta).toBeCloseTo(1);
    expect(c.find((x) => x.id === 'mode').available).toBe(false);
  });

  it('CSV başlığı ve satırları aynı sütun sayısında; Markdown tablolar içerir', () => {
    const [head, ...rows] = toCSV(results).split('\n');
    const cols = head.split(',').length;
    for (const r of rows) expect(r.replace(/"[^"]*"/g, 'x').split(',').length).toBe(cols);
    const md = toMarkdown(results, { resolution: '1280×720', delegate: 'GPU', date: '2026-10-31' });
    expect(md).toContain('Kamera: 1280×720');
    expect(md).toContain('| S1 Referans');
    expect(md).toContain('Algoritma Modu kapalı → açık (S1 → S2)');
  });
});

describe('protokol', () => {
  it('istenen dört karşılaştırma ve hareketli baş tanımlı; senaryo kimlikleri geçerli', () => {
    const ids = SCENARIOS.map((s) => s.id);
    for (const c of COMPARISONS) expect(ids).toEqual(expect.arrayContaining([c.a, c.b]));
    expect(COMPARISONS.map((c) => c.id)).toEqual(['algo', 'layers', 'mode', 'filter-still', 'filter-moving']);
  });

  it('senaryo ayarları uygulama durumuna doğru çevrilir; diğer ayarlar korunur', () => {
    const view = { mode: '2d', stabilize: true, showGlasses: false, filterParams: { minCutoff: 2 } };
    const all = scenarioState({ mode: '3d', stabilize: false, algo: 'all' }, view, DEFAULT_ALGO);
    expect(all.view).toEqual({ ...view, mode: '3d', stabilize: false });
    expect(all.algo).toEqual({ enabled: true, layers: ALL_LAYERS_ON });
    expect(Object.keys(ALL_LAYERS_ON).sort()).toEqual(ALGO_LAYERS.map((l) => l.key).sort());
    const def = scenarioState({ mode: '2d', stabilize: true, algo: 'default' }, view, DEFAULT_ALGO);
    expect(def.algo.layers).toEqual(DEFAULT_ALGO.layers);
    const custom = { enabled: true, layers: { ...DEFAULT_ALGO.layers, mesh: true } };
    expect(scenarioState({ mode: '2d', stabilize: true, algo: false }, view, custom).algo).toEqual({ ...custom, enabled: false });
  });
});

describe('ölçüm paneli', () => {
  const html = (el) => renderToString(el).replace(/<!-- -->/g, '');
  const bench = { status: 'idle', results: [], env: null, current: null, start() {}, cancel() {}, clear() {} };

  it('kamera kapalıyken başlatma devre dışı ve 7 senaryo listelenir', () => {
    const out = html(h(BenchmarkPanel, { bench, running: false }));
    expect(out).toMatch(/<button type="button" class="btn btn--small" disabled="">▶ Ölçüm protokolünü başlat/);
    for (const s of SCENARIOS) expect(out).toContain(s.name);
    expect(out).toContain('Ölçüm için önce kamerayı başlatın');
  });

  it('sonuç varsa tablo, karşılaştırma ve dışa aktarma düğmeleri', () => {
    const s = summarize(frames(Array.from({ length: 40 }, (_, i) => 640 + (i % 2))));
    const out = html(
      h(BenchmarkPanel, {
        bench: { ...bench, results: [{ scenario: SCENARIOS[3], effectiveMode: '2d', summary: s }], env: { resolution: '1280×720' } },
        running: true,
      }),
    );
    expect(out).toContain('1280×720');
    expect(out).toContain('3D açılamadı'); // S4 3D istedi, 2D ölçüldü
    for (const b of ['Markdown tabloyu kopyala', 'CSV indir', 'JSON indir']) expect(out).toContain(b);
  });

  it('ölçüm sırasında kamera üstünde yönerge', () => {
    const running = { ...bench, status: 'running', phase: 'recording', secondsLeft: 7, current: { scenario: SCENARIOS[5], index: 5, total: 7 } };
    const n = benchmarkNotice(running, true);
    expect(n.title).toBe('Ölçüm 6/7 · Kayıt · 7 sn');
    expect(n.text).toContain('sağa ve sola');
    expect(benchmarkNotice(running, false).tone).toBe('warn');
    expect(benchmarkNotice(bench, true)).toBeNull();
  });
});
