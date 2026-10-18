import { describe, expect, it } from 'vitest';
import { DT } from '../src/config';
import { ENEMY_INDEX } from '../src/data/enemies';
import { POWER_BY_ID } from '../src/data/powers';
import { FLAG_ZOMBIE, HOLD_JAIL, PK_ARROW, ZK_CAGE } from '../src/game/constants';
import { World } from '../src/game/world';
import { bot, play, sensible } from './helpers';

/** A world with only the given power and no crits. */
function only(id: string, level = 1, seed = 1, god = true): World {
  const w = new World({ seed, god });
  w.powers.length = 0;
  w.pr.n = 0;
  w.stats.critChance = 0;
  if (id) w.give(id, level);
  return w;
}

function steps(w: World, n: number, mx = 0, my = 0): void {
  for (let i = 0; i < n; i++) {
    w.step(mx, my);
    w.pendingLevelUps = 0;
    w.pendingChests.length = 0;
  }
}

function find(w: World, uid: number): number {
  for (let k = 0; k < w.en.n; k++) if (w.en.uid[k] === uid) return k;
  return -1;
}

describe('the second wave of Schrift', () => {
  it('G · The Glutton heals you for what it swallows', () => {
    const w = only('glutton', 1, 2, false);
    const p = w.player;
    p.hp = 50;
    for (let k = 0; k < 5; k++) {
      const i = w.spawnEnemy(ENEMY_INDEX.hollow, p.x + 50, p.y - 20 + k * 10);
      w.en.hp[i] = 1;
      w.en.spd[i] = 0;
    }
    steps(w, 40);
    expect(p.hp).toBeGreaterThan(50);
  });

  it('J · The Jail cages the toughest enemy near you, and nothing inside can move', () => {
    const w = only('jail');
    const p = w.player;
    w.spawnEnemy(ENEMY_INDEX.hollow, p.x + 100, p.y);
    const brute = w.spawnEnemy(ENEMY_INDEX.brute, p.x - 160, p.y);
    const uid = w.en.uid[brute];
    steps(w, 40);
    let cage = -1;
    for (let z = 0; z < w.zones.n; z++) if (w.zones.kind[z] === ZK_CAGE) cage = z;
    expect(cage).toBeGreaterThanOrEqual(0);
    const j = find(w, uid);
    expect(Math.hypot(w.zones.x[cage] - w.en.x[j], w.zones.y[cage] - w.en.y[j])).toBeLessThan(20);
    expect(w.en.freezeT[j]).toBeGreaterThan(0);
    expect(w.en.holdKind[j]).toBe(HOLD_JAIL);
    const x0 = w.en.x[j];
    steps(w, 30);
    expect(Math.abs(w.en.x[find(w, uid)] - x0)).toBeLessThan(1);
  });

  it('L · The Love charms enemies into fighting each other, never you', () => {
    const w = only('', 1, 3, false);
    const p = w.player;
    const a = w.spawnEnemy(ENEMY_INDEX.hollow, p.x + 30, p.y);
    const b = w.spawnEnemy(ENEMY_INDEX.brute, p.x + 90, p.y);
    const ua = w.en.uid[a];
    const ub = w.en.uid[b];
    w.charm(a, 5, 20, null);
    const hpB = w.en.hp[b];
    steps(w, Math.round(2 / DT));
    expect(w.en.charmT[find(w, ua)]).toBeGreaterThan(0);
    expect(w.en.hp[find(w, ub)]).toBeLessThan(hpB);
    // It walked right past you and never touched your health.
    expect(p.hp).toBe(p.maxHp);
  });

  it('L · bosses resist the charm but take more damage for a while', () => {
    const w = only('');
    const b = w.spawnEnemy(ENEMY_INDEX.bearer, w.player.x + 300, w.player.y);
    w.charm(b, 3, 20, null);
    expect(w.en.charmT[b]).toBe(0);
    expect(w.en.vulnT[b]).toBeGreaterThan(0);
    expect(w.en.vulnK[b]).toBeCloseTo(0.25);
  });

  it('Z · The Zombie: an infected enemy that dies rises on your side, then crumbles without a reward', () => {
    const w = only('zombie');
    const p = w.player;
    steps(w, 1); // let the power hand its numbers to the world
    const i = w.spawnEnemy(ENEMY_INDEX.brute, p.x + 200, p.y);
    w.en.infT[i] = 3;
    const orbs = w.orbs.n;
    w.killEnemy(i);
    let z = -1;
    for (let k = 0; k < w.en.n; k++) if (w.en.flags[k] & FLAG_ZOMBIE && !w.en.dead[k]) z = k;
    expect(z).toBeGreaterThanOrEqual(0);
    expect(w.en.charmT[z]).toBeGreaterThan(0);
    expect(w.zombieN).toBe(1);
    // The original kill dropped its mana.
    expect(w.orbs.n).toBe(orbs + 1);
    // When its time is up it crumbles: gone, no mana, not counted as a kill.
    const zuid = w.en.uid[z];
    w.powers.length = 0;
    w.en.charmT[z] = 0.02;
    const kills = w.kills;
    const orbsBefore = w.orbs.n;
    steps(w, 3);
    expect(find(w, zuid)).toBe(-1);
    expect(w.zombieN).toBe(0);
    expect(w.kills).toBe(kills);
    expect(w.orbs.n).toBe(orbsBefore);
  });

  it('Z · shots pass through your zombies instead of killing them', () => {
    const w = only('heilig', 1, 6);
    steps(w, 1);
    const p = w.player;
    const z = w.spawnEnemy(ENEMY_INDEX.brute, p.x + 40, p.y);
    w.en.flags[z] |= FLAG_ZOMBIE;
    w.en.charmT[z] = 99;
    w.zombieN = 1;
    w.en.spd[z] = 0;
    const hp = w.en.hp[z];
    const uid = w.en.uid[z];
    const foe = w.spawnEnemy(ENEMY_INDEX.brute, p.x + 140, p.y);
    w.en.spd[foe] = 0;
    steps(w, 60);
    expect(w.en.hp[find(w, uid)]).toBe(hp);
  });

  it('P · The Power hurls the crowd behind its target back', () => {
    const w = only('power');
    const p = w.player;
    const t = w.spawnEnemy(ENEMY_INDEX.brute, p.x + 60, p.y);
    const behind = w.spawnEnemy(ENEMY_INDEX.brute, p.x + 110, p.y + 5);
    const ub = w.en.uid[behind];
    w.en.spd[t] = 0;
    w.en.spd[behind] = 0;
    const hp = w.en.hp[behind];
    steps(w, 30);
    const j = find(w, ub);
    expect(w.en.hp[j]).toBeLessThan(hp);
    expect(w.en.x[j]).toBeGreaterThan(p.x + 115);
  });

  it('Y · The Yourself: doubles stand away from you and fire arrows of their own', () => {
    const w = only('yourself');
    const p = w.player;
    w.spawnEnemy(ENEMY_INDEX.brute, p.x + 250, p.y);
    let fromDouble = false;
    for (let s = 0; s < 90 && !fromDouble; s++) {
      steps(w, 1);
      for (let k = 0; k < w.pr.n; k++) {
        if (w.pr.kind[k] !== PK_ARROW) continue;
        const d = Math.hypot(w.pr.ox[k] - p.x, w.pr.oy[k] - p.y);
        if (d > 30 && d < 60 && w.pr.life[k] > 1.1) fromDouble = true;
      }
    }
    expect(fromDouble).toBe(true);
  });

  it('B · The Balance cuts the hit you take and bursts into the enemies around you', () => {
    const w = only('balance', 1, 4, false);
    steps(w, 1);
    const p = w.player;
    const i = w.spawnEnemy(ENEMY_INDEX.brute, p.x + 100, p.y);
    const hp = w.en.hp[i];
    w.hurtPlayer(20);
    expect(p.maxHp - p.hp).toBeCloseTo(20 * w.stats.dmgTaken * 0.9);
    expect(w.en.hp[i]).toBeLessThan(hp);
  });

  it('M · The Miracle: the lower your health, the harder you hit', () => {
    const w = only('miracle', 1, 5, false);
    steps(w, 1);
    const full = w.dmgMul;
    w.player.hp = w.player.maxHp * 0.25;
    steps(w, 1);
    expect(w.dmgMul).toBeGreaterThan(full * 1.25);
  });

  it('every new Schrift runs at its Lv 7 attributes without breaking the world', { timeout: 60_000 }, () => {
    for (const id of ['glutton', 'jail', 'love', 'power', 'yourself', 'zombie']) {
      const def = POWER_BY_ID.get(id);
      for (const attr of def?.attributes ?? []) {
        const w = new World({ seed: 9, god: true, startTime: 420 });
        w.give(id, 6);
        w.chooseAttribute(id, attr.id);
        play(w, 25, sensible, bot);
        for (let i = 0; i < w.en.n; i++) {
          if (!Number.isFinite(w.en.x[i]) || !Number.isFinite(w.en.hp[i])) throw new Error(`${id}/${attr.id}: enemy ${i} broke`);
        }
        expect(w.zombieN).toBeGreaterThanOrEqual(0);
        expect(w.zombieN).toBeLessThanOrEqual(16);
      }
    }
  });
});
