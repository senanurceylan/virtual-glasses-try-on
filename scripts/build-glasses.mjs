// Gözlük görselleri:
//   1) core/frameStyles.js'teki parametrik modellerden SVG üretir (elle çizilmiş olanlar hariç)
//      → assets/glasses/<id>.svg
//   2) Tüm SVG'leri şeffaf arka planlı PNG'ye çevirir → public/glasses/<id>.png
// Kullanım: npm run glasses
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { FRAME_STYLES, frameAttachments, frameLayout, offsetPoints, placedLens } from '../src/core/frameStyles.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'assets', 'glasses');
const outDir = join(root, 'public', 'glasses');
mkdirSync(outDir, { recursive: true });

// 2D yerleştirme referansı (glassesCatalog.js ile aynı): göz bebekleri (330, 200) ve (870, 200),
// aradaki 540 px = 6.3 cm → 1 cm = 85.71 px. Gözlük koordinatından (cm, y yukarı) görsele:
const PX = 540 / 6.3;
const X = (x) => 600 + x * PX;
const Y = (y) => 200 - y * PX;
const f = (v) => v.toFixed(1);
const pathOf = (pts) => `M ${pts.map((p) => `${f(X(p.x))} ${f(Y(p.y))}`).join(' L ')} Z`;

/** Rengi açar (k > 0) ya da koyulaştırır (k < 0). */
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [16, 8, 0].map((s) => (n >> s) & 255).map((c) => Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k)));
  return `#${ch.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function styleSvg(style) {
  const { bridgeY, hingeY } = frameLayout(style);
  const { bridgeX, hingeX } = frameAttachments(style);
  const metal = style.rim.material === 'metal';
  const color = style.rim.color;
  const rimPx = style.rim.width * PX;
  const lenses = [-1, 1].map((side) => placedLens(style, side, 144));
  const rims = lenses.map((pts) => offsetPoints(pts, style.rim.width / 2));
  const tortoise = style.id.includes('tortoise');

  const half = bridgeX;
  const bridge = (y, rise) =>
    `M ${f(X(-half))} ${f(Y(y))} Q ${f(X(0))} ${f(Y(y + rise * 2))} ${f(X(half))} ${f(Y(y))}`;
  const bridgeWidth = (metal ? 0.14 : 0.36) * PX;

  const hinge = (side) => {
    const x0 = X(side * (hingeX - 0.15));
    const w = (metal ? 0.3 : 0.55) * PX * side;
    const h = (metal ? 0.22 : 0.5) * PX;
    return `<path d="M ${f(x0)} ${f(Y(hingeY) - h / 2)} L ${f(x0 + w)} ${f(Y(hingeY) - h / 3)} L ${f(x0 + w)} ${f(Y(hingeY) + h / 3)} L ${f(x0)} ${f(Y(hingeY) + h / 2)} Z" fill="url(#frame)"/>`;
  };
  const pads = metal
    ? [-1, 1]
        .map(
          (s) => `<path d="M ${f(X(s * half * 0.9))} ${f(Y(bridgeY - 0.1))} Q ${f(X(s * 0.75))} ${f(Y(-0.3))} ${f(X(s * 0.9))} ${f(Y(-0.55))}" fill="none" stroke="url(#frame)" stroke-width="5"/>
    <ellipse cx="${f(X(s * 0.9))}" cy="${f(Y(-0.6))}" rx="10" ry="24" transform="rotate(${-s * 18} ${f(X(s * 0.9))} ${f(Y(-0.6))})" fill="#ffffff" fill-opacity="0.2" stroke="#dcdcdc" stroke-opacity="0.5" stroke-width="2"/>`,
        )
        .join('\n    ')
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<!--
  ${style.name}: ${style.description}
  Bu dosya scripts/build-glasses.mjs tarafından core/frameStyles.js'ten üretilir; elle düzenlemeyin.
  Göz bebekleri (330, 200) ve (870, 200): 540 px = 6.3 cm. 3D modelle aynı ölçüler.
-->
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="460" viewBox="0 0 1200 460">
  <defs>
    <linearGradient id="frame" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${shade(color, metal ? 0.55 : 0.25)}"/>
      <stop offset="${metal ? 0.5 : 0.35}" stop-color="${color}"/>
      <stop offset="1" stop-color="${shade(color, -0.45)}"/>
    </linearGradient>
    <radialGradient id="glass" cx="0.45" cy="0.4" r="0.75">
      <stop offset="0" stop-color="#c8d8ea" stop-opacity="0.06"/>
      <stop offset="1" stop-color="#7d93ad" stop-opacity="0.2"/>
    </radialGradient>${
      tortoise
        ? `
    <pattern id="spots" width="90" height="70" patternUnits="userSpaceOnUse">
      <ellipse cx="20" cy="18" rx="16" ry="9" fill="#c27a35" fill-opacity="0.55"/>
      <ellipse cx="62" cy="44" rx="20" ry="11" fill="#e0a050" fill-opacity="0.4"/>
      <ellipse cx="78" cy="10" rx="9" ry="6" fill="#1c0d05" fill-opacity="0.6"/>
      <ellipse cx="35" cy="58" rx="12" ry="7" fill="#1c0d05" fill-opacity="0.5"/>
    </pattern>`
        : ''
    }
  </defs>
  ${lenses.map((pts) => `<path d="${pathOf(pts)}" fill="url(#glass)"/>`).join('\n  ')}
  ${hinge(-1)}
  ${hinge(1)}
  <path d="${bridge(bridgeY, 0.22)}" fill="none" stroke="url(#frame)" stroke-width="${f(bridgeWidth)}" stroke-linecap="round"/>${
    style.doubleBridge
      ? `
  <path d="${bridge(bridgeY + style.lens.height * 0.32, 0.02)}" fill="none" stroke="url(#frame)" stroke-width="${f(bridgeWidth * 0.8)}" stroke-linecap="round"/>`
      : ''
  }
  ${rims.map((pts) => `<path d="${pathOf(pts)}" fill="none" stroke="url(#frame)" stroke-width="${f(rimPx)}" stroke-linejoin="round"/>`).join('\n  ')}${
    tortoise
      ? `
  ${rims.map((pts) => `<path d="${pathOf(pts)}" fill="none" stroke="url(#spots)" stroke-width="${f(rimPx)}" stroke-linejoin="round"/>`).join('\n  ')}`
      : ''
  }
  ${rims.map((pts) => `<path d="${pathOf(pts.filter((p) => p.y > frameLayout(style).centerY + style.lens.height * 0.3))}" fill="none" stroke="#ffffff" stroke-opacity="${metal ? 0.45 : 0.18}" stroke-width="${metal ? 2 : 4}" stroke-linecap="round"/>`.replace(' Z"', '"')).join('\n  ')}
  ${pads}
</svg>
`;
}

for (const style of FRAME_STYLES.filter((s) => !s.handDrawnSvg)) {
  writeFileSync(join(srcDir, `${style.id}.svg`), styleSvg(style));
}

for (const file of readdirSync(srcDir).filter((name) => name.endsWith('.svg'))) {
  const svg = readFileSync(join(srcDir, file));
  const png = new Resvg(svg, { background: 'rgba(0,0,0,0)' }).render().asPng();
  const out = join(outDir, `${basename(file, '.svg')}.png`);
  writeFileSync(out, png);
  console.log(`${file} → public/glasses/${basename(out)} (${(png.length / 1024).toFixed(0)} KB)`);
}
