/**
 * The figure kit for the named characters, drawn the way Bleach's manga
 * draws its cast: lanky, six to seven heads tall, angular silhouettes in flat
 * ink and paper, one hard shadow side, and each character known at a glance
 * by the shape of their hair, their weapon and what they wear. Canon
 * characters are homages in this game's own line; nothing is traced.
 *
 * Every figure is designed in a box 100 units tall (as wide as the sprite's
 * box allows) and scaled to its sprite, so proportions hold at every size.
 * The ink pass (../ink.ts) then flattens the tones and lays the outline, so
 * colours here are chosen near its levels (luma 9 / 58 / 112 / 172 / 236).
 */

export type Ctx = CanvasRenderingContext2D;
export type Draw = (g: Ctx, w: number, h: number) => void;
export type Pt = readonly [number, number];

export const TAU = Math.PI * 2;

// ------------------------------------------------------------------ tones

export const INK = '#0b0a0f';
/** The darkest tone above ink: folds in black cloth, dark hair's sheen. */
export const DARK = '#3b3a46';
export const MID = '#77737c';
export const LIGHT = '#b3aea4';
export const PAPER = '#f3efe4';
export const SKIN = '#f1ddc6';
export const SKIN_SHADE = '#bc9a80';
export const BLOOD = '#c8102e';
export const GOLD = '#e2b04a';
export const GOLD_SHADE = '#9a6e22';
export const STEEL = '#dfe4ec';
export const STEEL_SHADE = '#8d95a4';

// ----------------------------------------------------------------- frame

/**
 * Draw in the 100-unit design box: `d` gets the context scaled so the box is
 * 100 units tall, and the centre line's x in those units.
 */
export function fig(d: (g: Ctx, cx: number) => void): Draw {
  return (g, w, h) => {
    const k = h / 100;
    g.save();
    g.scale(k, k);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    d(g, w / k / 2);
    g.restore();
  };
}

/** A deterministic random stream, so a sprite is drawn the same every time. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

// ---------------------------------------------------------------- shapes

export function path(g: Ctx, pts: readonly Pt[], close = true): void {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let k = 1; k < pts.length; k++) g.lineTo(pts[k][0], pts[k][1]);
  if (close) g.closePath();
}

/** A filled polygon, optionally inked along its edge. */
export function shape(g: Ctx, pts: readonly Pt[], fill: string, stroke?: string, lw = 1.4): void {
  path(g, pts);
  g.fillStyle = fill;
  g.fill();
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = lw;
    g.stroke();
  }
}

/** An open ink stroke through the points. */
export function stroke(g: Ctx, pts: readonly Pt[], lw = 1.4, color = INK): void {
  path(g, pts, false);
  g.strokeStyle = color;
  g.lineWidth = lw;
  g.stroke();
}

/** A smooth closed shape through the points (quadratic curves between midpoints). */
export function blob(g: Ctx, pts: readonly Pt[], fill: string, line?: string, lw = 1.4): void {
  const n = pts.length;
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  g.beginPath();
  const m0 = mid(pts[n - 1], pts[0]);
  g.moveTo(m0[0], m0[1]);
  for (let k = 0; k < n; k++) {
    const p = pts[k];
    const m = mid(p, pts[(k + 1) % n]);
    g.quadraticCurveTo(p[0], p[1], m[0], m[1]);
  }
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  if (line) {
    g.strokeStyle = line;
    g.lineWidth = lw;
    g.stroke();
  }
}

export function disc(g: Ctx, x: number, y: number, r: number, fill: string): void {
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fillStyle = fill;
  g.fill();
}

export function oval(g: Ctx, x: number, y: number, rx: number, ry: number, rot: number, fill: string): void {
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, TAU);
  g.fillStyle = fill;
  g.fill();
}

/** A limb from a to b, w0 wide at a and w1 at b, with rounded ends. */
export function limb(g: Ctx, a: Pt, b: Pt, w0: number, w1: number, fill: string): void {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = Math.hypot(dx, dy) || 1;
  const nx = -dy / d;
  const ny = dx / d;
  path(g, [
    [a[0] + (nx * w0) / 2, a[1] + (ny * w0) / 2],
    [b[0] + (nx * w1) / 2, b[1] + (ny * w1) / 2],
    [b[0] - (nx * w1) / 2, b[1] - (ny * w1) / 2],
    [a[0] - (nx * w0) / 2, a[1] - (ny * w0) / 2],
  ]);
  g.fillStyle = fill;
  g.fill();
  disc(g, a[0], a[1], w0 / 2, fill);
  disc(g, b[0], b[1], w1 / 2, fill);
}

/** Point a fraction t of the way from a to b, pushed sideways by `off`. */
export function along(a: Pt, b: Pt, t: number, off = 0): Pt {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = Math.hypot(dx, dy) || 1;
  return [a[0] + dx * t - (dy / d) * off, a[1] + dy * t + (dx / d) * off];
}

// ----------------------------------------------------------------- heads

export interface HeadOpts {
  /** Turns the face this far toward the viewer's right (−1..1): features shift, the far cheek narrows. */
  turn?: number;
  skin?: string;
  shade?: string;
  /** Head width and height factors. */
  w?: number;
  h?: number;
  /** A heavier, squarer jaw. */
  jaw?: number;
}

/** The standard head's centre in the design box (the hair is drawn round it). */
export const HEAD: Pt = [0, 14];

/**
 * A manga head: a rounded skull narrowing to a pointed chin, a hard shadow
 * down the far side and under the jaw. (x, y) is the centre; the head is
 * about 13 units tall at w = h = 1.
 */
export function head(g: Ctx, x: number, y: number, o: HeadOpts = {}): void {
  const t = o.turn ?? 0.25;
  const W = 5.7 * (o.w ?? 1);
  const H = 7.4 * (o.h ?? 1);
  const j = o.jaw ?? 0;
  const chinX = x + t * 1.6;
  const outline = (): void => {
    g.beginPath();
    g.moveTo(x - W, y - 0.6);
    g.bezierCurveTo(x - W, y - H * 1.05, x + W, y - H * 1.05, x + W, y - 0.6);
    g.bezierCurveTo(x + W, y + H * 0.35, x + W * (0.55 + j * 0.3), y + H * (0.7 + j * 0.05), chinX + 0.4, y + H * 0.98);
    g.lineTo(chinX - 0.6, y + H * 0.98);
    g.bezierCurveTo(x - W * (0.6 + j * 0.3), y + H * (0.72 + j * 0.05), x - W, y + H * 0.35, x - W, y - 0.6);
    g.closePath();
  };
  outline();
  g.fillStyle = o.skin ?? SKIN;
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 1.1;
  g.stroke();
  // The far side in shadow, cut hard.
  g.save();
  outline();
  g.clip();
  const side = t >= 0 ? -1 : 1;
  path(g, [
    [x + side * W * 1.2, y - H],
    [x + side * W * 0.45, y - H],
    [x + side * W * 0.6, y + H * 0.2],
    [chinX + side * 0.4, y + H * 1.1],
    [x + side * W * 1.2, y + H * 1.1],
  ]);
  g.fillStyle = o.shade ?? SKIN_SHADE;
  g.fill();
  g.restore();
}

/**
 * Eyes in the style of the series' hard close-ups: a shadow band where the
 * brow throws its shade, two narrow almond slits, a pupil in each. `color`
 * is the iris; `kind` picks the read: sharp (the default), glare (white
 * slits on black, the anonymous menace), closed (calm arcs), wide.
 */
export function eyes(
  g: Ctx,
  x: number,
  y: number,
  o: { turn?: number; color?: string; kind?: 'sharp' | 'glare' | 'closed' | 'wide'; gap?: number; brow?: string; tilt?: number } = {},
): void {
  const t = o.turn ?? 0.25;
  const gap = o.gap ?? 2.7;
  const kind = o.kind ?? 'sharp';
  const tilt = o.tilt ?? 1;
  const cx = x + t * 1.3;
  if (kind === 'glare') {
    shape(g, [
      [cx - gap - 2.6, y - 1.4],
      [cx + gap + 2.6, y - 1.4],
      [cx + gap + 2.4, y + 1.1],
      [cx - gap - 2.4, y + 1.1],
    ], INK);
  }
  for (const d of [-1, 1]) {
    const ex = cx + d * gap * (d === (t >= 0 ? -1 : 1) ? 0.85 : 1);
    if (kind === 'closed') {
      stroke(g, [
        [ex - 2, y - 0.1],
        [ex, y + 0.8],
        [ex + 2, y - 0.1],
      ], 1.15);
      continue;
    }
    const tall = kind === 'wide' ? 1.5 : 0.95;
    const white = kind === 'glare' ? PAPER : '#fbf8ef';
    shape(g, [
      [ex - 2.2, y + 0.25 * d * tilt],
      [ex - 0.5, y - tall],
      [ex + 2.2, y - 0.25 * d * tilt],
      [ex + 0.5, y + tall * 0.75],
    ], white);
    if (kind !== 'glare') {
      disc(g, ex + t * 0.5, y + 0.05, kind === 'wide' ? 1 : 0.85, o.color ?? INK);
      // The upper lid, inked heavier than the lower.
      stroke(g, [
        [ex - 2.5, y + 0.4 * d * tilt],
        [ex - 0.5, y - tall - 0.15],
        [ex + 2.5, y - 0.4 * d * tilt],
      ], 1.2);
    }
  }
  if (o.brow) {
    for (const d of [-1, 1]) {
      const bx = cx + d * gap;
      shape(g, [
        [bx - d * 2.6, y - 2.5 - tilt * 0.6],
        [bx + d * 1.6, y - 1.6 + tilt * 0.3],
        [bx + d * 1.6, y - 2.4 + tilt * 0.3],
        [bx - d * 2.4, y - 3.3 - tilt * 0.6],
      ], o.brow);
    }
  }
}

/** A mouth: a short hard line, a grin of teeth, or a snarl. */
export function mouth(g: Ctx, x: number, y: number, kind: 'line' | 'grin' | 'teeth' | 'smile' | 'frown', w = 2.2, turn = 0.25): void {
  const cx = x + turn * 1.2;
  if (kind === 'line') stroke(g, [[cx - w * 0.6, y], [cx + w * 0.5, y + 0.1]], 0.8);
  else if (kind === 'smile') stroke(g, [[cx - w * 0.6, y - 0.3], [cx, y + 0.3], [cx + w * 0.6, y - 0.3]], 0.8);
  else if (kind === 'frown') stroke(g, [[cx - w * 0.6, y + 0.4], [cx, y - 0.1], [cx + w * 0.6, y + 0.4]], 0.9);
  else {
    // A wide mouth of teeth: white, split by ink.
    const h = kind === 'teeth' ? 1.8 : 1.3;
    shape(g, [
      [cx - w, y - 0.5],
      [cx + w, y - 0.7],
      [cx + w * 0.8, y + h * 0.6],
      [cx, y + h],
      [cx - w * 0.8, y + h * 0.6],
    ], '#fbf8ef', INK, 0.8);
    stroke(g, [[cx - w * 0.9, y + 0.2], [cx + w * 0.9, y + 0.1]], 0.55);
    for (let k = -2; k <= 2; k++) stroke(g, [[cx + k * w * 0.36, y - 0.5], [cx + k * w * 0.34, y + h * 0.7]], 0.4);
  }
}

// ------------------------------------------------------------ the robes

export interface RobeOpts {
  /** Shoulder half-width factor. */
  broad?: number;
  /** Shoulder line y. */
  top?: number;
  /** Waist y. */
  waist?: number;
  /** Feet y. */
  feet?: number;
  /** How far apart the feet stand (half-width). */
  stance?: number;
  /** Hakama colour (black by default). */
  hakama?: string;
  kosode?: string;
  obi?: string;
  /** Skin of hands and feet, and of the chest where the collar is open. */
  skin?: string;
  /** Tabi colour (white by default; dark under the Arrancar's white). */
  tabi?: string;
  /** The shitagi collar's colour. */
  collar?: string;
  /** The front open to the waist, the chest bare. */
  open?: boolean;
}

export interface Body {
  cx: number;
  top: number;
  waist: number;
  feet: number;
  /** Shoulder points, viewer's left and right. */
  sl: Pt;
  sr: Pt;
  /** Neck base. */
  neck: Pt;
  b: number;
}

export function bodyFrame(cx: number, o: RobeOpts = {}): Body {
  const b = o.broad ?? 1;
  const top = o.top ?? 26;
  return {
    cx,
    top,
    waist: o.waist ?? 50,
    feet: o.feet ?? 95,
    sl: [cx - 11.5 * b, top + 1.5],
    sr: [cx + 11.5 * b, top + 1.5],
    neck: [cx, top - 1],
    b,
  };
}

/**
 * The Soul Reaper's shihakushō from the waist down: hakama in a wide stance,
 * split at the legs, pleat lines, white tabi and sandals.
 */
export function hakama(g: Ctx, B: Body, o: RobeOpts = {}): void {
  const { cx, waist, feet, b } = B;
  const st = o.stance ?? 14;
  const fill = o.hakama ?? INK;
  shape(g, [
    [cx - 8.6 * b, waist - 1],
    [cx + 8.6 * b, waist - 1],
    [cx + st + 6.5, feet - 1.5],
    [cx + st - 6, feet - 0.5],
    [cx + 1, waist + 17],
    [cx - st + 6, feet - 0.5],
    [cx - st - 6.5, feet - 1.5],
  ], fill);
  // Pleats: the dark tone on black, the light one on white.
  const pleat = fill === INK ? DARK : LIGHT;
  stroke(g, [[cx - 4 * b, waist + 2], [cx - st - 1, feet - 3]], 1.2, pleat);
  stroke(g, [[cx + 4.4 * b, waist + 2], [cx + st + 1.5, feet - 3]], 1.2, pleat);
  stroke(g, [[cx - 1.5, waist + 4], [cx - st + 2.5, feet - 2]], 1, pleat);
  // Tabi and sandals.
  for (const d of [-1, 1]) {
    const fx = cx + d * st;
    shape(g, [
      [fx - 3, feet - 1.6],
      [fx + 3, feet - 1.6],
      [fx + 3.6 + d * 0.8, feet + 0.6],
      [fx - 3.6 + d * 0.8, feet + 0.6],
    ], o.tabi ?? PAPER);
    stroke(g, [[fx - 3.8 + d * 0.8, feet + 1.1], [fx + 3.8 + d * 0.8, feet + 1.1]], 1.1);
  }
}

/** The black kosode from shoulders to waist, with the white collar in a sharp V and the obi. */
export function kosode(g: Ctx, B: Body, o: RobeOpts = {}): void {
  const { cx, top, waist, sl, sr, b } = B;
  const fill = o.kosode ?? INK;
  shape(g, [
    [sl[0], sl[1]],
    [cx - 3, top - 1],
    [cx + 3, top - 1],
    [sr[0], sr[1]],
    [cx + 8.6 * b, waist],
    [cx - 8.6 * b, waist],
  ], fill);
  if (o.open) {
    // Open to the waist: the bare chest in a long V.
    shape(g, [
      [cx - 4.4, top - 1.2],
      [cx + 4.6, top - 1.2],
      [cx + 0.8, waist - 2],
    ], o.skin ?? SKIN, INK, 0.9);
  } else {
    // The shitagi collar crossing left over right.
    shape(g, [
      [cx - 3.6, top - 1.2],
      [cx + 1.4, top + 9],
      [cx + 3.8, top - 1.2],
      [cx + 2.4, top - 1.2],
      [cx + 0.6, top + 4.6],
      [cx - 2.2, top - 1.2],
    ], o.collar ?? PAPER);
  }
  // A fold or two catching the light.
  const fold = fill === INK ? DARK : LIGHT;
  stroke(g, [[cx - 5 * b, top + 6], [cx - 6.5 * b, waist - 3]], 1.1, fold);
  stroke(g, [[cx + 5.5 * b, top + 8], [cx + 6 * b, waist - 4]], 1, fold);
  // Obi.
  shape(g, [
    [cx - 8.8 * b, waist - 3.2],
    [cx + 8.8 * b, waist - 3.4],
    [cx + 8.8 * b, waist + 0.4],
    [cx - 8.8 * b, waist + 0.6],
  ], o.obi ?? PAPER);
}

/**
 * An arm from the shoulder to the hand, its kosode sleeve hanging square
 * from the upper arm (or, sleeve 'tight', close to it; 'bare', none).
 */
export function arm(
  g: Ctx,
  shoulder: Pt,
  hand: Pt,
  o: { sleeve?: 'square' | 'tight' | 'bare' | 'wide'; color?: string; skin?: string; elbow?: number; fist?: boolean; w?: number } = {},
): Pt {
  const color = o.color ?? INK;
  const skin = o.skin ?? SKIN;
  const w = o.w ?? 1;
  // The elbow bends outward from the body by `elbow` units.
  const el = along(shoulder, hand, 0.5, o.elbow ?? 2.5);
  const sleeve = o.sleeve ?? 'square';
  if (sleeve === 'bare') {
    limb(g, shoulder, el, 4.4 * w, 3.6 * w, skin);
    limb(g, el, hand, 3.6 * w, 3 * w, skin);
  } else {
    limb(g, shoulder, el, 5 * w, 4.2 * w, color);
    limb(g, el, along(el, hand, 0.8), 4.2 * w, 3.6 * w, sleeve === 'tight' ? color : skin);
  }
  if (sleeve === 'square' || sleeve === 'wide') {
    // The hanging sleeve: a square of cloth falling from the upper arm.
    const drop = sleeve === 'wide' ? 15 : 11;
    const out = shoulder[0] < hand[0] ? 1 : -1;
    const a = along(shoulder, el, 0.15);
    const b2 = along(shoulder, el, 1.05);
    shape(g, [
      [a[0] - out * 2, a[1]],
      [b2[0] + out * 2.6, b2[1] - 1],
      [b2[0] + out * 3.6, b2[1] + drop * 0.55],
      [a[0] + out * 1.2, a[1] + drop],
      [a[0] - out * 2.6, a[1] + drop * 0.7],
    ], color);
  }
  disc(g, hand[0], hand[1], o.fist ? 2.2 * w : 1.9 * w, skin);
  return el;
}

export interface HaoriOpts {
  sleeves?: 'sleeved' | 'sleeveless' | 'none';
  /** Hem y. */
  hem?: number;
  /** The hem's flutter to the viewer's right (+) or left (−). */
  flutter?: number;
  /** A ragged, torn hem (Kenpachi). */
  torn?: boolean;
  color?: string;
  /** The black diamond band along the hem. */
  diamonds?: boolean;
}

/**
 * The captain's haori over the shoulders: white, open down the front to show
 * the black beneath, falling to the knees and lifting in the wind, a band of
 * black diamonds along its hem.
 */
export function haori(g: Ctx, B: Body, o: HaoriOpts = {}): void {
  const { cx, top, sl, sr, b } = B;
  const hem = o.hem ?? 80;
  const f = o.flutter ?? 4;
  const color = o.color ?? PAPER;
  const rnd = seeded(31 + Math.round(cx));
  for (const d of [-1, 1]) {
    const s = d < 0 ? sl : sr;
    const swing = d * Math.max(0, d * f);
    const outer: Pt = [cx + d * 15 * b + swing, hem - (d * f > 0 ? 2.5 : 0)];
    const inner: Pt = [cx + d * 3.4 + swing * 0.3, hem + 1];
    const pts: Pt[] = [[s[0] - d * 1.2, s[1] - 1.4], [cx + d * 3.8, top - 1.6], [cx + d * 4.6, top + 6], inner];
    if (o.torn) {
      const n = 4;
      for (let k = 1; k < n; k++) {
        const t = k / n;
        const x = inner[0] + (outer[0] - inner[0]) * t;
        const y = inner[1] + (outer[1] - inner[1]) * t;
        pts.push([x, y + (k % 2 ? 5 + rnd() * 3 : -1)]);
      }
    }
    pts.push(outer, [s[0] + d * 2.6, s[1] + 12]);
    shape(g, pts, color, INK, 1.1);
    // The panel's inner fold, in shadow.
    stroke(g, [[cx + d * 6.5, top + 8], [cx + d * 8 + swing * 0.5, hem - 3]], 1.1, LIGHT);
    if (o.diamonds !== false && !o.torn) {
      const y = hem - 2.2;
      const x0 = inner[0] + d * 1.6;
      const x1 = outer[0] - d * 1.6;
      const n = Math.max(2, Math.floor(Math.abs(x1 - x0) / 3.4));
      for (let k = 0; k <= n; k++) {
        const x = x0 + ((x1 - x0) * k) / n;
        const yy = y + (outer[1] - inner[1]) * (k / n) * 0.9;
        shape(g, [
          [x, yy - 1.5],
          [x + 1.25, yy],
          [x, yy + 1.5],
          [x - 1.25, yy],
        ], INK);
      }
    }
  }
}

/** A haori sleeve (wide, white) hanging over an arm already drawn. */
export function haoriSleeve(g: Ctx, shoulder: Pt, elbow: Pt, o: { color?: string; long?: number } = {}): void {
  const out = elbow[0] > shoulder[0] ? 1 : -1;
  const L = o.long ?? 16;
  shape(g, [
    [shoulder[0] - out * 2.2, shoulder[1] - 1.5],
    [elbow[0] + out * 3, elbow[1] - 2],
    [elbow[0] + out * 4.4, elbow[1] + L * 0.45],
    [shoulder[0] + out * 1.5, shoulder[1] + L],
    [shoulder[0] - out * 3, shoulder[1] + L * 0.65],
  ], o.color ?? PAPER, INK, 1.1);
  stroke(g, [[shoulder[0] + out * 0.6, shoulder[1] + 3], [elbow[0] + out * 1.4, elbow[1] + L * 0.35]], 1, LIGHT);
}

// ------------------------------------------------------- the Wandenreich

export interface CoatOpts {
  broad?: number;
  top?: number;
  /** Coat hem y (the long Sternritter coat falls to the shins). */
  hem?: number;
  feet?: number;
  stance?: number;
  color?: string;
  shade?: string;
  trim?: string;
  /** A short skirt instead of the long coat (Bambietta). */
  skirt?: boolean;
  /** The cape hung from the shoulders, drawn first. */
  cape?: string;
  boots?: string;
  /** Skin, where a skirt leaves the thighs bare. */
  skin?: string;
}

/**
 * The Wandenreich's uniform: a white coat buttoned high, belted, falling
 * long and splitting as the figure strides, black boots, the Quincy cross at
 * the belt; or the short-skirted cut some Sternritter wear.
 */
export function coat(g: Ctx, cx: number, o: CoatOpts = {}): Body {
  const b = o.broad ?? 1;
  const top = o.top ?? 24;
  const hem = o.hem ?? 82;
  const feet = o.feet ?? 95;
  const st = o.stance ?? 11;
  const color = o.color ?? PAPER;
  const shade = o.shade ?? LIGHT;
  const trim = o.trim ?? INK;
  const B: Body = { cx, top, waist: 48, feet, sl: [cx - 10.5 * b, top + 1.5], sr: [cx + 10.5 * b, top + 1.5], neck: [cx, top - 1], b };
  if (o.cape) {
    shape(g, [
      [cx - 9.5 * b, top],
      [cx + 9.5 * b, top],
      [cx + 19 * b, hem + 6],
      [cx + 6, hem + 3],
      [cx - 4, hem + 7],
      [cx - 18 * b, hem + 4],
    ], o.cape);
  }
  // Legs and boots (bare thighs over tall boots under a skirt).
  for (const d of [-1, 1]) {
    if (o.skirt) {
      limb(g, [cx + d * 4, 60], [cx + d * (st - 1), 74], 5.6, 4.8, o.skin ?? SKIN);
      limb(g, [cx + d * (st - 1), 72], [cx + d * st, feet - 2], 5.2, 4.6, o.boots ?? INK);
    } else {
      limb(g, [cx + d * 4, 58], [cx + d * st, feet - 2], 6.4, 4.8, INK);
    }
    shape(g, [
      [cx + d * st - 3, feet - 6],
      [cx + d * st + 3, feet - 6],
      [cx + d * st + 3.4 + d * 1.6, feet + 0.8],
      [cx + d * st - 3.4 + d * 0.6, feet + 0.8],
    ], o.boots ?? INK);
  }
  if (o.skirt) {
    shape(g, [
      [cx - 9 * b, 46],
      [cx + 9 * b, 46],
      [cx + 13 * b, 64],
      [cx - 13 * b, 64],
    ], color);
    stroke(g, [[cx - 3, 49], [cx - 5, 63]], 1, shade);
    stroke(g, [[cx + 4, 49], [cx + 6, 63]], 1, shade);
  } else {
    // The long coat, split up the front from the belt so it parts as the figure strides, the legs showing between.
    shape(g, [
      [cx - 9.5 * b, 46],
      [cx + 0.5, 46],
      [cx - 1.5, 54],
      [cx - 7, hem + 1],
      [cx - 16 * b, hem - 1],
    ], shade, INK, 1.1);
    shape(g, [
      [cx + 0.5, 46],
      [cx + 9.5 * b, 46],
      [cx + 16 * b + 2, hem],
      [cx + 7.5, hem + 1.5],
      [cx + 2.5, 54],
    ], color, INK, 1.1);
    stroke(g, [[cx - 6 * b, 50], [cx - 12 * b, hem - 3]], 1.1, color === shade ? INK : color);
    stroke(g, [[cx + 6 * b, 50], [cx + 12 * b, hem - 3]], 1.1, shade);
    stroke(g, [[cx - 16 * b + 0.8, hem - 2.6], [cx - 7.2, hem - 1.2]], 1.4, trim);
    stroke(g, [[cx + 7.8, hem - 1.2], [cx + 16 * b + 1.6, hem - 3]], 1.4, trim);
  }
  // Torso: buttoned high, the far side in shadow.
  shape(g, [
    [B.sl[0], B.sl[1]],
    [cx - 3.4, top - 2],
    [cx + 3.4, top - 2],
    [B.sr[0], B.sr[1]],
    [cx + 9.4 * b, 47],
    [cx - 9.4 * b, 47],
  ], color);
  shape(g, [
    [B.sl[0], B.sl[1]],
    [cx - 5.5 * b, top + 2],
    [cx - 6 * b, 47],
    [cx - 9.4 * b, 47],
  ], shade);
  stroke(g, [[cx + 0.6, top], [cx + 0.6, 46]], 1, trim);
  // Belt, and the Quincy cross at its buckle.
  shape(g, [
    [cx - 9.6 * b, 44.4],
    [cx + 9.6 * b, 44.2],
    [cx + 9.6 * b, 47.6],
    [cx - 9.6 * b, 47.8],
  ], trim);
  quincyCross(g, cx + 0.6, 46, 2.2, color);
  return B;
}

/** The five-pointed cross of the Quincy, drawn as a sharp plus with a star's points. */
export function quincyCross(g: Ctx, x: number, y: number, r: number, fill: string): void {
  shape(g, [
    [x, y - r * 1.4],
    [x + r * 0.3, y - r * 0.3],
    [x + r * 1.1, y],
    [x + r * 0.3, y + r * 0.3],
    [x, y + r * 1.1],
    [x - r * 0.3, y + r * 0.3],
    [x - r * 1.1, y],
    [x - r * 0.3, y - r * 0.3],
  ], fill);
}

/** A five-pointed star (the Wandenreich's emblem). */
export function star(g: Ctx, x: number, y: number, r: number, fill: string, inner = 0.42): void {
  const pts: Pt[] = [];
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU - Math.PI / 2;
    const rr = k % 2 === 0 ? r : r * inner;
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  shape(g, pts, fill);
}

// --------------------------------------------------------------- weapons

/**
 * A katana from the hilt in the hand along angle `ang` (radians; 0 points
 * right): wrapped grip, a guard, a blade with a hard light edge.
 */
export function katana(
  g: Ctx,
  hand: Pt,
  ang: number,
  o: { len?: number; width?: number; blade?: string; edge?: string; grip?: string; guard?: string; curve?: number; nicks?: boolean } = {},
): Pt {
  const len = o.len ?? 34;
  const wd = o.width ?? 2.2;
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const P = (u: number, v: number): Pt => [hand[0] + c * u - s * v, hand[1] + s * u + c * v];
  const bend = o.curve ?? 1.6;
  // Grip behind the hand.
  shape(g, [P(-7, -1.2), P(1, -1.2), P(1, 1.2), P(-7, 1.2)], o.grip ?? INK);
  // Guard.
  shape(g, [P(1, -2.6), P(2.4, -2.6), P(2.4, 2.6), P(1, 2.6)], o.guard ?? GOLD);
  // Blade, slightly curved, back edge inked.
  const pts: Pt[] = [P(2.4, -wd / 2), P(len * 0.5, -wd / 2 - bend * 0.6), P(len, -bend), P(len - 3, wd / 2 - bend * 0.2), P(len * 0.5, wd / 2 - bend * 0.5), P(2.4, wd / 2)];
  if (o.nicks) {
    pts.splice(3, 0, P(len * 0.8, wd / 2 - bend * 0.4), P(len * 0.76, -bend * 0.1), P(len * 0.72, wd / 2 - bend * 0.3));
  }
  shape(g, pts, o.blade ?? STEEL);
  stroke(g, [P(3, -wd / 2 + 0.3), P(len * 0.5, -wd / 2 - bend * 0.6 + 0.3), P(len - 1, -bend + 0.3)], 0.7, o.edge ?? STEEL_SHADE);
  return P(len, -bend);
}

/** A sheathed sword at the hip (sloping back from the obi). */
export function sheath(g: Ctx, at: Pt, ang: number, len = 26, color = INK): void {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const P = (u: number, v: number): Pt => [at[0] + c * u - s * v, at[1] + s * u + c * v];
  shape(g, [P(-6, -1.3), P(0, -1.3), P(0, 1.3), P(-6, 1.3)], PAPER);
  shape(g, [P(0, -2.2), P(1.2, -2.2), P(1.2, 2.2), P(0, 2.2)], GOLD);
  shape(g, [P(1.2, -1.5), P(len, -1.2), P(len, 1.2), P(1.2, 1.5)], color);
}

/** Petals drifting: a scatter of small pointed leaves. */
export function petals(g: Ctx, seed: number, n: number, box: readonly [number, number, number, number], color: string): void {
  const rnd = seeded(seed);
  const [x0, y0, x1, y1] = box;
  for (let k = 0; k < n; k++) {
    const x = x0 + rnd() * (x1 - x0);
    const y = y0 + rnd() * (y1 - y0);
    const a = rnd() * TAU;
    const r = 1.4 + rnd() * 1.2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    shape(g, [
      [x + c * r * 1.6, y + s * r * 1.6],
      [x - s * r * 0.7, y + c * r * 0.7],
      [x - c * r * 1.2, y - s * r * 1.2],
      [x + s * r * 0.7, y - c * r * 0.7],
    ], color);
  }
}

/** A jagged bolt of lightning from a to b. */
export function zigzag(g: Ctx, a: Pt, b: Pt, seed: number, lw: number, color: string, steps = 5): void {
  const rnd = seeded(seed);
  const pts: Pt[] = [a];
  for (let k = 1; k < steps; k++) pts.push(along(a, b, k / steps, (rnd() - 0.5) * 7));
  pts.push(b);
  stroke(g, pts, lw, color);
}

/** The standard head's half-width and half-height, for hair laid out in head units. */
export const HEAD_W = 5.7;
export const HEAD_H = 7.4;

/** Points given in head units (−1..1 across the face, −1 the crown, 1 the chin) round a head centred at c. */
export function hp(c: Pt, pts: readonly (readonly [number, number])[], k = 1): Pt[] {
  return pts.map(([u, v]) => [c[0] + u * HEAD_W * k, c[1] + v * HEAD_H * k] as Pt);
}

/** A band of cloth along a spine, w0 wide at its start narrowing to w1, its curves smoothed. */
export function ribbon(g: Ctx, spine: readonly Pt[], w0: number, w1: number, fill: string, line = true): void {
  const n = spine.length;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let k = 0; k < n; k++) {
    const a = spine[Math.max(0, k - 1)];
    const b = spine[Math.min(n - 1, k + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const d = Math.hypot(dx, dy) || 1;
    const w = (w0 + (w1 - w0) * (k / (n - 1))) / 2;
    left.push([spine[k][0] - (dy / d) * w, spine[k][1] + (dx / d) * w]);
    right.push([spine[k][0] + (dy / d) * w, spine[k][1] - (dx / d) * w]);
  }
  const pts = [...left, ...right.reverse()];
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let k = 1; k < pts.length - 1; k++) {
    const m: Pt = [(pts[k][0] + pts[k + 1][0]) / 2, (pts[k][1] + pts[k + 1][1]) / 2];
    g.quadraticCurveTo(pts[k][0], pts[k][1], m[0], m[1]);
  }
  g.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  if (line) {
    g.strokeStyle = INK;
    g.lineWidth = 1.1;
    g.stroke();
  }
}

/** Draw `fn` scaled by k about the point (x, y): a shorter figure standing on the same ground. */
export function scaled(g: Ctx, x: number, y: number, k: number, fn: () => void): void {
  g.save();
  g.translate(x, y);
  g.scale(k, k);
  g.translate(-x, -y);
  fn();
  g.restore();
}

/** Ice: a jagged crystal from a base point, `len` long along angle `ang`. */
export function crystal(g: Ctx, at: Pt, ang: number, len: number, wide: number, fill: string): void {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const P = (u: number, v: number): Pt => [at[0] + c * u - s * v, at[1] + s * u + c * v];
  shape(g, [P(0, -wide / 2), P(len * 0.62, -wide * 0.62), P(len, 0), P(len * 0.62, wide * 0.5), P(0, wide / 2)], fill, INK, 0.9);
  stroke(g, [P(len * 0.1, 0), P(len * 0.85, 0)], 0.6, '#5a86b0');
}
