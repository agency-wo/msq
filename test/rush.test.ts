import { describe, expect, it } from 'vitest';
import { DT } from '../src/config';
import { ENEMY_INDEX } from '../src/data/enemies';
import { RUSH_TIERS, World } from '../src/game/world';

function quiet(seed = 1): World {
  const w = new World({ seed });
  w.powers.length = 0;
  w.pr.n = 0;
  return w;
}

function killMany(w: World, n: number): void {
  for (let k = 0; k < n; k++) {
    const i = w.spawnEnemy(ENEMY_INDEX.hollow, w.player.x + 300, w.player.y + k);
    w.killEnemy(i);
  }
}

describe('Blut Rush', () => {
  it('chained kills raise the tier, adding damage and speed', () => {
    const w = quiet();
    const base = w.dmgMul;
    killMany(w, RUSH_TIERS[0] - 1);
    expect(w.rushTier).toBe(0);
    killMany(w, 1);
    expect(w.rushTier).toBe(1);
    w.step(0, 0);
    expect(w.dmgMul).toBeGreaterThan(base);
    killMany(w, RUSH_TIERS[2]);
    expect(w.rushTier).toBe(3);
    expect(w.bestStreak).toBeGreaterThanOrEqual(RUSH_TIERS[2]);
  });

  it('a hit breaks the chain', () => {
    const w = quiet(2);
    killMany(w, RUSH_TIERS[1]);
    expect(w.rushTier).toBe(2);
    w.hurtPlayer(5);
    expect(w.streak).toBe(0);
    expect(w.rushTier).toBe(0);
  });

  it('so does a lull with nothing dying', () => {
    const w = quiet(3);
    killMany(w, RUSH_TIERS[0]);
    expect(w.rushTier).toBe(1);
    for (let s = 0; s < Math.round(3 / DT); s++) {
      w.step(0, 0);
      w.pendingLevelUps = 0;
    }
    expect(w.streak).toBe(0);
    expect(w.rushTier).toBe(0);
  });
});
