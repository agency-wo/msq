import { describe, expect, it } from 'vitest';
import { BANKAI_IDS } from '../src/data/bankai';
import { CODEX_ENEMIES, enemyKey } from '../src/data/codex';
import { ENEMY_INDEX } from '../src/data/enemies';
import { ROYAL_IDS } from '../src/data/royal';
import { World } from '../src/game/world';
import { defaultSave, migrate, recordRun } from '../src/save/save';

describe('the Codex', () => {
  it('counts kills by kind, and each named boss under its own name', () => {
    const w = new World({ seed: 1, god: true });
    const a = w.spawnEnemy(ENEMY_INDEX.hollow, w.player.x + 200, w.player.y);
    const b = w.spawnEnemy(ENEMY_INDEX.bearer, w.player.x + 260, w.player.y);
    w.en.variant[b] = BANKAI_IDS.indexOf('tengen');
    const c = w.spawnEnemy(ENEMY_INDEX.royal, w.player.x + 320, w.player.y);
    w.en.variant[c] = ROYAL_IDS.indexOf('kirio');
    for (const i of [a, b, c]) w.killEnemy(i);
    expect(w.killsBy.get('hollow')).toBe(1);
    expect(w.killsBy.get('bearer:tengen')).toBe(1);
    expect(w.killsBy.get('royal:kirio')).toBe(1);
    expect(enemyKey(ENEMY_INDEX.captain, BANKAI_IDS.indexOf('tengen'))).toBe('captain:tengen');
  });

  it('has an entry for every enemy and every named boss, each once', () => {
    const keys = CODEX_ENEMIES.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const id of ['hollow', 'menos', 'vasto', 'grandmaster', 'commander', 'ichibe', 'sentinel', 'rift']) expect(keys).toContain(id);
    // The five knights who stole a bankai; Zanka no Tachi is the Captain-Commander's.
    expect(keys.filter((k) => k.startsWith('bearer:'))).toHaveLength(5);
    expect(keys).not.toContain('bearer:zanka');
    expect(keys.filter((k) => k.startsWith('captain:'))).toHaveLength(5);
    expect(keys.filter((k) => k.startsWith('royal:'))).toHaveLength(4);
  });

  it('every run adds what it found, and kills add up', () => {
    const s = defaultSave();
    const run = { stage: 'hueco' as const, time: 300, level: 20, kills: 500, cleared: false, gold: 0 };
    recordRun(s, { ...run, codex: { powers: ['heilig', 'explode'], relics: ['crown'], resonances: [], kills: { hollow: 40, 'bearer:tengen': 1 } } });
    recordRun(s, { ...run, codex: { powers: ['explode', 'nope'], relics: [], resonances: ['firestorm'], kills: { hollow: 10, ghost: 3 } } });
    expect(s.codex.powers).toEqual(['heilig', 'explode']);
    expect(s.codex.relics).toEqual(['crown']);
    expect(s.codex.resonances).toEqual(['firestorm']);
    expect(s.codex.kills).toEqual({ hollow: 50, 'bearer:tengen': 1 });
  });

  it('an old save opens what it already awakened and took back; a broken one is cleaned', () => {
    const old = migrate({ v: 1, awakened: ['xaxis'], taken: ['tengen'] });
    expect(old.codex.powers.sort()).toEqual(['heilig', 'tengen', 'xaxis']);
    const junk = migrate({ v: 1, codex: { powers: ['heilig', 7, 'nope'], relics: ['crown', 'x'], resonances: 'all', kills: { hollow: 5, nobody: 2, brute: -1 } } });
    expect(junk.codex).toEqual({ powers: ['heilig'], relics: ['crown'], resonances: [], kills: { hollow: 5 } });
  });
});
