// Algoritma Modu: kamera üstünde gösterilen işlem adımlarının tanımları ve
// çizimden bağımsız (test edilebilir) yardımcı hesaplar.
//
// Bu modül YENİ bir algoritma içermez; mevcut hesapların (eyeGeometry, headPose,
// faceShape) çıktılarını görselleştirmek için gereken küçük dönüşümleri toplar:
//   • 478 noktanın yüz bölgelerine ayrılması (renklendirme için)
//   • kuaterniyondan kafa eksenlerinin ekran yönleri (3D eksen gizmosu)
//   • 2D afin matrisin bileşenlerine ayrılmış açıklaması

/** Ayrı ayrı açılıp kapatılabilen katmanlar (sıra = paneldeki sıra). */
export const ALGO_LAYERS = [
  { key: 'points', label: '478 yüz noktası (bölgelere göre renkli)' },
  { key: 'depth', label: 'Noktaları derinliğe (z) göre renklendir' },
  { key: 'mesh', label: 'Yüz ağı bağlantıları (tesselasyon)' },
  { key: 'critical', label: 'Gözlük için kritik noktalar (göz köşeleri)' },
  { key: 'geometry', label: '2D yerleştirme geometrisi (merkez, mesafe, açı, ölçek)' },
  { key: 'filter', label: 'Ham ↔ filtreli göz merkezleri (One Euro)' },
  { key: 'gizmo', label: '3D kafa pozu eksenleri (yaw, pitch, roll)' },
  { key: 'shape', label: 'Yüz şekli ölçü çizgileri' },
  { key: 'labels', label: 'Sayısal etiketler' },
];

export const DEFAULT_ALGO = {
  enabled: false,
  layers: {
    points: true,
    depth: false,
    mesh: false,
    critical: true,
    geometry: true,
    filter: true,
    gizmo: true,
    shape: false,
    labels: true,
  },
};

/**
 * Hazır katman seçimleri. "Yalnızca yüz noktaları", noktaların gerçek yüzle hizasını
 * diğer çizimler olmadan kontrol etmek içindir.
 */
export const LAYER_PRESETS = [
  { key: 'landmarks', label: 'Yalnızca yüz noktaları', layers: { ...Object.fromEntries(ALGO_LAYERS.map((l) => [l.key, false])), points: true } },
  { key: 'default', label: 'Varsayılan katmanlar', layers: DEFAULT_ALGO.layers },
];

/** Bölge kodları (çizimde renk tablosunun indisi). */
export const REGION = { other: 0, oval: 1, nose: 2, lips: 3, eyebrow: 4, eye: 5, iris: 6 };

export const REGION_INFO = [
  { key: 'other', label: 'Diğer yüz yüzeyi', color: 'rgba(200, 210, 225, 0.55)' },
  { key: 'oval', label: 'Yüz ovali', color: '#5b8cff' },
  { key: 'nose', label: 'Burun', color: '#ff9f43' },
  { key: 'lips', label: 'Dudaklar', color: '#ff6b9a' },
  { key: 'eyebrow', label: 'Kaşlar', color: '#c08bff' },
  { key: 'eye', label: 'Gözler', color: '#3ddc97' },
  { key: 'iris', label: 'İris', color: '#ffd666' },
];

// MediaPipe bu sürümde burun için bağlantı listesi vermiyor; burun sırtı, ucu ve
// kanatlarındaki noktalar kanonik yüz ağından seçildi (yaklaşık bölge).
export const NOSE_POINTS = [
  168, 6, 197, 195, 5, 4, 1, 19, 94, 2, 98, 97, 326, 327, 64, 294, 48, 278, 115, 344, 220, 440, 45, 275, 129, 358, 49,
  279, 102, 331, 3, 248, 51, 281, 236, 456, 198, 420, 131, 360,
];

/** Gözlük yerleştirmesinde kullanılan noktalar (eyeGeometry.EYE_LANDMARKS ile aynı). */
export const CRITICAL_POINTS = [33, 133, 362, 263];

/**
 * Her noktanın bölge kodu (Uint8Array, uzunluk = count).
 * Öncelik: iris > göz > kaş > dudak > burun > oval (bir nokta birden çok listede olabilir).
 * @param contours  FACE_CONTOURS ({ ad: [{start, end}] })
 */
export function landmarkRegions(contours, count = 478) {
  const codes = new Uint8Array(count);
  const mark = (indices, code) => {
    for (const i of indices) if (i < count && codes[i] < code) codes[i] = code;
  };
  const ends = (list = []) => list.flatMap(({ start, end }) => [start, end]);
  mark(ends(contours.oval), REGION.oval);
  mark(NOSE_POINTS, REGION.nose);
  mark(ends(contours.lips), REGION.lips);
  mark([...ends(contours.leftEyebrow), ...ends(contours.rightEyebrow)], REGION.eyebrow);
  mark([...ends(contours.leftEye), ...ends(contours.rightEye)], REGION.eye);
  mark([...ends(contours.leftIris), ...ends(contours.rightIris)], REGION.iris);
  // MediaPipe'ın iris bağlantıları merkez noktayı (468, 473) içermez; 468+ hepsi iristir.
  for (let i = 468; i < count; i++) codes[i] = REGION.iris;
  return codes;
}

/** Bölge başına nokta sayısı (panel açıklaması için). */
export function regionCounts(codes) {
  const counts = REGION_INFO.map(() => 0);
  for (const c of codes) counts[c]++;
  return Object.fromEntries(REGION_INFO.map((r, i) => [r.key, counts[i]]));
}

/**
 * Kuaterniyonun döndürdüğü kafa eksenleri, VİDEO PİKSELİ yönünde (y aşağı).
 * Dünya: x sağ, y yukarı, z kameraya doğru → piksel: (x, −y); z derinlik olarak döner
 * (z > 0 eksen kameraya doğru, önde çizilmeli).
 * @param q {x, y, z, w} birim kuaterniyon (THREE.Quaternion da olur)
 */
export function poseAxes(q) {
  const { x, y, z, w } = q;
  // Dönme matrisinin sütunları = döndürülmüş birim eksenler
  const X = { x: 1 - 2 * (y * y + z * z), y: 2 * (x * y + w * z), z: 2 * (x * z - w * y) };
  const Y = { x: 2 * (x * y - w * z), y: 1 - 2 * (x * x + z * z), z: 2 * (y * z + w * x) };
  const Z = { x: 2 * (x * z + w * y), y: 2 * (y * z - w * x), z: 1 - 2 * (x * x + y * y) };
  const toPixel = (v) => ({ dx: v.x, dy: -v.y, depth: v.z });
  return { x: toPixel(X), y: toPixel(Y), z: toPixel(Z) };
}

/**
 * 2D afin dönüşümün adımları (ekranda görüldüğü gibi açıklamak için).
 * glassesTransform(): görsel önce gözlük görselinin göz-orta noktası etrafında
 * θ kadar döndürülür, sx/sy kadar ölçeklenir ve yüzdeki göz merkezine ötelenir.
 * @returns null ya da { theta (°), scaleX, scaleY, translate: {x,y}, matrix: [a,b,c,d,e,f] }
 */
export function describeTransform(transform, metrics) {
  if (!transform || !metrics) return null;
  const { a, b, c, d, e, f } = transform;
  return {
    theta: (transform.angle * 180) / Math.PI,
    scaleX: transform.scaleX,
    scaleY: transform.scaleY,
    translate: { x: metrics.center.x, y: metrics.center.y },
    matrix: [a, b, c, d, e, f],
  };
}
