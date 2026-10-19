import { describe, expect, it } from 'vitest';
import { BANKAI_IDS } from '../src/data/bankai';
import { World } from '../src/game/world';

describe('medallion bearers and bankai', () => {
  it('draws three different bearers per run, the same ones for the same seed', () => {
    for (let seed = 1; seed < 60; seed++) {
      const a = new World({ seed });
      expect(a.bearers).toHaveLength(3);
      expect(new Set(a.bearers).size).toBe(3);
      for (const id of a.bearers) expect(BANKAI_IDS).toContain(id);
      expect(new World({ seed }).bearers).toEqual(a.bearers);
    }
  });

  it('over many runs, every bankai a Sternritter stole shows up; Zanka no Tachi only comes from Yamamoto', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed < 80; seed++) for (const id of new World({ seed }).bearers) seen.add(id);
    expect(seen).toEqual(new Set(BANKAI_IDS.filter((id) => id !== 'zanka')));
  });

  it('honours forced bearers first (testing switch)', () => {
    const w = new World({ seed: 9, bearers: ['tengen', 'gonryo'] });
    expect(w.bearers.slice(0, 2)).toEqual(['tengen', 'gonryo']);
    expect(new Set(w.bearers).size).toBe(3);
  });

  it('a bearer that dies drops its own medallion and a black chest', () => {
    const w = new World({ seed: 4, bearers: ['hyorinmaru'] });
    const i = w.spawnEnemy(4, w.player.x + 300, w.player.y, false, 1);
    w.en.variant[i] = BANKAI_IDS.indexOf('hyorinmaru');
    w.killEnemy(i);
    const medallion = w.pickups.find((q) => q.kind === 'medallion');
    expect(medallion?.bankai).toBe('hyorinmaru');
    expect(w.pickups.some((q) => q.kind === 'chestBlack')).toBe(true);
  });

  it('walking over a medallion grants exactly that bankai, with no board to choose from', () => {
    const w = new World({ seed: 5 });
    w.addPickup('medallion', w.player.x, w.player.y, 'zanka');
    w.step(0, 0);
    expect(w.powers.some((ps) => ps.def.id === 'zanka' && ps.level === 1)).toBe(true);
    expect(w.pendingLevelUps).toBe(0);
    expect(w.pendingChests).toHaveLength(0);
    expect(w.banners.some((b) => b.kind === 'bankai' && b.title === 'Zanka no Tachi')).toBe(true);
  });

  it('every bankai runs for a while without breaking the world', () => {
    for (const id of BANKAI_IDS) {
      const w = new World({ seed: 11, god: true, startTime: 400 });
      w.grantBankai(id);
      for (let s = 0; s < 60 * 20; s++) {
        w.step(Math.cos(s / 50), Math.sin(s / 50));
        w.pendingLevelUps = 0;
        w.pendingChests.length = 0;
      }
      expect(w.kills).toBeGreaterThan(0);
      for (let i = 0; i < w.en.n; i++) expect(Number.isFinite(w.en.hp[i])).toBe(true);
    }
  });
});
