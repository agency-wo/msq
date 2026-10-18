import { DT } from '../../config';
import { FX_GLOW, FX_RING, FX_STAR, FX_WINGS, LAYER_ADD } from '../constants';
import type { PowerState } from '../powers';
import type { World } from '../world';
import { cooldown } from './common';

/** The Iron: keeps shield charges topped up; World.hurtPlayer spends them. */
export function castIron(w: World, ps: PowerState): void {
  const st = ps.stats;
  w.shieldMax = st.count;
  w.ironBurst = st.damage;
  if (w.shieldCharges >= w.shieldMax) {
    ps.timer = cooldown(w, st.cooldown);
    return;
  }
  ps.timer -= DT;
  if (ps.timer > 0) return;
  w.shieldCharges++;
  ps.timer = cooldown(w, st.cooldown);
  w.spawnFx(FX_RING, 0, 0, 0, 0, 0.3, 60, 30, 0.9, 0, 0, 0xdfe7f2, LAYER_ADD, 0, 1);
  w.sound('shield');
}

/** The Superstar: every so often the crowd cheers and your damage goes up for a few seconds. */
export function castSuperstar(w: World, ps: PowerState): void {
  ps.timer -= DT;
  if (ps.timer > 0) return;
  const st = ps.stats;
  ps.timer = cooldown(w, st.cooldown);
  w.superT = st.duration * w.stats.duration;
  w.superAmt = st.amount;
  w.spawnFx(FX_GLOW, 0, 0, 0, 0, 0.5, 40, 180, 0.8, 0, 0, 0xffd27a, LAYER_ADD, 0, 1);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    w.spawnFx(FX_STAR, Math.cos(a) * 26, Math.sin(a) * 26, Math.cos(a) * 60, Math.sin(a) * 60 - 40, 0.8, 16, 6, 1, a, 4, 0xffe08a, LAYER_ADD, 1.5, 1);
  }
  w.sound('level');
}

/** The Overkill: hands its numbers to the world, which adds damage per stack of kills. */
export function castOverkill(w: World, ps: PowerState): void {
  if (ps.counter === 0) {
    ps.counter = 1;
    w.overkillStart = w.kills;
  }
  const st = ps.stats;
  w.overkillEvery = Math.max(1, st.count);
  w.overkillPer = st.damage;
  w.overkillCap = st.amount;
}

/** The Balance: hands its numbers to the world; World.hurtPlayer applies them. */
export function castBalance(w: World, ps: PowerState): void {
  const st = ps.stats;
  w.balanceCut = st.amount;
  w.balanceDmg = st.damage;
  w.balanceR = st.radius * w.stats.size;
}

/** The Miracle: hands its numbers to the world; World.updateBuffs scales damage with health lost. */
export function castMiracle(w: World, ps: PowerState): void {
  const st = ps.stats;
  w.miracleAmt = st.amount;
  w.miracleRegen = st.damage;
}

/** Quincy: Vollständig: wings of light, saved for when enemies are actually close. */
export function castVollstandig(w: World, ps: PowerState): void {
  ps.timer -= DT;
  if (ps.timer > 0) return;
  if (w.nearestEnemy(150) < 0) {
    ps.timer = 0.5;
    return;
  }
  const st = ps.stats;
  // Its own cooldown is not halved by itself.
  ps.timer = Math.max(5, st.cooldown * (1 - w.stats.cdr));
  const dur = st.duration * w.stats.duration;
  w.vollT = dur;
  w.messages.push({ text: 'Quincy: Vollständig', kind: 'info' });
  w.spawnFx(FX_WINGS, 0, -6, 0, 0, dur, 120, 120, 0.9, 0, 0, 0xcfefff, LAYER_ADD, 0, 1);
  w.spawnFx(FX_RING, 0, 0, 0, 0, 0.5, 30, 340, 1, 0, 0, 0xbfe6ff, LAYER_ADD, 0, 1);
  w.sound('bankai');
}
