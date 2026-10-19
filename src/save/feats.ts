import { CODEX_ENEMIES } from '../data/codex';
import { POWERS, STARTABLE_IDS } from '../data/powers';
import { RELICS } from '../data/relics';
import { RESONANCES } from '../data/resonances';
import { STAGE_IDS, type StageId } from '../data/stages';
import type { SaveData } from './save';

/**
 * Feats: long goals that pay once. Some are counted over every run (kills,
 * clears, the Codex), the rest are about a single run and remember the best
 * attempt, so their bars show how close you came. A few unlock an Emperor
 * look or a relic that can then turn up in chests.
 */

// The looks live with the Wardrobe; feats still open three of them.
export { type LookId, LOOKS } from '../data/looks';
import type { LookId } from '../data/looks';

export type FeatGroup = 'Journey' | 'Stages' | 'One run' | 'Modes';

/** What a finished run did, for the feats that are about one run. */
export interface RunFacts {
  stage: StageId;
  cleared: boolean;
  endless: boolean;
  bossRush: boolean;
  daily: boolean;
  time: number;
  level: number;
  kills: number;
  bankai: number;
  awakened: number;
  resonances: number;
  rushTier: number;
  almighty: boolean;
  fragments: number;
  pacts: number;
  damage: number;
  evolution: number;
}

export interface FeatDef {
  id: string;
  name: string;
  desc: string;
  group: FeatGroup;
  /** The value it needs (1 for yes-or-no feats). */
  goal: number;
  gold: number;
  look?: LookId;
  relic?: string;
  /** Counted over every run from the save, or the best a single run managed. */
  save?: (s: SaveData) => number;
  run?: (r: RunFacts) => number;
}

const yes = (b: boolean): number => (b ? 1 : 0);

/** Entries the Codex has opened, out of everything it holds. */
export function codexFound(s: SaveData): number {
  const c = s.codex;
  return (
    POWERS.filter((d) => c.powers.includes(d.id)).length +
    RESONANCES.filter((r) => c.resonances.includes(r.id)).length +
    RELICS.filter((r) => c.relics.includes(r.id)).length +
    CODEX_ENEMIES.filter((e) => (c.kills[e.key] ?? 0) > 0).length
  );
}

export function codexTotal(): number {
  return POWERS.length + RESONANCES.length + RELICS.length + CODEX_ENEMIES.length;
}

const highestTrial = (s: SaveData): number => Math.max(...STAGE_IDS.map((id) => (s.stages[id].cleared ? s.stages[id].clearTrial : -1)));

export const FEATS: readonly FeatDef[] = [
  { id: 'kills-1k', name: 'Thousand Cuts', desc: 'Defeat 1,000 enemies.', group: 'Journey', goal: 1000, gold: 100, save: (s) => s.totals.kills },
  { id: 'kills-25k', name: 'An Army Unmade', desc: 'Defeat 25,000 enemies.', group: 'Journey', goal: 25000, gold: 400, save: (s) => s.totals.kills },
  { id: 'kills-100k', name: 'The Thousand-Year Count', desc: 'Defeat 100,000 enemies.', group: 'Journey', goal: 100000, gold: 1000, look: 'gilded', save: (s) => s.totals.kills },
  { id: 'runs-10', name: 'Unrelenting', desc: 'Play 10 runs.', group: 'Journey', goal: 10, gold: 150, save: (s) => s.totals.runs },
  { id: 'runs-50', name: 'Nine Hundred Years of Patience', desc: 'Play 50 runs.', group: 'Journey', goal: 50, gold: 500, save: (s) => s.totals.runs },
  { id: 'gold-5k', name: 'The Treasury', desc: 'Earn 5,000 gold in all.', group: 'Journey', goal: 5000, gold: 200, save: (s) => s.totals.gold },
  { id: 'bankai-all', name: 'Every Medallion', desc: 'Take back all six bankai.', group: 'Journey', goal: 6, gold: 300, save: (s) => s.taken.length },
  { id: 'awaken-all', name: 'Every Letter', desc: 'Awaken every attack at least once.', group: 'Journey', goal: STARTABLE_IDS.length, gold: 600, save: (s) => s.awakened.length },
  { id: 'codex-half', name: 'Half the Book', desc: 'Discover half of the Codex.', group: 'Journey', goal: Math.floor(codexTotal() / 2), gold: 300, save: codexFound },
  { id: 'codex-all', name: 'The Whole Story', desc: 'Discover everything in the Codex.', group: 'Journey', goal: codexTotal(), gold: 1000, save: codexFound },
  { id: 'clear-hueco', name: 'Lord of the Desert', desc: 'Clear Hueco Mundo.', group: 'Stages', goal: 1, gold: 150, save: (s) => yes(s.stages.hueco.cleared) },
  { id: 'clear-seireitei', name: 'Ash on the Wind', desc: 'Clear the Seireitei.', group: 'Stages', goal: 1, gold: 300, save: (s) => yes(s.stages.seireitei.cleared) },
  { id: 'clear-silbern', name: 'The Silver City', desc: 'Clear Silbern.', group: 'Stages', goal: 1, gold: 500, save: (s) => yes(s.stages.silbern.cleared) },
  { id: 'clear-wahrwelt', name: 'One World', desc: 'Clear the Wahrwelt.', group: 'Stages', goal: 1, gold: 800, save: (s) => yes(s.stages.wahrwelt.cleared) },
  { id: 'clear-palace', name: 'Above the Clouds', desc: 'Clear the Soul King Palace.', group: 'Stages', goal: 1, gold: 500, look: 'white', save: (s) => yes(s.stages.palace.cleared) },
  { id: 'trial-3', name: 'Trial by Fire', desc: 'Clear any stage on Trial III.', group: 'Stages', goal: 3, gold: 400, save: (s) => Math.max(0, highestTrial(s)) },
  { id: 'trial-5', name: 'Beyond Every Trial', desc: 'Clear any stage on Trial V.', group: 'Stages', goal: 5, gold: 800, look: 'crimson', save: (s) => Math.max(0, highestTrial(s)) },
  { id: 'level-100', name: 'A Hundred Levels', desc: 'Reach level 100 in one run.', group: 'One run', goal: 100, gold: 200, run: (r) => r.level },
  { id: 'kills-run', name: 'One Long Night', desc: 'Defeat 5,000 enemies in one run.', group: 'One run', goal: 5000, gold: 300, run: (r) => r.kills },
  { id: 'bankai-run', name: 'Three Medallions', desc: 'Take back three bankai in one run.', group: 'One run', goal: 3, gold: 200, run: (r) => r.bankai },
  { id: 'awaken-run', name: 'Five Letters', desc: 'Awaken five Schrift in one run.', group: 'One run', goal: 5, gold: 300, run: (r) => r.awakened },
  { id: 'resonance-run', name: 'In Harmony', desc: 'Make three resonances in one run.', group: 'One run', goal: 3, gold: 300, run: (r) => r.resonances },
  { id: 'rush-3', name: 'Blood Running Hot', desc: 'Reach Blut Rush III.', group: 'One run', goal: 3, gold: 150, run: (r) => r.rushTier },
  { id: 'almighty-run', name: 'The Almighty', desc: 'Awaken A · The Almighty in a run.', group: 'One run', goal: 1, gold: 400, run: (r) => yes(r.almighty) },
  { id: 'eyes-run', name: 'The Eyes Open', desc: 'Reach the Emperor’s second evolution in a run.', group: 'One run', goal: 2, gold: 150, run: (r) => r.evolution },
  { id: 'fragments-run', name: 'The Pieces of a King', desc: 'Hold all three Fragments of the Soul King in one run.', group: 'One run', goal: 3, gold: 500, relic: 'seal', run: (r) => r.fragments },
  { id: 'pacts-run', name: 'A Hard Bargain', desc: 'Make three pacts in one run.', group: 'One run', goal: 3, gold: 200, relic: 'key', run: (r) => r.pacts },
  { id: 'damage-run', name: 'One Million', desc: 'Deal 1,000,000 damage in one run.', group: 'One run', goal: 1_000_000, gold: 300, run: (r) => r.damage },
  { id: 'endless-30', name: 'The Night Never Ends', desc: 'Survive 30:00 in Endless.', group: 'Modes', goal: 1800, gold: 500, run: (r) => (r.endless ? r.time : 0) },
  { id: 'rush-clear', name: 'Back to Back', desc: 'Clear a Boss Rush.', group: 'Modes', goal: 1, gold: 300, relic: 'founder', run: (r) => yes(r.bossRush && r.cleared) },
  { id: 'rush-fast', name: 'Racing the Dawn', desc: 'Clear a Boss Rush in under 4:00.', group: 'Modes', goal: 1, gold: 500, run: (r) => yes(r.bossRush && r.cleared && r.time < 240) },
  { id: 'daily-clear', name: 'Daily Devotion', desc: 'Clear a Daily Trial.', group: 'Modes', goal: 1, gold: 300, run: (r) => yes(r.daily && r.cleared) },
];

export const FEAT_BY_ID: ReadonlyMap<string, FeatDef> = new Map(FEATS.map((f) => [f.id, f]));

/** How far a feat has come: the lifetime count, or the best single run so far. */
export function featProgress(save: SaveData, f: FeatDef): number {
  if (save.feats.includes(f.id)) return f.goal;
  return f.save ? f.save(save) : (save.featBest[f.id] ?? 0);
}

/**
 * Check every feat after a run (or with no run, just the save): remember the
 * best single-run attempts, and pay each newly earned feat once (gold, and
 * any look or relic it unlocks). Returns the feats earned now.
 */
export function evaluateFeats(save: SaveData, run?: RunFacts): FeatDef[] {
  const earned: FeatDef[] = [];
  for (const f of FEATS) {
    if (f.run && run) save.featBest[f.id] = Math.max(save.featBest[f.id] ?? 0, f.run(run));
    if (save.feats.includes(f.id) || featProgress(save, f) < f.goal) continue;
    save.feats.push(f.id);
    save.gold += f.gold;
    save.totals.gold += f.gold;
    if (f.look && !save.looks.includes(f.look)) save.looks.push(f.look);
    if (f.relic && !save.relicsOpen.includes(f.relic)) save.relicsOpen.push(f.relic);
    earned.push(f);
  }
  return earned;
}
