import { DT } from '../../config';
import { FLAG_BOSS, FX_GLOW, FX_RING, FX_STAR, LAYER_ADD, MF_ENEMY } from '../constants';
import type { PowerState } from '../powers';
import type { World } from '../world';

/**
 * A · The Almighty. Every cooldown, with enemies in sight: time stands still
 * for a moment (World.almightyT freezes every enemy, boss, bullet and warning),
 * then the future is rewritten in rewrite() below.
 */
export function castAlmighty(w: World, ps: PowerState): void {
  const st = ps.stats;
  w.foresight = 0.12;
  if (w.almightyT > 0) return;
  ps.timer -= DT;
  if (ps.timer > 0) return;
  if (w.nearestEnemy(Math.max(w.viewHalfW, w.viewHalfH)) < 0) {
    ps.timer = 0.5;
    return;
  }
  ps.timer = st.cooldown;
  w.almightyT = w.almightyMax = st.duration;
  w.almightyDmg = st.damage + st.amount * w.level;
  w.almightyBoss = st.count;
  w.spawnFx(FX_GLOW, 0, 0, 0, 0, st.duration, 200, 900, 0.5, 0, 0, 0xb8c8ff, LAYER_ADD, 0, 1);
  w.sound('almighty');
}

/** Time starts again in a future where the enemy fire never happened and everything on screen was struck down. */
export function rewrite(w: World): void {
  const p = w.player;
  const B = w.eb;
  for (let i = 0; i < B.n; i++) w.spawnFx(FX_STAR, B.x[i], B.y[i], 0, -20, 0.3, 10, 2, 0.9, 0, 4, 0xffe6a0, LAYER_ADD);
  B.n = 0;
  const M = w.marks;
  for (let i = M.n - 1; i >= 0; i--) if (M.flags[i] & MF_ENEMY) M.remove(i);
  const E = w.en;
  const hw = w.viewHalfW + 30;
  const hh = w.viewHalfH + 30;
  for (let i = 0; i < E.n; i++) {
    if (E.dead[i] || E.charmT[i] > 0) continue;
    if (Math.abs(E.x[i] - p.x) > hw || Math.abs(E.y[i] - p.y) > hh) continue;
    const extra = E.flags[i] & FLAG_BOSS ? (E.maxHp[i] * w.almightyBoss) / Math.max(0.01, w.dmgMul) : 0;
    w.damageEnemy(i, w.almightyDmg + extra, 0, p.x, p.y, true);
  }
  w.spawnFx(FX_RING, 0, 0, 0, 0, 0.6, 60, 1300, 1, 0, 0, 0xffffff, LAYER_ADD, 0, 1);
  w.spawnFx(FX_GLOW, 0, 0, 0, 0, 0.45, 300, 1400, 0.8, 0, 0, 0xffe6a0, LAYER_ADD, 0, 1);
  w.shake = Math.max(w.shake, 12);
  w.sound('blast');
}
