import { describe, expect, it } from 'vitest';
import { createFaceOccluder, createHeadOccluder, setOccluderDebug } from '../src/render/three/occluders.js';
import { syntheticFace } from './helpers.js';

describe('occluder malzemesi', () => {
  it('normalde renge yazmaz (görünmez) ama derinliğe yazar', () => {
    const { material } = createHeadOccluder();
    expect(material.colorWrite).toBe(false);
    expect(material.depthWrite).toBe(true);
  });

  it('hata ayıklama modunda tel kafes olarak görünür, kapatınca yine görünmez olur', () => {
    const { material } = createHeadOccluder();
    setOccluderDebug(material, true);
    expect(material.colorWrite).toBe(true);
    expect(material.wireframe).toBe(true);
    setOccluderDebug(material, false);
    expect(material.colorWrite).toBe(false);
    expect(material.wireframe).toBe(false);
  });
});

describe('createFaceOccluder', () => {
  it('noktaları dünya koordinatına yazar: X = x·W, Y = −y·H, Z = −z·W', () => {
    const mesh = createFaceOccluder([0, 1, 2]);
    const face = syntheticFace();
    face[5] = { x: 0.25, y: 0.5, z: -0.02 };
    mesh.userData.update(face, 1280, 720);
    const pos = mesh.geometry.attributes.position;
    expect(pos.getX(5)).toBeCloseTo(320);
    expect(pos.getY(5)).toBeCloseTo(-360);
    expect(pos.getZ(5)).toBeCloseTo(25.6); // kameraya yakın nokta → pozitif Z
  });

  it('üçgen indekslerini kullanır', () => {
    const mesh = createFaceOccluder([0, 1, 2, 2, 3, 0]);
    expect(Array.from(mesh.geometry.index.array)).toEqual([0, 1, 2, 2, 3, 0]);
  });
});
