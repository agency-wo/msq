import { describe, expect, it } from 'vitest';
import { CODEX_ENEMY_KEYS } from '../src/data/codex';
import { ENEMY_INDEX } from '../src/data/enemies';
import { MISSIONS, missionStage } from '../src/data/missions';
import { DIFFICULTY, STAGES, type StageId, type TimelineEvent } from '../src/data/stages';
import { FLAG_STAMPEDE, MF_ENEMY, MK_CERO, MK_FIRE, MK_LANE, MS_LINE, ZK_MIRE } from '../src/game/constants';
import { World } from '../src/game/world';

function steps(w: World, n: number, mx = 0, my = 0): void {
  for (let i = 0; i < n; i++) {
    w.step(mx, my);
    w.pendingLevelUps = 0;
    w.pendingChests.length = 0;
  }
}

/** A quiet stage: no powers, nothing spawning on its own, the timeline far away. */
function quiet(stage: StageId, god = true): World {
  const w = new World({ seed: 5, stage, god });
  Object.assign(w as unknown as Record<string, unknown>, { spawnTick: () => undefined, runTimeline: () => undefined });
  w.powers.length = 0;
  w.pr.n = 0;
  steps(w, 1);
  return w;
}

function fire(w: World, ev: TimelineEvent): void {
  (w as unknown as { fire(e: TimelineEvent): void }).fire(ev);
}

function stampeders(w: World): number[] {
  const out: number[] = [];
  for (let i = 0; i < w.en.n; i++) if (!w.en.dead[i] && w.en.flags[i] & FLAG_STAMPEDE) out.push(i);
  return out;
}

describe('mid-run variety', () => {
  it('every stage and every mission has charging formations and hazard bursts', () => {
    for (const s of STAGES) {
      const runs = s.events.filter((e) => e.kind === 'stampede');
      const bursts = s.events.filter((e) => e.kind === 'hazard');
      expect(runs.length, s.id).toBeGreaterThanOrEqual(5);
      expect(bursts.length, s.id).toBeGreaterThanOrEqual(7);
      for (const e of runs) if (e.kind === 'stampede') expect(e.count).toBeLessThanOrEqual(DIFFICULTY.stampedeCap);
      expect(s.hazard.warn.length).toBeGreaterThan(8);
    }
    for (const m of MISSIONS) {
      const st = missionStage(m);
      // A mission gets its stage's formations and hazards wherever its bosses leave room.
      expect(st.events.some((e) => e.kind === 'hazard' || e.kind === 'stampede'), m.id).toBe(true);
      expect(st.events.every((e) => e.at < st.length + 1), m.id).toBe(true);
    }
  });

  it('a formation forms up off-screen, holds behind its warning, charges straight through and leaves without a kill', () => {
    const w = quiet('hueco');
    fire(w, { at: 0, kind: 'stampede', enemy: 'hound', count: 10, what: 'A pack of hounds' });
    const run = stampeders(w);
    expect(run.length).toBe(10);
    let lanes = 0;
    for (let k = 0; k < w.marks.n; k++) if (w.marks.kind[k] === MK_LANE && w.marks.shape[k] === MS_LINE && w.marks.dmg[k] === 0) lanes++;
    expect(lanes).toBeGreaterThan(0);
    const i = run[0];
    const x0 = w.en.x[i];
    const y0 = w.en.y[i];
    // Off the screen, and standing still through its wind-up.
    expect(Math.max(Math.abs(x0 - w.player.x) - w.viewHalfW, Math.abs(y0 - w.player.y) - w.viewHalfH)).toBeGreaterThan(0);
    steps(w, 30);
    expect(Math.hypot(w.en.x[i] - x0, w.en.y[i] - y0)).toBeLessThan(1);
    const kills = w.kills;
    const orbs = w.orbs.n;
    // Then it runs, and in a few seconds it is gone, with nothing to show for it.
    steps(w, 600);
    expect(stampeders(w).length).toBe(0);
    expect(w.kills).toBe(kills);
    expect(w.orbs.n).toBe(orbs);
  });

  it('a charge runs in a straight line, square to where it formed', () => {
    const w = quiet('silbern');
    fire(w, { at: 0, kind: 'stampede', enemy: 'brawler', count: 6, what: 'The Eleventh Division' });
    const run = stampeders(w);
    steps(w, 80);
    const a = run[0];
    const b = run[run.length - 1];
    // Both ends of the line moved the same way: the line holds.
    const da = [w.en.x[a] - w.en.ox[a], w.en.y[a] - w.en.oy[a]];
    const db = [w.en.x[b] - w.en.ox[b], w.en.y[b] - w.en.oy[b]];
    expect(Math.hypot(da[0], da[1])).toBeGreaterThan(2);
    expect(Math.abs(da[0] - db[0]) + Math.abs(da[1] - db[1])).toBeLessThan(0.5);
  });

  it('an Adjuchas in range fires a Cero down a warned line at you', () => {
    const w = quiet('hueco');
    expect(CODEX_ENEMY_KEYS.has('cero')).toBe(true);
    const i = w.spawnEnemy(ENEMY_INDEX.cero, w.player.x + 200, w.player.y);
    w.en.atkT[i] = 0;
    w.marks.n = 0;
    steps(w, 1);
    let ceros = 0;
    for (let k = 0; k < w.marks.n; k++) {
      if (w.marks.kind[k] !== MK_CERO || w.marks.shape[k] !== MS_LINE || !(w.marks.flags[k] & MF_ENEMY)) continue;
      ceros++;
      expect(w.marks.max[k]).toBeGreaterThanOrEqual(0.89);
      // Aimed at you: the line points from the Adjuchas toward the player.
      expect(Math.cos(w.marks.ang[k])).toBeLessThan(-0.9);
    }
    expect(ceros).toBe(1);
  });

  it('hazard strikes always come warned', () => {
    const w = quiet('seireitei');
    fire(w, { at: 0, kind: 'hazard' });
    w.marks.n = 0;
    let seen = 0;
    for (let s = 0; s < 400; s++) {
      steps(w, 1, 1, 0);
      for (let k = 0; k < w.marks.n; k++) {
        if (w.marks.kind[k] !== MK_FIRE || !(w.marks.flags[k] & MF_ENEMY)) continue;
        expect(w.marks.max[k]).toBeGreaterThanOrEqual(0.89);
        expect(w.marks.dmg[k]).toBeGreaterThan(0);
        seen++;
      }
    }
    expect(seen).toBeGreaterThan(0);
    // The burst ends.
    steps(w, DIFFICULTY.hazardSecs * 60);
    expect(w.hazardT).toBeLessThanOrEqual(0);
  });

  it('sinking sand slows you while you stand in it, and never wounds you', () => {
    const w = quiet('hueco', false);
    fire(w, { at: 0, kind: 'hazard' });
    let zone = -1;
    for (let s = 0; s < 200 && zone < 0; s++) {
      steps(w, 1);
      for (let k = 0; k < w.zones.n; k++) if (w.zones.kind[k] === ZK_MIRE) zone = k;
    }
    expect(zone).toBeGreaterThanOrEqual(0);
    const hp = w.player.hp;
    w.player.x = w.zones.x[zone];
    w.player.y = w.zones.y[zone];
    w.player.slowT = 0;
    steps(w, 20);
    expect(w.player.slowT).toBeGreaterThan(0);
    expect(w.player.hp).toBe(hp);
    expect(w.player.iframes).toBeLessThanOrEqual(0);
  });
});
