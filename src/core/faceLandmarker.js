// MediaPipe Face Landmarker sarmalayıcısı.
//
// Noktaların anlamı ve koordinat sistemi için bkz. landmarkUtils.js.

import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export const DEFAULT_OPTIONS = {
  modelPath: '/models/face_landmarker.task',
  wasmPath: '/mediapipe',
  numFaces: 1,
  minFaceDetectionConfidence: 0.5,
  minFacePresenceConfidence: 0.5,
  minTrackingConfidence: 0.5,
};

/**
 * Modeli yükler. Önce GPU (WebGL) dener, olmazsa CPU'ya düşer.
 * @returns {Promise<{landmarker: FaceLandmarker, delegate: 'GPU'|'CPU'}>}
 */
export async function createFaceLandmarker(options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const fileset = await FilesetResolver.forVisionTasks(opts.wasmPath);

  const build = (delegate) =>
    FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: opts.modelPath, delegate },
      runningMode: 'VIDEO',
      numFaces: opts.numFaces,
      minFaceDetectionConfidence: opts.minFaceDetectionConfidence,
      minFacePresenceConfidence: opts.minFacePresenceConfidence,
      minTrackingConfidence: opts.minTrackingConfidence,
      outputFaceBlendshapes: false,
      // 3D mod için yüzün 4×4 dönüşüm matrisi (kafa pozu). 2D mod bunu kullanmaz.
      outputFacialTransformationMatrixes: true,
    });

  try {
    return { landmarker: await build('GPU'), delegate: 'GPU' };
  } catch (gpuError) {
    console.warn('GPU delegate açılamadı, CPU kullanılıyor:', gpuError);
    return { landmarker: await build('CPU'), delegate: 'CPU' };
  }
}

/**
 * Bir video karesinde yüz noktalarını ve kafa pozu matrisini tespit eder.
 * @returns {{faces: Array<Array<{x,y,z}>>, matrices: Array<number[]>}}
 *   faces    : yüz başına 478 nokta (yüz yoksa boş dizi)
 *   matrices : yüz başına 16 elemanlı dönüşüm matrisi (sütun öncelikli / column-major)
 */
export function detectFrame(landmarker, video, timestampMs) {
  const result = landmarker.detectForVideo(video, timestampMs);
  return {
    faces: result.faceLandmarks ?? [],
    matrices: (result.facialTransformationMatrixes ?? []).map((m) => m.data),
  };
}

/** Kontur tanımları (nokta çiftleri listesi) — çizimde kullanılır. */
export const FACE_CONTOURS = {
  oval: FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
  leftEye: FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
  rightEye: FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
  leftEyebrow: FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
  rightEyebrow: FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
  leftIris: FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS,
  rightIris: FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS,
  lips: FaceLandmarker.FACE_LANDMARKS_LIPS,
};

/** Yüz yüzeyi ağının kenarları (üçgenler bu kenarlardan çıkarılır, bkz. faceMesh.js). */
export const FACE_TESSELATION = FaceLandmarker.FACE_LANDMARKS_TESSELATION;
