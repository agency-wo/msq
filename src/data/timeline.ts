import type { EnemyId } from './enemies';

/**
 * The stage timeline. Phase 1 compresses Magic Survival's pacing into a
 * 15-minute run: boss waves at 5:00 and 10:00, the final boss at 15:00, with
 * swarm rings, elites, chests and runes in between.
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
  | { at: number; kind: 'boss'; enemy: EnemyId; hpMul: number; final: boolean }
  | { at: number; kind: 'chest' }
  | { at: number; kind: 'rune'; rune: RuneKind };

const LENGTH = 15 * 60;

const PHASES: readonly SpawnPhase[] = [
  { from: 0, mix: [['wisp', 1]] },
  { from: 60, mix: [['wisp', 3], ['runner', 1]] },
  { from: 180, mix: [['wisp', 3], ['runner', 2], ['brute', 1]] },
  { from: 360, mix: [['wisp', 3], ['runner', 2], ['brute', 1], ['bomber', 1]] },
  { from: 600, mix: [['wisp', 2], ['runner', 3], ['brute', 2], ['bomber', 2]] },
];

function buildEvents(): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (let t = 90; t < LENGTH; t += 120) {
    events.push({ at: t, kind: 'ring', enemy: t < 400 ? 'wisp' : 'runner', count: 36 + Math.floor(t / 15) });
  }
  for (let t = 150; t < LENGTH; t += 120) {
    events.push({ at: t, kind: 'elite', enemy: t < 300 ? 'wisp' : 'brute' });
  }
  for (let t = 170; t < LENGTH; t += 150) events.push({ at: t, kind: 'chest' });
  for (let t = 240; t < LENGTH; t += 180) events.push({ at: t, kind: 'rune', rune: 'magnet' });
  // Boss health is set here per boss, not by the swarm's time curve: about 40 s, 60 s and 90 s of focus.
  events.push({ at: 300, kind: 'boss', enemy: 'warden', hpMul: 1, final: false });
  events.push({ at: 600, kind: 'boss', enemy: 'warden', hpMul: 2.8, final: false });
  events.push({ at: LENGTH, kind: 'boss', enemy: 'warden', hpMul: 7, final: true });
  return events.sort((a, b) => a.at - b.at);
}

export const STAGE = {
  name: 'Proving Ground',
  length: LENGTH,
  phases: PHASES,
  events: buildEvents() as readonly TimelineEvent[],
};

export function phaseAt(t: number): SpawnPhase {
  let phase = PHASES[0];
  for (const p of PHASES) if (t >= p.from) phase = p;
  return phase;
}

/** Regular spawns per second: a trickle at 0:00, a flood by 15:00. */
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
  return 1 + 0.1 * m + 0.03 * m * m;
}
