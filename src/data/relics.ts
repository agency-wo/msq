import type { StatMods } from '../game/stats';
import { SPOILS } from './spoils';

export type Rarity = 'common' | 'rare' | 'legendary';
export type RelicSpecial =
  | 'stopclock'
  | 'wildsigil'
  | 'phoenix'
  | 'sanrei'
  // Spoils of war (data/spoils.ts, game/spoils.ts).
  | 'fearthorn'
  | 'ironscale'
  | 'datacore'
  | 'spark'
  | 'tally'
  | 'horn'
  | 'cerodoble'
  | 'lagota'
  | 'scarf'
  | 'iceflower'
  | 'stinger'
  | 'tengen'
  | 'teacup'
  | 'balm'
  | 'ember'
  | 'eyepatch'
  | 'vial'
  | 'mask'
  | 'tachikaze'
  | 'haori'
  | 'spring'
  | 'riceball'
  | 'whetstone'
  | 'robe'
  | 'brush'
  | 'taiho'
  | 'tsukishiro'
  | 'arrowhead'
  | 'hogyoku'
  | 'getsuga';

export interface RelicDef {
  id: string;
  name: string;
  desc: string;
  rarity: Rarity;
  icon: string;
  mods?: StatMods;
  special?: RelicSpecial;
  /** Opened by a feat: never in a chest until then. */
  locked?: boolean;
  /** A spoil of war: the Codex key of the boss that leaves it. Never in a chest. */
  boss?: string;
  /** A spoil's own colour (its boss's), in place of its rarity's. */
  color?: string;
}

/** Quincy gear: global stats, trade-offs and rule-changers, as in the analysis. */
export const RELICS: readonly RelicDef[] = [
  { id: 'silver-tube', name: 'Silver Tube', rarity: 'common', icon: 'tube', desc: '+10% attack', mods: { atk: 10 } },
  { id: 'sandals', name: 'Hirenkyaku Sandals', rarity: 'common', icon: 'wing', desc: '+10% move speed', mods: { moveSpeed: 0.1 } },
  { id: 'cross', name: 'Quincy Cross', rarity: 'common', icon: 'cross', desc: 'Cooldowns -6%', mods: { cdr: 0.06 } },
  { id: 'funnel', name: 'Reishi Funnel', rarity: 'common', icon: 'magnet', desc: '+50% pickup range', mods: { pickup: 0.5 } },
  { id: 'vein-seal', name: 'Vein Seal', rarity: 'common', icon: 'heart', desc: '+25% max health', mods: { maxHp: 0.25 } },
  { id: 'wide-string', name: 'Wide String', rarity: 'common', icon: 'circles', desc: '+10% power size', mods: { size: 0.1 } },
  {
    id: 'twin-medallion',
    name: 'Twin Medallion',
    rarity: 'rare',
    icon: 'twin',
    desc: '+1 arrow, blade, bolt, bomb and missile on every power',
    mods: { count: 1 },
  },
  {
    id: 'banner',
    name: 'Wandenreich Banner',
    rarity: 'rare',
    icon: 'banner',
    desc: '+25% attack, but take 20% more damage',
    mods: { atk: 25, dmgTaken: 0.2 },
  },
  { id: 'vene-seal', name: 'Blut Vene Seal', rarity: 'rare', icon: 'shield', desc: 'Take 15% less damage', mods: { dmgTaken: -0.15 } },
  { id: 'lantern', name: 'Shadow Lantern', rarity: 'rare', icon: 'candle', desc: 'Powers last 25% longer', mods: { duration: 0.25 } },
  {
    id: 'monocle',
    name: 'Weak-Point Monocle',
    rarity: 'rare',
    icon: 'eye',
    desc: '+10% critical chance, +25% critical damage',
    mods: { critChance: 0.1, critMult: 0.25 },
  },
  { id: 'crown', name: "Emperor's Crown", rarity: 'legendary', icon: 'crown', desc: '+30% attack and cooldowns -10%', mods: { atk: 30, cdr: 0.1 } },
  {
    id: 'hourglass',
    name: 'Stopped Hourglass',
    rarity: 'legendary',
    icon: 'clock',
    desc: 'Every 20 s, every enemy freezes for 2.5 s',
    special: 'stopclock',
  },
  {
    id: 'pentacle',
    name: 'Sprenger Pentacle',
    rarity: 'legendary',
    icon: 'star',
    desc: 'Every 6 s, five pillars of light strike nearby enemies',
    special: 'wildsigil',
  },
  {
    id: 'threads',
    name: 'Ransōtengai Threads',
    rarity: 'legendary',
    icon: 'feather',
    desc: 'Reishi threads lift you back up once, at half health',
    special: 'phoenix',
  },
  {
    id: 'sanrei',
    name: 'Sanrei Glove',
    rarity: 'legendary',
    icon: 'glove',
    desc: '-20% damage until 8:00, then the glove comes off: +60%',
    special: 'sanrei',
  },
  // Opened by feats.
  { id: 'founder', name: "Founder's Medallion", rarity: 'legendary', icon: 'circles', desc: 'Bankai you take back arrive at Lv 2', locked: true },
  { id: 'key', name: 'Silbern Key', rarity: 'rare', icon: 'key', desc: 'Shrines offer four pacts instead of three', locked: true },
  { id: 'seal', name: "Soul King's Seal", rarity: 'legendary', icon: 'star', desc: 'Fragments of the Soul King arrive a level higher', locked: true },
];

/** Every relic by id, the spoils of war included (chests and the Armory's shelves use RELICS alone). */
export const RELIC_BY_ID: ReadonlyMap<string, RelicDef> = new Map([...RELICS, ...SPOILS].map((r) => [r.id, r]));
