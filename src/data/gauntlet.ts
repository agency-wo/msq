import type { EnemyId } from './enemies';
import type { StageId } from './stages';

/**
 * The Gauntlet: every enemy of the Wandenreich, back to back. Seven tiers,
 * each fought on its own ground with its own swarm, the bosses one after
 * another and the tier's lord last. A golden chest and two level-ups between
 * tiers; the run is won when the last tier falls. Opens once three stages
 * are cleared.
 */

/** A boss of the Gauntlet: a roster member (as the stages draw them), or a boss in its own right. */
export type GauntletBoss = { roster: 'bearer' | 'captain' | 'royal' | 'gotei' | 'heroes' | 'arrancar' | 'karakura'; id: string } | { enemy: EnemyId };

export interface GauntletTier {
  numeral: string;
  name: string;
  stage: StageId;
  /** Health of the tier's bosses (on the stages' scale), and the lord's on top of it. */
  hpMul: number;
  finalMul: number;
  /** How much harder the tier's bosses hit than they would on their own stage. */
  dmgMul: number;
  bosses: readonly GauntletBoss[];
}

const r = (roster: Extract<GauntletBoss, { roster: string }>['roster'], ...ids: string[]): GauntletBoss[] => ids.map((id) => ({ roster, id }));

export const GAUNTLET: readonly GauntletTier[] = [
  {
    numeral: 'I',
    name: 'The Desert of the Hollows',
    stage: 'hueco',
    hpMul: 1.2,
    finalMul: 2.5,
    dmgMul: 1,
    bosses: [...r('bearer', 'senbonzakura', 'hyorinmaru', 'raikoben', 'tengen', 'gonryo'), { enemy: 'ayon' }, { enemy: 'nel' }, { enemy: 'harribel' }],
  },
  {
    numeral: 'II',
    name: 'The Halls of Las Noches',
    stage: 'lasnoches',
    hpMul: 5,
    finalMul: 2.5,
    dmgMul: 1.15,
    bosses: [...r('arrancar', 'rudbornn', 'dordoni', 'cirucci', 'gantenbainne'), { enemy: 'grimmjow' }],
  },
  {
    numeral: 'III',
    name: 'The First Invasion',
    stage: 'seireitei',
    hpMul: 12,
    finalMul: 1.6,
    dmgMul: 1.3,
    bosses: [...r('captain', 'senbonzakura', 'hyorinmaru', 'raikoben', 'tengen', 'gonryo'), { enemy: 'unohana' }, { enemy: 'commander' }],
  },
  {
    numeral: 'IV',
    name: 'The Palace in the Sky',
    stage: 'palace',
    hpMul: 15,
    finalMul: 1.8,
    dmgMul: 1.5,
    bosses: [...r('royal', 'tenjiro', 'kirio', 'oetsu', 'senjumaru'), { enemy: 'ichibe' }],
  },
  {
    numeral: 'V',
    name: 'Silbern',
    stage: 'silbern',
    hpMul: 19,
    finalMul: 1.8,
    dmgMul: 1.85,
    bosses: [...r('gotei', 'kenpachi', 'mayuri', 'shinji', 'kensei'), { enemy: 'kyoraku' }],
  },
  {
    numeral: 'VI',
    name: 'The Wahrwelt',
    stage: 'wahrwelt',
    hpMul: 25,
    finalMul: 2.2,
    dmgMul: 2.2,
    bosses: [...r('heroes', 'renji', 'rukia', 'uryu', 'aizen'), { enemy: 'ichigo' }],
  },
  {
    numeral: 'VII',
    name: 'Another Telling',
    stage: 'karakura',
    hpMul: 32,
    finalMul: 2.4,
    dmgMul: 2.5,
    bosses: [...r('karakura', 'chad', 'orihime', 'yoruichi', 'isshin'), { enemy: 'urahara' }],
  },
];

/** Stages cleared before the Gauntlet opens. */
export const GAUNTLET_UNLOCK = 3;
/** Gold the first time each tier is cleared: this times the tier's number. */
export const GAUNTLET_GOLD = 2000;
/** Level-ups to start with, and for every boss put down; the first boss comes half a minute in. */
export const GAUNTLET_FIRST = 30;
export const GAUNTLET_START_LEVELS = 10;
export const GAUNTLET_LEVELS_PER_BOSS = 1;

export function gauntletBosses(): number {
  return GAUNTLET.reduce((n, t) => n + t.bosses.length, 0);
}
