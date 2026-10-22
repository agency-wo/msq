import type { EnemyId } from './enemies';
import { FIRST_SHRINE_AT } from './shrines';

/**
 * The stages. Each one is 20 minutes: medallion bearers (random bankai, drawn
 * per run) at 5:00, 10:00 and 15:00, an escort with the third, and a final
 * boss at 20:00 to clear it. Swarm rings, elites, chests and runes in between.
 */

export type StageId = 'hueco' | 'seireitei' | 'lasnoches' | 'silbern' | 'palace' | 'wahrwelt' | 'karakura';

export interface SpawnPhase {
  from: number;
  /** Weighted enemy mix for regular spawns. */
  mix: readonly (readonly [EnemyId, number])[];
}

export type RuneKind = 'magnet' | 'heart';

export type TimelineEvent =
  | { at: number; kind: 'ring'; enemy: EnemyId; count: number }
  | { at: number; kind: 'elite'; enemy: EnemyId }
  /** The `tier`th of the run's roster bosses (three; four in the Wahrwelt). */
  | { at: number; kind: 'bearer'; tier: number; hpMul: number }
  /** `warn` shows 4 s before it arrives, `sub` under its name on the title card. */
  | { at: number; kind: 'boss'; enemy: EnemyId; hpMul: number; final: boolean; warn: string; sub: string }
  | { at: number; kind: 'chest' }
  /** A Quincy shrine appears near you (see data/shrines.ts). */
  | { at: number; kind: 'shrine' }
  | { at: number; kind: 'rune'; rune: RuneKind }
  /** A formation of `count` charges across the field in a line, after a warning; `what` names it in the warning. */
  | { at: number; kind: 'stampede'; enemy: EnemyId; count: number; what: string }
  /** The stage's hazard comes down for a while (StageDef.hazard). */
  | { at: number; kind: 'hazard' };

/**
 * A stage's hazard: for a burst, something comes down near you every so
 * often, a little ahead of where you are going, always warned first.
 * strike: circles that burst · mire: patches that slow you while you stand
 * in them · line: strokes across your path · seal: circles that bind you.
 */
export interface HazardDef {
  form: 'strike' | 'mire' | 'line' | 'seal';
  /** How it looks: which warning and which burst. */
  look: 'sand' | 'shadow' | 'kido' | 'rubble' | 'ink' | 'collapse' | 'seal';
  r: number;
  /** Said as a burst begins. */
  warn: string;
}

/** Who charges in a stage's formations, and how the warning names them. */
export interface FormationDef {
  enemy: EnemyId;
  what: string;
}

export interface StageDef {
  id: StageId;
  name: string;
  /** One line for the stage picker. */
  blurb: string;
  length: number;
  phases: readonly SpawnPhase[];
  events: readonly TimelineEvent[];
  /** Multipliers on the shared time curves below. */
  hp: number;
  spawn: number;
  xp: number;
  /** Multiplier on the gold a run here pays out. */
  gold: number;
  /** The bankai bosses are the captains who own them, not medallion bearers. */
  captains?: boolean;
  /** Which bankai the bosses can carry (all six when missing). */
  bearerPool?: readonly string[];
  /**
   * Who the 5:00, 10:00 and 15:00 bosses are when they are not medallion
   * bearers: the Royal Guard (who leave Fragments of the Soul King),
   * Silbern's captains or the Wahrwelt's defenders (who leave black chests).
   */
  roster?: 'royal' | 'gotei' | 'heroes' | 'arrancar' | 'karakura';
  /**
   * A roster member who is never left out and always takes the last slot
   * (Aizen: Kyōraku lets him out of Muken, and he is the last before Ichigo).
   */
  lastBearer?: string;
  /** Clearing this stage unlocks this one. */
  unlockedBy?: StageId;
  /** What comes down in the stage's hazard bursts. */
  hazard: HazardDef;
  /** Who charges in its formations. */
  formation: FormationDef;
}

const LENGTH = 20 * 60;

/**
 * How hard the game is, in one place: the swarm's curves below, the rings and
 * elites on every timeline, and the world's multipliers on bosses, elites and
 * every hit all read from here.
 */
export const DIFFICULTY = {
  /** Swarm health over time: 1 + hpLinear·m + hpSquare·m² + hpCube·m³ (m in minutes). Near the old curve early, far past it late. */
  hpLinear: 0.06,
  hpSquare: 0.08,
  hpCube: 0.0015,
  /** Regular spawns per second: spawnBase + spawnLinear·m + spawnSquare·m², capped. */
  spawnBase: 0.9,
  spawnLinear: 0.55,
  spawnSquare: 0.14,
  spawnCap: 65,
  /** Swarm speed gained per minute. */
  speedPerMinute: 0.025,
  /** Every swarm hit: damage + damagePerMinute·m, so the late swarm hurts far more than the early one. */
  damage: 0.9,
  damagePerMinute: 0.035,
  /**
   * Past lateFrom minutes the swarm grows on top of all that: hpLate·(m − lateFrom)² more health and
   * dmgLate·(m − lateFrom) more on every hit. A run that is not strong by then will not last; one that is,
   * still has to work for it.
   */
  lateFrom: 8,
  hpLate: 0.15,
  dmgLate: 0.06,
  /**
   * The world answers your training: at pressure p (0 with nothing learned in the Archives, 1 with all
   * of it), bosses have 1 + pressureBoss·p times their health, elites 1 + pressureElite·p, the swarm
   * 1 + pressureSwarm·p, and every swarm hit lands 1 + pressureDamage·p times as hard. Training still
   * leaves you far ahead; it no longer leaves the fight behind.
   */
  pressureBoss: 3,
  pressureElite: 1.2,
  pressureSwarm: 0.5,
  pressureDamage: 0.6,
  /**
   * Boss health and hits, on top of each boss's own multiplier, growing with
   * that multiplier: the first boss of a stage is close to how it always was,
   * the last ones are far tougher. Health: bossHpBase + bossHpPerMul·hpMul, at
   * most bossHpMax. Hits: up to bossDamage, reached at hpMul bossDamageAt.
   */
  bossHpBase: 1.2,
  bossHpPerMul: 0.06,
  bossHpMax: 4.5,
  bossDamage: 1.5,
  bossDamageAt: 14,
  /** An elite's health and hits against a regular enemy's. */
  eliteHp: 16,
  eliteDamage: 1.6,
  /** Rings: ringBase enemies, one more every ringEvery seconds of the run. Elites from firstElite, every eliteEvery seconds. */
  ringBase: 36,
  ringEvery: 12,
  firstElite: 150,
  eliteEvery: 75,
  /** Charging formations from firstStampede, every stampedeEvery seconds: stampedeBase strong, one more a minute, at most stampedeCap. */
  firstStampede: 210,
  stampedeEvery: 150,
  stampedeBase: 8,
  stampedeCap: 24,
  /** Hazard bursts from firstHazard, every hazardEvery seconds, hazardSecs long; each strike hits for hazardDamage on the swarm's damage curve. */
  firstHazard: 150,
  hazardEvery: 120,
  hazardSecs: 18,
  hazardDamage: 12,
} as const;

/**
 * The formations and hazard bursts on a timeline of `length` seconds. None
 * comes in the 45 s before a boss (at `bosses`) or the 20 s after it: a
 * boss's arrival is its own moment.
 */
export function variety(length: number, formation: FormationDef, bosses: readonly number[] = []): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (let t = DIFFICULTY.firstStampede; t < length - 30; t += DIFFICULTY.stampedeEvery) {
    if (nearBoss(t, bosses)) continue;
    events.push({ at: t, kind: 'stampede', enemy: formation.enemy, count: Math.min(DIFFICULTY.stampedeCap, DIFFICULTY.stampedeBase + Math.floor(t / 60)), what: formation.what });
  }
  for (let t = DIFFICULTY.firstHazard; t < length - 30; t += DIFFICULTY.hazardEvery) {
    if (!nearBoss(t, bosses)) events.push({ at: t, kind: 'hazard' });
  }
  return events;
}

function nearBoss(t: number, bosses: readonly number[]): boolean {
  return bosses.some((b) => t > b - 45 && t < b + 20);
}

/** Who charges in each stage's formations. */
const HUECO_FORMATION: FormationDef = { enemy: 'hound', what: 'A pack of hounds' };
const SEIREITEI_FORMATION: FormationDef = { enemy: 'flash', what: 'A line of the Onmitsukidō' };
const LASNOCHES_FORMATION: FormationDef = { enemy: 'numeros', what: 'A rank of Arrancar soldiers' };
const PALACE_FORMATION: FormationDef = { enemy: 'sentinel', what: 'A phalanx of sentinels' };
const SILBERN_FORMATION: FormationDef = { enemy: 'brawler', what: 'The Eleventh Division' };
const WAHRWELT_FORMATION: FormationDef = { enemy: 'brawler', what: 'A charge of Soul Reapers' };
const KARAKURA_FORMATION: FormationDef = { enemy: 'gigai', what: 'A crowd of empty gigai' };

/** Rings, elites, chests, runes, formations, hazards and the three bearers: the skeleton every stage shares. */
function skeleton(ring: (t: number) => EnemyId, elite: (t: number) => EnemyId, bearerHp: readonly [number, number, number], formation: FormationDef): TimelineEvent[] {
  const events: TimelineEvent[] = variety(LENGTH, formation, [300, 600, 900]);
  for (let t = 90; t < LENGTH; t += 120) events.push({ at: t, kind: 'ring', enemy: ring(t), count: DIFFICULTY.ringBase + Math.floor(t / DIFFICULTY.ringEvery) });
  for (let t = DIFFICULTY.firstElite; t < LENGTH; t += DIFFICULTY.eliteEvery) events.push({ at: t, kind: 'elite', enemy: elite(t) });
  for (let t = 170; t < LENGTH; t += 150) events.push({ at: t, kind: 'chest' });
  for (let t = 240; t < LENGTH; t += 180) events.push({ at: t, kind: 'rune', rune: 'magnet' });
  // Bearer health comes from here, not from the swarm's time curve.
  events.push({ at: 300, kind: 'bearer', tier: 0, hpMul: bearerHp[0] });
  events.push({ at: 600, kind: 'bearer', tier: 1, hpMul: bearerHp[1] });
  events.push({ at: 900, kind: 'bearer', tier: 2, hpMul: bearerHp[2] });
  events.push({ at: FIRST_SHRINE_AT, kind: 'shrine' });
  return events;
}

function sorted(events: TimelineEvent[]): readonly TimelineEvent[] {
  return events.sort((a, b) => a.at - b.at);
}

/**
 * Hueco Mundo: the Hollow desert, where the Wandenreich made its camp. Its
 * 5:00, 10:00 and 15:00 bosses are three of the five Sternritter who stole a
 * bankai with a medallion (each takes a careful player about 35-50 s). Ayon,
 * the beast Harribel's Fracción make from their own left arms, comes with the
 * third; Neliel, once the Tercera Espada, stands in the way at 18:00, and at
 * 20:00 Tier Harribel, the queen of Las Noches, ends the stage (about 45 s
 * against a full build with three bankai).
 */
const HUECO: StageDef = {
  id: 'hueco',
  name: 'Hueco Mundo',
  blurb: 'The Hollow desert under a white moon.',
  length: LENGTH,
  phases: [
    { from: 0, mix: [['hollow', 1]] },
    { from: 60, mix: [['hollow', 3], ['hound', 1]] },
    { from: 180, mix: [['hollow', 3], ['hound', 2], ['brute', 1]] },
    { from: 360, mix: [['hollow', 3], ['hound', 2], ['brute', 1], ['volatile', 1], ['cero', 1]] },
    { from: 600, mix: [['hollow', 2], ['hound', 3], ['brute', 2], ['volatile', 2], ['cero', 1]] },
    { from: 720, mix: [['hollow', 2], ['hound', 3], ['brute', 2], ['volatile', 2], ['gillian', 1], ['cero', 1]] },
    { from: 900, mix: [['hollow', 2], ['hound', 3], ['brute', 3], ['volatile', 2], ['gillian', 1], ['cero', 2]] },
  ],
  events: sorted([
    ...skeleton(
      (t) => (t < 400 ? 'hollow' : 'hound'),
      (t) => (t < 300 ? 'hollow' : 'brute'),
      [1, 3.4, 14],
      HUECO_FORMATION,
    ),
    { at: 905, kind: 'boss', enemy: 'ayon', hpMul: 3.4, final: false, warn: 'Harribel’s Fracción give their left arms: Ayon rises', sub: 'The beast of three left arms' },
    { at: 1080, kind: 'boss', enemy: 'nel', hpMul: 14, final: false, warn: 'Neliel stands between you and Las Noches', sub: 'Once the Tercera Espada' },
    {
      at: LENGTH,
      kind: 'boss',
      enemy: 'harribel',
      hpMul: 60,
      final: true,
      warn: 'Tier Harribel bars the way to Las Noches',
      sub: 'Third Espada · Queen of Hueco Mundo',
    },
  ]),
  hp: 1,
  spawn: 1,
  xp: 1,
  gold: 1,
  hazard: { form: 'mire', look: 'sand', r: 48, warn: 'The sand begins to sink' },
  formation: HUECO_FORMATION,
  // The five stolen bankai: Zanka no Tachi was never a knight's; the Emperor takes it from Yamamoto.
  bearerPool: ['senbonzakura', 'hyorinmaru', 'raikoben', 'tengen', 'gonryo'],
};

/**
 * Seireitei: the Soul Reapers' walled city, at night. Unlocked by clearing
 * Hueco Mundo, and harder: tougher soldiers, flash-steps that close the gap,
 * Kidō casters that shoot from a distance. The bankai bosses here are the
 * captains themselves, defending their own bankai; Retsu Unohana comes with
 * the third, and Captain-Commander Yamamoto waits at 20:00.
 */
const SEIREITEI: StageDef = {
  id: 'seireitei',
  name: 'Seireitei',
  blurb: 'The Soul Reapers’ walled city. Flash-steps, Kidō and steel.',
  length: LENGTH,
  phases: [
    { from: 0, mix: [['officer', 1]] },
    { from: 45, mix: [['officer', 3], ['flash', 1]] },
    { from: 150, mix: [['officer', 3], ['flash', 2], ['caster', 1]] },
    { from: 300, mix: [['officer', 3], ['flash', 2], ['caster', 1], ['guard', 1]] },
    { from: 600, mix: [['officer', 2], ['flash', 3], ['caster', 2], ['guard', 2]] },
    { from: 900, mix: [['officer', 2], ['flash', 3], ['caster', 2], ['guard', 3]] },
  ],
  events: sorted([
    ...skeleton(
      (t) => (t < 400 ? 'officer' : 'flash'),
      (t) => (t < 300 ? 'officer' : 'guard'),
      [1.15, 4, 16],
      SEIREITEI_FORMATION,
    ),
    // The third captain comes with Unohana, who closes her soldiers' wounds as fast as you open them.
    { at: 905, kind: 'boss', enemy: 'unohana', hpMul: 5, final: false, warn: 'Retsu Unohana comes to tend her soldiers', sub: 'Captain of the 4th Division' },
    { at: 908, kind: 'elite', enemy: 'guard' },
    {
      at: LENGTH,
      kind: 'boss',
      enemy: 'commander',
      hpMul: 40,
      final: true,
      warn: 'The Captain-Commander draws Ryūjin Jakka',
      sub: 'Captain-Commander of the Gotei 13',
    },
  ]),
  hp: 1.2,
  spawn: 1.05,
  xp: 1.2,
  gold: 1.25,
  hazard: { form: 'strike', look: 'kido', r: 44, warn: 'The Kidō Corps open a barrage' },
  formation: SEIREITEI_FORMATION,
  captains: true,
  // Zanka no Tachi belongs to the Captain-Commander, who only fights at the end.
  bearerPool: ['senbonzakura', 'hyorinmaru', 'raikoben', 'tengen', 'gonryo'],
  unlockedBy: 'hueco',
};

/**
 * Las Noches: the palace Aizen raised in the middle of Hueco Mundo, white
 * halls under the false sky he painted on the inside of its dome. Arrancar
 * soldiers, the skull-masked Exequias, Gillian lumbering through the halls;
 * three of Rudbornn, Dordoni, Cirucci and Gantenbainne bar the way, and
 * Grimmjow Jaegerjaquez, the Sexta Espada, waits at 20:00. Opened, with the
 * Seireitei, by clearing Hueco Mundo.
 */
const LASNOCHES: StageDef = {
  id: 'lasnoches',
  name: 'Las Noches',
  blurb: 'Aizen’s white palace, under the false sky he painted on its dome.',
  length: LENGTH,
  phases: [
    { from: 0, mix: [['numeros', 2], ['hollow', 1]] },
    { from: 45, mix: [['numeros', 3], ['hollow', 1], ['hound', 1]] },
    { from: 150, mix: [['numeros', 3], ['hound', 2], ['exequias', 1]] },
    { from: 180, mix: [['numeros', 3], ['hound', 2], ['exequias', 1], ['cero', 1]] },
    { from: 300, mix: [['numeros', 3], ['hound', 2], ['exequias', 2], ['brute', 1], ['cero', 1]] },
    { from: 600, mix: [['numeros', 3], ['hound', 3], ['exequias', 2], ['brute', 2], ['cero', 1]] },
    { from: 900, mix: [['numeros', 3], ['hound', 3], ['exequias', 3], ['brute', 3], ['cero', 2]] },
  ],
  events: sorted([
    ...skeleton(
      (t) => (t < 400 ? 'numeros' : 'hound'),
      (t) => (t < 300 ? 'numeros' : 'gillian'),
      [1.15, 4.2, 16],
      LASNOCHES_FORMATION,
    ),
    // A Gillian lumbers in after the third Arrancar.
    { at: 906, kind: 'elite', enemy: 'gillian' },
    {
      at: LENGTH,
      kind: 'boss',
      enemy: 'grimmjow',
      hpMul: 50,
      final: true,
      warn: 'Grimmjow Jaegerjaquez is grinning at you',
      sub: 'Sexta Espada',
    },
  ]),
  hp: 1.15,
  spawn: 1.05,
  xp: 1.2,
  gold: 1.35,
  hazard: { form: 'strike', look: 'rubble', r: 44, warn: 'The false sky cracks: the dome is coming down' },
  formation: LASNOCHES_FORMATION,
  roster: 'arrancar',
  unlockedBy: 'hueco',
};

/**
 * The Soul King Palace: the Royal Guard's districts in the sky. Sentinels that
 * lunge, ink that splits, weavers whose threads hold you, flying blades, and
 * attendants that heal everything near them. Three of the four guardians
 * stand in your way; Ichibē waits at the end.
 */
const PALACE: StageDef = {
  id: 'palace',
  name: 'Soul King Palace',
  blurb: 'The palace above the clouds, and the guard that has never fallen.',
  length: LENGTH,
  phases: [
    { from: 0, mix: [['inkling', 2], ['inkwisp', 1]] },
    { from: 45, mix: [['inkling', 2], ['inkwisp', 2], ['sentinel', 1]] },
    { from: 150, mix: [['inkwisp', 3], ['sentinel', 2], ['asauchi', 1]] },
    { from: 300, mix: [['inkwisp', 3], ['sentinel', 2], ['asauchi', 2], ['weaver', 1]] },
    { from: 600, mix: [['inkwisp', 3], ['sentinel', 3], ['asauchi', 2], ['weaver', 2]] },
    { from: 900, mix: [['inkwisp', 3], ['sentinel', 3], ['asauchi', 3], ['weaver', 2]] },
  ],
  events: sorted([
    ...skeleton(
      (t) => (t < 400 ? 'inkling' : 'asauchi'),
      (t) => (t < 300 ? 'sentinel' : 'attendant'),
      [1.3, 4.6, 18],
      PALACE_FORMATION,
    ),
    // The third guardian keeps two attendants close.
    { at: 906, kind: 'elite', enemy: 'attendant' },
    { at: 910, kind: 'elite', enemy: 'attendant' },
    {
      at: LENGTH,
      kind: 'boss',
      enemy: 'ichibe',
      hpMul: 46,
      final: true,
      warn: 'Ichibē Hyōsube lifts his brush',
      sub: 'The One Who Names',
    },
  ]),
  hp: 1.2,
  spawn: 1,
  xp: 1.3,
  gold: 1.5,
  hazard: { form: 'line', look: 'ink', r: 18, warn: 'Ink runs across the palace floor' },
  formation: PALACE_FORMATION,
  roster: 'royal',
  unlockedBy: 'seireitei',
};

/**
 * Silbern: the Wandenreich's city, risen out of the Seireitei's own shadow to
 * take its place in the second invasion. The Gotei 13 fights back in streets
 * that are no longer theirs: brawlers of the 11th Division, the 12th's
 * specimens, and three of four captains (Kenpachi, Mayuri, Shinji, Kensei).
 * The new Captain-Commander, Shunsui Kyōraku, waits at 20:00. Unlocked with
 * the Palace by clearing the Seireitei.
 */
const SILBERN: StageDef = {
  id: 'silbern',
  name: 'Silbern',
  blurb: 'The Wandenreich’s city, risen out of the Seireitei’s own shadow.',
  length: LENGTH,
  phases: [
    { from: 0, mix: [['officer', 2], ['brawler', 2]] },
    { from: 45, mix: [['officer', 1], ['brawler', 3], ['flash', 1]] },
    { from: 150, mix: [['brawler', 2], ['flash', 2], ['specimen', 1], ['caster', 1]] },
    { from: 300, mix: [['brawler', 3], ['flash', 2], ['specimen', 2], ['caster', 1], ['guard', 1]] },
    { from: 600, mix: [['brawler', 3], ['flash', 3], ['specimen', 2], ['caster', 2], ['guard', 2]] },
    { from: 900, mix: [['brawler', 3], ['flash', 3], ['specimen', 3], ['caster', 2], ['guard', 3]] },
  ],
  events: sorted([
    ...skeleton(
      (t) => (t < 400 ? 'brawler' : 'flash'),
      (t) => (t < 300 ? 'brawler' : 'guard'),
      [1.3, 4.6, 18],
      SILBERN_FORMATION,
    ),
    {
      at: LENGTH,
      kind: 'boss',
      enemy: 'kyoraku',
      hpMul: 38,
      final: true,
      warn: 'Shunsui Kyōraku tips back his hat',
      sub: 'Captain-Commander of the Gotei 13',
    },
  ]),
  hp: 1.3,
  spawn: 1.08,
  xp: 1.2,
  gold: 1.6,
  hazard: { form: 'mire', look: 'shadow', r: 50, warn: 'The Schatten Bereich opens under the streets' },
  formation: SILBERN_FORMATION,
  roster: 'gotei',
  unlockedBy: 'seireitei',
};

/**
 * The Wahrwelt: the world the Emperor raised from the Soul King's palace once
 * he had taken the Soul King into himself. Every world comes up after him at
 * once, Soul Reapers and Hollows together. All four defenders stand in his
 * way every run: Renji, Rukia and Uryū in a different order at 5:00, 10:00
 * and 15:00, then Aizen, let out of Muken, at 18:00. Ichigo Kurosaki waits at
 * 20:00. The hardest stage, opened by clearing the Soul King Palace.
 */
const WAHRWELT: StageDef = {
  id: 'wahrwelt',
  name: 'Wahrwelt',
  blurb: 'The true world he raised from the Soul King’s palace. Everyone comes for him.',
  length: LENGTH,
  phases: [
    { from: 0, mix: [['officer', 2], ['hollow', 2]] },
    { from: 45, mix: [['officer', 2], ['hollow', 2], ['hound', 1], ['flash', 1]] },
    { from: 150, mix: [['officer', 2], ['hound', 2], ['flash', 2], ['brute', 1], ['caster', 1]] },
    { from: 300, mix: [['flash', 2], ['hound', 2], ['brute', 2], ['caster', 1], ['guard', 1], ['brawler', 1]] },
    { from: 600, mix: [['flash', 3], ['hound', 2], ['brute', 2], ['caster', 2], ['guard', 2], ['brawler', 2]] },
    { from: 900, mix: [['flash', 3], ['hound', 3], ['brute', 3], ['caster', 2], ['guard', 3], ['brawler', 2]] },
  ],
  events: sorted([
    ...skeleton(
      (t) => (t < 400 ? 'hollow' : 'flash'),
      (t) => (t < 300 ? 'brute' : 'guard'),
      [1.4, 5, 20],
      WAHRWELT_FORMATION,
    ),
    // Kyōraku lets Aizen out of Muken: he always comes, and always last before Ichigo.
    { at: 1080, kind: 'bearer', tier: 3, hpMul: 30 },
    {
      at: LENGTH,
      kind: 'boss',
      enemy: 'ichigo',
      hpMul: 44,
      final: true,
      warn: 'Ichigo Kurosaki draws both his blades',
      sub: 'Substitute Soul Reaper',
    },
  ]),
  hp: 1.35,
  spawn: 1.1,
  xp: 1.3,
  gold: 1.8,
  hazard: { form: 'strike', look: 'collapse', r: 58, warn: 'The old palace falls into the new world' },
  formation: WAHRWELT_FORMATION,
  roster: 'heroes',
  lastBearer: 'aizen',
  unlockedBy: 'palace',
};

/**
 * Karakura Town: the world of the living, the last part of the three worlds
 * that will not fold into the One World. Hollows pour into its streets
 * through Garganta, Urahara's empty gigai shuffle at you and his kidō
 * sentries fire from the corners; three of Chad, Orihime, Yoruichi and Isshin
 * stand in the way, and Kisuke Urahara, who planned for this a century ago,
 * waits at 20:00. Opened by clearing the Wahrwelt: the hardest stage.
 */
const KARAKURA: StageDef = {
  id: 'karakura',
  name: 'Karakura Town',
  blurb: 'The world of the living, the last of the three that will not fold.',
  length: LENGTH,
  phases: [
    { from: 0, mix: [['hollow', 2], ['gigai', 2]] },
    { from: 45, mix: [['hollow', 2], ['gigai', 2], ['hound', 1]] },
    { from: 150, mix: [['gigai', 2], ['hound', 2], ['sentry', 1], ['brute', 1]] },
    { from: 300, mix: [['gigai', 3], ['hound', 2], ['sentry', 2], ['brute', 1], ['volatile', 1]] },
    { from: 360, mix: [['gigai', 3], ['hound', 2], ['sentry', 2], ['brute', 1], ['volatile', 1], ['cero', 1]] },
    { from: 600, mix: [['gigai', 3], ['hound', 3], ['sentry', 2], ['brute', 2], ['volatile', 1], ['cero', 1]] },
    { from: 900, mix: [['gigai', 3], ['hound', 3], ['sentry', 3], ['brute', 3], ['volatile', 2], ['cero', 2]] },
  ],
  events: sorted([
    ...skeleton(
      (t) => (t < 400 ? 'gigai' : 'hound'),
      (t) => (t < 300 ? 'brute' : 'gillian'),
      [1.4, 5, 19],
      KARAKURA_FORMATION,
    ),
    // A Menos Grande comes through after the third defender, as one did in Karakura before.
    { at: 906, kind: 'elite', enemy: 'gillian' },
    {
      at: LENGTH,
      kind: 'boss',
      enemy: 'urahara',
      hpMul: 46,
      final: true,
      warn: 'Kisuke Urahara tips his hat to you',
      sub: 'Once Captain of the 12th Division',
    },
  ]),
  hp: 1.45,
  spawn: 1.12,
  xp: 1.35,
  gold: 2,
  hazard: { form: 'seal', look: 'seal', r: 40, warn: 'Urahara’s traps wake under the streets' },
  formation: KARAKURA_FORMATION,
  roster: 'karakura',
  unlockedBy: 'wahrwelt',
};

export const STAGES: readonly StageDef[] = [HUECO, SEIREITEI, LASNOCHES, SILBERN, PALACE, WAHRWELT, KARAKURA];

/**
 * Trials: harder runs of a stage, unlocked one at a time by clearing the one
 * before. Each tier adds to everything below, and pays more gold.
 */
export const MAX_TRIAL = 5;
export const TRIAL_NAMES = ['Normal', 'Trial I', 'Trial II', 'Trial III', 'Trial IV', 'Trial V'] as const;

export interface TrialMods {
  hp: number;
  speed: number;
  spawn: number;
  bossHp: number;
  damage: number;
  bossDamage: number;
  damageTaken: number;
  gold: number;
}

export function trialMods(trial: number): TrialMods {
  const t = Math.max(0, Math.min(MAX_TRIAL, Math.floor(trial)));
  return {
    hp: 1 + 0.4 * t,
    speed: 1 + 0.05 * t,
    spawn: 1 + 0.1 * t,
    bossHp: 1 + 0.35 * t,
    damage: 1 + 0.08 * t,
    bossDamage: 1 + 0.1 * t,
    damageTaken: 1 + 0.1 * t,
    gold: 1 + 0.6 * t,
  };
}

/** One line for the stage picker. */
export function trialBlurb(trial: number): string {
  if (trial <= 0) return '';
  const m = trialMods(trial);
  return `${TRIAL_NAMES[trial]}: enemies +${Math.round((m.hp - 1) * 100)}% health and faster, bosses tougher, you take +${Math.round((m.damageTaken - 1) * 100)}% damage. Gold +${Math.round((m.gold - 1) * 100)}%.`;
}
export const STAGE_IDS: readonly StageId[] = STAGES.map((s) => s.id);
export const STAGE_BY_ID: ReadonlyMap<string, StageDef> = new Map(STAGES.map((s) => [s.id, s]));

export function stageById(id: string | undefined | null): StageDef {
  return (id && STAGE_BY_ID.get(id)) || HUECO;
}

export function phaseAt(stage: StageDef, t: number): SpawnPhase {
  let phase = stage.phases[0];
  for (const p of stage.phases) if (t >= p.from) phase = p;
  return phase;
}

/** Regular spawns per second: a trickle at 0:00, a flood by the end. */
export function spawnRate(t: number): number {
  const m = t / 60;
  return Math.min(DIFFICULTY.spawnCap, DIFFICULTY.spawnBase + DIFFICULTY.spawnLinear * m + DIFFICULTY.spawnSquare * m * m);
}

/** Enemies get a little faster as the run goes on. */
export function speedScale(t: number): number {
  return 1 + DIFFICULTY.speedPerMinute * (t / 60);
}

/** Mana per kill grows with time, so level-ups keep coming as the curve steepens. */
export function xpScale(t: number): number {
  return 1 + 0.1 * (t / 60);
}

/** Enemy health multiplier over time. */
export function hpScale(t: number): number {
  const m = t / 60;
  const late = Math.max(0, m - DIFFICULTY.lateFrom);
  return 1 + DIFFICULTY.hpLinear * m + DIFFICULTY.hpSquare * m * m + DIFFICULTY.hpCube * m * m * m + DIFFICULTY.hpLate * late * late;
}

/** What every swarm hit is multiplied by at run time t (seconds), the clock held at the stage's length. */
export function swarmDamage(t: number, length: number): number {
  const m = Math.min(t, length) / 60;
  return DIFFICULTY.damage + DIFFICULTY.damagePerMinute * m + DIFFICULTY.dmgLate * Math.max(0, m - DIFFICULTY.lateFrom);
}

/** How much tougher and harder-hitting a boss is than its timeline multiplier alone says (see DIFFICULTY). */
export function bossToughness(hpMul: number): { hp: number; damage: number } {
  return {
    hp: Math.min(DIFFICULTY.bossHpMax, DIFFICULTY.bossHpBase + DIFFICULTY.bossHpPerMul * hpMul),
    damage: 1 + (DIFFICULTY.bossDamage - 1) * Math.min(1, hpMul / DIFFICULTY.bossDamageAt),
  };
}
