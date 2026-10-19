import { describe, expect, it } from 'vitest';
import { DT } from '../src/config';
import { dailyFor, dateKey } from '../src/data/daily';
import { ENEMY_INDEX } from '../src/data/enemies';
import { FRAGMENT_IDS } from '../src/data/fragments';
import { ROYAL_IDS } from '../src/data/royal';
import { CHAPTER_BY_ID } from '../src/data/story';
import { MK_INK, MK_STEAM } from '../src/game/constants';
import { World } from '../src/game/world';
import { defaultSave, recordRun, stageUnlocked } from '../src/save/save';
import { chaptersAfter, chaptersBefore } from '../src/save/story';

function steps(w: World, n: number): void {
  for (let i = 0; i < n; i++) {
    w.step(0, 0);
    w.pendingLevelUps = 0;
    w.pendingChests.length = 0;
    w.pendingShrine = false;
  }
}

function alive(w: World, type: number): number[] {
  return Array.from({ length: w.en.n }, (_, i) => i).filter((i) => w.en.type[i] === type && !w.en.dead[i]);
}

function quiet(w: World): void {
  Object.assign(w as unknown as Record<string, unknown>, { spawnTick: () => undefined });
}

describe('the Soul King Palace', () => {
  it('opens once the Seireitei is cleared, and tells its own chapters', () => {
    const s = defaultSave();
    expect(stageUnlocked(s, 'palace')).toBe(false);
    recordRun(s, { stage: 'hueco', time: 1210, level: 90, kills: 9000, cleared: true, gold: 0 });
    recordRun(s, { stage: 'seireitei', time: 1210, level: 90, kills: 9000, cleared: true, gold: 0 });
    expect(stageUnlocked(s, 'palace')).toBe(true);
    expect(chaptersBefore(s, 'palace').map((c) => c.id)).toContain('palace');
    recordRun(s, { stage: 'palace', time: 1210, level: 90, kills: 9000, cleared: true, gold: 0 });
    expect(chaptersAfter(s).map((c) => c.id)).toContain('soulking');
    expect(CHAPTER_BY_ID.get('soulking')?.text.length).toBeGreaterThan(0);
  });

  it('three of the four Royal Guard stand in the way each run, and a guardian arrives at 5:00', () => {
    const w = new World({ seed: 3, god: true, stage: 'palace', startTime: 295 });
    expect(w.bearers).toHaveLength(3);
    expect(new Set(w.bearers).size).toBe(3);
    for (const id of w.bearers) expect(ROYAL_IDS).toContain(id);
    steps(w, Math.round(7 / DT));
    const guards = alive(w, ENEMY_INDEX.royal);
    expect(guards).toHaveLength(1);
    expect(ROYAL_IDS[w.en.variant[guards[0]]]).toBe(w.bearers[0]);
    expect(w.boss.active).toBe(true);
    expect(w.boss.sub.length).toBeGreaterThan(0);
  });

  it('a guardian leaves a Fragment of the Soul King you do not have, and walking over it grants it', () => {
    const w = new World({ seed: 4, god: true, stage: 'palace', bearers: ['oetsu'] });
    const i = w.spawnEnemy(ENEMY_INDEX.royal, w.player.x + 200, w.player.y, false, 1);
    w.en.variant[i] = ROYAL_IDS.indexOf('oetsu');
    w.killEnemy(i);
    const drop = w.pickups.find((q) => q.kind === 'fragment');
    expect(drop?.fragment).toBeDefined();
    expect(FRAGMENT_IDS).toContain(drop?.fragment);
    expect(w.pickups.some((q) => q.kind === 'chestBlack')).toBe(true);
    if (!drop) return;
    w.player.x = drop.x;
    w.player.y = drop.y;
    w.step(0, 0);
    expect(w.powers.some((ps) => ps.def.id === drop.fragment)).toBe(true);
    expect(w.banners.some((b) => b.kind === 'fragment')).toBe(true);
  });

  it('never drops the same fragment twice; with all three held, gold instead', () => {
    const w = new World({ seed: 5, god: true, stage: 'palace' });
    const seen = new Set<string>();
    for (let k = 0; k < 3; k++) {
      const i = w.spawnEnemy(ENEMY_INDEX.royal, w.player.x + 300, w.player.y, false, 1);
      w.killEnemy(i);
      const drop = w.pickups.filter((q) => q.kind === 'fragment').pop();
      expect(drop?.fragment).toBeDefined();
      seen.add(drop?.fragment ?? '');
      w.pickups.length = 0;
    }
    expect(seen.size).toBe(3);
    const i = w.spawnEnemy(ENEMY_INDEX.royal, w.player.x + 300, w.player.y, false, 1);
    w.killEnemy(i);
    expect(w.pickups.some((q) => q.kind === 'fragment')).toBe(false);
    expect(w.pickups.filter((q) => q.kind === 'chestBlack')).toHaveLength(2);
  });

  it('fragments are never offered as new cards, but level up like bankai', () => {
    const w = new World({ seed: 6, god: true, stage: 'palace' });
    for (let k = 0; k < 40; k++) expect(w.offers().some((o) => o.kind === 'power-new' && FRAGMENT_IDS.includes(o.id))).toBe(false);
    w.grantFragment('rightarm');
    let up = false;
    for (let k = 0; k < 60 && !up; k++) up = w.offers().some((o) => o.kind === 'power-up' && o.id === 'rightarm');
    expect(up).toBe(true);
  });

  it('the Right Arm stills everything near you and slows a boss', () => {
    const w = new World({ seed: 7, god: true, stage: 'palace' });
    w.powers.length = 0;
    quiet(w);
    w.grantFragment('rightarm');
    const minion = w.spawnEnemy(ENEMY_INDEX.sentinel, w.player.x + 80, w.player.y);
    w.en.maxHp[minion] = w.en.hp[minion] = 1e6;
    const boss = w.spawnEnemy(ENEMY_INDEX.royal, w.player.x - 80, w.player.y);
    w.en.maxHp[boss] = w.en.hp[boss] = 1e6;
    steps(w, Math.round(0.6 / DT));
    expect(w.en.freezeT[minion]).toBeGreaterThan(0);
    expect(w.en.slowT[boss]).toBeGreaterThan(0);
    expect(w.en.freezeT[boss]).toBe(0);
  });

  it('the Left Arm binds the sturdiest enemies near you and lays them open', () => {
    const w = new World({ seed: 8, god: true, stage: 'palace' });
    w.powers.length = 0;
    quiet(w);
    w.grantFragment('leftarm');
    const weak = w.spawnEnemy(ENEMY_INDEX.inkling, w.player.x + 60, w.player.y);
    const strong = [0, 1, 2].map((k) => {
      const i = w.spawnEnemy(ENEMY_INDEX.sentinel, w.player.x - 60 - k * 30, w.player.y);
      w.en.maxHp[i] = w.en.hp[i] = 1e5;
      return i;
    });
    w.en.maxHp[weak] = w.en.hp[weak] = 50;
    steps(w, Math.round(0.6 / DT));
    for (const i of strong) {
      expect(w.en.freezeT[i]).toBeGreaterThan(0);
      expect(w.en.vulnT[i]).toBeGreaterThan(0);
    }
    expect(w.en.vulnT[weak]).toBe(0);
  });

  it('the Heart beats when you are close to falling: health back, untouchable for a moment, then it waits', () => {
    const w = new World({ seed: 9, stage: 'palace' });
    w.grantFragment('heart');
    w.player.hp = w.player.maxHp * 0.2;
    steps(w, 30);
    expect(w.player.hp).toBeGreaterThan(w.player.maxHp * 0.6);
    expect(w.surgeT).toBeGreaterThan(0);
    const before = w.player.hp;
    w.hurtPlayer(50);
    expect(w.player.hp).toBe(before);
    w.player.hp = w.player.maxHp * 0.2;
    steps(w, 5);
    expect(w.player.hp).toBeLessThan(w.player.maxHp * 0.3);
  });

  it('an ink wisp splits into two inklings as it dies', () => {
    const w = new World({ seed: 10, god: true, stage: 'palace' });
    const i = w.spawnEnemy(ENEMY_INDEX.inkwisp, w.player.x + 150, w.player.y);
    w.killEnemy(i);
    expect(alive(w, ENEMY_INDEX.inkling)).toHaveLength(2);
  });

  it('a sentinel stands still to wind up, then lunges', () => {
    const w = new World({ seed: 11, god: true, stage: 'palace' });
    quiet(w);
    w.powers.length = 0;
    const i = w.spawnEnemy(ENEMY_INDEX.sentinel, w.player.x + 150, w.player.y);
    w.en.atkT[i] = 0;
    w.step(0, 0);
    expect(w.en.atk2T[i]).toBeGreaterThan(0);
    const x = w.en.x[i];
    w.step(0, 0);
    expect(w.en.x[i]).toBeCloseTo(x, 0);
    steps(w, Math.round(0.8 / DT));
    expect(Math.abs(w.en.kx[i])).toBeGreaterThan(0);
  });

  it('a royal attendant mends the enemies around it', () => {
    const w = new World({ seed: 12, god: true, stage: 'palace' });
    quiet(w);
    w.powers.length = 0;
    const a = w.spawnEnemy(ENEMY_INDEX.attendant, w.player.x + 120, w.player.y, true);
    const hurt = w.spawnEnemy(ENEMY_INDEX.sentinel, w.player.x + 160, w.player.y);
    w.en.hp[hurt] = w.en.maxHp[hurt] * 0.2;
    w.en.atkT[a] = 0;
    w.step(0, 0);
    expect(w.en.hp[hurt]).toBeGreaterThan(w.en.maxHp[hurt] * 0.4);
  });

  it("a weaver's thread holds you in place", () => {
    const w = new World({ seed: 13, stage: 'palace' });
    quiet(w);
    w.powers.length = 0;
    const i = w.spawnEnemy(ENEMY_INDEX.weaver, w.player.x + 180, w.player.y);
    w.en.atkT[i] = 0;
    let rooted = false;
    for (let k = 0; k < 120 && !rooted; k++) {
      w.step(0, 0);
      rooted = w.player.rootT > 0;
    }
    expect(rooted).toBe(true);
  });

  it('Ichimonji silences one attack for a while, then gives it back', () => {
    const w = new World({ seed: 14, god: true, stage: 'palace' });
    quiet(w);
    const name = w.sealPower(2);
    expect(name).toBe('Heilig Pfeil');
    w.pr.n = 0;
    const i = w.spawnEnemy(ENEMY_INDEX.inkwisp, w.player.x + 120, w.player.y);
    w.en.maxHp[i] = w.en.hp[i] = 1e6;
    w.en.spd[i] = 0;
    steps(w, Math.round(1.5 / DT));
    expect(w.dmgBy[0]).toBe(0);
    steps(w, Math.round(2.5 / DT));
    expect(w.sealSlot).toBe(-1);
    expect(w.dmgBy[0]).toBeGreaterThan(0);
  });

  it('Kirio sheds her bulk at half health: smaller and far faster', () => {
    const w = new World({ seed: 15, god: true, stage: 'palace' });
    const i = w.spawnEnemy(ENEMY_INDEX.royal, w.player.x + 200, w.player.y, false, 1);
    w.en.variant[i] = ROYAL_IDS.indexOf('kirio');
    const speed = w.en.spd[i];
    w.en.hp[i] = w.en.maxHp[i] * 0.4;
    w.step(0, 0);
    expect(w.en.r[i]).toBe(24);
    expect(w.en.spd[i]).toBeCloseTo(speed * 1.8);
  });

  it('every guardian fights back with its own attacks', () => {
    for (const id of ROYAL_IDS) {
      const w = new World({ seed: 16, god: true, stage: 'palace' });
      quiet(w);
      const i = w.spawnEnemy(ENEMY_INDEX.royal, w.player.x + 160, w.player.y, false, 1);
      w.en.variant[i] = ROYAL_IDS.indexOf(id);
      w.en.maxHp[i] = w.en.hp[i] = 1e7;
      let threats = 0;
      for (let k = 0; k < Math.round(4 / DT); k++) {
        w.step(0, 0);
        threats = Math.max(threats, w.marks.n + w.eb.n);
      }
      expect(threats, id).toBeGreaterThan(0);
    }
    const t = new World({ seed: 17, god: true, stage: 'palace' });
    const i = t.spawnEnemy(ENEMY_INDEX.royal, t.player.x + 160, t.player.y, false, 1);
    t.en.variant[i] = ROYAL_IDS.indexOf('tenjiro');
    t.en.maxHp[i] = t.en.hp[i] = 1e7;
    let steam = false;
    for (let k = 0; k < Math.round(4 / DT) && !steam; k++) {
      t.step(0, 0);
      for (let m = 0; m < t.marks.n; m++) if (t.marks.kind[m] === MK_STEAM) steam = true;
    }
    expect(steam).toBe(true);
  });

  it('Ichibē ends the stage: strokes of ink, his servants, and Ichimonji', () => {
    const w = new World({ seed: 18, god: true, stage: 'palace', startTime: 1195 });
    w.give('explode', 3);
    let ink = false;
    let sealed = false;
    for (let k = 0; k < Math.round(20 / DT); k++) {
      w.step(0, 0);
      w.pendingLevelUps = 0;
      w.pendingChests.length = 0;
      for (let m = 0; m < w.marks.n; m++) if (w.marks.kind[m] === MK_INK) ink = true;
      if (w.sealT > 0) sealed = true;
    }
    expect(alive(w, ENEMY_INDEX.ichibe).length).toBeGreaterThan(0);
    expect(w.boss.final).toBe(true);
    expect(ink).toBe(true);
    expect(sealed).toBe(true);
    expect(alive(w, ENEMY_INDEX.inkwisp).length + alive(w, ENEMY_INDEX.inkling).length).toBeGreaterThan(0);
  });

  it('the Daily Trial reaches the palace only for players who have', () => {
    const days = Array.from({ length: 60 }, (_, k) => dateKey(new Date(2026, 9, 1 + k)));
    expect(days.some((d) => dailyFor(d, true, true).stage === 'palace')).toBe(true);
    for (const d of days) {
      expect(dailyFor(d, true, false).stage).not.toBe('palace');
      const a = dailyFor(d, true, true);
      const b = dailyFor(d, true, false);
      expect({ ...a, stage: b.stage }).toEqual(b);
    }
  });
});
