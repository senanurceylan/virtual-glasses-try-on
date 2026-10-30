// Bir karenin yerleştirme hesabı (React'ten bağımsız, test edilebilir):
//
//   landmark + matris → ham ölçüm (göz merkezleri, mesafe, açı, dönme)
//                     → stabilizatör (One Euro) → filtrelenmiş ölçüm
//                     → 2D afin matris ve 3D poz (ikisi de filtrelenmiş ölçümden)
//
// 2D ve 3D aynı filtrelenmiş durumdan beslendiği için modlar arasında
// geçiş filtreyi sıfırlamaz ve sıçrama oluşturmaz.

import { Quaternion } from 'three';
import { eyeCenters, eyeMetrics, glassesTransform } from './eyeGeometry.js';
import { matrixFromMediaPipe, poseFromMetrics, rotationFromMatrix } from './headPose.js';

/**
 * @param {object}  p
 * @param p.face        478 normalize nokta ya da null
 * @param p.matrix      MediaPipe dönüşüm matrisi (16) ya da null
 * @param p.anchors     2D gözlük görselindeki göz noktaları (yoksa 2D matris hesaplanmaz)
 * @param p.stabilizer  PlacementStabilizer ya da null
 * @param p.timeSec     kare zamanı (saniye)
 * @returns null (yüz yok) ya da { raw, metrics, pose, transform, width, height, stabilized }
 */
export function computePlacement({ face, matrix, width, height, anchors, stabilizer, timeSec }) {
  if (!face) {
    stabilizer?.reset(); // yüz kayboldu: yeniden görününce eski konumdan kayma olmasın
    return null;
  }

  const rawMetrics = eyeMetrics(eyeCenters(face, width, height));
  const rawQuaternion = matrix ? rotationFromMatrix(matrixFromMediaPipe(matrix)) : null;

  const filtered = stabilizer
    ? stabilizer.update(rawMetrics, rawQuaternion?.toArray() ?? null, timeSec)
    : { metrics: rawMetrics, quaternion: rawQuaternion?.toArray() ?? null };

  const metrics = filtered.metrics;
  const quaternion = filtered.quaternion ? new Quaternion().fromArray(filtered.quaternion) : null;

  return {
    raw: {
      metrics: rawMetrics,
      pose: rawQuaternion ? poseFromMetrics(rawMetrics, rawQuaternion) : null,
    },
    metrics,
    pose: quaternion ? poseFromMetrics(metrics, quaternion) : null,
    transform: anchors ? glassesTransform(metrics, anchors) : null,
    width,
    height,
    stabilized: Boolean(stabilizer?.enabled),
  };
}
