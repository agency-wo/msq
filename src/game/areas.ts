import { DT, PLAYER } from '../config';
import { TAU } from '../core/math';
import { burstAt, enemiesInArc, enemiesInCircle, enemiesOnSegment, inArc, segmentDist } from './casts/common';
import {
  DOT_FIRE,
  FLAG_BOSS,
  FX_BEAM,
  FX_BEAMH,
  FX_CRESCENT,
  FX_FLAME,
  FX_GLOW,
  FX_LIGHTNING,
  FX_RING,
  FX_SHOCK,
  FX_SNOW,
  FX_SPARK,
  HOLD_FREEZE,
  HOLD_JAIL,
  LAYER_ADD,
  MF_BURN,
  MF_CRATER,
  MF_ENEMY,
  MF_FREEZE,
  MF_ROOT,
  MF_SHATTER,
  MF_SLOW,
  MK_CERO,
  MK_FIRE,
  MK_ICE,
  MK_INFERNO,
  MK_LANCE,
  MK_METEOR,
  MK_MISSILE,
  MK_PILLAR,
  MK_RAIN,
  MK_SEAL,
  MK_SLASH,
  MS_ARC,
  MS_CIRCLE,
  MS_LINE,
  PK_BOMB,
  ZF_BLAZE,
  ZF_ENEMY,
  ZF_FOLLOW,
  ZF_FREEZE,
  ZF_PULL,
  ZF_PUSH,
  ZF_SPREAD,
  ZF_VULN,
  ZF_WANDER,
  ZK_CAGE,
  ZK_FIRE,
  ZK_HEAT,
  ZK_POISON,
  MK_STEAM,
  MK_INK,
  MK_THREAD,
  MK_SWORD,
  MK_WATER,
  FX_SMOKE,
  LAYER_NORMAL,
} from './constants';
import type { World } from './world';

// ------------------------------------------------------------------ zones

export function updateZones(w: World): void {
  const Z = w.zones;
  const E = w.en;
  const p = w.player;
  const plague = w.resonances.has('plague');
  const nightmare = w.resonances.has('nightmare');
  for (let i = Z.n - 1; i >= 0; i--) {
    w.dmgSlot = Z.src[i];
    Z.life[i] -= DT;
    if (Z.life[i] <= 0) {
      if (Z.kind[i] === ZK_CAGE && Z.extra[i] > 0) openCage(w, i);
      Z.remove(i);
      continue;
    }
    Z.ox[i] = Z.x[i];
    Z.oy[i] = Z.y[i];
    const flags = Z.flags[i];
    if (flags & ZF_FOLLOW) {
      Z.x[i] = p.x;
      Z.y[i] = p.y;
    } else {
      if (flags & ZF_WANDER) steerWander(w, i);
      Z.x[i] += Z.vx[i] * DT;
      Z.y[i] += Z.vy[i] * DT;
    }
    const x = Z.x[i];
    const y = Z.y[i];
    const r = Z.r[i];
    // Gusts and petal storms shove or drag every step, not just on ticks.
    if (flags & (ZF_PULL | ZF_PUSH) && !(flags & ZF_ENEMY)) {
      const n = enemiesInCircle(w, x, y, r);
      const strength = Z.extra[i] * 0.14;
      for (let k = 0; k < n; k++) {
        const j = w.qout[k];
        if (E.flags[j] & FLAG_BOSS) continue;
        const dx = E.x[j] - x;
        const dy = E.y[j] - y;
        const d = Math.hypot(dx, dy) || 1;
        if (flags & ZF_PULL) {
          if (d < 8) continue;
          E.kx[j] -= (dx / d) * strength;
          E.ky[j] -= (dy / d) * strength;
        } else {
          E.kx[j] += (dx / d) * strength;
          E.ky[j] += (dy / d) * strength;
        }
      }
    }
    Z.tickT[i] -= DT;
    if (Z.tickT[i] > 0) continue;
    Z.tickT[i] += Z.tickInt[i];
    if (flags & ZF_ENEMY) {
      const dx = p.x - x;
      const dy = p.y - y;
      const rr = r + PLAYER.radius;
      if (dx * dx + dy * dy < rr * rr) w.hurtPlayer(Z.dmg[i]);
      continue;
    }
    const kind = Z.kind[i];
    const noCrit = kind === ZK_POISON || kind === ZK_HEAT;
    const blaze = (flags & ZF_BLAZE) !== 0;
    const n = enemiesInCircle(w, x, y, r);
    for (let k = 0; k < n; k++) {
      const j = w.qout[k];
      // Plague: whatever breathes the cloud is infected before the tick lands, so a cloud kill rises.
      if (plague && kind === ZK_POISON) E.infT[j] = Math.max(E.infT[j], 3);
      w.damageEnemy(j, Z.dmg[i], 0, x, y, noCrit);
      if (blaze && !E.dead[j]) w.applyDot(j, 3, Z.aux[i], DOT_FIRE);
      if (nightmare && kind === ZK_CAGE && !E.dead[j]) w.applyVuln(j, Z.tickInt[i] + 0.2, 0.5);
      if (E.dead[j]) {
        if (flags & ZF_SPREAD && Z.n < 60) {
          w.spawnZone(ZK_POISON, E.x[j], E.y[j], 0, 0, r * 0.6, 2.5, Z.tickInt[i], Z.dmg[i] * 0.7, flags & ~(ZF_SPREAD | ZF_FOLLOW), Z.extra[i]);
        }
        continue;
      }
      if (flags & ZF_VULN) w.applyVuln(j, Z.tickInt[i] + 0.2, Z.extra[i]);
      if (flags & ZF_FREEZE) w.applyHold(j, 0.8, HOLD_FREEZE);
      if (kind === ZK_CAGE) w.applyHold(j, Z.tickInt[i] + 0.15, HOLD_JAIL);
    }
    // Firestorm: a blazing gust leaves fire on the ground behind it.
    if (blaze && Z.n < 80 && w.rng.next() < 0.4) w.spawnZone(ZK_FIRE, x, y, 0, 0, r * 0.55, 1.8, 0.4, Z.aux[i] * 0.7, 0);
  }
}

/** Execution: a cage that opens blows up on whatever is still inside. */
function openCage(w: World, i: number): void {
  const Z = w.zones;
  const x = Z.x[i];
  const y = Z.y[i];
  const r = Z.r[i];
  const n = enemiesInCircle(w, x, y, r);
  for (let k = 0; k < n; k++) w.damageEnemy(w.qout[k], Z.extra[i], 80, x, y);
  w.spawnFx(FX_GLOW, x, y, 0, 0, 0.3, r, r * 2.6, 1, 0, 0, 0xcfe0ff, LAYER_ADD);
  w.spawnFx(FX_RING, x, y, 0, 0, 0.3, r * 0.6, r * 2.4, 1, 0, 0, 0xffffff, LAYER_ADD);
  w.sound('blast');
}

/** Wandering gusts drift with a lazy random turn and curve back if they stray too far from you. */
function steerWander(w: World, i: number): void {
  const Z = w.zones;
  const p = w.player;
  const turn = (w.rng.next() - 0.5) * 3 * DT;
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  let vx = Z.vx[i] * c - Z.vy[i] * s;
  let vy = Z.vx[i] * s + Z.vy[i] * c;
  const dx = p.x - Z.x[i];
  const dy = p.y - Z.y[i];
  const d = Math.hypot(dx, dy);
  if (d > 240) {
    const sp = Math.hypot(vx, vy) || 1;
    vx += (dx / d) * sp * 2 * DT;
    vy += (dy / d) * sp * 2 * DT;
    const ns = Math.hypot(vx, vy) || 1;
    vx = (vx / ns) * sp;
    vy = (vy / ns) * sp;
  }
  Z.vx[i] = vx;
  Z.vy[i] = vy;
}

// ------------------------------------------------------------------ marks

export function updateMarks(w: World): void {
  if (w.almightyT > 0) return;
  const M = w.marks;
  for (let i = M.n - 1; i >= 0; i--) {
    M.delay[i] -= DT;
    if (M.delay[i] > 0) continue;
    w.dmgSlot = M.src[i];
    resolveMark(w, i);
    M.remove(i);
  }
  w.dmgSlot = 255;
}

/** The warning ran out: hit whatever stands inside the shape. */
function resolveMark(w: World, i: number): void {
  const M = w.marks;
  const x = M.x[i];
  const y = M.y[i];
  const r = M.r[i];
  const len = M.len[i];
  const ang = M.ang[i];
  const dmg = M.dmg[i];
  const flags = M.flags[i];
  const kind = M.kind[i];
  const shape = M.shape[i];
  if (flags & MF_ENEMY) {
    const p = w.player;
    let hit: boolean;
    if (shape === MS_CIRCLE) hit = Math.hypot(p.x - x, p.y - y) < r + PLAYER.radius;
    else if (shape === MS_LINE) hit = segmentDist(p.x, p.y, x, y, ang, len) < r / 2 + PLAYER.radius;
    else hit = inArc(p.x, p.y, x, y, ang, r, len, PLAYER.radius);
    if (hit) {
      w.hurtPlayer(dmg);
      if (flags & (MF_SLOW | MF_FREEZE)) p.slowT = Math.max(p.slowT, 1.5);
      if (flags & MF_ROOT && w.vollT <= 0) p.rootT = Math.max(p.rootT, 1);
    }
  } else {
    const E = w.en;
    let n: number;
    if (shape === MS_CIRCLE) n = enemiesInCircle(w, x, y, r);
    else if (shape === MS_LINE) n = enemiesOnSegment(w, x, y, ang, len, r / 2);
    else n = enemiesInArc(w, x, y, ang, r, len);
    const knock = kind === MK_SLASH ? 160 : kind === MK_MISSILE || kind === MK_METEOR ? 110 : 40;
    for (let k = 0; k < n; k++) {
      const j = w.qout[k];
      w.damageEnemy(j, dmg, knock, x, y);
      if (E.dead[j]) continue;
      if (flags & MF_FREEZE) {
        w.applyHold(j, 1.4, HOLD_FREEZE);
        w.applyVuln(j, 1.4, 0.5);
      }
      if (flags & MF_BURN) w.applyDot(j, 3, dmg * 0.2, DOT_FIRE);
    }
    if (flags & MF_CRATER) w.spawnZone(ZK_FIRE, x, y, 0, 0, r * 0.7, 3, 0.4, dmg * 0.12, 0);
    if (flags & MF_SHATTER) shatter(w, x, y);
    // Exploding Giant: Tengen's sweep bursts all along its arc.
    if (kind === MK_SLASH && shape === MS_ARC && w.resonances.has('giantblast') && w.powers[w.dmgSlot]?.def.id === 'tengen') {
      giantBlast(w, x, y, r, len, ang);
    }
  }
  markFx(w, kind, x, y, r, len, ang, (flags & MF_ENEMY) !== 0);
}

/** Exploding Giant (resonance): five of The Explode's blasts along the giant's arc. */
function giantBlast(w: World, x: number, y: number, r: number, half: number, ang: number): void {
  const ex = w.power('explode');
  if (!ex) return;
  const R = ex.stats.radius * ex.stats.size * w.stats.size * 0.8;
  for (let k = 0; k < 5; k++) {
    const a = ang + ((k - 2) / 2) * half;
    burstAt(w, x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7, R, ex.stats.damage, -1, false, 0xffb070);
  }
  w.sound('blast');
}

/** Armageddon (resonance): a meteor's impact flings four of The Explode's bombs outward. */
function shatter(w: World, x: number, y: number): void {
  const ex = w.power('explode');
  if (!ex) return;
  const slot = w.powers.indexOf(ex);
  const st = ex.stats;
  const R = st.radius * st.size * w.stats.size * 0.6;
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + w.rng.range(-0.4, 0.4);
    const d = w.rng.range(60, 110);
    const b = w.spawnProjectile(PK_BOMB, slot, x, y, (Math.cos(a) * d) / 0.4, (Math.sin(a) * d) / 0.4, 0.4, st.damage * 0.6, 6, 0, 0);
    if (b >= 0) {
      w.pr.pa[b] = R;
      w.pr.pb[b] = 0.4;
    }
  }
}

function markFx(w: World, kind: number, x: number, y: number, r: number, len: number, ang: number, enemy: boolean): void {
  switch (kind) {
    case MK_METEOR:
      w.blastFx(x, y, r, 0xffa24a, 3);
      sparks(w, x, y, 4, 0xffd27a);
      w.shake = Math.max(w.shake, 5);
      w.sound('blast');
      break;
    case MK_MISSILE:
      w.blastFx(x, y, r, 0xffd27a, 5);
      w.spawnFx(FX_RING, x, y, 0, 0, 0.5, r * 0.5, r * 2.5, 1, 0, 0, 0xffffff, LAYER_ADD);
      sparks(w, x, y, 8, 0xffe2a0);
      w.shake = Math.max(w.shake, enemy ? 8 : 12);
      w.sound('blast');
      break;
    case MK_CERO:
      w.spawnFx(FX_BEAMH, x + (Math.cos(ang) * len) / 2, y + (Math.sin(ang) * len) / 2, 0, 0, 0.35, len, len, 1, ang, 0, 0xff2d4a, LAYER_ADD, 0, 0, r * 1.8);
      w.spawnFx(FX_GLOW, x, y, 0, 0, 0.35, r, r * 3, 1, 0, 0, 0xff4d6a, LAYER_ADD);
      w.shake = Math.max(w.shake, 6);
      w.sound('blast');
      break;
    case MK_PILLAR:
      w.spawnFx(FX_LIGHTNING, x, y, 0, 0, 0.24, r * 1.4, r * 1.4, 1, w.rng.next() < 0.5 ? 1 : -1, 0, 0xfff3b8, LAYER_ADD, 0, 0, 240);
      w.spawnFx(FX_GLOW, x, y, 0, 0, 0.3, r, r * 2.4, 0.9, 0, 0, 0xfff0a0, LAYER_ADD);
      w.spawnFx(FX_SHOCK, x, y, 0, 0, 0.24, r * 0.5, r * 2, 0.7, 0, 0, 0xfff3b8, LAYER_ADD);
      w.sound('strike');
      break;
    case MK_ICE:
      w.spawnFx(FX_GLOW, x, y, 0, 0, 0.4, r, r * 2.4, 0.9, 0, 0, 0x8fd8ff, LAYER_ADD);
      w.spawnFx(FX_RING, x, y, 0, 0, 0.35, r * 0.5, r * 2.2, 0.9, 0, 0, 0xdff6ff, LAYER_ADD);
      for (let k = 0; k < 5; k++) {
        const a = w.rng.next() * TAU;
        w.spawnFx(FX_SNOW, x, y, Math.cos(a) * 90, Math.sin(a) * 90, 0.5, 14, 6, 1, a, 3, 0xe8f8ff, LAYER_ADD, 2);
      }
      w.sound('freeze');
      break;
    case MK_SLASH:
      w.spawnFx(FX_CRESCENT, x + Math.cos(ang) * r * 0.5, y + Math.sin(ang) * r * 0.5, 0, 0, 0.35, r * 1.15, r * 1.25, 1, ang, 0, enemy ? 0xff6a5a : 0xffe2a0, LAYER_ADD);
      w.shake = Math.max(w.shake, 6);
      break;
    case MK_FIRE:
      w.spawnFx(FX_FLAME, x + (Math.cos(ang) * len) / 2, y + (Math.sin(ang) * len) / 2, 0, 0, 0.4, len, len, 1, ang, 0, 0xff8a3c, LAYER_ADD, 0, 0, r * 2.2);
      sparks(w, x + Math.cos(ang) * len * 0.3, y + Math.sin(ang) * len * 0.3, 5, 0xffb070);
      break;
    case MK_RAIN:
      w.spawnFx(FX_BEAM, x, y, 0, 0, 0.18, r * 0.8, 0, 1, 0, 0, 0xbfe6ff, LAYER_ADD);
      w.spawnFx(FX_GLOW, x, y, 0, 0, 0.2, r * 0.6, r * 1.8, 0.8, 0, 0, 0x9fd8ff, LAYER_ADD);
      break;
    case MK_SEAL:
      w.spawnFx(FX_RING, x, y, 0, 0, 0.5, r * 2.2, r * 1.6, 1, 0, 0, 0xffcb5c, LAYER_ADD);
      w.spawnFx(FX_GLOW, x, y, 0, 0, 0.4, r, r * 2.2, 0.8, 0, 0, 0xffb347, LAYER_ADD);
      w.sound('shield');
      break;
    case MK_INFERNO:
      w.spawnFx(FX_GLOW, x, y, 0, 0, 0.45, r, r * 2.6, 1, 0, 0, 0xff7a3c, LAYER_ADD);
      w.spawnFx(FX_RING, x, y, 0, 0, 0.4, r * 0.5, r * 2.3, 0.9, 0, 0, 0xffc070, LAYER_ADD);
      sparks(w, x, y, Math.min(12, 4 + Math.round(r / 20)), 0xffb070);
      w.shake = Math.max(w.shake, r > 100 ? 8 : 3);
      w.sound('fire');
      break;
    case MK_LANCE:
      w.spawnFx(FX_BEAMH, x + (Math.cos(ang) * len) / 2, y + (Math.sin(ang) * len) / 2, 0, 0, 0.3, len, len, 1, ang, 0, 0xfff0b0, LAYER_ADD, 0, 0, r * 1.6);
      w.spawnFx(FX_GLOW, x, y, 0, 0, 0.3, r, r * 2.6, 1, 0, 0, 0xffe680, LAYER_ADD);
      w.shake = Math.max(w.shake, 5);
      w.sound('strike');
      break;
    case MK_STEAM:
      // A boiling spring bursts: a column of steam and a hot flash.
      w.spawnFx(FX_GLOW, x, y, 0, 0, 0.45, r, r * 2.6, 0.8, 0, 0, 0x9fe8ff, LAYER_ADD);
      for (let k = 0; k < 4; k++) {
        const a = w.rng.next() * TAU;
        w.spawnFx(FX_SMOKE, x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3, Math.cos(a) * 20, -40 - k * 12, 0.8, r * 0.8, r * 2, 0.55, 0, 0, 0xf2f8ff, LAYER_NORMAL, 1);
      }
      w.sound('blast');
      break;
    case MK_INK:
      // Ink: a black stroke along the line, or a splash where a pool was.
      if (len > 0) {
        w.spawnFx(FX_BEAMH, x + (Math.cos(ang) * len) / 2, y + (Math.sin(ang) * len) / 2, 0, 0, 0.6, len, len, 0.9, ang, 0, 0x120c1c, LAYER_NORMAL, 0, 0, r * 1.5);
      }
      for (let k = 0; k < (len > 0 ? 6 : 4); k++) {
        const t = len > 0 ? w.rng.next() * len : 0;
        const sx = x + Math.cos(ang) * t + (w.rng.next() - 0.5) * r;
        const sy = y + Math.sin(ang) * t + (w.rng.next() - 0.5) * r;
        w.spawnFx(FX_SMOKE, sx, sy, 0, 0, 0.7, r * 0.8, r * 1.8, 0.85, w.rng.next() * TAU, 0, 0x0e0a16, LAYER_NORMAL);
      }
      w.shake = Math.max(w.shake, r > 100 ? 7 : 3);
      w.sound('blade');
      break;
    case MK_THREAD:
      // Threads snap taut, or the cloth draws shut.
      if (len > 0) {
        w.spawnFx(FX_BEAMH, x + (Math.cos(ang) * len) / 2, y + (Math.sin(ang) * len) / 2, 0, 0, 0.35, len, len, 1, ang, 0, 0xe2ccff, LAYER_ADD, 0, 0, r * 0.5);
      } else {
        w.spawnFx(FX_RING, x, y, 0, 0, 0.35, r * 2.2, r * 0.4, 1, 0, 0, 0xe2ccff, LAYER_ADD);
        w.spawnFx(FX_GLOW, x, y, 0, 0, 0.35, r, r * 1.6, 0.7, 0, 0, 0xc9a8ff, LAYER_ADD);
      }
      w.sound('shield');
      break;
    case MK_SWORD:
      // A blade falls from the sky and bites into the stone.
      w.spawnFx(FX_BEAM, x, y, 0, 0, 0.2, r * 0.7, 0, 1, 0, 0, 0xf2f6ff, LAYER_ADD);
      w.spawnFx(FX_SHOCK, x, y, 0, 0, 0.25, r * 0.4, r * 1.8, 0.7, 0, 0, 0xe8eef8, LAYER_ADD);
      sparks(w, x, y, 4, 0xffffff);
      w.sound('strike');
      break;
    case MK_WATER:
      // Water: a blade of it down the lane, or a torrent crashing down and spraying out.
      if (len > 0) {
        w.spawnFx(FX_BEAMH, x + (Math.cos(ang) * len) / 2, y + (Math.sin(ang) * len) / 2, 0, 0, 0.35, len, len, 1, ang, 0, 0x5ac8ff, LAYER_ADD, 0, 0, r * 1.4);
      } else {
        w.spawnFx(FX_GLOW, x, y, 0, 0, 0.45, r, r * 2.4, 0.9, 0, 0, 0x5ac8ff, LAYER_ADD);
        w.spawnFx(FX_RING, x, y, 0, 0, 0.4, r * 0.4, r * 2, 0.9, 0, 0, 0xbfeeff, LAYER_ADD);
        for (let k = 0; k < Math.min(10, 3 + Math.round(r / 20)); k++) {
          const a = w.rng.next() * TAU;
          const v = w.rng.range(60, 160);
          w.spawnFx(FX_SMOKE, x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3, Math.cos(a) * v, Math.sin(a) * v, 0.6, r * 0.4, r * 1.1, 0.6, 0, 0, 0xd8f4ff, LAYER_NORMAL, 1.5);
        }
      }
      w.shake = Math.max(w.shake, r > 100 ? 8 : 3);
      w.sound('blast');
      break;
  }
}

function sparks(w: World, x: number, y: number, n: number, color: number): void {
  for (let k = 0; k < n; k++) {
    const a = w.rng.next() * TAU;
    const v = w.rng.range(100, 260);
    w.spawnFx(FX_SPARK, x, y, Math.cos(a) * v, Math.sin(a) * v, w.rng.range(0.3, 0.6), 14, 4, 1, a, 6, color, LAYER_ADD, 2.5);
  }
}
