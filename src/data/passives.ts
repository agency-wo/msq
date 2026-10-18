import type { StatMods } from '../game/stats';

export interface PassiveDef {
  id: string;
  name: string;
  /** Effect per level, shown on the card. */
  desc: string;
  icon: string;
  color: string;
  max: number;
  perLevel: StatMods;
}

/** Regular passives, mirroring the 8-passive table from the analysis (6 for Phase 1). */
export const PASSIVES: readonly PassiveDef[] = [
  { id: 'might', name: 'Might', desc: '+10% attack', icon: 'might', color: '#ff7a6b', max: 5, perLevel: { atk: 10 } },
  { id: 'celerity', name: 'Celerity', desc: 'Cooldowns -5%', icon: 'hourglass', color: '#7cc8ff', max: 3, perLevel: { cdr: 0.05 } },
  { id: 'vigor', name: 'Vigor', desc: '+20% max health, +0.2 HP/s', icon: 'heart', color: '#ff5d7a', max: 5, perLevel: { maxHp: 0.2, regen: 0.2 } },
  { id: 'swift', name: 'Swiftness', desc: '+10% move speed', icon: 'wing', color: '#7dffb0', max: 2, perLevel: { moveSpeed: 0.1 } },
  { id: 'expanse', name: 'Expanse', desc: '+8% power size', icon: 'circles', color: '#b69cff', max: 3, perLevel: { size: 0.08 } },
  { id: 'insight', name: 'Insight', desc: '+33% pickup range', icon: 'eye', color: '#ffd27a', max: 3, perLevel: { pickup: 0.33 } },
];

export const PASSIVE_BY_ID: ReadonlyMap<string, PassiveDef> = new Map(PASSIVES.map((p) => [p.id, p]));
