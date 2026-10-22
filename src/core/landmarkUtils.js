// Yüz noktalarıyla ilgili saf (MediaPipe'a bağımlı olmayan) yardımcılar.
//
// Model her karede yüz başına 478 nokta döndürür:
//   0–467  : yüz yüzeyi (face mesh)
//   468–472: kişinin sağ irisi (merkez + 4 kenar)   473–477: kişinin sol irisi
// Koordinatlar normalize edilmiştir: x, y ∈ [0, 1] (görüntü genişliği/yüksekliğine göre),
// z göreli derinliktir (x ile aynı ölçekte; negatif = kameraya daha yakın).

export const LANDMARK_COUNT = 478;

/** Normalize noktayı piksel koordinatına çevirir (z, x ölçeğinde piksele çevrilir). */
export function toPixel(point, width, height) {
  return { x: point.x * width, y: point.y * height, z: point.z * width };
}

/** Noktaları kapsayan dikdörtgen (normalize koordinatlarda). */
export function boundingBox(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** z değerlerinin en küçük/en büyük aralığı — derinliğe göre renklendirme için. */
export function depthRange(points) {
  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    if (p.z < min) min = p.z;
    if (p.z > max) max = p.z;
  }
  return { min, max };
}

/**
 * MediaPipe VIDEO modunda zaman damgaları kesin artan olmalıdır; aynı ya da
 * geriye giden değer hata verir. Bu saat bunu garanti eder.
 */
export function createMonotonicClock() {
  let last = -Infinity;
  return (ms) => {
    const t = Math.max(Math.round(ms), last + 1);
    last = t;
    return t;
  };
}
