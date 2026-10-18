import { describe, it } from 'vitest';
import { SIM_HZ } from '../src/config';
import { World } from '../src/game/world';
import { bot, circle, firstCard, maxedMeta, resolveChoices, sensible, type Mover, type Strategy } from './helpers';

/**
 * Pacing report, not a pass/fail test. Run with:
 *   BALANCE=1 npx vitest run test/balance.test.ts --silent=false
 * (add STAGE=seireitei, SEED=3, MINUTES=21 to change the run, META=max for a
 * player with every Archives upgrade). Prints level, kills, health and boss progress every 30 s of a simulated run
 * for a few play styles, so tuning changes can be compared before and after.
 */
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

function clock(t: number): string {
  return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
}

function run(seed: number, pick: Strategy, move: Mover, god: boolean, minutes: number): string[] {
  const w = new World({ seed, god, stage: env.STAGE, ...(env.META === 'max' ? maxedMeta() : {}) });
  const rows: string[] = [];
  let nextReport = 30;
  let bossStart = -1;
  let hits = 0;
  let lowest = 1;
  const steps = minutes * 60 * SIM_HZ;
  for (let i = 0; i < steps && !w.over; i++) {
    const [mx, my] = move(w);
    const before = w.player.hp;
    w.step(mx, my);
    if (w.player.hp < before - 0.01) hits++;
    lowest = Math.min(lowest, w.player.hp / w.player.maxHp);
    resolveChoices(w, pick);
    if (w.boss.active && bossStart < 0) bossStart = w.t;
    if (!w.boss.active && bossStart >= 0) {
      rows.push(`  boss down after ${(w.t - bossStart).toFixed(1)} s`);
      bossStart = -1;
    }
    if (w.t >= nextReport) {
      nextReport += 30;
      const boss = w.boss.active ? ` boss ${Math.round((w.boss.hp / w.boss.max) * 100)}%` : '';
      const hp = god ? '' : `  hp ${Math.round(w.player.hp)}/${Math.round(w.player.maxHp)} hits ${hits} low ${Math.round(lowest * 100)}%`;
      const powers = w.powers.map((p) => `${p.def.id}${p.level}`).join(' ');
      rows.push(
        `${clock(w.t)}  lv ${String(w.level).padStart(3)}  kills ${String(w.kills).padStart(6)}  alive ${String(w.en.n).padStart(4)}  orbs ${String(w.orbs.n).padStart(4)}  dmg x${w.dmgMul.toFixed(2)}${hp}${boss}  [${powers}]`,
      );
    }
  }
  if (w.over) rows.push(`  run over: ${w.over} at ${clock(w.t)}`);
  return rows;
}

describe.runIf(env.BALANCE)('balance report', () => {
  it('prints pacing for a few play styles', { timeout: 600_000 }, () => {
    const minutes = Number(env.MINUTES ?? 15);
    const styles: [string, Strategy, Mover, boolean][] = [
      ['circle + first card (god)', firstCard, circle, true],
      ['bot + sensible (god)', sensible, bot, true],
      ['bot + sensible (mortal)', sensible, bot, false],
      ['circle + first card (mortal)', firstCard, circle, false],
    ];
    for (const [name, pick, move, god] of styles) {
      console.log(`\n=== ${name} ===\n${run(Number(env.SEED ?? 7), pick, move, god, minutes).join('\n')}`);
    }
  });
});
