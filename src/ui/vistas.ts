import type { StageId } from '../data/stages';

/**
 * Small painted views of each stage for the stage cards on the title screen:
 * Hueco Mundo's crescent moon over white dunes and the dome of Las Noches,
 * the Seireitei's walls and tiled roofs under a low moon. Canvas 2D, drawn
 * once per card at the device's pixel ratio.
 */

type Ctx = CanvasRenderingContext2D;
type Paint = (g: Ctx, w: number, h: number) => void;

const TAU = Math.PI * 2;

function seeded(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function stars(g: Ctx, w: number, h: number, n: number, rnd: () => number): void {
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(220,230,255,${(0.2 + rnd() * 0.6).toFixed(2)})`;
    const s = rnd() < 0.85 ? 0.8 : 1.4;
    g.fillRect(rnd() * w, rnd() * h, s, s);
  }
}

function halo(g: Ctx, x: number, y: number, r: number, rgb: string, a: number): void {
  const grad = g.createRadialGradient(x, y, r * 0.2, x, y, r);
  grad.addColorStop(0, `rgba(${rgb},${a})`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

/** A rolling line across the card, filled down to the bottom; the top edge can catch the light. */
function ridge(g: Ctx, w: number, h: number, y: number, amp: number, seed: number, fill: string, rim?: string): void {
  const rnd = seeded(seed);
  const ph = rnd() * TAU;
  const f = (1.1 + rnd()) * (TAU / w);
  const at = (x: number): number => y + Math.sin(x * f + ph) * amp + Math.sin(x * f * 2.3 + ph * 1.7) * amp * 0.35;
  g.beginPath();
  g.moveTo(0, h);
  for (let x = 0; x <= w; x += 4) g.lineTo(x, at(x));
  g.lineTo(w, h);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  if (!rim) return;
  g.beginPath();
  g.moveTo(0, at(0));
  for (let x = 4; x <= w; x += 4) g.lineTo(x, at(x));
  g.strokeStyle = rim;
  g.lineWidth = 1;
  g.stroke();
}

/** A dead white tree of Hueco Mundo: a trunk that forks three times. */
function tree(g: Ctx, x: number, y: number, size: number, rnd: () => number): void {
  g.strokeStyle = 'rgba(232,238,250,0.8)';
  g.lineCap = 'round';
  const branch = (x0: number, y0: number, len: number, ang: number, width: number, depth: number): void => {
    const x1 = x0 + Math.cos(ang) * len;
    const y1 = y0 + Math.sin(ang) * len;
    g.lineWidth = width;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
    if (depth <= 0) return;
    branch(x1, y1, len * 0.7, ang - 0.45 - rnd() * 0.35, width * 0.62, depth - 1);
    branch(x1, y1, len * 0.7, ang + 0.45 + rnd() * 0.35, width * 0.62, depth - 1);
  };
  branch(x, y, size * 0.5, -Math.PI / 2 + (rnd() - 0.5) * 0.2, 1.8, 3);
}

const hueco: Paint = (g, w, h) => {
  const rnd = seeded(7);
  const horizon = h * 0.62;
  const sky = g.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#03050b');
  sky.addColorStop(1, '#18233f');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  stars(g, w, horizon * 0.9, 40, rnd);
  // The crescent: a lit disc with a bite of the sky's own gradient taken out of it.
  const mx = w * 0.76;
  const my = h * 0.28;
  const R = h * 0.15;
  halo(g, mx, my, R * 3.4, '190,220,255', 0.3);
  g.save();
  g.beginPath();
  g.arc(mx, my, R, 0, TAU);
  g.clip();
  g.fillStyle = '#f4f7ff';
  g.fillRect(mx - R, my - R, R * 2, R * 2);
  g.fillStyle = sky;
  g.beginPath();
  g.arc(mx + R * 0.45, my - R * 0.2, R * 0.92, 0, TAU);
  g.fill();
  g.restore();
  // Las Noches: a pale dome with thin towers on the horizon.
  g.fillStyle = 'rgba(206,214,232,0.2)';
  g.beginPath();
  g.ellipse(w * 0.3, horizon + 2, w * 0.2, h * 0.17, 0, Math.PI, TAU);
  g.fill();
  for (const [x, th] of [
    [0.13, 0.22],
    [0.19, 0.31],
    [0.41, 0.27],
    [0.47, 0.18],
  ] as const) {
    g.fillRect(w * x - 1.5, horizon - h * th, 3, h * th);
  }
  ridge(g, w, h, horizon + 2, 3, 3, '#141a2a');
  ridge(g, w, h, horizon + 15, 5, 5, '#1e2538', 'rgba(220,230,250,0.2)');
  ridge(g, w, h, horizon + 29, 6, 9, '#2b3347', 'rgba(236,240,252,0.4)');
  tree(g, w * 0.1, h * 0.95, 30, rnd);
  tree(g, w * 0.9, h * 0.98, 22, rnd);
  // Bone shards in the near sand.
  g.fillStyle = 'rgba(236,232,222,0.55)';
  for (let i = 0; i < 6; i++) g.fillRect(w * (0.2 + rnd() * 0.6), h * (0.86 + rnd() * 0.1), 3 + rnd() * 3, 1.2);
};

/** One row of white walls under dark tiled roofs with upturned eaves; a few windows lit. */
function roofs(g: Ctx, w: number, base: number, s: number, rnd: () => number, wall: string, roof: string, lit: number): void {
  let x = -rnd() * 20 * s;
  while (x < w) {
    const bw = (26 + rnd() * 22) * s;
    const wh = (7 + rnd() * 5) * s;
    g.fillStyle = wall;
    g.fillRect(x, base - wh, bw, wh + 60);
    const top = base - wh;
    const rh = (5 + rnd() * 4) * s;
    g.fillStyle = roof;
    g.beginPath();
    g.moveTo(x - 4 * s, top + 1.5 * s);
    g.quadraticCurveTo(x + 2 * s, top, x + bw * 0.18, top - rh);
    g.lineTo(x + bw * 0.82, top - rh);
    g.quadraticCurveTo(x + bw - 2 * s, top, x + bw + 4 * s, top + 1.5 * s);
    g.closePath();
    g.fill();
    if (rnd() < lit) {
      g.fillStyle = 'rgba(255,196,120,0.85)';
      g.fillRect(x + bw * (0.3 + rnd() * 0.4), base - wh * 0.6, 2 * s, 2.2 * s);
    }
    x += bw + (2 + rnd() * 8) * s;
  }
}

const seireitei: Paint = (g, w, h) => {
  const rnd = seeded(11);
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#070816');
  sky.addColorStop(0.55, '#1f1a3a');
  sky.addColorStop(1, '#3f2645');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  stars(g, w, h * 0.45, 22, rnd);
  // A big pale moon sitting low behind the city.
  const mx = w * 0.7;
  const my = h * 0.44;
  const R = h * 0.2;
  halo(g, mx, my, R * 2.6, '255,228,196', 0.26);
  g.fillStyle = '#f2e8d8';
  g.beginPath();
  g.arc(mx, my, R, 0, TAU);
  g.fill();
  // The tall white tower on its hill.
  g.fillStyle = '#121325';
  g.beginPath();
  g.ellipse(w * 0.2, h * 0.74, w * 0.2, h * 0.12, 0, Math.PI, TAU);
  g.fill();
  // A pagoda: a white body under three dark roofs that reach past it and turn up at the ends.
  const tx = w * 0.2;
  g.strokeStyle = '#d9dbe6';
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(tx, h * 0.25);
  g.lineTo(tx, h * 0.3);
  g.stroke();
  for (let k = 0; k < 3; k++) {
    const y = h * (0.31 + k * 0.12);
    const half = 9 + k * 2.5;
    g.fillStyle = '#d9dbe6';
    g.fillRect(tx - half * 0.5, y, half, h * 0.12);
    g.fillStyle = '#16172a';
    g.beginPath();
    g.moveTo(tx - half - 3, y + 2.5);
    g.quadraticCurveTo(tx - half, y + 0.5, tx - half * 0.55, y - 3);
    g.lineTo(tx + half * 0.55, y - 3);
    g.quadraticCurveTo(tx + half, y + 0.5, tx + half + 3, y + 2.5);
    g.closePath();
    g.fill();
  }
  roofs(g, w, h * 0.72, 0.8, rnd, '#4a4c63', '#17182a', 0.25);
  roofs(g, w, h * 0.84, 1.25, rnd, '#7a7f96', '#111220', 0.35);
  // The long white wall in front, capped with dark tiles and lanterns along it.
  g.fillStyle = '#e4e6ee';
  g.fillRect(0, h * 0.9, w, h * 0.1);
  g.fillStyle = '#14151f';
  g.fillRect(0, h * 0.875, w, h * 0.035);
  for (let k = 0; k < 4; k++) halo(g, w * (0.12 + k * 0.26), h * 0.86, 6, '255,190,110', 0.7);
};

/** A floating island: a flat top on a craggy underside. */
function island(g: Ctx, x: number, y: number, w: number, h: number, top: string, under: string): void {
  g.fillStyle = under;
  g.beginPath();
  g.moveTo(x - w, y);
  g.lineTo(x + w, y);
  g.lineTo(x + w * 0.55, y + h * 0.8);
  g.lineTo(x + w * 0.2, y + h * 1.6);
  g.lineTo(x - w * 0.15, y + h * 1.1);
  g.lineTo(x - w * 0.6, y + h * 0.9);
  g.closePath();
  g.fill();
  g.fillStyle = top;
  g.fillRect(x - w, y - h * 0.15, w * 2, h * 0.3);
}

/** A white tower under tiers of gold roof. */
function tower(g: Ctx, x: number, base: number, height: number, width: number): void {
  g.fillStyle = '#f4f1ea';
  g.fillRect(x - width / 2, base - height, width, height);
  for (let k = 0; k < 3; k++) {
    const y = base - height + k * (height / 3);
    const half = width * (0.9 + k * 0.18);
    g.fillStyle = '#e2b54a';
    g.beginPath();
    g.moveTo(x - half - 2, y + 2);
    g.quadraticCurveTo(x - half * 0.8, y, x - half * 0.5, y - 3);
    g.lineTo(x + half * 0.5, y - 3);
    g.quadraticCurveTo(x + half * 0.8, y, x + half + 2, y + 2);
    g.closePath();
    g.fill();
  }
}

/** Puffs of cloud along a line. */
function clouds(g: Ctx, w: number, y: number, color: string, size: number, rnd: () => number): void {
  g.fillStyle = color;
  for (let x = -10; x < w + 20; x += size * (0.8 + rnd() * 0.6)) {
    g.beginPath();
    g.arc(x, y + (rnd() - 0.5) * size * 0.4, size * (0.5 + rnd() * 0.4), 0, Math.PI * 2);
    g.fill();
  }
}

const palace: Paint = (g, w, h) => {
  const rnd = seeded(23);
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#16224a');
  sky.addColorStop(0.55, '#5d6fb0');
  sky.addColorStop(1, '#f0d6a2');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  stars(g, w, h * 0.28, 12, rnd);
  halo(g, w * 0.5, h * 0.6, h * 0.75, '255,236,190', 0.5);
  clouds(g, w, h * 0.7, 'rgba(255,244,228,0.5)', 14, rnd);
  island(g, w * 0.15, h * 0.48, w * 0.08, h * 0.08, '#e8e2f0', '#7a7896');
  island(g, w * 0.86, h * 0.44, w * 0.07, h * 0.07, '#e8e2f0', '#7a7896');
  island(g, w * 0.5, h * 0.58, w * 0.24, h * 0.1, '#f2ecf6', '#8a86a6');
  tower(g, w * 0.5, h * 0.55, h * 0.36, 10);
  tower(g, w * 0.36, h * 0.56, h * 0.18, 7);
  tower(g, w * 0.64, h * 0.56, h * 0.18, 7);
  tower(g, w * 0.15, h * 0.47, h * 0.12, 5);
  tower(g, w * 0.86, h * 0.43, h * 0.11, 5);
  clouds(g, w, h * 0.9, 'rgba(255,255,255,0.75)', 18, rnd);
};

/** Silbern: white towers of the Wandenreich over the Seireitei's dark roofs, at dusk. */
const silbern: Paint = (g, w, h) => {
  const rnd = seeded(31);
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#0c1428');
  sky.addColorStop(0.6, '#3a4a78');
  sky.addColorStop(1, '#9aa8cc');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  stars(g, w, h * 0.3, 14, rnd);
  halo(g, w * 0.5, h * 0.62, h * 0.7, '200,220,255', 0.32);
  // The white city: spires, each crowned with the Quincy cross.
  for (const [x, top, width] of [
    [0.18, 0.36, 7],
    [0.32, 0.22, 9],
    [0.5, 0.1, 13],
    [0.68, 0.24, 9],
    [0.82, 0.38, 7],
  ] as const) {
    const px = w * x;
    g.fillStyle = '#e8eef8';
    g.beginPath();
    g.moveTo(px - width / 2, h * 0.82);
    g.lineTo(px - width / 3, h * top + 6);
    g.lineTo(px, h * top);
    g.lineTo(px + width / 3, h * top + 6);
    g.lineTo(px + width / 2, h * 0.82);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(90,110,160,0.35)';
    g.fillRect(px, h * top + 6, width / 2, h * (0.82 - top) - 6);
    // The Quincy cross at the tip: a five-pointed star
    g.fillStyle = '#bfe6ff';
    g.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * TAU - Math.PI / 2;
      const r = k % 2 === 0 ? 3.6 : 1.5;
      g.lineTo(px + Math.cos(a) * r, h * top - 5 + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
  }
  // The Seireitei's old roofs, in shadow below.
  g.fillStyle = '#0a0d18';
  g.beginPath();
  g.moveTo(0, h);
  for (let x = 0, k = 0; x <= w + 14; x += 14, k++) g.lineTo(x, k % 2 === 0 ? h * 0.86 : h * 0.8);
  g.lineTo(w, h);
  g.closePath();
  g.fill();
};

/** The Wahrwelt: a black castle on what is left of the palace, under a red sky with an eye in it. */
const wahrwelt: Paint = (g, w, h) => {
  const rnd = seeded(47);
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#0a0408');
  sky.addColorStop(0.55, '#4a0e1c');
  sky.addColorStop(1, '#a03040');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  stars(g, w, h * 0.3, 10, rnd);
  // The eye in the sky
  const ex = w * 0.5;
  const ey = h * 0.26;
  halo(g, ex, ey, h * 0.4, '255,60,80', 0.3);
  g.fillStyle = 'rgba(255,220,220,0.85)';
  g.beginPath();
  g.ellipse(ex, ey, w * 0.09, h * 0.05, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#c0102a';
  g.beginPath();
  g.arc(ex, ey, h * 0.04, 0, TAU);
  g.fill();
  g.fillStyle = '#120408';
  g.beginPath();
  g.arc(ex, ey, h * 0.018, 0, TAU);
  g.fill();
  clouds(g, w, h * 0.86, 'rgba(60,20,30,0.85)', 16, rnd);
  // The castle on its rock
  island(g, w * 0.5, h * 0.66, w * 0.3, h * 0.1, '#1a1018', '#0a0408');
  g.fillStyle = '#0c0810';
  for (const [x, top, width] of [
    [0.36, 0.44, 10],
    [0.43, 0.36, 12],
    [0.5, 0.28, 16],
    [0.57, 0.36, 12],
    [0.64, 0.44, 10],
  ] as const) {
    const px = w * x;
    g.beginPath();
    g.moveTo(px - width / 2, h * 0.64);
    g.lineTo(px - width / 2, h * top + 6);
    g.lineTo(px, h * top);
    g.lineTo(px + width / 2, h * top + 6);
    g.lineTo(px + width / 2, h * 0.64);
    g.closePath();
    g.fill();
  }
  g.fillStyle = 'rgba(255,60,80,0.7)';
  for (let k = 0; k < 7; k++) g.fillRect(w * (0.4 + rnd() * 0.2), h * (0.42 + rnd() * 0.18), 1.5, 2.5);
  clouds(g, w, h * 0.96, 'rgba(30,8,14,0.95)', 20, rnd);
};

/** Las Noches: inside the dome, Aizen's painted day. White towers, a white wall, white sand, a sun that never sets. */
const lasnoches: Paint = (g, w, h) => {
  const rnd = seeded(61);
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#173c78');
  sky.addColorStop(0.6, '#5a98d6');
  sky.addColorStop(1, '#bfdcf0');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  // The curve of the dome, high overhead: the sky is painted on it.
  g.strokeStyle = 'rgba(255,255,255,0.2)';
  g.lineWidth = 1.5;
  g.beginPath();
  g.ellipse(w * 0.5, h * 1.15, w * 0.95, h * 1.08, 0, Math.PI, TAU);
  g.stroke();
  halo(g, w * 0.74, h * 0.22, h * 0.32, '255,250,230', 0.55);
  g.fillStyle = '#fffaf0';
  g.beginPath();
  g.arc(w * 0.74, h * 0.22, h * 0.06, 0, TAU);
  g.fill();
  for (const [x, top, tw] of [
    [0.12, 0.36, 8],
    [0.22, 0.22, 12],
    [0.34, 0.42, 7],
    [0.6, 0.3, 11],
    [0.86, 0.4, 9],
  ] as const) {
    const px = w * x;
    const grad = g.createLinearGradient(px - tw / 2, 0, px + tw / 2, 0);
    grad.addColorStop(0, '#f4f6fa');
    grad.addColorStop(1, '#aebccf');
    g.fillStyle = grad;
    g.fillRect(px - tw / 2, h * top, tw, h * 0.66 - h * top);
    g.fillStyle = 'rgba(40,60,90,0.35)';
    g.fillRect(px - tw / 2, h * top, tw, 2);
  }
  g.fillStyle = '#e8ecf2';
  g.fillRect(0, h * 0.62, w, h * 0.07);
  g.fillStyle = 'rgba(60,80,110,0.28)';
  for (let k = 0; k < 10; k++) g.fillRect(w * (0.04 + k * 0.1) + rnd() * 3, h * 0.635, 2, h * 0.045);
  ridge(g, w, h, h * 0.74, h * 0.03, 62, '#e6e2d6', 'rgba(255,255,255,0.6)');
  ridge(g, w, h, h * 0.85, h * 0.04, 63, '#cbc4b2', 'rgba(255,255,255,0.45)');
};

const VISTAS: Readonly<Partial<Record<StageId, Paint>>> = { hueco, seireitei, lasnoches, silbern, palace, wahrwelt };

/** Paint a stage's vista into a canvas; `w` and `h` are its CSS size (CSS covers the card with it). */
export function drawVista(canvas: HTMLCanvasElement, stage: StageId, w = 200, h = 104, ratio = Math.min(window.devicePixelRatio || 1, 3)): void {
  canvas.width = Math.round(w * ratio);
  canvas.height = Math.round(h * ratio);
  const g = canvas.getContext('2d');
  if (!g) return;
  g.scale(ratio, ratio);
  (VISTAS[stage] ?? hueco)(g, w, h);
}
