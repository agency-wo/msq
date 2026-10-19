import { Rng } from '../core/rng';
import { STARTABLE_IDS, STARTING_POWER } from './powers';
import type { StageId } from './stages';

/**
 * The Daily Trial: one seeded run a day. The date picks the stage, a
 * Schrift to open with beside Heilig Pfeil (any attack, awakened or not)
 * and two modifiers that bend the rules for that run.
 */

export interface DailyMod {
  id: string;
  name: string;
  desc: string;
}

export const DAILY_MODS: readonly DailyMod[] = [
  { id: 'glass', name: 'Glass Cannon', desc: 'You deal 40% more damage, and take 40% more.' },
  { id: 'swarm', name: 'The Swarm', desc: '35% more enemies, each 15% weaker.' },
  { id: 'giants', name: 'Giants', desc: 'Enemies are bigger, 50% sturdier and a little slower.' },
  { id: 'haste', name: 'Haste', desc: 'Everyone moves 15% faster, you included.' },
  { id: 'frail', name: 'Frail', desc: '60% of your health, but you regenerate 1.5 health a second.' },
  { id: 'barren', name: 'Barren', desc: 'Chests hold gold, never relics, but you level up 30% faster.' },
];

export const DAILY_MOD_BY_ID: ReadonlyMap<string, DailyMod> = new Map(DAILY_MODS.map((m) => [m.id, m]));

export interface DailySpec {
  /** Local date, YYYY-MM-DD. */
  date: string;
  seed: number;
  stage: StageId;
  /** Today's Schrift, held from the start together with Heilig Pfeil. */
  schrift: string;
  mods: string[];
}

/** Bonus gold, paid once a day each: for surviving five minutes of the trial, and for clearing it. */
export const DAILY_SURVIVE_TIME = 300;
export const DAILY_SURVIVE_GOLD = 100;
export const DAILY_CLEAR_GOLD = 300;

export function dateKey(d: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** FNV-1a, then a murmur3 finish so neighbouring dates give unrelated seeds. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

const DAILY_SCHRIFT = STARTABLE_IDS.filter((id) => id !== STARTING_POWER);

/** Today's (or any date's) trial. Players who have not reached Seireitei yet get Hueco Mundo. */
export function dailyFor(date: string, seireiteiOpen: boolean): DailySpec {
  const seed = hash(`quincy-daily-${date}`);
  const rng = new Rng(seed);
  // Always roll for the stage, so the Schrift and modifiers are the same for everyone that day.
  const roll = rng.next();
  const stage: StageId = seireiteiOpen && roll < 0.5 ? 'seireitei' : 'hueco';
  const schrift = DAILY_SCHRIFT[rng.int(DAILY_SCHRIFT.length)];
  const pool = DAILY_MODS.map((m) => m.id);
  const mods: string[] = [];
  while (mods.length < 2) {
    const id = pool.splice(rng.int(pool.length), 1)[0];
    mods.push(id);
  }
  return { date, seed, stage, schrift, mods };
}
