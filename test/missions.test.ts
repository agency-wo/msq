import { describe, expect, it } from 'vitest';
import { ARRANCAR_IDS } from '../src/data/arrancar';
import { BANKAI_IDS } from '../src/data/bankai';
import { GOTEI_IDS } from '../src/data/gotei';
import { HERO_IDS } from '../src/data/heroes';
import { KARAKURA_IDS } from '../src/data/karakura';
import { MISSION_BY_ID, MISSIONS, missionOpen, missionStage } from '../src/data/missions';
import { ROYAL_IDS } from '../src/data/royal';
import { stageById } from '../src/data/stages';
import { FEAT_BY_ID } from '../src/save/feats';
import { World } from '../src/game/world';
import { defaultSave, migrate, missionsCleared, recordMission, recordRun } from '../src/save/save';

function steps(w: World, n: number): void {
  for (let i = 0; i < n && !w.over; i++) {
    w.step(0, 0);
    w.pendingLevelUps = 0;
    w.pendingChests.length = 0;
  }
}

const ROSTER: Record<string, readonly string[]> = {
  arrancar: ARRANCAR_IDS,
  gotei: GOTEI_IDS,
  heroes: HERO_IDS,
  karakura: KARAKURA_IDS,
  royal: ROYAL_IDS,
};

describe('Story Mode', () => {
  it('ten missions, numbered in order, each on a real stage with a goal its timeline can meet', () => {
    expect(MISSIONS).toHaveLength(10);
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(10);
    expect(MISSIONS.map((m) => m.numeral)).toEqual(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']);
    for (const m of MISSIONS) {
      const stage = missionStage(m);
      expect(stage.id, m.id).toBe(m.stage);
      expect(stage.length, m.id).toBe(m.length);
      const at = stage.events.map((e) => e.at);
      expect([...at].sort((a, b) => a - b), m.id).toEqual(at);
      const finals = stage.events.filter((e) => e.kind === 'boss' && e.final);
      const bosses = stage.events.filter((e) => e.kind === 'bearer' || e.kind === 'boss');
      if (m.goal.kind === 'boss') {
        expect(finals, m.id).toHaveLength(1);
        expect(finals[0].at, m.id).toBe(m.length);
      } else {
        expect(finals, m.id).toHaveLength(0);
      }
      if (m.goal.kind === 'bosses') expect(bosses.length, m.id).toBeGreaterThanOrEqual(m.goal.count);
      expect(m.brief.length + m.after.length, m.id).toBeGreaterThan(1);
      expect(m.reward, m.id).toBeGreaterThan(0);
    }
  });

  it('forced bearers belong to the stage’s roster, and every bearer slot can be filled', () => {
    for (const m of MISSIONS) {
      const base = stageById(m.stage);
      const pool = base.roster ? ROSTER[base.roster] : (base.bearerPool ?? BANKAI_IDS);
      for (const id of m.bearers ?? []) expect(pool, `${m.id}: ${id}`).toContain(id);
      const slots = missionStage(m).events.filter((e) => e.kind === 'bearer').length;
      expect(pool.length, m.id).toBeGreaterThanOrEqual(slots);
      const w = new World({ seed: 2, god: true, mission: m });
      expect(w.bearers, m.id).toHaveLength(slots);
      if (m.bearers) expect(w.bearers.slice(0, m.bearers.length), m.id).toEqual([...m.bearers]);
    }
  });

  it('a mission brings its rules: mods, the opening Schrift, The Almighty', () => {
    const hunt = new World({ seed: 3, god: true, mission: MISSION_BY_ID.get('jagdarmee'), extra: 'jail' });
    expect(hunt.mods.has('swarm')).toBe(true);
    expect(hunt.powers.some((ps) => ps.def.id === 'jail')).toBe(true);
    const almighty = new World({ seed: 3, god: true, mission: MISSION_BY_ID.get('almighty') });
    expect(almighty.powers.some((ps) => ps.def.id === 'almighty')).toBe(true);
  });

  it('a survival mission is won when the clock reaches its length', () => {
    const m = MISSION_BY_ID.get('jagdarmee');
    if (!m) throw new Error('jagdarmee');
    const w = new World({ seed: 3, god: true, mission: m, startTime: m.length - 2 });
    steps(w, 60 * 6);
    expect(w.over).toBe('victory');
  });

  it('a mission of so many bosses is won when that many are down', () => {
    const m = MISSION_BY_ID.get('medallions');
    if (!m || m.goal.kind !== 'bosses') throw new Error('medallions');
    const w = new World({ seed: 3, god: true, mission: m });
    steps(w, 60);
    expect(w.over).toBe(null);
    (w as unknown as { bossKills: number }).bossKills = m.goal.count;
    steps(w, 60 * 3);
    expect(w.over).toBe('victory');
  });

  it('missions open in order; the first clear pays once and opens the next; the record keeps the fastest', () => {
    const s = defaultSave();
    const cleared = (): Set<string> => new Set(MISSIONS.filter((m) => s.missions[m.id]?.cleared).map((m) => m.id));
    expect(missionOpen(cleared(), 'desert')).toBe(true);
    expect(missionOpen(cleared(), 'jagdarmee')).toBe(false);
    const gold = s.gold;
    expect(recordMission(s, 'desert', 300, false).reward).toBe(0);
    const first = recordMission(s, 'desert', 400, true);
    expect(first.reward).toBe(MISSION_BY_ID.get('desert')?.reward);
    expect(first.opened).toContain('Mission II');
    expect(s.gold).toBe(gold + first.reward);
    expect(missionOpen(cleared(), 'jagdarmee')).toBe(true);
    expect(recordMission(s, 'desert', 380, true)).toEqual({ reward: 0, newBest: true, opened: null });
    expect(recordMission(s, 'desert', 390, true).newBest).toBe(false);
    expect(s.missions.desert).toEqual({ cleared: true, best: 380 });
    expect(missionsCleared(s)).toBe(1);
  });

  it('a mission run counts for totals but never for a stage’s records or unlocks', () => {
    const s = defaultSave();
    const out = recordRun(s, { stage: 'hueco', time: 400, level: 30, kills: 2000, cleared: true, gold: 50, mission: true });
    expect(out.unlocked).toBe(null);
    expect(s.stages.hueco).toEqual(defaultSave().stages.hueco);
    expect(s.totals.runs).toBe(1);
  });

  it('the save keeps real missions and drops anything else', () => {
    const s = migrate({ missions: { desert: { cleared: true, best: 333 }, jagdarmee: { cleared: false, best: 99 }, nonsense: { cleared: true } } });
    expect(s.missions).toEqual({ desert: { cleared: true, best: 333 }, jagdarmee: { cleared: false, best: 0 } });
    expect(migrate({}).missions).toEqual({});
  });

  it('two feats follow the campaign', () => {
    const s = defaultSave();
    for (const m of MISSIONS.slice(0, 5)) recordMission(s, m.id, 300, true);
    expect(FEAT_BY_ID.get('story-half')?.save?.(s)).toBe(5);
    expect(FEAT_BY_ID.get('story-all')?.goal).toBe(MISSIONS.length);
  });
});
