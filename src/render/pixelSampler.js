// Video karesinden belirli yüz noktalarının çevresindeki pikselleri okur (alın kontrolü için).
// Tüm kareyi okumak yavaş olduğundan yalnızca yüz kutusu küçük bir canvas'a
// (en uzun kenar 160 px) çizilir ve her noktanın 3×3 komşuluğu okunur.

const MAX_DIM = 160;

export function createPixelSampler() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  /**
   * @param video   HTMLVideoElement
   * @param face    478 normalize nokta
   * @param groups  { name: number[] } nokta indeksleri
   * @returns { name: [[r,g,b], …] }
   */
  return function sample(video, face, groups) {
    const W = video.videoWidth;
    const H = video.videoHeight;
    const idx = Object.values(groups).flat();
    const xs = idx.map((i) => face[i].x * W);
    const ys = idx.map((i) => face[i].y * H);
    const x0 = Math.max(0, Math.min(...xs) - 4);
    const y0 = Math.max(0, Math.min(...ys) - 4);
    const bw = Math.min(W, Math.max(...xs) + 4) - x0;
    const bh = Math.min(H, Math.max(...ys) + 4) - y0;
    if (bw <= 0 || bh <= 0) return null;

    const scale = MAX_DIM / Math.max(bw, bh);
    canvas.width = Math.max(1, Math.round(bw * scale));
    canvas.height = Math.max(1, Math.round(bh * scale));
    ctx.drawImage(video, x0, y0, bw, bh, 0, 0, canvas.width, canvas.height);
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const out = {};
    for (const [name, indices] of Object.entries(groups)) {
      out[name] = [];
      for (const i of indices) {
        const cx = Math.round((face[i].x * W - x0) * scale);
        const cy = Math.round((face[i].y * H - y0) * scale);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const x = cx + dx;
            const y = cy + dy;
            if (x < 0 || y < 0 || x >= width || y >= height) continue;
            const o = (y * width + x) * 4;
            out[name].push([data[o], data[o + 1], data[o + 2]]);
          }
        }
      }
    }
    return out;
  };
}
