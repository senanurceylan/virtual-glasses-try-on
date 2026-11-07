// Gerçek kamera ölçüm dosyalarından (docs/olcumler/*.json) rapor tablolarını üretir.
//
//   node scripts/summarize-measurements.mjs [dosya.json …]
//
// Dosya verilmezse docs/olcumler içindeki, yedi senaryonun hepsini içeren (tam)
// ölçümler kullanılır. Her değer için tekrarların ortalaması ve [en küçük–en büyük]
// aralığı verilir. Hiçbir değer tahmin edilmez; eksik değer "–" yazılır.
//
// Sabit baş senaryolarında (S1–S5) göz merkezi hareket genliği 0,3·IPD'yi aşmışsa
// baş sabit tutulmamış demektir; bu tekrarın titreme değeri ayrıca işaretlenir ve
// "geçerli" titreme ortalamasına alınmaz.

import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const DIR = new URL('../docs/olcumler/', import.meta.url).pathname;
const IDS = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7'];

const args = process.argv.slice(2);
const files = (args.length ? args : readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => join(DIR, f)))
  .map((path) => ({ path, data: JSON.parse(readFileSync(path, 'utf8')) }))
  .filter(({ data }) => args.length || IDS.every((id) => data.results.some((r) => r.scenario.id === id)));

if (!files.length) {
  console.error('Tam ölçüm dosyası bulunamadı (docs/olcumler).');
  process.exit(1);
}

const runs = files.map(({ data }) => Object.fromEntries(data.results.map((r) => [r.scenario.id, r])));
const fmt = (v, d) => (Number.isFinite(v) ? v.toFixed(d) : '–');
const agg = (values, d) => {
  const v = values.filter(Number.isFinite);
  if (!v.length) return '–';
  const m = v.reduce((s, x) => s + x, 0) / v.length;
  return v.length === 1 ? fmt(m, d) : `${fmt(m, d)} [${fmt(Math.min(...v), d)}–${fmt(Math.max(...v), d)}]`;
};
const col = (id, get) => runs.map((r) => (r[id] ? get(r[id]) : NaN));
const stage = (name, key) => (r) => r.summary.stages[name]?.[key] ?? NaN;
const still = (id) => runs[0][id]?.scenario.motion === 'still';
const amplitudeOk = (r) => {
  const lag = r.summary.lag;
  const ipd = r.summary.jitter?.ipdPx;
  return !lag || !ipd || lag.amplitudePx < 0.3 * ipd;
};

const env = files[0].data.env ?? {};
console.log(`Kaynak dosyalar (${files.length} tekrar): ${files.map((f) => basename(f.path)).join(', ')}`);
console.log(`Kamera ${env.resolution} @ ${env.frameRate} fps · MediaPipe ${env.delegate} · ısınma ${env.timing?.warmupMs / 1000} sn + kayıt ${env.timing?.durationMs / 1000} sn`);
console.log('Değer biçimi: ortalama [en küçük–en büyük] (tekrarlar arası)\n');

console.log('### Tablo A — Kare hızı ve kare süresi\n');
console.log('| Senaryo | FPS | Kare süresi ort (ms) | Kare süresi p95 (ms) | Kare aralığı p95 (ms) | Yüz bulunan kare (%) |');
console.log('|---|---|---|---|---|---|');
for (const id of IDS) {
  console.log(
    `| ${id} ${runs[0][id]?.scenario.name ?? ''} | ${agg(col(id, (r) => r.summary.fps), 2)} | ${agg(col(id, (r) => r.summary.frameMs.mean), 2)} | ${agg(col(id, (r) => r.summary.frameMs.p95), 2)} | ${agg(col(id, (r) => r.summary.interval.p95), 1)} | ${agg(col(id, (r) => r.summary.faceRate * 100), 1)} |`,
  );
}

console.log('\n### Tablo B — Aşama süreleri, ortalama (ms)\n');
const STAGES = ['Tespit', 'Yerleştirme', 'Çizim', '3D çizim', 'Algoritma', 'Yüz şekli'];
console.log(`| Senaryo | ${STAGES.join(' | ')} |`);
console.log(`|---|${STAGES.map(() => '---').join('|')}|`);
for (const id of IDS) {
  console.log(`| ${id} | ${STAGES.map((s) => agg(col(id, stage(s, 'mean')), s === 'Tespit' ? 2 : 3)).join(' | ')} |`);
}
console.log('\n### Tablo C — Aşama süreleri, p95 (ms)\n');
console.log(`| Senaryo | ${STAGES.join(' | ')} |`);
console.log(`|---|${STAGES.map(() => '---').join('|')}|`);
for (const id of IDS) {
  console.log(`| ${id} | ${STAGES.map((s) => agg(col(id, stage(s, 'p95')), s === 'Tespit' ? 2 : 3)).join(' | ')} |`);
}

console.log('\n### Tablo D — Göz merkezi titremesi ve filtre etkisi (her tekrar ayrı)\n');
console.log('| Senaryo | Tekrar | Yüz % | Hareket genliği (px) | IPD (px) | Titreme ham (px) | Titreme filtreli (px) | Azalma (%) | Gecikme (ms) | Not |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
for (const id of IDS) {
  runs.forEach((r, k) => {
    const x = r[id];
    if (!x) return;
    const s = x.summary;
    const notes = [];
    if (still(id) && !amplitudeOk(x)) notes.push('baş sabit değil');
    if (s.faceRate < 0.9) notes.push('yüz < %90');
    if (s.lag && !s.lag.reliable && !still(id)) notes.push('hareket az');
    const lag = s.lag?.reliable && x.scenario.settings.stabilize && !still(id) ? fmt(s.lag.ms, 0) : '–';
    console.log(
      `| ${id} | ${k + 1} | ${fmt(s.faceRate * 100, 0)} | ${fmt(s.lag?.amplitudePx, 0)} | ${fmt(s.jitter?.ipdPx, 0)} | ${fmt(s.jitter?.rawPx, 3)} | ${fmt(s.jitter?.filteredPx, 3)} | ${fmt(s.jitter ? s.jitter.reduction * 100 : NaN, 1)} | ${lag} | ${notes.join(', ')} |`,
    );
  });
}

console.log('\n### Tablo E — Sabit baş titremesi (yalnızca baş sabit tutulan tekrarlar)\n');
console.log('| Senaryo | Geçerli tekrar | Titreme ham (px) | Titreme filtreli (px) | Filtreli / IPD (%) | Azalma (%) |');
console.log('|---|---|---|---|---|---|');
for (const id of IDS.filter(still)) {
  const ok = runs.map((r) => r[id]).filter((x) => x && amplitudeOk(x));
  const g = (f) => ok.map((x) => f(x.summary.jitter));
  console.log(
    `| ${id} | ${ok.length}/${runs.length} | ${agg(g((j) => j.rawPx), 3)} | ${agg(g((j) => j.filteredPx), 3)} | ${agg(g((j) => j.filteredPctIpd), 3)} | ${agg(g((j) => j.reduction * 100), 1)} |`,
  );
}
