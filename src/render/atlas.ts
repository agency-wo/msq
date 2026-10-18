import { Rectangle, Texture } from 'pixi.js';

/**
 * All game art is drawn here with Canvas 2D at startup and packed into one
 * texture, so the whole game renders from a single texture source (which is
 * what lets Pixi's ParticleContainer batch thousands of sprites) and nothing
 * is downloaded. Every design is original.
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

/** Jagged lightning segment, stretched between two points. */
const bolt: Draw = (g, w, h) => {
  let seed = 7;
  const rnd = (): number => (seed = (seed * 16807) % 2147483647) / 2147483647;
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

/** Arrow of light pointing along +x. */
const arrow: Draw = (g, w, h) => {
  const cy = h / 2;
  const trail = g.createLinearGradient(0, 0, w, 0);
  trail.addColorStop(0, 'rgba(110,190,255,0)');
  trail.addColorStop(1, 'rgba(140,210,255,0.6)');
  g.fillStyle = trail;
  g.beginPath();
  g.moveTo(2, cy);
  g.lineTo(w - 12, cy - 6);
  g.lineTo(w - 12, cy + 6);
  g.closePath();
  g.fill();
  g.strokeStyle = '#ffffff';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(12, cy);
  g.lineTo(w - 12, cy);
  g.stroke();
  g.fillStyle = '#eef9ff';
  g.beginPath();
  g.moveTo(w - 1, cy);
  g.lineTo(w - 17, cy - 6);
  g.lineTo(w - 12, cy);
  g.lineTo(w - 17, cy + 6);
  g.closePath();
  g.fill();
};

/** Golden crescent blade. */
const blade: Draw = (g, w) => {
  const c = w / 2;
  g.save();
  g.translate(c, c);
  const grad = g.createLinearGradient(-c, -c, c, c);
  grad.addColorStop(0, '#fff7dc');
  grad.addColorStop(1, '#ffc23d');
  g.fillStyle = grad;
  g.shadowColor = 'rgba(255,205,110,0.95)';
  g.shadowBlur = 7;
  g.beginPath();
  g.arc(0, 0, c - 5, -Math.PI * 0.85, Math.PI * 0.35);
  g.arc(4, -3, c - 9, Math.PI * 0.35, -Math.PI * 0.85, true);
  g.closePath();
  g.fill();
  g.restore();
};

const shard: Draw = (g, w, h) => {
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(w - 1, h / 2);
  g.lineTo(2, 2);
  g.lineTo(5, h / 2);
  g.lineTo(2, h - 2);
  g.closePath();
  g.fill();
};

const pointer: Draw = (g, w, h) => {
  g.save();
  g.shadowColor = 'rgba(255,255,255,0.8)';
  g.shadowBlur = 5;
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(w - 3, h / 2);
  g.lineTo(5, 4);
  g.lineTo(10, h / 2);
  g.lineTo(5, h - 4);
  g.closePath();
  g.fill();
  g.restore();
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

function gem(top: string, bottom: string): Draw {
  return (g, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bottom);
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(cx, 1);
    g.lineTo(w - 3, cy);
    g.lineTo(cx, h - 1);
    g.lineTo(3, cy);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = 1.2;
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.beginPath();
    g.moveTo(cx, 4);
    g.lineTo(cx + 4, cy - 1);
    g.lineTo(cx, cy);
    g.closePath();
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
    g.strokeStyle = 'rgba(0,0,0,0.8)';
    g.strokeText(ch, w / 2, h / 2 + 1);
    g.fillStyle = '#ffffff';
    g.fillText(ch, w / 2, h / 2 + 1);
  };
}

// ------------------------------------------------------------- the hero

/** The Emperor: a hooded figure in white and gold with a floating halo. Faces right. */
const hero: Draw = (g, w) => {
  const cx = w / 2;
  // Cape
  g.fillStyle = '#1d2a52';
  g.beginPath();
  g.moveTo(cx - 11, 28);
  g.quadraticCurveTo(cx - 25, 52, cx - 21, 70);
  g.lineTo(cx + 21, 70);
  g.quadraticCurveTo(cx + 25, 52, cx + 11, 28);
  g.closePath();
  g.fill();
  g.strokeStyle = '#d9b45a';
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(cx - 21, 69.5);
  g.lineTo(cx + 21, 69.5);
  g.stroke();
  // Robe
  const robe = g.createLinearGradient(0, 28, 0, 66);
  robe.addColorStop(0, '#ffffff');
  robe.addColorStop(1, '#c6cfe4');
  g.fillStyle = robe;
  g.beginPath();
  g.moveTo(cx - 9, 30);
  g.quadraticCurveTo(cx - 15, 50, cx - 14, 66);
  g.lineTo(cx + 14, 66);
  g.quadraticCurveTo(cx + 15, 50, cx + 9, 30);
  g.closePath();
  g.fill();
  // Sleeves
  g.fillStyle = '#e6ebf6';
  g.beginPath();
  g.ellipse(cx - 12, 43, 4, 9, 0.3, 0, TAU);
  g.fill();
  g.beginPath();
  g.ellipse(cx + 12, 43, 4, 9, -0.3, 0, TAU);
  g.fill();
  // Gold trim
  g.fillStyle = '#d9b45a';
  g.fillRect(cx - 1.5, 34, 3, 32);
  g.fillRect(cx - 14, 62, 28, 2.5);
  // Hood
  const hood = g.createRadialGradient(cx - 3, 15, 2, cx, 22, 15);
  hood.addColorStop(0, '#ffffff');
  hood.addColorStop(1, '#d2d9e8');
  g.fillStyle = hood;
  g.beginPath();
  g.moveTo(cx, 7);
  g.bezierCurveTo(cx + 13, 8, cx + 15, 26, cx + 11, 34);
  g.lineTo(cx - 11, 34);
  g.bezierCurveTo(cx - 15, 26, cx - 13, 8, cx, 7);
  g.closePath();
  g.fill();
  // Shadowed face, set toward the facing side, with two pale eyes
  g.fillStyle = '#0a0e1a';
  g.beginPath();
  g.ellipse(cx + 3, 23, 6.5, 8, 0, 0, TAU);
  g.fill();
  glowDot(g, cx + 1.6, 22.4, 1.2, 1.2, '#d4f5ff', '#6fd6ff');
  glowDot(g, cx + 6.2, 22.4, 1.2, 1.2, '#d4f5ff', '#6fd6ff');
  // Halo
  g.save();
  g.strokeStyle = '#ffd979';
  g.shadowColor = '#ffcf5a';
  g.shadowBlur = 6;
  g.lineWidth = 2.2;
  g.beginPath();
  g.ellipse(cx, 4.5, 10, 3, 0, 0, TAU);
  g.stroke();
  g.restore();
};

// -------------------------------------------------------------- enemies

const wisp: Draw = (g, w, h) => {
  const cx = w / 2;
  const cy = h / 2 + 4;
  aura(g, cx, cy, 24, 'rgba(160,120,255,0.28)');
  const grad = g.createRadialGradient(cx - 5, cy - 7, 2, cx, cy, 20);
  grad.addColorStop(0, '#b79bff');
  grad.addColorStop(0.55, '#5b3bb0');
  grad.addColorStop(1, '#22134a');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(cx, cy - 22);
  g.bezierCurveTo(cx + 5, cy - 14, cx + 19, cy - 9, cx + 18, cy + 4);
  g.bezierCurveTo(cx + 17, cy + 17, cx - 17, cy + 17, cx - 18, cy + 4);
  g.bezierCurveTo(cx - 19, cy - 9, cx - 5, cy - 14, cx, cy - 22);
  g.closePath();
  g.fill();
  glowDot(g, cx - 6, cy + 2, 2.8, 3.8, '#fff1ff', '#ff9bf0');
  glowDot(g, cx + 6, cy + 2, 2.8, 3.8, '#fff1ff', '#ff9bf0');
};

const runner: Draw = (g, w, h) => {
  const cx = w / 2;
  const cy = h / 2;
  aura(g, cx, cy, 20, 'rgba(80,240,200,0.24)');
  const grad = g.createRadialGradient(cx - 4, cy - 5, 2, cx, cy, 17);
  grad.addColorStop(0, '#9bffe6');
  grad.addColorStop(0.6, '#1f9c86');
  grad.addColorStop(1, '#0b3a35');
  g.fillStyle = grad;
  g.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU - Math.PI / 2;
    const r = k % 2 ? 9 : 17;
    g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  glowDot(g, cx, cy + 1, 5.5, 2.2, '#f4fffb', '#7dffe0');
};

function horn(g: Ctx, x: number, y: number, dir: number): void {
  g.beginPath();
  g.moveTo(x - 6 * dir, y + 8);
  g.quadraticCurveTo(x + 2 * dir, y - 4, x + 10 * dir, y - 12);
  g.quadraticCurveTo(x + 5 * dir, y + 2, x + 6 * dir, y + 10);
  g.closePath();
  g.fill();
}

const brute: Draw = (g, w, h) => {
  const cx = w / 2;
  const cy = h / 2 + 4;
  aura(g, cx, cy, 34, 'rgba(255,80,80,0.22)');
  g.fillStyle = '#e9dcc8';
  horn(g, cx - 14, cy - 20, -1);
  horn(g, cx + 14, cy - 20, 1);
  const grad = g.createRadialGradient(cx - 8, cy - 10, 3, cx, cy, 30);
  grad.addColorStop(0, '#ff8a7a');
  grad.addColorStop(0.55, '#a3242c');
  grad.addColorStop(1, '#3a0c12');
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(cx, cy, 28, 26, 0, 0, TAU);
  g.fill();
  g.save();
  g.fillStyle = '#fff4d6';
  g.shadowColor = '#ffcf70';
  g.shadowBlur = 6;
  g.beginPath();
  g.moveTo(cx - 16, cy - 5);
  g.lineTo(cx - 4, cy);
  g.lineTo(cx - 13, cy + 3);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(cx + 16, cy - 5);
  g.lineTo(cx + 4, cy);
  g.lineTo(cx + 13, cy + 3);
  g.closePath();
  g.fill();
  g.restore();
  g.strokeStyle = 'rgba(20,0,0,0.7)';
  g.lineWidth = 2.5;
  g.beginPath();
  g.arc(cx, cy + 15, 7, Math.PI * 1.15, Math.PI * 1.85);
  g.stroke();
};

const bomber: Draw = (g, w, h) => {
  const cx = w / 2;
  const cy = h / 2 + 2;
  aura(g, cx, cy, 24, 'rgba(255,150,60,0.3)');
  const grad = g.createRadialGradient(cx - 5, cy - 6, 2, cx, cy, 19);
  grad.addColorStop(0, '#6a4a3a');
  grad.addColorStop(1, '#1f1410');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(cx, cy, 18, 0, TAU);
  g.fill();
  g.save();
  g.strokeStyle = '#ffb347';
  g.shadowColor = '#ff8a1f';
  g.shadowBlur = 8;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(cx - 10, cy - 8);
  g.lineTo(cx - 3, cy - 1);
  g.lineTo(cx - 8, cy + 6);
  g.moveTo(cx + 9, cy - 9);
  g.lineTo(cx + 3, cy + 1);
  g.lineTo(cx + 10, cy + 8);
  g.moveTo(cx - 2, cy + 11);
  g.lineTo(cx + 2, cy + 4);
  g.stroke();
  g.fillStyle = '#ffe2a8';
  g.beginPath();
  g.arc(cx, cy, 4, 0, TAU);
  g.fill();
  g.fillStyle = '#ffd36b';
  g.beginPath();
  g.arc(cx + 7, cy - 19, 3, 0, TAU);
  g.fill();
  g.restore();
};

/** Boss: a storm of shadow with a crown of five spikes and three eyes. */
const warden: Draw = (g, w, h) => {
  const cx = w / 2;
  const cy = h / 2 + 8;
  aura(g, cx, cy, 82, 'rgba(190,120,255,0.26)');
  const grad = g.createRadialGradient(cx - 18, cy - 22, 8, cx, cy, 70);
  grad.addColorStop(0, '#a77bff');
  grad.addColorStop(0.5, '#3f2380');
  grad.addColorStop(1, '#140a2c');
  g.fillStyle = grad;
  g.beginPath();
  const lobes = 9;
  for (let k = 0; k < lobes; k++) {
    const a = (k / lobes) * TAU;
    const lx = cx + Math.cos(a) * 46;
    const ly = cy + Math.sin(a) * 40;
    g.moveTo(lx + 22, ly);
    g.arc(lx, ly, 22, 0, TAU);
  }
  g.moveTo(cx + 52, cy);
  g.arc(cx, cy, 52, 0, TAU);
  g.fill();
  g.save();
  g.fillStyle = '#e6d4ff';
  g.shadowColor = '#c9a4ff';
  g.shadowBlur = 10;
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k - 2) * 0.36;
    const bx = cx + Math.cos(a) * 46;
    const by = cy + Math.sin(a) * 42;
    const tx = cx + Math.cos(a) * 80;
    const ty = cy + Math.sin(a) * 76;
    const nx = -Math.sin(a) * 7;
    const ny = Math.cos(a) * 7;
    g.beginPath();
    g.moveTo(bx + nx, by + ny);
    g.lineTo(tx, ty);
    g.lineTo(bx - nx, by - ny);
    g.closePath();
    g.fill();
  }
  g.restore();
  glowDot(g, cx - 20, cy, 4.8, 6, '#ffe8ff', '#ff7ae8', 12);
  glowDot(g, cx + 20, cy, 4.8, 6, '#ffe8ff', '#ff7ae8', 12);
  glowDot(g, cx, cy - 16, 5.6, 7, '#ffe8ff', '#ff7ae8', 12);
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
  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.beginPath();
  g.ellipse(cx - 5, 12, 2.5, 1.6, -0.6, 0, TAU);
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

// ------------------------------------------------------------ packing

const ENEMY_DRAW: readonly [string, number, Draw][] = [
  ['warden', 176, warden],
  ['brute', 76, brute],
  ['wisp', 52, wisp],
  ['bomber', 52, bomber],
  ['runner', 44, runner],
];

function specs(): Spec[] {
  const list: Spec[] = [
    { name: 'beam', w: 40, h: 200, draw: beam },
    { name: 'ring', w: 128, h: 128, draw: ring },
    { name: 'player', w: 60, h: 72, draw: hero },
    { name: 'player_f', w: 60, h: 72, draw: flash(hero) },
    { name: 'glow', w: 64, h: 64, draw: glow },
    { name: 'disc', w: 64, h: 64, draw: disc },
    { name: 'bolt', w: 128, h: 24, draw: bolt },
    { name: 'arrow', w: 56, h: 20, draw: arrow },
    { name: 'blade', w: 40, h: 40, draw: blade },
    { name: 'shadow', w: 48, h: 20, draw: shadow },
    { name: 'chest', w: 44, h: 38, draw: chest('#6b3f1f', '#8a5429', '#e2b552', 'rgba(255,200,90,0.35)') },
    { name: 'chestBlack', w: 44, h: 38, draw: chest('#1b1426', '#2b2140', '#f0c869', 'rgba(200,120,255,0.5)') },
    { name: 'heart', w: 32, h: 32, draw: heart },
    { name: 'magnet', w: 36, h: 36, draw: magnet },
    { name: 'nuke', w: 36, h: 36, draw: nuke },
    { name: 'pointer', w: 28, h: 28, draw: pointer },
    { name: 'spark', w: 24, h: 24, draw: spark },
    { name: 'orb0', w: 22, h: 22, draw: gem('#8fd0ff', '#1b4fb0') },
    { name: 'orb1', w: 22, h: 22, draw: gem('#ffcf7a', '#b0521b') },
    { name: 'orb2', w: 22, h: 22, draw: gem('#e3a8ff', '#5a1fa8') },
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

/** 512 px tile covering 256 world units: dark stone with a faint lattice. */
export function buildGroundTile(): Texture {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  if (!g) throw new Error('Canvas 2D is not available');
  g.fillStyle = '#0b0e16';
  g.fillRect(0, 0, S, S);
  let seed = 1234;
  const rnd = (): number => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = `rgba(120,140,190,${(0.02 + rnd() * 0.05).toFixed(3)})`;
    const s = 1 + rnd() * 3;
    g.fillRect(rnd() * S, rnd() * S, s, s);
  }
  g.strokeStyle = 'rgba(95,115,180,0.08)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(0, S / 2);
  g.lineTo(S / 2, 0);
  g.lineTo(S, S / 2);
  g.lineTo(S / 2, S);
  g.closePath();
  g.stroke();
  g.strokeStyle = 'rgba(95,115,180,0.05)';
  g.beginPath();
  g.arc(S / 2, S / 2, 46, 0, TAU);
  g.stroke();
  for (const [px, py] of [
    [0, 0],
    [S, 0],
    [0, S],
    [S, S],
  ] as const) {
    g.beginPath();
    g.arc(px, py, 46, 0, TAU);
    g.stroke();
  }
  const tex = Texture.from(c);
  tex.source.addressMode = 'repeat';
  return tex;
}
