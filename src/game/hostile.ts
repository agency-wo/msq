import { DT, PLAYER } from '../config';
import { TAU } from '../core/math';
import { BANKAI_IDS } from '../data/bankai';
import { ENEMY_INDEX, ENEMY_LIST } from '../data/enemies';
import {
  EB_BALA,
  EB_FIRE,
  EB_ICE,
  EB_PETAL,
  EB_WAVE,
  EBF_SLOW,
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
  MK_SEAL,
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
    w.spawnFx(FX_GLOW, B.x[i], B.y[i], 0, 0, 0.2, B.r[i] * 2, B.r[i] * 5, 0.9, 0, 0, BULLET_HIT[B.kind[i]] ?? 0xff4d6a, LAYER_ADD);
    B.remove(i);
  }
}

const BULLET_HIT: Record<number, number> = { [EB_ICE]: 0x8fd8ff, [EB_FIRE]: 0xff9a4a, [EB_WAVE]: 0xdfe8ff };

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

/** Kidō casters: a small fireball at you every few seconds while they are close enough to see you. */
export function casterAI(w: World, i: number, dist: number): void {
  const E = w.en;
  E.atkT[i] -= DT;
  if (E.atkT[i] > 0) return;
  E.atkT[i] = 5 + w.rng.next() * 2.5;
  if (dist > 270) return;
  const p = w.player;
  const a = Math.atan2(p.y - E.y[i], p.x - E.x[i]);
  w.spawnEnemyBullet(EB_FIRE, E.x[i], E.y[i], Math.cos(a) * 135, Math.sin(a) * 135, 5, 3, E.dmg[i] * 0.6);
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
  }
}

/**
 * The Captain-Commander: Ryūjin Jakka's heat burns anyone who comes close,
 * and he cycles four fire techniques, each warned on the ground first: a
 * blade of fire down a line, pillars of flame around you, a flare of his whole
 * body, and the charred dead raised in a ring to close in on you.
 */
function commanderAI(w: World, i: number, dist: number): void {
  const E = w.en;
  const p = w.player;
  const x = E.x[i];
  const y = E.y[i];
  const dmg = E.dmg[i];
  if (dist < COMMANDER_HEAT + PLAYER.radius) w.hurtPlayer(dmg * 0.35);
  if (E.atkT[i] > 0) return;
  E.atkT[i] = 2.3;
  const toP = Math.atan2(p.y - y, p.x - x);
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
      // Pillars of flame erupt around you, one right where you stand.
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * TAU + w.rng.next() * 0.4;
        const d = k === 0 ? 0 : 70 + w.rng.next() * 70;
        w.spawnMark(MK_INFERNO, MS_CIRCLE, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 36, 0, 0, 1 + k * 0.08, dmg * 0.6, MF_ENEMY);
      }
      w.sound('warn');
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
