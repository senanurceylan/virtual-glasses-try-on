// MediaPipe WASM çalışma dosyalarını node_modules'tan public/mediapipe/ altına kopyalar.
// Böylece uygulama CDN'e bağımlı olmadan, internet olmadan da çalışır.
// `npm run dev` ve `npm run build` öncesinde otomatik çalışır (predev/prebuild).
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const dst = join(root, 'public', 'mediapipe');

// FilesetResolver tarayıcının SIMD desteğine göre bu iki çiftten birini seçer.
const FILES = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
];

mkdirSync(dst, { recursive: true });
let copied = 0;
for (const name of FILES) {
  const from = join(src, name);
  const to = join(dst, name);
  if (existsSync(to) && statSync(to).size === statSync(from).size) continue;
  copyFileSync(from, to);
  copied++;
}
console.log(copied ? `MediaPipe WASM: ${copied} dosya kopyalandı.` : 'MediaPipe WASM: güncel.');
