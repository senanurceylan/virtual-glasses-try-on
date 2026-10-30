import { existsSync } from 'node:fs';
import { Box3 } from 'three';
import { describe, expect, it } from 'vitest';
import { CANONICAL, SHAPES } from '../src/core/faceShape.js';
import { frameAttachments, FRAME_STYLES, lensPoints, placedLens } from '../src/core/frameStyles.js';
import { faceDescriptors, recommendFrames } from '../src/core/recommendations.js';
import { CHEEK_POINTS, FOREHEAD_POINTS, rgbToYCrCb, skinCoverage } from '../src/core/skinCheck.js';
import { GLASSES } from '../src/render/glassesCatalog.js';
import { buildGlassesModel } from '../src/render/three/glassesModel3D.js';

const top3 = (shape) => recommendFrames(SHAPES[shape].proto, FRAME_STYLES, 3).map((r) => r.id);
const all = (shape) => recommendFrames(SHAPES[shape].proto, FRAME_STYLES, FRAME_STYLES.length).map((r) => r.id);

describe('faceDescriptors', () => {
  it('ortalama yüzde tüm tanımlayıcılar ~0', () => {
    for (const v of Object.values(faceDescriptors(CANONICAL))) expect(Math.abs(v)).toBeLessThan(0.05);
  });

  it('uzun yüz uzunluk +, kalp üst ağırlık +, elmas elmacık +, kare köşelilik +', () => {
    expect(faceDescriptors(SHAPES.oblong.proto).length).toBeGreaterThan(1);
    expect(faceDescriptors(SHAPES.heart.proto).topHeavy).toBeGreaterThan(1);
    expect(faceDescriptors(SHAPES.diamond.proto).cheek).toBeGreaterThan(1);
    expect(faceDescriptors(SHAPES.square.proto).angularity).toBeGreaterThan(0.5);
    expect(faceDescriptors(SHAPES.round.proto).angularity).toBeLessThan(-0.5);
  });
});

describe('recommendFrames — öneri puanı', () => {
  it('en fazla 3 öneri, puana göre sıralı, puanlar 0–100, her birinin gerekçesi var', () => {
    const recs = recommendFrames(SHAPES.oval.proto, FRAME_STYLES);
    expect(recs).toHaveLength(3);
    for (let i = 1; i < recs.length; i++) expect(recs[i - 1].score).toBeGreaterThanOrEqual(recs[i].score);
    for (const r of recs) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
      expect(r.reasons.length).toBeGreaterThan(0);
    }
  });

  it('yuvarlak yüz → köşeli/sığ çerçeve (dikdörtgen) önde, yuvarlak çerçeve en sonda', () => {
    expect(top3('round')[0]).toBe('rectangle-navy');
    expect(all('round').at(-1)).toBe('round-gold');
  });

  it('kare yüz → yuvarlak çerçeve ilk üçte, kare çerçeve en sonda', () => {
    expect(top3('square')).toContain('round-gold');
    expect(all('square').at(-1)).toBe('square-tortoise');
  });

  it('kalp yüz → altı ağır aviator önde, üstü ağır cat-eye en sonda', () => {
    expect(top3('heart')[0]).toBe('aviator-silver');
    expect(all('heart').at(-1)).toBe('cat-eye-burgundy');
  });

  it('uzun yüz → derin camlar önde, sığ dikdörtgen en sonda', () => {
    expect(top3('oblong')).toEqual(expect.arrayContaining(['round-gold', 'aviator-silver']));
    expect(all('oblong').at(-1)).toBe('rectangle-navy');
  });

  it('elmas yüz → üst kenarı vurgulu cat-eye önde', () => {
    expect(top3('diamond')[0]).toBe('cat-eye-burgundy');
  });

  it('ortalama yüzde tüm çerçeveler nötr (50) ve gerekçe "dengeli"', () => {
    const recs = recommendFrames(CANONICAL, FRAME_STYLES, FRAME_STYLES.length);
    for (const r of recs) {
      expect(r.score).toBe(50);
      expect(r.reasons[0]).toContain('dengeli');
    }
  });

  it('gerekçeler katkı yönüyle tutarlı: olumsuz katkılar "dikkat" listesinde', () => {
    const [worst] = recommendFrames(SHAPES.round.proto, FRAME_STYLES, FRAME_STYLES.length).slice(-1);
    expect(worst.cautions.length).toBeGreaterThan(0);
  });
});

describe('çerçeve modelleri (2D + 3D)', () => {
  it.each(FRAME_STYLES.map((s) => [s.id, s]))('%s: PNG var, katalogda 2D ve 3D modları açık', (id) => {
    expect(existsSync(`public/glasses/${id}.png`)).toBe(true);
    expect(GLASSES.find((g) => g.id === id).modes).toEqual(['2d', '3d']);
  });

  it.each(FRAME_STYLES.map((s) => [s.id, s]))('%s: cam hattı tanımlı yükseklikte ve saat yönü tersine', (id, style) => {
    const pts = lensPoints(style);
    const ys = pts.map((p) => p.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(style.lens.height, 5);
    const area = pts.reduce((s, p, i) => s + p.x * pts[(i + 1) % pts.length].y - pts[(i + 1) % pts.length].x * p.y, 0) / 2;
    expect(area).toBeGreaterThan(0);
  });

  it.each(FRAME_STYLES.map((s) => [s.id, s]))('%s: sağ ve sol cam birbirinin aynası', (id, style) => {
    const right = placedLens(style, -1, 72);
    const left = placedLens(style, 1, 72);
    expect(Math.min(...right.map((p) => p.x))).toBeCloseTo(-Math.max(...left.map((p) => p.x)));
  });

  it.each(FRAME_STYLES.map((s) => [s.id, s]))('%s: 3D model 12–15.5 cm genişlikte, simetrik; köprü burun üstünde', (id, style) => {
    const { front } = buildGlassesModel(style);
    const box = new Box3().setFromObject(front);
    expect(box.max.x - box.min.x).toBeGreaterThan(12);
    expect(box.max.x - box.min.x).toBeLessThan(15.5);
    expect(box.max.x + box.min.x).toBeCloseTo(0);
    const { bridgeX } = frameAttachments(style);
    expect(bridgeX).toBeGreaterThan(0.5);
    expect(bridgeX).toBeLessThan(1.6);
  });
});

describe('skinCheck — alın görünürlüğü (YCrCb ten benzerliği)', () => {
  const skin = [220, 170, 140];
  const vary = ([r, g, b], n, seed = 1) =>
    Array.from({ length: n }, (_, i) => {
      const d = ((i * 37 + seed * 11) % 9) - 4;
      return [r + d, g + d, b + d];
    });

  it('beyaz → Y 255, Cr = Cb = 128', () => {
    const p = rgbToYCrCb(255, 255, 255);
    expect(p.y).toBeCloseTo(255);
    expect(p.cr).toBeCloseTo(128);
    expect(p.cb).toBeCloseTo(128);
  });

  it('açık alın: ten oranı ~1', () => {
    expect(skinCoverage(vary(skin, 100), vary(skin, 90, 2))).toBeGreaterThan(0.95);
  });

  it('alında daha parlak ışık olsa da ten sayılır (renk, parlaklıktan ayrı)', () => {
    const brighter = skin.map((c) => Math.min(255, c * 1.12));
    expect(skinCoverage(vary(brighter, 100), vary(skin, 90))).toBeGreaterThan(0.9);
  });

  it('koyu saçla kapalı alın: ten oranı ~0', () => {
    expect(skinCoverage(vary([45, 32, 25], 100), vary(skin, 90))).toBeLessThan(0.05);
  });

  it('yarısı kapalı alın: ten oranı ~0.5', () => {
    const half = [...vary(skin, 50), ...vary([45, 32, 25], 50)];
    expect(skinCoverage(half, vary(skin, 90))).toBeCloseTo(0.5, 1);
  });

  it('açık renk (sarı) saç da renk farkından ayırt edilir', () => {
    expect(skinCoverage(vary([225, 200, 120], 100), vary(skin, 90))).toBeLessThan(0.2);
  });

  it('örnek noktaları geçerli MediaPipe indeksleri', () => {
    for (const i of [...FOREHEAD_POINTS, ...CHEEK_POINTS]) expect(i).toBeLessThan(468);
  });
});
