import { describe, expect, it } from 'vitest';
import { MASTERY_BACK, MASTERY_COSTS, masteryKey } from '../src/data/archives';
import { buyMastery, heldMastery, masteryLevel, masterySpent, metaMastery, metaPressure, switchMastery } from '../src/save/archives';
import { defaultSave, migrate } from '../src/save/save';

function rich() {
  const s = defaultSave();
  s.gold = 1_000_000;
  return s;
}

describe('Disciplines: one held at a time', () => {
  it('a second cannot be drilled while you hold one, and only one ever reaches the run', () => {
    const s = rich();
    while (buyMastery(s, 'heilig'));
    expect(masteryLevel(s, 'heilig')).toBe(MASTERY_COSTS.length);
    expect(buyMastery(s, 'seele')).toBe(false);
    expect(masteryLevel(s, 'seele')).toBe(0);
    expect(heldMastery(s)).toBe('heilig');
    expect(metaMastery(s)).toEqual({ heilig: MASTERY_COSTS.length });
  });

  it('switching forgets the one you hold, pays half of it back, and starts the new one at Lv 1', () => {
    const s = rich();
    for (let k = 0; k < 3; k++) buyMastery(s, 'heilig');
    const gold = s.gold;
    expect(switchMastery(s, 'xaxis')).toBe(true);
    expect(masteryLevel(s, 'heilig')).toBe(0);
    expect(masteryLevel(s, 'xaxis')).toBe(1);
    expect(heldMastery(s)).toBe('xaxis');
    expect(s.gold).toBe(gold + Math.floor(masterySpent(3) * MASTERY_BACK) - MASTERY_COSTS[0]);
  });

  it('a switch nobody can pay for changes nothing', () => {
    const s = defaultSave();
    s.gold = MASTERY_COSTS[0];
    buyMastery(s, 'heilig');
    expect(s.gold).toBe(0);
    expect(switchMastery(s, 'xaxis')).toBe(false);
    expect(heldMastery(s)).toBe('heilig');
  });

  it('survives a reload (it used to be forgotten), and an old save with several keeps its best and is paid back for the rest', () => {
    const s = rich();
    for (let k = 0; k < 4; k++) buyMastery(s, 'heilig');
    expect(masteryLevel(migrate(JSON.parse(JSON.stringify(s))), 'heilig')).toBe(4);

    const old = JSON.parse(JSON.stringify(defaultSave()));
    old.gold = 100;
    old.meta = { [masteryKey('heilig')]: 2, [masteryKey('xaxis')]: 5, [masteryKey('seele')]: 5, [masteryKey('nope')]: 3 };
    const back = migrate(old);
    // A tie goes to the first in the list of powers: Seele Schneider before The X-Axis.
    expect(heldMastery(back)).toBe('seele');
    expect(masteryLevel(back, 'seele')).toBe(5);
    expect(masteryLevel(back, 'xaxis')).toBe(0);
    expect(masteryLevel(back, 'heilig')).toBe(0);
    expect(back.gold).toBe(100 + masterySpent(2) + masterySpent(5));
    // Once settled, a reload pays nothing more.
    expect(migrate(JSON.parse(JSON.stringify(back))).gold).toBe(back.gold);
  });

  it('the world answers one Discipline, not every attack’s', () => {
    const s = rich();
    const before = metaPressure(s);
    while (buyMastery(s, 'heilig'));
    expect(metaPressure(s)).toBeGreaterThan(before);
  });
});
