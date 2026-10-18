export type EnemyId = 'wisp' | 'runner' | 'brute' | 'bomber' | 'warden';

export interface EnemyDef {
  id: EnemyId;
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

/** Index order matters: enemies store their type as a byte index into this list. */
export const ENEMY_LIST: readonly EnemyDef[] = [
  { id: 'wisp', hp: 10, speed: 46, radius: 11, damage: 8, xp: 1, color: 0xa77bff },
  // Faster than you on purpose: runners are the ones that punish standing still or kiting lazily.
  { id: 'runner', hp: 8, speed: 135, radius: 9, damage: 6, xp: 1, color: 0x4fe3c1 },
  { id: 'brute', hp: 70, speed: 34, radius: 18, damage: 14, xp: 4, color: 0xff5a5a },
  { id: 'bomber', hp: 18, speed: 80, radius: 12, damage: 22, xp: 2, bomber: true, color: 0xff9a3c },
  { id: 'warden', hp: 2600, speed: 42, radius: 40, damage: 25, xp: 60, boss: true, color: 0xc58bff },
];

export const ENEMY_INDEX: Readonly<Record<EnemyId, number>> = {
  wisp: 0,
  runner: 1,
  brute: 2,
  bomber: 3,
  warden: 4,
};
