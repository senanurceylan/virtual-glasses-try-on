import { describe, expect, it } from 'vitest';
import { drawGlasses, drawPlacementGeometry } from '../src/render/glassesRenderer.js';
import { mockContext } from './helpers.js';

const IMAGE = { width: 1200, height: 420 };
const T = { a: 0.2, b: 0.05, c: -0.05, d: 0.2, e: 500, f: 300 };

describe('drawGlasses', () => {
  it('dönüşüm yoksa yalnızca temizler', () => {
    const ctx = mockContext();
    drawGlasses(ctx, IMAGE, null);
    expect(ctx.count('clearRect')).toBe(1);
    expect(ctx.count('drawImage')).toBe(0);
  });

  it('görseli verilen afin matrisle çizer ve matrisi sıfırlar', () => {
    const ctx = mockContext();
    drawGlasses(ctx, IMAGE, T);
    const transforms = ctx.calls.filter((c) => c.name === 'setTransform').map((c) => c.args);
    expect(transforms).toContainEqual([0.2, 0.05, -0.05, 0.2, 500, 300]);
    expect(transforms.at(-1)).toEqual([1, 0, 0, 1, 0, 0]);
    expect(ctx.calls.find((c) => c.name === 'drawImage').args).toEqual([IMAGE, 0, 0]);
  });
});

describe('drawPlacementGeometry', () => {
  it('iki göz merkezini ve aralarındaki çizgiyi çizer', () => {
    const ctx = mockContext();
    const metrics = {
      right: { x: 580, y: 360 },
      left: { x: 700, y: 360 },
      center: { x: 640, y: 360 },
      distance2D: 120,
    };
    drawPlacementGeometry(ctx, metrics);
    expect(ctx.count('arc')).toBe(2);
    expect(ctx.calls).toContainEqual({ name: 'moveTo', args: [580, 360] });
    expect(ctx.calls).toContainEqual({ name: 'lineTo', args: [700, 360] });
  });
});
