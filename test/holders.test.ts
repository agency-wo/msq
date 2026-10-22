import { describe, expect, it } from 'vitest';
import { BANKAI_IDS } from '../src/data/bankai';
import { ENEMY_INDEX } from '../src/data/enemies';
import { GAUNTLET } from '../src/data/gauntlet';
import { DIFFICULTY } from '../src/data/stages';
import { FLAG_BOSS } from '../src/game/constants';
import { World } from '../src/game/world';
import { metaPressure, progressShare, trainingShare } from '../src/save/archives';
import { defaultSave } from '../src/save/save';

function steps(w: World, n: number): void {
  for (let k = 0; k < n && !w.over; k++) {
    w.step(0, 0);
    w.pendingLevelUps = 0;
    w.pendingChests.length = 0;
  }
}

describe('a bankai has one holder', () => {
  it('in the Gauntlet the captains come after their thieves have fallen: without their bankai, and no medallion', () => {
    const w = new World({ seed: 3, god: true, gauntlet: true });
    Object.assign(w as unknown as Record<string, unknown>, { spawnTick: () => undefined });
    let captains = 0;
    let medallionsAfterThieves = 0;
    for (let guard = 0; guard < 800 && w.gauntletTier < 3 && !w.over; guard++) {
      steps(w, 30);
      for (let i = 0; i < w.en.n; i++) {
        if (w.en.dead[i] || !(w.en.flags[i] & FLAG_BOSS)) continue;
        const captain = w.en.type[i] === ENEMY_INDEX.captain;
        if (captain) {
          captains++;
          expect(w.bankailess.has(w.en.uid[i]), BANKAI_IDS[w.en.variant[i]]).toBe(true);
        }
        const before = w.pickups.filter((q) => q.kind === 'medallion').length;
        w.killEnemy(i);
        if (captain) medallionsAfterThieves += w.pickups.filter((q) => q.kind === 'medallion').length - before;
      }
    }
    expect(captains).toBe(GAUNTLET[2].bosses.filter((b) => 'roster' in b && b.roster === 'captain').length);
    expect(medallionsAfterThieves).toBe(0);
    expect(w.banners.some((b) => b.sub.includes('bankai already taken'))).toBe(true);
  });

  it('a knight whose bankai you already hold comes without it', () => {
    const w = new World({ seed: 2, god: true, stage: 'seireitei' });
    w.grantBankai('senbonzakura');
    const i = (w as unknown as { spawnKnight(id: string, hp: number, captain: boolean): number }).spawnKnight('senbonzakura', 1, true);
    expect(w.bankailess.has(w.en.uid[i])).toBe(true);
    const j = (w as unknown as { spawnKnight(id: string, hp: number, captain: boolean): number }).spawnKnight('hyorinmaru', 1, true);
    expect(w.bankailess.has(w.en.uid[j])).toBe(false);
  });
});

describe('the world answers how strong you have become', () => {
  it('a new save meets none of it; a veteran meets all of it, however much they trained', () => {
    const fresh = defaultSave();
    expect(metaPressure(fresh)).toBe(0);
    const vet = defaultSave();
    for (const s of Object.values(vet.stages)) s.cleared = true;
    vet.gauntlet.tiers = GAUNTLET.length;
    for (const id of ['desert', 'jagdarmee', 'medallions']) vet.missions[id] = { cleared: true, best: 300 };
    expect(trainingShare(vet)).toBe(0);
    expect(progressShare(vet)).toBeGreaterThan(0.66);
    expect(metaPressure(vet)).toBe(progressShare(vet));
  });

  it('at full pressure bosses hit harder too', () => {
    const calm = new World({ seed: 4, god: true, pressure: 0 });
    const vet = new World({ seed: 4, god: true, pressure: 1 });
    const hit = (w: World): number => w.en.dmg[w.spawnEnemy(ENEMY_INDEX.bearer, w.player.x + 200, w.player.y, false, 5)];
    expect(hit(vet) / hit(calm)).toBeCloseTo(1 + DIFFICULTY.pressureBossDamage, 3);
  });
});
