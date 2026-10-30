// Gözlük yerleştirme stabilizasyonu: One Euro filtresi hangi parametrelere,
// hangi birimlerle uygulanır.
//
// Filtrelenen parametreler (2D ve 3D mod ortak kullanır):
//   konum  : göz merkezlerinin orta noktası (x, y, z piksel)
//            Hız, gözler arası mesafeye bölünerek normalize edilir → "saniyede kaç
//            göz mesafesi". Böylece beta, yüzün kameraya uzaklığından bağımsızdır.
//   ölçek  : gözler arası 2D ve 3D mesafe, logaritması filtrelenir → oransal değişim.
//            (%10 büyüme yakında da uzakta da aynı hızda sayılır.)
//   açı 2D : göz çizgisinin eğimi θ (radyan, ±π sürekliliği korunur)
//   dönme  : 3D kafa pozu kuaterniyonu (slerp ile; Euler sıçraması yok)
// Birimler bu şekilde normalize edildiği için dört kanalın hızları benzer
// büyüklüktedir ve tek bir {minCutoff, beta, dCutoff} seti hepsine uygundur.
//
// Sıfırlama: Yüz kaybolunca (reset) ya da kareler arasında `maxGapSec`'ten uzun boşluk
// olunca filtre durumu silinir; yüz yeniden görününce ilk kare ham değerle başlar,
// eski konumdan yeni konuma kayma olmaz.

import { AngleOneEuroFilter, DEFAULT_PARAMS, OneEuroFilter, QuaternionOneEuroFilter } from './oneEuroFilter.js';

export class PlacementStabilizer {
  constructor({ params = DEFAULT_PARAMS, enabled = true, maxGapSec = 0.5 } = {}) {
    this.params = { ...params };
    this.enabled = enabled;
    this.maxGapSec = maxGapSec;
    this.position = [0, 1, 2].map(() => new OneEuroFilter(this.params));
    this.logDistance2D = new OneEuroFilter(this.params);
    this.logDistance3D = new OneEuroFilter(this.params);
    this.angle = new AngleOneEuroFilter(this.params);
    this.rotation = new QuaternionOneEuroFilter(this.params);
    this.lastTime = null;
  }

  get filters() {
    return [...this.position, this.logDistance2D, this.logDistance3D, this.angle, this.rotation];
  }

  setParams(params) {
    this.params = { ...this.params, ...params };
    this.filters.forEach((f) => f.setParams(this.params));
  }

  setEnabled(enabled) {
    if (enabled !== this.enabled) this.reset();
    this.enabled = enabled;
  }

  reset() {
    this.filters.forEach((f) => f.reset());
    this.lastTime = null;
  }

  /**
   * @param metrics     ham eyeMetrics() çıktısı
   * @param quaternion  ham dönme [x, y, z, w] ya da null (matris yoksa)
   * @param t           kare zamanı (saniye)
   * @returns {{ metrics, quaternion }} filtrelenmiş (devre dışıysa ham) değerler
   */
  update(metrics, quaternion, t) {
    if (!this.enabled) return { metrics, quaternion };
    if (this.lastTime !== null && t - this.lastTime > this.maxGapSec) this.reset();
    this.lastTime = t;

    const unit = metrics.distance3D || 1; // konum hızı: saniyede kaç göz mesafesi
    const c = metrics.center;
    const center = {
      x: this.position[0].filter(c.x, t, unit),
      y: this.position[1].filter(c.y, t, unit),
      z: this.position[2].filter(c.z, t, unit),
    };
    const distance2D = Math.exp(this.logDistance2D.filter(Math.log(metrics.distance2D), t));
    const distance3D = Math.max(distance2D, Math.exp(this.logDistance3D.filter(Math.log(metrics.distance3D), t)));
    const angle = this.angle.filter(metrics.angle, t);

    return {
      metrics: rebuildMetrics(center, distance2D, distance3D, angle, metrics),
      quaternion: quaternion ? this.rotation.filter(quaternion, t) : null,
    };
  }
}

/**
 * Filtrelenmiş orta nokta, mesafe ve açıdan iki göz merkezini yeniden kurar
 * (geometri çizimi ve eyeMetrics ile aynı biçim için). Derinlik farkının işareti
 * ham ölçümden alınır.
 */
export function rebuildMetrics(center, distance2D, distance3D, angle, raw) {
  const hx = (Math.cos(angle) * distance2D) / 2;
  const hy = (Math.sin(angle) * distance2D) / 2;
  const dz = Math.sqrt(Math.max(0, distance3D ** 2 - distance2D ** 2)) * Math.sign(raw.left.z - raw.right.z || 1);
  return {
    right: { x: center.x - hx, y: center.y - hy, z: center.z - dz / 2 },
    left: { x: center.x + hx, y: center.y + hy, z: center.z + dz / 2 },
    center,
    distance2D,
    distance3D,
    angle,
  };
}
