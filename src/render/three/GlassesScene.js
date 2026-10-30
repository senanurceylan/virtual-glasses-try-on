// Three.js sahnesi: 3D gözlüğü video üzerine çizer.
//
// Kamera: Piksel ölçeğinde ortografik kamera. Dünya koordinatı = video pikseli
// (X = x, Y = −y, Z = −z), bu yüzden 3D gözlük 2D moddaki gibi landmark
// noktalarıyla birebir hizalanır. Ortografik izdüşüm, yüzün kameraya olan
// uzaklığının yüz derinliğinden çok büyük olduğu webcam senaryosunda iyi bir
// yaklaşımdır (zayıf perspektif / weak perspective) ve gerçek kameranın görüş
// açısını bilmeyi gerektirmez.
//
// Çizim sırası (occlusion):
//   1. geçiş: yüz ağı + kafa elipsoidi (yalnızca derinlik) → saplar (derinlik testli)
//   2. derinlik tamponu temizlenir
//   3. geçiş: çerçeve, camlar, köprü (her zaman yüzün önünde)
// Böylece saplar kafanın arkasına geçince gizlenir; ön çerçeve burun gibi
// yüz bölgeleriyle çakışıp kesilmez.

import {
  ACESFilmicToneMapping,
  DirectionalLight,
  Group,
  OrthographicCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildGlassesModel } from './glassesModel3D.js';
import { createFaceOccluder, createHeadOccluder, setOccluderDebug } from './occluders.js';

export class GlassesScene {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {number[]} faceTriangles  yüz ağı üçgen indeksleri
   * @throws WebGL desteklenmiyorsa
   */
  constructor(canvas, faceTriangles) {
    this.renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: true });
    this.renderer.setPixelRatio(1); // canvas çözünürlüğü = video çözünürlüğü
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.autoClear = false;
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;

    this.camera = new OrthographicCamera(0, 1, 0, -1, 0.1, 20000);
    this.camera.position.set(0, 0, 10000);

    const pmrem = new PMREMGenerator(this.renderer);
    const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const makeScene = () => {
      const scene = new Scene();
      scene.environment = envMap;
      const light = new DirectionalLight(0xffffff, 1.4);
      light.position.set(0.3, 1, 1);
      scene.add(light);
      return scene;
    };
    this.backScene = makeScene(); // maskeler + saplar
    this.frontScene = makeScene(); // ön çerçeve

    const { front, temples, materials } = buildGlassesModel();
    this.materials = materials;
    this.envMap = envMap;

    // Aynı poz iki sahnedeki iki gruba uygulanır.
    this.backPivot = new Group();
    this.frontPivot = new Group();
    this.headOccluder = createHeadOccluder();
    this.backPivot.add(temples, this.headOccluder);
    this.frontPivot.add(front);
    this.faceOccluder = createFaceOccluder(faceTriangles);
    this.faceOccluder.renderOrder = -1;
    this.headOccluder.renderOrder = -1;

    this.backScene.add(this.faceOccluder, this.backPivot);
    this.frontScene.add(this.frontPivot);

    this.width = 0;
    this.height = 0;
    this.visible = false;
  }

  setSize(width, height) {
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height, false);
    Object.assign(this.camera, { left: 0, right: width, top: 0, bottom: -height });
    this.camera.updateProjectionMatrix();
  }

  /** Maskeleri renkli tel kafes olarak göster (algoritmayı görselleştirmek için). */
  setOccluderDebug(enabled) {
    setOccluderDebug(this.faceOccluder.material, enabled);
    setOccluderDebug(this.headOccluder.material, enabled);
  }

  /**
   * @param face  478 normalize nokta (yüz ağı maskesi için)
   * @param pose  computeHeadPose() çıktısı; null ise gözlük gizlenir
   */
  update(face, pose) {
    this.visible = Boolean(face && pose);
    if (!this.visible) return;
    this.faceOccluder.userData.update(face, this.width, this.height);
    for (const pivot of [this.backPivot, this.frontPivot]) {
      pivot.position.copy(pose.position);
      pivot.quaternion.copy(pose.quaternion);
      pivot.scale.setScalar(pose.pxPerCm);
    }
  }

  render() {
    const r = this.renderer;
    r.clear(true, true, true);
    if (!this.visible) return;
    r.render(this.backScene, this.camera);
    r.clearDepth();
    r.render(this.frontScene, this.camera);
  }

  clear() {
    this.visible = false;
    this.renderer.clear(true, true, true);
  }

  dispose() {
    for (const scene of [this.backScene, this.frontScene]) {
      scene.traverse((obj) => obj.geometry?.dispose());
    }
    Object.values(this.materials).forEach((m) => m.dispose());
    this.faceOccluder.material.dispose();
    this.headOccluder.material.dispose();
    this.envMap.dispose();
    this.renderer.dispose();
  }
}
