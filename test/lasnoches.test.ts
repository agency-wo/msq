import { describe, expect, it } from 'vitest';
import { ARRANCAR_IDS, ARRANCAR_INFO } from '../src/data/arrancar';
import { CODEX_ENEMIES } from '../src/data/codex';
import { dailyFor } from '../src/data/daily';
import { ENEMY_INDEX } from '../src/data/enemies';
import { STAGES } from '../src/data/stages';
import { BOSS_LINES } from '../src/data/story';
import { EB_BALA, EB_SWORD, EB_WAVE, FLAG_ZOMBIE, MK_CERO, MK_FIRE, MK_SLASH, MS_ARC, MS_LINE } from '../src/game/constants';
import { GRIMMJOW_RELEASED } from '../src/game/lasnoches';
import { spoilDamageMul, spoilShotTaken, spoilTick } from '../src/game/spoils';
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

/** A quiet Las Noches (no powers, nothing spawning) with one enemy 180 units to your right. */
function arena(type: number, variant = 0): { w: World; i: number } {
  const w = new World({ seed: 9, stage: 'lasnoches', god: true });
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

function marks(w: World, kind: number, shape?: number): number {
  let n = 0;
  for (let k = 0; k < w.marks.n; k++) if (w.marks.kind[k] === kind && (shape === undefined || w.marks.shape[k] === shape)) n++;
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

const arr = (id: string): number => ARRANCAR_IDS.indexOf(id);

function half(w: World, i: number): void {
  w.en.hp[i] = w.en.maxHp[i] * 0.4;
  steps(w, 1);
}

describe('Las Noches', () => {
  it('opens with the Seireitei when Hueco Mundo is cleared; three of four Arrancar a run, then Grimmjow', () => {
    const s = defaultSave();
    expect(stageUnlocked(s, 'lasnoches')).toBe(false);
    s.stages.hueco.cleared = true;
    expect(stageUnlocked(s, 'lasnoches')).toBe(true);
    const ids = STAGES.map((x) => x.id);
    expect(ids.indexOf('lasnoches')).toBeGreaterThan(ids.indexOf('hueco'));
    for (let seed = 1; seed <= 20; seed++) {
      const w = new World({ seed, stage: 'lasnoches' });
      expect(w.bearers).toHaveLength(3);
      expect(new Set(w.bearers).size).toBe(3);
      for (const id of w.bearers) expect(ARRANCAR_IDS).toContain(id);
    }
    const last = STAGES.find((x) => x.id === 'lasnoches')?.events.filter((e) => e.kind === 'boss').pop();
    expect(last?.kind === 'boss' && last.enemy).toBe('grimmjow');
    for (const id of ARRANCAR_IDS) expect(BOSS_LINES[`arrancar:${id}`]).toBeTruthy();
    expect(BOSS_LINES['boss:grimmjow']).toBeTruthy();
    for (const key of ['name', 'title', 'warn', 'release'] as const) expect(new Set(ARRANCAR_INFO.map((a) => a[key])).size).toBe(4);
    for (const id of ARRANCAR_IDS) {
      expect(enemySpriteName(ENEMY_INDEX.arrancar, arr(id))).toBe(`arrancar_${id}`);
      expect(bossSpriteName(ENEMY_INDEX.arrancar, arr(id), 1)).toBe(`arrancar_${id}_late`);
    }
  });

  it('Rudbornn: Árbol’s Calaveras rise around you, and while they stand close they take half of every blow', () => {
    const { w, i } = arena(ENEMY_INDEX.arrancar, arr('rudbornn'));
    act(w, i, 0);
    expect(alive(w, ENEMY_INDEX.exequias)).toBe(5);
    // Two of them beside him: he is shielded.
    for (const dy of [-30, 30]) {
      const j = w.spawnEnemy(ENEMY_INDEX.exequias, w.en.x[i], w.en.y[i] + dy);
      w.en.spd[j] = 0;
    }
    w.en.atkT[i] = 99;
    steps(w, 16);
    expect(w.guarded(i)).toBe(true);
    half(w, i);
    expect(w.messages.some((m) => m.text.includes('Árbol'))).toBe(true);
    act(w, i, 1);
    expect(marks(w, MK_CERO, MS_LINE)).toBe(1);
    act(w, i, 2);
    expect(marks(w, MK_SLASH, MS_LINE)).toBe(5);
  });

  it('Dordoni: Giralda’s whirlwinds, a drilling kick, a Cero', () => {
    const { w, i } = arena(ENEMY_INDEX.arrancar, arr('dordoni'));
    act(w, i, 0);
    expect(bullets(w, EB_WAVE)).toBe(2);
    act(w, i, 1);
    expect(marks(w, MK_SLASH, MS_LINE)).toBe(1);
    expect(w.en.kx[i]).toBeLessThan(-500);
    w.en.kx[i] = w.en.ky[i] = 0;
    act(w, i, 2);
    expect(marks(w, MK_CERO, MS_LINE)).toBe(1);
    half(w, i);
    act(w, i, 0);
    expect(bullets(w, EB_WAVE)).toBe(4);
  });

  it('Cirucci: the blade on its cord sweeps wide, goes out and comes back; released, three fans of feathers', () => {
    const { w, i } = arena(ENEMY_INDEX.arrancar, arr('cirucci'));
    act(w, i, 0);
    expect(marks(w, MK_SLASH, MS_ARC)).toBe(1);
    act(w, i, 1);
    expect(bullets(w, EB_SWORD)).toBe(7);
    act(w, i, 2);
    expect(marks(w, MK_SLASH, MS_LINE)).toBe(2);
    half(w, i);
    act(w, i, 1);
    expect(bullets(w, EB_SWORD)).toBe(21);
  });

  it('Gantenbainne: Dragon Rugir, claws, a charge; released, the fire comes three at a time', () => {
    const { w, i } = arena(ENEMY_INDEX.arrancar, arr('gantenbainne'));
    act(w, i, 0);
    expect(marks(w, MK_FIRE, MS_LINE)).toBe(1);
    act(w, i, 1);
    expect(marks(w, MK_SLASH, MS_ARC)).toBe(1);
    half(w, i);
    act(w, i, 0);
    expect(marks(w, MK_FIRE, MS_LINE)).toBe(3);
  });

  it('Grimmjow: Desgarrón, Garra de la Pantera, Sonído, Gran Rey Cero; then Pantera released', () => {
    const { w, i } = arena(ENEMY_INDEX.grimmjow);
    act(w, i, 0);
    expect(marks(w, MK_SLASH, MS_LINE)).toBe(5);
    act(w, i, 1);
    expect(bullets(w, EB_SWORD)).toBe(8);
    act(w, i, 2);
    expect(w.en.kx[i]).toBeLessThan(-500);
    w.en.kx[i] = w.en.ky[i] = 0;
    act(w, i, 3);
    expect(marks(w, MK_CERO, MS_LINE)).toBe(1);
    half(w, i);
    expect(w.en.r[i]).toBe(GRIMMJOW_RELEASED);
    expect(w.phaseOf(i)).toBe(1);
    expect(bossSpriteName(ENEMY_INDEX.grimmjow, 0, 1)).toBe('grimmjow_pantera');
    act(w, i, 0);
    expect(marks(w, MK_SLASH, MS_LINE)).toBe(10);
  });

  it('its swarm: the Exequias fire Bala, a Gillian warns its Cero in a long line', () => {
    const ex = arena(ENEMY_INDEX.exequias);
    ex.w.en.atkT[ex.i] = 0;
    steps(ex.w, 1);
    expect(bullets(ex.w, EB_BALA)).toBe(1);
    const gi = arena(ENEMY_INDEX.gillian);
    gi.w.en.atkT[gi.i] = 0;
    steps(gi.w, 1);
    expect(marks(gi.w, MK_CERO, MS_LINE)).toBe(1);
  });

  it('is in the Codex, the story and the Daily, without changing anyone else’s day', () => {
    const keys = CODEX_ENEMIES.map((e) => e.key);
    for (const id of ARRANCAR_IDS) expect(keys).toContain(`arrancar:${id}`);
    for (const id of ['grimmjow', 'numeros', 'exequias', 'gillian']) expect(keys).toContain(id);
    const s = defaultSave();
    s.stages.hueco.cleared = true;
    expect(chaptersBefore(s, 'lasnoches').map((c) => c.id)).toContain('lasnoches');
    recordRun(s, { stage: 'lasnoches', time: 1210, level: 90, kills: 9000, cleared: true, gold: 0 });
    expect(chaptersAfter(s).map((c) => c.id)).toContain('sexta');
    let n = 0;
    for (let d = 1; d <= 60; d++) {
      const date = `2027-01-${String((d % 28) + 1).padStart(2, '0')}`;
      expect(dailyFor(date, true, true, true, true, false)).toEqual(dailyFor(date, true, true, true, true));
      if (dailyFor(date, true, true, true, true, true).stage === 'lasnoches') n++;
    }
    expect(n).toBeGreaterThan(0);
  });

  it('its Boss Rush ends with Grimmjow', () => {
    const w = new World({ seed: 2, stage: 'lasnoches', god: true, bossRush: true });
    const queue = (w as unknown as { rushQueue: { kind: string; enemy?: string; final?: boolean }[][] }).rushQueue;
    expect(queue[queue.length - 1].some((e) => e.kind === 'boss' && e.enemy === 'grimmjow' && e.final)).toBe(true);
  });
});

describe('Las Noches’ spoils of war', () => {
  const quiet = (spoils: string[]): World => {
    const w = new World({ seed: 5, stage: 'lasnoches', god: true });
    Object.assign(w as unknown as Record<string, unknown>, { spawnTick: () => undefined });
    w.powers.length = 0;
    w.pr.n = 0;
    for (const id of spoils) w.takeSpoil(`spoil-${id}`);
    return w;
  };

  it('Rudbornn’s Skull Crest raises two Calaveras on your side', () => {
    const w = quiet(['calavera']);
    spoilTick(w, 15.01);
    let allies = 0;
    for (let k = 0; k < w.en.n; k++) if (w.en.type[k] === ENEMY_INDEX.exequias && w.en.flags[k] & FLAG_ZOMBIE && w.en.charmT[k] > 9) allies++;
    expect(allies).toBe(2);
  });

  it('Giralda’s Whirlwind throws back what comes close while you move', () => {
    const w = quiet(['giralda']);
    const j = w.spawnEnemy(ENEMY_INDEX.numeros, w.player.x + 40, w.player.y);
    w.en.hp[j] = w.en.maxHp[j] = 1e5;
    w.en.spd[j] = 0;
    steps(w, 30, -1, 0);
    expect(w.en.x[j] - w.player.x).toBeGreaterThan(70);
  });

  it('Dragra’s Scale cuts shots by 30%; Grimmjow’s Jawbone grows with the crowd around you', () => {
    expect(spoilShotTaken(quiet([]))).toBe(1);
    expect(spoilShotTaken(quiet(['dragra']))).toBe(0.7);
    const w = quiet(['pantera']);
    for (let k = 0; k < 10; k++) {
      const j = w.spawnEnemy(ENEMY_INDEX.numeros, w.player.x + 40 + k * 6, w.player.y);
      w.en.spd[j] = 0;
    }
    steps(w, 1);
    spoilTick(w, 0.3);
    expect(spoilDamageMul(w)).toBeCloseTo(1.2, 5);
  });
});
