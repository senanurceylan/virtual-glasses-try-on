// 3D kafa pozu: MediaPipe dönüşüm matrisi + yüz noktalarından gözlük pozu.
//
// ─── Koordinat sistemleri ────────────────────────────────────────────────
// 1) Video pikseli (landmark):  x sağa, y aşağı, z kameradan uzağa.
//    MediaPipe z'si normalize ve göreli bir derinliktir; birimi milimetre DEĞİLDİR.
//    Belgelere göre x ile "yaklaşık aynı ölçekte" olduğundan z·genişlik ile
//    piksele çevrilir (bkz. landmarkUtils.toPixel). Mutlak derinlik değil,
//    yüzün kendi içindeki göreli derinliğidir.
//
// 2) Three.js dünyası (bu projede): x sağa, y yukarı, z kameraya doğru.
//    Piksel → dünya:  X = x,  Y = −y,  Z = −z
//    Ortografik kamera piksel ölçeğinde kurulur (bkz. GlassesScene); böylece
//    3D gözlük, 2D moddaki gibi doğrudan landmark pikselleriyle hizalanır.
//
// 3) MediaPipe metrik uzayı (dönüşüm matrisi): sağ el kuralı, x sağa, y yukarı,
//    z kameraya doğru (kamera −z yönüne bakar), birim santimetre. Eksen yönleri
//    (2) ile aynı olduğundan matrisin DÖNME kısmı doğrudan kullanılabilir.
//    Matrisin öteleme kısmı MediaPipe'ın varsaydığı sanal perspektif kameraya
//    (63° dikey görüş açısı) göredir; gerçek kameramızın açısı bilinmediği için
//    konum ve ölçek matristen değil, landmark noktalarından alınır.
//
// ─── Gözlük pozu ─────────────────────────────────────────────────────────
//   dönme    : matrisin dönme kısmı (kuaterniyon) → yaw, pitch, roll
//   konum    : iki göz merkezinin orta noktası (dünya koordinatında)
//   ölçek    : px/cm = gözler arası 3D piksel mesafesi / 6.3 cm
//              (3D model santimetre cinsinden; 6.3 cm ortalama göz bebeği mesafesi)
//
// Aynalama: Hesaplar ham video koordinatlarında yapılır; 3D canvas diğer
// katmanlarla aynı CSS aynası (scaleX(−1)) içinde olduğundan ayrıca çevrilmez.

import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { eyeCenters, eyeMetrics } from './eyeGeometry.js';

export const MODEL_IPD_CM = 6.3;

/** Piksel (x sağ, y aşağı, z uzak) → Three.js dünyası (x sağ, y yukarı, z yakın). */
export function pixelToWorld(p, target = new Vector3()) {
  return target.set(p.x, -p.y, -p.z);
}

/** MediaPipe'ın 16 elemanlı sütun öncelikli dizisinden Matrix4. */
export function matrixFromMediaPipe(data) {
  if (!data || data.length !== 16) throw new Error('Dönüşüm matrisi 16 elemanlı olmalı');
  return new Matrix4().fromArray(data);
}

/** Matristeki dönmeyi ayırır (öteleme ve olası ölçek atılır). */
export function rotationFromMatrix(matrix) {
  const position = new Vector3();
  const quaternion = new Quaternion();
  const scale = new Vector3();
  matrix.decompose(position, quaternion, scale);
  return quaternion;
}

/**
 * Kuaterniyondan yaw / pitch / roll (derece).
 * 'YXZ' sırası: önce yaw (y ekseni), sonra pitch (x), sonra roll (z).
 * İşaretler sağ el kuralından gelir (yüzün ileri yönü +z):
 *   yaw   > 0 : kişi kendi soluna döner (ham videoda yüz sağa döner)
 *   pitch > 0 : aşağı bakar
 *   roll  > 0 : başını kendi sağ omzuna yatırır (ham videoda saat yönü tersi)
 */
export function eulerAngles(quaternion) {
  const e = new Euler().setFromQuaternion(quaternion, 'YXZ');
  const deg = (r) => (r * 180) / Math.PI;
  return { yaw: deg(e.y), pitch: deg(e.x), roll: deg(e.z) };
}

/**
 * Bir karedeki 3D gözlük pozunu hesaplar.
 * @param face        478 normalize nokta
 * @param matrixData  MediaPipe dönüşüm matrisi (16 eleman)
 * @returns {{ position: Vector3, quaternion: Quaternion, pxPerCm: number,
 *             angles: {yaw,pitch,roll}, eyeRoll: number, metrics }}
 */
export function computeHeadPose(face, matrixData, width, height) {
  const metrics = eyeMetrics(eyeCenters(face, width, height));
  const quaternion = rotationFromMatrix(matrixFromMediaPipe(matrixData));
  return {
    position: pixelToWorld(metrics.center),
    quaternion,
    pxPerCm: metrics.distance3D / MODEL_IPD_CM,
    angles: eulerAngles(quaternion),
    // Doğrulama: göz çizgisinden ölçülen eğim. Dünya y'si yukarı olduğu için
    // piksel açısının işareti ters çevrilir; matristen gelen roll ile yakın olmalı.
    eyeRoll: -(metrics.angle * 180) / Math.PI,
    metrics,
  };
}
