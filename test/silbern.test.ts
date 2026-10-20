import { describe, expect, it } from 'vitest';
import { CODEX_ENEMIES } from '../src/data/codex';
import { dailyFor } from '../src/data/daily';
import { ENEMY_INDEX } from '../src/data/enemies';
import { GOTEI_IDS } from '../src/data/gotei';
import { STAGES } from '../src/data/stages';
import { BOSS_LINES } from '../src/data/story';
import {
  EB_WAVE,
  MF_INVERT,
  MF_ROOT,
  MK_GAS,
  MK_INK,
  MK_MIST,
  MK_SLASH,
  MK_STEAM,
  MK_SWORD,
  MK_THREAD,
  MS_ARC,
  MS_CIRCLE,
  MS_LINE,
} from '../src/game/constants';
import { World } from '../src/game/world';
import { defaultSave, recordRun, stageUnlocked } from '../src/save/save';
import { chaptersAfter, chaptersBefore } from '../src/save/story';

function steps(w: World, n: number, mx = 0, my = 0): void {
  for (let i = 0; i < n; i++) {
    w.step(mx, my);
    w.pendingLevelUps = 0;
    w.pendingChests.length = 0;
  }
}

/** A quiet Silbern world (no powers, nothing spawning) with one boss 180 units to your right. */
function arena(type: number, variant = 0, god = true): { w: World; i: number } {
  const w = new World({ seed: 8, stage: 'silbern', god });
  Object.assign(w as unknown as Record<string, unknown>, { spawnTick: () => undefined });
  w.powers.length = 0;
  w.pr.n = 0;
  const i = w.spawnEnemy(type, w.player.x + 180, w.player.y, false, 18);
  w.en.variant[i] = variant;
  w.en.spd[i] = 0;
  steps(w, 1);
  return { w, i };
}

/** The boss's next move, `move`, right now. */
function act(w: World, i: number, move: number): void {
  w.marks.n = 0;
  w.eb.n = 0;
  w.en.atkT[i] = 0;
  w.bossMemo(i).move = move;
  steps(w, 1);
}

function marks(w: World, kind: number, shape?: number, flag?: number): number {
  let n = 0;
  for (let k = 0; k < w.marks.n; k++) {
    if (w.marks.kind[k] !== kind) continue;
    if (shape !== undefined && w.marks.shape[k] !== shape) continue;
    if (flag !== undefined && !(w.marks.flags[k] & flag)) continue;
    n++;
  }
  return n;
}

function count(w: World, type: number): number {
  let n = 0;
  for (let k = 0; k < w.en.n; k++) if (w.en.type[k] === type && !w.en.dead[k]) n++;
  return n;
}

const captain = (id: string): number => GOTEI_IDS.indexOf(id);

describe('Silbern', () => {
  it('opens with the Palace once the Seireitei is cleared, and sits after it', () => {
    const ids = STAGES.map((s) => s.id);
    expect(ids.indexOf('silbern')).toBe(ids.indexOf('seireitei') + 1);
    const s = defaultSave();
    expect(stageUnlocked(s, 'silbern')).toBe(false);
    s.stages.seireitei.cleared = true;
    expect(stageUnlocked(s, 'silbern')).toBe(true);
    expect(stageUnlocked(s, 'palace')).toBe(true);
  });

  it('draws three of its four captains each run, and ends with the Captain-Commander', () => {
    const w = new World({ seed: 1, stage: 'silbern', god: true });
    expect(w.bearers.length).toBe(3);
    for (const id of w.bearers) expect(GOTEI_IDS).toContain(id);
    expect(new Set(w.bearers).size).toBe(3);
    const last = w.stage.events.filter((e) => e.kind === 'boss').pop();
    expect(last?.kind === 'boss' && last.enemy).toBe('kyoraku');
    for (const id of GOTEI_IDS) expect(BOSS_LINES[`gotei:${id}`]).toBeTruthy();
    expect(BOSS_LINES['boss:kyoraku']).toBeTruthy();
  });

  it('a captain is named on the boss bar and leaves a black chest and his spoil of war', () => {
    const { w, i } = arena(ENEMY_INDEX.gotei, captain('mayuri'));
    // Spawned by hand here, so count it the way the timeline would.
    (w as unknown as { bossCount: number }).bossCount = 1;
    steps(w, 1);
    expect(w.boss.name).toBe('Mayuri Kurotsuchi');
    expect(w.boss.sub).toBe('Captain of the 12th Division');
    w.killEnemy(i);
    expect(w.pickups.filter((q) => q.kind === 'chestBlack').length).toBe(1);
    expect(w.pickups.filter((q) => q.kind === 'spoil').map((q) => q.relic)).toEqual(['spoil-vial']);
  });

  it('Kenpachi: wild slashes and charges, then Kendō with both hands', () => {
    const { w, i } = arena(ENEMY_INDEX.gotei, captain('kenpachi'));
    act(w, i, 0);
    expect(marks(w, MK_SLASH, MS_ARC)).toBe(1);
    act(w, i, 1);
    expect(marks(w, MK_SLASH, MS_LINE)).toBe(1);
    expect(w.en.kx[i]).toBeLessThan(-500);
    w.en.kx[i] = w.en.ky[i] = 0;
    w.en.spd[i] = 40;
    w.en.hp[i] = w.en.maxHp[i] * 0.4;
    steps(w, 1);
    expect(w.en.spd[i]).toBeCloseTo(52, 0);
    act(w, i, 0);
    const k = Array.from({ length: w.marks.n }, (_, q) => q).find((q) => w.marks.kind[q] === MK_SLASH);
    expect(k).toBeDefined();
    expect(w.marks.r[k as number]).toBe(70);
  });

  it('Mayuri: thrusts that paralyze, poison gas, specimens, then Konjiki Ashisogi Jizō', () => {
    const { w, i } = arena(ENEMY_INDEX.gotei, captain('mayuri'));
    act(w, i, 0);
    expect(marks(w, 9 /* MK_LANCE */, MS_LINE, MF_ROOT)).toBe(1);
    act(w, i, 1);
    expect(marks(w, MK_GAS, MS_CIRCLE)).toBe(5);
    act(w, i, 2);
    expect(count(w, ENEMY_INDEX.specimen)).toBe(4);
    expect(count(w, ENEMY_INDEX.jizo)).toBe(0);
    w.en.hp[i] = w.en.maxHp[i] * 0.4;
    steps(w, 1);
    expect(count(w, ENEMY_INDEX.jizo)).toBe(1);
  });

  it("Shinji: Sakanade's mist turns you around; caught in it, every direction comes out backwards", () => {
    const { w, i } = arena(ENEMY_INDEX.gotei, captain('shinji'));
    act(w, i, 0);
    expect(marks(w, MK_MIST, MS_CIRCLE, MF_INVERT)).toBe(1);
    // Stand still in it until it lands.
    w.en.atkT[i] = 99;
    steps(w, Math.round(1.4 * 60));
    expect(w.invertT).toBeGreaterThan(0);
    const x = w.player.x;
    steps(w, 10, 1, 0);
    expect(w.player.x).toBeLessThan(x);
    // It wears off.
    steps(w, Math.round(3.2 * 60));
    expect(w.invertT).toBeLessThanOrEqual(0);
    const x2 = w.player.x;
    steps(w, 10, 1, 0);
    expect(w.player.x).toBeGreaterThan(x2);
  });

  it('Kensei: Tachikaze blades and bursts, more of each once Tekken Tachikaze is released', () => {
    const { w, i } = arena(ENEMY_INDEX.gotei, captain('kensei'));
    act(w, i, 0);
    expect(w.eb.n).toBe(5);
    act(w, i, 1);
    expect(marks(w, MK_STEAM, MS_CIRCLE)).toBe(3);
    w.en.hp[i] = w.en.maxHp[i] * 0.4;
    steps(w, 1);
    act(w, i, 0);
    expect(w.eb.n).toBe(7);
    act(w, i, 1);
    expect(marks(w, MK_STEAM, MS_CIRCLE)).toBe(5);
  });

  it("Kyōraku: Kageoni, Takaoni and Bushōgoma, then Karamatsu Shinjū's pool and threads", () => {
    const { w, i } = arena(ENEMY_INDEX.kyoraku);
    act(w, i, 0);
    expect(marks(w, MK_INK, MS_CIRCLE)).toBe(2);
    act(w, i, 1);
    expect(marks(w, MK_SWORD, MS_CIRCLE)).toBe(10);
    act(w, i, 2);
    let tops = 0;
    for (let k = 0; k < w.eb.n; k++) if (w.eb.kind[k] === EB_WAVE) tops++;
    expect(tops).toBe(18);
    w.en.hp[i] = w.en.maxHp[i] * 0.4;
    steps(w, 1);
    act(w, i, 3);
    expect(marks(w, MK_INK, MS_CIRCLE)).toBe(1);
    expect(marks(w, MK_THREAD, MS_LINE)).toBe(2);
  });

  it('a specimen bursts into poison as it dies; Jizō breathes it', () => {
    const { w } = arena(ENEMY_INDEX.specimen);
    w.marks.n = 0;
    const s = w.en.n - 1;
    w.killEnemy(s);
    expect(marks(w, MK_GAS, MS_CIRCLE)).toBe(1);
    const j = w.spawnEnemy(ENEMY_INDEX.jizo, w.player.x + 150, w.player.y);
    w.en.atkT[j] = 0;
    w.marks.n = 0;
    steps(w, 2);
    expect(marks(w, MK_GAS, MS_CIRCLE)).toBe(3);
  });

  it('is in the Codex, the story and the Daily, without changing anyone else’s day', () => {
    const keys = CODEX_ENEMIES.map((e) => e.key);
    for (const id of GOTEI_IDS) expect(keys).toContain(`gotei:${id}`);
    for (const id of ['brawler', 'specimen', 'jizo', 'kyoraku']) expect(keys).toContain(id);
    const s = defaultSave();
    s.stages.seireitei.cleared = true;
    expect(chaptersBefore(s, 'silbern').map((c) => c.id)).toContain('silbern');
    recordRun(s, { stage: 'silbern', time: 1210, level: 90, kills: 9000, cleared: true, gold: 0 });
    expect(chaptersAfter(s).map((c) => c.id)).toContain('games');
    let silbern = 0;
    for (let d = 1; d <= 60; d++) {
      const date = `2026-11-${String((d % 28) + 1).padStart(2, '0')}`;
      const before = dailyFor(date, true, true);
      expect(dailyFor(date, true, true, false)).toEqual(before);
      if (dailyFor(date, true, true, true).stage === 'silbern') silbern++;
    }
    expect(silbern).toBeGreaterThan(0);
  });

  it('its Boss Rush ends with the Captain-Commander', () => {
    const w = new World({ seed: 2, stage: 'silbern', god: true, bossRush: true });
    const queue = (w as unknown as { rushQueue: { kind: string; enemy?: string; final?: boolean }[][] }).rushQueue;
    expect(queue[queue.length - 1].some((e) => e.kind === 'boss' && e.enemy === 'kyoraku' && e.final)).toBe(true);
  });
});
