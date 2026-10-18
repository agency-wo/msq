import { stageById } from '../data/stages';

/** What a finished run did, as far as its gold is concerned. */
export interface RunTally {
  stage: string;
  /** Seconds survived. */
  time: number;
  level: number;
  /** Bosses killed before the final one (bearers, escorts). */
  bossKills: number;
  /** The final boss fell and the stage was cleared. */
  cleared: boolean;
  /** Gold picked up during the run (gold cards, empty chests). */
  pickupGold: number;
  /** Treasury bonus: 1 = none. */
  goldMul: number;
}

export const GOLD_PER_MINUTE = 15;
export const GOLD_PER_LEVEL = 2;
export const GOLD_PER_BOSS = 40;
export const GOLD_FINAL_BOSS = 120;
export const GOLD_CLEAR = 150;

/**
 * Gold paid out at the end of a run: mostly for surviving and growing, with
 * bonuses for bosses and for clearing the stage. Harder stages pay more.
 * About 120 for falling at 5:00, about 900 for a full clear of Hueco Mundo.
 */
export function runGold(r: RunTally): number {
  const earned =
    (r.time / 60) * GOLD_PER_MINUTE +
    r.level * GOLD_PER_LEVEL +
    r.bossKills * GOLD_PER_BOSS +
    (r.cleared ? GOLD_FINAL_BOSS + GOLD_CLEAR : 0);
  return Math.max(0, Math.round((earned * stageById(r.stage).gold + r.pickupGold) * r.goldMul));
}
