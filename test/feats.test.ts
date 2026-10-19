import { describe, expect, it } from 'vitest';
import { World } from '../src/game/world';
import { evaluateFeats, FEAT_BY_ID, FEATS, featProgress, type RunFacts } from '../src/save/feats';
import { defaultSave, migrate } from '../src/save/save';

function facts(over: Partial<RunFacts> = {}): RunFacts {
  return {
    stage: 'hueco',
    cleared: false,
    endless: false,
    bossRush: false,
    daily: false,
    time: 300,
    level: 20,
    kills: 400,
    bankai: 0,
    awakened: 0,
    resonances: 0,
    rushTier: 0,
    almighty: false,
    fragments: 0,
    pacts: 0,
    damage: 0,
    evolution: 0,
    ...over,
  };
}

describe('feats', () => {
  it('there are thirty, each with a goal and a reward', () => {
    expect(FEATS).toHaveLength(30);
    expect(new Set(FEATS.map((f) => f.id)).size).toBe(30);
    for (const f of FEATS) {
      expect(f.goal).toBeGreaterThan(0);
      expect(f.gold).toBeGreaterThan(0);
      expect(!!f.save !== !!f.run).toBe(true);
    }
  });

  it('a feat pays its gold once', () => {
    const s = defaultSave();
    s.totals.kills = 1200;
    const first = evaluateFeats(s).map((f) => f.id);
    expect(first).toContain('kills-1k');
    expect(s.gold).toBe(100);
    expect(evaluateFeats(s)).toHaveLength(0);
    expect(s.gold).toBe(100);
  });

  it('feats about one run remember the best attempt, and pay when one reaches the goal', () => {
    const s = defaultSave();
    evaluateFeats(s, facts({ level: 60 }));
    evaluateFeats(s, facts({ level: 40 }));
    const level = FEAT_BY_ID.get('level-100');
    if (!level) throw new Error('missing feat');
    expect(featProgress(s, level)).toBe(60);
    const earned = evaluateFeats(s, facts({ level: 104 })).map((f) => f.id);
    expect(earned).toContain('level-100');
    expect(featProgress(s, level)).toBe(100);
  });

  it('opens looks and relics', () => {
    const s = defaultSave();
    s.stages.palace.cleared = true;
    evaluateFeats(s, facts({ bossRush: true, cleared: true, time: 230, pacts: 3, fragments: 3 }));
    expect(s.looks).toContain('white');
    expect(s.relicsOpen.sort()).toEqual(['founder', 'key', 'seal']);
    expect(s.feats).toContain('rush-fast');
  });

  it('a locked relic never comes out of a chest until a feat opens it', () => {
    const locked = new Set(['founder', 'key', 'seal']);
    const closed = new World({ seed: 1, god: true });
    const open = new World({ seed: 1, god: true, relicsOpen: ['founder', 'key', 'seal'] });
    let seenClosed = false;
    let seenOpen = false;
    for (let k = 0; k < 400; k++) {
      if (closed.relicChoices('black').some((r) => locked.has(r.id))) seenClosed = true;
      if (open.relicChoices('black').some((r) => locked.has(r.id))) seenOpen = true;
    }
    expect(seenClosed).toBe(false);
    expect(seenOpen).toBe(true);
  });

  it("the feat relics: Founder's Medallion, the Silbern Key and the Soul King's Seal", () => {
    const w = new World({ seed: 2, god: true, stage: 'palace', relicsOpen: ['founder', 'key', 'seal'] });
    for (const id of ['founder', 'key', 'seal']) w.addRelic(id);
    w.grantBankai('zanka');
    w.grantFragment('heart');
    expect(w.powers.find((ps) => ps.def.id === 'zanka')?.level).toBe(2);
    expect(w.powers.find((ps) => ps.def.id === 'heart')?.level).toBe(2);
    expect(w.shrineChoices()).toHaveLength(4);
  });

  it('an old save starts with none earned and the default look; a broken one is cleaned', () => {
    const old = migrate({ v: 1 });
    expect(old.feats).toEqual([]);
    expect(old.looks).toEqual(['default']);
    expect(old.look).toBe('default');
    const junk = migrate({ v: 1, feats: ['kills-1k', 'nope', 3], featBest: { 'level-100': 50, x: 9 }, looks: ['white', 'pink'], look: 'crimson', relicsOpen: ['seal', 'crown'] });
    expect(junk.feats).toEqual(['kills-1k']);
    expect(junk.featBest).toEqual({ 'level-100': 50 });
    expect(junk.looks).toEqual(['default', 'white']);
    expect(junk.look).toBe('default');
    expect(junk.relicsOpen).toEqual(['seal']);
  });
});
