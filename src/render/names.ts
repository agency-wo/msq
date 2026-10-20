import { BANKAI_IDS } from '../data/bankai';
import { ENEMY_LIST } from '../data/enemies';
import { GOTEI_IDS } from '../data/gotei';
import { HERO_IDS } from '../data/heroes';
import { ARRANCAR_IDS } from '../data/arrancar';
import { ROYAL_IDS } from '../data/royal';

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
  if (id === 'arrancar') return `${base}_late`;
  if (id === 'grimmjow') return 'grimmjow_pantera';
  if (id === 'harribel') return 'harribel_tiburon';
  if (id === 'royal' && base === 'royal_kirio') return 'royal_kirio_slim';
  return base;
}
