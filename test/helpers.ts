import { SIM_HZ } from '../src/config';
import { UPGRADES } from '../src/data/archives';
import type { Offer } from '../src/game/offers';
import type { World, WorldOptions } from '../src/game/world';
import { buyUpgrade, metaMods, metaRerolls, metaRevives } from '../src/save/archives';
import { defaultSave } from '../src/save/save';

/** Simulated players for headless tests: how they pick cards and how they move. */

export type Strategy = (offers: Offer[]) => Offer;
export type Mover = (w: World) => [number, number];

export const firstCard: Strategy = (o) => o[0];

/** Roughly what a person does: take a resonance, finish builds, take the Lv 7 pick, then grab new powers. */
export const sensible: Strategy = (o) =>
  o.find((x) => x.kind === 'resonance') ??
  o.find((x) => x.kind === 'power-attr') ??
  o.find((x) => x.kind === 'power-up') ??
  o.find((x) => x.kind === 'power-new') ??
  o[0];

/** Pessimistic: walks a big circle and ignores enemies, orbs and chests. */
export const circle: Mover = (w) => [Math.cos(w.t * 0.35), Math.sin(w.t * 0.35)];

/**
 * Closer to a person: backs away from enemies that get close, sidesteps
 * bullets about to hit it, steps out of boss warnings it is standing in, goes
 * for medallions and chests first, otherwise the nearest orb.
 */
export const bot: Mover = (w) => {
  const p = w.player;
  const E = w.en;
  const O = w.orbs;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < E.n; i++) {
    // Charmed and risen enemies are on your side: nothing to run from.
    if (E.charmT[i] > 0) continue;
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
  // Sidestep the one bullet that will hit soonest, like a person reacting to the nearest threat.
  const B = w.eb;
  let soonest = 0.6;
  let dodgeX = 0;
  let dodgeY = 0;
  for (let i = 0; i < B.n; i++) {
    const rx = p.x - B.x[i];
    const ry = p.y - B.y[i];
    const sp = Math.hypot(B.vx[i], B.vy[i]) || 1;
    const ux = B.vx[i] / sp;
    const uy = B.vy[i] / sp;
    const along = rx * ux + ry * uy;
    const eta = along / sp;
    if (eta < 0 || eta > soonest) continue;
    const side = rx * -uy + ry * ux;
    if (Math.abs(side) > B.r[i] + 16) continue;
    soonest = eta;
    const dir = side >= 0 ? 1 : -1;
    dodgeX = -uy * dir * 2;
    dodgeY = ux * dir * 2;
  }
  mx += dodgeX;
  my += dodgeY;
  // Step out of warnings aimed at you: away from a circle's centre, sideways off a
  // line, straight back out of an arc.
  const M = w.marks;
  for (let i = 0; i < M.n; i++) {
    if (!(M.flags[i] & 1)) continue;
    const dx = p.x - M.x[i];
    const dy = p.y - M.y[i];
    const d = Math.hypot(dx, dy);
    if (M.shape[i] === 0) {
      if (d < M.r[i] + 14) {
        mx += (d > 1 ? dx / d : 1) * 4;
        my += (d > 1 ? dy / d : 0) * 4;
      }
    } else if (M.shape[i] === 1) {
      const ux = Math.cos(M.ang[i]);
      const uy = Math.sin(M.ang[i]);
      const along = dx * ux + dy * uy;
      const side = dx * -uy + dy * ux;
      if (along > -14 && along < M.len[i] + 14 && Math.abs(side) < M.r[i] / 2 + 16) {
        const dir = side >= 0 ? 1 : -1;
        mx += -uy * dir * 4;
        my += ux * dir * 4;
      }
    } else if (d < M.r[i] + 14) {
      let da = Math.atan2(dy, dx) - M.ang[i];
      da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) < M.len[i] + 0.2 && d > 1) {
        // Out of a wedge by the shorter way: straight back out, or sideways past its edge.
        const back = M.r[i] + 14 - d;
        const side = d * Math.sin(Math.max(0, M.len[i] + 0.2 - Math.abs(da)));
        if (back < side) {
          mx += (dx / d) * 4;
          my += (dy / d) * 4;
        } else {
          const dir = da >= 0 ? 1 : -1;
          mx += (-dy / d) * dir * 4;
          my += (dx / d) * dir * 4;
        }
      }
    }
  }
  let tx = 0;
  let ty = 0;
  let found = false;
  let bestD = 700 * 700;
  // Medallions and chests close by are worth pushing through a crowd for; orbs are not.
  let pull = 2.5;
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
    pull = 1;
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
    // Only worth pushing through a crowd when it is right there.
    if (d > 200) pull = 1;
    mx += ((tx - p.x) / d) * pull;
    my += ((ty - p.y) / d) * pull;
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

/** World options for a player who bought every Archives upgrade. */
export function maxedMeta(): Pick<WorldOptions, 'meta' | 'revives' | 'rerolls'> {
  const s = defaultSave();
  s.gold = 1_000_000;
  for (const u of UPGRADES) while (buyUpgrade(s, u.id));
  return { meta: metaMods(s), revives: metaRevives(s), rerolls: metaRerolls(s) };
}
