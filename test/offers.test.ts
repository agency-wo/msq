import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { PASSIVES } from '../src/data/passives';
import { POWER_MAX_LEVEL, POWERS } from '../src/data/powers';
import { RELICS } from '../src/data/relics';
import { generateOffers, rollRelics, type OfferInput } from '../src/game/offers';

function input(over: Partial<OfferInput> = {}): OfferInput {
  return { powers: [], passives: [], powerDefs: POWERS, passiveDefs: PASSIVES, maxPowers: 8, maxPassives: 6, ...over };
}

describe('level-up offers', () => {
  it('offers three distinct choices', () => {
    for (let seed = 1; seed < 200; seed++) {
      const offers = generateOffers(input({ powers: [{ id: 'arrow', level: 2 }] }), new Rng(seed));
      expect(offers).toHaveLength(3);
      const keys = offers.map((o) => `${o.kind}:${'id' in o ? o.id : ''}`);
      expect(new Set(keys).size).toBe(3);
    }
  });

  it('offers the Lv 7 attribute pick for a power at Lv 6, never a plain level-up', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed < 300; seed++) {
      for (const o of generateOffers(input({ powers: [{ id: 'arrow', level: POWER_MAX_LEVEL - 1 }] }), new Rng(seed))) {
        if ('id' in o && o.id === 'arrow') seen.add(o.kind);
      }
    }
    expect(seen).toEqual(new Set(['power-attr']));
  });

  it('never offers a maxed power or passive', () => {
    const powers = POWERS.map((p) => ({ id: p.id, level: POWER_MAX_LEVEL }));
    const passives = PASSIVES.map((p) => ({ id: p.id, level: p.max }));
    const offers = generateOffers(input({ powers, passives }), new Rng(7));
    expect(offers.map((o) => o.kind)).toEqual(['heal', 'gold']);
  });

  it('respects the power and passive slot limits', () => {
    const offers = generateOffers(input({ powers: [{ id: 'arrow', level: 1 }], maxPowers: 1, maxPassives: 0 }), new Rng(3));
    for (const o of offers) {
      expect(o.kind).not.toBe('power-new');
      expect(o.kind).not.toBe('passive');
    }
  });

  it('is deterministic for a given seed', () => {
    const a = generateOffers(input(), new Rng(42));
    const b = generateOffers(input(), new Rng(42));
    expect(a).toEqual(b);
  });
});

describe('relic chests', () => {
  it('black chests hold only legendaries while any are left', () => {
    for (let seed = 1; seed < 100; seed++) {
      for (const r of rollRelics(RELICS, new Set(), 'black', new Rng(seed))) expect(r.rarity).toBe('legendary');
    }
  });

  it('black chests fall back to rares once every legendary is owned', () => {
    const owned = new Set(RELICS.filter((r) => r.rarity === 'legendary').map((r) => r.id));
    const picks = rollRelics(RELICS, owned, 'black', new Rng(5));
    expect(picks.length).toBeGreaterThan(0);
    for (const r of picks) expect(r.rarity).toBe('rare');
  });

  it('never offers an owned relic', () => {
    const owned = new Set(RELICS.slice(0, RELICS.length - 2).map((r) => r.id));
    const picks = rollRelics(RELICS, owned, 'brown', new Rng(9));
    expect(picks).toHaveLength(2);
    for (const r of picks) expect(owned.has(r.id)).toBe(false);
  });
});
