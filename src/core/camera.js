// Kamera erişimi: getUserMedia ile akışı açar, <video> elemanına bağlar.
// React'ten bağımsızdır; hook (useCamera) bu fonksiyonları kullanır.

export const DEFAULT_CONSTRAINTS = {
  audio: false,
  video: {
    facingMode: 'user',
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 },
  },
};

/** Tarayıcı hatasını kullanıcıya gösterilecek Türkçe mesaja çevirir. */
export function describeCameraError(error) {
  switch (error?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Kamera izni reddedildi. Adres çubuğundaki kamera simgesinden izin verip tekrar deneyin.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Uygun bir kamera bulunamadı.';
    case 'NotReadableError':
    case 'AbortError':
      return 'Kamera başka bir uygulama tarafından kullanılıyor olabilir (Zoom, FaceTime vb.).';
    case 'InsecureContextError':
      return 'Kamera yalnızca güvenli bağlantıda (https veya localhost) kullanılabilir.';
    default:
      return `Kamera açılamadı: ${error?.message ?? 'bilinmeyen hata'}`;
  }
}

/** Kamera akışını açar (henüz bir <video>'ya bağlamaz). */
export async function openCameraStream(constraints = DEFAULT_CONSTRAINTS) {
  if (!navigator.mediaDevices?.getUserMedia) {
    const err = new Error('mediaDevices API yok');
    err.name = 'InsecureContextError';
    throw err;
  }
  return navigator.mediaDevices.getUserMedia(constraints);
}

/**
 * Akışı <video> elemanına bağlar ve oynatmaya başlar.
 * @returns {Promise<{width: number, height: number, frameRate: number|undefined}>}
 */
export async function attachStream(video, stream) {
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();

  const settings = stream.getVideoTracks()[0]?.getSettings() ?? {};
  return {
    width: video.videoWidth || settings.width,
    height: video.videoHeight || settings.height,
    frameRate: settings.frameRate,
  };
}

export function stopCamera(stream, video) {
  stream?.getTracks().forEach((track) => track.stop());
  if (video) video.srcObject = null;
}
