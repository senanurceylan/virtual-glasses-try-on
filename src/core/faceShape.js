// Yüz şekli analizi: 478 noktadan geometrik ölçümler ve açıklanabilir sınıflandırma.
//
// 1) Ölçümler (bir karede)
//    Genişlikler ve uzunluk 3D (x, y piksel; z·genişlik) mesafedir: kafanın küçük
//    dönmelerinde 2D izdüşüm kadar değişmez. Çene köşesi açısı ön görünüşte (2D) ölçülür.
//      alın genişliği     : 54  ↔ 284  (alnın iki yanı, kaş üstü)
//      elmacık genişliği  : 234 ↔ 454  (yüzün en geniş yeri, normalizasyon birimi)
//      çene genişliği     : 172 ↔ 397  (çene köşeleri / gonion)
//      çene ucu genişliği : 149 ↔ 378  (çene ucunun iki yanı)
//      yüz uzunluğu       : 10  ↔ 152  (yüz ağının üst sınırı → çene ucu)
//      çene köşesi açısı  : 234 – 172 – 152 (köşede ölçülen açı; küçük = köşeli)
//      ağız açıklığı      : iç dudak çiftleri 13↔14, 82↔87, 312↔317 (orta, sağ, sol)
//                           ortalaması / elmacık genişliği. Yüz uzunluğuna bölünmez:
//                           ağız açılınca çene iner ve uzunluk da büyür, oran olduğundan
//                           küçük çıkar. Elmacık genişliği çene hareketinden etkilenmez.
//
// 2) Normalizasyon: her genişlik ve uzunluk elmacık genişliğine bölünür. Böylece
//    kameraya uzaklık ve görüntü çözünürlüğü sonucu etkilemez (ölçekten bağımsız oranlar).
//
// 3) Sınıflandırma: her yüz şekli bir "prototip" oran vektörüyle tanımlanır.
//    Uzaklık d² = Σ ((oran − prototip) / σ)², benzerlik = exp(−d²/2),
//    olasılık = benzerlik / Σ benzerlik. En yakın prototip tahmindir; olasılık ve
//    ikinci şekle göre fark güveni verir.
//
// Referans: MediaPipe'ın kanonik yüz modeli (model dosyasındaki ortalama yüz ağı) bu
// noktalarla L = 1.153, F = 0.819, J = 0.775, C = 0.419, A = 132.2° verir. Prototipler bu
// ortalamaya göre literatürdeki tanımlara uygun yönde kaydırılarak belirlendi:
//   uzun → L büyük; yuvarlak → L küçük, açı geniş; kare → çene geniş, açı dar;
//   kalp → alın geniş, çene dar; elmas → alın ve çene dar (elmacık baskın).
// Bu eşikler gerçek yüz verisiyle kalibre EDİLMEMİŞTİR; sonuç yaklaşık bir tahmindir.

export const SHAPE_LANDMARKS = {
  forehead: [54, 284],
  cheekbone: [234, 454],
  jaw: [172, 397],
  chin: [149, 378],
  length: [10, 152],
  jawAngle: [234, 172, 152],
  mouth: [
    [13, 14],
    [82, 87],
    [312, 317],
  ],
};

/** Kanonik (ortalama) yüzün oranları; açıklamalarda "ortalama" olarak kullanılır. */
export const CANONICAL = { L: 1.153, F: 0.819, J: 0.775, C: 0.419, A: 132.2 };

export const FEATURES = {
  L: { label: 'Yüz uzunluğu / elmacık genişliği', sigma: 0.05, digits: 2 },
  F: { label: 'Alın / elmacık genişliği', sigma: 0.03, digits: 2 },
  J: { label: 'Çene / elmacık genişliği', sigma: 0.03, digits: 2 },
  C: { label: 'Çene ucu / elmacık genişliği', sigma: 0.03, digits: 2 },
  A: { label: 'Çene köşesi açısı', sigma: 5, digits: 0, unit: '°' },
};

export const SHAPES = {
  oval: { name: 'Oval', proto: { L: 1.2, F: 0.82, J: 0.76, C: 0.41, A: 134 } },
  round: { name: 'Yuvarlak', proto: { L: 1.05, F: 0.81, J: 0.8, C: 0.43, A: 140 } },
  square: { name: 'Kare', proto: { L: 1.07, F: 0.84, J: 0.85, C: 0.47, A: 127 } },
  heart: { name: 'Kalp', proto: { L: 1.15, F: 0.87, J: 0.72, C: 0.37, A: 133 } },
  oblong: { name: 'Uzun', proto: { L: 1.32, F: 0.81, J: 0.78, C: 0.42, A: 132 } },
  diamond: { name: 'Elmas', proto: { L: 1.17, F: 0.75, J: 0.71, C: 0.38, A: 136 } },
};

/** Normalize nokta → piksel uzayında 3D nokta (z, x ile aynı ölçekte: z·genişlik). */
function point(face, i, width, height) {
  const p = face[i];
  return { x: p.x * width, y: p.y * height, z: p.z * width };
}

const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** b köşesindeki a–b–c açısı (derece, 2D görüntü düzleminde). */
function angle2D(a, b, c) {
  const ux = a.x - b.x;
  const uy = a.y - b.y;
  const vx = c.x - b.x;
  const vy = c.y - b.y;
  const cos = (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy));
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

/**
 * Bir karenin ham ölçümleri (piksel) ve normalize oranları.
 * Çene köşesi açısı iki yanın ortalamasıdır (yaw'a karşı daha dengeli).
 */
export function measureFace(face, width, height) {
  const P = (i) => point(face, i, width, height);
  const d = ([a, b]) => dist3(P(a), P(b));
  const L = SHAPE_LANDMARKS;

  const cheekbone = d(L.cheekbone);
  const widths = {
    forehead: d(L.forehead),
    cheekbone,
    jaw: d(L.jaw),
    chin: d(L.chin),
    length: d(L.length),
  };
  const angleRight = angle2D(P(234), P(172), P(152));
  const angleLeft = angle2D(P(454), P(397), P(152));

  return {
    px: widths,
    ratios: {
      L: widths.length / cheekbone,
      F: widths.forehead / cheekbone,
      J: widths.jaw / cheekbone,
      C: widths.chin / cheekbone,
      A: (angleRight + angleLeft) / 2,
    },
    mouthOpen: L.mouth.reduce((sum, pair) => sum + d(pair), 0) / L.mouth.length / cheekbone,
    angleAsymmetry: Math.abs(angleRight - angleLeft),
  };
}

/**
 * Oranlardan yüz şekli olasılıkları.
 * @returns {{ shape, name, probability, margin, ranking: {shape,name,probability,distance}[] }}
 */
export function classifyFaceShape(ratios) {
  const ranking = Object.entries(SHAPES).map(([shape, { name, proto }]) => {
    const d2 = Object.keys(FEATURES).reduce((s, k) => s + ((ratios[k] - proto[k]) / FEATURES[k].sigma) ** 2, 0);
    return { shape, name, distance: Math.sqrt(d2), likelihood: Math.exp(-d2 / 2) };
  });
  // Tüm benzerlikler çok küçükse (sayısal taşma) uzaklıkla normalize et.
  const minD = Math.min(...ranking.map((r) => r.distance));
  const weights = ranking.map((r) => Math.exp(-(r.distance ** 2 - minD ** 2) / 2));
  const total = weights.reduce((s, w) => s + w, 0);
  ranking.forEach((r, i) => {
    r.probability = weights[i] / total;
    delete r.likelihood;
  });
  ranking.sort((a, b) => b.probability - a.probability);
  const [top, second] = ranking;
  return {
    shape: top.shape,
    name: top.name,
    probability: top.probability,
    margin: top.probability - second.probability,
    distance: top.distance,
    ranking,
  };
}

/** Bir oranın ortalamaya göre düzeyi: −1 düşük, 0 ortalama, +1 yüksek (±1σ eşik). */
export function featureLevel(key, value) {
  const z = (value - CANONICAL[key]) / FEATURES[key].sigma;
  return z > 1 ? 1 : z < -1 ? -1 : 0;
}

const LEVEL_TEXT = {
  L: ['kısa', 'ortalama', 'uzun'],
  F: ['dar', 'ortalama', 'geniş'],
  J: ['dar', 'ortalama', 'geniş'],
  C: ['sivri', 'ortalama', 'geniş'],
  A: ['köşeli', 'ortalama', 'yumuşak'],
};

/** Tahmini açıklayan satırlar: her oran, ortalama değer ve yorum. */
export function explainRatios(ratios) {
  return Object.entries(FEATURES).map(([key, f]) => {
    const level = featureLevel(key, ratios[key]);
    return {
      key,
      label: f.label,
      value: ratios[key],
      average: CANONICAL[key],
      digits: f.digits,
      unit: f.unit ?? '',
      level,
      text: LEVEL_TEXT[key][level + 1],
    };
  });
}
