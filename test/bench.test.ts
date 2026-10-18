import { describe, it } from 'vitest';
import { DT } from '../src/config';
import { ENEMY_INDEX } from '../src/data/enemies';
import { POWERS, upgradeCap } from '../src/data/powers';
import { FLAG_BOSS } from '../src/game/constants';
import { World } from '../src/game/world';

/**
 * Power bench, not a pass/fail test. Run with:
 *   BENCH=1 npx vitest run test/bench.test.ts --silent=false
 * Each offensive power alone at Lv 6 (no attribute), the Emperor standing
 * still, a medallion bearer walking in from 200 units and a steady swarm
 * around: damage per second to the boss and to everything else over 20 s.
 */
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

function bench(id: string, level: number): { boss: number; swarm: number } {
  const w = new World({ seed: 11, god: true, startTime: 240 });
  w.powers.length = 0;
  w.give(id, level);
  const p = w.player;
  const b = w.spawnEnemy(ENEMY_INDEX.bearer, p.x + 200, p.y, false, 100);
  w.en.spd[b] = 30;
  let boss = 0;
  let swarm = 0;
  const orig = w.damageEnemy.bind(w);
  w.damageEnemy = (i, base, knock, sx, sy, noCrit) => {
    const hp = w.en.hp[i];
    orig(i, base, knock, sx, sy, noCrit);
    const dealt = Math.max(0, hp - Math.max(0, w.en.hp[i]));
    if (w.en.flags[i] & FLAG_BOSS) boss += dealt;
    else swarm += dealt;
  };
  const secs = 20;
  for (let s = 0; s < secs / DT; s++) {
    w.step(0, 0);
    w.pendingLevelUps = 0;
    w.pendingChests.length = 0;
    // Keep the boss from ever reaching contact, so every power is measured at the same range.
    for (let i = 0; i < w.en.n; i++) {
      if (!(w.en.flags[i] & FLAG_BOSS)) continue;
      const dx = w.en.x[i] - p.x;
      const dy = w.en.y[i] - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 120) {
        w.en.x[i] = p.x + (dx / d) * 120;
        w.en.y[i] = p.y + (dy / d) * 120;
      }
    }
  }
  return { boss: boss / secs, swarm: swarm / secs };
}

describe.runIf(env.BENCH)('power bench', () => {
  it('prints damage per second for every offensive power at Lv 6', { timeout: 300_000 }, () => {
    const rows: string[] = [];
    for (const def of POWERS) {
      if (def.group === 'utility') continue;
      const level = Math.min(6, upgradeCap(def));
      const r = bench(def.id, level);
      rows.push(`${def.id.padEnd(14)} Lv${level}  boss ${r.boss.toFixed(0).padStart(5)}/s  swarm ${r.swarm.toFixed(0).padStart(6)}/s`);
    }
    console.log(`\n${rows.join('\n')}`);
  });
});
