import { UPGRADE_BY_ID, UPGRADES, type UpgradeSpecial } from '../data/archives';
import { STARTABLE_IDS, STARTING_POWER } from '../data/powers';
import { scaleMods, type StatMods } from '../game/stats';
import type { SaveData } from './save';

/** The Wandenreich Archives, read from and written to the save. */

export function upgradeLevel(save: SaveData, id: string): number {
  return save.meta[id] ?? 0;
}

/** Cost of an upgrade's next level, or null once it is maxed. */
export function nextCost(save: SaveData, id: string): number | null {
  const u = UPGRADE_BY_ID.get(id);
  if (!u) return null;
  const level = upgradeLevel(save, id);
  return level < u.costs.length ? u.costs[level] : null;
}

/** Spend gold on the next level. False if it is maxed or unaffordable. */
export function buyUpgrade(save: SaveData, id: string): boolean {
  const cost = nextCost(save, id);
  if (cost === null || save.gold < cost) return false;
  save.gold -= cost;
  save.meta[id] = upgradeLevel(save, id) + 1;
  return true;
}

/** Every stat upgrade owned, summed into one set of mods for the run. */
export function metaMods(save: SaveData): StatMods {
  const out: StatMods = {};
  for (const u of UPGRADES) {
    const level = upgradeLevel(save, u.id);
    if (level === 0 || !u.perLevel) continue;
    const m = scaleMods(u.perLevel, level);
    for (const key of Object.keys(m) as (keyof StatMods)[]) out[key] = (out[key] ?? 0) + (m[key] ?? 0);
  }
  return out;
}

function special(save: SaveData, kind: UpgradeSpecial): number {
  let total = 0;
  for (const u of UPGRADES) if (u.special === kind) total += (u.amount ?? 0) * upgradeLevel(save, u.id);
  return total;
}

export function metaRevives(save: SaveData): number {
  return special(save, 'revive');
}

export function metaRerolls(save: SaveData): number {
  return special(save, 'reroll');
}

/** Treasury: multiplier on the gold a run pays out. */
export function goldMul(save: SaveData): number {
  return 1 + special(save, 'gold');
}

/** Heilig Pfeil, plus every attack ever awakened to Lv 7, in the order the game lists them. */
export function startOptions(save: SaveData): string[] {
  return STARTABLE_IDS.filter((id) => id === STARTING_POWER || save.awakened.includes(id));
}

export function setStart(save: SaveData, id: string): boolean {
  if (!startOptions(save).includes(id)) return false;
  save.start = id;
  return true;
}
