import { describe, expect, it } from 'vitest';
import { DEFAULT_STYLE, depthColor, drawLandmarkOverlay, syncCanvasSize } from '../src/render/landmarkOverlay.js';
import { mockContext, syntheticFace } from './helpers.js';

const CONTOURS = { oval: [{ start: 0, end: 1 }, { start: 1, end: 2 }], leftIris: [{ start: 474, end: 475 }] };
const ONLY_POINTS = { showPoints: true, showContours: false, showBox: false, colorByDepth: false };

describe('drawLandmarkOverlay', () => {
  it('yüz yoksa yalnızca canvası temizler', () => {
    const ctx = mockContext();
    drawLandmarkOverlay(ctx, null, CONTOURS);
    expect(ctx.calls.map((c) => c.name)).toEqual(['clearRect']);
  });

  it('478 noktanın her birini çizer', () => {
    const ctx = mockContext();
    drawLandmarkOverlay(ctx, syntheticFace(), CONTOURS, ONLY_POINTS);
    expect(ctx.count('fillRect')).toBe(478);
  });

  it('noktaları video çözünürlüğündeki piksele yerleştirir', () => {
    const ctx = mockContext(1280, 720);
    const face = syntheticFace();
    face[0] = { x: 0.5, y: 0.5, z: 0 };
    drawLandmarkOverlay(ctx, face, CONTOURS, ONLY_POINTS);
    const [x, y, w, h] = ctx.calls.find((c) => c.name === 'fillRect').args;
    // Kare noktanın merkezi tam (640, 360) olmalı.
    expect(x + w / 2).toBeCloseTo(640);
    expect(y + h / 2).toBeCloseTo(360);
  });

  it('katmanlar ayrı ayrı kapatılabilir', () => {
    const ctx = mockContext();
    drawLandmarkOverlay(ctx, syntheticFace(), CONTOURS, { ...DEFAULT_STYLE, showPoints: false });
    expect(ctx.count('fillRect')).toBe(0);
    expect(ctx.count('strokeRect')).toBe(1); // sınır kutusu
    expect(ctx.count('lineTo')).toBe(3); // kontur bağlantıları
  });
});

describe('depthColor', () => {
  it('yakın ve uzak noktalara farklı renk verir, aralık dışını kırpar', () => {
    expect(depthColor(0)).not.toBe(depthColor(1));
    expect(depthColor(-5)).toBe(depthColor(0));
    expect(depthColor(9)).toBe(depthColor(1));
  });
});

describe('syncCanvasSize', () => {
  it('canvas boyutunu yalnızca farklıysa değiştirir', () => {
    const canvas = { width: 300, height: 150 };
    syncCanvasSize(canvas, 1280, 720);
    expect(canvas).toEqual({ width: 1280, height: 720 });
  });
});
