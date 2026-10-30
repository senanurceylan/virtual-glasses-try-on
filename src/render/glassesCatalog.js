// Gözlük modelleri. Her model için:
//   src      : şeffaf arka planlı PNG (public/ altında)
//   anchors  : görseldeki göz bebeği noktaları (piksel). Yerleştirme bu iki noktayı
//              kullanıcının göz merkezlerine oturtur.
//              right = görselin solundaki cam (kişinin sağ gözü).
// PNG'ler assets/glasses/*.svg kaynaklarından `npm run glasses` ile üretilir.

export const GLASSES = [
  {
    id: 'classic-black',
    name: 'Klasik Siyah',
    description: 'Wayfarer tarzı siyah asetat çerçeve (2D PNG ve 3D model)',
    src: '/glasses/classic-black.png',
    anchors: { right: { x: 330, y: 200 }, left: { x: 870, y: 200 } },
  },
];

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
