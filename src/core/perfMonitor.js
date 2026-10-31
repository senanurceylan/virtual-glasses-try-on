// Performans ölçümü: FPS ve her işlem aşamasının süresi (ms).
//
// Kullanım (her karede):
//   perf.frameStart();
//   perf.measure('algılama', () => landmarker.detect(...));
//   perf.measure('çizim', () => renderer.render(...));
//   perf.frameEnd();
//   perf.snapshot() → { fps, frameMs, stages: { algılama: {avg,min,max,last}, ... } }
//
// Değerler son `windowSize` kare üzerinden kayan pencere ile hesaplanır.
// `now` dışarıdan verilebildiği için zaman sahte saatle test edilebilir.

class RingBuffer {
  constructor(size) {
    this.size = size;
    this.values = [];
    this.index = 0;
  }

  push(value) {
    if (this.values.length < this.size) this.values.push(value);
    else this.values[this.index] = value;
    this.index = (this.index + 1) % this.size;
  }

  stats() {
    const n = this.values.length;
    if (n === 0) return { avg: 0, min: 0, max: 0, last: 0, count: 0 };
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    for (const v of this.values) {
      sum += v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const last = this.values[(this.index - 1 + this.size) % this.size];
    return { avg: sum / n, min, max, last, count: n };
  }

  clear() {
    this.values = [];
    this.index = 0;
  }
}

export class PerfMonitor {
  constructor({ windowSize = 60, now = () => performance.now() } = {}) {
    this.windowSize = windowSize;
    this.now = now;
    this.reset();
  }

  reset() {
    this.frameIntervals = new RingBuffer(this.windowSize); // kareler arası süre → FPS
    this.frameDurations = new RingBuffer(this.windowSize); // tek karenin toplam işlem süresi
    this.stages = new Map();
    this.lastFrameStart = null;
    this.currentFrameStart = null;
  }

  frameStart() {
    const t = this.now();
    if (this.lastFrameStart !== null) this.frameIntervals.push(t - this.lastFrameStart);
    this.lastFrameStart = t;
    this.currentFrameStart = t;
  }

  frameEnd() {
    if (this.currentFrameStart === null) return;
    this.frameDurations.push(this.now() - this.currentFrameStart);
    this.currentFrameStart = null;
  }

  /** Bir aşamanın süresini doğrudan kaydeder (ms). */
  record(name, ms) {
    if (!this.stages.has(name)) this.stages.set(name, new RingBuffer(this.windowSize));
    this.stages.get(name).push(ms);
  }

  /** Artık çalışmayan bir aşamanın kayıtlarını siler (ör. Algoritma Modu kapanınca). */
  drop(name) {
    this.stages.delete(name);
  }

  /** Senkron bir fonksiyonu çalıştırıp süresini kaydeder, sonucunu döndürür. */
  measure(name, fn) {
    const t0 = this.now();
    try {
      return fn();
    } finally {
      this.record(name, this.now() - t0);
    }
  }

  snapshot() {
    const interval = this.frameIntervals.stats();
    const stages = {};
    for (const [name, buf] of this.stages) stages[name] = buf.stats();
    return {
      fps: interval.avg > 0 ? 1000 / interval.avg : 0,
      frameMs: this.frameDurations.stats(),
      stages,
    };
  }
}
