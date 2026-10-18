import type { StatMods } from '../game/stats';

export type Rarity = 'common' | 'rare' | 'legendary';
export type RelicSpecial = 'stopclock' | 'wildsigil' | 'phoenix';

export interface RelicDef {
  id: string;
  name: string;
  desc: string;
  rarity: Rarity;
  icon: string;
  mods?: StatMods;
  special?: RelicSpecial;
}

/** One of each artifact type from the analysis: global stat, trade-off, rule-changer. */
export const RELICS: readonly RelicDef[] = [
  { id: 'ember-ring', name: 'Ember Ring', rarity: 'common', icon: 'ring', desc: '+10% attack', mods: { atk: 10 } },
  { id: 'feather-boots', name: 'Feather Boots', rarity: 'common', icon: 'wing', desc: '+10% move speed', mods: { moveSpeed: 0.1 } },
  { id: 'sand-charm', name: 'Sand Charm', rarity: 'common', icon: 'hourglass', desc: 'Cooldowns -6%', mods: { cdr: 0.06 } },
  { id: 'lodestone', name: 'Lodestone', rarity: 'common', icon: 'magnet', desc: '+50% pickup range', mods: { pickup: 0.5 } },
  { id: 'heart-locket', name: 'Heart Locket', rarity: 'common', icon: 'heart', desc: '+25% max health', mods: { maxHp: 0.25 } },
  { id: 'wide-lens', name: 'Wide Lens', rarity: 'common', icon: 'circles', desc: '+10% power size', mods: { size: 0.1 } },
  { id: 'twin-sigil', name: 'Twin Sigil', rarity: 'rare', icon: 'twin', desc: '+1 arrow, blade and strike on every power', mods: { count: 1 } },
  { id: 'war-banner', name: 'War Banner', rarity: 'rare', icon: 'banner', desc: '+25% attack, but take 20% more damage', mods: { atk: 25, dmgTaken: 0.2 } },
  { id: 'bulwark', name: 'Bulwark', rarity: 'rare', icon: 'shield', desc: 'Take 15% less damage', mods: { dmgTaken: -0.15 } },
  { id: 'long-candle', name: 'Long Candle', rarity: 'rare', icon: 'candle', desc: 'Powers last 25% longer', mods: { duration: 0.25 } },
  { id: 'keen-edge', name: 'Keen Edge', rarity: 'rare', icon: 'blade', desc: '+10% critical chance, +25% critical damage', mods: { critChance: 0.1, critMult: 0.25 } },
  { id: 'crown-of-ash', name: 'Crown of Ash', rarity: 'legendary', icon: 'crown', desc: '+30% attack and cooldowns -10%', mods: { atk: 30, cdr: 0.1 } },
  { id: 'stopped-clock', name: 'Stopped Clock', rarity: 'legendary', icon: 'clock', desc: 'Every 20 s, every enemy freezes for 2.5 s', special: 'stopclock' },
  { id: 'wild-sigil', name: 'Wild Sigil', rarity: 'legendary', icon: 'star', desc: 'Every 6 s, 6 free pillars of light strike', special: 'wildsigil' },
  { id: 'phoenix-feather', name: 'Phoenix Feather', rarity: 'legendary', icon: 'feather', desc: 'Rise once at half health when you fall', special: 'phoenix' },
];

export const RELIC_BY_ID: ReadonlyMap<string, RelicDef> = new Map(RELICS.map((r) => [r.id, r]));
