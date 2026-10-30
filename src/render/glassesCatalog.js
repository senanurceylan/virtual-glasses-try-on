// Gözlük modelleri. Her model için:
//   src      : şeffaf arka planlı PNG (public/ altında)
//   anchors  : görseldeki göz bebeği noktaları (piksel). Yerleştirme bu iki noktayı
//              kullanıcının göz merkezlerine oturtur.
//              right = görselin solundaki cam (kişinin sağ gözü).
//   style    : parametrik çerçeve tanımı (3D model ve öneri nitelikleri)
// PNG'ler assets/glasses/*.svg kaynaklarından `npm run glasses` ile üretilir; SVG'ler ve
// 3D modeller aynı parametrik tanımdan (core/frameStyles.js) gelir. Bu yüzden her model
// hem 2D hem 3D modda denenebilir.

import { FRAME_STYLES } from '../core/frameStyles.js';

const ANCHORS = { right: { x: 330, y: 200 }, left: { x: 870, y: 200 } };

export const GLASSES = FRAME_STYLES.map((style) => ({
  id: style.id,
  name: style.name,
  description: style.description,
  src: `/glasses/${style.id}.png`,
  anchors: ANCHORS,
  style,
  modes: ['2d', '3d'],
}));

/** Görseli yükler; yüklenince HTMLImageElement döner. */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Görsel yüklenemedi: ${src}`));
    img.src = src;
  });
}
