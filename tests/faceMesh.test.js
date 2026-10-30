import { describe, expect, it } from 'vitest';
import { FACE_TESSELATION } from '../src/core/faceLandmarker.js';
import { trianglesFromTesselation } from '../src/core/faceMesh.js';

describe('trianglesFromTesselation', () => {
  it('ardışık 3 kenarı bir üçgene çevirir', () => {
    const edges = [
      { start: 0, end: 1 },
      { start: 1, end: 2 },
      { start: 2, end: 0 },
      { start: 2, end: 3 },
      { start: 3, end: 0 },
      { start: 0, end: 2 },
    ];
    expect(trianglesFromTesselation(edges)).toEqual([0, 1, 2, 2, 3, 0]);
  });

  it('kapalı olmayan üçlüyü reddeder', () => {
    expect(() =>
      trianglesFromTesselation([
        { start: 0, end: 1 },
        { start: 1, end: 2 },
        { start: 2, end: 5 },
      ]),
    ).toThrow();
  });

  it('MediaPipe yüz ağından 852 üçgen çıkarır, indeksler yüz noktalarındadır (0–467)', () => {
    const tri = trianglesFromTesselation(FACE_TESSELATION);
    expect(tri.length / 3).toBe(852);
    expect(Math.min(...tri)).toBe(0);
    expect(Math.max(...tri)).toBe(467);
  });

  it('hiçbir üçgen tekrarlanmaz ve dejenere değildir', () => {
    const tri = trianglesFromTesselation(FACE_TESSELATION);
    const keys = new Set();
    for (let i = 0; i < tri.length; i += 3) {
      const t = [tri[i], tri[i + 1], tri[i + 2]];
      expect(new Set(t).size).toBe(3);
      keys.add([...t].sort((a, b) => a - b).join(','));
    }
    expect(keys.size).toBe(852);
  });
});
