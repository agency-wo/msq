// Draws the app icon (a golden halo with eight rays around a pale core) and writes PNGs
// to public/icons. Pure Node: shapes are signed-distance fields, supersampled 4x4, and
// encoded with a minimal PNG writer. Run with: npm run icons
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const mix = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Colour of the emblem at normalised coords (-1..1), as [r, g, b] 0..1. `scale` shrinks it for maskable safe zones. */
function shade(x, y, scale) {
  const r = Math.hypot(x, y) / scale;
  const a = Math.atan2(y, x);
  // Background: deep blue-black, a little lighter in the middle.
  let col = [mix(0.09, 0.03, clamp01(r / 1.4)), mix(0.1, 0.035, clamp01(r / 1.4)), mix(0.2, 0.06, clamp01(r / 1.4))];
  const paint = (c, alpha) => {
    col = [mix(col[0], c[0], alpha), mix(col[1], c[1], alpha), mix(col[2], c[2], alpha)];
  };
  // Soft glow behind the halo.
  paint([0.55, 0.45, 0.2], clamp01(1 - Math.abs(r - 0.52) / 0.35) * 0.35);
  // Eight rays.
  const sector = (Math.PI * 2) / 8;
  const off = Math.abs(((a + Math.PI / 8) % sector + sector) % sector - sector / 2) / (sector / 2);
  const rayLen = 0.86;
  if (r > 0.6 && r < rayLen) {
    const width = (1 - (r - 0.6) / (rayLen - 0.6)) * 0.42;
    if (off < width) paint([0.95, 0.79, 0.4], 1);
  }
  // The halo ring.
  const ring = Math.abs(r - 0.52) - 0.07;
  if (ring < 0) paint([mix(1, 0.85, (y / scale + 1) / 2), mix(0.88, 0.66, (y / scale + 1) / 2), mix(0.55, 0.28, (y / scale + 1) / 2)], 1);
  // Pale core: a diamond with a cool glow.
  const diamond = Math.abs(x / scale) + Math.abs(y / scale) * 0.8;
  paint([0.55, 0.8, 1], clamp01(1 - diamond / 0.42) * 0.55);
  if (diamond < 0.2) paint([0.92, 0.97, 1], 1);
  return col;
}

function render(size, scale) {
  const rgba = Buffer.alloc(size * size * 4);
  const ss = 4;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const x = ((px + (sx + 0.5) / ss) / size) * 2 - 1;
          const y = ((py + (sy + 0.5) / ss) / size) * 2 - 1;
          const c = shade(x, y, scale);
          r += c[0];
          g += c[1];
          b += c[2];
        }
      }
      const i = (py * size + px) * 4;
      const n = ss * ss;
      rgba[i] = Math.round((r / n) * 255);
      rgba[i + 1] = Math.round((g / n) * 255);
      rgba[i + 2] = Math.round((b / n) * 255);
      rgba[i + 3] = 255;
    }
  }
  return encodePng(size, rgba);
}

mkdirSync(OUT, { recursive: true });
const icons = [
  ['apple-touch-icon.png', 180, 1],
  ['icon-192.png', 192, 1],
  ['icon-512.png', 512, 1],
  // Maskable icons get cropped to a circle or squircle: keep the emblem inside the safe zone.
  ['icon-maskable-512.png', 512, 0.78],
];
for (const [name, size, scale] of icons) {
  writeFileSync(join(OUT, name), render(size, scale));
  console.log(`wrote public/icons/${name}`);
}
