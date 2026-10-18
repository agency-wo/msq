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

/** An original armored giant seen from behind its shoulder: helm with a crest, pauldrons. Drawn in light. */
const avatar: Draw = (g, w, h) => {
  const cx = w / 2;
  g.save();
  g.globalAlpha = 0.9;
  g.fillStyle = 'rgba(255,240,210,0.55)';
  // Pauldrons and torso
  g.beginPath();
  g.ellipse(cx - w * 0.28, h * 0.42, w * 0.2, h * 0.11, -0.25, 0, TAU);
  g.ellipse(cx + w * 0.28, h * 0.42, w * 0.2, h * 0.11, 0.25, 0, TAU);
  g.fill();
  poly(g, [
    [cx - w * 0.3, h * 0.42],
    [cx + w * 0.3, h * 0.42],
    [cx + w * 0.22, h * 0.98],
    [cx - w * 0.22, h * 0.98],
  ]);
  g.fill();
  // Helm and crest
  g.fillStyle = 'rgba(255,248,230,0.75)';
  g.beginPath();
  g.ellipse(cx, h * 0.26, w * 0.15, h * 0.15, 0, 0, TAU);
  g.fill();
  poly(g, [
    [cx - w * 0.03, h * 0.14],
    [cx, h * 0.01],
    [cx + w * 0.03, h * 0.14],
  ]);
  g.fill();
  g.fillStyle = 'rgba(40,30,20,0.6)';
  g.fillRect(cx - w * 0.1, h * 0.25, w * 0.2, h * 0.03);
  g.restore();
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

/**
 * The Emperor, drawn after Yhwach in the game's own chibi style: long wavy
 * black hair falling over his shoulders, a heavy mustache under stern brows,
 * red eyes, a black coat whose tall collar shows crimson beside the hair, and
 * a long cape. Pale rim lines keep the black silhouette readable at night.
 */
const hero: Draw = (g, w) => {
  const cx = w / 2;
  const RIM = 'rgba(214,222,242,0.6)';
  const HAIR = '#0b0b11';
  const HAIR_RIM = 'rgba(214,222,242,0.42)';
  // Cape, flaring from the shoulders
  g.fillStyle = '#0a0b10';
  g.beginPath();
  g.moveTo(cx - 10, 27);
  g.quadraticCurveTo(cx - 27, 50, cx - 24, 70);
  g.quadraticCurveTo(cx, 66, cx + 24, 70);
  g.quadraticCurveTo(cx + 27, 50, cx + 10, 27);
  g.closePath();
  g.fill();
  g.strokeStyle = RIM;
  g.lineWidth = 1.3;
  g.stroke();
  // Coat
  const coat = g.createLinearGradient(0, 28, 0, 66);
  coat.addColorStop(0, '#262833');
  coat.addColorStop(1, '#07080c');
  g.fillStyle = coat;
  g.beginPath();
  g.moveTo(cx - 9, 29);
  g.lineTo(cx + 9, 29);
  g.lineTo(cx + 13, 66);
  g.lineTo(cx - 13, 66);
  g.closePath();
  g.fill();
  // Front opening, hem trim and a silver star at the chest
  g.strokeStyle = 'rgba(232,236,246,0.5)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(cx, 40);
  g.lineTo(cx, 66);
  g.moveTo(cx - 12.6, 63);
  g.lineTo(cx + 12.6, 63);
  g.stroke();
  g.save();
  g.fillStyle = '#eef2fa';
  g.shadowColor = 'rgba(160,210,255,0.9)';
  g.shadowBlur = 4;
  g.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU - Math.PI / 2;
    const r = k % 2 === 0 ? 3.2 : 1.3;
    g.lineTo(cx + Math.cos(a) * r, 36 + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  g.restore();
  // Sleeves with pale cuffs and hands
  g.fillStyle = '#14151c';
  g.beginPath();
  g.ellipse(cx - 12, 44, 4, 9, 0.3, 0, TAU);
  g.fill();
  g.beginPath();
  g.ellipse(cx + 12, 44, 4, 9, -0.3, 0, TAU);
  g.fill();
  g.fillStyle = '#d9d2c4';
  g.fillRect(cx - 16, 50, 6, 1.6);
  g.fillRect(cx + 10, 50, 6, 1.6);
  g.fillStyle = '#efe0cc';
  g.beginPath();
  g.arc(cx - 13.5, 53.5, 2, 0, TAU);
  g.arc(cx + 13.5, 53.5, 2, 0, TAU);
  g.fill();
  // Tall collar: pointed flaps standing up beside the head, crimson facing out
  for (const dir of [-1, 1]) {
    g.fillStyle = '#101117';
    poly(g, [
      [cx + dir * 5, 29],
      [cx + dir * 16.5, 13],
      [cx + dir * 13.5, 31],
    ]);
    g.fill();
    g.fillStyle = '#7a1e2c';
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
  // Face
  g.fillStyle = '#efdfcb';
  g.beginPath();
  g.ellipse(cx, 19.5, 6, 7.2, 0, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(80,50,40,0.25)';
  g.beginPath();
  g.ellipse(cx, 24.5, 4.5, 2.2, 0, 0, TAU);
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

const volatile: Draw = (g, w, h) => {
  const cx = w / 2;
  const cy = h / 2 + 2;
  aura(g, cx, cy, 25, 'rgba(255,110,40,0.3)');
  const grad = g.createRadialGradient(cx - 5, cy - 6, 2, cx, cy, 19);
  grad.addColorStop(0, '#4a2420');
  grad.addColorStop(1, '#0d0708');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(cx, cy + 2, 18, 0, TAU);
  g.fill();
  g.save();
  g.strokeStyle = '#ff7a3c';
  g.shadowColor = '#ff3d1f';
  g.shadowBlur = 8;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(cx - 12, cy - 4);
  g.lineTo(cx - 4, cy + 3);
  g.lineTo(cx - 9, cy + 12);
  g.moveTo(cx + 11, cy - 5);
  g.lineTo(cx + 3, cy + 4);
  g.lineTo(cx + 10, cy + 13);
  g.stroke();
  g.restore();
  mask(g, cx, cy - 8, 16, 13, 2, false);
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

/** Menos Grande: a towering shadow with a broad, cracked three-eyed mask. Original design. */
const menos: Draw = (g, w, h) => {
  const cx = w / 2;
  const cy = h / 2 + 10;
  aura(g, cx, cy, 88, 'rgba(255,30,60,0.2)');
  shadowBody(g, cx, cy + 12, 70, 12, 41, '#2c2238');
  chestHole(g, cx, cy + 34, 11);
  mask(g, cx, cy - 26, 74, 56, 3, true);
  g.strokeStyle = 'rgba(0,0,0,0.6)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(cx + 18, cy - 52);
  g.lineTo(cx + 8, cy - 36);
  g.lineTo(cx + 14, cy - 24);
  g.stroke();
  g.fillStyle = BONE;
  for (let k = -3; k <= 3; k++) {
    if (k === 0) continue;
    const x = cx + k * 16;
    poly(g, [
      [x - 5, cy - 4],
      [x, cy - 22 - Math.abs(k) * 3],
      [x + 5, cy - 4],
    ]);
    g.fill();
  }
};

/** Vasto Lorde: lean, horned skull-mask, the lord of the stage. Original design. */
const vasto: Draw = (g, w, h) => {
  const cx = w / 2;
  const cy = h / 2 + 8;
  aura(g, cx, cy, 60, 'rgba(255,30,60,0.28)');
  // Slender body
  const body = g.createLinearGradient(0, cy - 20, 0, cy + 54);
  body.addColorStop(0, '#2b2236');
  body.addColorStop(1, '#040306');
  g.fillStyle = body;
  poly(g, [
    [cx - 22, cy - 6],
    [cx + 22, cy - 6],
    [cx + 12, cy + 54],
    [cx - 12, cy + 54],
  ]);
  g.fill();
  chestHole(g, cx, cy + 12, 6);
  // Long horns sweeping up
  g.fillStyle = BONE;
  g.beginPath();
  g.moveTo(cx - 10, cy - 30);
  g.quadraticCurveTo(cx - 44, cy - 40, cx - 40, cy - 70);
  g.quadraticCurveTo(cx - 30, cy - 46, cx - 6, cy - 38);
  g.fill();
  g.beginPath();
  g.moveTo(cx + 10, cy - 30);
  g.quadraticCurveTo(cx + 44, cy - 40, cx + 40, cy - 70);
  g.quadraticCurveTo(cx + 30, cy - 46, cx + 6, cy - 38);
  g.fill();
  mask(g, cx, cy - 26, 30, 26, 2, true);
  g.strokeStyle = '#ff2d4a';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(cx, cy - 40);
  g.lineTo(cx, cy - 14);
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

/**
 * The Kidō Grandmaster: an indigo-robed spell master under a wide straw hat,
 * hands joined over a glowing spell, a golden seal turning behind. Original design.
 */
const grandmaster: Draw = (g, w, h) => {
  const cx = w / 2;
  const cy = h / 2 + 6;
  aura(g, cx, cy, 62, 'rgba(255,170,90,0.22)');
  // The seal behind
  g.save();
  g.strokeStyle = 'rgba(255,205,110,0.85)';
  g.shadowColor = '#ffb347';
  g.shadowBlur = 8;
  g.lineWidth = 2;
  g.beginPath();
  g.arc(cx, cy - 6, 52, 0, TAU);
  g.stroke();
  g.lineWidth = 1.2;
  g.beginPath();
  g.arc(cx, cy - 6, 44, 0, TAU);
  g.stroke();
  g.fillStyle = 'rgba(255,215,130,0.9)';
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    const x = cx + Math.cos(a) * 48;
    const y = cy - 6 + Math.sin(a) * 48;
    poly(g, [
      [x, y - 3.5],
      [x + 3.5, y],
      [x, y + 3.5],
      [x - 3.5, y],
    ]);
    g.fill();
  }
  g.restore();
  // Robe
  const robe = g.createLinearGradient(0, cy - 16, 0, cy + 46);
  robe.addColorStop(0, '#2a2c58');
  robe.addColorStop(1, '#07080f');
  g.fillStyle = robe;
  poly(g, [
    [cx - 18, cy - 16],
    [cx + 18, cy - 16],
    [cx + 32, cy + 46],
    [cx - 32, cy + 46],
  ]);
  g.fill();
  g.strokeStyle = 'rgba(214,222,240,0.5)';
  g.lineWidth = 1;
  g.stroke();
  g.fillStyle = '#d9a54a';
  g.fillRect(cx - 31, cy + 41, 62, 3);
  g.fillStyle = '#eceff6';
  poly(g, [
    [cx - 8, cy - 16],
    [cx, cy - 2],
    [cx + 8, cy - 16],
    [cx + 5, cy - 16],
    [cx, cy - 8],
    [cx - 5, cy - 16],
  ]);
  g.fill();
  // Wide sleeves meeting at the chest, a spell glowing between the hands
  g.fillStyle = '#1b1d3d';
  g.beginPath();
  g.ellipse(cx - 14, cy + 6, 9, 14, 0.5, 0, TAU);
  g.fill();
  g.beginPath();
  g.ellipse(cx + 14, cy + 6, 9, 14, -0.5, 0, TAU);
  g.fill();
  glowDot(g, cx, cy + 10, 5, 5, '#fff4d8', '#ff9a3c', 14);
  // Straw hat over a shadowed face, two gold eyes under the brim
  g.fillStyle = INK;
  g.beginPath();
  g.ellipse(cx, cy - 24, 10, 9, 0, 0, TAU);
  g.fill();
  glowDot(g, cx - 4, cy - 23, 1.5, 1.1, '#fff0b8', '#ffb347', 6);
  glowDot(g, cx + 4, cy - 23, 1.5, 1.1, '#fff0b8', '#ffb347', 6);
  const hat = g.createLinearGradient(0, cy - 46, 0, cy - 26);
  hat.addColorStop(0, '#e2cf9f');
  hat.addColorStop(1, '#9c8655');
  g.fillStyle = hat;
  g.beginPath();
  g.moveTo(cx - 30, cy - 28);
  g.lineTo(cx, cy - 46);
  g.lineTo(cx + 30, cy - 28);
  g.quadraticCurveTo(cx, cy - 23, cx - 30, cy - 28);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(70,52,20,0.55)';
  g.lineWidth = 1;
  for (let k = -2; k <= 2; k++) {
    g.beginPath();
    g.moveTo(cx, cy - 46);
    g.lineTo(cx + k * 12, cy - 26.5);
    g.stroke();
  }
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

// ------------------------------------------------------------ packing

const ENEMY_DRAW: readonly [string, number, Draw][] = [
  ['menos', 184, menos],
  ['vasto', 128, vasto],
  ['bearer', 104, bearer],
  ['brute', 76, brute],
  ['adjuchas', 72, adjuchas],
  ['hollow', 52, hollow],
  ['volatile', 52, volatile],
  ['hound', 48, hound],
  ['grandmaster', 136, grandmaster],
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
    { name: 'beamh', w: 256, h: 32, draw: beamh },
    { name: 'flame', w: 192, h: 48, draw: flame },
    { name: 'dragon', w: 120, h: 48, draw: dragon },
    { name: 'meteor', w: 72, h: 72, draw: meteor },
    { name: 'player', w: 60, h: 72, draw: hero },
    { name: 'player_f', w: 60, h: 72, draw: flash(hero) },
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

/** A 1024 px tile covering 512 world units, one per stage. */
export function buildGroundTile(stage: string): Texture {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  if (!g) throw new Error('Canvas 2D is not available');
  if (stage === 'seireitei') seireiteiGround(g, S);
  else huecoGround(g, S);
  const tex = Texture.from(c);
  tex.source.addressMode = 'repeat';
  return tex;
}

/** Hueco Mundo at night: dark sand, pale ripples, bone, dead white trees. */
function huecoGround(g: Ctx, S: number): void {
  g.fillStyle = '#0d1018';
  g.fillRect(0, 0, S, S);
  const rnd = seeded(1234);
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
    g.strokeStyle = `rgba(215,222,240,${(0.03 + rnd() * 0.05).toFixed(3)})`;
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
  g.strokeStyle = 'rgba(232,236,245,0.11)';
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
