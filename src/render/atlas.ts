import { Rectangle, Texture } from 'pixi.js';

/**
 * All game art is drawn here with Canvas 2D at startup and packed into one
 * texture, so the whole game renders from a single texture source (which is
 * what lets Pixi's ParticleContainer batch thousands of sprites) and nothing
 * is downloaded. Bleach's look (ink black, bone white, Quincy blue, Hollow
 * red); the Emperor is a chibi homage to Yhwach, every other design is original.
 */

/** Atlas pixels per world unit at scale 1: sprites are drawn at 2x for sharp phones. */
export const ATLAS_SCALE = 2;

type Ctx = CanvasRenderingContext2D;
type Draw = (g: Ctx, w: number, h: number) => void;

interface Spec {
  name: string;
  w: number;
  h: number;
  draw: Draw;
  /** Shrink the frame by this many pixels per side (solid fills, to avoid edge bleed). */
  inset?: number;
}

export interface Atlas {
  canvas: HTMLCanvasElement;
  base: Texture;
  frames: Record<string, Texture>;
  /** Frame size in atlas pixels. */
  px: Record<string, { w: number; h: number }>;
}

const TAU = Math.PI * 2;
const BONE = '#efeae0';
const INK = '#07080c';

// ------------------------------------------------------------ helpers

function aura(g: Ctx, x: number, y: number, r: number, color: string): void {
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
}

function glowDot(g: Ctx, x: number, y: number, rx: number, ry: number, fill: string, glow: string, blur = 6): void {
  g.save();
  g.fillStyle = fill;
  g.shadowColor = glow;
  g.shadowBlur = blur;
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, TAU);
  g.fill();
  g.restore();
}

function roundRect(g: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y);
  g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r);
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}

function poly(g: Ctx, pts: readonly (readonly [number, number])[]): void {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
}

/** The same drawing turned pure white: hit-flash frames. */
function flash(draw: Draw): Draw {
  return (g, w, h) => {
    draw(g, w, h);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
  };
}

/** Deterministic noise so the art is identical on every load. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** A bone mask: rounded plate, eye holes, a row of teeth. Original Hollow-style design. */
function mask(g: Ctx, cx: number, cy: number, w: number, h: number, eyes: number, teeth: boolean): void {
  const grad = g.createLinearGradient(0, cy - h / 2, 0, cy + h / 2);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, '#cfc8ba');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(cx - w / 2, cy - h * 0.15);
  g.quadraticCurveTo(cx - w / 2, cy - h / 2, cx, cy - h / 2);
  g.quadraticCurveTo(cx + w / 2, cy - h / 2, cx + w / 2, cy - h * 0.15);
  g.lineTo(cx + w * 0.34, cy + h / 2);
  g.lineTo(cx - w * 0.34, cy + h / 2);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 1;
  g.stroke();
  g.fillStyle = INK;
  const ew = w * 0.16;
  const eh = h * 0.2;
  const ey = cy - h * 0.08;
  if (eyes === 3) {
    g.beginPath();
    g.ellipse(cx, ey - eh * 1.1, ew * 0.8, eh * 0.75, 0, 0, TAU);
    g.fill();
  }
  g.beginPath();
  g.ellipse(cx - w * 0.2, ey, ew, eh, 0.35, 0, TAU);
  g.fill();
  g.beginPath();
  g.ellipse(cx + w * 0.2, ey, ew, eh, -0.35, 0, TAU);
  g.fill();
  // A red glint deep in each eye: Hollows watch you from the dark.
  g.save();
  g.fillStyle = '#ff4a66';
  g.shadowColor = '#ff2d4a';
  g.shadowBlur = Math.max(2, w * 0.12);
  const glint = Math.max(0.9, ew * 0.36);
  for (const [gx, gy] of eyes === 3
    ? [
        [cx - w * 0.2, ey],
        [cx + w * 0.2, ey],
        [cx, ey - eh * 1.1],
      ]
    : [
        [cx - w * 0.2, ey],
        [cx + w * 0.2, ey],
      ]) {
    g.beginPath();
    g.arc(gx, gy + eh * 0.15, glint, 0, TAU);
    g.fill();
  }
  g.restore();
  if (teeth) {
    const ty = cy + h * 0.3;
    g.fillStyle = INK;
    g.fillRect(cx - w * 0.24, ty - h * 0.06, w * 0.48, h * 0.12);
    g.fillStyle = '#e9e3d6';
    const n = 5;
    for (let k = 0; k < n; k++) {
      const x = cx - w * 0.24 + (k + 0.5) * ((w * 0.48) / n);
      poly(g, [
        [x - w * 0.035, ty - h * 0.06],
        [x + w * 0.035, ty - h * 0.06],
        [x, ty + h * 0.03],
      ]);
      g.fill();
    }
  }
}

/** Shadow body with a ragged rim, the base of every Hollow. */
function shadowBody(g: Ctx, cx: number, cy: number, r: number, lobes: number, seed: number, tint: string): void {
  const rnd = seeded(seed);
  const grad = g.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.1, cx, cy, r * 1.1);
  grad.addColorStop(0, tint);
  grad.addColorStop(0.6, '#15111f');
  grad.addColorStop(1, '#05040a');
  g.fillStyle = grad;
  g.beginPath();
  for (let k = 0; k <= lobes * 2; k++) {
    const a = (k / (lobes * 2)) * TAU;
    const rr = k % 2 === 0 ? r * (0.92 + rnd() * 0.12) : r * (0.78 + rnd() * 0.1);
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (k === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.fill();
}

/** The hole in a Hollow's chest. */
function chestHole(g: Ctx, cx: number, cy: number, r: number): void {
  g.save();
  g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  g.arc(cx, cy, r, 0, TAU);
  g.fill();
  g.restore();
  g.strokeStyle = 'rgba(255,60,90,0.55)';
  g.lineWidth = 1.2;
  g.beginPath();
  g.arc(cx, cy, r + 0.5, 0, TAU);
  g.stroke();
}

// ------------------------------------------------------- generic shapes

const glow: Draw = (g, w) => {
  const r = w / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, w);
};

const ring: Draw = (g, w) => {
  const c = w / 2;
  g.strokeStyle = 'rgba(255,255,255,0.3)';
  g.lineWidth = 10;
  g.beginPath();
  g.arc(c, c, c - 9, 0, TAU);
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(c, c, c - 9, 0, TAU);
  g.stroke();
};

const disc: Draw = (g, w) => {
  const c = w / 2;
  const grad = g.createRadialGradient(c, c, c * 0.55, c, c, c);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(c, c, c, 0, TAU);
  g.fill();
};

/** Warning disc: faint fill, crisp rim. */
const wfill: Draw = (g, w) => {
  const c = w / 2;
  const grad = g.createRadialGradient(c, c, 0, c, c, c - 2);
  grad.addColorStop(0, 'rgba(255,255,255,0.35)');
  grad.addColorStop(0.85, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0.9)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(c, c, c - 2, 0, TAU);
  g.fill();
};

/** A 120 degree sector with its apex at the left edge, for arc warnings. */
const wedge: Draw = (g, w, h) => {
  const cy = h / 2;
  const grad = g.createRadialGradient(0, cy, 0, 0, cy, w);
  grad.addColorStop(0, 'rgba(255,255,255,0.25)');
  grad.addColorStop(0.9, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0.9)');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(0, cy);
  g.arc(0, cy, w - 1, -Math.PI / 3, Math.PI / 3);
  g.closePath();
  g.fill();
};

const spark: Draw = (g, w) => {
  const c = w / 2;
  g.fillStyle = '#ffffff';
  g.beginPath();
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU - Math.PI / 2;
    const r = k % 2 === 0 ? c - 1 : c * 0.28;
    g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
};

const square: Draw = (g, w, h) => {
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, w, h);
};

/** Vertical pillar of light, brightest at the bottom (anchored there). */
const beam: Draw = (g, w, h) => {
  const c = w / 2;
  const fade = g.createLinearGradient(0, 0, 0, h);
  fade.addColorStop(0, 'rgba(255,255,255,0)');
  fade.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  fade.addColorStop(1, 'rgba(255,255,255,1)');
  g.fillStyle = fade;
  g.globalAlpha = 0.22;
  g.fillRect(c - w * 0.46, 0, w * 0.92, h);
  g.globalAlpha = 0.5;
  g.fillRect(c - w * 0.26, 0, w * 0.52, h);
  g.globalAlpha = 1;
  g.fillRect(c - w * 0.08, 0, w * 0.16, h);
};

/** Horizontal beam: soft edges, white core, tapered ends. Beams, Cero, fire slashes. */
const beamh: Draw = (g, w, h) => {
  const cy = h / 2;
  const along = g.createLinearGradient(0, 0, w, 0);
  along.addColorStop(0, 'rgba(255,255,255,0)');
  along.addColorStop(0.06, 'rgba(255,255,255,1)');
  along.addColorStop(0.94, 'rgba(255,255,255,1)');
  along.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = along;
  g.globalAlpha = 0.25;
  g.fillRect(0, cy - h * 0.48, w, h * 0.96);
  g.globalAlpha = 0.55;
  g.fillRect(0, cy - h * 0.28, w, h * 0.56);
  g.globalAlpha = 1;
  g.fillRect(0, cy - h * 0.1, w, h * 0.2);
};

/** Jagged lightning segment, stretched between two points. */
const bolt: Draw = (g, w, h) => {
  const rnd = seeded(7);
  const pts: [number, number][] = [];
  const n = 9;
  for (let k = 0; k <= n; k++) pts.push([(k / n) * w, h / 2 + (k === 0 || k === n ? 0 : (rnd() - 0.5) * h * 0.7)]);
  const stroke = (width: number, alpha: number): void => {
    g.strokeStyle = `rgba(255,255,255,${alpha})`;
    g.lineWidth = width;
    g.lineJoin = 'round';
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
  };
  stroke(8, 0.25);
  stroke(4, 0.5);
  stroke(1.6, 1);
};

/** A jet of fire along +x: hot core, ragged tongues. */
const flame: Draw = (g, w, h) => {
  const cy = h / 2;
  const rnd = seeded(31);
  for (let layer = 0; layer < 3; layer++) {
    const spread = h * (0.46 - layer * 0.13);
    g.globalAlpha = 0.35 + layer * 0.25;
    g.fillStyle = ['#ff5a1f', '#ffa640', '#fff1c4'][layer];
    g.beginPath();
    g.moveTo(0, cy);
    const n = 10;
    for (let k = 1; k <= n; k++) {
      const x = (k / n) * w;
      const amp = spread * Math.sin((k / n) * Math.PI) * (0.75 + rnd() * 0.35);
      g.lineTo(x, cy - amp);
    }
    for (let k = n; k >= 1; k--) {
      const x = (k / n) * w;
      const amp = spread * Math.sin((k / n) * Math.PI) * (0.75 + rnd() * 0.35);
      g.lineTo(x - w * 0.03, cy + amp);
    }
    g.closePath();
    g.fill();
  }
  g.globalAlpha = 1;
};

/** Quincy arrow of light pointing along +x. */
const arrow: Draw = (g, w, h) => {
  const cy = h / 2;
  const trail = g.createLinearGradient(0, 0, w, 0);
  trail.addColorStop(0, 'rgba(90,180,255,0)');
  trail.addColorStop(1, 'rgba(150,215,255,0.65)');
  g.fillStyle = trail;
  poly(g, [
    [2, cy],
    [w - 12, cy - 6],
    [w - 12, cy + 6],
  ]);
  g.fill();
  g.strokeStyle = '#ffffff';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(12, cy);
  g.lineTo(w - 12, cy);
  g.stroke();
  g.fillStyle = '#eef9ff';
  poly(g, [
    [w - 1, cy],
    [w - 17, cy - 6],
    [w - 12, cy],
    [w - 17, cy + 6],
  ]);
  g.fill();
};

/** Reishi blade (Seele Schneider-style): a slim glowing blade along +x, spun by the renderer. */
const blade: Draw = (g, w, h) => {
  const cx = w / 2;
  const cy = h / 2;
  g.save();
  g.shadowColor = 'rgba(140,210,255,0.95)';
  g.shadowBlur = 8;
  const grad = g.createLinearGradient(0, cy, w, cy);
  grad.addColorStop(0, '#9fdcff');
  grad.addColorStop(0.5, '#ffffff');
  grad.addColorStop(1, '#9fdcff');
  g.fillStyle = grad;
  poly(g, [
    [3, cy],
    [cx, cy - h * 0.18],
    [w - 3, cy],
    [cx, cy + h * 0.18],
  ]);
  g.fill();
  g.restore();
};

const petal: Draw = (g, w, h) => {
  const grad = g.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, '#ff9cc2');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(2, h / 2);
  g.quadraticCurveTo(w * 0.5, -h * 0.2, w - 2, h / 2);
  g.quadraticCurveTo(w * 0.5, h * 1.2, 2, h / 2);
  g.fill();
};

const bomb: Draw = (g, w) => {
  const c = w / 2;
  aura(g, c, c, c, 'rgba(255,170,90,0.5)');
  const grad = g.createRadialGradient(c - 3, c - 3, 1, c, c, c * 0.6);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.5, '#9fdcff');
  grad.addColorStop(1, '#3a7fd6');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(c, c, c * 0.55, 0, TAU);
  g.fill();
  g.strokeStyle = '#ffd9a8';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(c - 4, c - 2);
  g.lineTo(c + 1, c + 1);
  g.lineTo(c - 1, c + 5);
  g.stroke();
};

const thorn: Draw = (g, w, h) => {
  const cy = h / 2;
  g.save();
  g.shadowColor = 'rgba(200,140,255,0.9)';
  g.shadowBlur = 5;
  g.fillStyle = '#e8d4ff';
  poly(g, [
    [w - 1, cy],
    [2, cy - h * 0.38],
    [w * 0.25, cy],
    [2, cy + h * 0.38],
  ]);
  g.fill();
  g.restore();
};

/** A small missile along +x with a flame tail (The Knowledge, Jakuhō Raikōben). */
const missile: Draw = (g, w, h) => {
  const cy = h / 2;
  const tail = g.createLinearGradient(0, 0, w * 0.45, 0);
  tail.addColorStop(0, 'rgba(255,140,60,0)');
  tail.addColorStop(1, 'rgba(255,200,120,0.9)');
  g.fillStyle = tail;
  poly(g, [
    [0, cy],
    [w * 0.45, cy - h * 0.28],
    [w * 0.45, cy + h * 0.28],
  ]);
  g.fill();
  g.fillStyle = '#d7dde8';
  roundRect(g, w * 0.4, cy - h * 0.22, w * 0.45, h * 0.44, h * 0.18);
  g.fill();
  g.fillStyle = '#ffcb5c';
  poly(g, [
    [w * 0.85, cy - h * 0.22],
    [w - 1, cy],
    [w * 0.85, cy + h * 0.22],
  ]);
  g.fill();
};

/** An original ice dragon along +x: a serpent of ice with swept wings. */
const dragon: Draw = (g, w, h) => {
  const cy = h / 2;
  g.save();
  g.shadowColor = 'rgba(150,220,255,0.9)';
  g.shadowBlur = 8;
  const body = g.createLinearGradient(0, 0, w, 0);
  body.addColorStop(0, 'rgba(140,210,255,0)');
  body.addColorStop(0.4, 'rgba(180,230,255,0.85)');
  body.addColorStop(1, '#ffffff');
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(0, cy);
  g.bezierCurveTo(w * 0.3, cy - h * 0.25, w * 0.55, cy + h * 0.2, w * 0.8, cy - h * 0.05);
  g.lineTo(w - 2, cy);
  g.lineTo(w * 0.8, cy + h * 0.12);
  g.bezierCurveTo(w * 0.55, cy + h * 0.32, w * 0.3, cy - h * 0.08, 0, cy);
  g.fill();
  g.fillStyle = 'rgba(210,240,255,0.75)';
  poly(g, [
    [w * 0.55, cy],
    [w * 0.35, cy - h * 0.48],
    [w * 0.66, cy - h * 0.08],
  ]);
  g.fill();
  poly(g, [
    [w * 0.55, cy + h * 0.06],
    [w * 0.35, cy + h * 0.48],
    [w * 0.66, cy + h * 0.14],
  ]);
  g.fill();
  g.restore();
  glowDot(g, w * 0.88, cy - h * 0.04, 1.6, 1.6, '#ffffff', '#9fe0ff');
};

/** The Knowledge drone: a dark disc with a blue lens and four tendril stubs. */
const drone: Draw = (g, w) => {
  const c = w / 2;
  g.strokeStyle = '#5a6a86';
  g.lineWidth = 2;
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + Math.PI / 4;
    g.beginPath();
    g.moveTo(c + Math.cos(a) * c * 0.4, c + Math.sin(a) * c * 0.4);
    g.lineTo(c + Math.cos(a) * c * 0.95, c + Math.sin(a) * c * 0.95);
    g.stroke();
  }
  const grad = g.createRadialGradient(c - 3, c - 3, 1, c, c, c * 0.55);
  grad.addColorStop(0, '#4b5770');
  grad.addColorStop(1, '#12161f');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(c, c, c * 0.5, 0, TAU);
  g.fill();
  glowDot(g, c, c, c * 0.18, c * 0.18, '#bfe6ff', '#59b8ff', 8);
};

const shard: Draw = (g, w, h) => {
  g.fillStyle = '#ffffff';
  poly(g, [
    [w - 1, h / 2],
    [2, 2],
    [5, h / 2],
    [2, h - 2],
  ]);
  g.fill();
};

/** A broken piece of bone mask (death effect). */
const maskShard: Draw = (g, w, h) => {
  g.fillStyle = BONE;
  poly(g, [
    [1, h * 0.3],
    [w * 0.55, 1],
    [w - 1, h * 0.45],
    [w * 0.6, h - 1],
    [w * 0.2, h * 0.8],
  ]);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.4)';
  g.lineWidth = 1;
  g.stroke();
};

/** Dark ash puff (normal blend). */
const ash: Draw = (g, w) => {
  const rnd = seeded(5);
  for (let k = 0; k < 7; k++) {
    const x = w * (0.3 + rnd() * 0.4);
    const y = w * (0.3 + rnd() * 0.4);
    aura(g, x, y, w * (0.2 + rnd() * 0.15), 'rgba(255,255,255,0.55)');
  }
};

const star: Draw = (g, w) => {
  const c = w / 2;
  g.fillStyle = '#ffffff';
  g.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU - Math.PI / 2;
    const r = k % 2 ? c * 0.4 : c - 1;
    g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
};

const snow: Draw = (g, w) => {
  const c = w / 2;
  g.strokeStyle = '#ffffff';
  g.lineWidth = 1.6;
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI;
    g.beginPath();
    g.moveTo(c + Math.cos(a) * (c - 1), c + Math.sin(a) * (c - 1));
    g.lineTo(c - Math.cos(a) * (c - 1), c - Math.sin(a) * (c - 1));
    g.stroke();
  }
};

/** A falling meteor: burning rock with a trail toward the upper left. */
const meteor: Draw = (g, w, h) => {
  const tail = g.createLinearGradient(0, 0, w * 0.7, h * 0.7);
  tail.addColorStop(0, 'rgba(255,170,80,0)');
  tail.addColorStop(1, 'rgba(255,210,140,0.85)');
  g.strokeStyle = tail;
  g.lineCap = 'round';
  g.lineWidth = w * 0.22;
  g.beginPath();
  g.moveTo(w * 0.1, h * 0.1);
  g.lineTo(w * 0.66, h * 0.66);
  g.stroke();
  const grad = g.createRadialGradient(w * 0.68, h * 0.68, 1, w * 0.7, h * 0.7, w * 0.22);
  grad.addColorStop(0, '#fff6dc');
  grad.addColorStop(0.5, '#ffb050');
  grad.addColorStop(1, '#7a2e10');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(w * 0.7, h * 0.7, w * 0.2, 0, TAU);
  g.fill();
};

/** A huge crescent slash, opening along +x (the giant warrior's cleave). */
const crescent: Draw = (g, w, h) => {
  const cy = h / 2;
  g.save();
  g.shadowColor = 'rgba(255,235,190,0.9)';
  g.shadowBlur = 14;
  const grad = g.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.6, 'rgba(255,245,220,0.75)');
  grad.addColorStop(1, '#ffffff');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(w * 0.15, 2);
  g.quadraticCurveTo(w * 1.15, cy, w * 0.15, h - 2);
  g.quadraticCurveTo(w * 0.78, cy, w * 0.15, 2);
  g.fill();
  g.restore();
};

/**
 * Tengen's warrior: a giant in armour rising behind you, seen from the front,
 * drawn in translucent gold light: crested helm with a glowing visor slit,
 * broad pauldrons, a great blade raised over the right shoulder. Original design.
 */
const avatar: Draw = (g, w, h) => {
  const cx = w / 2;
  g.save();
  g.shadowColor = 'rgba(255,214,140,0.9)';
  g.shadowBlur = 10;
  // The great blade, raised behind the right shoulder
  g.fillStyle = 'rgba(255,246,222,0.7)';
  poly(g, [
    [cx + w * 0.3, h * 0.5],
    [cx + w * 0.36, h * 0.5],
    [cx + w * 0.47, h * 0.02],
    [cx + w * 0.42, h * 0.04],
  ]);
  g.fill();
  g.fillStyle = 'rgba(200,160,90,0.8)';
  g.fillRect(cx + w * 0.27, h * 0.48, w * 0.12, h * 0.03);
  // Body and skirt of plates
  const body = g.createLinearGradient(0, h * 0.3, 0, h);
  body.addColorStop(0, 'rgba(255,236,190,0.75)');
  body.addColorStop(1, 'rgba(255,220,150,0.08)');
  g.fillStyle = body;
  poly(g, [
    [cx - w * 0.24, h * 0.36],
    [cx + w * 0.24, h * 0.36],
    [cx + w * 0.3, h * 0.98],
    [cx - w * 0.3, h * 0.98],
  ]);
  g.fill();
  g.strokeStyle = 'rgba(140,100,40,0.45)';
  g.lineWidth = 1.5;
  for (let k = 1; k < 5; k++) {
    const y = h * (0.36 + k * 0.13);
    g.beginPath();
    g.moveTo(cx - w * (0.24 + k * 0.012), y);
    g.lineTo(cx + w * (0.24 + k * 0.012), y);
    g.stroke();
  }
  // Pauldrons
  g.fillStyle = 'rgba(255,240,205,0.85)';
  for (const dir of [-1, 1]) {
    g.beginPath();
    g.ellipse(cx + dir * w * 0.27, h * 0.36, w * 0.17, h * 0.085, dir * 0.2, 0, TAU);
    g.fill();
  }
  // Helm with a crest and a glowing visor slit
  g.fillStyle = 'rgba(255,246,222,0.9)';
  g.beginPath();
  g.ellipse(cx, h * 0.23, w * 0.13, h * 0.12, 0, 0, TAU);
  g.fill();
  poly(g, [
    [cx - w * 0.035, h * 0.13],
    [cx, h * 0.02],
    [cx + w * 0.035, h * 0.13],
  ]);
  g.fill();
  g.restore();
  glowDot(g, cx, h * 0.24, w * 0.08, h * 0.012, '#fff8e0', '#ffb347', 8);
};

/** A bolt of lightning from the sky down to the bottom edge: jagged, branching, white-hot core. */
const lightning: Draw = (g, w, h) => {
  const rnd = seeded(77);
  const cx = w / 2;
  const pts: [number, number][] = [[cx + (rnd() - 0.5) * 8, 0]];
  const segs = 9;
  for (let k = 1; k <= segs; k++) {
    const y = (h - 2) * (k / segs);
    const x = k === segs ? cx : cx + (rnd() - 0.5) * w * 0.6;
    pts.push([x, y]);
  }
  const stroke = (width: number, color: string, blur: number, path: [number, number][]): void => {
    g.save();
    g.strokeStyle = color;
    g.lineWidth = width;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.shadowColor = 'rgba(255,240,170,0.9)';
    g.shadowBlur = blur;
    g.beginPath();
    path.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
    g.restore();
  };
  // Two forks off the main bolt
  const forks: [number, number][][] = [];
  for (const at of [3, 6]) {
    const [x0, y0] = pts[at];
    const dir = rnd() < 0.5 ? -1 : 1;
    forks.push([
      [x0, y0],
      [x0 + dir * w * 0.18, y0 + h * 0.07],
      [x0 + dir * w * 0.3, y0 + h * 0.14],
    ]);
  }
  stroke(w * 0.34, 'rgba(255,236,160,0.28)', 14, pts);
  for (const f of forks) stroke(w * 0.12, 'rgba(255,236,160,0.35)', 8, f);
  stroke(w * 0.11, 'rgba(255,248,210,0.95)', 6, pts);
  for (const f of forks) stroke(w * 0.05, 'rgba(255,250,230,0.9)', 4, f);
  stroke(w * 0.04, '#ffffff', 0, pts);
};

/** A shockwave: a bright rim fading inward, for rings of force. */
const shock: Draw = (g, w) => {
  const c = w / 2;
  const grad = g.createRadialGradient(c, c, c * 0.45, c, c, c - 2);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.18)');
  grad.addColorStop(0.92, 'rgba(255,255,255,0.85)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(c, c, c - 1, 0, TAU);
  g.fill();
};

/** A motion streak, faint at the tail (left) and bright at the head (right), tapering. */
const trail: Draw = (g, w, h) => {
  const cy = h / 2;
  const grad = g.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(1, 'rgba(255,255,255,0.9)');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(0, cy);
  g.lineTo(w - 2, cy - h * 0.42);
  g.quadraticCurveTo(w, cy, w - 2, cy + h * 0.42);
  g.closePath();
  g.fill();
};

/** A soft puff of smoke. */
const smoke: Draw = (g, w) => {
  const rnd = seeded(31);
  for (let k = 0; k < 5; k++) {
    const x = w / 2 + (rnd() - 0.5) * w * 0.3;
    const y = w / 2 + (rnd() - 0.5) * w * 0.3;
    const r = w * (0.22 + rnd() * 0.12);
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  }
};

/** Quincy: Vollständig wings of light, spread to both sides. */
const wings: Draw = (g, w, h) => {
  const cx = w / 2;
  const cy = h * 0.55;
  g.save();
  g.shadowColor = 'rgba(160,220,255,0.9)';
  g.shadowBlur = 10;
  for (const dir of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const grad = g.createLinearGradient(cx, cy, cx + dir * w * 0.5, cy - h * 0.4);
      grad.addColorStop(0, 'rgba(255,255,255,0.9)');
      grad.addColorStop(1, 'rgba(160,220,255,0.1)');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(cx + dir * 6, cy);
      g.quadraticCurveTo(cx + dir * w * (0.25 + k * 0.05), cy - h * (0.55 - k * 0.1), cx + dir * w * (0.48 - k * 0.04), cy - h * (0.2 - k * 0.12));
      g.quadraticCurveTo(cx + dir * w * 0.2, cy - h * 0.05, cx + dir * 6, cy + 4);
      g.fill();
    }
  }
  g.restore();
};

/** The Glutton's bite: two jaws of teeth seen from above, open toward +x. Drawn light so a tint colours it. */
const maw: Draw = (g, w, h) => {
  const cy = h / 2;
  const x0 = 10;
  const x1 = w - 6;
  const open = h * 0.36;
  // The gullet between the jaws
  const gullet = g.createRadialGradient(w * 0.4, cy, 4, w * 0.45, cy, w * 0.5);
  gullet.addColorStop(0, 'rgba(60,8,18,0.85)');
  gullet.addColorStop(1, 'rgba(120,20,40,0)');
  g.fillStyle = gullet;
  g.beginPath();
  g.ellipse(w * 0.45, cy, w * 0.42, open * 0.9, 0, 0, TAU);
  g.fill();
  for (const dir of [-1, 1]) {
    // Gum: a thick curved band
    g.fillStyle = '#e8a0a8';
    g.beginPath();
    for (let k = 0; k <= 20; k++) {
      const t = k / 20;
      const x = x0 + (x1 - x0) * t;
      const y = cy + dir * (open * Math.sin(Math.PI * (0.15 + 0.7 * t)) + 4);
      if (k === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    for (let k = 20; k >= 0; k--) {
      const t = k / 20;
      const x = x0 + (x1 - x0) * t;
      const y = cy + dir * (open * Math.sin(Math.PI * (0.15 + 0.7 * t)) + 14);
      g.lineTo(x, y);
    }
    g.closePath();
    g.fill();
    // Teeth pointing into the mouth
    g.fillStyle = '#ffffff';
    for (let k = 1; k < 9; k++) {
      const t = k / 9;
      const x = x0 + (x1 - x0) * t;
      const y = cy + dir * (open * Math.sin(Math.PI * (0.15 + 0.7 * t)) + 4);
      const len = 9 + (k % 2) * 3;
      poly(g, [
        [x - 4.5, y],
        [x + 4.5, y],
        [x, y - dir * len],
      ]);
      g.fill();
    }
  }
};

/** The Power's fist: a big gauntleted fist of light, punching toward +x. */
const fist: Draw = (g, w, h) => {
  const cy = h / 2;
  g.save();
  g.shadowColor = 'rgba(255,214,150,0.9)';
  g.shadowBlur = 8;
  // Cuff
  g.fillStyle = '#e9d6b0';
  roundRect(g, 4, cy - 11, 16, 22, 4);
  g.fill();
  // Back of the hand and knuckles
  const grad = g.createLinearGradient(16, 0, w - 4, 0);
  grad.addColorStop(0, '#fff3dc');
  grad.addColorStop(1, '#ffffff');
  g.fillStyle = grad;
  roundRect(g, 16, cy - 15, w - 22, 30, 9);
  g.fill();
  g.restore();
  // Finger creases and the thumb
  g.strokeStyle = 'rgba(120,90,40,0.45)';
  g.lineWidth = 1.4;
  for (let k = 1; k < 4; k++) {
    const y = cy - 15 + k * 7.5;
    g.beginPath();
    g.moveTo(w - 16, y);
    g.lineTo(w - 6, y);
    g.stroke();
  }
  g.fillStyle = '#f2e2c2';
  g.beginPath();
  g.ellipse(w * 0.55, cy + 12, 9, 4.5, -0.2, 0, TAU);
  g.fill();
};

/** A · The Almighty: an eye of light opening over the field, a five-pointed Quincy star for a pupil. Original design. */
const eye: Draw = (g, w, h) => {
  const cx = w / 2;
  const cy = h / 2;
  const almond = (inset: number): void => {
    g.beginPath();
    g.moveTo(inset, cy);
    g.quadraticCurveTo(cx, -h * 0.35 + inset, w - inset, cy);
    g.quadraticCurveTo(cx, h * 1.35 - inset, inset, cy);
    g.closePath();
  };
  g.save();
  almond(6);
  g.fillStyle = 'rgba(8,10,24,0.85)';
  g.fill();
  g.shadowColor = 'rgba(255,230,160,0.95)';
  g.shadowBlur = 14;
  g.strokeStyle = '#fff6dc';
  g.lineWidth = 3;
  g.stroke();
  g.restore();
  g.save();
  almond(6);
  g.clip();
  const r = h * 0.36;
  const iris = g.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
  iris.addColorStop(0, '#fff6dc');
  iris.addColorStop(0.45, '#ffcb5c');
  iris.addColorStop(1, 'rgba(120,80,20,0.9)');
  g.fillStyle = iris;
  g.beginPath();
  g.arc(cx, cy, r, 0, TAU);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.7)';
  g.lineWidth = 1.5;
  g.beginPath();
  g.arc(cx, cy, r * 0.78, 0, TAU);
  g.stroke();
  g.fillStyle = INK;
  g.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU - Math.PI / 2;
    const rr = k % 2 === 0 ? r * 0.62 : r * 0.25;
    g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
  g.restore();
};

/** The Love's heart ray: a crisp heart of light, no halo, so it reads at a glance. */
const loveHeart: Draw = (g, w, h) => {
  const cx = w / 2;
  g.save();
  g.shadowColor = 'rgba(255,140,190,0.9)';
  g.shadowBlur = 5;
  const grad = g.createLinearGradient(0, 2, 0, h - 2);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, '#ffc2dc');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(cx, h - 3);
  g.bezierCurveTo(cx - w * 0.55, h * 0.5, cx - w * 0.3, -h * 0.05, cx, h * 0.3);
  g.bezierCurveTo(cx + w * 0.3, -h * 0.05, cx + w * 0.55, h * 0.5, cx, h - 3);
  g.closePath();
  g.fill();
  g.restore();
};

/** The Jail from above: a ring of posts with crossed bars over the top. */
const cage: Draw = (g, w) => {
  const c = w / 2;
  const R = c - 6;
  g.save();
  g.beginPath();
  g.arc(c, c, R, 0, TAU);
  g.clip();
  g.fillStyle = 'rgba(200,220,255,0.12)';
  g.fillRect(0, 0, w, w);
  g.strokeStyle = 'rgba(255,255,255,0.55)';
  g.lineWidth = 2;
  for (let k = -3; k <= 3; k++) {
    g.beginPath();
    g.moveTo(c + k * 16, 0);
    g.lineTo(c + k * 16, w);
    g.stroke();
    g.beginPath();
    g.moveTo(0, c + k * 16);
    g.lineTo(w, c + k * 16);
    g.stroke();
  }
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(c, c, R, 0, TAU);
  g.stroke();
  g.fillStyle = '#ffffff';
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU;
    g.beginPath();
    g.arc(c + Math.cos(a) * R, c + Math.sin(a) * R, 4.5, 0, TAU);
    g.fill();
  }
};

const shadow: Draw = (g, w, h) => {
  g.save();
  g.translate(w / 2, h / 2);
  g.scale(1, h / w);
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, w / 2);
  grad.addColorStop(0, 'rgba(0,0,0,0.75)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(0, 0, w / 2, 0, TAU);
  g.fill();
  g.restore();
};

const pointer: Draw = (g, w, h) => {
  g.save();
  g.shadowColor = 'rgba(255,255,255,0.8)';
  g.shadowBlur = 5;
  g.fillStyle = '#ffffff';
  poly(g, [
    [w - 3, h / 2],
    [5, 4],
    [10, h / 2],
    [5, h - 4],
  ]);
  g.fill();
  g.restore();
};

function gem(top: string, bottom: string): Draw {
  return (g, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bottom);
    g.fillStyle = grad;
    poly(g, [
      [cx, 1],
      [w - 3, cy],
      [cx, h - 1],
      [3, cy],
    ]);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = 1.2;
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.8)';
    poly(g, [
      [cx, 4],
      [cx + 4, cy - 1],
      [cx, cy],
    ]);
    g.fill();
  };
}

function digit(ch: string): Draw {
  return (g, w, h) => {
    g.font = 'bold 26px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = 5;
    g.strokeStyle = 'rgba(0,0,0,0.85)';
    g.strokeText(ch, w / 2, h / 2 + 1);
    g.fillStyle = '#ffffff';
    g.fillText(ch, w / 2, h / 2 + 1);
  };
}

// ------------------------------------------------------- zone textures

const cloud: Draw = (g, w) => {
  const rnd = seeded(11);
  for (let k = 0; k < 9; k++) {
    const a = rnd() * TAU;
    const d = rnd() * w * 0.22;
    aura(g, w / 2 + Math.cos(a) * d, w / 2 + Math.sin(a) * d, w * (0.22 + rnd() * 0.12), 'rgba(255,255,255,0.32)');
  }
};

const firezone: Draw = (g, w) => {
  const c = w / 2;
  aura(g, c, c, c, 'rgba(255,255,255,0.35)');
  const rnd = seeded(23);
  g.fillStyle = 'rgba(255,255,255,0.65)';
  for (let k = 0; k < 7; k++) {
    const a = rnd() * TAU;
    const d = rnd() * c * 0.55;
    const x = c + Math.cos(a) * d;
    const y = c + Math.sin(a) * d;
    const s = c * (0.12 + rnd() * 0.1);
    g.beginPath();
    g.moveTo(x, y - s * 2.2);
    g.quadraticCurveTo(x + s, y - s * 0.4, x, y + s);
    g.quadraticCurveTo(x - s, y - s * 0.4, x, y - s * 2.2);
    g.fill();
  }
};

const gust: Draw = (g, w) => {
  const c = w / 2;
  g.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    g.strokeStyle = `rgba(255,255,255,${0.75 - k * 0.2})`;
    g.lineWidth = 5 - k;
    g.beginPath();
    for (let s = 0; s <= 40; s++) {
      const t = s / 40;
      const a = t * TAU * 1.4 + (k * TAU) / 3;
      const r = c * (0.15 + t * 0.78);
      const x = c + Math.cos(a) * r;
      const y = c + Math.sin(a) * r;
      if (s === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
};

const frost: Draw = (g, w) => {
  const c = w / 2;
  aura(g, c, c, c, 'rgba(255,255,255,0.3)');
  g.strokeStyle = 'rgba(255,255,255,0.75)';
  g.lineWidth = 2;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU;
    g.beginPath();
    g.moveTo(c, c);
    g.lineTo(c + Math.cos(a) * c * 0.85, c + Math.sin(a) * c * 0.85);
    g.stroke();
  }
};

// ------------------------------------------------------------- the hero

/** A Quincy shrine: a stone plinth with the five-pointed cross burning blue above it. */
const shrine: Draw = (g, w, h) => {
  const cx = w / 2;
  const stone = g.createLinearGradient(0, h * 0.55, 0, h);
  stone.addColorStop(0, '#a3abc0');
  stone.addColorStop(1, '#4b5266');
  g.fillStyle = stone;
  g.beginPath();
  g.moveTo(cx - 11, h * 0.56);
  g.lineTo(cx + 11, h * 0.56);
  g.lineTo(cx + 16, h - 3);
  g.lineTo(cx - 16, h - 3);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(20,24,36,0.6)';
  g.lineWidth = 1;
  g.stroke();
  g.fillStyle = '#d3d9e6';
  g.fillRect(cx - 15, h * 0.52, 30, 4);
  g.fillStyle = 'rgba(20,24,36,0.35)';
  g.fillRect(cx - 7, h * 0.66, 14, 2);
  g.save();
  g.shadowColor = '#59b8ff';
  g.shadowBlur = 9;
  g.strokeStyle = '#bfe6ff';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(cx, h * 0.29, 12, 0, TAU);
  g.stroke();
  g.fillStyle = '#eaf7ff';
  g.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU - Math.PI / 2;
    const r = k % 2 === 0 ? 10.5 : 4.2;
    g.lineTo(cx + Math.cos(a) * r, h * 0.29 + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  g.restore();
};

/** A crimson eye with a slit pupil, for the Emperor's evolutions. */
function crimsonEye(g: Ctx, x: number, y: number, s: number): void {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.shadowColor = '#ff2d4a';
  g.shadowBlur = 4;
  g.fillStyle = '#ff3b55';
  g.beginPath();
  g.moveTo(-4, 0);
  g.quadraticCurveTo(0, -3.2, 4, 0);
  g.quadraticCurveTo(0, 3.2, -4, 0);
  g.fill();
  g.shadowBlur = 0;
  g.fillStyle = '#12020a';
  g.fillRect(-0.6, -1.9, 1.2, 3.8);
  g.restore();
}

/**
 * The first sign of the Emperor's power: two fans of reishi feathers behind
 * his shoulders. Centred on the hero's shoulders (his (30, 30)).
 */
const evoWings: Draw = (g, w, h) => {
  const cx = w / 2;
  const cy = h / 2;
  g.save();
  g.shadowColor = 'rgba(120,200,255,0.9)';
  g.shadowBlur = 6;
  for (const dir of [-1, 1]) {
    for (let k = 0; k < 6; k++) {
      // From up and out to out and down; the upper feathers are the longest.
      const a = -0.7 + k * 0.26;
      const len = 46 - k * 4;
      const x0 = cx + dir * 6;
      const y0 = cy - 3 + k * 1.4;
      const tx = x0 + dir * Math.cos(a) * len;
      const ty = y0 + Math.sin(a) * len;
      const dx = tx - x0;
      const dy = ty - y0;
      const d = Math.hypot(dx, dy) || 1;
      const nx = (-dy / d) * 3.4;
      const ny = (dx / d) * 3.4;
      const grad = g.createLinearGradient(x0, y0, tx, ty);
      grad.addColorStop(0, 'rgba(205,238,255,0.95)');
      grad.addColorStop(1, 'rgba(80,160,255,0.08)');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x0 + dx * 0.45 + nx, y0 + dy * 0.45 + ny);
      g.lineTo(tx, ty);
      g.lineTo(x0 + dx * 0.45 - nx, y0 + dy * 0.45 - ny);
      g.closePath();
      g.fill();
    }
  }
  g.restore();
};

/** The second sign: crimson eyes opening across his cape and coat. Drawn over the hero, in his coordinates. */
const evoEyes: Draw = (g) => {
  for (const [x, y, s] of [
    [12, 51, 1],
    [48, 51, 1],
    [9, 62, 0.9],
    [51, 62, 0.9],
    [19, 66, 0.75],
    [41, 66, 0.75],
    [12, 42, 0.7],
    [48, 42, 0.7],
  ] as const) {
    crimsonEye(g, x, y, s);
  }
};

/** The Almighty: a shadow of black flame around him, full of eyes. Centred on his (30, 40). */
const evoShadow: Draw = (g, w, h) => {
  const cx = w / 2;
  const cy = h / 2;
  const rnd = seeded(77);
  const grad = g.createRadialGradient(cx, cy + 6, 6, cx, cy, w * 0.5);
  grad.addColorStop(0, 'rgba(4,2,8,0.95)');
  grad.addColorStop(0.65, 'rgba(10,4,16,0.72)');
  grad.addColorStop(1, 'rgba(10,4,16,0)');
  g.fillStyle = grad;
  g.beginPath();
  const n = 22;
  for (let k = 0; k <= n; k++) {
    const a = (k / n) * TAU - Math.PI / 2;
    // Flames climb higher above him than below.
    const up = Math.max(0, -Math.sin(a));
    const r = w * (0.3 + rnd() * 0.08 + up * (0.12 + rnd() * 0.08)) * (k % 2 ? 0.86 : 1);
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r * 0.95;
    if (k === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.fill();
  for (let k = 0; k < 9; k++) {
    const a = rnd() * TAU;
    const d = w * (0.18 + rnd() * 0.17);
    crimsonEye(g, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.9, 0.75 + rnd() * 0.6);
  }
};

/** The colours of one of the Emperor's looks. */
interface HeroLook {
  cape: string;
  coatTop: string;
  coatBottom: string;
  trim: string;
  star: string;
  starGlow: string;
  sleeve: string;
  cuff: string;
  collar: string;
  lining: string;
}

/** Every look the Emperor can wear (see data/looks.ts): three from feats, five bought in the Wardrobe. */
const HERO_LOOKS: Readonly<Record<string, HeroLook>> = {
  default: {
    cape: '#0a0b10',
    coatTop: '#262833',
    coatBottom: '#07080c',
    trim: 'rgba(232,236,246,0.5)',
    star: '#eef2fa',
    starGlow: 'rgba(160,210,255,0.9)',
    sleeve: '#14151c',
    cuff: '#d9d2c4',
    collar: '#101117',
    lining: '#7a1e2c',
  },
  // Wandenreich White: the knights' white uniform, lined in black, a blue star.
  white: {
    cape: '#e9ecf3',
    coatTop: '#ffffff',
    coatBottom: '#c7cddb',
    trim: 'rgba(20,24,36,0.55)',
    star: '#59b8ff',
    starGlow: 'rgba(89,184,255,0.9)',
    sleeve: '#e3e7ef',
    cuff: '#1a1c26',
    collar: '#f4f6fa',
    lining: '#1a1c26',
  },
  crimson: {
    cape: '#3a0a12',
    coatTop: '#5e1622',
    coatBottom: '#1c0508',
    trim: 'rgba(255,200,200,0.45)',
    star: '#ffd6d6',
    starGlow: 'rgba(255,45,74,0.9)',
    sleeve: '#3c0c15',
    cuff: '#d9c4c4',
    collar: '#2a0810',
    lining: '#0b0b11',
  },
  gilded: {
    cape: '#0a0b10',
    coatTop: '#262833',
    coatBottom: '#07080c',
    trim: 'rgba(255,210,120,0.85)',
    star: '#ffd25a',
    starGlow: 'rgba(255,200,90,0.95)',
    sleeve: '#14151c',
    cuff: '#e8c870',
    collar: '#101117',
    lining: '#c9a040',
  },
  // Schatten: the shadow realm the Wandenreich hid in. Violet-black, a violet star.
  schatten: {
    cape: '#120a1e',
    coatTop: '#2c1e44',
    coatBottom: '#0a0612',
    trim: 'rgba(196,160,255,0.55)',
    star: '#ece2ff',
    starGlow: 'rgba(154,122,255,0.95)',
    sleeve: '#1c1230',
    cuff: '#c9b8ff',
    collar: '#140c22',
    lining: '#5a2a9a',
  },
  // Blut: black, the trim running red like the veins of Blut Arterie.
  blut: {
    cape: '#0b0709',
    coatTop: '#2c1418',
    coatBottom: '#080406',
    trim: 'rgba(255,61,94,0.75)',
    star: '#ffd0d8',
    starGlow: 'rgba(255,45,74,0.95)',
    sleeve: '#1a0c10',
    cuff: '#ff5a70',
    collar: '#120a0c',
    lining: '#b0142e',
  },
  // Silbern: the silver of the Wandenreich's capital, trimmed in ice blue.
  silbern: {
    cape: '#c4ccd8',
    coatTop: '#eef2f8',
    coatBottom: '#a4aec0',
    trim: 'rgba(60,120,200,0.65)',
    star: '#bfe6ff',
    starGlow: 'rgba(120,200,255,0.95)',
    sleeve: '#d8dee8',
    cuff: '#4a7ab8',
    collar: '#e4e9f1',
    lining: '#3a6ab0',
  },
  // Heilig: holy white and gold.
  heilig: {
    cape: '#f2eee2',
    coatTop: '#fffdf6',
    coatBottom: '#e0d6bc',
    trim: 'rgba(201,160,64,0.85)',
    star: '#ffd25a',
    starGlow: 'rgba(255,210,90,0.95)',
    sleeve: '#f2ecdc',
    cuff: '#c9a040',
    collar: '#faf6ea',
    lining: '#c9a040',
  },
  // Kaiser: a black coat under a royal purple cape, gold at every edge.
  kaiser: {
    cape: '#2c1040',
    coatTop: '#22222c',
    coatBottom: '#07080c',
    trim: 'rgba(255,210,120,0.85)',
    star: '#ffd25a',
    starGlow: 'rgba(255,200,90,0.95)',
    sleeve: '#14151c',
    cuff: '#e8c870',
    collar: '#101117',
    lining: '#7a3aaa',
  },
};

/** The look ids the atlas draws. */
export const HERO_LOOK_IDS: readonly string[] = Object.keys(HERO_LOOKS);

/** The cape hangs from his shoulders here: the renderer turns it about this point. */
export const CAPE_PIVOT = { x: 0.5, y: 27 / 72 } as const;

/**
 * The Emperor's cape, on its own so it can trail behind him as he moves: the
 * lining shows along the hem, folds run down it, and a pale rim keeps the
 * black silhouette readable at night.
 */
function heroCape(look: HeroLook): Draw {
  return (g, w) => {
    const cx = w / 2;
    const outline = (): void => {
      g.beginPath();
      g.moveTo(cx - 10, 27);
      g.quadraticCurveTo(cx - 27.5, 50, cx - 24.5, 71);
      g.quadraticCurveTo(cx, 67.5, cx + 24.5, 71);
      g.quadraticCurveTo(cx + 27.5, 50, cx + 10, 27);
      g.closePath();
    };
    g.fillStyle = look.lining;
    outline();
    g.fill();
    // The cape itself, a little shorter, so the lining frames its hem.
    g.beginPath();
    g.moveTo(cx - 10, 27);
    g.quadraticCurveTo(cx - 26.2, 50, cx - 23, 68.6);
    g.quadraticCurveTo(cx, 65.4, cx + 23, 68.6);
    g.quadraticCurveTo(cx + 26.2, 50, cx + 10, 27);
    g.closePath();
    g.fillStyle = look.cape;
    g.fill();
    const shade = g.createLinearGradient(0, 30, 0, 69);
    shade.addColorStop(0, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(0,0,0,0.32)');
    g.fillStyle = shade;
    g.fill();
    // Folds falling from the shoulders.
    g.strokeStyle = 'rgba(214,222,242,0.16)';
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(cx - 14, 38);
    g.quadraticCurveTo(cx - 18.5, 53, cx - 16.5, 66.5);
    g.moveTo(cx + 14, 38);
    g.quadraticCurveTo(cx + 18.5, 53, cx + 16.5, 66.5);
    g.moveTo(cx - 20, 46);
    g.quadraticCurveTo(cx - 22.5, 57, cx - 21, 67.6);
    g.moveTo(cx + 20, 46);
    g.quadraticCurveTo(cx + 22.5, 57, cx + 21, 67.6);
    g.stroke();
    g.strokeStyle = 'rgba(214,222,242,0.6)';
    g.lineWidth = 1.3;
    outline();
    g.stroke();
  };
}

/**
 * The Emperor, drawn after Yhwach in the game's own chibi style: long wavy
 * black hair falling over his shoulders, a heavy mustache under stern brows,
 * red eyes, and a black coat whose tall collar shows crimson beside the hair.
 * Everything but the cape, which is its own layer.
 */
function heroBody(look: HeroLook): Draw {
  return (g, w) => {
  const cx = w / 2;
  const RIM = 'rgba(214,222,242,0.6)';
  const HAIR = '#0b0b11';
  const HAIR_RIM = 'rgba(214,222,242,0.42)';
  // Coat, with a soft light down its front
  const coat = g.createLinearGradient(0, 28, 0, 66);
  coat.addColorStop(0, look.coatTop);
  coat.addColorStop(1, look.coatBottom);
  g.fillStyle = coat;
  g.beginPath();
  g.moveTo(cx - 9, 29);
  g.lineTo(cx + 9, 29);
  g.lineTo(cx + 13, 66);
  g.lineTo(cx - 13, 66);
  g.closePath();
  g.fill();
  const sheen = g.createLinearGradient(cx - 9, 0, cx + 9, 0);
  sheen.addColorStop(0, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.42, 'rgba(255,255,255,0.07)');
  sheen.addColorStop(0.58, 'rgba(255,255,255,0.07)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sheen;
  g.fill();
  g.strokeStyle = 'rgba(214,222,242,0.35)';
  g.lineWidth = 0.9;
  g.stroke();
  // Front opening, hem trim and a silver star at the chest
  g.strokeStyle = look.trim;
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(cx, 40);
  g.lineTo(cx, 66);
  g.moveTo(cx - 12.6, 63);
  g.lineTo(cx + 12.6, 63);
  g.moveTo(cx - 12.1, 60.4);
  g.lineTo(cx + 12.1, 60.4);
  g.stroke();
  g.save();
  g.fillStyle = look.star;
  g.shadowColor = look.starGlow;
  g.shadowBlur = 6;
  g.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU - Math.PI / 2;
    const r = k % 2 === 0 ? 3.4 : 1.35;
    g.lineTo(cx + Math.cos(a) * r, 36 + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  g.restore();
  // Sleeves with pale cuffs and hands
  g.fillStyle = look.sleeve;
  g.beginPath();
  g.ellipse(cx - 12, 44, 4, 9, 0.3, 0, TAU);
  g.fill();
  g.beginPath();
  g.ellipse(cx + 12, 44, 4, 9, -0.3, 0, TAU);
  g.fill();
  g.strokeStyle = 'rgba(214,222,242,0.3)';
  g.lineWidth = 0.7;
  g.beginPath();
  g.ellipse(cx - 12, 44, 4, 9, 0.3, 0, TAU);
  g.stroke();
  g.beginPath();
  g.ellipse(cx + 12, 44, 4, 9, -0.3, 0, TAU);
  g.stroke();
  g.fillStyle = look.cuff;
  g.fillRect(cx - 16, 50, 6, 1.6);
  g.fillRect(cx + 10, 50, 6, 1.6);
  g.fillStyle = '#efe0cc';
  g.beginPath();
  g.arc(cx - 13.5, 53.5, 2, 0, TAU);
  g.arc(cx + 13.5, 53.5, 2, 0, TAU);
  g.fill();
  // Tall collar: pointed flaps standing up beside the head, crimson facing out
  for (const dir of [-1, 1]) {
    g.fillStyle = look.collar;
    poly(g, [
      [cx + dir * 5, 29],
      [cx + dir * 16.5, 13],
      [cx + dir * 13.5, 31],
    ]);
    g.fill();
    g.fillStyle = look.lining;
    poly(g, [
      [cx + dir * 9, 27],
      [cx + dir * 15.6, 15],
      [cx + dir * 13, 29.5],
    ]);
    g.fill();
    g.strokeStyle = RIM;
    g.lineWidth = 0.9;
    g.beginPath();
    g.moveTo(cx + dir * 5, 29);
    g.lineTo(cx + dir * 16.5, 13);
    g.lineTo(cx + dir * 13.5, 31);
    g.stroke();
  }
  // Face, shaded under the brows and the jaw
  g.fillStyle = '#efdfcb';
  g.beginPath();
  g.ellipse(cx, 19.5, 6, 7.2, 0, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(80,50,40,0.25)';
  g.beginPath();
  g.ellipse(cx, 24.5, 4.5, 2.2, 0, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(80,50,40,0.18)';
  g.beginPath();
  g.ellipse(cx, 17.6, 4.8, 1.3, 0, 0, TAU);
  g.fill();
  // Hair: a full crown with a centre part, and long wavy locks down over the shoulders
  g.fillStyle = HAIR;
  g.strokeStyle = HAIR_RIM;
  g.lineWidth = 0.9;
  g.beginPath();
  g.ellipse(cx, 14.5, 8.2, 7.4, 0, Math.PI, TAU);
  g.fill();
  for (const dir of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx + dir * 0.6, 8);
    g.quadraticCurveTo(cx + dir * 10.5, 9, cx + dir * 10.2, 19);
    g.quadraticCurveTo(cx + dir * 10.6, 26, cx + dir * 12.6, 31);
    g.quadraticCurveTo(cx + dir * 14.4, 36, cx + dir * 12.4, 40);
    g.quadraticCurveTo(cx + dir * 11.6, 43.5, cx + dir * 12.8, 46.5);
    g.quadraticCurveTo(cx + dir * 9.2, 44.5, cx + dir * 9.6, 40.5);
    g.quadraticCurveTo(cx + dir * 10.6, 36, cx + dir * 8.4, 31);
    g.quadraticCurveTo(cx + dir * 6.6, 26, cx + dir * 6.5, 19.5);
    g.quadraticCurveTo(cx + dir * 6.2, 15, cx + dir * 2, 12.5);
    g.closePath();
    g.fill();
    g.stroke();
    // Light catching the waves of each lock
    g.save();
    g.strokeStyle = 'rgba(214,222,242,0.22)';
    g.lineWidth = 0.6;
    g.beginPath();
    g.moveTo(cx + dir * 3.5, 10.2);
    g.quadraticCurveTo(cx + dir * 8.6, 11.5, cx + dir * 8.6, 18.5);
    g.moveTo(cx + dir * 9.4, 27);
    g.quadraticCurveTo(cx + dir * 11.6, 31.5, cx + dir * 11.2, 37);
    g.stroke();
    g.restore();
  }
  // Stern brows and red eyes
  g.strokeStyle = HAIR;
  g.lineWidth = 1.3;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx - 5, 16.2);
  g.lineTo(cx - 1.5, 17.8);
  g.moveTo(cx + 5, 16.2);
  g.lineTo(cx + 1.5, 17.8);
  g.stroke();
  glowDot(g, cx - 2.9, 19.7, 1.35, 0.95, '#ffe0e0', '#ff2d4a', 6);
  glowDot(g, cx + 2.9, 19.7, 1.35, 0.95, '#ffe0e0', '#ff2d4a', 6);
  // Heavy mustache, its ends sweeping down
  g.fillStyle = HAIR;
  for (const dir of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx, 22.3);
    g.quadraticCurveTo(cx + dir * 3.8, 21.4, cx + dir * 6.4, 26.2);
    g.quadraticCurveTo(cx + dir * 3.6, 24, cx, 24);
    g.closePath();
    g.fill();
  }
  };
}

/** Cape and body together, for the DOM portraits. */
function heroDraw(look: HeroLook): Draw {
  const cape = heroCape(look);
  const body = heroBody(look);
  return (g, w, h) => {
    cape(g, w, h);
    body(g, w, h);
  };
}

/**
 * The Almighty's eyes: once A · The Almighty is his, each eye shows several
 * pupils, as it does in the story. Laid over the body's own eyes.
 */
const evoPupils: Draw = (g, w) => {
  const cx = w / 2;
  for (const dir of [-1, 1]) {
    const x = cx + dir * 2.9;
    glowDot(g, x, 19.7, 1.6, 1.15, '#ff4a64', '#ff2d4a', 7);
    g.fillStyle = '#2a0008';
    for (const [dx, dy] of [
      [-0.62, 0.12],
      [0.62, 0.12],
      [0, -0.42],
    ] as const) {
      g.beginPath();
      g.arc(x + dx, 19.7 + dy, 0.3, 0, TAU);
      g.fill();
    }
  }
};

const hero = heroBody(HERO_LOOKS.default);

// -------------------------------------------------------------- enemies

const hollow: Draw = (g, w, h) => {
  const cx = w / 2;
  const cy = h / 2 + 3;
  aura(g, cx, cy, 25, 'rgba(255,40,80,0.16)');
  shadowBody(g, cx, cy + 3, 18, 7, 3, '#3a2f52');
  chestHole(g, cx, cy + 9, 3.2);
  mask(g, cx, cy - 6, 22, 18, 2, true);
};

const hound: Draw = (g, w, h) => {
  const cx = w / 2;
  const cy = h / 2 + 2;
  aura(g, cx, cy, 22, 'rgba(255,40,80,0.16)');
  // Low, spiky body
  const rnd = seeded(9);
  g.fillStyle = '#100c18';
  g.beginPath();
  for (let k = 0; k <= 16; k++) {
    const a = (k / 16) * TAU;
    const rr = k % 2 === 0 ? 17 + rnd() * 3 : 10;
    const x = cx + Math.cos(a) * rr;
    const y = cy + 4 + Math.sin(a) * rr * 0.7;
    if (k === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.fill();
  // Narrow beak-like mask
  g.fillStyle = BONE;
  poly(g, [
    [cx - 8, cy - 8],
    [cx + 8, cy - 8],
    [cx + 3, cy + 6],
    [cx, cy + 10],
    [cx - 3, cy + 6],
  ]);
  g.fill();
  g.fillStyle = INK;
  g.beginPath();
  g.ellipse(cx - 3.5, cy - 3, 2, 3, 0.4, 0, TAU);
  g.fill();
  g.beginPath();
  g.ellipse(cx + 3.5, cy - 3, 2, 3, -0.4, 0, TAU);
  g.fill();
  g.strokeStyle = 'rgba(255,45,74,0.85)';
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(cx - 6, cy - 7);
  g.lineTo(cx - 1, cy + 4);
  g.stroke();
};

function horn(g: Ctx, x: number, y: number, dir: number, s: number): void {
  g.beginPath();
  g.moveTo(x - 6 * dir * s, y + 8 * s);
  g.quadraticCurveTo(x + 2 * dir * s, y - 4 * s, x + 10 * dir * s, y - 12 * s);
  g.quadraticCurveTo(x + 5 * dir * s, y + 2 * s, x + 6 * dir * s, y + 10 * s);
  g.closePath();
  g.fill();
}

const brute: Draw = (g, w, h) => {
  const cx = w / 2;
  const cy = h / 2 + 4;
  aura(g, cx, cy, 36, 'rgba(255,40,80,0.18)');
  shadowBody(g, cx, cy + 4, 30, 9, 17, '#47263a');
  chestHole(g, cx, cy + 14, 5);
  g.fillStyle = BONE;
  horn(g, cx - 13, cy - 16, -1, 1);
  horn(g, cx + 13, cy - 16, 1, 1);
  mask(g, cx, cy - 7, 32, 24, 2, true);
};

/** Shrieker's leech: a fat black leech with a little white mask, its belly glowing as it swells to burst. */
const volatile: Draw = (g, w, h) => {
  const cx = w / 2;
  const cy = h / 2 + 3;
  aura(g, cx, cy, 25, 'rgba(255,110,40,0.3)');
  // Segmented body, thickest at the middle
  for (let k = 4; k >= 0; k--) {
    const x = cx + 10 - k * 5;
    const r = 6 + Math.sin(((k + 0.5) / 5) * Math.PI) * 6;
    const grad = g.createRadialGradient(x - 2, cy - 3, 1, x, cy, r);
    grad.addColorStop(0, '#3a2440');
    grad.addColorStop(1, '#0d070e');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(x, cy, r * 0.8, r, 0, 0, TAU);
    g.fill();
  }
  // The glowing belly about to go
  g.save();
  g.fillStyle = '#ff7a3c';
  g.shadowColor = '#ff3d1f';
  g.shadowBlur = 10;
  g.beginPath();
  g.ellipse(cx, cy + 3, 6, 4, 0, 0, TAU);
  g.fill();
  g.restore();
  mask(g, cx + 12, cy - 4, 10, 8, 2, false);
};

/** Elite: armored, with red war markings on the mask. */
const adjuchas: Draw = (g, w, h) => {
  const cx = w / 2;
  const cy = h / 2 + 3;
  aura(g, cx, cy, 34, 'rgba(255,30,70,0.32)');
  shadowBody(g, cx, cy + 4, 26, 6, 29, '#5a2034');
  // Armor plates
  g.fillStyle = '#d9d2c4';
  for (let k = 0; k < 3; k++) {
    poly(g, [
      [cx - 20 + k * 14, cy + 6],
      [cx - 14 + k * 14, cy - 2],
      [cx - 8 + k * 14, cy + 6],
    ]);
    g.fill();
  }
  mask(g, cx, cy - 10, 28, 22, 2, true);
  g.strokeStyle = '#ff2d4a';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(cx - 10, cy - 20);
  g.lineTo(cx - 4, cy - 2);
  g.moveTo(cx + 10, cy - 20);
  g.lineTo(cx + 4, cy - 2);
  g.stroke();
};

/** Medallion bearer: a black-armored knight in a white cloak, face hidden, medallion glowing. Original design. */
const bearer: Draw = (g, w, h) => {
  const cx = w / 2;
  const cy = h / 2 + 6;
  // Cloak
  g.fillStyle = BONE;
  g.beginPath();
  g.moveTo(cx - 16, cy - 20);
  g.quadraticCurveTo(cx - 40, cy + 14, cx - 34, cy + 40);
  g.lineTo(cx + 34, cy + 40);
  g.quadraticCurveTo(cx + 40, cy + 14, cx + 16, cy - 20);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 1.2;
  g.stroke();
  // Armor
  const armor = g.createLinearGradient(0, cy - 24, 0, cy + 36);
  armor.addColorStop(0, '#2a2f3d');
  armor.addColorStop(1, '#090a0f');
  g.fillStyle = armor;
  poly(g, [
    [cx - 18, cy - 14],
    [cx + 18, cy - 14],
    [cx + 14, cy + 36],
    [cx - 14, cy + 36],
  ]);
  g.fill();
  // Pauldrons
  g.beginPath();
  g.ellipse(cx - 18, cy - 12, 9, 6, -0.3, 0, TAU);
  g.ellipse(cx + 18, cy - 12, 9, 6, 0.3, 0, TAU);
  g.fill();
  // Helm with a visor slit
  g.fillStyle = '#1b1f29';
  g.beginPath();
  g.ellipse(cx, cy - 26, 11, 12, 0, 0, TAU);
  g.fill();
  g.fillStyle = BONE;
  g.fillRect(cx - 7, cy - 27, 14, 2.4);
  // Medallion
  glowDot(g, cx, cy + 4, 6.5, 6.5, '#ffe2a0', '#ffcb5c', 12);
  g.strokeStyle = '#7a5a1a';
  g.lineWidth = 1.2;
  g.beginPath();
  g.arc(cx, cy + 4, 4, 0, TAU);
  g.stroke();
};

/**
 * Ayon (a chibi homage): the beast Harribel's three Fracción make out of
 * their own left arms. A hulking dark body, Apache's antlers, Mila Rose's
 * mane, Sung-Sun's serpent for a tail, and a face that is almost nothing at
 * all. Enraged, it swells, its veins burn red and its face splits open.
 */
function ayonDraw(g: Ctx, w: number, h: number, rage: boolean): void {
  const k = rage ? 1.1 : 1;
  const cx = w / 2;
  const cy = h / 2 + 8 * k;
  aura(g, cx, cy, 86 * k, rage ? 'rgba(255,40,40,0.3)' : 'rgba(210,140,70,0.18)');
  // Sung-Sun's serpent: the tail, curling out behind and rearing its head
  g.strokeStyle = '#4e6e4a';
  g.lineWidth = 9 * k;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx + 18 * k, cy + 40 * k);
  g.bezierCurveTo(cx + 70 * k, cy + 56 * k, cx + 84 * k, cy + 6 * k, cx + 64 * k, cy - 18 * k);
  g.stroke();
  g.strokeStyle = '#7a9a72';
  g.lineWidth = 3 * k;
  g.stroke();
  g.fillStyle = '#4e6e4a';
  g.beginPath();
  g.ellipse(cx + 60 * k, cy - 24 * k, 9 * k, 6.5 * k, -0.6, 0, TAU);
  g.fill();
  glowDot(g, cx + 63 * k, cy - 27 * k, 1.6 * k, 1.6 * k, '#ffe28a', 'rgba(255,200,80,0.9)', 4);
  // Legs
  const skin = g.createLinearGradient(0, cy - 40 * k, 0, cy + 72 * k);
  skin.addColorStop(0, rage ? '#5a2a20' : '#4a3428');
  skin.addColorStop(1, rage ? '#200a08' : '#1c120c');
  g.fillStyle = skin;
  for (const dir of [-1, 1]) {
    g.beginPath();
    g.ellipse(cx + dir * 19 * k, cy + 54 * k, 13 * k, 20 * k, dir * 0.1, 0, TAU);
    g.fill();
  }
  // The torso: broad shoulders, a narrower waist
  g.beginPath();
  g.moveTo(cx - 42 * k, cy - 18 * k);
  g.quadraticCurveTo(cx, cy - 34 * k, cx + 42 * k, cy - 18 * k);
  g.quadraticCurveTo(cx + 34 * k, cy + 24 * k, cx + 26 * k, cy + 42 * k);
  g.lineTo(cx - 26 * k, cy + 42 * k);
  g.quadraticCurveTo(cx - 34 * k, cy + 24 * k, cx - 42 * k, cy - 18 * k);
  g.closePath();
  g.fill();
  // Long arms hanging to great fists
  for (const dir of [-1, 1]) {
    g.beginPath();
    g.ellipse(cx + dir * 47 * k, cy + 4 * k, 12 * k, 30 * k, -dir * 0.15, 0, TAU);
    g.fill();
    g.beginPath();
    g.arc(cx + dir * 51 * k, cy + 36 * k, 13 * k, 0, TAU);
    g.fill();
  }
  // Muscle lines, or burning veins
  g.strokeStyle = rage ? 'rgba(255,60,50,0.85)' : 'rgba(255,220,180,0.18)';
  g.lineWidth = (rage ? 2.2 : 1.6) * k;
  g.beginPath();
  g.moveTo(cx - 24 * k, cy - 8 * k);
  g.quadraticCurveTo(cx - 10 * k, cy + 2 * k, cx - 2 * k, cy - 6 * k);
  g.moveTo(cx + 24 * k, cy - 8 * k);
  g.quadraticCurveTo(cx + 10 * k, cy + 2 * k, cx + 2 * k, cy - 6 * k);
  g.moveTo(cx, cy + 4 * k);
  g.lineTo(cx, cy + 34 * k);
  for (const dir of [-1, 1]) {
    g.moveTo(cx + dir * 44 * k, cy - 14 * k);
    g.quadraticCurveTo(cx + dir * 52 * k, cy + 6 * k, cx + dir * 48 * k, cy + 22 * k);
  }
  g.stroke();
  if (rage) {
    // Spikes have burst from its shoulders
    g.fillStyle = '#e8dcc0';
    for (const dir of [-1, 1]) {
      for (let s = 0; s < 3; s++) {
        const bx = cx + dir * (30 + s * 7) * k;
        const by = cy - (26 - s * 3) * k;
        poly(g, [
          [bx - 3 * k, by],
          [bx + dir * 4 * k, by - 14 * k],
          [bx + 3 * k, by],
        ]);
        g.fill();
      }
    }
  }
  // Mila Rose's mane, all around the head and over the shoulders
  g.fillStyle = rage ? '#a0602a' : '#b8863a';
  g.beginPath();
  const n = 20;
  for (let q = 0; q <= n; q++) {
    const a = (q / n) * TAU;
    const r = (q % 2 ? 30 : 40) * k;
    const x = cx + Math.cos(a) * r;
    const y = cy - 36 * k + Math.sin(a) * r * 0.85;
    if (q === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.fill();
  g.fillStyle = rage ? '#6a3a14' : '#7a5420';
  g.beginPath();
  g.ellipse(cx, cy - 34 * k, 24 * k, 22 * k, 0, 0, TAU);
  g.fill();
  // Apache's antlers
  g.strokeStyle = '#e8dcc0';
  g.lineWidth = 4 * k;
  g.lineCap = 'round';
  g.beginPath();
  for (const dir of [-1, 1]) {
    const bx = cx + dir * 10 * k;
    const by = cy - 52 * k;
    g.moveTo(bx, by);
    g.quadraticCurveTo(bx + dir * 14 * k, by - 18 * k, bx + dir * 30 * k, by - 30 * k);
    g.moveTo(bx + dir * 9 * k, by - 12 * k);
    g.lineTo(bx + dir * 4 * k, by - 28 * k);
    g.moveTo(bx + dir * 19 * k, by - 21 * k);
    g.lineTo(bx + dir * 17 * k, by - 38 * k);
    g.moveTo(bx + dir * 24 * k, by - 25 * k);
    g.lineTo(bx + dir * 36 * k, by - 22 * k);
  }
  g.stroke();
  // The face: a dark, almost blank plate with two small eyes
  g.fillStyle = '#20140e';
  g.beginPath();
  g.ellipse(cx, cy - 36 * k, 16 * k, 18 * k, 0, 0, TAU);
  g.fill();
  if (rage) {
    // Split open: a fanged maw down the middle, burning inside
    g.save();
    g.shadowColor = 'rgba(255,40,30,0.9)';
    g.shadowBlur = 10;
    g.fillStyle = '#ff3a2a';
    g.beginPath();
    g.ellipse(cx, cy - 32 * k, 7 * k, 13 * k, 0, 0, TAU);
    g.fill();
    g.restore();
    g.fillStyle = '#3a0806';
    g.beginPath();
    g.ellipse(cx, cy - 32 * k, 4.6 * k, 10 * k, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#fbf3e0';
    for (let q = -3; q <= 3; q++) {
      for (const dir of [-1, 1]) {
        const y = cy - 32 * k + q * 2.8 * k;
        poly(g, [
          [cx + dir * 5.6 * k, y - 1.2 * k],
          [cx + dir * 2 * k, y],
          [cx + dir * 5.6 * k, y + 1.2 * k],
        ]);
        g.fill();
      }
    }
    glowDot(g, cx - 9 * k, cy - 44 * k, 2.4 * k, 1.8 * k, '#ffd0c0', 'rgba(255,40,30,1)', 8);
    glowDot(g, cx + 9 * k, cy - 44 * k, 2.4 * k, 1.8 * k, '#ffd0c0', 'rgba(255,40,30,1)', 8);
  } else {
    glowDot(g, cx - 6 * k, cy - 38 * k, 2.2 * k, 1.6 * k, '#ffe8a0', 'rgba(255,190,70,0.95)', 7);
    glowDot(g, cx + 6 * k, cy - 38 * k, 2.2 * k, 1.6 * k, '#ffe8a0', 'rgba(255,190,70,0.95)', 7);
  }
}

const ayon: Draw = (g, w, h) => ayonDraw(g, w, h, false);
const ayonRage: Draw = (g, w, h) => ayonDraw(g, w, h, true);

/** Neliel's skull mask on top of her head: a cracked bone cap with a ram's horn curling down each side. */
function nelMask(g: Ctx, cx: number, hy: number, s: number, big: boolean): void {
  const r = big ? 1.25 : 1;
  g.fillStyle = BONE;
  g.beginPath();
  g.ellipse(cx, hy - 4.6 * s, 6.6 * s * r, 3.6 * s * r, 0, Math.PI, TAU);
  g.lineTo(cx + 5.4 * s * r, hy - 3.6 * s);
  for (let q = 4; q >= -4; q--) g.lineTo(cx + q * 1.3 * s * r, hy - (q % 2 ? 3.6 : 2.4) * s);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(80,70,60,0.55)';
  g.lineWidth = 0.4 * s;
  g.stroke();
  g.beginPath();
  g.moveTo(cx + 1.6 * s, hy - 7.6 * s * r);
  g.lineTo(cx + 0.4 * s, hy - 5.6 * s);
  g.lineTo(cx + 1.4 * s, hy - 4.4 * s);
  g.stroke();
  // The horns: thick spirals curling back and down
  g.strokeStyle = '#efe6d2';
  g.lineCap = 'round';
  for (const dir of [-1, 1]) {
    g.lineWidth = 2.2 * s * r;
    g.beginPath();
    const ox = cx + dir * 6.4 * s * r;
    const oy = hy - 3.4 * s;
    g.moveTo(ox, oy);
    g.bezierCurveTo(ox + dir * 5 * s * r, oy - 4 * s * r, ox + dir * 7 * s * r, oy + 3 * s * r, ox + dir * 3 * s * r, oy + 4.2 * s * r);
    g.stroke();
    g.lineWidth = 1.2 * s * r;
    g.beginPath();
    g.moveTo(ox + dir * 3 * s * r, oy + 4.2 * s * r);
    g.quadraticCurveTo(ox + dir * 0.6 * s * r, oy + 3.4 * s * r, ox + dir * 1.6 * s * r, oy + 1.4 * s * r);
    g.stroke();
  }
}

/** Neliel's face: big hazel eyes and the crimson mark across her nose and cheeks. */
function nelFace(g: Ctx, cx: number, hy: number, s: number): void {
  faceAt(g, cx, hy + 0.8 * s, s, 5.4, 6.2);
  g.strokeStyle = '#d0283a';
  g.lineWidth = 0.9 * s;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx - 5 * s, hy + 3.2 * s);
  g.lineTo(cx + 5 * s, hy + 3.2 * s);
  g.stroke();
  eyesAt(g, cx, hy + 1.5 * s, s, '#f6dcae', '#a86a2a', 2.6);
  g.strokeStyle = '#14161f';
  g.lineWidth = 0.4 * s;
  g.beginPath();
  for (const dir of [-1, 1]) {
    g.moveTo(cx + dir * 1.4 * s, hy + 0.5 * s);
    g.quadraticCurveTo(cx + dir * 2.6 * s, hy - 0.2 * s, cx + dir * 3.8 * s, hy + 0.5 * s);
  }
  g.stroke();
}

/** Neliel's long sea-green hair: down her back to the knees, with a fringe over the brow. */
function nelHair(g: Ctx, cx: number, hy: number, cy: number, s: number, front: boolean): void {
  const hair = g.createLinearGradient(0, hy - 6 * s, 0, cy + 16 * s);
  hair.addColorStop(0, '#5ad8b0');
  hair.addColorStop(1, '#22856c');
  g.fillStyle = hair;
  if (!front) {
    g.beginPath();
    g.moveTo(cx - 7 * s, hy - 3 * s);
    g.quadraticCurveTo(cx - 12 * s, cy, cx - 11 * s, cy + 16 * s);
    for (let q = -3; q <= 3; q++) g.lineTo(cx + q * 3.4 * s, cy + (q % 2 ? 13.4 : 16) * s);
    g.quadraticCurveTo(cx + 12 * s, cy, cx + 7 * s, hy - 3 * s);
    g.closePath();
    g.fill();
    return;
  }
  g.beginPath();
  g.ellipse(cx, hy - 2 * s, 6.6 * s, 4.6 * s, 0, Math.PI * 0.95, Math.PI * 2.05);
  g.fill();
  for (const dir of [-1, 1]) {
    poly(g, [
      [cx + dir * 4.8 * s, hy - 2.6 * s],
      [cx + dir * 6.9 * s, hy],
      [cx + dir * 6.6 * s, hy + 6.4 * s],
      [cx + dir * 4.8 * s, hy + 2 * s],
    ]);
    g.fill();
  }
  poly(g, [
    [cx - 3.4 * s, hy - 3 * s],
    [cx + 1.6 * s, hy - 3.2 * s],
    [cx - 1.4 * s, hy + 0.6 * s],
  ]);
  g.fill();
}

/** Neliel's white Arrancar clothes: a fitted jacket, long sleeves with green cuffs, a white skirt over hakama. */
function nelBody(g: Ctx, cx: number, cy: number, s: number): void {
  const robe = g.createLinearGradient(0, cy - 6 * s, 0, cy + 20 * s);
  robe.addColorStop(0, '#ffffff');
  robe.addColorStop(1, '#cfd8e2');
  g.fillStyle = robe;
  g.beginPath();
  g.moveTo(cx - 7.6 * s, cy - 6 * s);
  g.lineTo(cx + 7.6 * s, cy - 6 * s);
  g.lineTo(cx + 11 * s, cy + 20 * s);
  g.lineTo(cx - 11 * s, cy + 20 * s);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(30,50,60,0.4)';
  g.lineWidth = 1;
  g.stroke();
  g.fillStyle = '#2a9a7a';
  g.fillRect(cx - 9 * s, cy + 4 * s, 18 * s, 2 * s);
  g.strokeStyle = 'rgba(30,50,60,0.3)';
  g.beginPath();
  g.moveTo(cx, cy - 4 * s);
  g.lineTo(cx, cy + 4 * s);
  g.stroke();
  for (const dir of [-1, 1]) {
    g.fillStyle = '#f6f8fb';
    g.beginPath();
    g.ellipse(cx + dir * 10 * s, cy + 1.5 * s, 3.6 * s, 7.4 * s, -dir * 0.25, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(30,50,60,0.4)';
    g.lineWidth = 0.8;
    g.stroke();
    g.strokeStyle = '#2a9a7a';
    g.lineWidth = 1 * s;
    g.beginPath();
    g.moveTo(cx + dir * 9 * s, cy + 7.8 * s);
    g.lineTo(cx + dir * 12.8 * s, cy + 6.8 * s);
    g.stroke();
    g.fillStyle = SKIN;
    g.beginPath();
    g.arc(cx + dir * 11.2 * s, cy + 9.6 * s, 1.5 * s, 0, TAU);
    g.fill();
    g.fillStyle = '#f4f2ec';
    g.beginPath();
    g.ellipse(cx + dir * 4 * s, cy + 20.6 * s, 2.6 * s, 1.4 * s, 0, 0, TAU);
    g.fill();
  }
}

/**
 * Neliel Tu Oderschvank (a chibi homage): the former Tercera Espada, grown
 * up again. Long sea-green hair, the ram's skull of her mask on her head, a
 * crimson mark across her face, white clothes and her sword at her side.
 */
const nel: Draw = (g, w, h) => {
  const s = 2;
  const cx = w / 2;
  const cy = h / 2 + 7;
  const hy = cy - 13 * s;
  aura(g, cx, cy, 54, 'rgba(90,216,176,0.2)');
  nelHair(g, cx, hy, cy, s, false);
  nelBody(g, cx, cy, s);
  heldSword(g, cx + 11.6 * s, cy + 9.6 * s, s, 14, -0.25);
  nelFace(g, cx, hy, s);
  nelHair(g, cx, hy, cy, s, true);
  nelMask(g, cx, hy, s, false);
};

/**
 * Neliel released, Gamuza (a chibi homage): the centaur form, a white ram's
 * body below the waist, her mask grown into a horned helmet, and the
 * double-bladed lance she throws as Lanzador Verde.
 */
const nelGamuza: Draw = (g, w, h) => {
  const s = 2;
  const cx = w / 2 - 6;
  const cy = h / 2 - 4;
  const hy = cy - 13 * s;
  aura(g, cx + 8, cy + 18, 66, 'rgba(90,216,176,0.26)');
  // The ram's body: four legs and cloven hooves
  const flank = g.createLinearGradient(0, cy + 8 * s, 0, cy + 30 * s);
  flank.addColorStop(0, '#ffffff');
  flank.addColorStop(1, '#c8d2dc');
  for (const [dx, back] of [
    [-6, false],
    [-1, true],
    [16, true],
    [21, false],
  ] as const) {
    g.fillStyle = back ? '#b8c2cc' : '#e8eef4';
    g.fillRect(cx + dx * s - 1.6 * s, cy + 18 * s, 3.2 * s, 11 * s);
    g.fillStyle = '#3a4048';
    g.fillRect(cx + dx * s - 1.8 * s, cy + 28 * s, 3.6 * s, 2.2 * s);
  }
  g.fillStyle = flank;
  g.beginPath();
  g.ellipse(cx + 8 * s, cy + 15 * s, 18 * s, 7.4 * s, 0, 0, TAU);
  g.fill();
  g.strokeStyle = 'rgba(30,50,60,0.4)';
  g.lineWidth = 1;
  g.stroke();
  // A green tail of hair behind
  g.fillStyle = '#2fae8a';
  g.beginPath();
  g.moveTo(cx + 25 * s, cy + 12 * s);
  g.quadraticCurveTo(cx + 33 * s, cy + 14 * s, cx + 31 * s, cy + 26 * s);
  g.quadraticCurveTo(cx + 27 * s, cy + 19 * s, cx + 24 * s, cy + 16 * s);
  g.closePath();
  g.fill();
  nelHair(g, cx, hy, cy, s, false);
  nelBody(g, cx, cy, s);
  // The lance, held across her: a long shaft with a crescent blade at each end
  g.save();
  g.translate(cx + 2 * s, cy + 4 * s);
  g.rotate(-0.55);
  g.fillStyle = '#d8b04a';
  g.fillRect(-26 * s, -0.8 * s, 52 * s, 1.6 * s);
  g.fillStyle = '#f2f6ff';
  for (const dir of [-1, 1]) {
    g.beginPath();
    g.moveTo(dir * 26 * s, -0.8 * s);
    g.quadraticCurveTo(dir * 33 * s, -6 * s, dir * 36 * s, 0);
    g.quadraticCurveTo(dir * 33 * s, 6 * s, dir * 26 * s, 0.8 * s);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(60,70,90,0.6)';
    g.lineWidth = 0.4 * s;
    g.stroke();
  }
  g.restore();
  nelFace(g, cx, hy, s);
  nelHair(g, cx, hy, cy, s, true);
  nelMask(g, cx, hy, s, true);
};

/** Unohana's long black hair, down her back. */
function unohanaHairBack(g: Ctx, cx: number, hy: number, cy: number, s: number, loose: boolean): void {
  g.fillStyle = '#0d0e14';
  g.beginPath();
  g.moveTo(cx - 6.8 * s, hy - 2 * s);
  g.quadraticCurveTo(cx - (loose ? 14 : 9) * s, cy + 2 * s, cx - (loose ? 12 : 8) * s, cy + (loose ? 15 : 6) * s);
  g.lineTo(cx + (loose ? 12 : 8) * s, cy + (loose ? 15 : 6) * s);
  g.quadraticCurveTo(cx + (loose ? 14 : 9) * s, cy + 2 * s, cx + 6.8 * s, hy - 2 * s);
  g.closePath();
  g.fill();
}

/** The top of Unohana's head: black hair parted at the middle and falling past her cheeks. */
function unohanaHairFront(g: Ctx, cx: number, hy: number, s: number): void {
  g.fillStyle = '#0d0e14';
  g.beginPath();
  g.ellipse(cx, hy - 2 * s, 6.8 * s, 5 * s, 0, Math.PI * 0.95, Math.PI * 2.05);
  g.fill();
  for (const dir of [-1, 1]) {
    poly(g, [
      [cx + dir * 0.4 * s, hy - 4.8 * s],
      [cx + dir * 6.8 * s, hy - 1.4 * s],
      [cx + dir * 6.6 * s, hy + 6 * s],
      [cx + dir * 4.8 * s, hy + 1.4 * s],
      [cx + dir * 1.6 * s, hy - 2.2 * s],
    ]);
    g.fill();
  }
}

/**
 * Retsu Unohana (a chibi homage): Captain of the 4th Division, the healer.
 * Her long black hair in one thick braid down her front, a calm smile, the
 * captain's haori, Minazuki at her side.
 */
const unohana: Draw = (g, w, h) => {
  const s = 2;
  const cx = w / 2;
  const cy = h / 2 + 7;
  const hy = cy - 13 * s;
  aura(g, cx, cy, 54, 'rgba(150,230,190,0.2)');
  unohanaHairBack(g, cx, hy, cy, s, false);
  captainBody(g, cx, cy, s, { haori: 'sleeved' });
  heldSword(g, cx + 12 * s, cy + 9.6 * s, s, 14, -0.12);
  faceAt(g, cx, hy + 0.8 * s, s, 5.6, 6.4);
  unohanaHairFront(g, cx, hy, s);
  // The braid, from under her chin down over her chest, tied at the end
  for (let q = 0; q < 7; q++) {
    const y = hy + 6.4 * s + q * 2.5 * s;
    const x = cx + Math.sin(q * 0.9) * 0.6 * s;
    g.fillStyle = q % 2 ? '#1a1c26' : '#0d0e14';
    g.beginPath();
    g.ellipse(x, y, 2.4 * s, 1.7 * s, (q % 2 ? 0.5 : -0.5), 0, TAU);
    g.fill();
  }
  g.fillStyle = '#d8dee8';
  g.fillRect(cx - 1.4 * s, hy + 23.6 * s, 2.8 * s, 1.2 * s);
  g.fillStyle = '#0d0e14';
  poly(g, [
    [cx - 1.8 * s, hy + 24.8 * s],
    [cx + 1.8 * s, hy + 24.8 * s],
    [cx, hy + 28 * s],
  ]);
  g.fill();
  // Calm, closed eyes and a faint smile
  g.strokeStyle = '#2a2430';
  g.lineWidth = 0.6 * s;
  g.beginPath();
  for (const dir of [-1, 1]) {
    g.moveTo(cx + dir * 1.4 * s, hy + 1.8 * s);
    g.quadraticCurveTo(cx + dir * 2.7 * s, hy + 2.6 * s, cx + dir * 4 * s, hy + 1.8 * s);
  }
  g.moveTo(cx - 1.4 * s, hy + 4.6 * s);
  g.quadraticCurveTo(cx, hy + 5.4 * s, cx + 1.4 * s, hy + 4.6 * s);
  g.stroke();
};

/**
 * Unohana as the first Kenpachi (a chibi homage): the braid let down and
 * her hair loose, the old scar across her chest showing at last, her eyes
 * open, and Minazuki's blade running red.
 */
const unohanaKenpachi: Draw = (g, w, h) => {
  const s = 2;
  const cx = w / 2;
  const cy = h / 2 + 7;
  const hy = cy - 13 * s;
  aura(g, cx, cy, 58, 'rgba(210,20,40,0.3)');
  unohanaHairBack(g, cx, hy, cy, s, true);
  captainBody(g, cx, cy, s, { haori: 'sleeved' });
  // The scar the braid always hid
  g.strokeStyle = '#c8303c';
  g.lineWidth = 0.8 * s;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx - 4 * s, cy - 5.6 * s);
  g.lineTo(cx + 3.6 * s, cy - 1.2 * s);
  g.stroke();
  // Minazuki raised, its blade dark red and dripping
  heldSword(g, cx + 12 * s, cy + 9.6 * s, s, 15, Math.PI + 0.5, '#a01828');
  g.fillStyle = '#c8202e';
  for (const [dx, dy] of [
    [15.6, -1],
    [18.4, -6],
    [20.8, -11],
  ] as const) {
    g.beginPath();
    g.ellipse(cx + dx * s, cy + dy * s, 0.7 * s, 1.2 * s, 0, 0, TAU);
    g.fill();
  }
  faceAt(g, cx, hy + 0.8 * s, s, 5.6, 6.4);
  unohanaHairFront(g, cx, hy, s);
  browsAt(g, cx, hy + 0.4 * s, s, '#0d0e14', 1.4);
  eyesAt(g, cx, hy + 1.9 * s, s, '#dfe6ff', '#3a5ac8', 2.6);
  g.strokeStyle = '#5a2a30';
  g.lineWidth = 0.55 * s;
  g.beginPath();
  g.moveTo(cx - 1.6 * s, hy + 4.8 * s);
  g.quadraticCurveTo(cx, hy + 4.2 * s, cx + 1.6 * s, hy + 4.8 * s);
  g.stroke();
};

// ----------------------------------------------------------- Soul Reapers

interface ReaperLook {
  /** Sash colour. */
  sash?: string;
  /** Width factor for heavier builds. */
  broad?: number;
  /** Cloth over the lower face (scouts). */
  scarf?: boolean;
  sword?: 'hip' | 'raised' | 'back';
  /** A glowing Kidō orb in the off hand. */
  orb?: string;
}

/**
 * A generic Soul Reaper in chibi proportions: black robe and hakama, white
 * collar, dark hair, a sword. Deliberately plain: an anonymous soldier, not
 * any character from the series.
 */
function reaper(g: Ctx, cx: number, cy: number, s: number, o: ReaperLook): void {
  const b = o.broad ?? 1;
  if (o.sword === 'back') {
    // A long blade slung across the back, drawn first so the body covers it.
    g.save();
    g.translate(cx, cy - 2 * s);
    g.rotate(-0.75);
    g.fillStyle = '#1a1c24';
    g.fillRect(-1.6 * s, -22 * s, 3.2 * s, 40 * s);
    g.fillStyle = BONE;
    g.fillRect(-1.6 * s, -26 * s, 3.2 * s, 6 * s);
    g.restore();
  }
  // Robe and hakama
  const robe = g.createLinearGradient(0, cy - 6 * s, 0, cy + 20 * s);
  robe.addColorStop(0, '#262935');
  robe.addColorStop(1, '#07080c');
  g.fillStyle = robe;
  g.beginPath();
  g.moveTo(cx - 8 * s * b, cy - 6 * s);
  g.lineTo(cx + 8 * s * b, cy - 6 * s);
  g.lineTo(cx + 11 * s * b, cy + 20 * s);
  g.lineTo(cx - 11 * s * b, cy + 20 * s);
  g.closePath();
  g.fill();
  // A pale rim so a black robe still reads on a dark floor.
  g.strokeStyle = 'rgba(214,222,240,0.6)';
  g.lineWidth = 1;
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.12)';
  g.beginPath();
  g.moveTo(cx, cy + 8 * s);
  g.lineTo(cx, cy + 20 * s);
  g.stroke();
  // White collar
  g.fillStyle = '#eceff6';
  poly(g, [
    [cx - 5 * s, cy - 6 * s],
    [cx, cy + 2 * s],
    [cx + 5 * s, cy - 6 * s],
    [cx + 3 * s, cy - 6 * s],
    [cx, cy - 1 * s],
    [cx - 3 * s, cy - 6 * s],
  ]);
  g.fill();
  // Sash
  g.fillStyle = o.sash ?? '#eceff6';
  g.fillRect(cx - 9 * s * b, cy + 4 * s, 18 * s * b, 2.2 * s);
  // Wide sleeves
  g.fillStyle = '#161820';
  g.beginPath();
  g.ellipse(cx - 10 * s * b, cy + 1 * s, 4 * s, 7 * s, 0.25, 0, TAU);
  g.fill();
  g.beginPath();
  g.ellipse(cx + 10 * s * b, cy + 1 * s, 4 * s, 7 * s, -0.25, 0, TAU);
  g.fill();
  if (b > 1.2) {
    // Plain shoulder guards on heavy builds.
    g.fillStyle = '#5a6070';
    g.beginPath();
    g.ellipse(cx - 9 * s * b, cy - 5 * s, 5 * s, 3.2 * s, -0.3, 0, TAU);
    g.fill();
    g.beginPath();
    g.ellipse(cx + 9 * s * b, cy - 5 * s, 5 * s, 3.2 * s, 0.3, 0, TAU);
    g.fill();
  }
  // White tabi
  g.fillStyle = '#f4f2ec';
  for (const dir of [-1, 1]) {
    g.beginPath();
    g.ellipse(cx + dir * 4 * s * b, cy + 20.6 * s, 2.4 * s, 1.3 * s, 0, 0, TAU);
    g.fill();
  }
  if (o.sword === 'hip') {
    // Worn at the left hip: hilt forward, blade sloping back and down, a round guard between.
    g.save();
    g.translate(cx + 7 * s * b, cy + 5 * s);
    g.rotate(0.9);
    g.fillStyle = '#2b2e38';
    g.fillRect(0, -1.2 * s, 15 * s, 2.4 * s);
    g.fillStyle = BONE;
    g.fillRect(-5 * s, -1.2 * s, 5 * s, 2.4 * s);
    g.fillStyle = '#c9a24a';
    g.beginPath();
    g.ellipse(0, 0, 0.9 * s, 2.2 * s, 0, 0, TAU);
    g.fill();
    g.restore();
  }
  if (o.sword === 'raised') {
    g.save();
    g.shadowColor = 'rgba(220,235,255,0.9)';
    g.shadowBlur = 6;
    g.strokeStyle = '#eef3fb';
    g.lineWidth = 2 * s;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(cx + 11 * s * b, cy + 1 * s);
    g.lineTo(cx + 21 * s * b, cy - 19 * s);
    g.stroke();
    g.restore();
    g.fillStyle = BONE;
    g.fillRect(cx + 9.5 * s * b, cy + 0.5 * s, 3 * s, 4 * s);
  }
  if (o.orb) glowDot(g, cx + 11 * s * b, cy - 4 * s, 3.6 * s, 3.6 * s, '#fff1d6', o.orb, 10 * s);
  // Head: pale face, dark hair, two small eyes.
  g.fillStyle = '#efdcc6';
  g.beginPath();
  g.arc(cx, cy - 12 * s, 6.2 * s, 0, TAU);
  g.fill();
  g.fillStyle = '#12131a';
  g.beginPath();
  g.arc(cx, cy - 13 * s, 6.8 * s, Math.PI, TAU);
  g.lineTo(cx + 6.8 * s, cy - 11 * s);
  g.lineTo(cx + 3 * s, cy - 13.5 * s);
  g.lineTo(cx, cy - 11.5 * s);
  g.lineTo(cx - 3 * s, cy - 13.5 * s);
  g.lineTo(cx - 6.8 * s, cy - 11 * s);
  g.closePath();
  g.fill();
  g.fillStyle = '#0b0c12';
  g.fillRect(cx - 3 * s, cy - 11 * s, 1.6 * s, 1.8 * s);
  g.fillRect(cx + 1.4 * s, cy - 11 * s, 1.6 * s, 1.8 * s);
  if (o.scarf) {
    g.fillStyle = '#2a2140';
    g.fillRect(cx - 6 * s, cy - 9 * s, 12 * s, 4 * s);
    g.beginPath();
    g.moveTo(cx + 5 * s, cy - 8 * s);
    g.quadraticCurveTo(cx + 14 * s, cy - 9 * s, cx + 16 * s, cy - 2 * s);
    g.lineTo(cx + 12 * s, cy - 4 * s);
    g.closePath();
    g.fill();
  }
}

const officer: Draw = (g, w, h) => {
  aura(g, w / 2, h / 2 + 4, 24, 'rgba(160,190,255,0.12)');
  reaper(g, w / 2, h / 2 + 2, 1, { sword: 'hip' });
};

const flashScout: Draw = (g, w, h) => {
  aura(g, w / 2, h / 2 + 4, 22, 'rgba(180,150,255,0.2)');
  reaper(g, w / 2, h / 2 + 2, 0.92, { scarf: true, sash: '#7a68b8', sword: 'hip' });
};

const caster: Draw = (g, w, h) => {
  aura(g, w / 2, h / 2 + 4, 24, 'rgba(255,150,80,0.16)');
  reaper(g, w / 2 - 2, h / 2 + 2, 1, { sash: '#d8794a', orb: '#ff8a3c' });
};

const guard: Draw = (g, w, h) => {
  aura(g, w / 2, h / 2 + 4, 38, 'rgba(160,190,255,0.12)');
  reaper(g, w / 2, h / 2 + 4, 1.45, { broad: 1.35, sash: '#8a8f9c', sword: 'back' });
};

/** Elite: a lieutenant, the white armband on the left arm, blade drawn. */
const seated: Draw = (g, w, h) => {
  aura(g, w / 2, h / 2 + 4, 34, 'rgba(255,60,90,0.22)');
  const s = 1.32;
  const cx = w / 2 - 3;
  const cy = h / 2 + 5;
  reaper(g, cx, cy, s, { sash: '#c23a4a', sword: 'raised' });
  g.save();
  g.translate(cx - 10 * s, cy + 0.5 * s);
  g.rotate(0.25);
  g.fillStyle = '#f2f2ee';
  g.fillRect(-4 * s, -1.6 * s, 8 * s, 3.2 * s);
  g.fillStyle = '#20232e';
  g.fillRect(-1.1 * s, -1 * s, 2.2 * s, 2 * s);
  g.restore();
};

// --------------------------------------------------------------- captains

/*
 * The Gotei 13 as chibi homages, in the same proportions as the Soul Reaper
 * soldiers: each captain is recognisable by their signature features (hair,
 * the white captain's haori with its diamond-pattern hem, what they carry)
 * but drawn in this game's own simple style.
 */

const SKIN = '#efdcc6';
const HAORI = '#f3f5fa';

interface CaptainLook {
  /** sleeved: the usual haori · sleeveless: short, bare arms · draped: hung from the shoulders · none: lieutenant. */
  haori: 'sleeved' | 'sleeveless' | 'draped' | 'none';
  broad?: number;
  obi?: string;
}

/** Black kimono and hakama, white tabi, and the haori over them. Head and props are drawn by each captain. */
function captainBody(g: Ctx, cx: number, cy: number, s: number, o: CaptainLook): void {
  const b = o.broad ?? 1;
  if (o.haori === 'draped') {
    // Hung from the shoulders like a cape, wider than the body.
    g.fillStyle = HAORI;
    g.beginPath();
    g.moveTo(cx - 9 * s * b, cy - 7 * s);
    g.quadraticCurveTo(cx - 16 * s * b, cy + 6 * s, cx - 14.5 * s * b, cy + 19 * s);
    g.lineTo(cx + 14.5 * s * b, cy + 19 * s);
    g.quadraticCurveTo(cx + 16 * s * b, cy + 6 * s, cx + 9 * s * b, cy - 7 * s);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(20,24,40,0.35)';
    g.lineWidth = 1;
    g.stroke();
    diamondBand(g, cx - 14 * s * b, cx + 14 * s * b, cy + 16.4 * s, s);
  }
  // Kimono and hakama
  const robe = g.createLinearGradient(0, cy - 6 * s, 0, cy + 20 * s);
  robe.addColorStop(0, '#262935');
  robe.addColorStop(1, '#07080c');
  g.fillStyle = robe;
  g.beginPath();
  g.moveTo(cx - 8 * s * b, cy - 6 * s);
  g.lineTo(cx + 8 * s * b, cy - 6 * s);
  g.lineTo(cx + 11 * s * b, cy + 20 * s);
  g.lineTo(cx - 11 * s * b, cy + 20 * s);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(214,222,240,0.55)';
  g.lineWidth = 1;
  g.stroke();
  // White tabi and sandals
  for (const dir of [-1, 1]) {
    g.fillStyle = '#f4f2ec';
    g.beginPath();
    g.ellipse(cx + dir * 4 * s, cy + 20.6 * s, 2.6 * s, 1.4 * s, 0, 0, TAU);
    g.fill();
  }
  // White under-collar
  g.fillStyle = '#eceff6';
  poly(g, [
    [cx - 4.5 * s, cy - 6 * s],
    [cx, cy + 1.5 * s],
    [cx + 4.5 * s, cy - 6 * s],
    [cx + 2.8 * s, cy - 6 * s],
    [cx, cy - 1.2 * s],
    [cx - 2.8 * s, cy - 6 * s],
  ]);
  g.fill();
  // Obi
  g.fillStyle = o.obi ?? '#eceff6';
  g.fillRect(cx - 9 * s * b, cy + 4 * s, 18 * s * b, 2.2 * s);
  if (o.haori === 'sleeved' || o.haori === 'sleeveless') {
    const bottom = o.haori === 'sleeved' ? 18.5 : 13;
    const panel = g.createLinearGradient(0, cy - 6 * s, 0, cy + bottom * s);
    panel.addColorStop(0, '#ffffff');
    panel.addColorStop(1, '#d6dbe6');
    for (const dir of [-1, 1]) {
      g.fillStyle = panel;
      g.beginPath();
      g.moveTo(cx + dir * 9 * s * b, cy - 6.5 * s);
      g.lineTo(cx + dir * 2.4 * s, cy - 6.5 * s);
      g.lineTo(cx + dir * 3.2 * s, cy + bottom * s);
      g.lineTo(cx + dir * 12.6 * s * b, cy + bottom * s);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(20,24,40,0.35)';
      g.lineWidth = 0.9;
      g.stroke();
    }
    const y = cy + (bottom - 2.2) * s;
    diamondBand(g, cx - 12.2 * s * b, cx - 3.4 * s, y, s);
    diamondBand(g, cx + 3.4 * s, cx + 12.2 * s * b, y, s);
  }
  if (o.haori === 'sleeved') {
    for (const dir of [-1, 1]) {
      g.fillStyle = HAORI;
      g.beginPath();
      g.ellipse(cx + dir * 11 * s * b, cy + 2 * s, 4.6 * s, 8 * s, -dir * 0.25, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(20,24,40,0.35)';
      g.lineWidth = 0.9;
      g.stroke();
    }
  } else if (o.haori === 'sleeveless') {
    for (const dir of [-1, 1]) {
      g.fillStyle = SKIN;
      g.beginPath();
      g.ellipse(cx + dir * 10.2 * s * b, cy + 2 * s, 2.4 * s, 7 * s, -dir * 0.2, 0, TAU);
      g.fill();
    }
  } else {
    for (const dir of [-1, 1]) {
      g.fillStyle = '#161820';
      g.beginPath();
      g.ellipse(cx + dir * 10.5 * s * b, cy + 1.5 * s, 4 * s, 7.4 * s, -dir * 0.25, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(214,222,240,0.35)';
      g.lineWidth = 0.8;
      g.stroke();
    }
  }
  // Hands
  g.fillStyle = SKIN;
  for (const dir of [-1, 1]) {
    g.beginPath();
    g.arc(cx + dir * 11.6 * s * b, cy + 9.6 * s, 1.6 * s, 0, TAU);
    g.fill();
  }
}

/** The black diamond pattern along a captain's haori hem. */
function diamondBand(g: Ctx, x0: number, x1: number, y: number, s: number): void {
  g.fillStyle = '#14161f';
  const step = 3 * s;
  for (let x = x0 + step / 2; x <= x1 - step / 3; x += step) {
    poly(g, [
      [x, y - 1.2 * s],
      [x + 1.25 * s, y],
      [x, y + 1.2 * s],
      [x - 1.25 * s, y],
    ]);
    g.fill();
  }
}

/** A face: skin, with eyes drawn by the caller. Returns nothing; the head centre is (cx, hy). */
function faceAt(g: Ctx, cx: number, hy: number, s: number, rx = 6, ry = 6.8): void {
  g.fillStyle = SKIN;
  g.beginPath();
  g.ellipse(cx, hy, rx * s, ry * s, 0, 0, TAU);
  g.fill();
}

function eyesAt(g: Ctx, cx: number, y: number, s: number, color: string, glow: string, gap = 2.6): void {
  glowDot(g, cx - gap * s, y, 1.1 * s, 0.75 * s, color, glow, 3 * s);
  glowDot(g, cx + gap * s, y, 1.1 * s, 0.75 * s, color, glow, 3 * s);
}

function browsAt(g: Ctx, cx: number, y: number, s: number, color: string, tilt = 1): void {
  g.strokeStyle = color;
  g.lineWidth = 1 * s;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx - 4.6 * s, y - 0.6 * s * tilt);
  g.lineTo(cx - 1.4 * s, y + 0.6 * s * tilt);
  g.moveTo(cx + 4.6 * s, y - 0.6 * s * tilt);
  g.lineTo(cx + 1.4 * s, y + 0.6 * s * tilt);
  g.stroke();
}

/** Byakuya Kuchiki: long black hair with white kenseikan, a silver scarf, calm eyes; sakura petals around him. */
const byakuya: Draw = (g, w, h) => {
  const s = 2;
  const cx = w / 2;
  const cy = h / 2 + 4;
  const hy = cy - 13 * s;
  aura(g, cx, cy, 52, 'rgba(255,156,194,0.16)');
  // The scarf trailing behind
  g.fillStyle = 'rgba(226,232,248,0.92)';
  g.beginPath();
  g.moveTo(cx - 4 * s, cy - 7 * s);
  g.quadraticCurveTo(cx - 18 * s, cy - 2 * s, cx - 17 * s, cy + 14 * s);
  g.lineTo(cx - 13 * s, cy + 13 * s);
  g.quadraticCurveTo(cx - 13 * s, cy, cx - 1 * s, cy - 5 * s);
  g.closePath();
  g.fill();
  captainBody(g, cx, cy, s, { haori: 'sleeved', obi: '#2a2d3a' });
  // The scarf around the neck
  g.fillStyle = '#e2e8f8';
  roundRect(g, cx - 7 * s, cy - 8.6 * s, 14 * s, 3.2 * s, 1.5 * s);
  g.fill();
  // Long straight black hair, behind and framing the face
  g.fillStyle = '#0d0e14';
  g.beginPath();
  g.ellipse(cx, hy + 1 * s, 7.6 * s, 8.4 * s, 0, 0, TAU);
  g.fill();
  g.fillRect(cx - 7.6 * s, hy, 3 * s, 9 * s);
  g.fillRect(cx + 4.6 * s, hy, 3 * s, 9 * s);
  faceAt(g, cx, hy + 1 * s, s, 5.4, 6.4);
  g.fillStyle = '#0d0e14';
  g.beginPath();
  g.ellipse(cx, hy - 3.2 * s, 6.6 * s, 3.6 * s, 0, Math.PI, TAU);
  g.fill();
  // The single strand between the eyes
  g.strokeStyle = '#0d0e14';
  g.lineWidth = 0.9 * s;
  g.beginPath();
  g.moveTo(cx, hy - 4 * s);
  g.quadraticCurveTo(cx + 0.8 * s, hy, cx - 0.4 * s, hy + 3 * s);
  g.stroke();
  // Kenseikan: white ornaments clipped in the hair
  g.fillStyle = '#ffffff';
  g.strokeStyle = 'rgba(60,64,80,0.6)';
  g.lineWidth = 0.6;
  for (const [x, y] of [
    [-6.4, -6.2],
    [-5, -7.8],
    [-3.4, -9],
    [4.2, -7.6],
    [5.6, -6.2],
  ] as const) {
    roundRect(g, cx + x * s - 1 * s, hy + y * s - 1.6 * s, 2 * s, 3.2 * s, 0.6 * s);
    g.fill();
    g.stroke();
  }
  // Calm, level eyes
  g.strokeStyle = '#1a1c26';
  g.lineWidth = 0.9 * s;
  g.beginPath();
  g.moveTo(cx - 4 * s, hy + 1 * s);
  g.lineTo(cx - 1.4 * s, hy + 1 * s);
  g.moveTo(cx + 1.4 * s, hy + 1 * s);
  g.lineTo(cx + 4 * s, hy + 1 * s);
  g.stroke();
  glowDot(g, cx - 2.7 * s, hy + 1.6 * s, 0.8 * s, 0.6 * s, '#cfd6e8', '#9aa6c8', 2);
  glowDot(g, cx + 2.7 * s, hy + 1.6 * s, 0.8 * s, 0.6 * s, '#cfd6e8', '#9aa6c8', 2);
  // A few petals
  g.fillStyle = '#ffb3cf';
  for (const [x, y, a] of [
    [17, -14, 0.6],
    [21, -2, 2.1],
    [-19, 6, 4],
  ] as const) {
    g.beginPath();
    g.ellipse(cx + x * s, cy + y * s, 1.6 * s, 0.9 * s, a, 0, TAU);
    g.fill();
  }
};

/** Tōshirō Hitsugaya: small, spiky white hair, teal eyes, a green sash holding the sword on his back. */
const hitsugaya: Draw = (g, w, h) => {
  const s = 1.75;
  const cx = w / 2;
  const cy = h / 2 + 8;
  const hy = cy - 13 * s;
  aura(g, cx, cy, 50, 'rgba(143,216,255,0.18)');
  // The sword on his back, hilt over the right shoulder
  g.strokeStyle = '#2b3140';
  g.lineWidth = 2.4 * s;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx - 6 * s, cy + 8 * s);
  g.lineTo(cx + 11 * s, cy - 19 * s);
  g.stroke();
  g.strokeStyle = '#3aa6a0';
  g.lineWidth = 1.8 * s;
  g.beginPath();
  g.moveTo(cx + 8.5 * s, cy - 15 * s);
  g.lineTo(cx + 12 * s, cy - 20.5 * s);
  g.stroke();
  g.fillStyle = '#d9e4f2';
  g.beginPath();
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    const r = k % 2 === 0 ? 2.6 * s : 1 * s;
    g.lineTo(cx + 8 * s + Math.cos(a) * r, cy - 14 * s + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  captainBody(g, cx, cy, s, { haori: 'sleeved', obi: '#2a2d3a' });
  // The green sash across the chest
  g.strokeStyle = '#3f9a5c';
  g.lineWidth = 2.2 * s;
  g.lineCap = 'butt';
  g.beginPath();
  g.moveTo(cx - 8 * s, cy - 6 * s);
  g.lineTo(cx + 9 * s, cy + 9 * s);
  g.stroke();
  faceAt(g, cx, hy + 0.5 * s, s);
  // Spiky white hair
  g.fillStyle = '#eef4ff';
  g.strokeStyle = 'rgba(120,150,190,0.6)';
  g.lineWidth = 0.7;
  g.beginPath();
  const spikes: [number, number][] = [
    [-8, -1],
    [-9.5, -6],
    [-6, -8],
    [-6.5, -12.5],
    [-2.5, -10],
    [0, -14.5],
    [2.5, -10],
    [6.5, -12.5],
    [6, -8],
    [9.5, -6],
    [8, -1],
  ];
  g.moveTo(cx - 7 * s, hy + 1 * s);
  for (let k = 0; k < spikes.length; k++) {
    const [x, y] = spikes[k];
    g.lineTo(cx + x * s, hy + y * s);
    if (k < spikes.length - 1) {
      const [nx, ny] = spikes[k + 1];
      g.lineTo(cx + ((x + nx) / 2) * 0.82 * s, hy + ((y + ny) / 2) * 0.72 * s);
    }
  }
  g.lineTo(cx + 7 * s, hy + 1 * s);
  g.lineTo(cx + 3 * s, hy - 3 * s);
  g.lineTo(cx + 1 * s, hy + 0.5 * s);
  g.lineTo(cx - 1.5 * s, hy - 3 * s);
  g.lineTo(cx - 4 * s, hy + 0.5 * s);
  g.closePath();
  g.fill();
  g.stroke();
  browsAt(g, cx, hy + 0.4 * s, s, '#cfd8ea', 1.2);
  eyesAt(g, cx, hy + 1.8 * s, s, '#c8fff6', '#2fd0c0');
};

/** Suì-Fēng: short black hair, two long braids wrapped in white ending in gold rings, a sleeveless haori, the golden stinger. */
const soifon: Draw = (g, w, h) => {
  const s = 1.85;
  const cx = w / 2;
  const cy = h / 2 + 6;
  const hy = cy - 13 * s;
  aura(g, cx, cy, 50, 'rgba(255,210,122,0.16)');
  captainBody(g, cx, cy, s, { haori: 'sleeveless', obi: '#e8c04a' });
  // The golden stinger on her right hand
  g.save();
  g.fillStyle = '#ffd27a';
  g.shadowColor = '#ffb347';
  g.shadowBlur = 5;
  poly(g, [
    [cx + 10.6 * s, cy + 10 * s],
    [cx + 13 * s, cy + 10 * s],
    [cx + 13.4 * s, cy + 16.5 * s],
  ]);
  g.fill();
  g.restore();
  faceAt(g, cx, hy + 0.5 * s, s, 5.6, 6.4);
  // Short black hair with bangs
  g.fillStyle = '#0e0f15';
  g.beginPath();
  g.ellipse(cx, hy - 1.6 * s, 6.8 * s, 5.8 * s, 0, Math.PI * 0.95, Math.PI * 2.05);
  g.fill();
  poly(g, [
    [cx - 6.6 * s, hy - 1.5 * s],
    [cx - 5.2 * s, hy + 3 * s],
    [cx - 3.6 * s, hy - 1 * s],
    [cx - 1.2 * s, hy + 1 * s],
    [cx + 1.2 * s, hy - 1.5 * s],
    [cx + 3.8 * s, hy + 1 * s],
    [cx + 5.4 * s, hy - 1 * s],
    [cx + 6.6 * s, hy + 2.5 * s],
    [cx + 6.8 * s, hy - 3 * s],
  ]);
  g.fill();
  // The braids, wrapped in white, swinging out past her arms, gold rings at the ends
  for (const dir of [-1, 1]) {
    const x0 = cx + dir * 6.4 * s;
    const y0 = hy + 3 * s;
    const x1 = cx + dir * 14.2 * s;
    const y1 = cy + 9 * s;
    const mx = cx + dir * 13.4 * s;
    const my = hy + 6 * s;
    g.fillStyle = '#0e0f15';
    g.beginPath();
    g.arc(x0, y0, 1.5 * s, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(70,70,64,0.8)';
    g.lineWidth = 2.6 * s;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo(mx, my, x1, y1);
    g.stroke();
    g.strokeStyle = '#f2f2ee';
    g.lineWidth = 1.9 * s;
    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo(mx, my, x1, y1);
    g.stroke();
    g.strokeStyle = '#ffd27a';
    g.lineWidth = 0.9 * s;
    g.beginPath();
    g.arc(x1, y1 + 1.8 * s, 1.6 * s, 0, TAU);
    g.stroke();
  }
  browsAt(g, cx, hy + 0.6 * s, s, '#0e0f15', 1.3);
  eyesAt(g, cx, hy + 2 * s, s, '#e8eaf0', '#8a90a8', 2.4);
};

/** Sajin Komamura: a towering wolf-headed captain. */
const komamura: Draw = (g, w, h) => {
  const s = 2.2;
  const cx = w / 2;
  const cy = h / 2 + 6;
  const hy = cy - 13 * s;
  aura(g, cx, cy, 62, 'rgba(201,181,138,0.18)');
  captainBody(g, cx, cy, s, { haori: 'sleeved', broad: 1.35, obi: '#5a4a36' });
  // Fur ruff at the neck
  g.fillStyle = '#7a4e28';
  g.beginPath();
  for (let k = 0; k <= 14; k++) {
    const a = Math.PI * (k / 14);
    const r = (k % 2 === 0 ? 9 : 7) * s;
    g.lineTo(cx + Math.cos(a) * r * 1.2, cy - 6.5 * s + Math.sin(a) * r * 0.45);
  }
  g.closePath();
  g.fill();
  // Ears
  g.fillStyle = '#a8703a';
  for (const dir of [-1, 1]) {
    poly(g, [
      [cx + dir * 3.5 * s, hy - 5 * s],
      [cx + dir * 8.8 * s, hy - 13 * s],
      [cx + dir * 9 * s, hy - 3 * s],
    ]);
    g.fill();
    g.fillStyle = '#5a3418';
    poly(g, [
      [cx + dir * 5 * s, hy - 5.5 * s],
      [cx + dir * 8.2 * s, hy - 10.5 * s],
      [cx + dir * 8.2 * s, hy - 4.5 * s],
    ]);
    g.fill();
    g.fillStyle = '#a8703a';
  }
  // Head and muzzle
  const fur = g.createRadialGradient(cx - 2 * s, hy - 3 * s, 1, cx, hy, 10 * s);
  fur.addColorStop(0, '#c4884a');
  fur.addColorStop(1, '#8a5a2e');
  g.fillStyle = fur;
  g.beginPath();
  g.ellipse(cx, hy, 8.6 * s, 8 * s, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#ead6b4';
  g.beginPath();
  g.ellipse(cx, hy + 3.6 * s, 4.4 * s, 4 * s, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#1a1210';
  g.beginPath();
  g.ellipse(cx, hy + 1.8 * s, 1.6 * s, 1.1 * s, 0, 0, TAU);
  g.fill();
  g.strokeStyle = '#1a1210';
  g.lineWidth = 0.7 * s;
  g.beginPath();
  g.moveTo(cx, hy + 2.8 * s);
  g.lineTo(cx, hy + 4.4 * s);
  g.moveTo(cx - 2.4 * s, hy + 5.2 * s);
  g.quadraticCurveTo(cx, hy + 6.2 * s, cx + 2.4 * s, hy + 5.2 * s);
  g.stroke();
  browsAt(g, cx, hy - 3.2 * s, s, '#4a2c14', 1);
  eyesAt(g, cx, hy - 1.8 * s, s, '#fff2b0', '#ffc23a', 3.4);
};

/** Chōjirō Sasakibe: a lieutenant, grey hair combed back, a grey mustache, the armband, a rapier. */
const sasakibe: Draw = (g, w, h) => {
  const s = 2;
  const cx = w / 2;
  const cy = h / 2 + 4;
  const hy = cy - 13 * s;
  aura(g, cx, cy, 52, 'rgba(255,243,160,0.16)');
  // The rapier at the left hip, a cup hilt forward
  g.strokeStyle = '#d8dde8';
  g.lineWidth = 1.1 * s;
  g.beginPath();
  g.moveTo(cx + 6 * s, cy + 6 * s);
  g.lineTo(cx + 17 * s, cy + 19 * s);
  g.stroke();
  captainBody(g, cx, cy, s, { haori: 'none', obi: '#eceff6' });
  g.strokeStyle = '#e8c86a';
  g.lineWidth = 0.9 * s;
  g.beginPath();
  g.arc(cx + 6.4 * s, cy + 6.4 * s, 2.2 * s, 0, TAU);
  g.stroke();
  // Lieutenant's armband on the left arm
  g.save();
  g.translate(cx - 10.5 * s, cy + 0.5 * s);
  g.rotate(0.25);
  g.fillStyle = '#f2f2ee';
  g.fillRect(-4.2 * s, -1.6 * s, 8.4 * s, 3.2 * s);
  g.fillStyle = '#20232e';
  g.fillRect(-1.2 * s, -1 * s, 2.4 * s, 2 * s);
  g.restore();
  faceAt(g, cx, hy + 0.5 * s, s, 5.6, 6.6);
  // Grey hair combed back
  g.fillStyle = '#c9ccd6';
  g.beginPath();
  g.ellipse(cx, hy - 2.6 * s, 6.6 * s, 4.6 * s, 0, Math.PI, TAU);
  g.fill();
  g.strokeStyle = 'rgba(90,94,110,0.6)';
  g.lineWidth = 0.6;
  for (let k = -2; k <= 2; k++) {
    g.beginPath();
    g.moveTo(cx + k * 2 * s, hy - 2.8 * s);
    g.quadraticCurveTo(cx + k * 2.4 * s, hy - 6.4 * s, cx + k * 1.4 * s, hy - 7.2 * s);
    g.stroke();
  }
  browsAt(g, cx, hy, s, '#a0a4b0', 1.1);
  eyesAt(g, cx, hy + 1.4 * s, s, '#e8eaf0', '#7a8098', 2.5);
  // Grey mustache, the ends curled up
  g.fillStyle = '#d8dce4';
  for (const dir of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx, hy + 3.6 * s);
    g.quadraticCurveTo(cx + dir * 3.4 * s, hy + 3 * s, cx + dir * 5 * s, hy + 2.6 * s);
    g.quadraticCurveTo(cx + dir * 3.4 * s, hy + 4.8 * s, cx, hy + 4.6 * s);
    g.closePath();
    g.fill();
  }
};

/**
 * Genryūsai Yamamoto, the Captain-Commander: bald and scarred, long white
 * brows and a long white beard tied with a band, the haori draped over his
 * shoulders, his sword sealed as a wooden cane.
 */
const yamamoto: Draw = (g, w, h) => {
  const s = 2.1;
  const cx = w / 2;
  const cy = h / 2 + 8;
  const hy = cy - 13 * s;
  aura(g, cx, cy, 60, 'rgba(255,122,60,0.22)');
  captainBody(g, cx, cy, s, { haori: 'draped', obi: '#2a2d3a' });
  // The haori sits over his shoulders
  for (const dir of [-1, 1]) {
    g.fillStyle = HAORI;
    g.beginPath();
    g.moveTo(cx + dir * 4 * s, cy - 7 * s);
    g.quadraticCurveTo(cx + dir * 12 * s, cy - 8.5 * s, cx + dir * 15 * s, cy - 1 * s);
    g.lineTo(cx + dir * 11 * s, cy - 2.6 * s);
    g.quadraticCurveTo(cx + dir * 8 * s, cy - 5.6 * s, cx + dir * 4 * s, cy - 5 * s);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(20,24,40,0.35)';
    g.lineWidth = 0.9;
    g.stroke();
  }
  // The cane in his right hand
  g.strokeStyle = '#7a4e28';
  g.lineWidth = 1.8 * s;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx + 12 * s, cy - 6 * s);
  g.lineTo(cx + 12.6 * s, cy + 21 * s);
  g.stroke();
  g.strokeStyle = '#4a2c14';
  g.lineWidth = 0.6 * s;
  for (const y of [-2, 6, 14]) {
    g.beginPath();
    g.moveTo(cx + 11.2 * s, cy + y * s);
    g.lineTo(cx + 13.4 * s, cy + (y + 0.4) * s);
    g.stroke();
  }
  // Bald, scarred head
  g.fillStyle = SKIN;
  g.beginPath();
  g.ellipse(cx, hy - 0.6 * s, 6.6 * s, 7.6 * s, 0, 0, TAU);
  g.fill();
  g.strokeStyle = 'rgba(150,90,70,0.7)';
  g.lineWidth = 0.6 * s;
  g.beginPath();
  g.moveTo(cx - 4.6 * s, hy - 6.4 * s);
  g.lineTo(cx - 0.6 * s, hy - 3 * s);
  g.moveTo(cx - 1 * s, hy - 7.2 * s);
  g.lineTo(cx - 4 * s, hy - 2.6 * s);
  g.stroke();
  // Long white beard down the chest, tied with a band
  g.fillStyle = '#f2f2ee';
  g.beginPath();
  g.moveTo(cx - 4.6 * s, hy + 2.6 * s);
  g.quadraticCurveTo(cx - 5 * s, cy + 2 * s, cx - 1.4 * s, cy + 12 * s);
  g.lineTo(cx, cy + 15 * s);
  g.lineTo(cx + 1.4 * s, cy + 12 * s);
  g.quadraticCurveTo(cx + 5 * s, cy + 2 * s, cx + 4.6 * s, hy + 2.6 * s);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(160,160,150,0.6)';
  g.lineWidth = 0.6;
  for (let k = -1; k <= 1; k++) {
    g.beginPath();
    g.moveTo(cx + k * 2 * s, hy + 4 * s);
    g.lineTo(cx + k * 0.8 * s, cy + 9 * s);
    g.stroke();
  }
  g.fillStyle = '#8a5ab8';
  g.fillRect(cx - 2.2 * s, cy + 8.6 * s, 4.4 * s, 1.4 * s);
  // Long white brows over closed eyes, and a white mustache
  g.strokeStyle = '#f2f2ee';
  g.lineWidth = 1.3 * s;
  g.lineCap = 'round';
  for (const dir of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx + dir * 1.2 * s, hy - 1.6 * s);
    g.quadraticCurveTo(cx + dir * 5 * s, hy - 2.6 * s, cx + dir * 7.4 * s, hy + 2.4 * s);
    g.stroke();
  }
  g.strokeStyle = '#3a2a24';
  g.lineWidth = 0.7 * s;
  g.beginPath();
  g.moveTo(cx - 3.6 * s, hy + 0.4 * s);
  g.lineTo(cx - 1.4 * s, hy + 0.6 * s);
  g.moveTo(cx + 1.4 * s, hy + 0.6 * s);
  g.lineTo(cx + 3.6 * s, hy + 0.4 * s);
  g.stroke();
  g.fillStyle = '#f2f2ee';
  for (const dir of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx, hy + 2.4 * s);
    g.quadraticCurveTo(cx + dir * 3.6 * s, hy + 2 * s, cx + dir * 5.4 * s, hy + 5 * s);
    g.quadraticCurveTo(cx + dir * 3 * s, hy + 3.6 * s, cx, hy + 3.6 * s);
    g.closePath();
    g.fill();
  }
};

/** The charred dead the Captain-Commander raises: blackened bones, embers for eyes. Original design. */
const ashen: Draw = (g, w, h) => {
  const cx = w / 2;
  const cy = h / 2 + 3;
  aura(g, cx, cy, 24, 'rgba(255,120,40,0.2)');
  // Torso of charred bone
  g.fillStyle = '#2a201c';
  g.beginPath();
  g.moveTo(cx - 7, cy - 4);
  g.lineTo(cx + 7, cy - 4);
  g.lineTo(cx + 5, cy + 14);
  g.lineTo(cx - 5, cy + 14);
  g.closePath();
  g.fill();
  g.strokeStyle = '#b89a80';
  g.lineWidth = 1.3;
  for (let k = 0; k < 4; k++) {
    const y = cy - 1 + k * 3.6;
    g.beginPath();
    g.moveTo(cx - 5.5 + k * 0.4, y);
    g.quadraticCurveTo(cx, y + 1.6, cx + 5.5 - k * 0.4, y);
    g.stroke();
  }
  g.beginPath();
  g.moveTo(cx, cy - 4);
  g.lineTo(cx, cy + 14);
  g.stroke();
  // Arms
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(cx - 7, cy - 3);
  g.lineTo(cx - 11, cy + 6);
  g.moveTo(cx + 7, cy - 3);
  g.lineTo(cx + 11, cy + 6);
  g.stroke();
  // Skull with ember eyes
  g.fillStyle = '#8a7462';
  g.beginPath();
  g.ellipse(cx, cy - 10, 6, 6.4, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#2a201c';
  g.fillRect(cx - 3.6, cy - 5.6, 7.2, 2.4);
  glowDot(g, cx - 2.3, cy - 10.6, 1.4, 1.4, '#ffd27a', '#ff6a1f', 6);
  glowDot(g, cx + 2.3, cy - 10.6, 1.4, 1.4, '#ffd27a', '#ff6a1f', 6);
  // Embers drifting off
  for (const [x, y] of [
    [-8, -14],
    [9, -11],
    [-10, 2],
    [10, 9],
  ] as const) {
    glowDot(g, cx + x, cy + y, 1, 1, '#ffb070', '#ff6a1f', 4);
  }
};

/** A rift (Garganta, or a Senkaimon in Seireitei): a jagged tear in the air, black inside, red light at its edge. */
const rift: Draw = (g, w, h) => {
  const cx = w / 2;
  const cy = h / 2;
  const rnd = seeded(13);
  aura(g, cx, cy, w * 0.5, 'rgba(255,40,80,0.25)');
  const pts: [number, number][] = [];
  const n = 22;
  for (let k = 0; k < n; k++) {
    const t = (k / n) * TAU;
    const jag = 1 + (rnd() - 0.5) * 0.3;
    // A tall lens, pinched at the top and bottom.
    const x = cx + Math.sin(t) * w * 0.2 * jag * (0.35 + 0.65 * Math.abs(Math.sin(t)));
    const y = cy - Math.cos(t) * h * 0.42 * (k % 2 ? 0.96 : 1);
    pts.push([x, y]);
  }
  const inside = g.createRadialGradient(cx, cy, 2, cx, cy, h * 0.42);
  inside.addColorStop(0, '#3a0c22');
  inside.addColorStop(0.6, '#12040c');
  inside.addColorStop(1, '#050208');
  g.save();
  g.fillStyle = inside;
  g.shadowColor = '#ff2d4a';
  g.shadowBlur = 12;
  poly(g, pts);
  g.fill();
  g.restore();
  g.strokeStyle = '#ff6a7e';
  g.lineWidth = 2;
  poly(g, pts);
  g.stroke();
  // A slow swirl of red inside
  g.strokeStyle = 'rgba(255,60,100,0.45)';
  g.lineWidth = 1.4;
  for (let k = 0; k < 3; k++) {
    g.beginPath();
    g.ellipse(cx, cy, w * (0.05 + k * 0.035), h * (0.14 + k * 0.08), 0, k * 0.8, Math.PI + k * 0.8);
    g.stroke();
  }
};

// -------------------------------------------------------------- pickups

function chest(body: string, lid: string, band: string, glowColor: string): Draw {
  return (g, w, h) => {
    aura(g, w / 2, h / 2 + 2, w / 2, glowColor);
    g.fillStyle = body;
    roundRect(g, 5, 14, w - 10, h - 17, 3);
    g.fill();
    g.fillStyle = lid;
    roundRect(g, 4, 6, w - 8, 11, 4);
    g.fill();
    g.fillStyle = band;
    g.fillRect(10, 6, 4, h - 9);
    g.fillRect(w - 14, 6, 4, h - 9);
    g.fillRect(4, 15, w - 8, 3);
    g.fillRect(w / 2 - 3, 14, 6, 7);
    g.fillStyle = '#140d06';
    g.fillRect(w / 2 - 1, 17, 2, 3);
  };
}

const medallion: Draw = (g, w) => {
  const c = w / 2;
  aura(g, c, c, c, 'rgba(255,215,120,0.5)');
  const grad = g.createRadialGradient(c - 4, c - 4, 1, c, c, c * 0.6);
  grad.addColorStop(0, '#fff6dc');
  grad.addColorStop(0.6, '#ffcb5c');
  grad.addColorStop(1, '#8a5a12');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(c, c, c * 0.55, 0, TAU);
  g.fill();
  g.strokeStyle = '#5a3a08';
  g.lineWidth = 1.5;
  g.beginPath();
  g.arc(c, c, c * 0.38, 0, TAU);
  g.stroke();
  g.fillStyle = '#5a3a08';
  g.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU - Math.PI / 2;
    const r = k % 2 ? c * 0.12 : c * 0.3;
    g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
};

const heart: Draw = (g, w, h) => {
  aura(g, w / 2, h / 2, w / 2, 'rgba(255,90,120,0.35)');
  const grad = g.createLinearGradient(0, 4, 0, h - 4);
  grad.addColorStop(0, '#ff8aa0');
  grad.addColorStop(1, '#d01d47');
  g.fillStyle = grad;
  const cx = w / 2;
  g.beginPath();
  g.moveTo(cx, h - 7);
  g.bezierCurveTo(cx - 16, h - 16, cx - 12, 4, cx, 11);
  g.bezierCurveTo(cx + 12, 4, cx + 16, h - 16, cx, h - 7);
  g.closePath();
  g.fill();
};

const magnet: Draw = (g, w, h) => {
  const c = w / 2;
  aura(g, c, h / 2, c, 'rgba(120,190,255,0.35)');
  g.lineCap = 'butt';
  g.strokeStyle = '#e8414f';
  g.lineWidth = 6;
  g.beginPath();
  g.arc(c, h / 2 - 1, 9, Math.PI * 0.05, Math.PI * 0.95, true);
  g.stroke();
  g.fillStyle = '#e8eef8';
  g.fillRect(c - 12, h / 2, 6, 6);
  g.fillRect(c + 6, h / 2, 6, 6);
};

const nuke: Draw = (g, w, h) => {
  const c = w / 2;
  aura(g, c, h / 2, c, 'rgba(255,240,170,0.45)');
  g.fillStyle = '#fff8dc';
  g.beginPath();
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * TAU - Math.PI / 2;
    const r = k % 2 === 0 ? 13 : 6;
    g.lineTo(c + Math.cos(a) * r, h / 2 + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
};

/** Hollow Bala: a red energy orb. */
const bala: Draw = (g, w) => {
  const c = w / 2;
  aura(g, c, c, c, 'rgba(255,40,70,0.7)');
  glowDot(g, c, c, c * 0.35, c * 0.35, '#ffe0e6', '#ff2d4a', 6);
};

const iceBolt: Draw = (g, w, h) => {
  const cy = h / 2;
  g.save();
  g.shadowColor = 'rgba(150,220,255,0.9)';
  g.shadowBlur = 8;
  g.fillStyle = '#dff6ff';
  poly(g, [
    [w - 1, cy],
    [w * 0.35, cy - h * 0.45],
    [0, cy],
    [w * 0.35, cy + h * 0.45],
  ]);
  g.fill();
  g.restore();
};

// ------------------------------------------------------ the Soul King Palace

/** The Royal Guard's long white coat, open at the front and edged in gold, over a black kimono. */
function royalRobe(g: Ctx, cx: number, cy: number, s: number, broad = 1, trim = '#e8c870'): void {
  const robe = g.createLinearGradient(0, cy - 6 * s, 0, cy + 20 * s);
  robe.addColorStop(0, '#262935');
  robe.addColorStop(1, '#07080c');
  g.fillStyle = robe;
  g.beginPath();
  g.moveTo(cx - 8 * s * broad, cy - 6 * s);
  g.lineTo(cx + 8 * s * broad, cy - 6 * s);
  g.lineTo(cx + 11 * s * broad, cy + 20 * s);
  g.lineTo(cx - 11 * s * broad, cy + 20 * s);
  g.closePath();
  g.fill();
  for (const dir of [-1, 1]) {
    g.fillStyle = '#f4f2ec';
    g.beginPath();
    g.ellipse(cx + dir * 4 * s, cy + 20.6 * s, 2.6 * s, 1.4 * s, 0, 0, TAU);
    g.fill();
  }
  const coat = g.createLinearGradient(0, cy - 7 * s, 0, cy + 20 * s);
  coat.addColorStop(0, '#ffffff');
  coat.addColorStop(1, '#dde2ee');
  for (const dir of [-1, 1]) {
    g.fillStyle = coat;
    g.beginPath();
    g.moveTo(cx + dir * 9.5 * s * broad, cy - 7 * s);
    g.lineTo(cx + dir * 2.6 * s, cy - 7 * s);
    g.lineTo(cx + dir * 3.6 * s, cy + 19.5 * s);
    g.lineTo(cx + dir * 13.5 * s * broad, cy + 19.5 * s);
    g.closePath();
    g.fill();
    g.strokeStyle = trim;
    g.lineWidth = 1.1;
    g.stroke();
    g.fillStyle = coat;
    g.beginPath();
    g.ellipse(cx + dir * 11.5 * s * broad, cy + 2 * s, 4.8 * s, 8.2 * s, -dir * 0.25, 0, TAU);
    g.fill();
    g.strokeStyle = trim;
    g.lineWidth = 0.9;
    g.stroke();
  }
  g.fillStyle = '#eceff6';
  poly(g, [
    [cx - 4.5 * s, cy - 6 * s],
    [cx, cy + 1.5 * s],
    [cx + 4.5 * s, cy - 6 * s],
    [cx + 2.8 * s, cy - 6 * s],
    [cx, cy - 1.2 * s],
    [cx - 2.8 * s, cy - 6 * s],
  ]);
  g.fill();
}

function royalHands(g: Ctx, cx: number, cy: number, s: number, broad = 1, skin = SKIN): void {
  g.fillStyle = skin;
  for (const dir of [-1, 1]) {
    g.beginPath();
    g.arc(cx + dir * 12 * s * broad, cy + 9.8 * s, 1.6 * s, 0, TAU);
    g.fill();
  }
}

/** Tenjirō Kirinji: a towering black pompadour, sideburns, a fierce grin, a long blade at his back. */
const tenjiro: Draw = (g, w, h) => {
  const s = 2;
  const cx = w / 2;
  const cy = h / 2 + 5;
  const hy = cy - 13 * s;
  const tan = '#dfb08a';
  aura(g, cx, cy, 52, 'rgba(143,224,255,0.16)');
  // The blade across his back
  g.save();
  g.translate(cx, cy - 2 * s);
  g.rotate(-0.75);
  g.fillStyle = '#e8eef8';
  g.fillRect(-1.2 * s, -24 * s, 2.4 * s, 26 * s);
  g.fillStyle = '#2a1e18';
  g.fillRect(-1.4 * s, 2 * s, 2.8 * s, 9 * s);
  g.fillStyle = '#d8b860';
  g.fillRect(-3 * s, 1.2 * s, 6 * s, 1.4 * s);
  g.restore();
  royalRobe(g, cx, cy, s, 1.12);
  royalHands(g, cx, cy, s, 1.12, tan);
  g.fillStyle = tan;
  g.beginPath();
  g.ellipse(cx, hy + 1 * s, 6 * s, 6.6 * s, 0, 0, TAU);
  g.fill();
  // Sideburns
  g.fillStyle = '#0d0e14';
  g.fillRect(cx - 6.2 * s, hy - 2 * s, 1.8 * s, 6 * s);
  g.fillRect(cx + 4.4 * s, hy - 2 * s, 1.8 * s, 6 * s);
  // The pompadour: a tall rolled wave of hair over the forehead
  g.beginPath();
  g.moveTo(cx - 6.4 * s, hy - 1 * s);
  g.quadraticCurveTo(cx - 8 * s, hy - 9 * s, cx - 3 * s, hy - 14.5 * s);
  g.quadraticCurveTo(cx + 4 * s, hy - 19 * s, cx + 8.5 * s, hy - 12 * s);
  g.quadraticCurveTo(cx + 9 * s, hy - 7 * s, cx + 6.4 * s, hy - 1 * s);
  g.quadraticCurveTo(cx, hy - 5 * s, cx - 6.4 * s, hy - 1 * s);
  g.fill();
  g.strokeStyle = 'rgba(214,222,242,0.45)';
  g.lineWidth = 0.9;
  g.beginPath();
  g.moveTo(cx - 3.5 * s, hy - 12 * s);
  g.quadraticCurveTo(cx + 2 * s, hy - 16 * s, cx + 6.5 * s, hy - 11 * s);
  g.stroke();
  browsAt(g, cx, hy - 1 * s, s, '#0d0e14', 1.6);
  eyesAt(g, cx, hy + 1.2 * s, s, '#20242e', 'rgba(143,224,255,0.6)');
  // A grin
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(cx - 3 * s, hy + 3.8 * s);
  g.quadraticCurveTo(cx, hy + 6 * s, cx + 3 * s, hy + 3.8 * s);
  g.closePath();
  g.fill();
  g.strokeStyle = '#3a2418';
  g.lineWidth = 0.8;
  g.stroke();
};

/** Kirio Hikifune: round and beaming, a big dark bun, rosy cheeks, a rice ball in hand. */
const kirio: Draw = (g, w, h) => {
  const s = 2;
  const cx = w / 2;
  const cy = h / 2 + 6;
  aura(g, cx, cy, 62, 'rgba(255,179,138,0.16)');
  // A great round body in a white robe, with a pink apron
  const body = g.createRadialGradient(cx - 6 * s, cy - 2 * s, 4 * s, cx, cy + 4 * s, 22 * s);
  body.addColorStop(0, '#ffffff');
  body.addColorStop(1, '#d9dde8');
  g.fillStyle = body;
  g.beginPath();
  g.ellipse(cx, cy + 5 * s, 19 * s, 17 * s, 0, 0, TAU);
  g.fill();
  g.strokeStyle = '#e8c870';
  g.lineWidth = 1.2;
  g.stroke();
  g.fillStyle = '#f6c6cf';
  g.beginPath();
  g.ellipse(cx, cy + 9 * s, 10 * s, 11 * s, 0, 0, TAU);
  g.fill();
  // Little arms, one holding a rice ball
  for (const dir of [-1, 1]) {
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.ellipse(cx + dir * 17 * s, cy + 3 * s, 4.5 * s, 6 * s, dir * 0.4, 0, TAU);
    g.fill();
    g.fillStyle = SKIN;
    g.beginPath();
    g.arc(cx + dir * 18.5 * s, cy + 8 * s, 2 * s, 0, TAU);
    g.fill();
  }
  g.fillStyle = '#f8f6f0';
  poly(g, [
    [cx + 18.5 * s, cy + 3 * s],
    [cx + 22.5 * s, cy + 10 * s],
    [cx + 14.5 * s, cy + 10 * s],
  ]);
  g.fill();
  g.fillStyle = '#1c2a22';
  g.fillRect(cx + 16.5 * s, cy + 7.6 * s, 4 * s, 2.4 * s);
  // Head: round face, the big bun on top
  const hy = cy - 14 * s;
  g.fillStyle = '#3a2a4a';
  g.beginPath();
  g.arc(cx, hy - 8 * s, 6 * s, 0, TAU);
  g.fill();
  g.beginPath();
  g.ellipse(cx, hy - 1 * s, 8.4 * s, 7.6 * s, 0, Math.PI, TAU);
  g.fill();
  faceAt(g, cx, hy + 1.5 * s, s, 7, 6.6);
  g.fillStyle = 'rgba(255,120,140,0.45)';
  g.beginPath();
  g.ellipse(cx - 4.4 * s, hy + 3.4 * s, 1.8 * s, 1.1 * s, 0, 0, TAU);
  g.ellipse(cx + 4.4 * s, hy + 3.4 * s, 1.8 * s, 1.1 * s, 0, 0, TAU);
  g.fill();
  // Smiling, eyes closed in two arcs
  g.strokeStyle = '#2a1e28';
  g.lineWidth = 0.9 * s;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(cx - 2.8 * s, hy + 1.6 * s, 1.2 * s, Math.PI * 1.1, Math.PI * 1.9);
  g.moveTo(cx + 4 * s, hy + 1.6 * s);
  g.arc(cx + 2.8 * s, hy + 1.6 * s, 1.2 * s, Math.PI * 1.1, Math.PI * 1.9);
  g.stroke();
  g.beginPath();
  g.arc(cx, hy + 3.4 * s, 2.2 * s, 0.2, Math.PI - 0.2);
  g.stroke();
};

/** Kirio after she sheds her bulk: slender, the dark hair let down to her waist. */
const kirioSlim: Draw = (g, w, h) => {
  const s = 2;
  const cx = w / 2;
  const cy = h / 2 + 5;
  const hy = cy - 13 * s;
  aura(g, cx, cy, 52, 'rgba(255,179,138,0.2)');
  // Long hair behind
  g.fillStyle = '#3a2a4a';
  g.beginPath();
  g.ellipse(cx, hy + 6 * s, 8.4 * s, 16 * s, 0, 0, TAU);
  g.fill();
  royalRobe(g, cx, cy, s, 0.86);
  royalHands(g, cx, cy, s, 0.86);
  faceAt(g, cx, hy + 1 * s, s, 5.4, 6.2);
  g.fillStyle = '#3a2a4a';
  g.beginPath();
  g.ellipse(cx, hy - 3 * s, 6.4 * s, 3.8 * s, 0, Math.PI, TAU);
  g.fill();
  // A pale flower in her hair
  glowDot(g, cx + 5 * s, hy - 4 * s, 1.6 * s, 1.6 * s, '#ffd8e0', 'rgba(255,179,138,0.8)', 4);
  eyesAt(g, cx, hy + 1.4 * s, s, '#3a2a4a', 'rgba(255,179,138,0.6)');
  g.strokeStyle = '#a04050';
  g.lineWidth = 0.8 * s;
  g.beginPath();
  g.moveTo(cx - 1.4 * s, hy + 4 * s);
  g.lineTo(cx + 1.4 * s, hy + 4 * s);
  g.stroke();
};

/** Ōetsu Nimaiya: a beanie, round dark glasses, a wide grin and a heavy gold chain; a sword hilt over his shoulder. */
const oetsu: Draw = (g, w, h) => {
  const s = 2;
  const cx = w / 2;
  const cy = h / 2 + 5;
  const hy = cy - 13 * s;
  aura(g, cx, cy, 52, 'rgba(255,224,138,0.16)');
  // A hilt behind the shoulder
  g.fillStyle = '#2a1e18';
  g.save();
  g.translate(cx + 9 * s, cy - 10 * s);
  g.rotate(0.5);
  g.fillRect(-1.3 * s, -7 * s, 2.6 * s, 8 * s);
  g.fillStyle = '#d8b860';
  g.fillRect(-2.6 * s, 0.6 * s, 5.2 * s, 1.4 * s);
  g.restore();
  royalRobe(g, cx, cy, s, 0.94);
  royalHands(g, cx, cy, s, 0.94);
  // The gold chain
  g.fillStyle = '#ffd25a';
  for (let k = 0; k <= 8; k++) {
    const a = Math.PI * (0.15 + (k / 8) * 0.7);
    g.beginPath();
    g.arc(cx + Math.cos(a) * 5.6 * s, cy - 6 * s + Math.sin(a) * 6 * s, 0.9 * s, 0, TAU);
    g.fill();
  }
  glowDot(g, cx, cy + 0.6 * s, 1.8 * s, 1.8 * s, '#ffd25a', 'rgba(255,210,90,0.9)', 4);
  faceAt(g, cx, hy + 1 * s, s, 5.6, 6.4);
  // Beanie
  g.fillStyle = '#26324a';
  g.beginPath();
  g.ellipse(cx, hy - 3 * s, 6.8 * s, 5.4 * s, 0, Math.PI, TAU);
  g.fill();
  g.fillRect(cx - 6.8 * s, hy - 3.4 * s, 13.6 * s, 2 * s);
  g.fillStyle = '#c84a3a';
  g.fillRect(cx - 6.8 * s, hy - 2.2 * s, 13.6 * s, 0.9 * s);
  // Round dark glasses with a glint
  g.fillStyle = '#0d0e14';
  for (const dir of [-1, 1]) {
    g.beginPath();
    g.arc(cx + dir * 2.7 * s, hy + 1 * s, 2.2 * s, 0, TAU);
    g.fill();
  }
  g.fillRect(cx - 0.6 * s, hy + 0.4 * s, 1.2 * s, 0.6 * s);
  g.fillStyle = 'rgba(255,255,255,0.8)';
  g.fillRect(cx - 3.6 * s, hy + 0.2 * s, 0.8 * s, 0.8 * s);
  g.fillRect(cx + 1.8 * s, hy + 0.2 * s, 0.8 * s, 0.8 * s);
  // A wide toothy grin
  g.fillStyle = '#ffffff';
  roundRect(g, cx - 3 * s, hy + 3.6 * s, 6 * s, 1.8 * s, 0.8 * s);
  g.fill();
  g.strokeStyle = '#3a2418';
  g.lineWidth = 0.6;
  g.stroke();
};

/** Senjumaru Shutara: a great ornate updo pinned with gold, a violet sash, and slender mechanical arms behind her. */
const senjumaru: Draw = (g, w, h) => {
  const s = 2;
  const cx = w / 2;
  const cy = h / 2 + 7;
  const hy = cy - 13 * s;
  aura(g, cx, cy, 56, 'rgba(216,184,255,0.18)');
  // The extra arms: jointed, arching out from her back
  g.strokeStyle = '#2a2436';
  g.lineWidth = 1.4 * s;
  g.lineCap = 'round';
  for (const dir of [-1, 1]) {
    for (const lift of [0, 1]) {
      const x0 = cx + dir * 4 * s;
      const y0 = cy - 4 * s;
      const x1 = cx + dir * (16 + lift * 3) * s;
      const y1 = cy - (10 + lift * 8) * s;
      const x2 = cx + dir * (24 + lift * 2) * s;
      const y2 = cy + (2 - lift * 10) * s;
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.lineTo(x2, y2);
      g.stroke();
      glowDot(g, x1, y1, 1.1 * s, 1.1 * s, '#e8c870', 'rgba(232,200,112,0.7)', 3);
    }
  }
  royalRobe(g, cx, cy, s, 0.92, '#c9a8ff');
  royalHands(g, cx, cy, s, 0.92);
  g.fillStyle = '#6a4a9a';
  g.fillRect(cx - 9 * s, cy + 4 * s, 18 * s, 2.4 * s);
  // The updo: two great loops of black hair above a smooth crown
  g.fillStyle = '#0d0e14';
  for (const dir of [-1, 1]) {
    g.beginPath();
    g.ellipse(cx + dir * 6.5 * s, hy - 9 * s, 5 * s, 6.5 * s, dir * 0.5, 0, TAU);
    g.fill();
  }
  g.beginPath();
  g.ellipse(cx, hy - 2 * s, 7.4 * s, 6 * s, 0, Math.PI, TAU);
  g.fill();
  faceAt(g, cx, hy + 1 * s, s, 5.4, 6.4);
  g.fillStyle = '#0d0e14';
  g.fillRect(cx - 6.8 * s, hy - 2 * s, 2 * s, 7 * s);
  g.fillRect(cx + 4.8 * s, hy - 2 * s, 2 * s, 7 * s);
  // Gold pins and beads
  for (const [x, y] of [
    [-9, -12],
    [9, -12],
    [-3, -7],
    [3, -7],
  ] as const) {
    glowDot(g, cx + x * s, hy + y * s, 1.2 * s, 1.2 * s, '#ffd25a', 'rgba(255,210,90,0.8)', 3);
  }
  // Half-closed eyes, red lips
  g.strokeStyle = '#1a1c26';
  g.lineWidth = 0.9 * s;
  g.beginPath();
  g.moveTo(cx - 4 * s, hy + 1.4 * s);
  g.lineTo(cx - 1.4 * s, hy + 1 * s);
  g.moveTo(cx + 1.4 * s, hy + 1 * s);
  g.lineTo(cx + 4 * s, hy + 1.4 * s);
  g.stroke();
  g.fillStyle = '#c03048';
  g.beginPath();
  g.ellipse(cx, hy + 4.2 * s, 1.3 * s, 0.7 * s, 0, 0, TAU);
  g.fill();
};

/** Ichibē Hyōsube: a great bald head, a bushy black beard and brows, dark robes and prayer beads, and a giant brush. */
const ichibe: Draw = (g, w, h) => {
  const s = 2.2;
  const cx = w / 2;
  const cy = h / 2 + 8;
  const hy = cy - 13 * s;
  aura(g, cx, cy, 66, 'rgba(154,122,255,0.18)');
  // The brush, held across him: a wooden shaft and an ink-soaked tip
  g.save();
  g.translate(cx + 4 * s, cy);
  g.rotate(0.85);
  g.fillStyle = '#8a5a2a';
  g.fillRect(-1.3 * s, -26 * s, 2.6 * s, 34 * s);
  g.fillStyle = '#1a1424';
  g.beginPath();
  g.moveTo(-3 * s, 8 * s);
  g.quadraticCurveTo(0, 22 * s, 3 * s, 8 * s);
  g.closePath();
  g.fill();
  g.restore();
  // Broad dark robes with a pale inner collar
  const robe = g.createLinearGradient(0, cy - 8 * s, 0, cy + 20 * s);
  robe.addColorStop(0, '#2a2638');
  robe.addColorStop(1, '#0b0a12');
  g.fillStyle = robe;
  g.beginPath();
  g.moveTo(cx - 11 * s, cy - 7 * s);
  g.quadraticCurveTo(cx - 17 * s, cy + 6 * s, cx - 15 * s, cy + 20 * s);
  g.lineTo(cx + 15 * s, cy + 20 * s);
  g.quadraticCurveTo(cx + 17 * s, cy + 6 * s, cx + 11 * s, cy - 7 * s);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(214,222,240,0.5)';
  g.lineWidth = 1;
  g.stroke();
  g.fillStyle = '#eceff6';
  poly(g, [
    [cx - 5 * s, cy - 7 * s],
    [cx, cy + 1 * s],
    [cx + 5 * s, cy - 7 * s],
    [cx + 3 * s, cy - 7 * s],
    [cx, cy - 2 * s],
    [cx - 3 * s, cy - 7 * s],
  ]);
  g.fill();
  // Prayer beads across the chest
  g.fillStyle = '#7a2a30';
  for (let k = 0; k <= 10; k++) {
    const a = Math.PI * (0.1 + (k / 10) * 0.8);
    g.beginPath();
    g.arc(cx + Math.cos(a) * 9 * s, cy - 4 * s + Math.sin(a) * 9 * s, 1.2 * s, 0, TAU);
    g.fill();
  }
  // Hands
  g.fillStyle = SKIN;
  for (const dir of [-1, 1]) {
    g.beginPath();
    g.arc(cx + dir * 14 * s, cy + 8 * s, 2 * s, 0, TAU);
    g.fill();
  }
  // The bald head with a shine
  faceAt(g, cx, hy, s, 7.4, 7.8);
  g.fillStyle = 'rgba(255,255,255,0.5)';
  g.beginPath();
  g.ellipse(cx - 2.6 * s, hy - 5 * s, 2.4 * s, 1.2 * s, -0.4, 0, TAU);
  g.fill();
  // A bushy black beard from cheek to chest, and a heavy mustache
  g.fillStyle = '#0d0e14';
  g.beginPath();
  g.moveTo(cx - 7 * s, hy + 1 * s);
  g.quadraticCurveTo(cx - 10 * s, hy + 12 * s, cx, hy + 15 * s);
  g.quadraticCurveTo(cx + 10 * s, hy + 12 * s, cx + 7 * s, hy + 1 * s);
  g.quadraticCurveTo(cx, hy + 6 * s, cx - 7 * s, hy + 1 * s);
  g.fill();
  g.beginPath();
  g.ellipse(cx - 2.6 * s, hy + 3.4 * s, 3.2 * s, 1.3 * s, 0.2, 0, TAU);
  g.ellipse(cx + 2.6 * s, hy + 3.4 * s, 3.2 * s, 1.3 * s, -0.2, 0, TAU);
  g.fill();
  // Thick brows over small, sharp eyes
  g.lineWidth = 1.8 * s;
  g.lineCap = 'round';
  g.strokeStyle = '#0d0e14';
  g.beginPath();
  g.moveTo(cx - 5.6 * s, hy - 2.6 * s);
  g.quadraticCurveTo(cx - 3.4 * s, hy - 4 * s, cx - 1.4 * s, hy - 2.2 * s);
  g.moveTo(cx + 5.6 * s, hy - 2.6 * s);
  g.quadraticCurveTo(cx + 3.4 * s, hy - 4 * s, cx + 1.4 * s, hy - 2.2 * s);
  g.stroke();
  eyesAt(g, cx, hy - 0.6 * s, s, '#1a1424', 'rgba(154,122,255,0.7)', 3);
};

/** A palace sentinel (original): gilded plate, a slit visor with a red plume, a tall spear. */
const sentinel: Draw = (g, w, h) => {
  const cx = w / 2;
  const cy = h / 2 + 3;
  aura(g, cx, cy, 24, 'rgba(255,224,138,0.14)');
  // Spear
  g.fillStyle = '#7a5a3a';
  g.fillRect(cx + 11, cy - 24, 2.4, 44);
  g.fillStyle = '#e8eef8';
  poly(g, [
    [cx + 12.2, cy - 33],
    [cx + 15.5, cy - 24],
    [cx + 8.9, cy - 24],
  ]);
  g.fill();
  // Plated body
  const plate = g.createLinearGradient(0, cy - 8, 0, cy + 18);
  plate.addColorStop(0, '#fff4d6');
  plate.addColorStop(1, '#b8945a');
  g.fillStyle = plate;
  poly(g, [
    [cx - 9, cy - 6],
    [cx + 9, cy - 6],
    [cx + 11, cy + 17],
    [cx - 11, cy + 17],
  ]);
  g.fill();
  g.strokeStyle = 'rgba(60,40,20,0.6)';
  g.lineWidth = 1;
  g.stroke();
  g.beginPath();
  g.moveTo(cx - 10, cy + 6);
  g.lineTo(cx + 10, cy + 6);
  g.stroke();
  // Helm with a slit visor and a plume
  g.fillStyle = '#c84a3a';
  g.beginPath();
  g.ellipse(cx, cy - 22, 3, 6, 0.3, 0, TAU);
  g.fill();
  g.fillStyle = plate;
  g.beginPath();
  g.ellipse(cx, cy - 12, 8, 9, 0, 0, TAU);
  g.fill();
  g.stroke();
  g.fillStyle = INK;
  g.fillRect(cx - 1.2, cy - 17, 2.4, 10);
  g.fillRect(cx - 5, cy - 12.6, 10, 2);
};

/** An ink wisp (original): a blob of living ink with pale eyes, dripping as it drifts. */
const inkWisp: Draw = (g, w, h) => {
  const cx = w / 2;
  const cy = h / 2;
  aura(g, cx, cy, 22, 'rgba(154,122,255,0.18)');
  const body = g.createRadialGradient(cx - 4, cy - 6, 2, cx, cy, 20);
  body.addColorStop(0, '#3a3050');
  body.addColorStop(1, '#0b0812');
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(cx - 15, cy + 4);
  g.quadraticCurveTo(cx - 16, cy - 16, cx, cy - 17);
  g.quadraticCurveTo(cx + 16, cy - 16, cx + 15, cy + 4);
  // A wavy dripping hem
  for (let k = 0; k <= 5; k++) {
    const x = cx + 15 - k * 6;
    g.quadraticCurveTo(x - 1.5, cy + (k % 2 ? 16 : 9), x - 3, cy + 5);
  }
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(200,180,255,0.4)';
  g.lineWidth = 1;
  g.stroke();
  glowDot(g, cx - 5, cy - 4, 2.6, 3.4, '#f2eeff', 'rgba(200,180,255,0.8)', 4);
  glowDot(g, cx + 5, cy - 4, 2.6, 3.4, '#f2eeff', 'rgba(200,180,255,0.8)', 4);
};

/** An inkling (original): what an ink wisp splits into, one eye and a tail. */
const inkling: Draw = (g, w, h) => {
  const cx = w / 2;
  const cy = h / 2;
  const body = g.createRadialGradient(cx - 2, cy - 4, 1, cx, cy, 13);
  body.addColorStop(0, '#3a3050');
  body.addColorStop(1, '#0b0812');
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(cx, cy + 14);
  g.quadraticCurveTo(cx - 13, cy + 2, cx - 9, cy - 8);
  g.quadraticCurveTo(cx, cy - 15, cx + 9, cy - 8);
  g.quadraticCurveTo(cx + 13, cy + 2, cx, cy + 14);
  g.fill();
  g.strokeStyle = 'rgba(200,180,255,0.4)';
  g.lineWidth = 1;
  g.stroke();
  glowDot(g, cx, cy - 3, 2.6, 3, '#f2eeff', 'rgba(200,180,255,0.8)', 4);
};

/** A spirit weaver (original): a pale hooded figure with glowing eyes, threads trailing from its hands. */
const weaver: Draw = (g, w, h) => {
  const cx = w / 2;
  const cy = h / 2 + 2;
  aura(g, cx, cy, 22, 'rgba(216,184,255,0.2)');
  g.strokeStyle = 'rgba(230,210,255,0.75)';
  g.lineWidth = 0.8;
  for (const dir of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx + dir * 10, cy + 4);
    g.quadraticCurveTo(cx + dir * 22, cy + 10, cx + dir * 20, cy + 22);
    g.moveTo(cx + dir * 10, cy + 4);
    g.quadraticCurveTo(cx + dir * 18, cy - 2, cx + dir * 24, cy + 6);
    g.stroke();
  }
  const cloak = g.createLinearGradient(0, cy - 18, 0, cy + 18);
  cloak.addColorStop(0, '#efe6ff');
  cloak.addColorStop(1, '#9a86c8');
  g.fillStyle = cloak;
  g.beginPath();
  g.moveTo(cx, cy - 20);
  g.quadraticCurveTo(cx - 12, cy - 16, cx - 13, cy + 18);
  g.lineTo(cx + 13, cy + 18);
  g.quadraticCurveTo(cx + 12, cy - 16, cx, cy - 20);
  g.fill();
  g.strokeStyle = 'rgba(60,40,90,0.55)';
  g.lineWidth = 1;
  g.stroke();
  g.fillStyle = '#140f22';
  g.beginPath();
  g.ellipse(cx, cy - 9, 6, 7, 0, 0, TAU);
  g.fill();
  glowDot(g, cx - 2.4, cy - 9, 1.3, 1.3, '#e2ccff', 'rgba(216,184,255,0.9)', 4);
  glowDot(g, cx + 2.4, cy - 9, 1.3, 1.3, '#e2ccff', 'rgba(216,184,255,0.9)', 4);
  g.fillStyle = SKIN;
  g.beginPath();
  g.arc(cx - 10, cy + 4, 1.8, 0, TAU);
  g.arc(cx + 10, cy + 4, 1.8, 0, TAU);
  g.fill();
};

/** An asauchi blade (original): an unnamed sword flying on its own, pale and humming. */
const asauchi: Draw = (g, w, h) => {
  const cx = w / 2;
  const cy = h / 2;
  aura(g, cx, cy, 20, 'rgba(232,238,248,0.22)');
  g.save();
  g.translate(cx, cy);
  g.rotate(-Math.PI / 4);
  const blade = g.createLinearGradient(-3, 0, 3, 0);
  blade.addColorStop(0, '#b8c4d8');
  blade.addColorStop(0.5, '#ffffff');
  blade.addColorStop(1, '#9aa8c0');
  g.fillStyle = blade;
  g.beginPath();
  g.moveTo(-2.4, 6);
  g.lineTo(-2.4, -14);
  g.quadraticCurveTo(0, -20, 2.6, -15);
  g.lineTo(2.4, 6);
  g.closePath();
  g.fill();
  g.fillStyle = '#d8b860';
  roundRect(g, -5.5, 6, 11, 2.6, 1);
  g.fill();
  g.fillStyle = '#20242e';
  g.fillRect(-1.8, 8.6, 3.6, 9);
  g.fillStyle = 'rgba(232,238,248,0.8)';
  for (let k = 0; k < 3; k++) g.fillRect(-1.9, 10 + k * 2.6, 3.8, 0.8);
  g.restore();
};

/** A royal attendant (original): a court servant in a tall black cap, white and gold robes, carrying a lantern. */
const attendant: Draw = (g, w, h) => {
  const cx = w / 2;
  const cy = h / 2 + 4;
  aura(g, cx, cy, 32, 'rgba(255,240,168,0.2)');
  const robe = g.createLinearGradient(0, cy - 12, 0, cy + 24);
  robe.addColorStop(0, '#ffffff');
  robe.addColorStop(1, '#d8cfb4');
  g.fillStyle = robe;
  g.beginPath();
  g.moveTo(cx - 12, cy - 10);
  g.quadraticCurveTo(cx - 18, cy + 10, cx - 16, cy + 24);
  g.lineTo(cx + 16, cy + 24);
  g.quadraticCurveTo(cx + 18, cy + 10, cx + 12, cy - 10);
  g.closePath();
  g.fill();
  g.strokeStyle = '#e8c870';
  g.lineWidth = 1.4;
  g.stroke();
  g.fillStyle = '#e8c870';
  g.fillRect(cx - 14, cy + 6, 28, 3);
  faceAt(g, cx, cy - 16, 1.6, 6, 6.4);
  g.fillStyle = '#0d0e14';
  roundRect(g, cx - 6, cy - 34, 12, 14, 3);
  g.fill();
  g.fillRect(cx - 9, cy - 22, 18, 3);
  g.strokeStyle = '#1a1c26';
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(cx - 4.5, cy - 15);
  g.lineTo(cx - 1.5, cy - 15);
  g.moveTo(cx + 1.5, cy - 15);
  g.lineTo(cx + 4.5, cy - 15);
  g.stroke();
  // The lantern held out in front
  g.strokeStyle = '#7a5a3a';
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(cx + 12, cy - 2);
  g.lineTo(cx + 20, cy + 4);
  g.stroke();
  glowDot(g, cx + 21, cy + 11, 4.5, 6, '#ffe6a0', 'rgba(255,214,120,0.95)', 10);
  g.fillStyle = '#7a5a3a';
  g.fillRect(cx + 17.5, cy + 4, 7, 1.6);
  g.fillRect(cx + 17.5, cy + 17, 7, 1.6);
};

/** A Fragment of the Soul King on the ground: a shard of white-gold light with a star at its heart. */
const fragment: Draw = (g, w, h) => {
  const cx = w / 2;
  const cy = h / 2;
  aura(g, cx, cy, w * 0.45, 'rgba(255,236,180,0.35)');
  const shard = g.createLinearGradient(cx, cy - 16, cx, cy + 16);
  shard.addColorStop(0, '#ffffff');
  shard.addColorStop(1, '#f2cf7a');
  g.fillStyle = shard;
  poly(g, [
    [cx, cy - 17],
    [cx + 9, cy - 2],
    [cx + 4, cy + 16],
    [cx - 5, cy + 15],
    [cx - 9, cy - 3],
  ]);
  g.fill();
  g.strokeStyle = 'rgba(150,110,40,0.7)';
  g.lineWidth = 1;
  g.stroke();
  g.fillStyle = '#ffffff';
  g.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU - Math.PI / 2;
    const r = k % 2 === 0 ? 5 : 2;
    g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
};

// ------------------------------------------------------------ Tier Harribel

const HARRIBEL_SKIN = '#a8744e';
const HARRIBEL_HAIR = '#f2cf63';
const HARRIBEL_HAIR_DEEP = '#c99a32';
const SHARK_BONE = '#f2efe6';
const SHARK_BONE_SHADE = '#cfc8b8';

/** Her three braids, hanging behind her left shoulder (drawn before the body). */
function harribelBraids(g: Ctx, cx: number, hy: number, s: number, len: number): void {
  g.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    const x0 = cx - (2 + k * 1.6) * s;
    const y0 = hy + 3 * s;
    const x1 = cx - (11 + k * 2.2) * s;
    const y1 = hy + (len - k * 1.5) * s;
    g.strokeStyle = HARRIBEL_HAIR_DEEP;
    g.lineWidth = 2.4 * s;
    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo(cx - (9 + k) * s, hy + 6 * s, x1, y1);
    g.stroke();
    g.strokeStyle = HARRIBEL_HAIR;
    g.lineWidth = 1.5 * s;
    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo(cx - (9 + k) * s, hy + 6 * s, x1, y1);
    g.stroke();
    // The plaits: little ticks down each braid.
    g.strokeStyle = 'rgba(150,104,30,0.7)';
    g.lineWidth = 0.5 * s;
    for (let t = 0.25; t < 1; t += 0.22) {
      const bx = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * (cx - (9 + k) * s) + t * t * x1;
      const by = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * (hy + 6 * s) + t * t * y1;
      g.beginPath();
      g.moveTo(bx - 0.8 * s, by - 0.5 * s);
      g.lineTo(bx + 0.8 * s, by + 0.5 * s);
      g.stroke();
    }
  }
}

/** Her head: dark skin, messy blonde hair with spiked bangs, narrow green eyes; the lower face hidden (by `guard`). */
function harribelHead(g: Ctx, cx: number, hy: number, s: number, guard: (y: number) => void, glowEyes: boolean): void {
  // Hair behind the head
  g.fillStyle = HARRIBEL_HAIR_DEEP;
  g.beginPath();
  g.ellipse(cx, hy - 0.6 * s, 7.6 * s, 7.4 * s, 0, 0, TAU);
  g.fill();
  faceAt(g, cx, hy + 0.6 * s, s, 5.6, 6.4);
  g.fillStyle = HARRIBEL_SKIN;
  g.beginPath();
  g.ellipse(cx, hy + 0.6 * s, 5.6 * s, 6.4 * s, 0, 0, TAU);
  g.fill();
  // The crown of the hair and the spiky bangs over her brow
  g.fillStyle = HARRIBEL_HAIR;
  g.beginPath();
  g.ellipse(cx, hy - 2.2 * s, 7.2 * s, 5.4 * s, 0, Math.PI * 0.94, Math.PI * 2.06);
  g.fill();
  poly(g, [
    [cx - 7.2 * s, hy - 2 * s],
    [cx - 6.6 * s, hy + 3.6 * s],
    [cx - 4.4 * s, hy - 0.4 * s],
    [cx - 2.8 * s, hy + 1.6 * s],
    [cx - 1.2 * s, hy - 1 * s],
    [cx + 0.6 * s, hy + 1.8 * s],
    [cx + 2.2 * s, hy - 0.8 * s],
    [cx + 4 * s, hy + 1.4 * s],
    [cx + 5 * s, hy - 0.6 * s],
    [cx + 6.8 * s, hy + 3.4 * s],
    [cx + 7.2 * s, hy - 2.4 * s],
  ]);
  g.fill();
  // Side locks framing the face
  for (const dir of [-1, 1]) {
    poly(g, [
      [cx + dir * 5.4 * s, hy - 1 * s],
      [cx + dir * 7.4 * s, hy + 1 * s],
      [cx + dir * 6.6 * s, hy + 7 * s],
      [cx + dir * 5 * s, hy + 3 * s],
    ]);
    g.fill();
  }
  // A few darker strands
  g.strokeStyle = 'rgba(160,112,34,0.75)';
  g.lineWidth = 0.6 * s;
  g.beginPath();
  g.moveTo(cx - 3 * s, hy - 6 * s);
  g.lineTo(cx - 2.6 * s, hy - 0.6 * s);
  g.moveTo(cx + 2 * s, hy - 6.4 * s);
  g.lineTo(cx + 1.4 * s, hy - 0.4 * s);
  g.stroke();
  // Narrow green eyes under level brows
  browsAt(g, cx, hy + 0.5 * s, s, '#8a6420', 0.5);
  eyesAt(g, cx, hy + 1.9 * s, s, glowEyes ? '#b8ffe0' : '#7cf0b8', glowEyes ? '#2fe0a0' : '#2fae7a', 2.5);
  g.strokeStyle = '#2a1a10';
  g.lineWidth = 0.6 * s;
  g.beginPath();
  g.moveTo(cx - 4 * s, hy + 1.2 * s);
  g.lineTo(cx - 1.2 * s, hy + 1.1 * s);
  g.moveTo(cx + 1.2 * s, hy + 1.1 * s);
  g.lineTo(cx + 4 * s, hy + 1.2 * s);
  g.stroke();
  guard(hy + 3.4 * s);
}

/**
 * Tier Harribel, the Third Espada (a chibi homage): dark skin, short messy
 * blonde hair with three braids, narrow green eyes, the tall white collar of
 * her Arrancar jacket hiding everything below them, and Tiburón, a broad
 * blade with a hollow down its middle, slung across her back.
 */
const harribel: Draw = (g, w, h) => {
  const s = 2;
  const cx = w / 2;
  const cy = h / 2 + 7;
  const hy = cy - 13 * s;
  aura(g, cx, cy, 54, 'rgba(90,200,255,0.16)');
  // Tiburón, sealed, across her back: the hilt over her right shoulder.
  g.save();
  g.translate(cx + 2 * s, cy - 2 * s);
  g.rotate(-0.85);
  const bl = 15 * s;
  g.fillStyle = '#c9d3e3';
  roundRect(g, -bl, -3 * s, 2 * bl - 4 * s, 6 * s, 1.5 * s);
  g.fill();
  g.strokeStyle = '#5a6478';
  g.lineWidth = 0.8 * s;
  g.stroke();
  g.fillStyle = '#1a2230';
  roundRect(g, -bl + 3 * s, -1.2 * s, 2 * bl - 12 * s, 2.4 * s, 1 * s);
  g.fill();
  g.fillStyle = '#d8b04a';
  g.fillRect(bl - 4.4 * s, -3.8 * s, 1.6 * s, 7.6 * s);
  g.fillStyle = '#2a2f3a';
  g.fillRect(bl - 2.8 * s, -1.3 * s, 6.4 * s, 2.6 * s);
  g.restore();
  harribelBraids(g, cx, hy, s, 15);
  // White hakama to the feet, a black sash
  const robe = g.createLinearGradient(0, cy - 6 * s, 0, cy + 20 * s);
  robe.addColorStop(0, '#ffffff');
  robe.addColorStop(1, '#cdd5e2');
  g.fillStyle = robe;
  g.beginPath();
  g.moveTo(cx - 8 * s, cy - 6 * s);
  g.lineTo(cx + 8 * s, cy - 6 * s);
  g.lineTo(cx + 11 * s, cy + 20 * s);
  g.lineTo(cx - 11 * s, cy + 20 * s);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(30,40,60,0.45)';
  g.lineWidth = 1;
  g.stroke();
  g.strokeStyle = 'rgba(30,40,60,0.22)';
  g.beginPath();
  g.moveTo(cx, cy + 7 * s);
  g.lineTo(cx, cy + 20 * s);
  g.stroke();
  for (const dir of [-1, 1]) {
    g.fillStyle = '#f4f2ec';
    g.beginPath();
    g.ellipse(cx + dir * 4 * s, cy + 20.6 * s, 2.6 * s, 1.4 * s, 0, 0, TAU);
    g.fill();
  }
  // The short jacket stops above the sash
  g.fillStyle = HARRIBEL_SKIN;
  g.fillRect(cx - 7.4 * s, cy + 1.6 * s, 14.8 * s, 2.6 * s);
  g.fillStyle = '#14161f';
  g.fillRect(cx - 9 * s, cy + 4 * s, 18 * s, 2.2 * s);
  g.fillStyle = '#f8f9fc';
  g.beginPath();
  g.moveTo(cx - 8.4 * s, cy - 6.5 * s);
  g.lineTo(cx + 8.4 * s, cy - 6.5 * s);
  g.lineTo(cx + 8.8 * s, cy + 1.8 * s);
  g.lineTo(cx - 8.8 * s, cy + 1.8 * s);
  g.closePath();
  g.fill();
  g.strokeStyle = '#14161f';
  g.lineWidth = 0.9 * s;
  g.beginPath();
  g.moveTo(cx - 8.8 * s, cy + 1.8 * s);
  g.lineTo(cx + 8.8 * s, cy + 1.8 * s);
  g.stroke();
  // Sleeves to the wrist, with black cuffs, and her hands
  for (const dir of [-1, 1]) {
    g.fillStyle = '#f4f6fa';
    g.beginPath();
    g.ellipse(cx + dir * 10.5 * s, cy + 1.5 * s, 4 * s, 7.4 * s, -dir * 0.25, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(30,40,60,0.45)';
    g.lineWidth = 0.8;
    g.stroke();
    g.strokeStyle = '#14161f';
    g.lineWidth = 1.1 * s;
    g.beginPath();
    g.moveTo(cx + dir * 9.4 * s, cy + 7.6 * s);
    g.lineTo(cx + dir * 13.4 * s, cy + 6.6 * s);
    g.stroke();
    g.fillStyle = HARRIBEL_SKIN;
    g.beginPath();
    g.arc(cx + dir * 11.6 * s, cy + 9.6 * s, 1.6 * s, 0, TAU);
    g.fill();
  }
  harribelHead(
    g,
    cx,
    hy,
    s,
    (y) => {
      // The tall collar, up to just under her eyes.
      g.fillStyle = '#f8f9fc';
      g.beginPath();
      g.moveTo(cx - 6.4 * s, y);
      g.quadraticCurveTo(cx, y - 0.8 * s, cx + 6.4 * s, y);
      g.lineTo(cx + 8.6 * s, cy - 6 * s);
      g.lineTo(cx - 8.6 * s, cy - 6 * s);
      g.closePath();
      g.fill();
      g.strokeStyle = '#14161f';
      g.lineWidth = 0.8 * s;
      g.beginPath();
      g.moveTo(cx - 6.4 * s, y);
      g.quadraticCurveTo(cx, y - 0.8 * s, cx + 6.4 * s, y);
      g.stroke();
      g.strokeStyle = 'rgba(30,40,60,0.3)';
      g.lineWidth = 0.6 * s;
      g.beginPath();
      g.moveTo(cx, y);
      g.lineTo(cx, cy - 6 * s);
      g.stroke();
    },
    false,
  );
};

/**
 * Harribel with Tiburón released: white bone plates over her shoulders, chest
 * and hips, a guard of bone across her face, and Tiburón become a great
 * shark-tooth blade on her right arm, water glowing around it.
 */
const harribelReleased: Draw = (g, w, h) => {
  const s = 2.05;
  const cx = w / 2;
  const cy = h / 2 + 8;
  const hy = cy - 13 * s;
  aura(g, cx, cy, 62, 'rgba(90,200,255,0.26)');
  harribelBraids(g, cx, hy, s, 19);
  // Dark-skinned legs and arms under the bone
  g.fillStyle = HARRIBEL_SKIN;
  for (const dir of [-1, 1]) {
    g.beginPath();
    g.ellipse(cx + dir * 4 * s, cy + 15 * s, 2.6 * s, 6 * s, 0, 0, TAU);
    g.fill();
    g.beginPath();
    g.ellipse(cx + dir * 10.2 * s, cy + 2 * s, 2.4 * s, 7.4 * s, -dir * 0.2, 0, TAU);
    g.fill();
  }
  // Bone boots
  for (const dir of [-1, 1]) {
    g.fillStyle = SHARK_BONE;
    poly(g, [
      [cx + dir * 1.6 * s, cy + 17 * s],
      [cx + dir * 6.4 * s, cy + 17 * s],
      [cx + dir * 6.8 * s, cy + 21.4 * s],
      [cx + dir * 1.2 * s, cy + 21.4 * s],
    ]);
    g.fill();
  }
  // The hip plates: a skirt of bone with a jagged hem
  g.fillStyle = SHARK_BONE;
  g.beginPath();
  g.moveTo(cx - 8 * s, cy + 2 * s);
  g.lineTo(cx + 8 * s, cy + 2 * s);
  for (let k = 0; k <= 6; k++) {
    const x = cx + 9.4 * s - (k * 18.8 * s) / 6;
    g.lineTo(x, cy + (k % 2 ? 9.5 : 12.5) * s);
  }
  g.closePath();
  g.fill();
  g.strokeStyle = SHARK_BONE_SHADE;
  g.lineWidth = 0.7 * s;
  g.stroke();
  // The breastplate, and the shoulder plates with their fins
  const chest = g.createLinearGradient(0, cy - 7 * s, 0, cy + 3 * s);
  chest.addColorStop(0, '#ffffff');
  chest.addColorStop(1, SHARK_BONE_SHADE);
  g.fillStyle = chest;
  roundRect(g, cx - 7.6 * s, cy - 7 * s, 15.2 * s, 9.6 * s, 2.4 * s);
  g.fill();
  g.strokeStyle = '#9a9282';
  g.lineWidth = 0.6 * s;
  g.beginPath();
  g.moveTo(cx - 4 * s, cy - 2 * s);
  g.lineTo(cx - 1 * s, cy + 1 * s);
  g.moveTo(cx + 4 * s, cy - 2 * s);
  g.lineTo(cx + 1 * s, cy + 1 * s);
  g.stroke();
  for (const dir of [-1, 1]) {
    g.fillStyle = SHARK_BONE;
    g.beginPath();
    g.ellipse(cx + dir * 9.6 * s, cy - 5.4 * s, 4.6 * s, 3.2 * s, dir * 0.3, 0, TAU);
    g.fill();
    g.strokeStyle = SHARK_BONE_SHADE;
    g.lineWidth = 0.6 * s;
    g.stroke();
    for (let k = 0; k < 3; k++) {
      const bx = cx + dir * (7.6 + k * 1.9) * s;
      poly(g, [
        [bx - 0.8 * s, cy - 7.6 * s + k * 0.6 * s],
        [bx + dir * 1.6 * s, cy - (12 - k * 1.2) * s],
        [bx + 0.9 * s, cy - 7.2 * s + k * 0.6 * s],
      ]);
      g.fill();
    }
  }
  // Her left hand; the right becomes the blade's grip
  g.fillStyle = HARRIBEL_SKIN;
  g.beginPath();
  g.arc(cx - 11.6 * s, cy + 9.6 * s, 1.6 * s, 0, TAU);
  g.fill();
  // Tiburón released: a great shark-tooth blade rising from her right arm
  g.save();
  g.shadowColor = 'rgba(90,200,255,0.9)';
  g.shadowBlur = 10;
  const blade = g.createLinearGradient(cx + 10 * s, cy + 10 * s, cx + 14 * s, hy - 16 * s);
  blade.addColorStop(0, '#d8e2f0');
  blade.addColorStop(1, '#ffffff');
  g.fillStyle = blade;
  g.beginPath();
  g.moveTo(cx + 7.4 * s, cy + 10.8 * s);
  g.quadraticCurveTo(cx + 8 * s, hy + 1 * s, cx + 15.4 * s, hy - 14 * s);
  g.quadraticCurveTo(cx + 22.6 * s, hy + 5 * s, cx + 18.6 * s, cy + 10.8 * s);
  g.quadraticCurveTo(cx + 13 * s, cy + 12.6 * s, cx + 7.4 * s, cy + 10.8 * s);
  g.closePath();
  g.fill();
  g.restore();
  g.strokeStyle = '#7a8aa4';
  g.lineWidth = 0.6 * s;
  g.stroke();
  g.fillStyle = '#1a2230';
  g.beginPath();
  g.moveTo(cx + 11.2 * s, cy + 6.4 * s);
  g.quadraticCurveTo(cx + 11.2 * s, hy + 3 * s, cx + 15.2 * s, hy - 6 * s);
  g.quadraticCurveTo(cx + 18.4 * s, hy + 4 * s, cx + 15.6 * s, cy + 6.4 * s);
  g.closePath();
  g.fill();
  g.fillStyle = HARRIBEL_SKIN;
  g.beginPath();
  g.arc(cx + 12 * s, cy + 10 * s, 1.8 * s, 0, TAU);
  g.fill();
  harribelHead(
    g,
    cx,
    hy,
    s,
    (y) => {
      // A guard of bone across the lower half of her face.
      g.fillStyle = SHARK_BONE;
      g.beginPath();
      g.moveTo(cx - 5.8 * s, y);
      g.quadraticCurveTo(cx, y - 0.6 * s, cx + 5.8 * s, y);
      g.quadraticCurveTo(cx + 5 * s, y + 4.6 * s, cx, y + 5 * s);
      g.quadraticCurveTo(cx - 5 * s, y + 4.6 * s, cx - 5.8 * s, y);
      g.closePath();
      g.fill();
      g.strokeStyle = '#9a9282';
      g.lineWidth = 0.5 * s;
      g.beginPath();
      for (let k = -2; k <= 2; k++) {
        g.moveTo(cx + k * 1.8 * s, y + 1 * s);
        g.lineTo(cx + k * 1.6 * s, y + 3.6 * s);
      }
      g.stroke();
    },
    true,
  );
};

// ------------------------------------------------------------ Silbern

/** A sword held point-down at his side: a straight blade, a guard and a hilt. Returns nothing. */
function heldSword(g: Ctx, hx: number, hy: number, s: number, len: number, ang: number, blade = '#d8dee8', notched = false): void {
  g.save();
  g.translate(hx, hy);
  g.rotate(ang);
  // Hilt above the hand, blade below it
  g.fillStyle = '#2a2f3a';
  g.fillRect(-0.9 * s, -5 * s, 1.8 * s, 5 * s);
  g.fillStyle = '#c9a040';
  g.fillRect(-2.2 * s, -0.6 * s, 4.4 * s, 1.2 * s);
  g.fillStyle = blade;
  g.beginPath();
  g.moveTo(-1 * s, 0.6 * s);
  if (notched) {
    // A chipped edge, nicked by a thousand fights
    for (let k = 1; k <= 5; k++) {
      g.lineTo(-1 * s + (k % 2 ? 0.7 : 0) * s, 0.6 * s + (len * k) / 6);
    }
  }
  g.lineTo(-1 * s, len * s * 0.94);
  g.lineTo(0, len * s);
  g.lineTo(1 * s, len * s * 0.94);
  g.lineTo(1 * s, 0.6 * s);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(40,46,60,0.6)';
  g.lineWidth = 0.6;
  g.stroke();
  g.restore();
}

/**
 * Kenpachi Zaraki (a chibi homage): wild spiked black hair, the long scar
 * down over his left eye, a wolfish grin, his haori torn ragged at the hem,
 * and a long nicked blade.
 */
const kenpachi: Draw = (g, w, h) => {
  const s = 2.05;
  const cx = w / 2;
  const cy = h / 2 + 7;
  const hy = cy - 13 * s;
  aura(g, cx, cy, 58, 'rgba(255,224,138,0.2)');
  captainBody(g, cx, cy, s, { haori: 'sleeved', broad: 1.18, obi: '#1a1c26' });
  // The haori's hem, torn into rags
  g.fillStyle = '#07080c';
  for (let k = 0; k < 7; k++) {
    const x = cx - 14 * s + k * 4.6 * s;
    poly(g, [
      [x, cy + 19 * s],
      [x + 2.3 * s, cy + (14.5 + (k % 2) * 1.5) * s],
      [x + 4.6 * s, cy + 19 * s],
    ]);
    g.fill();
  }
  heldSword(g, cx + 12.2 * s, cy + 9.6 * s, s, 15, -0.18, '#cfd6e2', true);
  faceAt(g, cx, hy + 0.6 * s, s, 5.8, 6.6);
  // Spiked hair, a crown of points
  g.fillStyle = '#0d0e14';
  g.beginPath();
  g.ellipse(cx, hy - 2.4 * s, 6.8 * s, 5.2 * s, 0, Math.PI * 0.95, Math.PI * 2.05);
  g.fill();
  for (let k = 0; k < 11; k++) {
    const a = Math.PI * (1.02 + (k / 10) * 0.96);
    const r0 = 5.6 * s;
    const r1 = (11 + (k % 2) * 3.2) * s;
    const x0 = cx + Math.cos(a - 0.12) * r0;
    const y0 = hy - 1.5 * s + Math.sin(a - 0.12) * r0;
    const x1 = cx + Math.cos(a) * r1;
    const y1 = hy - 1.5 * s + Math.sin(a) * r1;
    const x2 = cx + Math.cos(a + 0.12) * r0;
    const y2 = hy - 1.5 * s + Math.sin(a + 0.12) * r0;
    poly(g, [
      [x0, y0],
      [x1, y1],
      [x2, y2],
    ]);
    g.fill();
  }
  // Fierce eyes, and the scar running down over the left one
  browsAt(g, cx, hy + 0.2 * s, s, '#0d0e14', 1.8);
  eyesAt(g, cx, hy + 1.8 * s, s, '#fff2c0', '#ffd25a', 2.6);
  g.strokeStyle = '#9a4a3a';
  g.lineWidth = 0.7 * s;
  g.beginPath();
  g.moveTo(cx + 3.2 * s, hy - 3.6 * s);
  g.lineTo(cx + 2.4 * s, hy + 5.4 * s);
  g.stroke();
  // A wide grin, teeth showing
  g.fillStyle = '#1a0c0c';
  g.beginPath();
  g.ellipse(cx, hy + 4.6 * s, 2.8 * s, 1.1 * s, 0, 0, Math.PI);
  g.fill();
  g.fillStyle = '#f4f2ec';
  g.fillRect(cx - 2.4 * s, hy + 4.5 * s, 4.8 * s, 0.5 * s);
};

/**
 * Mayuri Kurotsuchi (a chibi homage): a face painted white with black about
 * the eyes, black lips and gold eyes, the gold headpiece with its two points,
 * a purple scarf, and Ashisogi Jizō's three golden prongs.
 */
const mayuri: Draw = (g, w, h) => {
  const s = 2;
  const cx = w / 2;
  const cy = h / 2 + 7;
  const hy = cy - 13 * s;
  aura(g, cx, cy, 56, 'rgba(157,255,138,0.18)');
  captainBody(g, cx, cy, s, { haori: 'sleeved', obi: '#6a4a9a' });
  // The purple scarf at his throat
  g.fillStyle = '#7a4aa8';
  g.beginPath();
  g.ellipse(cx, cy - 5.2 * s, 6.4 * s, 2.4 * s, 0, 0, TAU);
  g.fill();
  // Ashisogi Jizō: three golden prongs
  g.save();
  g.translate(cx + 12.2 * s, cy + 9.4 * s);
  g.rotate(-0.2);
  g.fillStyle = '#2a2f3a';
  g.fillRect(-0.8 * s, -4 * s, 1.6 * s, 4 * s);
  g.fillStyle = '#e8c840';
  g.shadowColor = 'rgba(232,200,64,0.7)';
  g.shadowBlur = 4;
  for (const dx of [-2.4, 0, 2.4]) {
    poly(g, [
      [dx * s - 0.7 * s, 0],
      [dx * s, (dx === 0 ? 13 : 10) * s],
      [dx * s + 0.7 * s, 0],
    ]);
    g.fill();
  }
  g.fillRect(-3.2 * s, -0.4 * s, 6.4 * s, 1.2 * s);
  g.restore();
  // The gold headpiece: a cap with a point rising on either side
  g.fillStyle = '#d8b040';
  for (const dir of [-1, 1]) {
    poly(g, [
      [cx + dir * 4.2 * s, hy - 3 * s],
      [cx + dir * 9.6 * s, hy - 11.4 * s],
      [cx + dir * 7.4 * s, hy - 1 * s],
    ]);
    g.fill();
  }
  g.beginPath();
  g.ellipse(cx, hy - 2.6 * s, 6.6 * s, 5 * s, 0, Math.PI, TAU);
  g.fill();
  g.strokeStyle = 'rgba(120,90,20,0.8)';
  g.lineWidth = 0.6 * s;
  g.stroke();
  // A white-painted face, black about the eyes, black lips
  g.fillStyle = '#f2f2ee';
  g.beginPath();
  g.ellipse(cx, hy + 0.8 * s, 5.4 * s, 6.4 * s, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#16141c';
  g.beginPath();
  g.ellipse(cx, hy + 1.6 * s, 4.8 * s, 1.9 * s, 0, 0, TAU);
  g.fill();
  eyesAt(g, cx, hy + 1.6 * s, s, '#ffe24a', '#c9a020', 2.3);
  g.fillStyle = '#16141c';
  g.beginPath();
  g.ellipse(cx, hy + 4.6 * s, 2.2 * s, 0.8 * s, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#f2f2ee';
  g.fillRect(cx - 1.8 * s, hy + 4.4 * s, 3.6 * s, 0.35 * s);
};

/**
 * Shinji Hirako (a chibi homage): a straight blond bob cut level above his
 * eyes, half-lidded eyes over a wide toothy grin, and Sakanade with the ring
 * at the end of its hilt.
 */
const shinji: Draw = (g, w, h) => {
  const s = 2;
  const cx = w / 2;
  const cy = h / 2 + 7;
  const hy = cy - 13 * s;
  aura(g, cx, cy, 56, 'rgba(255,184,224,0.18)');
  captainBody(g, cx, cy, s, { haori: 'sleeved' });
  // Sakanade, the ring on its pommel
  g.save();
  g.translate(cx + 12.2 * s, cy + 9.6 * s);
  g.rotate(-0.25);
  g.strokeStyle = '#d8b040';
  g.lineWidth = 0.9 * s;
  g.beginPath();
  g.arc(0, -6.6 * s, 1.8 * s, 0, TAU);
  g.stroke();
  g.restore();
  heldSword(g, cx + 12.2 * s, cy + 9.6 * s, s, 14, -0.25);
  // The bob: straight blond hair falling to the jaw, the fringe cut level
  g.fillStyle = '#f2d36b';
  g.beginPath();
  g.moveTo(cx - 7.2 * s, hy + 4.8 * s);
  g.lineTo(cx - 7.4 * s, hy - 2 * s);
  g.quadraticCurveTo(cx, hy - 11.2 * s, cx + 7.4 * s, hy - 2 * s);
  g.lineTo(cx + 7.2 * s, hy + 4.8 * s);
  g.closePath();
  g.fill();
  faceAt(g, cx, hy + 1 * s, s, 5.2, 6.2);
  g.fillStyle = '#f2d36b';
  g.fillRect(cx - 5.6 * s, hy - 4.2 * s, 11.2 * s, 3.4 * s);
  g.strokeStyle = 'rgba(160,120,40,0.6)';
  g.lineWidth = 0.4 * s;
  g.beginPath();
  for (let k = -4; k <= 4; k += 2) {
    g.moveTo(cx + k * s, hy - 4.2 * s);
    g.lineTo(cx + k * s, hy - 0.9 * s);
  }
  g.stroke();
  // Half-lidded eyes
  g.strokeStyle = '#3a2a10';
  g.lineWidth = 0.8 * s;
  g.beginPath();
  g.moveTo(cx - 4 * s, hy + 1.4 * s);
  g.lineTo(cx - 1.4 * s, hy + 1.4 * s);
  g.moveTo(cx + 1.4 * s, hy + 1.4 * s);
  g.lineTo(cx + 4 * s, hy + 1.4 * s);
  g.stroke();
  // The grin, all teeth
  g.fillStyle = '#f8f6f0';
  g.beginPath();
  g.moveTo(cx - 3.4 * s, hy + 3.6 * s);
  g.quadraticCurveTo(cx, hy + 6.6 * s, cx + 3.4 * s, hy + 3.6 * s);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(60,30,30,0.7)';
  g.lineWidth = 0.35 * s;
  g.stroke();
  g.beginPath();
  for (let k = -2; k <= 2; k++) {
    g.moveTo(cx + k * 1.2 * s, hy + 3.8 * s);
    g.lineTo(cx + k * 1.1 * s, hy + 5.2 * s);
  }
  g.stroke();
};

/**
 * Kensei Muguruma (a chibi homage): short spiked silver hair, a scowl, bare
 * arms under a sleeveless haori, and Tachikaze, a combat knife, in his fist.
 */
const kensei: Draw = (g, w, h) => {
  const s = 2;
  const cx = w / 2;
  const cy = h / 2 + 7;
  const hy = cy - 13 * s;
  aura(g, cx, cy, 56, 'rgba(207,230,255,0.18)');
  captainBody(g, cx, cy, s, { haori: 'sleeveless', broad: 1.1 });
  // Tachikaze: a short combat knife
  heldSword(g, cx + 12.4 * s, cy + 9.6 * s, s, 7, -0.6, '#e8eef8');
  faceAt(g, cx, hy + 0.8 * s, s, 5.6, 6.4);
  // Short spiked silver hair
  g.fillStyle = '#c9ced8';
  g.beginPath();
  g.ellipse(cx, hy - 2.6 * s, 6.4 * s, 4.6 * s, 0, Math.PI * 0.95, Math.PI * 2.05);
  g.fill();
  for (let k = 0; k < 9; k++) {
    const a = Math.PI * (1.05 + (k / 8) * 0.9);
    poly(g, [
      [cx + Math.cos(a - 0.16) * 5.4 * s, hy - 2 * s + Math.sin(a - 0.16) * 5.4 * s],
      [cx + Math.cos(a) * 9 * s, hy - 2 * s + Math.sin(a) * 9 * s],
      [cx + Math.cos(a + 0.16) * 5.4 * s, hy - 2 * s + Math.sin(a + 0.16) * 5.4 * s],
    ]);
    g.fill();
  }
  // A scowl
  browsAt(g, cx, hy + 0.4 * s, s, '#8a8f9c', 2);
  eyesAt(g, cx, hy + 1.9 * s, s, '#e8eaf0', '#8a90a8', 2.5);
  g.strokeStyle = '#5a3a30';
  g.lineWidth = 0.6 * s;
  g.beginPath();
  g.moveTo(cx - 1.8 * s, hy + 4.8 * s);
  g.quadraticCurveTo(cx, hy + 4.2 * s, cx + 1.8 * s, hy + 4.8 * s);
  g.stroke();
};

/**
 * Captain-Commander Shunsui Kyōraku (a chibi homage): the straw hat, wavy
 * brown hair tied back, stubble on his chin, a patch over his right eye, the
 * pink flowered kimono worn over his haori, and Katen Kyōkotsu's two blades.
 */
const kyoraku: Draw = (g, w, h) => {
  const s = 2.05;
  const cx = w / 2;
  const cy = h / 2 + 8;
  const hy = cy - 13 * s;
  aura(g, cx, cy, 60, 'rgba(255,154,200,0.2)');
  // The ponytail behind
  g.fillStyle = '#5a3a24';
  g.beginPath();
  g.ellipse(cx + 5 * s, hy + 6 * s, 2.4 * s, 6 * s, 0.4, 0, TAU);
  g.fill();
  captainBody(g, cx, cy, s, { haori: 'sleeved', obi: '#c86a9a' });
  // The pink kimono, worn open over the haori: it covers his shoulders and sides
  const pink = (dir: number): void => {
    g.beginPath();
    g.moveTo(cx + dir * 3.2 * s, cy - 7.2 * s);
    g.quadraticCurveTo(cx + dir * 17.5 * s, cy - 5 * s, cx + dir * 16.2 * s, cy + 19.6 * s);
    g.lineTo(cx + dir * 5.6 * s, cy + 19.6 * s);
    g.quadraticCurveTo(cx + dir * 6.4 * s, cy + 4 * s, cx + dir * 3.2 * s, cy - 7.2 * s);
    g.closePath();
  };
  for (const dir of [-1, 1]) {
    g.fillStyle = '#ff9ac8';
    pink(dir);
    g.fill();
    g.strokeStyle = 'rgba(120,40,80,0.45)';
    g.lineWidth = 0.6 * s;
    g.stroke();
  }
  g.fillStyle = 'rgba(255,255,255,0.8)';
  const rnd = seeded(808);
  for (let k = 0; k < 18; k++) {
    const dir = k % 2 ? 1 : -1;
    const x = cx + dir * (7 + rnd() * 8) * s;
    const y = cy + (rnd() * 24 - 4) * s;
    for (let q = 0; q < 5; q++) {
      const a = (q / 5) * TAU;
      g.beginPath();
      g.arc(x + Math.cos(a) * 0.8 * s, y + Math.sin(a) * 0.8 * s, 0.5 * s, 0, TAU);
      g.fill();
    }
  }
  // Katen Kyōkotsu: two blades, low
  heldSword(g, cx + 12.2 * s, cy + 9.6 * s, s, 13, -0.35);
  heldSword(g, cx - 12.2 * s, cy + 9.6 * s, s, 8, 0.45);
  faceAt(g, cx, hy + 0.8 * s, s, 5.6, 6.4);
  // Wavy brown hair, framing the face
  g.fillStyle = '#5a3a24';
  g.beginPath();
  g.ellipse(cx, hy - 1.8 * s, 6.8 * s, 5 * s, 0, Math.PI * 0.95, Math.PI * 2.05);
  g.fill();
  for (const dir of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx + dir * 5 * s, hy - 2 * s);
    g.quadraticCurveTo(cx + dir * 7.6 * s, hy + 2 * s, cx + dir * 6.2 * s, hy + 6 * s);
    g.quadraticCurveTo(cx + dir * 5.6 * s, hy + 2 * s, cx + dir * 4.2 * s, hy - 0.4 * s);
    g.closePath();
    g.fill();
  }
  // Stubble on the chin, a lazy eye, and the patch over his right
  g.fillStyle = 'rgba(70,46,30,0.75)';
  g.beginPath();
  g.ellipse(cx, hy + 5.8 * s, 2.2 * s, 1.2 * s, 0, 0, TAU);
  g.fill();
  g.strokeStyle = '#2a1a10';
  g.lineWidth = 0.8 * s;
  g.beginPath();
  g.moveTo(cx + 1.4 * s, hy + 1.6 * s);
  g.lineTo(cx + 4 * s, hy + 1.4 * s);
  g.stroke();
  g.fillStyle = '#14161f';
  g.beginPath();
  g.ellipse(cx - 2.7 * s, hy + 1.5 * s, 1.9 * s, 1.5 * s, 0, 0, TAU);
  g.fill();
  g.strokeStyle = '#14161f';
  g.lineWidth = 0.5 * s;
  g.beginPath();
  g.moveTo(cx - 6 * s, hy - 0.6 * s);
  g.lineTo(cx + 5.6 * s, hy - 0.2 * s);
  g.stroke();
  // The straw hat, tipped back
  g.fillStyle = '#c9a868';
  g.beginPath();
  g.moveTo(cx - 13 * s, hy - 3.4 * s);
  g.quadraticCurveTo(cx, hy - 16 * s, cx + 13 * s, hy - 4.6 * s);
  g.quadraticCurveTo(cx, hy - 6.4 * s, cx - 13 * s, hy - 3.4 * s);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(110,80,30,0.7)';
  g.lineWidth = 0.5 * s;
  g.beginPath();
  for (let k = -3; k <= 3; k++) {
    g.moveTo(cx + k * 1.4 * s, hy - 12.6 * s + Math.abs(k) * 0.4 * s);
    g.lineTo(cx + k * 3.6 * s, hy - 5 * s - Math.abs(k) * 0.2 * s);
  }
  g.stroke();
};

/**
 * Konjiki Ashisogi Jizō (a chibi homage to Mayuri's bankai): a great golden
 * caterpillar on blade legs, a baby's face, and a halo floating above it.
 */
const jizo: Draw = (g, w, h) => {
  const cx = w / 2;
  const cy = h / 2 + 10;
  aura(g, cx, cy, 64, 'rgba(232,200,64,0.18)');
  // Body segments, curling back from the head
  for (let k = 5; k >= 0; k--) {
    const x = cx + 20 - k * 8;
    const y = cy + 10 - Math.sin(k * 0.7) * 6;
    const r = 13 - k * 0.8;
    // Blade legs
    g.strokeStyle = '#4a2a6a';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x - 3, y + r * 0.6);
    g.lineTo(x - 6, y + r + 7);
    g.moveTo(x + 3, y + r * 0.6);
    g.lineTo(x + 6, y + r + 7);
    g.stroke();
    const body = g.createRadialGradient(x - 3, y - 4, 2, x, y, r);
    body.addColorStop(0, '#fff0a8');
    body.addColorStop(0.6, '#e8c840');
    body.addColorStop(1, '#9a7020');
    g.fillStyle = body;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(106,58,154,0.55)';
    g.beginPath();
    g.ellipse(x, y + r * 0.5, r * 0.8, r * 0.35, 0, 0, TAU);
    g.fill();
  }
  // The head: a baby's face, pale, eyes shut
  const hx = cx - 24;
  const hy = cy - 4;
  g.fillStyle = '#f4e2d0';
  g.beginPath();
  g.arc(hx, hy, 15, 0, TAU);
  g.fill();
  g.strokeStyle = '#5a3a2a';
  g.lineWidth = 1.4;
  g.beginPath();
  g.arc(hx - 5, hy - 1, 2.6, 0.1 * Math.PI, 0.9 * Math.PI);
  g.moveTo(hx + 7.6, hy - 1);
  g.arc(hx + 5, hy - 1, 2.6, 0.1 * Math.PI, 0.9 * Math.PI);
  g.stroke();
  g.fillStyle = '#c86a6a';
  g.beginPath();
  g.ellipse(hx, hy + 7, 2.6, 1.6, 0, 0, TAU);
  g.fill();
  // The halo
  g.save();
  g.strokeStyle = '#ffe880';
  g.shadowColor = 'rgba(255,232,128,0.9)';
  g.shadowBlur = 8;
  g.lineWidth = 2.4;
  g.beginPath();
  g.ellipse(hx, hy - 22, 11, 3.6, 0, 0, TAU);
  g.stroke();
  g.restore();
};

/** An Eleventh Division brawler (original): sleeves torn off, a headband, blade up and ready. */
const brawler: Draw = (g, w, h) => {
  aura(g, w / 2, h / 2 + 4, 26, 'rgba(255,224,138,0.14)');
  reaper(g, w / 2, h / 2 + 2, 1.06, { broad: 1.1, sash: '#c9a040', sword: 'raised' });
  // Bare arms, and a red headband
  g.fillStyle = SKIN;
  for (const dir of [-1, 1]) {
    g.beginPath();
    g.ellipse(w / 2 + dir * 8.8, h / 2 + 3, 2.2, 4.6, -dir * 0.2, 0, TAU);
    g.fill();
  }
  g.fillStyle = '#c83a3a';
  g.fillRect(w / 2 - 6, h / 2 - 19, 12, 2);
};

/** A Twelfth Division specimen (original): a bloated thing of stitched green flesh, one great eye, a vial on its back. */
const specimen: Draw = (g, w, h) => {
  const cx = w / 2;
  const cy = h / 2 + 4;
  aura(g, cx, cy, 30, 'rgba(157,255,138,0.16)');
  // The vial on its back, bubbling
  g.fillStyle = 'rgba(200,255,200,0.55)';
  roundRect(g, cx + 4, cy - 22, 7, 14, 3);
  g.fill();
  g.fillStyle = '#9dff8a';
  roundRect(g, cx + 5, cy - 15, 5, 6, 2);
  g.fill();
  // The body
  const body = g.createRadialGradient(cx - 4, cy - 6, 3, cx, cy, 17);
  body.addColorStop(0, '#c8ff9a');
  body.addColorStop(0.7, '#6ac85a');
  body.addColorStop(1, '#2e6a2a');
  g.fillStyle = body;
  g.beginPath();
  g.ellipse(cx, cy, 16, 14, 0, 0, TAU);
  g.fill();
  // Stitches across it
  g.strokeStyle = '#1e3a1a';
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(cx - 12, cy + 4);
  g.quadraticCurveTo(cx, cy + 9, cx + 12, cy + 3);
  g.stroke();
  for (let k = -4; k <= 4; k++) {
    const x = cx + k * 2.6;
    const y = cy + 6 - Math.abs(k) * 0.5;
    g.beginPath();
    g.moveTo(x, y - 2);
    g.lineTo(x, y + 2);
    g.stroke();
  }
  // One great eye
  g.fillStyle = '#fff6c8';
  g.beginPath();
  g.ellipse(cx - 1, cy - 4, 5.4, 4.4, 0, 0, TAU);
  g.fill();
  glowDot(g, cx - 1, cy - 4, 2.2, 2.2, '#2a1a08', 'rgba(255,220,80,0.8)', 4);
  // Stubby legs
  g.fillStyle = '#3e7a34';
  for (const dx of [-9, -3, 3, 9]) {
    g.beginPath();
    g.ellipse(cx + dx, cy + 14, 2.4, 3, 0, 0, TAU);
    g.fill();
  }
};

// ------------------------------------------------------------ Wahrwelt

/** A lieutenant's badge on the left arm: a white band with a small mark. */
function lieutenantBadge(g: Ctx, cx: number, cy: number, s: number): void {
  g.fillStyle = '#f4f2ec';
  g.save();
  g.translate(cx - 11 * s, cy + 1 * s);
  g.rotate(0.25);
  g.fillRect(-2.6 * s, -1.6 * s, 5.2 * s, 3.2 * s);
  g.fillStyle = '#14161f';
  g.fillRect(-0.8 * s, -0.8 * s, 1.6 * s, 1.6 * s);
  g.restore();
}

/** Renji's crimson hair, gathered high at the back of his head and fanning into spikes. */
function renjiTail(g: Ctx, cx: number, hy: number, s: number): void {
  g.fillStyle = '#c4202a';
  g.beginPath();
  g.moveTo(cx - 2 * s, hy - 6 * s);
  g.quadraticCurveTo(cx + 3 * s, hy - 16 * s, cx + 11 * s, hy - 15.5 * s);
  g.lineTo(cx + 9 * s, hy - 12.6 * s);
  g.lineTo(cx + 16 * s, hy - 11.4 * s);
  g.lineTo(cx + 10.6 * s, hy - 9 * s);
  g.lineTo(cx + 16.4 * s, hy - 5.6 * s);
  g.lineTo(cx + 10 * s, hy - 5.4 * s);
  g.lineTo(cx + 13 * s, hy - 1 * s);
  g.lineTo(cx + 6.4 * s, hy - 3.6 * s);
  g.quadraticCurveTo(cx + 3 * s, hy - 5 * s, cx + 1 * s, hy - 3.4 * s);
  g.closePath();
  g.fill();
  g.strokeStyle = '#7e0e16';
  g.lineWidth = 0.5 * s;
  g.beginPath();
  g.moveTo(cx + 1.6 * s, hy - 7 * s);
  g.quadraticCurveTo(cx + 6 * s, hy - 12 * s, cx + 12.4 * s, hy - 11.6 * s);
  g.moveTo(cx + 2.4 * s, hy - 5.6 * s);
  g.quadraticCurveTo(cx + 7 * s, hy - 8 * s, cx + 12.6 * s, hy - 6.4 * s);
  g.stroke();
}

/** Renji's bare arms, the kimono's sleeves torn off at the shoulder, with black tattoo stripes down them. */
function renjiArmInk(g: Ctx, cx: number, cy: number, s: number, b: number): void {
  for (const dir of [-1, 1]) {
    const ax = cx + dir * 10.5 * s * b;
    g.fillStyle = SKIN;
    g.beginPath();
    g.ellipse(ax, cy + 2.4 * s, 2.9 * s, 6.4 * s, -dir * 0.25, 0, TAU);
    g.fill();
    g.fillStyle = '#161820';
    g.beginPath();
    g.ellipse(ax - dir * 0.9 * s, cy - 3.6 * s, 2.8 * s, 1.7 * s, -dir * 0.3, 0, TAU);
    g.fill();
  }
  g.strokeStyle = '#14161f';
  g.lineWidth = 0.55 * s;
  g.beginPath();
  for (const dir of [-1, 1]) {
    const ax = cx + dir * 10.2 * s * b;
    for (let k = 0; k < 3; k++) {
      const y = cy - 2.4 * s + k * 3.2 * s;
      g.moveTo(ax - 1.8 * s, y);
      g.lineTo(ax, y + 1.1 * s);
      g.lineTo(ax + 1.8 * s, y);
    }
  }
  g.stroke();
}

/** Renji's head: the face, crimson hair swept back, a white bandana, the tattoos above his brows, a fighter's grin. */
function renjiHead(g: Ctx, cx: number, hy: number, s: number): void {
  faceAt(g, cx, hy + 0.8 * s, s, 5.6, 6.4);
  g.fillStyle = '#c4202a';
  g.beginPath();
  g.ellipse(cx, hy - 2.6 * s, 6.9 * s, 5 * s, 0, Math.PI * 0.95, Math.PI * 2.05);
  g.fill();
  for (let k = 0; k < 4; k++) {
    const a = Math.PI * (1.12 + k * 0.17);
    poly(g, [
      [cx + Math.cos(a - 0.16) * 5.4 * s, hy - 2.6 * s + Math.sin(a - 0.16) * 5.4 * s],
      [cx + Math.cos(a) * 8.4 * s, hy - 2.6 * s + Math.sin(a) * 8.4 * s],
      [cx + Math.cos(a + 0.16) * 5.4 * s, hy - 2.6 * s + Math.sin(a + 0.16) * 5.4 * s],
    ]);
    g.fill();
  }
  // The white bandana across his brow, its ends flying out behind him
  g.fillStyle = '#f4f2ec';
  g.beginPath();
  g.moveTo(cx - 6.4 * s, hy - 2.8 * s);
  g.quadraticCurveTo(cx, hy - 4.8 * s, cx + 6.4 * s, hy - 2.8 * s);
  g.lineTo(cx + 6.2 * s, hy - 1.2 * s);
  g.quadraticCurveTo(cx, hy - 3 * s, cx - 6.2 * s, hy - 1.2 * s);
  g.closePath();
  g.fill();
  poly(g, [
    [cx - 6 * s, hy - 2.4 * s],
    [cx - 11 * s, hy - 4.4 * s],
    [cx - 10.4 * s, hy - 2.6 * s],
    [cx - 12.6 * s, hy - 0.6 * s],
    [cx - 6 * s, hy - 1.2 * s],
  ]);
  g.fill();
  g.strokeStyle = 'rgba(40,40,60,0.35)';
  g.lineWidth = 0.4 * s;
  g.stroke();
  // The tattoos where his brows should be
  g.strokeStyle = '#14161f';
  g.lineWidth = 0.65 * s;
  g.beginPath();
  for (const dir of [-1, 1]) {
    g.moveTo(cx + dir * 1.2 * s, hy - 0.4 * s);
    g.lineTo(cx + dir * 2.4 * s, hy - 1 * s);
    g.lineTo(cx + dir * 3.6 * s, hy - 0.2 * s);
    g.lineTo(cx + dir * 5 * s, hy - 1 * s);
  }
  g.stroke();
  eyesAt(g, cx, hy + 1.9 * s, s, '#f6e0c0', '#c06030', 2.5);
  // A wide, toothy grin
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(cx - 2.4 * s, hy + 4.2 * s);
  g.quadraticCurveTo(cx, hy + 6.2 * s, cx + 2.4 * s, hy + 4.2 * s);
  g.closePath();
  g.fill();
  g.strokeStyle = '#5a2a20';
  g.lineWidth = 0.45 * s;
  g.stroke();
}

/** Zabimaru released: a long blade of jagged segments, each with a hooked tooth, held high. */
function zabimaru(g: Ctx, hx: number, hy: number, s: number, ang: number, segs: number): void {
  g.save();
  g.translate(hx, hy);
  g.rotate(ang);
  g.fillStyle = '#2a2f3a';
  g.fillRect(-1 * s, -5 * s, 2 * s, 5 * s);
  g.fillStyle = '#c9a040';
  g.fillRect(-2.4 * s, -0.7 * s, 4.8 * s, 1.4 * s);
  for (let k = 0; k < segs; k++) {
    const y0 = (1 + k * 4.6) * s;
    g.fillStyle = k % 2 ? '#dfe5ee' : '#cfd6e2';
    poly(g, [
      [-1.6 * s, y0],
      [1.6 * s, y0],
      [3.6 * s, y0 + 1.2 * s],
      [1.6 * s, y0 + 1.6 * s],
      [1.4 * s, y0 + 3.8 * s],
      [-1.6 * s, y0 + 3.8 * s],
    ]);
    g.fill();
    g.strokeStyle = 'rgba(40,46,60,0.7)';
    g.lineWidth = 0.45 * s;
    g.stroke();
  }
  g.fillStyle = '#e6ebf3';
  const tip = (1 + segs * 4.6) * s;
  poly(g, [
    [-1.6 * s, tip - 0.4 * s],
    [1.6 * s, tip - 0.4 * s],
    [0, tip + 3.4 * s],
  ]);
  g.fill();
  g.restore();
}

/**
 * Renji Abarai (a chibi homage): crimson hair tied high in a spiked
 * ponytail, a white bandana, the tattoos on his brow and his bare arms, and
 * Zabimaru released, a long blade of jagged segments held high.
 */
const renji: Draw = (g, w, h) => {
  const s = 2;
  const cx = w / 2 - 6;
  const cy = h / 2 + 10;
  const hy = cy - 13 * s;
  aura(g, cx, cy, 58, 'rgba(255,90,60,0.22)');
  renjiTail(g, cx, hy, s);
  captainBody(g, cx, cy, s, { haori: 'none', broad: 1.12 });
  renjiArmInk(g, cx, cy, s, 1.12);
  lieutenantBadge(g, cx, cy, s);
  zabimaru(g, cx + 13 * s, cy + 9.6 * s, s, Math.PI + 0.42, 6);
  renjiHead(g, cx, hy, s);
};

/**
 * Renji in Sōō Zabimaru (a chibi homage): Hihiō Zabimaru, the baboon king,
 * a huge crimson fur mantle over his shoulders and a great arm of bone with
 * claws in place of his right hand.
 */
const renjiBankai: Draw = (g, w, h) => {
  const s = 2;
  const cx = w / 2 - 4;
  const cy = h / 2 + 12;
  const hy = cy - 13 * s;
  aura(g, cx, cy, 66, 'rgba(255,70,50,0.3)');
  renjiTail(g, cx, hy, s);
  // The fur mantle, behind and around him: ragged tufts all the way round
  const fur = g.createRadialGradient(cx, cy - 4 * s, 4 * s, cx, cy, 22 * s);
  fur.addColorStop(0, '#d8463a');
  fur.addColorStop(0.7, '#9a1e22');
  fur.addColorStop(1, '#5a0e14');
  g.fillStyle = fur;
  g.beginPath();
  const n = 22;
  for (let k = 0; k <= n; k++) {
    const a = Math.PI * 0.92 + (k / n) * Math.PI * 1.16;
    const r = (k % 2 ? 17.5 : 21) * s;
    const x = cx + Math.cos(a) * r;
    const y = cy + 2 * s + Math.sin(a) * r * 0.82;
    if (k === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.lineTo(cx + 15 * s, cy + 18 * s);
  g.lineTo(cx - 15 * s, cy + 18 * s);
  g.closePath();
  g.fill();
  captainBody(g, cx, cy, s, { haori: 'none', broad: 1.12 });
  renjiArmInk(g, cx, cy, s, 1.12);
  // The mantle's collar, thick fur across both shoulders
  g.fillStyle = '#b8282a';
  for (let k = 0; k < 9; k++) {
    const x = cx - 12 * s + k * 3 * s;
    g.beginPath();
    g.ellipse(x, cy - 5.6 * s + Math.abs(k - 4) * 0.5 * s, 2.6 * s, 3.4 * s, (k - 4) * 0.12, 0, TAU);
    g.fill();
  }
  g.fillStyle = '#e8705a';
  for (let k = 0; k < 9; k += 2) {
    const x = cx - 12 * s + k * 3 * s;
    g.beginPath();
    g.ellipse(x, cy - 6.6 * s + Math.abs(k - 4) * 0.5 * s, 1 * s, 1.4 * s, 0, 0, TAU);
    g.fill();
  }
  // The bone arm: a huge skeletal forearm and fist with claws, raised at his side
  g.save();
  g.translate(cx + 14 * s, cy + 2 * s);
  g.rotate(-0.35);
  const bone = g.createLinearGradient(-5 * s, 0, 5 * s, 0);
  bone.addColorStop(0, '#f6f0e2');
  bone.addColorStop(1, '#c9bca2');
  g.fillStyle = bone;
  g.beginPath();
  g.ellipse(0, -2 * s, 4.2 * s, 7.4 * s, 0, 0, TAU);
  g.fill();
  g.strokeStyle = '#7a6a52';
  g.lineWidth = 0.5 * s;
  g.stroke();
  g.beginPath();
  g.ellipse(0, 7.6 * s, 6 * s, 5 * s, 0, 0, TAU);
  g.fillStyle = bone;
  g.fill();
  g.stroke();
  // Ridges along the bone and claws at the knuckles
  g.beginPath();
  for (let k = 0; k < 3; k++) {
    g.moveTo(-3 * s, -6 * s + k * 3.2 * s);
    g.lineTo(3 * s, -5.2 * s + k * 3.2 * s);
  }
  g.stroke();
  g.fillStyle = '#fbf8f0';
  for (let k = -2; k <= 2; k++) {
    poly(g, [
      [k * 2.2 * s - 1 * s, 11.6 * s],
      [k * 2.2 * s + 1 * s, 11.6 * s],
      [k * 2.6 * s, 16 * s],
    ]);
    g.fill();
    g.stroke();
  }
  g.restore();
  renjiHead(g, cx, hy, s);
};

/** A small six-armed snowflake. */
function snowflake(g: Ctx, x: number, y: number, r: number, color: string): void {
  g.strokeStyle = color;
  g.lineWidth = Math.max(0.8, r * 0.28);
  g.lineCap = 'round';
  g.beginPath();
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI;
    g.moveTo(x - Math.cos(a) * r, y - Math.sin(a) * r);
    g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  g.stroke();
}

/** Sode no Shirayuki: white from hilt to tip, a ring for a guard, its long white ribbon looping out behind. */
function shirayuki(g: Ctx, hx: number, hy: number, s: number, len: number, ang: number, ribbonFront: boolean): void {
  g.save();
  g.translate(hx, hy);
  g.rotate(ang);
  // The ribbon, tied at the pommel, swinging in a long loop
  g.strokeStyle = 'rgba(250,252,255,0.95)';
  g.lineWidth = 1.3 * s;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(0, -5 * s);
  if (ribbonFront) g.bezierCurveTo(-9 * s, -12 * s, -16 * s, 2 * s, -10 * s, 12 * s);
  else g.bezierCurveTo(8 * s, -14 * s, 16 * s, -2 * s, 12 * s, 10 * s);
  g.stroke();
  g.strokeStyle = 'rgba(160,200,240,0.5)';
  g.lineWidth = 0.4 * s;
  g.stroke();
  g.fillStyle = '#f2f6fc';
  g.fillRect(-0.9 * s, -5 * s, 1.8 * s, 5 * s);
  g.strokeStyle = '#f8fbff';
  g.lineWidth = 0.6 * s;
  g.beginPath();
  g.arc(0, 0, 2 * s, 0, TAU);
  g.stroke();
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(-1 * s, 0.6 * s);
  g.lineTo(-1 * s, len * s * 0.94);
  g.lineTo(0, len * s);
  g.lineTo(1 * s, len * s * 0.94);
  g.lineTo(1 * s, 0.6 * s);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(120,160,210,0.6)';
  g.lineWidth = 0.4 * s;
  g.stroke();
  g.restore();
}

/** Rukia's short hair to the jaw with one lock falling between her eyes (black, or white in her bankai). */
function rukiaHair(g: Ctx, cx: number, hy: number, s: number, color: string): void {
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(cx, hy - 1.8 * s, 6.6 * s, 5.2 * s, 0, Math.PI * 0.95, Math.PI * 2.05);
  g.fill();
  for (const dir of [-1, 1]) {
    poly(g, [
      [cx + dir * 4.6 * s, hy - 2.6 * s],
      [cx + dir * 6.8 * s, hy - 0.4 * s],
      [cx + dir * 6.2 * s, hy + 5.2 * s],
      [cx + dir * 4.4 * s, hy + 1.6 * s],
    ]);
    g.fill();
  }
  poly(g, [
    [cx - 1 * s, hy - 3 * s],
    [cx + 0.9 * s, hy - 3 * s],
    [cx + 0.2 * s, hy + 2.8 * s],
  ]);
  g.fill();
}

/**
 * Rukia Kuchiki (a chibi homage): small, short black hair with one lock
 * between her violet eyes, a lieutenant's badge, and Sode no Shirayuki,
 * white from hilt to tip, its long ribbon looping round her, snow in the air.
 */
const rukia: Draw = (g, w, h) => {
  const s = 1.72;
  const cx = w / 2 - 2;
  const cy = h / 2 + 12;
  const hy = cy - 13 * s;
  aura(g, cx, cy, 52, 'rgba(190,230,255,0.28)');
  captainBody(g, cx, cy, s, { haori: 'none', broad: 0.9 });
  lieutenantBadge(g, cx, cy, s);
  shirayuki(g, cx + 10.6 * s, cy + 9.6 * s, s, 16, -0.55, false);
  faceAt(g, cx, hy + 0.8 * s, s, 5.4, 6.2);
  rukiaHair(g, cx, hy, s, '#0d0e14');
  eyesAt(g, cx, hy + 1.9 * s, s, '#e0d0ff', '#8a64d0', 2.7);
  for (const [dx, dy, r] of [
    [-17, -8, 2.2],
    [-13, 10, 1.6],
    [19, -16, 1.8],
    [-20, 20, 1.4],
  ] as const) {
    snowflake(g, cx + dx * s, cy + dy * s, r * s, 'rgba(240,248,255,0.9)');
  }
};

/**
 * Rukia in Hakka no Togame (a chibi homage): her bankai at absolute zero.
 * Everything about her has turned white, hair, skin and a long robe that
 * trails like frost, with an ice ornament in her hair and cold mist at her feet.
 */
const rukiaBankai: Draw = (g, w, h) => {
  const s = 1.72;
  const cx = w / 2 - 2;
  const cy = h / 2 + 10;
  const hy = cy - 13 * s;
  aura(g, cx, cy, 60, 'rgba(170,225,255,0.4)');
  // Mist rolling at her feet
  g.fillStyle = 'rgba(220,240,255,0.35)';
  for (const [dx, r] of [
    [-12, 7],
    [0, 9],
    [12, 7],
  ] as const) {
    g.beginPath();
    g.ellipse(cx + dx * s, cy + 21 * s, r * s, 2.6 * s, 0, 0, TAU);
    g.fill();
  }
  // The white robe, flaring out into a long trailing hem
  const robe = g.createLinearGradient(0, cy - 7 * s, 0, cy + 22 * s);
  robe.addColorStop(0, '#ffffff');
  robe.addColorStop(1, '#cfe6f8');
  g.fillStyle = robe;
  g.beginPath();
  g.moveTo(cx - 7 * s, cy - 6.5 * s);
  g.lineTo(cx + 7 * s, cy - 6.5 * s);
  g.quadraticCurveTo(cx + 10 * s, cy + 8 * s, cx + 15 * s, cy + 21.5 * s);
  g.lineTo(cx - 15 * s, cy + 21.5 * s);
  g.quadraticCurveTo(cx - 10 * s, cy + 8 * s, cx - 7 * s, cy - 6.5 * s);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(110,160,210,0.55)';
  g.lineWidth = 1;
  g.stroke();
  // Frost along the hem
  g.fillStyle = '#e6f6ff';
  for (let k = -6; k <= 6; k++) {
    poly(g, [
      [cx + k * 2.3 * s - 1 * s, cy + 21.4 * s],
      [cx + k * 2.3 * s + 1 * s, cy + 21.4 * s],
      [cx + k * 2.3 * s, cy + (k % 2 ? 24 : 23) * s],
    ]);
    g.fill();
  }
  // A pale sash, and long white sleeves
  g.fillStyle = '#b8dcf4';
  g.fillRect(cx - 8 * s, cy + 4 * s, 16 * s, 2 * s);
  for (const dir of [-1, 1]) {
    g.fillStyle = '#f6fbff';
    g.beginPath();
    g.ellipse(cx + dir * 9.6 * s, cy + 3.5 * s, 3.6 * s, 8.6 * s, -dir * 0.3, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(110,160,210,0.45)';
    g.lineWidth = 0.8;
    g.stroke();
    g.fillStyle = '#f2f6ff';
    g.beginPath();
    g.arc(cx + dir * 11.2 * s, cy + 10.6 * s, 1.5 * s, 0, TAU);
    g.fill();
  }
  shirayuki(g, cx + 11 * s, cy + 10.6 * s, s, 17, -0.5, false);
  // Pale face, white hair, an ornament of ice
  g.fillStyle = '#f4f8ff';
  g.beginPath();
  g.ellipse(cx, hy + 0.8 * s, 5.4 * s, 6.2 * s, 0, 0, TAU);
  g.fill();
  rukiaHair(g, cx, hy, s, '#f8fcff');
  g.strokeStyle = 'rgba(140,190,230,0.6)';
  g.lineWidth = 0.4 * s;
  g.beginPath();
  g.ellipse(cx, hy - 1.8 * s, 6.6 * s, 5.2 * s, 0, Math.PI * 0.95, Math.PI * 2.05);
  g.stroke();
  g.save();
  g.shadowColor = 'rgba(150,215,255,0.95)';
  g.shadowBlur = 6;
  snowflake(g, cx - 5.6 * s, hy - 4.4 * s, 2.6 * s, '#bfe8ff');
  g.restore();
  eyesAt(g, cx, hy + 1.9 * s, s, '#e8f6ff', '#7ac8ff', 2.7);
  for (const [dx, dy, r] of [
    [-18, -10, 2.2],
    [-15, 12, 1.8],
    [19, -18, 2],
    [17, 4, 1.4],
    [-21, 22, 1.6],
  ] as const) {
    snowflake(g, cx + dx * s, cy + dy * s, r * s, 'rgba(235,248,255,0.95)');
  }
};

/**
 * Uryū Ishida (a chibi homage): glasses, straight black hair, the
 * Wandenreich's white uniform with its cape, and a bow of blue reishi.
 */
const uryu: Draw = (g, w, h) => {
  const s = 2;
  const cx = w / 2;
  const cy = h / 2 + 7;
  const hy = cy - 13 * s;
  aura(g, cx, cy, 56, 'rgba(143,208,255,0.2)');
  // The white cape
  g.fillStyle = '#eef2f8';
  g.beginPath();
  g.moveTo(cx - 9 * s, cy - 7 * s);
  g.quadraticCurveTo(cx - 16 * s, cy + 6 * s, cx - 14 * s, cy + 19.5 * s);
  g.lineTo(cx + 14 * s, cy + 19.5 * s);
  g.quadraticCurveTo(cx + 16 * s, cy + 6 * s, cx + 9 * s, cy - 7 * s);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(40,60,100,0.35)';
  g.lineWidth = 1;
  g.stroke();
  // The white uniform, a high collar, a blue Quincy cross at the chest
  const coat = g.createLinearGradient(0, cy - 6 * s, 0, cy + 20 * s);
  coat.addColorStop(0, '#ffffff');
  coat.addColorStop(1, '#c9d2e2');
  g.fillStyle = coat;
  g.beginPath();
  g.moveTo(cx - 8 * s, cy - 6 * s);
  g.lineTo(cx + 8 * s, cy - 6 * s);
  g.lineTo(cx + 10.6 * s, cy + 20 * s);
  g.lineTo(cx - 10.6 * s, cy + 20 * s);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(40,60,100,0.4)';
  g.stroke();
  g.strokeStyle = 'rgba(40,60,100,0.3)';
  g.beginPath();
  g.moveTo(cx, cy - 4 * s);
  g.lineTo(cx, cy + 20 * s);
  g.stroke();
  g.fillStyle = '#59b8ff';
  g.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU - Math.PI / 2;
    const r = k % 2 === 0 ? 2.2 * s : 0.9 * s;
    g.lineTo(cx - 4 * s + Math.cos(a) * r, cy - 1 * s + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  for (const dir of [-1, 1]) {
    g.fillStyle = '#eef2f8';
    g.beginPath();
    g.ellipse(cx + dir * 10.4 * s, cy + 1.5 * s, 3.8 * s, 7.2 * s, -dir * 0.25, 0, TAU);
    g.fill();
    g.fillStyle = SKIN;
    g.beginPath();
    g.arc(cx + dir * 11.6 * s, cy + 9.6 * s, 1.6 * s, 0, TAU);
    g.fill();
  }
  // A bow of blue reishi in his left hand
  g.save();
  g.strokeStyle = '#8fd0ff';
  g.shadowColor = 'rgba(143,208,255,0.9)';
  g.shadowBlur = 8;
  g.lineWidth = 1.2 * s;
  g.beginPath();
  g.arc(cx - 15 * s, cy + 4 * s, 9 * s, -1.1, 1.1);
  g.stroke();
  g.lineWidth = 0.4 * s;
  g.beginPath();
  g.moveTo(cx - 15 * s + Math.cos(-1.1) * 9 * s, cy + 4 * s + Math.sin(-1.1) * 9 * s);
  g.lineTo(cx - 15 * s + Math.cos(1.1) * 9 * s, cy + 4 * s + Math.sin(1.1) * 9 * s);
  g.stroke();
  g.restore();
  faceAt(g, cx, hy + 0.8 * s, s, 5.4, 6.4);
  // Straight black hair, a fringe swept to one side
  g.fillStyle = '#0d0e14';
  g.beginPath();
  g.ellipse(cx, hy - 2 * s, 6.6 * s, 5 * s, 0, Math.PI * 0.95, Math.PI * 2.05);
  g.fill();
  poly(g, [
    [cx - 6.4 * s, hy - 2 * s],
    [cx + 5 * s, hy - 3.6 * s],
    [cx + 1.6 * s, hy + 1.4 * s],
    [cx - 5.2 * s, hy + 3.6 * s],
  ]);
  g.fill();
  eyesAt(g, cx, hy + 1.9 * s, s, '#cfe0ff', '#5a7ab8', 2.5);
  // Glasses
  g.strokeStyle = '#c9d2e2';
  g.lineWidth = 0.5 * s;
  for (const dir of [-1, 1]) g.strokeRect(cx + dir * 2.5 * s - 1.6 * s, hy + 1 * s, 3.2 * s, 1.9 * s);
  g.beginPath();
  g.moveTo(cx - 0.9 * s, hy + 1.8 * s);
  g.lineTo(cx + 0.9 * s, hy + 1.8 * s);
  g.stroke();
};

/**
 * Sōsuke Aizen (a chibi homage): long wavy brown hair with one lock over his
 * brow, a calm smile, the white of a prisoner bound in black restraints, and
 * Kyōka Suigetsu at his side.
 */
const aizen: Draw = (g, w, h) => {
  const s = 2;
  const cx = w / 2;
  const cy = h / 2 + 7;
  const hy = cy - 13 * s;
  aura(g, cx, cy, 56, 'rgba(184,154,255,0.2)');
  // Long hair falling down his back
  g.fillStyle = '#6a4228';
  g.beginPath();
  g.ellipse(cx, hy + 6 * s, 8 * s, 11 * s, 0, 0, TAU);
  g.fill();
  // White robes, bound in black straps
  const robe = g.createLinearGradient(0, cy - 6 * s, 0, cy + 20 * s);
  robe.addColorStop(0, '#ffffff');
  robe.addColorStop(1, '#cfcad8');
  g.fillStyle = robe;
  g.beginPath();
  g.moveTo(cx - 8.4 * s, cy - 6.5 * s);
  g.lineTo(cx + 8.4 * s, cy - 6.5 * s);
  g.lineTo(cx + 11 * s, cy + 20 * s);
  g.lineTo(cx - 11 * s, cy + 20 * s);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(40,30,60,0.4)';
  g.lineWidth = 1;
  g.stroke();
  g.strokeStyle = '#1a1622';
  g.lineWidth = 1.4 * s;
  g.beginPath();
  g.moveTo(cx - 8.4 * s, cy - 4 * s);
  g.lineTo(cx + 9 * s, cy + 8 * s);
  g.moveTo(cx + 8.4 * s, cy - 4 * s);
  g.lineTo(cx - 9 * s, cy + 8 * s);
  g.moveTo(cx - 10 * s, cy + 13 * s);
  g.lineTo(cx + 10 * s, cy + 13 * s);
  g.stroke();
  g.fillStyle = '#8a8296';
  for (const [dx, dy] of [
    [0, 2],
    [-5, -1],
    [5, -1],
  ] as const) {
    g.fillRect(cx + dx * s - 1 * s, cy + dy * s - 1 * s, 2 * s, 2 * s);
  }
  for (const dir of [-1, 1]) {
    g.fillStyle = '#f4f2f8';
    g.beginPath();
    g.ellipse(cx + dir * 10.6 * s, cy + 1.5 * s, 3.8 * s, 7.2 * s, -dir * 0.25, 0, TAU);
    g.fill();
    g.fillStyle = SKIN;
    g.beginPath();
    g.arc(cx + dir * 11.6 * s, cy + 9.6 * s, 1.6 * s, 0, TAU);
    g.fill();
  }
  heldSword(g, cx + 12 * s, cy + 9.6 * s, s, 14, -0.22);
  faceAt(g, cx, hy + 0.8 * s, s, 5.6, 6.4);
  // Wavy brown hair, one lock over the brow
  g.fillStyle = '#6a4228';
  g.beginPath();
  g.ellipse(cx, hy - 2 * s, 7 * s, 5.2 * s, 0, Math.PI * 0.95, Math.PI * 2.05);
  g.fill();
  for (const dir of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx + dir * 5.4 * s, hy - 2 * s);
    g.quadraticCurveTo(cx + dir * 8.6 * s, hy + 4 * s, cx + dir * 7.4 * s, hy + 10 * s);
    g.lineTo(cx + dir * 5.6 * s, hy + 6 * s);
    g.quadraticCurveTo(cx + dir * 6 * s, hy + 1 * s, cx + dir * 4.4 * s, hy - 0.6 * s);
    g.closePath();
    g.fill();
  }
  g.strokeStyle = '#6a4228';
  g.lineWidth = 0.8 * s;
  g.beginPath();
  g.moveTo(cx + 0.4 * s, hy - 4 * s);
  g.quadraticCurveTo(cx - 1.4 * s, hy - 1 * s, cx + 0.6 * s, hy + 1.6 * s);
  g.stroke();
  // Calm eyes, a faint smile
  g.strokeStyle = '#3a2416';
  g.lineWidth = 0.7 * s;
  g.beginPath();
  g.moveTo(cx - 4 * s, hy + 1.6 * s);
  g.quadraticCurveTo(cx - 2.6 * s, hy + 1 * s, cx - 1.3 * s, hy + 1.6 * s);
  g.moveTo(cx + 1.3 * s, hy + 1.6 * s);
  g.quadraticCurveTo(cx + 2.6 * s, hy + 1 * s, cx + 4 * s, hy + 1.6 * s);
  g.moveTo(cx - 1.6 * s, hy + 4.4 * s);
  g.quadraticCurveTo(cx, hy + 5.2 * s, cx + 1.6 * s, hy + 4.4 * s);
  g.stroke();
};

/** Ichigo's two blades: the great cleaver in his right hand, the short one in his left. */
function ichigoBlades(g: Ctx, cx: number, cy: number, s: number): void {
  // The cleaver: broad, no guard, its hilt wrapped and trailing cloth
  g.save();
  g.translate(cx + 12.4 * s, cy + 9.6 * s);
  g.rotate(-0.35);
  g.fillStyle = '#1a1c26';
  g.fillRect(-0.9 * s, -5.4 * s, 1.8 * s, 5.4 * s);
  g.fillStyle = '#e8eef8';
  g.beginPath();
  g.moveTo(-1.2 * s, 0);
  g.lineTo(4.2 * s, 0);
  g.lineTo(4.2 * s, 15 * s);
  g.lineTo(1.4 * s, 18 * s);
  g.lineTo(-1.2 * s, 15 * s);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(40,46,60,0.6)';
  g.lineWidth = 0.5 * s;
  g.stroke();
  g.fillStyle = '#14161f';
  g.fillRect(-1.2 * s, 0, 1.4 * s, 15 * s);
  g.restore();
  heldSword(g, cx - 12 * s, cy + 9.6 * s, s, 8, 0.45, '#e8eef8');
}

/** Ichigo's spiked orange hair. */
function ichigoHair(g: Ctx, cx: number, hy: number, s: number): void {
  g.fillStyle = '#ff8a2a';
  g.beginPath();
  g.ellipse(cx, hy - 2.4 * s, 6.8 * s, 5 * s, 0, Math.PI * 0.95, Math.PI * 2.05);
  g.fill();
  for (let k = 0; k < 9; k++) {
    const a = Math.PI * (1.02 + (k / 8) * 0.96);
    poly(g, [
      [cx + Math.cos(a - 0.17) * 5.4 * s, hy - 1.8 * s + Math.sin(a - 0.17) * 5.4 * s],
      [cx + Math.cos(a) * (9.4 + (k % 2) * 1.6) * s, hy - 1.8 * s + Math.sin(a) * (9.4 + (k % 2) * 1.6) * s],
      [cx + Math.cos(a + 0.17) * 5.4 * s, hy - 1.8 * s + Math.sin(a + 0.17) * 5.4 * s],
    ]);
    g.fill();
  }
  poly(g, [
    [cx - 5 * s, hy - 3 * s],
    [cx - 1.4 * s, hy + 1.4 * s],
    [cx + 0.2 * s, hy - 2.6 * s],
    [cx + 2.2 * s, hy + 0.8 * s],
    [cx + 5 * s, hy - 3 * s],
  ]);
  g.fill();
}

/**
 * Ichigo Kurosaki (a chibi homage): spiked orange hair, a scowl, a long black
 * coat over his robes, and both of his blades.
 */
const ichigo: Draw = (g, w, h) => {
  const s = 2;
  const cx = w / 2;
  const cy = h / 2 + 7;
  const hy = cy - 13 * s;
  aura(g, cx, cy, 58, 'rgba(255,106,60,0.18)');
  // The long black coat, flared
  g.fillStyle = '#0a0b10';
  g.beginPath();
  g.moveTo(cx - 9 * s, cy - 7 * s);
  g.quadraticCurveTo(cx - 17 * s, cy + 8 * s, cx - 15 * s, cy + 20 * s);
  g.lineTo(cx + 15 * s, cy + 20 * s);
  g.quadraticCurveTo(cx + 17 * s, cy + 8 * s, cx + 9 * s, cy - 7 * s);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(255,90,70,0.45)';
  g.lineWidth = 1;
  g.stroke();
  captainBody(g, cx, cy, s, { haori: 'none' });
  ichigoBlades(g, cx, cy, s);
  faceAt(g, cx, hy + 0.8 * s, s, 5.6, 6.4);
  ichigoHair(g, cx, hy, s);
  browsAt(g, cx, hy + 0.6 * s, s, '#c8641a', 1.8);
  eyesAt(g, cx, hy + 2 * s, s, '#f0e0c8', '#a06030', 2.5);
  g.strokeStyle = '#5a3a30';
  g.lineWidth = 0.6 * s;
  g.beginPath();
  g.moveTo(cx - 1.6 * s, hy + 4.8 * s);
  g.lineTo(cx + 1.6 * s, hy + 4.8 * s);
  g.stroke();
};

/** Ichigo with his Hollow mask: white, red stripes down its left side, black eyes with yellow irises. */
const ichigoMask: Draw = (g, w, h) => {
  const s = 2;
  const cx = w / 2;
  const cy = h / 2 + 7;
  const hy = cy - 13 * s;
  aura(g, cx, cy, 64, 'rgba(255,48,72,0.26)');
  g.fillStyle = '#0a0b10';
  g.beginPath();
  g.moveTo(cx - 9 * s, cy - 7 * s);
  g.quadraticCurveTo(cx - 17 * s, cy + 8 * s, cx - 15 * s, cy + 20 * s);
  g.lineTo(cx + 15 * s, cy + 20 * s);
  g.quadraticCurveTo(cx + 17 * s, cy + 8 * s, cx + 9 * s, cy - 7 * s);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(255,48,72,0.7)';
  g.lineWidth = 1.2;
  g.stroke();
  captainBody(g, cx, cy, s, { haori: 'none' });
  ichigoBlades(g, cx, cy, s);
  ichigoHair(g, cx, hy, s);
  // The mask over his face
  g.fillStyle = '#f8f6f0';
  g.beginPath();
  g.ellipse(cx, hy + 1.2 * s, 5.8 * s, 6.6 * s, 0, 0, TAU);
  g.fill();
  g.strokeStyle = '#c8202e';
  g.lineWidth = 0.9 * s;
  g.beginPath();
  for (const dx of [-3.6, -2.2]) {
    g.moveTo(cx + dx * s, hy - 4.6 * s);
    g.lineTo(cx + dx * s - 0.6 * s, hy + 6 * s);
  }
  g.stroke();
  for (const dir of [-1, 1]) {
    g.fillStyle = '#0a0b10';
    g.beginPath();
    g.ellipse(cx + dir * 2.6 * s, hy + 1.4 * s, 1.8 * s, 1.2 * s, 0, 0, TAU);
    g.fill();
    glowDot(g, cx + dir * 2.6 * s, hy + 1.4 * s, 0.7 * s, 0.7 * s, '#ffd84a', 'rgba(255,216,74,0.9)', 4);
  }
  g.strokeStyle = '#14161f';
  g.lineWidth = 0.4 * s;
  g.beginPath();
  for (let k = -3; k <= 3; k++) {
    g.moveTo(cx + k * 0.9 * s, hy + 4.2 * s);
    g.lineTo(cx + k * 0.9 * s, hy + 6 * s);
  }
  g.stroke();
};

// ------------------------------------------------------------ the Sternritter who stole a bankai

/**
 * A Sternritter's white Wandenreich uniform: a long coat (or a short skirt and
 * boots), black trim down the front, a black belt, the Quincy star at the
 * chest, a white cape behind and black gloves. Heads are drawn by each knight.
 */
function sternritter(g: Ctx, cx: number, cy: number, s: number, o: { broad?: number; skirt?: boolean; skin?: string } = {}): void {
  const b = o.broad ?? 1;
  g.fillStyle = '#e6eaf2';
  g.beginPath();
  g.moveTo(cx - 9 * s * b, cy - 7 * s);
  g.quadraticCurveTo(cx - 16 * s * b, cy + 6 * s, cx - 14 * s * b, cy + 19.5 * s);
  g.lineTo(cx + 14 * s * b, cy + 19.5 * s);
  g.quadraticCurveTo(cx + 16 * s * b, cy + 6 * s, cx + 9 * s * b, cy - 7 * s);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(30,36,50,0.4)';
  g.lineWidth = 1;
  g.stroke();
  if (o.skirt) {
    // Long black boots under a short skirt
    g.fillStyle = '#14161f';
    for (const dir of [-1, 1]) {
      roundRect(g, cx + dir * 4 * s - 2.4 * s, cy + 9 * s, 4.8 * s, 11.6 * s, 1.4 * s);
      g.fill();
    }
  }
  const coat = g.createLinearGradient(0, cy - 6 * s, 0, cy + 20 * s);
  coat.addColorStop(0, '#ffffff');
  coat.addColorStop(1, '#c8d0de');
  g.fillStyle = coat;
  g.beginPath();
  g.moveTo(cx - 8 * s * b, cy - 6 * s);
  g.lineTo(cx + 8 * s * b, cy - 6 * s);
  const hem = o.skirt ? 10.5 : 20;
  g.lineTo(cx + (o.skirt ? 10.8 : 10.6) * s * b, cy + hem * s);
  g.lineTo(cx - (o.skirt ? 10.8 : 10.6) * s * b, cy + hem * s);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(20,24,36,0.5)';
  g.stroke();
  g.strokeStyle = '#14161f';
  g.lineWidth = 0.9 * s;
  g.beginPath();
  g.moveTo(cx, cy - 5 * s);
  g.lineTo(cx, cy + hem * s);
  g.stroke();
  g.fillStyle = '#14161f';
  g.fillRect(cx - 8.6 * s * b, cy + 3.6 * s, 17.2 * s * b, 1.8 * s);
  // The Quincy star at the chest
  g.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU - Math.PI / 2;
    const r = k % 2 === 0 ? 1.9 * s : 0.8 * s;
    g.lineTo(cx - 4 * s * b + Math.cos(a) * r, cy - 1.2 * s + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  if (!o.skirt) {
    g.fillStyle = '#14161f';
    for (const dir of [-1, 1]) {
      g.beginPath();
      g.ellipse(cx + dir * 4 * s, cy + 20.4 * s, 2.8 * s, 1.4 * s, 0, 0, TAU);
      g.fill();
    }
  }
  // Sleeves and black gloves
  for (const dir of [-1, 1]) {
    g.fillStyle = '#eef2f8';
    g.beginPath();
    g.ellipse(cx + dir * 10.4 * s * b, cy + 1.5 * s, 3.9 * s, 7.3 * s, -dir * 0.25, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(20,24,36,0.35)';
    g.lineWidth = 0.8;
    g.stroke();
    g.fillStyle = o.skin ?? '#14161f';
    g.beginPath();
    g.arc(cx + dir * 11.6 * s * b, cy + 9.6 * s, 1.7 * s, 0, TAU);
    g.fill();
  }
}

/**
 * Äs Nödt (a chibi homage), Sternritter F, The Fear, who stole Senbonzakura:
 * a white hood over wild black hair, dark sunken eyes, and a lipless mouth of
 * bared teeth. Pink petals drift around him.
 */
const thiefFear: Draw = (g, w, h) => {
  const s = 2;
  const cx = w / 2;
  const cy = h / 2 + 7;
  const hy = cy - 13 * s;
  aura(g, cx, cy, 56, 'rgba(255,156,194,0.18)');
  sternritter(g, cx, cy, s);
  // The hood
  g.fillStyle = '#eef2f8';
  g.beginPath();
  g.ellipse(cx, hy - 0.5 * s, 7.8 * s, 8 * s, 0, 0, TAU);
  g.fill();
  g.strokeStyle = 'rgba(20,24,36,0.4)';
  g.lineWidth = 0.8;
  g.stroke();
  g.fillStyle = '#c9ced8';
  g.beginPath();
  g.ellipse(cx, hy + 1 * s, 5.6 * s, 6.2 * s, 0, 0, TAU);
  g.fill();
  // Wild black hair spilling out under the hood
  g.fillStyle = '#0d0e14';
  for (let k = -3; k <= 3; k++) {
    poly(g, [
      [cx + k * 1.5 * s - 1 * s, hy - 4.6 * s],
      [cx + k * 1.7 * s, hy - 0.8 * s],
      [cx + k * 1.5 * s + 1 * s, hy - 4.6 * s],
    ]);
    g.fill();
  }
  // Sunken eyes
  for (const dir of [-1, 1]) {
    g.fillStyle = '#1a1622';
    g.beginPath();
    g.ellipse(cx + dir * 2.4 * s, hy + 1 * s, 1.7 * s, 1.4 * s, 0, 0, TAU);
    g.fill();
    glowDot(g, cx + dir * 2.4 * s, hy + 1 * s, 0.5 * s, 0.5 * s, '#ff6a8a', 'rgba(255,60,100,0.9)', 3);
  }
  // A lipless mouth: bared teeth
  g.fillStyle = '#f2ede2';
  g.fillRect(cx - 3 * s, hy + 3.6 * s, 6 * s, 1.8 * s);
  g.strokeStyle = '#2a2026';
  g.lineWidth = 0.35 * s;
  g.beginPath();
  for (let k = -2; k <= 2; k++) {
    g.moveTo(cx + k * 1.2 * s, hy + 3.6 * s);
    g.lineTo(cx + k * 1.2 * s, hy + 5.4 * s);
  }
  g.moveTo(cx - 3 * s, hy + 4.5 * s);
  g.lineTo(cx + 3 * s, hy + 4.5 * s);
  g.stroke();
  // Senbonzakura's petals
  g.fillStyle = 'rgba(255,170,205,0.9)';
  for (const [x, y] of [
    [-17, -6],
    [16, -10],
    [-14, 12],
    [18, 8],
  ] as const) {
    g.beginPath();
    g.ellipse(cx + x * s, cy + y * s, 1.4 * s, 0.8 * s, 0.6, 0, TAU);
    g.fill();
  }
};

/**
 * Cang Du (a chibi homage), Sternritter I, The Iron, who stole Hyōrinmaru:
 * long black hair in a braid over his shoulder, narrow eyes, a high collar,
 * and hands gone to steel. Frost glints around him.
 */
const thiefIron: Draw = (g, w, h) => {
  const s = 2;
  const cx = w / 2;
  const cy = h / 2 + 7;
  const hy = cy - 13 * s;
  aura(g, cx, cy, 56, 'rgba(143,216,255,0.18)');
  sternritter(g, cx, cy, s, { skin: '#9aa6b8' });
  // The braid, over the left shoulder
  g.strokeStyle = '#0d0e14';
  g.lineWidth = 2.4 * s;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx - 4 * s, hy + 3 * s);
  g.quadraticCurveTo(cx - 9 * s, cy - 2 * s, cx - 8 * s, cy + 8 * s);
  g.stroke();
  // High collar
  g.fillStyle = '#ffffff';
  g.fillRect(cx - 4.4 * s, cy - 8.6 * s, 8.8 * s, 3 * s);
  faceAt(g, cx, hy + 0.8 * s, s, 5.4, 6.2);
  // Black hair, combed straight back
  g.fillStyle = '#0d0e14';
  g.beginPath();
  g.ellipse(cx, hy - 2.2 * s, 6.4 * s, 5 * s, 0, Math.PI * 0.95, Math.PI * 2.05);
  g.fill();
  // Narrow eyes
  g.strokeStyle = '#1a1c26';
  g.lineWidth = 0.7 * s;
  g.beginPath();
  g.moveTo(cx - 4 * s, hy + 1.6 * s);
  g.lineTo(cx - 1.4 * s, hy + 1.2 * s);
  g.moveTo(cx + 1.4 * s, hy + 1.2 * s);
  g.lineTo(cx + 4 * s, hy + 1.6 * s);
  g.stroke();
  // Frost
  g.strokeStyle = 'rgba(200,236,255,0.85)';
  g.lineWidth = 0.6 * s;
  for (const [x, y] of [
    [-16, -4],
    [17, 2],
    [-13, 14],
  ] as const) {
    g.beginPath();
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI;
      g.moveTo(cx + x * s - Math.cos(a) * 2 * s, cy + y * s - Math.sin(a) * 2 * s);
      g.lineTo(cx + x * s + Math.cos(a) * 2 * s, cy + y * s + Math.sin(a) * 2 * s);
    }
    g.stroke();
  }
};

/**
 * BG9 (a chibi homage), Sternritter K, The Knowledge, who stole Raikōben: a
 * closed steel helmet with one glowing visor and a grille, heavy armoured
 * shoulders over the uniform, and launch tubes on his back.
 */
const thiefKnowledge: Draw = (g, w, h) => {
  const s = 2;
  const cx = w / 2;
  const cy = h / 2 + 7;
  const hy = cy - 13 * s;
  aura(g, cx, cy, 58, 'rgba(255,210,122,0.18)');
  // Launch tubes on his back
  g.fillStyle = '#4a5262';
  for (const dir of [-1, 1]) {
    roundRect(g, cx + dir * 9 * s - 2 * s, cy - 14 * s, 4 * s, 9 * s, 1 * s);
    g.fill();
  }
  sternritter(g, cx, cy, s, { broad: 1.25 });
  // Armoured shoulders
  g.fillStyle = '#5a6272';
  for (const dir of [-1, 1]) {
    g.beginPath();
    g.ellipse(cx + dir * 9.6 * s, cy - 5.4 * s, 4.8 * s, 3.4 * s, dir * 0.3, 0, TAU);
    g.fill();
  }
  // The helmet
  const helm = g.createLinearGradient(0, hy - 7 * s, 0, hy + 7 * s);
  helm.addColorStop(0, '#8a94a8');
  helm.addColorStop(1, '#3a4252');
  g.fillStyle = helm;
  roundRect(g, cx - 6.4 * s, hy - 6.4 * s, 12.8 * s, 13.4 * s, 4 * s);
  g.fill();
  g.strokeStyle = 'rgba(20,24,36,0.6)';
  g.lineWidth = 0.6 * s;
  g.stroke();
  glowDot(g, cx, hy + 0.4 * s, 4.4 * s, 0.9 * s, '#ffe680', 'rgba(255,220,90,0.9)', 6);
  g.strokeStyle = '#1a1e28';
  g.lineWidth = 0.4 * s;
  g.beginPath();
  for (let k = -2; k <= 2; k++) {
    g.moveTo(cx + k * 1.2 * s, hy + 3 * s);
    g.lineTo(cx + k * 1.2 * s, hy + 5.6 * s);
  }
  g.stroke();
};

/**
 * Bambietta Basterbine (a chibi homage), Sternritter E, The Explode, who
 * stole Kokujō Tengen Myō'ō: long straight black hair with a fringe, violet
 * eyes, a smirk, a short skirt and long black boots.
 */
const thiefExplode: Draw = (g, w, h) => {
  const s = 1.9;
  const cx = w / 2;
  const cy = h / 2 + 8;
  const hy = cy - 13 * s;
  aura(g, cx, cy, 54, 'rgba(255,170,90,0.18)');
  // Long hair behind
  g.fillStyle = '#0d0e14';
  g.beginPath();
  g.moveTo(cx - 7 * s, hy - 2 * s);
  g.lineTo(cx - 8.6 * s, cy + 6 * s);
  g.lineTo(cx + 8.6 * s, cy + 6 * s);
  g.lineTo(cx + 7 * s, hy - 2 * s);
  g.closePath();
  g.fill();
  sternritter(g, cx, cy, s, { skirt: true });
  faceAt(g, cx, hy + 0.8 * s, s, 5.4, 6.2);
  g.fillStyle = '#0d0e14';
  g.beginPath();
  g.ellipse(cx, hy - 2 * s, 6.6 * s, 5.2 * s, 0, Math.PI * 0.95, Math.PI * 2.05);
  g.fill();
  g.fillRect(cx - 5.8 * s, hy - 3.6 * s, 11.6 * s, 3.2 * s);
  for (const dir of [-1, 1]) g.fillRect(cx + dir * 5.6 * s - (dir > 0 ? 1.6 * s : 0), hy - 1 * s, 1.6 * s, 8 * s);
  eyesAt(g, cx, hy + 1.8 * s, s, '#e0c8ff', '#9a6ad8', 2.4);
  // A smirk
  g.strokeStyle = '#7a3a4a';
  g.lineWidth = 0.6 * s;
  g.beginPath();
  g.moveTo(cx - 1.4 * s, hy + 4.4 * s);
  g.quadraticCurveTo(cx + 0.6 * s, hy + 5 * s, cx + 1.8 * s, hy + 3.8 * s);
  g.stroke();
};

/**
 * Driscoll Berci (a chibi homage), Sternritter O, The Overkill, who stole
 * Kōkō Gonryō Rikyū: a huge, thick-necked brute with a flat-topped crew cut
 * and a grin full of teeth.
 */
const thiefOverkill: Draw = (g, w, h) => {
  const s = 2.1;
  const cx = w / 2;
  const cy = h / 2 + 8;
  const hy = cy - 12.4 * s;
  aura(g, cx, cy, 62, 'rgba(255,243,160,0.18)');
  sternritter(g, cx, cy, s, { broad: 1.42 });
  // A thick neck
  g.fillStyle = SKIN;
  g.fillRect(cx - 4.2 * s, hy + 4 * s, 8.4 * s, 4 * s);
  // A broad, square face
  g.fillStyle = SKIN;
  roundRect(g, cx - 6.6 * s, hy - 5 * s, 13.2 * s, 12.4 * s, 4 * s);
  g.fill();
  // The flat-topped crew cut
  g.fillStyle = '#2a2018';
  g.fillRect(cx - 6.4 * s, hy - 7 * s, 12.8 * s, 3.4 * s);
  // Small eyes under a heavy brow
  browsAt(g, cx, hy - 0.4 * s, s, '#2a2018', 0.4);
  eyesAt(g, cx, hy + 1.2 * s, s, '#f0e8d8', '#8a7050', 2.6);
  // The grin
  g.fillStyle = '#f8f4ea';
  g.beginPath();
  g.moveTo(cx - 4.2 * s, hy + 3.8 * s);
  g.quadraticCurveTo(cx, hy + 7.4 * s, cx + 4.2 * s, hy + 3.8 * s);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(60,30,20,0.8)';
  g.lineWidth = 0.4 * s;
  g.stroke();
  g.beginPath();
  for (let k = -3; k <= 3; k++) {
    g.moveTo(cx + k * 1.1 * s, hy + 4 * s);
    g.lineTo(cx + k * 1 * s, hy + 5.8 * s);
  }
  g.stroke();
};

/**
 * Ganju Shiba on Bonnie (a chibi homage): the Shiba clan's fireworks man, a
 * bandana on his head, riding his great boar, a sack of fireworks over his
 * shoulder.
 */
const ganju: Draw = (g, w, h) => {
  const cx = w / 2;
  const cy = h / 2 + 6;
  aura(g, cx, cy, 30, 'rgba(255,200,120,0.18)');
  // Bonnie: a big brown boar, white tusks
  g.fillStyle = '#7a4a2a';
  g.beginPath();
  g.ellipse(cx, cy + 8, 20, 11, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#5a3418';
  for (const dx of [-12, -4, 6, 13]) g.fillRect(cx + dx - 2, cy + 15, 4, 7);
  g.fillStyle = '#7a4a2a';
  g.beginPath();
  g.ellipse(cx + 18, cy + 6, 8, 7, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#c87a6a';
  g.beginPath();
  g.ellipse(cx + 25, cy + 7, 3, 2.6, 0, 0, TAU);
  g.fill();
  g.strokeStyle = '#f4f0e4';
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(cx + 22, cy + 10);
  g.quadraticCurveTo(cx + 26, cy + 9, cx + 27, cy + 5);
  g.stroke();
  g.fillStyle = '#14100c';
  g.beginPath();
  g.arc(cx + 20, cy + 3, 1.3, 0, TAU);
  g.fill();
  // Ganju, astride
  g.fillStyle = '#3a3048';
  roundRect(g, cx - 8, cy - 14, 14, 18, 4);
  g.fill();
  g.fillStyle = '#e8c8a0';
  g.beginPath();
  g.arc(cx - 1, cy - 20, 6.4, 0, TAU);
  g.fill();
  g.fillStyle = '#c83a3a';
  g.fillRect(cx - 7.6, cy - 25, 13.2, 3);
  g.fillStyle = '#1a1410';
  g.beginPath();
  g.arc(cx - 3, cy - 20, 0.9, 0, TAU);
  g.arc(cx + 1.6, cy - 20, 0.9, 0, TAU);
  g.fill();
  // The fireworks sack
  g.fillStyle = '#d8c8a0';
  g.beginPath();
  g.ellipse(cx - 11, cy - 14, 6, 7, -0.3, 0, TAU);
  g.fill();
  for (const [dx, col] of [
    [-13, '#ff5a5a'],
    [-10, '#5ac8ff'],
    [-7, '#ffd25a'],
  ] as const) {
    g.fillStyle = col;
    g.fillRect(cx + dx, cy - 24, 2, 5);
  }
};

/** Kon (a chibi homage): a mod soul in a stuffed lion, mane bristling, arms up, running for it. */
const kon: Draw = (g, w, h) => {
  const cx = w / 2;
  const cy = h / 2 + 4;
  aura(g, cx, cy, 24, 'rgba(255,220,120,0.2)');
  // Mane
  g.fillStyle = '#d88a2a';
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU;
    g.beginPath();
    g.ellipse(cx + Math.cos(a) * 10, cy - 6 + Math.sin(a) * 10, 5, 4, a, 0, TAU);
    g.fill();
  }
  // Body and head
  g.fillStyle = '#f2c860';
  g.beginPath();
  g.ellipse(cx, cy + 10, 8, 9, 0, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(cx, cy - 6, 9, 0, TAU);
  g.fill();
  // Arms up, legs running
  g.strokeStyle = '#f2c860';
  g.lineWidth = 4;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx - 6, cy + 5);
  g.lineTo(cx - 12, cy - 2);
  g.moveTo(cx + 6, cy + 5);
  g.lineTo(cx + 12, cy - 2);
  g.moveTo(cx - 3, cy + 17);
  g.lineTo(cx - 6, cy + 22);
  g.moveTo(cx + 3, cy + 17);
  g.lineTo(cx + 7, cy + 21);
  g.stroke();
  // Face: button eyes and a stitched smile
  g.fillStyle = '#1a1410';
  g.beginPath();
  g.arc(cx - 3, cy - 7, 1.4, 0, TAU);
  g.arc(cx + 3, cy - 7, 1.4, 0, TAU);
  g.fill();
  g.strokeStyle = '#6a3a1a';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(cx - 3, cy - 2);
  g.quadraticCurveTo(cx, cy, cx + 3, cy - 2);
  g.stroke();
  g.fillStyle = '#a05a2a';
  g.beginPath();
  g.ellipse(cx, cy - 4, 1.6, 1.1, 0, 0, TAU);
  g.fill();
};

// ------------------------------------------------------------ packing

const ENEMY_DRAW: readonly [string, number, Draw][] = [
  ['ayon', 184, ayon],
  ['ayon_rage', 200, ayonRage],
  ['nel', 112, nel],
  ['nel_gamuza', 140, nelGamuza],
  ['bearer', 104, bearer],
  ['brute', 76, brute],
  ['adjuchas', 72, adjuchas],
  ['hollow', 52, hollow],
  ['volatile', 52, volatile],
  ['hound', 48, hound],
  ['unohana', 112, unohana],
  ['unohana_kenpachi', 112, unohanaKenpachi],
  ['guard', 84, guard],
  ['seated', 72, seated],
  ['officer', 52, officer],
  ['caster', 52, caster],
  ['flash', 48, flashScout],
  ['cap_senbonzakura', 112, byakuya],
  ['cap_hyorinmaru', 112, hitsugaya],
  ['cap_raikoben', 112, soifon],
  ['cap_tengen', 136, komamura],
  ['cap_gonryo', 112, sasakibe],
  ['commander', 128, yamamoto],
  ['ashen', 52, ashen],
  ['rift', 96, rift],
  ['sentinel', 60, sentinel],
  ['inkwisp', 52, inkWisp],
  ['inkling', 36, inkling],
  ['weaver', 52, weaver],
  ['asauchi', 48, asauchi],
  ['attendant', 72, attendant],
  ['royal_tenjiro', 112, tenjiro],
  ['royal_kirio', 136, kirio],
  ['royal_kirio_slim', 112, kirioSlim],
  ['royal_oetsu', 112, oetsu],
  ['royal_senjumaru', 120, senjumaru],
  ['ichibe', 144, ichibe],
  ['harribel', 128, harribel],
  ['harribel_tiburon', 144, harribelReleased],
  ['brawler', 52, brawler],
  ['specimen', 56, specimen],
  ['gotei_kenpachi', 120, kenpachi],
  ['gotei_mayuri', 112, mayuri],
  ['gotei_shinji', 112, shinji],
  ['gotei_kensei', 112, kensei],
  ['kyoraku', 128, kyoraku],
  ['jizo', 128, jizo],
  ['heroes_renji', 120, renji],
  ['heroes_renji_bankai', 132, renjiBankai],
  ['heroes_rukia', 104, rukia],
  ['heroes_rukia_bankai', 112, rukiaBankai],
  ['heroes_uryu', 112, uryu],
  ['heroes_aizen', 112, aizen],
  ['ichigo', 120, ichigo],
  ['ichigo_mask', 128, ichigoMask],
  ['thief_senbonzakura', 112, thiefFear],
  ['thief_hyorinmaru', 112, thiefIron],
  ['thief_raikoben', 116, thiefKnowledge],
  ['thief_tengen', 104, thiefExplode],
  ['thief_gonryo', 124, thiefOverkill],
  ['ganju', 68, ganju],
  ['kon', 52, kon],
];

function specs(): Spec[] {
  const list: Spec[] = [
    { name: 'beam', w: 40, h: 200, draw: beam },
    { name: 'crescent', w: 256, h: 128, draw: crescent },
    { name: 'avatar', w: 160, h: 176, draw: avatar },
    { name: 'wings', w: 160, h: 96, draw: wings },
    { name: 'wedge', w: 128, h: 222, draw: wedge },
    { name: 'ring', w: 128, h: 128, draw: ring },
    { name: 'wfill', w: 128, h: 128, draw: wfill },
    { name: 'cloud', w: 128, h: 128, draw: cloud },
    { name: 'firezone', w: 128, h: 128, draw: firezone },
    { name: 'gust', w: 128, h: 128, draw: gust },
    { name: 'frost', w: 128, h: 128, draw: frost },
    { name: 'cage', w: 128, h: 128, draw: cage },
    { name: 'maw', w: 128, h: 112, draw: maw },
    { name: 'fist', w: 64, h: 40, draw: fist },
    { name: 'loveheart', w: 24, h: 22, draw: loveHeart },
    { name: 'eye', w: 192, h: 96, draw: eye },
    { name: 'lightning', w: 48, h: 256, draw: lightning },
    { name: 'shock', w: 128, h: 128, draw: shock },
    { name: 'trail', w: 64, h: 16, draw: trail },
    { name: 'smoke', w: 48, h: 48, draw: smoke },
    { name: 'beamh', w: 256, h: 32, draw: beamh },
    { name: 'flame', w: 192, h: 48, draw: flame },
    { name: 'dragon', w: 120, h: 48, draw: dragon },
    { name: 'meteor', w: 72, h: 72, draw: meteor },
    // The Emperor in every look: his body, its hit flash, and his cape on its own.
    { name: 'player', w: 60, h: 72, draw: hero },
    { name: 'player_f', w: 60, h: 72, draw: flash(hero) },
    { name: 'cape', w: 60, h: 72, draw: heroCape(HERO_LOOKS.default) },
    ...HERO_LOOK_IDS.filter((look) => look !== 'default').flatMap((look) => [
      { name: `player_${look}`, w: 60, h: 72, draw: heroBody(HERO_LOOKS[look]) },
      { name: `player_${look}_f`, w: 60, h: 72, draw: flash(heroBody(HERO_LOOKS[look])) },
      { name: `cape_${look}`, w: 60, h: 72, draw: heroCape(HERO_LOOKS[look]) },
    ]),
    { name: 'evo_pupils', w: 60, h: 72, draw: evoPupils },
    { name: 'evo_wings', w: 120, h: 60, draw: evoWings },
    { name: 'shrine', w: 48, h: 64, draw: shrine },
    { name: 'fragment', w: 40, h: 40, draw: fragment },
    { name: 'evo_eyes', w: 60, h: 72, draw: evoEyes },
    { name: 'evo_shadow', w: 112, h: 112, draw: evoShadow },
    { name: 'glow', w: 64, h: 64, draw: glow },
    { name: 'disc', w: 64, h: 64, draw: disc },
    { name: 'ash', w: 64, h: 64, draw: ash },
    { name: 'bolt', w: 128, h: 24, draw: bolt },
    { name: 'arrow', w: 56, h: 20, draw: arrow },
    { name: 'blade', w: 40, h: 24, draw: blade },
    { name: 'missile', w: 40, h: 16, draw: missile },
    { name: 'thorn', w: 30, h: 10, draw: thorn },
    { name: 'petal', w: 20, h: 14, draw: petal },
    { name: 'bomb', w: 26, h: 26, draw: bomb },
    { name: 'drone', w: 30, h: 30, draw: drone },
    { name: 'shadow', w: 48, h: 20, draw: shadow },
    { name: 'chest', w: 44, h: 38, draw: chest('#2a1d12', '#3a2818', '#e2b552', 'rgba(255,200,90,0.35)') },
    { name: 'chestBlack', w: 44, h: 38, draw: chest('#0e0c14', '#1c1828', '#f0c869', 'rgba(255,60,90,0.45)') },
    { name: 'medallion', w: 40, h: 40, draw: medallion },
    { name: 'heart', w: 32, h: 32, draw: heart },
    { name: 'magnet', w: 36, h: 36, draw: magnet },
    { name: 'nuke', w: 36, h: 36, draw: nuke },
    { name: 'pointer', w: 28, h: 28, draw: pointer },
    { name: 'spark', w: 24, h: 24, draw: spark },
    { name: 'star', w: 24, h: 24, draw: star },
    { name: 'snow', w: 20, h: 20, draw: snow },
    { name: 'mask', w: 22, h: 18, draw: maskShard },
    { name: 'bala', w: 20, h: 20, draw: bala },
    { name: 'icebolt', w: 40, h: 24, draw: iceBolt },
    { name: 'orb0', w: 22, h: 22, draw: gem('#bfe6ff', '#2a6fd6') },
    { name: 'orb1', w: 22, h: 22, draw: gem('#ffe2a0', '#c06a1b') },
    { name: 'orb2', w: 22, h: 22, draw: gem('#ffd0dc', '#b8143a') },
    { name: 'dot', w: 16, h: 16, draw: disc },
    { name: 'shard', w: 16, h: 16, draw: shard },
    { name: 'square', w: 8, h: 8, draw: square, inset: 2 },
  ];
  for (const [name, size, draw] of ENEMY_DRAW) {
    list.push({ name, w: size, h: size, draw });
    list.push({ name: `${name}_f`, w: size, h: size, draw: flash(draw) });
  }
  for (let d = 0; d < 10; d++) list.push({ name: `d${d}`, w: 22, h: 30, draw: digit(String(d)) });
  // Tallest first packs the shelves tighter.
  return list.sort((a, b) => b.h - a.h);
}

export function buildAtlas(): Atlas {
  const list = specs();
  const W = 1024;
  const pad = 2;
  let x = pad;
  let y = pad;
  let rowH = 0;
  const pos: { x: number; y: number }[] = [];
  for (const s of list) {
    if (x + s.w + pad > W) {
      x = pad;
      y += rowH + pad;
      rowH = 0;
    }
    pos.push({ x, y });
    x += s.w + pad;
    rowH = Math.max(rowH, s.h);
  }
  let H = 64;
  while (H < y + rowH + pad) H *= 2;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('Canvas 2D is not available');
  list.forEach((s, i) => {
    g.save();
    g.translate(pos[i].x, pos[i].y);
    g.beginPath();
    g.rect(0, 0, s.w, s.h);
    g.clip();
    s.draw(g, s.w, s.h);
    g.restore();
  });
  const base = Texture.from(canvas);
  const frames: Record<string, Texture> = {};
  const px: Record<string, { w: number; h: number }> = {};
  list.forEach((s, i) => {
    const inset = s.inset ?? 0;
    const w = s.w - inset * 2;
    const h = s.h - inset * 2;
    frames[s.name] = new Texture({ source: base.source, frame: new Rectangle(pos[i].x + inset, pos[i].y + inset, w, h) });
    px[s.name] = { w, h };
  });
  return { canvas, base, frames, px };
}

/**
 * Paint one atlas sprite into its own canvas for the DOM (the title's Emperor,
 * boss portraits, the Codex). `cssWidth` is the canvas's CSS width; it is
 * drawn at the device's pixel ratio so it stays sharp.
 */
export function drawSprite(canvas: HTMLCanvasElement, name: string, cssWidth: number, ratio = Math.min(window.devicePixelRatio || 1, 3)): boolean {
  const spec = specs().find((s) => s.name === name);
  const g = spec ? canvas.getContext('2d') : null;
  if (!spec || !g) return false;
  const k = (cssWidth / spec.w) * ratio;
  canvas.width = Math.round(spec.w * k);
  canvas.height = Math.round(spec.h * k);
  g.scale(k, k);
  spec.draw(g, spec.w, spec.h);
  return true;
}

/** The composite's size in atlas pixels: room for the wings either side of the hero. */
export const EMPEROR_BOX = { w: 124, h: 96 } as const;

/**
 * The Emperor as far as he has come: the hero, with wings from tier 1, eyes
 * from tier 2 and the Almighty's shadow at tier 3, laid out as they are in a
 * run. For the title, the results and the share card.
 */
export function drawEmperor(
  canvas: HTMLCanvasElement,
  tier: number,
  cssWidth: number,
  ratio = Math.min(window.devicePixelRatio || 1, 3),
  look = 'default',
): void {
  const g = canvas.getContext('2d');
  if (!g) return;
  const { w: W, h: H } = EMPEROR_BOX;
  const k = (cssWidth / W) * ratio;
  canvas.width = Math.round(W * k);
  canvas.height = Math.round(H * k);
  g.scale(k, k);
  const hx = (W - 60) / 2;
  const hy = H - 72 - 2;
  const layer = (draw: Draw, x: number, y: number, w: number, h: number): void => {
    g.save();
    g.translate(x, y);
    draw(g, w, h);
    g.restore();
  };
  if (tier >= 3) layer(evoShadow, hx + 30 - 56, hy + 40 - 56, 112, 112);
  if (tier >= 1) layer(evoWings, hx + 30 - 60, hy + 30 - 30, 120, 60);
  layer(heroDraw(HERO_LOOKS[look] ?? HERO_LOOKS.default), hx, hy, 60, 72);
  if (tier >= 2) layer(evoEyes, hx, hy, 60, 72);
  if (tier >= 3) layer(evoPupils, hx, hy, 60, 72);
}

/** A 1024 px tile covering 512 world units, one per stage. */
export function buildGroundTile(stage: string): Texture {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  if (!g) throw new Error('Canvas 2D is not available');
  if (stage === 'seireitei') seireiteiGround(g, S);
  else if (stage === 'palace') palaceGround(g, S);
  else if (stage === 'silbern') silbernGround(g, S);
  else if (stage === 'wahrwelt') wahrweltGround(g, S);
  else huecoGround(g, S);
  const tex = Texture.from(c);
  tex.source.addressMode = 'repeat';
  return tex;
}

/**
 * Silbern: the Wandenreich's city laid over the Seireitei. Pale slate flagstones
 * with silver seams, the Quincy cross set into the stone, and pools of the
 * shadow it rose from.
 */
function silbernGround(g: Ctx, S: number): void {
  g.fillStyle = '#1a1f2c';
  g.fillRect(0, 0, S, S);
  const rnd = seeded(5150);
  const tile = 128;
  for (let ty = 0; ty < S; ty += tile) {
    for (let tx = 0; tx < S; tx += tile) {
      const v = Math.floor(rnd() * 10);
      g.fillStyle = `rgb(${40 + v},${46 + v},${62 + v})`;
      g.fillRect(tx + 2, ty + 2, tile - 4, tile - 4);
      // A lighter band along the top of each stone, as if lit from above.
      g.fillStyle = 'rgba(214,226,250,0.04)';
      g.fillRect(tx + 2, ty + 2, tile - 4, 10);
      if (rnd() < 0.2) {
        // The Quincy cross, inlaid: a five-pointed star in a ring.
        const cx = tx + tile / 2;
        const cy = ty + tile / 2;
        g.strokeStyle = 'rgba(160,200,255,0.14)';
        g.lineWidth = 2;
        g.beginPath();
        g.arc(cx, cy, 38, 0, TAU);
        g.stroke();
        g.beginPath();
        for (let k = 0; k <= 5; k++) {
          const a = ((k * 2) / 5) * TAU - Math.PI / 2;
          const x = cx + Math.cos(a) * 34;
          const y = cy + Math.sin(a) * 34;
          if (k === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();
      }
    }
  }
  // Silver seams between the stones
  g.strokeStyle = 'rgba(200,214,240,0.16)';
  g.lineWidth = 2;
  for (let k = 0; k <= S; k += tile) {
    g.beginPath();
    g.moveTo(k, 0);
    g.lineTo(k, S);
    g.moveTo(0, k);
    g.lineTo(S, k);
    g.stroke();
  }
  // Pools of shadow, the Schatten Bereich showing through
  for (let k = 0; k < 7; k++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const r = 60 + rnd() * 110;
    for (const [ox, oy] of [
      [0, 0],
      [S, 0],
      [-S, 0],
      [0, S],
      [0, -S],
    ] as const) {
      const grad = g.createRadialGradient(x + ox, y + oy, 4, x + ox, y + oy, r);
      grad.addColorStop(0, 'rgba(4,5,12,0.42)');
      grad.addColorStop(1, 'rgba(4,5,12,0)');
      g.fillStyle = grad;
      g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }
  // A few glints of reishi in the seams
  for (let k = 0; k < 40; k++) {
    const x = Math.round((rnd() * S) / tile) * tile + (rnd() - 0.5) * 6;
    const y = rnd() * S;
    g.fillStyle = `rgba(160,210,255,${0.12 + rnd() * 0.2})`;
    g.fillRect(x - 1, y, 2, 2 + rnd() * 6);
  }
}

/**
 * The Wahrwelt: black stone the Emperor raised from the Soul King's palace,
 * cracked with red reiatsu, silver stars set in it, and here and there an eye
 * of The Almighty half open in the rock.
 */
function wahrweltGround(g: Ctx, S: number): void {
  g.fillStyle = '#100e16';
  g.fillRect(0, 0, S, S);
  const rnd = seeded(9091);
  const tile = 128;
  for (let ty = 0; ty < S; ty += tile) {
    for (let tx = 0; tx < S; tx += tile) {
      const v = Math.floor(rnd() * 8);
      g.fillStyle = `rgb(${22 + v},${19 + v},${30 + v})`;
      g.fillRect(tx + 2, ty + 2, tile - 4, tile - 4);
      if (rnd() < 0.16) {
        // A silver star, the Wandenreich's mark
        const cx = tx + tile / 2;
        const cy = ty + tile / 2;
        g.fillStyle = 'rgba(200,214,240,0.1)';
        g.beginPath();
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * TAU - Math.PI / 2;
          const r = k % 2 === 0 ? 30 : 12;
          g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
        g.closePath();
        g.fill();
      }
    }
  }
  // Red reiatsu running through the cracks
  g.lineCap = 'round';
  for (let k = 0; k < 14; k++) {
    let x = rnd() * S;
    let y = rnd() * S;
    g.strokeStyle = `rgba(255,45,74,${0.12 + rnd() * 0.14})`;
    g.lineWidth = 1.5 + rnd() * 1.5;
    g.beginPath();
    g.moveTo(x, y);
    for (let q = 0; q < 5; q++) {
      x += (rnd() - 0.5) * 90;
      y += (rnd() - 0.5) * 90;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  // Seams between the stones
  g.strokeStyle = 'rgba(160,140,200,0.1)';
  g.lineWidth = 2;
  for (let k = 0; k <= S; k += tile) {
    g.beginPath();
    g.moveTo(k, 0);
    g.lineTo(k, S);
    g.moveTo(0, k);
    g.lineTo(S, k);
    g.stroke();
  }
  // A few eyes in the stone
  for (let k = 0; k < 5; k++) {
    g.save();
    g.globalAlpha = 0.28;
    crimsonEye(g, 60 + rnd() * (S - 120), 60 + rnd() * (S - 120), 2.2 + rnd() * 1.5);
    g.restore();
  }
}

/** Hueco Mundo at night: moonlit sand, pale ripples, bone, dead white trees. */
function huecoGround(g: Ctx, S: number): void {
  g.fillStyle = '#121827';
  g.fillRect(0, 0, S, S);
  const rnd = seeded(1234);
  // Broad dune crests catching the moon: wide soft bands that wrap across the tile's edges.
  g.lineCap = 'round';
  for (let k = 0; k < 6; k++) {
    const y0 = (k / 6) * S + rnd() * 60;
    const amp = 30 + rnd() * 40;
    const freq = (1 + Math.floor(rnd() * 2)) * (TAU / S);
    const phase = rnd() * TAU;
    g.strokeStyle = `rgba(150,170,215,${(0.035 + rnd() * 0.03).toFixed(3)})`;
    g.lineWidth = 70 + rnd() * 60;
    for (const off of [-S, 0, S]) {
      g.beginPath();
      for (let x = 0; x <= S; x += 16) {
        const y = y0 + off + Math.sin(x * freq + phase) * amp;
        if (x === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
  }
  // Fine sand grain
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(160,170,200,${(0.015 + rnd() * 0.04).toFixed(3)})`;
    const s = 1 + rnd() * 2.5;
    g.fillRect(rnd() * S, rnd() * S, s, s);
  }
  // Wind ripples: long gentle waves; drawn on a wrapped tile so they continue across edges
  g.lineCap = 'round';
  for (let k = 0; k < 26; k++) {
    const y0 = rnd() * S;
    const amp = 6 + rnd() * 14;
    const freq = (1 + Math.floor(rnd() * 3)) * (TAU / S);
    const phase = rnd() * TAU;
    g.strokeStyle = `rgba(215,222,240,${(0.045 + rnd() * 0.06).toFixed(3)})`;
    g.lineWidth = 1.5 + rnd() * 2;
    for (const off of [-S, 0, S]) {
      g.beginPath();
      for (let x = 0; x <= S; x += 16) {
        const y = y0 + off + Math.sin(x * freq + phase) * amp;
        if (x === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
  }
  // Scattered bone shards
  for (let i = 0; i < 70; i++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const s = 2 + rnd() * 5;
    const a = rnd() * TAU;
    g.fillStyle = `rgba(239,234,224,${(0.12 + rnd() * 0.2).toFixed(3)})`;
    g.beginPath();
    g.moveTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
    g.lineTo(x + Math.cos(a + 2.4) * s * 0.6, y + Math.sin(a + 2.4) * s * 0.6);
    g.lineTo(x + Math.cos(a + 3.9) * s * 0.6, y + Math.sin(a + 3.9) * s * 0.6);
    g.closePath();
    g.fill();
  }
  // Two dead white trees, seen from above: branching strokes
  const tree = (x: number, y: number, len: number, a: number, depth: number): void => {
    if (depth === 0 || len < 6) return;
    const x2 = x + Math.cos(a) * len;
    const y2 = y + Math.sin(a) * len;
    g.lineWidth = depth * 1.1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x2, y2);
    g.stroke();
    tree(x2, y2, len * 0.68, a - 0.5 - rnd() * 0.3, depth - 1);
    tree(x2, y2, len * 0.68, a + 0.5 + rnd() * 0.3, depth - 1);
  };
  g.strokeStyle = 'rgba(232,236,245,0.16)';
  for (const [tx, ty] of [
    [260, 340],
    [760, 790],
  ] as const) {
    for (let b = 0; b < 4; b++) tree(tx, ty, 34, (b / 4) * TAU + rnd(), 4);
  }
}

/**
 * Seireitei at night, seen from above: a courtyard of big slate flagstones in
 * staggered rows, worn edges and cracks, pale gravel strips, and the warm
 * pools of light from stone lanterns. Everything stays low-contrast so the
 * fight on top reads first.
 */
function seireiteiGround(g: Ctx, S: number): void {
  g.fillStyle = '#10131b';
  g.fillRect(0, 0, S, S);
  const rnd = seeded(4321);
  // Flagstones: 8 rows of 128 px, every other row shifted half a stone. The slab
  // that hangs over the right edge is drawn again on the left, so the tile wraps.
  const row = 128;
  const stone = 128;
  const slab = (x: number, y: number, seed: number): void => {
    const r2 = seeded(seed);
    const v = Math.floor(r2() * 10);
    g.fillStyle = `rgb(${24 + v},${28 + v},${38 + v})`;
    roundRect(g, x + 3, y + 3, stone - 6, row - 6, 6);
    g.fill();
    // A faint lit top edge and a darker bottom edge give each slab some thickness.
    g.lineWidth = 2;
    g.strokeStyle = 'rgba(200,210,235,0.05)';
    g.beginPath();
    g.moveTo(x + 8, y + 5);
    g.lineTo(x + stone - 8, y + 5);
    g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.beginPath();
    g.moveTo(x + 8, y + row - 4);
    g.lineTo(x + stone - 8, y + row - 4);
    g.stroke();
    for (let m = 0; m < 10; m++) {
      g.fillStyle = `rgba(150,160,190,${(0.015 + r2() * 0.03).toFixed(3)})`;
      g.beginPath();
      g.arc(x + 10 + r2() * (stone - 20), y + 10 + r2() * (row - 20), 3 + r2() * 9, 0, TAU);
      g.fill();
    }
    if (r2() < 0.3) {
      g.strokeStyle = 'rgba(0,0,0,0.45)';
      g.lineWidth = 1.2;
      let cx = x + 20 + r2() * (stone - 40);
      let cy = y + 12;
      g.beginPath();
      g.moveTo(cx, cy);
      for (let q = 0; q < 5; q++) {
        cx += (r2() - 0.5) * 22;
        cy += 12 + r2() * 10;
        g.lineTo(cx, cy);
      }
      g.stroke();
    }
  };
  for (let r = 0; r < S / row; r++) {
    const shift = r % 2 ? stone / 2 : 0;
    for (let k = 0; k < S / stone; k++) {
      const x = k * stone + shift;
      const seed = 1 + Math.floor(rnd() * 2147483000);
      slab(x, r * row, seed);
      if (x + stone > S) slab(x - S, r * row, seed);
    }
  }
  // Gravel strip with raked lines, crossing the tile.
  const gy = 3 * row;
  g.fillStyle = '#1a1e28';
  g.fillRect(0, gy - 2, S, 22);
  g.strokeStyle = 'rgba(210,218,240,0.07)';
  g.lineWidth = 1;
  for (let l = 0; l < 4; l++) {
    g.beginPath();
    g.moveTo(0, gy + 3 + l * 5);
    g.lineTo(S, gy + 3 + l * 5);
    g.stroke();
  }
  // Pale specks of gravel and grit.
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = `rgba(200,208,230,${(0.02 + rnd() * 0.05).toFixed(3)})`;
    g.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 1.5, 1 + rnd() * 1.5);
  }
  // Fallen leaves, a few.
  for (let i = 0; i < 26; i++) {
    const x = rnd() * S;
    const y = rnd() * S;
    g.save();
    g.translate(x, y);
    g.rotate(rnd() * TAU);
    g.fillStyle = `rgba(214,190,150,${(0.08 + rnd() * 0.1).toFixed(3)})`;
    g.beginPath();
    g.ellipse(0, 0, 4 + rnd() * 3, 2, 0, 0, TAU);
    g.fill();
    g.restore();
  }
  // Warm lantern light pooling on the stones; each also drawn on the far side of
  // the tile edge it is near, so it wraps cleanly.
  for (const [lx, ly] of [
    [200, 640],
    [760, 180],
  ] as const) {
    for (const ox of [-S, 0, S]) {
      for (const oy of [-S, 0, S]) {
        aura(g, lx + ox, ly + oy, 150, 'rgba(255,190,110,0.07)');
        aura(g, lx + ox, ly + oy, 40, 'rgba(255,214,150,0.12)');
      }
    }
    // The lantern itself, from above: a square cap on a square base.
    g.fillStyle = '#2a2e3a';
    g.fillRect(lx - 14, ly - 14, 28, 28);
    g.fillStyle = '#3a3f4e';
    g.fillRect(lx - 9, ly - 9, 18, 18);
    glowDot(g, lx, ly, 4, 4, '#ffe2b0', '#ffb347', 10);
  }
}

/**
 * The Soul King Palace, seen from above: big tiles of pale marble with gold
 * seams, round inlays here and there, and thin cloud drifting across. Lighter
 * than the other stages, but still low in contrast so the fight reads first.
 */
function palaceGround(g: Ctx, S: number): void {
  g.fillStyle = '#1b1e2b';
  g.fillRect(0, 0, S, S);
  const rnd = seeded(2468);
  const tile = 128;
  for (let ty = 0; ty < S; ty += tile) {
    for (let tx = 0; tx < S; tx += tile) {
      const v = Math.floor(rnd() * 8);
      g.fillStyle = `rgb(${34 + v},${37 + v},${52 + v})`;
      g.fillRect(tx + 2, ty + 2, tile - 4, tile - 4);
      // Faint veins in the marble
      g.strokeStyle = 'rgba(220,226,245,0.05)';
      g.lineWidth = 1.2;
      g.beginPath();
      let x = tx + rnd() * tile;
      let y = ty + 4;
      g.moveTo(x, y);
      for (let q = 0; q < 4; q++) {
        x += (rnd() - 0.5) * 50;
        y += tile / 4;
        g.lineTo(Math.max(tx + 4, Math.min(tx + tile - 4, x)), Math.min(ty + tile - 4, y));
      }
      g.stroke();
      if (rnd() < 0.18) {
        // A round inlay: two gold rings
        const cx = tx + tile / 2;
        const cy = ty + tile / 2;
        g.strokeStyle = 'rgba(255,214,120,0.12)';
        g.lineWidth = 2;
        g.beginPath();
        g.arc(cx, cy, 34, 0, TAU);
        g.stroke();
        g.beginPath();
        g.arc(cx, cy, 22, 0, TAU);
        g.stroke();
      }
    }
  }
  // Gold seams between the tiles
  g.strokeStyle = 'rgba(255,203,92,0.14)';
  g.lineWidth = 2;
  for (let k = 0; k <= S; k += tile) {
    g.beginPath();
    g.moveTo(k, 0);
    g.lineTo(k, S);
    g.moveTo(0, k);
    g.lineTo(S, k);
    g.stroke();
  }
  // Cloud drifting across, drawn three times so it wraps at the edges
  for (let c = 0; c < 9; c++) {
    const x0 = rnd() * S;
    const y0 = rnd() * S;
    const r = 60 + rnd() * 90;
    for (const ox of [-S, 0, S]) {
      for (const oy of [-S, 0, S]) {
        const grad = g.createRadialGradient(x0 + ox, y0 + oy, 0, x0 + ox, y0 + oy, r);
        grad.addColorStop(0, 'rgba(235,240,255,0.06)');
        grad.addColorStop(1, 'rgba(235,240,255,0)');
        g.fillStyle = grad;
        g.fillRect(x0 + ox - r, y0 + oy - r, r * 2, r * 2);
      }
    }
  }
}
