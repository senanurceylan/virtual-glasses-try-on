import { describe, expect, it, vi } from 'vitest';
import { createCameraController } from '../src/core/cameraController.js';

const fakeStream = (id) => ({ id });
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

function setup({ open } = {}) {
  const states = [];
  const deps = {
    open: open ?? vi.fn(async () => fakeStream('s1')),
    attach: vi.fn(async () => ({ width: 1280, height: 720, frameRate: 30 })),
    release: vi.fn(),
    onChange: (s) => states.push(s.status),
  };
  return { ctrl: createCameraController(deps), deps, states };
}

describe('kamera başlat / durdur', () => {
  it('başlatınca starting → ready, çözünürlük bilgisi gelir', async () => {
    const { ctrl, states } = setup();
    await ctrl.start();
    expect(states).toEqual(['starting', 'ready']);
    expect(ctrl.state.info).toEqual({ width: 1280, height: 720, frameRate: 30 });
  });

  it('durdurunca akış bırakılır (kamera ışığı söner) ve idle olur', async () => {
    const { ctrl, deps } = setup();
    await ctrl.start();
    ctrl.stop();
    expect(deps.release).toHaveBeenCalledWith({ id: 's1' });
    expect(ctrl.state.status).toBe('idle');
  });

  it('durdurulan kamera yeniden başlatılabilir (yeni akış açılır)', async () => {
    let n = 0;
    const { ctrl, deps } = setup({ open: vi.fn(async () => fakeStream(`s${++n}`)) });
    await ctrl.start();
    ctrl.stop();
    await ctrl.start();
    expect(ctrl.state.status).toBe('ready');
    expect(deps.open).toHaveBeenCalledTimes(2);
  });

  it('çalışırken ikinci start çağrısı yeni akış açmaz', async () => {
    const { ctrl, deps } = setup();
    await ctrl.start();
    await ctrl.start();
    expect(deps.open).toHaveBeenCalledTimes(1);
  });

  it('açılırken durdurulursa geç gelen akış hemen kapatılır, durum idle kalır', async () => {
    const d = deferred();
    const { ctrl, deps } = setup({ open: () => d.promise });
    const p = ctrl.start();
    ctrl.stop();
    d.resolve(fakeStream('late'));
    await p;
    expect(deps.release).toHaveBeenCalledWith({ id: 'late' });
    expect(deps.attach).not.toHaveBeenCalled();
    expect(ctrl.state.status).toBe('idle');
  });
});

describe('kamera hataları', () => {
  it('izin reddedilince anlaşılır Türkçe mesaj ve hata türü verilir', async () => {
    const err = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    const { ctrl } = setup({ open: vi.fn(async () => Promise.reject(err)) });
    await ctrl.start();
    expect(ctrl.state.status).toBe('error');
    expect(ctrl.state.errorName).toBe('NotAllowedError');
    expect(ctrl.state.error).toContain('izni reddedildi');
  });

  it('kamera başka uygulamada açıksa bunu söyler', async () => {
    const err = Object.assign(new Error('busy'), { name: 'NotReadableError' });
    const { ctrl } = setup({ open: vi.fn(async () => Promise.reject(err)) });
    await ctrl.start();
    expect(ctrl.state.error).toContain('başka bir uygulama');
  });

  it('hatadan sonra "Tekrar dene" ile başlatılabilir, hata temizlenir', async () => {
    let fail = true;
    const { ctrl } = setup({
      open: vi.fn(async () => {
        if (fail) throw Object.assign(new Error('x'), { name: 'NotAllowedError' });
        return fakeStream('ok');
      }),
    });
    await ctrl.start();
    fail = false;
    await ctrl.start();
    expect(ctrl.state.status).toBe('ready');
    expect(ctrl.state.error).toBeNull();
  });
});
