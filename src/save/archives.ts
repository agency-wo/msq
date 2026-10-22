import { ARMORY_COST, GESANG_PER, GESANG_VERSES, MASTERY_BACK, MASTERY_COSTS, masteryKey, SHELL_EVERY, UPGRADE_BY_ID, UPGRADES, verseCost, type UpgradeSpecial } from '../data/archives';
import { POWERS, STARTABLE_IDS, STARTING_POWER, type PowerDef } from '../data/powers';
import { RELIC_BY_ID, RELICS, type RelicDef } from '../data/relics';
import { SPOILS } from '../data/spoils';
import { scaleMods, type StatMods } from '../game/stats';
import { GAUNTLET } from '../data/gauntlet';
import { MISSIONS } from '../data/missions';
import { STAGE_IDS } from '../data/stages';
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

/** Every stat upgrade owned and every verse of the Kaiser Gesang, summed into one set of mods for the run. */
export function metaMods(save: SaveData): StatMods {
  const out: StatMods = {};
  for (const u of UPGRADES) {
    const level = upgradeLevel(save, u.id);
    if (level === 0 || !u.perLevel) continue;
    const m = scaleMods(u.perLevel, level);
    for (const key of Object.keys(m) as (keyof StatMods)[]) out[key] = (out[key] ?? 0) + (m[key] ?? 0);
  }
  if (save.gesang > 0) {
    out.dmg = (out.dmg ?? 0) + GESANG_PER.dmg * save.gesang;
    out.maxHp = (out.maxHp ?? 0) + GESANG_PER.maxHp * save.gesang;
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

/** Gintō reserve: level-ups waiting as a run begins. */
export function metaStartLevels(save: SaveData): number {
  return special(save, 'start');
}

/** The Emperor's Foresight: extra cards on every level-up board. */
export function metaChoices(save: SaveData): number {
  return special(save, 'choices');
}

/** Blut Vene shell: seconds before the shield grows back (0 without it). */
export function metaShellEvery(save: SaveData): number {
  return SHELL_EVERY[Math.min(SHELL_EVERY.length - 1, upgradeLevel(save, 'shell'))] ?? 0;
}

/** Jagdarmee spoils: the chance an elite leaves a second chest. */
export function metaEliteChest(save: SaveData): number {
  return special(save, 'eliteChest');
}

/** Quartermaster: extra choices in every chest. */
export function metaChestChoices(save: SaveData): number {
  return special(save, 'chestChoice');
}

/** Auswählen harvest: the share of max health a fallen boss gives back. */
export function metaBossHeal(save: SaveData): number {
  return special(save, 'bossHeal');
}

/** The Emperor's vessel and the Sternritter regimen: extra power and passive slots. */
export function metaPowerSlots(save: SaveData): number {
  return special(save, 'powerSlot');
}

export function metaPassiveSlots(save: SaveData): number {
  return special(save, 'passiveSlot');
}

/** Wandenreich bounty: gold for each calamity lived through, before the clock's share. */
export function metaBounty(save: SaveData): number {
  return special(save, 'bounty');
}

// ------------------------------------------------------------ Disciplines

/** The attacks a discipline can be learned for: every Quincy art, Schrift, support power that strikes, and bankai. */
export const MASTERY_POWERS: readonly PowerDef[] = POWERS.filter(
  (d) => (d.group === 'art' || d.group === 'schrift' || d.group === 'utility' || d.group === 'bankai') && d.base.damage > 0,
);

export function masteryLevel(save: SaveData, id: string): number {
  return save.meta[masteryKey(id)] ?? 0;
}

/** Cost of a discipline's next level, or null once mastered. */
export function nextMasteryCost(save: SaveData, id: string): number | null {
  const level = masteryLevel(save, id);
  return level < MASTERY_COSTS.length ? MASTERY_COSTS[level] : null;
}

/** The one Discipline you hold (a power id), or null. */
export function heldMastery(save: SaveData): string | null {
  for (const d of MASTERY_POWERS) if (masteryLevel(save, d.id) > 0) return d.id;
  return null;
}

/** Gold a Discipline has cost to reach a level. */
export function masterySpent(level: number): number {
  return MASTERY_COSTS.slice(0, Math.max(0, level)).reduce((a, b) => a + b, 0);
}

/** Drill a Discipline one level: the one you hold, or a first one. Another while you hold one: switchMastery. */
export function buyMastery(save: SaveData, id: string): boolean {
  if (!MASTERY_POWERS.some((d) => d.id === id)) return false;
  const held = heldMastery(save);
  if (held && held !== id) return false;
  const cost = nextMasteryCost(save, id);
  if (cost === null || save.gold < cost) return false;
  save.gold -= cost;
  save.meta[masteryKey(id)] = masteryLevel(save, id) + 1;
  return true;
}

/**
 * Take up another Discipline: the one you hold is forgotten, MASTERY_BACK of what it cost comes back, and
 * the new one starts at Lv 1. False (and nothing changes) when the first level cannot be paid for.
 */
export function switchMastery(save: SaveData, id: string): boolean {
  if (!MASTERY_POWERS.some((d) => d.id === id)) return false;
  const held = heldMastery(save);
  if (!held || held === id) return buyMastery(save, id);
  const back = Math.floor(masterySpent(masteryLevel(save, held)) * MASTERY_BACK);
  if (save.gold + back < MASTERY_COSTS[0]) return false;
  save.gold += back;
  delete save.meta[masteryKey(held)];
  return buyMastery(save, id);
}

/**
 * How far through the war you are, 0 to 1: the stages cleared, the Gauntlet's tiers and the Story's
 * missions, a third each.
 */
export function progressShare(save: SaveData): number {
  const stages = STAGE_IDS.filter((id) => save.stages[id]?.cleared).length / STAGE_IDS.length;
  const gauntlet = Math.min(GAUNTLET.length, save.gauntlet.tiers) / GAUNTLET.length;
  const story = MISSIONS.filter((m) => save.missions[m.id]?.cleared).length / MISSIONS.length;
  return (stages + gauntlet + story) / 3;
}

/**
 * The world's answer (see DIFFICULTY.pressure*), 0 to 1: how much of the Archives you have learned, or how
 * far through the war you are, whichever is more. A veteran meets the war's full strength however much
 * they trained.
 */
export function metaPressure(save: SaveData): number {
  return Math.max(trainingShare(save), progressShare(save));
}

/**
 * How much of the Archives you have learned, 0 to 1: every training level,
 * every discipline level and every verse of the Kaiser Gesang, against all
 * there are. The world answers it (see DIFFICULTY.pressure*).
 */
export function trainingShare(save: SaveData): number {
  let have = save.gesang;
  let all = GESANG_VERSES;
  for (const u of UPGRADES) {
    have += Math.min(u.costs.length, upgradeLevel(save, u.id));
    all += u.costs.length;
  }
  // One Discipline is held at a time, so its five levels are all there are to learn.
  const held = heldMastery(save);
  have += held ? masteryLevel(save, held) : 0;
  all += MASTERY_COSTS.length;
  return all > 0 ? Math.min(1, have / all) : 0;
}

/** Every discipline learned, by power, for the run. */
export function metaMastery(save: SaveData): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of MASTERY_POWERS) {
    const level = masteryLevel(save, d.id);
    if (level > 0) out[d.id] = level;
  }
  return out;
}

// ------------------------------------------------------------ the Armory

/** What the Armory can hold: every relic, the feat relics once their feat has opened them. */
export function armoryRelics(save: SaveData): RelicDef[] {
  return RELICS.filter((r) => !r.locked || save.relicsOpen.includes(r.id));
}

/** The price of storing a relic in the Armory (by rarity), or null if there is no such relic. */
export function armoryCost(id: string): number | null {
  const r = RELIC_BY_ID.get(id);
  return r ? ARMORY_COST[r.rarity] : null;
}

/** Buy a relic into the Armory. False if it is already there, not open yet, or unaffordable. */
export function buyArmory(save: SaveData, id: string): boolean {
  if (save.armory.includes(id) || !armoryRelics(save).some((r) => r.id === id)) return false;
  const cost = armoryCost(id);
  if (cost === null || save.gold < cost) return false;
  save.gold -= cost;
  save.armory.push(id);
  return true;
}

/** The spoils of war won so far (the Codex remembers them): each can be equipped without buying it. */
export function wonSpoils(save: SaveData): RelicDef[] {
  return SPOILS.filter((r) => save.codex.relics.includes(r.id));
}

/** Equip a relic from the Armory (or a spoil you have won) for every run, or null for none. */
export function setStartRelic(save: SaveData, id: string | null): boolean {
  if (id !== null && !save.armory.includes(id) && !wonSpoils(save).some((r) => r.id === id)) return false;
  save.startRelic = id;
  return true;
}

// ------------------------------------------------------------ the Kaiser Gesang

/** The price of the next verse, or null once all hundred are sung. */
export function nextVerseCost(save: SaveData): number | null {
  return verseCost(save.gesang);
}

/** Sing the next verse. False once all are sung, or if it is unaffordable. */
export function buyVerse(save: SaveData): boolean {
  const cost = verseCost(save.gesang);
  if (cost === null || save.gold < cost) return false;
  save.gold -= cost;
  save.gesang++;
  return true;
}

/**
 * The cheapest thing in the Archives the gold on hand can buy, as a short
 * label ("Licht Regen drills Lv 2"), or null when nothing is affordable.
 */
export function affordable(save: SaveData): string | null {
  const options: [number, string][] = [];
  for (const u of UPGRADES) {
    const cost = nextCost(save, u.id);
    if (cost !== null && cost <= save.gold) options.push([cost, u.costs.length > 1 ? `${u.name} Lv ${upgradeLevel(save, u.id) + 1}` : u.name]);
  }
  for (const r of armoryRelics(save)) {
    const cost = ARMORY_COST[r.rarity];
    if (!save.armory.includes(r.id) && cost <= save.gold) options.push([cost, `the ${r.name} for the Armory`]);
  }
  const verse = verseCost(save.gesang);
  if (verse !== null && verse <= save.gold) options.push([verse, `verse ${save.gesang + 1} of the Kaiser Gesang`]);
  options.sort((a, b) => a[0] - b[0]);
  return options[0]?.[1] ?? null;
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
