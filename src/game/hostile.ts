import { DT, PLAYER } from '../config';
import { TAU } from '../core/math';
import { BANKAI_IDS } from '../data/bankai';
import { ENEMY_INDEX, ENEMY_LIST } from '../data/enemies';
import { GOTEI_BY_ID, GOTEI_IDS } from '../data/gotei';
import { HERO_BY_ID, HERO_IDS } from '../data/heroes';
import { ROYAL_IDS } from '../data/royal';
import { enemiesInCircle } from './casts/common';
import {
  EB_BALA,
  EB_FIRE,
  EB_ICE,
  EB_PETAL,
  EB_WAVE,
  EB_SWORD,
  EB_THREAD,
  EB_WATER,
  EBF_ROOT,
  EBF_SLOW,
  FLAG_BOSS,
  FX_AVATAR,
  FX_GLOW,
  FX_MISSILE,
  FX_RING,
  LAYER_ADD,
  MF_ENEMY,
  MF_FREEZE,
  MF_ROOT,
  MK_CERO,
  MK_FIRE,
  MK_ICE,
  MK_INFERNO,
  MK_LANCE,
  MK_MISSILE,
  MK_PILLAR,
  MK_INK,
  MK_SEAL,
  MK_SLASH,
  MK_STEAM,
  MK_SWORD,
  MK_THREAD,
  MK_WATER,
  MK_GAS,
  MK_MIST,
  MF_INVERT,
  MF_SLOW,
  MS_ARC,
  MS_CIRCLE,
  MS_LINE,
  MK_RAIN,
  MK_SILVER,
  EB_GETSUGA,
  EB_ARROW,
} from './constants';
import type { World } from './world';

/**
 * Everything that shoots back. Every boss attack leaves a warning on the
 * ground first (a mark), so a player who is watching can always step out.
 */

export function updateEnemyBullets(w: World): void {
  const B = w.eb;
  const p = w.player;
  if (w.almightyT > 0) {
    // Time stands still: bullets hang in the air.
    B.ox.set(B.x.subarray(0, B.n));
    B.oy.set(B.y.subarray(0, B.n));
    return;
  }
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
    if (B.flags[i] & EBF_ROOT && w.vollT <= 0) p.rootT = Math.max(p.rootT, 0.8);
    w.spawnFx(FX_GLOW, B.x[i], B.y[i], 0, 0, 0.2, B.r[i] * 2, B.r[i] * 5, 0.9, 0, 0, BULLET_HIT[B.kind[i]] ?? 0xff4d6a, LAYER_ADD);
    B.remove(i);
  }
}

const BULLET_HIT: Record<number, number> = {
  [EB_ICE]: 0x8fd8ff,
  [EB_FIRE]: 0xff9a4a,
  [EB_WAVE]: 0xdfe8ff,
  [EB_SWORD]: 0xf2f6ff,
  [EB_THREAD]: 0xe2ccff,
  [EB_WATER]: 0x9fe0ff,
};

/**
 * Elites shoot every few seconds while on screen: Adjuchas spit a red Bala,
 * seated officers swing a sword wave (bigger, slower, easy to read).
 */
export function eliteAI(w: World, i: number, dist: number): void {
  const E = w.en;
  E.atkT[i] -= DT;
  if (E.atkT[i] > 0) return;
  E.atkT[i] = 3.6 + w.rng.next() * 1.6;
  if (dist > Math.max(w.viewHalfW, w.viewHalfH)) return;
  if (E.type[i] === ENEMY_INDEX.attendant) {
    tendAround(w, i);
    return;
  }
  const p = w.player;
  const a = Math.atan2(p.y - E.y[i], p.x - E.x[i]);
  if (ENEMY_LIST[E.type[i]].shinigami) {
    w.spawnEnemyBullet(EB_WAVE, E.x[i], E.y[i], Math.cos(a) * 165, Math.sin(a) * 165, 12, 3.5, E.dmg[i] * 0.6);
    w.sound('blade');
  } else {
    w.spawnEnemyBullet(EB_BALA, E.x[i], E.y[i], Math.cos(a) * 150, Math.sin(a) * 150, 6, 4, E.dmg[i] * 0.6);
  }
}

/**
 * Run events. A rift pours out the stage's enemies until it is destroyed,
 * and seals itself (with nothing left behind) when its time runs out; a
 * golden runner flees, and escapes when its time runs out.
 */
export function eventAI(w: World, i: number): void {
  const E = w.en;
  E.atk2T[i] -= DT;
  if (E.atk2T[i] <= 0) {
    E.dead[i] = 1;
    w.spawnFx(FX_GLOW, E.x[i], E.y[i], 0, 0, 0.4, E.r[i] * 2, E.r[i] * 4, 0.8, 0, 0, E.type[i] === ENEMY_INDEX.rift ? 0x6a1830 : 0xffd27a, LAYER_ADD);
    w.messages.push({ text: E.type[i] === ENEMY_INDEX.rift ? 'The rift seals itself.' : 'It got away.', kind: 'info' });
    return;
  }
  if (E.type[i] !== ENEMY_INDEX.rift) return;
  E.atkT[i] -= DT;
  if (E.atkT[i] > 0) return;
  E.atkT[i] = 0.55;
  const a = w.rng.next() * TAU;
  const d = w.rng.range(30, 60);
  w.spawnEnemy(w.regularType(), E.x[i] + Math.cos(a) * d, E.y[i] + Math.sin(a) * d);
}

/**
 * Flash-step scouts: every few seconds, vanish and reappear most of the way
 * to you, never right on top of you, leaving an afterimage where they stood.
 */
export function blinkAI(w: World, i: number, dist: number): void {
  const E = w.en;
  E.atk2T[i] -= DT;
  if (E.atk2T[i] > 0) return;
  E.atk2T[i] = 2.6 + w.rng.next() * 1.8;
  if (dist > 340 || dist < 110) return;
  const p = w.player;
  const hop = Math.min(130, dist - 70);
  const x0 = E.x[i];
  const y0 = E.y[i];
  const nx = (p.x - x0) / dist;
  const ny = (p.y - y0) / dist;
  w.spawnFx(FX_GLOW, x0, y0, 0, 0, 0.3, E.r[i] * 2, E.r[i] * 3.2, 0.55, 0, 0, 0xc9b8ff, LAYER_ADD);
  E.x[i] = E.ox[i] = x0 + nx * hop;
  E.y[i] = E.oy[i] = y0 + ny * hop;
  w.spawnFx(FX_RING, E.x[i], E.y[i], 0, 0, 0.2, E.r[i], E.r[i] * 3, 0.6, 0, 0, 0xc9b8ff, LAYER_ADD);
}

/**
 * Kidō casters: a small fireball at you every few seconds while they are
 * close enough to see you. Spirit weavers throw a thread instead, which holds
 * you in place for a moment if it catches you.
 */
export function casterAI(w: World, i: number, dist: number): void {
  const E = w.en;
  E.atkT[i] -= DT;
  if (E.atkT[i] > 0) return;
  E.atkT[i] = 5 + w.rng.next() * 2.5;
  if (dist > 270) return;
  const p = w.player;
  const a = Math.atan2(p.y - E.y[i], p.x - E.x[i]);
  if (E.type[i] === ENEMY_INDEX.jizo) {
    // Konjiki Ashisogi Jizō breathes its poison out ahead of it.
    E.atkT[i] = 3.2;
    for (let k = 1; k <= 3; k++) {
      const d = 70 * k;
      w.spawnMark(MK_GAS, MS_CIRCLE, E.x[i] + Math.cos(a) * d, E.y[i] + Math.sin(a) * d, 40 + k * 6, 0, 0, 0.8 + k * 0.15, E.dmg[i] * 0.6, MF_ENEMY | MF_SLOW);
    }
    w.sound('warn');
    return;
  }
  if (E.type[i] === ENEMY_INDEX.weaver) {
    w.spawnEnemyBullet(EB_THREAD, E.x[i], E.y[i], Math.cos(a) * 150, Math.sin(a) * 150, 6, 3.2, E.dmg[i] * 0.5, EBF_ROOT);
    return;
  }
  w.spawnEnemyBullet(EB_FIRE, E.x[i], E.y[i], Math.cos(a) * 135, Math.sin(a) * 135, 5, 3, E.dmg[i] * 0.6);
}

/**
 * Palace sentinels: in reach, they stop with the spear raised for a moment
 * (a glint shows it), then lunge along the line to where you were.
 */
export function chargeAI(w: World, i: number, dist: number): void {
  const E = w.en;
  if (E.atk2T[i] > 0) {
    E.atk2T[i] -= DT;
    if (E.atk2T[i] <= 0) {
      const p = w.player;
      const dx = p.x - E.x[i];
      const dy = p.y - E.y[i];
      const d = Math.hypot(dx, dy) || 1;
      E.kx[i] = (dx / d) * 1300;
      E.ky[i] = (dy / d) * 1300;
    }
    return;
  }
  E.atkT[i] -= DT;
  if (E.atkT[i] > 0 || dist > 210 || dist < 40) return;
  E.atkT[i] = 4 + w.rng.next() * 2;
  E.atk2T[i] = 0.75;
  w.spawnFx(FX_GLOW, E.x[i], E.y[i] - E.r[i] * 0.6, 0, 0, 0.6, E.r[i], E.r[i] * 2.6, 0.9, 0, 0, 0xffe08a, LAYER_ADD);
}

/** Royal attendants: every few seconds they mend what stands near them (a guardian, a little; the rest, a lot). */
function tendAround(w: World, i: number): void {
  const E = w.en;
  const n = enemiesInCircle(w, E.x[i], E.y[i], 170);
  for (let k = 0; k < n; k++) {
    const j = w.qout[k];
    if (j === i || E.charmT[j] > 0) continue;
    const boss = (E.flags[j] & FLAG_BOSS) !== 0;
    E.hp[j] = Math.min(E.maxHp[j], E.hp[j] + E.maxHp[j] * (boss ? 0.025 : 0.3));
    w.spawnFx(FX_GLOW, E.x[j], E.y[j], 0, 0, 0.35, E.r[j], E.r[j] * 2.4, 0.6, 0, 0, 0xfff0a8, LAYER_ADD);
  }
  w.spawnFx(FX_RING, E.x[i], E.y[i], 0, 0, 0.5, 30, 340, 0.8, 0, 0, 0xfff0a8, LAYER_ADD);
}

export function bossAI(w: World, i: number, dist: number): void {
  const E = w.en;
  // Bosses only attack once they are on (or right next to) the screen.
  if (dist > Math.hypot(w.viewHalfW, w.viewHalfH) * 1.15) return;
  E.atkT[i] -= DT;
  E.atk2T[i] -= DT;
  const def = ENEMY_LIST[E.type[i]];
  if (def.id === 'bearer' || def.id === 'captain') {
    bearerAI(w, i, BANKAI_IDS[E.variant[i]] ?? '', dist);
  } else if (def.id === 'royal') {
    royalAI(w, i, ROYAL_IDS[E.variant[i]] ?? '', dist);
  } else if (def.id === 'ichibe') {
    ichibeAI(w, i);
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
  } else if (def.id === 'grandmaster') {
    grandmasterAI(w, i);
  } else if (def.id === 'commander') {
    commanderAI(w, i, dist);
  } else if (def.id === 'harribel') {
    harribelAI(w, i);
  } else if (def.id === 'gotei') {
    goteiAI(w, i, GOTEI_IDS[E.variant[i]] ?? 'kenpachi');
  } else if (def.id === 'kyoraku') {
    kyorakuAI(w, i);
  } else if (def.id === 'defender') {
    defenderAI(w, i, HERO_IDS[E.variant[i]] ?? 'renji');
  } else if (def.id === 'ichigo') {
    ichigoAI(w, i);
  }
}

/**
 * The Wahrwelt's defenders, each with what is canon for them, every attack
 * warned first. Renji: Zabimaru's segments whipping out, fangs closing in on
 * you, the bone cannon (Hikotsu Taihō); at half health, Sōō Zabimaru. Rukia:
 * Tsukishiro's circle of ice, Hakuren's wave; at half, Hakka no Togame
 * freezes everything near her. Uryū: volleys and Licht Regen's rain; at half
 * his Antithesis turns his wounds back once, and his silver arrow can silence
 * The Almighty. Aizen: Kyōka Suigetsu's copies (only one Aizen is real),
 * Kurohitsugi closing around you, and cuts you never see coming.
 */
function defenderAI(w: World, i: number, id: string): void {
  const E = w.en;
  const p = w.player;
  const x = E.x[i];
  const y = E.y[i];
  const toP = Math.atan2(p.y - y, p.x - x);
  const dmg = E.dmg[i];
  const memo = w.bossMemo(i);
  if (memo.phase === 0 && E.hp[i] < E.maxHp[i] * 0.5) {
    memo.phase = 1;
    E.atkT[i] = 1.2;
    w.spawnFx(FX_RING, x, y, 0, 0, 0.6, 30, 300, 1, 0, 0, HERO_BY_ID.get(id)?.aura ?? 0xffffff, LAYER_ADD);
    w.shake = Math.max(w.shake, 6);
    w.sound('bankai');
    if (id === 'renji') w.messages.push({ text: 'Bankai: Sōō Zabimaru', kind: 'boss' });
    else if (id === 'rukia') w.messages.push({ text: 'Bankai: Hakka no Togame', kind: 'boss' });
    else if (id === 'uryu') {
      // The Antithesis: half of what he has lost turns back.
      E.hp[i] = Math.min(E.maxHp[i], E.hp[i] + (E.maxHp[i] - E.hp[i]) * 0.5);
      w.messages.push({ text: 'Uryū’s Antithesis turns his wounds back', kind: 'boss' });
    } else w.messages.push({ text: 'Aizen smiles. Which of him is real?', kind: 'boss' });
  }
  // Kyōka Suigetsu's copies fade when their time is up.
  if (id === 'aizen' && memo.t > 0 && w.t > memo.t) {
    memo.t = 0;
    w.clearMirages();
  }
  if (E.atkT[i] > 0) return;
  const two = memo.phase === 1;
  const move = memo.move++ % 3;
  switch (id) {
    case 'renji':
      E.atkT[i] = two ? 2 : 2.5;
      if (move === 0) {
        // Zabimaru's segments whip out down a long lane.
        w.spawnMark(MK_SLASH, MS_LINE, x, y, two ? 46 : 34, 560, toP, 0.75, dmg, MF_ENEMY);
        w.sound('warn');
      } else if (move === 1) {
        // Fangs ring you and close in: slip out through a gap.
        const n = two ? 12 : 9;
        const off = w.rng.next() * TAU;
        for (let k = 0; k < n; k++) {
          const a = off + (k / n) * TAU;
          w.spawnEnemyBullet(EB_SWORD, p.x + Math.cos(a) * 250, p.y + Math.sin(a) * 250, -Math.cos(a) * 150, -Math.sin(a) * 150, 7, 3.4, dmg * 0.45);
        }
        w.sound('blade');
      } else {
        // Hikotsu Taihō: the bone cannon.
        w.spawnMark(MK_CERO, MS_LINE, x, y, two ? 66 : 54, 900, toP, 1.1, dmg * 1.2, MF_ENEMY);
        w.sound('warn');
      }
      break;
    case 'rukia':
      E.atkT[i] = two ? 2.1 : 2.6;
      if (move === 0) {
        // Some no Mai, Tsukishiro: a circle of ice rises where you stand.
        w.spawnMark(MK_ICE, MS_CIRCLE, p.x, p.y, 70, 0, 0, 1.1, dmg, MF_ENEMY | MF_FREEZE);
        w.sound('warn');
      } else if (move === 1) {
        // Tsugi no Mai, Hakuren: a wave of cold rushing out at you.
        for (let k = -2; k <= 2; k++) {
          const a = toP + k * 0.12;
          w.spawnEnemyBullet(EB_ICE, x, y, Math.cos(a) * 190, Math.sin(a) * 190, 12, 3.4, dmg * 0.5, EBF_SLOW);
        }
        w.sound('blade');
      } else if (two) {
        // Hakka no Togame: everything near her freezes.
        w.spawnMark(MK_ICE, MS_CIRCLE, x, y, 210, 0, 0, 1.3, dmg * 1.2, MF_ENEMY | MF_FREEZE);
        w.sound('warn');
      } else {
        // Shards of ice all around her.
        const off = w.rng.next() * TAU;
        for (let k = 0; k < 8; k++) {
          const a = off + (k / 8) * TAU;
          w.spawnEnemyBullet(EB_ICE, x, y, Math.cos(a) * 150, Math.sin(a) * 150, 9, 3.5, dmg * 0.4, EBF_SLOW);
        }
        w.sound('blade');
      }
      break;
    case 'uryu':
      E.atkT[i] = two ? 2 : 2.4;
      if (move === 0) {
        // A volley of arrows.
        for (let k = -2; k <= 2; k++) {
          const a = toP + k * 0.14;
          w.spawnEnemyBullet(EB_ARROW, x, y, Math.cos(a) * 260, Math.sin(a) * 260, 7, 2.6, dmg * 0.45);
        }
        w.sound('blade');
      } else if (move === 1) {
        // Licht Regen: arrows of light rain down around you.
        for (let k = 0; k < 9; k++) {
          const a = w.rng.next() * TAU;
          const d = k === 0 ? 0 : 50 + w.rng.next() * 110;
          w.spawnMark(MK_RAIN, MS_CIRCLE, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 30, 0, 0, 0.9 + k * 0.07, dmg * 0.45, MF_ENEMY);
        }
        w.sound('warn');
      } else if (two && w.power('almighty')) {
        // The silver arrow: struck by it, The Almighty falls silent for a while.
        w.spawnMark(MK_SILVER, MS_LINE, x, y, 26, 900, toP, 1, dmg * 0.8, MF_ENEMY);
        w.sound('warn');
      } else {
        // One heavy arrow, fast and straight.
        w.spawnEnemyBullet(EB_ARROW, x, y, Math.cos(toP) * 330, Math.sin(toP) * 330, 10, 2.8, dmg * 0.8);
        w.sound('blade');
      }
      break;
    default:
      // Sōsuke Aizen.
      E.atkT[i] = two ? 2.2 : 2.8;
      if (move === 0) {
        // Kyōka Suigetsu: copies of him step out of the air. Only one Aizen is real.
        const n = two ? 4 : 3;
        for (let k = 0; k < n; k++) {
          const a = w.rng.next() * TAU;
          w.spawnEnemy(ENEMY_INDEX.mirage, x + Math.cos(a) * 90, y + Math.sin(a) * 90);
        }
        memo.t = w.t + 9;
        w.sound('rise');
      } else if (move === 1) {
        // Hadō #90, Kurohitsugi: a black coffin closes around you. Be out of it when it does.
        const r = 90;
        for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
          const sx = p.x + Math.cos(a) * r - Math.cos(a + Math.PI / 2) * r;
          const sy = p.y + Math.sin(a) * r - Math.sin(a + Math.PI / 2) * r;
          w.spawnMark(MK_INK, MS_LINE, sx, sy, 22, r * 2, a + Math.PI / 2, 1.2, dmg * 0.6, MF_ENEMY);
        }
        w.spawnMark(MK_INK, MS_CIRCLE, p.x, p.y, 80, 0, 0, 1.45, dmg * 1.1, MF_ENEMY);
        w.sound('warn');
      } else {
        // A cut down a lane, and he is already past you.
        w.spawnMark(MK_SLASH, MS_LINE, x, y, 36, 420, toP, 0.6, dmg, MF_ENEMY);
        E.kx[i] = Math.cos(toP) * 1250;
        E.ky[i] = Math.sin(toP) * 1250;
        w.sound('warn');
      }
      break;
  }
}

/** Ichigo's size once his Hollow mask forms (the renderer switches to the masked sprite). */
export const ICHIGO_MASKED = 34;

/**
 * Ichigo Kurosaki: Getsuga Tenshō, a crescent of his own power flung at you;
 * flash steps that close any distance; and a blow from above where you stand.
 * Below half health his Hollow mask forms: bigger, faster, and the Getsuga
 * comes three at a time.
 */
function ichigoAI(w: World, i: number): void {
  const E = w.en;
  const p = w.player;
  const x = E.x[i];
  const y = E.y[i];
  const dmg = E.dmg[i];
  const masked = E.hp[i] < E.maxHp[i] * 0.5;
  if (masked && E.r[i] < ICHIGO_MASKED) {
    E.r[i] = ICHIGO_MASKED;
    E.spd[i] *= 1.3;
    E.atkT[i] = 1.2;
    w.spawnFx(FX_RING, x, y, 0, 0, 0.6, 30, 320, 1, 0, 0, 0xff3048, LAYER_ADD);
    w.shake = Math.max(w.shake, 8);
    w.messages.push({ text: 'Ichigo’s Hollow mask forms', kind: 'boss' });
    w.sound('rise');
  }
  if (E.atkT[i] > 0) return;
  E.atkT[i] = masked ? 1.9 : 2.5;
  const memo = w.bossMemo(i);
  const move = memo.move++ % 3;
  const toP = Math.atan2(p.y - y, p.x - x);
  switch (move) {
    case 0: {
      // Getsuga Tenshō.
      const n = masked ? 3 : 1;
      for (let k = 0; k < n; k++) {
        const a = toP + (k - (n - 1) / 2) * 0.3;
        w.spawnEnemyBullet(EB_GETSUGA, x, y, Math.cos(a) * 240, Math.sin(a) * 240, 24, 3.6, dmg * 0.9);
      }
      w.sound('blade');
      break;
    }
    case 1:
      // A flash step down a warned lane, and he is already through it.
      w.spawnMark(MK_SLASH, MS_LINE, x, y, 40, 460, toP, 0.6, dmg, MF_ENEMY);
      E.kx[i] = Math.cos(toP) * 1400;
      E.ky[i] = Math.sin(toP) * 1400;
      w.sound('warn');
      break;
    default:
      // He comes down on you from above: a great blow where you stand.
      w.spawnMark(MK_STEAM, MS_CIRCLE, p.x, p.y, masked ? 100 : 80, 0, 0, 1.1, dmg * 1.3, MF_ENEMY);
      w.sound('warn');
      break;
  }
}

/**
 * Silbern's captains, each with what is canon for them, every attack warned
 * on the ground first. Below half health each shows more: Kenpachi takes his
 * sword in both hands (Kendō), Mayuri releases Konjiki Ashisogi Jizō, Shinji
 * puts on his Hollow mask, Kensei releases Tekken Tachikaze.
 */
function goteiAI(w: World, i: number, id: string): void {
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
    w.spawnFx(FX_RING, x, y, 0, 0, 0.6, 30, 300, 1, 0, 0, GOTEI_BY_ID.get(id)?.aura ?? 0xffffff, LAYER_ADD);
    w.shake = Math.max(w.shake, 6);
    w.sound('bankai');
    if (id === 'kenpachi') {
      E.spd[i] *= 1.3;
      w.messages.push({ text: 'Kenpachi takes his sword in both hands', kind: 'boss' });
    } else if (id === 'mayuri') {
      w.spawnEnemy(ENEMY_INDEX.jizo, x - Math.cos(toP) * 70, y - Math.sin(toP) * 70, false, 4);
      w.messages.push({ text: 'Bankai: Konjiki Ashisogi Jizō', kind: 'boss' });
    } else if (id === 'shinji') {
      w.messages.push({ text: 'Shinji puts on his Hollow mask', kind: 'boss' });
    } else {
      w.messages.push({ text: 'Bankai: Tekken Tachikaze', kind: 'boss' });
    }
  }
  if (E.atkT[i] > 0) return;
  const move = memo.move++ % 3;
  switch (id) {
    case 'kenpachi':
      E.atkT[i] = late ? 2 : 2.5;
      if (move === 1) {
        // A charge down a warned lane, and he is already moving.
        w.spawnMark(MK_SLASH, MS_LINE, x, y, 40, 420, toP, 0.65, dmg, MF_ENEMY);
        E.kx[i] = Math.cos(toP) * 1300;
        E.ky[i] = Math.sin(toP) * 1300;
      } else if (late) {
        // Kendō: both hands on the blade, one great cut down a long line.
        w.spawnMark(MK_SLASH, MS_LINE, x, y, 70, 720, toP, 1, dmg * 1.6, MF_ENEMY);
      } else {
        // A wild slash in front of him.
        w.spawnMark(MK_SLASH, MS_ARC, x, y, 170, 0.9, toP, 0.7, dmg * 1.1, MF_ENEMY);
      }
      w.sound('warn');
      break;
    case 'mayuri':
      E.atkT[i] = late ? 2.2 : 2.8;
      if (move === 0) {
        // Ashisogi Jizō: a thrust whose poison leaves the limbs dead for a moment.
        w.spawnMark(MK_LANCE, MS_LINE, x, y, 30, 340, toP, 0.75, dmg, MF_ENEMY | MF_ROOT);
        w.sound('warn');
      } else if (move === 1) {
        // Poison gas drifting in around you.
        for (let k = 0; k < 5; k++) {
          const a = w.rng.next() * TAU;
          const d = k === 0 ? 0 : 60 + w.rng.next() * 80;
          w.spawnMark(MK_GAS, MS_CIRCLE, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 44, 0, 0, 1 + k * 0.1, dmg * 0.55, MF_ENEMY | MF_SLOW);
        }
        w.sound('warn');
      } else {
        // His specimens, let loose around you.
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * TAU + w.rng.next() * 0.3;
          w.spawnEnemy(ENEMY_INDEX.specimen, p.x + Math.cos(a) * 240, p.y + Math.sin(a) * 240);
        }
        w.sound('rise');
      }
      break;
    case 'shinji':
      E.atkT[i] = late ? 2 : 2.6;
      if (move === 0) {
        // Sakanade: a sweet mist settles around you. Inside it when it lands, up is down and left is right.
        w.spawnMark(MK_MIST, MS_CIRCLE, p.x, p.y, 110, 0, 0, 1.3, 0, MF_ENEMY | MF_INVERT);
        w.sound('warn');
      } else if (move === 1 || late) {
        // A Cero from his Hollow mask (masked, it comes in place of the sword waves).
        w.spawnMark(MK_CERO, MS_LINE, x, y, late ? 60 : 48, 900, toP, late ? 0.9 : 1.1, dmg * 1.2, MF_ENEMY);
        w.sound('warn');
      } else {
        // Sword waves in a fan.
        for (let k = -1; k <= 1; k++) {
          w.spawnEnemyBullet(EB_WAVE, x, y, Math.cos(toP + k * 0.24) * 175, Math.sin(toP + k * 0.24) * 175, 12, 3.5, dmg * 0.6);
        }
        w.sound('blade');
      }
      break;
    default:
      // Kensei Muguruma.
      E.atkT[i] = late ? 2 : 2.5;
      if (move === 0) {
        // Tachikaze: blades of wind in a fan.
        const n = late ? 7 : 5;
        for (let k = 0; k < n; k++) {
          const a = toP + (k - (n - 1) / 2) * 0.2;
          w.spawnEnemyBullet(EB_WAVE, x, y, Math.cos(a) * 200, Math.sin(a) * 200, 10, 3.2, dmg * 0.5);
        }
        w.sound('blade');
      } else if (move === 1) {
        // Bursts of wind marching toward you; released, Tekken Tachikaze's punches come in fives.
        const n = late ? 5 : 3;
        for (let k = 0; k < n; k++) {
          const t = (k + 1) / n;
          w.spawnMark(MK_STEAM, MS_CIRCLE, x + (p.x - x) * t, y + (p.y - y) * t, 46, 0, 0, 0.6 + k * 0.18, dmg * 0.7, MF_ENEMY);
        }
        w.sound('warn');
      } else {
        // A dash down a warned lane.
        w.spawnMark(MK_SLASH, MS_LINE, x, y, 36, 380, toP, 0.6, dmg * 0.9, MF_ENEMY);
        E.kx[i] = Math.cos(toP) * 1250;
        E.ky[i] = Math.sin(toP) * 1250;
        w.sound('warn');
      }
      break;
  }
}

/**
 * Captain-Commander Shunsui Kyōraku: Katen Kyōkotsu makes children's games
 * real. Kageoni: what steps on a shadow is struck from it, so keep moving.
 * Takaoni: a ring of strikes around you, so keep to its middle. Bushōgoma:
 * spinning tops flung out from him. Below half health his bankai, Katen
 * Kyōkotsu: Karamatsu Shinjū, darkens the ground into a pool that drags at
 * you, and threads cross where you stand.
 */
function kyorakuAI(w: World, i: number): void {
  const E = w.en;
  const p = w.player;
  const x = E.x[i];
  const y = E.y[i];
  const dmg = E.dmg[i];
  const memo = w.bossMemo(i);
  const late = E.hp[i] < E.maxHp[i] * 0.5;
  if (late && memo.phase === 0) {
    memo.phase = 1;
    E.atkT[i] = 1.4;
    w.spawnFx(FX_RING, x, y, 0, 0, 0.8, 40, 420, 1, 0, 0, 0xff9ac8, LAYER_ADD);
    w.messages.push({ text: 'Bankai: Katen Kyōkotsu: Karamatsu Shinjū', kind: 'boss' });
    w.shake = Math.max(w.shake, 8);
    w.sound('bankai');
  }
  if (E.atkT[i] > 0) return;
  E.atkT[i] = late ? 2.1 : 2.6;
  const move = memo.move++ % (late ? 4 : 3);
  const toP = Math.atan2(p.y - y, p.x - x);
  switch (move) {
    case 0: {
      // Kageoni: struck from your own shadow, then from where you are heading.
      w.spawnMark(MK_INK, MS_CIRCLE, p.x, p.y + 6, 40, 0, 0, 0.6, dmg * 0.9, MF_ENEMY);
      const ahead = 0.9 / DT;
      w.spawnMark(MK_INK, MS_CIRCLE, p.x + (p.x - p.ox) * ahead, p.y + (p.y - p.oy) * ahead + 6, 44, 0, 0, 1.05, dmg * 0.9, MF_ENEMY);
      w.sound('warn');
      break;
    }
    case 1:
      // Takaoni: a ring of strikes around you; its middle is the high ground.
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * TAU;
        w.spawnMark(MK_SWORD, MS_CIRCLE, p.x + Math.cos(a) * 130, p.y + Math.sin(a) * 130, 40, 0, 0, 1.1, dmg * 0.7, MF_ENEMY);
      }
      w.sound('warn');
      break;
    case 2: {
      // Bushōgoma: spinning tops flung out from him in three arms.
      const base = w.t * 1.7;
      for (let arm = 0; arm < 3; arm++) {
        for (let k = 0; k < 6; k++) {
          const a = base + (arm * TAU) / 3 + k * 0.12;
          const spd = 130 + k * 18;
          w.spawnEnemyBullet(EB_WAVE, x, y, Math.cos(a) * spd, Math.sin(a) * spd, 9, 4, dmg * 0.35);
        }
      }
      w.sound('blade');
      break;
    }
    default: {
      // Karamatsu Shinjū: the ground darkens into a pool that drags at you, and threads cross where you stand.
      w.spawnMark(MK_INK, MS_CIRCLE, p.x, p.y, 170, 0, 0, 1.6, dmg * 0.6, MF_ENEMY | MF_SLOW);
      for (const a of [toP, toP + Math.PI / 2]) {
        w.spawnMark(MK_THREAD, MS_LINE, p.x - Math.cos(a) * 300, p.y - Math.sin(a) * 300, 30, 600, a, 1.2, dmg * 0.8, MF_ENEMY);
      }
      w.sound('warn');
      break;
    }
  }
}

/** Tier Harribel's size once Tiburón is released (the renderer switches to her released form). */
export const HARRIBEL_RELEASED = 36;

/**
 * Tier Harribel, the Third Espada, who has ruled Las Noches since Aizen fell.
 * Ola Azul: waves cut from the hollow of her blade, in a fan at you. Sonído:
 * a lane is warned and she is already through it. Below half health she
 * releases Tiburón: bigger and faster, wider fans, and Cascada, a torrent
 * that falls where you stand. Every move is warned first.
 */
function harribelAI(w: World, i: number): void {
  const E = w.en;
  const p = w.player;
  const x = E.x[i];
  const y = E.y[i];
  const released = E.hp[i] < E.maxHp[i] * 0.5;
  if (released && E.r[i] < HARRIBEL_RELEASED) {
    E.r[i] = HARRIBEL_RELEASED;
    E.spd[i] *= 1.3;
    E.atkT[i] = 1.4;
    w.spawnFx(FX_RING, x, y, 0, 0, 0.6, 30, 320, 1, 0, 0, 0x5ac8ff, LAYER_ADD);
    w.spawnFx(FX_GLOW, x, y, 0, 0, 0.6, 40, 200, 0.9, 0, 0, 0x9fe0ff, LAYER_ADD);
    w.shake = Math.max(w.shake, 8);
    w.messages.push({ text: 'Harribel releases Tiburón', kind: 'boss' });
    w.sound('rise');
  }
  if (E.atkT[i] > 0) return;
  E.atkT[i] = released ? 2 : 2.6;
  const dmg = E.dmg[i];
  const toP = Math.atan2(p.y - y, p.x - x);
  // The variant byte is free on this boss: use it as the move counter.
  const move = E.variant[i] % 3;
  E.variant[i] = (move + 1) % 3;
  switch (move) {
    case 0: {
      // Ola Azul: a fan of waves from the hollow of her blade.
      const n = released ? 5 : 3;
      for (let k = 0; k < n; k++) {
        const a = toP + (k - (n - 1) / 2) * 0.26;
        w.spawnEnemyBullet(EB_WATER, x, y, Math.cos(a) * 210, Math.sin(a) * 210, 13, 3.6, dmg * 0.55);
      }
      w.sound('blade');
      break;
    }
    case 1:
      // Sonído: the lane is warned, and she is already moving down it.
      w.spawnMark(MK_WATER, MS_LINE, x, y, 38, 440, toP, 0.65, dmg, MF_ENEMY);
      E.kx[i] = Math.cos(toP) * 1250;
      E.ky[i] = Math.sin(toP) * 1250;
      w.sound('warn');
      break;
    case 2:
      if (released) {
        // Cascada: a torrent falls where you stand, and its spray lands all around.
        w.spawnMark(MK_WATER, MS_CIRCLE, p.x, p.y, 120, 0, 0, 1.35, dmg * 1.2, MF_ENEMY);
        const off = w.rng.next() * TAU;
        for (let k = 0; k < 5; k++) {
          const a = off + (k / 5) * TAU;
          w.spawnMark(MK_WATER, MS_CIRCLE, p.x + Math.cos(a) * 185, p.y + Math.sin(a) * 185, 44, 0, 0, 1.6, dmg * 0.5, MF_ENEMY);
        }
        w.sound('warn');
      } else {
        // One great wave, slower and wider than the rest.
        w.spawnEnemyBullet(EB_WATER, x, y, Math.cos(toP) * 150, Math.sin(toP) * 150, 24, 4.5, dmg * 0.8);
        w.sound('blade');
      }
      break;
  }
}

/**
 * The Captain-Commander. With his bankai, Zanka no Tachi, the heat burns
 * anyone who comes close, and he cycles four techniques, each warned on the
 * ground first: a blade of fire down a line, pillars of flame around you, a
 * flare of his whole body, and the charred dead raised in a ring around you.
 *
 * Below half health the Emperor takes Zanka no Tachi from him, as he did in
 * the story. The heat and the dead go with it; the old man fights on with
 * his shikai's pillars of flame and his own fists: Ikkotsu, a rush and one
 * blow at its end, and Sōkotsu, two blows where you stand.
 */
function commanderAI(w: World, i: number, dist: number): void {
  const E = w.en;
  const p = w.player;
  const x = E.x[i];
  const y = E.y[i];
  const dmg = E.dmg[i];
  if (!w.zankaStolen && E.hp[i] < E.maxHp[i] * 0.5) w.stealZanka(i);
  if (!w.zankaStolen && dist < COMMANDER_HEAT + PLAYER.radius) w.hurtPlayer(dmg * 0.35);
  if (E.atkT[i] > 0) return;
  const toP = Math.atan2(p.y - y, p.x - x);
  if (w.zankaStolen) {
    E.atkT[i] = 2.1;
    // The variant byte is free on this boss: use it as the technique counter.
    const move = E.variant[i] % 3;
    E.variant[i] = (move + 1) % 3;
    switch (move) {
      case 0:
        ennetsuJigoku(w, dmg, 5);
        break;
      case 1: {
        // Ikkotsu: he crosses the lane in a stride, and the blow lands at its end.
        const len = Math.min(380, Math.max(120, dist));
        w.spawnMark(MK_LANCE, MS_LINE, x, y, 30, len, toP, 0.8, dmg * 0.8, MF_ENEMY);
        w.spawnMark(MK_SEAL, MS_CIRCLE, x + Math.cos(toP) * len, y + Math.sin(toP) * len, 64, 0, 0, 1, dmg * 1.1, MF_ENEMY);
        E.kx[i] = Math.cos(toP) * 1100;
        E.ky[i] = Math.sin(toP) * 1100;
        w.sound('warn');
        break;
      }
      case 2:
        // Sōkotsu: two blows, one after the other, where you stand.
        w.spawnMark(MK_SEAL, MS_CIRCLE, p.x, p.y, 56, 0, 0, 0.9, dmg * 0.8, MF_ENEMY);
        w.spawnMark(MK_SEAL, MS_CIRCLE, p.x, p.y, 76, 0, 0, 1.5, dmg * 0.8, MF_ENEMY);
        w.sound('warn');
        break;
    }
    return;
  }
  E.atkT[i] = 2.3;
  // The variant byte is free on this boss: use it as the technique counter.
  const move = E.variant[i] % 4;
  E.variant[i] = (move + 1) % 4;
  switch (move) {
    case 0:
      // A blade of fire down a long line.
      w.spawnMark(MK_FIRE, MS_LINE, x, y, 44, 900, toP, 1, dmg, MF_ENEMY);
      w.sound('warn');
      break;
    case 1:
      ennetsuJigoku(w, dmg, 7);
      break;
    case 2:
      // His whole body flares: everything near him burns.
      w.spawnMark(MK_INFERNO, MS_CIRCLE, x, y, 190, 0, 0, 1.4, dmg * 1.1, MF_ENEMY);
      w.sound('warn');
      break;
    case 3:
      // The charred dead rise in a ring around you.
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU;
        w.spawnEnemy(ENEMY_INDEX.ashen, p.x + Math.cos(a) * 230, p.y + Math.sin(a) * 230);
      }
      w.sound('rise');
      break;
  }
}

/** Ennetsu Jigoku: pillars of flame erupt around you, one right where you stand. */
function ennetsuJigoku(w: World, dmg: number, n: number): void {
  const p = w.player;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU + w.rng.next() * 0.4;
    const d = k === 0 ? 0 : 70 + w.rng.next() * 70;
    w.spawnMark(MK_INFERNO, MS_CIRCLE, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 36, 0, 0, 1 + k * 0.08, dmg * 0.6, MF_ENEMY);
  }
  w.sound('warn');
}

/** How far the Captain-Commander's heat reaches (the renderer draws the same ring). */
export const COMMANDER_HEAT = 120;

/**
 * The Kidō Grandmaster cycles three spells, each warned on the ground first:
 * a binding seal at your feet (roots you if it lands), a fan of fireballs,
 * and a lightning lance down a straight line.
 */
function grandmasterAI(w: World, i: number): void {
  const E = w.en;
  const p = w.player;
  // Left far behind, it flash-steps back into range instead of plodding after you.
  if (E.atk2T[i] <= 0) {
    const d = Math.hypot(p.x - E.x[i], p.y - E.y[i]);
    if (d > 420) {
      E.atk2T[i] = 3;
      const a = Math.atan2(E.y[i] - p.y, E.x[i] - p.x);
      w.spawnFx(FX_GLOW, E.x[i], E.y[i], 0, 0, 0.35, E.r[i] * 2, E.r[i] * 3.5, 0.6, 0, 0, 0xffb37a, LAYER_ADD);
      E.x[i] = E.ox[i] = p.x + Math.cos(a) * 260;
      E.y[i] = E.oy[i] = p.y + Math.sin(a) * 260;
      w.spawnFx(FX_RING, E.x[i], E.y[i], 0, 0, 0.3, E.r[i], E.r[i] * 4, 0.7, 0, 0, 0xffcb5c, LAYER_ADD);
    }
  }
  if (E.atkT[i] > 0) return;
  E.atkT[i] = 2.4;
  const x = E.x[i];
  const y = E.y[i];
  const dmg = E.dmg[i];
  const toP = Math.atan2(p.y - y, p.x - x);
  // The variant byte is free on this boss: use it as the spell counter.
  const spell = E.variant[i] % 3;
  E.variant[i] = (spell + 1) % 3;
  if (spell === 0) {
    w.spawnMark(MK_SEAL, MS_CIRCLE, p.x, p.y, 62, 0, 0, 1.3, dmg * 0.5, MF_ENEMY | MF_ROOT);
    w.sound('warn');
  } else if (spell === 1) {
    for (let k = 0; k < 5; k++) {
      const a = toP + (k - 2) * 0.17;
      w.spawnEnemyBullet(EB_FIRE, x, y, Math.cos(a) * 175, Math.sin(a) * 175, 8, 4, dmg * 0.45);
    }
    w.sound('fire');
  } else {
    w.spawnMark(MK_LANCE, MS_LINE, x, y, 40, 900, toP, 1, dmg * 1.05, MF_ENEMY);
    w.sound('warn');
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

/** The Royal Guard: each fights with what they made. Every attack is warned on the ground first. */
function royalAI(w: World, i: number, id: string, dist: number): void {
  const E = w.en;
  const p = w.player;
  const x = E.x[i];
  const y = E.y[i];
  const toP = Math.atan2(p.y - y, p.x - x);
  const dmg = E.dmg[i];
  switch (id) {
    case 'tenjiro':
      if (E.atkT[i] <= 0) {
        // Boiling springs burst up around you, one under your feet.
        E.atkT[i] = 3.4;
        for (let k = 0; k < 5; k++) {
          const a = w.rng.next() * TAU;
          const d = k === 0 ? 0 : 55 + w.rng.next() * 80;
          w.spawnMark(MK_STEAM, MS_CIRCLE, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 40, 0, 0, 1.1 + k * 0.1, dmg * 0.6, MF_ENEMY);
        }
        w.sound('warn');
      }
      if (E.atk2T[i] <= 0 && dist < 420) {
        // A spear thrust down a line, and he steps into it.
        E.atk2T[i] = 6;
        w.spawnMark(MK_LANCE, MS_LINE, x, y, 34, 560, toP, 0.95, dmg * 1.1, MF_ENEMY);
        E.kx[i] = Math.cos(toP) * 900;
        E.ky[i] = Math.sin(toP) * 900;
        w.sound('warn');
      }
      break;
    case 'kirio': {
      // At half health she sheds her bulk: smaller and far faster. Her size is the sign of it.
      const slim = E.hp[i] < E.maxHp[i] * 0.5;
      if (slim && E.r[i] > 26) {
        E.r[i] = 24;
        E.spd[i] *= 1.8;
        E.atkT[i] = 1.2;
        w.spawnFx(FX_RING, x, y, 0, 0, 0.5, 30, 260, 1, 0, 0, 0xffb38a, LAYER_ADD);
        w.messages.push({ text: 'Kirio sheds her weight', kind: 'boss' });
      }
      if (!slim) {
        if (E.atkT[i] <= 0) {
          // Grain flung out in every direction.
          E.atkT[i] = 3;
          ring(w, i, 16, 150, 0.35);
        }
        if (E.atk2T[i] <= 0) {
          // Her servants: sentinels of the palace step in around you.
          E.atk2T[i] = 9;
          for (let k = 0; k < 4; k++) {
            const a = (k / 4) * TAU + w.rng.next() * 0.3;
            w.spawnEnemy(ENEMY_INDEX.sentinel, p.x + Math.cos(a) * 240, p.y + Math.sin(a) * 240);
          }
          w.sound('rise');
        }
      } else if (E.atkT[i] <= 0) {
        // Slim: a rush straight at you down a lane, and she is already moving.
        E.atkT[i] = 2.4;
        w.spawnMark(MK_SLASH, MS_LINE, x, y, 40, 420, toP, 0.7, dmg, MF_ENEMY);
        E.kx[i] = Math.cos(toP) * 1300;
        E.ky[i] = Math.sin(toP) * 1300;
        w.sound('warn');
      }
      break;
    }
    case 'oetsu':
      if (E.atkT[i] <= 0) {
        // A ring of swords around you, closing in: slip out through a gap.
        E.atkT[i] = 3.4;
        const off = w.rng.next() * TAU;
        for (let k = 0; k < 10; k++) {
          const a = off + (k / 10) * TAU;
          w.spawnEnemyBullet(EB_SWORD, p.x + Math.cos(a) * 260, p.y + Math.sin(a) * 260, -Math.cos(a) * 150, -Math.sin(a) * 150, 7, 3.6, dmg * 0.45);
        }
        w.sound('blade');
      }
      if (E.atk2T[i] <= 0) {
        // Blades fall from above.
        E.atk2T[i] = 5.5;
        for (let k = 0; k < 6; k++) {
          const a = w.rng.next() * TAU;
          const d = k === 0 ? 0 : 50 + w.rng.next() * 90;
          w.spawnMark(MK_SWORD, MS_CIRCLE, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 30, 0, 0, 0.9 + k * 0.12, dmg * 0.55, MF_ENEMY);
        }
        w.sound('warn');
      }
      break;
    case 'senjumaru':
      if (E.atkT[i] <= 0) {
        // A lattice of threads across where you stand: caught, you are held.
        E.atkT[i] = 3.8;
        const base = w.rng.next() * Math.PI;
        for (let k = 0; k < 3; k++) {
          const a = base + (k * Math.PI) / 3;
          const nx = -Math.sin(a) * (k - 1) * 60;
          const ny = Math.cos(a) * (k - 1) * 60;
          w.spawnMark(MK_THREAD, MS_LINE, p.x + nx - Math.cos(a) * 450, p.y + ny - Math.sin(a) * 450, 26, 900, a, 1.3, dmg * 0.7, MF_ENEMY | MF_ROOT);
        }
        w.sound('warn');
      }
      if (E.atk2T[i] <= 0) {
        // Cloth drawn shut around you: be outside it when it closes.
        E.atk2T[i] = 9;
        w.spawnMark(MK_THREAD, MS_CIRCLE, p.x, p.y, 150, 0, 0, 2.2, dmg * 1.2, MF_ENEMY);
        w.sound('warn');
      }
      break;
  }
}

/**
 * Ichibē Hyōsube: great strokes of ink, pools of it, his servants, and
 * Ichimonji, which takes the name from one of your attacks so it falls silent
 * for a while. Below half health he writes faster, and his strokes cross.
 */
function ichibeAI(w: World, i: number): void {
  const E = w.en;
  const p = w.player;
  if (E.atkT[i] > 0) return;
  const late = E.hp[i] < E.maxHp[i] * 0.5;
  E.atkT[i] = late ? 1.9 : 2.6;
  const x = E.x[i];
  const y = E.y[i];
  const dmg = E.dmg[i];
  const toP = Math.atan2(p.y - y, p.x - x);
  // The variant byte is free on this boss: use it as the move counter.
  const move = E.variant[i] % 4;
  E.variant[i] = (move + 1) % 4;
  switch (move) {
    case 0:
      for (const off of late ? [-0.5, 0.5] : [0]) {
        const a = toP + off;
        w.spawnMark(MK_INK, MS_LINE, p.x - Math.cos(a) * 450, p.y - Math.sin(a) * 450, 46, 900, a, 1.1, dmg, MF_ENEMY);
      }
      w.sound('warn');
      break;
    case 1:
      for (let k = 0; k < 6; k++) {
        const a = w.rng.next() * TAU;
        const d = k === 0 ? 0 : 60 + w.rng.next() * 90;
        w.spawnMark(MK_INK, MS_CIRCLE, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 44, 0, 0, 1 + k * 0.1, dmg * 0.6, MF_ENEMY);
      }
      w.sound('warn');
      break;
    case 2: {
      const name = w.sealPower(late ? 8 : 6);
      if (name) w.messages.push({ text: `Ichimonji: ${name} loses its name`, kind: 'boss' });
      w.spawnMark(MK_INK, MS_CIRCLE, x, y, 170, 0, 0, 1.4, dmg * 1.1, MF_ENEMY);
      w.sound('warn');
      break;
    }
    case 3:
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU;
        w.spawnEnemy(ENEMY_INDEX.inkwisp, p.x + Math.cos(a) * 230, p.y + Math.sin(a) * 230);
      }
      w.sound('rise');
      break;
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
        if (dist < 300) {
          E.atkT[i] = 4.5;
          // Wide but readable: 1.35 s is enough to step sideways out of the wedge.
          w.spawnMark(MK_SLASH, MS_ARC, x, y, 230, 0.7, toP, 1.35, dmg * 1.1, MF_ENEMY);
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
