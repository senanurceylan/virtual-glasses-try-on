import { describe, expect, it } from 'vitest';
import { PerfMonitor } from '../src/core/perfMonitor.js';

/** Elle ilerletilebilen sahte saat. */
function fakeClock() {
  let t = 0;
  return { now: () => t, advance: (ms) => (t += ms) };
}

describe('PerfMonitor', () => {
  it('kareler arası süreden FPS hesaplar', () => {
    const clock = fakeClock();
    const perf = new PerfMonitor({ now: clock.now });
    for (let i = 0; i < 31; i++) {
      perf.frameStart();
      perf.frameEnd();
      clock.advance(1000 / 30);
    }
    expect(perf.snapshot().fps).toBeCloseTo(30, 5);
  });

  it('ilk kareden önce FPS 0 döner', () => {
    const perf = new PerfMonitor({ now: fakeClock().now });
    expect(perf.snapshot().fps).toBe(0);
  });

  it('aşama sürelerini ölçer ve fonksiyonun sonucunu döndürür', () => {
    const clock = fakeClock();
    const perf = new PerfMonitor({ now: clock.now });
    const result = perf.measure('algılama', () => {
      clock.advance(12);
      return 'tamam';
    });
    expect(result).toBe('tamam');
    expect(perf.snapshot().stages['algılama']).toMatchObject({ avg: 12, min: 12, max: 12, last: 12, count: 1 });
  });

  it('fonksiyon hata fırlatsa da süreyi kaydeder', () => {
    const clock = fakeClock();
    const perf = new PerfMonitor({ now: clock.now });
    expect(() =>
      perf.measure('x', () => {
        clock.advance(5);
        throw new Error('hata');
      }),
    ).toThrow('hata');
    expect(perf.snapshot().stages.x.last).toBe(5);
  });

  it('kayan pencere yalnızca son N değeri tutar', () => {
    const perf = new PerfMonitor({ windowSize: 3, now: fakeClock().now });
    [10, 20, 30, 40, 50].forEach((ms) => perf.record('a', ms));
    expect(perf.snapshot().stages.a).toMatchObject({ avg: 40, min: 30, max: 50, last: 50, count: 3 });
  });

  it('kare toplam süresini ölçer', () => {
    const clock = fakeClock();
    const perf = new PerfMonitor({ now: clock.now });
    perf.frameStart();
    clock.advance(8);
    perf.frameEnd();
    expect(perf.snapshot().frameMs.avg).toBe(8);
  });

  it('reset tüm ölçümleri temizler', () => {
    const perf = new PerfMonitor({ now: fakeClock().now });
    perf.record('a', 1);
    perf.reset();
    expect(perf.snapshot().stages).toEqual({});
  });
});
