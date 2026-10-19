import { DT } from '../../config';
import { DOT_FIRE, FLAG_BOSS, FX_GLOW, FX_RING, FX_STAR, LAYER_ADD, MF_ENEMY } from '../constants';
import type { PowerState } from '../powers';
import type { World } from '../world';
import { enemiesInCircle } from './common';
import { DOUBLE_RING, doubleCount } from './schrift2';

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
  // The Other Half and Tenchi Kaijin strike harder; Tenchi Kaijin also burns what it strikes.
  const otherHalf = w.resonances.has('otherhalf');
  const zanka = w.resonances.has('tenchikaijin') ? w.power('zanka') : undefined;
  const mul = (otherHalf ? 1.3 : 1) * (zanka ? 1.2 : 1);
  for (let i = 0; i < E.n; i++) {
    if (E.dead[i] || E.charmT[i] > 0) continue;
    if (Math.abs(E.x[i] - p.x) > hw || Math.abs(E.y[i] - p.y) > hh) continue;
    const extra = E.flags[i] & FLAG_BOSS ? (E.maxHp[i] * w.almightyBoss) / Math.max(0.01, w.dmgMul) : 0;
    w.damageEnemy(i, (w.almightyDmg + extra) * mul, 0, p.x, p.y, true);
    if (zanka && !E.dead[i]) w.applyDot(i, 4, zanka.stats.damage * 0.4, DOT_FIRE);
  }
  if (otherHalf) w.heal(0.25);
  if (w.resonances.has('bodydouble')) bodyDoubles(w);
  if (zanka) w.spawnFx(FX_GLOW, 0, 0, 0, 0, 0.6, 300, 1300, 0.7, 0, 0, 0xff7a3c, LAYER_ADD, 0, 1);
  w.spawnFx(FX_RING, 0, 0, 0, 0, 0.6, 60, 1300, 1, 0, 0, 0xffffff, LAYER_ADD, 0, 1);
  w.spawnFx(FX_GLOW, 0, 0, 0, 0, 0.45, 300, 1400, 0.8, 0, 0, 0xffe6a0, LAYER_ADD, 0, 1);
  w.shake = Math.max(w.shake, 12);
  w.sound('blast');
}

/** Body Double: when the future is rewritten, each of The Yourself's doubles strikes everything around it. */
function bodyDoubles(w: World): void {
  const ps = w.power('yourself');
  if (!ps || ps.active <= 0) return;
  const p = w.player;
  const n = doubleCount(w, ps);
  for (let k = 0; k < n; k++) {
    const a = ps.angle + (k / n) * Math.PI * 2;
    const x = p.x + Math.cos(a) * DOUBLE_RING;
    const y = p.y + Math.sin(a) * DOUBLE_RING;
    const m = enemiesInCircle(w, x, y, 150);
    for (let q = 0; q < m; q++) w.damageEnemy(w.qout[q], w.almightyDmg * 0.5, 0, x, y, true);
    w.spawnFx(FX_RING, x, y, 0, 0, 0.5, 30, 320, 0.9, 0, 0, 0xffe6a0, LAYER_ADD);
  }
}
