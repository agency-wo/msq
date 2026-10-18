import type { EnemyId } from './enemies';

/**
 * Hueco Mundo, 20 minutes. Medallion bearers (random bankai, drawn per run) at
 * 5:00, 10:00 and 15:00, a Menos Grande escorting the third, and the Vasto
 * Lorde at 20:00 to clear the stage. Swarm rings, elites, chests and runes in between.
 */

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
  | { at: number; kind: 'boss'; enemy: EnemyId; hpMul: number; final: boolean }
  | { at: number; kind: 'chest' }
  | { at: number; kind: 'rune'; rune: RuneKind };

const LENGTH = 20 * 60;

const PHASES: readonly SpawnPhase[] = [
  { from: 0, mix: [['hollow', 1]] },
  { from: 60, mix: [['hollow', 3], ['hound', 1]] },
  { from: 180, mix: [['hollow', 3], ['hound', 2], ['brute', 1]] },
  { from: 360, mix: [['hollow', 3], ['hound', 2], ['brute', 1], ['volatile', 1]] },
  { from: 600, mix: [['hollow', 2], ['hound', 3], ['brute', 2], ['volatile', 2]] },
  { from: 900, mix: [['hollow', 2], ['hound', 3], ['brute', 3], ['volatile', 2]] },
];

function buildEvents(): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (let t = 90; t < LENGTH; t += 120) {
    events.push({ at: t, kind: 'ring', enemy: t < 400 ? 'hollow' : 'hound', count: 36 + Math.floor(t / 15) });
  }
  for (let t = 150; t < LENGTH; t += 120) events.push({ at: t, kind: 'elite', enemy: t < 300 ? 'hollow' : 'brute' });
  for (let t = 170; t < LENGTH; t += 150) events.push({ at: t, kind: 'chest' });
  for (let t = 240; t < LENGTH; t += 180) events.push({ at: t, kind: 'rune', rune: 'magnet' });
  // Bearer health comes from here, not from the swarm's time curve.
  // Tuned with the balance report: each bearer takes a careful player about 35-50 s,
  // the Vasto Lorde about 45 s against a full build with three bankai.
  events.push({ at: 300, kind: 'bearer', tier: 0, hpMul: 1 });
  events.push({ at: 600, kind: 'bearer', tier: 1, hpMul: 3.4 });
  events.push({ at: 900, kind: 'bearer', tier: 2, hpMul: 14 });
  events.push({ at: 905, kind: 'boss', enemy: 'menos', hpMul: 3, final: false });
  events.push({ at: LENGTH, kind: 'boss', enemy: 'vasto', hpMul: 60, final: true });
  return events.sort((a, b) => a.at - b.at);
}

export const STAGE = {
  name: 'Hueco Mundo',
  length: LENGTH,
  phases: PHASES,
  events: buildEvents() as readonly TimelineEvent[],
};

export function phaseAt(t: number): SpawnPhase {
  let phase = PHASES[0];
  for (const p of PHASES) if (t >= p.from) phase = p;
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
