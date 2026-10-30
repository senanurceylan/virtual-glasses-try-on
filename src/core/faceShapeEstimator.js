// Çok kareli, güvenilirlik kontrollü yüz şekli tahmini.
//
// Her karede ölçüm alınır ama yalnızca şu koşullar sağlanırsa örneğe eklenir
// (sağlanmayan ilk koşul kullanıcıya bildirilir):
//   1. Baş yeterince düz: |yaw| ≤ 12°, |pitch| ≤ 12°, |roll| ≤ 15°
//      (dönük yüzde bir yanak kameradan uzaklaşır, genişlikler ve açılar bozulur)
//   2. Yüz yeterince büyük: elmacık genişliği ≥ 110 px (uzakta nokta hatası oransal büyür)
//   3. Ölçülen noktalar kadraj içinde
//   4. Ağız kapalı (açık ağız çeneyi aşağı indirip yüz uzunluğunu büyütür).
//      Histerezis: açıklık > mouthEnter olunca "ağız açık" durumuna girilir, ancak
//      < mouthExit olunca çıkılır. Eşik çevresindeki konuşma/titreşimde uyarı
//      kareden kareye açılıp kapanmaz. Kapanınca analiz kendiliğinden sürer.
//   5. Oranlar makul aralıkta ve iki yandaki çene açısı tutarlı
//   6. Alın görünür (skinCheck: saç alnı kapatıyorsa alın genişliği güvenilmez)
//
// Kararlılık: son `windowSize` geçerli örneğin her oran için MEDYANI alınır (aykırı
// karelere dayanıklı). Örnekler arasındaki yayılım (MAD = medyan mutlak sapma)
// eşikten büyükse ölçüm kararsız sayılır ve tahmin verilmez.
// En az `minSamples` geçerli örnek toplanmadan tahmin verilmez.

import { classifyFaceShape, FEATURES, measureFace, SHAPE_LANDMARKS } from './faceShape.js';

export const ESTIMATOR_DEFAULTS = {
  windowSize: 60,
  minSamples: 30,
  maxYaw: 12,
  maxPitch: 12,
  maxRoll: 15,
  minCheekPx: 110,
  // Ağız açıklığı / elmacık genişliği. Ortalama yüzde (elmacık ≈ 15 cm) 0.045 ≈ 0.7 cm iç
  // dudak aralığı; bu kadar açıklık yüz uzunluğu oranını (L) yaklaşık 1σ büyütür.
  mouthEnter: 0.045,
  mouthExit: 0.03,
  maxAngleAsymmetry: 15,
  maxSpread: { L: 0.025, F: 0.02, J: 0.02, C: 0.02, A: 3 }, // MAD üst sınırı
  minForehead: 0.6, // alın piksellerinin ten oranı
  resetAfterMissing: 15, // bu kadar kare yüz yoksa örnekler silinir (başka kişi gelebilir)
};

const PLAUSIBLE = { L: [0.85, 1.6], F: [0.6, 1.05], J: [0.55, 1.0], C: [0.25, 0.65], A: [105, 165] };

export const STATUS_TEXT = {
  'no-face': 'Yüz algılanmadı.',
  pose: 'Başınızı düz tutun ve kameraya bakın.',
  'too-far': 'Kameraya biraz yaklaşın.',
  'out-of-frame': 'Yüzünüzün tamamı kadrajda olmalı.',
  mouth: 'Yüz şekli analizi için lütfen ağzınızı kapatın.',
  implausible: 'Ölçümler güvenilir değil (yüz noktaları beklenen aralıkta değil).',
  forehead: 'Alın bölgesi saçla kapalı görünüyor; alın genişliği ölçülemiyor.',
  collecting: 'Ölçüm toplanıyor…',
  unstable: 'Ölçümler kararsız; başınızı sabit tutun.',
  ready: 'Yaklaşık tahmin hazır.',
};

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Yaw/pitch/roll'a göre yönlendirme metni. */
function poseHint(angles, o) {
  if (Math.abs(angles.yaw) > o.maxYaw) return `Başınız ${angles.yaw > 0 ? 'sola' : 'sağa'} dönük (${Math.round(Math.abs(angles.yaw))}°).`;
  if (Math.abs(angles.pitch) > o.maxPitch) return `Başınız ${angles.pitch > 0 ? 'aşağı' : 'yukarı'} eğik (${Math.round(Math.abs(angles.pitch))}°).`;
  return `Başınız yana yatık (${Math.round(Math.abs(angles.roll))}°).`;
}

export class FaceShapeEstimator {
  constructor(options = {}) {
    this.o = { ...ESTIMATOR_DEFAULTS, ...options, maxSpread: { ...ESTIMATOR_DEFAULTS.maxSpread, ...options.maxSpread } };
    this.reset();
  }

  reset() {
    this.samples = [];
    this.missing = 0;
    this.forehead = null; // son alın ten oranı
    this.mouthOpen = false; // histerezisli ağız durumu
    this.mouthValue = null; // son ölçülen ağız açıklığı
    this.state = { status: 'no-face', message: STATUS_TEXT['no-face'], progress: 0, result: null, last: null, forehead: null, mouth: null };
  }

  /** skinCheck sonucu (0–1 ya da null); örnekleme seyrek yapıldığı için ayrı verilir. */
  setForeheadCoverage(value) {
    if (value === null || value === undefined) return;
    this.forehead = this.forehead === null ? value : 0.7 * this.forehead + 0.3 * value;
  }

  /**
   * @param face    478 normalize nokta ya da null
   * @param angles  {yaw, pitch, roll} derece (kafa pozu) ya da null
   */
  update(face, angles, width, height) {
    if (!face) {
      // Uzun süre yüz yoksa her şeyi sil: kameraya başka biri geçebilir.
      if (++this.missing >= this.o.resetAfterMissing) {
        this.reset();
        return this.state;
      }
      return this.setState('no-face');
    }
    this.missing = 0;

    const reason = this.rejectReason(face, angles, width, height);
    if (reason) return this.setState(reason.status, { message: reason.message });

    this.samples.push(this.measurement.ratios);
    if (this.samples.length > this.o.windowSize) this.samples.shift();
    if (this.samples.length < this.o.minSamples) return this.setState('collecting');

    const ratios = {};
    const spread = {};
    for (const k of Object.keys(FEATURES)) {
      const values = this.samples.map((s) => s[k]);
      ratios[k] = median(values);
      spread[k] = median(values.map((v) => Math.abs(v - ratios[k])));
    }
    const unstable = Object.keys(FEATURES).filter((k) => spread[k] > this.o.maxSpread[k]);
    if (unstable.length) return this.setState('unstable', { spread, unstableKeys: unstable });

    const classification = classifyFaceShape(ratios);
    return this.setState('ready', {
      result: { ratios, spread, classification, samples: this.samples.length },
    });
  }

  /** Örneği reddetme nedeni (yoksa null). Ölçüm this.measurement'a yazılır. */
  rejectReason(face, angles, width, height) {
    const o = this.o;
    const m = measureFace(face, width, height);
    this.measurement = m;
    // Ağız durumu her karede güncellenir (diğer kontroller reddetse bile), böylece histerezis kesintisiz.
    this.mouthValue = m.mouthOpen;
    this.mouthOpen = this.mouthOpen ? m.mouthOpen > o.mouthExit : m.mouthOpen > o.mouthEnter;

    if (!angles) return { status: 'pose', message: 'Kafa pozu hesaplanamadı.' };
    if (Math.abs(angles.yaw) > o.maxYaw || Math.abs(angles.pitch) > o.maxPitch || Math.abs(angles.roll) > o.maxRoll) {
      return { status: 'pose', message: `${poseHint(angles, o)} ${STATUS_TEXT.pose}` };
    }
    const used = Object.values(SHAPE_LANDMARKS).flat(2);
    if (used.some((i) => face[i].x < 0.01 || face[i].x > 0.99 || face[i].y < 0.01 || face[i].y > 0.99)) {
      return { status: 'out-of-frame' };
    }
    if (m.px.cheekbone < o.minCheekPx) return { status: 'too-far' };
    if (this.mouthOpen) return { status: 'mouth' };
    const bad = Object.entries(PLAUSIBLE).some(([k, [lo, hi]]) => m.ratios[k] < lo || m.ratios[k] > hi);
    if (bad || m.angleAsymmetry > o.maxAngleAsymmetry) return { status: 'implausible' };
    if (this.forehead !== null && this.forehead < o.minForehead) return { status: 'forehead' };
    return null;
  }

  setState(status, extra = {}) {
    const result = status === 'ready' ? extra.result : null;
    this.state = {
      status,
      message: extra.message ?? STATUS_TEXT[status],
      progress: Math.min(1, this.samples.length / this.o.minSamples),
      forehead: this.forehead,
      mouth: this.mouthValue,
      result,
      // Geçici bir sorun olduğunda son geçerli tahmin soluk gösterilebilsin
      last: result ?? extra.last ?? this.state?.result ?? this.state?.last ?? null,
      spread: extra.spread ?? null,
      unstableKeys: extra.unstableKeys ?? [],
    };
    return this.state;
  }
}
