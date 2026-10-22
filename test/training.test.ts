import { describe, expect, it } from 'vitest';
import { MASTERY_COSTS, MASTERY_PER } from '../src/data/archives';
import { ENEMY_INDEX } from '../src/data/enemies';
import { World } from '../src/game/world';
import {
  buyMastery,
  buyUpgrade,
  MASTERY_POWERS,
  masteryLevel,
  metaBossHeal,
  metaChestChoices,
  metaEliteChest,
  metaMastery,
  metaMods,
  metaShellEvery,
} from '../src/save/archives';
import { defaultSave } from '../src/save/save';

function rich(): ReturnType<typeof defaultSave> {
  const s = defaultSave();
  s.gold = 10_000_000;
  return s;
}

describe('more training', () => {
  it('Sternritter discipline hits bosses and elites harder, nothing else', () => {
    const s = rich();
    while (buyUpgrade(s, 'discipline'));
    const w = new World({ seed: 1, stage: 'hueco', god: true, meta: metaMods(s) });
    const plain = new World({ seed: 1, stage: 'hueco', god: true });
    for (const world of [w, plain]) Object.assign(world as unknown as Record<string, unknown>, { spawnTick: () => undefined });
    const hit = (world: World, type: number, elite: boolean): number => {
      const i = world.spawnEnemy(type, world.player.x + 300, world.player.y, elite, 50);
      const before = world.en.hp[i];
      world.stats.critChance = 0;
      world.damageEnemy(i, 10, 0, 0, 0, true);
      return before - world.en.hp[i];
    };
    expect(hit(w, ENEMY_INDEX.bearer, false) / hit(plain, ENEMY_INDEX.bearer, false)).toBeCloseTo(1.25, 2);
    expect(hit(w, ENEMY_INDEX.brute, true) / hit(plain, ENEMY_INDEX.brute, true)).toBeCloseTo(1.25, 2);
    expect(hit(w, ENEMY_INDEX.hollow, false) / hit(plain, ENEMY_INDEX.hollow, false)).toBeCloseTo(1, 2);
  });

  it('Letzt Stil drills strike harder only when close to falling', () => {
    const s = rich();
    while (buyUpgrade(s, 'letzt'));
    const w = new World({ seed: 1, stage: 'hueco', god: true, meta: metaMods(s) });
    const i = w.spawnEnemy(ENEMY_INDEX.brute, w.player.x + 300, w.player.y, false, 50);
    const strike = (): number => {
      const before = w.en.hp[i];
      w.damageEnemy(i, 10, 0, 0, 0, true);
      return before - w.en.hp[i];
    };
    const high = strike();
    w.player.hp = w.player.maxHp * 0.3;
    expect(strike() / high).toBeCloseTo(1.24, 2);
  });

  it('the shell grows back, elites leave a second chest, chests open wider, bosses give back health', () => {
    const s = rich();
    for (const id of ['shell', 'jagd', 'quartermaster', 'harvest']) while (buyUpgrade(s, id));
    expect(metaShellEvery(s)).toBe(30);
    expect(metaEliteChest(s)).toBeCloseTo(0.45);
    expect(metaChestChoices(s)).toBe(1);
    expect(metaBossHeal(s)).toBeCloseTo(0.24);
    const w = new World({ seed: 4, stage: 'hueco', shellEvery: metaShellEvery(s), eliteChest: 1, chestChoices: 1, bossHeal: 0.24 });
    w.step(0, 0);
    expect(w.shieldCharges).toBe(1);
    expect(w.relicChoices('brown').length).toBe(4);
    const e = w.spawnEnemy(ENEMY_INDEX.brute, w.player.x + 200, w.player.y, true);
    const chests = w.pickups.filter((q) => q.kind === 'chest').length;
    w.killEnemy(e);
    // Its own chest, and the Jagdarmee's second.
    expect(w.pickups.filter((q) => q.kind === 'chest').length).toBe(chests + 2);
    w.player.hp = 10;
    const b = w.spawnEnemy(ENEMY_INDEX.bearer, w.player.x + 200, w.player.y, false, 1);
    w.killEnemy(b);
    expect(w.player.hp).toBeCloseTo(10 + w.player.maxHp * 0.24, 1);
  });

  it('a discipline makes its power hit harder in a run, five levels at most', () => {
    const s = rich();
    const id = MASTERY_POWERS[0].id;
    while (buyMastery(s, id));
    expect(masteryLevel(s, id)).toBe(MASTERY_COSTS.length);
    expect(buyMastery(s, 'no-such-power')).toBe(false);
    const w = new World({ seed: 2, stage: 'hueco', start: id, mastery: metaMastery(s) });
    const base = new World({ seed: 2, stage: 'hueco', start: id });
    const a = w.powers.find((p) => p.def.id === id);
    const b = base.powers.find((p) => p.def.id === id);
    expect(a && b).toBeTruthy();
    if (!a || !b) return;
    expect(a.stats.damage / b.stats.damage).toBeCloseTo(1 + MASTERY_PER * MASTERY_COSTS.length, 5);
    w.addPower(id);
    base.addPower(id);
    expect(a.stats.damage / b.stats.damage).toBeCloseTo(1 + MASTERY_PER * MASTERY_COSTS.length, 5);
  });
});
