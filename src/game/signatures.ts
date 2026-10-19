import { TAU } from '../core/math';
import {
  EB_BALA,
  FLAG_BOSS,
  FX_AVATAR,
  FX_GLOW,
  FX_MISSILE,
  FX_RING,
  FX_SNOW,
  LAYER_ADD,
  MF_ENEMY,
  MF_FREEZE,
  MF_ROOT,
  MK_CERO,
  MK_ICE,
  MK_INK,
  MK_LANCE,
  MK_METEOR,
  MK_MISSILE,
  MK_SEAL,
  MK_SLASH,
  MK_STING,
  MK_SWORD,
  MS_ARC,
  MS_CIRCLE,
  MS_LINE,
} from './constants';
import { enemiesInCircle } from './casts/common';
import type { World } from './world';

/**
 * What makes each boss its own. The Sternritter who stole a bankai fight
 * with it in Hueco Mundo, and with their own Schrift too; the captains who
 * own those bankai fight with them in the Seireitei, and with one art of
 * their own. Ayon, Neliel and Unohana have no one else's moves at all.
 * Every attack is warned first.
 */

/** Ayon's size once enraged (the renderer switches to its split-faced sprite). */
export const AYON_RAGE = 50;
/** Neliel's size once released as Gamuza (the renderer switches to the centaur). */
export const NEL_RELEASED = 36;

/** Bala bursting out of a boss in every direction. */
function burst(w: World, i: number, n: number, speed: number, dmgMul: number): void {
  const E = w.en;
  const off = w.rng.next() * TAU;
  for (let k = 0; k < n; k++) {
    const a = off + (k / n) * TAU;
    w.spawnEnemyBullet(EB_BALA, E.x[i], E.y[i], Math.cos(a) * speed, Math.sin(a) * speed, 7, 5, E.dmg[i] * dmgMul);
  }
}

/**
 * Ayon: the beast Harribel's Fracción make from their own left arms. Both
 * fists come down where you stand, it charges down a lane, and it roars Bala
 * out in every direction. Below half health its face splits open: bigger,
 * faster, and the fists come down three times, chasing you.
 */
export function ayonAI(w: World, i: number): void {
  const E = w.en;
  const p = w.player;
  const x = E.x[i];
  const y = E.y[i];
  const dmg = E.dmg[i];
  const rage = E.hp[i] < E.maxHp[i] * 0.5;
  if (rage && E.r[i] < AYON_RAGE) {
    E.r[i] = AYON_RAGE;
    E.spd[i] *= 1.5;
    E.atkT[i] = 1;
    w.spawnFx(FX_RING, x, y, 0, 0, 0.7, 40, 360, 1, 0, 0, 0xff3a2a, LAYER_ADD);
    w.shake = Math.max(w.shake, 10);
    w.messages.push({ text: 'Ayon’s face splits open', kind: 'boss' });
    w.sound('rise');
    burst(w, i, 24, 170, 0.4);
  }
  if (E.atkT[i] > 0) return;
  const memo = w.bossMemo(i);
  const move = memo.move++ % 3;
  const toP = Math.atan2(p.y - y, p.x - x);
  if (move === 0) {
    E.atkT[i] = rage ? 2.2 : 3;
    const n = rage ? 3 : 1;
    for (let k = 0; k < n; k++) {
      const a = w.rng.next() * TAU;
      const d = k === 0 ? 0 : 60 + w.rng.next() * 50;
      w.spawnMark(MK_METEOR, MS_CIRCLE, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 64, 0, 0, 1.05 + k * 0.3, dmg * 1.1, MF_ENEMY);
    }
    w.sound('warn');
  } else if (move === 1) {
    E.atkT[i] = rage ? 2 : 2.6;
    w.spawnMark(MK_SLASH, MS_LINE, x, y, 64, 460, toP, 0.8, dmg * 1.2, MF_ENEMY);
    E.kx[i] = Math.cos(toP) * 1100;
    E.ky[i] = Math.sin(toP) * 1100;
    w.sound('warn');
  } else {
    E.atkT[i] = rage ? 2 : 2.8;
    burst(w, i, rage ? 22 : 14, rage ? 190 : 160, 0.4);
    w.sound('blast');
  }
}

/**
 * Neliel Tu Oderschvank, once the Tercera Espada. Cero Doble: she opens her
 * mouth and takes in whatever hits her, then spits it back as a Cero, wider
 * and harder the more she swallowed. Lanzador Verde: her lance, thrown down
 * a long line. Below half health she releases Gamuza: a centaur, faster,
 * charging down lanes and throwing two lances at once.
 */
export function nelAI(w: World, i: number): void {
  const E = w.en;
  const p = w.player;
  const x = E.x[i];
  const y = E.y[i];
  const dmg = E.dmg[i];
  const memo = w.bossMemo(i);
  const released = E.hp[i] < E.maxHp[i] * 0.5;
  if (released && E.r[i] < NEL_RELEASED) {
    E.r[i] = NEL_RELEASED;
    E.spd[i] *= 1.4;
    E.atkT[i] = 1.1;
    w.spawnFx(FX_RING, x, y, 0, 0, 0.6, 30, 320, 1, 0, 0, 0x5ad8b0, LAYER_ADD);
    w.shake = Math.max(w.shake, 7);
    w.messages.push({ text: 'Neliel releases: Gamuza', kind: 'boss' });
    w.sound('bankai');
  }
  const toP = Math.atan2(p.y - y, p.x - x);
  if (memo.u > 0) {
    // Swallowing: everything that hits her now comes back out.
    if (w.t >= memo.u) {
      const swallowed = Math.max(0, memo.n - E.hp[i]);
      memo.u = 0;
      const k = Math.min(1, swallowed / (E.maxHp[i] * 0.06));
      w.spawnMark(MK_CERO, MS_LINE, x, y, 40 + 50 * k, 900, toP, 0.9, dmg * (0.8 + 1.4 * k), MF_ENEMY);
      w.messages.push({ text: k > 0.5 ? 'Cero Doble: she spits it all back at you' : 'Cero Doble', kind: 'boss' });
      w.sound('warn');
    } else if (w.steps % 6 === 0) {
      w.spawnFx(FX_GLOW, x, y - E.r[i] * 0.5, 0, 0, 0.25, E.r[i] * 0.5, E.r[i] * 1.6, 0.85, 0, 0, 0x9dffd8, LAYER_ADD);
    }
    return;
  }
  if (E.atkT[i] > 0) return;
  const move = memo.move++ % 3;
  if (move === 0) {
    E.atkT[i] = 2.4;
    memo.u = w.t + 1.4;
    memo.n = E.hp[i];
    w.spawnFx(FX_RING, x, y, 0, 0, 0.6, E.r[i] * 3.5, E.r[i], 0.9, 0, 0, 0x9dffd8, LAYER_ADD);
    w.sound('rise');
  } else if (move === 1) {
    E.atkT[i] = released ? 2 : 2.6;
    const n = released ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const a = n === 1 ? toP : toP + (k - 0.5) * 0.32;
      w.spawnMark(MK_LANCE, MS_LINE, x, y, 34, 980, a, 0.8, dmg * 1.15, MF_ENEMY);
    }
    w.sound('warn');
  } else if (released) {
    E.atkT[i] = 2;
    w.spawnMark(MK_SLASH, MS_LINE, x, y, 46, 480, toP, 0.6, dmg * 1.1, MF_ENEMY);
    E.kx[i] = Math.cos(toP) * 1400;
    E.ky[i] = Math.sin(toP) * 1400;
    w.sound('warn');
  } else {
    E.atkT[i] = 2.2;
    w.spawnMark(MK_SLASH, MS_ARC, x, y, 150, 0.8, toP, 0.65, dmg, MF_ENEMY);
    w.sound('warn');
  }
}

/** Unohana's cuts at half health: each one that lands on you heals her by this share of her health. */
export const UNOHANA_DRAIN = 0.04;

/**
 * Retsu Unohana, Captain of the 4th Division. Minazuki glides over her
 * soldiers and closes their wounds; her Bakudō pins you where you stand; her
 * cuts are small and exact. Below half health she lets her braid down and
 * shows what she was before she was a healer, the first Kenpachi: faster,
 * cut after cut, and every cut that lands on you heals her.
 */
export function unohanaAI(w: World, i: number): void {
  const E = w.en;
  const p = w.player;
  const x = E.x[i];
  const y = E.y[i];
  const dmg = E.dmg[i];
  const memo = w.bossMemo(i);
  const late = E.hp[i] < E.maxHp[i] * 0.5;
  if (late && memo.phase === 0) {
    memo.phase = 1;
    E.spd[i] *= 1.6;
    E.atkT[i] = 1;
    w.spawnFx(FX_RING, x, y, 0, 0, 0.6, 30, 320, 1, 0, 0, 0xd8203a, LAYER_ADD);
    w.shake = Math.max(w.shake, 7);
    w.messages.push({ text: 'The braid comes down: the first Kenpachi', kind: 'boss' });
    w.sound('bankai');
  }
  if (E.atkT[i] > 0) return;
  const move = memo.move++ % 3;
  const toP = Math.atan2(p.y - y, p.x - x);
  if (!late) {
    if (move === 0) {
      E.atkT[i] = 2.6;
      const n = enemiesInCircle(w, x, y, 220);
      for (let k = 0; k < n; k++) {
        const j = w.qout[k];
        if (E.charmT[j] > 0) continue;
        const boss = (E.flags[j] & FLAG_BOSS) !== 0;
        E.hp[j] = Math.min(E.maxHp[j], E.hp[j] + E.maxHp[j] * (boss ? 0.02 : 0.5));
        w.spawnFx(FX_GLOW, E.x[j], E.y[j], 0, 0, 0.35, E.r[j], E.r[j] * 2.4, 0.6, 0, 0, 0x9fe6c0, LAYER_ADD);
      }
      w.spawnFx(FX_RING, x, y, 0, 0, 0.6, 40, 440, 0.8, 0, 0, 0x9fe6c0, LAYER_ADD);
      w.sound('heal');
    } else if (move === 1) {
      E.atkT[i] = 2.4;
      w.spawnMark(MK_SEAL, MS_CIRCLE, p.x, p.y, 60, 0, 0, 1.2, dmg * 0.5, MF_ENEMY | MF_ROOT);
      w.sound('warn');
    } else {
      E.atkT[i] = 2.2;
      w.spawnMark(MK_SLASH, MS_LINE, x, y, 30, 360, toP, 0.6, dmg, MF_ENEMY);
      E.kx[i] = Math.cos(toP) * 700;
      E.ky[i] = Math.sin(toP) * 700;
      w.sound('warn');
    }
    return;
  }
  E.atkT[i] = 1.7;
  if (move === 2) {
    for (let k = -1; k <= 1; k++) {
      const m = w.spawnMark(MK_SLASH, MS_LINE, x, y, 32, 420, toP + k * 0.35, 0.55 + (k + 1) * 0.2, dmg, MF_ENEMY);
      w.drainMark(m, i, UNOHANA_DRAIN);
    }
  } else {
    const m = w.spawnMark(MK_SLASH, MS_LINE, x, y, 40, 460, toP, 0.5, dmg * 1.2, MF_ENEMY);
    w.drainMark(m, i, UNOHANA_DRAIN);
    E.kx[i] = Math.cos(toP) * 1500;
    E.ky[i] = Math.sin(toP) * 1500;
  }
  w.sound('warn');
}

/** Driscoll stops growing at this many deaths. */
export const OVERKILL_MAX = 45;

/**
 * Each Sternritter's own Schrift, on top of the bankai they stole. Äs Nödt,
 * The Fear: thorns close on you from every side, and fear holds you still.
 * Cang Du, The Iron: his skin turns to iron for a while, and your blows
 * barely mark it. BG9, The Knowledge: missiles fall where you are going, not
 * where you are. Bambietta, The Explode: her bombs land all around you.
 * Driscoll, The Overkill: every death near him makes him bigger and harder
 * hitting, and he swings with all of it.
 */
export function thiefSchrift(w: World, i: number, id: string): void {
  const E = w.en;
  const p = w.player;
  const x = E.x[i];
  const y = E.y[i];
  const dmg = E.dmg[i];
  const memo = w.bossMemo(i);
  if (id === 'gonryo') w.overkillAt = i;
  if (memo.t === 0) memo.t = w.t + 3;
  if (w.t < memo.t) return;
  switch (id) {
    case 'senbonzakura': {
      memo.t = w.t + 7;
      const off = w.rng.next() * TAU;
      for (let k = 0; k < 8; k++) {
        const a = off + (k / 8) * TAU;
        w.spawnMark(MK_INK, MS_LINE, p.x + Math.cos(a) * 170, p.y + Math.sin(a) * 170, 16, 170, a + Math.PI, 1.1, dmg * 0.45, MF_ENEMY | MF_ROOT);
      }
      if (memo.phase === 0) w.messages.push({ text: 'The Fear: thorns close in from every side', kind: 'boss' });
      memo.phase = 1;
      w.sound('thorn');
      break;
    }
    case 'hyorinmaru':
      memo.t = w.t + 9;
      memo.guard = w.t + 3;
      memo.guardMul = 0.3;
      w.spawnFx(FX_RING, x, y, 0, 0, 0.5, E.r[i] * 3, E.r[i] * 1.2, 1, 0, 0, 0xb8c2d2, LAYER_ADD);
      w.messages.push({ text: 'The Iron: Cang Du’s skin turns to iron', kind: 'boss' });
      w.sound('shield');
      break;
    case 'raikoben': {
      memo.t = w.t + 6.5;
      // Where you will be if you keep going the way you are going.
      const vx = Math.max(-260, Math.min(260, (p.x - p.ox) * 60));
      const vy = Math.max(-260, Math.min(260, (p.y - p.oy) * 60));
      for (const t of [0.9, 1.35, 1.8]) {
        const tx = p.x + vx * t;
        const ty = p.y + vy * t;
        w.spawnMark(MK_MISSILE, MS_CIRCLE, tx, ty, 46, 0, 0, t, dmg * 0.8, MF_ENEMY);
        w.spawnFx(FX_MISSILE, tx, ty - 420, 0, 420 / t, t, 50, 50, 1, Math.PI / 2, 0, 0xffe2a0, LAYER_ADD);
      }
      w.sound('warn');
      break;
    }
    case 'tengen':
      memo.t = w.t + 6;
      for (let k = 0; k < 6; k++) {
        const a = w.rng.next() * TAU;
        const d = k === 0 ? 0 : 60 + w.rng.next() * 90;
        w.spawnMark(MK_METEOR, MS_CIRCLE, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 40, 0, 0, 0.9 + k * 0.12, dmg * 0.5, MF_ENEMY);
      }
      w.sound('warn');
      break;
    case 'gonryo': {
      memo.t = w.t + 8;
      const grown = 1 + memo.n * 0.02;
      const toP = Math.atan2(p.y - y, p.x - x);
      w.spawnMark(MK_SLASH, MS_ARC, x, y, 140 + memo.n * 2, 0.85, toP, 0.8, dmg * grown, MF_ENEMY);
      w.sound('warn');
      break;
    }
  }
}

/**
 * Each captain's own art, beside the bankai the Sternritter tried to take.
 * Byakuya, Senkei: a ring of a thousand blades stands around you; be inside
 * when it falls, or well outside. Hitsugaya, Hyōten Hyakkasō: flowers of ice
 * fall from a hole in the clouds and freeze what they touch. Suì-Fēng,
 * Nigeki Kessatsu: her first sting marks you with the Hōmonka, and a second
 * on the mark strikes three times as hard. Komamura: Tengen's giant blade
 * comes down from the sky where you stand. Sasakibe: a fencer's thrust, and
 * he is already through it.
 */
export function captainSignature(w: World, i: number, id: string): void {
  const E = w.en;
  const p = w.player;
  const x = E.x[i];
  const y = E.y[i];
  const dmg = E.dmg[i];
  const memo = w.bossMemo(i);
  if (memo.t === 0) memo.t = w.t + 4;
  if (w.t < memo.t) return;
  const toP = Math.atan2(p.y - y, p.x - x);
  switch (id) {
    case 'senbonzakura':
      memo.t = w.t + 8;
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * TAU;
        w.spawnMark(MK_SWORD, MS_CIRCLE, p.x + Math.cos(a) * 150, p.y + Math.sin(a) * 150, 22, 0, 0, 1.3, dmg * 0.6, MF_ENEMY);
      }
      if (memo.phase === 0) w.messages.push({ text: 'Senkei: a thousand blades stand around you', kind: 'boss' });
      memo.phase = 1;
      break;
    case 'hyorinmaru':
      memo.t = w.t + 9;
      for (let k = 0; k < 8; k++) {
        const a = w.rng.next() * TAU;
        const d = k === 0 ? 0 : 40 + w.rng.next() * 110;
        const fx = p.x + Math.cos(a) * d;
        const fy = p.y + Math.sin(a) * d;
        w.spawnMark(MK_ICE, MS_CIRCLE, fx, fy, 30, 0, 0, 1 + k * 0.14, dmg * 0.35, MF_ENEMY | MF_FREEZE);
        w.spawnFx(FX_SNOW, fx, fy - 160, 0, 160, 1, 14, 6, 1, 0, 2, 0xe8f8ff, LAYER_ADD, 2);
      }
      if (memo.phase === 0) w.messages.push({ text: 'Hyōten Hyakkasō: flowers of ice are falling', kind: 'boss' });
      memo.phase = 1;
      break;
    case 'raikoben':
      memo.t = w.t + 7;
      w.spawnMark(MK_STING, MS_LINE, x, y, 26, 380, toP, 0.55, dmg * 0.7, MF_ENEMY);
      E.kx[i] = Math.cos(toP) * 1500;
      E.ky[i] = Math.sin(toP) * 1500;
      break;
    case 'tengen':
      memo.t = w.t + 8.5;
      w.spawnMark(MK_SWORD, MS_CIRCLE, p.x, p.y, 100, 0, 0, 1.5, dmg * 1.3, MF_ENEMY);
      w.spawnFx(FX_AVATAR, p.x, p.y - 90, 0, 0, 1.4, 180, 180, 0.7, 0, 0, 0xc9b58a, LAYER_ADD);
      break;
    case 'gonryo':
      memo.t = w.t + 7;
      w.spawnMark(MK_LANCE, MS_LINE, x, y, 24, 520, toP, 0.6, dmg, MF_ENEMY);
      E.kx[i] = Math.cos(toP) * 1400;
      E.ky[i] = Math.sin(toP) * 1400;
      break;
    default:
      return;
  }
  w.sound('warn');
}
