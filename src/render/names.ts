import { BANKAI_IDS } from '../data/bankai';
import { ENEMY_LIST } from '../data/enemies';
import { GOTEI_IDS } from '../data/gotei';
import { HERO_IDS } from '../data/heroes';
import { ARRANCAR_IDS } from '../data/arrancar';
import { KARAKURA_IDS } from '../data/karakura';
import { ROYAL_IDS } from '../data/royal';
import { FLAG_BOSS } from '../game/constants';
import type { World } from '../game/world';

/** Enemies drawn with another enemy's sprite. */
const SPRITE_NAME: Readonly<Record<string, string>> = { captain: 'cap_senbonzakura', golden: 'ganju', mirage: 'heroes_aizen' };

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
  if (id === 'royal') return `royal_${ROYAL_IDS[variant] ?? 'tenjiro'}`;
  // Each stolen bankai's knight, drawn as themselves (Zanka no Tachi was never a knight's: the plain bearer).
  if (id === 'bearer') {
    const bankai = BANKAI_IDS[variant];
    return bankai && bankai !== 'zanka' ? `thief_${bankai}` : 'bearer';
  }
  if (id === 'gotei') return `gotei_${GOTEI_IDS[variant] ?? 'kenpachi'}`;
  if (id === 'defender') return `heroes_${HERO_IDS[variant] ?? 'renji'}`;
  if (id === 'arrancar') return `arrancar_${ARRANCAR_IDS[variant] ?? 'rudbornn'}`;
  if (id === 'karakura') return `karakura_${KARAKURA_IDS[variant] ?? 'chad'}`;
  return SPRITE_NAME[id] ?? id;
}

/** The sprite for a boss in the form it is in (phase 1: what it shows at half health), for the HUD's portrait. */
export function bossSpriteName(type: number, variant: number, phase: number): string {
  const base = enemySpriteName(type, variant);
  if (phase <= 0) return base;
  const id = ENEMY_LIST[type]?.id;
  if (id === 'defender') {
    const hero = HERO_IDS[variant];
    if (hero === 'renji' || hero === 'rukia') return `${base}_bankai`;
  }
  if (id === 'ichigo') return 'ichigo_mask';
  if (id === 'ayon') return 'ayon_rage';
  if (id === 'nel') return 'nel_gamuza';
  if (id === 'unohana') return 'unohana_kenpachi';
  if (id === 'arrancar' || id === 'karakura') return `${base}_late`;
  if (id === 'urahara') return 'urahara_bankai';
  if (id === 'grimmjow') return 'grimmjow_pantera';
  if (id === 'harribel') return 'harribel_tiburon';
  if (id === 'royal' && base === 'royal_kirio') return 'royal_kirio_slim';
  return base;
}

/** The boss that arrived last (the highest uid still standing), as the sprite it shows now; null with none on the field. */
export function newestBossSprite(w: World): string | null {
  const E = w.en;
  let best = -1;
  for (let i = 0; i < E.n; i++) {
    if (E.dead[i] || !(E.flags[i] & FLAG_BOSS)) continue;
    if (best < 0 || E.uid[i] > E.uid[best]) best = i;
  }
  return best < 0 ? null : bossSpriteName(E.type[best], E.variant[best], w.phaseOf(best));
}
