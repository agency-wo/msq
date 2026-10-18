import { DT } from '../config';
import { TAU } from '../core/math';
import { POWER_MAX_LEVEL, type PowerDef, type PowerStats } from '../data/powers';
import {
  FLAG_BOSS,
  FX_BEAM,
  FX_BOLT,
  FX_GLOW,
  FX_RING,
  LAYER_ADD,
  PF_SPECIAL,
  PK_ARROW,
} from './constants';
import type { World } from './world';

/** Runtime state of one owned power. */
export interface PowerState {
  def: PowerDef;
  level: number;
  /** Lv 7 attribute id, or null below Lv 7. */
  attr: string | null;
  stats: PowerStats;
  timer: number;
  counter: number;
  /** Orbit powers: current spin angle. */
  angle: number;
  /** Orbit powers: seconds the blades stay out (Infinity for Eternal); 0 while resting. */
  active: number;
}

export function computePowerStats(def: PowerDef, level: number): PowerStats {
  const s: PowerStats = { ...def.base };
  const top = Math.min(level, POWER_MAX_LEVEL - 1);
  for (let l = 2; l <= top; l++) {
    const add = def.levels[l - 2]?.add;
    if (!add) continue;
    for (const key of Object.keys(add) as (keyof PowerStats)[]) s[key] += add[key] ?? 0;
  }
  return s;
}

export function newPowerState(def: PowerDef): PowerState {
  return { def, level: 1, attr: null, stats: computePowerStats(def, 1), timer: 0.35, counter: 0, angle: 0, active: 0 };
}

export function refreshPowerStats(ps: PowerState): void {
  ps.stats = computePowerStats(ps.def, ps.level);
}

export function updatePowers(w: World): void {
  for (let slot = 0; slot < w.powers.length; slot++) {
    const ps = w.powers[slot];
    switch (ps.def.kind) {
      case 'bolt':
        castBolt(w, ps, slot);
        break;
      case 'orbit':
        castOrbit(w, ps, slot);
        break;
      case 'pulse':
        castPulse(w, ps);
        break;
      case 'strike':
        castStrike(w, ps);
        break;
    }
  }
}

function cooldown(w: World, base: number): number {
  return Math.max(0.05, base * (1 - w.stats.cdr));
}

/** Projectile at the nearest enemy (the Magic Bolt archetype). */
function castBolt(w: World, ps: PowerState, slot: number): void {
  ps.timer -= DT;
  if (ps.timer > 0) return;
  // Close range on purpose: kills (and their mana) land where you can reach them.
  const target = w.nearestEnemy(380);
  if (target < 0) {
    ps.timer = 0.1;
    return;
  }
  const st = ps.stats;
  ps.timer = cooldown(w, st.cooldown);
  const p = w.player;
  const E = w.en;
  const aim = Math.atan2(E.y[target] - p.y, E.x[target] - p.x);
  const lancer = ps.attr === 'lancer';
  const speed = st.speed * w.stats.projSpeed * (lancer ? 1.4 : 1);
  const size = st.size * w.stats.size * (lancer ? 1.25 : 1);
  const pierce = lancer ? 999 : st.pierce;
  const life = st.duration * w.stats.duration;
  const flags = ps.attr === 'detonate' ? PF_SPECIAL : 0;
  const count = st.count + w.stats.count;
  for (let k = 0; k < count; k++) {
    const a = aim + (k - (count - 1) / 2) * 0.13;
    w.spawnProjectile(PK_ARROW, slot, p.x, p.y, Math.cos(a) * speed, Math.sin(a) * speed, life, st.damage, st.radius * size, pierce, flags);
  }
  if (ps.attr === 'volley') {
    for (let k = 0; k < 4; k++) {
      const a = aim + (k - 1.5) * 0.42;
      w.spawnProjectile(PK_ARROW, slot, p.x, p.y, Math.cos(a) * speed, Math.sin(a) * speed, life, st.damage * 0.7, st.radius * size, pierce, flags);
    }
  }
  w.sound('shoot');
}

/** Blades orbiting the player (the Satellite archetype). */
function castOrbit(w: World, ps: PowerState, slot: number): void {
  const st = ps.stats;
  ps.angle += st.speed * DT;
  if (ps.active > 0) {
    if (ps.attr !== 'eternal') {
      ps.active -= DT;
      if (ps.active <= 0) {
        ps.active = 0;
        ps.timer = cooldown(w, st.cooldown);
        w.clearBlades(slot);
      }
    }
    return;
  }
  ps.timer -= DT;
  if (ps.timer > 0) return;
  ps.active = ps.attr === 'eternal' ? Infinity : st.duration * w.stats.duration;
  respawnBlades(w, slot);
  w.sound('blade');
}

/** Replace a power's blades, e.g. after a level-up changed their number. */
export function respawnBlades(w: World, slot: number): void {
  const ps = w.powers[slot];
  const st = ps.stats;
  w.clearBlades(slot);
  const n = st.count + w.stats.count;
  const size = st.size * w.stats.size;
  const ring = st.radius * size;
  const flags = ps.attr === 'razor' ? PF_SPECIAL : 0;
  for (let k = 0; k < n; k++) w.spawnBlade(slot, (k / n) * TAU, ring, st.damage, 10 * size, flags);
  if (ps.attr === 'twin') {
    // A negative ring radius spins the other way.
    for (let k = 0; k < n; k++) w.spawnBlade(slot, (k / n) * TAU + Math.PI / n, -ring * 1.6, st.damage, 10 * size, flags);
  }
}

/** A damage ring pulsing out from the player (the Electric Zone archetype). */
function castPulse(w: World, ps: PowerState): void {
  ps.timer -= DT;
  if (ps.timer > 0) return;
  const st = ps.stats;
  ps.timer = cooldown(w, st.cooldown);
  ps.counter++;
  const R = st.radius * st.size * w.stats.size;
  const over = ps.attr === 'overcharge' && ps.counter % 4 === 0;
  const dmg = st.damage * (over ? 5 : 1);
  const knock = ps.attr === 'repel' ? 260 : 25;
  const frost = ps.attr === 'frost';
  const p = w.player;
  const E = w.en;
  const buf = w.qbuf;
  const n = w.grid.query(p.x - R - 46, p.y - R - 46, p.x + R + 46, p.y + R + 46, buf);
  for (let k = 0; k < n; k++) {
    const j = buf[k];
    if (E.dead[j]) continue;
    const dx = E.x[j] - p.x;
    const dy = E.y[j] - p.y;
    const rr = R + E.r[j];
    if (dx * dx + dy * dy > rr * rr) continue;
    w.damageEnemy(j, dmg, knock, p.x, p.y);
    if (frost && !E.dead[j]) {
      E.slowT[j] = 1.5;
      E.slowK[j] = 0.45;
    }
  }
  const tint = over ? 0xffffff : frost ? 0x9fdcff : 0xb69cff;
  w.spawnFx(FX_RING, 0, 0, 0, 0, 0.32, R * 0.6, R * 2, over ? 1 : 0.8, 0, 0, tint, LAYER_ADD, 0, 1);
  w.sound('pulse');
}

/** Pillars of light on random nearby enemies (the Thunderstorm archetype). */
function castStrike(w: World, ps: PowerState): void {
  ps.timer -= DT;
  if (ps.timer > 0) return;
  const st = ps.stats;
  ps.timer = cooldown(w, st.cooldown);
  const count = st.count + w.stats.count + (ps.attr === 'tempest' ? 4 : 0);
  const R = st.radius * st.size * w.stats.size;
  let fired = 0;
  for (let k = 0; k < count; k++) {
    const j = w.randomEnemyNear(300);
    if (j < 0) break;
    strikeAt(w, w.en.x[j], w.en.y[j], st.damage, R, ps.attr);
    fired++;
  }
  if (fired === 0) ps.timer = 0.25;
  else w.sound('strike');
}

/** One pillar of light: area damage plus the Lv 7 attribute effects. Also used by the Wild Sigil relic. */
export function strikeAt(w: World, x: number, y: number, dmg: number, R: number, attr: string | null): void {
  const E = w.en;
  const buf = w.qbuf2;
  let n = w.grid.query(x - R - 46, y - R - 46, x + R + 46, y + R + 46, buf);
  for (let k = 0; k < n; k++) {
    const j = buf[k];
    if (E.dead[j]) continue;
    const dx = E.x[j] - x;
    const dy = E.y[j] - y;
    const rr = R + E.r[j];
    if (dx * dx + dy * dy > rr * rr) continue;
    w.damageEnemy(j, dmg, 40, x, y);
    if (attr === 'execute' && !E.dead[j] && !(E.flags[j] & FLAG_BOSS) && E.hp[j] < E.maxHp[j] * 0.2) w.killEnemy(j);
  }
  w.spawnFx(FX_BEAM, x, y, 0, 0, 0.3, R * 1.25, 0, 1, 0, 0, 0xfff3b8, LAYER_ADD);
  w.spawnFx(FX_GLOW, x, y, 0, 0, 0.3, R * 1.4, R * 2.8, 0.9, 0, 0, 0xfff0a0, LAYER_ADD);
  if (attr !== 'chain') return;
  // Arc to up to 3 other enemies within reach, for half damage.
  n = w.grid.query(x - 150, y - 150, x + 150, y + 150, buf);
  let arcs = 0;
  for (let k = 0; k < n && arcs < 3; k++) {
    const j = buf[(k * 7 + w.steps) % n];
    if (E.dead[j]) continue;
    const dx = E.x[j] - x;
    const dy = E.y[j] - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < (R + 6) * (R + 6) || d2 > 150 * 150) continue;
    w.damageEnemy(j, dmg * 0.5, 20, x, y);
    const len = Math.sqrt(d2);
    w.spawnFx(FX_BOLT, x + dx / 2, y + dy / 2, 0, 0, 0.18, len, len, 1, Math.atan2(dy, dx), 0, 0xfff6c8, LAYER_ADD, 0, 0, 14);
    arcs++;
  }
}
