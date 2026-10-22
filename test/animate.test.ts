import { describe, expect, it } from 'vitest';
import { ENEMY_INDEX } from '../src/data/enemies';
import { BOSS_ACT } from '../src/game/constants';
import { World } from '../src/game/world';

describe('bosses act', () => {
  it('a boss that strikes shows it for a moment, and only then', () => {
    const w = new World({ seed: 6, stage: 'hueco', god: true });
    Object.assign(w as unknown as Record<string, unknown>, { spawnTick: () => undefined, runTimeline: () => undefined });
    w.powers.length = 0;
    const i = w.spawnEnemy(ENEMY_INDEX.harribel, w.player.x + 120, w.player.y, false, 5);
    w.en.spd[i] = 0;
    expect(w.en.actT[i]).toBe(0);
    let struck = false;
    for (let k = 0; k < 600 && !struck; k++) {
      w.step(0, 0);
      w.pendingLevelUps = 0;
      if (w.en.actT[i] > 0) struck = true;
    }
    expect(struck).toBe(true);
    expect(w.en.actT[i]).toBeLessThanOrEqual(BOSS_ACT);
    // It fades on its own.
    for (let k = 0; k < 40; k++) w.step(0, 0);
    expect(w.en.actT[i]).toBeLessThan(BOSS_ACT);
  });
});
