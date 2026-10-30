// Canlı titreme ölçümü: ham ve filtrelenmiş değerlerin kareden kareye
// değişiminin karekök ortalaması (RMS). Baş hareketsizken bu değer doğrudan
// titremeyi ölçer; "azalma %" filtrenin titremeyi ne kadar bastırdığını gösterir.
// Ayrıca grafik için son N karenin ham/filtrelenmiş geçmişini tutar.

const toDeg = (r) => (r * 180) / Math.PI;

export class StabilityMonitor {
  constructor({ windowSize = 90, historySize = 150 } = {}) {
    this.windowSize = windowSize;
    this.historySize = historySize;
    this.reset();
  }

  reset() {
    this.prev = null;
    this.deltas = { rawPos: [], filtPos: [], rawRoll: [], filtRoll: [] };
    this.history = [];
  }

  /** @param placement computePlacement() çıktısı (null ise geçmiş kesilir) */
  update(placement) {
    if (!placement) {
      this.prev = null;
      return;
    }
    const cur = {
      raw: placement.raw.metrics.center,
      filt: placement.metrics.center,
      rawRoll: toDeg(placement.raw.metrics.angle),
      filtRoll: toDeg(placement.metrics.angle),
    };
    if (this.prev) {
      this.push('rawPos', Math.hypot(cur.raw.x - this.prev.raw.x, cur.raw.y - this.prev.raw.y));
      this.push('filtPos', Math.hypot(cur.filt.x - this.prev.filt.x, cur.filt.y - this.prev.filt.y));
      this.push('rawRoll', cur.rawRoll - this.prev.rawRoll);
      this.push('filtRoll', cur.filtRoll - this.prev.filtRoll);
    }
    this.prev = cur;
    this.history.push({ rawX: cur.raw.x, filtX: cur.filt.x, rawRoll: cur.rawRoll, filtRoll: cur.filtRoll });
    if (this.history.length > this.historySize) this.history.shift();
  }

  push(key, value) {
    const arr = this.deltas[key];
    arr.push(value);
    if (arr.length > this.windowSize) arr.shift();
  }

  /** RMS kareden kareye değişim ve azalma oranı. */
  snapshot() {
    const rms = (a) => (a.length ? Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length) : 0);
    const reduction = (raw, filt) => (raw > 0 ? 1 - filt / raw : 0);
    const rawPos = rms(this.deltas.rawPos);
    const filtPos = rms(this.deltas.filtPos);
    const rawRoll = rms(this.deltas.rawRoll);
    const filtRoll = rms(this.deltas.filtRoll);
    return {
      samples: this.deltas.rawPos.length,
      position: { raw: rawPos, filtered: filtPos, reduction: reduction(rawPos, filtPos) },
      roll: { raw: rawRoll, filtered: filtRoll, reduction: reduction(rawRoll, filtRoll) },
      history: this.history,
    };
  }
}
