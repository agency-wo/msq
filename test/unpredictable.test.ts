import { describe, expect, it } from 'vitest';
import { DT } from '../src/config';
import { MISSION_BY_ID, missionStage } from '../src/data/missions';
import { DIFFICULTY, stageById } from '../src/data/stages';
import { FLAG_ELITE, MF_ENEMY, MS_LINE } from '../src/game/constants';
import { CALAMITIES, World } from '../src/game/world';

function steps(w: World, n: number, mx = 0, my = 0): void {
  for (let i = 0; i < n && !w.over; i++) {
    w.step(mx, my);
    w.pendingLevelUps = 0;
    w.pendingChests.length = 0;
  }
}

/** Enemy marks that would land on the player's spot right now. */
function strikesOnYou(w: World): number[] {
  const M = w.marks;
  const out: number[] = [];
  for (let i = 0; i < M.n; i++) if (M.flags[i] & MF_ENEMY && Math.hypot(M.x[i] - w.player.x, M.y[i] - w.player.y) < 1) out.push(M.dmg[i]);
  return out;
}

/** A world with nothing else going on: no swarm, no timeline, no run events. */
function calm(seed: number, god = true): World {
  const w = new World({ seed, god, startTime: 60 });
  Object.assign(w as unknown as Record<string, unknown>, { spawnTick: () => undefined });
  w.stage = { ...w.stage, events: [] };
  w.nextEventT = 1e9;
  w.powers.length = 0;
  w.pr.n = 0;
  return w;
}

describe('stand still and the field finds you', () => {
  it('nothing comes down during the grace; then strikes land on your spot, heavier each time', () => {
    const w = calm(1);
    steps(w, Math.round((DIFFICULTY.stillGrace - 0.5) / DT));
    expect(strikesOnYou(w)).toHaveLength(0);
    steps(w, Math.round(1 / DT));
    const first = strikesOnYou(w);
    expect(first.length).toBeGreaterThan(0);
    expect(first[0]).toBeCloseTo(DIFFICULTY.stillBase * w.player.maxHp, 3);
    steps(w, Math.round(4 / DT));
    const later = Math.max(...strikesOnYou(w));
    expect(later).toBeGreaterThan(first[0]);
    expect(later).toBeLessThanOrEqual(DIFFICULTY.stillCap * w.player.maxHp + 1e-6);
    expect(w.messages.some((m) => m.text.includes('Stand still'))).toBe(true);
  });

  it('a mortal Emperor left standing does not last', () => {
    const w = calm(2, false);
    steps(w, Math.round(90 / DT));
    expect(w.over).toBe('dead');
  });

  it('moving on starts the count again', () => {
    const w = calm(3);
    for (let k = 0; k < 6; k++) {
      steps(w, Math.round(4 / DT));
      // Walk well clear of the spot every few seconds.
      steps(w, Math.round(1.2 / DT), k % 2 ? 1 : -1, 0);
    }
    expect(w.marks.n).toBe(0);
  });
});

describe('every run its own war', () => {
  const nonBoss = (w: World): string => w.stage.events.filter((e) => e.kind !== 'bearer' && e.kind !== 'boss' && e.kind !== 'shrine').map((e) => `${e.kind}@${e.at}`).join(' ');

  it('two seeds bring the timeline at different moments; bosses, bearers and shrines keep theirs', () => {
    const a = new World({ seed: 1, god: true, stage: 'hueco' });
    const b = new World({ seed: 2, god: true, stage: 'hueco' });
    expect(nonBoss(a)).not.toEqual(nonBoss(b));
    const fixed = (events: readonly { kind: string; at: number }[]): string =>
      events
        .filter((e) => e.kind === 'bearer' || e.kind === 'boss' || e.kind === 'shrine')
        .map((e) => `${e.kind}@${e.at}`)
        .join(' ');
    expect(fixed(a.stage.events)).toEqual(fixed(stageById('hueco').events));
  });

  it('nothing lands in a boss’s window or the last half minute, and the timeline stays in order', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const w = new World({ seed, god: true, stage: 'seireitei' });
      const at = w.stage.events.map((e) => e.at);
      expect([...at].sort((x, y) => x - y)).toEqual(at);
      const bosses = w.stage.events.filter((e) => e.kind === 'bearer' || e.kind === 'boss').map((e) => e.at);
      for (const e of w.stage.events) {
        if (e.kind === 'bearer' || e.kind === 'boss' || e.kind === 'shrine') continue;
        const was = stageById('seireitei').events.some((o) => o.kind === e.kind && o.at === e.at);
        if (was) continue;
        expect(bosses.some((b) => e.at > b - 45 && e.at < b + 20), `${e.kind}@${e.at}`).toBe(false);
        expect(e.at).toBeLessThanOrEqual(w.stage.length - 30);
      }
    }
  });

  it('a Story mission keeps its script', () => {
    const m = MISSION_BY_ID.get('jagdarmee');
    if (!m) throw new Error('jagdarmee');
    const w = new World({ seed: 5, god: true, mission: m });
    expect(w.stage.events.map((e) => `${e.kind}@${e.at}`)).toEqual(missionStage(m).events.map((e) => `${e.kind}@${e.at}`));
  });
});

describe('calamities', () => {
  it('each one announces itself', () => {
    for (const kind of CALAMITIES) {
      const w = calm(4);
      w.startEvent(kind);
      expect(w.banners.some((b) => b.kind === 'event'), kind).toBe(true);
    }
  });

  it('a barrage sends warned lines across the field, close by you', () => {
    const w = calm(5);
    w.startEvent('barrage');
    steps(w, Math.round(1 / DT));
    const M = w.marks;
    let lines = 0;
    for (let i = 0; i < M.n; i++) {
      if (M.shape[i] !== MS_LINE || !(M.flags[i] & MF_ENEMY)) continue;
      lines++;
      // The line's nearest point to you is within reach of a step or two.
      const dx = w.player.x - M.x[i];
      const dy = w.player.y - M.y[i];
      const along = dx * Math.cos(M.ang[i]) + dy * Math.sin(M.ang[i]);
      const off = Math.abs(-dx * Math.sin(M.ang[i]) + dy * Math.cos(M.ang[i]));
      expect(along).toBeGreaterThan(0);
      expect(off).toBeLessThanOrEqual(81);
      expect(M.dmg[i]).toBeGreaterThan(0.1 * w.player.maxHp);
    }
    expect(lines).toBeGreaterThanOrEqual(2);
  });

  it('a hunt sends a fast pack of elites; a frenzy speeds the swarm and ends', () => {
    const w = calm(6);
    w.startEvent('hunt');
    const E = w.en;
    let pack = 0;
    for (let i = 0; i < E.n; i++) if (E.flags[i] & FLAG_ELITE) pack++;
    expect(pack).toBe(3);
    // The pack is a threat, not a prize: no chest from any of them.
    for (let i = E.n - 1; i >= 0; i--) if (E.flags[i] & FLAG_ELITE) w.killEnemy(i);
    expect(w.pickups.some((q) => q.kind === 'chest')).toBe(false);
    w.startEvent('frenzy');
    expect(w.frenzyT).toBeGreaterThan(0);
    steps(w, Math.round(21 / DT));
    expect(w.frenzyT).toBeLessThanOrEqual(0);
  });

  it('Endless keeps rolling them past the stage’s end, more often the longer it goes', { timeout: 30_000 }, () => {
    const w = new World({ seed: 7, god: true, endless: true, startTime: 1500 });
    // Only the roller: no swarm, and no returning bosses to hold it back.
    Object.assign(w as unknown as Record<string, unknown>, { spawnTick: () => undefined, endlessNext: 1e9 });
    w.nextEventT = w.t;
    let events = 0;
    for (let k = 0; k < 600 / 30; k++) {
      steps(w, Math.round(30 / DT));
      events += w.banners.filter((b) => b.kind === 'event').length;
      w.banners.length = 0;
    }
    expect(events).toBeGreaterThanOrEqual(5);
  });
});
