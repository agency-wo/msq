import { SIM_HZ } from '../src/config';
import type { Offer } from '../src/game/offers';
import type { World } from '../src/game/world';

/** Simulated players for headless tests: how they pick cards and how they move. */

export type Strategy = (offers: Offer[]) => Offer;
export type Mover = (w: World) => [number, number];

export const firstCard: Strategy = (o) => o[0];

/** Roughly what a person does: finish builds, take the Lv 7 pick, then grab new powers. */
export const sensible: Strategy = (o) =>
  o.find((x) => x.kind === 'power-attr') ?? o.find((x) => x.kind === 'power-up') ?? o.find((x) => x.kind === 'power-new') ?? o[0];

/** Pessimistic: walks a big circle and ignores enemies, orbs and chests. */
export const circle: Mover = (w) => [Math.cos(w.t * 0.35), Math.sin(w.t * 0.35)];

/**
 * Closer to a person: backs away from enemies that get close and from boss
 * warnings it is standing in, goes for medallions and chests first, otherwise
 * the nearest orb.
 */
export const bot: Mover = (w) => {
  const p = w.player;
  const E = w.en;
  const O = w.orbs;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < E.n; i++) {
    const dx = p.x - E.x[i];
    const dy = p.y - E.y[i];
    const R = 100 + E.r[i];
    const d2 = dx * dx + dy * dy;
    if (d2 < R * R && d2 > 1) {
      const d = Math.sqrt(d2);
      const k = ((R - d) / R) * 3;
      mx += (dx / d) * k;
      my += (dy / d) * k;
    }
  }
  // Step out of circular warnings aimed at you.
  const M = w.marks;
  for (let i = 0; i < M.n; i++) {
    if (!(M.flags[i] & 1) || M.shape[i] !== 0) continue;
    const dx = p.x - M.x[i];
    const dy = p.y - M.y[i];
    const d = Math.hypot(dx, dy);
    if (d < M.r[i] + 14) {
      mx += ((d > 1 ? dx / d : 1) * 4);
      my += ((d > 1 ? dy / d : 0) * 4);
    }
  }
  let tx = 0;
  let ty = 0;
  let found = false;
  let bestD = 700 * 700;
  for (const q of w.pickups) {
    if (q.kind !== 'chest' && q.kind !== 'chestBlack' && q.kind !== 'medallion') continue;
    const d2 = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
    if (d2 < bestD) {
      bestD = d2;
      tx = q.x;
      ty = q.y;
      found = true;
    }
  }
  if (!found) {
    bestD = 420 * 420;
    for (let i = 0; i < O.n; i++) {
      const d2 = (O.x[i] - p.x) ** 2 + (O.y[i] - p.y) ** 2;
      if (d2 < bestD) {
        bestD = d2;
        tx = O.x[i];
        ty = O.y[i];
        found = true;
      }
    }
  }
  if (found) {
    const d = Math.sqrt(bestD) || 1;
    mx += (tx - p.x) / d;
    my += (ty - p.y) / d;
  } else {
    mx += Math.cos(w.t * 0.35) * 0.5;
    my += Math.sin(w.t * 0.35) * 0.5;
  }
  const len = Math.hypot(mx, my);
  return len > 1 ? [mx / len, my / len] : [mx, my];
};

/** Resolve pending level-ups and chests the way the given strategy would. */
export function resolveChoices(w: World, pick: Strategy): void {
  while (w.pendingLevelUps > 0) {
    const o = pick(w.offers());
    if (o.kind === 'power-attr') {
      const ps = w.powers.find((q) => q.def.id === o.id);
      if (ps?.def.attributes) w.chooseAttribute(o.id, ps.def.attributes[0].id);
    } else {
      w.applyOffer(o);
    }
    w.pendingLevelUps--;
  }
  while (w.pendingChests.length > 0) {
    const kind = w.pendingChests.shift();
    if (!kind) break;
    const [relic] = w.relicChoices(kind);
    if (relic) w.addRelic(relic.id);
  }
}

/** Advance `seconds` of game time (or until the run ends). */
export function play(w: World, seconds: number, pick: Strategy, move: Mover, onStep?: (w: World) => void): void {
  const steps = Math.round(seconds * SIM_HZ);
  for (let i = 0; i < steps && !w.over; i++) {
    const [mx, my] = move(w);
    w.step(mx, my);
    resolveChoices(w, pick);
    onStep?.(w);
  }
}
