import { describe, expect, it } from 'vitest';
import { UPGRADE_BY_ID } from '../src/data/archives';
import { GIFT_CODES, normalizeGiftCode } from '../src/data/gifts';
import { buyUpgrade, metaMods, metaRevives } from '../src/save/archives';
import { defaultSave, migrate, redeemGift } from '../src/save/save';

describe('gift codes', () => {
  it('a code pays its gold once per save, however it is typed', () => {
    const s = defaultSave();
    const out = redeemGift(s, ' kaiser 900k ');
    expect(out.ok).toBe(true);
    expect(s.gold).toBe(GIFT_CODES.KAISER900K.gold);
    expect(s.gifts).toEqual(['KAISER900K']);
    expect(redeemGift(s, 'KAISER900K')).toEqual({ ok: false, reason: 'used' });
    expect(s.gold).toBe(900_000);
    expect(redeemGift(s, 'NOT-A-CODE')).toEqual({ ok: false, reason: 'unknown' });
    expect(normalizeGiftCode('ab-1 c')).toBe('AB1C');
  });

  it('the save remembers redeemed codes, and forgets ones that do not exist', () => {
    expect(migrate({ gifts: ['KAISER900K', 'KAISER900K', 'MADE-UP', 7] }).gifts).toEqual(['KAISER900K']);
    expect(migrate({}).gifts).toEqual([]);
  });
});

describe('more training', () => {
  it('the new rows train what they say', () => {
    const s = defaultSave();
    s.gold = 1_000_000;
    for (const id of ['hardening', 'restoration', 'bogen', 'kirchenlied', 'mastery', 'volleys']) {
      expect(UPGRADE_BY_ID.has(id), id).toBe(true);
      while (buyUpgrade(s, id));
    }
    const m = metaMods(s);
    expect(m.dmgTaken).toBeCloseTo(-0.15);
    // Five levels each now (two more since the rows were added).
    expect(m.regen).toBeCloseTo(1.5);
    expect(m.projSpeed).toBeCloseTo(0.3);
    expect(m.duration).toBeCloseTo(0.25);
    expect(m.critMult).toBeCloseTo(0.75);
    expect(m.count).toBe(1);
  });

  it('Ransōtengai now has a second rise', () => {
    const s = defaultSave();
    s.gold = 100_000;
    while (buyUpgrade(s, 'ransotengai'));
    expect(metaRevives(s)).toBe(2);
  });
});
