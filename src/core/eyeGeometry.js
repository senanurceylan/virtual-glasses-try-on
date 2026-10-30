// Göz geometrisi ve gözlük yerleştirme dönüşümü.
//
// Algoritma (her karede):
//  1. Göz merkezi = göz köşelerinin orta noktası
//       kişinin sağ gözü: dış köşe 33, iç köşe 133
//       kişinin sol gözü: iç köşe 362, dış köşe 263
//     İris merkezi (468/473) yerine köşeler kullanılır: bakış yönü değişince
//     iris kayar ama köşeler kafaya sabittir, gözlük gözle birlikte kaymaz.
//  2. Gözler arası mesafe:
//       d2D = √(Δx² + Δy²)          → ekrandaki (izdüşüm) mesafe
//       d3D = √(Δx² + Δy² + Δz²)    → derinlik dahil gerçek mesafe
//  3. Eğim (roll) açısı: θ = atan2(Δy, Δx)
//  4. Ölçek: sx = d2D / dPNG, sy = d3D / dPNG
//     (dPNG: gözlük görselindeki göz bebekleri arası piksel mesafesi)
//     Kafa kameraya yaklaşınca d büyür → gözlük büyür; uzaklaşınca küçülür.
//     Kafa sağa/sola dönünce (yaw) gözler ekranda birbirine yaklaşır (d2D küçülür)
//     ama gerçek mesafe (d3D) değişmez. Yatay ölçek d2D'yi, dikey ölçek d3D'yi
//     kullandığı için gözlük yalnızca yatayda daralır; dikeyde basık görünmez.
//  5. Afin dönüşüm: görseldeki göz noktalarının orta noktası, ekrandaki göz
//     merkezlerinin orta noktasına taşınır; θ kadar döndürülür, (sx, sy) ile ölçeklenir.
//
// Koordinatlar ham (aynalanmamış) video pikselleridir. Aynalama CSS ile tüm
// katmanlara birlikte uygulandığı için hesaplar aynalamadan bağımsızdır.

import { toPixel } from './landmarkUtils.js';

export const EYE_LANDMARKS = {
  rightOuter: 33,
  rightInner: 133,
  leftInner: 362,
  leftOuter: 263,
};

const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });

/**
 * Göz merkezlerini piksel cinsinden döndürür.
 * `right` kişinin sağ gözüdür ve ham videoda görüntünün solunda kalır.
 */
export function eyeCenters(face, width, height) {
  const p = (i) => toPixel(face[i], width, height);
  return {
    right: midpoint(p(EYE_LANDMARKS.rightOuter), p(EYE_LANDMARKS.rightInner)),
    left: midpoint(p(EYE_LANDMARKS.leftInner), p(EYE_LANDMARKS.leftOuter)),
  };
}

/** Göz merkezlerinden mesafe, açı ve orta noktayı hesaplar. */
export function eyeMetrics({ right, left }) {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  const dz = left.z - right.z;
  return {
    right,
    left,
    center: midpoint(right, left),
    distance2D: Math.hypot(dx, dy),
    distance3D: Math.hypot(dx, dy, dz),
    angle: Math.atan2(dy, dx), // radyan; 0 = gözler yatay
  };
}

/**
 * Gözlük görselini ekrana yerleştiren 2×3 afin matris.
 * Canvas'ın setTransform(a, b, c, d, e, f) sırasıyla uyumludur:
 *   x' = a·x + c·y + e
 *   y' = b·x + d·y + f
 *
 * @param metrics  eyeMetrics() çıktısı
 * @param anchors  görseldeki göz bebeği noktaları { right: {x,y}, left: {x,y} }
 *                 (right = görselin solundaki cam; ham videodaki yerleşimle aynı)
 */
export function glassesTransform(metrics, anchors) {
  const ax = anchors.left.x - anchors.right.x;
  const ay = anchors.left.y - anchors.right.y;
  const anchorDistance = Math.hypot(ax, ay);
  const anchorAngle = Math.atan2(ay, ax);
  const mx = (anchors.right.x + anchors.left.x) / 2;
  const my = (anchors.right.y + anchors.left.y) / 2;

  const scaleX = metrics.distance2D / anchorDistance;
  const scaleY = metrics.distance3D / anchorDistance;
  const theta = metrics.angle - anchorAngle;

  // Döndürülmüş eksenler: u = göz çizgisi yönü, n = ona dik (aşağı)
  const ux = Math.cos(theta);
  const uy = Math.sin(theta);
  const nx = -uy;
  const ny = ux;

  const a = ux * scaleX;
  const b = uy * scaleX;
  const c = nx * scaleY;
  const d = ny * scaleY;
  const e = metrics.center.x - a * mx - c * my;
  const f = metrics.center.y - b * mx - d * my;

  return { a, b, c, d, e, f, scaleX, scaleY, angle: theta };
}

/** Afin matrisi bir noktaya uygular (test ve hata ayıklama için). */
export function applyTransform(t, point) {
  return { x: t.a * point.x + t.c * point.y + t.e, y: t.b * point.x + t.d * point.y + t.f };
}

export const toDegrees = (rad) => (rad * 180) / Math.PI;
