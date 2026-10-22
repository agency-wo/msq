import { describe, expect, it } from 'vitest';
import { BANKAI_BY_ID, BANKAI_IDS } from '../src/data/bankai';
import { ENEMY_INDEX } from '../src/data/enemies';
import { GAUNTLET } from '../src/data/gauntlet';
import { HERO_IDS } from '../src/data/heroes';
import { POWERS } from '../src/data/powers';
import { World } from '../src/game/world';

/** The power a bankai's thief carries ('senbonzakura' → 'fear'). */
function thiefPower(bankai: string): string {
  const name = BANKAI_BY_ID.get(bankai)?.thiefSchrift;
  const def = POWERS.find((d) => d.name === name);
  if (!def) throw new Error(bankai);
  return def.id;
}

/** Every power a level-up board could offer as new, over many boards. */
function offered(w: World, boards = 300): Set<string> {
  const seen = new Set<string>();
  for (let k = 0; k < boards; k++) for (const o of w.offers()) if (o.kind === 'power-new') seen.add(o.id);
  return seen;
}

describe('a Schrift has one holder', () => {
  it('in Hueco Mundo the bearers’ letters are never offered while they stand; when one falls the Emperor takes it', () => {
    const w = new World({ seed: 4, god: true, stage: 'hueco' });
    const held = w.bearers.map(thiefPower);
    expect([...w.heldLetters.keys()].sort()).toEqual([...held].sort());
    const seen = offered(w);
    for (const id of held) expect(seen.has(id), id).toBe(false);
    expect(w.messages.some((m) => m.text.includes('held by knights here'))).toBe(true);

    const first = w.bearers[0];
    const i = w.spawnEnemy(ENEMY_INDEX.bearer, w.player.x + 300, w.player.y, false, 1);
    w.en.variant[i] = BANKAI_IDS.indexOf(first);
    const before = w.powers.length;
    w.killEnemy(i);
    const letter = thiefPower(first);
    expect(w.heldLetters.has(letter)).toBe(false);
    expect(w.powers).toHaveLength(before + 1);
    expect(w.powerLevel(letter)).toBe(1);
    expect(w.banners.some((b) => b.title === POWERS.find((d) => d.id === letter)?.name && b.sub.includes(BANKAI_BY_ID.get(first)?.thief ?? '?'))).toBe(true);
    // The others are still held; a letter you already own is never given twice.
    for (const id of w.bearers.slice(1)) expect(w.heldLetters.has(thiefPower(id))).toBe(true);
  });

  it('a knight carrying a letter you already own gives nothing more when it falls', () => {
    const w = new World({ seed: 4, god: true, stage: 'hueco' });
    const first = w.bearers[0];
    w.give(thiefPower(first), 3);
    expect(w.heldLetters.has(thiefPower(first))).toBe(false);
    const i = w.spawnEnemy(ENEMY_INDEX.bearer, w.player.x + 300, w.player.y, false, 1);
    w.en.variant[i] = BANKAI_IDS.indexOf(first);
    w.killEnemy(i);
    expect(w.powerLevel(thiefPower(first))).toBe(3);
  });

  it('the knights carrying a letter you start with are drawn last', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const w = new World({ seed, god: true, stage: 'hueco', extra: 'fear' });
      expect(w.bearers, `seed ${seed}`).not.toContain('senbonzakura');
      expect(w.heldLetters.has('fear')).toBe(false);
    }
  });

  it('Uryū holds the Antithesis in the Wahrwelt; the captains of the Seireitei hold no letter', () => {
    const wahrwelt = new World({ seed: 2, god: true, stage: 'wahrwelt' });
    expect(wahrwelt.heldLetters.get('antithesis')).toBe('Uryū Ishida');
    expect(offered(wahrwelt).has('antithesis')).toBe(false);
    const uryu = wahrwelt.spawnEnemy(ENEMY_INDEX.defender, wahrwelt.player.x + 300, wahrwelt.player.y, false, 1);
    wahrwelt.en.variant[uryu] = HERO_IDS.indexOf('uryu');
    wahrwelt.killEnemy(uryu);
    expect(wahrwelt.powerLevel('antithesis')).toBe(1);
    expect(new World({ seed: 2, god: true, stage: 'seireitei' }).heldLetters.size).toBe(0);
  });

  it('each Gauntlet tier holds its own knights’ letters', () => {
    const w = new World({ seed: 2, god: true, gauntlet: true });
    const tierOne = GAUNTLET[0].bosses.flatMap((b) => ('roster' in b && b.roster === 'bearer' ? [thiefPower(b.id)] : []));
    expect(tierOne).toHaveLength(5);
    expect([...w.heldLetters.keys()].sort()).toEqual([...tierOne].sort());
    const six = new World({ seed: 2, god: true, gauntlet: true, gauntletTier: 5 });
    expect([...six.heldLetters.keys()]).toEqual(['antithesis']);
  });
});
