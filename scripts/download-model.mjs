// MediaPipe Face Landmarker modelini public/models/ altına indirir.
// Kullanım: npm run model
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const target = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'models', 'face_landmarker.task');

if (existsSync(target)) {
  console.log('Model zaten mevcut:', target);
  process.exit(0);
}

console.log('Model indiriliyor:', MODEL_URL);
const res = await fetch(MODEL_URL);
if (!res.ok) {
  console.error(`İndirme başarısız: HTTP ${res.status}`);
  process.exit(1);
}
mkdirSync(dirname(target), { recursive: true });
const buf = Buffer.from(await res.arrayBuffer());
writeFileSync(target, buf);
console.log(`Kaydedildi (${(buf.length / 1024 / 1024).toFixed(1)} MB):`, target);
