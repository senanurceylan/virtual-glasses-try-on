// Gözlük öneri puanı: yüz oranları × çerçeve nitelikleri.
//
// Optik mağazalarında yaygın olan "denge ve karşıtlık" ilkesi sayısal kurallara çevrildi.
// Yüz şekli etiketine değil, doğrudan ölçülen oranlara dayanır; böylece iki şekil
// arasında kalan yüzler de tutarlı puan alır.
//
// Yüz tanımlayıcıları (kanonik ortalama yüze göre, ±2 ile sınırlı):
//   uzunluk   = (L − 1.153) / 0.08              + uzun yüz,  − kısa yüz
//   köşelilik = (132.2 − A) / 6                 + köşeli çene, − yumuşak/yuvarlak hatlar
//   üst ağırlık = ((F − J) − 0.044) / 0.06       + alın çeneden geniş (kalp), − çene baskın
//   elmacık   = (0.797 − (F + J)/2) / 0.035      + elmacık baskın (elmas)
//
// Çerçeve nitelikleri (frameStyles.js): köşelilik, derinlik (yükseklik/genişlik),
// üst ağırlık (kalın üst kenar, cat-eye), alt ağırlık (aviator damlası).
//
// Kurallar (her biri −2…+2 arası katkı; puan = 50 + 18 · Σ ağırlık·katkı, 0–100):
//   karşıtlık : köşeli yüz → yuvarlak çerçeve, yuvarlak yüz → köşeli çerçeve
//   uzunluk   : uzun yüz → derin cam (yüzü kısa gösterir), kısa yüz → sığ, geniş cam
//   denge     : alnı geniş yüz → altı ağır çerçeve; çenesi baskın yüz → üstü ağır çerçeve
//   elmacık   : elmacık baskın yüz → üst kenarı vurgulu ve yumuşak hatlı çerçeve
// Bunlar estetik eğilimlerdir, kesin kurallar değildir.

import { lensDepth } from './frameStyles.js';

const clamp = (v, lo = -2, hi = 2) => Math.max(lo, Math.min(hi, v));

export function faceDescriptors(r) {
  return {
    length: clamp((r.L - 1.153) / 0.08),
    angularity: clamp((132.2 - r.A) / 6),
    topHeavy: clamp((r.F - r.J - 0.044) / 0.06),
    cheek: clamp((0.797 - (r.F + r.J) / 2) / 0.035),
  };
}

const RULES = [
  {
    key: 'contrast',
    weight: 1.3,
    term: (f, t) => -f.angularity * (t.angularity - 0.5) * 2,
    why: (f) =>
      f.angularity > 0
        ? ['yumuşak hatları köşeli çene çizgisini dengeler', 'köşeli hatları zaten köşeli olan çene çizgisini sertleştirebilir']
        : ['köşeli hatları yumuşak/yuvarlak yüz hatlarına tanım katar', 'yuvarlak hatları yüzün yuvarlaklığını artırabilir'],
  },
  {
    key: 'length',
    weight: 0.8,
    term: (f, t) => f.length * ((t.depth - 0.78) / 0.17),
    why: (f) =>
      f.length > 0
        ? ['derin camları uzun yüzü dikeyde kısaltıp dengeler', 'sığ camları yüzü daha da uzun gösterebilir']
        : ['geniş ve sığ camları kısa yüzü daha uzun gösterir', 'derin camları kısa yüzü daha da kısa gösterebilir'],
  },
  {
    key: 'balance',
    weight: 0.8,
    term: (f, t) => f.topHeavy * (t.bottomWeight - t.topWeight),
    why: (f) =>
      f.topHeavy > 0
        ? ['alt kısmı ağır yapısı geniş alın ile dar çeneyi dengeler', 'üst kenar vurgusu geniş alnı daha belirgin yapabilir']
        : ['üst kenar vurgusu yüzün üst kısmını genişletip baskın çeneyi dengeler', 'alt kısmı ağır yapısı baskın çeneye dikkat çekebilir'],
  },
  {
    key: 'cheek',
    weight: 0.6,
    term: (f, t) => f.cheek * (0.7 * t.topWeight + 0.3 * (1 - t.angularity) - 0.35) * 2,
    why: () => [
      'vurgulu üst kenarı ve yumuşak hatları dar alın ile çeneyi elmacıklarla dengeler',
      'elmacık kemiklerini daha da baskın gösterebilir',
    ],
  },
];

/** Bir çerçevenin puanı ve kural katkıları. */
export function scoreFrame(descriptors, style) {
  const traits = { ...style.traits, depth: lensDepth(style) };
  const contributions = RULES.map((rule) => {
    const value = rule.weight * rule.term(descriptors, traits);
    const [pro, con] = rule.why(descriptors);
    return { key: rule.key, value, text: value >= 0 ? pro : con };
  });
  const total = contributions.reduce((s, c) => s + c.value, 0);
  return { score: Math.round(Math.max(0, Math.min(100, 50 + 18 * total))), contributions };
}

/**
 * Yüz oranlarına göre çerçeveleri puanlar ve sıralar.
 * @returns {{ id, name, score, reasons: string[], cautions: string[] }[]} yüksekten düşüğe
 */
export function recommendFrames(ratios, styles, limit = 3) {
  const descriptors = faceDescriptors(ratios);
  return styles
    .map((style) => {
      const { score, contributions } = scoreFrame(descriptors, style);
      const significant = contributions.filter((c) => Math.abs(c.value) >= 0.2).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
      const reasons = significant.filter((c) => c.value > 0).map((c) => `${style.name} çerçevenin ${c.text}.`);
      const cautions = significant.filter((c) => c.value < 0).map((c) => `${style.name} çerçevenin ${c.text}.`);
      if (!reasons.length) reasons.push('Yüz oranlarınız dengeli; bu çerçeve belirgin bir etki yaratmadan nötr bir seçim.');
      return { id: style.id, name: style.name, score, reasons, cautions, contributions };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
