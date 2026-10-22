import { describe, expect, it } from 'vitest';
import { ARRANCAR_IDS } from '../src/data/arrancar';
import { BANKAI_IDS } from '../src/data/bankai';
import { GOTEI_IDS } from '../src/data/gotei';
import { HERO_IDS } from '../src/data/heroes';
import { KARAKURA_IDS } from '../src/data/karakura';
import { BOOK_ONE, BOOK_TWO, MISSION_BY_ID, missionBefore, MISSIONS, missionOpen, missionStage } from '../src/data/missions';
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
  it('twenty-two missions in three books, numbered in order, each on a real stage with a goal its timeline can meet', () => {
    expect(MISSIONS).toHaveLength(22);
    expect(BOOK_ONE).toBe(10);
    expect(BOOK_TWO).toBe(15);
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(MISSIONS.length);
    expect(MISSIONS.map((m) => m.numeral)).toEqual(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI', 'XXII']);
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
      // A mission may draw its bosses from another roster than its ground's (the Gotei climbing to the palace).
      const base = missionStage(m);
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
    expect(FEAT_BY_ID.get('story-all')?.goal).toBe(BOOK_ONE);
    expect(FEAT_BY_ID.get('story-book2')?.goal).toBe(BOOK_TWO - BOOK_ONE);
    expect(FEAT_BY_ID.get('story-book3')?.goal).toBe(MISSIONS.length - BOOK_TWO);
    expect(FEAT_BY_ID.get('story-book3')?.look).toBe('firstwar');
    for (const m of MISSIONS.slice(BOOK_ONE, BOOK_ONE + 2)) recordMission(s, m.id, 300, true);
    expect(FEAT_BY_ID.get('story-book2')?.save?.(s)).toBe(2);
  });

  it('Book III opens after Book I, then divides: both roads open with its first mission, each road in order', () => {
    const s = defaultSave();
    const open = (id: string): boolean => missionOpen(new Set(MISSIONS.filter((m) => s.missions[m.id]?.cleared).map((m) => m.id)), id);
    for (const m of MISSIONS.slice(0, BOOK_ONE)) recordMission(s, m.id, 300, true);
    expect(open('firstwar')).toBe(true);
    expect(open('throne')).toBe(false);
    expect(open('unbroken')).toBe(false);
    const prologue = recordMission(s, 'firstwar', 400, true);
    expect(prologue.opened).toContain('Mission XVII');
    expect(prologue.opened).toContain('Mission XX');
    expect(open('throne')).toBe(true);
    expect(open('unbroken')).toBe(true);
    expect(open('hollowarmy')).toBe(false);
    expect(open('zero')).toBe(false);
    expect(missionBefore(MISSION_BY_ID.get('zero') ?? MISSIONS[0])?.id).toBe('unbroken');
    // Each road has its own ending, and roads carry their names.
    const roads = new Set(MISSIONS.slice(BOOK_TWO).map((m) => m.road).filter(Boolean));
    expect(roads.size).toBe(2);
  });

  it('a telling can change who a roster boss is: Aizen still on his throne', () => {
    const m = MISSION_BY_ID.get('throne');
    if (!m) throw new Error('throne');
    // Just before he comes, with no swarm to wade through.
    const w = new World({ seed: 2, god: true, mission: m, startTime: 470 });
    Object.assign(w as unknown as Record<string, unknown>, { spawnTick: () => undefined });
    expect(w.bearers).toEqual(['aizen']);
    steps(w, 15 * 60);
    expect(w.messages.some((x) => x.text === 'Aizen rises from the white throne')).toBe(true);
    expect(w.banners.some((b) => b.title === 'Sōsuke Aizen' && b.sub === 'King of Las Noches')).toBe(true);
  });

  it('Book II: the Gotei climb to the palace, and Auswählen heals on every elite', () => {
    const climb = MISSION_BY_ID.get('climb');
    if (!climb) throw new Error('climb');
    const w = new World({ seed: 2, god: true, mission: climb });
    expect(w.stage.id).toBe('palace');
    expect(w.stage.roster).toBe('gotei');
    expect(stageById('palace').roster).toBe('royal');
    const m = MISSION_BY_ID.get('auswahlen');
    if (!m) throw new Error('auswahlen');
    const a = new World({ seed: 2, mission: m });
    a.step(0, 0);
    a.player.hp = a.player.maxHp * 0.5;
    a.killEnemy(a.spawnEnemy(0, a.player.x + 300, a.player.y, true));
    expect(a.player.hp).toBeCloseTo(a.player.maxHp * (0.5 + (m.eliteHeal ?? 0)), 3);
  });
});
