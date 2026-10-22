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
      outputFacialTransformationMatrixes: false,
    });

  try {
    return { landmarker: await build('GPU'), delegate: 'GPU' };
  } catch (gpuError) {
    console.warn('GPU delegate açılamadı, CPU kullanılıyor:', gpuError);
    return { landmarker: await build('CPU'), delegate: 'CPU' };
  }
}

/**
 * Bir video karesinde yüz noktalarını tespit eder.
 * @returns {Array<Array<{x:number,y:number,z:number}>>} yüz başına nokta listesi (yüz yoksa boş dizi)
 */
export function detectFaces(landmarker, video, timestampMs) {
  const result = landmarker.detectForVideo(video, timestampMs);
  return result.faceLandmarks ?? [];
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
