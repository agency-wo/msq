import { describe, expect, it } from 'vitest';
import { ENEMY_INDEX } from '../src/data/enemies';
import { bossToughness, DIFFICULTY, hpScale, spawnRate, swarmDamage } from '../src/data/stages';
import { World } from '../src/game/world';

/** The curves as they were before the game was made harder. */
const oldHp = (t: number): number => {
  const m = t / 60;
  return 1 + 0.1 * m + 0.035 * m * m;
};
const oldSpawn = (t: number): number => {
  const m = t / 60;
  return Math.min(45, 0.9 + 0.6 * m + 0.09 * m * m);
};

describe('difficulty', () => {
  it('the swarm stays near the old curve early and is far tougher and thicker late', () => {
    expect(hpScale(180) / oldHp(180)).toBeLessThan(1.25);
    expect(hpScale(1200) / oldHp(1200)).toBeGreaterThan(2.5);
    expect(spawnRate(120) / oldSpawn(120)).toBeLessThan(1.15);
    expect(spawnRate(1200) / oldSpawn(1200)).toBeGreaterThan(1.3);
  });

  it('bosses grow tougher with their tier: the first near what it was, the last up to the cap', () => {
    expect(bossToughness(1).hp).toBeLessThan(1.3);
    expect(bossToughness(1).damage).toBeLessThan(1.05);
    expect(bossToughness(14).hp).toBeGreaterThan(bossToughness(4).hp);
    expect(bossToughness(14).damage).toBeCloseTo(DIFFICULTY.bossDamage);
    expect(bossToughness(60).hp).toBe(DIFFICULTY.bossHpMax);
  });

  it('a hit late in the run lands far harder than the same enemy’s at the start', () => {
    const at = (t: number): number => {
      const w = new World({ seed: 3, god: true, startTime: t });
      const i = w.spawnEnemy(ENEMY_INDEX.hollow, w.player.x + 200, w.player.y);
      return w.en.dmg[i];
    };
    expect(at(1200) / at(0)).toBeCloseTo(swarmDamage(1200, 1200) / swarmDamage(0, 1200), 2);
    // Past 8:00 the hits climb faster still.
    expect(swarmDamage(1200, 1200) - swarmDamage(600, 1200)).toBeGreaterThan(swarmDamage(480, 1200) - swarmDamage(0, 1200));
  });

  it('the late game grows on its own; the first eight minutes are as they were', () => {
    const early = (t: number): number => {
      const m = t / 60;
      return 1 + DIFFICULTY.hpLinear * m + DIFFICULTY.hpSquare * m * m + DIFFICULTY.hpCube * m * m * m;
    };
    expect(hpScale(DIFFICULTY.lateFrom * 60)).toBeCloseTo(early(DIFFICULTY.lateFrom * 60), 6);
    expect(hpScale(1200)).toBeGreaterThan(early(1200) * 1.3);
  });

  it('the world answers your training: enemies grow with how much of the Archives you hold', () => {
    const make = (pressure: number): World => new World({ seed: 4, god: true, pressure });
    const a = make(0);
    const b = make(1);
    const hp = (w: World, type: number, elite = false, hpMul = 1): number => w.en.hp[w.spawnEnemy(type, w.player.x + 200, w.player.y, elite, hpMul)];
    expect(hp(b, ENEMY_INDEX.bearer, false, 5) / hp(a, ENEMY_INDEX.bearer, false, 5)).toBeCloseTo(1 + DIFFICULTY.pressureBoss, 3);
    expect(hp(b, ENEMY_INDEX.brute, true) / hp(a, ENEMY_INDEX.brute, true)).toBeCloseTo(1 + DIFFICULTY.pressureElite, 3);
    expect(hp(b, ENEMY_INDEX.hollow) / hp(a, ENEMY_INDEX.hollow)).toBeCloseTo(1 + DIFFICULTY.pressureSwarm, 3);
    const dmg = (w: World): number => w.en.dmg[w.spawnEnemy(ENEMY_INDEX.hollow, w.player.x - 200, w.player.y)];
    expect(dmg(b) / dmg(a)).toBeCloseTo(1 + DIFFICULTY.pressureDamage, 3);
  });
});
