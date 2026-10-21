/**
 * The ink pass. Bleach is drawn in brush and ink: flat tones, hard shadows and
 * a black line round every figure, never airbrushed light. Every sprite, icon
 * and painting is drawn first and then put through here once:
 *
 * - figures (enemies, the Emperor, pickups) lose their soft halo, their
 *   shading is flattened into a few hard tones, and they get an ink outline;
 * - effects keep their colour but their soft falloff becomes a few hard-edged
 *   bands, the way cel-animated spiritual pressure is drawn;
 * - paintings (grounds, title vistas) are flattened into tones, with
 *   screentone dots in the shadows like a printed manga page.
 */

export type InkKind = 'figure' | 'fx' | 'paint' | 'none';

/** The display face (Anton, bundled in src/fonts and loaded before the atlas is drawn), with condensed fallbacks. */
export const DISPLAY_FONT = 'Anton, "Avenir Next Condensed", "Arial Narrow", Impact, sans-serif';

const INK = [9, 9, 12] as const;
const PAPER = [236, 230, 214] as const;

/** Hard tone levels by luma. Anything darker than the first threshold is solid ink. */
const LEVELS = [9, 58, 112, 172, 236];

function smooth(a: number, lo: number, hi: number): number {
  if (a <= lo) return 0;
  if (a >= hi) return 1;
  const t = (a - lo) / (hi - lo);
  return t * t * (3 - 2 * t);
}

/** Effects: alpha in a few bands with a short soft step between them, so edges stay clean but hard. */
function bandAlpha(a: number): number {
  return 0.3 * smooth(a, 0.06, 0.12) + 0.32 * smooth(a, 0.3, 0.36) + 0.38 * smooth(a, 0.58, 0.64);
}

/** The nearest tone level for every luma 0..255, worked out once. */
const NEAREST = (() => {
  const t = new Uint8Array(256);
  for (let y = 0; y < 256; y++) {
    let best = LEVELS[1];
    for (const l of LEVELS) if (Math.abs(l - y) < Math.abs(best - y)) best = l;
    t[y] = best;
  }
  return t;
})();

/** Flatten one colour to its nearest tone, keeping its hue, a little desaturated. */
function tone(d: Uint8ClampedArray, i: number, desat: number): void {
  const r = d[i];
  const gr = d[i + 1];
  const b = d[i + 2];
  const y = 0.299 * r + 0.587 * gr + 0.114 * b;
  if (y < 30) {
    d[i] = INK[0] + r * 0.25;
    d[i + 1] = INK[1] + gr * 0.25;
    d[i + 2] = INK[2] + b * 0.25;
    return;
  }
  const best = NEAREST[y | 0];
  const k = best / Math.max(1, y);
  const gray = best;
  for (let c = 0; c < 3; c++) {
    const v = d[i + c] * k;
    d[i + c] = gray + (v - gray) * (1 - desat);
  }
  if (best >= 236) {
    // The brightest tone is paper, not glare.
    d[i] = d[i] * 0.55 + PAPER[0] * 0.45;
    d[i + 1] = d[i + 1] * 0.55 + PAPER[1] * 0.45;
    d[i + 2] = d[i + 2] * 0.55 + PAPER[2] * 0.45;
  }
}

/** Distance (in pixels) from every pixel to the nearest solid one: a two-pass chamfer transform. */
function distance(mask: Uint8Array, w: number, h: number): Float32Array {
  const INF = 1e6;
  const d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = mask[i] ? 0 : INF;
  const D = Math.SQRT2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let v = d[i];
      if (v === 0) continue;
      if (x > 0) v = Math.min(v, d[i - 1] + 1);
      if (y > 0) {
        v = Math.min(v, d[i - w] + 1);
        if (x > 0) v = Math.min(v, d[i - w - 1] + D);
        if (x < w - 1) v = Math.min(v, d[i - w + 1] + D);
      }
      d[i] = v;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      let v = d[i];
      if (v === 0) continue;
      if (x < w - 1) v = Math.min(v, d[i + 1] + 1);
      if (y < h - 1) {
        v = Math.min(v, d[i + w] + 1);
        if (x < w - 1) v = Math.min(v, d[i + w + 1] + D);
        if (x > 0) v = Math.min(v, d[i + w - 1] + D);
      }
      d[i] = v;
    }
  }
  return d;
}

/** Inner ink lines where tones meet hard. Off: at sprite size they speckle faces more than they shape them. */
const INNER_LINES = false;

/** Figures: halo cut, tones flattened, and an outline `line` pixels wide. */
function figure(img: ImageData, line: number): void {
  const { data: d, width: w, height: h } = img;
  const n = w * h;
  const mask = new Uint8Array(n);
  const band = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    const a = d[i + 3] / 255;
    const a2 = smooth(a, 0.3, 0.55);
    d[i + 3] = Math.round(a2 * 255);
    if (a2 <= 0) continue;
    tone(d, i, 0.18);
    const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    band[p] = y < 34 ? 0 : y < 85 ? 1 : y < 142 ? 2 : y < 204 ? 3 : 4;
    if (a2 >= 0.5) mask[p] = 1;
  }
  // Inner lines: where a light tone meets one two or more steps darker, the light side gets ink.
  if (INNER_LINES && line >= 2) {
    const inner = new Uint8Array(n);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const p = y * w + x;
        if (!mask[p] || band[p] < 3) continue;
        const b = band[p];
        if ((mask[p - 1] && b - band[p - 1] >= 3) || (mask[p + 1] && b - band[p + 1] >= 3) || (mask[p - w] && b - band[p - w] >= 3) || (mask[p + w] && b - band[p + w] >= 3)) inner[p] = 1;
      }
    }
    for (let p = 0; p < n; p++) {
      if (!inner[p]) continue;
      const i = p * 4;
      d[i] = INK[0];
      d[i + 1] = INK[1];
      d[i + 2] = INK[2];
    }
  }
  if (line <= 0) return;
  const dist = distance(mask, w, h);
  // Past the ink line, a faint rim of paper: how manga keeps a black figure apart from a dark ground.
  const rim = Math.max(1, line * 0.45);
  for (let p = 0; p < n; p++) {
    const dv = dist[p];
    if (dv === 0 || dv > line + rim + 1) continue;
    const ink = Math.max(0, Math.min(1, line + 0.5 - dv));
    const paper = ink >= 1 ? 0 : RIM * Math.max(0, Math.min(1, line + rim + 0.5 - dv));
    const i = p * 4;
    const a = d[i + 3] / 255;
    // The figure's own soft edge sits over the ink, the ink over the rim.
    const under = ink + paper * (1 - ink);
    if (under <= 0) continue;
    const out = a + under * (1 - a);
    for (let c = 0; c < 3; c++) {
      const u = (INK[c] * ink + PAPER[c] * paper * (1 - ink)) / under;
      d[i + c] = (d[i + c] * a + u * under * (1 - a)) / out;
    }
    d[i + 3] = Math.round(out * 255);
  }
}

/** How strong the paper rim outside the ink line is. */
const RIM = 0.32;

/** Effects: hard-edged alpha bands, tones flattened toward a white core. */
function fx(img: ImageData): void {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3] / 255;
    if (a <= 0) continue;
    const a2 = bandAlpha(a);
    d[i + 3] = Math.round(a2 * 255);
    if (a2 > 0) tone(d, i, 0);
  }
}

/** Paintings: flat tones, with screentone dots laid over the middle tones like a printed page. */
function paint(img: ImageData, dot: number): void {
  const { data: d, width: w } = img;
  const cell = Math.max(3, dot);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const y0 = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    tone(d, i, 0.12);
    const y1 = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    // Where the tone was rounded up, dark dots carry the lost shade; rounded down, light dots.
    const p = i / 4;
    const x = p % w;
    const yy = (p - x) / w;
    const row = Math.floor(yy / cell);
    const cx = ((x + (row % 2) * (cell / 2)) % cell) - cell / 2 + 0.5;
    const cy = (yy % cell) - cell / 2 + 0.5;
    const r2 = cx * cx + cy * cy;
    const diff = (y0 - y1) / 60;
    const rad = Math.min(1, Math.abs(diff)) * cell * 0.5;
    if (r2 < rad * rad) {
      const k = diff < 0 ? 0.55 : 1.35;
      d[i] *= k;
      d[i + 1] *= k;
      d[i + 2] *= k;
    }
  }
}

export interface InkRect {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: InkKind;
  line: number;
}

/**
 * Ink many rectangles of one canvas at once: one read of its pixels, each
 * rectangle processed in memory, one write back. (Reading back per sprite
 * costs far more than the processing itself.)
 */
export function inkRects(g: CanvasRenderingContext2D, width: number, height: number, rects: readonly InkRect[]): void {
  const full = g.getImageData(0, 0, width, height);
  const src = full.data;
  for (const r of rects) {
    if (r.kind === 'none' || r.w <= 0 || r.h <= 0 || r.y + r.h > height) continue;
    const img = new ImageData(r.w, r.h);
    const d = img.data;
    for (let row = 0; row < r.h; row++) {
      const from = ((r.y + row) * width + r.x) * 4;
      d.set(src.subarray(from, from + r.w * 4), row * r.w * 4);
    }
    if (r.kind === 'figure') figure(img, r.line);
    else if (r.kind === 'fx') fx(img);
    else paint(img, 6);
    for (let row = 0; row < r.h; row++) src.set(d.subarray(row * r.w * 4, (row + 1) * r.w * 4), ((r.y + row) * width + r.x) * 4);
  }
  g.putImageData(full, 0, 0);
}

/** Put a drawn rectangle of a canvas through the ink pass. `line` and `dot` are in that canvas's pixels. */
export function inkRegion(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, kind: InkKind, line = 2, dot = 6): void {
  if (kind === 'none' || w <= 0 || h <= 0) return;
  const img = g.getImageData(x, y, w, h);
  if (kind === 'figure') figure(img, line);
  else if (kind === 'fx') fx(img);
  else paint(img, dot);
  g.putImageData(img, x, y);
}

/** The whole canvas, for DOM canvases (portraits, icons, vistas). */
export function inkCanvas(canvas: HTMLCanvasElement, kind: InkKind, line = 2, dot = 6): void {
  const g = canvas.getContext('2d', { willReadFrequently: true });
  if (!g) return;
  inkRegion(g, 0, 0, canvas.width, canvas.height, kind, line, dot);
}
