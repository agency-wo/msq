import { DT } from '../../config';
import { TAU } from '../../core/math';
import {
  DOT_FIRE,
  FLAG_BOSS,
  FX_BEAM,
  FX_BEAMH,
  FX_BOLT,
  FX_FLAME,
  FX_GLOW,
  FX_METEOR,
  FX_RING,
  FX_SPARK,
  HOLD_FEAR,
  LAYER_ADD,
  MF_CRATER,
  MF_SHATTER,
  MK_METEOR,
  MK_RAIN,
  MS_CIRCLE,
  PF_BURST,
  PF_CLUSTER,
  PF_HOMING,
  PF_SPECIAL,
  PF_STUN,
  PF_VOLATILE,
  PK_ARROW,
  PK_BLADE,
  PK_BOMB,
  PK_DRONE,
  PK_MISSILE,
  PK_THORN,
  ZF_BLAZE,
  ZF_FOLLOW,
  ZF_PULL,
  ZF_PUSH,
  ZF_SPREAD,
  ZF_VULN,
  ZF_WANDER,
  ZK_FIRE,
  ZK_GUST,
  ZK_POISON,
} from '../constants';
import type { PowerState } from '../powers';
import type { World } from '../world';
import { cooldown, densestPoint, enemiesInCircle, enemiesOnSegment } from './common';

// ------------------------------------------------------------ Heilig Pfeil

/** Holy arrows at the nearest enemy (the Magic Bolt archetype). */
export function castBolt(w: World, ps: PowerState, slot: number): void {
  ps.timer -= DT;
  if (ps.timer > 0) return;
  // Close range on purpose: kills (and their mana) land where you can reach them.
  const target = w.nearestEnemy(380);
  if (target < 0) {
    ps.timer = 0.1;
    return;
  }
  const st = ps.stats;
  ps.timer = cooldown(w, st.cooldown);
  const p = w.player;
  const E = w.en;
  const aim = Math.atan2(E.y[target] - p.y, E.x[target] - p.x);
  const bogen = ps.attr === 'bogen';
  const speed = st.speed * w.stats.projSpeed * (bogen ? 1.4 : 1);
  const size = st.size * w.stats.size * (bogen ? 1.25 : 1);
  const pierce = bogen ? 999 : st.pierce;
  const life = st.duration * w.stats.duration;
  const flags = ps.attr === 'sprenger' ? PF_SPECIAL : 0;
  const count = st.count + w.stats.count;
  for (let k = 0; k < count; k++) {
    const a = aim + (k - (count - 1) / 2) * 0.13;
    w.spawnProjectile(PK_ARROW, slot, p.x, p.y, Math.cos(a) * speed, Math.sin(a) * speed, life, st.damage, st.radius * size, pierce, flags);
  }
  if (ps.attr === 'lichtregen') {
    for (let k = 0; k < 5; k++) {
      const j = w.randomEnemyNear(300);
      if (j < 0) break;
      w.spawnMark(MK_RAIN, MS_CIRCLE, E.x[j], E.y[j], 28 * w.stats.size, 0, 0, 0.22 + k * 0.06, st.damage * 0.6, 0);
    }
  }
  w.sound('shoot');
}

// --------------------------------------------------------- Seele Schneider

/** Reishi blades orbiting the player (the Satellite archetype). */
export function castOrbit(w: World, ps: PowerState, slot: number): void {
  const st = ps.stats;
  ps.angle += st.speed * DT;
  if (ps.active > 0) {
    if (ps.attr !== 'eternal') {
      ps.active -= DT;
      if (ps.active <= 0) {
        ps.active = 0;
        ps.timer = cooldown(w, st.cooldown);
        w.clearKind(slot, PK_BLADE);
        return;
      }
    }
    if (w.resonances.has('seelepfeil')) seelePfeil(w, ps, slot);
    return;
  }
  ps.timer -= DT;
  if (ps.timer > 0) return;
  ps.active = ps.attr === 'eternal' ? Infinity : st.duration * w.stats.duration;
  respawnBlades(w, slot);
  w.sound('blade');
}

/** Seele Pfeil (resonance): every 0.7 s each blade shoots a holy arrow straight outward. */
function seelePfeil(w: World, ps: PowerState, slot: number): void {
  ps.timer2 -= DT;
  if (ps.timer2 > 0) return;
  ps.timer2 = cooldown(w, 0.7);
  const heilig = w.power('heilig');
  if (!heilig) return;
  const hs = w.powers.indexOf(heilig);
  const P = w.pr;
  const speed = 420 * w.stats.projSpeed;
  const dmg = heilig.stats.damage * 0.6;
  const n = P.n;
  for (let i = 0; i < n; i++) {
    if (P.kind[i] !== PK_BLADE || P.src[i] !== slot || P.life[i] <= 0) continue;
    const a = P.rot[i];
    w.spawnProjectile(PK_ARROW, hs, P.x[i], P.y[i], Math.cos(a) * speed, Math.sin(a) * speed, 0.8, dmg, 6 * w.stats.size, 0, 0);
  }
  w.sound('shoot');
}

/** Replace a power's blades, e.g. after a level-up changed their number. */
export function respawnBlades(w: World, slot: number): void {
  const ps = w.powers[slot];
  const st = ps.stats;
  w.clearKind(slot, PK_BLADE);
  const n = st.count + w.stats.count;
  const size = st.size * w.stats.size;
  const ring = st.radius * size;
  const flags = ps.attr === 'shards' ? PF_SPECIAL : 0;
  for (let k = 0; k < n; k++) w.spawnOrbiter(PK_BLADE, slot, (k / n) * TAU, ring, st.damage, 10 * size, flags);
  if (ps.attr === 'twin') {
    for (let k = 0; k < n; k++) w.spawnOrbiter(PK_BLADE, slot, (k / n) * TAU + Math.PI / n, -ring * 1.6, st.damage, 10 * size, flags);
  }
}

// --------------------------------------------------------------- The Roar

/** Shockwave rings from the player (the Electric Zone archetype). */
export function castPulse(w: World, ps: PowerState): void {
  ps.timer -= DT;
  if (ps.timer > 0) return;
  const st = ps.stats;
  ps.timer = cooldown(w, st.cooldown);
  ps.counter++;
  const R = st.radius * st.size * w.stats.size;
  const over = ps.attr === 'overcharge' && ps.counter % 4 === 0;
  const dmg = st.damage * (over ? 5 : 1);
  const knock = ps.attr === 'repel' ? 260 : 25;
  const paralyze = ps.attr === 'paralyze';
  const p = w.player;
  const n = enemiesInCircle(w, p.x, p.y, R);
  for (let k = 0; k < n; k++) {
    const j = w.qout[k];
    w.damageEnemy(j, dmg, knock, p.x, p.y);
    if (paralyze) w.applyHold(j, 0.5, HOLD_FEAR);
  }
  w.spawnFx(FX_RING, 0, 0, 0, 0, 0.32, R * 0.6, R * 2, over ? 1 : 0.8, 0, 0, over ? 0xffffff : 0xd7c3ff, LAYER_ADD, 0, 1);
  if (w.resonances.has('sonic')) sonicDrones(w, dmg, knock, R * 0.6);
  w.sound('pulse');
}

/** Sonic Drones (resonance): the same ring, smaller, from every drone you have. */
function sonicDrones(w: World, dmg: number, knock: number, R: number): void {
  const drones = w.power('knowledge');
  if (!drones) return;
  const ks = w.powers.indexOf(drones);
  const P = w.pr;
  for (let i = 0; i < P.n; i++) {
    if (P.kind[i] !== PK_DRONE || P.src[i] !== ks || P.life[i] <= 0) continue;
    const x = P.x[i];
    const y = P.y[i];
    const n = enemiesInCircle(w, x, y, R);
    for (let k = 0; k < n; k++) w.damageEnemy(w.qout[k], dmg * 0.7, knock * 0.5, x, y);
    w.spawnFx(FX_RING, x, y, 0, 0, 0.28, R * 0.5, R * 2, 0.75, 0, 0, 0xd7c3ff, LAYER_ADD);
  }
}

// -------------------------------------------------------- The Thunderbolt

/** Lightning on random nearby enemies (the Thunderstorm archetype). */
export function castStrike(w: World, ps: PowerState): void {
  ps.timer -= DT;
  if (ps.timer > 0) return;
  const st = ps.stats;
  ps.timer = cooldown(w, st.cooldown);
  const count = st.count + w.stats.count + (ps.attr === 'storm' ? 4 : 0);
  const R = st.radius * st.size * w.stats.size;
  let fired = 0;
  for (let k = 0; k < count; k++) {
    const j = w.randomEnemyNear(300);
    if (j < 0) break;
    strikeAt(w, w.en.x[j], w.en.y[j], st.damage, R, ps.attr);
    fired++;
  }
  if (fired === 0) ps.timer = 0.25;
  else w.sound('strike');
}

/** One bolt of lightning: area damage plus the Lv 7 effects. Also used by the Sprenger Pentacle and Gonryō Rikyū. */
export function strikeAt(w: World, x: number, y: number, dmg: number, R: number, attr: string | null): void {
  const E = w.en;
  const buf = w.qbuf2;
  let n = w.grid.query(x - R - 46, y - R - 46, x + R + 46, y + R + 46, buf);
  for (let k = 0; k < n; k++) {
    const j = buf[k];
    if (E.dead[j]) continue;
    const dx = E.x[j] - x;
    const dy = E.y[j] - y;
    const rr = R + E.r[j];
    if (dx * dx + dy * dy > rr * rr) continue;
    w.damageEnemy(j, dmg, 40, x, y);
    if (attr === 'electrocute' && !E.dead[j] && !(E.flags[j] & FLAG_BOSS) && E.hp[j] < E.maxHp[j] * 0.2) w.killEnemy(j);
  }
  w.spawnFx(FX_BEAM, x, y, 0, 0, 0.3, R * 1.25, 0, 1, 0, 0, 0xfff3b8, LAYER_ADD);
  w.spawnFx(FX_GLOW, x, y, 0, 0, 0.3, R * 1.4, R * 2.8, 0.9, 0, 0, 0xfff0a0, LAYER_ADD);
  if (attr !== 'chain') return;
  // Arc to up to 3 other enemies within reach, for half damage.
  n = w.grid.query(x - 150, y - 150, x + 150, y + 150, buf);
  let arcs = 0;
  for (let k = 0; k < n && arcs < 3; k++) {
    const j = buf[(k * 7 + w.steps) % n];
    if (E.dead[j]) continue;
    const dx = E.x[j] - x;
    const dy = E.y[j] - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < (R + 6) * (R + 6) || d2 > 150 * 150) continue;
    w.damageEnemy(j, dmg * 0.5, 20, x, y);
    const len = Math.sqrt(d2);
    w.spawnFx(FX_BOLT, x + dx / 2, y + dy / 2, 0, 0, 0.18, len, len, 1, Math.atan2(dy, dx), 0, 0xfff6c8, LAYER_ADD, 0, 0, 14);
    arcs++;
  }
}

// ------------------------------------------------------------ The X-Axis

/** A beam that pierces everything along its line (the Arcane Ray archetype). */
export function castBeam(w: World, ps: PowerState): void {
  if (ps.counter > 0) {
    // Rapid Fire follow-up shots.
    ps.timer2 -= DT;
    if (ps.timer2 > 0) return;
    ps.timer2 = 0.12;
    ps.counter--;
    fireBeams(w, ps);
    return;
  }
  ps.timer -= DT;
  if (ps.timer > 0) return;
  ps.timer = cooldown(w, ps.stats.cooldown);
  if (!fireBeams(w, ps)) {
    ps.timer = 0.2;
    return;
  }
  if (ps.attr === 'rapid') {
    ps.counter = 2;
    ps.timer2 = 0.12;
  }
}

function fireBeams(w: World, ps: PowerState): boolean {
  const target = w.nearestEnemy(560);
  if (target < 0) return false;
  const p = w.player;
  const E = w.en;
  const tx = E.x[target];
  const ty = E.y[target];
  const aim = Math.atan2(ty - p.y, tx - p.x);
  const st = ps.stats;
  const sniper = ps.attr === 'sniper';
  const width = st.radius * st.size * w.stats.size * (sniper ? 2 : 1);
  const dmg = st.damage * (sniper ? 2 : 1);
  const count = st.count + w.stats.count;
  for (let b = 0; b < count; b++) {
    const a = aim + (b - (count - 1) / 2) * 0.16;
    beamLine(w, p.x, p.y, a, 900, width, dmg, 0x9fe7ff, FX_BEAMH, 20, 0, 0);
  }
  if (ps.attr === 'twinaxis') {
    // A second beam crossing the first through the target, at a right angle.
    const perp = aim + Math.PI / 2;
    beamLine(w, tx - Math.cos(perp) * 450, ty - Math.sin(perp) * 450, perp, 900, width, dmg, 0x9fe7ff, FX_BEAMH, 20, 0, 0);
  }
  if (w.resonances.has('railgun')) {
    for (let b = 0; b < count; b++) railgun(w, p.x, p.y, aim + (b - (count - 1) / 2) * 0.16);
  }
  w.sound('beam');
  return true;
}

/** Railgun (resonance): lightning strikes at four points along a beam, with The Thunderbolt's numbers. */
function railgun(w: World, x: number, y: number, ang: number): void {
  const th = w.power('thunder');
  if (!th) return;
  const R = th.stats.radius * th.stats.size * w.stats.size;
  for (const d of [110, 230, 350, 470]) strikeAt(w, x + Math.cos(ang) * d, y + Math.sin(ang) * d, th.stats.damage * 0.6, R, th.attr);
  w.sound('strike');
}

/** Damage along a line, with a stretched sprite for the look. Shared by beams, jets and fire slashes. */
export function beamLine(
  w: World,
  x0: number,
  y0: number,
  ang: number,
  len: number,
  width: number,
  dmg: number,
  color: number,
  fxFrame: number,
  knock: number,
  burnDps: number,
  burnSecs: number,
): void {
  const n = enemiesOnSegment(w, x0, y0, ang, len, width / 2);
  for (let k = 0; k < n; k++) {
    const j = w.qout[k];
    w.damageEnemy(j, dmg, knock, x0, y0);
    if (burnDps > 0) w.applyDot(j, burnSecs, burnDps, DOT_FIRE);
  }
  const cx = x0 + (Math.cos(ang) * len) / 2;
  const cy = y0 + (Math.sin(ang) * len) / 2;
  w.spawnFx(fxFrame, cx, cy, 0, 0, 0.22, len, len, 1, ang, 0, color, LAYER_ADD, 0, 0, width * 2.2);
}

// ----------------------------------------------------------- The Explode

/** Reishi bombs lobbed onto the crowd. */
export function castLob(w: World, ps: PowerState, slot: number): void {
  ps.timer -= DT;
  if (ps.timer > 0) return;
  const st = ps.stats;
  const big = ps.attr === 'bigbang';
  ps.timer = cooldown(w, st.cooldown * (big ? 1.25 : 1));
  const count = st.count + w.stats.count;
  const flags = (ps.attr === 'volatile' ? PF_VOLATILE : 0) | (ps.attr === 'cluster' ? PF_CLUSTER : 0);
  const radius = st.radius * st.size * w.stats.size * (big ? 1.8 : 1);
  const dmg = st.damage * (big ? 1.5 : 1);
  const p = w.player;
  let fired = 0;
  for (let k = 0; k < count; k++) {
    let tx: number;
    let ty: number;
    if (k === 0 && densestPoint(w, 320)) {
      tx = w.tx;
      ty = w.ty;
    } else {
      const j = w.randomEnemyNear(320);
      if (j < 0) break;
      tx = w.en.x[j];
      ty = w.en.y[j];
    }
    const flight = st.duration;
    const i = w.spawnProjectile(PK_BOMB, slot, p.x, p.y, (tx - p.x) / flight, (ty - p.y) / flight, flight, dmg, 8, 0, flags);
    if (i >= 0) {
      w.pr.pa[i] = radius;
      w.pr.pb[i] = flight;
    }
    fired++;
  }
  if (fired === 0) ps.timer = 0.25;
  else w.sound('shoot');
}

/** A bomb landed. Called from inside the projectile loop, so it uses the second query buffer. */
export function explodeBomb(w: World, i: number): void {
  const P = w.pr;
  const E = w.en;
  const x = P.x[i];
  const y = P.y[i];
  const R = P.pa[i];
  const dmg = P.dmg[i];
  const flags = P.flags[i];
  const buf = w.qbuf2;
  const n = w.grid.query(x - R - 46, y - R - 46, x + R + 46, y + R + 46, buf);
  for (let k = 0; k < n; k++) {
    const j = buf[k];
    if (E.dead[j]) continue;
    const dx = E.x[j] - x;
    const dy = E.y[j] - y;
    const rr = R + E.r[j];
    if (dx * dx + dy * dy > rr * rr) continue;
    if (flags & PF_VOLATILE) {
      // Marked before the hit, so an enemy this blast kills goes off too.
      E.volT[j] = 0.25;
      E.volDmg[j] = dmg * 0.5;
    }
    w.damageEnemy(j, dmg, 90, x, y);
  }
  w.spawnFx(FX_GLOW, x, y, 0, 0, 0.3, R * 0.9, R * 2.4, 1, 0, 0, 0xffb37a, LAYER_ADD);
  w.spawnFx(FX_RING, x, y, 0, 0, 0.28, R * 0.5, R * 2.1, 0.9, 0, 0, 0xbfe6ff, LAYER_ADD);
  for (let s = 0; s < 4; s++) {
    const a = w.rng.next() * TAU;
    const v = w.rng.range(80, 180);
    w.spawnFx(FX_SPARK, x, y, Math.cos(a) * v, Math.sin(a) * v, 0.3, 10, 3, 1, a, 6, 0xffd9a8, LAYER_ADD, 3);
  }
  if (flags & PF_CLUSTER) {
    for (let c = 0; c < 4; c++) {
      const a = (c / 4) * TAU + w.rng.range(-0.4, 0.4);
      const d = w.rng.range(50, 90);
      const b = w.spawnProjectile(PK_BOMB, P.src[i], x, y, (Math.cos(a) * d) / 0.35, (Math.sin(a) * d) / 0.35, 0.35, dmg * 0.4, 6, 0, flags & ~PF_CLUSTER);
      if (b >= 0) {
        w.pr.pa[b] = R * 0.55;
        w.pr.pb[b] = 0.35;
      }
    }
  }
  w.sound('explode');
}

// --------------------------------------------------------------- The Heat

/** Burner Finger: jets of fire toward the nearest enemy, or where you are heading. */
export function castJet(w: World, ps: PowerState): void {
  ps.timer -= DT;
  if (ps.timer > 0) return;
  const st = ps.stats;
  ps.timer = cooldown(w, st.cooldown);
  const p = w.player;
  const size = st.size * w.stats.size;
  const len = st.radius * size;
  const t = w.nearestEnemy(len * 1.3);
  const aim = t >= 0 ? Math.atan2(w.en.y[t] - p.y, w.en.x[t] - p.x) : w.aim;
  const four = ps.attr === 'finger4';
  const count = st.count + w.stats.count + (four ? 3 : 0);
  const spread = four ? 0.32 : 0.22;
  const width = st.amount * size;
  const burn = ps.attr === 'afterburn' ? st.damage * 0.5 : 0;
  for (let k = 0; k < count; k++) {
    const a = aim + (k - (count - 1) / 2) * spread;
    beamLine(w, p.x, p.y, a, len, width, st.damage, 0xff8a4a, FX_FLAME, 25, burn, st.duration);
    if (ps.attr === 'ignite') {
      w.spawnZone(ZK_FIRE, p.x + Math.cos(a) * len * 0.75, p.y + Math.sin(a) * len * 0.75, 0, 0, 34 * size, 2.2, 0.4, st.damage * 0.35, 0);
    }
  }
  w.sound('fire');
}

// --------------------------------------------------------- The Visionary

/** Imagined meteors: a warning circle, then the impact (the Meteor archetype). */
export function castMeteor(w: World, ps: PowerState): void {
  ps.timer -= DT;
  if (ps.timer > 0) return;
  const st = ps.stats;
  ps.timer = cooldown(w, st.cooldown);
  const colossus = ps.attr === 'colossus';
  const count = colossus ? 1 : st.count + w.stats.count;
  const size = st.size * w.stats.size;
  const R = st.radius * size * (colossus ? 1.6 : 1);
  const dmg = st.damage * (colossus ? 4 : 1);
  const flags = (ps.attr === 'crater' ? MF_CRATER : 0) | (w.resonances.has('armageddon') ? MF_SHATTER : 0);
  let fired = 0;
  for (let k = 0; k < count; k++) {
    let tx: number;
    let ty: number;
    if (k === 0 && densestPoint(w, 360)) {
      tx = w.tx;
      ty = w.ty;
    } else {
      const j = w.randomEnemyNear(360);
      if (j < 0) break;
      tx = w.en.x[j];
      ty = w.en.y[j];
    }
    w.spawnMark(MK_METEOR, MS_CIRCLE, tx, ty, R, 0, 0, st.duration, dmg, flags);
    meteorFall(w, tx, ty, st.duration, R);
    if (ps.attr === 'shower') {
      for (let s = 0; s < 3; s++) {
        const a = w.rng.next() * TAU;
        const d = R * (0.8 + w.rng.next());
        const delay = st.duration + 0.15 + s * 0.12;
        w.spawnMark(MK_METEOR, MS_CIRCLE, tx + Math.cos(a) * d, ty + Math.sin(a) * d, R * 0.5, 0, 0, delay, dmg * 0.5, flags & MF_SHATTER);
        meteorFall(w, tx + Math.cos(a) * d, ty + Math.sin(a) * d, delay, R * 0.5);
      }
    }
    fired++;
  }
  if (fired === 0) ps.timer = 0.3;
}

function meteorFall(w: World, x: number, y: number, delay: number, R: number): void {
  w.spawnFx(FX_METEOR, x - 150, y - 280, 150 / delay, 280 / delay, delay, R * 0.9, R * 0.9, 1, Math.atan2(280, 150), 0, 0xffd27a, LAYER_ADD);
}

// --------------------------------------------------------------- The Fear

/** A ring of fear thorns; whatever they hit is paralyzed. */
export function castThorns(w: World, ps: PowerState, slot: number): void {
  ps.timer -= DT;
  if (ps.timer > 0) return;
  const st = ps.stats;
  ps.timer = cooldown(w, st.cooldown);
  const n = st.count + w.stats.count * 4;
  const secs = st.duration * (ps.attr === 'dread' ? 2 : 1);
  const vuln = ps.attr === 'terror' ? 0.5 : 0;
  const size = st.size * w.stats.size;
  const p = w.player;
  const base = w.rng.next() * TAU;
  const rings = ps.attr === 'thornstorm' ? 2 : 1;
  for (let ring = 0; ring < rings; ring++) {
    const off = base + (ring * Math.PI) / n;
    const speed = st.speed * (ring === 0 ? 1 : 0.78);
    for (let k = 0; k < n; k++) {
      const a = off + (k / n) * TAU;
      const i = w.spawnProjectile(PK_THORN, slot, p.x, p.y, Math.cos(a) * speed, Math.sin(a) * speed, 0.7, st.damage, st.radius * size, st.pierce, PF_STUN);
      if (i >= 0) {
        w.pr.pa[i] = secs;
        w.pr.pb[i] = vuln;
      }
    }
  }
  w.sound('thorn');
}

// --------------------------------------------------------------- The Wind

/** Gusts that wander through the swarm. */
export function castGust(w: World, ps: PowerState): void {
  ps.timer -= DT;
  if (ps.timer > 0) return;
  const st = ps.stats;
  ps.timer = cooldown(w, st.cooldown);
  const gale = ps.attr === 'gale';
  const count = st.count + w.stats.count + (ps.attr === 'twin' ? 1 : 0);
  const size = st.size * w.stats.size * (gale ? 1.6 : 1);
  const life = st.duration * w.stats.duration * (gale ? 1.6 : 1);
  // Firestorm (resonance): the gusts carry The Heat's fire.
  const heat = w.resonances.has('firestorm') ? w.power('heat') : undefined;
  const flags = ZF_WANDER | (ps.attr === 'vacuum' ? ZF_PULL : ZF_PUSH) | (heat ? ZF_BLAZE : 0);
  const p = w.player;
  for (let k = 0; k < count; k++) {
    const a = w.rng.next() * TAU;
    const z = w.spawnZone(ZK_GUST, p.x, p.y, Math.cos(a) * st.speed, Math.sin(a) * st.speed, st.radius * size, life, st.tick, st.damage, flags, 120);
    if (heat && z >= 0) w.zones.aux[z] = heat.stats.damage * 0.5;
  }
  w.sound(heat ? 'fire' : 'gust');
}

// -------------------------------------------------------- The Deathdealing

/** Clouds of a lethal dose. */
export function castCloud(w: World, ps: PowerState): void {
  ps.timer -= DT;
  if (ps.timer > 0) return;
  const st = ps.stats;
  ps.timer = cooldown(w, st.cooldown);
  const count = st.count + w.stats.count;
  const size = st.size * w.stats.size;
  const life = st.duration * w.stats.duration;
  let flags = 0;
  if (ps.attr === 'lethal') flags |= ZF_VULN;
  if (ps.attr === 'spreading') flags |= ZF_SPREAD;
  const p = w.player;
  for (let k = 0; k < count; k++) {
    const j = w.randomEnemyNear(320);
    const x = j >= 0 ? w.en.x[j] : p.x + w.rng.range(-120, 120);
    const y = j >= 0 ? w.en.y[j] : p.y + w.rng.range(-120, 120);
    w.spawnZone(ZK_POISON, x, y, 0, 0, st.radius * size, life, st.tick, st.damage, flags, 0.3);
  }
  if (ps.attr === 'giftball') w.spawnZone(ZK_POISON, p.x, p.y, 0, 0, st.radius * size * 0.9, life, st.tick, st.damage, flags | ZF_FOLLOW, 0.3);
}

// ---------------------------------------------------------- The Knowledge

/** Drones circle you and fire missiles. */
export function castDrones(w: World, ps: PowerState, slot: number): void {
  const st = ps.stats;
  ps.angle += 0.9 * DT;
  ps.timer -= DT;
  if (ps.timer > 0) return;
  ps.timer = cooldown(w, st.cooldown / (ps.attr === 'overclock' ? 1.6 : 1));
  const P = w.pr;
  const E = w.en;
  const flags = PF_BURST | (ps.attr === 'homing' ? PF_HOMING : 0);
  const burst = st.radius * st.size * w.stats.size;
  let fired = 0;
  for (let i = 0; i < P.n; i++) {
    if (P.kind[i] !== PK_DRONE || P.src[i] !== slot || P.life[i] <= 0) continue;
    const j = w.randomEnemyNear(420);
    if (j < 0) continue;
    const a = Math.atan2(E.y[j] - P.y[i], E.x[j] - P.x[i]);
    const m = w.spawnProjectile(PK_MISSILE, slot, P.x[i], P.y[i], Math.cos(a) * st.speed, Math.sin(a) * st.speed, 1.6, st.damage, 7, 0, flags);
    if (m >= 0) w.pr.pa[m] = burst;
    fired++;
  }
  if (fired > 0) w.sound('shoot');
}

export function respawnDrones(w: World, slot: number): void {
  const ps = w.powers[slot];
  ps.active = Infinity;
  w.clearKind(slot, PK_DRONE);
  const n = ps.stats.count + w.stats.count + (ps.attr === 'arsenal' ? 2 : 0);
  for (let k = 0; k < n; k++) w.spawnOrbiter(PK_DRONE, slot, (k / n) * TAU, 70, 0, 9, 0);
}

/** Homing missiles turn toward the nearest enemy, a little each step. */
export function steerMissile(w: World, i: number): void {
  const P = w.pr;
  const j = w.grid.nearest(P.x[i], P.y[i], 240, w.en.x, w.en.y, w.isAlive);
  if (j < 0) return;
  const want = Math.atan2(w.en.y[j] - P.y[i], w.en.x[j] - P.x[i]);
  const cur = Math.atan2(P.vy[i], P.vx[i]);
  const d = Math.atan2(Math.sin(want - cur), Math.cos(want - cur));
  const maxTurn = 7 * DT;
  const na = cur + (d > maxTurn ? maxTurn : d < -maxTurn ? -maxTurn : d);
  const sp = Math.hypot(P.vx[i], P.vy[i]);
  P.vx[i] = Math.cos(na) * sp;
  P.vy[i] = Math.sin(na) * sp;
}
