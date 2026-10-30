// Kodla üretilen 3D gözlük modeli. Cam şekli, ölçüler ve malzeme çerçeve modelinden
// (core/frameStyles.js) gelir; varsayılan model klasik siyah wayfarer'dır.
//
// Birim: santimetre. Yerel eksenler (kafaya göre):
//   x → kişinin soluna,  y → yukarı,  z → ileri (yüzün baktığı yön, kameraya doğru)
//   Orijin: iki göz merkezinin orta noktası.
// Ölçüler 2D görsellerle aynıdır (aynı frameStyles tanımından üretilir):
//   göz bebekleri arası 6.3, wayfarer camı 5.2 × 4.0, köprü 1.8, cam düzlemi gözün 1.2 cm önünde.
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
import { DEFAULT_FRAME_ID, frameAttachments, frameLayout, frameStyle, placedLens } from '../../core/frameStyles.js';

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

/**
 * Cam dış hattı (merkez (0,0), saat yönü tersine). Varsayılan: wayfarer —
 * süperelips (köşeleri yuvarlatılmış dikdörtgen), üst kenar biraz daha geniş.
 */
export function lensOutline(segments = 72, style = frameStyle(DEFAULT_FRAME_ID)) {
  const { centerX, centerY } = frameLayout(style);
  return placedLens(style, 1, segments).map((p) => new Vector2(p.x - centerX, p.y - centerY));
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

export function createMaterials(style = frameStyle(DEFAULT_FRAME_ID)) {
  const frame =
    style.rim.material === 'metal'
      ? new MeshStandardMaterial({ color: style.rim.color, metalness: 1, roughness: 0.22 })
      : new MeshPhysicalMaterial({
          color: style.rim.color,
          roughness: 0.3,
          metalness: 0,
          clearcoat: 1,
          clearcoatRoughness: 0.08,
        });
  return {
    acetate: frame, // çerçeve malzemesi (metal modellerde metal)
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

const toVec2 = (pts) => pts.map((p) => new Vector2(p.x, p.y));

function buildRim(style, materials, side) {
  const inner = toVec2(placedLens(style, side));
  const outer = offsetOutline(inner, style.rim.width);
  const shape = new Shape(outer);
  shape.holes.push(new Path(inner));
  const bevel = Math.min(0.07, style.rim.width / 3);
  const geo = new ExtrudeGeometry(shape, {
    depth: style.rim.depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.85,
    bevelSegments: 3,
    curveSegments: 4,
  });
  geo.translate(0, 0, DIMENSIONS.lensZ - style.rim.depth / 2);
  const mesh = new Mesh(geo, materials.acetate);
  mesh.name = side < 0 ? 'rim-right' : 'rim-left';
  return mesh;
}

function buildLens(style, materials, side) {
  const geo = new ShapeGeometry(new Shape(offsetOutline(toVec2(placedLens(style, side)), 0.05)));
  geo.translate(0, 0, DIMENSIONS.lensZ);
  const mesh = new Mesh(geo, materials.lens);
  mesh.name = side < 0 ? 'lens-right' : 'lens-left';
  mesh.renderOrder = 1; // saydam camlar çerçeveden sonra
  return mesh;
}

/** Köprü: iki camın iç üst kenarları arasında hafif kavisli çubuk (aviator'da çift). */
function buildBridge(style, materials) {
  const { bridgeY } = frameLayout(style);
  const z = DIMENSIONS.lensZ + 0.05;
  const half = frameAttachments(style).bridgeX;
  const radius = style.rim.material === 'metal' ? 0.07 : 0.19;
  const bar = (y, rise, name) => {
    const curve = new CatmullRomCurve3([
      new Vector3(-half, y, z),
      new Vector3(-half * 0.5, y + rise * 0.8, z + 0.08),
      new Vector3(0, y + rise, z + 0.1),
      new Vector3(half * 0.5, y + rise * 0.8, z + 0.08),
      new Vector3(half, y, z),
    ]);
    const mesh = new Mesh(new TubeGeometry(curve, 24, radius, 10, false), materials.acetate);
    mesh.name = name;
    return mesh;
  };
  const group = new Group();
  group.name = 'bridge';
  group.add(bar(bridgeY, 0.45, 'bridge-main'));
  if (style.doubleBridge) group.add(bar(bridgeY + style.lens.height * 0.32, 0.05, 'bridge-top'));
  return group;
}

function buildHinge(style, materials, side) {
  const { hingeY } = frameLayout(style);
  const { hingeX } = frameAttachments(style);
  const group = new Group();
  group.name = side < 0 ? 'hinge-right' : 'hinge-left';
  const size = style.rim.material === 'metal' ? 0.35 : 0.7;
  const block = new Mesh(new BoxGeometry(size, size * 1.2, 0.7), materials.acetate);
  block.position.set(side * (hingeX + size / 2 - 0.15), hingeY, DIMENSIONS.lensZ - 0.15);
  const rivet = new Mesh(new SphereGeometry(0.09, 12, 8), materials.metal);
  rivet.position.set(side * (hingeX + size / 2 - 0.15), hingeY, DIMENSIONS.lensZ - 0.15 + 0.36);
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
export function templePath(side, style = frameStyle(DEFAULT_FRAME_ID)) {
  const x = DIMENSIONS.templeX;
  const { hingeY } = frameLayout(style);
  const { hingeX } = frameAttachments(style);
  return new CatmullRomCurve3([
    new Vector3(side * Math.max(hingeX + 0.3, 6.4), hingeY, DIMENSIONS.lensZ - 0.3),
    new Vector3(side * 6.95, 1.0, -2),
    new Vector3(side * x, 0.95, -6),
    new Vector3(side * x, 0.8, -9),
    new Vector3(side * 6.95, -0.2, -10.6),
    new Vector3(side * 6.7, -1.3, -11.2),
  ]);
}

function buildTemple(style, materials, side) {
  const radius = style.rim.material === 'metal' ? 0.08 : 0.17;
  const mesh = new Mesh(new TubeGeometry(templePath(side, style), 48, radius, 8, false), materials.acetate);
  mesh.name = side < 0 ? 'temple-right' : 'temple-left';
  return mesh;
}

/**
 * Gözlük modelini oluşturur.
 * side = −1: kişinin sağı (−x), side = +1: kişinin solu (+x)
 * @param style  frameStyles.js'teki çerçeve modeli
 * @returns {{ front: Group, temples: Group, materials }}
 */
export function buildGlassesModel(style = frameStyle(DEFAULT_FRAME_ID), materials = createMaterials(style)) {
  const front = new Group();
  front.name = 'glasses-front';
  const temples = new Group();
  temples.name = 'glasses-temples';

  for (const side of [-1, 1]) {
    front.add(
      buildRim(style, materials, side),
      buildLens(style, materials, side),
      buildHinge(style, materials, side),
      buildNosePad(materials, side),
    );
    temples.add(buildTemple(style, materials, side));
  }
  front.add(buildBridge(style, materials));

  return { front, temples, materials };
}
