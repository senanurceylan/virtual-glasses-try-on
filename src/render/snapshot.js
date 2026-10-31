// Ekran görüntüsü: kamera karesi ve gözlük katmanlarını tek bir PNG'de birleştirir.
//
// Tamamen tarayıcıda çalışır; görüntü hiçbir sunucuya gönderilmez. Kullanıcı
// "İndir"e basınca yalnızca kendi bilgisayarına kaydedilir.
//
// Katmanlar ham (aynalanmamış) video koordinatlarındadır ve ekranda CSS ile
// birlikte aynalanır. Ekranda görülenle aynı sonuç için hepsi aynı yatay
// çevirme dönüşümüyle çizilir; sıra ekrandaki sırayla aynıdır:
//   video → 2D gözlük canvas'ı → 3D (WebGL) canvas'ı → (isteğe bağlı) nokta/geometri katmanı
//
// WebGL canvas'ı varsayılan ayarla (preserveDrawingBuffer: false) çizimden sonraki
// görev bitince temizlenebilir. Bu yüzden birleştirme kare döngüsünde, 3D çizimin
// hemen ardından aynı görevde yapılır (bkz. useFaceTracking).

/**
 * @param ctx     hedef 2D bağlam (boyutu width × height)
 * @param layers  çizilecek kaynaklar (video/canvas), alttan üste; null olanlar atlanır
 * @param opts.mirror  ekrandaki gibi aynala (varsayılan true)
 */
export function composeSnapshot(ctx, layers, width, height, { mirror = true } = {}) {
  ctx.save();
  if (mirror) ctx.setTransform(-1, 0, 0, 1, width, 0);
  for (const layer of layers) {
    if (layer) ctx.drawImage(layer, 0, 0, width, height);
  }
  ctx.restore();
}

/** Ekran görüntüsünde hangi katmanlar yer alır (moda göre). */
export function snapshotLayers({ video, glassesCanvas, threeCanvas, overlayCanvas }, { mode, showGlasses, includeOverlay }) {
  return [
    video,
    showGlasses && mode === '2d' ? glassesCanvas : null,
    showGlasses && mode === '3d' ? threeCanvas : null,
    includeOverlay ? overlayCanvas : null,
  ];
}

const TR = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'c', Ğ: 'g', İ: 'i', Ö: 'o', Ş: 's', Ü: 'u' };

/** Dosya adı: sanal-gozluk_<model>_<YYYYMMDD-HHMMSS>.png (Türkçe karakterler sadeleştirilir). */
export function snapshotFileName(modelName, date = new Date()) {
  const slug = modelName
    .replace(/[çğıöşüÇĞİÖŞÜ]/g, (c) => TR[c])
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const p = (n) => String(n).padStart(2, '0');
  const stamp = `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
  return `sanal-gozluk_${slug || 'gozluk'}_${stamp}.png`;
}

/** Katmanları yeni bir canvas'ta birleştirip PNG Blob döndürür (tarayıcı). */
export function captureToBlob(layers, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  composeSnapshot(canvas.getContext('2d'), layers, width, height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Görüntü oluşturulamadı.'))), 'image/png'),
  );
}
