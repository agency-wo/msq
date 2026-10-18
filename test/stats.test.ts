import { describe, expect, it } from 'vitest';
import { CDR_CAP, DMG_TAKEN_FLOOR, computeStats, damageMultiplier, hitDamage, scaleMods } from '../src/game/stats';
import { xpForLevel, xpToNext } from '../src/game/xp';

describe('stats', () => {
  it('adds ATK percentages to the base 100 instead of compounding them', () => {
    // The worked example from the analysis: +12% and +20% make 132, not 134.
    const s = computeStats([{ atk: 12 }, { atk: 20 }]);
    expect(s.atk).toBe(132);
    expect(damageMultiplier(s)).toBeCloseTo(1.32);
  });

  it('stacks the damage bucket multiplicatively', () => {
    const s = computeStats([{ dmg: 0.2 }, { dmg: 0.5 }]);
    expect(s.dmgMult).toBeCloseTo(1.8);
  });

  it('applies crit only when the roll crits', () => {
    const s = computeStats([{ atk: 50, critMult: 0.5 }]);
    expect(hitDamage(10, s, false)).toBeCloseTo(15);
    expect(hitDamage(10, s, true)).toBeCloseTo(30);
  });

  it('caps cooldown reduction and floors damage taken', () => {
    const s = computeStats([{ cdr: 0.6 }, { cdr: 0.6 }, { dmgTaken: -2 }]);
    expect(s.cdr).toBe(CDR_CAP);
    expect(s.dmgTaken).toBe(DMG_TAKEN_FLOOR);
  });

  it('scales passive mods by level', () => {
    const m = scaleMods({ atk: 10, cdr: 0.05 }, 3);
    expect(m.atk).toBe(30);
    expect(m.cdr).toBeCloseTo(0.15);
  });
});

describe('xp curve', () => {
  it('starts quick and only ever gets steeper', () => {
    expect(xpToNext(1)).toBeLessThanOrEqual(12);
    for (let l = 1; l < 120; l++) expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l));
  });

  it('sums consistently', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(3)).toBe(xpToNext(1) + xpToNext(2));
  });
});
