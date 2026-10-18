/** Shared shapes for power definitions (Schrift, Quincy arts, utilities and bankai). */

export type PowerKind =
  // Phase 1 archetypes
  | 'bolt'
  | 'orbit'
  | 'pulse'
  | 'strike'
  // Schrift
  | 'beam'
  | 'lob'
  | 'jet'
  | 'meteor'
  | 'thorns'
  | 'gust'
  | 'cloud'
  | 'drones'
  | 'maw'
  | 'jail'
  | 'love'
  | 'punch'
  | 'double'
  | 'zombie'
  // Utilities
  | 'iron'
  | 'superstar'
  | 'overkill'
  | 'vollstandig'
  | 'balance'
  | 'miracle'
  // The Emperor's own
  | 'almighty'
  // Stolen bankai
  | 'senbonzakura'
  | 'hyorinmaru'
  | 'raikoben'
  | 'tengen'
  | 'gonryo'
  | 'zanka';

/**
 * art: a Quincy technique · schrift: a knight's letter · utility: support ·
 * bankai: won from a boss only · ultimate: The Almighty, never on the level-up board.
 */
export type PowerGroup = 'art' | 'schrift' | 'utility' | 'bankai' | 'ultimate';

/** Generic numbers each cast pattern reads in its own way (see the comment on each power). */
export interface PowerStats {
  damage: number;
  cooldown: number;
  count: number;
  speed: number;
  pierce: number;
  size: number;
  duration: number;
  radius: number;
  tick: number;
  amount: number;
}

export interface PowerAttribute {
  id: string;
  name: string;
  desc: string;
}

export interface PowerDef {
  id: string;
  kind: PowerKind;
  group: PowerGroup;
  name: string;
  /** Schrift letter, shown as the card icon. */
  letter?: string;
  /** Whose power it was, shown under the name. */
  credit?: string;
  desc: string;
  /** Glyph for powers without a letter. */
  icon: string;
  color: string;
  maxLevel: number;
  base: PowerStats;
  /** Upgrades from Lv 2 up to upgradeCap(def). */
  levels: readonly { desc: string; add: Partial<PowerStats> }[];
  /** Offensive powers only: the Lv 7 pick. */
  attributes?: readonly [PowerAttribute, PowerAttribute, PowerAttribute];
}

export function stats(s: Partial<PowerStats>): PowerStats {
  return { damage: 0, cooldown: 1, count: 1, speed: 0, pierce: 0, size: 1, duration: 0, radius: 0, tick: 0.5, amount: 0, ...s };
}

/** Highest level plain upgrade cards reach; powers with attributes take their last level as the attribute pick. */
export function upgradeCap(def: PowerDef): number {
  return def.attributes ? def.maxLevel - 1 : def.maxLevel;
}
