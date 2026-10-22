import { describe, expect, it } from 'vitest';
import { ENEMY_INDEX } from '../src/data/enemies';
import { World } from '../src/game/world';

function quiet(god = false): World {
  const w = new World({ seed: 3, stage: 'hueco', god });
  Object.assign(w as unknown as Record<string, unknown>, { spawnTick: () => undefined, runTimeline: () => undefined });
  w.powers.length = 0;
  w.pr.n = 0;
  w.step(0, 0);
  return w;
}

describe('impact', () => {
  it('a heavy blow asks for a hit-stop, a light one does not', () => {
    const w = quiet();
    w.player.iframes = 0;
    w.hurtPlayer(2);
    expect(w.hitStop).toBe(0);
    w.player.iframes = 0;
    w.hurtPlayer(w.player.maxHp * 0.3);
    expect(w.hitStop).toBeGreaterThan(0.05);
  });

  it('a boss falling holds the moment, and splashes ink', () => {
    const w = quiet(true);
    const i = w.spawnEnemy(ENEMY_INDEX.bearer, w.player.x + 150, w.player.y, false, 1);
    w.splats.n = 0;
    w.killEnemy(i);
    expect(w.hitStop).toBeGreaterThanOrEqual(0.18);
    expect(w.splats.n).toBeGreaterThan(0);
  });

  it('every death leaves ink for the renderer, a Soul Reaper\'s smaller than a Hollow\'s', () => {
    const w = quiet(true);
    const h = w.spawnEnemy(ENEMY_INDEX.brute, w.player.x + 150, w.player.y);
    w.splats.n = 0;
    w.killEnemy(h);
    const hollow = w.splats.s[0];
    const r = w.spawnEnemy(ENEMY_INDEX.guard, w.player.x - 150, w.player.y);
    w.splats.n = 0;
    w.killEnemy(r);
    expect(w.splats.n).toBe(1);
    expect(w.splats.s[0]).toBeLessThan(hollow);
  });

  it('the simulation never reads the hit-stop: a run plays the same with it set', () => {
    const a = new World({ seed: 11, stage: 'hueco', god: true });
    const b = new World({ seed: 11, stage: 'hueco', god: true });
    for (let k = 0; k < 600; k++) {
      b.hitStop = 0.5;
      a.step(0.3, -0.2);
      b.step(0.3, -0.2);
      a.pendingLevelUps = b.pendingLevelUps = 0;
      a.pendingChests.length = b.pendingChests.length = 0;
    }
    expect(b.kills).toBe(a.kills);
    expect(b.en.n).toBe(a.en.n);
    expect(b.player.x).toBe(a.player.x);
  });
});
