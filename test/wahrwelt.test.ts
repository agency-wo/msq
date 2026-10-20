import { describe, expect, it } from 'vitest';
import { CODEX_ENEMIES } from '../src/data/codex';
import { dailyFor } from '../src/data/daily';
import { ENEMY_INDEX } from '../src/data/enemies';
import { HERO_BY_ID, HERO_IDS, HERO_INFO } from '../src/data/heroes';
import { STAGES } from '../src/data/stages';
import { BOSS_LINES } from '../src/data/story';
import { EB_ARROW, EB_GETSUGA, EB_ICE, EB_SWORD, MF_FREEZE, MK_CERO, MK_ICE, MK_INK, MK_RAIN, MK_SILVER, MS_CIRCLE, MS_LINE } from '../src/game/constants';
import { ICHIGO_MASKED } from '../src/game/hostile';
import { bossSpriteName, enemySpriteName } from '../src/render/names';
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
const w0 = (): World => new World({ seed: 1, stage: 'wahrwelt' });

describe('Wahrwelt', () => {
  it('is opened by clearing the Soul King Palace, and opens Karakura Town after it', () => {
    expect(STAGES[STAGES.length - 2].id).toBe('wahrwelt');
    expect(STAGES.find((x) => x.id === 'karakura')?.unlockedBy).toBe('wahrwelt');
    const s = defaultSave();
    s.stages.seireitei.cleared = true;
    expect(stageUnlocked(s, 'wahrwelt')).toBe(false);
    s.stages.palace.cleared = true;
    expect(stageUnlocked(s, 'wahrwelt')).toBe(true);
  });

  it('brings all four defenders every run, each once, Aizen always last before Ichigo', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const w = new World({ seed, stage: 'wahrwelt', god: true });
      expect(w.bearers).toHaveLength(4);
      expect(new Set(w.bearers)).toEqual(new Set(HERO_IDS));
      expect(w.bearers[3]).toBe('aizen');
    }
    // The other three still come in a different order from run to run.
    const firsts = new Set(Array.from({ length: 30 }, (_, k) => new World({ seed: k + 1, stage: 'wahrwelt' }).bearers[0]));
    expect(firsts.size).toBe(3);
    // A forced defender goes first (testing switch) and nobody is lost.
    const forced = new World({ seed: 5, stage: 'wahrwelt', bearers: ['uryu'] });
    expect(forced.bearers[0]).toBe('uryu');
    expect(new Set(forced.bearers)).toEqual(new Set(HERO_IDS));
    const last = w0().stage.events.filter((e) => e.kind === 'boss').pop();
    expect(last?.kind === 'boss' && last.enemy).toBe('ichigo');
    for (const id of HERO_IDS) expect(BOSS_LINES[`heroes:${id}`]).toBeTruthy();
    expect(BOSS_LINES['boss:ichigo']).toBeTruthy();
  });

  it('never shows two defenders alike: name, title, warning, sprite and bankai form are all their own', { timeout: 60_000 }, () => {
    for (const key of ['name', 'title', 'warn'] as const) expect(new Set(HERO_INFO.map((h) => h[key])).size).toBe(HERO_INFO.length);
    const sprites = HERO_IDS.map((_, v) => enemySpriteName(ENEMY_INDEX.defender, v));
    expect(new Set(sprites).size).toBe(HERO_IDS.length);
    expect(bossSpriteName(ENEMY_INDEX.defender, hero('renji'), 1)).toBe('heroes_renji_bankai');
    expect(bossSpriteName(ENEMY_INDEX.defender, hero('rukia'), 1)).toBe('heroes_rukia_bankai');
    expect(bossSpriteName(ENEMY_INDEX.defender, hero('aizen'), 1)).toBe('heroes_aizen');
    // In a run, every defender that arrives carries its own name and title on the boss bar, and its own warning.
    const w = new World({ seed: 11, stage: 'wahrwelt', god: true });
    Object.assign(w as unknown as Record<string, unknown>, { spawnTick: () => undefined });
    const seen: string[] = [];
    const warned: string[] = [];
    for (let s = 0; s < 1090 * 60; s++) {
      w.step(0, 0);
      w.pendingLevelUps = 0;
      w.pendingChests.length = 0;
      for (const m of w.messages.splice(0)) if (HERO_INFO.some((h) => h.warn === m.text)) warned.push(m.text);
      if (w.boss.active && w.boss.type === ENEMY_INDEX.defender && !seen.includes(w.boss.name)) {
        const info = HERO_BY_ID.get(HERO_IDS[w.boss.variant]);
        expect(w.boss.name).toBe(info?.name);
        expect(w.boss.sub).toBe(info?.title);
        seen.push(w.boss.name);
        for (let i = 0; i < w.en.n; i++) if (w.en.type[i] === ENEMY_INDEX.defender && !w.en.dead[i]) w.killEnemy(i);
      }
    }
    expect(seen).toEqual(w.bearers.map((id) => HERO_BY_ID.get(id)?.name));
    expect(warned).toEqual(w.bearers.map((id) => HERO_BY_ID.get(id)?.warn));
  });

  it('shows Renji and Rukia in their bankai once they pass half health', () => {
    const { w, i } = arena(ENEMY_INDEX.defender, hero('rukia'));
    (w as unknown as { bossCount: number }).bossCount = 1;
    expect(w.phaseOf(i)).toBe(0);
    w.en.hp[i] = w.en.maxHp[i] * 0.4;
    steps(w, 1);
    expect(w.phaseOf(i)).toBe(1);
    expect(w.boss.phase).toBe(1);
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

  it('its Boss Rush brings all four defenders, Aizen last, then Ichigo', () => {
    const w = new World({ seed: 2, stage: 'wahrwelt', god: true, bossRush: true });
    const queue = (w as unknown as { rushQueue: { kind: string; enemy?: string; final?: boolean; tier?: number }[][] }).rushQueue;
    expect(queue).toHaveLength(5);
    expect(queue.map((wave) => wave.find((e) => e.kind === 'bearer')?.tier ?? -1)).toEqual([0, 1, 2, 3, -1]);
    expect(w.bearers[3]).toBe('aizen');
    expect(queue[queue.length - 1].some((e) => e.kind === 'boss' && e.enemy === 'ichigo' && e.final)).toBe(true);
  });
});
