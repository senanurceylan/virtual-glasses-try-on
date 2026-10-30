// One Euro filtresi ölçüm tablosu: titreme azalması ve gecikme.
// Kullanım: npm run bench:filter
// Farklı parametreleri denemek için: npm run bench:filter -- 1.0 2.0 1.0   (minCutoff beta dCutoff)
import { DEFAULT_PARAMS } from '../src/core/oneEuroFilter.js';
import { IPD, simulateRamp, simulateStatic, simulateStep } from '../tests/filterSim.js';

const [minCutoff, beta, dCutoff] = process.argv.slice(2).map(Number);
const params = {
  minCutoff: minCutoff || DEFAULT_PARAMS.minCutoff,
  beta: Number.isFinite(beta) ? beta : DEFAULT_PARAMS.beta,
  dCutoff: dCutoff || DEFAULT_PARAMS.dCutoff,
};
const pct = (v) => `${(v * 100).toFixed(1)} %`;
const ms = (s) => (s === null ? '–' : `${Math.round(s * 1000)} ms`);

console.log(`Parametreler: minCutoff=${params.minCutoff} Hz, beta=${params.beta}, dCutoff=${params.dCutoff} Hz`);
console.log(`Birim: 1 IPD = ${IPD} px (gözler arası mesafe)\n`);

console.log('1) Sabit yüz + gürültü (σ = 1 px)');
console.table(
  [15, 30, 60].map((fps) => {
    const r = simulateStatic({ fps, sigma: 1, params });
    return {
      FPS: fps,
      'ham sapma (px)': r.rawError.toFixed(3),
      'filtreli sapma (px)': r.filtError.toFixed(3),
      'sapma azalması': pct(r.errorReduction),
      'ham kare-kare (px)': r.rawDelta.toFixed(3),
      'filtreli kare-kare (px)': r.filtDelta.toFixed(3),
      'titreme azalması': pct(r.deltaReduction),
    };
  }),
);

console.log('2) Ani sıçrama (1 IPD = 120 px)');
console.table(
  [15, 30, 60].map((fps) => {
    const r = simulateStep({ fps, params });
    const lp = simulateStep({ fps, params: { ...params, beta: 0 } });
    return {
      FPS: fps,
      '%50 süresi': ms(r.t50),
      '%90 süresi': ms(r.t90),
      'aşma (px)': r.overshoot.toFixed(2),
      '%90 (beta=0, düz alçak geçiren)': ms(lp.t90),
    };
  }),
);

console.log('3) Sabit hızla hareket (3 IPD/s = 360 px/s)');
console.table(
  [15, 30, 60].map((fps) => {
    const r = simulateRamp({ fps, params });
    const lp = simulateRamp({ fps, params: { ...params, beta: 0 } });
    return {
      FPS: fps,
      'gecikme (ms)': r.lagMs.toFixed(1),
      'gecikme (px)': r.lagPx.toFixed(1),
      'gecikme beta=0 (ms)': lp.lagMs.toFixed(1),
    };
  }),
);
