// Yüz şekli testleri için sentetik yüz: istenen oranlara (L, F, J, C, A) sahip nokta seti.
//
// Yalnızca ölçümde kullanılan noktalar yerleştirilir; diğerleri syntheticFace() elipsinden
// gelir. Derinlik (z) kanonik MediaPipe yüzünden oransal alınır, böylece baş döndürüldüğünde
// gerçekçi izdüşüm oluşur. Bu yüzler algoritmanın İÇ TUTARLILIĞINI test eder; gerçek
// yüzlerde sınıflandırma doğruluğunu kanıtlamaz.

import { Euler, Vector3 } from 'three';
import { gaussian } from './filterSim.js';
import { syntheticFace } from './helpers.js';

export const W = 1280;
export const H = 720;

// Kanonik yüzde (cm) z değerleri / elmacık genişliği (15.33 cm)
const Z = { cheek: -2.44, jaw: -0.63, chin: 2.8, chinTip: 4.26, top: 4.48, forehead: 1.43, mouth: 4.0 };
const CANON_CHEEK_CM = 15.33;

/** b köşesindeki açı (derece) — 2D. */
function angleAt(a, b, c) {
  const u = [a[0] - b[0], a[1] - b[1]];
  const v = [c[0] - b[0], c[1] - b[1]];
  return (Math.acos((u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v))) * 180) / Math.PI;
}

/**
 * @param ratios  { L, F, J, C, A }
 * @param opts    cheekPx: elmacık genişliği (px); yaw/pitch/roll (derece) baş dönmesi;
 *                mouth: iç dudak aralığı / elmacık genişliği (0.005 ≈ kapalı ağız). Ağız açılınca
 *                gerçek yüzdeki gibi çene aşağı iner: çene ucu noktaları aralık kadar, çene
 *                köşeleri %40'ı kadar. Ölçülen oranlar (L, A) bu yüzden bozulur.
 *                noise: piksel gürültüsü σ; seed
 */
export function shapeFace(ratios, { cheekPx = 320, cx = 640, cy = 380, yaw = 0, pitch = 0, roll = 0, mouth = 0.005, noise = 0, seed = 1 } = {}) {
  const w = cheekPx / 2;
  const z = (cm) => (cm / CANON_CHEEK_CM) * cheekPx;
  const length = ratios.L * cheekPx;
  const yTop = -0.47 * length; // 10 numaralı nokta (y aşağı +)
  const yChin = yTop + length;
  const jawX = ratios.J * w;

  // Çene köşesinin y'si: 234–172–152 açısı hedef A olacak şekilde ikiye bölme ile bulunur
  let lo = 0;
  let hi = yChin - 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const a = angleAt([-w, 0], [-jawX, mid], [0, yChin]);
    // köşe aşağı indikçe açı büyür
    if (a < ratios.A) lo = mid;
    else hi = mid;
  }
  const yJaw = (lo + hi) / 2;

  const pts = {
    234: [-w, 0, z(Z.cheek)],
    454: [w, 0, z(Z.cheek)],
    172: [-jawX, yJaw, z(Z.jaw)],
    397: [jawX, yJaw, z(Z.jaw)],
    149: [-ratios.C * w, yChin - 0.06 * length, z(Z.chin)],
    378: [ratios.C * w, yChin - 0.06 * length, z(Z.chin)],
    152: [0, yChin, z(Z.chinTip)],
    10: [0, yTop, z(Z.top)],
    54: [-ratios.F * w, yTop + 0.1 * length, z(Z.forehead)],
    284: [ratios.F * w, yTop + 0.1 * length, z(Z.forehead)],
  };
  // İç dudaklar: üst 82–13–312, alt 87–14–317 (kapalı ağızda üst üste)
  const yLip = yTop + 0.72 * length;
  const gap = mouth * cheekPx;
  for (const [up, down, x] of [[82, 87, -0.12], [13, 14, 0], [312, 317, 0.12]]) {
    pts[up] = [x * cheekPx, yLip, z(Z.mouth)];
    pts[down] = [x * cheekPx, yLip + gap, z(Z.mouth)];
  }
  // Çene iner (gap 0.005 kapalı ağız referansı; ondan fazlası çeneyi indirir)
  const drop = Math.max(0, gap - 0.005 * cheekPx);
  for (const i of [152, 149, 378]) pts[i][1] += drop;
  for (const i of [172, 397]) pts[i][1] += 0.4 * drop;
  // Elmacık–çene ucu genişlikleri 3D ölçüldüğü için z farkı genişliğe eklenmesin:
  // simetrik nokta çiftlerinin z'si eşit, dolayısıyla 3D mesafe = x farkı.

  const rot = new Euler((-pitch * Math.PI) / 180, (yaw * Math.PI) / 180, (roll * Math.PI) / 180, 'YXZ');
  const rand = gaussian(seed);
  const face = syntheticFace();
  for (const [i, [x, y, zz]] of Object.entries(pts)) {
    // Görüntü (y aşağı, z uzağa) → dünya (y yukarı, z kameraya), döndür, geri çevir
    const v = new Vector3(x, -y, -zz).applyEuler(rot);
    face[i] = {
      x: (cx + v.x + noise * rand()) / W,
      y: (cy - v.y + noise * rand()) / H,
      z: -v.z / W,
    };
  }
  return face;
}
