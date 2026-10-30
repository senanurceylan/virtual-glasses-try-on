import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { EYE_LANDMARKS } from '../src/core/eyeGeometry.js';
import {
  computeHeadPose,
  eulerAngles,
  matrixFromMediaPipe,
  MODEL_IPD_CM,
  pixelToWorld,
  rotationFromMatrix,
} from '../src/core/headPose.js';
import { syntheticFace } from './helpers.js';

const W = 1280;
const H = 720;
const rad = (d) => (d * Math.PI) / 180;

/** yaw/pitch/roll (derece, 'YXZ') + öteleme + ölçekten MediaPipe biçiminde 16'lık dizi. */
function mediaPipeMatrix({ yaw = 0, pitch = 0, roll = 0, t = [2, -3, -45], s = 1 } = {}) {
  const q = new Quaternion().setFromEuler(new Euler(rad(pitch), rad(yaw), rad(roll), 'YXZ'));
  return new Matrix4().compose(new Vector3(...t), q, new Vector3(s, s, s)).toArray(); // sütun öncelikli
}

/** Göz merkezleri verilen piksel noktalarında olan yapay yüz. */
function faceWithEyes(right, left) {
  const face = syntheticFace();
  const set = (i, p) => (face[i] = { x: p.x / W, y: p.y / H, z: (p.z ?? 0) / W });
  set(EYE_LANDMARKS.rightOuter, { ...right, x: right.x - 20 });
  set(EYE_LANDMARKS.rightInner, { ...right, x: right.x + 20 });
  set(EYE_LANDMARKS.leftInner, { ...left, x: left.x - 20 });
  set(EYE_LANDMARKS.leftOuter, { ...left, x: left.x + 20 });
  return face;
}

describe('pixelToWorld', () => {
  it('piksel (y aşağı, z uzak) → dünya (y yukarı, z kameraya doğru)', () => {
    expect(pixelToWorld({ x: 100, y: 200, z: 30 }).toArray()).toEqual([100, -200, -30]);
  });
});

describe('matrixFromMediaPipe — satır/sütun düzeni', () => {
  it('diziyi sütun öncelikli okur: öteleme 12, 13, 14. elemanlardadır', () => {
    const data = mediaPipeMatrix({ t: [5, 6, 7] });
    expect(data.slice(12, 15)).toEqual([5, 6, 7]);
    const m = matrixFromMediaPipe(data);
    expect(new Vector3().setFromMatrixPosition(m).toArray()).toEqual([5, 6, 7]);
  });

  it('dizi satır öncelikli okunsaydı dönme tersine çevrilirdi (yanlış yorum ayırt edilebilir)', () => {
    const data = mediaPipeMatrix({ roll: 20, t: [0, 0, 0] });
    const correct = eulerAngles(rotationFromMatrix(matrixFromMediaPipe(data)));
    const transposed = eulerAngles(rotationFromMatrix(matrixFromMediaPipe(data).transpose()));
    expect(correct.roll).toBeCloseTo(20);
    expect(transposed.roll).toBeCloseTo(-20);
  });

  it('16 elemanlı olmayan diziyi reddeder', () => {
    expect(() => matrixFromMediaPipe([1, 2, 3])).toThrow();
  });
});

describe('rotationFromMatrix + eulerAngles', () => {
  it.each([
    { yaw: 30, pitch: 0, roll: 0 },
    { yaw: 0, pitch: -20, roll: 0 },
    { yaw: 0, pitch: 0, roll: 15 },
    { yaw: -25, pitch: 10, roll: -8 },
  ])('açıları geri elde eder: %o', (angles) => {
    const got = eulerAngles(rotationFromMatrix(matrixFromMediaPipe(mediaPipeMatrix(angles))));
    expect(got.yaw).toBeCloseTo(angles.yaw);
    expect(got.pitch).toBeCloseTo(angles.pitch);
    expect(got.roll).toBeCloseTo(angles.roll);
  });

  it('matristeki öteleme ve ölçek dönmeyi etkilemez', () => {
    const plain = rotationFromMatrix(matrixFromMediaPipe(mediaPipeMatrix({ yaw: 20, t: [0, 0, 0], s: 1 })));
    const scaled = rotationFromMatrix(matrixFromMediaPipe(mediaPipeMatrix({ yaw: 20, t: [9, -4, -60], s: 1.7 })));
    expect(plain.angleTo(scaled)).toBeCloseTo(0);
  });
});

describe('eksen yönleri ve açı işaretleri', () => {
  const forward = new Vector3(0, 0, 1); // yüzün baktığı yön (kameraya doğru)
  const up = new Vector3(0, 1, 0);
  const q = (a) => rotationFromMatrix(matrixFromMediaPipe(mediaPipeMatrix(a)));

  it('yaw > 0: yüz +x yönüne döner (ham videoda sağa = kişinin soluna)', () => {
    expect(forward.clone().applyQuaternion(q({ yaw: 30 })).x).toBeGreaterThan(0.4);
  });

  it('pitch > 0: yüz aşağı bakar', () => {
    expect(forward.clone().applyQuaternion(q({ pitch: 20 })).y).toBeLessThan(-0.3);
  });

  it('roll > 0: başın üstü −x yönüne yatar (ham videoda saat yönü tersi = kişinin sağ omzu)', () => {
    expect(up.clone().applyQuaternion(q({ roll: 20 })).x).toBeLessThan(-0.3);
  });
});

describe('computeHeadPose', () => {
  it('konum = göz merkezlerinin orta noktası (dünya koordinatında)', () => {
    const face = faceWithEyes({ x: 580, y: 350 }, { x: 700, y: 350 });
    const pose = computeHeadPose(face, mediaPipeMatrix(), W, H);
    expect(pose.position.x).toBeCloseTo(640);
    expect(pose.position.y).toBeCloseTo(-350);
  });

  it('ölçek = gözler arası 3D piksel mesafesi / 6.3 cm (z normalize değer, mm değil)', () => {
    const face = faceWithEyes({ x: 580, y: 350, z: -30 }, { x: 700, y: 350, z: 30 });
    const pose = computeHeadPose(face, mediaPipeMatrix(), W, H);
    expect(pose.pxPerCm).toBeCloseTo(Math.hypot(120, 60) / MODEL_IPD_CM, 3);
  });

  it('kafa yaklaşınca (göz mesafesi 2 katı) ölçek 2 katına çıkar', () => {
    const near = computeHeadPose(faceWithEyes({ x: 520, y: 350 }, { x: 760, y: 350 }), mediaPipeMatrix(), W, H);
    const far = computeHeadPose(faceWithEyes({ x: 580, y: 350 }, { x: 700, y: 350 }), mediaPipeMatrix(), W, H);
    expect(near.pxPerCm / far.pxPerCm).toBeCloseTo(2);
  });

  it.each([-20, 12])('göz çizgisi %i° eğikken matris roll ile göz çizgisi roll aynı işaretli ve eşit', (deg) => {
    // Ham videoda saat yönü tersi (roll > 0) eğim: sol göz (görüntünün sağı) yukarı çıkar → piksel y azalır.
    const a = rad(deg);
    const hx = Math.cos(a) * 60;
    const hy = Math.sin(a) * 60;
    const face = faceWithEyes({ x: 640 - hx, y: 360 + hy }, { x: 640 + hx, y: 360 - hy });
    const pose = computeHeadPose(face, mediaPipeMatrix({ roll: deg }), W, H);
    expect(pose.eyeRoll).toBeCloseTo(deg);
    expect(pose.angles.roll).toBeCloseTo(deg);
  });
});
