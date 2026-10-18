import { describe, expect, it } from 'vitest';
import { SIM_HZ } from '../src/config';
import { STAGE } from '../src/data/timeline';
import { World } from '../src/game/world';
import { bot, circle, firstCard, play, sensible } from './helpers';

function assertFinite(w: World): void {
  expect(Number.isFinite(w.player.x) && Number.isFinite(w.player.y)).toBe(true);
  for (let i = 0; i < w.en.n; i++) {
    if (!Number.isFinite(w.en.x[i]) || !Number.isFinite(w.en.y[i]) || !Number.isFinite(w.en.hp[i])) {
      throw new Error(`enemy ${i} has a non-finite value`);
    }
  }
}

describe('world simulation', () => {
  it('plays the first minute: Hollows spawn and die, mana levels you up', () => {
    const w = new World({ seed: 1, god: true });
    play(w, 60, sensible, bot);
    assertFinite(w);
    expect(w.kills).toBeGreaterThan(40);
    expect(w.level).toBeGreaterThanOrEqual(4);
    expect(w.en.n).toBeGreaterThan(0);
  });

  it('kills the 5:00 medallion bearer within a minute and takes back its bankai', { timeout: 90_000 }, () => {
    const w = new World({ seed: 2, god: true });
    let bossSeenAt = -1;
    let bossDownAt = -1;
    play(w, 420, sensible, bot, (world) => {
      if (world.boss.active && bossSeenAt < 0) bossSeenAt = world.t;
      if (!world.boss.active && bossSeenAt >= 0 && bossDownAt < 0) bossDownAt = world.t;
    });
    assertFinite(w);
    expect(bossSeenAt).toBeGreaterThanOrEqual(300);
    expect(bossDownAt - bossSeenAt).toBeGreaterThan(0);
    expect(bossDownAt - bossSeenAt).toBeLessThan(60);
    // The bot walked over the medallion: the first bearer's bankai is now ours.
    expect(w.powers.some((ps) => ps.def.id === w.bearers[0])).toBe(true);
    expect(w.relics.some((r) => r.rarity === 'legendary')).toBe(true);
  });

  it('clears Hueco Mundo: the Vasto Lorde dies and the run ends in victory', { timeout: 240_000 }, () => {
    const w = new World({ seed: 7, god: true });
    play(w, STAGE.length + 240, sensible, bot);
    expect(w.over).toBe('victory');
    expect(w.t).toBeGreaterThan(STAGE.length);
    // All three bearers fell along the way.
    for (const id of w.bearers) expect(w.powers.some((ps) => ps.def.id === id)).toBe(true);
  });

  it('punishes a player who ignores the swarm', { timeout: 60_000 }, () => {
    const w = new World({ seed: 3 });
    play(w, 600, firstCard, circle);
    expect(w.over).toBe('dead');
  });

  it('kills a player who stands still', () => {
    const w = new World({ seed: 3 });
    for (let i = 0; i < 300 * SIM_HZ && !w.over; i++) {
      w.step(0, 0);
      w.pendingLevelUps = 0;
      w.pendingChests.length = 0;
    }
    expect(w.over).toBe('dead');
  });

  it('keeps a stress swarm at the requested size without breaking', () => {
    const w = new World({ seed: 4, stress: 1200 });
    play(w, 5, sensible, circle);
    assertFinite(w);
    expect(w.en.n).toBeGreaterThan(1000);
    expect(w.over).toBeNull();
  });
});
