import { describe, expect, it } from 'vitest';
import { DT } from '../src/config';
import { ENEMY_INDEX } from '../src/data/enemies';
import { POWER_BY_ID } from '../src/data/powers';
import { doubleCount, TWIN_SHARE, twinCopy } from '../src/game/casts/schrift2';
import { PK_ARROW } from '../src/game/constants';
import { World } from '../src/game/world';

function only(id: string, level: number): World {
  const w = new World({ seed: 3, god: true, startTime: 60 });
  Object.assign(w as unknown as Record<string, unknown>, { spawnTick: () => undefined });
  w.stage = { ...w.stage, events: [] };
  w.nextEventT = 1e9;
  w.powers.length = 0;
  w.pr.n = 0;
  w.give(id, level);
  return w;
}

function steps(w: World, n: number): void {
  for (let i = 0; i < n; i++) {
    w.step(0, 0);
    w.pendingLevelUps = 0;
    w.pendingChests.length = 0;
  }
}

describe('The Yourself: the Lloyd twins', () => {
  it('never more than two of them, whatever else you hold; Royd joins at Lv 4', () => {
    const one = only('yourself', 3);
    const ps1 = one.power('yourself');
    if (!ps1) throw new Error('yourself');
    expect(doubleCount(one, ps1)).toBe(1);
    const two = only('yourself', 7);
    const ps2 = two.power('yourself');
    if (!ps2) throw new Error('yourself');
    two.stats.count = 5;
    expect(doubleCount(two, ps2)).toBe(2);
    expect(POWER_BY_ID.get('yourself')?.attributes?.some((a) => a.id === 'legion')).toBe(false);
  });

  it('Loyd has all of your power and 70% of your memory; Royd all of your memory and 70% of your power', () => {
    const w = only('yourself', 5);
    const ps = w.power('yourself');
    if (!ps) throw new Error('yourself');
    expect(twinCopy(ps, 0)).toEqual({ power: 1, memory: TWIN_SHARE });
    expect(twinCopy(ps, 1)).toEqual({ power: TWIN_SHARE, memory: 1 });
    // Their arrows: Loyd's hit as hard as the power, Royd's 70% as hard; Royd fires more of them.
    // (A target that outlasts the test.)
    w.spawnEnemy(ENEMY_INDEX.bearer, w.player.x + 250, w.player.y, false, 60);
    const seen = new Map<number, number>();
    for (let s = 0; s < Math.round(12 / DT); s++) {
      steps(w, 1);
      const P = w.pr;
      for (let k = 0; k < P.n; k++) if (P.kind[k] === PK_ARROW && P.life[k] > 1.2 - 1.5 * DT) seen.set(Math.round(P.dmg[k] * 100), (seen.get(Math.round(P.dmg[k] * 100)) ?? 0) + 1);
    }
    const full = Math.round(ps.stats.damage * 100);
    const part = Math.round(ps.stats.damage * TWIN_SHARE * 100);
    expect(seen.get(full) ?? 0).toBeGreaterThan(0);
    expect(seen.get(part) ?? 0).toBeGreaterThan(seen.get(full) ?? 0);
  });

  it('Perfect Copy: both twins copy all of you', () => {
    const w = only('yourself', 7);
    const ps = w.power('yourself');
    if (!ps) throw new Error('yourself');
    ps.attr = 'perfect';
    expect(twinCopy(ps, 0)).toEqual({ power: 1, memory: 1 });
    expect(twinCopy(ps, 1)).toEqual({ power: 1, memory: 1 });
  });
});

describe('The X-Axis: Lille Barro', () => {
  it('as the beam fires you turn intangible for a moment, at most once every 3 s', () => {
    const w = only('xaxis', 1);
    w.spawnEnemy(ENEMY_INDEX.brute, w.player.x + 200, w.player.y);
    let first = -1;
    let times = 0;
    let was = false;
    for (let s = 0; s < Math.round(9 / DT); s++) {
      steps(w, 1);
      const now = w.intangibleT > 0;
      if (now && !was) {
        times++;
        if (first < 0) first = w.t;
      }
      was = now;
    }
    expect(first).toBeGreaterThan(0);
    // The beam fires every 2 s; the intangible moment comes at most every 3 s.
    expect(times).toBeGreaterThanOrEqual(2);
    expect(times).toBeLessThanOrEqual(3);
    // While intangible, a blow passes through.
    w.intangibleT = 0;
    (w as unknown as { intangibleNext: number }).intangibleNext = 0;
    w.player.iframes = 0;
    w.turnIntangible();
    const hp = w.player.hp;
    w.hurtPlayer(10);
    expect(w.player.hp).toBe(hp);
  });

  it('pierces a boss’s guard: the whole blow gets through', () => {
    const w = only('xaxis', 1);
    const i = w.spawnEnemy(ENEMY_INDEX.bearer, w.player.x + 200, w.player.y, false, 5);
    const memo = w.bossMemo(i);
    memo.guard = w.t + 60;
    memo.guardMul = 0.3;
    const before = w.en.hp[i];
    w.pierceGuard = true;
    w.damageEnemy(i, 100, 0, w.player.x, w.player.y, true);
    w.pierceGuard = false;
    const pierced = before - w.en.hp[i];
    const mid = w.en.hp[i];
    w.damageEnemy(i, 100, 0, w.player.x, w.player.y, true);
    const guarded = mid - w.en.hp[i];
    expect(guarded / pierced).toBeCloseTo(0.3, 2);
  });
});
