import { describe, expect, it } from 'vitest';
import { ENEMY_INDEX } from '../src/data/enemies';
import { World } from '../src/game/world';
import { newestBossSprite } from '../src/render/names';

describe('boss title cards', () => {
  it('name the boss that arrived last, as it looks now', () => {
    const w = new World({ seed: 2, stage: 'hueco', god: true });
    expect(newestBossSprite(w)).toBeNull();
    const a = w.spawnEnemy(ENEMY_INDEX.nel, w.player.x + 200, w.player.y, false, 1);
    expect(newestBossSprite(w)).toBe('nel');
    w.spawnEnemy(ENEMY_INDEX.harribel, w.player.x - 200, w.player.y, false, 1);
    expect(newestBossSprite(w)).toBe('harribel');
    w.killEnemy(a);
    expect(newestBossSprite(w)).toBe('harribel');
  });
});
