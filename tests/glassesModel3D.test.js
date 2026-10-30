import { Box3, Euler, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { MODEL_IPD_CM } from '../src/core/headPose.js';
import {
  buildGlassesModel,
  DIMENSIONS,
  lensOutline,
  offsetOutline,
  templePath,
} from '../src/render/three/glassesModel3D.js';
import { HEAD_ELLIPSOID, rayHitsEllipsoid } from '../src/render/three/occluders.js';

const polygonArea = (pts) =>
  Math.abs(pts.reduce((s, p, i) => s + p.x * pts[(i + 1) % pts.length].y - pts[(i + 1) % pts.length].x * p.y, 0)) / 2;

describe('lensOutline / offsetOutline', () => {
  it('cam hattı 5.2 × 4.0 cm kutusuna sığar', () => {
    const pts = lensOutline();
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(DIMENSIONS.lensHeight, 1);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(DIMENSIONS.lensWidth * 0.95);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(DIMENSIONS.lensWidth * 1.1);
  });

  it('dışa kaydırma alanı büyütür (çerçeve camın dışında kalır)', () => {
    const inner = lensOutline();
    expect(polygonArea(offsetOutline(inner, 0.3))).toBeGreaterThan(polygonArea(inner));
  });
});

describe('buildGlassesModel', () => {
  const { front, temples } = buildGlassesModel();
  const frontBox = new Box3().setFromObject(front);
  const templeBox = new Box3().setFromObject(temples);

  it('gerekli tüm parçaları içerir', () => {
    const names = [];
    front.traverse((o) => names.push(o.name));
    temples.traverse((o) => names.push(o.name));
    for (const part of ['rim-left', 'rim-right', 'lens-left', 'lens-right', 'bridge', 'hinge-left', 'hinge-right', 'temple-left', 'temple-right']) {
      expect(names).toContain(part);
    }
  });

  it('ön çerçeve gerçekçi genişlikte (12–15 cm) ve x = 0 eksenine göre simetrik', () => {
    expect(frontBox.max.x - frontBox.min.x).toBeGreaterThan(12);
    expect(frontBox.max.x - frontBox.min.x).toBeLessThan(15);
    expect(frontBox.max.x + frontBox.min.x).toBeCloseTo(0);
  });

  it('ön çerçeve göz düzleminin önünde (z > 0), saplar arkaya uzanır', () => {
    expect(frontBox.min.z).toBeGreaterThan(0);
    expect(templeBox.min.z).toBeLessThan(-10);
  });

  it('cam merkezleri göz merkezlerinin yakınında (2D modeldeki gibi optik merkez biraz içeride)', () => {
    const lensCenter = (DIMENSIONS.lensWidth + DIMENSIONS.bridge) / 2;
    expect(Math.abs(lensCenter - MODEL_IPD_CM / 2)).toBeLessThan(0.5);
  });
});

describe('occlusion geometrisi (kafa elipsoidi)', () => {
  // Sap yolundan örnek noktalar (yerel koordinat, cm)
  const samples = (side) => templePath(side).getPoints(40);
  const view = new Vector3(0, 0, 1); // dünyada kameraya doğru

  /** Kafa yaw kadar dönmüşken bir sapın gizlenen nokta oranı. */
  function hiddenRatio(side, yawDeg) {
    const q = new Quaternion().setFromEuler(new Euler(0, (yawDeg * Math.PI) / 180, 0, 'YXZ'));
    const localView = view.clone().applyQuaternion(q.clone().invert()); // kamera yönü yerel koordinatta
    const pts = samples(side);
    return pts.filter((p) => rayHitsEllipsoid(p, localView)).length / pts.length;
  }

  it('saplar kafa elipsoidinin dışında kalır (yandan bakınca görünür olmalı)', () => {
    const [cx, cy, cz] = HEAD_ELLIPSOID.center;
    const [rx, ry, rz] = HEAD_ELLIPSOID.radii;
    for (const side of [-1, 1]) {
      for (const p of samples(side)) {
        expect(((p.x - cx) / rx) ** 2 + ((p.y - cy) / ry) ** 2 + ((p.z - cz) / rz) ** 2).toBeGreaterThan(1);
      }
    }
  });

  it('kafa düzken saplar kafanın arkasında gizlenmez', () => {
    expect(hiddenRatio(-1, 0)).toBeLessThan(0.1);
    expect(hiddenRatio(1, 0)).toBeLessThan(0.1);
  });

  it('kafa sola dönünce (yaw +45°) uzak sap (+x) çoğunlukla gizlenir, yakın sap görünür kalır', () => {
    expect(hiddenRatio(1, 45)).toBeGreaterThan(0.6);
    expect(hiddenRatio(-1, 45)).toBeLessThan(0.1);
  });

  it('kafa sağa dönünce (yaw −45°) durum tersine döner', () => {
    expect(hiddenRatio(-1, -45)).toBeGreaterThan(0.6);
    expect(hiddenRatio(1, -45)).toBeLessThan(0.1);
  });
});
