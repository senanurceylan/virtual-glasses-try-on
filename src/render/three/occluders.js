// Occlusion (örtme) maskeleri.
//
// Fikir: Görünmez ama derinlik tamponuna (depth buffer) yazan bir yüzey çizilir.
// Renk yazılmadığı için ekranda görünmez; ancak arkasında kalan nesneler
// derinlik testinde elendiği için onlar da görünmez. Böylece gözlük sapı
// kafanın arkasına geçtiğinde "kafa tarafından örtülmüş" olur.
//
// İki maske birlikte kullanılır:
//   1) Yüz ağı maskesi: 478 noktadan her karede güncellenen gerçek yüz yüzeyi
//      (yanak, şakak, alın). Konumu doğrudan landmark piksellerinden gelir.
//   2) Kafa elipsoidi: Yüz ağı yalnızca yüzün önünü kapsar; kafanın arkasını
//      temsil etmek için kafa pozuna bağlı bir elipsoid (yerel koordinat, cm).

import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
} from 'three';

/** Derinliğe yazan, renge yazmayan malzeme. `debug` açıkken yarı saydam tel kafes görünür. */
export function occluderMaterial(debugColor) {
  const mat = new MeshBasicMaterial({ colorWrite: false, side: DoubleSide });
  mat.userData.debugColor = debugColor;
  return mat;
}

export function setOccluderDebug(material, enabled) {
  material.colorWrite = enabled;
  material.wireframe = enabled;
  material.transparent = enabled;
  material.opacity = enabled ? 0.35 : 1;
  material.color.set(enabled ? material.userData.debugColor : 0x000000);
  material.needsUpdate = true;
}

/** Kafa elipsoidinin yerel ölçüleri (cm). Saplar (x ≈ ±7.1) elipsoidin biraz dışında kalır. */
export const HEAD_ELLIPSOID = { center: [0, 1.0, -8.6], radii: [6.9, 9.2, 9.6] };

/**
 * Bir noktadan çıkan ışın elipsoidi keser mi? (Derinlik testinin geometrik karşılığı.)
 * Kameraya doğru giden ışın elipsoide çarpıyorsa nokta elipsoidin arkasındadır → gizlenir.
 * Elipsoid birim küreye ölçeklenip  |o + t·d|² = 1  denklemi t > 0 için çözülür.
 * @param origin, direction  {x,y,z} — elipsoidin yerel koordinatında
 */
export function rayHitsEllipsoid(origin, direction, ellipsoid = HEAD_ELLIPSOID) {
  const [cx, cy, cz] = ellipsoid.center;
  const [rx, ry, rz] = ellipsoid.radii;
  const o = [(origin.x - cx) / rx, (origin.y - cy) / ry, (origin.z - cz) / rz];
  const d = [direction.x / rx, direction.y / ry, direction.z / rz];
  const a = d[0] ** 2 + d[1] ** 2 + d[2] ** 2;
  const b = 2 * (o[0] * d[0] + o[1] * d[1] + o[2] * d[2]);
  const c = o[0] ** 2 + o[1] ** 2 + o[2] ** 2 - 1;
  if (c < 0) return true; // nokta elipsoidin içinde
  const disc = b * b - 4 * a * c;
  if (disc < 0) return false;
  const tFar = (-b + Math.sqrt(disc)) / (2 * a);
  return tFar > 0; // dışarıdaki noktada iki kök aynı işaretli; ikisi de pozitifse ışın önde kesişir
}

export function createHeadOccluder() {
  const geo = new SphereGeometry(1, 32, 20);
  const mesh = new Mesh(geo, occluderMaterial(0xff6b6b));
  mesh.name = 'head-occluder';
  mesh.position.fromArray(HEAD_ELLIPSOID.center);
  mesh.scale.fromArray(HEAD_ELLIPSOID.radii);
  return mesh;
}

/**
 * Yüz ağı maskesi. `update(face, width, height)` her karede nokta konumlarını
 * dünya koordinatına (X = x, Y = −y, Z = −z) yazar.
 * @param {number[]} triangles  trianglesFromTesselation() çıktısı
 */
export function createFaceOccluder(triangles, pointCount = 478) {
  const geo = new BufferGeometry();
  const positions = new Float32Array(pointCount * 3);
  geo.setAttribute('position', new BufferAttribute(positions, 3));
  geo.setIndex(triangles);
  const mesh = new Mesh(geo, occluderMaterial(0x5b8cff));
  mesh.name = 'face-occluder';
  mesh.frustumCulled = false; // sınır küresi her karede değiştiği için

  mesh.userData.update = (face, width, height) => {
    const n = Math.min(face.length, pointCount);
    for (let i = 0; i < n; i++) {
      const p = face[i];
      positions[i * 3] = p.x * width;
      positions[i * 3 + 1] = -p.y * height;
      positions[i * 3 + 2] = -p.z * width;
    }
    geo.attributes.position.needsUpdate = true;
  };
  return mesh;
}
