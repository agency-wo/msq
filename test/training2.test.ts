import { describe, expect, it } from 'vitest';
import { UPGRADE_BY_ID } from '../src/data/archives';
import { MF_ENEMY, MS_CIRCLE, MK_METEOR } from '../src/game/constants';
import { World } from '../src/game/world';
import { buyUpgrade, metaBounty, metaMods, metaPassiveSlots, metaPowerSlots } from '../src/save/archives';
import { defaultSave } from '../src/save/save';

function trained(...ids: string[]) {
  const s = defaultSave();
  s.gold = 10_000_000;
  for (const id of ids) {
    expect(UPGRADE_BY_ID.has(id), id).toBe(true);
    while (buyUpgrade(s, id));
  }
  return s;
}

describe('training for an unpredictable war', () => {
  it('Reiatsu sensing: everything aimed at you shows itself longer; your own marks do not change', () => {
    const s = trained('sensing');
    expect(metaMods(s).warn).toBeCloseTo(0.45);
    const w = new World({ seed: 1, god: true, meta: metaMods(s) });
    const enemy = w.spawnMark(MK_METEOR, MS_CIRCLE, 0, 0, 40, 0, 0, 1, 10, MF_ENEMY);
    const mine = w.spawnMark(MK_METEOR, MS_CIRCLE, 0, 0, 40, 0, 0, 1, 10, 0);
    expect(w.marks.delay[enemy]).toBeCloseTo(1.45);
    expect(w.marks.delay[mine]).toBeCloseTo(1);
  });

  it('Hirenkyaku afterimage: a share of blows miss', () => {
    const s = trained('afterimage');
    expect(metaMods(s).dodge).toBeCloseTo(0.09);
    const w = new World({ seed: 3, meta: metaMods(s) });
    let missed = 0;
    for (let k = 0; k < 2000; k++) {
      w.player.iframes = 0;
      w.player.hp = w.player.maxHp;
      w.hurtPlayer(1);
      if (w.player.hp === w.player.maxHp) missed++;
    }
    expect(missed / 2000).toBeGreaterThan(0.06);
    expect(missed / 2000).toBeLessThan(0.12);
  });

  it('The Emperor’s vessel and the Sternritter regimen: more slots', () => {
    const s = trained('vessel', 'regimen');
    expect(metaPowerSlots(s)).toBe(2);
    expect(metaPassiveSlots(s)).toBe(1);
    const w = new World({ seed: 1, god: true, powerSlots: metaPowerSlots(s), passiveSlots: metaPassiveSlots(s) });
    expect(w.maxPowers).toBe(14);
    expect(w.maxPassives).toBe(9);
  });

  it('Wandenreich bounty: a calamity lived through pays gold and mana', () => {
    const s = trained('bounty');
    expect(metaBounty(s)).toBe(120);
    const w = new World({ seed: 2, god: true, bounty: metaBounty(s), startTime: 300 });
    w.nextEventT = 1e9;
    w.startEvent('frenzy');
    const gold = w.gold;
    for (let k = 0; k < 21 * 60; k++) {
      w.step(0, 0);
      w.pendingLevelUps = 0;
      w.pendingChests.length = 0;
    }
    expect(w.gold - gold).toBeGreaterThanOrEqual(Math.round(120 * (1 + 300 / 600)));
    expect(w.messages.some((m) => m.text.startsWith('Bounty paid'))).toBe(true);
  });
});
