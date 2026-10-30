// Çerçeve modelleri: tek bir parametrik tanımdan hem 2D PNG (scripts/build-glasses.mjs)
// hem 3D model (render/three/glassesModel3D.js) üretilir. Böylece önerilen her model
// iki modda da denenebilir ve iki görünüm aynı ölçülere sahiptir.
//
// Birim: santimetre. Eksenler 3D modelle aynı: x → kişinin soluna, y → yukarı.
// Cam hattı "dış taraf = +x" olacak şekilde tanımlanır; kişinin sağ camı (−x tarafı)
// için aynalanır (cat-eye gibi simetrik olmayan şekiller için gerekli).
//
// Cam hattı = süperelips |x/a|^p + |y/b|^p = 1 ve üç değiştirici:
//   p          : 2 → elips (yuvarlak), büyüdükçe köşeli (kare/dikdörtgen)
//   topFlare   : üst kenar daha geniş (+) ya da alt kenar daha geniş (−, aviator damla)
//   bottomDrop : alt yarıyı aşağı uzatır (aviator)
//   teardrop   : alt yarıyı dışa kaydırır → buruna doğru daralan damla (aviator)
//   catLift    : dış üst köşeyi yukarı kaldırır (cat-eye)
//
// Öneri için kullanılan nitelikler (0–1):
//   angularity : köşelilik (p'den), depth : cam yüksekliği / genişliği,
//   topWeight  : görsel ağırlığın üstte olması, bottomWeight : altta olması

export const FRAME_STYLES = [
  {
    id: 'classic-black',
    name: 'Wayfarer',
    description: 'Siyah asetat, üst kenarı belirgin klasik çerçeve',
    lens: { width: 5.2, height: 4.0, p: 2.8, topFlare: 0.07, bottomDrop: 0, catLift: 0 },
    bridge: 1.8,
    rim: { width: 0.32, depth: 0.45, material: 'acetate', color: '#111113' },
    traits: { angularity: 0.7, topWeight: 0.5, bottomWeight: 0 },
    handDrawnSvg: true, // assets/glasses/classic-black.svg elle çizildi
  },
  {
    id: 'round-gold',
    name: 'Yuvarlak',
    description: 'İnce altın metal, tam yuvarlak camlar',
    lens: { width: 5.0, height: 4.8, p: 2.0, topFlare: 0, bottomDrop: 0, catLift: 0 },
    bridge: 1.9,
    rim: { width: 0.12, depth: 0.16, material: 'metal', color: '#c9a45c' },
    traits: { angularity: 0, topWeight: 0, bottomWeight: 0 },
  },
  {
    id: 'square-tortoise',
    name: 'Kare',
    description: 'Kalın kahverengi asetat, köşeli kare camlar',
    lens: { width: 5.0, height: 4.5, p: 4.5, topFlare: 0.02, bottomDrop: 0, catLift: 0 },
    bridge: 1.9,
    rim: { width: 0.34, depth: 0.45, material: 'acetate', color: '#4a2b17' },
    traits: { angularity: 1, topWeight: 0.15, bottomWeight: 0 },
  },
  {
    id: 'rectangle-navy',
    name: 'Dikdörtgen',
    description: 'İnce lacivert asetat, yatay dar camlar',
    lens: { width: 5.4, height: 3.3, p: 5.0, topFlare: 0, bottomDrop: 0, catLift: 0 },
    bridge: 1.7,
    rim: { width: 0.24, depth: 0.38, material: 'acetate', color: '#1d2a44' },
    traits: { angularity: 0.95, topWeight: 0, bottomWeight: 0 },
  },
  {
    id: 'aviator-silver',
    name: 'Aviator',
    description: 'Gümüş metal, aşağı doğru genişleyen damla camlar',
    lens: { width: 5.2, height: 4.6, p: 2.6, topFlare: -0.02, bottomDrop: 0.1, teardrop: 0.18, catLift: 0 },
    bridge: 1.5,
    rim: { width: 0.11, depth: 0.15, material: 'metal', color: '#b9bdc4' },
    traits: { angularity: 0.2, topWeight: 0, bottomWeight: 1 },
    doubleBridge: true,
  },
  {
    id: 'cat-eye-burgundy',
    name: 'Cat-eye',
    description: 'Bordo asetat, dış üst köşesi kalkık çerçeve',
    lens: { width: 5.4, height: 3.7, p: 2.8, topFlare: 0.12, bottomDrop: 0, catLift: 0.55 },
    bridge: 1.6,
    rim: { width: 0.3, depth: 0.42, material: 'acetate', color: '#5c1a2b' },
    traits: { angularity: 0.45, topWeight: 1, bottomWeight: 0 },
  },
];

export const DEFAULT_FRAME_ID = 'classic-black';

export function frameStyle(id) {
  return FRAME_STYLES.find((s) => s.id === id) ?? FRAME_STYLES[0];
}

/** Cam derinliği (yükseklik / genişlik): derin camlar yüzü kısaltır, sığ camlar uzatır. */
export const lensDepth = (style) => style.lens.height / style.lens.width;

/**
 * Cam hattı (dış taraf +x), saat yönü tersine, merkez (0, 0).
 * @returns {{x:number, y:number}[]}
 */
export function lensPoints(style, segments = 72) {
  const { width, height, p, topFlare = 0, bottomDrop = 0, teardrop = 0, catLift = 0 } = style.lens;
  const a = width / 2;
  const b = height / 2;
  const pts = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    let y = b * Math.sign(s) * Math.abs(s) ** (2 / p);
    let x = a * Math.sign(c) * Math.abs(c) ** (2 / p) * (1 + topFlare * (y / b));
    if (y < 0) {
      y *= 1 + bottomDrop;
      x += teardrop * a * (y / b) ** 2;
    }
    if (catLift && y > 0) y += catLift * b * Math.max(0, (x / a + 1) / 2) ** 2.5 * (y / b);
    pts.push({ x, y });
  }
  // Yükseklik tanımdaki değere eşit kalsın diye y'yi yeniden ölçekle (değiştiriciler uzatmış olabilir).
  const ys = pts.map((q) => q.y);
  const k = height / (Math.max(...ys) - Math.min(...ys));
  const mid = (Math.max(...ys) + Math.min(...ys)) / 2;
  return pts.map((q) => ({ x: q.x, y: (q.y - mid) * k }));
}

/**
 * Kişinin sağ (side = −1) ya da sol (side = +1) camının hattı, gözlük koordinatlarında.
 * Sağ cam aynalanır, sıralama ters çevrilerek saat yönü tersi korunur.
 */
export function placedLens(style, side, segments) {
  const centerX = (style.lens.width + style.bridge) / 2;
  const centerY = -0.2;
  const pts = lensPoints(style, segments).map((q) => ({ x: side * q.x + side * centerX, y: q.y + centerY }));
  return side < 0 ? pts.reverse() : pts;
}

/** Sol camın (side = +1) y yüksekliğindeki iç (burun tarafı) ve dış kenar x değerleri. */
export function lensEdgesAt(style, y) {
  const pts = placedLens(style, 1, 144);
  const xs = [];
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    if ((p.y - y) * (q.y - y) <= 0 && p.y !== q.y) xs.push(p.x + ((y - p.y) / (q.y - p.y)) * (q.x - p.x));
  });
  return { inner: Math.min(...xs), outer: Math.max(...xs) };
}

/** Cam merkezleri, menteşe ve köprü konumları (cm). Köprü ve menteşe çerçevenin kenarına oturur. */
export function frameLayout(style) {
  const centerX = (style.lens.width + style.bridge) / 2;
  const centerY = -0.2; // göz bebeği camın biraz üstünde
  const hingeY = centerY + style.lens.height * 0.3;
  const bridgeY = centerY + style.lens.height * 0.25;
  return { centerX, centerY, hingeY, bridgeY };
}

/** Köprü uçlarının x'i, menteşenin x'i ve toplam genişlik (çerçeve kenarları dahil). */
export function frameAttachments(style) {
  const { hingeY, bridgeY } = frameLayout(style);
  const pts = placedLens(style, 1, 144);
  const outerX = Math.max(...pts.map((p) => p.x)) + style.rim.width;
  return {
    bridgeX: lensEdgesAt(style, bridgeY).inner - style.rim.width * 0.3,
    hingeX: lensEdgesAt(style, hingeY).outer + style.rim.width * 0.3,
    outerX,
    totalWidth: 2 * outerX,
  };
}

/** Kapalı çokgeni dışa doğru `d` kadar kaydırır (saat yönü tersi çokgen; komşu kenar normali boyunca). */
export function offsetPoints(points, d) {
  const n = points.length;
  return points.map((p, i) => {
    const prev = points[(i - 1 + n) % n];
    const next = points[(i + 1) % n];
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const len = Math.hypot(tx, ty) || 1;
    return { x: p.x + (ty / len) * d, y: p.y - (tx / len) * d };
  });
}
