// One Euro Filter (Casiez, Roussel, Vogel — CHI 2012).
//
// Gürültülü bir sinyali (landmark konumu, açı) gerçek zamanlı yumuşatan,
// hıza göre uyarlanan bir alçak geçiren filtre:
//
//   α(fc, Δt) = r / (r + 1),   r = 2π · fc · Δt        (birinci derece alçak geçiren)
//   ẋ         = (x − x̂ₖ₋₁) / Δt                        (ham hız)
//   ẋ̂         = ẋ̂ₖ₋₁ + α(dCutoff, Δt) · (ẋ − ẋ̂ₖ₋₁)     (yumuşatılmış hız)
//   fc        = minCutoff + beta · |ẋ̂|                 (hıza göre kesim frekansı)
//   x̂         = x̂ₖ₋₁ + α(fc, Δt) · (x − x̂ₖ₋₁)          (filtrelenmiş değer)
//
// Yavaşken fc ≈ minCutoff → güçlü yumuşatma (titreme azalır).
// Hızlıyken fc büyür → filtre neredeyse ham değeri izler (gecikme azalır).
//
// Δt gerçek kare zamanlarından hesaplanır; böylece 15, 30 ya da 60 FPS'te
// filtre saniye cinsinden aynı davranır.
//
// Parametreler:
//   minCutoff (Hz) : küçüldükçe durağan titreme daha çok bastırılır, gecikme artar
//   beta           : büyüdükçe hızlı harekette gecikme azalır (titreme biraz artar)
//   dCutoff (Hz)   : hız tahmininin yumuşatılması (genelde 1 Hz)

export const DEFAULT_PARAMS = Object.freeze({ minCutoff: 1.0, beta: 2.0, dCutoff: 1.0 });

/** α = r / (r + 1), r = 2π·fc·Δt. Δt büyüdükçe α büyür → FPS'ten bağımsız davranış. */
export function smoothingFactor(cutoffHz, dt) {
  const r = 2 * Math.PI * cutoffHz * dt;
  return r / (r + 1);
}

/** Tek boyutlu One Euro filtresi. */
export class OneEuroFilter {
  constructor(params = {}) {
    this.params = { ...DEFAULT_PARAMS, ...params };
    this.reset();
  }

  setParams(params) {
    this.params = { ...this.params, ...params };
  }

  reset() {
    this.x = null; // son filtrelenmiş değer
    this.dx = 0; // yumuşatılmış hız
    this.t = null; // son zaman (s)
    this.cutoff = this.params.minCutoff;
  }

  /**
   * @param value      ham değer
   * @param t          zaman (saniye, artan)
   * @param speedUnit  hızı normalize etmek için birim (ör. piksel konumu için gözler arası
   *                   mesafe). beta bu sayede kafanın kameraya uzaklığından bağımsız olur.
   */
  filter(value, t, speedUnit = 1) {
    if (this.x === null) {
      this.x = value;
      this.t = t;
      return value;
    }
    const dt = t - this.t;
    if (!(dt > 0)) return this.x; // aynı ya da geri giden zaman: güncelleme yok

    const { minCutoff, beta, dCutoff } = this.params;
    const rawDx = (value - this.x) / dt;
    this.dx += smoothingFactor(dCutoff, dt) * (rawDx - this.dx);
    this.cutoff = minCutoff + (beta * Math.abs(this.dx)) / speedUnit;
    this.x += smoothingFactor(this.cutoff, dt) * (value - this.x);
    this.t = t;
    return this.x;
  }
}

/** Açı filtresi (radyan). ±π sınırında 2π'lik sıçramayı önlemek için açıyı önceki değere göre açar. */
export class AngleOneEuroFilter extends OneEuroFilter {
  filter(angle, t) {
    if (this.x === null) return super.filter(angle, t);
    const unwrapped = this.x + wrapToPi(angle - this.x);
    return super.filter(unwrapped, t);
  }
}

export function wrapToPi(a) {
  return a - 2 * Math.PI * Math.round(a / (2 * Math.PI));
}

/**
 * Kuaterniyon filtresi ([x, y, z, w]). Euler açılarını ayrı ayrı filtrelemek
 * gimbal kilidi ve ±180° sıçramalarına açıktır; bunun yerine dönme bütün
 * olarak filtrelenir:
 *   - hız = iki dönme arasındaki açı / Δt   (rad/s)
 *   - α hızdan One Euro kuralıyla hesaplanır
 *   - yeni dönme = slerp(önceki, ham, α)    (küresel doğrusal ara değerleme)
 * q ve −q aynı dönmeyi temsil eder; nokta çarpım negatifse ham kuaterniyon
 * ters çevrilir (yarım küre sürekliliği), böylece ani 360° dönüş oluşmaz.
 */
export class QuaternionOneEuroFilter {
  constructor(params = {}) {
    this.params = { ...DEFAULT_PARAMS, ...params };
    this.reset();
  }

  setParams(params) {
    this.params = { ...this.params, ...params };
  }

  reset() {
    this.q = null;
    this.speed = 0;
    this.t = null;
    this.cutoff = this.params.minCutoff;
  }

  filter(raw, t) {
    let q = normalize(raw);
    if (this.q === null) {
      this.q = q;
      this.t = t;
      return [...q];
    }
    const dt = t - this.t;
    if (!(dt > 0)) return [...this.q];

    if (dot(this.q, q) < 0) q = q.map((v) => -v);
    const angle = 2 * Math.acos(Math.min(1, Math.abs(dot(this.q, q))));

    const { minCutoff, beta, dCutoff } = this.params;
    this.speed += smoothingFactor(dCutoff, dt) * (angle / dt - this.speed);
    this.cutoff = minCutoff + beta * Math.abs(this.speed);
    this.q = slerp(this.q, q, smoothingFactor(this.cutoff, dt));
    this.t = t;
    return [...this.q];
  }
}

export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];

export function normalize(q) {
  const n = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}

/** Küresel doğrusal ara değerleme; a ve b aynı yarım kürede varsayılır. */
export function slerp(a, b, s) {
  const cos = Math.min(1, dot(a, b));
  if (cos > 0.9995) return normalize(a.map((v, i) => v + s * (b[i] - v))); // çok yakın: doğrusal
  const theta = Math.acos(cos);
  const sin = Math.sin(theta);
  const wa = Math.sin((1 - s) * theta) / sin;
  const wb = Math.sin(s * theta) / sin;
  return a.map((v, i) => wa * v + wb * b[i]);
}
