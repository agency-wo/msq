import type { StageId } from '../data/stages';
import { CHAPTERS, type Chapter } from '../data/story';
import { almightyUnlocked, type SaveData } from './save';

/** Which chapters to tell, and when, from what the save says has happened. */

/** Whether the moment a chapter belongs to has come: its stage was played, or its milestone reached. */
function conditionMet(save: SaveData, c: Chapter): boolean {
  const t = c.trigger;
  if (t.when === 'before') return t.stage === undefined || (save.stages[t.stage as StageId]?.best ?? 0) > 0;
  switch (t.condition) {
    case 'bankai':
      return save.taken.length > 0;
    case 'hueco':
      return save.stages.hueco.cleared;
    case 'seireitei':
      return save.stages.seireitei.cleared;
    case 'almighty':
      return almightyUnlocked(save);
    case 'palace':
      return save.stages.palace.cleared;
    case 'heir':
      return save.codex.powers.includes('antithesis');
    case 'silbern':
      return save.stages.silbern.cleared;
    case 'wahrwelt':
      return save.stages.wahrwelt.cleared;
    case 'lasnoches':
      return save.stages.lasnoches.cleared;
  }
}

/** Chapters to tell before a run on this stage, not yet seen. */
export function chaptersBefore(save: SaveData, stage: string): Chapter[] {
  return CHAPTERS.filter((c) => c.trigger.when === 'before' && (c.trigger.stage === undefined || c.trigger.stage === stage) && !save.chapters.includes(c.id));
}

/** Chapters whose milestone was reached (checked after a run), not yet seen. */
export function chaptersAfter(save: SaveData): Chapter[] {
  return CHAPTERS.filter((c) => c.trigger.when === 'after' && !save.chapters.includes(c.id) && conditionMet(save, c));
}

export function markChapter(save: SaveData, id: string): void {
  if (!save.chapters.includes(id)) save.chapters.push(id);
}

/** Readable in the Chronicle: already told, or its moment has come (old saves can read what they already did). */
export function chapterUnlocked(save: SaveData, c: Chapter): boolean {
  return save.chapters.includes(c.id) || conditionMet(save, c);
}
