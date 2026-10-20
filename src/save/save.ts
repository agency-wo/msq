import { GESANG_VERSES, UPGRADES } from '../data/archives';
import { BANKAI_IDS } from '../data/bankai';
import { RESONANCE_BY_ID } from '../data/resonances';
import { TRAIL_BY_ID, type TrailId } from '../data/looks';
import { RELIC_BY_ID } from '../data/relics';
import { CODEX_ENEMY_KEYS } from '../data/codex';
import { DAILY_CLEAR_GOLD, DAILY_SURVIVE_GOLD, DAILY_SURVIVE_TIME } from '../data/daily';
import { POWER_BY_ID, STARTABLE_IDS, STARTING_POWER } from '../data/powers';
import { MAX_TRIAL, STAGE_IDS, STAGES, type StageId } from '../data/stages';
import { CHAPTER_BY_ID } from '../data/story';
import { TIP_IDS } from '../data/tips';
import { FEAT_BY_ID, LOOKS, type LookId } from './feats';

/**
 * Versioned save in localStorage. On iPhone a Home Screen web app keeps its
 * own storage, which Safari's 7-day cleanup does not touch; the export code
 * is a manual backup on top of that.
 */

export interface Settings {
  sound: boolean;
  music: boolean;
  numbers: boolean;
  shake: boolean;
  /** First-time tips. */
  tips: boolean;
}

export interface Best {
  time: number;
  level: number;
  kills: number;
}

export interface StageRecord {
  /** Longest survival on this stage, seconds. */
  best: number;
  cleared: boolean;
  /** Highest trial cleared (0 = normal), -1 before the first clear. */
  clearTrial: number;
  /** Longest Endless run, seconds. */
  endless: number;
  /** Fastest Boss Rush clear, seconds (0: not yet). */
  rush: number;
}

export interface SaveData {
  v: 1;
  best: Best;
  totals: { runs: number; kills: number; clears: number; gold: number };
  settings: Settings;
  /** The stage picked last time, so Play starts there again. */
  stage: StageId;
  stages: Record<StageId, StageRecord>;
  /** Every bankai ever taken back, across runs. All six unlock A · The Almighty. */
  taken: string[];
  /** Gold to spend in the Archives (totals.gold counts everything ever earned). */
  gold: number;
  /** Archives upgrade levels, by upgrade id. */
  meta: Record<string, number>;
  /** Attacks ever awakened to Lv 7 in a run: each can open a run. */
  awakened: string[];
  /** The Schrift a run opens with. */
  start: string;
  /** Story chapters already told. */
  chapters: string[];
  /** The trial and Endless picked on the title screen (checked against what each stage has opened). */
  trial: number;
  endless: boolean;
  /** Boss Rush picked on the title screen (it and Endless exclude each other). */
  rush: boolean;
  /** Today's Daily Trial: its date, best time, and whether its survival and clear bonuses were paid. */
  daily: DailyRecord;
  /** The furthest the Emperor has evolved in any run (0 to 3), shown on the title. */
  evolution: number;
  /** What the Codex has opened: powers held, relics found, resonances made, enemies defeated (by Codex key). */
  codex: Codex;
  /** Feats earned, and the best single run toward each feat that is about one run. */
  feats: string[];
  featBest: Record<string, number>;
  /** Emperor looks opened by feats, and the one he wears. */
  looks: LookId[];
  look: LookId;
  /** Relics opened by feats, which can now turn up in chests. */
  relicsOpen: string[];
  /** First-time tips already shown. */
  tips: string[];
  /** Relics bought into the Armory, and the one every run (but the Daily Trial) starts with. */
  armory: string[];
  startRelic: string | null;
  /** Verses of the Kaiser Gesang sung, 0 to GESANG_VERSES. */
  gesang: number;
  /** Cloak trails bought in the Wardrobe ('none' is always there), and the one he wears. */
  trails: TrailId[];
  trail: TrailId;
}

export interface Codex {
  powers: string[];
  relics: string[];
  resonances: string[];
  kills: Record<string, number>;
}

export interface DailyRecord {
  date: string;
  best: number;
  survived: boolean;
  cleared: boolean;
}

export interface RunResult {
  stage: StageId;
  /** Bankai taken back during the run. */
  bankai?: readonly string[];
  /** Powers awakened to Lv 7 during the run. */
  awakened?: readonly string[];
  trial?: number;
  endless?: boolean;
  /** A Daily Trial: counts for gold, bankai, awakenings and totals, not for stage records or unlocks. */
  daily?: boolean;
  /** How far the Emperor evolved in the run. */
  evolution?: number;
  /** A Boss Rush: keeps its own record (the fastest clear) and changes nothing else about the stage. */
  bossRush?: boolean;
  /** What the run discovered, for the Codex. */
  codex?: { powers: string[]; relics: string[]; resonances: string[]; kills: Record<string, number> };
  time: number;
  level: number;
  kills: number;
  cleared: boolean;
  /** Gold the run paid out (see game/rewards.ts). */
  gold: number;
}

const KEY = 'msq.save';
const CODE_PREFIX = 'MSQ1.';

export function defaultSave(): SaveData {
  return {
    v: 1,
    best: { time: 0, level: 0, kills: 0 },
    totals: { runs: 0, kills: 0, clears: 0, gold: 0 },
    settings: { sound: true, music: true, numbers: true, shake: true, tips: true },
    stage: 'hueco',
    stages: Object.fromEntries(STAGE_IDS.map((id) => [id, { best: 0, cleared: false, clearTrial: -1, endless: 0, rush: 0 }])) as Record<StageId, StageRecord>,
    taken: [],
    gold: 0,
    meta: {},
    awakened: [],
    start: STARTING_POWER,
    chapters: [],
    trial: 0,
    endless: false,
    rush: false,
    daily: { date: '', best: 0, survived: false, cleared: false },
    evolution: 0,
    // You always begin with Heilig Pfeil, so the Codex always knows it.
    codex: { powers: [STARTING_POWER], relics: [], resonances: [], kills: {} },
    feats: [],
    featBest: {},
    looks: ['default'],
    look: 'default',
    relicsOpen: [],
    tips: [],
    armory: [],
    startRelic: null,
    gesang: 0,
    trails: ['none'],
    trail: 'none',
  };
}

/** Fold a Daily Trial into today's record: the bonus gold it earned (each bonus paid once a day) and whether it set today's best. */
export function recordDaily(save: SaveData, date: string, time: number, cleared: boolean): { bonus: number; newBest: boolean } {
  if (save.daily.date !== date) save.daily = { date, best: 0, survived: false, cleared: false };
  let bonus = 0;
  if (time >= DAILY_SURVIVE_TIME && !save.daily.survived) {
    save.daily.survived = true;
    bonus += DAILY_SURVIVE_GOLD;
  }
  if (cleared && !save.daily.cleared) {
    save.daily.cleared = true;
    bonus += DAILY_CLEAR_GOLD;
  }
  const newBest = time > save.daily.best;
  save.daily.best = Math.max(save.daily.best, time);
  save.gold += bonus;
  save.totals.gold += bonus;
  return { bonus, newBest };
}

/** The highest trial a stage offers: one past the highest cleared, once it has been cleared at all. */
export function trialsOpen(save: SaveData, id: StageId): number {
  const rec = save.stages[id];
  return rec.cleared ? Math.min(MAX_TRIAL, Math.max(0, rec.clearTrial) + 1) : 0;
}

/** Endless opens once a stage has been cleared. */
export function endlessOpen(save: SaveData, id: StageId): boolean {
  return save.stages[id].cleared;
}

/** Boss Rush opens on a stage once it has been cleared. */
export function rushOpen(save: SaveData, id: StageId): boolean {
  return save.stages[id].cleared;
}

/** A · The Almighty: unlocked once every bankai has been taken back at least once. */
export function almightyUnlocked(save: SaveData): boolean {
  return BANKAI_IDS.every((id) => save.taken.includes(id));
}

/** Hueco Mundo is always open; every other stage opens when the one before it is cleared. */
export function stageUnlocked(save: SaveData, id: StageId): boolean {
  const def = STAGES.find((s) => s.id === id);
  if (!def) return false;
  return !def.unlockedBy || save.stages[def.unlockedBy].cleared;
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function obj(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

/** Accept anything and return a valid save: unknown or broken fields fall back to defaults. */
export function migrate(raw: unknown): SaveData {
  const d = defaultSave();
  const r = obj(raw);
  const best = obj(r.best);
  const totals = obj(r.totals);
  const settings = obj(r.settings);
  const stagesRaw = obj(r.stages);
  const stages = d.stages;
  for (const id of STAGE_IDS) {
    const rec = obj(stagesRaw[id]);
    const cleared = bool(rec.cleared, false);
    const clearTrial = cleared ? Math.min(MAX_TRIAL, Math.floor(num(rec.clearTrial, 0))) : -1;
    stages[id] = { best: num(rec.best, 0), cleared, clearTrial, endless: num(rec.endless, 0), rush: num(rec.rush, 0) };
  }
  // Saves from before stages existed: everything they recorded was Hueco Mundo.
  if (!('stages' in r)) {
    stages.hueco.best = num(best.time, 0);
    stages.hueco.cleared = num(totals.clears, 0) > 0;
    stages.hueco.clearTrial = stages.hueco.cleared ? 0 : -1;
  }
  const stage = STAGE_IDS.find((id) => id === r.stage) ?? 'hueco';
  const taken = Array.isArray(r.taken) ? BANKAI_IDS.filter((id) => (r.taken as unknown[]).includes(id)) : [];
  const metaRaw = obj(r.meta);
  const meta: Record<string, number> = {};
  for (const u of UPGRADES) {
    const level = Math.floor(num(metaRaw[u.id], 0));
    if (level > 0) meta[u.id] = Math.min(level, u.costs.length);
  }
  const awakened = Array.isArray(r.awakened) ? STARTABLE_IDS.filter((id) => (r.awakened as unknown[]).includes(id)) : [];
  const start = typeof r.start === 'string' && awakened.includes(r.start) ? r.start : STARTING_POWER;
  const chapters = Array.isArray(r.chapters) ? (r.chapters as unknown[]).filter((id): id is string => typeof id === 'string' && CHAPTER_BY_ID.has(id)) : [];
  const feats = migrateFeats(r);
  const codex = migrateCodex(r.codex, awakened, taken);
  return {
    v: 1,
    best: { time: num(best.time, 0), level: num(best.level, 0), kills: num(best.kills, 0) },
    totals: {
      runs: num(totals.runs, 0),
      kills: num(totals.kills, 0),
      clears: num(totals.clears, 0),
      gold: num(totals.gold, 0),
    },
    settings: {
      sound: bool(settings.sound, d.settings.sound),
      music: bool(settings.music, d.settings.music),
      numbers: bool(settings.numbers, d.settings.numbers),
      shake: bool(settings.shake, d.settings.shake),
      tips: bool(settings.tips, d.settings.tips),
    },
    stage,
    stages,
    taken,
    // Saves from before the Archives start with the gold they had already counted.
    gold: num(r.gold, num(totals.gold, 0)),
    meta,
    awakened,
    start,
    chapters: [...new Set(chapters)],
    trial: Math.min(MAX_TRIAL, Math.floor(num(r.trial, 0))),
    endless: bool(r.endless, false),
    rush: bool(r.rush, false),
    daily: {
      date: typeof obj(r.daily).date === 'string' ? (obj(r.daily).date as string) : '',
      best: num(obj(r.daily).best, 0),
      survived: bool(obj(r.daily).survived, false),
      cleared: bool(obj(r.daily).cleared, false),
    },
    evolution: Math.max(0, Math.min(3, Math.floor(num(r.evolution, 0)))),
    codex,
    ...feats,
    tips: Array.isArray(r.tips) ? [...new Set(r.tips.filter((id): id is string => typeof id === 'string' && (TIP_IDS as string[]).includes(id)))] : [],
    ...migrateArmory(r, feats.relicsOpen, codex.relics),
    ...migrateTrails(r),
  };
}

/** Trails that exist, 'none' always among them; the one worn must be owned. */
function migrateTrails(r: Record<string, unknown>): Pick<SaveData, 'trails' | 'trail'> {
  const owned = Array.isArray(r.trails) ? r.trails.filter((id): id is TrailId => typeof id === 'string' && TRAIL_BY_ID.has(id)) : [];
  const trails = [...new Set<TrailId>(['none', ...owned])];
  const trail = trails.find((id) => id === r.trail) ?? 'none';
  return { trails, trail };
}

/**
 * The Armory and the Kaiser Gesang: only relics that exist (and are open) and
 * were bought, a start relic that is in the Armory or a spoil of war already
 * won, a whole number of verses.
 */
function migrateArmory(r: Record<string, unknown>, relicsOpen: readonly string[], found: readonly string[]): Pick<SaveData, 'armory' | 'startRelic' | 'gesang'> {
  const valid = (id: unknown): id is string => {
    if (typeof id !== 'string') return false;
    const relic = RELIC_BY_ID.get(id);
    return !!relic && !relic.boss && (!relic.locked || relicsOpen.includes(id));
  };
  const armory = Array.isArray(r.armory) ? [...new Set(r.armory.filter(valid))] : [];
  const spoil = (id: string): boolean => !!RELIC_BY_ID.get(id)?.boss && found.includes(id);
  const startRelic = typeof r.startRelic === 'string' && (armory.includes(r.startRelic) || spoil(r.startRelic)) ? r.startRelic : null;
  const gesang = Math.min(GESANG_VERSES, Math.floor(num(r.gesang, 0)));
  return { armory, startRelic, gesang };
}

/** Feats, looks and feat-opened relics, each checked against what exists. */
function migrateFeats(r: Record<string, unknown>): Pick<SaveData, 'feats' | 'featBest' | 'looks' | 'look' | 'relicsOpen'> {
  const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const feats = [...new Set(strings(r.feats).filter((id) => FEAT_BY_ID.has(id)))];
  const featBest: Record<string, number> = {};
  for (const [id, n] of Object.entries(obj(r.featBest))) {
    if (FEAT_BY_ID.has(id) && typeof n === 'number' && Number.isFinite(n) && n > 0) featBest[id] = n;
  }
  const lookIds = LOOKS.map((l) => l.id);
  const looks = [...new Set<LookId>(['default', ...strings(r.looks).filter((id): id is LookId => (lookIds as string[]).includes(id))])];
  const look = looks.find((id) => id === r.look) ?? 'default';
  const relicsOpen = [...new Set(strings(r.relicsOpen).filter((id) => RELIC_BY_ID.get(id)?.locked))];
  return { feats, featBest, looks, look, relicsOpen };
}

/** The Codex, checked entry by entry. Saves from before it existed open what they already awakened and took back. */
function migrateCodex(raw: unknown, awakened: readonly string[], taken: readonly string[]): Codex {
  const c = obj(raw);
  const list = (v: unknown, valid: (id: string) => boolean): string[] =>
    Array.isArray(v) ? [...new Set(v.filter((id): id is string => typeof id === 'string' && valid(id)))] : [];
  const kills: Record<string, number> = {};
  for (const [key, n] of Object.entries(obj(c.kills))) {
    if (CODEX_ENEMY_KEYS.has(key) && typeof n === 'number' && Number.isFinite(n) && n > 0) kills[key] = Math.floor(n);
  }
  const powers = raw !== undefined ? list(c.powers, (id) => POWER_BY_ID.has(id)) : [STARTING_POWER, ...awakened, ...taken];
  return {
    powers: [...new Set(powers)],
    relics: list(c.relics, (id) => RELIC_BY_ID.has(id)),
    resonances: list(c.resonances, (id) => RESONANCE_BY_ID.has(id)),
    kills,
  };
}

/** Fold a run's discoveries into the Codex. */
function recordCodex(save: SaveData, found: NonNullable<RunResult['codex']>): void {
  const c = save.codex;
  for (const id of found.powers) if (POWER_BY_ID.has(id) && !c.powers.includes(id)) c.powers.push(id);
  for (const id of found.relics) if (RELIC_BY_ID.has(id) && !c.relics.includes(id)) c.relics.push(id);
  for (const id of found.resonances) if (RESONANCE_BY_ID.has(id) && !c.resonances.includes(id)) c.resonances.push(id);
  for (const [key, n] of Object.entries(found.kills)) if (CODEX_ENEMY_KEYS.has(key) && n > 0) c.kills[key] = (c.kills[key] ?? 0) + n;
}

function defaultStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Some private modes throw on access.
    return null;
  }
}

export function loadSave(storage: Storage | null = defaultStorage()): SaveData {
  if (!storage) return defaultSave();
  try {
    const raw = storage.getItem(KEY);
    return raw ? migrate(JSON.parse(raw)) : defaultSave();
  } catch {
    return defaultSave();
  }
}

export function writeSave(data: SaveData, storage: Storage | null = defaultStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

function toBase64(s: string): string {
  let bin = '';
  for (const b of new TextEncoder().encode(s)) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function exportCode(data: SaveData): string {
  return CODE_PREFIX + toBase64(JSON.stringify(data));
}

/** Parse a code from exportCode; null if it is not one. */
export function importCode(code: string): SaveData | null {
  const c = code.trim();
  if (!c.startsWith(CODE_PREFIX)) return null;
  try {
    return migrate(JSON.parse(fromBase64(c.slice(CODE_PREFIX.length))));
  } catch {
    return null;
  }
}

export interface RecordOutcome {
  newBest: boolean;
  /** A stage this run opened up, if any. */
  unlocked: StageId | null;
  /** This run took back the last missing bankai: A · The Almighty is unlocked. */
  almighty: boolean;
  /** Attacks awakened for the first time: new starting options. */
  starts: string[];
}

/**
 * Fold a finished run into the save: records, the gold it paid, the bankai it
 * took back and the attacks it awakened. "Best" is the longest survival,
 * overall and per stage; newBest is about the stage just played.
 */
export function recordRun(save: SaveData, r: RunResult): RecordOutcome {
  const hadAlmighty = almightyUnlocked(save);
  for (const id of r.bankai ?? []) if (BANKAI_IDS.includes(id) && !save.taken.includes(id)) save.taken.push(id);
  const starts: string[] = [];
  for (const id of r.awakened ?? []) {
    if (!STARTABLE_IDS.includes(id) || save.awakened.includes(id)) continue;
    save.awakened.push(id);
    if (id !== STARTING_POWER) starts.push(id);
  }
  save.totals.runs++;
  save.totals.kills += r.kills;
  save.totals.gold += r.gold;
  save.gold += r.gold;
  save.evolution = Math.max(save.evolution, Math.min(3, r.evolution ?? 0));
  if (r.codex) recordCodex(save, r.codex);
  if (r.cleared) save.totals.clears++;
  if (r.time > save.best.time && !r.daily && !r.bossRush) save.best = { time: r.time, level: r.level, kills: r.kills };
  if (r.daily) return { newBest: false, unlocked: null, almighty: !hadAlmighty && almightyUnlocked(save), starts };
  if (r.bossRush) {
    const rec = save.stages[r.stage];
    const newBest = r.cleared && (rec.rush === 0 || r.time < rec.rush);
    if (newBest) rec.rush = r.time;
    return { newBest, unlocked: null, almighty: !hadAlmighty && almightyUnlocked(save), starts };
  }
  const rec = save.stages[r.stage];
  // Endless runs keep their own record; newBest is about the record this run competes with.
  const newBest = r.endless ? r.time > rec.endless : r.time > rec.best;
  if (r.endless) rec.endless = Math.max(rec.endless, r.time);
  else if (r.time > rec.best) rec.best = r.time;
  let unlocked: StageId | null = null;
  if (r.cleared && !rec.cleared) {
    rec.cleared = true;
    unlocked = STAGES.find((s) => s.unlockedBy === r.stage)?.id ?? null;
  }
  if (r.cleared) rec.clearTrial = Math.max(rec.clearTrial, r.trial ?? 0);
  return { newBest, unlocked, almighty: !hadAlmighty && almightyUnlocked(save), starts };
}
