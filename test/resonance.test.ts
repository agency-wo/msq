import { describe, expect, it } from 'vitest';
import { DT } from '../src/config';
import { ENEMY_INDEX } from '../src/data/enemies';
import { RESONANCES } from '../src/data/resonances';
import { STARTABLE_IDS } from '../src/data/powers';
import { FLAG_ZOMBIE, PK_ARROW, PK_BOMB, PK_HEART, PK_THORN, ZF_BLAZE, ZK_CAGE, ZK_FIRE, ZK_POISON } from '../src/game/constants';
import { World } from '../src/game/world';

/** A god-mode world owning exactly these powers at Lv 7 (first attribute), and the resonances given. */
function build(ids: string[], res: string[] = [], seed = 1): World {
  const w = new World({ seed, god: true });
  w.powers.length = 0;
  w.pr.n = 0;
  w.stats.critChance = 0;
  for (const id of ids) w.give(id, 7);
  for (const id of res) w.addResonance(id);
  return w;
}

function steps(w: World, n: number): void {
  for (let i = 0; i < n; i++) {
    w.step(0, 0);
    w.pendingLevelUps = 0;
    w.pendingChests.length = 0;
  }
}

function find(w: World, uid: number): number {
  for (let k = 0; k < w.en.n; k++) if (w.en.uid[k] === uid) return k;
  return -1;
}

/** A tough enemy that will not walk anywhere. */
function post(w: World, dx: number, dy: number, type = ENEMY_INDEX.brute): number {
  const i = w.spawnEnemy(type, w.player.x + dx, w.player.y + dy);
  w.en.spd[i] = 0;
  w.en.hp[i] = w.en.maxHp[i] = 1e6;
  return w.en.uid[i];
}

describe('resonances', () => {
  it('pair every attack with exactly one partner', () => {
    const used = RESONANCES.flatMap((r) => [r.a, r.b]);
    expect(new Set(used).size).toBe(used.length);
    expect([...used].sort()).toEqual([...STARTABLE_IDS].sort());
  });

  it('are offered once both powers are awakened, never before, never twice', () => {
    const w = build(['heat', 'wind']);
    const seen = () => {
      for (let k = 0; k < 200; k++) if (w.offers().some((o) => o.kind === 'resonance' && o.id === 'firestorm')) return true;
      return false;
    };
    expect(seen()).toBe(true);
    const early = new World({ seed: 1 });
    early.give('heat', 7);
    early.give('wind', 6);
    for (let k = 0; k < 200; k++) expect(early.offers().some((o) => o.kind === 'resonance')).toBe(false);
    w.applyOffer({ kind: 'resonance', id: 'firestorm' });
    expect(w.resonances.has('firestorm')).toBe(true);
    expect(w.banners.some((b) => b.kind === 'resonance')).toBe(true);
    expect(seen()).toBe(false);
    // Both powers are still there, untouched.
    expect(w.powerLevel('heat')).toBe(7);
    expect(w.powerLevel('wind')).toBe(7);
  });

  it('Firestorm: gusts burn what they touch and leave fire behind', () => {
    const w = build(['wind', 'heat'], ['firestorm']);
    const uid = post(w, 60, 0);
    let blazing = false;
    let trail = false;
    let burning = false;
    for (let s = 0; s < Math.round(8 / DT); s++) {
      steps(w, 1);
      for (let z = 0; z < w.zones.n; z++) {
        if (w.zones.flags[z] & ZF_BLAZE) blazing = true;
        if (w.zones.kind[z] === ZK_FIRE) trail = true;
      }
      if (w.en.dotT[find(w, uid)] > 0) burning = true;
    }
    expect(blazing).toBe(true);
    expect(trail).toBe(true);
    expect(burning).toBe(true);
  });

  it('Railgun: lightning strikes along the beam, hitting what the beam itself misses', () => {
    const dealt = (res: string[]) => {
      const w = build(['xaxis', 'thunder'], res, 2);
      // The Thunderbolt stays owned (the strikes use its numbers) but silent: no ordinary strikes.
      const th = w.power('thunder');
      if (th) th.timer = 1e9;
      post(w, 150, 0); // the nearest enemy: the beam aims here, along +x
      // Beside the lines further on: clear of both beams (Lv 7 fires two, slightly spread), inside a strike.
      const side = post(w, 350, -70);
      steps(w, Math.round(3 / DT));
      const j = find(w, side);
      return w.en.maxHp[j] - w.en.hp[j];
    };
    expect(dealt([])).toBe(0);
    expect(dealt(['railgun'])).toBeGreaterThan(0);
  });

  it('Armageddon: a meteor impact flings bombs from The Explode', () => {
    const w = build(['visionary', 'explode'], ['armageddon']);
    const ex = w.power('explode');
    if (ex) ex.timer = 1e9; // only meteors throw bombs here
    post(w, 150, 0);
    const slot = w.powers.findIndex((p) => p.def.id === 'explode');
    let bombs = 0;
    for (let s = 0; s < Math.round(6 / DT); s++) {
      steps(w, 1);
      let n = 0;
      for (let k = 0; k < w.pr.n; k++) if (w.pr.kind[k] === PK_BOMB && w.pr.src[k] === slot) n++;
      bombs = Math.max(bombs, n);
    }
    expect(bombs).toBeGreaterThanOrEqual(4);
  });

  it('Plague: clouds infect what breathes them, and a crumbling zombie leaves a cloud', () => {
    const w = build(['death', 'zombie'], ['plague']);
    const z = w.power('zombie');
    if (z) z.timer = 1e9; // no blood bolts: any infection comes from the clouds
    const uid = post(w, 80, 0);
    let infected = false;
    for (let s = 0; s < Math.round(8 / DT) && !infected; s++) {
      steps(w, 1);
      if (w.en.infT[find(w, uid)] > 0) infected = true;
    }
    expect(infected).toBe(true);
    const i = w.spawnEnemy(ENEMY_INDEX.hollow, w.player.x - 300, w.player.y);
    w.en.flags[i] |= FLAG_ZOMBIE;
    w.zombieN++;
    const clouds = () => {
      let n = 0;
      for (let k = 0; k < w.zones.n; k++) if (w.zones.kind[k] === ZK_POISON && Math.abs(w.zones.x[k] - (w.player.x - 300)) < 5) n++;
      return n;
    };
    const before = clouds();
    w.killEnemy(i);
    expect(clouds()).toBe(before + 1);
  });

  it('Nightmare Prison: a dropping cage throws fear thorns, and caged enemies take more damage', () => {
    const w = build(['jail', 'fear'], ['nightmare']);
    const fear = w.power('fear');
    if (fear) fear.timer = 1e9; // only the cages throw thorns here
    const uid = post(w, 150, 0);
    let thorns = 0;
    let vulnerable = false;
    for (let s = 0; s < Math.round(6 / DT); s++) {
      steps(w, 1);
      let n = 0;
      for (let k = 0; k < w.pr.n; k++) if (w.pr.kind[k] === PK_THORN) n++;
      thorns = Math.max(thorns, n);
      let caged = false;
      for (let k = 0; k < w.zones.n; k++) if (w.zones.kind[k] === ZK_CAGE) caged = true;
      if (caged && w.en.vulnT[find(w, uid)] > 0) vulnerable = true;
    }
    expect(thorns).toBeGreaterThanOrEqual(8);
    expect(vulnerable).toBe(true);
  });

  it('Seele Pfeil: the spinning blades shoot arrows outward', () => {
    const w = build(['seele', 'heilig'], ['seelepfeil']);
    const heilig = w.power('heilig');
    if (heilig) heilig.timer = 1e9; // no ordinary volleys
    post(w, 300, 0);
    let fromBlade = false;
    for (let s = 0; s < Math.round(6 / DT) && !fromBlade; s++) {
      steps(w, 1);
      for (let k = 0; k < w.pr.n; k++) {
        if (w.pr.kind[k] !== PK_ARROW || w.pr.life[k] < 0.75) continue;
        const d = Math.hypot(w.pr.ox[k] - w.player.x, w.pr.oy[k] - w.player.y);
        if (d > 40) fromBlade = true;
      }
    }
    expect(fromBlade).toBe(true);
  });

  it('Devouring Fist: the shockwave swallows the weakened and heals you', () => {
    const w = new World({ seed: 5 });
    w.powers.length = 0;
    w.stats.critChance = 0;
    w.give('power', 7);
    w.give('glutton', 7);
    const g = w.power('glutton');
    if (g) g.timer = 1e9; // no ordinary bites
    w.addResonance('devour');
    const p = w.player;
    p.hp = 40;
    const target = post(w, 50, 0);
    const weak: number[] = [];
    for (let k = 0; k < 4; k++) {
      const i = w.spawnEnemy(ENEMY_INDEX.brute, p.x + 90 + k * 6, p.y - 12 + k * 8);
      w.en.spd[i] = 0;
      w.en.maxHp[i] = 1000;
      w.en.hp[i] = 120; // the punch takes them under 30%, the bite does the rest
      weak.push(w.en.uid[i]);
    }
    steps(w, 30);
    expect(find(w, target)).toBeGreaterThanOrEqual(0);
    expect(weak.every((uid) => find(w, uid) < 0)).toBe(true);
    expect(p.hp).toBeGreaterThan(40);
  });

  it('Narcissus: the doubles fire hearts', () => {
    const w = build(['yourself', 'love'], ['narcissus']);
    const love = w.power('love');
    if (love) love.timer = 1e9; // no ordinary hearts from you
    post(w, 250, 0);
    let hearts = 0;
    for (let s = 0; s < Math.round(5 / DT); s++) {
      steps(w, 1);
      for (let k = 0; k < w.pr.n; k++) if (w.pr.kind[k] === PK_HEART) hearts = Math.max(hearts, 1);
    }
    expect(hearts).toBe(1);
  });

  it('Sonic Drones: the roar also bursts from each drone', () => {
    const dealt = (res: string[]) => {
      const w = build(['roar', 'knowledge'], res, 6);
      const k = w.power('knowledge');
      if (k) k.timer = 1e9; // drones hold their missiles
      // Just outside the roar's own reach, right beside the drones' orbit.
      const roar = w.power('roar');
      const R = (roar?.stats.radius ?? 100) * w.stats.size;
      const uid = post(w, R + 24, 0);
      steps(w, Math.round(4 / DT));
      const j = find(w, uid);
      return w.en.maxHp[j] - w.en.hp[j];
    };
    expect(dealt([])).toBe(0);
    expect(dealt(['sonic'])).toBeGreaterThan(0);
  });
});
