// Not: Bu testler sentetik noktalarla algoritmanın iç tutarlılığını doğrular.
// Gerçek yüzlerde yüz şekli sınıflandırmasının doğruluğunu KANITLAMAZ.
import { describe, expect, it } from 'vitest';
import { CANONICAL, classifyFaceShape, explainRatios, featureLevel, measureFace, SHAPES } from '../src/core/faceShape.js';
import { ESTIMATOR_DEFAULTS, FaceShapeEstimator } from '../src/core/faceShapeEstimator.js';
import { shapeFace, W, H } from './shapeFace.js';

const shapeIds = Object.keys(SHAPES);
const close = (ratios, target, tol = 0.005) => {
  for (const k of ['L', 'F', 'J', 'C']) expect(ratios[k]).toBeCloseTo(target[k], -Math.log10(tol));
  expect(Math.abs(ratios.A - target.A)).toBeLessThan(0.5);
};

describe('measureFace — ölçümler ve normalizasyon', () => {
  it('sentetik yüzün oranlarını geri bulur', () => {
    for (const id of shapeIds) close(measureFace(shapeFace(SHAPES[id].proto), W, H).ratios, SHAPES[id].proto);
  });

  it('ölçekten bağımsız: yüz küçük ya da büyük olsa da oranlar aynı', () => {
    const p = SHAPES.oval.proto;
    const small = measureFace(shapeFace(p, { cheekPx: 160 }), W, H).ratios;
    const big = measureFace(shapeFace(p, { cheekPx: 480 }), W, H).ratios;
    close(small, big);
  });

  it('baş yana yatınca (roll 20°) oranlar değişmez', () => {
    const p = SHAPES.heart.proto;
    close(measureFace(shapeFace(p, { roll: 20 }), W, H).ratios, p);
  });

  it('küçük yaw (±10°): genişlikler 3D ölçüldüğü için değişmez, çene açısı 1°’den az sapar', () => {
    for (const yaw of [-10, 10]) {
      const r = measureFace(shapeFace(SHAPES.square.proto, { yaw }), W, H).ratios;
      expect(r.J).toBeCloseTo(SHAPES.square.proto.J, 3);
      expect(Math.abs(r.A - SHAPES.square.proto.A)).toBeLessThan(1);
    }
  });

  it('büyük yaw (25°) 2D çene açısını belirgin bozar (bu yüzden tahmin reddedilir)', () => {
    const r = measureFace(shapeFace(SHAPES.round.proto, { yaw: 25 }), W, H).ratios;
    expect(Math.abs(r.A - SHAPES.round.proto.A)).toBeGreaterThan(2);
  });

  it('ağız açıklığını üç iç dudak çiftinden ölçer, elmacık genişliğine göre normalize eder', () => {
    expect(measureFace(shapeFace(SHAPES.oval.proto, { mouth: 0.1 }), W, H).mouthOpen).toBeCloseTo(0.1, 3);
    // yüz boyutundan bağımsız
    const small = measureFace(shapeFace(SHAPES.oval.proto, { mouth: 0.06, cheekPx: 180 }), W, H).mouthOpen;
    const big = measureFace(shapeFace(SHAPES.oval.proto, { mouth: 0.06, cheekPx: 450 }), W, H).mouthOpen;
    expect(small).toBeCloseTo(big, 4);
  });

  it('ağız açılınca çene iner ve yüz uzunluğu oranı (L) büyür — bu yüzden açık ağız ölçülmemeli', () => {
    const closed = measureFace(shapeFace(SHAPES.oval.proto), W, H).ratios.L;
    const open = measureFace(shapeFace(SHAPES.oval.proto, { mouth: 0.15 }), W, H).ratios.L;
    expect(open - closed).toBeGreaterThan(0.1);
  });
});

describe('classifyFaceShape — prototip benzerliği', () => {
  it.each(shapeIds)('%s prototipi kendi şekline sınıflanır (olasılık > 0.8)', (id) => {
    const c = classifyFaceShape(SHAPES[id].proto);
    expect(c.shape).toBe(id);
    expect(c.probability).toBeGreaterThan(0.8);
  });

  it('olasılıklar toplamı 1, sıralama azalan', () => {
    const c = classifyFaceShape(CANONICAL);
    expect(c.ranking.reduce((s, r) => s + r.probability, 0)).toBeCloseTo(1);
    for (let i = 1; i < c.ranking.length; i++) expect(c.ranking[i - 1].probability).toBeGreaterThanOrEqual(c.ranking[i].probability);
  });

  it('kanonik (ortalama) yüz ovale en yakın', () => {
    expect(classifyFaceShape(CANONICAL).shape).toBe('oval');
  });

  it.each([
    ['round', 'square'],
    ['oval', 'oblong'],
    ['heart', 'oval'],
  ])('%s ile %s prototiplerinin tam ortası iki şekil arasında kararsız sonuç verir', (a, b) => {
    const pa = SHAPES[a].proto;
    const pb = SHAPES[b].proto;
    const c = classifyFaceShape(Object.fromEntries(Object.keys(pa).map((k) => [k, (pa[k] + pb[k]) / 2])));
    expect(c.probability).toBeLessThan(0.6);
    expect(c.margin).toBeLessThan(0.05);
    expect([c.ranking[0].shape, c.ranking[1].shape].sort()).toEqual([a, b].sort());
  });

  it('yüz uzadıkça (L ↑) sonuç ovalden uzuna geçer', () => {
    const shapes = [1.2, 1.26, 1.32, 1.38].map((L) => classifyFaceShape({ ...SHAPES.oval.proto, L }).shape);
    expect(shapes[0]).toBe('oval');
    expect(shapes.at(-1)).toBe('oblong');
  });
});

describe('explainRatios', () => {
  it('ortalamadan ±1σ uzak oranları düşük/yüksek olarak açıklar', () => {
    expect(featureLevel('L', 1.32)).toBe(1);
    expect(featureLevel('L', 1.153)).toBe(0);
    const rows = explainRatios(SHAPES.oblong.proto);
    expect(rows.find((r) => r.key === 'L').text).toBe('uzun');
    expect(rows).toHaveLength(5);
  });
});

describe('FaceShapeEstimator — çok kareli, güvenilirlik kontrollü tahmin', () => {
  const straight = { yaw: 0, pitch: 0, roll: 0 };
  const feed = (est, n, makeFace, angles = straight) => {
    let s;
    for (let i = 0; i < n; i++) s = est.update(makeFace(i), typeof angles === 'function' ? angles(i) : angles, W, H);
    return s;
  };

  it('yeterli örnek toplanmadan tahmin vermez, ilerleme gösterir', () => {
    const est = new FaceShapeEstimator();
    const s = feed(est, 10, () => shapeFace(SHAPES.oval.proto));
    expect(s.status).toBe('collecting');
    expect(s.result).toBeNull();
    expect(s.progress).toBeCloseTo(10 / ESTIMATOR_DEFAULTS.minSamples);
  });

  it.each(shapeIds)('gürültülü landmark’larla (σ = 1 px) %s yüz doğru tahmin edilir', (id) => {
    const est = new FaceShapeEstimator();
    const s = feed(est, 60, (i) => shapeFace(SHAPES[id].proto, { noise: 1, seed: i + 1 }));
    expect(s.status).toBe('ready');
    expect(s.result.classification.shape).toBe(id);
  });

  it('küçük baş hareketlerinde (yaw/pitch ±8°) aynı sonuç', () => {
    const est = new FaceShapeEstimator();
    const angles = (i) => ({ yaw: 8 * Math.sin(i / 5), pitch: 6 * Math.cos(i / 7), roll: 0 });
    const s = feed(est, 60, (i) => shapeFace(SHAPES.diamond.proto, { yaw: 8 * Math.sin(i / 5), pitch: 6 * Math.cos(i / 7), noise: 1, seed: i + 1 }), angles);
    expect(s.result.classification.shape).toBe('diamond');
  });

  it.each([
    [{ yaw: 25, pitch: 0, roll: 0 }, 'sola'],
    [{ yaw: -25, pitch: 0, roll: 0 }, 'sağa'],
    [{ yaw: 0, pitch: 20, roll: 0 }, 'aşağı'],
    [{ yaw: 0, pitch: -20, roll: 0 }, 'yukarı'],
    [{ yaw: 0, pitch: 0, roll: 25 }, 'yatık'],
  ])('baş dönükken (%o) örnek almaz ve yönü bildirir', (angles, word) => {
    const est = new FaceShapeEstimator();
    const s = feed(est, 60, () => shapeFace(SHAPES.oval.proto, angles), angles);
    expect(s.status).toBe('pose');
    expect(s.message).toContain(word);
    expect(est.samples).toHaveLength(0);
    expect(s.result).toBeNull();
  });

  it('kafa pozu yoksa tahmin vermez', () => {
    const est = new FaceShapeEstimator();
    expect(feed(est, 40, () => shapeFace(SHAPES.oval.proto), null).status).toBe('pose');
  });

  describe('ağız açıklığı kontrolü', () => {
    const { mouthEnter, mouthExit } = ESTIMATOR_DEFAULTS;
    const oval = (mouth, i = 0) => shapeFace(SHAPES.oval.proto, { mouth, noise: 0.5, seed: i + 1 });

    it('kapalı ağız (0.005) ve normal konuşma/hafif açıklık (0.02) ölçümü durdurmaz', () => {
      for (const g of [0.005, 0.02]) {
        const est = new FaceShapeEstimator();
        expect(feed(est, 40, (i) => oval(g, i)).status).toBe('ready');
      }
    });

    it('belirgin açıklıkta (0.08) örnek eklenmez ve "ağzınızı kapatın" uyarısı çıkar', () => {
      const est = new FaceShapeEstimator();
      const s = feed(est, 40, (i) => oval(0.08, i));
      expect(s.status).toBe('mouth');
      expect(s.message).toBe('Yüz şekli analizi için lütfen ağzınızı kapatın.');
      expect(est.samples).toHaveLength(0);
      expect(s.mouth).toBeCloseTo(0.08, 2);
    });

    it('tahmin hazırken ağız açılınca yeni örnek eklenmez, eski sonuç yalnızca "last" olarak kalır', () => {
      const est = new FaceShapeEstimator();
      feed(est, 40, (i) => oval(0.005, i));
      const before = est.samples.length;
      const s = feed(est, 20, (i) => oval(0.12, i));
      expect(est.samples).toHaveLength(before);
      expect(s.status).toBe('mouth');
      expect(s.result).toBeNull(); // güncel sonuç yok
      expect(s.last.classification.shape).toBe('oval'); // panel bunu "güncel değil" notuyla gösterir
    });

    it('ağız kapanınca analiz kendiliğinden devam eder', () => {
      const est = new FaceShapeEstimator();
      feed(est, 40, (i) => oval(0.005, i));
      feed(est, 10, (i) => oval(0.1, i));
      const s = feed(est, 5, (i) => oval(0.005, i));
      expect(s.status).toBe('ready');
      expect(s.result.classification.shape).toBe('oval');
    });

    it('histerezis: eşikler arasında (0.035) bulunan değer önceki durumu korur', () => {
      const mid = (mouthEnter + mouthExit) / 2;
      const fromClosed = new FaceShapeEstimator();
      feed(fromClosed, 40, (i) => oval(0.005, i));
      expect(feed(fromClosed, 10, (i) => oval(mid, i)).status).toBe('ready');

      const fromOpen = new FaceShapeEstimator();
      feed(fromOpen, 40, (i) => oval(0.005, i));
      feed(fromOpen, 3, (i) => oval(0.1, i));
      expect(feed(fromOpen, 10, (i) => oval(mid, i)).status).toBe('mouth');
    });

    it('eşik çevresinde dalgalanan açıklıkta uyarı kareden kareye açılıp kapanmaz', () => {
      const est = new FaceShapeEstimator();
      feed(est, 40, (i) => oval(0.005, i));
      const statuses = [];
      // 0.04 ↔ 0.05: giriş eşiği (0.045) çevresinde dalgalanma
      for (let i = 0; i < 40; i++) statuses.push(est.update(oval(i % 2 ? 0.05 : 0.04, i), { yaw: 0, pitch: 0, roll: 0 }, W, H).status);
      const changes = statuses.slice(1).filter((s, i) => s !== statuses[i]).length;
      expect(changes).toBeLessThanOrEqual(1); // bir kez "mouth"a girer ve orada kalır
      expect(statuses.at(-1)).toBe('mouth');
    });

    it('histerezis olmasaydı aynı dalgalanma her karede durum değiştirirdi (karşılaştırma)', () => {
      const est = new FaceShapeEstimator({ mouthEnter: 0.045, mouthExit: 0.045 });
      feed(est, 40, (i) => oval(0.005, i));
      const statuses = [];
      for (let i = 0; i < 40; i++) statuses.push(est.update(oval(i % 2 ? 0.05 : 0.04, i), { yaw: 0, pitch: 0, roll: 0 }, W, H).status);
      expect(statuses.slice(1).filter((s, i) => s !== statuses[i]).length).toBeGreaterThan(30);
    });

    it('ağız durumu baş dönükken de izlenir (dönünce histerezis sıfırlanmaz)', () => {
      const est = new FaceShapeEstimator();
      feed(est, 40, (i) => oval(0.005, i));
      feed(est, 3, (i) => oval(0.1, i));
      feed(est, 5, (i) => oval(0.1, i), { yaw: 30, pitch: 0, roll: 0 });
      expect(est.mouthOpen).toBe(true);
      expect(feed(est, 3, (i) => oval(0.005, i)).status).toBe('ready');
    });

    it('yüz kaybolup sıfırlanınca ağız durumu da sıfırlanır', () => {
      const est = new FaceShapeEstimator();
      feed(est, 3, (i) => oval(0.1, i));
      for (let i = 0; i < ESTIMATOR_DEFAULTS.resetAfterMissing; i++) est.update(null, null, W, H);
      expect(est.mouthOpen).toBe(false);
      expect(est.state.mouth).toBeNull();
    });
  });

  it('yüz çok küçükse (uzaktaysa) örnek almaz', () => {
    const est = new FaceShapeEstimator();
    expect(feed(est, 40, () => shapeFace(SHAPES.oval.proto, { cheekPx: 80 })).status).toBe('too-far');
  });

  it('yüz kadrajdan taşıyorsa örnek almaz', () => {
    const est = new FaceShapeEstimator();
    expect(feed(est, 40, () => shapeFace(SHAPES.oval.proto, { cx: 1200 })).status).toBe('out-of-frame');
  });

  it('alın saçla kapalıysa (ten oranı düşük) tahmini zorlamaz', () => {
    const est = new FaceShapeEstimator();
    est.setForeheadCoverage(0.3);
    const s = feed(est, 60, () => shapeFace(SHAPES.heart.proto));
    expect(s.status).toBe('forehead');
    expect(s.result).toBeNull();
  });

  it('alın görünürse (ten oranı yüksek) normal çalışır', () => {
    const est = new FaceShapeEstimator();
    est.setForeheadCoverage(0.95);
    expect(feed(est, 60, () => shapeFace(SHAPES.heart.proto)).status).toBe('ready');
  });

  it('beklenmeyen oranlar (bozuk noktalar) güvenilmez sayılır', () => {
    const est = new FaceShapeEstimator();
    const s = feed(est, 40, () => shapeFace({ ...SHAPES.oval.proto, J: 0.4 }));
    expect(s.status).toBe('implausible');
  });

  it('ölçümler kareden kareye çok oynuyorsa kararsız der ve tahmin vermez', () => {
    const est = new FaceShapeEstimator();
    const s = feed(est, 60, (i) => shapeFace(i % 2 ? SHAPES.round.proto : SHAPES.oblong.proto));
    expect(s.status).toBe('unstable');
    expect(s.result).toBeNull();
    expect(s.unstableKeys).toContain('L');
  });

  it('medyan sayesinde ara sıra gelen aykırı kareler sonucu değiştirmez', () => {
    const est = new FaceShapeEstimator();
    const s = feed(est, 60, (i) => shapeFace(i % 10 === 0 ? SHAPES.oblong.proto : SHAPES.round.proto));
    expect(s.status).toBe('ready');
    expect(s.result.classification.shape).toBe('round');
  });

  it('geçici sorunda son tahmini "last" olarak saklar, uzun süre yüz yoksa sıfırlar', () => {
    const est = new FaceShapeEstimator();
    feed(est, 40, () => shapeFace(SHAPES.oval.proto));
    let s = est.update(shapeFace(SHAPES.oval.proto), { yaw: 30, pitch: 0, roll: 0 }, W, H);
    expect(s.result).toBeNull();
    expect(s.last.classification.shape).toBe('oval');
    for (let i = 0; i < ESTIMATOR_DEFAULTS.resetAfterMissing; i++) s = est.update(null, null, W, H);
    expect(s.last).toBeNull();
    expect(est.samples).toHaveLength(0);
  });
});
