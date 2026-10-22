import { describe, expect, it } from 'vitest';
import { GAUNTLET, GAUNTLET_GOLD, GAUNTLET_LEVELS_PER_BOSS, gauntletBosses } from '../src/data/gauntlet';
import { ARRANCAR_IDS } from '../src/data/arrancar';
import { BANKAI_IDS } from '../src/data/bankai';
import { ENEMY_INDEX } from '../src/data/enemies';
import { GOTEI_IDS } from '../src/data/gotei';
import { HERO_IDS } from '../src/data/heroes';
import { KARAKURA_IDS } from '../src/data/karakura';
import { ROYAL_IDS } from '../src/data/royal';
import { FLAG_BOSS } from '../src/game/constants';
import { World } from '../src/game/world';
import { defaultSave, gauntletOpen, migrate, recordGauntlet } from '../src/save/save';

const ROSTER: Record<string, readonly string[]> = {
  bearer: BANKAI_IDS,
  captain: BANKAI_IDS,
  royal: ROYAL_IDS,
  gotei: GOTEI_IDS,
  heroes: HERO_IDS,
  arrancar: ARRANCAR_IDS,
  karakura: KARAKURA_IDS,
};

/** Put down whatever boss stands, then let the Gauntlet bring the next. */
function clearBoss(w: World): void {
  for (let i = 0; i < w.en.n; i++) if (!w.en.dead[i] && w.en.flags[i] & FLAG_BOSS) w.killEnemy(i);
}

function steps(w: World, n: number): void {
  for (let k = 0; k < n && !w.over; k++) {
    w.step(0, 0);
    w.pendingLevelUps = 0;
    w.pendingChests.length = 0;
  }
}

describe('the Gauntlet', () => {
  it('fields every named enemy, each one real', () => {
    expect(gauntletBosses()).toBe(40);
    for (const t of GAUNTLET) {
      for (const b of t.bosses) {
        if ('enemy' in b) expect(ENEMY_INDEX[b.enemy], b.enemy).toBeGreaterThanOrEqual(0);
        else expect(ROSTER[b.roster]).toContain(b.id);
      }
    }
  });

  it('calls its bosses one after another, moves to the next tier on its own ground, and is won at the end', () => {
    const w = new World({ seed: 3, god: true, gauntlet: true });
    Object.assign(w as unknown as Record<string, unknown>, { spawnTick: () => undefined });
    expect(w.stage.id).toBe(GAUNTLET[0].stage);
    expect(w.pendingLevelUps).toBeGreaterThan(0);
    const seen = new Set<string>();
    for (let guard = 0; guard < 800 && !w.over; guard++) {
      steps(w, 30);
      seen.add(w.stage.id);
      expect(w.boss.active ? 1 : 0).toBeLessThanOrEqual(1);
      clearBoss(w);
    }
    expect(w.over).toBe('victory');
    expect(w.gauntletCleared).toBe(GAUNTLET.length);
    for (const t of GAUNTLET) expect(seen.has(t.stage)).toBe(true);
  });

  it('only a tier’s lord leaves chests and its spoil; every boss is a level-up', () => {
    const w = new World({ seed: 5, god: true, gauntlet: true });
    Object.assign(w as unknown as Record<string, unknown>, { spawnTick: () => undefined });
    const tier = GAUNTLET[0].bosses.length;
    for (let k = 0; k < tier; k++) {
      while (!w.boss.active) steps(w, 10);
      w.pickups.length = 0;
      clearBoss(w);
      const loot = w.pickups.filter((q) => q.kind === 'chestBlack' || q.kind === 'spoil').length;
      if (k < tier - 1) expect(loot, `boss ${k + 1}`).toBe(0);
      else expect(loot).toBeGreaterThan(0);
      expect(w.pendingLevelUps).toBe(GAUNTLET_LEVELS_PER_BOSS);
      steps(w, 1);
    }
  });

  it('a gifted level-up board is taken at the level you are; earned ones count up to it', () => {
    const w = new World({ seed: 2, god: true, gauntlet: true });
    expect(w.pendingLevelUps).toBeGreaterThan(1);
    expect(w.boardLevel()).toBe(1);
    w.takeLevelUp();
    expect(w.boardLevel()).toBe(1);
    Object.assign(w, { level: 7, pendingLevelUps: 3, earnedLevelUps: 2 });
    const seen: number[] = [];
    while (w.pendingLevelUps > 0) {
      seen.push(w.boardLevel());
      w.takeLevelUp();
    }
    expect(seen).toEqual([6, 7, 7]);
  });

  it('the Emperor’s Seal stops at ten bosses', () => {
    const w = new World({ seed: 8, stage: 'hueco', god: true });
    w.step(0, 0);
    const mul = w.dmgMul;
    w.addRelic('kaiser-seal');
    for (let k = 0; k < 14; k++) w.killEnemy(w.spawnEnemy(ENEMY_INDEX.bearer, w.player.x + 200, w.player.y, false, 1));
    expect(w.dmgMul / mul).toBeCloseTo(1.08 ** 10, 3);
  });

  it('pays each tier once, keeps the best and the fastest clear, opens after three stages', () => {
    const s = defaultSave();
    expect(gauntletOpen(s)).toBe(false);
    s.stages.hueco.cleared = s.stages.seireitei.cleared = s.stages.lasnoches.cleared = true;
    expect(gauntletOpen(s)).toBe(true);
    const a = recordGauntlet(s, 2, 600);
    expect(a.reward).toBe(GAUNTLET_GOLD * (1 + 2));
    expect(recordGauntlet(s, 2, 500).reward).toBe(0);
    const all = recordGauntlet(s, GAUNTLET.length, 1800);
    expect(all.newBest).toBe(true);
    expect(s.gauntlet).toEqual({ tiers: GAUNTLET.length, time: 1800 });
    expect(recordGauntlet(s, GAUNTLET.length, 1900).newBest).toBe(false);
    expect(migrate(JSON.parse(JSON.stringify(s))).gauntlet).toEqual({ tiers: GAUNTLET.length, time: 1800 });
    expect(migrate({ v: 1, gauntlet: { tiers: 99, time: -3 } }).gauntlet).toEqual({ tiers: GAUNTLET.length, time: 0 });
  });
});
