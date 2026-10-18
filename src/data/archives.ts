import type { StatMods } from '../game/stats';

/**
 * The Wandenreich Archives: permanent upgrades bought with the gold every run
 * pays out. Stat upgrades add their perLevel mods once per level owned; the
 * three special ones are read by the save helpers (revives, rerolls, gold).
 */

export type UpgradeSpecial = 'revive' | 'reroll' | 'gold';

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
  /** Special upgrades: how much one level adds (a revive, a reroll, +10% gold). */
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
];

export const UPGRADE_BY_ID: ReadonlyMap<string, UpgradeDef> = new Map(UPGRADES.map((u) => [u.id, u]));
