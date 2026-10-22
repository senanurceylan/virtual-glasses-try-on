import { describe, expect, it } from 'vitest';
import { FacePresence } from '../src/core/facePresence.js';

const feed = (presence, values) => values.map((v) => presence.update(v));

describe('FacePresence', () => {
  it('başlangıçta yüz yok kabul edilir', () => {
    expect(new FacePresence().visible).toBe(false);
  });

  it('yüz foundAfter kare art arda görülünce görünür olur', () => {
    const p = new FacePresence({ foundAfter: 2, lostAfter: 3 });
    expect(feed(p, [true, true])).toEqual([false, true]);
  });

  it('tek karelik kayıplarda uyarı yanıp sönmez', () => {
    const p = new FacePresence({ foundAfter: 1, lostAfter: 3 });
    const states = feed(p, [true, false, true, false, false, true]);
    expect(states.every(Boolean)).toBe(true);
  });

  it('lostAfter kare art arda yüz yoksa kayıp olur', () => {
    const p = new FacePresence({ foundAfter: 1, lostAfter: 3 });
    expect(feed(p, [true, false, false, false])).toEqual([true, true, true, false]);
  });

  it('tespit oranını hesaplar', () => {
    const p = new FacePresence();
    feed(p, [true, true, false, true]);
    expect(p.detectionRate).toBe(0.75);
  });

  it('reset durumu ve sayaçları sıfırlar', () => {
    const p = new FacePresence({ foundAfter: 1 });
    feed(p, [true, true]);
    p.reset();
    expect(p.visible).toBe(false);
    expect(p.detectionRate).toBe(0);
  });
});
