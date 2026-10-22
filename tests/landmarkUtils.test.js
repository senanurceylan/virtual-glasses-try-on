import { describe, expect, it } from 'vitest';
import { boundingBox, createMonotonicClock, depthRange, toPixel } from '../src/core/landmarkUtils.js';

describe('toPixel', () => {
  it('normalize koordinatı piksele çevirir, z x ölçeğini kullanır', () => {
    expect(toPixel({ x: 0.5, y: 0.25, z: -0.1 }, 1280, 720)).toEqual({ x: 640, y: 180, z: -128 });
  });
});

describe('boundingBox', () => {
  it('noktaları kapsayan en küçük dikdörtgeni bulur', () => {
    const box = boundingBox([
      { x: 0.2, y: 0.3 },
      { x: 0.6, y: 0.1 },
      { x: 0.4, y: 0.9 },
    ]);
    expect(box.x).toBeCloseTo(0.2);
    expect(box.y).toBeCloseTo(0.1);
    expect(box.width).toBeCloseTo(0.4);
    expect(box.height).toBeCloseTo(0.8);
  });
});

describe('depthRange', () => {
  it('z aralığını bulur', () => {
    expect(depthRange([{ z: 0.1 }, { z: -0.3 }, { z: 0 }])).toEqual({ min: -0.3, max: 0.1 });
  });
});

describe('createMonotonicClock', () => {
  it('zaman damgalarını kesin artan yapar', () => {
    const clock = createMonotonicClock();
    expect(clock(100)).toBe(100);
    expect(clock(100)).toBe(101); // aynı değer → +1
    expect(clock(50)).toBe(102); // geriye gidiş → +1
    expect(clock(200.4)).toBe(200);
  });
});
