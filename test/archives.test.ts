import { describe, expect, it } from 'vitest';
import { ARMORY_COST, GESANG_VERSES, UPGRADES, verseCost } from '../src/data/archives';
import { RELIC_BY_ID } from '../src/data/relics';
import { runGold } from '../src/game/rewards';
import { World } from '../src/game/world';
import {
  affordable,
  armoryRelics,
  buyArmory,
  buyUpgrade,
  buyVerse,
  goldMul,
  metaChoices,
  metaMods,
  metaRerolls,
  metaRevives,
  metaStartLevels,
  nextCost,
  nextVerseCost,
  setStart,
  setStartRelic,
  startOptions,
  upgradeLevel,
} from '../src/save/archives';
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
    // A one-level upgrade is maxed at once.
    const r = rich(5000);
    expect(buyUpgrade(r, 'foresight')).toBe(true);
    expect(nextCost(r, 'foresight')).toBeNull();
    expect(buyUpgrade(r, 'foresight')).toBe(false);
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
    expect(metaRevives(full)).toBe(2);
    expect(metaRerolls(full)).toBe(3);
    expect(goldMul(full)).toBeCloseTo(1.3);
    expect(metaMods(full).atk).toBe(20);
    expect(metaMods(full).size).toBeCloseTo(0.25);
    expect(metaMods(full).critChance).toBeCloseTo(0.1);
    expect(metaStartLevels(full)).toBe(2);
    expect(metaChoices(full)).toBe(1);
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

  it('the world applies the upgrades: health, attack, revives, rerolls and the starting Schrift', () => {
    const s = maxed();
    const w = new World({ seed: 1, meta: metaMods(s), revives: metaRevives(s), rerolls: metaRerolls(s), start: 'xaxis' });
    expect(w.player.maxHp).toBeCloseTo(130);
    expect(w.player.hp).toBeCloseTo(130);
    expect(w.stats.atk).toBe(120);
    expect(w.player.revives).toBe(2);
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

describe('the Armory', () => {
  it('stores relics for good at a price by rarity, once each, and only those that are open', () => {
    const s = rich(2000);
    expect(buyArmory(s, 'silver-tube')).toBe(true);
    expect(s.gold).toBe(2000 - ARMORY_COST.common);
    expect(buyArmory(s, 'silver-tube')).toBe(false);
    expect(buyArmory(s, 'crown')).toBe(true);
    expect(s.gold).toBe(2000 - ARMORY_COST.common - ARMORY_COST.legendary);
    expect(buyArmory(s, 'banner')).toBe(false); // 400 left, a rare relic costs 800
    // Feat relics stay out until their feat opens them.
    expect(armoryRelics(s).some((r) => r.id === 'key')).toBe(false);
    s.gold = 5000;
    expect(buyArmory(s, 'key')).toBe(false);
    s.relicsOpen.push('key');
    expect(buyArmory(s, 'key')).toBe(true);
    expect(buyArmory(s, 'nope')).toBe(false);
    expect(s.armory).toEqual(['silver-tube', 'crown', 'key']);
  });

  it('equips only what it holds, and a run starts with the equipped relic', () => {
    const s = rich(2000);
    expect(setStartRelic(s, 'crown')).toBe(false);
    buyArmory(s, 'crown');
    expect(setStartRelic(s, 'crown')).toBe(true);
    expect(s.startRelic).toBe('crown');
    const w = new World({ seed: 1, relic: 'crown' });
    expect(w.relics.map((r) => r.id)).toEqual(['crown']);
    expect(w.stats.atk).toBe(130);
    // The relic is already held, so no chest offers it again.
    for (let k = 0; k < 20; k++) expect(w.relicChoices('black').some((r) => r.id === 'crown')).toBe(false);
    // A feat relic the save has not opened does nothing.
    expect(new World({ seed: 1, relic: 'key' }).relics).toEqual([]);
    expect(new World({ seed: 1, relic: 'key', relicsOpen: ['key'] }).relics.map((r) => r.id)).toEqual(['key']);
    expect(setStartRelic(s, null)).toBe(true);
    expect(s.startRelic).toBeNull();
  });
});

describe('the Kaiser Gesang', () => {
  it('each verse costs more than the one before, and there are a hundred', () => {
    expect(verseCost(0)).toBe(400);
    expect(verseCost(1)).toBe(500);
    expect(verseCost(GESANG_VERSES - 1)).toBe(400 + 100 * (GESANG_VERSES - 1));
    expect(verseCost(GESANG_VERSES)).toBeNull();
    const s = rich(900);
    expect(buyVerse(s)).toBe(true);
    expect(buyVerse(s)).toBe(true);
    expect(s.gold).toBe(0);
    expect(buyVerse(s)).toBe(false);
    expect(s.gesang).toBe(2);
    s.gesang = GESANG_VERSES;
    s.gold = 1e9;
    expect(nextVerseCost(s)).toBeNull();
    expect(buyVerse(s)).toBe(false);
  });

  it('every verse adds 1% damage and 1% health to every run', () => {
    const s = defaultSave();
    s.gesang = 10;
    const m = metaMods(s);
    expect(m.dmg).toBeCloseTo(0.1);
    expect(m.maxHp).toBeCloseTo(0.1);
    const w = new World({ seed: 1, meta: m });
    expect(w.player.maxHp).toBeCloseTo(110);
    expect(w.stats.dmgMult).toBeCloseTo(1.1);
  });
});

describe('gold that keeps mattering', () => {
  it('Gintō reserve opens a run with level-ups waiting, and the Foresight adds a card to every board', () => {
    expect(new World({ seed: 1, startLevels: 2 }).pendingLevelUps).toBe(2);
    const plain = new World({ seed: 4 });
    const seer = new World({ seed: 4, choices: 1 });
    for (let k = 0; k < 5; k++) {
      expect(plain.offers().length).toBe(3);
      expect(seer.offers().length).toBe(4);
    }
  });

  it('names the cheapest thing the gold on hand can buy', () => {
    const s = defaultSave();
    expect(affordable(s)).toBeNull();
    s.gold = 100;
    expect(affordable(s)).toBe('Absorption training Lv 1');
    const full = maxed();
    full.gold = 400;
    // Every upgrade is maxed: a common relic for the Armory comes before the first verse at the same price.
    expect(affordable(full)).toMatch(/^the .* for the Armory$/);
    full.gold = 1e6;
    for (const r of armoryRelics(full)) buyArmory(full, r.id);
    full.gold = 450;
    expect(affordable(full)).toBe('verse 1 of the Kaiser Gesang');
  });

  it('repairs the Armory and the Gesang in a broken save', () => {
    const s = migrate({ armory: ['crown', 'crown', 'nope', 7, 'key'], startRelic: 'banner', gesang: 1e6 });
    expect(s.armory).toEqual(['crown']);
    expect(s.startRelic).toBeNull();
    expect(s.gesang).toBe(GESANG_VERSES);
    const ok = migrate({ armory: ['crown', 'key'], startRelic: 'key', relicsOpen: ['key'], gesang: 3.7 });
    expect(ok.armory).toEqual(['crown', 'key']);
    expect(ok.startRelic).toBe('key');
    expect(ok.gesang).toBe(3);
    expect(RELIC_BY_ID.get('key')?.locked).toBe(true);
    expect(migrate({}).armory).toEqual([]);
  });
});
