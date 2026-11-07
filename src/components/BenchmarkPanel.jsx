import { useState } from 'react';
import { compareResults, DEFAULT_TIMING, SCENARIOS, toCSV, toMarkdown } from '../core/benchmark.js';

const f = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '–');
const signed = (v, d = 2) => (Number.isFinite(v) ? `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}` : '–');

const DURATIONS = [
  { ms: 10000, label: '10 sn' },
  { ms: 20000, label: '20 sn' },
];

/** Dosyayı yalnızca kullanıcının bilgisayarına kaydeder (Blob URL; ağ isteği yok). */
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Ekranda ölçüm sırasında gösterilecek yönerge (yoksa null). */
export function benchmarkNotice(bench, faceVisible) {
  if (bench.status !== 'running' || !bench.current) return null;
  const { scenario, index, total } = bench.current;
  const phase = bench.phase === 'warmup' ? 'Isınma' : 'Kayıt';
  return {
    tone: faceVisible ? 'info' : 'warn',
    title: `Ölçüm ${index + 1}/${total} · ${phase} · ${bench.secondsLeft} sn`,
    text: faceVisible ? `${scenario.name}. ${scenario.instruction}` : 'Yüz algılanamadı: kameraya bakın, ölçüm sürüyor.',
  };
}

/**
 * Gerçek kamera ölçüm paneli: protokolü başlatır, ilerlemeyi ve sonuçları gösterir,
 * JSON / CSV indirme ve Markdown kopyalama sunar. Sonuçlar yalnızca bu tarayıcıda tutulur.
 *
 * @param bench  useBenchmark() çıktısı
 */
export function BenchmarkPanel({ bench, running }) {
  const [durationMs, setDurationMs] = useState(DEFAULT_TIMING.durationMs);
  const [copied, setCopied] = useState(false);
  const busy = bench.status === 'running';
  const timing = { ...DEFAULT_TIMING, durationMs };
  const totalSec = Math.round((SCENARIOS.length * (timing.warmupMs + timing.durationMs)) / 1000);
  const results = [...bench.results].sort((a, b) => a.scenario.id.localeCompare(b.scenario.id));
  const stamp = (bench.env?.date ?? new Date().toISOString()).slice(0, 16).replace(/[:T]/g, '-');

  const copyMarkdown = async () => {
    const text = toMarkdown(results, bench.env ?? {});
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      download(`olcum-${stamp}.md`, text, 'text/markdown');
    }
  };

  return (
    <div className="panel-body">
      <p className="small">
        Her senaryonun ayarları otomatik uygulanır. Önce {timing.warmupMs / 1000} sn ısınma (kaydedilmez), sonra{' '}
        {durationMs / 1000} sn kayıt yapılır. Toplam {SCENARIOS.length} senaryo, yaklaşık {Math.ceil(totalSec / 60)} dk
        sürer. Yönergeler kamera üzerinde görünür. Bitince ayarlarınız geri yüklenir.
      </p>

      <ol className="scenario-list small">
        {SCENARIOS.map((s) => (
          <li key={s.id} className={bench.current?.scenario.id === s.id ? 'is-active' : ''}>
            <span className="mono">{s.id}</span> {s.name}
            <span className="muted"> · {s.motion === 'moving' ? 'hareketli baş' : 'sabit baş'}</span>
            {!busy && running && (
              <button type="button" className="link-btn" onClick={() => bench.start([s.id], timing)}>
                yalnız bunu ölç
              </button>
            )}
          </li>
        ))}
      </ol>

      <div className="bench-actions">
        <label className="small">
          Kayıt süresi{' '}
          <select value={durationMs} disabled={busy} onChange={(e) => setDurationMs(Number(e.target.value))}>
            {DURATIONS.map((d) => (
              <option key={d.ms} value={d.ms}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        {busy ? (
          <button type="button" className="btn btn--ghost btn--small" onClick={bench.cancel}>
            Ölçümü iptal et
          </button>
        ) : (
          <button type="button" className="btn btn--small" disabled={!running} onClick={() => bench.start(undefined, timing)}>
            ▶ Ölçüm protokolünü başlat
          </button>
        )}
      </div>
      {!running && !busy && <p className="muted small">Ölçüm için önce kamerayı başlatın.</p>}
      {busy && bench.current && (
        <p className="small" role="status">
          <b>
            {bench.current.index + 1}/{bench.current.total} · {bench.current.scenario.id}
          </b>{' '}
          {bench.phase === 'warmup' ? 'ısınma' : 'kayıt'} · {bench.secondsLeft} sn kaldı
        </p>
      )}
      {bench.status === 'error' && <p className="error-text">{bench.error}</p>}
      {bench.status === 'cancelled' && <p className="muted small">Ölçüm iptal edildi; tamamlanan senaryolar aşağıda.</p>}

      {results.length > 0 && (
        <>
          <h3 className="subhead">Sonuçlar {bench.env?.resolution && <span className="muted">· {bench.env.resolution}</span>}</h3>
          <div className="table-scroll">
            <table className="ratio-table bench-table">
              <thead>
                <tr>
                  <th>Senaryo</th>
                  <th>FPS</th>
                  <th>Kare ort / p95 (ms)</th>
                  <th>Tespit ort / p95</th>
                  <th>Titreme ham → filtreli (px)</th>
                  <th>Gecikme</th>
                </tr>
              </thead>
              <tbody>
                {results.map(({ scenario, summary: s, effectiveMode }) => (
                  <tr key={scenario.id} title={scenario.name}>
                    <td>
                      {scenario.id}
                      <Warnings s={s} scenario={scenario} effectiveMode={effectiveMode} />
                    </td>
                    <td>{f(s.fps)}</td>
                    <td>
                      {f(s.frameMs.mean, 2)} / {f(s.frameMs.p95, 2)}
                    </td>
                    <td>
                      {f(s.stages.Tespit?.mean, 2)} / {f(s.stages.Tespit?.p95, 2)}
                    </td>
                    <td>
                      {s.jitter ? `${f(s.jitter.rawPx, 2)} → ${f(s.jitter.filteredPx, 2)} (−${f(s.jitter.reduction * 100, 0)}%)` : '–'}
                    </td>
                    <td>{s.lag?.reliable ? `${f(s.lag.ms, 0)} ms` : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="subhead">Karşılaştırmalar</h3>
          <ul className="compare-list small">
            {compareResults(results).map((c) => (
              <li key={c.id}>
                <b>{c.label}</b> ({c.a} → {c.b}):{' '}
                {c.available ? (
                  <>
                    FPS {f(c.fps.a)} → {f(c.fps.b)}, kare süresi {signed(c.frameMs.delta)} ms (p95 {f(c.frameP95.a, 2)} →{' '}
                    {f(c.frameP95.b, 2)})
                    {c.jitter && `, filtreli titreme ${f(c.jitter.a, 2)} → ${f(c.jitter.b, 2)} px`}
                  </>
                ) : (
                  <span className="muted">ölçülmedi</span>
                )}
              </li>
            ))}
          </ul>

          <div className="bench-actions">
            <button type="button" className="btn btn--ghost btn--small" onClick={copyMarkdown}>
              {copied ? 'Kopyalandı ✓' : 'Markdown tabloyu kopyala'}
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => download(`olcum-${stamp}.csv`, toCSV(results), 'text/csv')}
            >
              CSV indir
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => download(`olcum-${stamp}.json`, JSON.stringify({ env: bench.env, results }, null, 2), 'application/json')}
            >
              JSON indir
            </button>
            {!busy && (
              <button type="button" className="btn btn--ghost btn--small" onClick={bench.clear}>
                Sonuçları temizle
              </button>
            )}
          </div>
          <p className="muted small">
            Gecikme yalnızca hareketli baş senaryolarında ve baş yeterince hareket ettiyse gösterilir. Sonuçlar bu tarayıcıda
            saklanır; hiçbir yere gönderilmez.
          </p>
        </>
      )}
    </div>
  );
}

function Warnings({ s, scenario, effectiveMode }) {
  const notes = [];
  if (s.faceRate < 0.9) notes.push(`yüz %${Math.round(s.faceRate * 100)}`);
  if (effectiveMode !== scenario.settings.mode) notes.push('3D açılamadı');
  if (scenario.motion === 'moving' && s.lag && !s.lag.reliable) notes.push('hareket az');
  return notes.length ? <span className="bench-warn"> ⚠ {notes.join(', ')}</span> : null;
}
