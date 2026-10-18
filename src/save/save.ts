import { BANKAI_IDS } from '../data/bankai';
import { STAGE_IDS, STAGES, type StageId } from '../data/stages';

/**
 * Versioned save in localStorage. On iPhone a Home Screen web app keeps its
 * own storage, which Safari's 7-day cleanup does not touch; the export code
 * is a manual backup on top of that.
 */

export interface Settings {
  sound: boolean;
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
}

export interface RunResult {
  stage: StageId;
  /** Bankai taken back during the run. */
  bankai?: readonly string[];
  time: number;
  level: number;
  kills: number;
  cleared: boolean;
  gold: number;
}

const KEY = 'msq.save';
const CODE_PREFIX = 'MSQ1.';

export function defaultSave(): SaveData {
  return {
    v: 1,
    best: { time: 0, level: 0, kills: 0 },
    totals: { runs: 0, kills: 0, clears: 0, gold: 0 },
    settings: { sound: true, numbers: true, shake: true },
    stage: 'hueco',
    stages: Object.fromEntries(STAGE_IDS.map((id) => [id, { best: 0, cleared: false }])) as Record<StageId, StageRecord>,
    taken: [],
  };
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
    stages[id] = { best: num(rec.best, 0), cleared: bool(rec.cleared, false) };
  }
  // Saves from before stages existed: everything they recorded was Hueco Mundo.
  if (!('stages' in r)) {
    stages.hueco.best = num(best.time, 0);
    stages.hueco.cleared = num(totals.clears, 0) > 0;
  }
  const stage = STAGE_IDS.find((id) => id === r.stage) ?? 'hueco';
  const taken = Array.isArray(r.taken) ? BANKAI_IDS.filter((id) => (r.taken as unknown[]).includes(id)) : [];
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
      numbers: bool(settings.numbers, d.settings.numbers),
      shake: bool(settings.shake, d.settings.shake),
    },
    stage,
    stages,
    taken,
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

/**
 * Fold a finished run into the save. "Best" is the longest survival, overall
 * and per stage; newBest is about the stage just played. `unlocked` names a
 * stage this run opened up, if any.
 */
export function recordRun(save: SaveData, r: RunResult): { newBest: boolean; unlocked: StageId | null; almighty: boolean } {
  const hadAlmighty = almightyUnlocked(save);
  for (const id of r.bankai ?? []) if (BANKAI_IDS.includes(id) && !save.taken.includes(id)) save.taken.push(id);
  save.totals.runs++;
  save.totals.kills += r.kills;
  save.totals.gold += r.gold;
  if (r.cleared) save.totals.clears++;
  if (r.time > save.best.time) save.best = { time: r.time, level: r.level, kills: r.kills };
  const rec = save.stages[r.stage];
  const newBest = r.time > rec.best;
  if (newBest) rec.best = r.time;
  let unlocked: StageId | null = null;
  if (r.cleared && !rec.cleared) {
    rec.cleared = true;
    unlocked = STAGES.find((s) => s.unlockedBy === r.stage)?.id ?? null;
  }
  return { newBest, unlocked, almighty: !hadAlmighty && almightyUnlocked(save) };
}
