// Algoritma Modu çizimleri. Yalnızca mevcut hesapların çıktıları çizilir
// (computePlacement, measureFace); burada yeni bir ölçüm ya da filtre yoktur.
//
// İki katman vardır:
//   drawAlgorithmOverlay → AYNALI kapsayıcıdaki canvas (video ile aynı ham piksel
//                          koordinatları). Yazı çizilmez, ters görünürdü.
//   drawAlgorithmLabels  → AYNALANMAMIŞ canvas: sayısal etiketler ve 3D eksen gizmosu.
//                          Ham x koordinatı ekranda (genişlik − x) konumundadır.

import { CRITICAL_POINTS, poseAxes, REGION_INFO } from '../core/algorithmLayers.js';
import { applyTransform } from '../core/eyeGeometry.js';
import { measureFace, SHAPE_LANDMARKS } from '../core/faceShape.js';
import { depthRange } from '../core/landmarkUtils.js';
import { drawPlacementGeometry } from './glassesRenderer.js';
import { depthColor } from './landmarkOverlay.js';

const REGION_COLORS = REGION_INFO.map((r) => r.color);

/** Yüz şekli ölçü çizgileri: landmark çifti, renk ve oran anahtarı (faceShape.FEATURES). */
export const SHAPE_LINES = [
  { key: 'forehead', label: 'Alın', ratio: 'F', color: '#c08bff' },
  { key: 'cheekbone', label: 'Elmacık', ratio: null, color: '#5b8cff' },
  { key: 'jaw', label: 'Çene', ratio: 'J', color: '#3ddc97' },
  { key: 'chin', label: 'Çene ucu', ratio: 'C', color: '#ffd666' },
  { key: 'length', label: 'Uzunluk', ratio: 'L', color: '#ff9f43' },
];
const JAW_ANGLE_COLOR = '#ff6b9a';

export const AXIS_COLORS = { x: '#ff6b6b', y: '#3ddc97', z: '#5b8cff' };

const lineScale = (width) => Math.max(1, width / 640);
const px = (p, width, height) => ({ x: p.x * width, y: p.y * height });

/**
 * Aynalı katman: noktalar, ağ, kritik noktalar, yerleştirme geometrisi, ham/filtreli
 * karşılaştırma ve yüz şekli çizgileri. Önce canvas temizlenir.
 *
 * @param frame   { face, placement, glassesSize: {width, height} | null }
 * @param layers  DEFAULT_ALGO.layers biçiminde açık/kapalı bayraklar
 * @param assets  { regions: landmarkRegions() çıktısı, tesselation: FACE_TESSELATION }
 */
export function drawAlgorithmOverlay(ctx, frame, layers, assets) {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  const { face, placement } = frame;
  if (!face) return;
  const s = lineScale(width);

  if (layers.mesh) drawMesh(ctx, face, assets.tesselation, width, height, s);
  if (layers.shape) drawShapeLines(ctx, face, width, height, s);
  if (layers.points) drawRegionPoints(ctx, face, assets.regions, layers.depth, width, height, s);
  if (layers.critical) drawCritical(ctx, face, width, height, s);
  if (placement) {
    if (layers.geometry) {
      if (placement.transform && frame.glassesSize) drawGlassesBounds(ctx, placement.transform, frame.glassesSize, s);
      drawPlacementGeometry(ctx, placement.metrics);
    }
    if (layers.filter) drawFilterCompare(ctx, placement, s);
  }
}

function drawMesh(ctx, face, edges, width, height, s) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 0.6 * s;
  ctx.beginPath();
  for (const { start, end } of edges) {
    const a = face[start];
    const b = face[end];
    if (!a || !b) continue;
    ctx.moveTo(a.x * width, a.y * height);
    ctx.lineTo(b.x * width, b.y * height);
  }
  ctx.stroke();
  ctx.restore();
}

function drawRegionPoints(ctx, face, regions, byDepth, width, height, s) {
  const size = 1.8 * s;
  const half = size / 2;
  const { min, max } = byDepth ? depthRange(face) : { min: 0, max: 1 };
  const span = max - min || 1;
  for (let i = 0; i < face.length; i++) {
    const p = face[i];
    const region = regions[i] ?? 0;
    ctx.fillStyle = byDepth ? depthColor((p.z - min) / span) : REGION_COLORS[region];
    const k = region === 0 || byDepth ? 1 : 1.35; // bölge noktaları biraz büyük
    ctx.fillRect(p.x * width - half * k, p.y * height - half * k, size * k, size * k);
  }
}

function drawCritical(ctx, face, width, height, s) {
  ctx.save();
  ctx.lineWidth = 2 * s;
  ctx.strokeStyle = '#ffffff';
  for (const i of CRITICAL_POINTS) {
    const p = px(face[i], width, height);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6 * s, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** Dönüştürülmüş gözlük görselinin sınırı: öteleme + dönme + ölçeğin birlikte görünümü. */
function drawGlassesBounds(ctx, transform, size, s) {
  const corners = [
    { x: 0, y: 0 },
    { x: size.width, y: 0 },
    { x: size.width, y: size.height },
    { x: 0, y: size.height },
  ].map((c) => applyTransform(transform, c));
  ctx.save();
  ctx.strokeStyle = 'rgba(91, 140, 255, 0.85)';
  ctx.lineWidth = 1.5 * s;
  ctx.setLineDash([5 * s, 4 * s]);
  ctx.beginPath();
  corners.forEach((c, i) => (i ? ctx.lineTo(c.x, c.y) : ctx.moveTo(c.x, c.y)));
  ctx.lineTo(corners[0].x, corners[0].y);
  ctx.stroke();
  ctx.restore();
}

/** Ham ölçüm gri halka, filtrelenmiş ölçüm dolu nokta: aradaki fark filtrenin etkisidir. */
function drawFilterCompare(ctx, placement, s) {
  const raw = placement.raw.metrics;
  const filt = placement.metrics;
  ctx.save();
  ctx.lineWidth = 1.5 * s;
  ctx.strokeStyle = 'rgba(220, 225, 235, 0.9)';
  for (const p of [raw.right, raw.left, raw.center]) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 9 * s, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#3ddc97';
  for (const p of [filt.right, filt.left]) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.5 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawShapeLines(ctx, face, width, height, s) {
  ctx.save();
  ctx.lineWidth = 2 * s;
  ctx.lineCap = 'round';
  for (const line of SHAPE_LINES) {
    const [a, b] = SHAPE_LANDMARKS[line.key].map((i) => px(face[i], width, height));
    ctx.strokeStyle = line.color;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Çene köşesi açısı: 234–172–152 ve 454–397–152 (köşe noktası ortada)
  ctx.strokeStyle = JAW_ANGLE_COLOR;
  ctx.setLineDash([4 * s, 3 * s]);
  for (const chain of [SHAPE_LANDMARKS.jawAngle, [454, 397, 152]]) {
    const pts = chain.map((i) => px(face[i], width, height));
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Aynalanmamış katman: sayısal etiketler ve 3D eksen gizmosu. Önce canvas temizlenir.
 * Ham koordinat x, ekranda (genişlik − x) konumuna yazılır.
 */
export function drawAlgorithmLabels(ctx, frame, layers) {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  const { face, placement } = frame;
  if (!face) return;
  const s = lineScale(width);
  const mx = (x) => width - x;
  ctx.save();
  ctx.font = `600 ${Math.round(12 * s)}px ui-monospace, Menlo, monospace`;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  if (layers.gizmo && placement?.pose) drawGizmo(ctx, placement, mx, s, layers.labels);

  if (layers.labels) {
    if (layers.critical) {
      for (const i of CRITICAL_POINTS) {
        const p = px(face[i], width, height);
        label(ctx, String(i), mx(p.x), p.y - 14 * s, '#ffffff', s, 'center');
      }
    }
    if (layers.geometry && placement) {
      const m = placement.metrics;
      const theta = (-m.angle * 180) / Math.PI; // ekranda (aynalı) görülen eğim
      label(ctx, `d = ${m.distance3D.toFixed(0)} px`, mx(m.center.x), m.center.y - 38 * s, '#3ddc97', s, 'center');
      label(ctx, `θ = ${signed(theta)}°`, mx(m.center.x), m.center.y + 22 * s, '#ff6b6b', s, 'center');
      if (placement.transform) {
        const t = placement.transform;
        label(ctx, `s = ${t.scaleX.toFixed(2)}×${t.scaleY.toFixed(2)}`, mx(m.center.x), m.center.y + 40 * s, '#5b8cff', s, 'center');
      }
    }
    if (layers.shape) drawShapeLabels(ctx, face, width, height, mx, s);
  }
  ctx.restore();
}

function drawShapeLabels(ctx, face, width, height, mx, s) {
  const { ratios } = measureFace(face, width, height);
  for (const line of SHAPE_LINES) {
    const [a, b] = SHAPE_LANDMARKS[line.key].map((i) => px(face[i], width, height));
    const value = line.ratio ? ratios[line.ratio].toFixed(2) : '1.00';
    if (line.key === 'length') {
      label(ctx, `${line.label} ${value}`, mx(a.x) + 10 * s, a.y - 12 * s, line.color, s, 'left');
    } else {
      // Ekranda soldaki uca yaz (ham videoda sağdaki uç)
      const end = mx(a.x) < mx(b.x) ? a : b;
      label(ctx, `${line.label} ${value}`, mx(end.x) - 10 * s, end.y, line.color, s, 'right');
    }
  }
  const corner = px(face[172], width, height);
  label(ctx, `∠ ${ratios.A.toFixed(0)}°`, mx(corner.x) + 10 * s, corner.y + 14 * s, JAW_ANGLE_COLOR, s, 'left');
}

/** Kafa eksenleri gözlük merkezinde: Three.js'e verilen konum + dönmenin aynısı. */
function drawGizmo(ctx, placement, mx, s, withAngles) {
  const { pose, metrics } = placement;
  const origin = { x: mx(metrics.center.x), y: metrics.center.y };
  const len = metrics.distance3D * 0.55;
  const axes = poseAxes(pose.quaternion);
  // Arkadaki eksen önce çizilir (z küçük = kameradan uzak)
  const order = Object.entries(axes).sort((a, b) => a[1].depth - b[1].depth);
  ctx.lineCap = 'round';
  for (const [name, v] of order) {
    const tip = { x: origin.x - v.dx * len, y: origin.y + v.dy * len }; // ekran aynalı: dx ters
    ctx.lineWidth = 3 * s;
    ctx.strokeStyle = AXIS_COLORS[name];
    ctx.globalAlpha = v.depth < -0.2 ? 0.55 : 1;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    label(ctx, name.toUpperCase(), tip.x, tip.y, AXIS_COLORS[name], s, 'center');
  }
  if (withAngles) {
    // Sağ üst köşe: yüz üzerindeki etiketlerle çakışmaz (sol üstte FPS göstergesi var)
    const { yaw, pitch, roll } = pose.angles;
    const x = ctx.canvas.width - 12 * s;
    label(ctx, `yaw ${signed(yaw)}°`, x, 18 * s, '#e8ecf1', s, 'right');
    label(ctx, `pitch ${signed(pitch)}°`, x, 36 * s, '#e8ecf1', s, 'right');
    label(ctx, `roll ${signed(roll)}°`, x, 54 * s, '#e8ecf1', s, 'right');
  }
}

// İşaret yuvarlanmış değerden alınır: −0.00001 → "+0.0" (−0.0 yazılmaz)
const signed = (v, digits = 1) => {
  const r = Number(v.toFixed(digits));
  return `${r >= 0 ? '+' : '−'}${Math.abs(r).toFixed(digits)}`;
};

/** Okunurluk için koyu kenarlı yazı. */
function label(ctx, text, x, y, color, s, align) {
  ctx.textAlign = align;
  ctx.lineWidth = 3.5 * s;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}
