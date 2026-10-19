import { describe, expect, it } from 'vitest';
import { CODEX_ENEMIES } from '../src/data/codex';
import { ENEMY_INDEX } from '../src/data/enemies';
import { STAGES } from '../src/data/stages';
import { BOSS_LINES, CHAPTER_BY_ID } from '../src/data/story';
import { EB_WATER, MK_WATER, MS_CIRCLE, MS_LINE } from '../src/game/constants';
import { HARRIBEL_RELEASED } from '../src/game/hostile';
import { World } from '../src/game/world';

function steps(w: World, n: number): void {
  for (let i = 0; i < n; i++) {
    w.step(0, 0);
    w.pendingLevelUps = 0;
    w.pendingChests.length = 0;
  }
}

/** A quiet world with Tier Harribel standing 200 units to your right. */
function arena(): { w: World; i: number } {
  const w = new World({ seed: 5, god: true });
  Object.assign(w as unknown as Record<string, unknown>, { spawnTick: () => undefined });
  w.powers.length = 0;
  const i = w.spawnEnemy(ENEMY_INDEX.harribel, w.player.x + 200, w.player.y, false, 60);
  w.en.spd[i] = 0;
  steps(w, 1);
  return { w, i };
}

/** Her next move: `move` (0 Ola Azul, 1 Sonído, 2 the great wave or Cascada), right now. */
function act(w: World, i: number, move: number): void {
  w.en.atkT[i] = 0;
  w.en.variant[i] = move;
  steps(w, 1);
}

function water(w: World): number {
  let n = 0;
  for (let k = 0; k < w.eb.n; k++) if (w.eb.kind[k] === EB_WATER) n++;
  return n;
}

function marks(w: World, shape: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < w.marks.n; k++) if (w.marks.kind[k] === MK_WATER && w.marks.shape[k] === shape) out.push(k);
  return out;
}

describe('Tier Harribel', () => {
  it('ends Hueco Mundo; a Vasto Lorde rises before her', () => {
    const hueco = STAGES.find((s) => s.id === 'hueco');
    const bosses = hueco?.events.filter((e) => e.kind === 'boss') ?? [];
    const last = bosses[bosses.length - 1];
    expect(last?.kind === 'boss' && last.enemy).toBe('harribel');
    expect(last?.kind === 'boss' && last.final).toBe(true);
    expect(last?.at).toBe(hueco?.length);
    const vasto = bosses.find((e) => e.kind === 'boss' && e.enemy === 'vasto');
    expect(vasto?.kind === 'boss' && vasto.final).toBe(false);
    expect(vasto?.at).toBe(18 * 60);
  });

  it('Ola Azul: a fan of three waves, five once Tiburón is released', () => {
    const { w, i } = arena();
    act(w, i, 0);
    expect(water(w)).toBe(3);
    w.eb.n = 0;
    w.en.hp[i] = w.en.maxHp[i] * 0.4;
    steps(w, 1);
    act(w, i, 0);
    expect(water(w)).toBe(5);
  });

  it('Sonído: warns a lane and is already moving down it', () => {
    const { w, i } = arena();
    act(w, i, 1);
    expect(marks(w, MS_LINE).length).toBe(1);
    expect(w.en.kx[i]).toBeLessThan(-500);
  });

  it('releases Tiburón at half health: bigger, faster, and says so', () => {
    const { w, i } = arena();
    w.en.spd[i] = 50;
    const speed = w.en.spd[i];
    expect(w.en.r[i]).toBeLessThan(HARRIBEL_RELEASED);
    w.en.hp[i] = w.en.maxHp[i] * 0.49;
    steps(w, 1);
    expect(w.en.r[i]).toBe(HARRIBEL_RELEASED);
    expect(w.en.spd[i]).toBeGreaterThan(speed);
    expect(w.messages.some((m) => m.text === 'Harribel releases Tiburón')).toBe(true);
  });

  it('Cascada only once released: a torrent where you stand, and its spray around it', () => {
    const { w, i } = arena();
    act(w, i, 2);
    expect(marks(w, MS_CIRCLE).length).toBe(0);
    expect(water(w)).toBe(1);
    w.en.hp[i] = w.en.maxHp[i] * 0.4;
    steps(w, 1);
    act(w, i, 2);
    const circles = marks(w, MS_CIRCLE);
    expect(circles.length).toBe(6);
    const big = circles.find((k) => w.marks.r[k] === 120);
    expect(big).toBeDefined();
    expect(Math.hypot(w.marks.x[big as number] - w.player.x, w.marks.y[big as number] - w.player.y)).toBeLessThan(1);
  });

  it('is in the Codex, speaks as she arrives, and the story tells of her defeat', () => {
    expect(CODEX_ENEMIES.some((e) => e.key === 'harribel')).toBe(true);
    expect(BOSS_LINES['boss:harribel']).toBeTruthy();
    expect(CHAPTER_BY_ID.get('lord')?.text.join(' ')).toContain('Harribel');
  });

  it('is the last boss of a Hueco Mundo Boss Rush', () => {
    const w = new World({ seed: 2, god: true, bossRush: true });
    const queue = (w as unknown as { rushQueue: { kind: string; enemy?: string; final?: boolean }[][] }).rushQueue;
    const last = queue[queue.length - 1];
    expect(last.some((e) => e.kind === 'boss' && e.enemy === 'harribel' && e.final)).toBe(true);
  });
});
