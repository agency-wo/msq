import { DT } from '../../config';
import { TAU } from '../../core/math';
import {
  FLAG_BOSS,
  FX_CRESCENT,
  FX_FIST,
  FX_GLOW,
  FX_MAW,
  FX_RING,
  HOLD_STUN,
  LAYER_ADD,
  PF_CHARM,
  PF_INFECT,
  PK_ARROW,
  PK_BLOOD,
  PK_HEART,
  ZK_CAGE,
} from '../constants';
import type { PowerState } from '../powers';
import type { World } from '../world';
import { cooldown, enemiesInArc } from './common';

/**
 * The second wave of Schrift: G, J, L, P, Y and Z. The Love and The Zombie
 * share the ally system in World (charmed and risen enemies fight for you).
 */

// ------------------------------------------------------------ The Glutton

const BITE_HALF = 0.7;
const MAX_HEALED_PER_BITE = 6;

/** A maw bites the crowd in front of you; every enemy it finishes heals you. */
export function castMaw(w: World, ps: PowerState): void {
  ps.timer -= DT;
  if (ps.timer > 0) return;
  const st = ps.stats;
  const reach = st.radius * st.size * w.stats.size;
  const t = w.nearestEnemy(reach * 1.15);
  if (t < 0) {
    ps.timer = 0.2;
    return;
  }
  ps.timer = cooldown(w, st.cooldown);
  const p = w.player;
  const aim = Math.atan2(w.en.y[t] - p.y, w.en.x[t] - p.x);
  const wide = ps.attr === 'bottomless';
  const half = BITE_HALF * (wide ? 1.5 : 1);
  const devour = ps.attr === 'devour';
  let eaten = bite(w, aim, reach, half, st.damage, devour);
  if (ps.attr === 'gorge') eaten += bite(w, aim + Math.PI, reach, half, st.damage, devour);
  if (eaten > 0) w.healFlat(Math.min(eaten, MAX_HEALED_PER_BITE) * st.amount * (wide ? 3 : 1));
  w.sound('bite');
}

function bite(w: World, aim: number, reach: number, half: number, dmg: number, devour: boolean): number {
  const E = w.en;
  const p = w.player;
  const n = enemiesInArc(w, p.x, p.y, aim, reach, half);
  let eaten = 0;
  for (let k = 0; k < n; k++) {
    const j = w.qout[k];
    if (devour && !(E.flags[j] & FLAG_BOSS) && E.hp[j] < E.maxHp[j] * 0.25) {
      w.killEnemy(j);
      eaten++;
      continue;
    }
    w.damageEnemy(j, dmg, 50, p.x, p.y);
    if (E.dead[j]) eaten++;
  }
  const cx = p.x + Math.cos(aim) * reach * 0.5;
  const cy = p.y + Math.sin(aim) * reach * 0.5;
  w.spawnFx(FX_MAW, cx, cy, 0, 0, 0.28, reach * 1.25, reach * 0.95, 1, aim, 0, 0xffd0c8, 0);
  return eaten;
}

// --------------------------------------------------------------- The Jail

/** Where this cast's cages went, so two never land on the same spot. */
const placedX = new Float32Array(16);
const placedY = new Float32Array(16);

/** Cages drop over the toughest enemies near you. Holding and burning happen in updateZones. */
export function castJail(w: World, ps: PowerState): void {
  ps.timer -= DT;
  if (ps.timer > 0) return;
  const st = ps.stats;
  const lock = ps.attr === 'lockdown';
  const count = Math.min(16, st.count + w.stats.count + (ps.attr === 'cellblock' ? 2 : 0));
  const R = st.radius * st.size * w.stats.size * (lock ? 1.6 : 1);
  const life = st.duration * w.stats.duration * (lock ? 1.5 : 1);
  const extra = ps.attr === 'execution' ? st.damage * 6 : 0;
  const E = w.en;
  const p = w.player;
  const range = 300;
  const n = w.grid.query(p.x - range, p.y - range, p.x + range, p.y + range, w.qbuf);
  let placed = 0;
  for (let c = 0; c < count; c++) {
    let best = -1;
    let bestHp = 0;
    for (let k = 0; k < n; k++) {
      const j = w.qbuf[k];
      if (E.dead[j] || E.hp[j] <= bestHp) continue;
      const dx = E.x[j] - p.x;
      const dy = E.y[j] - p.y;
      if (dx * dx + dy * dy > range * range) continue;
      let taken = false;
      for (let q = 0; q < placed; q++) {
        const ex = E.x[j] - placedX[q];
        const ey = E.y[j] - placedY[q];
        if (ex * ex + ey * ey < R * R) {
          taken = true;
          break;
        }
      }
      if (taken) continue;
      best = j;
      bestHp = E.hp[j];
    }
    if (best < 0) break;
    placedX[placed] = E.x[best];
    placedY[placed] = E.y[best];
    placed++;
    w.spawnZone(ZK_CAGE, E.x[best], E.y[best], 0, 0, R, life, st.tick, st.damage, 0, extra);
    w.spawnFx(FX_RING, E.x[best], E.y[best], 0, 0, 0.25, R * 3, R * 2.2, 0.9, 0, 0, 0xcfe0ff, LAYER_ADD);
  }
  if (placed === 0) {
    ps.timer = 0.3;
    return;
  }
  ps.timer = cooldown(w, st.cooldown);
  w.sound('shield');
}

// --------------------------------------------------------------- The Love

/** Heart rays at enemies near you; whatever they hit (bosses aside) is charmed. */
export function castLove(w: World, ps: PowerState, slot: number): void {
  ps.timer -= DT;
  if (ps.timer > 0) return;
  const st = ps.stats;
  const p = w.player;
  const E = w.en;
  const count = st.count + w.stats.count;
  const size = st.size * w.stats.size;
  const secs = st.duration * w.stats.duration * (ps.attr === 'adoration' ? 2 : 1);
  const speed = st.speed * w.stats.projSpeed;
  const heart = (a: number): void => {
    const i = w.spawnProjectile(PK_HEART, slot, p.x, p.y, Math.cos(a) * speed, Math.sin(a) * speed, 1.4, st.damage, st.radius * size, 0, PF_CHARM);
    if (i >= 0) {
      w.pr.pa[i] = secs;
      w.pr.pb[i] = st.amount;
    }
  };
  let fired = 0;
  for (let k = 0; k < count; k++) {
    const j = w.randomEnemyNear(340);
    if (j < 0) break;
    heart(Math.atan2(E.y[j] - p.y, E.x[j] - p.x));
    fired++;
  }
  if (ps.attr === 'lovestorm' && fired > 0) {
    const off = w.rng.next() * TAU;
    for (let k = 0; k < 6; k++) heart(off + (k / 6) * TAU);
  }
  if (fired === 0) {
    ps.timer = 0.3;
    return;
  }
  ps.timer = cooldown(w, st.cooldown);
  w.sound('charm');
}

// -------------------------------------------------------------- The Power

/** A fist slams the nearest enemy and a shockwave cone rolls on behind it. One-Two throws a second punch. */
export function castPunch(w: World, ps: PowerState): void {
  if (ps.counter > 0) {
    ps.timer2 -= DT;
    if (ps.timer2 > 0) return;
    ps.counter--;
    punch(w, ps);
    return;
  }
  ps.timer -= DT;
  if (ps.timer > 0) return;
  const titan = ps.attr === 'titan';
  ps.timer = cooldown(w, ps.stats.cooldown * (titan ? 1.3 : 1));
  if (!punch(w, ps)) {
    ps.timer = 0.2;
    return;
  }
  if (ps.attr === 'onetwo') {
    ps.counter = 1;
    ps.timer2 = 0.22;
  }
}

function punch(w: World, ps: PowerState): boolean {
  const st = ps.stats;
  const titan = ps.attr === 'titan';
  const size = st.size * w.stats.size * (titan ? 1.5 : 1);
  const reach = st.radius * size;
  // The fist itself only reaches what is close; the shockwave carries on.
  const t = w.nearestEnemy(Math.min(reach, 170));
  if (t < 0) return false;
  const p = w.player;
  const E = w.en;
  const aim = Math.atan2(E.y[t] - p.y, E.x[t] - p.x);
  const dmg = st.damage * (titan ? 2 : 1);
  w.damageEnemy(t, dmg * 0.5, 0, p.x, p.y);
  const quake = ps.attr === 'quake';
  const n = enemiesInArc(w, p.x, p.y, aim, reach, st.amount);
  for (let k = 0; k < n; k++) {
    const j = w.qout[k];
    w.damageEnemy(j, dmg, 240, p.x, p.y);
    if (quake && !E.dead[j]) w.applyHold(j, 0.8, HOLD_STUN);
  }
  const cos = Math.cos(aim);
  const sin = Math.sin(aim);
  w.spawnFx(FX_FIST, p.x + cos * 12, p.y + sin * 12, cos * 520, sin * 520, 0.13, 34 * size, 40 * size, 1, aim, 0, 0xffffff, 0);
  w.spawnFx(FX_CRESCENT, p.x + cos * reach * 0.55, p.y + sin * reach * 0.55, cos * 120, sin * 120, 0.3, reach * 0.9, reach * 1.1, 0.9, aim, 0, 0xffd9a0, LAYER_ADD);
  w.shake = Math.max(w.shake, 3);
  w.sound('punch');
  return true;
}

// ------------------------------------------------------------ The Yourself

/** How far from you the doubles stand. */
export const DOUBLE_RING = 46;

export function doubleCount(w: World, ps: PowerState): number {
  return ps.stats.count + w.stats.count + (ps.attr === 'legion' ? 2 : 0);
}

/** Where double k of n stands right now, written to w.tx/w.ty. */
export function doubleAt(w: World, ps: PowerState, k: number, n: number, px = w.player.x, py = w.player.y): void {
  const a = ps.angle + (k / n) * TAU;
  w.tx = px + Math.cos(a) * DOUBLE_RING;
  w.ty = py + Math.sin(a) * DOUBLE_RING;
}

/** Doubles step out for a while and fire arrows of their own, then rest. Mirror Image keeps them out for good. */
export function castDouble(w: World, ps: PowerState, slot: number): void {
  const st = ps.stats;
  ps.angle += 0.8 * DT;
  if (ps.active > 0) {
    if (ps.attr !== 'mirror') {
      ps.active -= DT;
      if (ps.active <= 0) {
        ps.active = 0;
        ps.timer = cooldown(w, st.cooldown);
        return;
      }
    }
    ps.timer2 -= DT;
    if (ps.timer2 > 0) return;
    ps.timer2 = cooldown(w, st.tick);
    const n = doubleCount(w, ps);
    const perfect = ps.attr === 'perfect';
    const size = st.size * w.stats.size;
    const speed = st.speed * w.stats.projSpeed;
    const E = w.en;
    let fired = 0;
    for (let k = 0; k < n; k++) {
      doubleAt(w, ps, k, n);
      const x = w.tx;
      const y = w.ty;
      const j = w.grid.nearest(x, y, 380, E.x, E.y, w.isAlive);
      if (j < 0) continue;
      const aim = Math.atan2(E.y[j] - y, E.x[j] - x);
      const shots = perfect ? 3 : 1;
      for (let s = 0; s < shots; s++) {
        const a = aim + (s - (shots - 1) / 2) * 0.14;
        w.spawnProjectile(PK_ARROW, slot, x, y, Math.cos(a) * speed, Math.sin(a) * speed, 1.2, st.damage, st.radius * size, st.pierce + (perfect ? 2 : 0), 0);
      }
      fired++;
    }
    if (fired > 0) w.sound('shoot');
    return;
  }
  ps.timer -= DT;
  if (ps.timer > 0) return;
  ps.active = ps.attr === 'mirror' ? Infinity : st.duration * w.stats.duration;
  ps.timer2 = 0.25;
  const n = doubleCount(w, ps);
  for (let k = 0; k < n; k++) {
    doubleAt(w, ps, k, n);
    w.spawnFx(FX_GLOW, w.tx, w.ty, 0, 0, 0.35, 20, 70, 0.8, 0, 0, 0x9fd0ff, LAYER_ADD);
  }
  w.sound('blade');
}

// ------------------------------------------------------------- The Zombie

/** Blood bolts infect; World.killEnemy raises the infected that die while it lasts. */
export function castZombie(w: World, ps: PowerState, slot: number): void {
  const st = ps.stats;
  // Hand the zombies' numbers to the world, which raises them.
  const horde = ps.attr === 'horde';
  w.zombieLife = st.amount * w.stats.duration;
  w.zombieDps = st.damage * 1.6;
  w.zombieMax = horde ? 16 : 8;
  w.zombieFull = horde;
  w.zombiePlague = ps.attr === 'plague';
  w.zombieBurst = ps.attr === 'bloodburst';
  ps.timer -= DT;
  if (ps.timer > 0) return;
  const p = w.player;
  const E = w.en;
  const count = st.count + w.stats.count;
  const size = st.size * w.stats.size;
  const speed = st.speed * w.stats.projSpeed;
  const secs = st.duration * w.stats.duration;
  let fired = 0;
  for (let k = 0; k < count; k++) {
    const j = w.randomEnemyNear(320);
    if (j < 0) break;
    const a = Math.atan2(E.y[j] - p.y, E.x[j] - p.x) + w.rng.range(-0.08, 0.08);
    const i = w.spawnProjectile(PK_BLOOD, slot, p.x, p.y, Math.cos(a) * speed, Math.sin(a) * speed, 1.2, st.damage, st.radius * size, 0, PF_INFECT);
    if (i >= 0) w.pr.pa[i] = secs;
    fired++;
  }
  if (fired === 0) {
    ps.timer = 0.25;
    return;
  }
  ps.timer = cooldown(w, st.cooldown);
  w.sound('thorn');
}
