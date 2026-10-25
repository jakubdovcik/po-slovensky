#!/usr/bin/env node
// Draws the app icon (a white Slovak double cross over blue hills) as PNGs, no dependencies.

import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'icons');

const BG = [1, 66, 164];   // Wellesley blue
const HILL = [12, 33, 66];  // deep navy
const WHITE = [255, 252, 244]; // cream

// Shapes in unit coordinates (0..1). Later shapes paint over earlier ones.
function colorAt(x, y) {
  let c = BG;
  const hill = (cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 < r * r;
  if (hill(0.5, 1.02, 0.30) || hill(0.18, 1.08, 0.26) || hill(0.82, 1.08, 0.26)) c = HILL;
  const rect = (x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  if (rect(0.455, 0.16, 0.545, 0.80) || rect(0.335, 0.30, 0.665, 0.385) || rect(0.27, 0.48, 0.73, 0.565)) c = WHITE;
  return c;
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size) {
  const SS = 4; // supersampling for smooth edges
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const [cr, cg, cb] = colorAt((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size);
        r += cr; g += cg; b += cb;
      }
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = r / SS / SS; raw[o + 1] = g / SS / SS; raw[o + 2] = b / SS / SS;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

writeFileSync(join(OUT, 'apple-touch-icon.png'), png(180));
writeFileSync(join(OUT, 'icon-192.png'), png(192));
writeFileSync(join(OUT, 'icon-512.png'), png(512));
console.log('Icons written to', OUT);
