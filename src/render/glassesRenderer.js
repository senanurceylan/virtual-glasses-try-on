// Gözlük görselini afin dönüşümle canvas'a çizer, ayrıca yerleştirme
// geometrisini (göz merkezleri, göz çizgisi, orta nokta) görselleştirir.

/** Canvas'ı temizler; dönüşüm varsa gözlüğü çizer. */
export function drawGlasses(ctx, image, transform) {
  const { width, height } = ctx.canvas;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  if (!image || !transform) return;

  const { a, b, c, d, e, f } = transform;
  ctx.setTransform(a, b, c, d, e, f);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/**
 * Yerleştirme geometrisini çizer (mevcut çizimin üstüne, temizlemeden).
 * Göz merkezleri, aralarındaki çizgi (mesafe + açı), orta nokta ve
 * yatay referans çizgisi (açının görünmesi için).
 */
export function drawPlacementGeometry(ctx, metrics) {
  if (!metrics) return;
  const { right, left, center, distance2D } = metrics;
  const scale = Math.max(1, ctx.canvas.width / 640);

  ctx.save();
  ctx.lineCap = 'round';

  // Yatay referans (θ = 0)
  ctx.setLineDash([6 * scale, 6 * scale]);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1 * scale;
  ctx.beginPath();
  ctx.moveTo(center.x - distance2D * 0.75, center.y);
  ctx.lineTo(center.x + distance2D * 0.75, center.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Göz çizgisi (mesafe ve açı)
  ctx.strokeStyle = '#3ddc97';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(right.x, right.y);
  ctx.lineTo(left.x, left.y);
  ctx.stroke();

  // Göz merkezleri
  ctx.fillStyle = '#3ddc97';
  for (const p of [right, left]) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  // Orta nokta (gözlüğün yerleştirildiği nokta)
  ctx.strokeStyle = '#ff6b6b';
  ctx.lineWidth = 2 * scale;
  const r = 7 * scale;
  ctx.beginPath();
  ctx.moveTo(center.x - r, center.y);
  ctx.lineTo(center.x + r, center.y);
  ctx.moveTo(center.x, center.y - r);
  ctx.lineTo(center.x, center.y + r);
  ctx.stroke();

  ctx.restore();
}
