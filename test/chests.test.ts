import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { ENEMY_INDEX } from '../src/data/enemies';
import { RELICS } from '../src/data/relics';
import { cacheGold, TREASURES } from '../src/data/treasures';
import { rollChest, type ChestCard } from '../src/game/offers';
import { World } from '../src/game/world';

const ALL: ChestCard[] = TREASURES.map((t) => ({ kind: 'treasure', treasure: t.id }));

describe('chest rewards', () => {
  it('a brown chest sometimes ends on a treasure; a golden chest always holds a legendary and a treasure', () => {
    let treasures = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const cards = rollChest(RELICS, new Set(), 'brown', new Rng(seed), 3, ALL);
      expect(cards.length).toBe(3);
      if (cards[2].kind === 'treasure') treasures++;
      const gold = rollChest(RELICS, new Set(), 'gold', new Rng(seed), 4, ALL);
      expect(gold.length).toBe(4);
      expect(gold[0].kind === 'relic' && gold[0].relic.rarity === 'legendary').toBe(true);
      expect(gold.some((c) => c.kind === 'treasure')).toBe(true);
      const black = rollChest(RELICS, new Set(), 'black', new Rng(seed), 3, ALL);
      expect(black.every((c) => c.kind === 'relic')).toBe(true);
    }
    expect(treasures).toBeGreaterThan(50);
    expect(treasures).toBeLessThan(110);
  });

  it('every treasure does what it says', () => {
    const w = new World({ seed: 3, stage: 'hueco', god: true });
    w.step(0, 0);
    const gold = w.gold;
    w.takeTreasure('cache');
    expect(w.gold - gold).toBe(cacheGold(w.t));
    const max = w.player.maxHp;
    w.player.hp = 5;
    w.takeTreasure('spring');
    expect(w.player.maxHp).toBeCloseTo(max * 1.1, 1);
    expect(w.player.hp).toBe(w.player.maxHp);
    const id = w.powers[0].def.id;
    const level = w.powers[0].level;
    w.takeTreasure('surge', id);
    expect(w.powers[0].level).toBe(level + 1);
    const ups = w.pendingLevelUps;
    w.takeTreasure('crystal');
    expect(w.pendingLevelUps).toBe(ups + 1);
    const rr = w.rerolls;
    w.takeTreasure('sigil');
    expect(w.rerolls).toBe(rr + 1);
    const mul = w.dmgMul;
    w.takeTreasure('verse');
    expect(w.dmgMul / mul).toBeCloseTo(1.05, 3);
  });

  it('a caught treasure runner leaves a golden chest, and its board has one card more', () => {
    const w = new World({ seed: 5, stage: 'hueco', god: true });
    w.startEvent('golden');
    const i = w.en.type.indexOf(ENEMY_INDEX.golden);
    expect(i).toBeGreaterThanOrEqual(0);
    w.killEnemy(i);
    expect(w.pickups.some((q) => q.kind === 'chestGold')).toBe(true);
    expect(w.chestCards('gold').length).toBe(w.chestCards('brown').length + 1);
  });

  it('the new gear works', () => {
    const w = new World({ seed: 8, stage: 'hueco', god: true });
    w.step(0, 0);
    const mul = w.dmgMul;
    w.addRelic('kaiser-seal');
    const b = w.spawnEnemy(ENEMY_INDEX.bearer, w.player.x + 200, w.player.y, false, 1);
    w.killEnemy(b);
    expect(w.dmgMul / mul).toBeCloseTo(1.08, 3);
    const bonus = w.goldBonus;
    w.addRelic('ledger');
    expect(w.goldBonus / bonus).toBeCloseTo(1.2, 5);
    w.addRelic('reishi-shell');
    w.shieldCharges = 0;
    w.step(0, 0);
    expect(w.shieldCharges).toBe(1);
  });
});
