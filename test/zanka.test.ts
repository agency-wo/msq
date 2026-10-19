import { describe, expect, it } from 'vitest';
import { ENEMY_INDEX } from '../src/data/enemies';
import { MK_FIRE, MK_INFERNO, MK_LANCE, MK_SEAL, MS_CIRCLE, MS_LINE } from '../src/game/constants';
import { World } from '../src/game/world';
import { bot, play, sensible } from './helpers';

/** A Seireitei world with no powers and nothing spawning, the Captain-Commander 150 units away. */
function arena(god = true): { w: World; i: number } {
  const w = new World({ seed: 3, stage: 'seireitei', god });
  Object.assign(w as unknown as Record<string, unknown>, { spawnTick: () => undefined });
  w.powers.length = 0;
  w.pr.n = 0;
  const i = w.spawnEnemy(ENEMY_INDEX.commander, w.player.x + 150, w.player.y, false, 40);
  w.en.spd[i] = 0;
  steps(w, 1);
  return { w, i };
}

function steps(w: World, n: number): void {
  for (let k = 0; k < n; k++) {
    w.step(0, 0);
    w.pendingLevelUps = 0;
    w.pendingChests.length = 0;
  }
}

function marks(w: World, kind: number, shape: number): number {
  let n = 0;
  for (let k = 0; k < w.marks.n; k++) if (w.marks.kind[k] === kind && w.marks.shape[k] === shape) n++;
  return n;
}

/** His next technique, `move`, right now. */
function act(w: World, i: number, move: number): void {
  w.marks.n = 0;
  w.en.atkT[i] = 0;
  w.en.variant[i] = move;
  steps(w, 1);
}

describe("Yamamoto's bankai", () => {
  it('keeps Zanka no Tachi above half health', () => {
    const { w, i } = arena();
    w.en.hp[i] = w.en.maxHp[i] * 0.55;
    steps(w, 5);
    expect(w.zankaStolen).toBe(false);
    expect(w.powers.some((ps) => ps.def.id === 'zanka')).toBe(false);
  });

  it('below half health the Emperor takes it, and it counts as a bankai taken back', () => {
    const { w, i } = arena();
    expect(w.almightyProgress()?.have).toBe(0);
    w.en.hp[i] = w.en.maxHp[i] * 0.49;
    steps(w, 1);
    expect(w.zankaStolen).toBe(true);
    expect(w.powers.some((ps) => ps.def.id === 'zanka')).toBe(true);
    expect(w.banners.some((b) => b.kind === 'bankai' && b.title === 'Zanka no Tachi')).toBe(true);
    expect(w.almightyProgress()?.have).toBe(1);
    // Only once.
    steps(w, 5);
    expect(w.powers.filter((ps) => ps.def.id === 'zanka').length).toBe(1);
  });

  it('without it his heat no longer burns, and the dead no longer rise', () => {
    const { w, i } = arena(false);
    const p = w.player;
    p.maxHp = p.hp = 1e6;
    // Right beside him: the heat burns while he has his bankai.
    w.en.x[i] = p.x + 60;
    w.en.atkT[i] = 99;
    p.iframes = 0;
    steps(w, 2);
    expect(p.hp).toBeLessThan(p.maxHp);
    w.en.hp[i] = w.en.maxHp[i] * 0.4;
    steps(w, 1);
    w.en.atkT[i] = 99;
    const hp = p.hp;
    p.iframes = 0;
    steps(w, 60);
    expect(p.hp).toBe(hp);
    // Every technique he has left, none of them raises the dead or draws a blade of fire.
    for (let move = 0; move < 3; move++) {
      act(w, i, move);
      expect(marks(w, MK_FIRE, MS_LINE)).toBe(0);
    }
    let dead = 0;
    for (let k = 0; k < w.en.n; k++) if (w.en.type[k] === ENEMY_INDEX.ashen) dead++;
    expect(dead).toBe(0);
  });

  it('fights on with Ennetsu Jigoku, Ikkotsu and Sōkotsu', () => {
    const { w, i } = arena();
    w.en.hp[i] = w.en.maxHp[i] * 0.4;
    steps(w, 1);
    act(w, i, 0);
    expect(marks(w, MK_INFERNO, MS_CIRCLE)).toBe(5);
    act(w, i, 1);
    expect(marks(w, MK_LANCE, MS_LINE)).toBe(1);
    expect(marks(w, MK_SEAL, MS_CIRCLE)).toBe(1);
    expect(w.en.kx[i]).toBeLessThan(-500);
    act(w, i, 2);
    expect(marks(w, MK_SEAL, MS_CIRCLE)).toBe(2);
  });

  it('a full Seireitei run ends with Zanka no Tachi in hand', { timeout: 300_000 }, () => {
    const w = new World({ seed: 7, stage: 'seireitei', god: true });
    play(w, w.stage.length + 240, sensible, bot);
    expect(w.over).toBe('victory');
    expect(w.powers.some((ps) => ps.def.id === 'zanka')).toBe(true);
  });
});
