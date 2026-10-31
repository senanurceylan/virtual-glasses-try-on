import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { composeSnapshot, snapshotFileName, snapshotLayers } from '../src/render/snapshot.js';
import { mockContext } from './helpers.js';

const layers = { video: 'VIDEO', glassesCanvas: 'GLASSES2D', threeCanvas: 'THREE', overlayCanvas: 'OVERLAY' };

describe('snapshotLayers — hangi katmanlar birleşir', () => {
  it('2D modda: video + 2D gözlük', () => {
    expect(snapshotLayers(layers, { mode: '2d', showGlasses: true }).filter(Boolean)).toEqual(['VIDEO', 'GLASSES2D']);
  });

  it('3D modda: video + WebGL gözlük', () => {
    expect(snapshotLayers(layers, { mode: '3d', showGlasses: true }).filter(Boolean)).toEqual(['VIDEO', 'THREE']);
  });

  it('gözlük gizliyken yalnızca video; istenirse nokta/geometri katmanı en üstte', () => {
    expect(snapshotLayers(layers, { mode: '3d', showGlasses: false }).filter(Boolean)).toEqual(['VIDEO']);
    expect(snapshotLayers(layers, { mode: '2d', showGlasses: true, includeOverlay: true }).filter(Boolean)).toEqual([
      'VIDEO',
      'GLASSES2D',
      'OVERLAY',
    ]);
  });
});

describe('composeSnapshot — katmanların birleştirilmesi', () => {
  it('ekrandaki gibi aynalar ve katmanları alttan üste aynı boyutta çizer', () => {
    const ctx = mockContext(640, 480);
    composeSnapshot(ctx, snapshotLayers(layers, { mode: '3d', showGlasses: true }), 640, 480);
    const names = ctx.calls.map((c) => c.name);
    expect(names).toEqual(['save', 'setTransform', 'drawImage', 'drawImage', 'restore']);
    expect(ctx.calls[1].args).toEqual([-1, 0, 0, 1, 640, 0]); // x → genişlik − x
    expect(ctx.calls[2].args).toEqual(['VIDEO', 0, 0, 640, 480]);
    expect(ctx.calls[3].args).toEqual(['THREE', 0, 0, 640, 480]);
  });

  it('mirror: false ise dönüşüm uygulanmaz', () => {
    const ctx = mockContext();
    composeSnapshot(ctx, ['VIDEO'], 100, 50, { mirror: false });
    expect(ctx.count('setTransform')).toBe(0);
  });
});

describe('snapshotFileName', () => {
  it('Türkçe karakterleri sadeleştirir, tarih-saat ekler', () => {
    expect(snapshotFileName('Dikdörtgen Çerçeve', new Date(2026, 9, 31, 9, 5, 7))).toBe(
      'sanal-gozluk_dikdortgen-cerceve_20261031-090507.png',
    );
    expect(snapshotFileName('Cat-eye', new Date(2026, 0, 2, 3, 4, 5))).toBe('sanal-gozluk_cat-eye_20260102-030405.png');
  });
});

describe('gizlilik: görüntü sunucuya gönderilmez', () => {
  const files = (dir) =>
    readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));

  it('uygulama kodunda ağ gönderme API’si (fetch, XHR, sendBeacon, WebSocket) kullanılmaz', () => {
    for (const file of files('src')) {
      const code = readFileSync(file, 'utf8');
      expect(code, file).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|sendBeacon|new WebSocket/);
    }
  });
});
