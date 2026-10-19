import { BANKAI_IDS } from '../data/bankai';
import { ENEMY_LIST } from '../data/enemies';

/** Enemies drawn with another enemy's sprite. */
const SPRITE_NAME: Readonly<Record<string, string>> = { captain: 'cap_senbonzakura', golden: 'hollow' };

/**
 * The atlas sprite an enemy is drawn with: a captain by the bankai they
 * carry (Zanka no Tachi is the Captain-Commander himself), everyone else by
 * type. Shared by the renderer and the HUD's boss portrait.
 */
export function enemySpriteName(type: number, variant = 0): string {
  const id = ENEMY_LIST[type]?.id ?? 'hollow';
  if (id === 'captain') {
    const bankai = BANKAI_IDS[variant];
    if (bankai === 'zanka') return 'commander';
    if (bankai) return `cap_${bankai}`;
  }
  return SPRITE_NAME[id] ?? id;
}
