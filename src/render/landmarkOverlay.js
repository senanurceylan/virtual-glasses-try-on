// Yüz noktalarını 2D canvas üzerine çizer.
//
// Hizalama: canvas'ın iç çözünürlüğü video karesiyle birebir aynıdır (ör. 1280×720)
// ve canvas, videoyla aynı aynalanmış kapsayıcıdadır. Böylece normalize nokta
// (x, y) doğrudan (x·genişlik, y·yükseklik) pikseline düşer; ek dönüşüm gerekmez.
//
// Canvas aynalandığı için buraya yazı çizilmez (ters görünür); yazılar React katmanında.

import { boundingBox, depthRange, toPixel } from '../core/landmarkUtils.js';

const IRIS_START = 468;

export const DEFAULT_STYLE = {
  showPoints: true,
  showContours: true,
  showBox: true,
  colorByDepth: true,
};

/** Canvas iç çözünürlüğünü video boyutuna eşitler (gerekirse). */
export function syncCanvasSize(canvas, width, height) {
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

/**
 * Derinliği renge çevirir: kameraya yakın noktalar açık camgöbeği,
 * uzak noktalar koyu mor. t ∈ [0, 1] (0 = en yakın).
 */
export function depthColor(t) {
  const clamped = Math.min(1, Math.max(0, t));
  const hue = 185 + clamped * 85; // 185° camgöbeği → 270° mor
  const light = 72 - clamped * 22;
  return `hsl(${hue.toFixed(0)}, 90%, ${light.toFixed(0)}%)`;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{x,y,z}>|null} face  tek yüzün 478 noktası (yoksa yalnızca temizlenir)
 * @param {object} contours  { ad: [{start, end}, ...] } — FACE_CONTOURS
 */
export function drawLandmarkOverlay(ctx, face, contours, style = DEFAULT_STYLE) {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  if (!face) return;

  const scale = Math.max(1, width / 640); // 1280 px genişlikte çizgiler 2 kat kalın

  if (style.showBox) drawBox(ctx, face, width, height, scale);
  if (style.showContours) drawContours(ctx, face, contours, width, height, scale);
  if (style.showPoints) drawPoints(ctx, face, width, height, scale, style.colorByDepth);
}

function drawBox(ctx, face, width, height, scale) {
  const box = boundingBox(face);
  ctx.save();
  ctx.strokeStyle = 'rgba(91, 140, 255, 0.7)';
  ctx.lineWidth = 1.5 * scale;
  ctx.setLineDash([8 * scale, 6 * scale]);
  ctx.strokeRect(box.x * width, box.y * height, box.width * width, box.height * height);
  ctx.restore();
}

function drawContours(ctx, face, contours, width, height, scale) {
  ctx.save();
  ctx.lineWidth = 1.2 * scale;
  ctx.lineJoin = 'round';
  for (const [name, connections] of Object.entries(contours)) {
    ctx.strokeStyle = name.endsWith('Iris') ? 'rgba(255, 214, 102, 0.95)' : 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    for (const { start, end } of connections) {
      const a = face[start];
      const b = face[end];
      if (!a || !b) continue;
      ctx.moveTo(a.x * width, a.y * height);
      ctx.lineTo(b.x * width, b.y * height);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawPoints(ctx, face, width, height, scale, colorByDepth) {
  const size = 1.6 * scale;
  const half = size / 2;
  const { min, max } = depthRange(face);
  const span = max - min || 1;

  for (let i = 0; i < face.length; i++) {
    const p = toPixel(face[i], width, height);
    if (i >= IRIS_START) {
      ctx.fillStyle = '#ffd666';
      ctx.fillRect(p.x - half * 1.5, p.y - half * 1.5, size * 1.5, size * 1.5);
    } else {
      ctx.fillStyle = colorByDepth ? depthColor((face[i].z - min) / span) : '#7cf5ff';
      ctx.fillRect(p.x - half, p.y - half, size, size);
    }
  }
}
