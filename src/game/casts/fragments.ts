import { DT } from '../../config';
import { FLAG_BOSS, FX_BEAMH, FX_GLOW, FX_RING, FX_SHOCK, HOLD_STUN, LAYER_ADD } from '../constants';
import type { PowerState } from '../powers';
import type { World } from '../world';
import { cooldown, enemiesInCircle } from './common';

/**
 * Fragments of the Soul King, won from the Royal Guard. Each does one big
 * thing on its own rhythm rather than adding to the stream of attacks.
 */

/** Right Arm: a wave of stillness. Everything near you stops where it stands and is struck; bosses only slow. */
export function castStillness(w: World, ps: PowerState): void {
  ps.timer -= DT;
  if (ps.timer > 0) return;
  const st = ps.stats;
  ps.timer = cooldown(w, st.cooldown);
  const p = w.player;
  const E = w.en;
  const R = st.radius * w.stats.size;
  const n = enemiesInCircle(w, p.x, p.y, R);
  for (let k = 0; k < n; k++) {
    const j = w.qout[k];
    w.damageEnemy(j, st.damage, 0, p.x, p.y);
    if (E.dead[j]) continue;
    if (E.flags[j] & FLAG_BOSS) {
      E.slowT[j] = Math.max(E.slowT[j], st.duration);
      E.slowK[j] = Math.max(E.slowK[j], 0.6);
    } else {
      w.applyHold(j, st.duration, HOLD_STUN);
    }
  }
  w.spawnFx(FX_SHOCK, 0, 0, 0, 0, 0.5, R * 0.3, R * 2.1, 0.8, 0, 0, 0xfff2c2, LAYER_ADD, 0, 1);
  w.spawnFx(FX_RING, 0, 0, 0, 0, 0.6, R * 0.4, R * 2.1, 1, 0, 0, 0xffffff, LAYER_ADD, 0, 1);
  w.sound('freeze');
}

/** Left Arm: nerve threads seize the sturdiest enemies in reach, bind them, and leave them open to everything. */
export function castNerves(w: World, ps: PowerState): void {
  ps.timer -= DT;
  if (ps.timer > 0) return;
  const st = ps.stats;
  const p = w.player;
  const E = w.en;
  const n = enemiesInCircle(w, p.x, p.y, st.radius * w.stats.size);
  if (n === 0) {
    ps.timer = 0.5;
    return;
  }
  ps.timer = cooldown(w, st.cooldown);
  // The sturdiest first: bosses and elites are what the threads are for.
  const picks = Array.from(w.qout.subarray(0, n))
    .sort((a, b) => E.hp[b] - E.hp[a])
    .slice(0, st.count + w.stats.count);
  for (const j of picks) {
    const dx = E.x[j] - p.x;
    const dy = E.y[j] - p.y;
    const d = Math.hypot(dx, dy);
    w.spawnFx(FX_BEAMH, p.x + dx / 2, p.y + dy / 2, 0, 0, 0.4, d, d, 0.9, Math.atan2(dy, dx), 0, 0xe8d8ff, LAYER_ADD, 0, 0, 5);
    w.spawnFx(FX_GLOW, E.x[j], E.y[j], 0, 0, 0.45, E.r[j], E.r[j] * 3, 0.8, 0, 0, 0xd8b8ff, LAYER_ADD);
    w.damageEnemy(j, st.damage, 0, p.x, p.y);
    if (E.dead[j]) continue;
    w.applyHold(j, st.duration, HOLD_STUN);
    w.applyVuln(j, st.duration + 2, 0.4);
  }
  w.sound('shield');
}

/**
 * Heart: when your health falls below 30%, once per cooldown, it beats. You
 * cannot be hurt for a moment, half your health comes back, and everything
 * near you is struck and thrown back.
 */
export function castHeartSurge(w: World, ps: PowerState): void {
  if (ps.timer > 0) ps.timer -= DT;
  const p = w.player;
  if (ps.timer > 0 || !p.alive || p.hp >= p.maxHp * 0.3) return;
  const st = ps.stats;
  ps.timer = st.cooldown;
  p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.5);
  w.surgeT = Math.max(w.surgeT, st.duration);
  const R = st.radius * w.stats.size;
  const n = enemiesInCircle(w, p.x, p.y, R);
  for (let k = 0; k < n; k++) w.damageEnemy(w.qout[k], st.damage, 380, p.x, p.y);
  w.spawnFx(FX_GLOW, 0, 0, 0, 0, 0.9, 40, R * 2.6, 1, 0, 0, 0xffcf7a, LAYER_ADD, 0, 1);
  w.spawnFx(FX_SHOCK, 0, 0, 0, 0, 0.5, R * 0.3, R * 2.2, 0.85, 0, 0, 0xffe6a0, LAYER_ADD, 0, 1);
  w.spawnFx(FX_RING, 0, 0, 0, 0, 0.6, R * 0.4, R * 2.2, 1, 0, 0, 0xffffff, LAYER_ADD, 0, 1);
  w.shake = Math.max(w.shake, 10);
  w.messages.push({ text: 'The heart beats', kind: 'info' });
  w.sound('level');
}
