import { describe, expect, it } from 'vitest';
import {
  applyTransform,
  EYE_LANDMARKS,
  eyeCenters,
  eyeMetrics,
  glassesTransform,
  toDegrees,
} from '../src/core/eyeGeometry.js';
import { syntheticFace } from './helpers.js';

const W = 1280;
const H = 720;
// Gözlük görselindeki göz bebeği noktaları (glassesCatalog ile aynı)
const ANCHORS = { right: { x: 330, y: 200 }, left: { x: 870, y: 200 } };

/** Göz merkezleri verilen noktalarda olan yapay yüz (normalize koordinatlarla). */
function faceWithEyes(right, left) {
  const face = syntheticFace();
  const set = (i, p) => (face[i] = { x: p.x / W, y: p.y / H, z: (p.z ?? 0) / W });
  // Her gözün iki köşesini merkezden ±20 px yatay konuma koy → orta nokta = merkez
  set(EYE_LANDMARKS.rightOuter, { ...right, x: right.x - 20 });
  set(EYE_LANDMARKS.rightInner, { ...right, x: right.x + 20 });
  set(EYE_LANDMARKS.leftInner, { ...left, x: left.x - 20 });
  set(EYE_LANDMARKS.leftOuter, { ...left, x: left.x + 20 });
  return face;
}

/** Merkez etrafında açı ve mesafeyle göz çifti üretir. */
function eyesAt({ cx = 640, cy = 360, distance = 120, angleDeg = 0, dz = 0 }) {
  const a = (angleDeg * Math.PI) / 180;
  const hx = (Math.cos(a) * distance) / 2;
  const hy = (Math.sin(a) * distance) / 2;
  return {
    right: { x: cx - hx, y: cy - hy, z: -dz / 2 },
    left: { x: cx + hx, y: cy + hy, z: dz / 2 },
  };
}

describe('eyeCenters', () => {
  it('göz merkezini iki köşenin orta noktası olarak bulur', () => {
    const face = faceWithEyes({ x: 580, y: 350 }, { x: 700, y: 352 });
    const { right, left } = eyeCenters(face, W, H);
    expect(right.x).toBeCloseTo(580);
    expect(right.y).toBeCloseTo(350);
    expect(left.x).toBeCloseTo(700);
    expect(left.y).toBeCloseTo(352);
  });
});

describe('eyeMetrics', () => {
  it('yatay gözlerde açı 0, mesafe doğru', () => {
    const m = eyeMetrics(eyesAt({ distance: 120 }));
    expect(m.angle).toBeCloseTo(0);
    expect(m.distance2D).toBeCloseTo(120);
    expect(m.center).toMatchObject({ x: 640, y: 360 });
  });

  it.each([-30, -10, 15, 40])('baş %i° eğilince açıyı doğru ölçer', (deg) => {
    const m = eyeMetrics(eyesAt({ angleDeg: deg }));
    expect(toDegrees(m.angle)).toBeCloseTo(deg);
  });

  it('derinlik farkı (yaw) 3D mesafeyi 2D mesafeden büyük yapar', () => {
    const m = eyeMetrics(eyesAt({ distance: 90, dz: 60 }));
    expect(m.distance2D).toBeCloseTo(90);
    expect(m.distance3D).toBeCloseTo(Math.hypot(90, 60));
  });
});

describe('glassesTransform', () => {
  it.each([
    { angleDeg: 0, distance: 120 },
    { angleDeg: 20, distance: 120 },
    { angleDeg: -35, distance: 200 },
    { angleDeg: 10, distance: 60, cx: 300, cy: 500 },
  ])('görseldeki göz noktalarını ekrandaki göz merkezlerine oturtur (%o)', (cfg) => {
    const eyes = eyesAt(cfg);
    const t = glassesTransform(eyeMetrics(eyes), ANCHORS);
    const r = applyTransform(t, ANCHORS.right);
    const l = applyTransform(t, ANCHORS.left);
    expect(r.x).toBeCloseTo(eyes.right.x, 6);
    expect(r.y).toBeCloseTo(eyes.right.y, 6);
    expect(l.x).toBeCloseTo(eyes.left.x, 6);
    expect(l.y).toBeCloseTo(eyes.left.y, 6);
  });

  it('kameraya yaklaşınca (mesafe 2 katı) gözlük 2 kat büyür', () => {
    const near = glassesTransform(eyeMetrics(eyesAt({ distance: 240 })), ANCHORS);
    const far = glassesTransform(eyeMetrics(eyesAt({ distance: 120 })), ANCHORS);
    expect(near.scaleX / far.scaleX).toBeCloseTo(2);
    expect(near.scaleY / far.scaleY).toBeCloseTo(2);
  });

  it('ölçek = gözler arası mesafe / görseldeki mesafe', () => {
    const t = glassesTransform(eyeMetrics(eyesAt({ distance: 135 })), ANCHORS);
    expect(t.scaleX).toBeCloseTo(135 / 540);
  });

  it('gözlüğü göz çizgisiyle aynı açıda döndürür', () => {
    const t = glassesTransform(eyeMetrics(eyesAt({ angleDeg: 25 })), ANCHORS);
    expect(toDegrees(t.angle)).toBeCloseTo(25);
    // Görselin yatay ekseni (1,0) ekranda 25° dönmüş olmalı
    expect(toDegrees(Math.atan2(t.b, t.a))).toBeCloseTo(25);
  });

  it('yaw durumunda yatay daralır ama dikey ölçek korunur', () => {
    const frontal = glassesTransform(eyeMetrics(eyesAt({ distance: 120 })), ANCHORS);
    const turned = glassesTransform(eyeMetrics(eyesAt({ distance: 90, dz: Math.sqrt(120 ** 2 - 90 ** 2) })), ANCHORS);
    expect(turned.scaleX).toBeLessThan(frontal.scaleX);
    expect(turned.scaleY).toBeCloseTo(frontal.scaleY);
  });
});
