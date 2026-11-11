// Writes the fixture's test tone (components/parrot/hello-en.wav): 1.2 s of 8 kHz, 8-bit mono, three short bursts at
// the three word times of the English voice. Made here, never downloaded. Prints the sha256 digest for the JSON.
// Usage: node engine/v2/tests/lines-fixture/make-tone.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export function toneWav() {
  const rate = 8000; const n = Math.round(rate * 1.2);
  const data = Buffer.alloc(n);
  const bursts = [[0, 0.4], [0.4, 0.8], [0.9, 1.2]];
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const on = bursts.some(([a, b]) => t >= a + 0.02 && t < b - 0.02);
    data[i] = 128 + (on ? Math.round(60 * Math.sin(2 * Math.PI * 440 * t)) : 0);
  }
  const head = Buffer.alloc(44);
  head.write('RIFF', 0); head.writeUInt32LE(36 + n, 4); head.write('WAVE', 8); head.write('fmt ', 12);
  head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22); head.writeUInt32LE(rate, 24);
  head.writeUInt32LE(rate, 28); head.writeUInt16LE(1, 32); head.writeUInt16LE(8, 34); head.write('data', 36); head.writeUInt32LE(n, 40);
  return Buffer.concat([head, data]);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = path.join(path.dirname(fileURLToPath(import.meta.url)), 'components', 'parrot', 'hello-en.wav');
  const b = toneWav();
  fs.writeFileSync(out, b);
  console.log(`sha256:${crypto.createHash('sha256').update(b).digest('hex')}`);
}
