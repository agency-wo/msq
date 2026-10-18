import { describe, expect, it } from 'vitest';
import { DT } from '../src/config';
import { DOT_POISON, EB_BALA, HOLD_FEAR, MF_ENEMY, MK_CERO, MS_LINE, ZK_POISON } from '../src/game/constants';
import { World } from '../src/game/world';

/** A world with no powers and no crits, so damage numbers are exact. */
function quiet(seed = 1, god = false): World {
  const w = new World({ seed, god });
  w.powers.length = 0;
  w.pr.n = 0;
  w.stats.critChance = 0;
  return w;
}

function steps(w: World, n: number): void {
  for (let i = 0; i < n; i++) {
    w.step(0, 0);
    w.pendingLevelUps = 0;
    w.pendingChests.length = 0;
  }
}

describe('status effects', () => {
  it('paralysis stops an enemy from moving; bosses ignore it', () => {
    const w = quiet();
    const i = w.spawnEnemy(0, w.player.x + 150, w.player.y);
    w.applyHold(i, 1, HOLD_FEAR);
    const uid = w.en.uid[i];
    const x0 = w.en.x[i];
    steps(w, 30);
    const j = [...Array(w.en.n).keys()].find((k) => w.en.uid[k] === uid) ?? -1;
    expect(Math.abs(w.en.x[j] - x0)).toBeLessThan(0.5);

    const b = w.spawnEnemy(6, w.player.x + 400, w.player.y);
    w.applyHold(b, 1, HOLD_FEAR);
    expect(w.en.freezeT[b]).toBe(0);
  });

  it('vulnerability multiplies the damage taken', () => {
    const w = quiet();
    const i = w.spawnEnemy(2, w.player.x + 200, w.player.y);
    const hp = w.en.hp[i];
    w.damageEnemy(i, 10);
    const plain = hp - w.en.hp[i];
    w.applyVuln(i, 1, 0.5);
    const before = w.en.hp[i];
    w.damageEnemy(i, 10);
    expect(before - w.en.hp[i]).toBeCloseTo(plain * 1.5);
  });

  it('damage over time ticks every half second', () => {
    const w = quiet();
    const i = w.spawnEnemy(2, w.player.x + 250, w.player.y);
    const uid = w.en.uid[i];
    const hp = w.en.hp[i];
    w.applyDot(i, 2, 10, DOT_POISON);
    steps(w, Math.round(1.05 / DT));
    const j = [...Array(w.en.n).keys()].find((k) => w.en.uid[k] === uid) ?? -1;
    // Two ticks of 5 in the first second.
    expect(hp - w.en.hp[j]).toBeCloseTo(10, 0);
  });
});

describe('zones and warnings', () => {
  it('a poison cloud damages enemies standing in it', () => {
    const w = quiet();
    const i = w.spawnEnemy(2, w.player.x + 260, w.player.y);
    const uid = w.en.uid[i];
    const hp = w.en.hp[i];
    w.spawnZone(ZK_POISON, w.en.x[i], w.en.y[i], 0, 0, 60, 3, 0.5, 4, 0);
    steps(w, 40);
    const j = [...Array(w.en.n).keys()].find((k) => w.en.uid[k] === uid) ?? -1;
    expect(w.en.hp[j]).toBeLessThan(hp);
  });

  it('a Cero hurts you only if you are inside its warned line', () => {
    const inside = quiet(2);
    inside.spawnMark(MK_CERO, MS_LINE, inside.player.x - 300, inside.player.y, 40, 600, 0, 0.1, 30, MF_ENEMY);
    steps(inside, 10);
    expect(inside.player.hp).toBeLessThan(inside.player.maxHp);

    const outside = quiet(2);
    outside.spawnMark(MK_CERO, MS_LINE, outside.player.x - 300, outside.player.y + 120, 40, 600, 0, 0.1, 30, MF_ENEMY);
    steps(outside, 10);
    expect(outside.player.hp).toBe(outside.player.maxHp);
  });
});

describe('enemy fire and defence', () => {
  it('two bullets arriving together only hurt once (invulnerability frames)', () => {
    const w = quiet(3);
    const p = w.player;
    w.spawnEnemyBullet(EB_BALA, p.x - 5, p.y, 300, 0, 6, 2, 10);
    w.spawnEnemyBullet(EB_BALA, p.x + 5, p.y, -300, 0, 6, 2, 10);
    steps(w, 2);
    expect(p.maxHp - p.hp).toBeCloseTo(10 * w.stats.dmgTaken);
  });

  it('The Iron blocks a hit, then has to recharge', () => {
    const w = quiet(4);
    w.give('iron', 1);
    steps(w, 30);
    expect(w.shieldCharges).toBe(1);
    w.hurtPlayer(25);
    expect(w.player.hp).toBe(w.player.maxHp);
    expect(w.shieldCharges).toBe(0);
    w.player.iframes = 0;
    w.hurtPlayer(25);
    expect(w.player.hp).toBeLessThan(w.player.maxHp);
  });

  it('Vollständig makes you untouchable while it lasts', () => {
    const w = quiet(5);
    w.vollT = 3;
    w.hurtPlayer(50);
    expect(w.player.hp).toBe(w.player.maxHp);
  });
});
