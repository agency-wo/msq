import { describe, expect, it } from 'vitest';
import { CODEX_ENEMIES } from '../src/data/codex';
import { ENEMY_INDEX } from '../src/data/enemies';
import { GOTEI_IDS } from '../src/data/gotei';
import { RELIC_BY_ID, RELICS } from '../src/data/relics';
import { SPOIL_BY_BOSS, SPOILS } from '../src/data/spoils';
import type { StageId } from '../src/data/stages';
import { MF_ENEMY, MF_ROOT, MK_CERO, MK_ICE, MK_SEAL, MK_SLASH, MS_ARC, MS_CIRCLE, MS_LINE } from '../src/game/constants';
import { spoilDamageMul, spoilSwallow, spoilTick } from '../src/game/spoils';
import { World } from '../src/game/world';
import { setStartRelic, wonSpoils } from '../src/save/archives';
import { defaultSave, migrate } from '../src/save/save';

function steps(w: World, n: number, mx = 0, my = 0): void {
  for (let i = 0; i < n; i++) {
    w.step(mx, my);
    w.pendingLevelUps = 0;
    w.pendingChests.length = 0;
  }
}

/** A quiet, mortal run (no powers, nothing spawning) holding these spoils, with plenty of health. */
function quiet(spoils: string[] = [], stage: StageId = 'hueco', god = false): World {
  const w = new World({ seed: 5, stage, god });
  Object.assign(w as unknown as Record<string, unknown>, { spawnTick: () => undefined });
  w.powers.length = 0;
  w.pr.n = 0;
  for (const id of spoils) w.takeSpoil(`spoil-${id}`);
  w.stats.critChance = 0;
  w.player.maxHp = w.player.hp = 1000;
  w.banners.length = 0;
  return w;
}

function hollow(w: World, dx: number, dy = 0, hp = 1e6): number {
  const i = w.spawnEnemy(ENEMY_INDEX.hollow, w.player.x + dx, w.player.y + dy);
  w.en.spd[i] = 0;
  w.en.hp[i] = w.en.maxHp[i] = hp;
  return i;
}

function hit(w: World, amount: number): number {
  const before = w.player.hp;
  w.player.iframes = 0;
  w.hurtPlayer(amount);
  return before - w.player.hp;
}

function marks(w: World, kind: number, shape: number): number {
  let n = 0;
  for (let k = 0; k < w.marks.n; k++) if (w.marks.kind[k] === kind && w.marks.shape[k] === shape) n++;
  return n;
}

const bursts = (w: World): number => (w as unknown as { burstN: number }).burstN;

describe('spoils of war', () => {
  it('every boss has one, its own, and nothing else in the game does what it does', () => {
    const bosses = CODEX_ENEMIES.filter((e) => e.boss && e.key !== 'mirage');
    expect(SPOILS).toHaveLength(40);
    expect(new Set(SPOILS.map((s) => s.id)).size).toBe(SPOILS.length);
    expect(new Set(SPOILS.map((s) => s.name)).size).toBe(SPOILS.length);
    expect(new Set(SPOILS.map((s) => s.special)).size).toBe(SPOILS.length);
    for (const b of bosses) expect(SPOIL_BY_BOSS.get(b.key), b.key).toBeTruthy();
    for (const s of SPOILS) expect(bosses.map((b) => b.key)).toContain(s.boss);
    // Never in a chest, never on the Armory's shelves for gold.
    for (const s of SPOILS) expect(RELICS).not.toContain(s);
    for (const s of SPOILS) expect(RELIC_BY_ID.get(s.id)).toBe(s);
  });

  it('a boss leaves its own spoil; picking it up holds it, with a title card', () => {
    const w = quiet();
    const i = w.spawnEnemy(ENEMY_INDEX.gotei, w.player.x + 200, w.player.y);
    w.en.variant[i] = GOTEI_IDS.indexOf('kenpachi');
    (w as unknown as { bossCount: number }).bossCount = 1;
    w.killEnemy(i);
    const drop = w.pickups.find((q) => q.kind === 'spoil');
    expect(drop?.relic).toBe('spoil-eyepatch');
    w.player.x = drop?.x ?? 0;
    w.player.y = drop?.y ?? 0;
    steps(w, 1);
    expect(w.relics.map((r) => r.id)).toContain('spoil-eyepatch');
    expect(w.banners.some((b) => b.kind === 'spoil' && b.title === 'Kenpachi’s Eyepatch')).toBe(true);
    // Already held: the next Kenpachi leaves a black chest instead.
    const j = w.spawnEnemy(ENEMY_INDEX.gotei, w.player.x + 200, w.player.y);
    w.en.variant[j] = GOTEI_IDS.indexOf('kenpachi');
    (w as unknown as { bossCount: number }).bossCount = 1;
    const black = w.pickups.filter((q) => q.kind === 'chestBlack').length;
    w.killEnemy(j);
    expect(w.pickups.filter((q) => q.kind === 'spoil')).toHaveLength(0);
    expect(w.pickups.filter((q) => q.kind === 'chestBlack').length).toBe(black + 2);
  });

  it('the last boss’s spoil is yours at once, since the run ends with it; in Endless it drops', () => {
    for (const endless of [false, true]) {
      const w = new World({ seed: 5, stage: 'wahrwelt', god: true, endless });
      const i = w.spawnEnemy(ENEMY_INDEX.ichigo, w.player.x + 200, w.player.y);
      Object.assign(w as unknown as Record<string, unknown>, { finalBossUid: w.en.uid[i], bossCount: 1 });
      w.killEnemy(i);
      const held = w.relics.some((r) => r.id === 'spoil-getsuga');
      const dropped = w.pickups.some((q) => q.kind === 'spoil' && q.relic === 'spoil-getsuga');
      expect([held, dropped]).toEqual(endless ? [false, true] : [true, false]);
    }
  });
});

describe('chests only offer what the run can use', () => {
  const open = ['founder', 'seal', 'key'];
  const offered = (w: World, kind: 'brown' | 'black' = 'brown'): Set<string> => {
    const seen = new Set<string>();
    for (let k = 0; k < 300; k++) for (const r of w.relicChoices(kind)) seen.add(r.id);
    return seen;
  };

  it('no Founder’s Medallion where no bankai is left to take', () => {
    for (const stage of ['silbern', 'palace', 'wahrwelt'] as const) {
      const w = new World({ seed: 3, stage, relicsOpen: open });
      expect(offered(w, 'black').has('founder'), stage).toBe(false);
    }
    const hueco = new World({ seed: 3, stage: 'hueco', relicsOpen: open });
    expect(offered(hueco, 'black').has('founder')).toBe(true);
    // Once every bankai this run could give is yours, it stops coming.
    for (const id of hueco.bearers) hueco.grantBankai(id);
    expect(hueco.relicUseful('founder')).toBe(false);
    const sei = new World({ seed: 3, stage: 'seireitei', relicsOpen: open });
    for (const id of sei.bearers) sei.grantBankai(id);
    expect(sei.relicUseful('founder')).toBe(true);
  });

  it('the Soul King’s Seal only in the Palace, while a Fragment can still drop', () => {
    expect(offered(new World({ seed: 3, stage: 'hueco', relicsOpen: open }), 'black').has('seal')).toBe(false);
    const palace = new World({ seed: 3, stage: 'palace', relicsOpen: open });
    expect(offered(palace, 'black').has('seal')).toBe(true);
    for (const f of ['rightarm', 'leftarm', 'heart']) palace.grantFragment(f);
    expect(palace.relicUseful('seal')).toBe(false);
  });

  it('no Silbern Key or Sanrei Glove in a Boss Rush', () => {
    const rush = new World({ seed: 3, stage: 'hueco', bossRush: true, relicsOpen: open });
    const seen = offered(rush);
    expect(seen.has('key')).toBe(false);
    expect(seen.has('sanrei')).toBe(false);
    const run = offered(new World({ seed: 3, stage: 'hueco', relicsOpen: open }));
    expect(run.has('key')).toBe(true);
    expect(run.has('sanrei')).toBe(true);
  });
});

describe('the Armory keeps the spoils you have won', () => {
  it('a won spoil can be equipped for free; one not won yet cannot; saves agree', () => {
    const s = defaultSave();
    expect(setStartRelic(s, 'spoil-haori')).toBe(false);
    s.codex.relics.push('spoil-haori');
    expect(wonSpoils(s).map((r) => r.id)).toEqual(['spoil-haori']);
    expect(setStartRelic(s, 'spoil-haori')).toBe(true);
    const back = migrate(JSON.parse(JSON.stringify(s)));
    expect(back.startRelic).toBe('spoil-haori');
    const forged = migrate({ ...JSON.parse(JSON.stringify(defaultSave())), startRelic: 'spoil-getsuga', armory: ['spoil-getsuga'] });
    expect(forged.startRelic).toBeNull();
    expect(forged.armory).toEqual([]);
  });

  it('a run started with a spoil holds it, and that boss then leaves a black chest', () => {
    const w = new World({ seed: 2, stage: 'hueco', relic: 'spoil-lagota', god: true });
    expect(w.relics.map((r) => r.id)).toContain('spoil-lagota');
    expect(w.spoil.has.has('lagota')).toBe(true);
  });
});

describe('what each spoil does', () => {
  it('Cang Du’s Iron Scale: right after a hit, the next lands at 40%', () => {
    const w = quiet(['ironscale']);
    const first = hit(w, 100);
    expect(hit(w, 100)).toBeCloseTo(first * 0.4, 3);
    w.t += 2.5;
    expect(hit(w, 100)).toBeCloseTo(first, 3);
  });

  it('Kyōraku’s Flowered Haori: a blow of a quarter of your health or more slides off, once every 30 s', () => {
    const w = quiet(['haori']);
    expect(hit(w, 300)).toBe(0);
    expect(hit(w, 300)).toBeGreaterThan(0);
    expect(hit(w, 100)).toBeGreaterThan(0);
  });

  it('Äs Nödt’s Thorn: a hit freezes everything near you with fear', () => {
    const w = quiet(['fearthorn']);
    const near = hollow(w, 60);
    const far = hollow(w, 400);
    steps(w, 1);
    hit(w, 50);
    expect(w.en.freezeT[near]).toBeGreaterThan(1);
    expect(w.en.freezeT[far]).toBe(0);
  });

  it('BG9’s Data Core: the longer a boss fights you, the harder you hit it, up to +30%', () => {
    const w = quiet(['datacore']);
    const i = w.spawnEnemy(ENEMY_INDEX.ichibe, w.player.x + 200, w.player.y);
    // Health is stored as float32: keep it small enough that every point counts.
    w.en.hp[i] = w.en.maxHp[i] = 1e5;
    const memo = w.bossMemo(i);
    const dealt = (): number => {
      const hp = w.en.hp[i];
      w.damageEnemy(i, 100);
      return hp - w.en.hp[i];
    };
    const fresh = dealt();
    memo.born = w.t - 50;
    expect(dealt()).toBeCloseTo(fresh * 1.15, 2);
    memo.born = w.t - 500;
    expect(dealt()).toBeCloseTo(fresh * 1.3, 2);
  });

  it('Bambietta’s Spark, Driscoll’s Tally, Ayon’s Antler: what kills and boss kills give', () => {
    const w = quiet(['spark', 'tally', 'horn']);
    const max = w.stats.maxHp;
    for (let k = 0; k < 200; k++) w.killEnemy(hollow(w, 300, 0, 1));
    expect(bursts(w)).toBeGreaterThan(0);
    expect(w.stats.maxHp).toBe(max + 4);
    expect(w.player.maxHp).toBe(max + 4);
    const b = w.spawnEnemy(ENEMY_INDEX.gotei, w.player.x + 200, w.player.y);
    (w as unknown as { bossCount: number }).bossCount = 1;
    w.killEnemy(b);
    expect(w.spoil.tally).toBe(1);
    expect(spoilDamageMul(w)).toBeCloseTo(1.08, 5);
  });

  it('Neliel’s Mask: every sixth shot is swallowed and comes back out as a Cero', () => {
    const w = quiet(['cerodoble']);
    const out = [0, 1, 2, 3, 4, 5].map(() => spoilSwallow(w));
    expect(out).toEqual([false, false, false, false, false, true]);
    expect(marks(w, MK_CERO, MS_LINE)).toBe(1);
  });

  it('Tiburón’s Drop: a critical hit splashes', () => {
    const w = quiet(['lagota']);
    const i = hollow(w, 80);
    w.stats.critChance = 1;
    w.damageEnemy(i, 50);
    expect(bursts(w)).toBe(1);
  });

  it('Byakuya’s Silver Scarf: half again as much gold', () => {
    const plain = quiet();
    const w = quiet(['scarf']);
    expect(w.goldBonus).toBeCloseTo(plain.goldBonus * 1.5, 5);
  });

  it('Hitsugaya’s Ice Flower: falling below half freezes everything near you, once every 30 s', () => {
    const w = quiet(['iceflower']);
    const near = hollow(w, 80);
    steps(w, 1);
    w.player.hp = 520;
    hit(w, 50);
    expect(w.en.freezeT[near]).toBeGreaterThan(2);
    w.en.freezeT[near] = 0;
    hit(w, 50);
    expect(w.en.freezeT[near]).toBe(0);
  });

  it('Suzumebachi’s Stinger: the second blow on the Hōmonka kills a common enemy outright', () => {
    const w = quiet(['stinger']);
    const i = hollow(w, 80, 0, 1000);
    w.damageEnemy(i, 10);
    expect(w.en.dead[i]).toBe(0);
    w.damageEnemy(i, 10);
    expect(w.en.dead[i]).toBe(1);
  });

  it('the spoils that strike on their own: Tengen, Zabimaru, Sode no Shirayuki, Zangetsu, Tachikaze', () => {
    const w = quiet(['tengen', 'taiho', 'tsukishiro', 'getsuga']);
    for (let k = 0; k < 12; k++) hollow(w, 120 + k * 4, k * 3);
    steps(w, 1);
    w.marks.n = 0;
    spoilTick(w, 14.01);
    expect(marks(w, MK_SLASH, MS_ARC)).toBe(1);
    expect(marks(w, MK_CERO, MS_LINE)).toBe(1);
    expect(marks(w, MK_ICE, MS_CIRCLE)).toBe(1);
    expect(marks(w, MK_SLASH, MS_LINE)).toBe(1);
    const wind = quiet(['tachikaze']);
    wind.marks.n = 0;
    steps(wind, 40, 1, 0);
    expect(marks(wind, MK_SLASH, MS_CIRCLE)).toBeGreaterThan(0);
  });

  it('Ryūjin Jakka’s Ember burns what comes close; Ichimonji’s Brush takes the sturdiest one’s name', () => {
    const w = quiet(['ember', 'brush']);
    const near = hollow(w, 50);
    const big = hollow(w, 200, 0, 5e6);
    steps(w, 1);
    spoilTick(w, 20.01);
    expect(w.en.dotT[near]).toBeGreaterThan(0);
    expect(w.en.vulnT[big]).toBeGreaterThan(5);
    expect(w.en.vulnK[big]).toBe(1);
  });

  it('Sasakibe’s Teacup heals you when a boss arrives; Kenpachi’s Eyepatch is for boss fights', () => {
    const w = quiet(['teacup', 'eyepatch']);
    w.player.hp = 400;
    expect(spoilDamageMul(w)).toBeCloseTo(0.9, 5);
    w.spawnEnemy(ENEMY_INDEX.ichibe, w.player.x + 300, w.player.y);
    (w as unknown as { bossCount: number }).bossCount = 1;
    steps(w, 1);
    expect(w.player.hp).toBeGreaterThan(640);
    expect(spoilDamageMul(w)).toBeCloseTo(1.35, 5);
  });

  it('Mayuri’s Vial now and then leaves a common enemy unable to move', () => {
    const w = quiet(['vial']);
    const i = hollow(w, 80);
    for (let k = 0; k < 60; k++) w.damageEnemy(i, 1);
    expect(w.en.freezeT[i]).toBeGreaterThan(0);
  });

  it('Shinji’s Hollow Mask: nothing roots you or turns you around', () => {
    const w = quiet(['mask']);
    w.spawnMark(MK_SEAL, MS_CIRCLE, w.player.x, w.player.y, 60, 0, 0, 0.01, 0, MF_ENEMY | MF_ROOT);
    steps(w, 2);
    expect(w.player.rootT).toBe(0);
    w.invert(3);
    expect(w.invertT).toBe(0);
  });

  it('Kirinden water heals you standing still; Kirio’s Rice Ball feeds every level-up', () => {
    const w = quiet(['spring', 'riceball']);
    w.player.hp = 500;
    steps(w, 90);
    expect(w.player.hp).toBeGreaterThan(520);
    w.recomputeStats();
    const max = w.player.maxHp;
    w.player.hp = max / 2;
    (w as unknown as { gainXp: (v: number) => void }).gainXp.call(w, w.xpNext / w.stats.xpGain + 0.01);
    expect(w.player.maxHp).toBe(max + 2);
    expect(w.player.hp).toBeGreaterThan(max / 2 + 2 + max * 0.09);
  });

  it('Uryū’s Silver Arrowhead counts toward The Almighty; the Hōgyoku answers once, at a quarter of your health', () => {
    const before = quiet().almightyProgress()?.have ?? 0;
    expect(quiet(['arrowhead']).almightyProgress()?.have).toBe(before + 1);
    const w = quiet(['hogyoku']);
    w.player.hp = 300;
    hit(w, 100);
    expect(w.player.hp).toBe(w.player.maxHp);
    expect(spoilDamageMul(w)).toBeCloseTo(1.15, 5);
    w.player.hp = 300;
    hit(w, 100);
    expect(w.player.hp).toBeLessThan(250);
  });
});
