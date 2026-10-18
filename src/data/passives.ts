import type { StatMods } from '../game/stats';

export interface PassiveDef {
  id: string;
  name: string;
  /** Schrift letter, shown as the card icon. */
  letter?: string;
  credit?: string;
  /** Effect per level, shown on the card. */
  desc: string;
  icon: string;
  color: string;
  max: number;
  perLevel: StatMods;
}

/** Quincy techniques, plus one knight's letter that works as a passive. */
export const PASSIVES: readonly PassiveDef[] = [
  { id: 'arterie', name: 'Blut Arterie', desc: '+10% attack', icon: 'drop', color: '#ff6b7d', max: 5, perLevel: { atk: 10 } },
  {
    id: 'vene',
    name: 'Blut Vene',
    desc: '+15% max health, -4% damage taken',
    icon: 'shield',
    color: '#8fd0ff',
    max: 5,
    perLevel: { maxHp: 0.15, dmgTaken: -0.04 },
  },
  { id: 'hirenkyaku', name: 'Hirenkyaku', desc: '+10% move speed', icon: 'wing', color: '#7dffb0', max: 2, perLevel: { moveSpeed: 0.1 } },
  { id: 'absorption', name: 'Reishi Absorption', desc: '+33% pickup range', icon: 'magnet', color: '#ffd27a', max: 3, perLevel: { pickup: 0.33 } },
  { id: 'control', name: 'Reishi Control', desc: 'Cooldowns -5%', icon: 'hourglass', color: '#9fe7ff', max: 3, perLevel: { cdr: 0.05 } },
  { id: 'expansion', name: 'Reishi Expansion', desc: '+8% power size', icon: 'circles', color: '#c08bff', max: 3, perLevel: { size: 0.08 } },
  { id: 'binding', name: 'Reishi Binding', desc: '+10% power duration', icon: 'candle', color: '#e6f4ff', max: 3, perLevel: { duration: 0.1 } },
  {
    id: 'underbelly',
    name: 'The Underbelly',
    letter: 'U',
    credit: 'NaNaNa Najahkoop',
    desc: '+5% critical chance: weak points are marked',
    icon: 'eye',
    color: '#ffb37a',
    max: 3,
    perLevel: { critChance: 0.05 },
  },
];

export const PASSIVE_BY_ID: ReadonlyMap<string, PassiveDef> = new Map(PASSIVES.map((p) => [p.id, p]));
