// Alın görünürlüğü kontrolü (renk tabanlı ten benzerliği).
//
// MediaPipe alın noktalarını saç altında da "tahmin eder"; yani noktalar her zaman
// vardır ama perçem alnı kapatıyorsa alın genişliği gerçek yüzü yansıtmaz.
// Bunu görüntüden anlamak için:
//   1. Yanak noktalarının çevresinden piksel alınır → kişinin ten rengi modeli.
//   2. Alın noktalarının çevresinden piksel alınır.
//   3. Pikseller YCrCb uzayına çevrilir. Cr/Cb (renk) ışık şiddetinden büyük ölçüde
//      bağımsızdır, Y (parlaklık) ayrı tutulur.
//   4. Alın pikseli, renk olarak yanağa yakınsa (|Cr − μCr| ve |Cb − μCb| ≤ k·σ) ve
//      çok koyu değilse (Y ≥ oran · μY) "ten" sayılır. Saç genelde ya renk olarak
//      farklı ya da çok daha koyudur.
//   5. Ten oranı eşiğin altındaysa alın kapalı kabul edilir.

/** ITU-R BT.601 RGB → YCrCb (0–255). */
export function rgbToYCrCb(r, g, b) {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  return { y, cr: 128 + 0.5 * r - 0.418688 * g - 0.081312 * b, cb: 128 - 0.168736 * r - 0.331264 * g + 0.5 * b };
}

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const std = (a, m = mean(a)) => Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length);

/** Yanak piksellerinden ten rengi modeli. pixels: [[r,g,b], …] */
export function skinModel(pixels) {
  const c = pixels.map(([r, g, b]) => rgbToYCrCb(r, g, b));
  const cr = c.map((p) => p.cr);
  const cb = c.map((p) => p.cb);
  return { y: mean(c.map((p) => p.y)), cr: mean(cr), cb: mean(cb), crStd: std(cr), cbStd: std(cb) };
}

export const SKIN_DEFAULTS = { k: 2.5, minTolerance: 6, minLumaRatio: 0.55 };

/**
 * Alın piksellerinin ten modeline uyan oranı (0–1).
 * @param forehead  [[r,g,b], …]
 * @param cheeks    [[r,g,b], …]
 */
export function skinCoverage(forehead, cheeks, opts = SKIN_DEFAULTS) {
  if (!forehead.length || !cheeks.length) return null;
  const m = skinModel(cheeks);
  const tCr = Math.max(opts.k * m.crStd, opts.minTolerance);
  const tCb = Math.max(opts.k * m.cbStd, opts.minTolerance);
  const skin = forehead.filter(([r, g, b]) => {
    const p = rgbToYCrCb(r, g, b);
    return Math.abs(p.cr - m.cr) <= tCr && Math.abs(p.cb - m.cb) <= tCb && p.y >= opts.minLumaRatio * m.y;
  });
  return skin.length / forehead.length;
}

/** Örnekleme noktaları (MediaPipe indeksleri). Alın noktaları kaş ile saç çizgisi arasında. */
export const FOREHEAD_POINTS = [10, 109, 338, 67, 297, 108, 337, 151, 69, 299, 104, 333];
export const CHEEK_POINTS = [50, 280, 101, 330, 118, 347, 205, 425, 36, 266];
