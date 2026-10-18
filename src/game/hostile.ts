import { DT, PLAYER } from '../config';
import { TAU } from '../core/math';
import { BANKAI_IDS } from '../data/bankai';
import { ENEMY_LIST } from '../data/enemies';
import {
  EB_BALA,
  EB_ICE,
  EB_PETAL,
  EBF_SLOW,
  FX_AVATAR,
  FX_GLOW,
  FX_MISSILE,
  LAYER_ADD,
  MF_ENEMY,
  MF_FREEZE,
  MK_CERO,
  MK_FIRE,
  MK_ICE,
  MK_MISSILE,
  MK_PILLAR,
  MK_SLASH,
  MS_ARC,
  MS_CIRCLE,
  MS_LINE,
} from './constants';
import type { World } from './world';

/**
 * Everything that shoots back. Every boss attack leaves a warning on the
 * ground first (a mark), so a player who is watching can always step out.
 */

export function updateEnemyBullets(w: World): void {
  const B = w.eb;
  const p = w.player;
  for (let i = B.n - 1; i >= 0; i--) {
    B.life[i] -= DT;
    if (B.life[i] <= 0) {
      B.remove(i);
      continue;
    }
    B.ox[i] = B.x[i];
    B.oy[i] = B.y[i];
    B.x[i] += B.vx[i] * DT;
    B.y[i] += B.vy[i] * DT;
    const dx = p.x - B.x[i];
    const dy = p.y - B.y[i];
    const rr = B.r[i] + PLAYER.radius;
    if (dx * dx + dy * dy > rr * rr) continue;
    w.hurtPlayer(B.dmg[i]);
    if (B.flags[i] & EBF_SLOW) p.slowT = Math.max(p.slowT, 1.6);
    w.spawnFx(FX_GLOW, B.x[i], B.y[i], 0, 0, 0.2, B.r[i] * 2, B.r[i] * 5, 0.9, 0, 0, B.kind[i] === EB_ICE ? 0x8fd8ff : 0xff4d6a, LAYER_ADD);
    B.remove(i);
  }
}

/** Adjuchas (elites) spit a red Bala at you every few seconds while on screen. */
export function eliteAI(w: World, i: number, dist: number): void {
  const E = w.en;
  E.atkT[i] -= DT;
  if (E.atkT[i] > 0) return;
  E.atkT[i] = 3.6 + w.rng.next() * 1.6;
  if (dist > Math.max(w.viewHalfW, w.viewHalfH)) return;
  const p = w.player;
  const a = Math.atan2(p.y - E.y[i], p.x - E.x[i]);
  w.spawnEnemyBullet(EB_BALA, E.x[i], E.y[i], Math.cos(a) * 150, Math.sin(a) * 150, 6, 4, E.dmg[i] * 0.6);
}

export function bossAI(w: World, i: number, dist: number): void {
  const E = w.en;
  // Bosses only attack once they are on (or right next to) the screen.
  if (dist > Math.hypot(w.viewHalfW, w.viewHalfH) * 1.15) return;
  E.atkT[i] -= DT;
  E.atk2T[i] -= DT;
  const def = ENEMY_LIST[E.type[i]];
  if (def.id === 'bearer') {
    bearerAI(w, i, BANKAI_IDS[E.variant[i]] ?? '', dist);
  } else if (def.id === 'menos') {
    if (E.atkT[i] <= 0) {
      E.atkT[i] = 5;
      cero(w, i, 1.25, 48, 1.2);
    }
  } else if (def.id === 'vasto') {
    if (E.atkT[i] <= 0) {
      E.atkT[i] = 2.6;
      // Alternate a Cero and a ring of Bala.
      E.atk2T[i] = E.atk2T[i] > 0 ? -1 : 1;
      if (E.atk2T[i] > 0) cero(w, i, 1, 54, 1.1);
      else ring(w, i, 14, 170, 0.4);
    }
  }
}

function cero(w: World, i: number, delay: number, width: number, dmgMul: number): void {
  const E = w.en;
  const p = w.player;
  const a = Math.atan2(p.y - E.y[i], p.x - E.x[i]);
  w.spawnMark(MK_CERO, MS_LINE, E.x[i], E.y[i], width, 900, a, delay, E.dmg[i] * dmgMul, MF_ENEMY);
  w.sound('warn');
}

function ring(w: World, i: number, n: number, speed: number, dmgMul: number): void {
  const E = w.en;
  const off = w.rng.next() * TAU;
  for (let k = 0; k < n; k++) {
    const a = off + (k / n) * TAU;
    w.spawnEnemyBullet(EB_BALA, E.x[i], E.y[i], Math.cos(a) * speed, Math.sin(a) * speed, 7, 5, E.dmg[i] * dmgMul);
  }
}

/** Each bearer fights with the bankai it carries. */
function bearerAI(w: World, i: number, id: string, dist: number): void {
  const E = w.en;
  const p = w.player;
  const x = E.x[i];
  const y = E.y[i];
  const toP = Math.atan2(p.y - y, p.x - x);
  const dmg = E.dmg[i];
  switch (id) {
    case 'senbonzakura':
      if (E.atkT[i] <= 0) {
        // Three spiralling arms of petals.
        E.atkT[i] = 3.2;
        const base = w.t * 1.3;
        for (let arm = 0; arm < 3; arm++) {
          for (let k = 0; k < 6; k++) {
            const a = base + (arm * TAU) / 3 + k * 0.11;
            const spd = 120 + k * 16;
            w.spawnEnemyBullet(EB_PETAL, x, y, Math.cos(a) * spd, Math.sin(a) * spd, 6, 4, dmg * 0.28);
          }
        }
      }
      if (E.atk2T[i] <= 0) {
        // A fan of petals straight at you.
        E.atk2T[i] = 5.2;
        for (let k = 0; k < 9; k++) {
          const a = toP + (k - 4) * 0.11;
          w.spawnEnemyBullet(EB_PETAL, x, y, Math.cos(a) * 200, Math.sin(a) * 200, 6, 3.5, dmg * 0.3);
        }
      }
      break;
    case 'hyorinmaru':
      if (E.atkT[i] <= 0) {
        // An ice dragon that slows you if it connects.
        E.atkT[i] = 4;
        w.spawnEnemyBullet(EB_ICE, x, y, Math.cos(toP) * 185, Math.sin(toP) * 185, 16, 4, dmg * 0.7, EBF_SLOW);
      }
      if (E.atk2T[i] <= 0) {
        E.atk2T[i] = 6.5;
        for (let k = 0; k < 4; k++) {
          const a = w.rng.next() * TAU;
          const d = k === 0 ? 0 : 40 + w.rng.next() * 70;
          w.spawnMark(MK_ICE, MS_CIRCLE, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 42, 0, 0, 1.2, dmg * 0.6, MF_ENEMY | MF_FREEZE);
        }
        w.sound('warn');
      }
      break;
    case 'raikoben':
      if (E.atkT[i] <= 0) {
        E.atkT[i] = 5;
        w.spawnMark(MK_MISSILE, MS_CIRCLE, p.x, p.y, 110, 0, 0, 1.6, dmg * 1.2, MF_ENEMY);
        w.spawnFx(FX_MISSILE, p.x, p.y - 420, 0, 420 / 1.6, 1.6, 60, 60, 1, Math.PI / 2, 0, 0xffe2a0, LAYER_ADD);
        w.sound('warn');
      }
      break;
    case 'tengen':
      if (E.atkT[i] <= 0) {
        if (dist < 330) {
          E.atkT[i] = 4.5;
          w.spawnMark(MK_SLASH, MS_ARC, x, y, 270, 0.7, toP, 1.1, dmg * 1.1, MF_ENEMY);
          w.spawnFx(FX_AVATAR, x - Math.cos(toP) * 30, y - Math.sin(toP) * 30 - 50, 0, 0, 1.4, 170, 170, 0.75, 0, 0, 0xc9b58a, LAYER_ADD);
          w.sound('warn');
        } else {
          E.atkT[i] = 0.5;
        }
      }
      break;
    case 'gonryo':
      if (E.atkT[i] <= 0) {
        E.atkT[i] = 3.6;
        for (let k = 0; k < 5; k++) {
          const a = w.rng.next() * TAU;
          const d = k === 0 ? 0 : 50 + w.rng.next() * 80;
          w.spawnMark(MK_PILLAR, MS_CIRCLE, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 34, 0, 0, 0.9 + k * 0.12, dmg * 0.55, MF_ENEMY);
        }
        w.sound('warn');
      }
      break;
    case 'zanka':
      // The heat aura burns you up close (invulnerability frames pace it).
      if (dist < 95 + PLAYER.radius) w.hurtPlayer(dmg * 0.4);
      if (E.atkT[i] <= 0) {
        E.atkT[i] = 4;
        w.spawnMark(MK_FIRE, MS_LINE, x, y, 36, 760, toP, 1, dmg * 0.9, MF_ENEMY);
        w.sound('warn');
      }
      break;
  }
}
