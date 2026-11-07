import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_ALGO } from '../core/algorithmLayers.js';
import { ALL_LAYERS_ON, BenchmarkRecorder, DEFAULT_TIMING, SCENARIOS, summarize } from '../core/benchmark.js';

const POLL_MS = 200;
const STORAGE_KEY = 'sanal-gozluk:benchmark-results';

/** Senaryo ayarlarını uygulama durumuna çevirir (view ve algo). */
export function scenarioState(settings, view, algo) {
  return {
    view: { ...view, mode: settings.mode, stabilize: settings.stabilize },
    algo: settings.algo
      ? { enabled: true, layers: settings.algo === 'all' ? { ...ALL_LAYERS_ON } : { ...DEFAULT_ALGO.layers } }
      : { ...algo, enabled: false },
  };
}

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function save(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // depolama kapalıysa sonuçlar yalnızca bu oturumda kalır
  }
}

/**
 * Ölçüm protokolünü çalıştırır: her senaryonun ayarlarını uygular, ısınma + kayıt
 * süresince kareleri BenchmarkRecorder'a toplar, özetler ve sonrakine geçer.
 * Bitince (ya da iptal edilince) kullanıcının önceki ayarlarını geri yükler.
 *
 * React durumu yalnızca evre ya da kalan saniye değişince güncellenir (≤ 1 Hz),
 * böylece ölçüm sırasında arayüz yeniden çizimi ölçümü etkilemez.
 *
 * @param env  () => { resolution, frameRate, delegate } — sonuçlara eklenir
 */
export function useBenchmark({ perf, running, view, setView, algo, setAlgo, mode, env }) {
  const recorderRef = useRef(null);
  const latest = useRef({});
  latest.current = { view, algo, mode, env };
  const run = useRef(null); // { queue, index, saved, results, timing }
  const [state, setState] = useState(() => ({ status: 'idle', current: null, phase: null, secondsLeft: 0, ...(loadSaved() ?? { results: [], env: null }) }));

  const finish = useCallback(
    (status, error = null) => {
      const r = run.current;
      if (!r) return;
      perf.setListener(null);
      recorderRef.current = null;
      setView(r.saved.view);
      setAlgo(r.saved.algo);
      run.current = null;
      setState((s) => {
        const next = { ...s, status, error, current: null, phase: null, secondsLeft: 0 };
        if (status === 'done') save({ results: next.results, env: next.env });
        return next;
      });
    },
    [perf, setView, setAlgo],
  );

  const startScenario = useCallback(
    (index) => {
      const r = run.current;
      const scenario = r.queue[index];
      const { view: v, algo: a } = scenarioState(scenario.settings, latest.current.view, latest.current.algo);
      setView(v);
      setAlgo(a);
      const rec = new BenchmarkRecorder(r.timing);
      rec.start(performance.now());
      recorderRef.current = rec;
      r.index = index;
      setState((s) => ({ ...s, current: { scenario, index, total: r.queue.length }, phase: 'warmup' }));
    },
    [setView, setAlgo],
  );

  const start = useCallback(
    (ids = SCENARIOS.map((s) => s.id), timing = DEFAULT_TIMING) => {
      if (run.current || !running) return;
      const queue = SCENARIOS.filter((s) => ids.includes(s.id));
      run.current = { queue, index: 0, timing, saved: { view: latest.current.view, algo: latest.current.algo } };
      perf.setListener((t, now) => recorderRef.current?.observeFrame(t, now));
      const e = latest.current.env();
      setState((s) => ({
        ...s,
        status: 'running',
        error: null,
        // Tek senaryo tekrar ölçülürse eski sonucu değiştir, diğerlerini koru
        results: s.results.filter((x) => !ids.includes(x.scenario.id) && x.env?.resolution === e.resolution),
        env: { ...e, date: new Date().toISOString(), userAgent: navigator.userAgent, timing },
      }));
      startScenario(0);
    },
    [perf, running, startScenario],
  );

  const cancel = useCallback(() => finish('cancelled'), [finish]);

  // İlerlemeyi izle: senaryo bitince özetle, sonrakine geç.
  useEffect(() => {
    if (state.status !== 'running') return undefined;
    const id = setInterval(() => {
      const r = run.current;
      const rec = recorderRef.current;
      if (!r || !rec) return;
      const now = performance.now();
      if (rec.phase === 'done') {
        const result = {
          scenario: r.queue[r.index],
          effectiveMode: latest.current.mode,
          env: { resolution: latest.current.env().resolution },
          summary: summarize(rec.frames),
        };
        setState((s) => ({ ...s, results: [...s.results.filter((x) => x.scenario.id !== result.scenario.id), result] }));
        if (r.index + 1 < r.queue.length) startScenario(r.index + 1);
        else finish('done');
        return;
      }
      const p = rec.progress(now);
      const secondsLeft = Math.ceil(p.remainingMs / 1000);
      setState((s) => (s.phase === p.phase && s.secondsLeft === secondsLeft ? s : { ...s, phase: p.phase, secondsLeft }));
    }, POLL_MS);
    return () => clearInterval(id);
  }, [state.status, startScenario, finish]);

  // Kamera kapanırsa ölçüm iptal edilir (eksik veriyle sonuç üretilmez).
  useEffect(() => {
    if (!running && run.current) finish('error', 'Kamera kapandı; ölçüm iptal edildi.');
  }, [running, finish]);

  const clear = useCallback(() => {
    save({ results: [], env: null });
    setState((s) => ({ ...s, results: [], env: null, status: 'idle' }));
  }, []);

  return { ...state, recorderRef, start, cancel, clear };
}
