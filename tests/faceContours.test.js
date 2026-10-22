import { describe, expect, it } from 'vitest';
import { FACE_CONTOURS } from '../src/core/faceLandmarker.js';
import { LANDMARK_COUNT } from '../src/core/landmarkUtils.js';

describe('FACE_CONTOURS', () => {
  it('tüm kontur noktaları 0–477 aralığında', () => {
    for (const [name, connections] of Object.entries(FACE_CONTOURS)) {
      expect(connections.length, name).toBeGreaterThan(0);
      for (const { start, end } of connections) {
        expect(start).toBeLessThan(LANDMARK_COUNT);
        expect(end).toBeLessThan(LANDMARK_COUNT);
      }
    }
  });

  it('iris konturları 468 sonrası noktaları kullanır', () => {
    const irisPoints = [...FACE_CONTOURS.leftIris, ...FACE_CONTOURS.rightIris].flatMap((c) => [c.start, c.end]);
    expect(Math.min(...irisPoints)).toBeGreaterThanOrEqual(468);
  });
});
