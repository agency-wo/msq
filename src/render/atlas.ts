import { Rectangle, Texture } from 'pixi.js';
import { huecoGround, karakuraGround, lasnochesGround, palaceGround, seireiteiGround, silbernGround, wahrweltGround } from './grounds';
import { DISPLAY_FONT, type InkKind, type InkRect, inkCanvas, inkRects } from './ink';
import * as heroes from './cast/heroes';
import * as royal from './cast/royal';
import * as hueco from './cast/hueco';
import * as wand from './cast/wandenreich';
import { CAPE_PIVOT, EVO_EYES, evoPupils, HERO_LOOK_IDS, HERO_LOOKS, heroBody, heroCape, heroDraw } from './cast/emperor';
import * as gotei from './cast/gotei';

/**
 * All game art is drawn here with Canvas 2D at startup and packed into one
 * texture, so the whole game renders from a single texture source (which is
 * what lets Pixi's ParticleContainer batch thousands of sprites) and nothing
 * is downloaded. Bleach's look (ink black, bone white, Quincy blue, Hollow
 * red). The Emperor and the named characters are manga homages (drawn with
 * the figure kit in cast/); the swarm and the effects are original designs.
 * Every sprite then goes through the ink pass (ink.ts): flat tones, hard
 * shadows, an ink line round each figure, effects in hard-edged bands.
 */

/** Atlas pixels per world unit at scale 1: sprites are drawn at 2x for sharp phones. */
export const ATLAS_SCALE = 2;

export { DISPLAY_FONT };

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

/** Effects: drawn additively in a run, so they get hard-edged bands and no outline. */
const FX_SPRITES = new Set([
  'beam', 'crescent', 'avatar', 'wings', 'wedge', 'ring', 'wfill', 'cloud', 'firezone', 'gust', 'frost', 'cage', 'maw', 'fist',
  'loveheart', 'eye', 'lightning', 'shock', 'trail', 'smoke', 'beamh', 'flame', 'dragon', 'meteor', 'evo_wings', 'evo_shadow',
  'glow', 'disc', 'ash', 'bolt', 'arrow', 'blade', 'missile', 'thorn', 'petal', 'spark', 'star', 'snow', 'mask', 'bala',
  'icebolt', 'dot', 'shard',
]);

/** Drawn flat already (solid fills and the ground shadow): left as they are. */
const PLAIN_SPRITES = new Set(['square', 'shadow']);

/** How the ink pass treats a sprite, and how wide its ink line is in atlas pixels (bigger figures, bolder line). */
function inkOf(name: string, w: number): { kind: InkKind; line: number } {
  if (PLAIN_SPRITES.has(name)) return { kind: 'none', line: 0 };
  if (FX_SPRITES.has(name)) return { kind: 'fx', line: 0 };
  return { kind: 'figure', line: w >= 110 ? 3 : w >= 40 ? 2.5 : 2 };
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

/** A jagged star of `spikes` points between radius r and r·(1 − jag): one band of a reiatsu flare. */
function flare(g: Ctx, c: number, r: number, spikes: number, jag: number, rnd: () => number): void {
  g.beginPath();
  for (let k = 0; k <= spikes * 2; k++) {
    const a = (k / (spikes * 2)) * TAU + 0.2;
    const rr = k % 2 === 0 ? r * (0.9 + rnd() * 0.1) : r * (1 - jag * (0.55 + rnd() * 0.45));
    const x = c + Math.cos(a) * rr;
    const y = c + Math.sin(a) * rr;
    if (k === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.fill();
}

/**
 * Spiritual pressure as Bleach inks it: a jagged flare in three hard bands
 * around a solid core, never an airbrushed blob. Tinted in a run.
 */
const glow: Draw = (g, w) => {
  const c = w / 2;
  const rnd = seeded(5);
  g.fillStyle = 'rgba(255,255,255,0.3)';
  flare(g, c, c - 1, 13, 0.34, rnd);
  g.fillStyle = 'rgba(255,255,255,0.42)';
  flare(g, c, c * 0.66, 10, 0.3, rnd);
  g.fillStyle = '#ffffff';
  flare(g, c, c * 0.34, 7, 0.22, rnd);
};

/** A ring as one stroke of the brush (an ensō): thick where the brush lands, thinning to a gap where it lifts. */
const ring: Draw = (g, w) => {
  const c = w / 2;
  const R = c - 9;
  const n = 96;
  const start = -0.35;
  const sweep = TAU * 0.94;
  const outer: [number, number][] = [];
  const inner: [number, number][] = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const a = start + t * sweep;
    // Heavy at the start, a long taper toward the lift.
    const thick = 1.5 + 6.5 * Math.sin(Math.PI * Math.min(1, t * 1.15)) ** 0.6 * (1 - t * 0.55);
    const wob = Math.sin(t * 23) * 0.6;
    outer.push([c + Math.cos(a) * (R + thick / 2 + wob), c + Math.sin(a) * (R + thick / 2 + wob)]);
    inner.push([c + Math.cos(a) * (R - thick / 2 + wob), c + Math.sin(a) * (R - thick / 2 + wob)]);
  }
  g.fillStyle = '#ffffff';
  poly(g, [...outer, ...inner.reverse()]);
  g.fill();
};

/** A hard white disc: the solid core of shots and motes. */
const disc: Draw = (g, w) => {
  const c = w / 2;
  g.fillStyle = 'rgba(255,255,255,0.45)';
  g.beginPath();
  g.arc(c, c, c - 1, 0, TAU);
  g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(c, c, c * 0.72, 0, TAU);
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

/** The ground shadow: a flat blot of ink with a brushed, ragged rim, not an airbrushed fade. */
const shadow: Draw = (g, w, h) => {
  const rnd = seeded(41);
  g.fillStyle = 'rgba(4,4,6,0.62)';
  g.beginPath();
  const n = 22;
  for (let k = 0; k <= n; k++) {
    const a = (k / n) * TAU;
    const j = 0.86 + rnd() * 0.12;
    const x = w / 2 + Math.cos(a) * (w / 2 - 2) * j;
    const y = h / 2 + Math.sin(a) * (h / 2 - 2) * j;
    if (k === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.fill();
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

/** Damage numerals as a manga letters them: heavy, condensed, slanted, paper white in a thick ink line. */
function digit(ch: string): Draw {
  return (g, w, h) => {
    g.save();
    g.translate(w / 2, h / 2 + 1);
    g.transform(1, 0, -0.16, 1, 0, 0);
    g.font = `28px ${DISPLAY_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'miter';
    g.lineWidth = 6;
    g.strokeStyle = '#000000';
    g.strokeText(ch, 0, 0);
    g.fillStyle = '#ffffff';
    g.fillText(ch, 0, 0);
    g.restore();
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
  for (const [x, y, s] of EVO_EYES) crimsonEye(g, x, y, s);
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

export { CAPE_PIVOT, HERO_LOOK_IDS };

const hero = heroBody(HERO_LOOKS.default);

// -------------------------------------------------------------- enemies

// ---------------------------------------------------- the Hollow swarm
// Grotesque, the way Bleach inks its Hollows: black bodies that are all limbs
// and spines, bone masks that are mostly teeth, a hole where the heart was.
// Every one an original design. Colours sit on the ink pass's tone levels.

const H_INK = '#0c0a10';
const H_SHADE = '#3c3a4a';
const H_BONE = '#ece6d6';
const H_BONE_SHADE = '#a99f8b';
const H_MAW = '#4a0a16';
const H_EYE = '#ff3050';

interface GrinOpts {
  /** Teeth along the top of the grin. */
  teeth: number;
  /** Red war paint down through the eyes. */
  stripes?: boolean;
  /** Bone horns from the brow, this long relative to the mask's width. */
  horns?: number;
  /** Blood and drool running off the teeth. */
  drool?: boolean;
}

/** A Hollow's mask: a cracked bone plate, slanted black sockets each with a red glint, and a grin packed with teeth. */
function grinMask(g: Ctx, cx: number, cy: number, mw: number, mh: number, seed: number, o: GrinOpts): void {
  const rnd = seeded(seed);
  const hw = mw / 2;
  if (o.horns) {
    g.fillStyle = H_BONE;
    for (const s of [-1, 1]) {
      const L = mw * o.horns;
      g.beginPath();
      g.moveTo(cx + s * hw * 0.45, cy - mh * 0.3);
      g.quadraticCurveTo(cx + s * (hw + L * 0.45), cy - mh * 0.4, cx + s * (hw + L * 0.6), cy - mh * 0.5 - L * 0.7);
      g.quadraticCurveTo(cx + s * (hw + L * 0.15), cy - mh * 0.42, cx + s * hw * 0.85, cy - mh * 0.06);
      g.closePath();
      g.fill();
    }
  }
  // The plate: a domed brow with a notched rim, cheekbones, a heavy jaw.
  const pts: [number, number][] = [];
  const n = 14;
  for (let k = 0; k <= n; k++) {
    const a = Math.PI + (k / n) * Math.PI;
    const notch = k > 0 && k < n && k % 4 === 2 ? 0.82 : 1;
    pts.push([cx + Math.cos(a) * hw * (0.95 + rnd() * 0.06), cy - mh * 0.06 + Math.sin(a) * mh * 0.46 * notch]);
  }
  pts.push(
    [cx + hw * 0.98, cy + mh * 0.14],
    [cx + hw * 0.8, cy + mh * 0.36],
    [cx + hw * 0.5, cy + mh * 0.5],
    [cx, cy + mh * 0.56],
    [cx - hw * 0.5, cy + mh * 0.5],
    [cx - hw * 0.8, cy + mh * 0.36],
    [cx - hw * 0.98, cy + mh * 0.14],
  );
  g.fillStyle = H_BONE;
  poly(g, pts);
  g.fill();
  // One hard shadow down the right of the face: cel shading, never a gradient.
  g.save();
  poly(g, pts);
  g.clip();
  g.fillStyle = H_BONE_SHADE;
  poly(g, [
    [cx + hw * 0.34, cy - mh],
    [cx + hw * 1.3, cy - mh],
    [cx + hw * 1.3, cy + mh],
    [cx + hw * 0.1, cy + mh],
    [cx + hw * 0.3, cy + mh * 0.12],
  ]);
  g.fill();
  g.restore();
  // Sockets slanted down to the nose, black, each with a red glint.
  g.fillStyle = H_INK;
  for (const s of [-1, 1]) {
    poly(g, [
      [cx + s * hw * 0.84, cy - mh * 0.2],
      [cx + s * hw * 0.12, cy - mh * 0.02],
      [cx + s * hw * 0.16, cy + mh * 0.12],
      [cx + s * hw * 0.7, cy + mh * 0.06],
    ]);
    g.fill();
  }
  g.fillStyle = H_EYE;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.arc(cx + s * hw * 0.42, cy + mh * 0.03, Math.max(1.1, mw * 0.05), 0, TAU);
    g.fill();
  }
  if (o.stripes) {
    g.fillStyle = H_EYE;
    for (const s of [-1, 1]) {
      poly(g, [
        [cx + s * hw * 0.38, cy - mh * 0.5],
        [cx + s * hw * 0.5, cy - mh * 0.5],
        [cx + s * hw * 0.46, cy - mh * 0.2],
        [cx + s * hw * 0.36, cy - mh * 0.2],
      ]);
      g.fill();
    }
  }
  // The grin: a dark-red slit across the jaw, teeth top and bottom, longer at the corners.
  const my = cy + mh * 0.3;
  const half = hw * 0.86;
  const mh2 = mh * 0.15;
  g.fillStyle = H_MAW;
  poly(g, [
    [cx - half, my - mh2 * 0.4],
    [cx, my - mh2 * 1.1],
    [cx + half, my - mh2 * 0.4],
    [cx + half * 0.8, my + mh2],
    [cx, my + mh2 * 1.3],
    [cx - half * 0.8, my + mh2],
  ]);
  g.fill();
  g.fillStyle = H_BONE;
  const t = o.teeth;
  const step = (half * 2) / t;
  for (let k = 0; k < t; k++) {
    const x0 = cx - half + (k + 0.5) * step;
    const tw = step * 0.42;
    const long = k === 0 || k === t - 1 ? 1.7 : 1;
    poly(g, [
      [x0 - tw, my - mh2 * 0.9],
      [x0 + tw, my - mh2 * 0.9],
      [x0, my + mh2 * 0.55 * long],
    ]);
    g.fill();
    if (k < t - 1) {
      const x1 = x0 + step / 2;
      poly(g, [
        [x1 - tw, my + mh2 * 1.1],
        [x1 + tw, my + mh2 * 1.1],
        [x1, my - mh2 * 0.25],
      ]);
      g.fill();
    }
  }
  if (o.drool) {
    g.fillStyle = '#c41430';
    for (const [dx, len] of [[-0.42, 0.34], [0.18, 0.5], [0.5, 0.24]] as const) {
      const x = cx + dx * half;
      g.beginPath();
      g.moveTo(x - mw * 0.03, my + mh2 * 0.6);
      g.lineTo(x + mw * 0.03, my + mh2 * 0.6);
      g.lineTo(x + mw * 0.02, my + mh2 + mh * len * 0.5);
      g.arc(x, my + mh2 + mh * len * 0.5, mw * 0.026, 0, Math.PI);
      g.closePath();
      g.fill();
    }
  }
  // A crack down from the brow.
  g.strokeStyle = H_INK;
  g.lineWidth = Math.max(0.9, mw * 0.035);
  g.lineJoin = 'miter';
  const c0 = cx - hw * 0.35 + rnd() * hw * 0.25;
  g.beginPath();
  g.moveTo(c0, cy - mh * 0.5);
  g.lineTo(c0 + mw * 0.05, cy - mh * 0.36);
  g.lineTo(c0 - mw * 0.02, cy - mh * 0.24);
  g.stroke();
}

/** A limb as one tapering brush stroke through `pts`, from width w0 to w1. */
function limb(g: Ctx, pts: readonly (readonly [number, number])[], w0: number, w1: number, color = H_INK): void {
  g.strokeStyle = color;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (let k = 0; k < pts.length - 1; k++) {
    g.lineWidth = w0 + (w1 - w0) * (k / Math.max(1, pts.length - 2));
    g.beginPath();
    g.moveTo(pts[k][0], pts[k][1]);
    g.lineTo(pts[k + 1][0], pts[k + 1][1]);
    g.stroke();
  }
}

/** Bone claws fanned out from (x, y), pointing along `angle`. */
function claws(g: Ctx, x: number, y: number, angle: number, len: number, count = 3): void {
  g.fillStyle = H_BONE;
  for (let k = 0; k < count; k++) {
    const a = angle + (k - (count - 1) / 2) * 0.45;
    const tx = x + Math.cos(a) * len;
    const ty = y + Math.sin(a) * len;
    const nx = Math.cos(a + Math.PI / 2) * len * 0.22;
    const ny = Math.sin(a + Math.PI / 2) * len * 0.22;
    poly(g, [
      [x + nx, y + ny],
      [tx + nx * 0.6, ty + ny * 0.6],
      [x - nx, y - ny],
    ]);
    g.fill();
  }
}

/** Punch the hole where the heart was right through the body, rimmed in raw red so it reads on any ground. */
function heartHole(g: Ctx, cx: number, cy: number, r: number): void {
  g.strokeStyle = '#c41430';
  g.lineWidth = Math.max(1.4, r * 0.32);
  g.beginPath();
  g.ellipse(cx, cy, r + g.lineWidth * 0.4, (r + g.lineWidth * 0.4) * 1.08, 0, 0, TAU);
  g.stroke();
  g.save();
  g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  g.ellipse(cx, cy, r, r * 1.08, 0, 0, TAU);
  g.fill();
  g.restore();
}

/** Lesser Hollow: a hunched ghoul, arms dragging to the ground, spines along its back, a mask that is all grin. */
const hollow: Draw = (g) => {
  // Arms first, behind the body: shoulder, knobbed elbow, clawed hand on the ground.
  limb(g, [[14, 23], [7, 32], [6, 43]], 4.6, 2.8);
  limb(g, [[38, 23], [45, 32], [46, 43]], 4.6, 2.8);
  claws(g, 6, 44, Math.PI * 0.55, 5);
  claws(g, 46, 44, Math.PI * 0.45, 5);
  // Bent legs, clawed feet.
  limb(g, [[21, 38], [16, 44], [19, 48]], 4.2, 3);
  limb(g, [[31, 38], [36, 44], [33, 48]], 4.2, 3);
  // Hunched torso with a ridge of spines.
  g.fillStyle = H_INK;
  poly(g, [
    [12, 24], [9, 13], [17, 18], [17, 9], [23, 15], [26, 12], [29, 15], [35, 9], [35, 18], [43, 13], [40, 24],
    [37, 35], [33, 42], [19, 42], [15, 35],
  ]);
  g.fill();
  // A hard rim of light down its right flank.
  limb(g, [[39, 25], [36, 34], [32, 40]], 1.6, 1.2, H_SHADE);
  heartHole(g, 26, 32, 3.6);
  grinMask(g, 26, 16, 22, 18, 3, { teeth: 5, drool: true });
};

/** Hound: a crouching beast seen head-on, a mane of black spines, a long narrow snout mask and fangs past the jaw. */
const hound: Draw = (g) => {
  const rnd = seeded(9);
  // The mane: long spines fanning up and out behind the head.
  g.fillStyle = H_INK;
  g.beginPath();
  for (let k = 0; k <= 20; k++) {
    const a = Math.PI * (1 + (k / 20));
    const rr = k % 2 === 0 ? 20 + rnd() * 3 : 10;
    const x = 24 + Math.cos(a) * rr;
    const y = 26 + Math.sin(a) * rr * 0.9;
    if (k === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.lineTo(38, 38);
  g.lineTo(10, 38);
  g.closePath();
  g.fill();
  // Splayed front legs, bent like a spider's, claws dug in.
  limb(g, [[15, 30], [5, 34], [6, 43]], 3.8, 2.4);
  limb(g, [[33, 30], [43, 34], [42, 43]], 3.8, 2.4);
  claws(g, 6, 44, Math.PI * 0.6, 4);
  claws(g, 42, 44, Math.PI * 0.4, 4);
  g.fillStyle = H_INK;
  g.beginPath();
  g.ellipse(24, 33, 12, 8, 0, 0, TAU);
  g.fill();
  limb(g, [[33, 28], [35, 34]], 1.4, 1.2, H_SHADE);
  // Fangs first, so the snout overlaps their roots.
  g.fillStyle = H_BONE;
  poly(g, [[19, 30], [14, 44], [21.5, 34]]);
  g.fill();
  poly(g, [[29, 30], [34, 44], [26.5, 34]]);
  g.fill();
  // The snout mask, foreshortened toward you: long, narrow and pointed, two short horns.
  const snout: [number, number][] = [[17, 14], [20, 11], [24, 10], [28, 11], [31, 14], [30, 24], [27, 36], [24, 42], [21, 36], [18, 24]];
  poly(g, [[18, 13], [14, 5], [21, 11]]);
  g.fill();
  poly(g, [[30, 13], [34, 5], [27, 11]]);
  g.fill();
  poly(g, snout);
  g.fill();
  g.save();
  poly(g, snout);
  g.clip();
  g.fillStyle = H_BONE_SHADE;
  g.fillRect(25, 8, 10, 36);
  g.restore();
  // Sockets with glints, nostril slits, a row of small teeth at the tip.
  g.fillStyle = H_INK;
  poly(g, [[17.6, 15.5], [22.6, 18.5], [22.4, 22], [18.4, 20]]);
  g.fill();
  poly(g, [[30.4, 15.5], [25.4, 18.5], [25.6, 22], [29.6, 20]]);
  g.fill();
  g.fillRect(22.6, 30, 1.1, 3.2);
  g.fillRect(24.4, 30, 1.1, 3.2);
  g.fillStyle = H_EYE;
  g.beginPath();
  g.arc(20.2, 19.2, 1.2, 0, TAU);
  g.arc(27.8, 19.2, 1.2, 0, TAU);
  g.fill();
  g.fillStyle = '#c41430';
  poly(g, [[23, 40], [25, 40], [24.6, 45], [23.4, 45]]);
  g.fill();
};

/** Brute: a horned gorilla of a Hollow, knuckles on the ground, ribs of bone round the hole in its chest. */
const brute: Draw = (g) => {
  // Pillar arms to fists on the ground, behind the hump.
  limb(g, [[17, 30], [9, 46], [11, 62]], 10, 8);
  limb(g, [[59, 30], [67, 46], [65, 62]], 10, 8);
  // Fists with bone knuckle plates.
  g.fillStyle = H_INK;
  g.beginPath();
  g.ellipse(11, 66, 7.5, 6, 0, 0, TAU);
  g.ellipse(65, 66, 7.5, 6, 0, 0, TAU);
  g.fill();
  g.fillStyle = H_BONE;
  for (const x of [6, 10, 14, 61, 65, 69]) {
    poly(g, [[x - 2, 62], [x + 2, 62], [x + 1.5, 66], [x - 1.5, 66]]);
    g.fill();
  }
  // Stumpy legs.
  limb(g, [[30, 56], [28, 68]], 9, 8);
  limb(g, [[46, 56], [48, 68]], 9, 8);
  // The hump: massive shoulders with a ridge of spines.
  g.fillStyle = H_INK;
  poly(g, [
    [10, 32], [12, 20], [20, 22], [22, 12], [30, 18], [38, 14], [46, 18], [54, 12], [56, 22], [64, 20], [66, 32],
    [60, 48], [52, 58], [24, 58], [16, 48],
  ]);
  g.fill();
  limb(g, [[63, 33], [58, 47], [51, 56]], 2, 1.6, H_SHADE);
  // Bone ribs curving round the chest hole.
  g.strokeStyle = H_BONE;
  g.lineCap = 'butt';
  g.lineWidth = 2.6;
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      g.arc(38, 44, 9 + k * 4, s < 0 ? Math.PI * 0.62 : Math.PI * 0.08, s < 0 ? Math.PI * 0.92 : Math.PI * 0.38);
      g.stroke();
    }
  }
  heartHole(g, 38, 44, 6);
  grinMask(g, 38, 23, 28, 22, 17, { teeth: 6, horns: 0.55, drool: true });
};

/** Shrieker's leech: a bloated black grub, its back blistered with sacs about to burst, a lamprey mouth of teeth. */
const volatile: Draw = (g) => {
  // Segments, tail to head, swelling in the middle.
  g.fillStyle = H_INK;
  for (let k = 0; k < 6; k++) {
    const x = 9 + k * 6.4;
    const r = 6 + Math.sin(((k + 0.5) / 6) * Math.PI) * 7;
    g.beginPath();
    g.ellipse(x, 29, r * 0.78, r, 0, 0, TAU);
    g.fill();
  }
  // A hard rim of light along the top of each segment.
  g.strokeStyle = H_SHADE;
  g.lineWidth = 1.4;
  for (let k = 1; k < 5; k++) {
    const x = 9 + k * 6.4;
    const r = 6 + Math.sin(((k + 0.5) / 6) * Math.PI) * 7;
    g.beginPath();
    g.ellipse(x, 29, r * 0.78, r, 0, Math.PI * 1.2, Math.PI * 1.55);
    g.stroke();
  }
  // Blisters full of fire.
  for (const [x, y, r] of [[18, 22, 3.6], [26, 19, 4.4], [34, 23, 3.4], [23, 31, 2.6]] as const) {
    g.fillStyle = '#ff7a2c';
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
    g.fillStyle = '#ffd49a';
    g.beginPath();
    g.arc(x - r * 0.25, y - r * 0.25, r * 0.45, 0, TAU);
    g.fill();
  }
  // The head: a round mouth ringed with teeth pointing in, a scrap of mask above.
  const hx = 43;
  const hy = 30;
  g.fillStyle = H_BONE;
  g.beginPath();
  g.arc(hx, hy, 7, 0, TAU);
  g.fill();
  g.fillStyle = H_MAW;
  g.beginPath();
  g.arc(hx, hy, 4.6, 0, TAU);
  g.fill();
  g.fillStyle = H_BONE;
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * TAU;
    poly(g, [
      [hx + Math.cos(a - 0.3) * 4.8, hy + Math.sin(a - 0.3) * 4.8],
      [hx + Math.cos(a + 0.3) * 4.8, hy + Math.sin(a + 0.3) * 4.8],
      [hx + Math.cos(a) * 1.8, hy + Math.sin(a) * 1.8],
    ]);
    g.fill();
  }
  g.fillStyle = H_BONE_SHADE;
  poly(g, [[37, 22], [44, 18], [49, 22], [46, 24], [40, 24]]);
  g.fill();
  g.fillStyle = H_EYE;
  g.beginPath();
  g.arc(42, 21.5, 1.1, 0, TAU);
  g.fill();
};

/** Adjuchas: a mantis-backed elite, bone armour over black, scythes of bone raised, red war paint on a horned mask. */
const adjuchas: Draw = (g) => {
  // Scythe arms raised behind the body.
  for (const s of [-1, 1]) {
    limb(g, [[36 + s * 10, 32], [36 + s * 22, 22], [36 + s * 25, 12]], 4.4, 3);
    g.fillStyle = H_BONE;
    g.beginPath();
    g.moveTo(36 + s * 25, 12);
    g.quadraticCurveTo(36 + s * 33, 18, 36 + s * 31, 38);
    g.quadraticCurveTo(36 + s * 28, 24, 36 + s * 21, 16);
    g.closePath();
    g.fill();
  }
  // Long digitigrade legs.
  limb(g, [[30, 52], [22, 60], [27, 69]], 5, 3);
  limb(g, [[42, 52], [50, 60], [45, 69]], 5, 3);
  claws(g, 27, 69, Math.PI * 0.75, 3.5);
  claws(g, 45, 69, Math.PI * 0.25, 3.5);
  // Narrow torso.
  g.fillStyle = H_INK;
  poly(g, [[24, 30], [36, 24], [48, 30], [46, 46], [41, 56], [31, 56], [26, 46]]);
  g.fill();
  // Bone armour: a breastplate and segmented belly plates.
  g.fillStyle = H_BONE;
  poly(g, [[27, 31], [36, 27], [45, 31], [43, 39], [36, 42], [29, 39]]);
  g.fill();
  g.fillStyle = H_BONE_SHADE;
  poly(g, [[36, 27], [45, 31], [43, 39], [36, 42]]);
  g.fill();
  g.fillStyle = H_BONE;
  for (let k = 0; k < 3; k++) {
    g.fillRect(30 + k * 0.6, 44 + k * 4, 12 - k * 1.2, 2.2);
  }
  heartHole(g, 36, 35, 2.8);
  // A crest of three spikes over the mask.
  g.fillStyle = H_BONE;
  poly(g, [[31, 13], [33, 2], [36, 11], [39, 2], [41, 13]]);
  g.fill();
  grinMask(g, 36, 18, 22, 20, 29, { teeth: 5, stripes: true, horns: 0.4 });
};

/**
 * Cero Adjuchas: a Menos crouched on four legs, its neck reaching out long
 * and low, spines of bone down its back, and a long bone muzzle split open
 * on the red light of a Cero. Original design.
 */
const ceroHollow: Draw = (g) => {
  // The tail, then the far legs.
  limb(g, [[17, 38], [8, 37], [3, 30]], 4.4, 1.6);
  limb(g, [[24, 41], [22, 49], [25, 56]], 4, 2.4);
  limb(g, [[36, 40], [39, 48], [37, 56]], 4, 2.4);
  // The hunched body.
  g.fillStyle = H_INK;
  poly(g, [[13, 38], [20, 28], [33, 25], [43, 29], [45, 39], [34, 45], [19, 45]]);
  g.fill();
  g.fillStyle = H_SHADE;
  poly(g, [[20, 40], [33, 41], [40, 38], [34, 44], [21, 44]]);
  g.fill();
  // Spines of bone down its back.
  g.fillStyle = H_BONE;
  for (let k = 0; k < 5; k++) {
    const x = 19 + k * 5;
    const y = 29 - Math.sin((k / 4) * Math.PI) * 3;
    poly(g, [[x - 1.6, y + 1.5], [x + 0.4, y - 6 - (k % 2) * 2], [x + 2, y + 1.2]]);
    g.fill();
  }
  heartHole(g, 29, 36, 2.4);
  // The near legs, clawed.
  limb(g, [[19, 40], [14, 48], [17, 56]], 4.6, 2.6);
  limb(g, [[41, 37], [46, 46], [45, 56]], 4.6, 2.6);
  claws(g, 17, 56, Math.PI * 0.62, 3);
  claws(g, 25, 56, Math.PI * 0.5, 3);
  claws(g, 37, 56, Math.PI * 0.5, 3);
  claws(g, 45, 56, Math.PI * 0.38, 3);
  // The long neck, reaching up and out.
  limb(g, [[40, 31], [46, 23], [49, 16]], 6.2, 4.4);
  // The maw: a red Cero gathering between the jaws.
  g.fillStyle = H_MAW;
  poly(g, [[46, 13], [58, 12], [58, 20], [47, 19]]);
  g.fill();
  g.fillStyle = H_EYE;
  g.beginPath();
  g.arc(54, 16, 3, 0, TAU);
  g.fill();
  g.fillStyle = '#ffd0d8';
  g.beginPath();
  g.arc(54.4, 15.6, 1.3, 0, TAU);
  g.fill();
  // Upper jaw: a long muzzle of bone, teeth hanging from it.
  g.fillStyle = H_BONE;
  poly(g, [[42, 9], [49, 5], [58, 9], [59.5, 12.5], [47, 13.5], [42.5, 13]]);
  g.fill();
  g.fillStyle = H_BONE_SHADE;
  poly(g, [[49, 5], [58, 9], [59.5, 12.5], [52, 11]]);
  g.fill();
  g.fillStyle = H_BONE;
  for (let k = 0; k < 4; k++) {
    poly(g, [[48 + k * 2.8, 13.2], [49.2 + k * 2.8, 15.6], [50.4 + k * 2.8, 13.2]]);
    g.fill();
  }
  // Lower jaw, dropped open.
  poly(g, [[44, 17], [57, 19.5], [56.5, 22.5], [45, 21]]);
  g.fill();
  for (let k = 0; k < 3; k++) {
    poly(g, [[49 + k * 2.8, 19.6], [50.2 + k * 2.8, 17.4], [51.4 + k * 2.8, 20]]);
    g.fill();
  }
  // One red eye in a slit of the mask.
  g.fillStyle = H_INK;
  poly(g, [[46, 8.6], [50.6, 7.6], [50, 10], [46.4, 10.6]]);
  g.fill();
  g.fillStyle = H_EYE;
  g.beginPath();
  g.arc(48.6, 9.2, 0.9, 0, TAU);
  g.fill();
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
  /** The Arrancar's white uniform instead of the Soul Reaper's black. */
  white?: boolean;
}

/**
 * A generic Soul Reaper as Bleach draws its rank and file: lanky, a small
 * head of spiky black hair with the eyes lost in shadow but for two hard
 * white slits, the black kosode with its square hanging sleeves, hakama
 * flaring and split at the legs, the white collar, a sword. An anonymous
 * soldier, not any character from the series.
 */
function reaper(g: Ctx, cx: number, cy: number, s: number, o: ReaperLook): void {
  const b = o.broad ?? 1;
  const w = o.white === true;
  const HAKAMA = w ? '#e2ded3' : '#0d0e13';
  const KOSODE = w ? '#ebe7dc' : '#121319';
  const SLEEVE = w ? '#dedacf' : '#16171e';
  const PLEAT = w ? '#a39d8f' : '#3a3d48';
  const COLLAR = w ? '#15161c' : '#eceae2';
  const X = (x: number): number => cx + x * s;
  const Y = (y: number): number => cy + y * s;
  if (o.sword === 'back') {
    // A long blade slung across the back, drawn first so the body covers it.
    g.save();
    g.translate(X(0), Y(-6));
    g.rotate(-0.75);
    g.fillStyle = '#1a1c24';
    g.fillRect(-1.5 * s, -24 * s, 3 * s, 44 * s);
    g.fillStyle = BONE;
    g.fillRect(-1.5 * s, -28 * s, 3 * s, 6 * s);
    g.restore();
  }
  // Hakama: flaring from the waist, split between the legs, sandals and white tabi below.
  g.fillStyle = HAKAMA;
  poly(g, [
    [X(-7 * b), Y(0)],
    [X(7 * b), Y(0)],
    [X(11 * b), Y(19)],
    [X(2), Y(19)],
    [X(0), Y(10)],
    [X(-2), Y(19)],
    [X(-11 * b), Y(19)],
  ]);
  g.fill();
  g.strokeStyle = PLEAT;
  g.lineWidth = 1 * s;
  g.beginPath();
  g.moveTo(X(-4 * b), Y(3));
  g.lineTo(X(-7.5 * b), Y(18));
  g.moveTo(X(4 * b), Y(3));
  g.lineTo(X(7.5 * b), Y(18));
  g.stroke();
  g.fillStyle = w ? '#2a2b31' : '#ece8de';
  g.fillRect(X(-8.5 * b), Y(19), 5 * s, 2.4 * s);
  g.fillRect(X(3.5 * b), Y(19), 5 * s, 2.4 * s);
  // Kosode: shoulders to waist.
  g.fillStyle = KOSODE;
  poly(g, [
    [X(-8 * b), Y(-14)],
    [X(8 * b), Y(-14)],
    [X(7.5 * b), Y(1)],
    [X(-7.5 * b), Y(1)],
  ]);
  g.fill();
  // The square sleeves, hanging straight from the shoulders with a sharp hem.
  g.fillStyle = SLEEVE;
  for (const d of [-1, 1]) {
    poly(g, [
      [X(d * 6 * b), Y(-14)],
      [X(d * 11.5 * b), Y(-12)],
      [X(d * 13 * b), Y(3)],
      [X(d * 7.5 * b), Y(5)],
      [X(d * 6.5 * b), Y(-4)],
    ]);
    g.fill();
  }
  g.strokeStyle = PLEAT;
  g.lineWidth = 1 * s;
  for (const d of [-1, 1]) {
    g.beginPath();
    g.moveTo(X(d * 7 * b), Y(-10));
    g.lineTo(X(d * 8.5 * b), Y(4));
    g.stroke();
  }
  if (b > 1.2) {
    // Plain iron shoulder guards on heavy builds.
    g.fillStyle = '#5d636f';
    for (const d of [-1, 1]) {
      poly(g, [
        [X(d * 5 * b), Y(-15)],
        [X(d * 12 * b), Y(-14)],
        [X(d * 13 * b), Y(-9)],
        [X(d * 6 * b), Y(-10)],
      ]);
      g.fill();
    }
  }
  // The shitagi collar in a sharp V (black under the Arrancar's white).
  g.fillStyle = COLLAR;
  poly(g, [
    [X(-4), Y(-14)],
    [X(0), Y(-5)],
    [X(4), Y(-14)],
    [X(2.4), Y(-14)],
    [X(0), Y(-8.5)],
    [X(-2.4), Y(-14)],
  ]);
  g.fill();
  // Obi.
  g.fillStyle = o.sash ?? (w ? '#15161c' : '#e6e2d8');
  g.fillRect(X(-7.6 * b), Y(-1), 15.2 * s * b, 2.2 * s);
  if (o.sword === 'hip') {
    // Worn at the left hip: hilt forward, the sheathed blade sloping back and down.
    g.save();
    g.translate(X(6 * b), Y(0.5));
    g.rotate(0.85);
    g.fillStyle = '#2b2e38';
    g.fillRect(0, -1.1 * s, 16 * s, 2.2 * s);
    g.fillStyle = BONE;
    g.fillRect(-5.5 * s, -1.1 * s, 5.5 * s, 2.2 * s);
    g.fillStyle = '#b8923e';
    g.fillRect(-0.6 * s, -2 * s, 1.4 * s, 4 * s);
    g.restore();
  }
  if (o.sword === 'raised') {
    // Blade drawn high in the right hand.
    g.fillStyle = '#e8ecf2';
    poly(g, [
      [X(11 * b), Y(-3)],
      [X(13 * b), Y(-3)],
      [X(23 * b), Y(-26)],
      [X(21.5 * b), Y(-26.5)],
    ]);
    g.fill();
    g.fillStyle = '#b8923e';
    g.fillRect(X(10 * b), Y(-4), 4.6 * s, 1.6 * s);
    g.fillStyle = BONE;
    poly(g, [
      [X(10.4 * b), Y(-3)],
      [X(12.4 * b), Y(-3)],
      [X(11.6 * b), Y(2)],
      [X(9.6 * b), Y(2)],
    ]);
    g.fill();
  }
  if (o.orb) {
    // Kidō in the off hand: a hard white core in a band of its colour.
    g.fillStyle = o.orb;
    g.beginPath();
    g.arc(X(-13 * b), Y(-2), 4.2 * s, 0, TAU);
    g.fill();
    g.fillStyle = '#fff4dc';
    g.beginPath();
    g.arc(X(-13 * b), Y(-2), 2 * s, 0, TAU);
    g.fill();
  }
  // Head: small, pale, under spiky black hair; the eyes in shadow but for two white slits.
  g.fillStyle = '#e6d6c2';
  g.beginPath();
  g.ellipse(X(0), Y(-18.5), 3.6 * s, 4.3 * s, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#0d0e13';
  poly(g, [
    [X(-4.6), Y(-17)],
    [X(-5.6), Y(-21)],
    [X(-7), Y(-23.5)],
    [X(-3.6), Y(-23)],
    [X(-2.6), Y(-26)],
    [X(0), Y(-23.6)],
    [X(2.6), Y(-26.2)],
    [X(3.6), Y(-23)],
    [X(7), Y(-23.4)],
    [X(5.6), Y(-20.6)],
    [X(4.6), Y(-17)],
    [X(2.8), Y(-19.6)],
    [X(0.6), Y(-18.4)],
    [X(-1.6), Y(-19.8)],
    [X(-3.4), Y(-18.6)],
  ]);
  g.fill();
  // The shadow the fringe throws over the eyes, and the eyes themselves.
  g.fillStyle = '#2a2730';
  g.fillRect(X(-3.4), Y(-19), 6.8 * s, 2.2 * s);
  g.fillStyle = '#f4f2ea';
  poly(g, [
    [X(-2.8), Y(-18.6)],
    [X(-0.8), Y(-18.2)],
    [X(-1), Y(-17.5)],
    [X(-2.6), Y(-17.8)],
  ]);
  g.fill();
  poly(g, [
    [X(2.8), Y(-18.6)],
    [X(0.8), Y(-18.2)],
    [X(1), Y(-17.5)],
    [X(2.6), Y(-17.8)],
  ]);
  g.fill();
  if (o.scarf) {
    // Scouts: cloth wound over the lower face, its tail streaming back.
    g.fillStyle = '#2a2140';
    g.fillRect(X(-4), Y(-17), 8 * s, 3.4 * s);
    poly(g, [
      [X(3.4), Y(-16.4)],
      [X(13), Y(-18)],
      [X(16), Y(-12)],
      [X(10), Y(-13.6)],
    ]);
    g.fill();
  }
}

const officer: Draw = (g, w, h) => {
  reaper(g, w / 2 - 1, h / 2 + 2, 1, { sword: 'hip' });
};

const flashScout: Draw = (g, w, h) => {
  reaper(g, w / 2 - 2, h / 2 + 2, 0.92, { scarf: true, sash: '#7a68b8', sword: 'hip' });
};

const caster: Draw = (g, w, h) => {
  reaper(g, w / 2 + 3, h / 2 + 2, 1, { sash: '#d8794a', orb: '#ff8a3c' });
};

const guard: Draw = (g, w, h) => {
  reaper(g, w / 2, h / 2 + 6, 1.45, { broad: 1.35, sash: '#8a8f9c', sword: 'back' });
};

/** Elite: a lieutenant, the white armband on the left arm, blade drawn. */
const seated: Draw = (g, w, h) => {
  const s = 1.32;
  const cx = w / 2 - 5;
  const cy = h / 2 + 7;
  reaper(g, cx, cy, s, { sash: '#c23a4a', sword: 'raised' });
  g.save();
  g.translate(cx - 10 * s, cy - 6 * s);
  g.rotate(0.12);
  g.fillStyle = '#f2f2ee';
  g.fillRect(-4 * s, -1.6 * s, 8 * s, 3.2 * s);
  g.fillStyle = '#20232e';
  g.fillRect(-1.1 * s, -1 * s, 2.2 * s, 2 * s);
  g.restore();
};

// ------------------------------------------- the named characters' kin
// (The named characters themselves are drawn in cast/; what is left here are
// the original designs that stand beside them.)

const SKIN = '#efdcc6';

/** A face: skin, with eyes drawn by the caller. Returns nothing; the head centre is (cx, hy). */
function faceAt(g: Ctx, cx: number, hy: number, s: number, rx = 6, ry = 6.8): void {
  g.fillStyle = SKIN;
  g.beginPath();
  g.ellipse(cx, hy, rx * s, ry * s, 0, 0, TAU);
  g.fill();
}

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

/** An ink wisp (original): a heap of living ink, a cluster of pale eyes, a ragged mouth, dripping as it drifts. */
const inkWisp: Draw = (g, w) => {
  const cx = w / 2;
  const rnd = seeded(4352);
  g.fillStyle = '#0b0b10';
  // The heap: a ragged dome, drips running off its lower rim.
  g.beginPath();
  for (let k = 0; k <= 20; k++) {
    const a = Math.PI + (k / 20) * Math.PI;
    const r = 18 * (0.88 + rnd() * 0.16);
    const x = cx + Math.cos(a) * r;
    const y = 30 + Math.sin(a) * r;
    if (k === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  for (let k = 0; k <= 8; k++) {
    const x = cx + 18 - k * 4.5;
    const drip = k % 2 === 0 ? 6 + rnd() * 10 : 1;
    g.lineTo(x + 1, 30 + drip);
    g.lineTo(x - 1.2, 30 + drip);
  }
  g.closePath();
  g.fill();
  for (const [x, len] of [
    [cx - 9, 9],
    [cx + 4, 14],
    [cx + 12, 7],
  ] as const) {
    g.beginPath();
    g.arc(x, 31 + len, 1.6, 0, TAU);
    g.fill();
  }
  // A cluster of pale eyes, no two the same size.
  for (const [x, y, r] of [
    [cx - 6, 21, 3],
    [cx + 3, 18, 3.6],
    [cx + 10, 23, 2],
    [cx - 11, 26, 1.6],
    [cx + 1, 25, 1.4],
  ] as const) {
    g.fillStyle = '#e8e4f0';
    g.beginPath();
    g.ellipse(x, y, r, r * 0.8, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#0b0b10';
    g.beginPath();
    g.arc(x, y + r * 0.1, r * 0.4, 0, TAU);
    g.fill();
  }
  // A ragged mouth of white teeth.
  g.fillStyle = '#e8e4f0';
  for (let k = 0; k < 6; k++) {
    const x = cx - 7 + k * 2.8;
    poly(g, [
      [x - 1.1, 29],
      [x + 1.1, 29],
      [x, 32 + (k % 2) * 1.4],
    ]);
    g.fill();
  }
};

/** An inkling (original): what an ink wisp splits into, a drop of ink with one eye, fangs and a whip of a tail. */
const inkling: Draw = (g, w) => {
  const cx = w / 2;
  g.fillStyle = '#0b0b10';
  g.beginPath();
  g.moveTo(cx, 4);
  g.quadraticCurveTo(cx + 12, 16, cx + 9, 23);
  g.quadraticCurveTo(cx, 30, cx - 9, 23);
  g.quadraticCurveTo(cx - 12, 16, cx, 4);
  g.fill();
  limb(g, [[cx + 5, 26], [cx + 9, 31], [cx + 14, 31]], 2.6, 1, '#0b0b10');
  g.fillStyle = '#e8e4f0';
  g.beginPath();
  g.ellipse(cx, 16, 4.4, 3.6, 0, 0, TAU);
  g.fill();
  g.fillStyle = H_EYE;
  g.beginPath();
  g.arc(cx, 16.4, 1.8, 0, TAU);
  g.fill();
  g.fillStyle = '#e8e4f0';
  for (const x of [cx - 3, cx, cx + 3]) {
    poly(g, [
      [x - 1, 21.5],
      [x + 1, 21.5],
      [x, 24.6],
    ]);
    g.fill();
  }
};

/** A spirit weaver (original): a tall pale hood with nothing in it but two eyes, long spider fingers trailing threads. */
const weaver: Draw = (g, w) => {
  const cx = w / 2;
  // Threads first, from the fingertips down to the ground.
  g.strokeStyle = '#cfc8e8';
  g.lineWidth = 0.8;
  g.beginPath();
  for (const [x0, x1] of [
    [cx - 17, cx - 22],
    [cx - 15, cx - 13],
    [cx + 17, cx + 22],
    [cx + 15, cx + 13],
  ] as const) {
    g.moveTo(x0, 30);
    g.lineTo(x1, 50);
  }
  g.stroke();
  // Long thin arms and spider fingers.
  for (const d of [-1, 1]) {
    limb(g, [[cx + d * 7, 18], [cx + d * 14, 24], [cx + d * 16, 29]], 2.4, 1.6, '#bdb4d8');
    for (const a of [-0.5, 0, 0.5]) {
      limb(g, [[cx + d * 16, 29], [cx + d * (16 + Math.sin(a) * 3), 29 + Math.cos(a) * 5]], 1.1, 0.8, '#bdb4d8');
    }
  }
  // The robe: a tall hood falling to a ragged hem.
  const robe: [number, number][] = [
    [cx, 3],
    [cx + 7, 12],
    [cx + 10, 30],
    [cx + 12, 46],
    [cx + 6, 43],
    [cx + 2, 47],
    [cx - 3, 43],
    [cx - 8, 47],
    [cx - 12, 45],
    [cx - 10, 30],
    [cx - 7, 12],
  ];
  g.fillStyle = '#c9c1e2';
  poly(g, robe);
  g.fill();
  g.save();
  poly(g, robe);
  g.clip();
  g.fillStyle = '#8f86ad';
  g.fillRect(cx + 2, 0, 14, 50);
  g.restore();
  // The empty hood, two eyes in the dark of it.
  g.fillStyle = '#0b0b10';
  g.beginPath();
  g.ellipse(cx, 14, 4.4, 5.6, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#fff4c8';
  g.fillRect(cx - 2.6, 13, 1.6, 1.2);
  g.fillRect(cx + 1, 13, 1.6, 1.2);
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

/**
 * A spoil of war on the ground: a pointed crest with a laurel and a jewel,
 * drawn pale so the renderer can tint it in the colour of the boss it came from.
 */
const spoilCrest: Draw = (g, w, h) => {
  const cx = w / 2;
  const cy = h / 2 + 1;
  aura(g, cx, cy, w * 0.46, 'rgba(255,255,255,0.3)');
  const face = g.createLinearGradient(cx, cy - 18, cx, cy + 20);
  face.addColorStop(0, '#ffffff');
  face.addColorStop(1, '#c8c8c8');
  g.fillStyle = face;
  g.beginPath();
  g.moveTo(cx - 14, cy - 16);
  g.quadraticCurveTo(cx, cy - 21, cx + 14, cy - 16);
  g.lineTo(cx + 13, cy + 2);
  g.quadraticCurveTo(cx + 10, cy + 14, cx, cy + 20);
  g.quadraticCurveTo(cx - 10, cy + 14, cx - 13, cy + 2);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(40,40,40,0.75)';
  g.lineWidth = 1.4;
  g.stroke();
  // A laurel down both sides
  g.strokeStyle = 'rgba(60,60,60,0.65)';
  g.lineWidth = 1;
  for (const dir of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx + dir * 3, cy + 15);
    g.quadraticCurveTo(cx + dir * 11, cy + 6, cx + dir * 9, cy - 10);
    g.stroke();
    for (let k = 0; k < 4; k++) {
      const y = cy + 10 - k * 6;
      const x = cx + dir * (6 + k * 0.9);
      g.beginPath();
      g.ellipse(x + dir * 2, y, 2.6, 1.2, dir * -0.7, 0, TAU);
      g.stroke();
    }
  }
  // The jewel: a four-pointed star
  g.fillStyle = '#ffffff';
  g.strokeStyle = 'rgba(40,40,40,0.8)';
  g.beginPath();
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU - Math.PI / 2;
    const r = k % 2 === 0 ? 7 : 2.4;
    g.lineTo(cx + Math.cos(a) * r, cy - 2 + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  g.stroke();
};

// ------------------------------------------------------------ Tier Harribel

// ------------------------------------------------------------ Silbern

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

/** A Twelfth Division specimen (original): a bloated thing of stitched green flesh, too many eyes, a fanged slit, a vial on its back. */
const specimen: Draw = (g, w) => {
  const cx = w / 2;
  // The vial on its back, glowing green.
  g.fillStyle = '#2b3a2e';
  g.fillRect(cx + 6, 4, 8, 16);
  g.fillStyle = '#8ef07a';
  g.fillRect(cx + 7.5, 9, 5, 10);
  g.fillStyle = '#d8ffc8';
  g.fillRect(cx + 8.5, 10, 1.6, 7);
  // Stubby clawed legs.
  limb(g, [[cx - 9, 40], [cx - 12, 48]], 4.6, 3.6, '#4d6644');
  limb(g, [[cx + 9, 40], [cx + 12, 48]], 4.6, 3.6, '#4d6644');
  claws(g, cx - 12, 49, Math.PI * 0.6, 3.5);
  claws(g, cx + 12, 49, Math.PI * 0.4, 3.5);
  // The bloated body, lit from one side only.
  g.fillStyle = '#6f8f62';
  g.beginPath();
  g.ellipse(cx, 30, 17, 16, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#4d6644';
  g.beginPath();
  g.ellipse(cx + 6, 32, 11, 14, 0, -Math.PI * 0.5, Math.PI * 0.5);
  g.fill();
  // Stitched seams across the flesh.
  g.strokeStyle = H_INK;
  g.lineWidth = 0.9;
  g.beginPath();
  g.moveTo(cx - 15, 26);
  g.quadraticCurveTo(cx - 2, 20, cx + 14, 25);
  for (let k = 0; k < 7; k++) {
    const x = cx - 13 + k * 4.2;
    const y = 24.6 - Math.sin((k / 6) * Math.PI) * 3;
    g.moveTo(x, y - 1.6);
    g.lineTo(x + 0.8, y + 1.6);
  }
  g.moveTo(cx - 6, 44);
  g.lineTo(cx - 2, 34);
  g.stroke();
  // Eyes: one great one and three small, red irises on yellowed white.
  for (const [x, y, r] of [
    [cx - 4, 30, 5.4],
    [cx + 7, 27, 2.4],
    [cx + 9, 33, 1.8],
    [cx - 11, 33, 2],
  ] as const) {
    g.fillStyle = '#efe9d6';
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
    g.fillStyle = H_EYE;
    g.beginPath();
    g.arc(x + r * 0.15, y, r * 0.5, 0, TAU);
    g.fill();
    g.fillStyle = H_INK;
    g.beginPath();
    g.arc(x + r * 0.15, y, r * 0.22, 0, TAU);
    g.fill();
  }
  // A fanged slit of a mouth.
  g.fillStyle = H_MAW;
  poly(g, [
    [cx - 10, 39],
    [cx + 9, 38],
    [cx + 6, 42],
    [cx - 7, 42.5],
  ]);
  g.fill();
  g.fillStyle = H_BONE;
  for (let k = 0; k < 6; k++) {
    const x = cx - 8.5 + k * 3.2;
    poly(g, [
      [x - 1, 38.8],
      [x + 1, 38.7],
      [x, 41.4],
    ]);
    g.fill();
  }
};

// ------------------------------------------------------------ Wahrwelt

// ------------------------------------------------------------ the Sternritter who stole a bankai

// ------------------------------------------------------------ packing

// ------------------------------------------------------------ Las Noches

/** An Arrancar soldier (original): lanky in the white uniform, dark hair, the jaw of his old mask still on his cheek. */
const numeros: Draw = (g, w, h) => {
  const cx = w / 2 - 1;
  const cy = h / 2 + 2;
  reaper(g, cx, cy, 1, { white: true, sword: 'hip' });
  // What is left of the mask: a jawbone along the left cheek, teeth bared.
  g.fillStyle = H_BONE;
  poly(g, [
    [cx - 4.6, cy - 19.5],
    [cx - 0.4, cy - 16.4],
    [cx + 1.2, cy - 14.2],
    [cx - 3.6, cy - 14],
    [cx - 5.4, cy - 16.4],
  ]);
  g.fill();
  g.fillStyle = H_MAW;
  g.fillRect(cx - 4, cy - 16.2, 4.4, 1);
  g.fillStyle = H_INK;
  for (let k = 0; k < 4; k++) g.fillRect(cx - 3.8 + k * 1.1, cy - 16.6, 0.5, 1.8);
  // The hole, through the chest.
  heartHole(g, cx + 2, cy - 7, 1.3);
};

/** An executioner of the Exequias (original): lanky in the white uniform under a black hood, a skull for a face. */
const exequias: Draw = (g, w, h) => {
  const cx = w / 2;
  const cy = h / 2 + 2;
  // The black hooded cape behind the body.
  g.fillStyle = '#0d0e13';
  poly(g, [
    [cx - 6, cy - 24],
    [cx + 6, cy - 24],
    [cx + 10, cy - 14],
    [cx + 15, cy + 16],
    [cx - 15, cy + 16],
    [cx - 10, cy - 14],
  ]);
  g.fill();
  reaper(g, cx, cy, 1, { white: true, sash: '#6a5a40', sword: 'hip' });
  // The hood over the head, and the skull inside it.
  g.fillStyle = '#0d0e13';
  poly(g, [
    [cx - 6.6, cy - 13],
    [cx - 7, cy - 21],
    [cx - 3, cy - 27],
    [cx + 3, cy - 27],
    [cx + 7, cy - 21],
    [cx + 6.6, cy - 13],
  ]);
  g.fill();
  g.fillStyle = H_BONE;
  g.beginPath();
  g.ellipse(cx, cy - 19, 4.4, 5, 0, 0, TAU);
  g.fill();
  g.fillStyle = H_BONE_SHADE;
  g.fillRect(cx + 1.2, cy - 24, 3.4, 10);
  g.fillStyle = H_INK;
  poly(g, [
    [cx - 3.6, cy - 21],
    [cx - 0.6, cy - 19.6],
    [cx - 1, cy - 18],
    [cx - 3.4, cy - 18.6],
  ]);
  g.fill();
  poly(g, [
    [cx + 3.6, cy - 21],
    [cx + 0.6, cy - 19.6],
    [cx + 1, cy - 18],
    [cx + 3.4, cy - 18.6],
  ]);
  g.fill();
  g.fillRect(cx - 2.6, cy - 16, 5.2, 1.2);
  g.fillStyle = H_BONE;
  for (let k = 0; k < 4; k++) g.fillRect(cx - 2.3 + k * 1.3, cy - 16.2, 0.7, 1.6);
  g.fillStyle = H_EYE;
  g.fillRect(cx - 2.4, cy - 19.6, 1, 1);
  g.fillRect(cx + 1.4, cy - 19.6, 1, 1);
};

/** A Gillian, the lowest of the Menos Grande (original): a towering black shape with a long-nosed white mask. */
const gillian: Draw = (g, w, h) => {
  const cx = w / 2;
  const cy = h / 2 + 6;
  aura(g, cx, cy, 46, 'rgba(255,40,70,0.12)');
  const body = g.createLinearGradient(0, cy - 30, 0, cy + 40);
  body.addColorStop(0, '#2c2238');
  body.addColorStop(1, '#05040a');
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(cx - 14, cy - 24);
  g.lineTo(cx - 24, cy - 16);
  g.lineTo(cx - 20, cy - 10);
  g.lineTo(cx - 28, cy + 2);
  g.lineTo(cx - 22, cy + 6);
  g.lineTo(cx - 26, cy + 40);
  g.lineTo(cx + 26, cy + 40);
  g.lineTo(cx + 22, cy + 6);
  g.lineTo(cx + 28, cy + 2);
  g.lineTo(cx + 20, cy - 10);
  g.lineTo(cx + 24, cy - 16);
  g.lineTo(cx + 14, cy - 24);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(200,180,230,0.25)';
  g.lineWidth = 1;
  g.stroke();
  // The white mask, its long nose pointing down
  g.fillStyle = BONE;
  g.beginPath();
  g.ellipse(cx, cy - 26, 13, 12, 0, 0, TAU);
  g.fill();
  poly(g, [
    [cx - 4, cy - 22],
    [cx + 4, cy - 22],
    [cx, cy - 4],
  ]);
  g.fill();
  g.strokeStyle = 'rgba(60,50,40,0.6)';
  g.stroke();
  g.fillStyle = '#05060a';
  for (const dir of [-1, 1]) {
    g.beginPath();
    g.ellipse(cx + dir * 6, cy - 28, 3.4, 4.2, dir * 0.4, 0, TAU);
    g.fill();
  }
  glowDot(g, cx - 6, cy - 28, 1.2, 1.2, '#ffd0d0', 'rgba(255,60,80,0.9)', 4);
  glowDot(g, cx + 6, cy - 28, 1.2, 1.2, '#ffd0d0', 'rgba(255,60,80,0.9)', 4);
  chestHole(g, cx, cy + 12, 5);
};

// ------------------------------------------------------------ Karakura Town

/** An empty gigai (original): one of Urahara's spare bodies, a jointed mannequin stitched at every seam, nobody inside, reaching for you. */
const gigai: Draw = (g, w) => {
  const cx = w / 2;
  const PALE = '#d9d0c0';
  const SHADE = '#b7ae9e';
  const JOINT = '#8f877a';
  // Legs, knock-kneed, jointed.
  limb(g, [[cx - 3, 30], [cx - 5, 39], [cx - 3, 48]], 3.6, 3, PALE);
  limb(g, [[cx + 3, 30], [cx + 6, 39], [cx + 5, 48]], 3.6, 3, PALE);
  // One arm hanging, one reaching out with its fingers spread.
  limb(g, [[cx - 6, 16], [cx - 10, 25], [cx - 9, 33]], 3.2, 2.6, PALE);
  limb(g, [[cx + 6, 16], [cx + 13, 18], [cx + 20, 15]], 3.2, 2.6, PALE);
  for (const a of [-0.7, -0.2, 0.3]) {
    limb(g, [[cx + 20, 15], [cx + 20 + Math.cos(a) * 4, 15 + Math.sin(a) * 4]], 1.2, 1, PALE);
  }
  // Torso, narrow, a seam stitched down it.
  g.fillStyle = PALE;
  poly(g, [
    [cx - 7, 14],
    [cx + 7, 14],
    [cx + 5, 31],
    [cx - 5, 31],
  ]);
  g.fill();
  g.fillStyle = SHADE;
  poly(g, [
    [cx + 1, 14],
    [cx + 7, 14],
    [cx + 5, 31],
    [cx + 1, 31],
  ]);
  g.fill();
  g.strokeStyle = H_INK;
  g.lineWidth = 0.8;
  g.beginPath();
  g.moveTo(cx, 15);
  g.lineTo(cx, 30);
  for (let y = 16; y < 30; y += 3) {
    g.moveTo(cx - 1.4, y);
    g.lineTo(cx + 1.4, y + 1.2);
  }
  g.stroke();
  // Ball joints.
  g.fillStyle = JOINT;
  for (const [x, y, r] of [
    [cx - 6, 16, 2],
    [cx + 6, 16, 2],
    [cx - 10, 25, 1.6],
    [cx + 13, 18, 1.6],
    [cx - 5, 39, 1.8],
    [cx + 6, 39, 1.8],
  ] as const) {
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  }
  // The head: a blank egg, two holes for eyes, a seam stitched across where a mouth should be.
  g.fillStyle = PALE;
  g.beginPath();
  g.ellipse(cx, 8, 4.6, 5.6, 0, 0, TAU);
  g.fill();
  g.fillStyle = SHADE;
  g.fillRect(cx + 1.6, 3, 3.4, 11);
  g.fillStyle = H_INK;
  g.beginPath();
  g.ellipse(cx - 1.8, 7.4, 1.1, 1.5, 0, 0, TAU);
  g.ellipse(cx + 1.8, 7.4, 1.1, 1.5, 0, 0, TAU);
  g.fill();
  g.strokeStyle = H_INK;
  g.lineWidth = 0.7;
  g.beginPath();
  g.moveTo(cx - 2.6, 11);
  g.lineTo(cx + 2.6, 11);
  for (let k = -2; k <= 2; k++) {
    g.moveTo(cx + k * 1.1, 10.2);
    g.lineTo(cx + k * 1.1, 11.8);
  }
  g.stroke();
};

/** A kidō sentry (original): a seal of light hung in the air, tassels beneath, an eye that tracks you. */
const sentry: Draw = (g, w, h) => {
  const cx = w / 2;
  const cy = h / 2;
  aura(g, cx, cy, 24, 'rgba(255,214,120,0.2)');
  g.save();
  g.strokeStyle = '#ffd27a';
  g.shadowColor = 'rgba(255,190,80,0.9)';
  g.shadowBlur = 6;
  g.lineWidth = 1.6;
  g.beginPath();
  g.arc(cx, cy, 13, 0, TAU);
  g.stroke();
  g.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU - Math.PI / 2;
    const x = cx + Math.cos(a) * 13;
    const y = cy + Math.sin(a) * 13;
    if (k % 2 === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
    const b = ((k + 2) / 6) * TAU - Math.PI / 2;
    g.lineTo(cx + Math.cos(b) * 13, cy + Math.sin(b) * 13);
  }
  g.stroke();
  g.restore();
  g.strokeStyle = 'rgba(255,214,120,0.7)';
  g.lineWidth = 1;
  for (const dx of [-6, 0, 6]) {
    g.beginPath();
    g.moveTo(cx + dx, cy + 13);
    g.lineTo(cx + dx * 1.2, cy + 22);
    g.stroke();
  }
  glowDot(g, cx, cy, 4, 3, '#fff6d8', 'rgba(255,190,80,0.95)', 8);
  g.fillStyle = '#3a2a10';
  g.beginPath();
  g.arc(cx, cy, 1.6, 0, TAU);
  g.fill();
};

const ENEMY_DRAW: readonly [string, number, Draw][] = [
  ['ayon', 184, hueco.ayon],
  ['ayon_rage', 200, hueco.ayonRage],
  ['nel', 112, hueco.nel],
  ['nel_gamuza', 140, hueco.nelGamuza],
  ['bearer', 104, wand.bearer],
  ['brute', 76, brute],
  ['adjuchas', 72, adjuchas],
  ['hollow', 52, hollow],
  ['cero', 60, ceroHollow],
  ['volatile', 52, volatile],
  ['hound', 48, hound],
  ['unohana', 112, gotei.unohana],
  ['unohana_kenpachi', 112, gotei.unohanaKenpachi],
  ['guard', 84, guard],
  ['seated', 72, seated],
  ['officer', 52, officer],
  ['caster', 52, caster],
  ['flash', 48, flashScout],
  ['cap_senbonzakura', 112, gotei.byakuya],
  ['cap_hyorinmaru', 112, gotei.hitsugaya],
  ['cap_raikoben', 112, gotei.soifon],
  ['cap_tengen', 136, gotei.komamura],
  ['cap_gonryo', 112, gotei.sasakibe],
  ['commander', 128, gotei.yamamoto],
  ['ashen', 52, ashen],
  ['rift', 96, rift],
  ['sentinel', 60, sentinel],
  ['inkwisp', 52, inkWisp],
  ['inkling', 36, inkling],
  ['weaver', 52, weaver],
  ['asauchi', 48, asauchi],
  ['attendant', 72, attendant],
  ['royal_tenjiro', 112, royal.tenjiro],
  ['royal_kirio', 136, royal.kirio],
  ['royal_kirio_slim', 112, royal.kirioSlim],
  ['royal_oetsu', 112, royal.oetsu],
  ['royal_senjumaru', 120, royal.senjumaru],
  ['ichibe', 144, royal.ichibe],
  ['harribel', 128, hueco.harribel],
  ['harribel_tiburon', 144, hueco.harribelReleased],
  ['brawler', 52, brawler],
  ['specimen', 56, specimen],
  ['gotei_kenpachi', 120, gotei.kenpachi],
  ['gotei_mayuri', 112, gotei.mayuri],
  ['gotei_shinji', 112, gotei.shinji],
  ['gotei_kensei', 112, gotei.kensei],
  ['kyoraku', 128, gotei.kyoraku],
  ['jizo', 128, gotei.jizo],
  ['heroes_renji', 120, heroes.renji],
  ['heroes_renji_bankai', 132, heroes.renjiBankai],
  ['heroes_rukia', 104, heroes.rukia],
  ['heroes_rukia_bankai', 112, heroes.rukiaBankai],
  ['heroes_uryu', 112, heroes.uryu],
  ['heroes_aizen', 112, heroes.aizen],
  ['ichigo', 120, heroes.ichigo],
  ['numeros', 52, numeros],
  ['exequias', 52, exequias],
  ['gillian', 96, gillian],
  ['arrancar_rudbornn', 112, hueco.rudbornn],
  ['arrancar_rudbornn_late', 136, hueco.rudbornnArbol],
  ['arrancar_dordoni', 112, hueco.dordoni],
  ['arrancar_dordoni_late', 128, hueco.dordoniGiralda],
  ['arrancar_cirucci', 104, hueco.cirucci],
  ['arrancar_cirucci_late', 132, hueco.cirucciGolondrina],
  ['arrancar_gantenbainne', 116, hueco.gantenbainne],
  ['arrancar_gantenbainne_late', 116, hueco.gantenDragra],
  ['grimmjow', 116, hueco.grimmjow],
  ['grimmjow_pantera', 132, hueco.grimmjowPantera],
  ['pesche', 68, hueco.pesche],
  ['gigai', 52, gigai],
  ['sentry', 52, sentry],
  ['karakura_chad', 124, heroes.chad],
  ['karakura_chad_late', 124, heroes.chadLate],
  ['karakura_orihime', 104, heroes.orihime],
  ['karakura_orihime_late', 112, heroes.orihimeLate],
  ['karakura_yoruichi', 108, heroes.yoruichi],
  ['karakura_yoruichi_late', 108, heroes.yoruichiLate],
  ['karakura_isshin', 116, heroes.isshin],
  ['karakura_isshin_late', 116, heroes.isshinLate],
  ['urahara', 116, heroes.urahara],
  ['urahara_bankai', 140, heroes.uraharaBankai],
  ['kanonji', 68, heroes.kanonji],
  ['ichigo_mask', 128, heroes.ichigoMask],
  ['thief_senbonzakura', 112, wand.thiefFear],
  ['thief_hyorinmaru', 112, wand.thiefIron],
  ['thief_raikoben', 116, wand.thiefKnowledge],
  ['thief_tengen', 104, wand.thiefExplode],
  ['thief_gonryo', 124, wand.thiefOverkill],
  ['ganju', 68, heroes.ganju],
  ['kon', 52, heroes.kon],
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
    { name: 'spoil', w: 44, h: 48, draw: spoilCrest },
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
  const g = canvas.getContext('2d', { willReadFrequently: true });
  if (!g) throw new Error('Canvas 2D is not available');
  const rects: InkRect[] = [];
  list.forEach((s, i) => {
    g.save();
    g.translate(pos[i].x, pos[i].y);
    g.beginPath();
    g.rect(0, 0, s.w, s.h);
    g.clip();
    s.draw(g, s.w, s.h);
    g.restore();
    rects.push({ x: pos[i].x, y: pos[i].y, w: s.w, h: s.h, ...inkOf(s.name, s.w) });
  });
  inkRects(g, W, Math.min(H, y + rowH + pad), rects);
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
export function drawSprite(canvas: HTMLCanvasElement, name: string, cssWidth: number, ratio = Math.min(window.devicePixelRatio || 1, 3), face = false): boolean {
  const spec = specs().find((s) => s.name === name);
  const g = spec ? canvas.getContext('2d') : null;
  if (!spec || !g) return false;
  const crop = face ? faceRect(name, spec.w, spec.h) : null;
  if (crop) {
    // Head and shoulders only, filling a square canvas.
    const q = (cssWidth * ratio) / crop.size;
    canvas.width = canvas.height = Math.round(cssWidth * ratio);
    g.setTransform(q, 0, 0, q, -crop.x * q, -crop.y * q);
    spec.draw(g, spec.w, spec.h);
    const ink = inkOf(spec.name, spec.w);
    inkCanvas(canvas, ink.kind, ink.line * q);
    return true;
  }
  const k = (cssWidth / spec.w) * ratio;
  canvas.width = Math.round(spec.w * k);
  canvas.height = Math.round(spec.h * k);
  g.scale(k, k);
  spec.draw(g, spec.w, spec.h);
  const ink = inkOf(spec.name, spec.w);
  inkCanvas(canvas, ink.kind, ink.line * k);
  return true;
}

/**
 * Where each manga figure's head and shoulders sit, in its 100-unit design
 * box: x from the centre line, y, and half the crop's size. A lanky figure's
 * face is too small to read whole at portrait size, so the HUD shows this.
 */
const FACE_DEFAULT = [0, 19, 15] as const;
const FACE: Readonly<Record<string, readonly [number, number, number] | null>> = {
  bearer: FACE_DEFAULT,
  thief_senbonzakura: [0, 18, 16],
  thief_hyorinmaru: FACE_DEFAULT,
  thief_raikoben: [0, 16, 15],
  thief_tengen: [0, 20, 15],
  thief_gonryo: [0, 19, 15],
  cap_senbonzakura: [0, 19, 15],
  cap_hyorinmaru: [0, 31, 15],
  cap_raikoben: [-1, 20, 15],
  cap_tengen: [1, 17, 18],
  cap_gonryo: [-2, 19, 15],
  commander: [0, 20, 16],
  unohana: FACE_DEFAULT,
  unohana_kenpachi: FACE_DEFAULT,
  gotei_kenpachi: [0, 17, 18],
  gotei_mayuri: [3, 17, 16],
  gotei_shinji: FACE_DEFAULT,
  gotei_kensei: [0, 18, 15],
  kyoraku: [0, 16, 18],
  jizo: [-23, 46, 21],
  ayon: [0, 22, 20],
  ayon_rage: [0, 22, 20],
  nel: [0, 16, 17],
  nel_gamuza: [-6, 15, 19],
  harribel: FACE_DEFAULT,
  harribel_tiburon: [0, 20, 15],
  arrancar_rudbornn: [0, 14, 18],
  arrancar_rudbornn_late: [0, 14, 18],
  arrancar_dordoni: [0, 18, 15],
  arrancar_dordoni_late: [0, 17, 17],
  arrancar_cirucci: [0, 26, 15],
  arrancar_cirucci_late: [0, 26, 16],
  arrancar_gantenbainne: [0, 19, 16],
  arrancar_gantenbainne_late: [0, 17, 17],
  grimmjow: [0, 18, 15],
  grimmjow_pantera: [-4, 23, 15],
  royal_tenjiro: [0, 18, 18],
  royal_kirio: [0, 18, 19],
  royal_kirio_slim: FACE_DEFAULT,
  royal_oetsu: FACE_DEFAULT,
  royal_senjumaru: [0, 20, 18],
  ichibe: [0, 24, 22],
  heroes_renji: [0, 16, 17],
  heroes_renji_bankai: [0, 18, 18],
  heroes_rukia: [0, 27, 14],
  heroes_rukia_bankai: [0, 25, 15],
  heroes_uryu: FACE_DEFAULT,
  heroes_aizen: FACE_DEFAULT,
  ichigo: [0, 18, 16],
  ichigo_mask: [0, 18, 16],
  karakura_chad: [0, 19, 16],
  karakura_chad_late: [0, 19, 16],
  karakura_orihime: FACE_DEFAULT,
  karakura_orihime_late: [0, 19, 16],
  karakura_yoruichi: [0, 18, 16],
  karakura_yoruichi_late: [-2, 22, 18],
  karakura_isshin: FACE_DEFAULT,
  karakura_isshin_late: FACE_DEFAULT,
  urahara: FACE_DEFAULT,
  urahara_bankai: [2, 20, 20],
};

/** The face crop of a sprite in its own pixels, or null for art drawn whole (the swarm, the runaways). */
export function faceRect(name: string, w: number, h: number): { x: number; y: number; size: number } | null {
  const f = FACE[name];
  if (!f) return null;
  const k = h / 100;
  const size = f[2] * 2 * k;
  return { x: w / 2 + f[0] * k - size / 2, y: f[1] * k - size / 2, size };
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
  const layer = (c: Ctx, draw: Draw, x: number, y: number, w: number, h: number): void => {
    c.save();
    c.translate(x, y);
    draw(c, w, h);
    c.restore();
  };
  // Shadow and wings are effects (hard bands); the Emperor himself is a figure with an ink line, inked on his own layer.
  if (tier >= 3) layer(g, evoShadow, hx + 30 - 56, hy + 40 - 56, 112, 112);
  if (tier >= 1) layer(g, evoWings, hx + 30 - 60, hy + 30 - 30, 120, 60);
  if (tier >= 1) inkCanvas(canvas, 'fx');
  const body = document.createElement('canvas');
  body.width = canvas.width;
  body.height = canvas.height;
  const b = body.getContext('2d', { willReadFrequently: true });
  if (!b) return;
  b.scale(k, k);
  layer(b, heroDraw(HERO_LOOKS[look] ?? HERO_LOOKS.default), hx, hy, 60, 72);
  if (tier >= 2) layer(b, evoEyes, hx, hy, 60, 72);
  if (tier >= 3) layer(b, evoPupils, hx, hy, 60, 72);
  inkCanvas(body, 'figure', 2.5 * k);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(body, 0, 0);
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
  else if (stage === 'lasnoches') lasnochesGround(g, S);
  else if (stage === 'karakura') karakuraGround(g, S);
  else huecoGround(g, S);
  const tex = Texture.from(c);
  tex.source.addressMode = 'repeat';
  return tex;
}
