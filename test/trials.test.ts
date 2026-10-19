import { describe, expect, it } from 'vitest';
import { DT } from '../src/config';
import { ENEMY_INDEX } from '../src/data/enemies';
import { trialMods } from '../src/data/stages';
import { runGold } from '../src/game/rewards';
import { World } from '../src/game/world';
import { defaultSave, endlessOpen, recordRun, trialsOpen } from '../src/save/save';

function steps(w: World, n: number): void {
  for (let i = 0; i < n; i++) {
    w.step(0, 0);
    w.pendingLevelUps = 0;
    w.pendingChests.length = 0;
  }
}

describe('trials', () => {
  it('each tier makes enemies tougher, bosses sturdier and hits harder', () => {
    const normal = new World({ seed: 1, startTime: 300 });
    const hard = new World({ seed: 1, startTime: 300, trial: 3 });
    const a = normal.spawnEnemy(ENEMY_INDEX.hollow, 300, 0);
    const b = hard.spawnEnemy(ENEMY_INDEX.hollow, 300, 0);
    expect(hard.en.maxHp[b] / normal.en.maxHp[a]).toBeCloseTo(trialMods(3).hp);
    const ba = normal.spawnEnemy(ENEMY_INDEX.bearer, 300, 0, false, 2);
    const bb = hard.spawnEnemy(ENEMY_INDEX.bearer, 300, 0, false, 2);
    expect(hard.en.maxHp[bb] / normal.en.maxHp[ba]).toBeCloseTo(trialMods(3).bossHp);
    normal.hurtPlayer(20);
    hard.hurtPlayer(20);
    expect(hard.player.maxHp - hard.player.hp).toBeCloseTo((normal.player.maxHp - normal.player.hp) * trialMods(3).damageTaken);
  });

  it('pay more gold per tier', () => {
    const run = { stage: 'hueco', time: 900, level: 60, bossKills: 3, cleared: false, pickupGold: 0, goldMul: 1 };
    expect(runGold({ ...run, trial: 2 })).toBe(Math.round(runGold(run) * trialMods(2).gold));
  });

  it('open one at a time: clearing a tier opens the next, up to Trial V; Endless opens with the first clear', () => {
    const s = defaultSave();
    expect(trialsOpen(s, 'hueco')).toBe(0);
    expect(endlessOpen(s, 'hueco')).toBe(false);
    const run = { stage: 'hueco' as const, time: 1210, level: 90, kills: 9000, cleared: true, gold: 0 };
    recordRun(s, run);
    expect(trialsOpen(s, 'hueco')).toBe(1);
    expect(endlessOpen(s, 'hueco')).toBe(true);
    recordRun(s, { ...run, trial: 1 });
    expect(trialsOpen(s, 'hueco')).toBe(2);
    recordRun(s, { ...run, trial: 1, cleared: false });
    expect(trialsOpen(s, 'hueco')).toBe(2);
    recordRun(s, { ...run, trial: 5 });
    expect(trialsOpen(s, 'hueco')).toBe(5);
    expect(trialsOpen(s, 'seireitei')).toBe(0);
  });
});

describe('Endless', () => {
  it('the lord falls and the night goes on: no victory, and a new wave of bosses a minute later', () => {
    const w = new World({ seed: 4, god: true, startTime: 1199, endless: true });
    w.powers.length = 0;
    steps(w, Math.round(3 / DT));
    let lord = -1;
    for (let i = 0; i < w.en.n; i++) if (w.en.type[i] === ENEMY_INDEX.vasto) lord = i;
    expect(lord).toBeGreaterThanOrEqual(0);
    w.killEnemy(lord);
    steps(w, Math.round(5 / DT));
    expect(w.over).toBeNull();
    expect(w.banners.some((b) => b.title === 'Endless')).toBe(true);
    steps(w, Math.round(60 / DT));
    expect(w.boss.active).toBe(true);
    expect(w.over).toBeNull();
    expect(w.t).toBeGreaterThan(w.stage.length + 60);
  });

  it('keeps its own record', () => {
    const s = defaultSave();
    recordRun(s, { stage: 'hueco', time: 1210, level: 90, kills: 9000, cleared: true, gold: 0 });
    const out = recordRun(s, { stage: 'hueco', time: 1650, level: 120, kills: 20000, cleared: false, gold: 0, endless: true });
    expect(out.newBest).toBe(true);
    expect(s.stages.hueco.endless).toBe(1650);
    expect(s.stages.hueco.best).toBe(1210);
  });
});
