import { describe, expect, it } from 'vitest';
import { DT } from '../src/config';
import { ENEMY_INDEX } from '../src/data/enemies';
import { PASSIVE_BY_ID } from '../src/data/passives';
import { POWER_BY_ID } from '../src/data/powers';
import { RESONANCE_BY_ID, resonanceParts } from '../src/data/resonances';
import { ZF_FREEZE, ZK_GUST } from '../src/game/constants';
import { World } from '../src/game/world';

const NEW = ['silverarrow', 'sanktzwinger', 'sklaverei', 'freundschild', 'anhaben', 'hyotenhyakkaso', 'galvano', 'ironfist'];

function steps(w: World, n: number): void {
  for (let i = 0; i < n; i++) {
    w.step(0, 0);
    w.pendingLevelUps = 0;
    w.pendingChests.length = 0;
  }
}

/** Raise a power, a bankai, a passive or The Almighty to `level`. */
function raise(w: World, id: string, level: number): void {
  if (id === 'almighty') {
    w.grantAlmighty();
    return;
  }
  if (PASSIVE_BY_ID.has(id)) {
    for (let k = 0; k < level; k++) w.addPassive(id);
    return;
  }
  if (POWER_BY_ID.get(id)?.group === 'bankai') w.grantBankai(id);
  for (let k = w.powerLevel(id); k < level; k++) w.give(id, k + 1);
}

/** A quiet world (nothing spawns) holding exactly these, and these resonances. */
function build(parts: [string, number][], res: string[] = [], god = true): World {
  const w = new World({ seed: 4, god });
  Object.assign(w as unknown as Record<string, unknown>, { spawnTick: () => undefined });
  w.powers.length = 0;
  w.pr.n = 0;
  w.stats.critChance = 0;
  for (const [id, level] of parts) raise(w, id, level);
  for (const id of res) w.addResonance(id);
  return w;
}

/** A sturdy, unmoving target. */
function post(w: World, dx: number, dy: number, type = ENEMY_INDEX.brute): number {
  const i = w.spawnEnemy(type, w.player.x + dx, w.player.y + dy);
  w.en.spd[i] = 0;
  w.en.hp[i] = w.en.maxHp[i] = 1e6;
  return i;
}

/** The level a resonance needs of one of its parts. */
function need(id: string, part: string): number {
  const r = RESONANCE_BY_ID.get(id);
  if (!r) throw new Error(id);
  const asked = part === r.a ? r.needA : part === r.b ? r.needB : r.needC;
  if (asked !== undefined) return asked;
  return POWER_BY_ID.get(part)?.maxLevel ?? PASSIVE_BY_ID.get(part)?.max ?? 1;
}

const offered = (w: World, id: string): boolean => {
  for (let k = 0; k < 300; k++) if (w.offers().some((o) => o.kind === 'resonance' && o.id === id)) return true;
  return false;
};

describe('eight more resonances', () => {
  it('each is offered once all its partners are ready (passives at their last level), and not a level before', () => {
    for (const id of NEW) {
      const r = RESONANCE_BY_ID.get(id);
      if (!r) throw new Error(id);
      const parts = resonanceParts(r);
      expect(offered(build(parts.map((p) => [p, need(id, p)])), id), id).toBe(true);
      // One partner a level short (The Almighty has no levels, so leave it out instead).
      const short = parts[0] === 'almighty' ? parts[1] : parts[0];
      const partial = parts.filter((p) => !(p === 'almighty' && short !== 'almighty')).map((p): [string, number] => [p, p === short ? need(id, p) - 1 : need(id, p)]);
      expect(offered(build(partial), id), `${id} early`).toBe(false);
    }
  });

  it('Silver Arrowhead: every sixth volley, a silver arrow freezes the strongest enemy and hits it hard', () => {
    const w = build([['heilig', 7], ['antithesis', 7]], ['silverarrow']);
    const weak = post(w, 120, 0, ENEMY_INDEX.hollow);
    w.en.maxHp[weak] = w.en.hp[weak] = 50_000;
    const strong = post(w, -150, 0);
    let frozen = false;
    for (let k = 0; k < Math.round(20 / DT) && !frozen; k++) {
      steps(w, 1);
      if (w.en.freezeT[strong] > 0) frozen = true;
    }
    expect(w.silverVolleys).toBeGreaterThanOrEqual(6);
    expect(frozen).toBe(true);
  });

  it('Sankt Zwinger and Sklaverei: cages cut harder, and under Vollständig they drain', () => {
    const caged = (res: string[], voll: boolean): number => {
      const w = build([['jail', 6], ['seele', 7], ['vollstandig', 1]], res);
      const i = post(w, 160, 0);
      for (let k = 0; k < Math.round(6 / DT); k++) {
        if (voll) w.vollT = 1;
        steps(w, 1);
      }
      return 1e6 - w.en.hp[i];
    };
    const plain = caged([], false);
    expect(caged(['sanktzwinger'], false)).toBeGreaterThan(plain * 1.1);
    expect(caged(['sklaverei'], true)).toBeGreaterThan(caged([], true) * 1.3);
    const w = build([['jail', 7], ['vollstandig', 1]], ['sklaverei'], false);
    w.player.hp = w.player.maxHp * 0.5;
    w.sklavereiFeed();
    w.sklavereiFeed();
    expect(w.player.hp / w.player.maxHp).toBeCloseTo(0.51, 3);
  });

  it('Freund Schild: a blow The Iron turns aside is handed back to what is near', () => {
    const handedBack = (res: string[]): number => {
      const w = build([['iron', 7], ['balance', 7]], res, false);
      const i = post(w, 60, 0);
      // The Balance sets its strength as it ticks.
      steps(w, 1);
      w.shieldCharges = 1;
      w.player.iframes = 0;
      w.hurtPlayer(10);
      return 1e6 - w.en.hp[i];
    };
    // The same seed both times, so the only difference is the blow handed back.
    expect(handedBack(['freundschild']) - handedBack([])).toBeGreaterThan(0);
  });

  it('Blut Vene Anhaben: the ring wounds what stands close and feeds you', () => {
    const w = build([['vene', 5], ['almighty', 1]], ['anhaben'], false);
    const i = post(w, 60, 0);
    w.player.hp = w.player.maxHp * 0.5;
    steps(w, Math.round(0.6 / DT));
    expect(w.en.hp[i]).toBeLessThan(1e6);
    expect(w.player.hp).toBeGreaterThan(w.player.maxHp * 0.5);
  });

  it('Hyōten Hyakkasō: every gust freezes', () => {
    const w = build([['wind', 7], ['hyorinmaru', 3]], ['hyotenhyakkaso']);
    post(w, 100, 0);
    steps(w, Math.round(4 / DT));
    let gusts = 0;
    for (let z = 0; z < w.zones.n; z++) {
      if (w.zones.kind[z] !== ZK_GUST) continue;
      gusts++;
      expect(w.zones.flags[z] & ZF_FREEZE).toBeTruthy();
    }
    expect(gusts).toBeGreaterThan(0);
  });

  it('Twin Storms: every third Thunderbolt cast, Gonryō strikes too', () => {
    const dealt = (res: string[]): number => {
      const w = build([['thunder', 7], ['gonryo', 3]], res);
      const targets = [post(w, 80, 0), post(w, -80, 0), post(w, 0, 80), post(w, 0, -80)];
      steps(w, Math.round(20 / DT));
      return targets.reduce((s, i) => s + (1e6 - w.en.hp[i]), 0);
    };
    expect(dealt(['galvano'])).toBeGreaterThan(dealt([]) * 1.15);
  });

  it('Arterie Fist: a punch lands 12% harder for each level of Blut Arterie', () => {
    const punch = (res: string[]): number => {
      const w = build([['power', 7], ['arterie', 5]], res);
      const i = post(w, 40, 0);
      w.stats.critChance = 0;
      let k = 0;
      while (w.en.hp[i] >= 1e6 && k++ < Math.round(10 / DT)) steps(w, 1);
      return 1e6 - w.en.hp[i];
    };
    expect(punch(['ironfist']) / punch([])).toBeCloseTo(1.6, 1);
  });
});

