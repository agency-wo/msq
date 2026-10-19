import { describe, expect, it } from 'vitest';
import { DT } from '../src/config';
import { BANKAI_BY_ID } from '../src/data/bankai';
import { ENEMY_INDEX } from '../src/data/enemies';
import { POWER_BY_ID } from '../src/data/powers';
import { RESONANCE_BY_ID } from '../src/data/resonances';
import { MK_MISSILE } from '../src/game/constants';
import { World } from '../src/game/world';

function steps(w: World, n: number): void {
  for (let i = 0; i < n; i++) {
    w.step(0, 0);
    w.pendingLevelUps = 0;
    w.pendingChests.length = 0;
  }
}

/** A god-mode world with exactly these powers (id and level) and resonances. */
function build(powers: [string, number][], res: string[] = [], seed = 1): World {
  const w = new World({ seed, god: true });
  Object.assign(w as unknown as Record<string, unknown>, { spawnTick: () => undefined });
  w.powers.length = 0;
  w.pr.n = 0;
  w.stats.critChance = 0;
  for (const [id, level] of powers) {
    if (POWER_BY_ID.get(id)?.group === 'bankai') w.grantBankai(id);
    for (let k = w.powerLevel(id); k < level; k++) w.give(id, k + 1);
  }
  for (const id of res) w.addResonance(id);
  return w;
}

function post(w: World, dx: number, dy: number): number {
  const i = w.spawnEnemy(ENEMY_INDEX.brute, w.player.x + dx, w.player.y + dy);
  w.en.spd[i] = 0;
  w.en.hp[i] = w.en.maxHp[i] = 1e6;
  return i;
}

const STOLEN = ['fearpetals', 'ironice', 'barrage', 'giantblast', 'overthunder'];

describe('resonances from the story', () => {
  it('each Sternritter resonates with the bankai that knight stole', () => {
    for (const id of STOLEN) {
      const r = RESONANCE_BY_ID.get(id);
      if (!r) throw new Error(id);
      expect(BANKAI_BY_ID.get(r.b)?.thief, id).toBe(POWER_BY_ID.get(r.a)?.credit);
    }
  });

  it('a stolen bankai resonates from Lv 3, an awakened Schrift at Lv 7', () => {
    const offered = (w: World): boolean => {
      for (let k = 0; k < 200; k++) if (w.offers().some((o) => o.kind === 'resonance' && o.id === 'fearpetals')) return true;
      return false;
    };
    expect(offered(build([['fear', 7], ['senbonzakura', 2]]))).toBe(false);
    expect(offered(build([['fear', 6], ['senbonzakura', 3]]))).toBe(false);
    expect(offered(build([['fear', 7], ['senbonzakura', 3]]))).toBe(true);
  });

  it('Petals of Terror: Senbonzakura’s petals fill what they cut with fear', () => {
    // Senbonzakura alone, so only the resonance can make its cuts frightening.
    const feared = (res: string[]): boolean => {
      const w = build([['senbonzakura', 3]], res);
      const targets = [post(w, 50, 0), post(w, -50, 0), post(w, 0, 50), post(w, 0, -50)];
      for (let k = 0; k < Math.round(6 / DT); k++) {
        steps(w, 1);
        if (targets.some((i) => w.en.freezeT[i] > 0 && w.en.vulnT[i] > 0)) return true;
      }
      return false;
    };
    expect(feared([])).toBe(false);
    expect(feared(['fearpetals'])).toBe(true);
  });

  it('Frozen Steel: a blow turned aside by The Iron freezes everything close', () => {
    const w = new World({ seed: 2 });
    Object.assign(w as unknown as Record<string, unknown>, { spawnTick: () => undefined });
    w.powers.length = 0;
    w.give('iron', 5);
    w.grantBankai('hyorinmaru');
    w.give('hyorinmaru', 3);
    w.addResonance('ironice');
    const i = post(w, 60, 0);
    // One step so the spatial grid knows where everything stands.
    w.step(0, 0);
    w.shieldCharges = 1;
    w.player.iframes = 0;
    w.hurtPlayer(10);
    expect(w.en.freezeT[i]).toBeGreaterThan(1);
    expect(w.en.vulnT[i]).toBeGreaterThan(1);
  });

  it('Raikōben Barrage: the drones call missiles down', () => {
    const w = build([['knowledge', 7], ['raikoben', 3]], ['barrage']);
    for (let k = 0; k < 6; k++) post(w, 120 + k * 20, k * 15);
    let missiles = false;
    for (let k = 0; k < Math.round(10 / DT) && !missiles; k++) {
      steps(w, 1);
      for (let m = 0; m < w.marks.n; m++) if (w.marks.kind[m] === MK_MISSILE) missiles = true;
    }
    expect(missiles).toBe(true);
  });

  it('Exploding Giant: Tengen’s sweep explodes along its arc', () => {
    const plain = build([['tengen', 3], ['explode', 7]], [], 3);
    const giant = build([['tengen', 3], ['explode', 7]], ['giantblast'], 3);
    const hits = (w: World): number => {
      const ids = [post(w, 140, 0), post(w, 120, 60), post(w, 120, -60)];
      steps(w, Math.round(6 / DT));
      return ids.reduce((s, i) => s + (w.en.maxHp[i] - w.en.hp[i]), 0);
    };
    expect(hits(giant)).toBeGreaterThan(hits(plain) * 1.15);
  });

  it('Overkill Storm: every 40 kills, Gonryō’s lightning strikes eight more', () => {
    const w = build([['overkill', 5], ['gonryo', 3]], ['overthunder']);
    const slot = w.slotOf('gonryo');
    w.powers.find((ps) => ps.def.id === 'gonryo')!.timer2 = 1e9;
    const targets = [0, 1, 2, 3].map((k) => post(w, 100 + k * 20, 0));
    w.step(0, 0);
    w.dmgSlot = 255;
    const before = w.dmgBy[slot];
    for (let k = 0; k < 40; k++) w.killEnemy(w.spawnEnemy(ENEMY_INDEX.hollow, w.player.x + 300, w.player.y));
    expect(w.dmgBy[slot]).toBeGreaterThan(before);
    expect(targets.some((i) => w.en.hp[i] < w.en.maxHp[i])).toBe(true);
  });

  it('The Other Half heals you when the future is rewritten; Tenchi Kaijin sets it burning', () => {
    const w = build([['balance', 5], ['zanka', 3], ['almighty', 1]], ['otherhalf', 'tenchikaijin']);
    const i = post(w, 120, 0);
    w.player.hp = w.player.maxHp * 0.3;
    let rewritten = false;
    for (let k = 0; k < Math.round(30 / DT) && !rewritten; k++) {
      steps(w, 1);
      rewritten = w.en.dotT[i] > 0;
    }
    expect(rewritten).toBe(true);
    expect(w.player.hp).toBeGreaterThan(w.player.maxHp * 0.5);
  });

  it('Body Double: each double strikes around itself as the future is rewritten', () => {
    const plain = build([['yourself', 7], ['almighty', 1]], [], 4);
    const doubled = build([['yourself', 7], ['almighty', 1]], ['bodydouble'], 4);
    const total = (w: World): number => {
      steps(w, 1);
      let s = 0;
      for (let k = 0; k < Math.round(30 / DT); k++) {
        steps(w, 1);
        if (w.almightyT > 0) break;
      }
      const ids = [post(w, 70, 0), post(w, -70, 0), post(w, 0, 70), post(w, 0, -70)];
      steps(w, Math.round(3 / DT));
      for (const i of ids) s += w.en.maxHp[i] - w.en.hp[i];
      return s;
    };
    expect(total(doubled)).toBeGreaterThan(total(plain));
  });
});
