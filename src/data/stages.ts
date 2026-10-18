import type { EnemyId } from './enemies';

/**
 * The stages. Each one is 20 minutes: medallion bearers (random bankai, drawn
 * per run) at 5:00, 10:00 and 15:00, an escort with the third, and a final
 * boss at 20:00 to clear it. Swarm rings, elites, chests and runes in between.
 */

export type StageId = 'hueco' | 'seireitei';

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

export const STAGES: readonly StageDef[] = [HUECO, SEIREITEI];
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
