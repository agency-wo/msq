import { FX_GLOW, LAYER_ADD } from '../constants';
import type { World } from '../world';

/** Extra margin on grid queries so the biggest enemies are never missed. */
const PAD = 46;

/** A power's cooldown after global reduction; Vollständig halves it. */
export function cooldown(w: World, base: number): number {
  let cd = base * (1 - w.stats.cdr);
  if (w.vollT > 0) cd *= 0.5;
  return Math.max(0.05, cd);
}

/**
 * Area helpers. Each writes the indices of live enemies inside the shape to
 * w.qout and returns how many. They use their own scratch buffers, so call
 * them from top-level code only, never while iterating another helper's result.
 */
export function enemiesInCircle(w: World, x: number, y: number, R: number): number {
  const E = w.en;
  const raw = w.qraw;
  const out = w.qout;
  const n = w.grid.query(x - R - PAD, y - R - PAD, x + R + PAD, y + R + PAD, raw);
  let m = 0;
  for (let k = 0; k < n; k++) {
    const j = raw[k];
    if (E.dead[j]) continue;
    const dx = E.x[j] - x;
    const dy = E.y[j] - y;
    const rr = R + E.r[j];
    if (dx * dx + dy * dy <= rr * rr) out[m++] = j;
  }
  return m;
}

export function enemiesOnSegment(w: World, x0: number, y0: number, ang: number, len: number, half: number): number {
  const E = w.en;
  const raw = w.qraw;
  const out = w.qout;
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  const x1 = x0 + dx * len;
  const y1 = y0 + dy * len;
  const pad = half + PAD;
  const n = w.grid.query(Math.min(x0, x1) - pad, Math.min(y0, y1) - pad, Math.max(x0, x1) + pad, Math.max(y0, y1) + pad, raw);
  let m = 0;
  for (let k = 0; k < n; k++) {
    const j = raw[k];
    if (E.dead[j]) continue;
    const px = E.x[j] - x0;
    const py = E.y[j] - y0;
    let t = px * dx + py * dy;
    if (t < -E.r[j] || t > len + E.r[j]) continue;
    t = t < 0 ? 0 : t > len ? len : t;
    const cx = px - dx * t;
    const cy = py - dy * t;
    const lim = half + E.r[j];
    if (cx * cx + cy * cy <= lim * lim) out[m++] = j;
  }
  return m;
}

export function enemiesInArc(w: World, x: number, y: number, ang: number, R: number, half: number): number {
  const E = w.en;
  const raw = w.qraw;
  const out = w.qout;
  const n = w.grid.query(x - R - PAD, y - R - PAD, x + R + PAD, y + R + PAD, raw);
  let m = 0;
  for (let k = 0; k < n; k++) {
    const j = raw[k];
    if (E.dead[j]) continue;
    const dx = E.x[j] - x;
    const dy = E.y[j] - y;
    const d2 = dx * dx + dy * dy;
    const rr = R + E.r[j];
    if (d2 > rr * rr) continue;
    const diff = angleDiff(Math.atan2(dy, dx), ang);
    const slack = E.r[j] / Math.max(1, Math.sqrt(d2));
    if (Math.abs(diff) <= half + slack) out[m++] = j;
  }
  return m;
}

/** Signed smallest difference a - b, in (-PI, PI]. */
export function angleDiff(a: number, b: number): number {
  const d = a - b;
  return Math.atan2(Math.sin(d), Math.cos(d));
}

/** Distance from (px, py) to the segment starting at (x0, y0), going `len` along `ang`. */
export function segmentDist(px: number, py: number, x0: number, y0: number, ang: number, len: number): number {
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  const qx = px - x0;
  const qy = py - y0;
  let t = qx * dx + qy * dy;
  t = t < 0 ? 0 : t > len ? len : t;
  return Math.hypot(qx - dx * t, qy - dy * t);
}

/** Whether a circle of radius pr at (px, py) touches the arc sector. */
export function inArc(px: number, py: number, x: number, y: number, ang: number, R: number, half: number, pr: number): boolean {
  const dx = px - x;
  const dy = py - y;
  const d = Math.hypot(dx, dy);
  if (d > R + pr) return false;
  if (d < pr) return true;
  return Math.abs(angleDiff(Math.atan2(dy, dx), ang)) <= half + pr / d;
}

/**
 * Damage everything around a point. Pass nested = true when called from
 * inside the projectile loop (it then uses the second query buffer).
 */
export function burstAt(w: World, x: number, y: number, R: number, dmg: number, skip: number, nested: boolean, color: number): void {
  const E = w.en;
  const buf = nested ? w.qbuf2 : w.qbuf;
  const n = w.grid.query(x - R - PAD, y - R - PAD, x + R + PAD, y + R + PAD, buf);
  for (let k = 0; k < n; k++) {
    const j = buf[k];
    if (j === skip || E.dead[j]) continue;
    const dx = E.x[j] - x;
    const dy = E.y[j] - y;
    const rr = R + E.r[j];
    if (dx * dx + dy * dy > rr * rr) continue;
    w.damageEnemy(j, dmg, 60, x, y);
  }
  w.spawnFx(FX_GLOW, x, y, 0, 0, 0.22, R * 0.8, R * 2.2, 0.85, 0, 0, color, LAYER_ADD);
}

/** Centre of the thickest crowd within `range` of the player, written to w.tx/w.ty. False if nobody is there. */
export function densestPoint(w: World, range: number): boolean {
  const g = w.grid;
  const p = w.player;
  const s = g.cell;
  const d = g.dim;
  const x0 = Math.max(0, Math.floor((p.x - range - g.originX) / s));
  const x1 = Math.min(d - 1, Math.floor((p.x + range - g.originX) / s));
  const y0 = Math.max(0, Math.floor((p.y - range - g.originY) / s));
  const y1 = Math.min(d - 1, Math.floor((p.y + range - g.originY) / s));
  let best = -1;
  let bestN = 0;
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      const c = cy * d + cx;
      const n = g.start[c + 1] - g.start[c];
      if (n > bestN) {
        bestN = n;
        best = c;
      }
    }
  }
  if (best < 0) return false;
  const E = w.en;
  let sx = 0;
  let sy = 0;
  let m = 0;
  for (let k = g.start[best]; k < g.start[best + 1]; k++) {
    const j = g.items[k];
    if (E.dead[j]) continue;
    sx += E.x[j];
    sy += E.y[j];
    m++;
  }
  if (m === 0) return false;
  w.tx = sx / m;
  w.ty = sy / m;
  return true;
}
