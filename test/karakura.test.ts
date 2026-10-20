import { describe, expect, it } from 'vitest';
import { CODEX_ENEMIES } from '../src/data/codex';
import { dailyFor } from '../src/data/daily';
import { ENEMY_INDEX } from '../src/data/enemies';
import { KARAKURA_IDS, KARAKURA_INFO } from '../src/data/karakura';
import { STAGES } from '../src/data/stages';
import { BOSS_LINES } from '../src/data/story';
import { DOT_FIRE, EB_FIRE, EB_GETSUGA, MF_ROOT, MK_LANCE, MK_METEOR, MK_PILLAR, MK_SLASH, MK_THREAD, MS_CIRCLE, MS_LINE } from '../src/game/constants';
import { spoilChestChoices, spoilContactTaken, spoilTick } from '../src/game/spoils';
import { World } from '../src/game/world';
import { bossSpriteName, enemySpriteName } from '../src/render/names';
import { defaultSave, recordRun, stageUnlocked } from '../src/save/save';
import { chaptersAfter, chaptersBefore } from '../src/save/story';

function steps(w: World, n: number, mx = 0, my = 0): void {
  for (let i = 0; i < n; i++) {
    w.step(mx, my);
    w.pendingLevelUps = 0;
    w.pendingChests.length = 0;
  }
}

/** A quiet Karakura (no powers, nothing spawning) with one enemy 180 units to your right. */
function arena(type: number, variant = 0): { w: World; i: number } {
  const w = new World({ seed: 9, stage: 'karakura', god: true });
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
    if (w.marks.kind[k] !== kind || (shape !== undefined && w.marks.shape[k] !== shape)) continue;
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

const who = (id: string): number => KARAKURA_IDS.indexOf(id);

function half(w: World, i: number): void {
  w.en.hp[i] = w.en.maxHp[i] * 0.4;
  steps(w, 1);
}

describe('Karakura Town', () => {
  it('is the last stage, opened by clearing the Wahrwelt; three of four defenders a run, then Urahara', () => {
    expect(STAGES[STAGES.length - 1].id).toBe('karakura');
    const s = defaultSave();
    s.stages.palace.cleared = true;
    expect(stageUnlocked(s, 'karakura')).toBe(false);
    s.stages.wahrwelt.cleared = true;
    expect(stageUnlocked(s, 'karakura')).toBe(true);
    for (let seed = 1; seed <= 20; seed++) {
      const w = new World({ seed, stage: 'karakura' });
      expect(new Set(w.bearers).size).toBe(3);
      for (const id of w.bearers) expect(KARAKURA_IDS).toContain(id);
    }
    const last = STAGES[STAGES.length - 1].events.filter((e) => e.kind === 'boss').pop();
    expect(last?.kind === 'boss' && last.enemy).toBe('urahara');
    for (const id of KARAKURA_IDS) expect(BOSS_LINES[`karakura:${id}`]).toBeTruthy();
    expect(BOSS_LINES['boss:urahara']).toBeTruthy();
    for (const key of ['name', 'title', 'warn', 'late'] as const) expect(new Set(KARAKURA_INFO.map((k) => k[key])).size).toBe(4);
    for (const id of KARAKURA_IDS) {
      expect(enemySpriteName(ENEMY_INDEX.karakura, who(id))).toBe(`karakura_${id}`);
      expect(bossSpriteName(ENEMY_INDEX.karakura, who(id), 1)).toBe(`karakura_${id}_late`);
    }
    expect(bossSpriteName(ENEMY_INDEX.urahara, 0, 1)).toBe('urahara_bankai');
  });

  it('Chad: El Directo, La Muerte where you stand, the Giant’s arm raised as a shield', () => {
    const { w, i } = arena(ENEMY_INDEX.karakura, who('chad'));
    act(w, i, 0);
    expect(marks(w, MK_LANCE, MS_LINE)).toBe(1);
    act(w, i, 1);
    expect(marks(w, MK_METEOR, MS_CIRCLE)).toBe(1);
    act(w, i, 2);
    expect(w.guarded(i)).toBe(true);
    w.en.kx[i] = w.en.ky[i] = 0;
    half(w, i);
    act(w, i, 0);
    expect(marks(w, MK_LANCE, MS_LINE)).toBe(3);
  });

  it('Orihime: Koten Zanshun, Santen Kesshun’s shield, and Sōten Kisshun raising the fallen around her', () => {
    const { w, i } = arena(ENEMY_INDEX.karakura, who('orihime'));
    act(w, i, 0);
    expect(marks(w, MK_SLASH, MS_LINE)).toBe(1);
    act(w, i, 1);
    expect(w.guarded(i)).toBe(true);
    const before = w.en.n;
    act(w, i, 2);
    expect(w.en.n - before).toBe(8);
  });

  it('Yoruichi: she flash-steps to your side and strikes; Shunkō; lightning marching at you', () => {
    const { w, i } = arena(ENEMY_INDEX.karakura, who('yoruichi'));
    act(w, i, 0);
    expect(Math.hypot(w.en.x[i] - w.player.x, w.en.y[i] - w.player.y)).toBeLessThan(130);
    expect(marks(w, MK_SLASH, MS_CIRCLE)).toBe(1);
    act(w, i, 1);
    expect(marks(w, MK_PILLAR, MS_CIRCLE)).toBe(1);
    act(w, i, 2);
    expect(marks(w, MK_PILLAR, MS_CIRCLE)).toBe(4);
    half(w, i);
    act(w, i, 1);
    expect(marks(w, MK_PILLAR, MS_CIRCLE)).toBe(7);
  });

  it('Isshin: Getsuga Tenshō, and Engetsu’s fire laid in a wall across your path', () => {
    const { w, i } = arena(ENEMY_INDEX.karakura, who('isshin'));
    act(w, i, 0);
    expect(bullets(w, EB_GETSUGA)).toBe(1);
    const zones = w.zones.n;
    act(w, i, 1);
    expect(w.zones.n - zones).toBe(7);
    half(w, i);
    act(w, i, 0);
    expect(bullets(w, EB_GETSUGA)).toBe(3);
  });

  it('Urahara: Nake Benihime, Shibari Benihime, Raikōhō, Danku; his bankai remakes his wounds once', () => {
    const { w, i } = arena(ENEMY_INDEX.urahara);
    act(w, i, 0);
    expect(bullets(w, EB_FIRE)).toBe(5);
    act(w, i, 1);
    expect(marks(w, MK_THREAD, MS_CIRCLE, MF_ROOT)).toBe(1);
    act(w, i, 2);
    expect(marks(w, MK_LANCE, MS_LINE)).toBe(1);
    act(w, i, 3);
    expect(w.guarded(i)).toBe(true);
    w.en.hp[i] = w.en.maxHp[i] * 0.4;
    steps(w, 1);
    expect(w.en.hp[i] / w.en.maxHp[i]).toBeCloseTo(0.55, 2);
    expect(w.phaseOf(i)).toBe(1);
    expect(w.messages.some((m) => m.text.includes('Benihime Aratame'))).toBe(true);
    act(w, i, 3);
    expect(marks(w, MK_THREAD, MS_LINE)).toBe(3);
  });

  it('is in the Codex, the story and the Daily, without changing anyone else’s day; its Boss Rush ends with Urahara', () => {
    const keys = CODEX_ENEMIES.map((e) => e.key);
    for (const id of KARAKURA_IDS) expect(keys).toContain(`karakura:${id}`);
    for (const id of ['urahara', 'gigai', 'sentry']) expect(keys).toContain(id);
    const s = defaultSave();
    s.stages.wahrwelt.cleared = true;
    expect(chaptersBefore(s, 'karakura').map((c) => c.id)).toContain('karakura');
    recordRun(s, { stage: 'karakura', time: 1210, level: 90, kills: 9000, cleared: true, gold: 0 });
    expect(chaptersAfter(s).map((c) => c.id)).toContain('lastlight');
    let n = 0;
    for (let d = 1; d <= 70; d++) {
      const date = `2027-02-${String((d % 28) + 1).padStart(2, '0')}`;
      expect(dailyFor(date, true, true, true, true, true, false)).toEqual(dailyFor(date, true, true, true, true, true));
      if (dailyFor(date, true, true, true, true, true, true).stage === 'karakura') n++;
    }
    expect(n).toBeGreaterThan(0);
    const w = new World({ seed: 2, stage: 'karakura', god: true, bossRush: true });
    const queue = (w as unknown as { rushQueue: { kind: string; enemy?: string; final?: boolean }[][] }).rushQueue;
    expect(queue[queue.length - 1].some((e) => e.kind === 'boss' && e.enemy === 'urahara' && e.final)).toBe(true);
  });
});

describe('Karakura’s spoils of war', () => {
  const quiet = (spoils: string[]): World => {
    const w = new World({ seed: 5, stage: 'karakura', god: false });
    Object.assign(w as unknown as Record<string, unknown>, { spawnTick: () => undefined });
    w.powers.length = 0;
    w.pr.n = 0;
    for (const id of spoils) w.takeSpoil(`spoil-${id}`);
    return w;
  };

  it('the Giant’s arm cuts what touches you; Urahara’s hat adds a relic to every chest', () => {
    expect(spoilContactTaken(quiet([]))).toBe(1);
    expect(spoilContactTaken(quiet(['gigante']))).toBe(0.75);
    expect(spoilChestChoices(quiet([]))).toBe(3);
    const w = quiet(['hat']);
    expect(spoilChestChoices(w)).toBe(4);
    expect(w.relicChoices('brown')).toHaveLength(4);
  });

  it('Orihime’s hairpins heal back a third of a wound over 4 s', () => {
    const w = quiet(['rikka']);
    const p = w.player;
    p.hp = p.maxHp;
    p.iframes = 0;
    w.hurtPlayer(30);
    const hurt = p.hp;
    const lost = p.maxHp - hurt;
    spoilTick(w, 4.01);
    expect(p.hp - hurt).toBeCloseTo(lost / 3, 3);
  });

  it('Engetsu makes your fire burn twice as long and 30% hotter', () => {
    const plain = quiet([]);
    const w = quiet(['engetsu']);
    for (const world of [plain, w]) {
      const j = world.spawnEnemy(ENEMY_INDEX.gigai, world.player.x + 100, world.player.y);
      world.applyDot(j, 3, 10, DOT_FIRE);
    }
    const last = (x: World): number => x.en.n - 1;
    expect(w.en.dotT[last(w)]).toBeCloseTo(plain.en.dotT[last(plain)] * 2, 5);
    expect(w.en.dotDps[last(w)]).toBeCloseTo(plain.en.dotDps[last(plain)] * 1.3, 5);
  });
});
