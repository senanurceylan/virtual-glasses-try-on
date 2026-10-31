// Kamera durum makinesi (React'ten bağımsız, test edilebilir).
//
//   idle ──start()──▶ starting ──akış hazır──▶ ready
//     ▲                  │  └──hata──▶ error ──start()──▶ starting
//     └──────stop()──────┴──────────────────────────────────┘
//
// `generation` sayacı: start() beklerken stop() çağrılırsa (ör. kullanıcı hemen
// "Durdur"a basarsa ya da React StrictMode effect'i iki kez çalıştırırsa) geç gelen
// akış hemen kapatılır, kamera ışığı açık kalmaz.

import { describeCameraError } from './camera.js';

/**
 * @param deps.open    () => Promise<MediaStream>
 * @param deps.attach  (stream) => Promise<{width, height, frameRate}>
 * @param deps.release (stream|null) => void   akışı durdurur, videodan ayırır
 * @param deps.onChange (state) => void
 */
export function createCameraController({ open, attach, release, onChange }) {
  let state = { status: 'idle', error: null, errorName: null, info: null };
  let stream = null;
  let generation = 0;

  const set = (patch) => {
    state = { ...state, ...patch };
    onChange?.(state);
  };

  async function start() {
    if (stream || state.status === 'starting') return;
    const gen = ++generation;
    set({ status: 'starting', error: null, errorName: null });
    try {
      const s = await open();
      if (gen !== generation) {
        release(s);
        return;
      }
      stream = s;
      const info = await attach(s);
      if (gen !== generation) return;
      set({ status: 'ready', info });
    } catch (err) {
      if (gen !== generation) return;
      release(stream);
      stream = null;
      set({ status: 'error', error: describeCameraError(err), errorName: err?.name ?? null });
    }
  }

  function stop() {
    generation++;
    release(stream);
    stream = null;
    set({ status: 'idle', error: null, errorName: null });
  }

  return {
    start,
    stop,
    get state() {
      return state;
    },
  };
}
