import { describe, expect, it } from 'vitest';
import { DT } from '../src/config';
import { ENEMY_INDEX } from '../src/data/enemies';
import { FIRST_SHRINE_AT, PACTS } from '../src/data/shrines';
import { World } from '../src/game/world';

function steps(w: World, n: number): void {
  for (let i = 0; i < n; i++) {
    w.step(0, 0);
    w.pendingLevelUps = 0;
    w.pendingChests.length = 0;
  }
}

function power(w: World, id: string): number {
  return w.powers.find((ps) => ps.def.id === id)?.level ?? 0;
}

describe('Quincy shrines', () => {
  it('the first appears at 3:40; walking into it offers three different pacts', () => {
    const w = new World({ seed: 1, god: true, startTime: FIRST_SHRINE_AT - 2 });
    steps(w, Math.round(3 / DT));
    const shrine = w.pickups.find((q) => q.kind === 'shrine');
    expect(shrine).toBeDefined();
    expect(w.banners.some((b) => b.title === 'Quincy Shrine')).toBe(true);
    if (!shrine) return;
    w.player.x = shrine.x;
    w.player.y = shrine.y;
    w.step(0, 0);
    expect(w.pendingShrine).toBe(true);
    const ids = w.shrineChoices().map((d) => d.id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
  });

  it('each pact is made once a run, and is not offered again', () => {
    const w = new World({ seed: 2, god: true });
    const hp = () => w.player.maxHp;
    const before = hp();
    w.takePact('blood');
    w.takePact('blood');
    expect(hp()).toBeCloseTo(before * 0.75);
    for (let k = 0; k < 20; k++) expect(w.shrineChoices().some((d) => d.id === 'blood')).toBe(false);
  });

  it('Blood, Iron and Echoes trade damage against health and numbers', () => {
    const base = new World({ seed: 3, god: true });
    const blood = new World({ seed: 3, god: true });
    const iron = new World({ seed: 3, god: true });
    const echoes = new World({ seed: 3, god: true });
    blood.takePact('blood');
    iron.takePact('iron');
    echoes.takePact('echoes');
    for (const w of [base, blood, iron, echoes]) w.step(0, 0);
    expect(blood.dmgMul / base.dmgMul).toBeCloseTo(1.3);
    expect(iron.dmgMul / base.dmgMul).toBeCloseTo(0.85);
    expect(iron.player.maxHp / base.player.maxHp).toBeCloseTo(1.4);
    expect(iron.stats.regen - base.stats.regen).toBeCloseTo(2);
    expect(echoes.stats.count - base.stats.count).toBe(1);
    expect(echoes.dmgMul / base.dmgMul).toBeCloseTo(0.8);
  });

  it('Haste and Greed change the enemies that come after', () => {
    const base = new World({ seed: 4, god: true, startTime: 300 });
    const haste = new World({ seed: 4, god: true, startTime: 300 });
    const greed = new World({ seed: 4, god: true, startTime: 300 });
    haste.takePact('haste');
    greed.takePact('greed');
    const a = base.spawnEnemy(ENEMY_INDEX.hollow, 300, 0);
    const b = haste.spawnEnemy(ENEMY_INDEX.hollow, 300, 0);
    const c = greed.spawnEnemy(ENEMY_INDEX.hollow, 300, 0);
    expect(haste.en.spd[b] / base.en.spd[a]).toBeCloseTo(1.12);
    expect(haste.stats.moveSpeed - base.stats.moveSpeed).toBeCloseTo(0.2);
    expect(greed.en.maxHp[c] / base.en.maxHp[a]).toBeCloseTo(1.2);
    expect(greed.goldBonus).toBeCloseTo(1.6);
  });

  it('Offering moves two levels from the weakest attack to the strongest', () => {
    const w = new World({ seed: 5, god: true });
    expect(w.shrineChoices().some((d) => d.id === 'offering')).toBe(false);
    w.give('explode', 4);
    w.give('fear', 3);
    w.takePact('offering');
    expect(power(w, 'explode')).toBe(6);
    expect(power(w, 'fear')).toBe(1);
  });

  it("the Hunter's Pact calls the next bearer now, never again later, and it pays an extra black chest", () => {
    const w = new World({ seed: 6, god: true, startTime: 200 });
    w.takePact('hunter');
    const bearers = () => Array.from({ length: w.en.n }, (_, i) => i).filter((i) => w.en.type[i] === ENEMY_INDEX.bearer && !w.en.dead[i]);
    expect(bearers()).toHaveLength(1);
    w.messages.length = 0;
    steps(w, Math.round(110 / DT));
    expect(bearers()).toHaveLength(1);
    expect(w.messages.some((m) => m.text === 'A medallion bearer approaches')).toBe(false);
    w.killEnemy(bearers()[0]);
    expect(w.pickups.filter((q) => q.kind === 'chestBlack')).toHaveLength(2);
  });

  it('the Gamble wins a legendary relic or costs half your health', () => {
    let won = 0;
    let lost = 0;
    for (let seed = 1; seed <= 30 && (won === 0 || lost === 0); seed++) {
      const w = new World({ seed, god: true });
      const hp = w.player.hp;
      w.takePact('gamble');
      if (w.relics.some((r) => r.rarity === 'legendary')) won++;
      else if (w.player.hp < hp) lost++;
    }
    expect(won).toBeGreaterThan(0);
    expect(lost).toBeGreaterThan(0);
  });

  it('Renewal heals you fully and adds a reroll, at the cost of your progress to the next level', () => {
    const w = new World({ seed: 7, god: true });
    w.player.hp = 10;
    w.xp = w.xpNext * 0.8;
    w.takePact('renewal');
    expect(w.player.hp).toBe(w.player.maxHp);
    expect(w.rerolls).toBe(1);
    expect(w.xp).toBe(0);
  });

  it('the Wandenreich Pact speeds levels and turns chests into gold', () => {
    const w = new World({ seed: 8, god: true });
    const xp = w.stats.xpGain;
    w.takePact('wandenreich');
    expect(w.stats.xpGain - xp).toBeCloseTo(0.3);
    w.addPickup('chest', w.player.x, w.player.y);
    w.step(0, 0);
    expect(w.pendingChests).toHaveLength(0);
    expect(w.gold).toBeGreaterThanOrEqual(50);
  });

  it('every pact has a gain and a price', () => {
    for (const d of PACTS) {
      expect(d.gain.length).toBeGreaterThan(5);
      expect(d.cost.length).toBeGreaterThan(5);
    }
  });
});
