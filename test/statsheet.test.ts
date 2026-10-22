import { describe, expect, it } from 'vitest';
import { World } from '../src/game/world';
import { health, powerRows, statSheet } from '../src/ui/statsheet';

function world(): World {
  const w = new World({ seed: 1, stage: 'hueco' });
  w.step(0, 0);
  return w;
}

describe('the pause stat sheet', () => {
  it('shows the Emperor\'s numbers as they stand', () => {
    const w = world();
    const by = Object.fromEntries(statSheet(w).map((t) => [t.label, t]));
    expect(by.Attack.value).toBe(String(Math.round(w.stats.atk)));
    expect(by.Health.value).toBe(`${Math.round(w.player.hp)} / ${Math.round(w.player.maxHp)}`);
    // Never more than the maximum beside it, never 0 while standing.
    expect(health(112.6, 112.4)).toBe(112);
    expect(health(0.3, 100)).toBe(1);
    expect(health(0, 100)).toBe(0);
    expect(by['Critical hits'].value).toBe(`${Math.round(w.stats.critChance * 100)}%`);
    expect(by.Cooldowns.value).toBe('0%');
    w.stats.cdr = 0.75;
    expect(Object.fromEntries(statSheet(w).map((t) => [t.label, t])).Cooldowns.note).toBe('at the cap');
  });

  it('lists every power with its hit and its cooldown after reduction', () => {
    const w = world();
    const rows = powerRows(w);
    expect(rows.length).toBe(w.powers.length);
    expect(rows[0].name).toBe(w.powers[0].def.name);
    expect(rows[0].level).toBe(w.powers[0].level);
    const before = parseFloat(rows[0].every);
    w.stats.cdr = 0.5;
    expect(parseFloat(powerRows(w)[0].every)).toBeLessThan(before);
    // A stronger hit shows as one.
    const hit = parseFloat(rows[0].hit);
    w.dmgMul *= 2;
    expect(parseFloat(powerRows(w)[0].hit)).toBeGreaterThan(hit * 1.9);
  });
});
