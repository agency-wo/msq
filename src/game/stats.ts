/**
 * The stat sheet and the damage formula.
 *
 * ATK follows the rule from the analysis: it starts at 100 and percentage
 * bonuses add to that base instead of compounding, so +12% and +20% make 132,
 * not 134. `dmg` is the separate multiplicative "magic damage" bucket.
 */

export interface StatMods {
  /** Percentage points of ATK added to the base 100 (10 = +10%). */
  atk?: number;
  /** Multiplicative damage bonus (0.2 = x1.2); stacks multiplicatively. */
  dmg?: number;
  critChance?: number;
  critMult?: number;
  /** Cooldown reduction as a fraction; additive, capped at CDR_CAP. */
  cdr?: number;
  duration?: number;
  size?: number;
  /** Extra arrows, blades and strikes, flat. */
  count?: number;
  moveSpeed?: number;
  /** Max health bonus as a fraction of the base 100. */
  maxHp?: number;
  /** Health regenerated per second. */
  regen?: number;
  pickup?: number;
  xpGain?: number;
  /** Damage taken as a fraction: 0.2 takes 20% more, -0.15 takes 15% less. */
  dmgTaken?: number;
  projSpeed?: number;
  /** Extra damage to bosses and elites, as a fraction. */
  bossDmg?: number;
  /** Extra damage while below 40% health, as a fraction. */
  lowHpDmg?: number;
  /** Longer warnings on every attack aimed at you, as a fraction (Reiatsu sensing). */
  warn?: number;
  /** Chance a blow finds only an afterimage (Hirenkyaku afterimage). */
  dodge?: number;
}

export interface Stats {
  atk: number;
  /** Temporary amplification (buff zones, runes); 1 = none. */
  amp: number;
  dmgMult: number;
  critChance: number;
  critMult: number;
  cdr: number;
  duration: number;
  size: number;
  count: number;
  moveSpeed: number;
  maxHp: number;
  regen: number;
  pickup: number;
  xpGain: number;
  dmgTaken: number;
  projSpeed: number;
  bossDmg: number;
  lowHpDmg: number;
  warn: number;
  dodge: number;
}

export const BASE_ATK = 100;
export const BASE_HP = 100;
export const CDR_CAP = 0.75;
export const DMG_TAKEN_FLOOR = 0.2;
/** Below this share of max health, lowHpDmg applies. */
export const LOW_HP = 0.4;

export function computeStats(mods: readonly StatMods[]): Stats {
  let atkPoints = 0;
  let dmgMult = 1;
  let critChance = 0.05;
  let critMult = 1.5;
  let cdr = 0;
  let duration = 1;
  let size = 1;
  let count = 0;
  let moveSpeed = 1;
  let maxHp = 0;
  let regen = 0;
  let pickup = 1;
  let xpGain = 1;
  let dmgTaken = 1;
  let projSpeed = 1;
  let bossDmg = 0;
  let lowHpDmg = 0;
  let warn = 0;
  let dodge = 0;
  for (const m of mods) {
    atkPoints += m.atk ?? 0;
    dmgMult *= 1 + (m.dmg ?? 0);
    critChance += m.critChance ?? 0;
    critMult += m.critMult ?? 0;
    cdr += m.cdr ?? 0;
    duration += m.duration ?? 0;
    size += m.size ?? 0;
    count += m.count ?? 0;
    moveSpeed += m.moveSpeed ?? 0;
    maxHp += m.maxHp ?? 0;
    regen += m.regen ?? 0;
    pickup += m.pickup ?? 0;
    xpGain += m.xpGain ?? 0;
    dmgTaken += m.dmgTaken ?? 0;
    projSpeed += m.projSpeed ?? 0;
    bossDmg += m.bossDmg ?? 0;
    lowHpDmg += m.lowHpDmg ?? 0;
    warn += m.warn ?? 0;
    dodge += m.dodge ?? 0;
  }
  return {
    atk: BASE_ATK + atkPoints,
    amp: 1,
    dmgMult,
    critChance: Math.min(1, Math.max(0, critChance)),
    critMult,
    cdr: Math.min(CDR_CAP, Math.max(0, cdr)),
    duration,
    size,
    count,
    moveSpeed,
    maxHp: BASE_HP * (1 + maxHp),
    regen,
    pickup,
    xpGain,
    dmgTaken: Math.max(DMG_TAKEN_FLOOR, dmgTaken),
    projSpeed,
    bossDmg,
    lowHpDmg,
    warn,
    dodge: Math.min(0.5, dodge),
  };
}

/** Everything in the damage formula except the base damage and the crit roll. */
export function damageMultiplier(s: Stats): number {
  return (s.atk / BASE_ATK) * s.amp * s.dmgMult;
}

/** damage = base x ATK x amplification x damage bonuses x crit multiplier. */
export function hitDamage(base: number, s: Stats, crit: boolean): number {
  return base * damageMultiplier(s) * (crit ? s.critMult : 1);
}

/** A passive's per-level mods multiplied by its level. */
export function scaleMods(m: StatMods, level: number): StatMods {
  const out: StatMods = {};
  for (const key of Object.keys(m) as (keyof StatMods)[]) out[key] = (m[key] ?? 0) * level;
  return out;
}
