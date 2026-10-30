// Kodla üretilen 3D gözlük modeli (klasik siyah asetat, wayfarer tarzı).
//
// Birim: santimetre. Yerel eksenler (kafaya göre):
//   x → kişinin soluna,  y → yukarı,  z → ileri (yüzün baktığı yön, kameraya doğru)
//   Orijin: iki göz merkezinin orta noktası.
// Ölçüler 2D modelle (assets/glasses/classic-black.svg) aynıdır:
//   göz bebekleri arası 6.3, cam 5.2 × 4.0, köprü 1.8, cam düzlemi gözün 1.2 cm önünde.
//
// Model iki gruba ayrılır (occlusion için, bkz. GlassesScene):
//   front   : çerçeve, camlar, köprü, menteşeler, burun pedleri → her zaman yüzün önünde
//   temples : saplar → kafanın arkasına geçince yüz/kafa maskesiyle gizlenir

import {
  CatmullRomCurve3,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Path,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  BoxGeometry,
} from 'three';

export const DIMENSIONS = {
  lensWidth: 5.2,
  lensHeight: 4.0,
  bridge: 1.8,
  lensCenterY: -0.2, // göz bebeği camın biraz üstünde
  lensZ: 1.2, // gözden cama mesafe (vertex distance)
  rimWidth: 0.32,
  rimDepth: 0.45,
  templeX: 7.1, // sapların kafanın yanındaki yarı genişliği
  templeLength: 11.5,
};

const lensCenterX = (DIMENSIONS.lensWidth + DIMENSIONS.bridge) / 2; // 3.5

/**
 * Cam dış hattı: süperelips (köşeleri yuvarlatılmış dikdörtgen),
 * üst kenar biraz daha geniş (wayfarer). Merkez (0,0), saat yönü tersine.
 */
export function lensOutline(segments = 72) {
  const a = DIMENSIONS.lensWidth / 2;
  const b = DIMENSIONS.lensHeight / 2;
  const p = 2.8;
  const pts = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const y = b * Math.sign(s) * Math.abs(s) ** (2 / p);
    const x = a * Math.sign(c) * Math.abs(c) ** (2 / p) * (1 + 0.07 * (y / b));
    pts.push(new Vector2(x, y));
  }
  return pts;
}

/** Kapalı çokgeni dışa doğru `d` kadar kaydırır (her noktayı komşu kenarların normali boyunca). */
export function offsetOutline(points, d) {
  const n = points.length;
  return points.map((p, i) => {
    const prev = points[(i - 1 + n) % n];
    const next = points[(i + 1) % n];
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const len = Math.hypot(tx, ty) || 1;
    // Saat yönü tersi çokgende dış normal = (ty, −tx)
    return new Vector2(p.x + (ty / len) * d, p.y - (tx / len) * d);
  });
}

export function createMaterials() {
  return {
    acetate: new MeshPhysicalMaterial({
      color: 0x111113,
      roughness: 0.3,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
    }),
    lens: new MeshPhysicalMaterial({
      color: 0xd2deea,
      roughness: 0.02,
      metalness: 0,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: DoubleSide,
      envMapIntensity: 1.6,
    }),
    metal: new MeshStandardMaterial({ color: 0xdedede, metalness: 1, roughness: 0.25 }),
    pad: new MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.1, transparent: true, opacity: 0.35 }),
  };
}

function buildRim(materials, side) {
  const inner = lensOutline();
  const outer = offsetOutline(inner, DIMENSIONS.rimWidth);
  const shape = new Shape(outer);
  shape.holes.push(new Path(inner));
  const geo = new ExtrudeGeometry(shape, {
    depth: DIMENSIONS.rimDepth,
    bevelEnabled: true,
    bevelThickness: 0.07,
    bevelSize: 0.06,
    bevelSegments: 3,
    curveSegments: 4,
  });
  geo.translate(side * lensCenterX, DIMENSIONS.lensCenterY, DIMENSIONS.lensZ - DIMENSIONS.rimDepth / 2);
  const mesh = new Mesh(geo, materials.acetate);
  mesh.name = side < 0 ? 'rim-right' : 'rim-left';
  return mesh;
}

function buildLens(materials, side) {
  const geo = new ShapeGeometry(new Shape(offsetOutline(lensOutline(), 0.05)));
  geo.translate(side * lensCenterX, DIMENSIONS.lensCenterY, DIMENSIONS.lensZ);
  const mesh = new Mesh(geo, materials.lens);
  mesh.name = side < 0 ? 'lens-right' : 'lens-left';
  mesh.renderOrder = 1; // saydam camlar çerçeveden sonra
  return mesh;
}

function buildBridge(materials) {
  const z = DIMENSIONS.lensZ + 0.05;
  const curve = new CatmullRomCurve3([
    new Vector3(-1.05, 1.25, z),
    new Vector3(-0.5, 1.6, z + 0.08),
    new Vector3(0, 1.7, z + 0.1),
    new Vector3(0.5, 1.6, z + 0.08),
    new Vector3(1.05, 1.25, z),
  ]);
  const mesh = new Mesh(new TubeGeometry(curve, 24, 0.19, 10, false), materials.acetate);
  mesh.name = 'bridge';
  return mesh;
}

function buildHinge(materials, side) {
  const group = new Group();
  group.name = side < 0 ? 'hinge-right' : 'hinge-left';
  const block = new Mesh(new BoxGeometry(0.7, 0.85, 0.7), materials.acetate);
  block.position.set(side * 6.25, 1.05, DIMENSIONS.lensZ - 0.15);
  const rivet = new Mesh(new SphereGeometry(0.09, 12, 8), materials.metal);
  rivet.position.set(side * 6.25, 1.05, DIMENSIONS.lensZ + 0.21);
  group.add(block, rivet);
  return group;
}

function buildNosePad(materials, side) {
  const mesh = new Mesh(new SphereGeometry(0.3, 16, 10), materials.pad);
  mesh.scale.set(0.45, 1, 0.35);
  mesh.position.set(side * 0.9, -0.55, DIMENSIONS.lensZ - 0.35);
  mesh.rotation.z = side * 0.3;
  mesh.name = side < 0 ? 'pad-right' : 'pad-left';
  return mesh;
}

/** Sap yolu: menteşeden kafanın yanı boyunca kulağa, sonra kulağın arkasında aşağı kıvrılır. */
export function templePath(side) {
  const x = DIMENSIONS.templeX;
  return new CatmullRomCurve3([
    new Vector3(side * 6.55, 1.05, DIMENSIONS.lensZ - 0.3),
    new Vector3(side * 6.95, 1.0, -2),
    new Vector3(side * x, 0.95, -6),
    new Vector3(side * x, 0.8, -9),
    new Vector3(side * 6.95, -0.2, -10.6),
    new Vector3(side * 6.7, -1.3, -11.2),
  ]);
}

function buildTemple(materials, side) {
  const mesh = new Mesh(new TubeGeometry(templePath(side), 48, 0.17, 8, false), materials.acetate);
  mesh.name = side < 0 ? 'temple-right' : 'temple-left';
  return mesh;
}

/**
 * Gözlük modelini oluşturur.
 * side = −1: kişinin sağı (−x), side = +1: kişinin solu (+x)
 * @returns {{ front: Group, temples: Group, materials }}
 */
export function buildGlassesModel(materials = createMaterials()) {
  const front = new Group();
  front.name = 'glasses-front';
  const temples = new Group();
  temples.name = 'glasses-temples';

  for (const side of [-1, 1]) {
    front.add(buildRim(materials, side), buildLens(materials, side), buildHinge(materials, side), buildNosePad(materials, side));
    temples.add(buildTemple(materials, side));
  }
  front.add(buildBridge(materials));

  return { front, temples, materials };
}
