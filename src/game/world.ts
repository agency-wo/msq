import { CAP, DT, GRID_CELL, GRID_DIM, MAX_ENEMIES_ALIVE, PLAYER } from '../config';
import { SpatialGrid } from '../core/grid';
import { TAU } from '../core/math';
import { Rng } from '../core/rng';
import { ENEMY_INDEX, ENEMY_LIST } from '../data/enemies';
import { PASSIVE_BY_ID, PASSIVES } from '../data/passives';
import { POWER_BY_ID, POWER_MAX_LEVEL, POWERS } from '../data/powers';
import { RELIC_BY_ID, RELICS, type RelicDef } from '../data/relics';
import { STAGE, hpScale, phaseAt, spawnRate, speedScale, xpScale, type TimelineEvent } from '../data/timeline';
import {
  FLAG_BOSS,
  FLAG_ELITE,
  FX_GLOW,
  FX_RING,
  FX_SPARK,
  LAYER_ADD,
  PF_SPECIAL,
  PK_ARROW,
  PK_BLADE,
  PK_SHARD,
} from './constants';
import { generateOffers, rollRelics, type ChestKind, type Offer } from './offers';
import { newPowerState, refreshPowerStats, respawnBlades, strikeAt, updatePowers, type PowerState } from './powers';
import { computeStats, damageMultiplier, scaleMods, type StatMods, type Stats } from './stats';
import { xpToNext } from './xp';

type Field = Float32Array | Int32Array | Uint8Array | Uint32Array;

/**
 * Struct-of-arrays pool. Live entities sit densely in [0, n); removal copies
 * the last entity into the hole, so iteration stays tight and nothing is
 * allocated while playing (allocation is what causes GC stutter on iOS).
 */
class Pool {
  n = 0;
  readonly cap: number;
  protected readonly fields: Field[] = [];

  constructor(cap: number) {
    this.cap = cap;
  }

  protected f32(): Float32Array {
    return this.track(new Float32Array(this.cap));
  }

  protected i32(): Int32Array {
    return this.track(new Int32Array(this.cap));
  }

  protected u8(): Uint8Array {
    return this.track(new Uint8Array(this.cap));
  }

  protected u32(): Uint32Array {
    return this.track(new Uint32Array(this.cap));
  }

  /** Copy slot `from` into slot `to`. */
  move(from: number, to: number): void {
    for (const a of this.fields) a[to] = a[from];
  }

  private track<T extends Field>(a: T): T {
    this.fields.push(a);
    return a;
  }
}

export class EnemyPool extends Pool {
  readonly x = this.f32();
  readonly y = this.f32();
  readonly ox = this.f32();
  readonly oy = this.f32();
  /** Knockback velocity, decays every step. */
  readonly kx = this.f32();
  readonly ky = this.f32();
  readonly hp = this.f32();
  readonly maxHp = this.f32();
  readonly r = this.f32();
  readonly spd = this.f32();
  readonly dmg = this.f32();
  readonly xp = this.f32();
  readonly flash = this.f32();
  readonly slowT = this.f32();
  readonly slowK = this.f32();
  readonly freezeT = this.f32();
  /** Time of the last blade hit; blades share a short per-enemy hit cooldown. */
  readonly ohit = this.f32();
  readonly type = this.u8();
  readonly flags = this.u8();
  /** Set when killed mid-step; the slot is reclaimed at the end of the step. */
  readonly dead = this.u8();
  /** Never reused, so a piercing arrow can remember who it already hit. */
  readonly uid = this.i32();
  /** This enemy's latest damage number, so rapid hits merge into one instead of stacking. */
  readonly nslot = this.i32();
  readonly nt = this.f32();
}

const HITS = 8;

export class ProjPool extends Pool {
  readonly x = this.f32();
  readonly y = this.f32();
  readonly ox = this.f32();
  readonly oy = this.f32();
  readonly vx = this.f32();
  readonly vy = this.f32();
  readonly life = this.f32();
  readonly dmg = this.f32();
  readonly r = this.f32();
  readonly rot = this.f32();
  /** Blades: angle offset in the ring. */
  readonly pa = this.f32();
  /** Blades: ring radius (negative spins the other way). */
  readonly pb = this.f32();
  readonly pierce = this.i32();
  readonly kind = this.u8();
  /** Owning power slot. */
  readonly src = this.u8();
  readonly flags = this.u8();
  readonly hitN = this.u8();
  readonly hits = new Int32Array(this.cap * HITS);

  move(from: number, to: number): void {
    super.move(from, to);
    this.hits.copyWithin(to * HITS, from * HITS, from * HITS + HITS);
  }
}

export class OrbPool extends Pool {
  readonly x = this.f32();
  readonly y = this.f32();
  readonly ox = this.f32();
  readonly oy = this.f32();
  readonly val = this.f32();
  readonly spd = this.f32();
  /** 0 blue, 1 orange, 2 purple. */
  readonly tier = this.u8();
  readonly mag = this.u8();
}

export class FxPool extends Pool {
  readonly x = this.f32();
  readonly y = this.f32();
  readonly ox = this.f32();
  readonly oy = this.f32();
  readonly vx = this.f32();
  readonly vy = this.f32();
  readonly life = this.f32();
  readonly max = this.f32();
  /** Start and end size in world units (diameter, or length for bolts). */
  readonly s0 = this.f32();
  readonly s1 = this.f32();
  /** Fixed thickness for stretched sprites (bolts); 0 = uniform scale. */
  readonly sy = this.f32();
  readonly a0 = this.f32();
  readonly rot = this.f32();
  readonly vr = this.f32();
  readonly drag = this.f32();
  readonly frame = this.u8();
  readonly layer = this.u8();
  /** 1 = x/y are offsets from the player, so the effect travels with you. */
  readonly follow = this.u8();
  readonly tint = this.u32();
}

/** Damage numbers in a ring buffer: when it is full the oldest number is overwritten. */
export class NumberRing {
  readonly cap: number;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly life: Float32Array;
  readonly val: Float32Array;
  readonly crit: Uint8Array;
  /** uid of the enemy the number belongs to. */
  readonly owner: Int32Array;
  private head = 0;

  constructor(cap: number) {
    this.cap = cap;
    this.x = new Float32Array(cap);
    this.y = new Float32Array(cap);
    this.life = new Float32Array(cap);
    this.val = new Float32Array(cap);
    this.crit = new Uint8Array(cap);
    this.owner = new Int32Array(cap);
  }

  /** Returns the slot used. */
  push(x: number, y: number, val: number, crit: boolean, owner: number): number {
    const i = this.head;
    this.head = (i + 1) % this.cap;
    this.x[i] = x + (Math.random() - 0.5) * 14;
    this.y[i] = y;
    this.val[i] = val;
    this.crit[i] = crit ? 1 : 0;
    this.owner[i] = owner;
    this.life[i] = 0.7;
    return i;
  }
}

export type PickupKind = 'chest' | 'chestBlack' | 'heart' | 'magnet' | 'nuke';

export interface Pickup {
  kind: PickupKind;
  x: number;
  y: number;
  born: number;
}

export interface Message {
  text: string;
  kind: 'boss' | 'info';
}

export type SoundName =
  | 'shoot'
  | 'blade'
  | 'pulse'
  | 'strike'
  | 'hit'
  | 'kill'
  | 'orb'
  | 'level'
  | 'chest'
  | 'hurt'
  | 'boss'
  | 'nuke'
  | 'freeze'
  | 'heal'
  | 'magnet'
  | 'explode';

export interface WorldOptions {
  seed?: number;
  /** Keep this many enemies alive and max every power, for performance testing. Implies god mode. */
  stress?: number;
  god?: boolean;
  /** Start the clock here (seconds) to test late-game spawns. */
  startTime?: number;
  numbers?: boolean;
}

function orbTier(v: number): number {
  return v >= 20 ? 2 : v >= 4 ? 1 : 0;
}

/** One run's whole simulation. Pure logic: the renderer and UI only read it. */
export class World {
  readonly rng: Rng;
  readonly en = new EnemyPool(CAP.enemies);
  readonly pr = new ProjPool(CAP.projectiles);
  readonly orbs = new OrbPool(CAP.orbs);
  readonly fx = new FxPool(CAP.fx);
  readonly nums = new NumberRing(CAP.numbers);
  readonly pickups: Pickup[] = [];
  readonly grid = new SpatialGrid(GRID_CELL, GRID_DIM, CAP.enemies);
  /** Scratch buffers for grid queries; nested queries must use the second one. */
  readonly qbuf = new Int32Array(4096);
  readonly qbuf2 = new Int32Array(4096);

  readonly player = {
    x: 0,
    y: 0,
    ox: 0,
    oy: 0,
    hp: PLAYER.hp as number,
    maxHp: PLAYER.hp as number,
    iframes: 0,
    face: 1,
    alive: true,
    revives: 0,
  };

  t = 0;
  steps = 0;
  level = 1;
  xp = 0;
  xpNext = xpToNext(1);
  kills = 0;
  gold = 0;
  pendingLevelUps = 0;
  readonly pendingChests: ChestKind[] = [];
  readonly messages: Message[] = [];
  readonly sounds = new Set<SoundName>();
  shake = 0;
  over: 'dead' | 'victory' | null = null;

  readonly powers: PowerState[] = [];
  readonly passives = new Map<string, number>();
  readonly relics: RelicDef[] = [];
  stats: Stats = computeStats([]);
  dmgMul = 1;

  /** Half the visible area in world units; the renderer keeps this current. */
  viewHalfW = 210;
  viewHalfH = 455;
  showNumbers: boolean;
  readonly god: boolean;
  readonly stress: number;
  /** Stopped Clock relic: seconds left of the global freeze. */
  freezeAllT = 0;
  /** The first live boss, for the boss health bar. */
  readonly boss = { active: false, hp: 0, max: 1 };

  private bossCount = 0;
  private evCursor = 0;
  private warnCursor = 0;
  private readonly bossTimes: number[];
  private spawnAcc = 0;
  private uidSeq = 0;
  private moveX = 0;
  private moveY = -1;
  private tx = 0;
  private ty = 0;
  private clockCd = 20;
  private sigilCd = 6;
  private hasClock = false;
  private hasSigil = false;
  private finalBossUid = -1;
  private victoryT = -1;
  private readonly isAlive = (i: number): boolean => this.en.dead[i] === 0;

  constructor(opts: WorldOptions = {}) {
    this.rng = new Rng(opts.seed);
    this.stress = Math.max(0, Math.floor(opts.stress ?? 0));
    this.god = !!opts.god || this.stress > 0;
    this.showNumbers = opts.numbers ?? true;
    this.bossTimes = STAGE.events.filter((e) => e.kind === 'boss').map((e) => e.at);
    const start = Math.max(0, opts.startTime ?? 0);
    if (start > 0) {
      this.t = start;
      while (this.evCursor < STAGE.events.length && STAGE.events[this.evCursor].at < start) this.evCursor++;
      while (this.warnCursor < this.bossTimes.length && this.bossTimes[this.warnCursor] - 4 < start) this.warnCursor++;
    }
    this.addPower('arrow');
    if (this.stress > 0) {
      for (const def of POWERS) {
        this.addPower(def.id);
        while (this.powerLevel(def.id) < POWER_MAX_LEVEL - 1) this.addPower(def.id);
      }
    }
    this.recomputeStats();
    this.player.hp = this.player.maxHp;
  }

  // ---------------------------------------------------------------- step

  /** Advance one fixed 1/60 s step. (mx, my) is the joystick vector. */
  step(mx: number, my: number): void {
    if (this.over) return;
    this.t += DT;
    this.steps++;
    const p = this.player;
    p.ox = p.x;
    p.oy = p.y;
    const speed = PLAYER.speed * this.stats.moveSpeed;
    p.x += mx * speed * DT;
    p.y += my * speed * DT;
    if (mx > 0.05) p.face = 1;
    else if (mx < -0.05) p.face = -1;
    if (mx !== 0 || my !== 0) {
      this.moveX = mx;
      this.moveY = my;
    }
    this.runTimeline();
    this.spawnTick();
    this.grid.build(this.en.x, this.en.y, this.en.dead, this.en.n, p.x, p.y);
    this.updateEnemies();
    updatePowers(this);
    this.updateProjectiles();
    this.updateOrbs();
    this.updatePickups();
    this.updateFx();
    this.updateNumbers();
    this.updateTimers();
    this.compact();
  }

  sound(name: SoundName): void {
    this.sounds.add(name);
  }

  // ------------------------------------------------------------ timeline

  private runTimeline(): void {
    if (this.stress > 0) return;
    while (this.warnCursor < this.bossTimes.length && this.t >= this.bossTimes[this.warnCursor] - 4) {
      this.warnCursor++;
      this.messages.push({ text: 'A Warden approaches', kind: 'boss' });
      this.sound('boss');
    }
    const events = STAGE.events;
    while (this.evCursor < events.length && this.t >= events[this.evCursor].at) this.fire(events[this.evCursor++]);
    if (this.victoryT > 0) {
      this.victoryT -= DT;
      if (this.victoryT <= 0) this.over = 'victory';
    }
  }

  private fire(ev: TimelineEvent): void {
    const p = this.player;
    switch (ev.kind) {
      case 'ring': {
        const R = Math.max(this.viewHalfW, this.viewHalfH) + 50;
        const type = ENEMY_INDEX[ev.enemy];
        for (let k = 0; k < ev.count; k++) {
          const a = (k / ev.count) * TAU;
          this.spawnEnemy(type, p.x + Math.cos(a) * R, p.y + Math.sin(a) * R);
        }
        break;
      }
      case 'elite':
        this.edgePoint();
        this.spawnEnemy(ENEMY_INDEX[ev.enemy], this.tx, this.ty, true);
        break;
      case 'boss': {
        this.edgePoint(80);
        const i = this.spawnEnemy(ENEMY_INDEX[ev.enemy], this.tx, this.ty, false, ev.hpMul);
        if (i >= 0) {
          this.bossCount++;
          if (ev.final) this.finalBossUid = this.en.uid[i];
        }
        this.shake = Math.max(this.shake, 8);
        break;
      }
      case 'chest': {
        const a = this.rng.next() * TAU;
        const d = this.rng.range(170, 230);
        this.addPickup('chest', p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
        break;
      }
      case 'rune': {
        const a = this.rng.next() * TAU;
        const d = this.rng.range(120, 180);
        this.addPickup(ev.rune, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
        break;
      }
    }
  }

  private spawnTick(): void {
    const E = this.en;
    if (this.stress > 0) {
      let budget = 60;
      const far = Math.hypot(this.viewHalfW, this.viewHalfH) + 40;
      while (E.n < this.stress && budget-- > 0) {
        const a = this.rng.next() * TAU;
        const d = this.rng.range(120, far);
        this.spawnEnemy(this.rng.int(4), this.player.x + Math.cos(a) * d, this.player.y + Math.sin(a) * d, false, 3);
      }
      return;
    }
    this.spawnAcc += spawnRate(this.t) * DT;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (E.n >= MAX_ENEMIES_ALIVE) {
        this.spawnAcc = 0;
        break;
      }
      this.edgePoint();
      this.spawnEnemy(this.pickType(), this.tx, this.ty);
    }
  }

  private pickType(): number {
    const mix = phaseAt(this.t).mix;
    let total = 0;
    for (const entry of mix) total += entry[1];
    let r = this.rng.next() * total;
    for (const entry of mix) {
      r -= entry[1];
      if (r < 0) return ENEMY_INDEX[entry[0]];
    }
    return ENEMY_INDEX[mix[mix.length - 1][0]];
  }

  /** A random point just outside the visible area, written to tx/ty. */
  private edgePoint(margin = 40): void {
    const p = this.player;
    const hw = this.viewHalfW + margin;
    const hh = this.viewHalfH + margin;
    const w2 = hw * 2;
    const h2 = hh * 2;
    let d = this.rng.next() * 2 * (w2 + h2);
    if (d < w2) {
      this.tx = p.x - hw + d;
      this.ty = p.y - hh;
      return;
    }
    d -= w2;
    if (d < w2) {
      this.tx = p.x - hw + d;
      this.ty = p.y + hh;
      return;
    }
    d -= w2;
    if (d < h2) {
      this.tx = p.x - hw;
      this.ty = p.y - hh + d;
      return;
    }
    d -= h2;
    this.tx = p.x + hw;
    this.ty = p.y - hh + d;
  }

  // ------------------------------------------------------------- enemies

  spawnEnemy(type: number, x: number, y: number, elite = false, hpMul = 1): number {
    const E = this.en;
    if (E.n >= E.cap) return -1;
    const def = ENEMY_LIST[type];
    const i = E.n++;
    // Bosses get their health from the timeline alone; everything else also scales with time.
    let hp = def.hp * hpMul * (def.boss ? 1 : hpScale(this.t));
    let r = def.radius;
    let dmg = def.damage;
    let xp = def.xp * xpScale(this.t);
    let flags = 0;
    if (elite) {
      hp *= 12;
      r *= 1.45;
      dmg *= 1.5;
      xp *= 10;
      flags |= FLAG_ELITE;
    }
    if (def.boss) flags |= FLAG_BOSS;
    E.x[i] = E.ox[i] = x;
    E.y[i] = E.oy[i] = y;
    E.kx[i] = E.ky[i] = 0;
    E.hp[i] = E.maxHp[i] = hp;
    E.r[i] = r;
    E.spd[i] = def.speed * (def.boss ? 1 : speedScale(this.t)) * this.rng.range(0.9, 1.1);
    E.dmg[i] = dmg;
    E.xp[i] = xp;
    E.flash[i] = 0;
    E.slowT[i] = 0;
    E.slowK[i] = 0;
    E.freezeT[i] = 0;
    E.ohit[i] = -10;
    E.type[i] = type;
    E.flags[i] = flags;
    E.dead[i] = 0;
    E.uid[i] = ++this.uidSeq;
    E.nslot[i] = -1;
    E.nt[i] = -10;
    return i;
  }

  private updateEnemies(): void {
    const E = this.en;
    const g = this.grid;
    const p = this.player;
    const parity = this.steps & 1;
    const frozenAll = this.freezeAllT > 0;
    const recycle = Math.hypot(this.viewHalfW, this.viewHalfH) * 1.6;
    const recycle2 = recycle * recycle;
    const dim = g.dim;
    const cs = g.cell;
    const start = g.start;
    const items = g.items;
    for (let i = 0; i < E.n; i++) {
      if (E.dead[i]) continue;
      let x = E.x[i];
      let y = E.y[i];
      E.ox[i] = x;
      E.oy[i] = y;
      if (E.flash[i] > 0) E.flash[i] -= DT;
      const boss = (E.flags[i] & FLAG_BOSS) !== 0;
      let k = 1;
      if (E.freezeT[i] > 0) {
        E.freezeT[i] -= DT;
        k = 0;
      } else if (frozenAll && !boss) {
        k = 0;
      } else if (E.slowT[i] > 0) {
        E.slowT[i] -= DT;
        k = 1 - E.slowK[i];
      }
      const dx = p.x - x;
      const dy = p.y - y;
      const dist2 = dx * dx + dy * dy;
      const dist = Math.sqrt(dist2) || 1;
      const v = E.spd[i] * k * DT;
      x += (dx / dist) * v;
      y += (dy / dist) * v;
      const kx = E.kx[i];
      const ky = E.ky[i];
      if (kx !== 0 || ky !== 0) {
        x += kx * DT;
        y += ky * DT;
        const nkx = kx * 0.86;
        const nky = ky * 0.86;
        if (Math.abs(nkx) + Math.abs(nky) < 3) {
          E.kx[i] = 0;
          E.ky[i] = 0;
        } else {
          E.kx[i] = nkx;
          E.ky[i] = nky;
        }
      }
      // Soft separation so the swarm spreads out instead of stacking. Half the swarm each step.
      if ((i & 1) === parity) {
        const r = E.r[i];
        const c0x = Math.floor((x - g.originX) / cs);
        const c0y = Math.floor((y - g.originY) / cs);
        let px = 0;
        let py = 0;
        let checks = 0;
        for (let cy = c0y - 1; cy <= c0y + 1 && checks < 14; cy++) {
          if (cy < 0 || cy >= dim) continue;
          for (let cx = c0x - 1; cx <= c0x + 1 && checks < 14; cx++) {
            if (cx < 0 || cx >= dim) continue;
            const c = cy * dim + cx;
            const end = start[c + 1];
            for (let q = start[c]; q < end && checks < 14; q++) {
              const j = items[q];
              if (j === i || E.dead[j]) continue;
              checks++;
              const ex = x - E.x[j];
              const ey = y - E.y[j];
              const min = (r + E.r[j]) * 0.85;
              const e2 = ex * ex + ey * ey;
              if (e2 >= min * min || e2 < 1e-4) continue;
              const e = Math.sqrt(e2);
              const push = (min - e) / e;
              px += ex * push;
              py += ey * push;
            }
          }
        }
        if (px !== 0 || py !== 0) {
          const mass = boss ? 0.04 : r > 15 ? 0.25 : 0.5;
          let sx = px * mass;
          let sy = py * mass;
          const m = Math.hypot(sx, sy);
          if (m > 3) {
            sx *= 3 / m;
            sy *= 3 / m;
          }
          x += sx;
          y += sy;
        }
      }
      E.x[i] = x;
      E.y[i] = y;
      if (dist < E.r[i] + PLAYER.radius + 2) this.contact(i);
      else if (dist2 > recycle2 && !boss) this.recycle(i);
    }
  }

  private contact(i: number): void {
    const E = this.en;
    this.hurtPlayer(E.dmg[i]);
    if (ENEMY_LIST[E.type[i]].bomber) {
      this.explosionFx(E.x[i], E.y[i]);
      this.killEnemy(i);
    }
  }

  /** Move a straggler that fell far behind to just off-screen ahead of you. */
  private recycle(i: number): void {
    const E = this.en;
    const p = this.player;
    const a = Math.atan2(this.moveY, this.moveX) + this.rng.range(-1, 1);
    const d = Math.hypot(this.viewHalfW, this.viewHalfH) + 30;
    E.x[i] = E.ox[i] = p.x + Math.cos(a) * d;
    E.y[i] = E.oy[i] = p.y + Math.sin(a) * d;
    E.kx[i] = E.ky[i] = 0;
  }

  damageEnemy(i: number, base: number, knock = 0, srcX = this.player.x, srcY = this.player.y): void {
    const E = this.en;
    if (E.dead[i]) return;
    const crit = this.rng.next() < this.stats.critChance;
    const dmg = base * this.dmgMul * (crit ? this.stats.critMult : 1);
    E.hp[i] -= dmg;
    E.flash[i] = 0.07;
    if (knock > 0 && !(E.flags[i] & FLAG_BOSS)) {
      const dx = E.x[i] - srcX;
      const dy = E.y[i] - srcY;
      const d = Math.hypot(dx, dy) || 1;
      const k = E.flags[i] & FLAG_ELITE ? knock * 0.25 : knock;
      E.kx[i] += (dx / d) * k;
      E.ky[i] += (dy / d) * k;
    }
    if (this.showNumbers) {
      // Hits on the same enemy within 0.15 s add up in one number; crits always get their own.
      const N = this.nums;
      const slot = E.nslot[i];
      if (!crit && slot >= 0 && this.t - E.nt[i] < 0.15 && N.owner[slot] === E.uid[i] && N.crit[slot] === 0 && N.life[slot] > 0.4) {
        N.val[slot] += dmg;
      } else {
        E.nslot[i] = N.push(E.x[i], E.y[i] - E.r[i], dmg, crit, E.uid[i]);
        E.nt[i] = this.t;
      }
    }
    this.sound('hit');
    if (E.hp[i] <= 0) this.killEnemy(i);
  }

  killEnemy(i: number): void {
    const E = this.en;
    if (E.dead[i]) return;
    E.dead[i] = 1;
    this.kills++;
    const x = E.x[i];
    const y = E.y[i];
    const flags = E.flags[i];
    const def = ENEMY_LIST[E.type[i]];
    this.spawnOrb(x, y, E.xp[i]);
    if (flags & FLAG_BOSS) {
      this.bossCount = Math.max(0, this.bossCount - 1);
      this.addPickup('chestBlack', x, y);
      for (let k = 0; k < 10; k++) {
        const a = this.rng.next() * TAU;
        const d = this.rng.range(20, 70);
        this.spawnOrb(x + Math.cos(a) * d, y + Math.sin(a) * d, E.xp[i] * 0.3);
      }
      this.shake = Math.max(this.shake, 14);
      this.messages.push({ text: 'Warden defeated', kind: 'info' });
      this.bigBurst(x, y, def.color);
      if (E.uid[i] === this.finalBossUid) this.victoryT = 2.2;
    } else {
      if (flags & FLAG_ELITE) {
        this.addPickup('chest', x, y);
      } else {
        const roll = this.rng.next();
        if (roll < 0.0035) this.addPickup('heart', x, y);
        else if (roll < 0.005) this.addPickup('magnet', x, y);
        else if (roll < 0.0056) this.addPickup('nuke', x, y);
      }
      this.deathFx(x, y, def.color);
    }
    this.sound('kill');
  }

  hurtPlayer(amount: number): void {
    const p = this.player;
    if (p.iframes > 0 || this.god || !p.alive) return;
    p.hp -= amount * this.stats.dmgTaken;
    p.iframes = PLAYER.iframes;
    this.shake = Math.max(this.shake, 5);
    this.sound('hurt');
    if (p.hp > 0) return;
    if (p.revives > 0) {
      p.revives--;
      p.hp = p.maxHp * 0.5;
      p.iframes = 2.5;
      this.shockwave(220);
      this.messages.push({ text: 'The feather burns. You rise again.', kind: 'info' });
    } else {
      p.hp = 0;
      p.alive = false;
      this.over = 'dead';
    }
  }

  private shockwave(R: number): void {
    const E = this.en;
    const p = this.player;
    for (let i = 0; i < E.n; i++) {
      if (E.dead[i]) continue;
      const dx = E.x[i] - p.x;
      const dy = E.y[i] - p.y;
      if (dx * dx + dy * dy > R * R) continue;
      this.damageEnemy(i, 40 + this.level * 4, 420, p.x, p.y);
    }
    this.spawnFx(FX_RING, 0, 0, 0, 0, 0.5, 40, R * 2.2, 1, 0, 0, 0xffe6a0, LAYER_ADD, 0, 1);
    this.shake = 12;
  }

  nearestEnemy(range: number): number {
    return this.grid.nearest(this.player.x, this.player.y, range, this.en.x, this.en.y, this.isAlive);
  }

  /** A random live enemy within `range`, preferring ones on screen; -1 if none. */
  randomEnemyNear(range: number): number {
    const p = this.player;
    const E = this.en;
    const n = this.grid.query(p.x - range, p.y - range, p.x + range, p.y + range, this.qbuf);
    if (n === 0) return -1;
    for (let tries = 0; tries < 10; tries++) {
      const j = this.qbuf[this.rng.int(n)];
      if (E.dead[j]) continue;
      const dx = E.x[j] - p.x;
      const dy = E.y[j] - p.y;
      if (dx * dx + dy * dy > range * range) continue;
      if (Math.abs(dx) > this.viewHalfW + 20 || Math.abs(dy) > this.viewHalfH) continue;
      return j;
    }
    return -1;
  }

  // --------------------------------------------------------- projectiles

  spawnProjectile(
    kind: number,
    src: number,
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    dmg: number,
    r: number,
    pierce: number,
    flags: number,
  ): number {
    const P = this.pr;
    if (P.n >= P.cap) return -1;
    const i = P.n++;
    P.x[i] = P.ox[i] = x;
    P.y[i] = P.oy[i] = y;
    P.vx[i] = vx;
    P.vy[i] = vy;
    P.life[i] = life;
    P.dmg[i] = dmg;
    P.r[i] = r;
    P.rot[i] = Math.atan2(vy, vx);
    P.pa[i] = 0;
    P.pb[i] = 0;
    P.pierce[i] = pierce;
    P.kind[i] = kind;
    P.src[i] = src;
    P.flags[i] = flags;
    P.hitN[i] = 0;
    return i;
  }

  spawnBlade(slot: number, offset: number, ring: number, dmg: number, r: number, flags: number): void {
    const ps = this.powers[slot];
    const p = this.player;
    const ang = (ring < 0 ? -ps.angle : ps.angle) + offset;
    const rad = Math.abs(ring);
    const i = this.spawnProjectile(PK_BLADE, slot, p.x + Math.cos(ang) * rad, p.y + Math.sin(ang) * rad, 0, 0, 1e9, dmg, r, 0, flags);
    if (i < 0) return;
    this.pr.pa[i] = offset;
    this.pr.pb[i] = ring;
    this.pr.rot[i] = ang;
  }

  clearBlades(slot: number): void {
    const P = this.pr;
    for (let i = 0; i < P.n; i++) if (P.kind[i] === PK_BLADE && P.src[i] === slot) P.life[i] = -1;
  }

  private updateProjectiles(): void {
    const P = this.pr;
    const E = this.en;
    const g = this.grid;
    const buf = this.qbuf;
    const p = this.player;
    for (let i = 0; i < P.n; i++) {
      if (P.life[i] <= 0) continue;
      const kind = P.kind[i];
      P.ox[i] = P.x[i];
      P.oy[i] = P.y[i];
      let x: number;
      let y: number;
      if (kind === PK_BLADE) {
        const ps = this.powers[P.src[i]];
        if (!ps || ps.active <= 0) {
          P.life[i] = -1;
          continue;
        }
        const ring = P.pb[i];
        const ang = (ring < 0 ? -ps.angle : ps.angle) + P.pa[i];
        const rad = Math.abs(ring);
        x = p.x + Math.cos(ang) * rad;
        y = p.y + Math.sin(ang) * rad;
        P.rot[i] = ang;
      } else {
        P.life[i] -= DT;
        if (P.life[i] <= 0) continue;
        x = P.x[i] + P.vx[i] * DT;
        y = P.y[i] + P.vy[i] * DT;
      }
      P.x[i] = x;
      P.y[i] = y;
      const r = P.r[i];
      const n = g.query(x - r - 46, y - r - 46, x + r + 46, y + r + 46, buf);
      for (let k = 0; k < n; k++) {
        const j = buf[k];
        if (E.dead[j]) continue;
        const rr = r + E.r[j];
        const dx = E.x[j] - x;
        const dy = E.y[j] - y;
        if (dx * dx + dy * dy > rr * rr) continue;
        if (kind === PK_BLADE) {
          if (this.t - E.ohit[j] < 0.3) continue;
          E.ohit[j] = this.t;
          this.damageEnemy(j, P.dmg[i], 70, x, y);
          if (P.flags[i] & PF_SPECIAL && this.rng.next() < 0.3) this.spawnShards(x, y, P.dmg[i] * 0.5);
          continue;
        }
        const uid = E.uid[j];
        if (this.alreadyHit(i, uid)) continue;
        this.recordHit(i, uid);
        this.damageEnemy(j, P.dmg[i], kind === PK_ARROW ? 30 : 15, x - P.vx[i] * 0.05, y - P.vy[i] * 0.05);
        if (P.flags[i] & PF_SPECIAL) this.burst(x, y, 36 * this.stats.size, P.dmg[i] * 0.6, j);
        if (P.pierce[i]-- <= 0) {
          P.life[i] = -1;
          this.spawnFx(FX_SPARK, x, y, 0, 0, 0.15, 12, 4, 1, this.rng.next() * TAU, 0, 0xbfe8ff, LAYER_ADD);
          break;
        }
      }
    }
  }

  private alreadyHit(i: number, uid: number): boolean {
    const P = this.pr;
    const n = Math.min(P.hitN[i], HITS);
    const base = i * HITS;
    for (let k = 0; k < n; k++) if (P.hits[base + k] === uid) return true;
    return false;
  }

  private recordHit(i: number, uid: number): void {
    const P = this.pr;
    P.hits[i * HITS + (P.hitN[i] % HITS)] = uid;
    if (P.hitN[i] < 255) P.hitN[i]++;
  }

  /** Area damage around a point (Detonate arrows). Uses the second query buffer: it runs inside a projectile query. */
  private burst(x: number, y: number, R: number, dmg: number, skip: number): void {
    const E = this.en;
    const buf = this.qbuf2;
    const n = this.grid.query(x - R - 46, y - R - 46, x + R + 46, y + R + 46, buf);
    for (let k = 0; k < n; k++) {
      const j = buf[k];
      if (j === skip || E.dead[j]) continue;
      const dx = E.x[j] - x;
      const dy = E.y[j] - y;
      const rr = R + E.r[j];
      if (dx * dx + dy * dy > rr * rr) continue;
      this.damageEnemy(j, dmg, 60, x, y);
    }
    this.spawnFx(FX_GLOW, x, y, 0, 0, 0.22, R * 0.8, R * 2.2, 0.85, 0, 0, 0x9fd8ff, LAYER_ADD);
  }

  private spawnShards(x: number, y: number, dmg: number): void {
    for (let k = 0; k < 2; k++) {
      const a = this.rng.next() * TAU;
      this.spawnProjectile(PK_SHARD, 0, x, y, Math.cos(a) * 320, Math.sin(a) * 320, 0.45, dmg, 6, 0, 0);
    }
  }

  // ---------------------------------------------------------- orbs + xp

  spawnOrb(x: number, y: number, value: number): void {
    const O = this.orbs;
    if (O.n >= O.cap) {
      // Pool full: fold the mana into an existing orb instead of losing it.
      const j = this.rng.int(O.n);
      O.val[j] += value;
      O.tier[j] = orbTier(O.val[j]);
      return;
    }
    const i = O.n++;
    O.x[i] = O.ox[i] = x + this.rng.range(-4, 4);
    O.y[i] = O.oy[i] = y + this.rng.range(-4, 4);
    O.val[i] = value;
    O.tier[i] = orbTier(value);
    O.mag[i] = 0;
    O.spd[i] = 0;
  }

  private updateOrbs(): void {
    const O = this.orbs;
    const p = this.player;
    const R = PLAYER.magnet * this.stats.pickup;
    const R2 = R * R;
    const grab = PLAYER.radius + 8;
    for (let i = O.n - 1; i >= 0; i--) {
      const x = O.x[i];
      const y = O.y[i];
      O.ox[i] = x;
      O.oy[i] = y;
      const dx = p.x - x;
      const dy = p.y - y;
      const d2 = dx * dx + dy * dy;
      if (!O.mag[i]) {
        if (d2 > R2) continue;
        O.mag[i] = 1;
        O.spd[i] = 40;
      }
      const d = Math.sqrt(d2) || 1;
      O.spd[i] = Math.min(1100, O.spd[i] + 1500 * DT);
      const s = O.spd[i] * DT;
      if (d <= grab + s) {
        this.gainXp(O.val[i]);
        O.n--;
        if (i < O.n) O.move(O.n, i);
        continue;
      }
      O.x[i] = x + (dx / d) * s;
      O.y[i] = y + (dy / d) * s;
    }
  }

  private gainXp(v: number): void {
    this.xp += v * this.stats.xpGain;
    this.sound('orb');
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = xpToNext(this.level);
      // Stress runs never open the level-up board: it would pause the very thing being measured.
      if (this.stress === 0) this.pendingLevelUps++;
      this.sound('level');
      this.spawnFx(FX_RING, 0, 0, 0, 0, 0.5, 20, 170, 0.9, 0, 0, 0x9fe8ff, LAYER_ADD, 0, 1);
    }
  }

  // ------------------------------------------------------------ pickups

  addPickup(kind: PickupKind, x: number, y: number): void {
    if (this.pickups.length >= CAP.pickups) {
      const idx = this.pickups.findIndex((q) => q.kind !== 'chest' && q.kind !== 'chestBlack');
      if (idx < 0) return;
      this.pickups.splice(idx, 1);
    }
    this.pickups.push({ kind, x, y, born: this.t });
  }

  private updatePickups(): void {
    const p = this.player;
    const list = this.pickups;
    const pull = PLAYER.magnet * this.stats.pickup * 0.8;
    for (let i = list.length - 1; i >= 0; i--) {
      const q = list[i];
      const dx = p.x - q.x;
      const dy = p.y - q.y;
      const d = Math.hypot(dx, dy);
      const chest = q.kind === 'chest' || q.kind === 'chestBlack';
      if (!chest && d < pull && d > 0) {
        const s = Math.min(d, 260 * DT);
        q.x += (dx / d) * s;
        q.y += (dy / d) * s;
      }
      if (d > PLAYER.radius + (chest ? 16 : 12)) continue;
      list.splice(i, 1);
      this.collect(q);
    }
  }

  private collect(q: Pickup): void {
    switch (q.kind) {
      case 'chest':
        if (this.stress === 0) this.pendingChests.push('brown');
        this.sound('chest');
        break;
      case 'chestBlack':
        if (this.stress === 0) this.pendingChests.push('black');
        this.sound('chest');
        break;
      case 'heart':
        this.heal(0.3);
        this.sound('heal');
        this.spawnFx(FX_GLOW, 0, 0, 0, 0, 0.45, 30, 100, 0.7, 0, 0, 0xff6b8a, LAYER_ADD, 0, 1);
        break;
      case 'magnet': {
        const O = this.orbs;
        for (let i = 0; i < O.n; i++) {
          O.mag[i] = 1;
          O.spd[i] = Math.max(O.spd[i], 160);
        }
        this.sound('magnet');
        break;
      }
      case 'nuke':
        this.nuke();
        break;
    }
  }

  /** Annihilation rune: clears the screen, chips the boss. */
  private nuke(): void {
    const E = this.en;
    const p = this.player;
    const hw = this.viewHalfW + 30;
    const hh = this.viewHalfH + 30;
    for (let i = 0; i < E.n; i++) {
      if (E.dead[i]) continue;
      if (Math.abs(E.x[i] - p.x) > hw || Math.abs(E.y[i] - p.y) > hh) continue;
      if (E.flags[i] & FLAG_BOSS) {
        E.hp[i] -= E.maxHp[i] * 0.08;
        E.flash[i] = 0.1;
        if (E.hp[i] <= 0) this.killEnemy(i);
      } else {
        this.killEnemy(i);
      }
    }
    this.spawnFx(FX_GLOW, 0, 0, 0, 0, 0.6, 100, 1400, 0.9, 0, 0, 0xffffff, LAYER_ADD, 0, 1);
    this.shake = 14;
    this.sound('nuke');
  }

  heal(fraction: number): void {
    const p = this.player;
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * fraction);
  }

  // ------------------------------------------------------------ effects

  spawnFx(
    frame: number,
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    s0: number,
    s1: number,
    a0: number,
    rot: number,
    vr: number,
    tint: number,
    layer: number,
    drag = 0,
    follow = 0,
    sy = 0,
  ): void {
    const F = this.fx;
    if (F.n >= F.cap) return;
    const i = F.n++;
    F.x[i] = F.ox[i] = x;
    F.y[i] = F.oy[i] = y;
    F.vx[i] = vx;
    F.vy[i] = vy;
    F.life[i] = F.max[i] = life;
    F.s0[i] = s0;
    F.s1[i] = s1 > 0 ? s1 : s0;
    F.sy[i] = sy;
    F.a0[i] = a0;
    F.rot[i] = rot;
    F.vr[i] = vr;
    F.drag[i] = drag;
    F.frame[i] = frame;
    F.layer[i] = layer;
    F.follow[i] = follow;
    F.tint[i] = tint;
  }

  private deathFx(x: number, y: number, color: number): void {
    this.spawnFx(FX_GLOW, x, y, 0, 0, 0.22, 14, 34, 0.7, 0, 0, color, LAYER_ADD);
    for (let k = 0; k < 4; k++) {
      const a = this.rng.next() * TAU;
      const s = this.rng.range(50, 130);
      this.spawnFx(FX_SPARK, x, y, Math.cos(a) * s, Math.sin(a) * s, this.rng.range(0.25, 0.45), 9, 3, 1, this.rng.next() * TAU, this.rng.range(-8, 8), color, LAYER_ADD, 4);
    }
  }

  private explosionFx(x: number, y: number): void {
    this.spawnFx(FX_GLOW, x, y, 0, 0, 0.35, 30, 110, 1, 0, 0, 0xffa040, LAYER_ADD);
    this.spawnFx(FX_RING, x, y, 0, 0, 0.3, 20, 90, 0.9, 0, 0, 0xffc070, LAYER_ADD);
    this.sound('explode');
  }

  private bigBurst(x: number, y: number, color: number): void {
    this.spawnFx(FX_GLOW, x, y, 0, 0, 0.6, 60, 320, 1, 0, 0, color, LAYER_ADD);
    this.spawnFx(FX_RING, x, y, 0, 0, 0.55, 40, 360, 1, 0, 0, 0xffffff, LAYER_ADD);
    for (let k = 0; k < 18; k++) {
      const a = this.rng.next() * TAU;
      const s = this.rng.range(120, 320);
      this.spawnFx(FX_SPARK, x, y, Math.cos(a) * s, Math.sin(a) * s, this.rng.range(0.4, 0.8), 16, 4, 1, a, this.rng.range(-6, 6), color, LAYER_ADD, 2.5);
    }
  }

  private updateFx(): void {
    const F = this.fx;
    for (let i = F.n - 1; i >= 0; i--) {
      F.life[i] -= DT;
      if (F.life[i] <= 0) {
        F.n--;
        if (i < F.n) F.move(F.n, i);
        continue;
      }
      F.ox[i] = F.x[i];
      F.oy[i] = F.y[i];
      F.x[i] += F.vx[i] * DT;
      F.y[i] += F.vy[i] * DT;
      const drag = F.drag[i];
      if (drag > 0) {
        const k = Math.max(0, 1 - drag * DT);
        F.vx[i] *= k;
        F.vy[i] *= k;
      }
      F.rot[i] += F.vr[i] * DT;
    }
  }

  private updateNumbers(): void {
    const N = this.nums;
    for (let i = 0; i < N.cap; i++) {
      if (N.life[i] <= 0) continue;
      N.life[i] -= DT;
      N.y[i] -= 36 * DT;
    }
  }

  // ------------------------------------------------------------- timers

  private updateTimers(): void {
    const p = this.player;
    if (p.iframes > 0) p.iframes -= DT;
    if (this.stats.regen > 0 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + this.stats.regen * DT);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - 28 * DT);
    if (this.freezeAllT > 0) this.freezeAllT -= DT;
    if (this.hasClock) {
      this.clockCd -= DT;
      if (this.clockCd <= 0) {
        this.clockCd = 20;
        this.freezeAllT = 2.5;
        this.spawnFx(FX_RING, 0, 0, 0, 0, 0.6, 40, 900, 0.8, 0, 0, 0x8fd0ff, LAYER_ADD, 0, 1);
        this.sound('freeze');
      }
    }
    if (this.hasSigil) {
      this.sigilCd -= DT;
      if (this.sigilCd <= 0) {
        this.sigilCd = 6;
        for (let k = 0; k < 6; k++) {
          const j = this.randomEnemyNear(320);
          if (j < 0) break;
          strikeAt(this, this.en.x[j], this.en.y[j], 30 + this.level * 1.5, 34 * this.stats.size, null);
        }
        this.sound('strike');
      }
    }
  }

  /** Reclaim slots of everything that died or expired this step. */
  private compact(): void {
    const E = this.en;
    for (let i = 0; i < E.n; ) {
      if (E.dead[i]) {
        E.n--;
        if (i < E.n) E.move(E.n, i);
      } else {
        i++;
      }
    }
    const P = this.pr;
    for (let i = 0; i < P.n; ) {
      if (P.life[i] <= 0) {
        P.n--;
        if (i < P.n) P.move(P.n, i);
      } else {
        i++;
      }
    }
    this.boss.active = false;
    if (this.bossCount > 0) {
      for (let i = 0; i < E.n; i++) {
        if (E.flags[i] & FLAG_BOSS) {
          this.boss.active = true;
          this.boss.hp = E.hp[i];
          this.boss.max = E.maxHp[i];
          break;
        }
      }
    }
  }

  // -------------------------------------------------- build choices

  offers(): Offer[] {
    return generateOffers(
      {
        powers: this.powers.map((ps) => ({ id: ps.def.id, level: ps.level })),
        passives: [...this.passives].map(([id, level]) => ({ id, level })),
        powerDefs: POWERS,
        passiveDefs: PASSIVES,
        maxPowers: 8,
        maxPassives: 6,
      },
      this.rng,
    );
  }

  relicChoices(kind: ChestKind): RelicDef[] {
    return rollRelics(RELICS, new Set(this.relics.map((r) => r.id)), kind, this.rng);
  }

  applyOffer(o: Offer): void {
    switch (o.kind) {
      case 'power-new':
      case 'power-up':
        this.addPower(o.id);
        break;
      case 'passive':
        this.addPassive(o.id);
        break;
      case 'heal':
        this.heal(0.3);
        break;
      case 'gold':
        this.gold += 25;
        break;
      case 'power-attr':
        // Resolved by chooseAttribute once the player picks one of the three.
        break;
    }
  }

  powerLevel(id: string): number {
    return this.powers.find((ps) => ps.def.id === id)?.level ?? 0;
  }

  addPower(id: string): void {
    const owned = this.powers.find((ps) => ps.def.id === id);
    if (owned) {
      if (owned.level < POWER_MAX_LEVEL - 1) {
        owned.level++;
        refreshPowerStats(owned);
        this.onPowerChanged(owned);
      }
      return;
    }
    const def = POWER_BY_ID.get(id);
    if (def) this.powers.push(newPowerState(def));
  }

  chooseAttribute(id: string, attr: string): void {
    const ps = this.powers.find((q) => q.def.id === id);
    if (!ps || ps.level !== POWER_MAX_LEVEL - 1) return;
    if (!ps.def.attributes.some((a) => a.id === attr)) return;
    ps.level = POWER_MAX_LEVEL;
    ps.attr = attr;
    refreshPowerStats(ps);
    this.onPowerChanged(ps);
  }

  private onPowerChanged(ps: PowerState): void {
    if (ps.def.kind === 'orbit' && ps.active > 0) respawnBlades(this, this.powers.indexOf(ps));
  }

  addPassive(id: string): void {
    const def = PASSIVE_BY_ID.get(id);
    if (!def) return;
    const level = this.passives.get(id) ?? 0;
    if (level >= def.max) return;
    this.passives.set(id, level + 1);
    this.recomputeStats();
  }

  addRelic(id: string): void {
    const def = RELIC_BY_ID.get(id);
    if (!def || this.relics.includes(def)) return;
    this.relics.push(def);
    if (def.special === 'phoenix') this.player.revives++;
    if (def.special === 'stopclock') this.hasClock = true;
    if (def.special === 'wildsigil') this.hasSigil = true;
    this.recomputeStats();
  }

  recomputeStats(): void {
    const mods: StatMods[] = [];
    for (const [id, level] of this.passives) {
      const def = PASSIVE_BY_ID.get(id);
      if (def) mods.push(scaleMods(def.perLevel, level));
    }
    for (const r of this.relics) if (r.mods) mods.push(r.mods);
    const p = this.player;
    const prevMax = p.maxHp;
    const prevCount = this.stats.count;
    const prevSize = this.stats.size;
    this.stats = computeStats(mods);
    this.dmgMul = damageMultiplier(this.stats);
    p.maxHp = this.stats.maxHp;
    if (p.maxHp > prevMax) p.hp += p.maxHp - prevMax;
    p.hp = Math.min(p.hp, p.maxHp);
    if (this.stats.count !== prevCount || this.stats.size !== prevSize) {
      for (let s = 0; s < this.powers.length; s++) {
        if (this.powers[s].def.kind === 'orbit' && this.powers[s].active > 0) respawnBlades(this, s);
      }
    }
  }
}
