import { describe, expect, it } from 'vitest';
import { ENEMY_INDEX } from '../src/data/enemies';
import { POWER_BY_ID } from '../src/data/powers';
import { BAMBIES_HASTE, RESONANCE_BY_ID, RESONANCES, resonanceParts } from '../src/data/resonances';
import { PK_ARROW } from '../src/game/constants';
import { World } from '../src/game/world';

function steps(w: World, n: number): void {
  for (let i = 0; i < n; i++) {
    w.step(0, 0);
    w.pendingLevelUps = 0;
    w.pendingChests.length = 0;
  }
}

/** A god-mode world with exactly these powers and resonances, nothing spawning. */
function build(powers: [string, number][], res: string[] = []): World {
  const w = new World({ seed: 12, god: true });
  Object.assign(w as unknown as Record<string, unknown>, { spawnTick: () => undefined });
  w.powers.length = 0;
  w.pr.n = 0;
  w.stats.critChance = 0;
  for (const [id, level] of powers) for (let k = w.powerLevel(id); k < level; k++) w.give(id, k + 1);
  for (const id of res) w.addResonance(id);
  steps(w, 1);
  return w;
}

function post(w: World, dx: number, dy: number): number {
  const i = w.spawnEnemy(ENEMY_INDEX.brute, w.player.x + dx, w.player.y + dy);
  w.en.spd[i] = 0;
  w.en.hp[i] = w.en.maxHp[i] = 1e7;
  return i;
}

function offered(w: World, id: string): boolean {
  for (let k = 0; k < 200; k++) if (w.offers().some((o) => o.kind === 'resonance' && o.id === id)) return true;
  return false;
}

const TRIOS: Record<string, [string, string, string]> = {
  bambies: ['explode', 'thunder', 'glutton'],
  schutzstaffel: ['xaxis', 'death', 'miracle'],
  arrowrain: ['heilig', 'seele', 'vollstandig'],
  soulking: ['rightarm', 'leftarm', 'heart'],
};

describe('resonances of three', () => {
  it('four trios, each three different powers whose owners belong together', () => {
    for (const [id, parts] of Object.entries(TRIOS)) {
      const r = RESONANCE_BY_ID.get(id);
      expect(r, id).toBeDefined();
      if (!r) continue;
      expect(resonanceParts(r)).toEqual(parts);
      expect(new Set(parts).size).toBe(3);
      for (const p of parts) expect(POWER_BY_ID.has(p), p).toBe(true);
      expect(r.letters.length).toBe(3);
    }
    // The Bambies and the Schutzstaffel are who the story says they are.
    expect(['explode', 'thunder', 'glutton'].map((p) => POWER_BY_ID.get(p)?.credit)).toEqual(['Bambietta Basterbine', 'Candice Catnipp', 'Liltotto Lamperd']);
    expect(['xaxis', 'death', 'miracle'].map((p) => POWER_BY_ID.get(p)?.credit)).toEqual(['Lille Barro', 'Askin Nakk Le Vaar', 'Gerard Valkyrie']);
    expect(RESONANCES.length).toBe(34);
  });

  it('is offered only once all three are strong enough', () => {
    expect(offered(build([['explode', 6], ['thunder', 6]]), 'bambies')).toBe(false);
    expect(offered(build([['explode', 6], ['thunder', 6], ['glutton', 5]]), 'bambies')).toBe(false);
    expect(offered(build([['explode', 6], ['thunder', 6], ['glutton', 6]]), 'bambies')).toBe(true);
  });

  it('names all three on its banner', () => {
    const w = build([['explode', 6], ['thunder', 6], ['glutton', 6]], ['bambies']);
    expect(w.banners.some((b) => b.title === 'The Bambies' && b.sub === 'The Explode + The Thunderbolt + The Glutton')).toBe(true);
  });

  it('the Bambies: when one strikes, the other two are ready sooner', () => {
    const w = build([['explode', 6], ['thunder', 6], ['glutton', 6]], ['bambies']);
    post(w, 120, 0);
    steps(w, 1);
    const explode = w.power('explode');
    const thunder = w.power('thunder');
    const glutton = w.power('glutton');
    if (!explode || !thunder || !glutton) throw new Error('missing');
    explode.timer = 0;
    thunder.timer = 5;
    glutton.timer = 5;
    steps(w, 1);
    // The Explode casts first in the step, so the others are hurried, then tick down as usual.
    expect(thunder.timer).toBeCloseTo(5 * (1 - BAMBIES_HASTE) - 1 / 60, 3);
    expect(glutton.timer).toBeCloseTo(5 * (1 - BAMBIES_HASTE) - 1 / 60, 3);
  });

  it('Schutzstaffel: The X-Axis and The Deathdealing hit harder the closer you are to falling', () => {
    const w = build([['xaxis', 6], ['death', 6], ['miracle', 5]], ['schutzstaffel']);
    const i = post(w, 150, 0);
    steps(w, 1);
    const hit = (id: string): number => {
      w.dmgSlot = w.powers.findIndex((ps) => ps.def.id === id);
      const before = w.en.hp[i];
      w.damageEnemy(i, 100, 0, w.player.x, w.player.y, true);
      return before - w.en.hp[i];
    };
    w.player.hp = w.player.maxHp * 0.1;
    expect(hit('xaxis') / hit('miracle')).toBeCloseTo(1.9, 3);
    expect(hit('death') / hit('miracle')).toBeCloseTo(1.9, 3);
    w.player.hp = w.player.maxHp;
    expect(hit('xaxis') / hit('miracle')).toBeCloseTo(1, 3);
    w.dmgSlot = 255;
  });

  it('Licht Regen: while Vollständig shines, arrows of light rain down', () => {
    const w = build([['heilig', 6], ['seele', 6], ['vollstandig', 5]], ['arrowrain']);
    // Out of Vollständig's own reach (it opens when enemies come within 150), inside the rain's.
    post(w, 230, 60);
    post(w, -230, -60);
    steps(w, 1);
    const voll = w.power('vollstandig');
    if (voll) voll.timer = 999;
    const slot = w.powers.findIndex((ps) => ps.def.id === 'heilig');
    const falling = (): number => {
      let n = 0;
      for (let k = 0; k < w.pr.n; k++) if (w.pr.kind[k] === PK_ARROW && w.pr.src[k] === slot && w.pr.vy[k] > 1000) n++;
      return n;
    };
    w.vollT = 0;
    steps(w, 30);
    expect(falling()).toBe(0);
    w.vollT = 3;
    steps(w, 30);
    expect(falling()).toBeGreaterThan(0);
  });

  it('the Soul King, whole: his pieces answer twice as often', () => {
    const plain = build([['rightarm', 3], ['leftarm', 3], ['heart', 3]]);
    const whole = build([['rightarm', 3], ['leftarm', 3], ['heart', 3]], ['soulking']);
    for (const w of [plain, whole]) {
      post(w, 80, 0);
      steps(w, 1);
      const arm = w.power('rightarm');
      if (arm) arm.timer = 0;
      steps(w, 1);
    }
    const a = plain.power('rightarm')?.timer ?? 0;
    const b = whole.power('rightarm')?.timer ?? 0;
    expect(a).toBeGreaterThan(1);
    expect(b).toBeCloseTo(a / 2, 3);
  });
});
