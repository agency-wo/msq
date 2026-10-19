import { describe, expect, it } from 'vitest';
import { ENEMY_INDEX } from '../src/data/enemies';
import { POWER_BY_ID } from '../src/data/powers';
import { RESONANCE_BY_ID, RESONANCES } from '../src/data/resonances';
import { rewrite } from '../src/game/casts/almighty';
import { explodeBomb } from '../src/game/casts/schrift';
import { BOSS_REVERSAL } from '../src/game/casts/schrift2';
import { DOT_FIRE, PK_BOMB } from '../src/game/constants';
import { World } from '../src/game/world';

function steps(w: World, n: number): void {
  for (let i = 0; i < n; i++) {
    w.step(0, 0);
    w.pendingLevelUps = 0;
    w.pendingChests.length = 0;
  }
}

/** A world with exactly these powers and resonances and nothing spawning (god mode unless you need to be hurt). */
function build(powers: [string, number][], res: string[], god = true): World {
  const w = new World({ seed: 9, god });
  Object.assign(w as unknown as Record<string, unknown>, { spawnTick: () => undefined });
  w.powers.length = 0;
  w.pr.n = 0;
  w.stats.critChance = 0;
  for (const [id, level] of powers) {
    if (POWER_BY_ID.get(id)?.group === 'bankai') w.grantBankai(id);
    for (let k = w.powerLevel(id); k < level; k++) w.give(id, k + 1);
  }
  for (const id of res) w.addResonance(id);
  steps(w, 1);
  return w;
}

function post(w: World, dx: number, dy: number, hp: number, type = ENEMY_INDEX.brute): number {
  const i = w.spawnEnemy(type, w.player.x + dx, w.player.y + dy);
  w.en.spd[i] = 0;
  w.en.hp[i] = w.en.maxHp[i] = hp;
  return i;
}

/** One of The Explode's bombs going off right on top of enemy j. */
function blast(w: World, j: number): void {
  const b = w.spawnProjectile(PK_BOMB, 0, w.en.x[j], w.en.y[j], 0, 0, 1, 50, 8, 0, 0);
  w.pr.pa[b] = 60;
  explodeBomb(w, b);
}

describe('bonds from the story', () => {
  it('every new bond is a story resonance between the right pair', () => {
    const pairs: Record<string, [string, string]> = {
      bambietta: ['zombie', 'explode'],
      oldfriends: ['heat', 'balance'],
      kingsheart: ['heart', 'miracle'],
      successor: ['antithesis', 'almighty'],
    };
    for (const [id, [a, b]] of Object.entries(pairs)) {
      const r = RESONANCE_BY_ID.get(id);
      expect(r?.a, id).toBe(a);
      expect(r?.b, id).toBe(b);
      expect(r?.story, id).toBe(true);
    }
    expect(RESONANCES.length).toBe(22);
  });

  it('Risen Bambietta: The Explode infects what it hits, and what it kills rises', () => {
    const plain = build([['zombie', 7], ['explode', 7]], []);
    const a = post(plain, 120, 0, 1e6);
    steps(plain, 1);
    blast(plain, a);
    expect(plain.en.infT[a]).toBe(0);

    const w = build([['zombie', 7], ['explode', 7]], ['bambietta']);
    const tough = post(w, 120, 0, 1e6);
    const weak = post(w, -120, 0, 1);
    steps(w, 1);
    blast(w, tough);
    expect(w.en.infT[tough]).toBeGreaterThan(0);
    const risen = w.zombieN;
    blast(w, weak);
    expect(w.zombieN).toBe(risen + 1);
  });

  it('Old Friends: The Balance’s burst sets what it hits burning', () => {
    const w = build([['heat', 7], ['balance', 5]], ['oldfriends'], false);
    const near = post(w, 60, 0, 1e6);
    steps(w, 1);
    w.player.iframes = 0;
    w.hurtPlayer(10);
    expect(w.en.dotT[near]).toBeGreaterThan(0);
    expect(w.en.dotKind[near]).toBe(DOT_FIRE);

    const plain = build([['heat', 7], ['balance', 5]], [], false);
    const other = post(plain, 60, 0, 1e6);
    steps(plain, 1);
    plain.player.iframes = 0;
    plain.hurtPlayer(10);
    expect(plain.en.dotT[other]).toBe(0);
  });

  it('Heart of the King: the Heart beats below 45% health, twice as often, with The Miracle at its height', () => {
    const plain = build([['heart', 3], ['miracle', 5]], []);
    plain.player.hp = plain.player.maxHp * 0.4;
    steps(plain, 30);
    expect(plain.surgeT).toBe(0);

    const w = build([['heart', 3], ['miracle', 5]], ['kingsheart']);
    w.player.hp = w.player.maxHp * 0.4;
    steps(w, 30);
    expect(w.surgeT).toBeGreaterThan(0);
    const heart = w.power('heart');
    expect(heart?.timer).toBeCloseTo((heart?.stats.cooldown ?? 0) / 2, 0);
    // Healed back up by the beat, yet The Miracle counts you as all but fallen while it lasts.
    expect(w.player.hp).toBeGreaterThan(w.player.maxHp * 0.85);
    expect(w.dmgMul).toBeGreaterThanOrEqual(1 + w.miracleAmt - 1e-6);
  });

  it('The Successor: a rewritten future heals your wounds and turns their share onto everything on screen', () => {
    const run = (res: string[]): { hp: number; boss: number; w: World } => {
      const w = build([['antithesis', 7], ['almighty', 1]], res);
      const boss = post(w, 0, 200, 1e6, ENEMY_INDEX.bearer);
      w.player.hp = w.player.maxHp * 0.3;
      rewrite(w);
      return { hp: w.player.hp / w.player.maxHp, boss: 1e6 - w.en.hp[boss], w };
    };
    const plain = run([]);
    const heir = run(['successor']);
    expect(plain.hp).toBeCloseTo(0.3, 3);
    // Seventy percent was missing; at most half comes back.
    expect(heir.hp).toBeCloseTo(0.8, 3);
    expect(heir.boss - plain.boss).toBeCloseTo(1e6 * 0.5 * BOSS_REVERSAL * heir.w.dmgMul, -1);
  });
});
