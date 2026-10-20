import { TAU } from '../core/math';
import { densestPoint, enemiesInCircle } from './casts/common';
import { ENEMY_INDEX } from '../data/enemies';
import {
  DOT_FIRE,
  FLAG_BOSS,
  FLAG_EVENT,
  FLAG_ZOMBIE,
  FX_AVATAR,
  FX_CRESCENT,
  FX_GLOW,
  FX_RING,
  FX_SMOKE,
  FX_SNOW,
  HOLD_FEAR,
  HOLD_FREEZE,
  HOLD_STUN,
  LAYER_ADD,
  LAYER_NORMAL,
  MF_FREEZE,
  MK_CERO,
  MK_ICE,
  MK_SLASH,
  MS_ARC,
  MS_CIRCLE,
  MS_LINE,
} from './constants';
import type { World } from './world';

/**
 * What the spoils of war do (see data/spoils.ts). Each is held as its
 * special's name; the World calls in here from a few places: every step,
 * when you are hurt, when you strike, when something dies, and for the
 * damage and health they add. Their own strikes count as "other" damage.
 */
export class SpoilState {
  readonly has = new Set<string>();
  /** Any spoil held: the hot paths check this first. */
  on = false;
  ironT = 0;
  tally = 0;
  hornKills = 0;
  hornHp = 0;
  shots = 0;
  splashT = -1;
  iceCd = 0;
  stingUid = -1;
  stingReady = 0;
  tengenT = 10;
  emberT = 0;
  windT = 0;
  haoriCd = 0;
  stillT = 0;
  riceHp = 0;
  brushT = 20;
  taihoT = 14;
  tsukiT = 10;
  hogyoku = false;
  getsugaT = 8;
  calaveraT = 15;
  whirlT = 0;
  crowdT = 0;
  /** Grimmjow's jawbone: how many enemies stood close at the last count. */
  crowd = 0;
  /** Orihime's hairpins: health still to come back, and how fast. */
  rikkaPool = 0;
  rikkaRate = 0;
  readonly greeted = new Set<number>();
}

/** A spoil was won: it works from now on. */
export function gainSpoil(w: World, special: string): void {
  const s = w.spoil;
  s.has.add(special);
  s.on = true;
  if (special === 'scarf') w.goldBonus *= 1.5;
}

/** A spoil's own strike, so it is credited to "other" damage, not to whatever power hit last. */
function own(w: World, fn: () => void): void {
  const prev = w.dmgSlot;
  w.dmgSlot = 255;
  fn();
  w.dmgSlot = prev;
}

/** How hard the spoils' own strikes hit: they grow with the run. */
const power = (w: World, base: number, perLevel: number): number => base + w.level * perLevel;

export function spoilTick(w: World, dt: number): void {
  const s = w.spoil;
  const p = w.player;
  const moving = Math.abs(p.x - p.ox) + Math.abs(p.y - p.oy) > 0.05;
  if (s.has.has('ember')) {
    s.emberT -= dt;
    if (s.emberT <= 0) {
      s.emberT = 0.5;
      const n = enemiesInCircle(w, p.x, p.y, 95);
      own(w, () => {
        for (let k = 0; k < n; k++) w.applyDot(w.qout[k], 2, power(w, 8, 0.8), DOT_FIRE);
      });
    }
  }
  if (s.has.has('tachikaze') && moving) {
    s.windT -= dt;
    if (s.windT <= 0) {
      s.windT = 0.3;
      const a = Math.atan2(p.y - p.oy, p.x - p.ox) + Math.PI;
      own(w, () => w.spawnMark(MK_SLASH, MS_CIRCLE, p.x + Math.cos(a) * 34, p.y + Math.sin(a) * 34, 36, 0, 0, 0.05, power(w, 12, 1.2), 0));
    }
  }
  if (s.has.has('spring')) {
    s.stillT = moving ? 0 : s.stillT + dt;
    if (s.stillT > 0.6 && p.hp < p.maxHp) w.heal(0.03 * dt);
  }
  if (s.has.has('tengen')) {
    s.tengenT -= dt;
    if (s.tengenT <= 0) {
      s.tengenT = 10;
      own(w, () => w.spawnMark(MK_SLASH, MS_ARC, p.x, p.y, 220, 0.6, w.aim, 0.45, power(w, 60, 6), 0));
      w.spawnFx(FX_AVATAR, p.x - Math.cos(w.aim) * 30, p.y - Math.sin(w.aim) * 30 - 50, 0, 0, 0.9, 170, 170, 0.6, 0, 0, 0xc9b58a, LAYER_ADD);
      w.sound('punch');
    }
  }
  if (s.has.has('brush')) {
    s.brushT -= dt;
    if (s.brushT <= 0) {
      s.brushT = 20;
      const j = sturdiestInSight(w);
      if (j >= 0) {
        w.applyVuln(j, 6, 1);
        const E = w.en;
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * TAU;
          w.spawnFx(FX_SMOKE, E.x[j] + Math.cos(a) * E.r[j], E.y[j] + Math.sin(a) * E.r[j], 0, -20, 0.8, E.r[j] * 0.6, E.r[j] * 1.4, 0.8, 0, 0, 0x120c1c, LAYER_NORMAL);
        }
        w.messages.push({ text: 'Ichimonji takes its name: double damage', kind: 'info' });
      }
    }
  }
  if (s.has.has('taiho')) {
    s.taihoT -= dt;
    if (s.taihoT <= 0) {
      s.taihoT = 14;
      const a = densestPoint(w, 420) ? Math.atan2(w.ty - p.y, w.tx - p.x) : w.aim;
      own(w, () => w.spawnMark(MK_CERO, MS_LINE, p.x, p.y, 56, 760, a, 0.2, power(w, 90, 7), 0));
      w.sound('beam');
    }
  }
  if (s.has.has('tsukishiro')) {
    s.tsukiT -= dt;
    if (s.tsukiT <= 0) {
      s.tsukiT = 10;
      if (densestPoint(w, 380)) {
        own(w, () => w.spawnMark(MK_ICE, MS_CIRCLE, w.tx, w.ty, 85, 0, 0, 0.45, power(w, 45, 4), MF_FREEZE));
      }
    }
  }
  if (s.has.has('calavera')) {
    s.calaveraT -= dt;
    if (s.calaveraT <= 0) {
      s.calaveraT = 15;
      // Two of Rudbornn's Calaveras rise on your side, and crumble when their time is up.
      for (const dir of [-1, 1]) {
        const j = w.spawnEnemy(ENEMY_INDEX.exequias, p.x + dir * 40, p.y + 10);
        if (j < 0) continue;
        const E = w.en;
        E.xp[j] = 0;
        E.flags[j] |= FLAG_ZOMBIE;
        E.charmT[j] = 10;
        E.charmDmg[j] = power(w, 14, 1.4);
        E.charmSrc[j] = 255;
        w.spawnFx(FX_GLOW, E.x[j], E.y[j], 0, 0, 0.4, E.r[j] * 1.5, E.r[j] * 3.5, 0.8, 0, 0, 0xd8d0b8, LAYER_ADD);
      }
      w.sound('rise');
    }
  }
  if (s.has.has('giralda') && moving) {
    s.whirlT -= dt;
    if (s.whirlT <= 0) {
      s.whirlT = 0.35;
      const n = enemiesInCircle(w, p.x, p.y, 80);
      own(w, () => {
        for (let k = 0; k < n; k++) w.damageEnemy(w.qout[k], power(w, 6, 0.6), 420, p.x, p.y);
      });
      if (n > 0) w.spawnFx(FX_RING, 0, 0, 0, 0, 0.3, 20, 170, 0.6, 0, 0, 0x9fe0d0, LAYER_ADD, 0, 1);
    }
  }
  if (s.rikkaPool > 0) {
    const back = Math.min(s.rikkaPool, s.rikkaRate * dt);
    s.rikkaPool -= back;
    w.healFlat(back);
  }
  if (s.has.has('pantera')) {
    s.crowdT -= dt;
    if (s.crowdT <= 0) {
      s.crowdT = 0.25;
      s.crowd = enemiesInCircle(w, p.x, p.y, 150);
    }
  }
  if (s.has.has('getsuga')) {
    s.getsugaT -= dt;
    if (s.getsugaT <= 0) {
      s.getsugaT = 8;
      const a = w.aim;
      own(w, () => w.spawnMark(MK_SLASH, MS_LINE, p.x, p.y, 64, 560, a, 0.05, power(w, 80, 6), 0));
      w.spawnFx(FX_CRESCENT, p.x, p.y, Math.cos(a) * 900, Math.sin(a) * 900, 0.55, 60, 70, 1, a, 0, 0x2a1a24, LAYER_NORMAL);
      w.spawnFx(FX_CRESCENT, p.x, p.y, Math.cos(a) * 900, Math.sin(a) * 900, 0.55, 64, 74, 0.7, a, 0, 0xff3048, LAYER_ADD);
      w.sound('blade');
    }
  }
}

/** The enemy in sight with the most health left (a boss if one is out), or -1. */
function sturdiestInSight(w: World): number {
  const E = w.en;
  const p = w.player;
  let best = -1;
  let hp = 0;
  for (let i = 0; i < E.n; i++) {
    if (E.dead[i] || E.charmT[i] > 0 || E.flags[i] & FLAG_EVENT) continue;
    if (Math.abs(E.x[i] - p.x) > w.viewHalfW || Math.abs(E.y[i] - p.y) > w.viewHalfH) continue;
    if (E.hp[i] > hp) {
      hp = E.hp[i];
      best = i;
    }
  }
  return best;
}

/** A blow is about to land for `dealt` health: what the spoils let through (0 when it slides off). */
export function spoilBeforeHurt(w: World, dealt: number): number {
  const s = w.spoil;
  const p = w.player;
  if (s.has.has('haori') && dealt >= p.maxHp * 0.25 && w.t >= s.haoriCd) {
    s.haoriCd = w.t + 30;
    w.messages.push({ text: 'Kyōraku’s haori turns the blow aside', kind: 'info' });
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU;
      w.spawnFx(FX_GLOW, p.x + Math.cos(a) * 20, p.y + Math.sin(a) * 20, Math.cos(a) * 60, Math.sin(a) * 60, 0.5, 8, 4, 0.9, 0, 0, 0xff9ac8, LAYER_ADD);
    }
    return 0;
  }
  if (s.has.has('ironscale') && w.t < s.ironT) return dealt * 0.4;
  return dealt;
}

/** You were hurt for `lost` health. */
export function spoilAfterHurt(w: World, lost: number): void {
  if (lost <= 0) return;
  const s = w.spoil;
  const p = w.player;
  if (s.has.has('ironscale')) s.ironT = w.t + 2;
  if (s.has.has('rikka')) {
    // Sōten Kisshun rejects a third of the wound: it heals back over the next 4 s.
    s.rikkaPool += lost / 3;
    s.rikkaRate = s.rikkaPool / 4;
  }
  if (s.has.has('fearthorn')) {
    const n = enemiesInCircle(w, p.x, p.y, 150);
    for (let k = 0; k < n; k++) w.applyHold(w.qout[k], 1.5, HOLD_FEAR);
    w.spawnFx(FX_RING, 0, 0, 0, 0, 0.4, 20, 320, 0.8, 0, 0, 0x9a7ab8, LAYER_ADD, 0, 1);
  }
  if (s.has.has('iceflower') && p.hp < p.maxHp * 0.5 && w.t >= s.iceCd) {
    s.iceCd = w.t + 30;
    const n = enemiesInCircle(w, p.x, p.y, 230);
    for (let k = 0; k < n; k++) {
      const j = w.qout[k];
      w.applyHold(j, 3, HOLD_FREEZE);
      w.applyVuln(j, 3, 0.5);
    }
    w.spawnFx(FX_RING, 0, 0, 0, 0, 0.6, 30, 480, 0.9, 0, 0, 0xbfe8ff, LAYER_ADD, 0, 1);
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * TAU;
      w.spawnFx(FX_SNOW, p.x, p.y, Math.cos(a) * 200, Math.sin(a) * 200, 0.8, 16, 8, 1, a, 3, 0xe8f8ff, LAYER_ADD, 2);
    }
    w.messages.push({ text: 'Ice flowers bloom around you', kind: 'info' });
    w.sound('freeze');
  }
  if (s.has.has('hogyoku') && !s.hogyoku && p.alive && p.hp > 0 && p.hp < p.maxHp * 0.25) {
    s.hogyoku = true;
    p.hp = p.maxHp;
    w.spawnFx(FX_GLOW, 0, 0, 0, 0, 0.9, 40, 520, 1, 0, 0, 0xb89aff, LAYER_ADD, 0, 1);
    w.banners.push({ kind: 'spoil', title: 'The Hōgyoku answers', sub: 'Your wounds close, and you strike harder from now on' });
    w.sound('almighty');
  }
}

/** Damage about to land on enemy i: what the spoils make of it. */
export function spoilDamage(w: World, i: number, dmg: number, crit: boolean): number {
  const s = w.spoil;
  const E = w.en;
  const boss = (E.flags[i] & FLAG_BOSS) !== 0;
  if (boss && s.has.has('datacore')) dmg *= 1 + Math.min(0.3, Math.floor(w.bossAge(i) / 10) * 0.03);
  if (s.has.has('whetstone') && w.powers[w.dmgSlot]?.attr) dmg *= 1.12;
  if (s.has.has('stinger')) {
    if (s.stingUid === E.uid[i] && !(E.flags[i] & FLAG_EVENT)) {
      // The second sting on the Hōmonka.
      s.stingUid = -1;
      dmg += boss ? E.maxHp[i] * 0.03 : E.hp[i];
      w.spawnFx(FX_RING, E.x[i], E.y[i], 0, 0, 0.35, E.r[i] * 2.4, E.r[i] * 0.6, 1, 0, 0, 0xe8c34a, LAYER_ADD);
    } else if (s.stingUid < 0 && w.t >= s.stingReady) {
      s.stingUid = E.uid[i];
      s.stingReady = w.t + 5;
      w.spawnFx(FX_RING, E.x[i], E.y[i], 0, 0, 0.5, E.r[i] * 0.6, E.r[i] * 2.2, 0.9, 0, 0, 0x1a1020, LAYER_NORMAL);
    }
  }
  if (!boss && s.has.has('vial') && w.rng.next() < 0.1) w.applyHold(i, 2, HOLD_STUN);
  if (crit && s.has.has('lagota') && w.t - s.splashT > 0.08) {
    s.splashT = w.t;
    w.queueBurst(E.x[i], E.y[i], 40 * w.stats.size, dmg * 0.3, 255);
    w.spawnFx(FX_GLOW, E.x[i], E.y[i], 0, 0, 0.3, 10, 50, 0.8, 0, 0, 0x5ac8ff, LAYER_ADD);
  }
  return dmg;
}

/** Something died at (x, y). */
export function spoilKill(w: World, x: number, y: number, boss: boolean): void {
  const s = w.spoil;
  if (boss) {
    if (s.has.has('tally') && s.tally < 6) s.tally++;
    return;
  }
  if (s.has.has('spark') && w.rng.next() < 0.125) {
    w.queueBurst(x, y, 56 * w.stats.size, power(w, 20, 2.5), 255);
    w.blastFx(x, y, 40, 0xff9a4a, 2);
  }
  if (s.has.has('horn') && s.hornHp < 50 && ++s.hornKills % 50 === 0) {
    s.hornHp++;
    // Recomputing raises your health along with its maximum.
    w.recomputeStats();
  }
}

/** A level-up came. */
export function spoilLevelUp(w: World): void {
  const s = w.spoil;
  if (!s.has.has('riceball')) return;
  if (s.riceHp < 60) {
    s.riceHp = Math.min(60, s.riceHp + 2);
    w.recomputeStats();
  }
  w.heal(0.1);
}

/** Flat max health the spoils add (Ayon's antler, Kirio's rice). */
export function spoilMaxHp(w: World): number {
  return w.spoil.hornHp + w.spoil.riceHp;
}

/** What the spoils multiply your damage by right now. */
export function spoilDamageMul(w: World): number {
  const s = w.spoil;
  let m = 1;
  if (s.tally > 0) m *= 1 + 0.08 * s.tally;
  if (s.has.has('eyepatch')) m *= w.boss.active ? 1.35 : 0.9;
  if (s.hogyoku) m *= 1.15;
  if (s.has.has('pantera')) m *= 1 + Math.min(0.3, 0.02 * s.crowd);
  return m;
}

/** What an enemy's touch is cut to before it hurts you (the Giant's arm). */
export function spoilContactTaken(w: World): number {
  return w.spoil.on && w.spoil.has.has('gigante') ? 0.75 : 1;
}

/** How much longer, and hotter, your fire burns (Engetsu). */
export function spoilFire(w: World): { secs: number; dps: number } {
  return w.spoil.on && w.spoil.has.has('engetsu') ? { secs: 2, dps: 1.3 } : { secs: 1, dps: 1 };
}

/** How many relics a chest offers (Urahara's hat adds one). */
export function spoilChestChoices(w: World): number {
  return w.spoil.on && w.spoil.has.has('hat') ? 4 : 3;
}

/** What an enemy shot, beam or blast is cut to before it hurts you (Dragra's scale). */
export function spoilShotTaken(w: World): number {
  return w.spoil.on && w.spoil.has.has('dragra') ? 0.7 : 1;
}

/** An enemy shot is about to hit you: true if Neliel's mask swallows it instead (every sixth). */
export function spoilSwallow(w: World): boolean {
  const s = w.spoil;
  if (!s.has.has('cerodoble') || ++s.shots % 6 !== 0) return false;
  const p = w.player;
  const j = w.randomEnemyNear(420);
  const a = j >= 0 ? Math.atan2(w.en.y[j] - p.y, w.en.x[j] - p.x) : w.aim;
  own(w, () => w.spawnMark(MK_CERO, MS_LINE, p.x, p.y, 46, 700, a, 0.15, power(w, 50, 4), 0));
  w.spawnFx(FX_GLOW, 0, 0, 0, 0, 0.3, 20, 90, 0.9, 0, 0, 0x9dffd8, LAYER_ADD, 0, 1);
  return true;
}

/** Shinji's mask: nothing slows, roots or turns you around. */
export function spoilSteady(w: World): boolean {
  return w.spoil.has.has('mask');
}

/** A boss you had not met yet came into view (Sasakibe's tea). */
export function spoilGreet(w: World, uid: number): void {
  const s = w.spoil;
  if (!s.has.has('teacup') || s.greeted.has(uid)) return;
  s.greeted.add(uid);
  w.heal(0.25);
  w.messages.push({ text: 'A moment for tea: you heal', kind: 'info' });
  w.sound('heal');
}
