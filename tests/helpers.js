// Testler için yapay yüz: 478 noktayı bir elips üzerine dağıtır.
export function syntheticFace({ cx = 0.5, cy = 0.5, rx = 0.15, ry = 0.2, count = 478 } = {}) {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a), z: -0.05 + 0.1 * (i / count) };
  });
}

/** Canvas 2D bağlamının çağrıları kaydeden sahte sürümü. */
export function mockContext(width = 1280, height = 720) {
  const calls = [];
  const record = (name) => (...args) => calls.push({ name, args });
  return {
    canvas: { width, height },
    calls,
    count: (name) => calls.filter((c) => c.name === name).length,
    clearRect: record('clearRect'),
    fillRect: record('fillRect'),
    strokeRect: record('strokeRect'),
    beginPath: record('beginPath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    stroke: record('stroke'),
    save: record('save'),
    restore: record('restore'),
    setLineDash: record('setLineDash'),
    setTransform: record('setTransform'),
    drawImage: record('drawImage'),
    arc: record('arc'),
    fill: record('fill'),
  };
}
