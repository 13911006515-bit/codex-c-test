import { mkdir, readdir, copyFile } from 'node:fs/promises';
const source = new URL('../node_modules/@mediapipe/hands/', import.meta.url);
const target = new URL('../public/mediapipe/', import.meta.url);
await mkdir(target, { recursive: true });
for (const file of await readdir(source)) {
  if (/\.(js|wasm|data|binarypb|tflite)$/.test(file)) await copyFile(new URL(file, source), new URL(file, target));
}
console.log('MediaPipe runtime and models prepared locally.');
