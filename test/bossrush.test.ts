import { describe, expect, it } from 'vitest';
import { DT } from '../src/config';
import { ENEMY_INDEX } from '../src/data/enemies';
import { World } from '../src/game/world';
import { defaultSave, recordRun, rushOpen } from '../src/save/save';

function steps(w: World, n: number): void {
  for (let i = 0; i < n; i++) {
    w.step(0, 0);
    w.pendingLevelUps = 0;
    w.pendingChests.length = 0;
    w.pendingShrine = false;
  }
}

function bosses(w: World): number[] {
  return Array.from({ length: w.en.n }, (_, i) => i).filter((i) => !w.en.dead[i] && w.en.flags[i] & 2);
}

describe('Boss Rush', () => {
  it('opens with eight level-ups and the first boss a few seconds in', () => {
    const w = new World({ seed: 1, god: true, bossRush: true });
    expect(w.pendingLevelUps).toBe(8);
    steps(w, Math.round(11 / DT));
    expect(bosses(w)).toHaveLength(0);
    steps(w, Math.round(2 / DT));
    expect(bosses(w)).toHaveLength(1);
    expect(w.en.type[bosses(w)[0]]).toBe(ENEMY_INDEX.bearer);
  });

  it('each boss down pays four level-ups, and the next comes six seconds later', () => {
    const w = new World({ seed: 2, god: true, bossRush: true });
    steps(w, Math.round(13 / DT));
    w.pendingLevelUps = 0;
    w.killEnemy(bosses(w)[0]);
    expect(w.pendingLevelUps).toBe(4);
    w.step(0, 0);
    w.pendingLevelUps = 0;
    steps(w, Math.round(5 / DT));
    expect(bosses(w)).toHaveLength(0);
    steps(w, Math.round(1.5 / DT));
    expect(bosses(w)).toHaveLength(1);
  });

  it('the third wave brings its escort, and the final boss ends it in victory', () => {
    const w = new World({ seed: 3, god: true, bossRush: true, stage: 'seireitei' });
    const kinds: number[][] = [];
    for (let wave = 0; wave < 4; wave++) {
      for (let k = 0; k < Math.round(12 / DT) && bosses(w).length === 0; k++) steps(w, 1);
      kinds.push(bosses(w).map((i) => w.en.type[i]));
      for (const i of bosses(w)) w.killEnemy(i);
      steps(w, 2);
    }
    expect(kinds[2]).toContain(ENEMY_INDEX.grandmaster);
    expect(kinds[3]).toEqual([ENEMY_INDEX.commander]);
    steps(w, Math.round(3 / DT));
    expect(w.over).toBe('victory');
    expect(w.t).toBeLessThan(120);
  });

  it('a wave is lighter than the same boss in a full run', () => {
    const rush = new World({ seed: 4, god: true, bossRush: true });
    for (let k = 0; k < Math.round(30 / DT) && bosses(rush).length < 2; k++) {
      steps(rush, 1);
      if (bosses(rush).length === 1 && rush.bossKills === 0) rush.killEnemy(bosses(rush)[0]);
    }
    const full = new World({ seed: 4, god: true, startTime: 599 });
    steps(full, Math.round(2 / DT));
    const a = bosses(rush)[0];
    const b = bosses(full)[0];
    expect(rush.en.maxHp[a]).toBeLessThan(full.en.maxHp[b]);
  });

  it('keeps the fastest clear, counts only clears, and opens once the stage is cleared', () => {
    const s = defaultSave();
    expect(rushOpen(s, 'hueco')).toBe(false);
    recordRun(s, { stage: 'hueco', time: 1210, level: 90, kills: 9000, cleared: true, gold: 0 });
    expect(rushOpen(s, 'hueco')).toBe(true);
    const run = { stage: 'hueco' as const, level: 40, kills: 900, gold: 0, bossRush: true };
    expect(recordRun(s, { ...run, time: 300, cleared: false }).newBest).toBe(false);
    expect(s.stages.hueco.rush).toBe(0);
    expect(recordRun(s, { ...run, time: 460, cleared: true }).newBest).toBe(true);
    expect(recordRun(s, { ...run, time: 520, cleared: true }).newBest).toBe(false);
    expect(recordRun(s, { ...run, time: 410, cleared: true }).newBest).toBe(true);
    expect(s.stages.hueco.rush).toBe(410);
    expect(s.stages.hueco.best).toBe(1210);
    expect(s.best.time).toBe(1210);
  });
});
