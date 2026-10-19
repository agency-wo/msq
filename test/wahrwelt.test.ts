import { describe, expect, it } from 'vitest';
import { CODEX_ENEMIES } from '../src/data/codex';
import { dailyFor } from '../src/data/daily';
import { ENEMY_INDEX } from '../src/data/enemies';
import { HERO_IDS } from '../src/data/heroes';
import { STAGES } from '../src/data/stages';
import { BOSS_LINES } from '../src/data/story';
import { EB_ARROW, EB_GETSUGA, EB_ICE, EB_SWORD, MF_FREEZE, MK_CERO, MK_ICE, MK_INK, MK_RAIN, MK_SILVER, MS_CIRCLE, MS_LINE } from '../src/game/constants';
import { ICHIGO_MASKED } from '../src/game/hostile';
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

/** A quiet Wahrwelt (no powers, nothing spawning) with one boss 180 units to your right. */
function arena(type: number, variant = 0): { w: World; i: number } {
  const w = new World({ seed: 9, stage: 'wahrwelt', god: true });
  Object.assign(w as unknown as Record<string, unknown>, { spawnTick: () => undefined });
  w.powers.length = 0;
  w.pr.n = 0;
  const i = w.spawnEnemy(type, w.player.x + 180, w.player.y, false, 18);
  w.en.variant[i] = variant;
  w.en.spd[i] = 0;
  steps(w, 1);
  return { w, i };
}

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

function bullets(w: World, kind: number): number {
  let n = 0;
  for (let k = 0; k < w.eb.n; k++) if (w.eb.kind[k] === kind) n++;
  return n;
}

function alive(w: World, type: number): number {
  let n = 0;
  for (let k = 0; k < w.en.n; k++) if (w.en.type[k] === type && !w.en.dead[k]) n++;
  return n;
}

const hero = (id: string): number => HERO_IDS.indexOf(id);

describe('Wahrwelt', () => {
  it('is the last stage, opened by clearing the Soul King Palace', () => {
    expect(STAGES[STAGES.length - 1].id).toBe('wahrwelt');
    const s = defaultSave();
    s.stages.seireitei.cleared = true;
    expect(stageUnlocked(s, 'wahrwelt')).toBe(false);
    s.stages.palace.cleared = true;
    expect(stageUnlocked(s, 'wahrwelt')).toBe(true);
  });

  it('draws three of its four defenders each run, and ends with Ichigo', () => {
    const w = new World({ seed: 3, stage: 'wahrwelt', god: true });
    expect(new Set(w.bearers).size).toBe(3);
    for (const id of w.bearers) expect(HERO_IDS).toContain(id);
    const last = w.stage.events.filter((e) => e.kind === 'boss').pop();
    expect(last?.kind === 'boss' && last.enemy).toBe('ichigo');
    for (const id of HERO_IDS) expect(BOSS_LINES[`heroes:${id}`]).toBeTruthy();
    expect(BOSS_LINES['boss:ichigo']).toBeTruthy();
  });

  it('Renji: Zabimaru, fangs closing in, the bone cannon', () => {
    const { w, i } = arena(ENEMY_INDEX.defender, hero('renji'));
    act(w, i, 1);
    expect(bullets(w, EB_SWORD)).toBe(9);
    act(w, i, 2);
    expect(marks(w, MK_CERO, MS_LINE)).toBe(1);
    w.en.hp[i] = w.en.maxHp[i] * 0.4;
    steps(w, 1);
    act(w, i, 1);
    expect(bullets(w, EB_SWORD)).toBe(12);
  });

  it('Rukia: Tsukishiro and Hakuren, then Hakka no Togame freezes everything near her', () => {
    const { w, i } = arena(ENEMY_INDEX.defender, hero('rukia'));
    act(w, i, 0);
    expect(marks(w, MK_ICE, MS_CIRCLE, MF_FREEZE)).toBe(1);
    act(w, i, 1);
    expect(bullets(w, EB_ICE)).toBe(5);
    w.en.hp[i] = w.en.maxHp[i] * 0.4;
    steps(w, 1);
    act(w, i, 2);
    const k = Array.from({ length: w.marks.n }, (_, q) => q).find((q) => w.marks.kind[q] === MK_ICE);
    expect(w.marks.r[k as number]).toBe(210);
  });

  it('Uryū: volleys and Licht Regen; his Antithesis turns his wounds back once; the silver arrow silences The Almighty', () => {
    const { w, i } = arena(ENEMY_INDEX.defender, hero('uryu'));
    act(w, i, 0);
    expect(bullets(w, EB_ARROW)).toBe(5);
    act(w, i, 1);
    expect(marks(w, MK_RAIN, MS_CIRCLE)).toBe(9);
    w.en.hp[i] = w.en.maxHp[i] * 0.4;
    steps(w, 1);
    expect(w.en.hp[i] / w.en.maxHp[i]).toBeCloseTo(0.7, 2);
    // No Almighty to silence: a heavy arrow instead.
    act(w, i, 2);
    expect(marks(w, MK_SILVER)).toBe(0);
    w.grantAlmighty();
    act(w, i, 2);
    expect(marks(w, MK_SILVER, MS_LINE)).toBe(1);
    // Struck: it falls silent and rewrites nothing while it lasts.
    w.silver(8);
    expect(w.silverT).toBe(8);
    const almighty = w.power('almighty');
    if (!almighty) throw new Error('no Almighty');
    almighty.timer = 0;
    w.en.atkT[i] = 99;
    steps(w, 30);
    expect(w.almightyT).toBe(0);
    expect(w.silverT).toBeLessThan(8);
  });

  it('Aizen: Kyōka Suigetsu’s copies vanish at a touch, with time, or when he falls; Kurohitsugi closes around you', () => {
    const { w, i } = arena(ENEMY_INDEX.defender, hero('aizen'));
    act(w, i, 0);
    expect(alive(w, ENEMY_INDEX.mirage)).toBe(3);
    const kills = w.kills;
    let copy = -1;
    for (let k = 0; k < w.en.n; k++) if (w.en.type[k] === ENEMY_INDEX.mirage && !w.en.dead[k]) copy = k;
    w.killEnemy(copy);
    expect(w.kills).toBe(kills);
    expect(alive(w, ENEMY_INDEX.mirage)).toBe(2);
    w.en.atkT[i] = 99;
    steps(w, Math.round(9.5 * 60));
    w.en.atkT[i] = 0;
    w.bossMemo(i).move = 1;
    steps(w, 1);
    expect(alive(w, ENEMY_INDEX.mirage)).toBe(0);
    expect(marks(w, MK_INK, MS_LINE)).toBe(4);
    expect(marks(w, MK_INK, MS_CIRCLE)).toBe(1);
    act(w, i, 0);
    expect(alive(w, ENEMY_INDEX.mirage)).toBe(3);
    w.killEnemy(i);
    expect(alive(w, ENEMY_INDEX.mirage)).toBe(0);
  });

  it('Ichigo: Getsuga Tenshō, then his Hollow mask and three at a time', () => {
    const { w, i } = arena(ENEMY_INDEX.ichigo);
    act(w, i, 0);
    expect(bullets(w, EB_GETSUGA)).toBe(1);
    act(w, i, 1);
    expect(w.en.kx[i]).toBeLessThan(-500);
    w.en.kx[i] = w.en.ky[i] = 0;
    w.en.hp[i] = w.en.maxHp[i] * 0.4;
    steps(w, 1);
    expect(w.en.r[i]).toBe(ICHIGO_MASKED);
    expect(w.messages.some((m) => m.text.includes('Hollow mask'))).toBe(true);
    act(w, i, 0);
    expect(bullets(w, EB_GETSUGA)).toBe(3);
  });

  it('is in the Codex, the story and the Daily, without changing anyone else’s day', () => {
    const keys = CODEX_ENEMIES.map((e) => e.key);
    for (const id of HERO_IDS) expect(keys).toContain(`defender:${id}`);
    expect(keys).toContain('ichigo');
    expect(keys).not.toContain('mirage');
    const s = defaultSave();
    s.stages.palace.cleared = true;
    expect(chaptersBefore(s, 'wahrwelt').map((c) => c.id)).toContain('wahrwelt');
    recordRun(s, { stage: 'wahrwelt', time: 1210, level: 90, kills: 9000, cleared: true, gold: 0 });
    expect(chaptersAfter(s).map((c) => c.id)).toContain('oneworld');
    let n = 0;
    for (let d = 1; d <= 60; d++) {
      const date = `2026-12-${String((d % 28) + 1).padStart(2, '0')}`;
      expect(dailyFor(date, true, true, true, false)).toEqual(dailyFor(date, true, true, true));
      if (dailyFor(date, true, true, true, true).stage === 'wahrwelt') n++;
    }
    expect(n).toBeGreaterThan(0);
  });

  it('its Boss Rush ends with Ichigo', () => {
    const w = new World({ seed: 2, stage: 'wahrwelt', god: true, bossRush: true });
    const queue = (w as unknown as { rushQueue: { kind: string; enemy?: string; final?: boolean }[][] }).rushQueue;
    expect(queue[queue.length - 1].some((e) => e.kind === 'boss' && e.enemy === 'ichigo' && e.final)).toBe(true);
  });
});
