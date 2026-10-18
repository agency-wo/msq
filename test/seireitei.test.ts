import { describe, expect, it } from 'vitest';
import { DT } from '../src/config';
import { BANKAI_BY_ID, BANKAI_IDS } from '../src/data/bankai';
import { ENEMY_INDEX, ENEMY_LIST } from '../src/data/enemies';
import { EB_FIRE, MF_ENEMY, MF_ROOT, MK_FIRE, MK_INFERNO, MK_SEAL, MS_CIRCLE } from '../src/game/constants';
import { World } from '../src/game/world';
import { bot, play, sensible } from './helpers';

/** A Seireitei world with no powers, so nothing dies unless a test kills it. */
function quiet(seed = 1): World {
  const w = new World({ seed, stage: 'seireitei' });
  w.powers.length = 0;
  w.pr.n = 0;
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

describe('Seireitei', () => {
  it('spawns only Soul Reapers, and the stage curves make them tougher than Hollows', () => {
    const w = new World({ seed: 1, stage: 'seireitei', god: true });
    const seen = new Set<string>();
    play(w, 360, sensible, bot, (world) => {
      for (let i = 0; i < world.en.n; i++) seen.add(ENEMY_LIST[world.en.type[i]].id);
    });
    for (const id of seen) expect(ENEMY_LIST[ENEMY_INDEX[id as keyof typeof ENEMY_INDEX]].shinigami || id === 'bearer').toBe(true);
    for (const id of ['officer', 'flash', 'caster', 'guard']) expect(seen.has(id)).toBe(true);

    const hueco = new World({ seed: 1 });
    const a = hueco.spawnEnemy(ENEMY_INDEX.hollow, 300, 0);
    const b = w.spawnEnemy(ENEMY_INDEX.hollow, w.player.x + 300, w.player.y);
    // Same type, same moment in each run's clock would be equal; Seireitei adds its 1.3x on top.
    expect(w.en.maxHp[b] / ENEMY_LIST[0].hp).toBeGreaterThan(hueco.en.maxHp[a] / ENEMY_LIST[0].hp);
  });

  it('a flash-step scout blinks most of the way to you, never on top of you', () => {
    const w = quiet(2);
    const p = w.player;
    const i = w.spawnEnemy(ENEMY_INDEX.flash, p.x + 300, p.y);
    const uid = w.en.uid[i];
    w.en.atk2T[i] = 0.05;
    let minGap = Infinity;
    let jumped = false;
    let last = 300;
    for (let s = 0; s < 30; s++) {
      steps(w, 1);
      const j = find(w, uid);
      const d = Math.hypot(w.en.x[j] - p.x, w.en.y[j] - p.y);
      if (last - d > 50) jumped = true;
      last = d;
      minGap = Math.min(minGap, d);
    }
    expect(jumped).toBe(true);
    expect(minGap).toBeGreaterThan(55);
  });

  it('a Kidō caster holds its distance and fires at you', () => {
    const w = quiet(3);
    const p = w.player;
    const i = w.spawnEnemy(ENEMY_INDEX.caster, p.x + 120, p.y);
    const uid = w.en.uid[i];
    w.en.atkT[i] = 0.1;
    steps(w, 30);
    let fire = false;
    for (let k = 0; k < w.eb.n; k++) if (w.eb.kind[k] === EB_FIRE) fire = true;
    expect(fire).toBe(true);
    steps(w, Math.round(3 / DT));
    const j = find(w, uid);
    const d = Math.hypot(w.en.x[j] - p.x, w.en.y[j] - p.y);
    // It backed off from 120 and settled in its ring instead of walking into you.
    expect(d).toBeGreaterThan(140);
    expect(d).toBeLessThan(240);
  });

  it('the binding seal roots you if it lands, and does nothing if you stepped out', () => {
    const caught = quiet(4);
    const p = caught.player;
    caught.spawnMark(MK_SEAL, MS_CIRCLE, p.x, p.y, 62, 0, 0, 0.1, 10, MF_ENEMY | MF_ROOT);
    steps(caught, 8);
    expect(p.rootT).toBeGreaterThan(0.5);
    expect(p.hp).toBeLessThan(p.maxHp);
    const x0 = p.x;
    steps(caught, 20, 1, 0);
    expect(p.x).toBe(x0);
    steps(caught, Math.round(1 / DT), 1, 0);
    expect(p.x).toBeGreaterThan(x0);

    const free = quiet(4);
    free.spawnMark(MK_SEAL, MS_CIRCLE, free.player.x + 120, free.player.y, 62, 0, 0, 0.1, 10, MF_ENEMY | MF_ROOT);
    steps(free, 8);
    expect(free.player.rootT).toBe(0);
    expect(free.player.hp).toBe(free.player.maxHp);
  });

  it('the bankai bosses are the captains who own them, and Zanka no Tachi only comes at the end', () => {
    for (let seed = 1; seed < 60; seed++) expect(new World({ seed, stage: 'seireitei' }).bearers).not.toContain('zanka');
    const w = new World({ seed: 5, stage: 'seireitei', god: true, startTime: 298 });
    w.powers.length = 0;
    steps(w, Math.round(3 / DT));
    let captain = -1;
    for (let i = 0; i < w.en.n; i++) if (w.en.type[i] === ENEMY_INDEX.captain) captain = i;
    expect(captain).toBeGreaterThanOrEqual(0);
    const id = BANKAI_IDS[w.en.variant[captain]];
    expect(id).toBe(w.bearers[0]);
    const owner = BANKAI_BY_ID.get(id)?.owner ?? '';
    expect(w.boss.name).toBe(owner);
    // Hueco Mundo keeps its medallion bearers.
    const h = new World({ seed: 5, god: true, startTime: 298 });
    h.powers.length = 0;
    steps(h, Math.round(3 / DT));
    let types = 0;
    for (let i = 0; i < h.en.n; i++) if (h.en.type[i] === ENEMY_INDEX.bearer) types++;
    expect(types).toBe(1);
  });

  it('a fallen captain leaves its bankai and a black chest', () => {
    const w = quiet(6);
    const i = w.spawnEnemy(ENEMY_INDEX.captain, w.player.x + 300, w.player.y);
    w.en.variant[i] = BANKAI_IDS.indexOf('tengen');
    w.killEnemy(i);
    expect(w.pickups.some((q) => q.kind === 'medallion' && q.bankai === 'tengen')).toBe(true);
    expect(w.pickups.some((q) => q.kind === 'chestBlack')).toBe(true);
  });

  it('the Captain-Commander burns up close, sets fire around you and raises the dead', () => {
    const w = quiet(7);
    const p = w.player;
    // Standing in his heat would kill a normal Emperor in about 2.5 s: give this one room to watch.
    p.maxHp = p.hp = 1e6;
    w.spawnEnemy(ENEMY_INDEX.commander, p.x + 90, p.y, false, 40);
    let fire = false;
    let rose = 0;
    for (let s = 0; s < Math.round(12 / DT); s++) {
      steps(w, 1);
      for (let k = 0; k < w.marks.n; k++) if (w.marks.kind[k] === MK_FIRE || w.marks.kind[k] === MK_INFERNO) fire = true;
      let n = 0;
      for (let k = 0; k < w.en.n; k++) if (w.en.type[k] === ENEMY_INDEX.ashen) n++;
      rose = Math.max(rose, n);
    }
    expect(fire).toBe(true);
    expect(rose).toBeGreaterThanOrEqual(6);
    expect(p.hp).toBeLessThan(p.maxHp);
  });

  it('clears Seireitei: the captains fall, then the Captain-Commander, and the run ends in victory', { timeout: 300_000 }, () => {
    const w = new World({ seed: 7, stage: 'seireitei', god: true });
    const seen = new Set<string>();
    play(w, w.stage.length + 240, sensible, bot, (world) => {
      if (world.boss.active) seen.add(world.boss.name);
    });
    for (const id of w.bearers) expect(seen.has(BANKAI_BY_ID.get(id)?.owner ?? '?')).toBe(true);
    expect(seen.has('Genryūsai Yamamoto')).toBe(true);
    expect(w.over).toBe('victory');
    for (const id of w.bearers) expect(w.powers.some((ps) => ps.def.id === id)).toBe(true);
  });
});
