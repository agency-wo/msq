import { describe, expect, it } from 'vitest';
import { BANKAI_IDS } from '../src/data/bankai';
import { CODEX_ENEMIES } from '../src/data/codex';
import { ENEMY_INDEX, ENEMY_LIST } from '../src/data/enemies';
import { STAGES } from '../src/data/stages';
import { BOSS_LINES } from '../src/data/story';
import {
  EB_BALA,
  MF_FREEZE,
  MF_ROOT,
  MK_CERO,
  MK_ICE,
  MK_INK,
  MK_LANCE,
  MK_METEOR,
  MK_MISSILE,
  MK_SEAL,
  MK_SLASH,
  MK_STING,
  MK_SWORD,
  MS_CIRCLE,
  MS_LINE,
} from '../src/game/constants';
import { AYON_RAGE, NEL_RELEASED, OVERKILL_MAX, UNOHANA_DRAIN } from '../src/game/signatures';
import type { StageId } from '../src/data/stages';
import { World } from '../src/game/world';
import { bossSpriteName, enemySpriteName } from '../src/render/names';

function steps(w: World, n: number, mx = 0, my = 0): void {
  for (let i = 0; i < n; i++) {
    w.step(mx, my);
    w.pendingLevelUps = 0;
    w.pendingChests.length = 0;
  }
}

/** A quiet stage (no powers, nothing spawning) with one boss 180 units to your right. */
function arena(stage: StageId, type: number, variant = 0, god = true): { w: World; i: number } {
  const w = new World({ seed: 9, stage, god });
  Object.assign(w as unknown as Record<string, unknown>, { spawnTick: () => undefined });
  w.powers.length = 0;
  w.pr.n = 0;
  w.stats.critChance = 0;
  const i = w.spawnEnemy(type, w.player.x + 180, w.player.y, false, 18);
  w.en.variant[i] = variant;
  w.en.spd[i] = 0;
  (w as unknown as { bossCount: number }).bossCount = 1;
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

/** Make a boss's own art (Schrift or signature) due now, and let it act. */
function art(w: World, i: number): void {
  w.marks.n = 0;
  w.eb.n = 0;
  w.en.atkT[i] = 99;
  w.en.atk2T[i] = 99;
  w.bossMemo(i).t = w.t;
  steps(w, 1);
}

function marks(w: World, kind: number, shape?: number, flag?: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < w.marks.n; k++) {
    if (w.marks.kind[k] !== kind) continue;
    if (shape !== undefined && w.marks.shape[k] !== shape) continue;
    if (flag !== undefined && !(w.marks.flags[k] & flag)) continue;
    out.push(k);
  }
  return out;
}

function bullets(w: World, kind: number): number {
  let n = 0;
  for (let k = 0; k < w.eb.n; k++) if (w.eb.kind[k] === kind) n++;
  return n;
}

const bankai = (id: string): number => BANKAI_IDS.indexOf(id);

describe('every boss is its own', () => {
  it('no stage has a nameless boss left: each is a character with a line of its own', () => {
    const generic = ['Menos Grande', 'Vasto Lorde', 'Kidō Corps Commander'];
    for (const stage of STAGES) {
      for (const e of stage.events) {
        if (e.kind !== 'boss') continue;
        const def = ENEMY_LIST[ENEMY_INDEX[e.enemy]];
        expect(generic, stage.id).not.toContain(def.name);
        expect(BOSS_LINES[`boss:${e.enemy}`], e.enemy).toBeTruthy();
      }
    }
    const keys = CODEX_ENEMIES.map((c) => c.key);
    for (const id of ['ayon', 'nel', 'unohana']) expect(keys).toContain(id);
  });

  it('Ayon: fists where you stand, a charge, a roar of Bala; at half health its face splits and it hits three times', () => {
    const { w, i } = arena('hueco', ENEMY_INDEX.ayon);
    act(w, i, 0);
    expect(marks(w, MK_METEOR, MS_CIRCLE)).toHaveLength(1);
    act(w, i, 1);
    expect(marks(w, MK_SLASH, MS_LINE)).toHaveLength(1);
    expect(w.en.kx[i]).toBeLessThan(-500);
    w.en.kx[i] = w.en.ky[i] = 0;
    act(w, i, 2);
    expect(bullets(w, EB_BALA)).toBe(14);
    w.en.hp[i] = w.en.maxHp[i] * 0.4;
    steps(w, 1);
    expect(w.en.r[i]).toBe(AYON_RAGE);
    expect(w.phaseOf(i)).toBe(1);
    expect(w.messages.some((m) => m.text.includes('face splits'))).toBe(true);
    act(w, i, 0);
    expect(marks(w, MK_METEOR, MS_CIRCLE)).toHaveLength(3);
    expect(bossSpriteName(ENEMY_INDEX.ayon, 0, 1)).toBe('ayon_rage');
  });

  it('Neliel: Cero Doble spits back what she swallowed, Lanzador Verde, and Gamuza at half health', () => {
    const cero = (hurt: number): number => {
      const { w, i } = arena('hueco', ENEMY_INDEX.nel);
      act(w, i, 0);
      expect(w.bossMemo(i).u).toBeGreaterThan(w.t);
      w.en.hp[i] -= w.en.maxHp[i] * hurt;
      w.marks.n = 0;
      steps(w, Math.round(1.5 * 60));
      const k = marks(w, MK_CERO, MS_LINE);
      expect(k).toHaveLength(1);
      return w.marks.r[k[0]];
    };
    expect(cero(0)).toBe(40);
    expect(cero(0.06)).toBeCloseTo(90, 0);
    const { w, i } = arena('hueco', ENEMY_INDEX.nel);
    act(w, i, 1);
    expect(marks(w, MK_LANCE, MS_LINE)).toHaveLength(1);
    w.en.hp[i] = w.en.maxHp[i] * 0.4;
    steps(w, 1);
    expect(w.en.r[i]).toBe(NEL_RELEASED);
    expect(w.messages.some((m) => m.text.includes('Gamuza'))).toBe(true);
    act(w, i, 1);
    expect(marks(w, MK_LANCE, MS_LINE)).toHaveLength(2);
    expect(bossSpriteName(ENEMY_INDEX.nel, 0, 1)).toBe('nel_gamuza');
  });

  it('Unohana: Minazuki closes her soldiers’ wounds, her Bakudō pins you; as the first Kenpachi her cuts heal her', () => {
    const { w, i } = arena('seireitei', ENEMY_INDEX.unohana);
    const soldier = w.spawnEnemy(ENEMY_INDEX.guard, w.en.x[i] + 40, w.en.y[i]);
    w.en.spd[soldier] = 0;
    w.en.hp[soldier] = w.en.maxHp[soldier] * 0.3;
    steps(w, 1);
    act(w, i, 0);
    expect(w.en.hp[soldier] / w.en.maxHp[soldier]).toBeCloseTo(0.8, 2);
    act(w, i, 1);
    expect(marks(w, MK_SEAL, MS_CIRCLE, MF_ROOT)).toHaveLength(1);
    // Mortal now, so a cut can land.
    const m = arena('seireitei', ENEMY_INDEX.unohana, 0, false);
    const p = m.w.player;
    p.maxHp = p.hp = 1e6;
    m.w.en.hp[m.i] = m.w.en.maxHp[m.i] * 0.4;
    steps(m.w, 1);
    expect(m.w.bossMemo(m.i).phase).toBe(1);
    expect(m.w.messages.some((q) => q.text.includes('first Kenpachi'))).toBe(true);
    act(m.w, m.i, 0);
    m.w.en.kx[m.i] = m.w.en.ky[m.i] = 0;
    const before = m.w.en.hp[m.i];
    steps(m.w, Math.round(0.6 * 60));
    expect(p.hp).toBeLessThan(1e6);
    expect(m.w.en.hp[m.i] - before).toBeCloseTo(m.w.en.maxHp[m.i] * UNOHANA_DRAIN, 0);
    expect(bossSpriteName(ENEMY_INDEX.unohana, 0, 1)).toBe('unohana_kenpachi');
  });
});

describe('the Sternritter fight with their own Schrift too', () => {
  it('Äs Nödt, The Fear: eight thorns close on you, and they hold you still', () => {
    const { w, i } = arena('hueco', ENEMY_INDEX.bearer, bankai('senbonzakura'));
    art(w, i);
    expect(marks(w, MK_INK, MS_LINE, MF_ROOT)).toHaveLength(8);
  });

  it('Cang Du, The Iron: his skin turns to iron, and blows barely mark it for a while', () => {
    const { w, i } = arena('hueco', ENEMY_INDEX.bearer, bankai('hyorinmaru'));
    w.en.hp[i] = w.en.maxHp[i];
    let hp = w.en.hp[i];
    w.damageEnemy(i, 100);
    const plain = hp - w.en.hp[i];
    art(w, i);
    expect(w.guarded(i)).toBe(true);
    hp = w.en.hp[i];
    w.damageEnemy(i, 100);
    expect(hp - w.en.hp[i]).toBeCloseTo(plain * 0.3, 3);
    steps(w, Math.round(3.2 * 60));
    expect(w.guarded(i)).toBe(false);
  });

  it('BG9, The Knowledge: the missiles fall where you are going', () => {
    const { w, i } = arena('hueco', ENEMY_INDEX.bearer, bankai('raikoben'));
    w.marks.n = 0;
    w.en.atkT[i] = 99;
    w.en.atk2T[i] = 99;
    w.bossMemo(i).t = w.t;
    steps(w, 1, 0, 1);
    const k = marks(w, MK_MISSILE, MS_CIRCLE);
    expect(k).toHaveLength(3);
    for (const q of k) expect(w.marks.y[q]).toBeGreaterThan(w.player.y + 60);
  });

  it('Bambietta, The Explode: her bombs land all around you', () => {
    const { w, i } = arena('hueco', ENEMY_INDEX.bearer, bankai('tengen'));
    art(w, i);
    const k = marks(w, MK_METEOR, MS_CIRCLE);
    expect(k).toHaveLength(6);
    for (const q of k) expect(Math.hypot(w.marks.x[q] - w.player.x, w.marks.y[q] - w.player.y)).toBeLessThan(160);
  });

  it('Driscoll, The Overkill: every death near him makes him bigger and harder hitting, up to a limit', () => {
    const { w, i } = arena('hueco', ENEMY_INDEX.bearer, bankai('gonryo'));
    const dmg = w.en.dmg[i];
    const r = w.en.r[i];
    for (let k = 0; k < 20; k++) w.killEnemy(w.spawnEnemy(ENEMY_INDEX.hollow, w.en.x[i] + 30, w.en.y[i]));
    expect(w.bossMemo(i).n).toBe(20);
    expect(w.en.dmg[i]).toBeGreaterThan(dmg * 1.2);
    expect(w.en.r[i]).toBeGreaterThan(r + 2);
    // Far from him, a death feeds nothing.
    for (let k = 0; k < 5; k++) w.killEnemy(w.spawnEnemy(ENEMY_INDEX.hollow, w.en.x[i] + 900, w.en.y[i]));
    expect(w.bossMemo(i).n).toBe(20);
    for (let k = 0; k < 60; k++) {
      steps(w, 1);
      w.killEnemy(w.spawnEnemy(ENEMY_INDEX.hollow, w.en.x[i] + 30, w.en.y[i]));
    }
    expect(w.bossMemo(i).n).toBe(OVERKILL_MAX);
    expect(w.messages.some((m) => m.text.includes('Driscoll grows'))).toBe(true);
  });
});

describe('the captains each have an art of their own', () => {
  it('Byakuya, Senkei: a ring of a thousand blades stands around you', () => {
    const { w, i } = arena('seireitei', ENEMY_INDEX.captain, bankai('senbonzakura'));
    art(w, i);
    const k = marks(w, MK_SWORD, MS_CIRCLE);
    expect(k).toHaveLength(14);
    for (const q of k) expect(Math.hypot(w.marks.x[q] - w.player.x, w.marks.y[q] - w.player.y)).toBeCloseTo(150, 0);
  });

  it('Hitsugaya, Hyōten Hyakkasō: flowers of ice fall and freeze', () => {
    const { w, i } = arena('seireitei', ENEMY_INDEX.captain, bankai('hyorinmaru'));
    art(w, i);
    expect(marks(w, MK_ICE, MS_CIRCLE, MF_FREEZE)).toHaveLength(8);
  });

  it('Suì-Fēng, Nigeki Kessatsu: the first sting marks you, the second on the mark strikes three times as hard', () => {
    const { w, i } = arena('seireitei', ENEMY_INDEX.captain, bankai('raikoben'));
    art(w, i);
    expect(marks(w, MK_STING, MS_LINE)).toHaveLength(1);
    expect(w.sting()).toBe(1);
    expect(w.homonkaT).toBe(6);
    expect(w.sting()).toBe(3);
    expect(w.homonkaT).toBe(0);
    // The mark fades if she does not strike again in time.
    w.sting();
    steps(w, Math.round(6.1 * 60));
    expect(w.homonkaT).toBeLessThanOrEqual(0);
  });

  it('Komamura: the giant’s blade comes down where you stand; Sasakibe: a thrust, and he is through it', () => {
    const k = arena('seireitei', ENEMY_INDEX.captain, bankai('tengen'));
    art(k.w, k.i);
    const blade = marks(k.w, MK_SWORD, MS_CIRCLE);
    expect(blade).toHaveLength(1);
    expect(k.w.marks.r[blade[0]]).toBe(100);
    const s = arena('seireitei', ENEMY_INDEX.captain, bankai('gonryo'));
    art(s.w, s.i);
    expect(marks(s.w, MK_LANCE, MS_LINE)).toHaveLength(1);
    expect(s.w.en.kx[s.i]).toBeLessThan(-500);
  });

  it('every new form has its own sprite', () => {
    expect(enemySpriteName(ENEMY_INDEX.ayon)).toBe('ayon');
    expect(enemySpriteName(ENEMY_INDEX.nel)).toBe('nel');
    expect(enemySpriteName(ENEMY_INDEX.unohana)).toBe('unohana');
  });
});
