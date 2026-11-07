// Gerçek kamera performans ve stabilizasyon ölçümü (Aşama 8).
//
// BenchmarkRecorder bir senaryoyu iki evrede ölçer:
//   ısınma  (warmupMs)  : ayarlar oturur, filtre ve JIT ısınır; kareler KAYDEDİLMEZ
//   kayıt   (durationMs): her kare ham olarak saklanır
// Kare başına saklananlar: kare aralığı, işlem süresi, aşama süreleri (PerfMonitor
// dinleyicisinden) ve ham/filtreli göz orta noktası (computePlacement çıktısından).
// Özetler (ortalama, p95, titreme, gecikme) yalnızca kayıt evresindeki karelerden hesaplanır.
//
// Tanımlar:
//   FPS              = 1000 / ortalama kare aralığı (ms)
//   kare süresi      = bir karenin işlenme süresi (tespit + yerleştirme + çizim + …)
//   p95              = sıralı örneklerde %95 konumundaki değer (doğrusal ara değer)
//   titreme (jitter) = ardışık karelerde göz orta noktası yer değiştirmesinin RMS'i (px);
//                      ayrıca göz arası mesafeye (IPD, 3D px) oranla (%) verilir
//   azalma           = 1 − titreme_filtreli / titreme_ham
//   gecikme          = filtreli dizinin ham diziye en iyi oturduğu gecikme (kare → ms);
//                      yalnızca baş belirgin hareket ediyorsa anlamlıdır (reliable)

export const ALL_LAYERS_ON = {
  points: true,
  depth: true,
  mesh: true,
  critical: true,
  geometry: true,
  filter: true,
  gizmo: true,
  shape: true,
  labels: true,
};

const STILL = 'Başınızı sabit tutun, doğrudan kameraya bakın.';
const MOVING = 'Başınızı yavaşça sağa ve sola çevirin (yaklaşık saniyede bir gidiş-dönüş).';

/**
 * Ölçüm protokolü. settings: { mode, stabilize, algo: false | 'default' | 'all' }.
 * Karşılaştırmalar COMPARISONS'ta tanımlıdır.
 */
export const SCENARIOS = [
  { id: 'S1', name: 'Referans: 2D, Algoritma kapalı, filtre açık', motion: 'still', instruction: STILL, settings: { mode: '2d', stabilize: true, algo: false } },
  { id: 'S2', name: '2D, Algoritma açık (varsayılan katmanlar)', motion: 'still', instruction: STILL, settings: { mode: '2d', stabilize: true, algo: 'default' } },
  { id: 'S3', name: '2D, Algoritma açık (tüm katmanlar)', motion: 'still', instruction: STILL, settings: { mode: '2d', stabilize: true, algo: 'all' } },
  { id: 'S4', name: '3D, Algoritma kapalı, filtre açık', motion: 'still', instruction: STILL, settings: { mode: '3d', stabilize: true, algo: false } },
  { id: 'S5', name: '2D, filtre kapalı, sabit baş', motion: 'still', instruction: STILL, settings: { mode: '2d', stabilize: false, algo: false } },
  { id: 'S6', name: '2D, filtre açık, hareketli baş', motion: 'moving', instruction: MOVING, settings: { mode: '2d', stabilize: true, algo: false } },
  { id: 'S7', name: '2D, filtre kapalı, hareketli baş', motion: 'moving', instruction: MOVING, settings: { mode: '2d', stabilize: false, algo: false } },
];

/** İstenen dört karşılaştırma (+ hareketli baş). a = temel, b = karşılaştırılan. */
export const COMPARISONS = [
  { id: 'algo', label: 'Algoritma Modu kapalı → açık', a: 'S1', b: 'S2' },
  { id: 'layers', label: 'Algoritma varsayılan → tüm katmanlar', a: 'S2', b: 'S3' },
  { id: 'mode', label: '2D → 3D', a: 'S1', b: 'S4' },
  { id: 'filter-still', label: 'Filtre kapalı → açık (sabit baş)', a: 'S5', b: 'S1' },
  { id: 'filter-moving', label: 'Filtre kapalı → açık (hareketli baş)', a: 'S7', b: 'S6' },
];

export const DEFAULT_TIMING = { warmupMs: 3000, durationMs: 10000 };

export class BenchmarkRecorder {
  constructor({ warmupMs = DEFAULT_TIMING.warmupMs, durationMs = DEFAULT_TIMING.durationMs } = {}) {
    this.warmupMs = warmupMs;
    this.durationMs = durationMs;
    this.phase = 'idle';
    this.frames = [];
    this.pending = null;
  }

  start(now) {
    this.phase = 'warmup';
    this.t0 = now;
    this.recordStart = null;
    this.frames = [];
    this.pending = null;
  }

  /** Karenin yerleştirme sonucu (frameEnd'den önce, aynı karede çağrılır). */
  observePlacement(placement) {
    if (this.phase !== 'warmup' && this.phase !== 'recording') return;
    this.pending = placement
      ? {
          raw: { x: placement.raw.metrics.center.x, y: placement.raw.metrics.center.y },
          filt: { x: placement.metrics.center.x, y: placement.metrics.center.y },
          ipd: placement.raw.metrics.distance3D,
        }
      : null;
  }

  /** PerfMonitor dinleyicisi: { interval, duration, stages }. */
  observeFrame(timing, now) {
    const p = this.pending;
    this.pending = null;
    if (this.phase === 'warmup') {
      if (now - this.t0 >= this.warmupMs) {
        this.phase = 'recording';
        this.recordStart = now;
      }
      return;
    }
    if (this.phase !== 'recording') return;
    this.frames.push({
      interval: timing.interval,
      duration: timing.duration,
      stages: { ...timing.stages },
      face: p !== null,
      raw: p?.raw ?? null,
      filt: p?.filt ?? null,
      ipd: p?.ipd ?? null,
    });
    if (now - this.recordStart >= this.durationMs) this.phase = 'done';
  }

  /** 0–1 ilerleme ve kalan süre (ms) — o anki evre içinde. */
  progress(now) {
    if (this.phase === 'warmup') {
      const t = now - this.t0;
      return { phase: 'warmup', fraction: Math.min(1, t / this.warmupMs), remainingMs: Math.max(0, this.warmupMs - t) };
    }
    if (this.phase === 'recording') {
      const t = now - this.recordStart;
      return { phase: 'recording', fraction: Math.min(1, t / this.durationMs), remainingMs: Math.max(0, this.durationMs - t) };
    }
    return { phase: this.phase, fraction: this.phase === 'done' ? 1 : 0, remainingMs: 0 };
  }
}

// ─── İstatistik ──────────────────────────────────────────────────────────

const finite = (a) => a.filter((v) => Number.isFinite(v));
export const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);

/** p ∈ [0, 1]; sıralı dizide doğrusal ara değerli yüzdelik. */
export function percentile(values, p) {
  const s = finite(values).sort((x, y) => x - y);
  if (!s.length) return NaN;
  const pos = (s.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

const stat = (values) => {
  const v = finite(values);
  return { mean: mean(v), p95: percentile(v, 0.95), n: v.length };
};

/** Ardışık yüzlü kare grupları (yüz kaybolunca dizi kesilir; filtre de sıfırlanır). */
function segments(frames) {
  const out = [];
  let cur = [];
  for (const f of frames) {
    if (f.face) cur.push(f);
    else if (cur.length) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  return out;
}

/** Titreme: ardışık karelerde göz orta noktası yer değiştirmesinin RMS'i. */
export function jitterStats(frames) {
  const dRaw = [];
  const dFilt = [];
  const dev = [];
  const ipd = [];
  for (const seg of segments(frames)) {
    seg.forEach((f, i) => {
      ipd.push(f.ipd);
      dev.push(Math.hypot(f.filt.x - f.raw.x, f.filt.y - f.raw.y));
      if (i === 0) return;
      const prev = seg[i - 1];
      dRaw.push(Math.hypot(f.raw.x - prev.raw.x, f.raw.y - prev.raw.y));
      dFilt.push(Math.hypot(f.filt.x - prev.filt.x, f.filt.y - prev.filt.y));
    });
  }
  if (!dRaw.length) return null;
  const rms = (a) => Math.sqrt(mean(a.map((v) => v * v)));
  const raw = rms(dRaw);
  const filtered = rms(dFilt);
  const ipdMean = mean(ipd);
  return {
    rawPx: raw,
    filteredPx: filtered,
    rawPctIpd: (raw / ipdMean) * 100,
    filteredPctIpd: (filtered / ipdMean) * 100,
    reduction: raw > 0 ? 1 - filtered / raw : 0,
    meanDeviationPx: mean(dev), // filtreli ile ham arasındaki ortalama uzaklık
    ipdPx: ipdMean,
    samples: dRaw.length,
  };
}

/**
 * Filtre gecikmesi: filtreli[t] ile ham[t − k] arasındaki ortalama kare hata en küçük
 * olan k (kare), parabolik ara değerle kesirli. ms = k · ortalama kare aralığı.
 * Baş hareket etmiyorsa (ham hareket genliği < 0,3·IPD) sonuç güvenilmez işaretlenir.
 */
export function estimateLag(frames, maxLag = 15) {
  const segs = segments(frames).filter((s) => s.length > maxLag * 2);
  if (!segs.length) return null;
  const err = [];
  for (let k = 0; k <= maxLag; k++) {
    let sum = 0;
    let n = 0;
    for (const s of segs) {
      for (let t = k; t < s.length; t++) {
        sum += (s[t].filt.x - s[t - k].raw.x) ** 2 + (s[t].filt.y - s[t - k].raw.y) ** 2;
        n++;
      }
    }
    err.push(sum / n);
  }
  let k = err.indexOf(Math.min(...err));
  if (k > 0 && k < maxLag) {
    const [a, b, c] = [err[k - 1], err[k], err[k + 1]];
    const denom = a - 2 * b + c;
    if (denom > 0) k += (0.5 * (a - c)) / denom;
  }
  const xs = segs.flat().map((f) => f.raw.x);
  const amplitude = Math.max(...xs) - Math.min(...xs);
  const ipd = mean(segs.flat().map((f) => f.ipd));
  const interval = mean(finite(frames.map((f) => f.interval)));
  return { frames: k, ms: k * interval, amplitudePx: amplitude, reliable: amplitude >= 0.3 * ipd };
}

/** Bir senaryonun özet istatistikleri. */
export function summarize(frames) {
  const intervals = finite(frames.map((f) => f.interval));
  const names = [...new Set(frames.flatMap((f) => Object.keys(f.stages)))];
  const stages = Object.fromEntries(names.map((n) => [n, stat(frames.map((f) => f.stages[n]))]));
  return {
    frames: frames.length,
    faceRate: frames.length ? frames.filter((f) => f.face).length / frames.length : 0,
    fps: intervals.length ? 1000 / mean(intervals) : NaN,
    interval: stat(intervals),
    frameMs: stat(frames.map((f) => f.duration)),
    stages,
    jitter: jitterStats(frames),
    lag: estimateLag(frames),
  };
}

/** Senaryo çiftleri arasındaki farklar (b − a). Eksik senaryo varsa null. */
export function compareResults(results) {
  const byId = Object.fromEntries(results.map((r) => [r.scenario.id, r.summary]));
  return COMPARISONS.map((c) => {
    const a = byId[c.a];
    const b = byId[c.b];
    if (!a || !b) return { ...c, available: false };
    return {
      ...c,
      available: true,
      fps: { a: a.fps, b: b.fps, delta: b.fps - a.fps },
      frameMs: { a: a.frameMs.mean, b: b.frameMs.mean, delta: b.frameMs.mean - a.frameMs.mean },
      frameP95: { a: a.frameMs.p95, b: b.frameMs.p95, delta: b.frameMs.p95 - a.frameMs.p95 },
      jitter: a.jitter && b.jitter ? { a: a.jitter.filteredPx, b: b.jitter.filteredPx, delta: b.jitter.filteredPx - a.jitter.filteredPx } : null,
    };
  });
}

// ─── Dışa aktarma ────────────────────────────────────────────────────────

export const STAGE_ORDER = ['Tespit', 'Yerleştirme', 'Çizim', '3D çizim', 'Algoritma', 'Yüz şekli'];

const f = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '');

/** Satır başına bir senaryo; sayılar nokta ondalıklı (tablolama programları için). */
export function toCSV(results) {
  const head = [
    'id', 'senaryo', 'mod', 'filtre', 'algoritma', 'kare', 'yuz_orani', 'fps', 'kare_ms_ort', 'kare_ms_p95', 'aralik_ms_p95',
    ...STAGE_ORDER.flatMap((s) => [`${s}_ort`, `${s}_p95`]),
    'titreme_ham_px', 'titreme_filtreli_px', 'titreme_ham_yuzde_ipd', 'titreme_filtreli_yuzde_ipd', 'titreme_azalma_yuzde', 'ort_sapma_px', 'gecikme_ms', 'gecikme_guvenilir',
  ];
  const rows = results.map(({ scenario, summary: s, effectiveMode }) => {
    const j = s.jitter;
    return [
      scenario.id, `"${scenario.name}"`, effectiveMode, scenario.settings.stabilize ? 'acik' : 'kapali', scenario.settings.algo || 'kapali',
      s.frames, f(s.faceRate, 3), f(s.fps), f(s.frameMs.mean), f(s.frameMs.p95), f(s.interval.p95),
      ...STAGE_ORDER.flatMap((n) => [f(s.stages[n]?.mean, 3), f(s.stages[n]?.p95, 3)]),
      f(j?.rawPx, 3), f(j?.filteredPx, 3), f(j?.rawPctIpd, 3), f(j?.filteredPctIpd, 3), f(j ? j.reduction * 100 : NaN, 1), f(j?.meanDeviationPx),
      f(s.lag?.ms, 1), s.lag ? (s.lag.reliable ? 'evet' : 'hayir') : '',
    ].join(',');
  });
  return [head.join(','), ...rows].join('\n');
}

/** Rapora yapıştırılabilir Markdown tabloları. */
export function toMarkdown(results, env = {}) {
  const lines = [];
  if (env.resolution) lines.push(`Kamera: ${env.resolution} · Hızlandırıcı: ${env.delegate ?? '–'} · Tarih: ${env.date ?? '–'}`, '');
  lines.push('| Senaryo | Mod | Yüz % | FPS | Kare ort / p95 (ms) | Tespit ort / p95 | Yerleştirme | Çizim | 3D çizim | Algoritma |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const { scenario, summary: s, effectiveMode } of results) {
    const st = (n) => (s.stages[n] ? `${f(s.stages[n].mean)} / ${f(s.stages[n].p95)}` : '–');
    lines.push(
      `| ${scenario.id} ${scenario.name} | ${effectiveMode.toUpperCase()} | ${f(s.faceRate * 100, 0)} | ${f(s.fps, 1)} | ${f(s.frameMs.mean)} / ${f(s.frameMs.p95)} | ${st('Tespit')} | ${st('Yerleştirme')} | ${st('Çizim')} | ${st('3D çizim')} | ${st('Algoritma')} |`,
    );
  }
  lines.push('', '| Senaryo | Titreme ham (px) | Titreme filtreli (px) | Filtreli / IPD | Azalma | Ort. sapma (px) | Gecikme (ms) |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const { scenario, summary: s } of results) {
    const j = s.jitter;
    const lag = s.lag ? `${f(s.lag.ms, 0)}${s.lag.reliable ? '' : ' (güvenilmez: hareket az)'}` : '–';
    lines.push(
      `| ${scenario.id} | ${f(j?.rawPx)} | ${f(j?.filteredPx)} | %${f(j?.filteredPctIpd)} | %${f(j ? j.reduction * 100 : NaN, 0)} | ${f(j?.meanDeviationPx)} | ${lag} |`,
    );
  }
  const cmp = compareResults(results).filter((c) => c.available);
  if (cmp.length) {
    lines.push('', '| Karşılaştırma | FPS (a → b) | Kare ort. ms (a → b, Δ) | Kare p95 ms (a → b) | Filtreli titreme px (a → b) |');
    lines.push('|---|---|---|---|---|');
    for (const c of cmp) {
      lines.push(
        `| ${c.label} (${c.a} → ${c.b}) | ${f(c.fps.a, 1)} → ${f(c.fps.b, 1)} | ${f(c.frameMs.a)} → ${f(c.frameMs.b)} (${c.frameMs.delta >= 0 ? '+' : ''}${f(c.frameMs.delta)}) | ${f(c.frameP95.a)} → ${f(c.frameP95.b)} | ${c.jitter ? `${f(c.jitter.a)} → ${f(c.jitter.b)}` : '–'} |`,
      );
    }
  }
  return lines.join('\n');
}
