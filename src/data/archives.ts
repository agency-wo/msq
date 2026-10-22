import type { StatMods } from '../game/stats';
import type { Rarity } from './relics';

/**
 * The Wandenreich Archives: permanent upgrades bought with the gold every run
 * pays out. Stat upgrades add their perLevel mods once per level owned; the
 * special ones are read by the save helpers (revives, rerolls, gold, level-ups
 * waiting at the start, extra cards on every board).
 */

export type UpgradeSpecial = 'revive' | 'reroll' | 'gold' | 'start' | 'choices' | 'shell' | 'eliteChest' | 'chestChoice' | 'bossHeal' | 'powerSlot' | 'passiveSlot' | 'bounty';

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
    costs: [150, 350, 600, 950, 1400],
    perLevel: { moveSpeed: 0.03 },
  },
  {
    id: 'absorption',
    name: 'Absorption training',
    per: '+10% pickup range',
    desc: 'Mana and pickups drift to you from further away.',
    icon: 'magnet',
    color: '#bfe6ff',
    costs: [100, 220, 380, 600, 900],
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
    costs: [300, 600, 1000, 1500, 2200],
    perLevel: { size: 0.05 },
  },
  {
    id: 'seele',
    name: 'Seele Schneider drills',
    per: '+2% critical chance',
    desc: 'A blade of humming reishi finds the gap in any guard.',
    icon: 'blade',
    color: '#9fe8ff',
    costs: [250, 500, 900, 1400, 2100],
    perLevel: { critChance: 0.02 },
  },
  {
    id: 'hardening',
    name: 'Blut Vene hardening',
    per: '−3% damage taken',
    desc: 'The defensive blood set like steel under the skin: every blow lands a little lighter.',
    icon: 'shield',
    color: '#8fd0ff',
    costs: [400, 800, 1300, 1900, 2600],
    perLevel: { dmgTaken: -0.03 },
  },
  {
    id: 'restoration',
    name: 'Reishi restoration',
    per: '+0.3 health a second',
    desc: 'Draw in the reishi around you to close your wounds as you fight.',
    icon: 'drop',
    color: '#9fffd0',
    costs: [500, 1100, 1900, 2900, 4200],
    perLevel: { regen: 0.3 },
  },
  {
    id: 'bogen',
    name: 'Heilig Bogen drills',
    per: '+6% projectile speed',
    desc: 'A truer bow of reishi: arrows, blades and missiles fly faster and reach the crowd sooner.',
    icon: 'arrow',
    color: '#bfe6ff',
    costs: [300, 650, 1100, 1700, 2500],
    perLevel: { projSpeed: 0.06 },
  },
  {
    id: 'kirchenlied',
    name: 'Kirchenlied study',
    per: '+5% power duration',
    desc: 'The Quincy hymns hold a spell in place: clouds, cages, blades and fire all last longer.',
    icon: 'candle',
    color: '#e6f4ff',
    costs: [350, 750, 1250, 1900, 2800],
    perLevel: { duration: 0.05 },
  },
  {
    id: 'mastery',
    name: 'Blut Arterie mastery',
    per: '+15% critical damage',
    desc: 'Blood driven into the blow at the moment it lands: critical hits strike far harder.',
    icon: 'star',
    color: '#ff8a8a',
    costs: [500, 1100, 1900, 2900, 4200],
    perLevel: { critMult: 0.15 },
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
    per: '+1 rise per run',
    desc: 'Threads of reishi lift your body back up when you fall: once a run for each level.',
    icon: 'wings',
    color: '#bfe6ff',
    costs: [1500, 7000],
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
  {
    id: 'volleys',
    name: 'Heilig Pfeil volleys',
    per: '+1 to every power’s count',
    desc: 'One more of everything: an extra arrow in each volley, an extra blade, bolt, cage and gust.',
    icon: 'twin',
    color: '#ffe6a0',
    costs: [6000],
    perLevel: { count: 1 },
  },
  {
    id: 'discipline',
    name: 'Sternritter discipline',
    per: '+5% damage to bosses and elites',
    desc: 'The knights drill against the strongest: every blow finds the gap in a captain’s guard.',
    icon: 'helm',
    color: '#ffb36a',
    costs: [600, 1200, 2000, 3000, 4200],
    perLevel: { bossDmg: 0.05 },
  },
  {
    id: 'letzt',
    name: 'Letzt Stil drills',
    per: '+8% damage below 40% health',
    desc: 'The last style of the Quincy: the closer you are to falling, the harder you strike.',
    icon: 'flame',
    color: '#ff6a7e',
    costs: [700, 1500, 2600],
    perLevel: { lowHpDmg: 0.08 },
  },
  {
    id: 'shell',
    name: 'Blut Vene shell',
    per: 'A shield that turns one blow, grown back every 60 / 45 / 30 s',
    desc: 'Blut Vene hardened into a shell over the skin, which breaks on one blow and closes again.',
    icon: 'shield',
    color: '#cfd8e6',
    costs: [1200, 2400, 4000],
    special: 'shell',
    amount: 1,
  },
  {
    id: 'jagd',
    name: 'Jagdarmee spoils',
    per: '+15% chance an elite leaves a second chest',
    desc: 'The hunting army brings back more of what the strong ones carried.',
    icon: 'banner',
    color: '#ffd27a',
    costs: [800, 1700, 3000],
    special: 'eliteChest',
    amount: 0.15,
  },
  {
    id: 'quartermaster',
    name: 'Quartermaster',
    per: '+1 choice in every chest',
    desc: 'The Wandenreich’s stores open wider: one more in every chest you open.',
    icon: 'vault',
    color: '#ffe6a0',
    costs: [5000],
    special: 'chestChoice',
    amount: 1,
  },
  {
    id: 'harvest',
    name: 'Auswählen harvest',
    per: 'A boss falling gives back 12% of your health',
    desc: 'Take back a little of what a fallen enemy held.',
    icon: 'drop',
    color: '#ff8a9a',
    costs: [1500, 3200],
    special: 'bossHeal',
    amount: 0.12,
  },
  {
    id: 'sensing',
    name: 'Reiatsu sensing',
    per: 'Warnings last 15% longer',
    desc: 'Feel the reiatsu gather before a blow falls: every attack aimed at you shows itself a moment sooner.',
    icon: 'eye',
    color: '#bfe8ff',
    costs: [600, 1300, 2400],
    perLevel: { warn: 0.15 },
  },
  {
    id: 'afterimage',
    name: 'Hirenkyaku afterimage',
    per: '3% of blows miss',
    desc: 'A step too quick to follow: some blows strike only the place you just left.',
    icon: 'wing',
    color: '#d8f0ff',
    costs: [900, 1900, 3200],
    perLevel: { dodge: 0.03 },
  },
  {
    id: 'vessel',
    name: 'The Emperor’s vessel',
    per: 'One more power slot',
    desc: 'Every power he ever gave away is his to hold again: carry one more at once.',
    icon: 'crown',
    color: '#ffd27a',
    costs: [9000, 18000],
    special: 'powerSlot',
    amount: 1,
  },
  {
    id: 'regimen',
    name: 'Sternritter regimen',
    per: 'One more passive slot',
    desc: 'Every drill of the knights at once, until the body keeps one more of them.',
    icon: 'gear',
    color: '#c8d2e0',
    costs: [7000],
    special: 'passiveSlot',
    amount: 1,
  },
  {
    id: 'bounty',
    name: 'Wandenreich bounty',
    per: '+40 gold for every calamity you live through',
    desc: 'The Wandenreich pays for every calamity its Emperor walks out of, more the longer the war goes on, and a ring of mana with it.',
    icon: 'coin',
    color: '#ffcb5c',
    costs: [700, 1500, 2600],
    special: 'bounty',
    amount: 40,
  },
];

/** Blut Vene shell: seconds before the shield grows back, by level (0 for none). */
export const SHELL_EVERY: readonly number[] = [0, 60, 45, 30];

/**
 * Disciplines: a mastery for one attack, bought in the Archives. Each level
 * makes that power hit harder in every run. Only one is held at a time:
 * taking up another forgets it, and MASTERY_BACK of what it cost comes back.
 */
export const MASTERY_PER = 0.06;
export const MASTERY_BACK = 0.5;
export const MASTERY_COSTS: readonly number[] = [400, 900, 1600, 2600, 4000];
export const masteryKey = (id: string): string => `mastery:${id}`;

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
