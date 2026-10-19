import { describe, expect, it } from 'vitest';
import { DT } from '../src/config';
import { ENEMY_INDEX } from '../src/data/enemies';
import { World } from '../src/game/world';

function steps(w: World, n: number): void {
  for (let i = 0; i < n; i++) {
    w.step(0, 0);
    w.pendingLevelUps = 0;
    w.pendingChests.length = 0;
  }
}

/** No new enemies arrive: only the crowd below is there to be hit. */
function quiet(w: World): void {
  Object.assign(w as unknown as Record<string, unknown>, { spawnTick: () => undefined });
}

/** A ring of sturdy Hollows close around you, so every power has something to hit. */
function crowd(w: World, n = 24): void {
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const i = w.spawnEnemy(ENEMY_INDEX.brute, w.player.x + Math.cos(a) * 90, w.player.y + Math.sin(a) * 90);
    w.en.maxHp[i] = w.en.hp[i] = 1e6;
    w.en.spd[i] = 0;
  }
}

describe('the damage report', () => {
  it('credits every hit to the power that dealt it', () => {
    const w = new World({ seed: 2, god: true });
    crowd(w);
    steps(w, Math.round(6 / DT));
    const report = w.damageReport();
    expect(report).toHaveLength(1);
    expect(report[0].id).toBe('heilig');
    expect(report[0].total).toBeGreaterThan(0);
    expect(w.dmgBy[255]).toBe(0);
  });

  it('keeps two powers apart, sorts by damage, and adds up to the health removed', () => {
    const w = new World({ seed: 3, god: true });
    w.give('explode', 3);
    quiet(w);
    crowd(w);
    const before = Array.from({ length: w.en.n }, (_, i) => w.en.hp[i]);
    steps(w, Math.round(8 / DT));
    const report = w.damageReport();
    expect(report.map((r) => r.id).sort()).toEqual(['explode', 'heilig']);
    expect(report[0].total).toBeGreaterThanOrEqual(report[1].total);
    let removed = 0;
    for (let i = 0; i < before.length; i++) removed += before[i] - w.en.hp[i];
    expect(report.reduce((s, r) => s + r.total, 0)).toBeCloseTo(removed, 0);
    for (const r of report) expect(r.dps).toBeCloseTo(r.total / 8, 0);
  });

  it('credits a burn to the power that lit it, long after the cast', () => {
    const w = new World({ seed: 4, god: true });
    w.give('heat', 6);
    w.chooseAttribute('heat', 'afterburn');
    crowd(w);
    steps(w, Math.round(5 / DT));
    const heat = w.slotOf('heat');
    w.powers.length = 0;
    const burnt = w.dmgBy[heat];
    expect(burnt).toBeGreaterThan(0);
    steps(w, Math.round(1 / DT));
    // Nothing casts any more, yet the fire keeps counting for The Heat.
    expect(w.dmgBy[heat]).toBeGreaterThan(burnt);
    expect(w.dmgBy[255]).toBe(0);
  });

  it('puts what no power dealt under "other"', () => {
    const w = new World({ seed: 5, god: true });
    w.powers.length = 0;
    const i = w.spawnEnemy(ENEMY_INDEX.hollow, w.player.x + 120, w.player.y);
    w.damageEnemy(i, 5);
    expect(w.dmgBy[255]).toBeGreaterThan(0);
    expect(w.damageReport()[0].id).toBe('other');
  });
});
