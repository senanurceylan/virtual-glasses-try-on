// Yüz noktası katmanının hizalanma testleri.
//
// Gerçekçi yüz için MediaPipe'ın kanonik yüz ağı kullanılır (fixtures/canonicalFace.json:
// model dosyasındaki ortalama yüzün 468 noktası, santimetre, x kişinin soluna, y yukarı,
// z kameraya doğru). Bu ağ, döndürülüp ölçeklenerek normalize landmark'lara çevrilir;
// böylece bölge indekslerinin anatomik yeri ve noktaların yüz hareketini izlemesi
// kameradan bağımsız olarak doğrulanır.
import { readFileSync } from 'node:fs';
import { Euler, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { ALGO_LAYERS, landmarkRegions, REGION, REGION_INFO } from '../src/core/algorithmLayers.js';
import { EYE_LANDMARKS, eyeCenters, eyeMetrics } from '../src/core/eyeGeometry.js';
import { FACE_CONTOURS, FACE_TESSELATION } from '../src/core/faceLandmarker.js';
import { toPixel } from '../src/core/landmarkUtils.js';
import { drawAlgorithmLabels, drawAlgorithmOverlay } from '../src/render/algorithmOverlay.js';
import { drawLandmarkOverlay } from '../src/render/landmarkOverlay.js';
import { mockContext } from './helpers.js';

const CANON = JSON.parse(readFileSync(new URL('./fixtures/canonicalFace.json', import.meta.url)));
const W = 1280;
const H = 720;
const REGIONS = landmarkRegions(FACE_CONTOURS);
const ASSETS = { regions: REGIONS, tesselation: FACE_TESSELATION };
const NONE = Object.fromEntries(ALGO_LAYERS.map(({ key }) => [key, false]));
const only = (...keys) => ({ ...NONE, ...Object.fromEntries(keys.map((k) => [k, true])) });

/**
 * Kanonik ağdan bir karenin 478 normalize noktası.
 * Görüntü: x sağa, y aşağı (ham, aynalanmamış video). Kişinin sağ gözü görüntünün solunda.
 * İris (468–477) göz köşelerinin ortasına 5 nokta olarak eklenir.
 */
function canonicalFace({ cx = 640, cy = 360, pxPerCm = 14, yaw = 0, pitch = 0, roll = 0 } = {}) {
  const rad = Math.PI / 180;
  const rot = new Euler(pitch * rad, yaw * rad, roll * rad, 'YXZ');
  const face = CANON.map(([x, y, z]) => {
    const v = new Vector3(x, y, z).applyEuler(rot);
    return { x: (cx + v.x * pxPerCm) / W, y: (cy - v.y * pxPerCm) / H, z: (-v.z * pxPerCm) / W };
  });
  for (const [a, b] of [
    [33, 133],
    [362, 263],
  ]) {
    const c = { x: (face[a].x + face[b].x) / 2, y: (face[a].y + face[b].y) / 2, z: (face[a].z + face[b].z) / 2 };
    const r = 0.004;
    face.push(c, { ...c, x: c.x + r }, { ...c, y: c.y - r }, { ...c, x: c.x - r }, { ...c, y: c.y + r });
  }
  return face;
}

/** Nokta katmanının çizdiği kareler: merkez ve renk, çizim sırasıyla. */
function drawnPoints(face, layers = only('points')) {
  const ctx = mockContext(W, H);
  drawAlgorithmOverlay(ctx, { face, placement: null }, layers, ASSETS);
  const out = [];
  let color = null;
  for (const c of ctx.calls) {
    if (c.name === 'fillStyle') color = c.args[0];
    if (c.name === 'fillRect') {
      const [x, y, w, h] = c.args;
      out.push({ x: x + w / 2, y: y + h / 2, color });
    }
  }
  return out;
}

const indicesOf = (code) => [...REGIONS.keys()].filter((i) => i < 468 && REGIONS[i] === code);
const mean = (idx, k) => idx.reduce((s, i) => s + CANON[i][k], 0) / idx.length;
const range = (idx, k) => [Math.min(...idx.map((i) => CANON[i][k])), Math.max(...idx.map((i) => CANON[i][k]))];

describe('bölge indeksleri kanonik yüzde anatomik olarak doğru yerde', () => {
  const eye = indicesOf(REGION.eye);
  const brow = indicesOf(REGION.eyebrow);
  const nose = indicesOf(REGION.nose);
  const lips = indicesOf(REGION.lips);
  const oval = indicesOf(REGION.oval);

  it('her bölge boş değil; 468 yüz + 10 iris noktası', () => {
    expect(CANON).toHaveLength(468);
    for (const idx of [eye, brow, nose, lips, oval]) expect(idx.length).toBeGreaterThan(15);
    expect([...REGIONS.slice(468)].every((c) => c === REGION.iris)).toBe(true);
  });

  it('dikey sıra: kaş > göz > burun ucu > dudak (y yukarı)', () => {
    expect(range(brow, 1)[0]).toBeGreaterThan(range(eye, 1)[1]); // tüm kaş noktaları gözlerin üstünde
    expect(range(lips, 1)[1]).toBeLessThan(CANON[1][1]); // dudaklar burun ucunun altında
    expect(range(nose, 1)[1]).toBeLessThan(range(brow, 1)[0]); // burun sırtı kaşların altında
    expect(range(nose, 1)[0]).toBeGreaterThan(range(lips, 1)[1]); // burun dudakların üstünde
  });

  it('burun orta hatta ve yüzün en önünde; dudaklar ortada', () => {
    for (const i of nose) expect(Math.abs(CANON[i][0])).toBeLessThan(2);
    expect(mean(nose, 2)).toBeGreaterThan(mean(eye, 2));
    expect(Math.abs(mean(lips, 0))).toBeLessThan(0.01);
  });

  it('gözler iki yanda, gözlük için kullanılan köşeler göz bölgesinde', () => {
    for (const i of eye) expect(Math.abs(CANON[i][0])).toBeGreaterThan(1.5);
    for (const i of Object.values(EYE_LANDMARKS)) expect(REGIONS[i]).toBe(REGION.eye);
  });

  it('yüz ovali çevrede: her oval noktası kendi yönündeki en dış noktadır', () => {
    const cy = mean([...CANON.keys()], 1);
    const ang = (p) => Math.atan2(p[1] - cy, p[0]);
    const rad = (p) => Math.hypot(p[0], p[1] - cy);
    for (const i of oval) {
      const a = ang(CANON[i]);
      const near = CANON.filter((p) => Math.abs(Math.atan2(Math.sin(ang(p) - a), Math.cos(ang(p) - a))) < 0.08);
      expect(rad(CANON[i])).toBeGreaterThanOrEqual(Math.max(...near.map(rad)) - 1e-9);
    }
  });

  it('ham görüntüde kişinin sağ gözü (33, 133) solda, sol gözü (362, 263) sağda', () => {
    const f = canonicalFace();
    expect(f[33].x).toBeLessThan(f[133].x);
    expect(f[133].x).toBeLessThan(0.5);
    expect(f[362].x).toBeGreaterThan(0.5);
    expect(f[362].x).toBeLessThan(f[263].x);
    // MediaPipe'ın leftEye konturu kişinin sol gözü (görüntünün sağı)
    const meanX = (set) => set.reduce((s, c) => s + f[c.start].x, 0) / set.length;
    expect(meanX(FACE_CONTOURS.leftEye)).toBeGreaterThan(0.5);
    expect(meanX(FACE_CONTOURS.rightEye)).toBeLessThan(0.5);
  });
});

describe('noktalar landmark piksellerine çizilir ve yüzü izler', () => {
  const POSES = [
    {},
    { cx: 420, cy: 300 },
    { cx: 900, cy: 450, pxPerCm: 9 },
    { roll: 15 },
    { yaw: 25 },
    { pitch: -12, yaw: -18, roll: -8, pxPerCm: 20 },
  ];

  it('478 noktanın her biri sırayla tam (x·W, y·H) konumunda', () => {
    for (const pose of POSES) {
      const face = canonicalFace(pose);
      const pts = drawnPoints(face);
      expect(pts).toHaveLength(478);
      pts.forEach((p, i) => {
        const e = toPixel(face[i], W, H);
        expect(p.x).toBeCloseTo(e.x, 9);
        expect(p.y).toBeCloseTo(e.y, 9);
      });
    }
  });

  it('her nokta kendi bölgesinin rengiyle çizilir', () => {
    const pts = drawnPoints(canonicalFace());
    pts.forEach((p, i) => expect(p.color).toBe(REGION_INFO[REGIONS[i]].color));
    // örnek indeksler: burun ucu, üst dudak, sağ üst göz kapağı, sağ kaş, alın üstü, iris merkezi
    const colorOf = (key) => REGION_INFO.find((r) => r.key === key).color;
    expect(pts[1].color).toBe(colorOf('nose'));
    expect(pts[13].color).toBe(colorOf('lips'));
    expect(pts[159].color).toBe(colorOf('eye'));
    expect(pts[70].color).toBe(colorOf('eyebrow'));
    expect(pts[10].color).toBe(colorOf('oval'));
    expect(pts[468].color).toBe(colorOf('iris'));
  });

  it('yüz kayınca tüm noktalar aynı piksel kadar kayar', () => {
    const a = drawnPoints(canonicalFace({ cx: 600, cy: 350 }));
    const b = drawnPoints(canonicalFace({ cx: 700, cy: 330 }));
    a.forEach((p, i) => {
      expect(b[i].x - p.x).toBeCloseTo(100, 6);
      expect(b[i].y - p.y).toBeCloseTo(-20, 6);
    });
  });

  it('baş yana yatınca çizilen göz köşeleri arasındaki açı yatma açısını izler', () => {
    for (const roll of [-20, -5, 0, 10, 25]) {
      const pts = drawnPoints(canonicalFace({ roll }));
      const angle = (Math.atan2(pts[263].y - pts[33].y, pts[263].x - pts[33].x) * 180) / Math.PI;
      // kanonik ağda iki dış köşe aynı yükseklikte; ham görüntüde y aşağı → açı = −roll
      expect(angle).toBeCloseTo(-roll, 6);
    }
  });

  it('eski nokta katmanı (Algoritma Modu kapalı) da aynı piksellere çizer', () => {
    const face = canonicalFace({ yaw: 10, roll: 5 });
    const ctx = mockContext(W, H);
    drawLandmarkOverlay(ctx, face, FACE_CONTOURS, { showPoints: true, showContours: false, showBox: false, colorByDepth: false });
    const rects = ctx.calls.filter((c) => c.name === 'fillRect');
    const algo = drawnPoints(face);
    rects.forEach((c, i) => {
      const [x, y, w, h] = c.args;
      expect(x + w / 2).toBeCloseTo(algo[i].x, 9);
      expect(y + h / 2).toBeCloseTo(algo[i].y, 9);
    });
  });
});

describe('noktalar gözlük yerleştirmesiyle aynı koordinatlarda', () => {
  it('kritik nokta halkalarının ortası, gözlüğün kullandığı göz merkezleridir', () => {
    for (const pose of [{}, { cx: 500, roll: 12 }, { yaw: 20, pxPerCm: 18 }]) {
      const face = canonicalFace(pose);
      const ctx = mockContext(W, H);
      drawAlgorithmOverlay(ctx, { face, placement: null }, only('critical'), ASSETS);
      const [r33, r133, r362, r263] = ctx.calls.filter((c) => c.name === 'arc').map((c) => ({ x: c.args[0], y: c.args[1] }));
      const m = eyeMetrics(eyeCenters(face, W, H));
      expect((r33.x + r133.x) / 2).toBeCloseTo(m.right.x, 9);
      expect((r33.y + r133.y) / 2).toBeCloseTo(m.right.y, 9);
      expect((r362.x + r263.x) / 2).toBeCloseTo(m.left.x, 9);
      expect((r362.y + r263.y) / 2).toBeCloseTo(m.left.y, 9);
    }
  });

  it('aynalanmamış etiket katmanı aynı noktayı ekranda (W − x) konumuna yazar', () => {
    const face = canonicalFace({ cx: 520, roll: 8 });
    const ring = mockContext(W, H);
    drawAlgorithmOverlay(ring, { face, placement: null }, only('critical'), ASSETS);
    const labels = mockContext(W, H);
    drawAlgorithmLabels(labels, { face, placement: null }, only('critical', 'labels'));
    const rings = ring.calls.filter((c) => c.name === 'arc');
    const texts = labels.texts();
    ['33', '133', '362', '263'].forEach((id, k) => {
      const t = texts.find((x) => x.text === id);
      // Aynalı canvas'ta x olan nokta ekranda W − x'te görünür; etiket oraya yazılır
      expect(t.x).toBeCloseTo(W - rings[k].args[0], 9);
    });
  });
});
