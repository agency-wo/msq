import { describe, expect, it } from 'vitest';
import { DT } from '../src/config';
import { BANKAI_IDS } from '../src/data/bankai';
import { ENEMY_INDEX } from '../src/data/enemies';
import { EB_BALA } from '../src/game/constants';
import { World } from '../src/game/world';
import { almightyUnlocked, defaultSave, migrate, recordRun } from '../src/save/save';

function steps(w: World, n: number): void {
  for (let i = 0; i < n; i++) {
    w.step(0, 0);
    w.pendingLevelUps = 0;
    w.pendingChests.length = 0;
  }
}

function find(w: World, uid: number): number {
  for (let k = 0; k < w.en.n; k++) if (w.en.uid[k] === uid) return k;
  return -1;
}

describe('A · The Almighty', () => {
  it('never shows up on the level-up board', () => {
    const w = new World({ seed: 1, almighty: true });
    for (let k = 0; k < 400; k++) {
      for (const o of w.offers()) expect('id' in o && o.id === 'almighty').toBe(false);
    }
  });

  it('awakens with the third Lv 7 Schrift, but only once unlocked', () => {
    const locked = new World({ seed: 2 });
    for (const id of ['heilig', 'xaxis', 'explode']) locked.give(id, 7);
    expect(locked.powerLevel('almighty')).toBe(0);

    const w = new World({ seed: 2, almighty: true });
    w.give('heilig', 7);
    w.give('xaxis', 7);
    expect(w.powerLevel('almighty')).toBe(0);
    w.give('explode', 7);
    expect(w.powerLevel('almighty')).toBe(1);
    expect(w.banners.some((b) => b.kind === 'almighty')).toBe(true);
    // Once per run.
    expect(w.grantAlmighty()).toBe(false);
  });

  it('stops time for everything, bosses included, then rewrites the future', () => {
    const w = new World({ seed: 3, god: true });
    w.powers.length = 0;
    w.pr.n = 0;
    w.grantAlmighty();
    const p = w.player;
    const a = w.spawnEnemy(ENEMY_INDEX.brute, p.x + 120, p.y);
    const boss = w.spawnEnemy(ENEMY_INDEX.bearer, p.x - 160, p.y, false, 4);
    const ua = w.en.uid[a];
    const ub = w.en.uid[boss];
    w.spawnEnemyBullet(EB_BALA, p.x + 200, p.y + 50, -100, 0, 6, 9, 10);
    // Wait for time to stop.
    for (let s = 0; s < 120 && w.almightyT <= 0; s++) steps(w, 1);
    expect(w.almightyT).toBeGreaterThan(0);
    const ax = w.en.x[find(w, ua)];
    const bx = w.en.x[find(w, ub)];
    const bulletX = w.eb.x[0];
    const bossHp = w.en.hp[find(w, ub)];
    steps(w, 30);
    expect(w.en.x[find(w, ua)]).toBe(ax);
    expect(w.en.x[find(w, ub)]).toBe(bx);
    expect(w.eb.x[0]).toBe(bulletX);
    // Time starts again: the bullet never happened, the brute is struck, the boss loses its share.
    steps(w, Math.round(1.2 / DT));
    expect(w.almightyT).toBeLessThanOrEqual(0);
    expect(w.eb.n).toBe(0);
    const j = find(w, ua);
    if (j >= 0) expect(w.en.hp[j]).toBeLessThan(w.en.maxHp[j]);
    const b = find(w, ub);
    expect(bossHp - w.en.hp[b]).toBeGreaterThanOrEqual(w.en.maxHp[b] * 0.05 - 1);
  });

  it('foresight: some hits simply never happen', () => {
    const w = new World({ seed: 4 });
    w.foresight = 1;
    w.hurtPlayer(30);
    expect(w.player.hp).toBe(w.player.maxHp);
  });

  it('the save remembers every bankai taken back, and all six unlock it', () => {
    const s = defaultSave();
    expect(almightyUnlocked(s)).toBe(false);
    const run = { stage: 'hueco' as const, time: 900, level: 50, kills: 5000, cleared: false, gold: 0 };
    expect(recordRun(s, { ...run, bankai: BANKAI_IDS.slice(0, 3) }).almighty).toBe(false);
    expect(recordRun(s, { ...run, bankai: BANKAI_IDS.slice(2, 5) }).almighty).toBe(false);
    expect(s.taken.length).toBe(5);
    expect(recordRun(s, { ...run, bankai: [BANKAI_IDS[5]] }).almighty).toBe(true);
    expect(almightyUnlocked(s)).toBe(true);
    // Only the run that completes the set reports the unlock.
    expect(recordRun(s, { ...run, bankai: [BANKAI_IDS[0]] }).almighty).toBe(false);
    // Junk in a save is dropped.
    expect(migrate({ taken: ['zanka', 'nope', 7] }).taken).toEqual(['zanka']);
  });
});
