import { CAP, DT, GRID_CELL, GRID_DIM, MAX_ENEMIES_ALIVE, PLAYER } from '../config';
import { SpatialGrid } from '../core/grid';
import { TAU } from '../core/math';
import { Rng } from '../core/rng';
import { BANKAI_BY_ID, BANKAI_IDS } from '../data/bankai';
import { ENEMY_INDEX, ENEMY_LIST } from '../data/enemies';
import { PASSIVE_BY_ID, PASSIVES } from '../data/passives';
import { enemyKey } from '../data/codex';
import { FRAGMENT_IDS } from '../data/fragments';
import { POWER_BY_ID, POWERS, STARTABLE_IDS, STARTING_POWER, upgradeCap } from '../data/powers';
import { RELIC_BY_ID, RELICS, type RelicDef } from '../data/relics';
import { PACT_BY_ID, PACTS, type PactDef } from '../data/shrines';
import { GOTEI_BY_ID, GOTEI_IDS } from '../data/gotei';
import { ROYAL_BY_ID, ROYAL_IDS } from '../data/royal';
import { RESONANCE_BY_ID, RESONANCES, resonanceParts } from '../data/resonances';
import { BOSS_LINES } from '../data/story';
import {
  hpScale,
  phaseAt,
  spawnRate,
  speedScale,
  stageById,
  trialMods,
  xpScale,
  type StageDef,
  type TimelineEvent,
  type TrialMods,
} from '../data/stages';
import { updateMarks, updateZones } from './areas';
import { rewrite } from './casts/almighty';
import { burstAt, enemiesInCircle } from './casts/common';
import { explodeBomb, steerMissile, strikeAt } from './casts/schrift';
import { reverseWound } from './casts/schrift2';
import {
  BH_BLINK,
  BH_CHARGE,
  BH_CHASE,
  BH_FLEE,
  BH_RANGED,
  DOT_FIRE,
  FLAG_BLOODBURST,
  FLAG_BOSS,
  FLAG_ELITE,
  FLAG_EVENT,
  FLAG_HEARTBREAK,
  FLAG_PLAGUE,
  FLAG_ZOMBIE,
  FX_ASH,
  FX_BEAMH,
  FX_DOT,
  FX_GLOW,
  FX_SHOCK,
  FX_SMOKE,
  FX_MASK,
  FX_RING,
  FX_SPARK,
  HOLD_FEAR,
  HOLD_FREEZE,
  LAYER_ADD,
  LAYER_NORMAL,
  PF_BURST,
  PF_CHARM,
  PF_FREEZE,
  PF_HOMING,
  PF_INFECT,
  PF_SPECIAL,
  PF_STUN,
  PK_ARROW,
  PK_BLADE,
  PK_BOMB,
  PK_DRAGON,
  PK_DRONE,
  PK_HEART,
  PK_MISSILE,
  PK_PETAL,
  PK_SHARD,
  ZK_POISON,
  MK_GAS,
  MF_ENEMY,
  MS_CIRCLE,
} from './constants';
import { blinkAI, bossAI, casterAI, chargeAI, COMMANDER_HEAT, eliteAI, eventAI, updateEnemyBullets } from './hostile';
import { generateOffers, rollRelics, type ChestKind, type Offer } from './offers';
import { EBulletPool, EnemyPool, FxPool, HITS, MarkPool, NumberRing, OrbPool, ProjPool, ZonePool } from './pools';
import { newPowerState, refreshPowerStats, syncPower, updatePowers, type PowerState } from './powers';
import { computeStats, damageMultiplier, scaleMods, type StatMods, type Stats } from './stats';
import { xpToNext } from './xp';

export type PickupKind = 'chest' | 'chestBlack' | 'heart' | 'magnet' | 'nuke' | 'medallion' | 'shrine' | 'fragment';

export interface Pickup {
  kind: PickupKind;
  x: number;
  y: number;
  born: number;
  /** Medallions: the bankai inside. */
  bankai?: string;
  /** Fragments of the Soul King: which one. */
  fragment?: string;
}

export interface Message {
  text: string;
  kind: 'boss' | 'info';
}

/** A title card: a boss arriving, a bankai taken back, a resonance, an event, or The Almighty awakening. */
export interface Banner {
  kind: 'bankai' | 'boss' | 'almighty' | 'resonance' | 'event' | 'evolve' | 'fragment';
  title: string;
  sub: string;
  /** What a boss says (or does) as it arrives. */
  quote?: string;
}

export type SoundName =
  | 'shoot'
  | 'blade'
  | 'pulse'
  | 'strike'
  | 'hit'
  | 'kill'
  | 'orb'
  | 'level'
  | 'chest'
  | 'hurt'
  | 'boss'
  | 'nuke'
  | 'freeze'
  | 'heal'
  | 'magnet'
  | 'explode'
  | 'bankai'
  | 'warn'
  | 'beam'
  | 'fire'
  | 'thorn'
  | 'gust'
  | 'shield'
  | 'blast'
  | 'bite'
  | 'charm'
  | 'punch'
  | 'rise'
  | 'almighty';

export interface WorldOptions {
  seed?: number;
  /** Keep this many enemies alive and max every power, for performance testing. Implies god mode. */
  stress?: number;
  god?: boolean;
  /** Start the clock here (seconds) to test late-game spawns. */
  startTime?: number;
  numbers?: boolean;
  /** Force which bankai the bearers carry, in order (testing). */
  bearers?: string[];
  /** Stage id; Hueco Mundo when missing or unknown. */
  stage?: string;
  /** A · The Almighty is unlocked: it awakens once three Schrift reach Lv 7. */
  almighty?: boolean;
  /** Archives upgrades: stat mods for the whole run, extra revives and level-up rerolls. */
  meta?: StatMods;
  revives?: number;
  rerolls?: number;
  /** The Schrift the run opens with (an attack; anything else falls back to Heilig Pfeil). */
  start?: string;
  /** A second attack held from the start (the Daily Trial's Schrift). */
  extra?: string;
  /** Trial tier, 0 (normal) to 5. */
  trial?: number;
  /** Endless: the final boss does not end the run; the night goes on until you fall. */
  endless?: boolean;
  /** Boss Rush: the stage's bosses one after another, and nothing else on the timeline. */
  bossRush?: boolean;
  /** Relics opened by feats, which may now turn up in chests. */
  relicsOpen?: string[];
  /** A relic from the Armory the run starts with. */
  relic?: string;
  /** Gintō reserve: level-ups waiting as the run begins. */
  startLevels?: number;
  /** The Emperor's Foresight: extra cards on every level-up board. */
  choices?: number;
  /** Daily Trial modifiers (see data/daily.ts). */
  mods?: string[];
}

interface Warning {
  at: number;
  text: string;
  /** The timeline event it warns of, so a boss called early by a pact is not announced again. */
  ev: number;
}

function orbTier(v: number): number {
  return v >= 20 ? 2 : v >= 4 ? 1 : 0;
}

const MAX_BURSTS = 64;

/** Powers taken back in one run that wake The Almighty, and how many once all six bankai were ever taken back. */
export const ALMIGHTY_AT = 5;
export const ALMIGHTY_AT_UNLOCKED = 3;

/** Boss Rush: each wave's health against a full run's, wave by wave (you meet them with far fewer levels). */
const RUSH_HP = [1, 0.8, 0.55, 0.36];
/** ...and how hard they hit: the Emperor faces the first wave with a run's first levels and base health. */
const RUSH_DMG = [0.6, 0.75, 0.85, 0.9];

/** Pickups you walk to rather than hoover up: never pulled by the magnet, never dropped for space. */
const BIG_PICKUPS: ReadonlySet<PickupKind> = new Set<PickupKind>(['chest', 'chestBlack', 'medallion', 'shrine', 'fragment']);

/** Blut Rush: kills chained without being hit, each tier adding damage and speed while the chain holds. */
export const RUSH_TIERS = [60, 200, 500] as const;
const RUSH_WINDOW = 2;
const RUSH_DAMAGE = 0.05;
const RUSH_SPEED = 0.03;

const BEHAVIOR_CODE = { chase: BH_CHASE, blink: BH_BLINK, ranged: BH_RANGED, flee: BH_FLEE, charge: BH_CHARGE } as const;
/** Per enemy type, for the hot loop. */
const BEHAVIOR = Uint8Array.from(ENEMY_LIST, (d) => BEHAVIOR_CODE[d.behavior]);

/** One run's whole simulation. Pure logic: the renderer and UI only read it. */
export class World {
  readonly rng: Rng;
  readonly stage: StageDef;
  readonly trial: number;
  readonly endless: boolean;
  readonly bossRush: boolean;
  /** Relics a feat has opened; the other locked ones never come out of a chest. */
  private readonly relicsOpen: ReadonlySet<string>;
  /** Boss Rush: the waves still to come (a boss and its escort each), and when the next one arrives. */
  private rushQueue: TimelineEvent[][] = [];
  private rushNext = 0;
  /** Which wave is arriving, for its damage. */
  private rushWave = 0;
  private readonly tm: TrialMods;
  /** Daily Trial modifiers, and what they add up to. */
  readonly mods: ReadonlySet<string>;
  private readonly modHp: number;
  private readonly modSpawn: number;
  private readonly modSpeed: number;
  private readonly modRadius: number;
  private readonly modDealt: number;
  private readonly modTaken: number;
  private readonly modMove: number;
  /** Endless: when the next wave of bosses comes, and how many have come. */
  private endlessNext = 0;
  private endlessWave = 0;
  readonly en = new EnemyPool(CAP.enemies);
  readonly pr = new ProjPool(CAP.projectiles);
  readonly orbs = new OrbPool(CAP.orbs);
  readonly fx = new FxPool(CAP.fx);
  readonly zones = new ZonePool(CAP.zones);
  readonly marks = new MarkPool(CAP.marks);
  readonly eb = new EBulletPool(CAP.ebullets);
  readonly nums = new NumberRing(CAP.numbers);
  readonly pickups: Pickup[] = [];
  readonly grid = new SpatialGrid(GRID_CELL, GRID_DIM, CAP.enemies);
  /** Grid query scratch: qbuf for top-level loops, qbuf2 inside them, qraw/qout for the area helpers. */
  readonly qbuf = new Int32Array(4096);
  readonly qbuf2 = new Int32Array(4096);
  readonly qraw = new Int32Array(4096);
  readonly qout = new Int32Array(4096);

  readonly player = {
    x: 0,
    y: 0,
    ox: 0,
    oy: 0,
    hp: PLAYER.hp as number,
    maxHp: PLAYER.hp as number,
    iframes: 0,
    face: 1,
    alive: true,
    revives: 0,
    slowT: 0,
    /** Rooted by a binding seal: cannot move. */
    rootT: 0,
  };

  t = 0;
  steps = 0;
  level = 1;
  xp = 0;
  xpNext = xpToNext(1);
  kills = 0;
  gold = 0;
  pendingLevelUps = 0;
  readonly pendingChests: ChestKind[] = [];
  readonly messages: Message[] = [];
  readonly banners: Banner[] = [];
  readonly sounds = new Set<SoundName>();
  shake = 0;
  over: 'dead' | 'victory' | null = null;

  readonly powers: PowerState[] = [];
  readonly passives = new Map<string, number>();
  /** Resonances owned this run (two awakened Schrift working together). */
  readonly resonances = new Set<string>();
  readonly relics: RelicDef[] = [];
  stats: Stats = computeStats([]);
  /** Damage multiplier used by every hit: stats plus temporary boosts (Superstar, Overkill, Sanrei). */
  dmgMul = 1;
  private baseDmgMul = 1;

  /** The three bankai this run's medallion bearers carry, in boss order. */
  readonly bearers: string[];

  // Player states from utilities.
  shieldCharges = 0;
  shieldMax = 0;
  ironBurst = 0;
  superT = 0;
  superAmt = 0;
  vollT = 0;
  overkillEvery = 0;
  overkillPer = 0;
  overkillCap = 0;
  overkillStart = 0;
  /** The Balance: share of each hit shrugged off, and the burst it sends into enemies within balanceR. */
  balanceCut = 0;
  balanceDmg = 0;
  balanceR = 0;
  /** The Miracle: extra damage at zero health, and regen per second below 35% health. */
  miracleAmt = 0;
  miracleRegen = 0;
  /** The Zombie: how risen enemies behave, and how many are up right now. */
  zombieLife = 0;
  zombieDps = 0;
  zombieMax = 0;
  zombieFull = false;
  zombiePlague = false;
  zombieBurst = false;
  zombieN = 0;
  /** A · The Almighty: while almightyT > 0 time stands still; then the strike in rewrite(). */
  readonly almightyUnlocked: boolean;
  almightyGranted = false;
  /** Zanka no Tachi has been taken from the Captain-Commander this run: he fights on without it. */
  zankaStolen = false;
  /** Licht Regen: time to the next arrows of light. */
  rainT = 0;
  /** Sakanade: seconds left with your directions inverted. */
  invertT = 0;
  /** Schutzstaffel: the slots (as bits) of The X-Axis and The Deathdealing, which grow with your wounds. */
  private schutzBits = 0;
  /** The Almighty is on its way: earned, arriving a moment later under its own title card. */
  private almightyDue = 0;
  almightyT = 0;
  almightyMax = 1;
  almightyDmg = 0;
  almightyBoss = 0;
  /** Chance that a hit never happens (The Almighty's foresight). */
  foresight = 0;
  /** Level-up boards that can still be redrawn this run (Second Auswählen). */
  rerolls = 0;
  /** Blut Rush: kills in the current chain, seconds since the last one, and the tier reached. */
  streak = 0;
  streakT = 0;
  rushTier = 0;
  /** Longest chain this run. */
  bestStreak = 0;
  /** Highest Blut Rush tier announced this run (each is announced once). */
  private rushAnnounced = 0;
  /** Run events: when the next may come, and the Reishi Storm's time left. */
  nextEventT = 0;
  stormT = 0;
  private stormAcc = 0;
  /** Bosses killed before the final one, for the run's gold. */
  bossKills = 0;
  /** Archives upgrades, applied on top of passives and relics. */
  private readonly metaMods: StatMods | null;
  /** Direction you last moved, radians: aim for powers that fire "where you are heading". */
  aim = -Math.PI / 2;

  /** Half the visible area in world units; the renderer keeps this current. */
  viewHalfW = 210;
  viewHalfH = 455;
  showNumbers: boolean;
  readonly god: boolean;
  readonly stress: number;
  /** Stopped Hourglass relic: seconds left of the global freeze. */
  freezeAllT = 0;
  /** The first live boss, for the boss health bar (final: it is the stage's last boss). */
  /** The boss on screen, for the HUD: who it is (type and variant pick the portrait) and how hurt. */
  readonly boss = { active: false, hp: 0, max: 1, name: '', sub: '', final: false, type: -1, variant: 0, uid: -1 };
  /** Bumped whenever a power is gained, levelled or awakened, so the HUD redraws its tray only then. */
  buildVersion = 0;
  /** Ichimonji: the power slot that is silenced, and for how long. */
  sealSlot = -1;
  sealT = 0;
  /** The Heart of the Soul King's surge: you cannot be hurt while it lasts. */
  surgeT = 0;
  /** Fragments that already dropped this run. */
  private readonly dropped = new Set<string>();
  /** The Antithesis: health lost since its last reversal. */
  takenSince = 0;
  /** Overkill Storm: kills toward the next strike, and a guard against kills inside it starting another. */
  private stormKills = 0;
  private inStorm = false;
  /** Kills this run by Codex key (named bosses each under their own). */
  readonly killsBy = new Map<string, number>();
  /** Shrines: a pact board is waiting, the pacts made this run, and what they add up to. */
  pendingShrine = false;
  readonly pacts = new Set<string>();
  private readonly pactMods: StatMods[] = [];
  private pactHp = 1;
  private pactSpeed = 1;
  /** Multiplies the gold the run pays out (the Pact of Greed). */
  goldBonus = 1;
  /** The Wandenreich Pact: chests pay gold instead of relics. */
  private chestGold = false;
  /** The boss a Hunter's Pact called, which owes an extra black chest. */
  private huntUid = -1;
  /** Timeline events a pact already brought forward. */
  private readonly calledEarly = new Set<number>();
  /**
   * How far the Emperor has visibly evolved this run: 1 reishi wings, 2 eyes
   * on his cloak, 3 the Almighty's shadow. A new tier is revealed a moment
   * after it is earned, so its title card follows the one that earned it.
   */
  evolution = 0;
  private evolveNext = 0;
  private evolveT = 0;
  /** The power slot that the damage being dealt right now belongs to; 255 is everything else (runes, revives). */
  dmgSlot = 255;
  /** Damage dealt this run by power slot (255: everything else), counting only health actually removed. */
  readonly dmgBy = new Float64Array(256);
  /** When the run began, for the damage per second of everything else. */
  private readonly startT: number;
  /** Scratch target written by densestPoint() and edgePoint(). */
  tx = 0;
  ty = 0;
  /** A valid target for your powers: alive and not fighting on your side. */
  readonly isAlive = (i: number): boolean => this.en.dead[i] === 0 && this.en.charmT[i] <= 0;

  private bossCount = 0;
  private evCursor = 0;
  private warnCursor = 0;
  private readonly warnings: Warning[];
  private spawnAcc = 0;
  private uidSeq = 0;
  private moveX = 0;
  private moveY = -1;
  private clockCd = 20;
  private sigilCd = 6;
  private hasClock = false;
  private hasSigil = false;
  private hasSanrei = false;
  private sanreiOff = false;
  private finalBossUid = -1;
  private victoryT = -1;
  private readonly bursts = new Float32Array(MAX_BURSTS * 5);
  private burstN = 0;

  constructor(opts: WorldOptions = {}) {
    this.rng = new Rng(opts.seed);
    this.metaMods = opts.meta ?? null;
    this.stage = stageById(opts.stage);
    this.trial = Math.max(0, Math.min(5, Math.floor(opts.trial ?? 0)));
    this.tm = trialMods(this.trial);
    this.endless = !!opts.endless;
    this.bossRush = !!opts.bossRush && !this.endless;
    this.relicsOpen = new Set(opts.relicsOpen ?? []);
    const mods = new Set(opts.mods ?? []);
    this.mods = mods;
    this.modHp = (mods.has('swarm') ? 0.85 : 1) * (mods.has('giants') ? 1.5 : 1);
    this.modSpawn = mods.has('swarm') ? 1.35 : 1;
    this.modSpeed = (mods.has('giants') ? 0.85 : 1) * (mods.has('haste') ? 1.15 : 1);
    this.modRadius = mods.has('giants') ? 1.15 : 1;
    this.modDealt = mods.has('glass') ? 1.4 : 1;
    this.modTaken = mods.has('glass') ? 1.4 : 1;
    this.modMove = mods.has('haste') ? 1.15 : 1;
    this.almightyUnlocked = !!opts.almighty;
    this.stress = Math.max(0, Math.floor(opts.stress ?? 0));
    this.god = !!opts.god || this.stress > 0;
    this.showNumbers = opts.numbers ?? true;

    // Draw this run's bearers: three different bankai from the stage's pool (in the palace, three
    // of the Royal Guard), any forced ones first.
    const roster = this.rosterIds();
    const pool = (this.stage.roster ? roster : (this.stage.bearerPool ?? BANKAI_IDS)).slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = this.rng.int(i + 1);
      const tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }
    const forced = (opts.bearers ?? []).filter((id) => roster.includes(id));
    this.bearers = [...forced, ...pool.filter((id) => !forced.includes(id))].slice(0, 3);

    this.warnings = [];
    const events = this.stage.events;
    events.forEach((e, ev) => {
      if (e.kind === 'bearer') {
        const text =
          this.stage.roster === 'royal'
            ? 'A guardian of the palace approaches'
            : this.stage.roster === 'gotei' || this.stage.captains
              ? 'A captain approaches'
              : 'A medallion bearer approaches';
        this.warnings.push({ at: e.at - 4, text, ev });
      }
      else if (e.kind === 'boss') this.warnings.push({ at: e.at - 4, text: e.warn, ev });
    });

    const start = Math.max(0, opts.startTime ?? 0);
    this.startT = start;
    if (start > 0) {
      this.t = start;
      while (this.evCursor < events.length && events[this.evCursor].at < start) this.evCursor++;
      while (this.warnCursor < this.warnings.length && this.warnings[this.warnCursor].at < start) this.warnCursor++;
    }
    this.nextEventT = this.t + this.rng.range(100, 140);
    if (this.bossRush) this.setupBossRush();
    this.addPower(opts.start && STARTABLE_IDS.includes(opts.start) ? opts.start : STARTING_POWER);
    if (opts.extra && STARTABLE_IDS.includes(opts.extra) && !this.powers.some((ps) => ps.def.id === opts.extra)) this.addPower(opts.extra);
    this.player.revives += Math.max(0, Math.floor(opts.revives ?? 0));
    this.rerolls = Math.max(0, Math.floor(opts.rerolls ?? 0));
    // The Armory's relic, the Gintō reserve and the Emperor's Foresight.
    const relic = opts.relic ? RELIC_BY_ID.get(opts.relic) : undefined;
    if (relic && (!relic.locked || this.relicsOpen.has(relic.id))) this.addRelic(relic.id);
    this.pendingLevelUps += Math.max(0, Math.floor(opts.startLevels ?? 0));
    this.choices = 3 + Math.max(0, Math.floor(opts.choices ?? 0));
    if (this.stress > 0) {
      for (const def of POWERS) {
        if (def.group === 'bankai') continue;
        this.addPower(def.id);
        while (this.powerLevel(def.id) < upgradeCap(def)) this.addPower(def.id);
      }
    }
    this.recomputeStats();
    this.player.hp = this.player.maxHp;
  }

  // ---------------------------------------------------------------- step

  /** Advance one fixed 1/60 s step. (mx, my) is the joystick vector. */
  step(mx: number, my: number): void {
    if (this.over) return;
    // Sakanade: every direction comes out backwards.
    if (this.invertT > 0) {
      this.invertT -= DT;
      mx = -mx;
      my = -my;
    }
    this.t += DT;
    this.steps++;
    this.updateBuffs();
    const p = this.player;
    p.ox = p.x;
    p.oy = p.y;
    let speed = PLAYER.speed * this.stats.moveSpeed * this.modMove;
    if (this.vollT > 0) speed *= 1.3;
    if (this.rushTier > 0) speed *= 1 + RUSH_SPEED * this.rushTier;
    if (p.slowT > 0) {
      p.slowT -= DT;
      speed *= 0.6;
    }
    if (p.rootT > 0) {
      p.rootT -= DT;
      speed = 0;
    }
    p.x += mx * speed * DT;
    p.y += my * speed * DT;
    if (mx > 0.05) p.face = 1;
    else if (mx < -0.05) p.face = -1;
    if (mx !== 0 || my !== 0) {
      this.moveX = mx;
      this.moveY = my;
      this.aim = Math.atan2(my, mx);
    }
    this.runTimeline();
    this.spawnTick();
    this.grid.build(this.en.x, this.en.y, this.en.dead, this.en.n, p.x, p.y);
    this.updateEnemies();
    updatePowers(this);
    this.updateProjectiles();
    this.flushBursts();
    updateMarks(this);
    updateZones(this);
    this.dmgSlot = 255;
    updateEnemyBullets(this);
    this.updateOrbs();
    this.updatePickups();
    this.updateFx();
    this.updateNumbers();
    this.updateTimers();
    this.compact();
  }

  sound(name: SoundName): void {
    this.sounds.add(name);
  }

  private updateBuffs(): void {
    if (this.superT > 0) this.superT -= DT;
    if (this.vollT > 0) this.vollT -= DT;
    let mul = this.modDealt;
    if (this.superT > 0) mul *= 1 + this.superAmt;
    if (this.overkillEvery > 0) {
      const stacks = Math.floor((this.kills - this.overkillStart) / this.overkillEvery);
      mul *= 1 + Math.min(this.overkillCap, stacks * this.overkillPer);
    }
    if (this.miracleAmt > 0) {
      // Heart of the King: while the Heart beats, The Miracle counts you as all but fallen.
      const lost = this.surgeT > 0 && this.resonances.has('kingsheart') ? 1 : 1 - Math.max(0, this.player.hp) / this.player.maxHp;
      mul *= 1 + this.miracleAmt * lost;
    }
    if (this.rushTier > 0) mul *= 1 + RUSH_DAMAGE * this.rushTier;
    if (this.hasSanrei) {
      if (!this.sanreiOff && this.t >= 480) {
        this.sanreiOff = true;
        this.messages.push({ text: 'The Sanrei Glove comes off', kind: 'info' });
      }
      mul *= this.sanreiOff ? 1.6 : 0.8;
    }
    this.dmgMul = this.baseDmgMul * mul;
  }

  // ------------------------------------------------------------ timeline

  private runTimeline(): void {
    if (this.stress > 0) return;
    if (this.bossRush) {
      this.rushTick();
    } else {
      while (this.warnCursor < this.warnings.length && this.t >= this.warnings[this.warnCursor].at) {
        const warn = this.warnings[this.warnCursor++];
        if (this.calledEarly.has(warn.ev)) continue;
        this.messages.push({ text: warn.text, kind: 'boss' });
        this.sound('boss');
      }
      const events = this.stage.events;
      while (this.evCursor < events.length && this.t >= events[this.evCursor].at) {
        const k = this.evCursor++;
        if (!this.calledEarly.has(k)) this.fire(events[k]);
      }
      if (this.t >= this.nextEventT) this.runEvent();
      if (this.endless && this.endlessNext > 0 && this.t >= this.endlessNext) this.endlessWaveTick();
    }
    if (this.victoryT > 0) {
      this.victoryT -= DT;
      if (this.victoryT <= 0) this.over = 'victory';
    }
  }

  /**
   * Boss Rush: the stage's bosses in order, each wave with whatever escorts
   * it (bosses and elites within 12 s of it), made lighter because you meet
   * them with far fewer levels than a full run would give you. Eight level-ups
   * to start; the next wave comes 6 s after the last boss falls.
   */
  private setupBossRush(): void {
    const events = this.stage.events;
    const grouped = new Set<TimelineEvent>();
    const waves: TimelineEvent[][] = [];
    for (const e of events) {
      if ((e.kind !== 'bearer' && e.kind !== 'boss') || grouped.has(e)) continue;
      const wave = events.filter((x) => !grouped.has(x) && x.at >= e.at && x.at <= e.at + 12 && (x.kind === 'bearer' || x.kind === 'boss' || x.kind === 'elite'));
      for (const x of wave) grouped.add(x);
      waves.push(wave);
    }
    this.rushQueue = waves.map((wave, k) => {
      const scale = RUSH_HP[Math.min(k, RUSH_HP.length - 1)];
      return wave.map((x) => (x.kind === 'bearer' || x.kind === 'boss' ? { ...x, hpMul: x.hpMul * scale } : x));
    });
    this.rushNext = 12;
    this.pendingLevelUps = 8;
    this.nextEventT = Infinity;
  }

  private rushTick(): void {
    if (this.bossCount > 0 || this.rushQueue.length === 0) return;
    if (this.rushNext <= 0) {
      this.rushNext = this.t + 6;
      this.messages.push({ text: 'The next one is coming', kind: 'boss' });
      return;
    }
    if (this.t < this.rushNext) return;
    this.rushNext = 0;
    for (const e of this.rushQueue.shift() ?? []) this.fire(e);
    this.rushWave++;
  }

  private fire(ev: TimelineEvent): void {
    const p = this.player;
    switch (ev.kind) {
      case 'ring': {
        const R = Math.max(this.viewHalfW, this.viewHalfH) + 50;
        const type = ENEMY_INDEX[ev.enemy];
        for (let k = 0; k < ev.count; k++) {
          const a = (k / ev.count) * TAU;
          this.spawnEnemy(type, p.x + Math.cos(a) * R, p.y + Math.sin(a) * R);
        }
        break;
      }
      case 'elite':
        this.edgePoint();
        this.spawnEnemy(ENEMY_INDEX[ev.enemy], this.tx, this.ty, true);
        break;
      case 'bearer': {
        const id = this.bearers[ev.tier];
        if (id) this.spawnBearer(id, ev.hpMul);
        break;
      }
      case 'boss': {
        this.edgePoint(80);
        const i = this.spawnEnemy(ENEMY_INDEX[ev.enemy], this.tx, this.ty, false, ev.hpMul);
        if (i < 0) break;
        this.bossCount++;
        if (ev.final) this.finalBossUid = this.en.uid[i];
        const def = ENEMY_LIST[ENEMY_INDEX[ev.enemy]];
        this.banners.push({ kind: 'boss', title: def.name, sub: ev.sub, quote: BOSS_LINES[`boss:${ev.enemy}`] });
        this.shake = Math.max(this.shake, 8);
        break;
      }
      case 'chest': {
        const a = this.rng.next() * TAU;
        const d = this.rng.range(170, 230);
        this.addPickup('chest', p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
        break;
      }
      case 'shrine':
        this.startEvent('shrine');
        break;
      case 'rune': {
        const a = this.rng.next() * TAU;
        const d = this.rng.range(120, 180);
        this.addPickup(ev.rune, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
        break;
      }
    }
  }

  /**
   * Something happens between the bosses: a rift, a golden runner, a storm of
   * mana, an ambush. Never during a boss fight or just before one.
   */
  private runEvent(): void {
    const soon = this.stage.events.some((e) => (e.kind === 'bearer' || e.kind === 'boss') && e.at > this.t - 5 && e.at < this.t + 25);
    if (this.boss.active || soon || (!this.endless && this.t > this.stage.length - 40)) {
      this.nextEventT = this.t + 15;
      return;
    }
    this.nextEventT = this.t + this.rng.range(120, 170);
    const roll = this.rng.next() * 12;
    this.startEvent(roll < 3 ? 'rift' : roll < 6 ? 'golden' : roll < 8 ? 'storm' : roll < 10 ? 'ambush' : 'shrine');
  }

  /** Start one run event now. */
  startEvent(kind: 'rift' | 'golden' | 'storm' | 'ambush' | 'shrine'): void {
    const sei = this.stage.id === 'seireitei';
    const p = this.player;
    if (kind === 'rift') {
      const a = this.rng.next() * TAU;
      const i = this.spawnEnemy(ENEMY_INDEX.rift, p.x + Math.cos(a) * 230, p.y + Math.sin(a) * 230);
      if (i >= 0) {
        this.en.flags[i] |= FLAG_EVENT;
        this.en.atkT[i] = 0.5;
        this.en.atk2T[i] = 25;
      }
      this.banners.push({ kind: 'event', title: sei ? 'Senkaimon' : 'Garganta', sub: 'A rift tears open. Close it before it seals.' });
    } else if (kind === 'golden') {
      const a = this.rng.next() * TAU;
      const i = this.spawnEnemy(ENEMY_INDEX.golden, p.x + Math.cos(a) * 160, p.y + Math.sin(a) * 160);
      if (i >= 0) {
        this.en.flags[i] |= FLAG_EVENT;
        this.en.atk2T[i] = 18;
      }
      this.banners.push({ kind: 'event', title: sei ? 'Treasury Runner' : 'Golden Hollow', sub: 'Catch it before it escapes.' });
    } else if (kind === 'storm') {
      this.stormT = 15;
      this.banners.push({ kind: 'event', title: 'Reishi Storm', sub: 'Mana falls like rain.' });
    } else if (kind === 'shrine') {
      if (this.stress > 0) return;
      const a = this.rng.next() * TAU;
      this.addPickup('shrine', p.x + Math.cos(a) * 210, p.y + Math.sin(a) * 210);
      this.banners.push({ kind: 'event', title: 'Quincy Shrine', sub: 'Walk to it and make a pact, or pass it by.' });
    } else {
      const heavy = ENEMY_INDEX[sei ? 'guard' : 'brute'];
      this.spawnEnemy(heavy, p.x - 230, p.y, true);
      this.spawnEnemy(heavy, p.x + 230, p.y, true);
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * TAU;
        this.spawnEnemy(this.regularType(), p.x + Math.cos(a) * 290, p.y + Math.sin(a) * 290);
      }
      this.banners.push({ kind: 'event', title: 'Ambush', sub: 'They were waiting for you.' });
    }
    this.sound('warn');
  }

  /** A bankai boss: in Seireitei the bankai's own captain defends it; elsewhere a medallion bearer carries it. */
  private spawnBearer(id: string, hpMul: number): number {
    this.edgePoint(80);
    if (this.stage.roster === 'royal') return this.spawnRoyal(id, hpMul);
    if (this.stage.roster === 'gotei') return this.spawnGotei(id, hpMul);
    const captain = !!this.stage.captains;
    const i = this.spawnEnemy(captain ? ENEMY_INDEX.captain : ENEMY_INDEX.bearer, this.tx, this.ty, false, hpMul);
    if (i < 0) return -1;
    this.en.variant[i] = BANKAI_IDS.indexOf(id);
    this.bossCount++;
    const bankaiName = POWER_BY_ID.get(id)?.name ?? id;
    const info = BANKAI_BY_ID.get(id);
    const quote = BOSS_LINES[`${captain ? 'captain' : 'bearer'}:${id}`];
    this.banners.push(
      captain && info
        ? { kind: 'boss', title: info.owner, sub: `${info.rank} · ${bankaiName}`, quote }
        : { kind: 'boss', title: 'Medallion Bearer', sub: `carries ${bankaiName}`, quote },
    );
    this.shake = Math.max(this.shake, 8);
    return i;
  }

  /** The bosses a stage draws its three from: the Royal Guard, Silbern's captains, or the six bankai. */
  private rosterIds(): readonly string[] {
    return this.stage.roster === 'royal' ? ROYAL_IDS : this.stage.roster === 'gotei' ? GOTEI_IDS : BANKAI_IDS;
  }

  /** One of Silbern's captains comes out to meet you. */
  private spawnGotei(id: string, hpMul: number): number {
    const i = this.spawnEnemy(ENEMY_INDEX.gotei, this.tx, this.ty, false, hpMul);
    if (i < 0) return -1;
    this.en.variant[i] = Math.max(0, GOTEI_IDS.indexOf(id));
    this.bossCount++;
    const info = GOTEI_BY_ID.get(id);
    this.banners.push({ kind: 'boss', title: info?.name ?? 'Captain', sub: info?.title ?? '', quote: BOSS_LINES[`gotei:${id}`] });
    this.shake = Math.max(this.shake, 8);
    return i;
  }

  /** A little memory for bosses whose variant byte is taken (it says who they are): their move counter and phase. */
  private readonly memos = new Map<number, { move: number; phase: number }>();

  bossMemo(i: number): { move: number; phase: number } {
    const uid = this.en.uid[i];
    let m = this.memos.get(uid);
    if (!m) {
      m = { move: 0, phase: 0 };
      this.memos.set(uid, m);
    }
    return m;
  }

  /** Sakanade's mist: up is down and left is right for a while. */
  invert(secs: number): void {
    if (this.invertT <= 0) this.messages.push({ text: 'Sakanade: up is down, left is right', kind: 'boss' });
    this.invertT = Math.max(this.invertT, secs);
  }

  /** One of the Royal Guard steps out to meet you. */
  private spawnRoyal(id: string, hpMul: number): number {
    const i = this.spawnEnemy(ENEMY_INDEX.royal, this.tx, this.ty, false, hpMul);
    if (i < 0) return -1;
    this.en.variant[i] = Math.max(0, ROYAL_IDS.indexOf(id));
    this.bossCount++;
    const info = ROYAL_BY_ID.get(id);
    this.banners.push({ kind: 'boss', title: info?.name ?? 'Royal Guard', sub: info?.title ?? '', quote: BOSS_LINES[`royal:${id}`] });
    this.shake = Math.max(this.shake, 8);
    return i;
  }

  /**
   * Endless: a new wave every 150 s past the stage's end. Two in three bring a
   * bankai boss back, stronger each time; every third, the stage's own lord
   * returns. Elites, chests and runes keep coming in between.
   */
  private endlessWaveTick(): void {
    this.endlessNext = this.t + 150;
    const k = this.endlessWave++;
    const p = this.player;
    if (k % 3 === 2) {
      const last = this.stage.events.filter((e) => e.kind === 'boss' && e.final).pop();
      if (last && last.kind === 'boss') {
        this.edgePoint(80);
        const i = this.spawnEnemy(ENEMY_INDEX[last.enemy], this.tx, this.ty, false, last.hpMul * Math.pow(1.3, (k + 1) / 3));
        if (i >= 0) {
          this.bossCount++;
          this.banners.push({ kind: 'boss', title: ENEMY_LIST[ENEMY_INDEX[last.enemy]].name, sub: 'Returns, stronger', quote: BOSS_LINES[`boss:${last.enemy}`] });
        }
      }
    } else {
      const pool = this.stage.roster ? this.rosterIds() : (this.stage.bearerPool ?? BANKAI_IDS);
      this.spawnBearer(pool[this.rng.int(pool.length)], 14 * Math.pow(1.35, k));
    }
    this.edgePoint();
    this.spawnEnemy(this.regularType(), this.tx, this.ty, true);
    const a = this.rng.next() * TAU;
    this.addPickup('chest', p.x + Math.cos(a) * 200, p.y + Math.sin(a) * 200);
    this.sound('boss');
  }

  private spawnTick(): void {
    // Nothing arrives while time stands still.
    if (this.almightyT > 0) return;
    const E = this.en;
    if (this.stress > 0) {
      let budget = 60;
      const far = Math.hypot(this.viewHalfW, this.viewHalfH) + 40;
      while (E.n < this.stress && budget-- > 0) {
        const a = this.rng.next() * TAU;
        const d = this.rng.range(120, far);
        this.spawnEnemy(this.stressType(), this.player.x + Math.cos(a) * d, this.player.y + Math.sin(a) * d, false, 3);
      }
      return;
    }
    // Endless: past the stage's end the flood keeps rising.
    const beyond = this.endless ? Math.max(0, this.t - this.stage.length) : 0;
    const rate = Math.min(70, spawnRate(Math.min(this.t, this.stage.length)) + (beyond / 60) * 1.5);
    // Boss Rush keeps only a thin swarm between and around the bosses.
    this.spawnAcc += rate * this.stage.spawn * this.tm.spawn * this.modSpawn * (this.bossRush ? 0.35 : 1) * DT;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (E.n >= MAX_ENEMIES_ALIVE) {
        this.spawnAcc = 0;
        break;
      }
      this.edgePoint();
      this.spawnEnemy(this.regularType(), this.tx, this.ty);
    }
  }

  /** A regular enemy type from the stage's current mix. */
  regularType(): number {
    const mix = phaseAt(this.stage, this.t).mix;
    let total = 0;
    for (const entry of mix) total += entry[1];
    let r = this.rng.next() * total;
    for (const entry of mix) {
      r -= entry[1];
      if (r < 0) return ENEMY_INDEX[entry[0]];
    }
    return ENEMY_INDEX[mix[mix.length - 1][0]];
  }

  /** Stress swarms use the stage's late-game mix. */
  private stressType(): number {
    const mix = this.stage.phases[this.stage.phases.length - 1].mix;
    return ENEMY_INDEX[mix[this.rng.int(mix.length)][0]];
  }

  /** A random point just outside the visible area, written to tx/ty. */
  private edgePoint(margin = 40): void {
    const p = this.player;
    const hw = this.viewHalfW + margin;
    const hh = this.viewHalfH + margin;
    const w2 = hw * 2;
    const h2 = hh * 2;
    let d = this.rng.next() * 2 * (w2 + h2);
    if (d < w2) {
      this.tx = p.x - hw + d;
      this.ty = p.y - hh;
      return;
    }
    d -= w2;
    if (d < w2) {
      this.tx = p.x - hw + d;
      this.ty = p.y + hh;
      return;
    }
    d -= w2;
    if (d < h2) {
      this.tx = p.x - hw;
      this.ty = p.y - hh + d;
      return;
    }
    d -= h2;
    this.tx = p.x + hw;
    this.ty = p.y - hh + d;
  }

  // ------------------------------------------------------------- enemies

  spawnEnemy(type: number, x: number, y: number, elite = false, hpMul = 1): number {
    const E = this.en;
    if (E.n >= E.cap) return -1;
    const def = ENEMY_LIST[type];
    const i = E.n++;
    // Bosses get their health from the timeline alone; everything else also scales with time.
    let hp = def.hp * hpMul * (def.boss ? this.tm.bossHp : hpScale(this.t) * this.stage.hp * this.tm.hp);
    // Endless pressure: every minute past the stage's end, the swarm gets sturdier (faster and faster) and hits harder.
    const over = this.endless ? Math.max(0, this.t - this.stage.length) / 60 : 0;
    if (over > 0 && !def.boss) hp *= 1 + 0.15 * over + 0.02 * over * over;
    if (!def.boss) hp *= this.modHp * this.pactHp;
    let r = def.radius * (def.boss ? 1 : this.modRadius);
    // Boss hits scale with the boss's tier: the first bearer is an introduction, the last boss hits hard.
    let dmg = def.damage * (def.boss ? Math.min(1.6, 0.65 + 0.06 * hpMul) * this.tm.bossDamage : this.tm.damage) * (1 + 0.1 * over);
    let xp = def.xp * xpScale(this.t) * this.stage.xp;
    let flags = 0;
    if (elite) {
      hp *= 12;
      r *= 1.45;
      dmg *= 1.5;
      xp *= 10;
      flags |= FLAG_ELITE;
    }
    if (def.boss) flags |= FLAG_BOSS;
    E.x[i] = E.ox[i] = x;
    E.y[i] = E.oy[i] = y;
    E.kx[i] = E.ky[i] = 0;
    E.hp[i] = E.maxHp[i] = hp;
    E.r[i] = r;
    E.spd[i] = def.speed * (def.boss ? 1 : speedScale(this.t) * this.tm.speed) * this.modSpeed * this.pactSpeed * this.rng.range(0.9, 1.1);
    if (def.boss && this.bossRush) dmg *= RUSH_DMG[Math.min(this.rushWave, RUSH_DMG.length - 1)];
    E.dmg[i] = dmg;
    E.xp[i] = xp;
    E.flash[i] = 0;
    E.slowT[i] = 0;
    E.slowK[i] = 0;
    E.freezeT[i] = 0;
    E.holdKind[i] = HOLD_FREEZE;
    E.ohit[i] = -10;
    E.vulnT[i] = 0;
    E.vulnK[i] = 0;
    E.dotT[i] = 0;
    E.dotDps[i] = 0;
    E.dotTick[i] = 0;
    E.dotKind[i] = 0;
    E.atkT[i] = def.boss ? 2.5 : 2 + this.rng.next() * 2;
    // A sentinel's second timer is its wind-up, which only starts when it lunges.
    E.atk2T[i] = def.boss ? 4 : BEHAVIOR[type] === BH_CHARGE ? 0 : 1.5 + this.rng.next() * 2.5;
    E.volT[i] = 0;
    E.volDmg[i] = 0;
    E.charmT[i] = 0;
    E.charmDmg[i] = 0;
    E.infT[i] = 0;
    E.type[i] = type;
    E.variant[i] = 0;
    E.flags[i] = flags;
    E.dead[i] = 0;
    E.uid[i] = ++this.uidSeq;
    E.nslot[i] = -1;
    E.nt[i] = -10;
    return i;
  }

  private updateEnemies(): void {
    const E = this.en;
    const g = this.grid;
    const p = this.player;
    const parity = this.steps & 1;
    const frozenAll = this.freezeAllT > 0;
    const recycle = Math.hypot(this.viewHalfW, this.viewHalfH) * 1.6;
    const recycle2 = recycle * recycle;
    const dim = g.dim;
    const cs = g.cell;
    const start = g.start;
    const items = g.items;
    for (let i = 0; i < E.n; i++) {
      if (E.dead[i]) continue;
      this.dmgSlot = 255;
      let x = E.x[i];
      let y = E.y[i];
      E.ox[i] = x;
      E.oy[i] = y;
      if (E.flash[i] > 0) E.flash[i] -= DT;
      if (E.volT[i] > 0) E.volT[i] -= DT;
      if (E.vulnT[i] > 0) {
        E.vulnT[i] -= DT;
        if (E.vulnT[i] <= 0) E.vulnK[i] = 0;
      }
      if (E.dotT[i] > 0) {
        E.dotT[i] -= DT;
        E.dotTick[i] -= DT;
        if (E.dotTick[i] <= 0) {
          E.dotTick[i] += 0.5;
          this.dmgSlot = E.dotSrc[i];
          this.damageEnemy(i, E.dotDps[i] * 0.5, 0, x, y, true);
          this.dmgSlot = 255;
          if (E.dead[i]) continue;
        }
      }
      const flags = E.flags[i];
      const boss = (flags & FLAG_BOSS) !== 0;
      let charmed = false;
      if (E.charmT[i] > 0) {
        E.charmT[i] -= DT;
        if (E.charmT[i] > 0) {
          charmed = true;
        } else {
          E.charmT[i] = 0;
          if (flags & FLAG_ZOMBIE) {
            this.killEnemy(i);
            continue;
          }
          if (flags & FLAG_HEARTBREAK) {
            E.flags[i] = flags & ~FLAG_HEARTBREAK;
            this.queueBurst(x, y, 60 * this.stats.size, E.charmDmg[i] * 3);
          }
        }
      }
      if (E.infT[i] > 0) E.infT[i] -= DT;
      // The Almighty stopped time: nobody moves, attacks or touches you, bosses included.
      if (this.almightyT > 0) continue;
      let k = 1;
      if (E.freezeT[i] > 0) {
        E.freezeT[i] -= DT;
        k = 0;
      } else if (frozenAll && !boss) {
        k = 0;
      } else if (E.slowT[i] > 0) {
        E.slowT[i] -= DT;
        k = 1 - E.slowK[i];
      }
      const dx = p.x - x;
      const dy = p.y - y;
      const dist2 = dx * dx + dy * dy;
      const dist = Math.sqrt(dist2) || 1;
      const v = E.spd[i] * k * DT;
      const behavior = BEHAVIOR[E.type[i]];
      if (charmed) {
        // On your side: rush the nearest enemy and hit it; with nobody near, stay close to you.
        // The rush is faster than a normal walk, or an ally could never catch a target heading your way.
        E.atk2T[i] -= DT;
        const t = this.grid.nearest(x, y, 260, E.x, E.y, this.isAlive);
        if (t >= 0) {
          const tx = E.x[t] - x;
          const ty = E.y[t] - y;
          const td = Math.hypot(tx, ty) || 1;
          if (td > E.r[i] + E.r[t] + 8) {
            const rush = Math.min(td, v * 1.6);
            x += (tx / td) * rush;
            y += (ty / td) * rush;
          } else if (E.atk2T[i] <= 0) {
            E.atk2T[i] = 0.5;
            if (flags & FLAG_PLAGUE) E.infT[t] = Math.max(E.infT[t], 4);
            this.dmgSlot = E.charmSrc[i];
            this.damageEnemy(t, E.charmDmg[i] * 0.5, 30, x, y, true);
            this.dmgSlot = 255;
          }
        } else if (dist > 70) {
          x += (dx / dist) * v;
          y += (dy / dist) * v;
        }
      } else if (behavior === BH_FLEE) {
        x -= (dx / dist) * v;
        y -= (dy / dist) * v;
      } else if (behavior === BH_CHARGE && E.atk2T[i] > 0) {
        // Winding up for a lunge: it stands its ground.
      } else if (behavior === BH_RANGED && !(flags & FLAG_ELITE)) {
        // Casters hold a ring around you: close in, back off, or circle.
        if (dist > 220) {
          x += (dx / dist) * v;
          y += (dy / dist) * v;
        } else if (dist < 150) {
          x -= (dx / dist) * v * 0.8;
          y -= (dy / dist) * v * 0.8;
        } else {
          const side = E.uid[i] & 1 ? 0.5 : -0.5;
          x += (-dy / dist) * v * side;
          y += (dx / dist) * v * side;
        }
      } else {
        x += (dx / dist) * v;
        y += (dy / dist) * v;
      }
      const kx = E.kx[i];
      const ky = E.ky[i];
      if (kx !== 0 || ky !== 0) {
        x += kx * DT;
        y += ky * DT;
        const nkx = kx * 0.86;
        const nky = ky * 0.86;
        if (Math.abs(nkx) + Math.abs(nky) < 3) {
          E.kx[i] = 0;
          E.ky[i] = 0;
        } else {
          E.kx[i] = nkx;
          E.ky[i] = nky;
        }
      }
      // Soft separation so the swarm spreads out instead of stacking. Half the swarm each step.
      if ((i & 1) === parity) {
        const r = E.r[i];
        const c0x = Math.floor((x - g.originX) / cs);
        const c0y = Math.floor((y - g.originY) / cs);
        let px = 0;
        let py = 0;
        let checks = 0;
        for (let cy = c0y - 1; cy <= c0y + 1 && checks < 14; cy++) {
          if (cy < 0 || cy >= dim) continue;
          for (let cx = c0x - 1; cx <= c0x + 1 && checks < 14; cx++) {
            if (cx < 0 || cx >= dim) continue;
            const c = cy * dim + cx;
            const end = start[c + 1];
            for (let q = start[c]; q < end && checks < 14; q++) {
              const j = items[q];
              if (j === i || E.dead[j]) continue;
              checks++;
              const ex = x - E.x[j];
              const ey = y - E.y[j];
              const min = (r + E.r[j]) * 0.85;
              const e2 = ex * ex + ey * ey;
              if (e2 >= min * min || e2 < 1e-4) continue;
              const e = Math.sqrt(e2);
              const push = (min - e) / e;
              px += ex * push;
              py += ey * push;
            }
          }
        }
        if ((px !== 0 || py !== 0) && !(flags & FLAG_EVENT && E.spd[i] === 0)) {
          const mass = boss ? 0.04 : r > 15 ? 0.25 : 0.5;
          let sx = px * mass;
          let sy = py * mass;
          const m = Math.hypot(sx, sy);
          if (m > 3) {
            sx *= 3 / m;
            sy *= 3 / m;
          }
          x += sx;
          y += sy;
        }
      }
      E.x[i] = x;
      E.y[i] = y;
      if (boss) bossAI(this, i, dist);
      else if (charmed) {
        // Allies neither shoot at you nor flash-step.
      } else if (flags & FLAG_EVENT) eventAI(this, i);
      else if (flags & FLAG_ELITE) eliteAI(this, i, dist);
      else if (k > 0 && behavior === BH_BLINK) blinkAI(this, i, dist);
      else if (k > 0 && behavior === BH_RANGED) casterAI(this, i, dist);
      else if (k > 0 && behavior === BH_CHARGE) chargeAI(this, i, dist);
      if (E.dead[i]) continue;
      if (!charmed && E.dmg[i] > 0 && dist < E.r[i] + PLAYER.radius + 2) this.contact(i);
      else if (dist2 > recycle2 && !boss && !(flags & FLAG_EVENT)) this.recycle(i);
    }
  }

  private contact(i: number): void {
    const E = this.en;
    this.hurtPlayer(E.dmg[i]);
    if (ENEMY_LIST[E.type[i]].bomber) {
      this.explosionFx(E.x[i], E.y[i]);
      this.killEnemy(i);
    }
  }

  /** Move a straggler that fell far behind to just off-screen ahead of you. */
  private recycle(i: number): void {
    const E = this.en;
    const p = this.player;
    const a = Math.atan2(this.moveY, this.moveX) + this.rng.range(-1, 1);
    const d = Math.hypot(this.viewHalfW, this.viewHalfH) + 30;
    E.x[i] = E.ox[i] = p.x + Math.cos(a) * d;
    E.y[i] = E.oy[i] = p.y + Math.sin(a) * d;
    E.kx[i] = E.ky[i] = 0;
  }

  damageEnemy(i: number, base: number, knock = 0, srcX = this.player.x, srcY = this.player.y, noCrit = false): void {
    const E = this.en;
    if (E.dead[i]) return;
    const crit = !noCrit && this.rng.next() < this.stats.critChance;
    const vul = E.vulnT[i] > 0 ? 1 + E.vulnK[i] : 1;
    let dmg = base * this.dmgMul * vul * (crit ? this.stats.critMult : 1);
    // Schutzstaffel: up to twice as hard the closer you are to falling.
    if (this.schutzBits !== 0 && this.dmgSlot < 31 && (this.schutzBits >>> this.dmgSlot) & 1) dmg *= 2 - Math.max(0, this.player.hp) / this.player.maxHp;
    this.dmgBy[this.dmgSlot] += Math.min(dmg, Math.max(0, E.hp[i]));
    E.hp[i] -= dmg;
    E.flash[i] = 0.07;
    if (knock > 0 && !(E.flags[i] & (FLAG_BOSS | FLAG_EVENT))) {
      const dx = E.x[i] - srcX;
      const dy = E.y[i] - srcY;
      const d = Math.hypot(dx, dy) || 1;
      const k = E.flags[i] & FLAG_ELITE ? knock * 0.25 : knock;
      E.kx[i] += (dx / d) * k;
      E.ky[i] += (dy / d) * k;
    }
    if (this.showNumbers) {
      // Hits on the same enemy within 0.15 s add up in one number; crits always get their own.
      const N = this.nums;
      const slot = E.nslot[i];
      if (!crit && slot >= 0 && this.t - E.nt[i] < 0.15 && N.owner[slot] === E.uid[i] && N.crit[slot] === 0 && N.life[slot] > 0.4) {
        N.val[slot] += dmg;
      } else {
        E.nslot[i] = N.push(E.x[i], E.y[i] - E.r[i], dmg, crit, E.uid[i]);
        E.nt[i] = this.t;
      }
    }
    this.sound('hit');
    if (E.hp[i] <= 0) this.killEnemy(i);
  }

  /** Unable to move for `secs` (bosses ignore it, elites shake it off twice as fast). */
  applyHold(i: number, secs: number, kind: number): void {
    const E = this.en;
    if (E.dead[i] || E.flags[i] & (FLAG_BOSS | FLAG_EVENT)) return;
    const s = E.flags[i] & FLAG_ELITE ? secs * 0.5 : secs;
    if (s > E.freezeT[i]) {
      E.freezeT[i] = s;
      E.holdKind[i] = kind;
    }
  }

  applyVuln(i: number, secs: number, k: number): void {
    const E = this.en;
    if (E.dead[i]) return;
    E.vulnT[i] = Math.max(E.vulnT[i], secs);
    E.vulnK[i] = Math.max(E.vulnK[i], k);
  }

  applyDot(i: number, secs: number, dps: number, kind: number): void {
    const E = this.en;
    if (E.dead[i]) return;
    if (E.dotT[i] <= 0) E.dotTick[i] = 0.5;
    E.dotT[i] = Math.max(E.dotT[i], secs);
    // The strongest burn sets the rate, so it is the one credited.
    if (dps >= E.dotDps[i]) E.dotSrc[i] = this.dmgSlot;
    E.dotDps[i] = Math.max(E.dotDps[i], dps);
    E.dotKind[i] = kind;
  }

  /** Charm an enemy (The Love): it fights for you for a while. Bosses and the risen are immune; elites resist unless Adoration. */
  charm(j: number, secs: number, dps: number, attr: string | null): void {
    const E = this.en;
    if (E.dead[j] || E.flags[j] & (FLAG_ZOMBIE | FLAG_EVENT)) return;
    if (E.flags[j] & FLAG_BOSS) {
      // Bosses cannot be charmed, but they are flustered: more damage from everything for a while.
      this.applyVuln(j, secs, 0.25);
      return;
    }
    const s = E.flags[j] & FLAG_ELITE && attr !== 'adoration' ? secs * 0.5 : secs;
    if (s > E.charmT[j]) E.charmT[j] = s;
    E.charmDmg[j] = Math.max(E.charmDmg[j], dps);
    E.charmSrc[j] = this.dmgSlot;
    if (attr === 'heartbreak') E.flags[j] |= FLAG_HEARTBREAK;
    E.atk2T[j] = Math.min(E.atk2T[j], 0.2);
    this.spawnFx(FX_GLOW, E.x[j], E.y[j], 0, 0, 0.3, E.r[j] * 1.5, E.r[j] * 3, 0.7, 0, 0, 0xff9cc8, LAYER_ADD);
  }

  /** An infected enemy died: it rises again on your side (The Zombie). */
  private raise(type: number, x: number, y: number): void {
    const E = this.en;
    const z = this.spawnEnemy(type, x, y);
    if (z < 0) return;
    if (!this.zombieFull) {
      E.maxHp[z] *= 0.5;
      E.hp[z] = E.maxHp[z];
    }
    E.xp[z] = 0;
    E.flags[z] |= FLAG_ZOMBIE | (this.zombiePlague ? FLAG_PLAGUE : 0) | (this.zombieBurst ? FLAG_BLOODBURST : 0);
    E.charmT[z] = this.zombieLife;
    E.charmDmg[z] = this.zombieDps;
    E.charmSrc[z] = this.slotOf('zombie');
    E.atk2T[z] = 0.3;
    this.zombieN++;
    this.spawnFx(FX_GLOW, x, y, 0, 0, 0.4, E.r[z] * 1.5, E.r[z] * 3.5, 0.8, 0, 0, 0xff3050, LAYER_ADD);
    this.sound('rise');
  }

  killEnemy(i: number): void {
    const E = this.en;
    if (E.dead[i]) return;
    E.dead[i] = 1;
    const x = E.x[i];
    const y = E.y[i];
    const flags = E.flags[i];
    const def = ENEMY_LIST[E.type[i]];
    if (flags & FLAG_ZOMBIE) {
      // The risen crumble: no mana, no drops, not a kill.
      this.zombieN = Math.max(0, this.zombieN - 1);
      if (flags & FLAG_BLOODBURST) this.queueBurst(x, y, 56 * this.stats.size, E.charmDmg[i] * 2.5, E.charmSrc[i]);
      // Plague: the risen leave a lethal cloud behind.
      const death = this.resonances.has('plague') ? this.power('death') : undefined;
      if (death) this.spawnZone(ZK_POISON, x, y, 0, 0, 44 * this.stats.size, 2.5, death.stats.tick, death.stats.damage * 0.7, 0, 0.3);
      this.spawnFx(FX_GLOW, x, y, 0, 0, 0.3, E.r[i], E.r[i] * 2.6, 0.6, 0, 0, 0xff3050, LAYER_ADD);
      return;
    }
    this.kills++;
    const key = enemyKey(E.type[i], E.variant[i]);
    this.killsBy.set(key, (this.killsBy.get(key) ?? 0) + 1);
    this.chainKill();
    if (E.charmT[i] > 0 && flags & FLAG_HEARTBREAK) this.queueBurst(x, y, 60 * this.stats.size, E.charmDmg[i] * 3);
    // Overkill Storm: every 40 kills, Gonryō Rikyū's lightning answers.
    if (this.resonances.has('overthunder') && !this.inStorm && ++this.stormKills >= 40) {
      this.stormKills = 0;
      this.inStorm = true;
      this.credit('gonryo', () => this.overkillStorm());
      this.inStorm = false;
    }
    // An ink wisp splits in two as it dies.
    if (def.id === 'inkwisp') {
      for (const dir of [-1, 1]) this.spawnEnemy(ENEMY_INDEX.inkling, x + dir * 10, y + dir * 4);
    }
    // A Twelfth Division specimen bursts into poison as it dies.
    if (def.id === 'specimen' && !(E.flags[i] & FLAG_ZOMBIE) && E.charmT[i] <= 0) {
      this.spawnMark(MK_GAS, MS_CIRCLE, x, y, 46, 0, 0, 0.7, E.dmg[i] * 1.1, MF_ENEMY);
    }
    this.spawnOrb(x, y, E.xp[i]);
    if (E.volT[i] > 0) this.queueBurst(x, y, 44 * this.stats.size, E.volDmg[i]);
    if (flags & FLAG_BOSS) {
      this.bossCount = Math.max(0, this.bossCount - 1);
      if (E.uid[i] !== this.finalBossUid) this.bossKills++;
      // Boss Rush: every boss down is four more level-ups.
      if (this.bossRush && E.uid[i] !== this.finalBossUid) this.pendingLevelUps += 4;
      const carrier = def.id === 'bearer' || def.id === 'captain';
      if (carrier) {
        this.addPickup('medallion', x, y, BANKAI_IDS[E.variant[i]]);
        this.addPickup('chestBlack', x + 36, y + 12);
      }
      // The Royal Guard each leave a Fragment of the Soul King you do not have yet (gold once you hold all three).
      // Silbern's captains carry no bankai to take: two black chests instead.
      if (def.id === 'gotei') {
        this.addPickup('chestBlack', x - 36, y - 12);
        this.addPickup('chestBlack', x + 36, y + 12);
      }
      if (def.id === 'royal') {
        const fragment = this.fragmentToDrop();
        if (fragment) this.addPickup('fragment', x, y, undefined, fragment);
        else this.addPickup('chestBlack', x - 36, y - 12);
        this.addPickup('chestBlack', x + 36, y + 12);
      }
      // The Hunter's Pact: the boss it called pays an extra black chest.
      if (E.uid[i] === this.huntUid) {
        this.huntUid = -1;
        this.addPickup('chestBlack', x - 36, y + 12);
      } else if (def.id === 'menos' || def.id === 'grandmaster' || def.id === 'vasto') {
        this.addPickup('chest', x, y);
      }
      for (let k = 0; k < 10; k++) {
        const a = this.rng.next() * TAU;
        const d = this.rng.range(20, 70);
        this.spawnOrb(x + Math.cos(a) * d, y + Math.sin(a) * d, E.xp[i] * 0.3);
      }
      this.shake = Math.max(this.shake, 14);
      const fallen =
        def.id === 'bearer'
          ? 'The bearer falls. Take back its medallion.'
          : def.id === 'captain'
            ? `${BANKAI_BY_ID.get(BANKAI_IDS[E.variant[i]])?.owner ?? 'The captain'} falls. Seize the bankai.`
            : `${def.name} defeated`;
      this.messages.push({ text: fallen, kind: 'info' });
      this.bigBurst(x, y, def.color);
      if (E.uid[i] === this.finalBossUid) {
        if (this.endless) {
          // Endless: the lord falls, and the night goes on.
          this.bossKills++;
          this.finalBossUid = -1;
          this.endlessNext = this.t + 60;
          this.banners.push({ kind: 'event', title: 'Endless', sub: 'The night goes on. How long can you last?' });
        } else {
          this.victoryT = 2.2;
        }
      }
    } else {
      if (flags & FLAG_EVENT) {
        // A sealed rift or a caught runner pays out.
        const golden = def.id === 'golden';
        this.gold += golden ? 80 : 40;
        this.addPickup('chest', x, y);
        if (golden) this.addPickup('heart', x + 20, y);
        for (let k = 0; k < (golden ? 12 : 6); k++) {
          const a = this.rng.next() * TAU;
          this.spawnOrb(x + Math.cos(a) * 30, y + Math.sin(a) * 30, E.xp[i] * 0.15);
        }
        this.messages.push({ text: golden ? 'Caught. Gold spills everywhere.' : 'The rift is sealed. Something was left behind.', kind: 'info' });
      } else if (flags & FLAG_ELITE) {
        this.addPickup('chest', x, y);
      } else {
        const roll = this.rng.next();
        if (roll < 0.0035) this.addPickup('heart', x, y);
        else if (roll < 0.005) this.addPickup('magnet', x, y);
        else if (roll < 0.0056) this.addPickup('nuke', x, y);
      }
      if (def.shinigami) this.spiritFx(x, y, E.r[i]);
      else this.deathFx(x, y, def.color, E.r[i]);
      if (E.infT[i] > 0 && this.zombieN < this.zombieMax && !(flags & FLAG_EVENT)) this.raise(E.type[i], x, y);
    }
    this.sound('kill');
  }

  /** A kill extends the Blut Rush chain; passing a threshold raises the tier. */
  private chainKill(): void {
    this.streak++;
    this.streakT = 0;
    if (this.streak > this.bestStreak) this.bestStreak = this.streak;
    if (this.rushTier < RUSH_TIERS.length && this.streak >= RUSH_TIERS[this.rushTier]) {
      this.rushTier++;
      this.spawnFx(FX_RING, 0, 0, 0, 0, 0.4, 20, 150, 0.8, 0, 0, 0xff4d6a, LAYER_ADD, 0, 1);
      if (this.rushTier > this.rushAnnounced) {
        this.rushAnnounced = this.rushTier;
        this.messages.push({ text: `Blut Rush ${['I', 'II', 'III'][this.rushTier - 1]}: +${Math.round(RUSH_DAMAGE * this.rushTier * 100)}% damage`, kind: 'info' });
        this.sound('level');
      }
    }
  }

  /** The chain breaks: a hit landed, or nothing died for a while. */
  private breakChain(): void {
    this.streak = 0;
    this.rushTier = 0;
  }

  hurtPlayer(amount: number): void {
    const p = this.player;
    if (p.iframes > 0 || this.god || !p.alive || this.vollT > 0 || this.surgeT > 0) return;
    if (this.foresight > 0 && this.rng.next() < this.foresight) {
      // Foresight: you saw this future and stepped out of it.
      p.iframes = 0.25;
      this.spawnFx(FX_RING, 0, 0, 0, 0, 0.3, 16, 60, 0.9, 0, 0, 0xffe6a0, LAYER_ADD, 0, 1);
      return;
    }
    if (this.shieldCharges > 0) {
      // The Iron: steel skin eats the hit.
      this.shieldCharges--;
      p.iframes = 0.6;
      this.spawnFx(FX_RING, 0, 0, 0, 0, 0.35, 20, 70, 1, 0, 0, 0xdfe7f2, LAYER_ADD, 0, 1);
      this.sound('shield');
      if (this.ironBurst > 0) this.credit('iron', () => this.shockwave(140, this.ironBurst, 300));
      // Frozen Steel: the turned blow bursts into ice.
      if (this.resonances.has('ironice')) this.credit('hyorinmaru', () => this.frostBurst());
      return;
    }
    const hpBefore = p.hp;
    p.hp -= amount * this.stats.dmgTaken * (1 - this.balanceCut) * this.tm.damageTaken * this.modTaken;
    const lost = Math.max(0, hpBefore - Math.max(0, p.hp));
    this.takenSince += lost;
    // The Scales Turned: part of every wound turns straight back.
    if (this.resonances.has('scales') && lost > 0) this.credit('antithesis', () => this.scalesTurned(lost));
    p.iframes = PLAYER.iframes;
    this.breakChain();
    this.shake = Math.max(this.shake, 5);
    this.sound('hurt');
    // The Balance: the misfortune is shared with everything around you.
    if (this.balanceDmg > 0) this.credit('balance', () => this.shockwave(this.balanceR, this.balanceDmg, 140));
    // Old Friends: the shared misfortune catches fire.
    if (this.balanceDmg > 0 && this.resonances.has('oldfriends')) this.credit('heat', () => this.oldFriends());
    if (p.hp > 0) return;
    if (p.revives > 0) {
      p.revives--;
      p.hp = p.maxHp * 0.5;
      p.iframes = 2.5;
      this.credit(null, () => this.shockwave(220, 40 + this.level * 4, 420));
      this.messages.push({ text: 'Reishi threads lift you back up', kind: 'info' });
    } else {
      p.hp = 0;
      p.alive = false;
      this.over = 'dead';
    }
  }

  private shockwave(R: number, dmg: number, knock: number): void {
    const E = this.en;
    const p = this.player;
    for (let i = 0; i < E.n; i++) {
      if (E.dead[i]) continue;
      const dx = E.x[i] - p.x;
      const dy = E.y[i] - p.y;
      if (dx * dx + dy * dy > R * R) continue;
      this.damageEnemy(i, dmg, knock, p.x, p.y);
    }
    this.spawnFx(FX_SHOCK, 0, 0, 0, 0, 0.5, 40, R * 2.2, 1, 0, 0, 0xffe6a0, LAYER_ADD, 0, 1);
    this.spawnFx(FX_RING, 0, 0, 0, 0, 0.45, 40, R * 2.2, 0.6, 0, 0, 0xffffff, LAYER_ADD, 0, 1);
    this.shake = Math.max(this.shake, 10);
  }

  nearestEnemy(range: number): number {
    return this.grid.nearest(this.player.x, this.player.y, range, this.en.x, this.en.y, this.isAlive);
  }

  /** A random live enemy within `range`, preferring ones on screen; -1 if none. */
  randomEnemyNear(range: number): number {
    const p = this.player;
    const E = this.en;
    const n = this.grid.query(p.x - range, p.y - range, p.x + range, p.y + range, this.qbuf);
    if (n === 0) return -1;
    for (let tries = 0; tries < 10; tries++) {
      const j = this.qbuf[this.rng.int(n)];
      if (E.dead[j] || E.charmT[j] > 0) continue;
      const dx = E.x[j] - p.x;
      const dy = E.y[j] - p.y;
      if (dx * dx + dy * dy > range * range) continue;
      if (Math.abs(dx) > this.viewHalfW + 20 || Math.abs(dy) > this.viewHalfH) continue;
      return j;
    }
    return -1;
  }

  // --------------------------------------------------------- projectiles

  spawnProjectile(
    kind: number,
    src: number,
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    dmg: number,
    r: number,
    pierce: number,
    flags: number,
  ): number {
    const P = this.pr;
    if (P.n >= P.cap) return -1;
    const i = P.n++;
    P.x[i] = P.ox[i] = x;
    P.y[i] = P.oy[i] = y;
    P.vx[i] = vx;
    P.vy[i] = vy;
    P.life[i] = life;
    P.dmg[i] = dmg;
    P.r[i] = r;
    P.rot[i] = Math.atan2(vy, vx);
    P.pa[i] = 0;
    P.pb[i] = 0;
    P.pierce[i] = pierce;
    P.kind[i] = kind;
    P.src[i] = src;
    P.flags[i] = flags;
    P.hitN[i] = 0;
    return i;
  }

  /** Something that circles the player: blades, petals, drones. A negative ring spins the other way. */
  spawnOrbiter(kind: number, slot: number, offset: number, ring: number, dmg: number, r: number, flags: number): void {
    const ps = this.powers[slot];
    const p = this.player;
    const ang = (ring < 0 ? -ps.angle : ps.angle) + offset;
    const rad = Math.abs(ring);
    const i = this.spawnProjectile(kind, slot, p.x + Math.cos(ang) * rad, p.y + Math.sin(ang) * rad, 0, 0, 1e9, dmg, r, 0, flags);
    if (i < 0) return;
    this.pr.pa[i] = offset;
    this.pr.pb[i] = ring;
    this.pr.rot[i] = ang;
  }

  /** Remove a power's projectiles of one kind (its blades, petals or drones). */
  clearKind(slot: number, kind: number): void {
    const P = this.pr;
    for (let i = 0; i < P.n; i++) if (P.kind[i] === kind && P.src[i] === slot) P.life[i] = -1;
  }

  private updateProjectiles(): void {
    const P = this.pr;
    const E = this.en;
    const g = this.grid;
    const buf = this.qbuf;
    const p = this.player;
    for (let i = 0; i < P.n; i++) {
      if (P.life[i] <= 0) continue;
      this.dmgSlot = P.src[i];
      const kind = P.kind[i];
      P.ox[i] = P.x[i];
      P.oy[i] = P.y[i];
      let x: number;
      let y: number;
      if (kind === PK_BLADE || kind === PK_PETAL || kind === PK_DRONE) {
        const ps = this.powers[P.src[i]];
        if (!ps || ps.active <= 0) {
          P.life[i] = -1;
          continue;
        }
        const ring = P.pb[i];
        const ang = (ring < 0 ? -ps.angle : ps.angle) + P.pa[i];
        let rad = Math.abs(ring);
        if (kind === PK_PETAL) rad += Math.sin(this.t * 2.6 + P.pa[i] * 7) * 10;
        x = p.x + Math.cos(ang) * rad;
        y = p.y + Math.sin(ang) * rad;
        P.rot[i] = ang;
        P.x[i] = x;
        P.y[i] = y;
        if (kind === PK_DRONE) continue;
      } else {
        P.life[i] -= DT;
        if (kind === PK_BOMB) {
          // Lobbed: no collision in flight, it blows up where it lands.
          P.x[i] += P.vx[i] * DT;
          P.y[i] += P.vy[i] * DT;
          if (P.life[i] <= 0) explodeBomb(this, i);
          continue;
        }
        if (P.life[i] <= 0) continue;
        if (kind === PK_MISSILE && P.flags[i] & PF_HOMING) steerMissile(this, i);
        x = P.x[i] + P.vx[i] * DT;
        y = P.y[i] + P.vy[i] * DT;
        P.x[i] = x;
        P.y[i] = y;
        if (kind === PK_MISSILE || kind === PK_DRAGON) P.rot[i] = Math.atan2(P.vy[i], P.vx[i]);
      }
      const r = P.r[i];
      const n = g.query(x - r - 46, y - r - 46, x + r + 46, y + r + 46, buf);
      for (let k = 0; k < n; k++) {
        const j = buf[k];
        // Shots pass through enemies fighting on your side.
        if (E.dead[j] || E.charmT[j] > 0) continue;
        const rr = r + E.r[j];
        const dx = E.x[j] - x;
        const dy = E.y[j] - y;
        if (dx * dx + dy * dy > rr * rr) continue;
        if (kind === PK_BLADE || kind === PK_PETAL) {
          if (this.t - E.ohit[j] < (kind === PK_PETAL ? 0.22 : 0.3)) continue;
          E.ohit[j] = this.t;
          this.damageEnemy(j, P.dmg[i], kind === PK_PETAL ? 20 : 70, x, y);
          // Petals of Terror: The Fear rides on Senbonzakura's petals.
          if (kind === PK_PETAL && this.resonances.has('fearpetals') && !E.dead[j]) {
            this.applyHold(j, 0.5, HOLD_FEAR);
            this.applyVuln(j, 2, 0.2);
          }
          if (kind === PK_BLADE && P.flags[i] & PF_SPECIAL && this.rng.next() < 0.3) this.spawnShards(x, y, P.dmg[i] * 0.5);
          continue;
        }
        const uid = E.uid[j];
        if (this.alreadyHit(i, uid)) continue;
        this.recordHit(i, uid);
        const f = P.flags[i];
        const knock = kind === PK_ARROW ? 30 : kind === PK_DRAGON ? 60 : kind === PK_HEART ? 0 : 15;
        // Infected before the hit lands, so a bolt that kills still raises a zombie.
        if (f & PF_INFECT) E.infT[j] = Math.max(E.infT[j], P.pa[i]);
        this.damageEnemy(j, P.dmg[i], knock, x - P.vx[i] * 0.05, y - P.vy[i] * 0.05);
        if (f & PF_CHARM && !E.dead[j]) this.charm(j, P.pa[i], P.pb[i], this.powers[P.src[i]]?.attr ?? null);
        if (f & PF_STUN && !E.dead[j]) {
          this.applyHold(j, P.pa[i], HOLD_FEAR);
          if (P.pb[i] > 0) this.applyVuln(j, P.pa[i], P.pb[i]);
        }
        if (f & PF_FREEZE && !E.dead[j]) {
          this.applyHold(j, P.pa[i], HOLD_FREEZE);
          this.applyVuln(j, P.pa[i], 0.5);
        }
        if (f & PF_SPECIAL) burstAt(this, x, y, 36 * this.stats.size, P.dmg[i] * 0.6, j, true, 0x9fd8ff);
        if (f & PF_BURST) {
          burstAt(this, x, y, P.pa[i], P.dmg[i] * 0.7, j, true, 0xa8c4ff);
          this.spawnFx(FX_SHOCK, x, y, 0, 0, 0.22, P.pa[i] * 0.5, P.pa[i] * 2, 0.75, 0, 0, 0xc8d8ff, LAYER_ADD);
          P.life[i] = -1;
          break;
        }
        if (P.pierce[i]-- <= 0) {
          P.life[i] = -1;
          this.spawnFx(FX_SPARK, x, y, 0, 0, 0.15, 12, 4, 1, this.rng.next() * TAU, 0, 0xbfe8ff, LAYER_ADD);
          break;
        }
      }
    }
  }

  private alreadyHit(i: number, uid: number): boolean {
    const P = this.pr;
    const n = Math.min(P.hitN[i], HITS);
    const base = i * HITS;
    for (let k = 0; k < n; k++) if (P.hits[base + k] === uid) return true;
    return false;
  }

  private recordHit(i: number, uid: number): void {
    const P = this.pr;
    P.hits[i * HITS + (P.hitN[i] % HITS)] = uid;
    if (P.hitN[i] < 255) P.hitN[i]++;
  }

  private spawnShards(x: number, y: number, dmg: number): void {
    for (let k = 0; k < 2; k++) {
      const a = this.rng.next() * TAU;
      this.spawnProjectile(PK_SHARD, 0, x, y, Math.cos(a) * 320, Math.sin(a) * 320, 0.45, dmg, 6, 0, 0);
    }
  }

  /** Volatile kills explode after the step's projectile pass, so chains never recurse. */
  private queueBurst(x: number, y: number, r: number, dmg: number, slot = this.dmgSlot): void {
    if (this.burstN >= MAX_BURSTS || dmg <= 0) return;
    const b = this.burstN++ * 5;
    this.bursts[b] = x;
    this.bursts[b + 1] = y;
    this.bursts[b + 2] = r;
    this.bursts[b + 3] = dmg;
    this.bursts[b + 4] = slot;
  }

  private flushBursts(): void {
    let done = 0;
    while (this.burstN > 0 && done < MAX_BURSTS) {
      const b = --this.burstN * 5;
      this.dmgSlot = this.bursts[b + 4];
      burstAt(this, this.bursts[b], this.bursts[b + 1], this.bursts[b + 2], this.bursts[b + 3], -1, false, 0xffb37a);
      done++;
    }
    this.burstN = 0;
  }

  // ---------------------------------------------- zones, marks, bullets

  spawnZone(
    kind: number,
    x: number,
    y: number,
    vx: number,
    vy: number,
    r: number,
    life: number,
    tickInt: number,
    dmg: number,
    flags: number,
    extra = 0,
    src = 0,
  ): number {
    const Z = this.zones;
    if (Z.n >= Z.cap) return -1;
    const i = Z.n++;
    Z.x[i] = Z.ox[i] = x;
    Z.y[i] = Z.oy[i] = y;
    Z.vx[i] = vx;
    Z.vy[i] = vy;
    Z.r[i] = r;
    Z.life[i] = Z.max[i] = life;
    Z.tickT[i] = 0;
    Z.tickInt[i] = Math.max(0.05, tickInt);
    Z.dmg[i] = dmg;
    Z.extra[i] = extra;
    Z.aux[i] = 0;
    Z.kind[i] = kind;
    Z.flags[i] = flags;
    Z.src[i] = src;
    Z.seed[i] = this.rng.int(256);
    return i;
  }

  spawnMark(kind: number, shape: number, x: number, y: number, r: number, len: number, ang: number, delay: number, dmg: number, flags: number): number {
    const M = this.marks;
    if (M.n >= M.cap) return -1;
    const i = M.n++;
    M.x[i] = x;
    M.y[i] = y;
    M.r[i] = r;
    M.len[i] = len;
    M.ang[i] = ang;
    M.delay[i] = M.max[i] = delay;
    M.dmg[i] = dmg;
    M.kind[i] = kind;
    M.shape[i] = shape;
    M.flags[i] = flags;
    M.src[i] = this.dmgSlot;
    return i;
  }

  spawnEnemyBullet(kind: number, x: number, y: number, vx: number, vy: number, r: number, life: number, dmg: number, flags = 0): void {
    const B = this.eb;
    if (B.n >= B.cap) return;
    const i = B.n++;
    B.x[i] = B.ox[i] = x;
    B.y[i] = B.oy[i] = y;
    B.vx[i] = vx;
    B.vy[i] = vy;
    B.r[i] = r;
    B.life[i] = life;
    B.dmg[i] = dmg;
    B.kind[i] = kind;
    B.flags[i] = flags;
  }

  // ---------------------------------------------------------- orbs + xp

  spawnOrb(x: number, y: number, value: number): void {
    const O = this.orbs;
    if (O.n >= O.cap) {
      // Pool full: fold the mana into an existing orb instead of losing it.
      const j = this.rng.int(O.n);
      O.val[j] += value;
      O.tier[j] = orbTier(O.val[j]);
      return;
    }
    const i = O.n++;
    O.x[i] = O.ox[i] = x + this.rng.range(-4, 4);
    O.y[i] = O.oy[i] = y + this.rng.range(-4, 4);
    O.val[i] = value;
    O.tier[i] = orbTier(value);
    O.mag[i] = 0;
    O.spd[i] = 0;
  }

  private updateOrbs(): void {
    const O = this.orbs;
    const p = this.player;
    const R = PLAYER.magnet * this.stats.pickup;
    const R2 = R * R;
    const grab = PLAYER.radius + 8;
    for (let i = O.n - 1; i >= 0; i--) {
      const x = O.x[i];
      const y = O.y[i];
      O.ox[i] = x;
      O.oy[i] = y;
      const dx = p.x - x;
      const dy = p.y - y;
      const d2 = dx * dx + dy * dy;
      if (!O.mag[i]) {
        if (d2 > R2) continue;
        O.mag[i] = 1;
        O.spd[i] = 40;
      }
      const d = Math.sqrt(d2) || 1;
      O.spd[i] = Math.min(1100, O.spd[i] + 1500 * DT);
      const s = O.spd[i] * DT;
      if (d <= grab + s) {
        this.gainXp(O.val[i]);
        O.remove(i);
        continue;
      }
      O.x[i] = x + (dx / d) * s;
      O.y[i] = y + (dy / d) * s;
    }
  }

  private gainXp(v: number): void {
    this.xp += v * this.stats.xpGain;
    this.sound('orb');
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = xpToNext(this.level);
      // Stress runs never open the level-up board: it would pause the very thing being measured.
      if (this.stress === 0) this.pendingLevelUps++;
      this.sound('level');
      this.spawnFx(FX_RING, 0, 0, 0, 0, 0.5, 20, 170, 0.9, 0, 0, 0x9fe8ff, LAYER_ADD, 0, 1);
    }
  }

  // ------------------------------------------------------------ pickups

  addPickup(kind: PickupKind, x: number, y: number, bankai?: string, fragment?: string): void {
    if (this.pickups.length >= CAP.pickups) {
      const idx = this.pickups.findIndex((q) => !BIG_PICKUPS.has(q.kind));
      if (idx < 0) return;
      this.pickups.splice(idx, 1);
    }
    this.pickups.push({ kind, x, y, born: this.t, bankai, fragment });
  }

  private updatePickups(): void {
    const p = this.player;
    const list = this.pickups;
    const pull = PLAYER.magnet * this.stats.pickup * 0.8;
    for (let i = list.length - 1; i >= 0; i--) {
      const q = list[i];
      const dx = p.x - q.x;
      const dy = p.y - q.y;
      const d = Math.hypot(dx, dy);
      const big = BIG_PICKUPS.has(q.kind);
      if (!big && d < pull && d > 0) {
        const s = Math.min(d, 260 * DT);
        q.x += (dx / d) * s;
        q.y += (dy / d) * s;
      }
      if (d > PLAYER.radius + (big ? 16 : 12)) continue;
      list.splice(i, 1);
      this.collect(q);
    }
  }

  private collect(q: Pickup): void {
    switch (q.kind) {
      case 'chest':
      case 'chestBlack':
        this.gainChest(q.kind === 'chest' ? 'brown' : 'black');
        this.sound('chest');
        break;
      case 'medallion':
        if (q.bankai) this.grantBankai(q.bankai);
        break;
      case 'shrine':
        if (this.stress === 0) this.pendingShrine = true;
        this.sound('chest');
        break;
      case 'fragment':
        if (q.fragment) this.grantFragment(q.fragment);
        break;
      case 'heart':
        this.heal(0.3);
        this.sound('heal');
        this.spawnFx(FX_GLOW, 0, 0, 0, 0, 0.45, 30, 100, 0.7, 0, 0, 0xff6b8a, LAYER_ADD, 0, 1);
        break;
      case 'magnet': {
        const O = this.orbs;
        for (let i = 0; i < O.n; i++) {
          O.mag[i] = 1;
          O.spd[i] = Math.max(O.spd[i], 160);
        }
        this.sound('magnet');
        break;
      }
      case 'nuke':
        this.nuke();
        break;
    }
  }

  /** A chest queues a relic choice; under Barren (Daily Trial) it pays its gold on the spot instead. */
  private gainChest(kind: ChestKind): void {
    if (this.stress > 0) return;
    if (this.mods.has('barren') || this.chestGold) {
      const amount = kind === 'black' ? 150 : 50;
      this.gold += amount;
      this.messages.push({ text: `Only gold inside: +${amount}`, kind: 'info' });
      return;
    }
    this.pendingChests.push(kind);
  }

  /** Annihilation rune: clears the screen, chips the bosses. */
  private nuke(): void {
    const E = this.en;
    const p = this.player;
    const hw = this.viewHalfW + 30;
    const hh = this.viewHalfH + 30;
    for (let i = 0; i < E.n; i++) {
      if (E.dead[i]) continue;
      if (Math.abs(E.x[i] - p.x) > hw || Math.abs(E.y[i] - p.y) > hh) continue;
      if (E.flags[i] & FLAG_BOSS) {
        E.hp[i] -= E.maxHp[i] * 0.08;
        E.flash[i] = 0.1;
        if (E.hp[i] <= 0) this.killEnemy(i);
      } else {
        this.killEnemy(i);
      }
    }
    this.spawnFx(FX_GLOW, 0, 0, 0, 0, 0.6, 100, 1400, 0.9, 0, 0, 0xffffff, LAYER_ADD, 0, 1);
    this.shake = 14;
    this.sound('nuke');
  }

  heal(fraction: number): void {
    const p = this.player;
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * fraction);
  }

  healFlat(amount: number): void {
    const p = this.player;
    if (p.alive) p.hp = Math.min(p.maxHp, p.hp + amount);
  }

  // ------------------------------------------------------------ effects

  spawnFx(
    frame: number,
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    s0: number,
    s1: number,
    a0: number,
    rot: number,
    vr: number,
    tint: number,
    layer: number,
    drag = 0,
    follow = 0,
    sy = 0,
  ): void {
    const F = this.fx;
    if (F.n >= F.cap) return;
    const i = F.n++;
    F.x[i] = F.ox[i] = x;
    F.y[i] = F.oy[i] = y;
    F.vx[i] = vx;
    F.vy[i] = vy;
    F.life[i] = F.max[i] = life;
    F.s0[i] = s0;
    F.s1[i] = s1 > 0 ? s1 : s0;
    F.sy[i] = sy;
    F.a0[i] = a0;
    F.rot[i] = rot;
    F.vr[i] = vr;
    F.drag[i] = drag;
    F.frame[i] = frame;
    F.layer[i] = layer;
    F.follow[i] = follow;
    F.tint[i] = tint;
  }

  /** Hollows: the mask cracks into white shards and the body dissolves into ash. */
  private deathFx(x: number, y: number, color: number, r: number): void {
    this.spawnFx(FX_ASH, x, y, 0, -12, 0.45, r * 1.6, r * 3, 0.55, this.rng.next() * TAU, 0, 0x14101c, LAYER_NORMAL);
    for (let k = 0; k < 3; k++) {
      const a = this.rng.next() * TAU;
      const s = this.rng.range(60, 150);
      this.spawnFx(FX_MASK, x, y - r * 0.3, Math.cos(a) * s, Math.sin(a) * s - 30, this.rng.range(0.3, 0.5), r * 0.9, r * 0.5, 1, a, this.rng.range(-9, 9), color, LAYER_NORMAL, 3);
    }
    this.spawnFx(FX_GLOW, x, y, 0, 0, 0.2, r, r * 2.6, 0.45, 0, 0, 0xbfe6ff, LAYER_ADD);
  }

  /** Soul Reapers: the body comes apart into rising motes of spirit light. */
  private spiritFx(x: number, y: number, r: number): void {
    for (let k = 0; k < 4; k++) {
      const ox = this.rng.range(-r, r) * 0.7;
      this.spawnFx(FX_DOT, x + ox, y + this.rng.range(-r, r) * 0.5, ox * 0.6, -this.rng.range(50, 95), this.rng.range(0.4, 0.65), 5, 2, 0.95, 0, 0, 0xcfe6ff, LAYER_ADD, 1.5);
    }
    this.spawnFx(FX_GLOW, x, y, 0, 0, 0.22, r, r * 2.6, 0.5, 0, 0, 0x9fc8ff, LAYER_ADD);
  }

  private explosionFx(x: number, y: number): void {
    this.blastFx(x, y, 40, 0xff8a3c);
    this.sound('explode');
  }

  /** An explosion: a white-hot flash, the coloured blast, a shockwave ring, embers and drifting smoke. */
  blastFx(x: number, y: number, R: number, color: number, smoke = 3): void {
    this.spawnFx(FX_GLOW, x, y, 0, 0, 0.16, R * 0.6, R * 1.6, 1, 0, 0, 0xffffff, LAYER_ADD);
    this.spawnFx(FX_GLOW, x, y, 0, 0, 0.36, R, R * 2.6, 0.9, 0, 0, color, LAYER_ADD);
    this.spawnFx(FX_SHOCK, x, y, 0, 0, 0.32, R * 0.6, R * 2.4, 0.9, 0, 0, color, LAYER_ADD);
    for (let k = 0; k < 6; k++) {
      const a = this.rng.next() * TAU;
      const v = this.rng.range(120, 260);
      this.spawnFx(FX_SPARK, x, y, Math.cos(a) * v, Math.sin(a) * v, this.rng.range(0.25, 0.45), 10, 3, 1, a, 6, 0xffe2b0, LAYER_ADD, 3);
    }
    for (let k = 0; k < smoke; k++) {
      const a = this.rng.next() * TAU;
      const d = R * 0.3;
      this.spawnFx(FX_SMOKE, x + Math.cos(a) * d, y + Math.sin(a) * d, Math.cos(a) * 20, -25 + Math.sin(a) * 10, this.rng.range(0.6, 1), R * 0.5, R * 1.1, 0.35, this.rng.next() * TAU, this.rng.range(-1, 1), 0x3a3540, LAYER_NORMAL, 1);
    }
  }

  private bigBurst(x: number, y: number, color: number): void {
    this.spawnFx(FX_GLOW, x, y, 0, 0, 0.6, 60, 320, 1, 0, 0, color, LAYER_ADD);
    this.spawnFx(FX_RING, x, y, 0, 0, 0.55, 40, 360, 1, 0, 0, 0xffffff, LAYER_ADD);
    for (let k = 0; k < 18; k++) {
      const a = this.rng.next() * TAU;
      const s = this.rng.range(120, 320);
      this.spawnFx(FX_SPARK, x, y, Math.cos(a) * s, Math.sin(a) * s, this.rng.range(0.4, 0.8), 16, 4, 1, a, this.rng.range(-6, 6), color, LAYER_ADD, 2.5);
    }
  }

  private updateFx(): void {
    const F = this.fx;
    for (let i = F.n - 1; i >= 0; i--) {
      F.life[i] -= DT;
      if (F.life[i] <= 0) {
        F.remove(i);
        continue;
      }
      F.ox[i] = F.x[i];
      F.oy[i] = F.y[i];
      F.x[i] += F.vx[i] * DT;
      F.y[i] += F.vy[i] * DT;
      const drag = F.drag[i];
      if (drag > 0) {
        const k = Math.max(0, 1 - drag * DT);
        F.vx[i] *= k;
        F.vy[i] *= k;
      }
      F.rot[i] += F.vr[i] * DT;
    }
  }

  private updateNumbers(): void {
    const N = this.nums;
    for (let i = 0; i < N.cap; i++) {
      if (N.life[i] <= 0) continue;
      N.life[i] -= DT;
      N.y[i] -= 36 * DT;
    }
  }

  // ------------------------------------------------------------- timers

  private updateTimers(): void {
    if (this.almightyDue > 0) {
      this.almightyDue -= DT;
      if (this.almightyDue <= 0) this.grantAlmighty();
    }
    if (this.surgeT > 0) this.surgeT -= DT;
    if (this.sealT > 0) {
      this.sealT -= DT;
      if (this.sealT <= 0) {
        this.sealSlot = -1;
        this.buildVersion++;
      }
    }
    if (this.evolveT > 0) {
      this.evolveT -= DT;
      if (this.evolveT <= 0) this.evolve();
    }
    const p = this.player;
    if (p.iframes > 0) p.iframes -= DT;
    if (this.streak > 0) {
      this.streakT += DT;
      if (this.streakT > RUSH_WINDOW) this.breakChain();
    }
    if (this.stats.regen > 0 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + this.stats.regen * DT);
    if (this.miracleRegen > 0 && p.alive && p.hp < p.maxHp * 0.35) p.hp += this.miracleRegen * DT;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - 28 * DT);
    if (this.freezeAllT > 0) this.freezeAllT -= DT;
    if (this.stormT > 0) this.reishiStorm();
    if (this.almightyT > 0) {
      this.almightyT -= DT;
      if (this.almightyT <= 0) this.credit('almighty', () => rewrite(this));
    }
    if (this.hasClock) {
      this.clockCd -= DT;
      if (this.clockCd <= 0) {
        this.clockCd = 20;
        this.freezeAllT = 2.5;
        this.spawnFx(FX_RING, 0, 0, 0, 0, 0.6, 40, 900, 0.8, 0, 0, 0x8fd0ff, LAYER_ADD, 0, 1);
        this.sound('freeze');
      }
    }
    if (this.hasSigil) {
      this.sigilCd -= DT;
      if (this.sigilCd <= 0) {
        this.sigilCd = 6;
        for (let k = 0; k < 5; k++) {
          const j = this.randomEnemyNear(320);
          if (j < 0) break;
          strikeAt(this, this.en.x[j], this.en.y[j], 30 + this.level * 1.5, 34 * this.stats.size, null);
        }
        this.sound('strike');
      }
    }
  }

  /** Reishi Storm: mana orbs fall all over the screen for a while. */
  private reishiStorm(): void {
    this.stormT -= DT;
    this.stormAcc += DT;
    const p = this.player;
    const value = 1.5 * xpScale(this.t) * this.stage.xp;
    while (this.stormAcc >= 0.07) {
      this.stormAcc -= 0.07;
      const x = p.x + this.rng.range(-this.viewHalfW + 20, this.viewHalfW - 20);
      const y = p.y + this.rng.range(-this.viewHalfH + 60, this.viewHalfH - 60);
      this.spawnOrb(x, y, value);
      if (this.rng.next() < 0.3) this.spawnFx(FX_SPARK, x, y - 40, 0, 220, 0.18, 10, 4, 0.9, Math.PI / 2, 0, 0x9fd8ff, LAYER_ADD);
    }
  }

  /** Reclaim slots of everything that died or expired this step. */
  private compact(): void {
    const E = this.en;
    for (let i = 0; i < E.n; ) {
      if (E.dead[i]) E.remove(i);
      else i++;
    }
    const P = this.pr;
    for (let i = 0; i < P.n; ) {
      if (P.life[i] <= 0) P.remove(i);
      else i++;
    }
    this.boss.active = false;
    this.boss.final = false;
    if (this.bossCount > 0) {
      for (let i = 0; i < E.n; i++) {
        if (E.flags[i] & FLAG_BOSS) {
          const B = this.boss;
          B.active = true;
          B.final = E.uid[i] === this.finalBossUid;
          B.hp = E.hp[i];
          B.max = E.maxHp[i];
          if (B.uid !== E.uid[i]) {
            B.uid = E.uid[i];
            B.type = E.type[i];
            B.variant = E.variant[i];
            const def = ENEMY_LIST[E.type[i]];
            const bankai = BANKAI_IDS[E.variant[i]];
            if (def.id === 'bearer') {
              B.name = POWER_BY_ID.get(bankai)?.name ?? def.name;
              B.sub = 'Medallion bearer';
            } else if (def.id === 'captain') {
              const info = BANKAI_BY_ID.get(bankai);
              B.name = info?.owner ?? def.name;
              B.sub = info?.rank ?? '';
            } else if (def.id === 'royal') {
              const info = ROYAL_BY_ID.get(ROYAL_IDS[E.variant[i]]);
              B.name = info?.name ?? def.name;
              B.sub = info?.title ?? '';
            } else if (def.id === 'gotei') {
              const info = GOTEI_BY_ID.get(GOTEI_IDS[E.variant[i]]);
              B.name = info?.name ?? def.name;
              B.sub = info?.title ?? '';
            } else {
              const ev = this.stage.events.find((e): e is Extract<TimelineEvent, { kind: 'boss' }> => e.kind === 'boss' && e.enemy === def.id);
              B.name = def.name;
              B.sub = ev?.sub ?? '';
            }
          }
          break;
        }
      }
    }
  }

  // -------------------------------------------------- build choices

  offers(): Offer[] {
    return generateOffers(
      {
        powers: this.powers.map((ps) => ({ id: ps.def.id, level: ps.level })),
        passives: [...this.passives].map(([id, level]) => ({ id, level })),
        powerDefs: POWERS,
        passiveDefs: PASSIVES,
        maxPowers: 12,
        maxPassives: 8,
        resonances: RESONANCES,
        ownedResonances: this.resonances,
      },
      this.rng,
      this.choices,
    );
  }

  /** Cards on every level-up board: three, more with the Emperor's Foresight. */
  choices = 3;

  relicChoices(kind: ChestKind): RelicDef[] {
    const pool = RELICS.filter((r) => !r.locked || this.relicsOpen.has(r.id));
    return rollRelics(pool, new Set(this.relics.map((r) => r.id)), kind, this.rng);
  }

  private hasRelic(id: string): boolean {
    return this.relics.some((r) => r.id === id);
  }

  applyOffer(o: Offer): void {
    switch (o.kind) {
      case 'power-new':
      case 'power-up':
        this.addPower(o.id);
        break;
      case 'passive':
        this.addPassive(o.id);
        break;
      case 'heal':
        this.heal(0.3);
        break;
      case 'gold':
        this.gold += 25;
        break;
      case 'power-attr':
        // Resolved by chooseAttribute once the player picks one of the three.
        break;
      case 'resonance':
        this.addResonance(o.id);
        break;
    }
  }

  /** Two awakened Schrift resonate: the new effect joins the build, with a title card. */
  addResonance(id: string): boolean {
    const def = RESONANCE_BY_ID.get(id);
    if (!def || this.resonances.has(id)) return false;
    this.resonances.add(id);
    this.refreshTrios();
    const sub = resonanceParts(def)
      .map((p) => POWER_BY_ID.get(p)?.name ?? p)
      .join(' + ');
    this.banners.push({ kind: 'resonance', title: def.name, sub });
    this.sound('bankai');
    this.shake = Math.max(this.shake, 8);
    const color = Number.parseInt(def.color.slice(1), 16);
    this.spawnFx(FX_GLOW, 0, 0, 0, 0, 0.8, 50, 520, 0.9, 0, 0, color, LAYER_ADD, 0, 1);
    this.spawnFx(FX_RING, 0, 0, 0, 0, 0.7, 30, 460, 1, 0, 0, 0xffffff, LAYER_ADD, 0, 1);
    return true;
  }

  /** Schutzstaffel: mark which slots grow with your wounds. */
  private refreshTrios(): void {
    this.schutzBits = 0;
    if (!this.resonances.has('schutzstaffel')) return;
    this.powers.forEach((ps, slot) => {
      if ((ps.def.id === 'xaxis' || ps.def.id === 'death') && slot < 31) this.schutzBits |= 1 << slot;
    });
  }

  /** An owned power by id (the resonances read their partner's numbers through this). */
  power(id: string): PowerState | undefined {
    for (const ps of this.powers) if (ps.def.id === id) return ps;
    return undefined;
  }

  powerLevel(id: string): number {
    return this.powers.find((ps) => ps.def.id === id)?.level ?? 0;
  }

  addPower(id: string): void {
    this.buildVersion++;
    const owned = this.powers.find((ps) => ps.def.id === id);
    if (owned) {
      if (owned.level < upgradeCap(owned.def)) {
        owned.level++;
        refreshPowerStats(owned);
        syncPower(this, this.powers.indexOf(owned));
      }
      return;
    }
    this.checkEvolution(id);
    const def = POWER_BY_ID.get(id);
    if (!def) return;
    const ps = newPowerState(def);
    ps.since = this.t;
    this.powers.push(ps);
    syncPower(this, this.powers.length - 1);
    this.refreshTrios();
  }

  /**
   * Every bankai and fragment taken back and every Schrift awakened counts
   * toward the Emperor's evolution: the first one brings wings, the third
   * the eyes, The Almighty his shadow. `adding` is a power about to join.
   */
  private checkEvolution(adding?: string): void {
    const taken = this.takenBack(adding);
    const ultimate = adding === 'almighty' || this.powers.some((ps) => ps.def.group === 'ultimate');
    // Enough taken back: The Almighty is coming. A moment later, so the card for what earned it shows first.
    if (!this.almightyGranted && this.almightyDue <= 0 && taken >= (this.almightyUnlocked ? ALMIGHTY_AT_UNLOCKED : ALMIGHTY_AT)) {
      this.almightyDue = 3.2;
    }
    const tier = ultimate ? 3 : taken >= 3 ? 2 : taken >= 1 ? 1 : 0;
    if (tier <= Math.max(this.evolution, this.evolveNext)) return;
    this.evolveNext = tier;
    this.evolveT = 2.8;
  }

  /** Reveal the tier that was earned: the new look, a burst of light and its title card. */
  private evolve(): void {
    this.evolution = this.evolveNext;
    this.shake = Math.max(this.shake, 9);
    this.sound('bankai');
    this.spawnFx(FX_GLOW, 0, 0, 0, 0, 0.9, 40, 520, 1, 0, 0, this.evolution >= 3 ? 0xff2d4a : 0x9fdcff, LAYER_ADD, 0, 1);
    this.spawnFx(FX_RING, 0, 0, 0, 0, 0.7, 30, 460, 1, 0, 0, 0xffffff, LAYER_ADD, 0, 1);
    // The Almighty brings its own title card; the first two signs get theirs here.
    if (this.evolution === 1) this.banners.push({ kind: 'evolve', title: 'Reishi Wings', sub: 'What he takes back begins to show.' });
    else if (this.evolution === 2) this.banners.push({ kind: 'evolve', title: 'The Eyes Open', sub: 'Every power returned watches through him.' });
  }

  // -------------------------------------------------------------- shrines

  /** Up to three pacts the shrine offers: ones not made yet this run that would do something now. */
  shrineChoices(): PactDef[] {
    const pool = PACTS.filter((d) => !this.pacts.has(d.id) && this.pactPossible(d.id));
    const picks: PactDef[] = [];
    // The Silbern Key opens a fourth.
    const n = this.hasRelic('key') ? 4 : 3;
    while (picks.length < n && pool.length > 0) picks.push(pool.splice(this.rng.int(pool.length), 1)[0]);
    return picks;
  }

  private pactPossible(id: string): boolean {
    if (id === 'offering') return this.offering() !== null;
    if (id === 'hunter') return this.nextBearer() >= 0;
    if (id === 'wandenreich') return !this.chestGold && !this.mods.has('barren');
    return true;
  }

  /** The Offering's two attacks: the strongest that can still grow, and the weakest other one that can lose two levels. */
  private offering(): { strong: PowerState; weak: PowerState } | null {
    const attacks = this.powers.filter((ps) => ps.def.group === 'schrift' || ps.def.group === 'art');
    const strong = attacks.filter((ps) => ps.level < upgradeCap(ps.def)).sort((a, b) => b.level - a.level)[0];
    const weak = attacks.filter((ps) => ps !== strong && ps.attr === null && ps.level >= 3).sort((a, b) => a.level - b.level)[0];
    return strong && weak ? { strong, weak } : null;
  }

  /** The next medallion bearer (or captain) still to come, as an index into the timeline; -1 if none or a boss is out. */
  private nextBearer(): number {
    if (this.bossCount > 0) return -1;
    const events = this.stage.events;
    for (let k = this.evCursor; k < events.length; k++) {
      const e = events[k];
      if (e.kind === 'bearer' && !this.calledEarly.has(k) && this.bearers[e.tier] && e.at - this.t > 20) return k;
    }
    return -1;
  }

  /** Make a pact (each once a run). */
  takePact(id: string): void {
    if (this.pacts.has(id) || !this.pactPossible(id)) return;
    const def = PACT_BY_ID.get(id);
    if (!def) return;
    this.pacts.add(id);
    const p = this.player;
    switch (id) {
      case 'blood':
        this.pactMods.push({ dmg: 0.3, maxHp: -0.25 });
        break;
      case 'iron':
        this.pactMods.push({ maxHp: 0.4, regen: 2, dmg: -0.15 });
        break;
      case 'haste':
        this.pactMods.push({ moveSpeed: 0.2, cdr: 0.1 });
        this.pactSpeed *= 1.12;
        break;
      case 'greed':
        this.goldBonus *= 1.6;
        this.pactHp *= 1.2;
        break;
      case 'echoes':
        this.pactMods.push({ count: 1, dmg: -0.2 });
        break;
      case 'wandenreich':
        this.pactMods.push({ xpGain: 0.3 });
        this.chestGold = true;
        break;
      case 'offering': {
        const o = this.offering();
        if (!o) break;
        o.weak.level -= 2;
        refreshPowerStats(o.weak);
        syncPower(this, this.powers.indexOf(o.weak));
        this.addPower(o.strong.def.id);
        this.addPower(o.strong.def.id);
        break;
      }
      case 'hunter': {
        const k = this.nextBearer();
        const e = this.stage.events[k];
        if (!e || e.kind !== 'bearer') break;
        this.calledEarly.add(k);
        const i = this.spawnBearer(this.bearers[e.tier], e.hpMul);
        if (i >= 0) this.huntUid = this.en.uid[i];
        break;
      }
      case 'gamble':
        if (this.rng.next() < 0.5) {
          const pool = RELICS.filter((r) => r.rarity === 'legendary' && !this.relics.some((o) => o.id === r.id));
          const won = pool.length > 0 ? pool[this.rng.int(pool.length)] : null;
          if (won) this.addRelic(won.id);
          else this.gold += 200;
          this.messages.push({ text: won ? `The gamble pays: ${won.name}` : 'The gamble pays: 200 gold', kind: 'info' });
        } else {
          p.hp = Math.max(1, p.hp * 0.5);
          this.messages.push({ text: 'The gamble takes its price', kind: 'boss' });
        }
        break;
      case 'renewal':
        p.hp = p.maxHp;
        this.rerolls++;
        this.xp = 0;
        break;
    }
    this.recomputeStats();
    this.buildVersion++;
    this.sound('bankai');
    this.spawnFx(FX_GLOW, 0, 0, 0, 0, 0.7, 30, 360, 0.9, 0, 0, 0x9fdcff, LAYER_ADD, 0, 1);
  }

  // -------------------------------------------------------- the palace

  /** A Fragment of the Soul King you do not hold and that has not dropped this run, or null. */
  private fragmentToDrop(): string | null {
    const left = FRAGMENT_IDS.filter((id) => !this.dropped.has(id) && !this.powers.some((ps) => ps.def.id === id));
    const id = left.length > 0 ? left[this.rng.int(left.length)] : null;
    if (id) this.dropped.add(id);
    return id;
  }

  /** A fragment picked up: it joins your powers at Lv 1, with its own title card. */
  grantFragment(id: string): boolean {
    const def = POWER_BY_ID.get(id);
    if (!def || def.group !== 'fragment') return false;
    this.addPower(id);
    // The Soul King's Seal: it arrives a level up.
    if (this.hasRelic('seal')) this.addPower(id);
    this.banners.push({ kind: 'fragment', title: def.name, sub: 'A piece of the Soul King, taken back' });
    this.sound('bankai');
    this.shake = Math.max(this.shake, 10);
    this.spawnFx(FX_GLOW, 0, 0, 0, 0, 0.8, 40, 600, 1, 0, 0, 0xffe6a0, LAYER_ADD, 0, 1);
    this.spawnFx(FX_RING, 0, 0, 0, 0, 0.7, 30, 520, 1, 0, 0, 0xffffff, LAYER_ADD, 0, 1);
    return true;
  }

  /**
   * Ichibē's Ichimonji: one of your stronger attacks loses its name and falls
   * silent for a while. Returns its name, or null if you have none to lose.
   */
  sealPower(seconds: number): string | null {
    const slots = this.powers
      .map((ps, k) => ({ ps, k }))
      .filter(({ ps }) => ps.def.group === 'schrift' || ps.def.group === 'art' || ps.def.group === 'bankai')
      .sort((a, b) => b.ps.level - a.ps.level);
    if (slots.length === 0) return null;
    const pick = slots[this.rng.int(Math.min(2, slots.length))];
    this.sealSlot = pick.k;
    this.sealT = seconds;
    this.buildVersion++;
    return pick.ps.def.name;
  }

  /**
   * The Scales Turned: a quarter of every wound is undone at once, and the
   * nearest enemy loses three times the share of health you lost. What is
   * undone here no longer waits for The Antithesis to turn it back.
   */
  private scalesTurned(lost: number): void {
    const p = this.player;
    p.hp = Math.min(p.maxHp, p.hp + lost * 0.25);
    this.takenSince = Math.max(0, this.takenSince - lost * 0.25);
    const j = this.nearestEnemy(300);
    if (j >= 0) reverseWound(this, j, (lost / p.maxHp) * 3);
  }

  /** Old Friends: everything inside The Balance's burst burns with The Heat for 3 s. */
  private oldFriends(): void {
    const heat = this.power('heat');
    if (!heat) return;
    const p = this.player;
    const n = enemiesInCircle(this, p.x, p.y, this.balanceR);
    for (let k = 0; k < n; k++) this.applyDot(this.qout[k], 3, heat.stats.damage * 1.5, DOT_FIRE);
    this.spawnFx(FX_RING, 0, 0, 0, 0, 0.4, 20, this.balanceR, 0.9, 0, 0, 0xff9a4a, LAYER_ADD, 0, 1);
  }

  /** Frozen Steel: everything close freezes, and takes more damage while it is frozen. */
  private frostBurst(): void {
    const p = this.player;
    const n = enemiesInCircle(this, p.x, p.y, 160 * this.stats.size);
    for (let k = 0; k < n; k++) {
      const j = this.qout[k];
      this.applyHold(j, 1.6, HOLD_FREEZE);
      this.applyVuln(j, 1.6, 0.3);
    }
    this.spawnFx(FX_RING, 0, 0, 0, 0, 0.45, 30, 330, 1, 0, 0, 0xdff6ff, LAYER_ADD, 0, 1);
    this.spawnFx(FX_GLOW, 0, 0, 0, 0, 0.5, 40, 340, 0.8, 0, 0, 0x8fd8ff, LAYER_ADD, 0, 1);
    this.sound('freeze');
  }

  /** Overkill Storm: Gonryō Rikyū's lightning strikes eight enemies near you. */
  private overkillStorm(): void {
    const g = this.power('gonryo');
    if (!g) return;
    const dmg = g.stats.damage * 3;
    const R = g.stats.radius * g.stats.size * this.stats.size;
    for (let k = 0; k < 8; k++) {
      const j = this.randomEnemyNear(360);
      if (j < 0) break;
      strikeAt(this, this.en.x[j], this.en.y[j], dmg, R, null);
    }
    this.sound('strike');
  }

  /** A power's slot in `powers`, or 255 when you do not hold it. */
  slotOf(id: string): number {
    const k = this.powers.findIndex((ps) => ps.def.id === id);
    return k < 0 ? 255 : k;
  }

  /** Deal damage inside `fn` on behalf of a power (null: nobody's, as with a revive's blast). */
  private credit(id: string | null, fn: () => void): void {
    const prev = this.dmgSlot;
    this.dmgSlot = id ? this.slotOf(id) : 255;
    fn();
    this.dmgSlot = prev;
  }

  /**
   * Damage this run by power, most first: the total, and damage per second
   * over the time each was held. Everything not dealt by a power is "other".
   */
  damageReport(): { id: string; total: number; dps: number }[] {
    const rows = this.powers.map((ps, slot) => ({ id: ps.def.id, total: this.dmgBy[slot], dps: this.dmgBy[slot] / Math.max(1, this.t - ps.since) }));
    const other = this.dmgBy[255];
    if (other > 0) rows.push({ id: 'other', total: other, dps: other / Math.max(1, this.t - this.startT) });
    return rows.filter((r) => r.total > 0).sort((a, b) => b.total - a.total);
  }

  chooseAttribute(id: string, attr: string): void {
    const ps = this.powers.find((q) => q.def.id === id);
    if (!ps || !ps.def.attributes || ps.level !== ps.def.maxLevel - 1) return;
    if (!ps.def.attributes.some((a) => a.id === attr)) return;
    ps.level = ps.def.maxLevel;
    ps.attr = attr;
    this.buildVersion++;
    this.checkEvolution();
    refreshPowerStats(ps);
    syncPower(this, this.powers.indexOf(ps));
  }

  /**
   * Powers taken back this run toward The Almighty: every bankai, every
   * Fragment of the Soul King and every awakened Schrift. It awakens at five,
   * or at three once all six bankai have been taken back across your runs.
   */
  almightyProgress(): { have: number; need: number } | null {
    if (this.almightyGranted || this.almightyDue > 0) return null;
    return { have: this.takenBack(), need: this.almightyUnlocked ? ALMIGHTY_AT_UNLOCKED : ALMIGHTY_AT };
  }

  private takenBack(adding?: string): number {
    const ids = this.powers.map((ps) => ps.def.id);
    if (adding && !ids.includes(adding)) ids.push(adding);
    const groups = ids.map((id) => POWER_BY_ID.get(id)?.group);
    return groups.filter((g) => g === 'bankai' || g === 'fragment').length + this.powers.filter((ps) => ps.attr !== null).length;
  }

  /** A · The Almighty joins your powers, with its own title card. Once per run. */
  grantAlmighty(): boolean {
    if (this.almightyGranted) return false;
    const def = POWER_BY_ID.get('almighty');
    if (!def) return false;
    this.almightyGranted = true;
    this.addPower('almighty');
    this.banners.push({ kind: 'almighty', title: 'The Almighty', sub: 'Every future is yours to see, and to rewrite' });
    this.sound('almighty');
    this.shake = Math.max(this.shake, 12);
    this.spawnFx(FX_GLOW, 0, 0, 0, 0, 1, 60, 900, 1, 0, 0, 0xffe6a0, LAYER_ADD, 0, 1);
    this.spawnFx(FX_RING, 0, 0, 0, 0, 0.9, 40, 700, 1, 0, 0, 0xffffff, LAYER_ADD, 0, 1);
    return true;
  }

  /** A medallion was taken back: its bankai joins your powers at Lv 1 (or levels up if you somehow have it). */
  grantBankai(id: string): boolean {
    const def = POWER_BY_ID.get(id);
    if (!def || def.group !== 'bankai') return false;
    this.addPower(id);
    // Founder's Medallion: it arrives a level up.
    if (this.hasRelic('founder')) this.addPower(id);
    const info = BANKAI_BY_ID.get(id);
    this.banners.push({ kind: 'bankai', title: def.name, sub: info ? `${info.owner}'s bankai, stolen by ${info.thief}` : '' });
    this.sound('bankai');
    this.shake = Math.max(this.shake, 10);
    this.spawnFx(FX_GLOW, 0, 0, 0, 0, 0.8, 40, 600, 1, 0, 0, info?.aura ?? 0xffcb5c, LAYER_ADD, 0, 1);
    this.spawnFx(FX_RING, 0, 0, 0, 0, 0.7, 30, 520, 1, 0, 0, 0xffe6a0, LAYER_ADD, 0, 1);
    return true;
  }

  /**
   * The Captain-Commander below half health: the Emperor takes Zanka no Tachi
   * from him in the middle of the fight, as he did in the story.
   */
  stealZanka(i: number): void {
    const E = this.en;
    const p = this.player;
    this.zankaStolen = true;
    const dx = p.x - E.x[i];
    const dy = p.y - E.y[i];
    const d = Math.hypot(dx, dy) || 1;
    this.spawnFx(FX_BEAMH, E.x[i] + dx / 2, E.y[i] + dy / 2, 0, 0, 0.7, d, d, 1, Math.atan2(dy, dx), 0, 0xff7a3c, LAYER_ADD, 0, 0, 12);
    this.spawnFx(FX_RING, E.x[i], E.y[i], 0, 0, 0.6, COMMANDER_HEAT, 20, 1, 0, 0, 0xff7a3c, LAYER_ADD);
    this.grantBankai('zanka');
    this.messages.push({ text: 'Zanka no Tachi is yours. The Captain-Commander fights on without it.', kind: 'boss' });
    E.atkT[i] = 1.6;
  }

  /** Testing: own a power at a given level (taking the first attribute when it reaches its last level). */
  give(id: string, level: number): void {
    const def = POWER_BY_ID.get(id);
    if (!def) return;
    for (let guard = 0; guard < 12 && this.powerLevel(id) < Math.min(level, upgradeCap(def)); guard++) this.addPower(id);
    if (def.attributes && level >= def.maxLevel) this.chooseAttribute(id, def.attributes[0].id);
  }

  addPassive(id: string): void {
    const def = PASSIVE_BY_ID.get(id);
    if (!def) return;
    const level = this.passives.get(id) ?? 0;
    if (level >= def.max) return;
    this.passives.set(id, level + 1);
    this.recomputeStats();
  }

  addRelic(id: string): void {
    const def = RELIC_BY_ID.get(id);
    if (!def || this.relics.includes(def)) return;
    this.relics.push(def);
    if (def.special === 'phoenix') this.player.revives++;
    if (def.special === 'stopclock') this.hasClock = true;
    if (def.special === 'wildsigil') this.hasSigil = true;
    if (def.special === 'sanrei') this.hasSanrei = true;
    this.recomputeStats();
  }

  recomputeStats(): void {
    const mods: StatMods[] = [];
    for (const [id, level] of this.passives) {
      const def = PASSIVE_BY_ID.get(id);
      if (def) mods.push(scaleMods(def.perLevel, level));
    }
    for (const r of this.relics) if (r.mods) mods.push(r.mods);
    if (this.metaMods) mods.push(this.metaMods);
    // Frail (Daily Trial): less health, steady regeneration. Barren: no relics, faster level-ups.
    if (this.mods.has('frail')) mods.push({ maxHp: -0.4, regen: 1.5 });
    if (this.mods.has('barren')) mods.push({ xpGain: 0.3 });
    mods.push(...this.pactMods);
    const p = this.player;
    const prevMax = p.maxHp;
    const prevCount = this.stats.count;
    const prevSize = this.stats.size;
    this.stats = computeStats(mods);
    this.baseDmgMul = damageMultiplier(this.stats);
    this.dmgMul = this.baseDmgMul;
    p.maxHp = this.stats.maxHp;
    if (p.maxHp > prevMax) p.hp += p.maxHp - prevMax;
    p.hp = Math.min(p.hp, p.maxHp);
    // Orbiters and auras depend on count and size: rebuild them when those change.
    if (this.stats.count !== prevCount || this.stats.size !== prevSize) {
      for (let s = 0; s < this.powers.length; s++) syncPower(this, s);
    }
  }
}
