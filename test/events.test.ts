import { describe, expect, it } from 'vitest';
import { DT } from '../src/config';
import { ENEMY_INDEX } from '../src/data/enemies';
import { World } from '../src/game/world';

function quiet(seed = 1, god = true): World {
  const w = new World({ seed, god, startTime: 120 });
  w.powers.length = 0;
  w.pr.n = 0;
  w.nextEventT = 1e9;
  // No timeline either: a shuffled run may bring its next chest or ring into the moments a test watches.
  w.stage = { ...w.stage, events: [] };
  return w;
}

function steps(w: World, n: number): void {
  for (let i = 0; i < n; i++) {
    w.step(0, 0);
    w.pendingLevelUps = 0;
    w.pendingChests.length = 0;
  }
}

function find(w: World, type: number): number {
  for (let i = 0; i < w.en.n; i++) if (w.en.type[i] === type && !w.en.dead[i]) return i;
  return -1;
}

describe('run events', () => {
  it('come between the bosses, never during a boss fight', () => {
    const w = quiet(2);
    w.nextEventT = w.t;
    steps(w, 2);
    expect(w.banners.some((b) => b.kind === 'event')).toBe(true);
    // The 5:00 bearer arrives from the timeline, then an event comes due mid-fight.
    const b = new World({ seed: 3, god: true, startTime: 298 });
    b.powers.length = 0;
    b.nextEventT = 1e9;
    steps(b, Math.round(4 / DT));
    expect(b.boss.active).toBe(true);
    b.banners.length = 0;
    b.nextEventT = b.t;
    steps(b, 2);
    expect(b.banners.some((x) => x.kind === 'event')).toBe(false);
    expect(b.nextEventT).toBeGreaterThan(b.t);
  });

  it('a rift pours out enemies; sealing it leaves a chest and gold', () => {
    const w = quiet(4);
    w.startEvent('rift');
    const before = w.en.n;
    steps(w, Math.round(3 / DT));
    expect(w.en.n).toBeGreaterThan(before + 3);
    const r = find(w, ENEMY_INDEX.rift);
    expect(r).toBeGreaterThanOrEqual(0);
    const gold = w.gold;
    w.killEnemy(r);
    expect(w.gold).toBeGreaterThan(gold);
    expect(w.pickups.some((q) => q.kind === 'chest')).toBe(true);
  });

  it('left alone, a rift seals itself with nothing left behind', () => {
    const w = quiet(5);
    w.startEvent('rift');
    steps(w, Math.round(26 / DT));
    expect(find(w, ENEMY_INDEX.rift)).toBe(-1);
    expect(w.pickups.some((q) => q.kind === 'chest')).toBe(false);
  });

  it('a golden runner flees and escapes, and pays out if caught', () => {
    const w = quiet(6);
    w.startEvent('golden');
    const i = find(w, ENEMY_INDEX.golden);
    const d0 = Math.hypot(w.en.x[i] - w.player.x, w.en.y[i] - w.player.y);
    steps(w, Math.round(2 / DT));
    const j = find(w, ENEMY_INDEX.golden);
    expect(Math.hypot(w.en.x[j] - w.player.x, w.en.y[j] - w.player.y)).toBeGreaterThan(d0 + 100);
    steps(w, Math.round(17 / DT));
    expect(find(w, ENEMY_INDEX.golden)).toBe(-1);

    const c = quiet(7);
    c.startEvent('golden');
    const gold = c.gold;
    c.killEnemy(find(c, ENEMY_INDEX.golden));
    expect(c.gold).toBe(gold + 80);
    expect(c.pickups.some((q) => q.kind === 'heart')).toBe(true);
  });

  it('a Reishi Storm rains mana; an ambush brings two elites and a ring', () => {
    const w = quiet(8);
    const orbs = w.orbs.n;
    w.startEvent('storm');
    steps(w, Math.round(2 / DT));
    expect(w.orbs.n).toBeGreaterThan(orbs + 15);
    const a = quiet(9);
    const n = a.en.n;
    a.startEvent('ambush');
    let elites = 0;
    for (let i = 0; i < a.en.n; i++) if (a.en.flags[i] & 1) elites++;
    expect(elites).toBe(2);
    expect(a.en.n).toBe(n + 26);
  });

  it('event enemies cannot be pushed, held or charmed, and never hurt you', () => {
    const w = quiet(10, false);
    w.startEvent('golden');
    const i = find(w, ENEMY_INDEX.golden);
    w.en.x[i] = w.player.x;
    w.en.y[i] = w.player.y;
    w.applyHold(i, 2, 0);
    w.charm(i, 5, 10, null);
    expect(w.en.freezeT[i]).toBe(0);
    expect(w.en.charmT[i]).toBe(0);
    steps(w, 10);
    expect(w.player.hp).toBe(w.player.maxHp);
  });
});
