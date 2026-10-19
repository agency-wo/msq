import { Rng } from '../core/rng';
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

/** "October 19" for "2026-10-19". */
export function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

/** "Daily Trial · October 19 · Frail + Giants". */
export function dailyLine(spec: DailySpec): string {
  return `Daily Trial · ${dayLabel(spec.date)} · ${spec.mods.map((m) => DAILY_MOD_BY_ID.get(m)?.name ?? m).join(' + ')}`;
}

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

/**
 * The attacks a Daily Trial can hand you, fixed so that a day's trial never
 * changes when a new Schrift joins the game.
 */
const DAILY_SCHRIFT: readonly string[] = [
  'seele',
  'roar',
  'thunder',
  'xaxis',
  'explode',
  'heat',
  'visionary',
  'fear',
  'wind',
  'death',
  'knowledge',
  'glutton',
  'jail',
  'love',
  'power',
  'yourself',
  'zombie',
];

/** Today's (or any date's) trial. Players who have not reached a stage yet are sent to one they have. */
export function dailyFor(date: string, seireiteiOpen: boolean, palaceOpen = false, silbernOpen = false, wahrweltOpen = false): DailySpec {
  const seed = hash(`quincy-daily-${date}`);
  const rng = new Rng(seed);
  // Always roll for the stage, so the Schrift and modifiers are the same for everyone that day.
  const roll = rng.next();
  let stage: StageId = seireiteiOpen && roll < 0.5 ? 'seireitei' : 'hueco';
  const schrift = DAILY_SCHRIFT[rng.int(DAILY_SCHRIFT.length)];
  const pool = DAILY_MODS.map((m) => m.id);
  const mods: string[] = [];
  while (mods.length < 2) {
    const id = pool.splice(rng.int(pool.length), 1)[0];
    mods.push(id);
  }
  // Drawn last, so the palace changes nothing about the day for players who have not reached it.
  if (palaceOpen && rng.next() < 1 / 3) stage = 'palace';
  // Silbern after it, for the same reason.
  if (silbernOpen && rng.next() < 1 / 4) stage = 'silbern';
  if (wahrweltOpen && rng.next() < 1 / 5) stage = 'wahrwelt';
  return { date, seed, stage, schrift, mods };
}
