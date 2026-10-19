import { describe, expect, it } from 'vitest';
import { ENEMY_INDEX } from '../src/data/enemies';
import { POWER_BY_ID } from '../src/data/powers';
import { RESONANCE_BY_ID } from '../src/data/resonances';
import { BOSS_REVERSAL } from '../src/game/casts/schrift2';
import { EB_BALA, PK_ARROW } from '../src/game/constants';
import type { PowerState } from '../src/game/powers';
import { World } from '../src/game/world';

function steps(w: World, n: number): void {
  for (let i = 0; i < n; i++) {
    w.step(0, 0);
    w.pendingLevelUps = 0;
    w.pendingChests.length = 0;
  }
}

/** A world you can be hurt in, with exactly these powers and resonances and nothing spawning. */
function build(powers: [string, number][], res: string[] = []): World {
  const w = new World({ seed: 3 });
  Object.assign(w as unknown as Record<string, unknown>, { spawnTick: () => undefined });
  w.powers.length = 0;
  w.pr.n = 0;
  w.stats.critChance = 0;
  for (const [id, level] of powers) for (let k = w.powerLevel(id); k < level; k++) w.give(id, k + 1);
  for (const id of res) w.addResonance(id);
  steps(w, 1);
  return w;
}

function antithesis(w: World): PowerState {
  const ps = w.powers.find((q) => q.def.id === 'antithesis');
  if (!ps) throw new Error('no Antithesis');
  return ps;
}

/** A target that never moves, with this much health. */
function post(w: World, dx: number, dy: number, hp: number, type = ENEMY_INDEX.brute): number {
  const i = w.spawnEnemy(type, w.player.x + dx, w.player.y + dy);
  w.en.spd[i] = 0;
  w.en.hp[i] = w.en.maxHp[i] = hp;
  return i;
}

/** Take a hit and return the health it cost. */
function hurt(w: World, amount: number): number {
  const before = w.player.hp;
  w.player.iframes = 0;
  w.hurtPlayer(amount);
  return before - w.player.hp;
}

describe('The Antithesis', () => {
  it('is the letter A that Uryū Ishida was given', () => {
    const def = POWER_BY_ID.get('antithesis');
    expect(def?.letter).toBe('A');
    expect(def?.credit).toBe('Uryū Ishida');
    expect(def?.group).toBe('schrift');
  });

  it('heals part of the wound and turns the same share of health onto the sturdiest enemies', () => {
    const w = build([['antithesis', 1]]);
    const weak = post(w, 150, 0, 1e6);
    const mid = post(w, -150, 0, 2e6);
    const big = post(w, 0, 150, 3e6);
    steps(w, 1);
    const lost = hurt(w, 20);
    expect(lost).toBeGreaterThan(0);
    const hp = w.player.hp;
    antithesis(w).timer = 0;
    steps(w, 1);
    const share = (lost / w.player.maxHp) * 1.5;
    expect(w.player.hp).toBeCloseTo(hp + lost * 0.5, 3);
    expect(3e6 - w.en.hp[big]).toBeCloseTo(3e6 * share * w.dmgMul, -1);
    expect(2e6 - w.en.hp[mid]).toBeCloseTo(2e6 * share * w.dmgMul, -1);
    expect(w.en.hp[weak]).toBe(1e6);
    // The wound was turned back: the next reversal has nothing to turn.
    expect(w.takenSince).toBe(0);
  });

  it('turns back a smaller share onto bosses', () => {
    const w = build([['antithesis', 1]]);
    const boss = post(w, 160, 0, 4e6, ENEMY_INDEX.bearer);
    steps(w, 1);
    const lost = hurt(w, 20);
    antithesis(w).timer = 0;
    steps(w, 1);
    expect(4e6 - w.en.hp[boss]).toBeCloseTo(4e6 * (lost / w.player.maxHp) * 1.5 * BOSS_REVERSAL * w.dmgMul, -1);
  });

  it('only counts wounds taken while you hold it, and pulses when you are unhurt', () => {
    const w = build([]);
    hurt(w, 30);
    w.give('antithesis', 1);
    const near = post(w, 60, 0, 1e6);
    const hp = w.player.hp;
    steps(w, 30);
    // No heal: the wound from before it was yours is not turned back.
    expect(w.player.hp).toBeCloseTo(hp, 3);
    expect(1e6 - w.en.hp[near]).toBeCloseTo((40 + 4 * w.level) * w.dmgMul, 1);
  });

  it('Mirror of Wounds reaches bosses in sight beyond its reach', () => {
    const w = build([['antithesis', 7]]);
    antithesis(w).attr = 'wounds';
    const boss = post(w, 0, 380, 4e6, ENEMY_INDEX.bearer);
    steps(w, 1);
    const lost = hurt(w, 20);
    antithesis(w).timer = 0;
    steps(w, 1);
    expect(4e6 - w.en.hp[boss]).toBeCloseTo(4e6 * (lost / w.player.maxHp) * 2 * BOSS_REVERSAL * w.dmgMul, -1);
  });

  it('Turnabout sends enemy fire back as your own', () => {
    const w = build([['antithesis', 7]]);
    const ps = antithesis(w);
    ps.attr = 'turnabout';
    const p = w.player;
    w.spawnEnemyBullet(EB_BALA, p.x + 150, p.y, -150, 0, 6, 9, 10);
    ps.timer = 0;
    steps(w, 1);
    expect(w.eb.n).toBe(0);
    const k = Array.from({ length: w.pr.n }, (_, i) => i).find((i) => w.pr.kind[i] === PK_ARROW);
    expect(k).toBeDefined();
    expect(w.pr.vx[k as number]).toBeGreaterThan(300);
  });

  it('Undo reverses more often and frees you from slows and binds', () => {
    const w = build([['antithesis', 7]]);
    const ps = antithesis(w);
    ps.attr = 'undo';
    w.player.slowT = 2;
    w.player.rootT = 1;
    ps.timer = 0;
    steps(w, 1);
    expect(w.player.slowT).toBe(0);
    expect(w.player.rootT).toBe(0);
    expect(ps.timer).toBeCloseTo((ps.stats.cooldown * (1 - w.stats.cdr)) / 1.4, 2);
  });
});

describe('The Scales Turned', () => {
  it('pairs The Antithesis with The Balance', () => {
    const r = RESONANCE_BY_ID.get('scales');
    expect(r?.a).toBe('antithesis');
    expect(r?.b).toBe('balance');
  });

  it('undoes a quarter of every wound at once and turns three times its share onto the nearest enemy', () => {
    const w = build([['antithesis', 7], ['balance', 5]], ['scales']);
    const near = post(w, 250, 0, 1e6);
    steps(w, 1);
    const hp = w.player.hp;
    w.player.iframes = 0;
    w.hurtPlayer(20);
    const healed = w.player.hp - hp;
    // What was taken, before the quarter came back.
    const lost = w.takenSince / 0.75;
    expect(lost).toBeGreaterThan(0);
    expect(healed).toBeCloseTo(-lost * 0.75, 3);
    expect(1e6 - w.en.hp[near]).toBeCloseTo(1e6 * (lost / w.player.maxHp) * 3 * w.dmgMul, -1);
  });

  it('is offered once The Antithesis is awakened and The Balance is full', () => {
    const offered = (w: World): boolean => {
      for (let k = 0; k < 200; k++) if (w.offers().some((o) => o.kind === 'resonance' && o.id === 'scales')) return true;
      return false;
    };
    expect(offered(build([['antithesis', 6], ['balance', 5]]))).toBe(false);
    expect(offered(build([['antithesis', 7], ['balance', 4]]))).toBe(false);
    expect(offered(build([['antithesis', 7], ['balance', 5]]))).toBe(true);
  });
});
