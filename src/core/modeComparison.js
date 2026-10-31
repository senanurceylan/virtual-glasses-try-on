// Algoritma Modu açık ↔ kapalı performans karşılaştırması.
//
// Periyodik olarak PerfMonitor.snapshot() örnekleri alınır ve o anki moda göre
// ayrı ayrı biriktirilir. Mod değiştikten hemen sonraki örnekler (kayan pencerede
// hâlâ eski modun kareleri vardır) `warmupMs` boyunca atılır.
//
// Not: FPS kameranın kare hızıyla sınırlıdır (çoğunlukla 30). Algoritma katmanlarının
// asıl maliyeti kare işlem süresinde (frameMs) görülür.

export class ModeComparison {
  constructor({ warmupMs = 1500 } = {}) {
    this.warmupMs = warmupMs;
    this.reset();
  }

  reset() {
    this.acc = { off: empty(), on: empty() };
    this.mode = null;
    this.since = 0;
  }

  /** Örneklemeyi duraklatır; sonraki ilk örnek ısınma başlangıcı sayılır. */
  pause() {
    this.mode = null;
  }

  /**
   * @param on    Algoritma Modu açık mı
   * @param snap  perf.snapshot()
   * @param now   ms
   */
  sample(on, snap, now) {
    const mode = on ? 'on' : 'off';
    if (mode !== this.mode) {
      this.mode = mode;
      this.since = now;
      return;
    }
    if (now - this.since < this.warmupMs || !(snap.fps > 0)) return;
    const a = this.acc[mode];
    a.fps += snap.fps;
    a.frameMs += snap.frameMs.avg;
    a.algoMs += snap.stages?.Algoritma?.avg ?? 0;
    a.samples++;
  }

  summary() {
    const avg = (a) =>
      a.samples ? { fps: a.fps / a.samples, frameMs: a.frameMs / a.samples, algoMs: a.algoMs / a.samples, samples: a.samples } : null;
    const off = avg(this.acc.off);
    const on = avg(this.acc.on);
    return { off, on, deltaMs: off && on ? on.frameMs - off.frameMs : null };
  }
}

function empty() {
  return { fps: 0, frameMs: 0, algoMs: 0, samples: 0 };
}
