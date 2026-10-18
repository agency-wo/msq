export type EnemyId = 'hollow' | 'hound' | 'brute' | 'volatile' | 'bearer' | 'menos' | 'vasto';

export interface EnemyDef {
  id: EnemyId;
  name: string;
  hp: number;
  /** Units per second. */
  speed: number;
  radius: number;
  /** Contact damage. */
  damage: number;
  /** Mana dropped. */
  xp: number;
  /** Explodes on contact instead of chewing on you. */
  bomber?: boolean;
  boss?: boolean;
  /** Death-burst colour. */
  color: number;
}

/**
 * Hueco Mundo's Hollows (original designs: white bone masks over shadow bodies)
 * and the bosses. Index order matters: enemies store their type as a byte.
 * Elites of any type are drawn as Adjuchas.
 */
export const ENEMY_LIST: readonly EnemyDef[] = [
  { id: 'hollow', name: 'Lesser Hollow', hp: 10, speed: 46, radius: 11, damage: 8, xp: 1, color: 0xe8e2d6 },
  // Faster than you on purpose: hounds punish standing still or kiting lazily.
  { id: 'hound', name: 'Hound Hollow', hp: 8, speed: 135, radius: 9, damage: 6, xp: 1, color: 0xe8e2d6 },
  { id: 'brute', name: 'Brute Hollow', hp: 70, speed: 34, radius: 18, damage: 14, xp: 4, color: 0xe8e2d6 },
  { id: 'volatile', name: 'Volatile Hollow', hp: 18, speed: 80, radius: 12, damage: 22, xp: 2, bomber: true, color: 0xff6a3c },
  { id: 'bearer', name: 'Medallion Bearer', hp: 2600, speed: 44, radius: 30, damage: 25, xp: 60, boss: true, color: 0xffcb5c },
  { id: 'menos', name: 'Menos Grande', hp: 2600, speed: 30, radius: 44, damage: 30, xp: 80, boss: true, color: 0xff2d4a },
  { id: 'vasto', name: 'Vasto Lorde', hp: 2600, speed: 52, radius: 34, damage: 35, xp: 120, boss: true, color: 0xff2d4a },
];

export const ENEMY_INDEX: Readonly<Record<EnemyId, number>> = {
  hollow: 0,
  hound: 1,
  brute: 2,
  volatile: 3,
  bearer: 4,
  menos: 5,
  vasto: 6,
};
