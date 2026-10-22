/**
 * The Wahrwelt's defenders: those who climbed after the Emperor into the
 * world he made from the Soul King's palace. Drawn in the game's chibi style
 * as homages to their Bleach designs, each with a look of their own (and, for
 * Renji and Rukia, their bankai at half health). Every run all four stand in
 * his way: Renji, Rukia and Uryū in a different order at 5:00, 10:00 and
 * 15:00, then Aizen at 18:00. Ichigo Kurosaki waits at the end.
 */

export interface HeroInfo {
  id: string;
  name: string;
  /** Under the name on the boss bar and the title card: what they fight with first, so no two read alike. */
  title: string;
  /** The warning a few seconds before they arrive. */
  warn: string;
  /** Aura colour around the boss. */
  aura: number;
  /** The Schrift the Emperor gave them, if any (a power id): out of his reach until they fall. */
  schrift?: string;
}

export const HERO_INFO: readonly HeroInfo[] = [
  { id: 'renji', name: 'Renji Abarai', title: 'Zabimaru · 6th Division', warn: 'Renji Abarai comes roaring up the stairs', aura: 0xff6a4a },
  { id: 'rukia', name: 'Rukia Kuchiki', title: 'Sode no Shirayuki · 13th Division', warn: 'The air turns bitter cold: Rukia Kuchiki', aura: 0xcfeeff },
  { id: 'uryu', name: 'Uryū Ishida', title: 'Quincy · The Heir', warn: 'Your heir has turned his bow on you', aura: 0x8fd0ff, schrift: 'antithesis' },
  { id: 'aizen', name: 'Sōsuke Aizen', title: 'Let out of Muken', warn: 'Kyōraku has let Aizen out of Muken', aura: 0xb89aff },
];

export const HERO_IDS: readonly string[] = HERO_INFO.map((h) => h.id);
export const HERO_BY_ID: ReadonlyMap<string, HeroInfo> = new Map(HERO_INFO.map((h) => [h.id, h]));
