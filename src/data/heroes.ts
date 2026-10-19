/**
 * The Wahrwelt's defenders: those who climbed after the Emperor into the
 * world he made from the Soul King's palace. Drawn in the game's chibi style
 * as homages to their Bleach designs. Each run, three of the four stand in
 * his way (the 5:00, 10:00 and 15:00 bosses); Ichigo Kurosaki waits at the end.
 */

export interface HeroInfo {
  id: string;
  name: string;
  /** Under the name on the boss bar and the title card. */
  title: string;
  /** Aura colour around the boss. */
  aura: number;
}

export const HERO_INFO: readonly HeroInfo[] = [
  { id: 'renji', name: 'Renji Abarai', title: 'Lieutenant of the 6th Division', aura: 0xff6a4a },
  { id: 'rukia', name: 'Rukia Kuchiki', title: 'Lieutenant of the 13th Division', aura: 0xcfeeff },
  { id: 'uryu', name: 'Uryū Ishida', title: 'Quincy · The Heir', aura: 0x8fd0ff },
  { id: 'aizen', name: 'Sōsuke Aizen', title: 'Prisoner of Muken', aura: 0xb89aff },
];

export const HERO_IDS: readonly string[] = HERO_INFO.map((h) => h.id);
export const HERO_BY_ID: ReadonlyMap<string, HeroInfo> = new Map(HERO_INFO.map((h) => [h.id, h]));
