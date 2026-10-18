import { DT } from '../../config';
import { TAU } from '../../core/math';
import {
  FX_AVATAR,
  FX_MISSILE,
  FX_PETAL,
  LAYER_ADD,
  MF_BURN,
  MF_CRATER,
  MF_FREEZE,
  MK_FIRE,
  MK_ICE,
  MK_MISSILE,
  MK_PILLAR,
  MK_SLASH,
  MS_ARC,
  MS_CIRCLE,
  MS_LINE,
  PF_FREEZE,
  PK_DRAGON,
  PK_PETAL,
  ZF_FOLLOW,
  ZF_PULL,
  ZK_HEAT,
  ZK_PETALS,
} from '../constants';
import type { PowerState } from '../powers';
import type { World } from '../world';
import { cooldown, densestPoint } from './common';
import { strikeAt } from './schrift';

// ------------------------------------------------- Senbonzakura Kageyoshi

/** Petals orbit you like blades; every cooldown they converge on the thickest crowd. */
export function castSenbonzakura(w: World, ps: PowerState): void {
  ps.angle += 1.7 * DT;
  ps.timer -= DT;
  if (ps.timer > 0) return;
  const st = ps.stats;
  ps.timer = cooldown(w, st.cooldown);
  if (!densestPoint(w, 320)) {
    ps.timer = 0.5;
    return;
  }
  const size = st.size * w.stats.size;
  w.spawnZone(ZK_PETALS, w.tx, w.ty, 0, 0, st.radius * size, st.duration * w.stats.duration, st.tick, st.damage * 1.4, ZF_PULL, 160);
  const p = w.player;
  const dx = w.tx - p.x;
  const dy = w.ty - p.y;
  for (let k = 0; k < 18; k++) {
    const spread = w.rng.range(-30, 30);
    w.spawnFx(FX_PETAL, w.rng.range(-20, 20), w.rng.range(-20, 20), dx * 2.6 + spread, dy * 2.6 - spread, 0.38, 10, 8, 1, w.rng.next() * TAU, w.rng.range(-8, 8), 0xffc2d6, LAYER_ADD, 0, 1);
  }
  w.sound('blade');
}

export function respawnPetals(w: World, slot: number): void {
  const ps = w.powers[slot];
  ps.active = Infinity;
  w.clearKind(slot, PK_PETAL);
  const st = ps.stats;
  const size = st.size * w.stats.size;
  const n = st.count + w.stats.count * 4;
  for (let k = 0; k < n; k++) {
    const ring = (46 + (k % 3) * 28 + w.rng.next() * 12) * size;
    w.spawnOrbiter(PK_PETAL, slot, (k / n) * TAU * 3 + w.rng.next() * 0.3, k % 2 === 0 ? ring : -ring, st.damage, 7 * size, 0);
  }
}

// ---------------------------------------------------- Daiguren Hyōrinmaru

/** Ice dragons fly through the swarm, freezing what they touch; every third cast, ice pillars ring you. */
export function castHyorinmaru(w: World, ps: PowerState, slot: number): void {
  ps.timer -= DT;
  if (ps.timer > 0) return;
  const st = ps.stats;
  ps.timer = cooldown(w, st.cooldown);
  const p = w.player;
  const E = w.en;
  const size = st.size * w.stats.size;
  const count = st.count + w.stats.count;
  for (let k = 0; k < count; k++) {
    const j = w.randomEnemyNear(380);
    const a = j >= 0 ? Math.atan2(E.y[j] - p.y, E.x[j] - p.x) : w.rng.next() * TAU;
    const i = w.spawnProjectile(PK_DRAGON, slot, p.x, p.y, Math.cos(a) * st.speed, Math.sin(a) * st.speed, 2, st.damage, st.radius * size, 999, PF_FREEZE);
    if (i >= 0) w.pr.pa[i] = st.duration;
  }
  ps.counter++;
  if (ps.counter % 3 === 0) {
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU;
      w.spawnMark(MK_ICE, MS_CIRCLE, p.x + Math.cos(a) * 120, p.y + Math.sin(a) * 120, 46 * size, 0, 0, 0.35, st.damage * 0.8, MF_FREEZE);
    }
  }
  w.sound('freeze');
}

// ------------------------------------------------------- Jakuhō Raikōben

/** A colossal missile on the thickest crowd: warning circle, impact, burning crater. */
export function castRaikoben(w: World, ps: PowerState): void {
  ps.timer -= DT;
  if (ps.timer > 0) return;
  const st = ps.stats;
  ps.timer = cooldown(w, st.cooldown);
  const size = st.size * w.stats.size;
  let fired = 0;
  for (let k = 0; k < st.count; k++) {
    let x: number;
    let y: number;
    if (k === 0 && densestPoint(w, 420)) {
      x = w.tx;
      y = w.ty;
    } else {
      const j = w.randomEnemyNear(420);
      if (j < 0) break;
      x = w.en.x[j];
      y = w.en.y[j];
    }
    w.spawnMark(MK_MISSILE, MS_CIRCLE, x, y, st.radius * size, 0, 0, st.duration, st.damage, MF_CRATER);
    w.spawnFx(FX_MISSILE, x, y - 420, 0, 420 / st.duration, st.duration, 70, 70, 1, Math.PI / 2, 0, 0xffe2a0, LAYER_ADD);
    fired++;
  }
  if (fired === 0) ps.timer = 0.4;
  else w.sound('warn');
}

// --------------------------------------------------- Kokujō Tengen Myō'ō

/** A giant armored warrior rises behind you and cleaves a huge arc toward the nearest enemy. */
export function castTengen(w: World, ps: PowerState): void {
  ps.timer -= DT;
  if (ps.timer > 0) return;
  const st = ps.stats;
  const size = st.size * w.stats.size;
  const reach = st.radius * size;
  const t = w.nearestEnemy(reach * 1.05);
  if (t < 0) {
    ps.timer = 0.3;
    return;
  }
  ps.timer = cooldown(w, st.cooldown);
  const p = w.player;
  const aim = Math.atan2(w.en.y[t] - p.y, w.en.x[t] - p.x);
  w.spawnMark(MK_SLASH, MS_ARC, p.x, p.y, reach, st.amount, aim, 0.25, st.damage, 0);
  w.spawnFx(FX_AVATAR, -Math.cos(aim) * 30, -Math.sin(aim) * 30 - 40, 0, 0, 0.9, 150 * size, 150 * size, 0.85, 0, 0, 0xd9c089, LAYER_ADD, 0, 1);
  w.sound('blast');
}

// ------------------------------------------------------ Kōkō Gonryō Rikyū

/** Bolts keep striking enemies on screen; every cooldown, pillars of lightning ring you. */
export function castGonryo(w: World, ps: PowerState): void {
  const st = ps.stats;
  const size = st.size * w.stats.size;
  ps.timer2 -= DT;
  if (ps.timer2 <= 0) {
    ps.timer2 = Math.max(0.06, st.tick * (1 - w.stats.cdr) * (w.vollT > 0 ? 0.5 : 1));
    const j = w.randomEnemyNear(340);
    if (j >= 0) strikeAt(w, w.en.x[j], w.en.y[j], st.damage, st.radius * size, null);
  }
  ps.timer -= DT;
  if (ps.timer > 0) return;
  ps.timer = cooldown(w, st.cooldown);
  const p = w.player;
  const n = st.count + w.stats.count * 2;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU;
    w.spawnMark(MK_PILLAR, MS_CIRCLE, p.x + Math.cos(a) * 130, p.y + Math.sin(a) * 130, 44 * size, 0, 0, 0.35 + (k % 2) * 0.1, st.damage * 1.6, 0);
  }
  w.sound('strike');
}

// ----------------------------------------------------------- Zanka no Tachi

/** A blade of fire along a long line toward the nearest enemy; the heat aura is a zone kept by syncHeatAura. */
export function castZanka(w: World, ps: PowerState): void {
  ps.timer -= DT;
  if (ps.timer > 0) return;
  const st = ps.stats;
  ps.timer = cooldown(w, st.cooldown);
  const p = w.player;
  const t = w.nearestEnemy(600);
  const aim = t >= 0 ? Math.atan2(w.en.y[t] - p.y, w.en.x[t] - p.x) : w.aim;
  w.spawnMark(MK_FIRE, MS_LINE, p.x, p.y, st.radius * st.size * w.stats.size, 900, aim, 0.12, st.damage, MF_BURN);
  w.sound('fire');
}

export function syncHeatAura(w: World, slot: number): void {
  const ps = w.powers[slot];
  const Z = w.zones;
  for (let i = Z.n - 1; i >= 0; i--) if (Z.kind[i] === ZK_HEAT && Z.src[i] === slot) Z.remove(i);
  const st = ps.stats;
  const p = w.player;
  w.spawnZone(ZK_HEAT, p.x, p.y, 0, 0, 85 * st.size * w.stats.size, 1e9, st.tick, st.amount, ZF_FOLLOW, 0, slot);
}
