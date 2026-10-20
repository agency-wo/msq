import { TAU } from '../core/math';
import { ARRANCAR_BY_ID } from '../data/arrancar';
import { ENEMY_INDEX } from '../data/enemies';
import { EB_SWORD, EB_WAVE, FX_RING, LAYER_ADD, MF_ENEMY, MK_CERO, MK_FIRE, MK_SLASH, MS_ARC, MS_LINE } from './constants';
import { enemiesInCircle } from './casts/common';
import type { World } from './world';

/** Grimmjow's size once Pantera is released (the renderer switches to his released sprite). */
export const GRIMMJOW_RELEASED = 35;

/** Rudbornn's Exequias stop coming once this many stand on the field. */
const EXEQUIAS_CAP = 14;

/**
 * Las Noches' defenders, each fighting with what is canon for them, every
 * attack warned first; at half health each releases. Rudbornn: Árbol's
 * Calaveras rise around you, and while his soldiers stand close they take
 * the blows meant for him. Dordoni: Giralda's whirlwinds, a drilling kick, a
 * Cero. Cirucci: Golondrina's blade on its cord sweeping wide, thrown out
 * and reeled back, and a storm of razor feathers. Gantenbainne: Dragon
 * Rugir's fire, claws and a charge.
 */
export function arrancarAI(w: World, i: number, id: string): void {
  const E = w.en;
  const p = w.player;
  const x = E.x[i];
  const y = E.y[i];
  const toP = Math.atan2(p.y - y, p.x - x);
  const dmg = E.dmg[i];
  const memo = w.bossMemo(i);
  const late = E.hp[i] < E.maxHp[i] * 0.5;
  if (late && memo.phase === 0) {
    memo.phase = 1;
    E.atkT[i] = 1.2;
    const info = ARRANCAR_BY_ID.get(id);
    w.spawnFx(FX_RING, x, y, 0, 0, 0.6, 30, 320, 1, 0, 0, info?.aura ?? 0xffffff, LAYER_ADD);
    w.shake = Math.max(w.shake, 7);
    w.sound('bankai');
    if (info) w.messages.push({ text: info.release, kind: 'boss' });
    if (id === 'dordoni') E.spd[i] *= 1.4;
  }
  if (id === 'rudbornn' && w.steps % 15 === 0) {
    // His Exequias close ranks around him: while two or more stand near, half of every blow is theirs.
    const n = enemiesInCircle(w, x, y, 260);
    let guards = 0;
    for (let k = 0; k < n; k++) if (E.type[w.qout[k]] === ENEMY_INDEX.exequias && E.charmT[w.qout[k]] <= 0) guards++;
    memo.guard = guards >= 2 ? w.t + 0.3 : 0;
    memo.guardMul = 0.5;
  }
  if (E.atkT[i] > 0) return;
  const move = memo.move++ % 3;
  switch (id) {
    case 'rudbornn':
      E.atkT[i] = late ? 2.4 : 3;
      if (move === 0) {
        let standing = 0;
        for (let k = 0; k < E.n; k++) if (!E.dead[k] && E.type[k] === ENEMY_INDEX.exequias) standing++;
        const n = Math.min(late ? 8 : 5, Math.max(0, EXEQUIAS_CAP - standing));
        const off = w.rng.next() * TAU;
        for (let k = 0; k < n; k++) {
          const a = off + (k / n) * TAU;
          w.spawnEnemy(ENEMY_INDEX.exequias, p.x + Math.cos(a) * 210, p.y + Math.sin(a) * 210);
        }
        w.sound('rise');
      } else if (move === 1) {
        w.spawnMark(MK_CERO, MS_LINE, x, y, 44, 900, toP, 1, dmg * 1.1, MF_ENEMY);
        w.sound('warn');
      } else {
        const n = late ? 5 : 3;
        for (let k = 0; k < n; k++) {
          const a = toP + (k - (n - 1) / 2) * 0.3;
          w.spawnMark(MK_SLASH, MS_LINE, x, y, 26, 420, a, 0.75, dmg * 0.8, MF_ENEMY);
        }
        w.sound('warn');
      }
      break;
    case 'dordoni':
      E.atkT[i] = late ? 2 : 2.6;
      if (move === 0) {
        const n = late ? 4 : 2;
        for (let k = 0; k < n; k++) {
          const a = toP + (k - (n - 1) / 2) * 0.35;
          w.spawnEnemyBullet(EB_WAVE, x, y, Math.cos(a) * 150, Math.sin(a) * 150, 18, 4, dmg * 0.6);
        }
        w.sound('gust');
      } else if (move === 1) {
        w.spawnMark(MK_SLASH, MS_LINE, x, y, 44, 460, toP, 0.65, dmg * 1.1, MF_ENEMY);
        E.kx[i] = Math.cos(toP) * 1400;
        E.ky[i] = Math.sin(toP) * 1400;
        w.sound('warn');
      } else {
        w.spawnMark(MK_CERO, MS_LINE, x, y, late ? 56 : 44, 900, toP, 0.95, dmg * 1.1, MF_ENEMY);
        w.sound('warn');
      }
      break;
    case 'cirucci':
      E.atkT[i] = late ? 2 : 2.5;
      if (move === 0) {
        w.spawnMark(MK_SLASH, MS_ARC, x, y, 250, 0.55, toP, 0.8, dmg * 1.05, MF_ENEMY);
        w.sound('warn');
      } else if (move === 1) {
        const fans = late ? 3 : 1;
        for (let f = 0; f < fans; f++) {
          for (let k = -3; k <= 3; k++) {
            const a = toP + k * 0.13 + (f - (fans - 1) / 2) * 0.05;
            const sp = 190 + f * 35;
            w.spawnEnemyBullet(EB_SWORD, x, y, Math.cos(a) * sp, Math.sin(a) * sp, 7, 3.2, dmg * 0.4);
          }
        }
        w.sound('blade');
      } else {
        // The blade thrown out down a lane, and reeled back down the same one.
        w.spawnMark(MK_SLASH, MS_LINE, x, y, 30, 520, toP, 0.7, dmg, MF_ENEMY);
        w.spawnMark(MK_SLASH, MS_LINE, x, y, 30, 520, toP, 1.25, dmg, MF_ENEMY);
        w.sound('warn');
      }
      break;
    default:
      // Gantenbainne Mosqueda.
      E.atkT[i] = late ? 2.2 : 2.7;
      if (move === 0) {
        const n = late ? 3 : 1;
        for (let k = 0; k < n; k++) {
          const a = toP + (k - (n - 1) / 2) * 0.28;
          w.spawnMark(MK_FIRE, MS_LINE, x, y, 40, 640, a, 0.9, dmg, MF_ENEMY);
        }
        w.sound('fire');
      } else if (move === 1) {
        w.spawnMark(MK_SLASH, MS_ARC, x, y, 170, 0.9, toP, 0.7, dmg * 1.1, MF_ENEMY);
        w.sound('warn');
      } else {
        w.spawnMark(MK_SLASH, MS_LINE, x, y, 56, 440, toP, 0.7, dmg * 1.15, MF_ENEMY);
        E.kx[i] = Math.cos(toP) * 1300;
        E.ky[i] = Math.sin(toP) * 1300;
        w.sound('warn');
      }
      break;
  }
}

/**
 * Grimmjow Jaegerjaquez, the Sexta Espada. Desgarrón: five claws of blue
 * reiatsu rake toward you. Garra de la Pantera: his claws fired like darts.
 * Sonído: he is past you before you see him move. Gran Rey Cero: the
 * Espada's own Cero. Below half health he releases Pantera: bigger, faster,
 * the claws rake twice and the darts come in more.
 */
export function grimmjowAI(w: World, i: number): void {
  const E = w.en;
  const p = w.player;
  const x = E.x[i];
  const y = E.y[i];
  const dmg = E.dmg[i];
  const released = E.hp[i] < E.maxHp[i] * 0.5;
  if (released && E.r[i] < GRIMMJOW_RELEASED) {
    E.r[i] = GRIMMJOW_RELEASED;
    E.spd[i] *= 1.35;
    E.atkT[i] = 1;
    w.spawnFx(FX_RING, x, y, 0, 0, 0.6, 30, 340, 1, 0, 0, 0x59b8ff, LAYER_ADD);
    w.shake = Math.max(w.shake, 9);
    w.messages.push({ text: 'Grind, Pantera: Grimmjow releases', kind: 'boss' });
    w.sound('bankai');
  }
  if (E.atkT[i] > 0) return;
  const memo = w.bossMemo(i);
  const move = memo.move++ % 4;
  const toP = Math.atan2(p.y - y, p.x - x);
  E.atkT[i] = released ? 1.8 : 2.4;
  switch (move) {
    case 0: {
      const nx = -Math.sin(toP);
      const ny = Math.cos(toP);
      const rakes = released ? 2 : 1;
      for (let r = 0; r < rakes; r++) {
        for (let k = -2; k <= 2; k++) {
          const off = k * 26;
          w.spawnMark(MK_SLASH, MS_LINE, x + nx * off, y + ny * off, 18, 520, toP, 0.8 + r * 0.35, dmg * 0.7, MF_ENEMY);
        }
      }
      w.sound('warn');
      break;
    }
    case 1: {
      const n = released ? 14 : 8;
      for (let k = 0; k < n; k++) {
        const a = toP + (k / (n - 1) - 0.5) * 1;
        w.spawnEnemyBullet(EB_SWORD, x, y, Math.cos(a) * 260, Math.sin(a) * 260, 6, 3, dmg * 0.4);
      }
      w.sound('blade');
      break;
    }
    case 2:
      w.spawnMark(MK_SLASH, MS_LINE, x, y, 40, 480, toP, 0.5, dmg * 1.1, MF_ENEMY);
      E.kx[i] = Math.cos(toP) * 1500;
      E.ky[i] = Math.sin(toP) * 1500;
      w.sound('warn');
      break;
    default:
      w.spawnMark(MK_CERO, MS_LINE, x, y, released ? 80 : 64, 1000, toP, 1.1, dmg * 1.4, MF_ENEMY);
      w.sound('warn');
      break;
  }
}
