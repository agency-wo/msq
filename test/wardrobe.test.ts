import { describe, expect, it } from 'vitest';
import { LOOKS, TRAILS } from '../src/data/looks';
import { defaultSave, migrate } from '../src/save/save';
import { evaluateFeats, FEATS } from '../src/save/feats';
import { buyLook, buyTrail, wardrobeAffordable, wearLook, wearTrail } from '../src/save/wardrobe';

describe('the Wardrobe', () => {
  it('sells five looks for gold, and keeps three for feats', () => {
    const sold = LOOKS.filter((l) => l.price !== undefined);
    expect(sold.map((l) => l.id)).toEqual(['schatten', 'blut', 'silbern', 'heilig', 'kaiser']);
    for (let k = 1; k < sold.length; k++) expect(sold[k].price ?? 0).toBeGreaterThan(sold[k - 1].price ?? 0);
    const featLooks = new Set(FEATS.map((f) => f.look).filter(Boolean));
    expect([...featLooks].sort()).toEqual(['crimson', 'gilded', 'white']);
    for (const id of featLooks) expect(LOOKS.find((l) => l.id === id)?.price).toBeUndefined();
  });

  it('buying a look spends its price and puts it on; feat looks cannot be bought', () => {
    const s = defaultSave();
    s.gold = 1000;
    expect(buyLook(s, 'blut')).toBe(true);
    expect(s.gold).toBe(0);
    expect(s.look).toBe('blut');
    expect(s.looks).toContain('blut');
    expect(buyLook(s, 'blut')).toBe(false);
    s.gold = 1e6;
    expect(buyLook(s, 'white')).toBe(false);
    expect(wearLook(s, 'white')).toBe(false);
    expect(wearLook(s, 'default')).toBe(true);
    expect(s.look).toBe('default');
  });

  it('trails: none is always worn for free, the rest are bought once and worn at will', () => {
    const s = defaultSave();
    expect(s.trails).toEqual(['none']);
    expect(s.trail).toBe('none');
    expect(wearTrail(s, 'gold')).toBe(false);
    s.gold = 600;
    expect(buyTrail(s, 'gold')).toBe(false);
    expect(buyTrail(s, 'reishi')).toBe(true);
    expect(s.gold).toBe(100);
    expect(s.trail).toBe('reishi');
    expect(wearTrail(s, 'none')).toBe(true);
    expect(s.trail).toBe('none');
    expect(buyTrail(s, 'reishi')).toBe(false);
    expect(TRAILS.every((t) => t.id === 'none' || t.price > 0)).toBe(true);
  });

  it('knows when something is affordable', () => {
    const s = defaultSave();
    expect(wardrobeAffordable(s)).toBe(false);
    s.gold = 500;
    expect(wardrobeAffordable(s)).toBe(true);
    s.gold = 1e6;
    for (const l of LOOKS) buyLook(s, l.id);
    for (const t of TRAILS) buyTrail(s, t.id);
    expect(wardrobeAffordable(s)).toBe(false);
  });

  it('feats still open their looks', () => {
    const s = defaultSave();
    s.totals.kills = 100_000;
    evaluateFeats(s);
    expect(s.looks).toContain('gilded');
  });

  it('repairs looks and trails in a broken save', () => {
    const s = migrate({ looks: ['blut', 'nope', 7, 'blut'], look: 'kaiser', trails: ['gold', 'nope', 'gold'], trail: 'blut' });
    expect(s.looks).toEqual(['default', 'blut']);
    expect(s.look).toBe('default');
    expect(s.trails).toEqual(['none', 'gold']);
    expect(s.trail).toBe('none');
    const ok = migrate({ looks: ['kaiser'], look: 'kaiser', trails: ['gold'], trail: 'gold' });
    expect(ok.look).toBe('kaiser');
    expect(ok.trail).toBe('gold');
  });
});
