import { UPGRADES } from '../data/archives';
import { BANKAI_IDS } from '../data/bankai';
import { DAILY_CLEAR_GOLD, DAILY_SURVIVE_GOLD, DAILY_SURVIVE_TIME } from '../data/daily';
import { STARTABLE_IDS, STARTING_POWER } from '../data/powers';
import { MAX_TRIAL, STAGE_IDS, STAGES, type StageId } from '../data/stages';
import { CHAPTER_BY_ID } from '../data/story';

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
  /** Today's Daily Trial: its date, best time, and whether its survival and clear bonuses were paid. */
  daily: DailyRecord;
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
    settings: { sound: true, music: true, numbers: true, shake: true },
    stage: 'hueco',
    stages: Object.fromEntries(STAGE_IDS.map((id) => [id, { best: 0, cleared: false, clearTrial: -1, endless: 0 }])) as Record<StageId, StageRecord>,
    taken: [],
    gold: 0,
    meta: {},
    awakened: [],
    start: STARTING_POWER,
    chapters: [],
    trial: 0,
    endless: false,
    daily: { date: '', best: 0, survived: false, cleared: false },
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
    stages[id] = { best: num(rec.best, 0), cleared, clearTrial, endless: num(rec.endless, 0) };
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
    daily: {
      date: typeof obj(r.daily).date === 'string' ? (obj(r.daily).date as string) : '',
      best: num(obj(r.daily).best, 0),
      survived: bool(obj(r.daily).survived, false),
      cleared: bool(obj(r.daily).cleared, false),
    },
  };
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
  if (r.cleared) save.totals.clears++;
  if (r.time > save.best.time && !r.daily) save.best = { time: r.time, level: r.level, kills: r.kills };
  if (r.daily) return { newBest: false, unlocked: null, almighty: !hadAlmighty && almightyUnlocked(save), starts };
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
