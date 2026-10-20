import { TAU } from '../core/math';
import { KARAKURA_BY_ID } from '../data/karakura';
import {
  EB_FIRE,
  FLAG_BOSS,
  EB_GETSUGA,
  FX_GLOW,
  FX_RING,
  LAYER_ADD,
  MF_ENEMY,
  MF_ROOT,
  MK_LANCE,
  MK_METEOR,
  MK_PILLAR,
  MK_SLASH,
  MK_THREAD,
  MS_CIRCLE,
  MS_LINE,
  ZF_ENEMY,
  ZK_FIRE,
} from './constants';
import type { World } from './world';

/** Orihime stops calling the fallen back once this many stand around her. */
const REJECTED_CAP = 40;

/**
 * Karakura Town's defenders, each with what is canon for them, every attack
 * warned first. Chad: El Directo down a lane, La Muerte where you stand, and
 * the Giant's arm raised as a shield. Orihime: Koten Zanshun's cut, Santen
 * Kesshun's shield, and Sōten Kisshun, which rejects the deaths of the
 * soldiers around her: they stand up again. Yoruichi: she flash-steps to
 * your side and strikes, Shunkō bursts around her, lightning punches march
 * at you. Isshin: Getsuga Tenshō, and Engetsu's fire laid in a wall across
 * your path that burns for a while.
 */
export function karakuraAI(w: World, i: number, id: string): void {
  const E = w.en;
  const p = w.player;
  const x = E.x[i];
  const y = E.y[i];
  const toP = Math.atan2(p.y - y, p.x - x);
  const dmg = E.dmg[i];
  const memo = w.bossMemo(i);
  if (E.hp[i] < E.maxHp[i] * 0.5 && memo.phase === 0) {
    memo.phase = 1;
    E.atkT[i] = 1.2;
    const info = KARAKURA_BY_ID.get(id);
    w.spawnFx(FX_RING, x, y, 0, 0, 0.6, 30, 320, 1, 0, 0, info?.aura ?? 0xffffff, LAYER_ADD);
    w.shake = Math.max(w.shake, 7);
    w.sound('bankai');
    if (info) w.messages.push({ text: info.late, kind: 'boss' });
    if (id === 'yoruichi') E.spd[i] *= 1.4;
  }
  // Once shown, it stays: Orihime heals herself back over half health and is still all six fairies.
  const late = memo.phase === 1;
  if (E.atkT[i] > 0) return;
  const move = memo.move++ % 3;
  switch (id) {
    case 'chad':
      E.atkT[i] = late ? 2.1 : 2.6;
      if (move === 0) {
        const n = late ? 3 : 1;
        for (let k = 0; k < n; k++) {
          const a = toP + (k - (n - 1) / 2) * 0.26;
          w.spawnMark(MK_LANCE, MS_LINE, x, y, 40, 700, a, 0.8, dmg, MF_ENEMY);
        }
      } else if (move === 1) {
        w.spawnMark(MK_METEOR, MS_CIRCLE, p.x, p.y, late ? 140 : 100, 0, 0, 1.4, dmg * 1.5, MF_ENEMY);
      } else {
        // The Giant's arm up: blows glance off it for a moment, and he shoulders forward behind it.
        memo.guard = w.t + 2.5;
        memo.guardMul = 0.4;
        w.spawnFx(FX_RING, x, y, 0, 0, 0.4, E.r[i] * 2.6, E.r[i] * 1.2, 1, 0, 0, 0xff7a6a, LAYER_ADD);
        w.spawnMark(MK_SLASH, MS_LINE, x, y, 48, 320, toP, 0.6, dmg, MF_ENEMY);
        E.kx[i] = Math.cos(toP) * 900;
        E.ky[i] = Math.sin(toP) * 900;
      }
      w.sound('warn');
      break;
    case 'orihime':
      E.atkT[i] = late ? 2.2 : 2.6;
      if (move === 0) {
        const n = late ? 3 : 1;
        for (let k = 0; k < n; k++) {
          const a = toP + (k - (n - 1) / 2) * 0.3;
          w.spawnMark(MK_SLASH, MS_LINE, x, y, 24, 600, a, 0.55, dmg, MF_ENEMY);
        }
        w.sound('warn');
      } else if (move === 1) {
        memo.guard = w.t + 2;
        memo.guardMul = 0.4;
        w.spawnFx(FX_RING, x, y, 0, 0, 0.5, E.r[i] * 1.2, E.r[i] * 2.8, 1, 0, 0, 0xffd27a, LAYER_ADD);
        w.sound('shield');
      } else {
        // Sōten Kisshun: she rejects what happened, and the fallen around her stand again.
        let standing = 0;
        for (let k = 0; k < E.n; k++) if (!E.dead[k] && !(E.flags[k] & FLAG_BOSS)) standing++;
        const n = Math.min(late ? 12 : 8, Math.max(0, REJECTED_CAP - standing));
        for (let k = 0; k < n; k++) {
          const a = w.rng.next() * TAU;
          const d = 60 + w.rng.next() * 120;
          const j = w.spawnEnemy(w.regularType(), x + Math.cos(a) * d, y + Math.sin(a) * d);
          if (j >= 0) w.spawnFx(FX_GLOW, E.x[j], E.y[j], 0, 0, 0.5, E.r[j], E.r[j] * 2.6, 0.7, 0, 0, 0xffd27a, LAYER_ADD);
        }
        E.hp[i] = Math.min(E.maxHp[i], E.hp[i] + E.maxHp[i] * 0.04);
        w.spawnFx(FX_RING, x, y, 0, 0, 0.7, 30, 420, 0.8, 0, 0, 0xffd27a, LAYER_ADD);
        w.sound('heal');
      }
      break;
    case 'yoruichi':
      E.atkT[i] = late ? 1.7 : 2.2;
      if (move === 0) {
        // Shunpo: she is beside you before you see her move, and strikes.
        const a = w.rng.next() * TAU;
        w.spawnFx(FX_GLOW, x, y, 0, 0, 0.3, E.r[i], E.r[i] * 2.4, 0.7, 0, 0, 0xc8a8ff, LAYER_ADD);
        E.x[i] = E.ox[i] = p.x + Math.cos(a) * 110;
        E.y[i] = E.oy[i] = p.y + Math.sin(a) * 110;
        w.spawnMark(MK_SLASH, MS_CIRCLE, E.x[i], E.y[i], 80, 0, 0, 0.5, dmg, MF_ENEMY);
      } else if (move === 1) {
        w.spawnMark(MK_PILLAR, MS_CIRCLE, x, y, 140, 0, 0, 0.8, dmg * 1.2, MF_ENEMY);
        if (late) {
          const off = w.rng.next() * TAU;
          for (let k = 0; k < 6; k++) {
            const a = off + (k / 6) * TAU;
            w.spawnMark(MK_PILLAR, MS_CIRCLE, p.x + Math.cos(a) * 90, p.y + Math.sin(a) * 90, 34, 0, 0, 1 + k * 0.08, dmg * 0.6, MF_ENEMY);
          }
        }
      } else {
        const n = late ? 6 : 4;
        for (let k = 0; k < n; k++) {
          const t = (k + 1) / n;
          w.spawnMark(MK_PILLAR, MS_CIRCLE, x + (p.x - x) * t * 1.15, y + (p.y - y) * t * 1.15, 40, 0, 0, 0.6 + k * 0.14, dmg * 0.8, MF_ENEMY);
        }
      }
      w.sound('warn');
      break;
    default:
      // Isshin Kurosaki.
      E.atkT[i] = late ? 2.1 : 2.6;
      if (move === 0) {
        const n = late ? 3 : 1;
        for (let k = 0; k < n; k++) {
          const a = toP + (k - (n - 1) / 2) * 0.32;
          w.spawnEnemyBullet(EB_GETSUGA, x, y, Math.cos(a) * 200, Math.sin(a) * 200, 30, 3.8, dmg * 0.9);
        }
        w.sound('blade');
      } else if (move === 1) {
        // Engetsu's fire, laid in a wall across your path: it burns for a while, so go round it.
        const nx = -Math.sin(toP);
        const ny = Math.cos(toP);
        const cx = p.x + Math.cos(toP) * 60;
        const cy = p.y + Math.sin(toP) * 60;
        for (let k = -3; k <= 3; k++) {
          w.spawnZone(ZK_FIRE, cx + nx * k * 46, cy + ny * k * 46, 0, 0, 30, 4, 0.5, dmg * 0.3, ZF_ENEMY);
        }
        w.sound('fire');
      } else {
        w.spawnMark(MK_SLASH, MS_LINE, x, y, 42, 440, toP, 0.6, dmg * 1.1, MF_ENEMY);
        E.kx[i] = Math.cos(toP) * 1300;
        E.ky[i] = Math.sin(toP) * 1300;
        w.sound('warn');
      }
      break;
  }
}

/**
 * Kisuke Urahara, once Captain of the 12th Division. Nake, Benihime: a fan
 * of crimson blasts. Shibari Benihime: a red net that holds you. Hadō #63,
 * Raikōhō: lightning down a long line. Bakudō #81, Danku: a wall your blows
 * barely get through. At half health his bankai, Kannonbiraki Benihime
 * Aratame, remakes his own wounds once, and its needle stitches red threads
 * across the street.
 */
export function uraharaAI(w: World, i: number): void {
  const E = w.en;
  const p = w.player;
  const x = E.x[i];
  const y = E.y[i];
  const dmg = E.dmg[i];
  const memo = w.bossMemo(i);
  if (E.hp[i] < E.maxHp[i] * 0.5 && memo.phase === 0) {
    memo.phase = 1;
    E.atkT[i] = 1.2;
    E.hp[i] = Math.min(E.maxHp[i], E.hp[i] + E.maxHp[i] * 0.15);
    w.spawnFx(FX_RING, x, y, 0, 0, 0.7, 30, 360, 1, 0, 0, 0xc8303c, LAYER_ADD);
    w.shake = Math.max(w.shake, 9);
    w.messages.push({ text: 'Bankai: Kannonbiraki Benihime Aratame', kind: 'boss' });
    w.sound('bankai');
  }
  // His bankai remakes his wounds, lifting him back over half health; it stays released.
  const late = memo.phase === 1;
  if (E.atkT[i] > 0) return;
  const move = memo.move++ % 4;
  const toP = Math.atan2(p.y - y, p.x - x);
  E.atkT[i] = late ? 1.9 : 2.4;
  switch (move) {
    case 0: {
      const n = late ? 7 : 5;
      for (let k = 0; k < n; k++) {
        const a = toP + (k - (n - 1) / 2) * 0.16;
        w.spawnEnemyBullet(EB_FIRE, x, y, Math.cos(a) * 210, Math.sin(a) * 210, 8, 3.4, dmg * 0.5);
      }
      w.sound('fire');
      break;
    }
    case 1:
      w.spawnMark(MK_THREAD, MS_CIRCLE, p.x, p.y, 70, 0, 0, 1, dmg * 0.6, MF_ENEMY | MF_ROOT);
      w.sound('warn');
      break;
    case 2: {
      const n = late ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const a = toP + (n === 1 ? 0 : (k - 0.5) * 0.5);
        w.spawnMark(MK_LANCE, MS_LINE, x, y, 46, 900, a, 0.9, dmg * 1.2, MF_ENEMY);
      }
      w.sound('strike');
      break;
    }
    default:
      memo.guard = w.t + 2;
      memo.guardMul = 0.35;
      w.spawnFx(FX_RING, x, y, 0, 0, 0.5, E.r[i] * 1.4, E.r[i] * 3, 1, 0, 0, 0xe8eef8, LAYER_ADD);
      if (late) {
        // Benihime Aratame's needle stitches three red threads across the street near you.
        for (let k = -1; k <= 1; k++) {
          const a = toP + Math.PI / 2 + k * 0.5;
          const sx = p.x - Math.cos(a) * 260 + Math.cos(toP) * k * 50;
          const sy = p.y - Math.sin(a) * 260 + Math.sin(toP) * k * 50;
          w.spawnMark(MK_THREAD, MS_LINE, sx, sy, 22, 520, a, 1 + (k + 1) * 0.2, dmg * 0.7, MF_ENEMY);
        }
        w.sound('warn');
      } else {
        w.sound('shield');
      }
      break;
  }
}
