import { describe, expect, it } from 'vitest';
import { UPGRADES } from '../src/data/archives';
import { runGold } from '../src/game/rewards';
import { World } from '../src/game/world';
import { buyUpgrade, goldMul, metaMods, metaRerolls, metaRevives, nextCost, setStart, startOptions, upgradeLevel } from '../src/save/archives';
import { defaultSave, migrate, recordRun } from '../src/save/save';

function rich(gold = 100_000) {
  const s = defaultSave();
  s.gold = gold;
  return s;
}

function maxed() {
  const s = rich(1_000_000);
  for (const u of UPGRADES) while (buyUpgrade(s, u.id));
  return s;
}

describe('the Wandenreich Archives', () => {
  it('every upgrade costs more at each level', () => {
    for (const u of UPGRADES) {
      expect(u.costs.length).toBeGreaterThan(0);
      for (let k = 1; k < u.costs.length; k++) expect(u.costs[k]).toBeGreaterThan(u.costs[k - 1]);
      expect(!!u.perLevel !== !!u.special).toBe(true);
    }
  });

  it('buying spends the price, raises the level, and stops at max or when gold runs out', () => {
    const s = rich(300);
    expect(nextCost(s, 'arterie')).toBe(120);
    expect(buyUpgrade(s, 'arterie')).toBe(true);
    expect(s.gold).toBe(180);
    expect(upgradeLevel(s, 'arterie')).toBe(1);
    expect(nextCost(s, 'arterie')).toBe(240);
    expect(buyUpgrade(s, 'arterie')).toBe(false); // 180 < 240
    expect(s.gold).toBe(180);
    const r = rich(5000);
    expect(buyUpgrade(r, 'ransotengai')).toBe(true);
    expect(nextCost(r, 'ransotengai')).toBeNull();
    expect(buyUpgrade(r, 'ransotengai')).toBe(false);
    expect(buyUpgrade(r, 'nope')).toBe(false);
  });

  it('sums owned upgrades into one set of stat mods, plus revives, rerolls and a gold bonus', () => {
    const s = rich();
    buyUpgrade(s, 'arterie');
    buyUpgrade(s, 'arterie');
    for (let k = 0; k < 3; k++) buyUpgrade(s, 'vene');
    buyUpgrade(s, 'control');
    const m = metaMods(s);
    expect(m.atk).toBe(8);
    expect(m.maxHp).toBeCloseTo(0.18);
    expect(m.cdr).toBeCloseTo(0.02);
    expect(m.moveSpeed).toBeUndefined();
    const full = maxed();
    expect(metaRevives(full)).toBe(1);
    expect(metaRerolls(full)).toBe(3);
    expect(goldMul(full)).toBeCloseTo(1.3);
    expect(metaMods(full).atk).toBe(20);
  });

  it('repairs a broken or old save: levels clamped, junk dropped, gold carried over', () => {
    const s = migrate({
      gold: 'lots',
      totals: { gold: 420 },
      meta: { arterie: 99, control: 2.7, nope: 3, vene: -1 },
      awakened: ['xaxis', 'senbonzakura', 'balance', 7, 'explode'],
      start: 'senbonzakura',
    });
    expect(s.gold).toBe(420);
    expect(s.meta).toEqual({ arterie: 5, control: 2 });
    expect(s.awakened).toEqual(['xaxis', 'explode']);
    expect(s.start).toBe('heilig');
    expect(migrate({ awakened: ['fear'], start: 'fear' }).start).toBe('fear');
  });

  it('a finished run adds its gold to spend and to the lifetime total, and its awakenings become starts', () => {
    const s = defaultSave();
    const out = recordRun(s, {
      stage: 'hueco',
      time: 600,
      level: 40,
      kills: 4000,
      cleared: false,
      gold: 310,
      awakened: ['heilig', 'xaxis', 'senbonzakura'],
    });
    expect(s.gold).toBe(310);
    expect(s.totals.gold).toBe(310);
    expect(s.awakened).toEqual(['heilig', 'xaxis']);
    expect(out.starts).toEqual(['xaxis']);
    expect(startOptions(s)).toEqual(['heilig', 'xaxis']);
    expect(setStart(s, 'xaxis')).toBe(true);
    expect(setStart(s, 'explode')).toBe(false);
    expect(s.start).toBe('xaxis');
    // Already awakened: nothing new to report.
    expect(recordRun(s, { stage: 'hueco', time: 60, level: 3, kills: 30, cleared: false, gold: 20, awakened: ['xaxis'] }).starts).toEqual([]);
  });

  it('pays about 120 gold for falling at 5:00 and about 900 for clearing Hueco Mundo; Seireitei pays more', () => {
    const early = runGold({ stage: 'hueco', time: 300, level: 21, bossKills: 0, cleared: false, pickupGold: 0, goldMul: 1 });
    expect(early).toBe(117);
    const clear = { stage: 'hueco', time: 1240, level: 100, bossKills: 4, cleared: true, pickupGold: 0, goldMul: 1 };
    expect(runGold(clear)).toBeGreaterThan(850);
    expect(runGold(clear)).toBeLessThan(1000);
    expect(runGold({ ...clear, stage: 'seireitei' })).toBe(Math.round(runGold(clear) * 1.25));
    expect(runGold({ ...clear, goldMul: 1.3 })).toBe(Math.round(runGold(clear) * 1.3));
    expect(runGold({ ...clear, pickupGold: 75 })).toBe(runGold(clear) + 75);
  });

  it('the world applies the upgrades: health, attack, a revive, rerolls and the starting Schrift', () => {
    const s = maxed();
    const w = new World({ seed: 1, meta: metaMods(s), revives: metaRevives(s), rerolls: metaRerolls(s), start: 'xaxis' });
    expect(w.player.maxHp).toBeCloseTo(130);
    expect(w.player.hp).toBeCloseTo(130);
    expect(w.stats.atk).toBe(120);
    expect(w.player.revives).toBe(1);
    expect(w.rerolls).toBe(3);
    expect(w.powers.map((p) => p.def.id)).toEqual(['xaxis']);
    // Utilities, bankai and The Almighty cannot open a run.
    for (const bad of ['iron', 'senbonzakura', 'almighty', 'nope']) {
      expect(new World({ seed: 1, start: bad }).powers.map((p) => p.def.id)).toEqual(['heilig']);
    }
  });

  it('the upgrades survive a level-up and a passive (stats are recomputed with them)', () => {
    const s = maxed();
    const w = new World({ seed: 2, meta: metaMods(s) });
    w.addPassive('arterie');
    expect(w.stats.atk).toBe(130);
    expect(w.player.maxHp).toBeCloseTo(130);
  });
});
