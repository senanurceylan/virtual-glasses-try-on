import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { EYE_LANDMARKS, glassesTransform } from '../src/core/eyeGeometry.js';
import { computePlacement } from '../src/core/placementPipeline.js';
import { PlacementStabilizer } from '../src/core/stabilizer.js';
import { StabilityMonitor } from '../src/core/stabilityMonitor.js';
import { gaussian, frameTimes } from './filterSim.js';
import { syntheticFace } from './helpers.js';

const W = 1280;
const H = 720;
const ANCHORS = { right: { x: 330, y: 200 }, left: { x: 870, y: 200 } };

/** Göz merkezleri (cx ± 60, cy) civarında, isteğe bağlı gürültülü yapay yüz. */
function face({ cx = 640, cy = 360, noise = null } = {}) {
  const f = syntheticFace();
  const n = () => (noise ? noise() : 0);
  const set = (i, x, y) => (f[i] = { x: (x + n()) / W, y: (y + n()) / H, z: 0 });
  set(EYE_LANDMARKS.rightOuter, cx - 80, cy);
  set(EYE_LANDMARKS.rightInner, cx - 40, cy);
  set(EYE_LANDMARKS.leftInner, cx + 40, cy);
  set(EYE_LANDMARKS.leftOuter, cx + 80, cy);
  return f;
}

function matrix(yawDeg = 0) {
  const q = new Quaternion().setFromEuler(new Euler(0, (yawDeg * Math.PI) / 180, 0, 'YXZ'));
  return new Matrix4().compose(new Vector3(0, 0, -50), q, new Vector3(1, 1, 1)).toArray();
}

const place = (stabilizer, f, t, m = matrix()) =>
  computePlacement({ face: f, matrix: m, width: W, height: H, anchors: ANCHORS, stabilizer, timeSec: t });

describe('PlacementStabilizer + computePlacement', () => {
  it('kapalıyken filtrelenmiş değer = ham değer', () => {
    const s = new PlacementStabilizer({ enabled: false });
    const noise = gaussian(2);
    for (const t of frameTimes(30, 1)) {
      const p = place(s, face({ noise }), t);
      expect(p.metrics.center.x).toBe(p.raw.metrics.center.x);
      expect(p.stabilized).toBe(false);
    }
  });

  it('sabit yüzde 2D yerleştirmenin konum ve açı titremesini azaltır', () => {
    const s = new PlacementStabilizer();
    const monitor = new StabilityMonitor({ windowSize: 1000 });
    const noise = gaussian(4);
    for (const t of frameTimes(30, 5)) monitor.update(place(s, face({ noise }), t));
    const snap = monitor.snapshot();
    expect(snap.position.reduction).toBeGreaterThan(0.8);
    expect(snap.roll.reduction).toBeGreaterThan(0.8);
  });

  it('yüz kaybolunca sıfırlanır: yüz başka yerde geri gelince ilk kare tam yeni konumdadır', () => {
    const s = new PlacementStabilizer();
    for (const t of frameTimes(30, 1)) place(s, face({ cx: 400 }), t);
    expect(place(s, null, 1.05)).toBeNull();
    const back = place(s, face({ cx: 900 }), 1.1);
    expect(back.metrics.center.x).toBeCloseTo(900);
  });

  it('kareler arasında uzun boşluk (> 0.5 s) olursa kendiliğinden sıfırlanır', () => {
    const s = new PlacementStabilizer();
    for (const t of frameTimes(30, 1)) place(s, face({ cx: 400 }), t);
    expect(place(s, face({ cx: 900 }), 2).metrics.center.x).toBeCloseTo(900);
  });

  it('açıp kapatınca durum sıfırlanır', () => {
    const s = new PlacementStabilizer();
    for (const t of frameTimes(30, 1)) place(s, face({ cx: 400 }), t);
    s.setEnabled(false);
    s.setEnabled(true);
    expect(place(s, face({ cx: 700 }), 1.1).metrics.center.x).toBeCloseTo(700);
  });

  it('3D dönmeyi filtreler ve filtrelenmiş pozu üretir', () => {
    const s = new PlacementStabilizer();
    const noise = gaussian(9);
    let p;
    for (const t of frameTimes(30, 3)) p = place(s, face(), t, matrix(15 + 0.5 * noise()));
    expect(p.pose.angles.yaw).toBeCloseTo(15, 0);
    expect(Math.abs(p.pose.angles.yaw - 15)).toBeLessThan(Math.abs(p.raw.pose.angles.yaw - 15) + 0.3);
  });
});

describe('2D ↔ 3D mod geçişi', () => {
  it('2D afin matris ve 3D poz aynı filtrelenmiş ölçümden gelir (geçişte sıçrama yok)', () => {
    const s = new PlacementStabilizer();
    const noise = gaussian(6);
    for (const t of frameTimes(30, 2)) {
      const p = place(s, face({ noise }), t);
      // 2D matris filtrelenmiş metriklerden yeniden hesaplanabilir olmalı
      expect(p.transform).toEqual(glassesTransform(p.metrics, ANCHORS));
      // 3D konum aynı filtrelenmiş orta noktadır
      expect(p.pose.position.x).toBeCloseTo(p.metrics.center.x);
      expect(p.pose.position.y).toBeCloseTo(-p.metrics.center.y);
      expect(p.pose.pxPerCm).toBeCloseTo(p.metrics.distance3D / 6.3);
    }
  });

  it('modu değiştirmek filtre durumunu sıfırlamaz: art arda karelerde konum sürekli kalır', () => {
    const s = new PlacementStabilizer();
    let prev = null;
    const times = frameTimes(30, 2);
    for (const [i, t] of times.entries()) {
      // Yarıda "mod değişir": 2D çizim matrisi yerine 3D poz okunur; hesap aynı yoldan
      const p = place(s, face({ cx: 640 + i * 2 }), t);
      const x = i < times.length / 2 ? p.transform.e : p.pose.position.x;
      if (prev !== null && i !== Math.floor(times.length / 2)) expect(Math.abs(x - prev)).toBeLessThan(10);
      prev = i < times.length / 2 ? p.transform.e : p.pose.position.x;
    }
  });
});

describe('StabilityMonitor', () => {
  it('yüz yokken geçmişi keser, yeni karede sahte büyük sıçrama saymaz', () => {
    const s = new PlacementStabilizer();
    const m = new StabilityMonitor();
    m.update(place(s, face({ cx: 400 }), 0));
    m.update(place(s, face({ cx: 400 }), 0.033));
    m.update(null);
    m.update(place(s, face({ cx: 900 }), 0.1));
    expect(m.snapshot().position.raw).toBeCloseTo(0);
  });

  it('grafik geçmişini sınırlı tutar', () => {
    const s = new PlacementStabilizer();
    const m = new StabilityMonitor({ historySize: 10 });
    for (const t of frameTimes(30, 2)) m.update(place(s, face(), t));
    expect(m.snapshot().history).toHaveLength(10);
  });
});
