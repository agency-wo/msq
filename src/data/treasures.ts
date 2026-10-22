/**
 * Treasures: chest cards that are not relics. A brown chest's last card is
 * one of them four times in ten, and a golden chest always holds one. Each
 * is spent at once: gold, health, a power's level, a level-up, a reroll or
 * a lasting edge for the rest of the run.
 */

export type TreasureId = 'cache' | 'spring' | 'surge' | 'crystal' | 'sigil' | 'verse';

export interface TreasureDef {
  id: TreasureId;
  name: string;
  desc: string;
  icon: string;
  color: string;
}

export const TREASURES: readonly TreasureDef[] = [
  { id: 'cache', name: 'Gold cache', desc: 'A Wandenreich paymaster’s strongbox: gold now, and more the later in the run it is found.', icon: 'coin', color: '#ffd27a' },
  { id: 'spring', name: 'Reishi spring', desc: 'Healed in full, and +10% max health for the rest of the run.', icon: 'heart', color: '#ff8a9a' },
  { id: 'surge', name: 'Power surge', desc: 'One of your powers rises a level.', icon: 'star', color: '#9fdcff' },
  { id: 'crystal', name: 'Mana crystal', desc: 'A level-up, taken at once.', icon: 'drop', color: '#8fd0ff' },
  { id: 'sigil', name: 'Auswählen sigil', desc: 'One more reroll for the rest of the run.', icon: 'reroll', color: '#ffe6a0' },
  { id: 'verse', name: 'Kaiser verse', desc: '+5% damage for the rest of the run.', icon: 'book', color: '#ffcb5c' },
];

export const TREASURE_BY_ID: ReadonlyMap<TreasureId, TreasureDef> = new Map(TREASURES.map((t) => [t.id, t]));

/** A gold cache's gold, by the run clock. */
export function cacheGold(t: number): number {
  return Math.round(60 + t * 0.2);
}
