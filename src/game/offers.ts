import type { Rng } from '../core/rng';
import type { PassiveDef } from '../data/passives';
import { upgradeCap, type PowerDef } from '../data/powers';
import type { Rarity, RelicDef } from '../data/relics';

export type Offer =
  | { kind: 'power-new'; id: string }
  | { kind: 'power-up'; id: string; to: number }
  /** The power is at Lv 6: picking this opens its three Lv 7 attributes. */
  | { kind: 'power-attr'; id: string }
  /** Both partners are awakened: their resonance joins the build (no slot). */
  | { kind: 'resonance'; id: string }
  | { kind: 'passive'; id: string; to: number }
  | { kind: 'heal' }
  | { kind: 'gold' };

export interface Owned {
  id: string;
  level: number;
}

export interface OfferInput {
  powers: readonly Owned[];
  passives: readonly Owned[];
  powerDefs: readonly PowerDef[];
  passiveDefs: readonly PassiveDef[];
  maxPowers: number;
  maxPassives: number;
  /** Resonance pairs, and the ones already owned. */
  resonances?: readonly { id: string; a: string; b: string }[];
  ownedResonances?: ReadonlySet<string>;
}

/** Combined weight of every "new power" card before the slots-used falloff. */
const NEW_TOTAL = 30;

interface Weighted<T> {
  item: T;
  w: number;
}

function drawWeighted<T>(pool: Weighted<T>[], rng: Rng): T {
  let total = 0;
  for (const c of pool) total += c.w;
  let r = rng.next() * total;
  let k = 0;
  for (; k < pool.length - 1; k++) {
    r -= pool[k].w;
    if (r < 0) break;
  }
  const [picked] = pool.splice(k, 1);
  return picked.item;
}

/**
 * The level-up board: a weighted draw without replacement. A power gets
 * likelier to appear the higher it already is, which is what snowballs a
 * build; the Lv 7 attribute pick is weighted highest so builds get defined.
 * Bankai never appear as new cards (they come from medallion bearers), but
 * once owned their upgrades do, weighted a little higher.
 */
export function generateOffers(input: OfferInput, rng: Rng, count = 3): Offer[] {
  const pool: Weighted<Offer>[] = [];
  const ownedPowers = new Map(input.powers.map((p) => [p.id, p.level]));
  const defs = new Map(input.powerDefs.map((d) => [d.id, d]));
  // Bankai and The Almighty come from elsewhere: they take no slot and are never offered as new.
  const offerable = (d: PowerDef | undefined): boolean => !!d && d.group !== 'bankai' && d.group !== 'ultimate';
  const slotsUsed = input.powers.filter((p) => offerable(defs.get(p.id))).length;
  // New powers get rarer the more you own, so a build focuses instead of spreading thin. Their
  // combined weight is shared across however many there are, so adding content to the game
  // never dilutes a build: each unowned power gets a slice, never more than 2.4.
  const unowned = input.powerDefs.filter((d) => offerable(d) && !ownedPowers.has(d.id)).length;
  const newWeight = Math.min(2.4, NEW_TOTAL / Math.max(1, unowned)) / (1 + slotsUsed * 0.5);
  for (const def of input.powerDefs) {
    const level = ownedPowers.get(def.id);
    if (level === undefined) {
      if (offerable(def) && slotsUsed < input.maxPowers) pool.push({ item: { kind: 'power-new', id: def.id }, w: newWeight });
    } else if (def.attributes && level === def.maxLevel - 1) {
      pool.push({ item: { kind: 'power-attr', id: def.id }, w: 6 });
    } else if (level < upgradeCap(def)) {
      pool.push({ item: { kind: 'power-up', id: def.id, to: level + 1 }, w: (def.group === 'bankai' ? 5 : 3) + level });
    }
  }
  // A resonance is offered, weighted high, once both of its powers are awakened (at their last level).
  for (const r of input.resonances ?? []) {
    if (input.ownedResonances?.has(r.id)) continue;
    const da = defs.get(r.a);
    const db = defs.get(r.b);
    if (!da || !db) continue;
    if (ownedPowers.get(r.a) === da.maxLevel && ownedPowers.get(r.b) === db.maxLevel) pool.push({ item: { kind: 'resonance', id: r.id }, w: 9 });
  }
  const ownedPassives = new Map(input.passives.map((p) => [p.id, p.level]));
  for (const def of input.passiveDefs) {
    const level = ownedPassives.get(def.id) ?? 0;
    if (level >= def.max) continue;
    if (level === 0 && input.passives.length >= input.maxPassives) continue;
    pool.push({ item: { kind: 'passive', id: def.id, to: level + 1 }, w: level === 0 ? 1.5 : 2 + level * 0.5 });
  }
  const out: Offer[] = [];
  while (out.length < count && pool.length > 0) out.push(drawWeighted(pool, rng));
  // Everything maxed: fall back to health and gold so the board is never empty.
  const fillers: Offer[] = [{ kind: 'heal' }, { kind: 'gold' }];
  for (const f of fillers) if (out.length < count) out.push(f);
  return out;
}

export type ChestKind = 'brown' | 'black';

const RARITY_WEIGHT: Readonly<Record<Rarity, number>> = { common: 70, rare: 26, legendary: 4 };

/**
 * Relic choices for a chest. Brown chests mix rarities; black chests (from
 * bosses) hold legendaries only, falling back to rares once those run out.
 * Relics are unique per run, so owned ones never come back.
 */
export function rollRelics(
  defs: readonly RelicDef[],
  owned: ReadonlySet<string>,
  chest: ChestKind,
  rng: Rng,
  count = 3,
): RelicDef[] {
  const available = defs.filter((d) => !owned.has(d.id));
  let source: RelicDef[];
  if (chest === 'black') {
    source = available.filter((d) => d.rarity === 'legendary');
    if (source.length === 0) source = available.filter((d) => d.rarity === 'rare');
    if (source.length === 0) source = available.slice();
  } else {
    source = available.slice();
  }
  const pool: Weighted<RelicDef>[] = source.map((d) => ({ item: d, w: chest === 'black' ? 1 : RARITY_WEIGHT[d.rarity] }));
  const out: RelicDef[] = [];
  while (out.length < count && pool.length > 0) out.push(drawWeighted(pool, rng));
  return out;
}
