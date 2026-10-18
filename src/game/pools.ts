/**
 * Struct-of-arrays pools. Live entries sit densely in [0, n); removal copies
 * the last entry into the hole, so iteration stays tight and nothing is
 * allocated while playing (allocation is what causes GC stutter on iOS).
 */

type Field = Float32Array | Int32Array | Uint8Array | Uint32Array;

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

  /** Swap-remove slot i. Safe while iterating backwards. */
  remove(i: number): void {
    this.n--;
    if (i < this.n) this.move(this.n, i);
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
  /** Seconds left unable to move (frozen or paralyzed); holdKind says which, for the tint. */
  readonly freezeT = this.f32();
  readonly holdKind = this.u8();
  /** Time of the last blade or petal hit; orbiters share a short per-enemy hit cooldown. */
  readonly ohit = this.f32();
  /** Vulnerability: takes 1 + vulnK times damage while vulnT > 0. */
  readonly vulnT = this.f32();
  readonly vulnK = this.f32();
  /** One damage-over-time slot (burn or poison). */
  readonly dotT = this.f32();
  readonly dotDps = this.f32();
  readonly dotTick = this.f32();
  readonly dotKind = this.u8();
  /** Boss and elite attack timers. */
  readonly atkT = this.f32();
  readonly atk2T = this.f32();
  /** Marked by a Volatile blast: explodes for volDmg if it dies within volT. */
  readonly volT = this.f32();
  readonly volDmg = this.f32();
  /** Charmed (The Love) or risen (The Zombie): fights other enemies for charmT seconds, dealing charmDmg a second. */
  readonly charmT = this.f32();
  readonly charmDmg = this.f32();
  /** Infected by The Zombie: rises on your side if it dies while infT > 0. */
  readonly infT = this.f32();
  readonly type = this.u8();
  /** Bosses: which bankai a medallion bearer carries (index into BANKAI_IDS). */
  readonly variant = this.u8();
  readonly flags = this.u8();
  /** Set when killed mid-step; the slot is reclaimed at the end of the step. */
  readonly dead = this.u8();
  /** Never reused, so a piercing arrow can remember who it already hit. */
  readonly uid = this.i32();
  /** This enemy's latest damage number, so rapid hits merge into one instead of stacking. */
  readonly nslot = this.i32();
  readonly nt = this.f32();
}

export const HITS = 8;

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
  /** Orbiters: angle offset. Others: kind-specific (blast radius, paralysis seconds...). */
  readonly pa = this.f32();
  /** Orbiters: ring radius (negative spins the other way). Others: kind-specific. */
  readonly pb = this.f32();
  readonly pierce = this.i32();
  readonly kind = this.u8();
  /** Owning power slot. */
  readonly src = this.u8();
  readonly flags = this.u32();
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
  /** Start and end size in world units (diameter, or length for stretched sprites). */
  readonly s0 = this.f32();
  readonly s1 = this.f32();
  /** Fixed thickness for stretched sprites; 0 = uniform scale. */
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

/** Lingering areas: poison clouds, burning ground, gusts, petal storms, frost, heat auras. */
export class ZonePool extends Pool {
  readonly x = this.f32();
  readonly y = this.f32();
  readonly ox = this.f32();
  readonly oy = this.f32();
  readonly vx = this.f32();
  readonly vy = this.f32();
  readonly r = this.f32();
  readonly life = this.f32();
  readonly max = this.f32();
  readonly tickT = this.f32();
  readonly tickInt = this.f32();
  readonly dmg = this.f32();
  /** Kind-specific: push/pull strength, vulnerability amount. */
  readonly extra = this.f32();
  readonly kind = this.u8();
  readonly flags = this.u8();
  readonly src = this.u8();
  readonly seed = this.u8();
}

/** Delayed strikes with a visible warning: circles, lines and arcs. */
export class MarkPool extends Pool {
  readonly x = this.f32();
  readonly y = this.f32();
  /** Circle and arc radius, or line width. */
  readonly r = this.f32();
  /** Line length, or arc half-angle. */
  readonly len = this.f32();
  readonly ang = this.f32();
  readonly delay = this.f32();
  readonly max = this.f32();
  readonly dmg = this.f32();
  readonly kind = this.u8();
  readonly shape = this.u8();
  readonly flags = this.u8();
  readonly src = this.u8();
}

export class EBulletPool extends Pool {
  readonly x = this.f32();
  readonly y = this.f32();
  readonly ox = this.f32();
  readonly oy = this.f32();
  readonly vx = this.f32();
  readonly vy = this.f32();
  readonly r = this.f32();
  readonly life = this.f32();
  readonly dmg = this.f32();
  readonly kind = this.u8();
  readonly flags = this.u8();
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
