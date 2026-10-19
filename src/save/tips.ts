import { TIPS, type TipId } from '../data/tips';
import type { SaveData } from './save';

/** A tip's text the first time it comes up (marking it seen), or null: already seen, or tips are off. */
export function takeTip(save: SaveData, id: TipId): string | null {
  if (!save.settings.tips || save.tips.includes(id)) return null;
  save.tips.push(id);
  return TIPS[id];
}

/** Show every tip again. */
export function resetTips(save: SaveData): void {
  save.tips = [];
}
