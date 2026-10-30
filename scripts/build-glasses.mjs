// assets/glasses/*.svg → public/glasses/*.png (şeffaf arka planlı)
// Kullanım: npm run glasses
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'assets', 'glasses');
const outDir = join(root, 'public', 'glasses');
mkdirSync(outDir, { recursive: true });

for (const file of readdirSync(srcDir).filter((f) => f.endsWith('.svg'))) {
  const svg = readFileSync(join(srcDir, file));
  const png = new Resvg(svg, { background: 'rgba(0,0,0,0)' }).render().asPng();
  const out = join(outDir, `${basename(file, '.svg')}.png`);
  writeFileSync(out, png);
  console.log(`${file} → public/glasses/${basename(out)} (${(png.length / 1024).toFixed(0)} KB)`);
}
