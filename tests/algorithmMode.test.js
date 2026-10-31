// Algoritma Modu: katman hesapları, çizim fonksiyonları, kabul koşulları ve
// açık/kapalı performans karşılaştırması. Çizimler sahte canvas ile test edilir.
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { AlgorithmPanel } from '../src/components/AlgorithmPanel.jsx';
import { StageToolbar } from '../src/components/StageToolbar.jsx';
import {
  ALGO_LAYERS,
  CRITICAL_POINTS,
  DEFAULT_ALGO,
  describeTransform,
  LAYER_PRESETS,
  landmarkRegions,
  NOSE_POINTS,
  poseAxes,
  REGION,
  REGION_INFO,
  regionCounts,
} from '../src/core/algorithmLayers.js';
import { EYE_LANDMARKS } from '../src/core/eyeGeometry.js';
import { FACE_CONTOURS, FACE_TESSELATION } from '../src/core/faceLandmarker.js';
import { SHAPES } from '../src/core/faceShape.js';
import { evaluateGates, FaceShapeEstimator, ESTIMATOR_DEFAULTS } from '../src/core/faceShapeEstimator.js';
import { measureFace } from '../src/core/faceShape.js';
import { ModeComparison } from '../src/core/modeComparison.js';
import { PerfMonitor } from '../src/core/perfMonitor.js';
import { computePlacement } from '../src/core/placementPipeline.js';
import { AXIS_COLORS, drawAlgorithmLabels, drawAlgorithmOverlay, SHAPE_LINES } from '../src/render/algorithmOverlay.js';
import { mockContext, syntheticFace } from './helpers.js';
import { H, shapeFace, W } from './shapeFace.js';

const ANCHORS = { right: { x: 330, y: 200 }, left: { x: 870, y: 200 } };
const GLASSES_SIZE = { width: 1200, height: 400 };
const NONE = Object.fromEntries(ALGO_LAYERS.map(({ key }) => [key, false]));
const only = (...keys) => ({ ...NONE, ...Object.fromEntries(keys.map((k) => [k, true])) });
const ASSETS = { regions: landmarkRegions(FACE_CONTOURS), tesselation: FACE_TESSELATION };

/** Gözleri (cx ± 60, cy) civarında olan yapay yüz. */
function eyeFace({ cx = 640, cy = 360, tilt = 0 } = {}) {
  const f = syntheticFace();
  const set = (i, x, y) => (f[i] = { x: x / W, y: (y + tilt * (x - cx)) / H, z: 0 });
  set(EYE_LANDMARKS.rightOuter, cx - 80, cy);
  set(EYE_LANDMARKS.rightInner, cx - 40, cy);
  set(EYE_LANDMARKS.leftInner, cx + 40, cy);
  set(EYE_LANDMARKS.leftOuter, cx + 80, cy);
  return f;
}

function matrix(yawDeg = 0, pitchDeg = 0, rollDeg = 0) {
  const rad = Math.PI / 180;
  const q = new Quaternion().setFromEuler(new Euler(pitchDeg * rad, yawDeg * rad, rollDeg * rad, 'YXZ'));
  return new Matrix4().compose(new Vector3(0, 0, -50), q, new Vector3(1, 1, 1)).toArray();
}

const place = (face, m = matrix()) => computePlacement({ face, matrix: m, width: W, height: H, anchors: ANCHORS, stabilizer: null, timeSec: 0 });

describe('landmarkRegions', () => {
  const codes = landmarkRegions(FACE_CONTOURS);

  it('478 noktanın her birine bir bölge verir; bölge sayıları toplamı 478', () => {
    expect(codes).toHaveLength(478);
    const counts = regionCounts(codes);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(478);
    for (const r of REGION_INFO) expect(counts[r.key]).toBeGreaterThan(0);
  });

  it('468–477 iris, göz köşeleri göz, dudak ve oval konturları kendi bölgesinde', () => {
    for (let i = 468; i < 478; i++) expect(codes[i]).toBe(REGION.iris);
    for (const i of CRITICAL_POINTS) expect(codes[i]).toBe(REGION.eye);
    expect(codes[13]).toBe(REGION.lips);
    expect(codes[10]).toBe(REGION.oval);
    expect(codes[1]).toBe(REGION.nose); // burun ucu
  });

  it('burun noktaları göz, kaş, dudak konturlarıyla çakışmaz', () => {
    for (const i of NOSE_POINTS) expect([REGION.nose, REGION.oval]).toContain(codes[i]);
  });
});

describe('poseAxes', () => {
  it('dönme yokken X sağa, Y yukarı (piksel y negatif), Z kameraya doğru', () => {
    const a = poseAxes({ x: 0, y: 0, z: 0, w: 1 });
    expect(a.x).toEqual({ dx: 1, dy: -0, depth: 0 });
    expect(a.y.dy).toBe(-1);
    expect(a.z.depth).toBe(1);
  });

  it('Three.js applyQuaternion ile aynı eksenleri verir', () => {
    const q = new Quaternion().setFromEuler(new Euler(0.3, -0.5, 0.2, 'YXZ'));
    const a = poseAxes(q);
    for (const [k, unit] of [
      ['x', new Vector3(1, 0, 0)],
      ['y', new Vector3(0, 1, 0)],
      ['z', new Vector3(0, 0, 1)],
    ]) {
      const v = unit.applyQuaternion(q);
      expect(a[k].dx).toBeCloseTo(v.x, 10);
      expect(a[k].dy).toBeCloseTo(-v.y, 10);
      expect(a[k].depth).toBeCloseTo(v.z, 10);
    }
  });
});

describe('describeTransform', () => {
  it('mevcut 2D matrisi bileşenlerine ayırır (yeni hesap yapmaz)', () => {
    const p = place(eyeFace({ tilt: 0.1 }));
    const d = describeTransform(p.transform, p.metrics);
    const t = p.transform;
    expect(d.matrix).toEqual([t.a, t.b, t.c, t.d, t.e, t.f]);
    expect(d.theta).toBeCloseTo((Math.atan(0.1) * 180) / Math.PI, 6);
    expect(d.scaleX).toBeCloseTo(120 * Math.hypot(1, 0.1) / 540, 6);
    expect(describeTransform(null, p.metrics)).toBeNull();
  });
});

describe('drawAlgorithmOverlay', () => {
  const face = eyeFace();
  const placement = place(face);
  const frame = { face, placement, glassesSize: GLASSES_SIZE };

  it('yüz yoksa yalnızca temizler', () => {
    const ctx = mockContext();
    drawAlgorithmOverlay(ctx, { face: null, placement: null }, DEFAULT_ALGO.layers, ASSETS);
    expect(ctx.calls.map((c) => c.name)).toEqual(['clearRect']);
  });

  it('tüm katmanlar kapalıyken çizim yapmaz', () => {
    const ctx = mockContext();
    drawAlgorithmOverlay(ctx, frame, NONE, ASSETS);
    expect(ctx.calls.map((c) => c.name)).toEqual(['clearRect']);
  });

  it('noktalar: 478 nokta, bölge renkleriyle', () => {
    const ctx = mockContext();
    drawAlgorithmOverlay(ctx, frame, only('points'), ASSETS);
    expect(ctx.count('fillRect')).toBe(478);
    const colors = new Set(ctx.calls.filter((c) => c.name === 'fillStyle').map((c) => c.args[0]));
    for (const r of REGION_INFO) expect(colors.has(r.color)).toBe(true);
  });

  it('derinlik seçeneği bölge renkleri yerine z rengini kullanır', () => {
    const ctx = mockContext();
    drawAlgorithmOverlay(ctx, frame, only('points', 'depth'), ASSETS);
    const colors = ctx.calls.filter((c) => c.name === 'fillStyle').map((c) => c.args[0]);
    expect(colors.every((c) => c.startsWith('hsl('))).toBe(true);
  });

  it('yüz ağı: her tesselasyon kenarı tek path içinde', () => {
    const ctx = mockContext();
    drawAlgorithmOverlay(ctx, frame, only('mesh'), ASSETS);
    expect(ctx.count('lineTo')).toBe(FACE_TESSELATION.length);
    expect(ctx.count('stroke')).toBe(1);
  });

  it('kritik noktalar: dört göz köşesinde halka', () => {
    const ctx = mockContext();
    drawAlgorithmOverlay(ctx, frame, only('critical'), ASSETS);
    const arcs = ctx.calls.filter((c) => c.name === 'arc');
    expect(arcs).toHaveLength(4);
    expect(arcs[0].args[0]).toBeCloseTo(560); // 33: cx − 80
    expect(arcs[0].args[1]).toBeCloseTo(360);
  });

  it('geometri: dönüştürülmüş gözlük dörtgeni göz merkezlerini çevreler', () => {
    const ctx = mockContext();
    drawAlgorithmOverlay(ctx, frame, only('geometry'), ASSETS);
    const moves = ctx.calls.filter((c) => c.name === 'moveTo');
    // İlk path dörtgen: köşe (0,0) → applyTransform; göz orta noktası (640,360) içeride
    const [x0, y0] = moves[0].args;
    expect(x0).toBeLessThan(placement.metrics.right.x);
    expect(y0).toBeLessThan(360);
    expect(ctx.count('arc')).toBe(2); // göz merkezleri (drawPlacementGeometry)
  });

  it('filtre katmanı: ham (3 halka) ve filtreli (2 nokta) ayrı çizilir', () => {
    const ctx = mockContext();
    drawAlgorithmOverlay(ctx, frame, only('filter'), ASSETS);
    expect(ctx.count('arc')).toBe(5);
    expect(ctx.count('fill')).toBe(2);
  });

  it('yüz şekli: 5 ölçü çizgisi + iki çene açısı', () => {
    const f = shapeFace(SHAPES.oval.proto);
    const ctx = mockContext();
    drawAlgorithmOverlay(ctx, { face: f, placement: null }, only('shape'), ASSETS);
    expect(ctx.count('stroke')).toBe(SHAPE_LINES.length + 2);
  });
});

describe('drawAlgorithmLabels (aynalanmamış katman)', () => {
  const face = eyeFace();
  const placement = place(face);
  const frame = { face, placement };

  it('etiketler kapalı ve gizmo kapalıyken yazı yok', () => {
    const ctx = mockContext();
    drawAlgorithmLabels(ctx, frame, only('geometry', 'critical'));
    expect(ctx.count('fillText')).toBe(0);
  });

  it('x koordinatı aynalanır: ham x → genişlik − x', () => {
    const f = eyeFace({ cx: 400 });
    const ctx = mockContext();
    drawAlgorithmLabels(ctx, { face: f, placement: place(f) }, only('geometry', 'labels'));
    const d = ctx.texts().find((t) => t.text.startsWith('d = '));
    expect(d.x).toBeCloseTo(W - 400);
    expect(d.text).toBe('d = 120 px');
  });

  it('eğim etiketi ekranda görülen işaretle (aynalı)', () => {
    const f = eyeFace({ tilt: 0.1 }); // ham videoda sol göz aşağıda → ekranda saat yönü tersi
    const ctx = mockContext();
    drawAlgorithmLabels(ctx, { face: f, placement: place(f) }, only('geometry', 'labels'));
    const theta = ctx.texts().find((t) => t.text.startsWith('θ'));
    expect(theta.text).toBe('θ = −5.7°');
  });

  it('gizmo: dönme yokken X ekranda sola (ayna), Y yukarı; renkler eksenlere göre', () => {
    const ctx = mockContext();
    drawAlgorithmLabels(ctx, frame, only('gizmo'));
    const t = Object.fromEntries(ctx.texts().map((x) => [x.text, x]));
    const ox = W - 640;
    expect(t.X.x).toBeLessThan(ox);
    expect(t.X.y).toBeCloseTo(360);
    expect(t.Y.y).toBeLessThan(360);
    expect(t.Y.x).toBeCloseTo(ox);
    expect(t.Z.x).toBeCloseTo(ox); // kameraya bakıyor: ekranda nokta
    const strokes = ctx.calls.filter((c) => c.name === 'stroke');
    expect(strokes.length).toBeGreaterThanOrEqual(3);
    expect(AXIS_COLORS.x).not.toBe(AXIS_COLORS.y);
  });

  it('gizmo + etiketler: yaw/pitch/roll okunur', () => {
    const f = eyeFace();
    const ctx = mockContext();
    drawAlgorithmLabels(ctx, { face: f, placement: place(f, matrix(10, -5, 0)) }, only('gizmo', 'labels'));
    const texts = ctx.texts();
    expect(texts.map((t) => t.text)).toEqual(expect.arrayContaining(['yaw +10.0°', 'pitch −5.0°', 'roll +0.0°']));
    // sağ üst köşede, yüzden bağımsız
    const yaw = texts.find((t) => t.text.startsWith('yaw'));
    expect(yaw.x).toBeGreaterThan(W - 40);
    expect(yaw.y).toBeLessThan(60);
  });

  it('yüz şekli etiketleri measureFace oranlarını gösterir', () => {
    const f = shapeFace(SHAPES.heart.proto);
    const ratios = measureFace(f, W, H).ratios;
    const ctx = mockContext();
    drawAlgorithmLabels(ctx, { face: f, placement: null }, only('shape', 'labels'));
    const texts = ctx.texts().map((t) => t.text);
    expect(texts).toContain(`Alın ${ratios.F.toFixed(2)}`);
    expect(texts).toContain(`Çene ${ratios.J.toFixed(2)}`);
    expect(texts).toContain(`∠ ${ratios.A.toFixed(0)}°`);
  });
});

describe('evaluateGates', () => {
  const angles = { yaw: 0, pitch: 0, roll: 0 };
  const gates = (face, extra = {}) =>
    evaluateGates({ face, measurement: measureFace(face, W, H), angles, mouthOpen: false, forehead: null, ...extra });

  it('uygun yüzde tüm koşullar sağlanır', () => {
    const g = gates(shapeFace(SHAPES.oval.proto));
    expect(g.map((x) => x.key)).toEqual(['pose', 'out-of-frame', 'too-far', 'mouth', 'implausible', 'forehead']);
    expect(g.every((x) => x.ok)).toBe(true);
  });

  it('birden çok koşul aynı anda başarısız olabilir (hepsi gösterilir)', () => {
    const g = gates(shapeFace(SHAPES.oval.proto, { cheekPx: 80 }), { angles: { yaw: 30, pitch: 0, roll: 0 }, mouthOpen: true });
    const failed = g.filter((x) => !x.ok).map((x) => x.key);
    expect(failed).toEqual(['pose', 'too-far', 'mouth']);
  });

  it('tahmin edicinin reddetme nedeni ilk başarısız koşuldur', () => {
    const cases = [
      [shapeFace(SHAPES.oval.proto, { cheekPx: 80 }), angles, 'too-far'],
      [shapeFace(SHAPES.oval.proto, { mouth: 0.08 }), angles, 'mouth'],
      [shapeFace(SHAPES.oval.proto), { yaw: 20, pitch: 0, roll: 0 }, 'pose'],
      [shapeFace(SHAPES.oval.proto), null, 'pose'],
    ];
    for (const [face, a, status] of cases) {
      const est = new FaceShapeEstimator();
      expect(est.rejectReason(face, a, W, H)?.status).toBe(status);
      expect(est.gates.find((g) => !g.ok).key).toBe(status);
    }
  });

  it('yüz kaybolunca kontroller ve ölçüm silinir', () => {
    const est = new FaceShapeEstimator();
    est.update(shapeFace(SHAPES.oval.proto), angles, W, H);
    expect(est.gates).not.toBeNull();
    expect(est.measurement).not.toBeNull();
    est.update(null, null, W, H);
    expect(est.gates).toBeNull();
    expect(est.measurement).toBeNull();
  });

  it('etiketler eşikleri içerir', () => {
    const g = gates(shapeFace(SHAPES.oval.proto));
    expect(g.find((x) => x.key === 'too-far').label).toContain(String(ESTIMATOR_DEFAULTS.minCheekPx));
  });
});

describe('ModeComparison', () => {
  const snap = (fps, frameMs, algoMs) => ({ fps, frameMs: { avg: frameMs }, stages: algoMs ? { Algoritma: { avg: algoMs } } : {} });

  it('mod değişiminden sonraki ısınma örneklerini atar, modları ayrı ortalar', () => {
    const c = new ModeComparison({ warmupMs: 1000 });
    let t = 0;
    const run = (on, s, n) => {
      for (let i = 0; i < n; i++) c.sample(on, s, (t += 500));
    };
    run(false, snap(30, 10), 1); // mod başlangıcı (sayılmaz)
    run(false, snap(99, 99), 1); // ısınma (500 ms) atılır
    run(false, snap(30, 10), 4);
    run(true, snap(99, 99), 2); // yeni mod: başlangıç + ısınma
    run(true, snap(29, 12, 1.5), 4);
    const s = c.summary();
    expect(s.off).toEqual({ fps: 30, frameMs: 10, algoMs: 0, samples: 4 });
    expect(s.on).toEqual({ fps: 29, frameMs: 12, algoMs: 1.5, samples: 4 });
    expect(s.deltaMs).toBeCloseTo(2);
  });

  it('FPS 0 (kamera yok) örnekleri sayılmaz; pause ısınmayı yeniden başlatır', () => {
    const c = new ModeComparison({ warmupMs: 0 });
    c.sample(true, snap(30, 5), 0);
    c.sample(true, snap(0, 0), 500);
    c.pause();
    c.sample(true, snap(30, 5), 1000); // pause sonrası ilk örnek başlangıç
    expect(c.summary().on).toBeNull();
    c.sample(true, snap(30, 5), 1500);
    expect(c.summary().on.samples).toBe(1);
    expect(c.summary().deltaMs).toBeNull();
  });
});

describe('PerfMonitor.drop', () => {
  it('kapanan aşamanın kaydını siler', () => {
    const perf = new PerfMonitor({ now: () => 0 });
    perf.record('Algoritma', 2);
    perf.record('Çizim', 1);
    perf.drop('Algoritma');
    expect(Object.keys(perf.snapshot().stages)).toEqual(['Çizim']);
  });
});

describe('Algoritma Modu arayüzü', () => {
  const html = (el) => renderToString(el).replace(/<!-- -->/g, '');
  const refs = {
    perf: new PerfMonitor(),
    comparison: new ModeComparison(),
    placementRef: { current: null },
    stabilityRef: { current: { snapshot: () => ({ samples: 0, history: [] }) } },
    faceShapeRef: { current: new FaceShapeEstimator() },
  };
  const view = { mode: '2d', stabilize: true, showOccluders: false, filterParams: { minCutoff: 1, beta: 2, dCutoff: 1 } };
  const panel = (algo) => html(h(AlgorithmPanel, { algo, onAlgoChange: () => {}, view, onViewChange: () => {}, mode: '2d', ...refs }));

  it('kapalıyken yalnızca anahtar ve kısa açıklama (adımlar çizilmez)', () => {
    const out = panel(DEFAULT_ALGO);
    expect(out).toContain('Algoritma Modu');
    expect(out).toContain('Kapalı');
    expect(out).not.toContain('1 · Yüz noktaları');
    expect(out).not.toContain('type="checkbox" checked=""');
  });

  it('açıkken katman seçenekleri ve altı işlem adımı görünür', () => {
    const out = panel({ ...DEFAULT_ALGO, enabled: true });
    for (const { label } of ALGO_LAYERS) expect(out).toContain(label);
    for (const step of ['1 · Yüz noktaları', '2 · 2D yerleştirme', '3 · 3D kafa pozu', '4 · One Euro filtresi', '5 · Yüz şekli', '6 · Performans']) {
      expect(out).toContain(step);
    }
    expect(out).toContain('Kritik noktalar: 33, 133, 362, 263');
    expect(out).toContain('card--algo is-on');
  });

  it('hazır seçim: "Yalnızca yüz noktaları" yalnızca nokta katmanını açar', () => {
    const out = panel({ ...DEFAULT_ALGO, enabled: true });
    for (const p of LAYER_PRESETS) expect(out).toContain(p.label);
    const landmarks = LAYER_PRESETS.find((p) => p.key === 'landmarks').layers;
    expect(Object.entries(landmarks).filter(([, on]) => on).map(([k]) => k)).toEqual(['points']);
    expect(Object.keys(landmarks).sort()).toEqual(ALGO_LAYERS.map((l) => l.key).sort());
  });

  it('derinlik seçeneği noktalar kapalıyken devre dışı', () => {
    const out = panel({ enabled: true, layers: { ...DEFAULT_ALGO.layers, points: false } });
    expect(out).toMatch(/<input type="checkbox" disabled=""[^>]*\/><span>Noktaları derinliğe/);
  });

  it('araç çubuğunda Algoritma anahtarı', () => {
    const out = html(
      h(StageToolbar, {
        mode: '2d',
        onModeChange: () => {},
        showGlasses: true,
        onShowGlassesChange: () => {},
        algorithm: true,
        onAlgorithmChange: () => {},
        onSnapshot: () => {},
        canSnapshot: true,
        busy: false,
        scene3D: { status: 'ready' },
      }),
    );
    expect(out).toContain('Algoritma');
    expect(out.match(/checked=""/g)).toHaveLength(3); // 2D, Gözlük, Algoritma
  });
});
