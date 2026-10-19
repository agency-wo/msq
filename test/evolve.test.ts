import { describe, expect, it } from 'vitest';
import { DT } from '../src/config';
import { World } from '../src/game/world';
import { defaultSave, migrate, recordRun } from '../src/save/save';

function steps(w: World, n: number): void {
  for (let i = 0; i < n; i++) {
    w.step(0, 0);
    w.pendingLevelUps = 0;
    w.pendingChests.length = 0;
  }
}

describe('the Emperor evolves', () => {
  it('a bankai taken back brings wings a moment later, with their own title card', () => {
    const w = new World({ seed: 1, god: true });
    expect(w.evolution).toBe(0);
    w.grantBankai('zanka');
    expect(w.evolution).toBe(0);
    w.banners.length = 0;
    steps(w, Math.round(3 / DT));
    expect(w.evolution).toBe(1);
    expect(w.banners.some((b) => b.kind === 'evolve' && b.title === 'Reishi Wings')).toBe(true);
  });

  it('three powers taken back open the eyes, and awakened Schrift count too', () => {
    const w = new World({ seed: 2, god: true });
    w.give('heilig', 7);
    w.give('explode', 7);
    steps(w, Math.round(3 / DT));
    expect(w.evolution).toBe(1);
    w.banners.length = 0;
    w.give('fear', 7);
    steps(w, Math.round(3 / DT));
    expect(w.evolution).toBe(2);
    expect(w.banners.some((b) => b.kind === 'evolve' && b.title === 'The Eyes Open')).toBe(true);
  });

  it('The Almighty brings the shadow, under its own title card', () => {
    const w = new World({ seed: 3, god: true });
    w.grantAlmighty();
    expect(w.banners.some((b) => b.kind === 'almighty')).toBe(true);
    w.banners.length = 0;
    steps(w, Math.round(3 / DT));
    expect(w.evolution).toBe(3);
    expect(w.banners.some((b) => b.kind === 'evolve')).toBe(false);
  });

  it('levelling up a power it already has does not count twice', () => {
    const w = new World({ seed: 4, god: true });
    w.grantBankai('zanka');
    w.addPower('zanka');
    w.addPower('zanka');
    steps(w, Math.round(3 / DT));
    expect(w.evolution).toBe(1);
  });

  it('the save remembers the furthest he has come', () => {
    const s = defaultSave();
    const run = { stage: 'hueco' as const, time: 100, level: 5, kills: 10, cleared: false, gold: 0 };
    recordRun(s, { ...run, evolution: 2 });
    recordRun(s, { ...run, evolution: 1 });
    expect(s.evolution).toBe(2);
    expect(migrate({ v: 1, evolution: 9 }).evolution).toBe(3);
    expect(migrate({ v: 1 }).evolution).toBe(0);
  });
});
