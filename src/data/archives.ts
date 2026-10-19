import type { StatMods } from '../game/stats';
import type { Rarity } from './relics';

/**
 * The Wandenreich Archives: permanent upgrades bought with the gold every run
 * pays out. Stat upgrades add their perLevel mods once per level owned; the
 * special ones are read by the save helpers (revives, rerolls, gold, level-ups
 * waiting at the start, extra cards on every board).
 */

export type UpgradeSpecial = 'revive' | 'reroll' | 'gold' | 'start' | 'choices';

export interface UpgradeDef {
  id: string;
  name: string;
  /** What one level gives, shown on the row. */
  per: string;
  desc: string;
  icon: string;
  color: string;
  /** Cost of each level in turn; its length is the max level. */
  costs: readonly number[];
  perLevel?: StatMods;
  special?: UpgradeSpecial;
  /** Special upgrades: how much one level adds (a revive, a reroll, +10% gold, a level-up, a card). */
  amount?: number;
}

const STEEP = [120, 240, 400, 600, 850] as const;

export const UPGRADES: readonly UpgradeDef[] = [
  {
    id: 'arterie',
    name: 'Blut Arterie training',
    per: '+4 ATK',
    desc: 'Reishi drawn into the blood: every power hits harder.',
    icon: 'might',
    color: '#ff8a8a',
    costs: STEEP,
    perLevel: { atk: 4 },
  },
  {
    id: 'vene',
    name: 'Blut Vene training',
    per: '+6% max health',
    desc: 'The defensive blood hardens: more health every run.',
    icon: 'heart',
    color: '#9fd0ff',
    costs: STEEP,
    perLevel: { maxHp: 0.06 },
  },
  {
    id: 'hirenkyaku',
    name: 'Hirenkyaku training',
    per: '+3% speed',
    desc: 'Ride the reishi under your feet a little faster.',
    icon: 'feather',
    color: '#e6f4ff',
    costs: [150, 350, 600],
    perLevel: { moveSpeed: 0.03 },
  },
  {
    id: 'absorption',
    name: 'Absorption training',
    per: '+10% pickup range',
    desc: 'Mana and pickups drift to you from further away.',
    icon: 'magnet',
    color: '#bfe6ff',
    costs: [100, 220, 380],
    perLevel: { pickup: 0.1 },
  },
  {
    id: 'control',
    name: 'Control training',
    per: '−2% cooldowns',
    desc: 'Gather reishi faster between casts.',
    icon: 'clock',
    color: '#c9b8ff',
    costs: [150, 300, 500, 750, 1050],
    perLevel: { cdr: 0.02 },
  },
  {
    id: 'study',
    name: 'Auswählen study',
    per: '+4% mana gained',
    desc: 'Take back more from everything you defeat: faster level-ups.',
    icon: 'eye',
    color: '#9fe8ff',
    costs: [120, 250, 420, 640, 900],
    perLevel: { xpGain: 0.04 },
  },
  {
    id: 'lichtregen',
    name: 'Licht Regen drills',
    per: '+5% power size',
    desc: 'Arrows rain down wider: every power covers more ground.',
    icon: 'circles',
    color: '#bfe6ff',
    costs: [300, 600, 1000],
    perLevel: { size: 0.05 },
  },
  {
    id: 'seele',
    name: 'Seele Schneider drills',
    per: '+2% critical chance',
    desc: 'A blade of humming reishi finds the gap in any guard.',
    icon: 'blade',
    color: '#9fe8ff',
    costs: [250, 500, 900],
    perLevel: { critChance: 0.02 },
  },
  {
    id: 'treasury',
    name: 'Treasury',
    per: '+10% gold',
    desc: 'The Wandenreich pays better for every run.',
    icon: 'coin',
    color: '#ffd27a',
    costs: [150, 350, 650],
    special: 'gold',
    amount: 0.1,
  },
  {
    id: 'ransotengai',
    name: 'Ransōtengai',
    per: 'Rise once per run',
    desc: 'Threads of reishi lift you back up the first time you fall.',
    icon: 'wings',
    color: '#bfe6ff',
    costs: [1500],
    special: 'revive',
    amount: 1,
  },
  {
    id: 'reroll',
    name: 'Second Auswählen',
    per: '+1 reroll per run',
    desc: 'Redraw a level-up board you do not like.',
    icon: 'reroll',
    color: '#ffe6a0',
    costs: [200, 450, 800],
    special: 'reroll',
    amount: 1,
  },
  {
    id: 'ginto',
    name: 'Gintō reserve',
    per: '+1 level-up as the run begins',
    desc: 'Silver tubes filled with reishi before you set out: choose a power before the first enemy arrives.',
    icon: 'tube',
    color: '#d8e2f0',
    costs: [800, 1600],
    special: 'start',
    amount: 1,
  },
  {
    id: 'foresight',
    name: 'The Emperor’s Foresight',
    per: '+1 card on every level-up',
    desc: 'See one more future each time you choose what to take back.',
    icon: 'eye',
    color: '#ffe6a0',
    costs: [3500],
    special: 'choices',
    amount: 1,
  },
];

export const UPGRADE_BY_ID: ReadonlyMap<string, UpgradeDef> = new Map(UPGRADES.map((u) => [u.id, u]));

/**
 * The Armory: relics bought into it for good. One of them can be equipped,
 * and every run (except the Daily Trial) starts with it. Priced by rarity.
 */
export const ARMORY_COST: Readonly<Record<Rarity, number>> = { common: 400, rare: 800, legendary: 1200 };

/**
 * The Kaiser Gesang, the song that foretold the sealed Emperor's return: his
 * heartbeat first, then his mind, then his power. Its verses are bought one
 * after another, each dearer than the last, and each makes every run a little
 * stronger. There are a hundred.
 */
export const GESANG_VERSES = 100;
/** What each verse adds: +1% damage and +1% max health. */
export const GESANG_PER: Readonly<{ dmg: number; maxHp: number }> = { dmg: 0.01, maxHp: 0.01 };

/** The price of the next verse when `sung` verses are already sung, or null once all are. */
export function verseCost(sung: number): number | null {
  return sung >= GESANG_VERSES ? null : 400 + 100 * sung;
}
