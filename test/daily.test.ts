import { describe, expect, it } from 'vitest';
import { DAILY_CLEAR_GOLD, DAILY_MODS, DAILY_SURVIVE_GOLD, DAILY_SURVIVE_TIME, dailyFor, dateKey } from '../src/data/daily';
import { ENEMY_INDEX } from '../src/data/enemies';
import { STARTABLE_IDS, STARTING_POWER } from '../src/data/powers';
import { World } from '../src/game/world';
import { defaultSave, migrate, recordDaily, recordRun, stageUnlocked } from '../src/save/save';

const days = Array.from({ length: 90 }, (_, k) => dateKey(new Date(2026, 9, 1 + k)));

describe('the Daily Trial', () => {
  it('the same date always gives the same trial, and the next day a different one', () => {
    expect(dailyFor('2026-10-19', true)).toEqual(dailyFor('2026-10-19', true));
    expect(dailyFor('2026-10-20', true).seed).not.toBe(dailyFor('2026-10-19', true).seed);
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it("picks a Schrift to hold beside Heilig Pfeil, and two different rules", () => {
    const mods = new Set(DAILY_MODS.map((m) => m.id));
    for (const date of days) {
      const spec = dailyFor(date, true);
      expect(STARTABLE_IDS).toContain(spec.schrift);
      expect(spec.schrift).not.toBe(STARTING_POWER);
      expect(spec.mods).toHaveLength(2);
      expect(spec.mods[0]).not.toBe(spec.mods[1]);
      for (const id of spec.mods) expect(mods.has(id)).toBe(true);
    }
  });

  it('only sends players to Seireitei once they have reached it, with the rest of the trial unchanged', () => {
    const stages = new Set(days.map((d) => dailyFor(d, true).stage));
    expect(stages).toEqual(new Set(['hueco', 'seireitei']));
    for (const date of days) {
      const open = dailyFor(date, true);
      const closed = dailyFor(date, false);
      expect(closed.stage).toBe('hueco');
      expect({ ...closed, stage: open.stage }).toEqual(open);
    }
  });

  it("the run holds Heilig Pfeil and today's Schrift from the first second", () => {
    const spec = dailyFor('2026-10-19', true);
    const w = new World({ seed: spec.seed, stage: spec.stage, start: STARTING_POWER, extra: spec.schrift, mods: spec.mods });
    expect(w.powers.map((ps) => ps.def.id)).toEqual([STARTING_POWER, spec.schrift]);
    expect(new World({ extra: STARTING_POWER }).powers).toHaveLength(1);
    expect(new World({ extra: 'senbonzakura' }).powers).toHaveLength(1);
  });

  it('every rule turns up within a season', () => {
    const seen = new Set(days.flatMap((d) => dailyFor(d, true).mods));
    expect(seen.size).toBe(DAILY_MODS.length);
  });
});

describe('daily rules', () => {
  const pair = (mods: string[]): [World, World] => [new World({ seed: 3, startTime: 300 }), new World({ seed: 3, startTime: 300, mods })];

  it('Glass Cannon: 40% more damage dealt and taken', () => {
    const [a, b] = pair(['glass']);
    a.step(0, 0);
    b.step(0, 0);
    expect(b.dmgMul / a.dmgMul).toBeCloseTo(1.4);
    a.hurtPlayer(20);
    b.hurtPlayer(20);
    expect(b.player.maxHp - b.player.hp).toBeCloseTo((a.player.maxHp - a.player.hp) * 1.4);
  });

  it('The Swarm and Giants change how sturdy, big and fast enemies are, but not bosses', () => {
    for (const [mods, hp, r, spd] of [
      [['swarm'], 0.85, 1, 1],
      [['giants'], 1.5, 1.15, 0.85],
    ] as const) {
      const [a, b] = pair([...mods]);
      const i = a.spawnEnemy(ENEMY_INDEX.hollow, 300, 0);
      const j = b.spawnEnemy(ENEMY_INDEX.hollow, 300, 0);
      expect(b.en.maxHp[j] / a.en.maxHp[i]).toBeCloseTo(hp);
      expect(b.en.r[j] / a.en.r[i]).toBeCloseTo(r);
      expect(b.en.spd[j] / a.en.spd[i]).toBeCloseTo(spd);
      const bi = a.spawnEnemy(ENEMY_INDEX.bearer, 300, 0, false, 2);
      const bj = b.spawnEnemy(ENEMY_INDEX.bearer, 300, 0, false, 2);
      expect(b.en.maxHp[bj]).toBeCloseTo(a.en.maxHp[bi]);
    }
  });

  it('Haste: you and the enemies move 15% faster', () => {
    const [a, b] = pair(['haste']);
    a.step(1, 0);
    b.step(1, 0);
    expect((b.player.x - b.player.ox) / (a.player.x - a.player.ox)).toBeCloseTo(1.15);
    const i = a.spawnEnemy(ENEMY_INDEX.hollow, 300, 0);
    const j = b.spawnEnemy(ENEMY_INDEX.hollow, 300, 0);
    expect(b.en.spd[j] / a.en.spd[i]).toBeCloseTo(1.15);
  });

  it('Frail: 60% of your health, regenerating 1.5 a second', () => {
    const [a, b] = pair(['frail']);
    expect(b.player.maxHp / a.player.maxHp).toBeCloseTo(0.6);
    expect(b.stats.regen - a.stats.regen).toBeCloseTo(1.5);
  });

  it('Barren: a chest pays its gold on the spot and never opens a relic choice, and levels come 30% faster', () => {
    const [a, b] = pair(['barren']);
    expect(b.stats.xpGain - a.stats.xpGain).toBeCloseTo(0.3);
    for (const w of [a, b]) {
      w.addPickup('chest', w.player.x, w.player.y);
      w.step(0, 0);
    }
    expect(a.pendingChests).toEqual(['brown']);
    expect(b.pendingChests).toHaveLength(0);
    expect(b.gold - a.gold).toBe(50);
  });
});

describe('the daily record', () => {
  it('pays once a day for surviving five minutes and once for the clear, and keeps the best time', () => {
    const s = defaultSave();
    // Quitting straight away pays nothing, so the bonus cannot be farmed.
    expect(recordDaily(s, '2026-10-19', 20, false)).toEqual({ bonus: 0, newBest: true });
    expect(recordDaily(s, '2026-10-19', DAILY_SURVIVE_TIME, false)).toEqual({ bonus: DAILY_SURVIVE_GOLD, newBest: true });
    expect(recordDaily(s, '2026-10-19', 400, false)).toEqual({ bonus: 0, newBest: true });
    expect(recordDaily(s, '2026-10-19', 1210, true)).toEqual({ bonus: DAILY_CLEAR_GOLD, newBest: true });
    expect(recordDaily(s, '2026-10-19', 1210, true)).toEqual({ bonus: 0, newBest: false });
    expect(s.gold).toBe(DAILY_SURVIVE_GOLD + DAILY_CLEAR_GOLD);
    expect(s.totals.gold).toBe(DAILY_SURVIVE_GOLD + DAILY_CLEAR_GOLD);
    expect(s.daily.best).toBe(1210);
    // A new day starts a new record; a first-run clear pays both bonuses.
    expect(recordDaily(s, '2026-10-20', 1215, true)).toEqual({ bonus: DAILY_SURVIVE_GOLD + DAILY_CLEAR_GOLD, newBest: true });
    expect(s.daily).toEqual({ date: '2026-10-20', best: 1215, survived: true, cleared: true });
  });

  it('a daily run pays and counts, but sets no stage record and unlocks no stage', () => {
    const s = defaultSave();
    const out = recordRun(s, { stage: 'hueco', time: 1210, level: 90, kills: 9000, cleared: true, gold: 500, daily: true });
    expect(out.newBest).toBe(false);
    expect(out.unlocked).toBeNull();
    expect(s.stages.hueco).toEqual(defaultSave().stages.hueco);
    expect(s.best.time).toBe(0);
    expect(stageUnlocked(s, 'seireitei')).toBe(false);
    expect(s.gold).toBe(500);
    expect(s.totals.runs).toBe(1);
  });

  it('survives a reload, and an old or broken save starts with an empty record', () => {
    const s = defaultSave();
    recordDaily(s, '2026-10-19', 640, false);
    expect(migrate(JSON.parse(JSON.stringify(s))).daily).toEqual(s.daily);
    const blank = { date: '', best: 0, survived: false, cleared: false };
    expect(migrate({ v: 1 }).daily).toEqual(blank);
    expect(migrate({ v: 1, daily: { date: 7, best: 'x', survived: 'yes' } }).daily).toEqual(blank);
  });
});
