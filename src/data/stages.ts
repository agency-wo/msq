import type { EnemyId } from './enemies';
import { FIRST_SHRINE_AT } from './shrines';

/**
 * The stages. Each one is 20 minutes: medallion bearers (random bankai, drawn
 * per run) at 5:00, 10:00 and 15:00, an escort with the third, and a final
 * boss at 20:00 to clear it. Swarm rings, elites, chests and runes in between.
 */

export type StageId = 'hueco' | 'seireitei' | 'palace';

export interface SpawnPhase {
  from: number;
  /** Weighted enemy mix for regular spawns. */
  mix: readonly (readonly [EnemyId, number])[];
}

export type RuneKind = 'magnet' | 'heart';

export type TimelineEvent =
  | { at: number; kind: 'ring'; enemy: EnemyId; count: number }
  | { at: number; kind: 'elite'; enemy: EnemyId }
  /** The `tier`th of the run's three medallion bearers. */
  | { at: number; kind: 'bearer'; tier: number; hpMul: number }
  /** `warn` shows 4 s before it arrives, `sub` under its name on the title card. */
  | { at: number; kind: 'boss'; enemy: EnemyId; hpMul: number; final: boolean; warn: string; sub: string }
  | { at: number; kind: 'chest' }
  /** A Quincy shrine appears near you (see data/shrines.ts). */
  | { at: number; kind: 'shrine' }
  | { at: number; kind: 'rune'; rune: RuneKind };

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
  /** The bosses are the Royal Guard, who leave Fragments of the Soul King instead of medallions. */
  royals?: boolean;
  /** Clearing this stage unlocks this one. */
  unlockedBy?: StageId;
}

const LENGTH = 20 * 60;

/** Rings, elites, chests, runes and the three bearers: the skeleton every stage shares. */
function skeleton(ring: (t: number) => EnemyId, elite: (t: number) => EnemyId, bearerHp: readonly [number, number, number]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (let t = 90; t < LENGTH; t += 120) events.push({ at: t, kind: 'ring', enemy: ring(t), count: 36 + Math.floor(t / 15) });
  for (let t = 150; t < LENGTH; t += 120) events.push({ at: t, kind: 'elite', enemy: elite(t) });
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
 * Hueco Mundo: the Hollow desert. Tuned with the balance report: each bearer
 * takes a careful player about 35-50 s, the Vasto Lorde about 45 s against a
 * full build with three bankai.
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
    { from: 360, mix: [['hollow', 3], ['hound', 2], ['brute', 1], ['volatile', 1]] },
    { from: 600, mix: [['hollow', 2], ['hound', 3], ['brute', 2], ['volatile', 2]] },
    { from: 900, mix: [['hollow', 2], ['hound', 3], ['brute', 3], ['volatile', 2]] },
  ],
  events: sorted([
    ...skeleton(
      (t) => (t < 400 ? 'hollow' : 'hound'),
      (t) => (t < 300 ? 'hollow' : 'brute'),
      [1, 3.4, 14],
    ),
    { at: 905, kind: 'boss', enemy: 'menos', hpMul: 3, final: false, warn: 'A Menos Grande rises', sub: 'Its Cero burns in a straight line' },
    { at: LENGTH, kind: 'boss', enemy: 'vasto', hpMul: 60, final: true, warn: 'The lord of Hueco Mundo awakens', sub: 'Lord of Hueco Mundo' },
  ]),
  hp: 1,
  spawn: 1,
  xp: 1,
  gold: 1,
};

/**
 * Seireitei: the Soul Reapers' walled city, at night. Unlocked by clearing
 * Hueco Mundo, and harder: tougher soldiers, flash-steps that close the gap,
 * Kidō casters that shoot from a distance. The bankai bosses here are the
 * captains themselves, defending their own bankai; the Kidō Grandmaster
 * escorts the third, and Captain-Commander Yamamoto waits at 20:00.
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
    ),
    // The third captain comes with the Kidō Corps instead of a Menos.
    { at: 905, kind: 'boss', enemy: 'grandmaster', hpMul: 4, final: false, warn: 'The Kidō Corps arrives', sub: 'Its seal binds you where you stand' },
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
  captains: true,
  // Zanka no Tachi belongs to the Captain-Commander, who only fights at the end.
  bearerPool: ['senbonzakura', 'hyorinmaru', 'raikoben', 'tengen', 'gonryo'],
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
  royals: true,
  unlockedBy: 'seireitei',
};

export const STAGES: readonly StageDef[] = [HUECO, SEIREITEI, PALACE];

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
    hp: 1 + 0.3 * t,
    speed: 1 + 0.04 * t,
    spawn: 1 + 0.08 * t,
    bossHp: 1 + 0.25 * t,
    damage: 1 + 0.05 * t,
    bossDamage: 1 + 0.08 * t,
    damageTaken: 1 + 0.06 * t,
    gold: 1 + 0.5 * t,
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
  return Math.min(45, 0.9 + 0.6 * m + 0.09 * m * m);
}

/** Enemies get a little faster as the run goes on. */
export function speedScale(t: number): number {
  return 1 + 0.012 * (t / 60);
}

/** Mana per kill grows with time, so level-ups keep coming as the curve steepens. */
export function xpScale(t: number): number {
  return 1 + 0.1 * (t / 60);
}

/** Enemy health multiplier over time. */
export function hpScale(t: number): number {
  const m = t / 60;
  return 1 + 0.1 * m + 0.035 * m * m;
}
