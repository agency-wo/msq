/**
 * Silbern's captains: the Gotei 13 making its stand in the second invasion,
 * in streets the Wandenreich has made its own. Like the other captains they
 * are drawn in the game's chibi style as homages to their Bleach designs.
 * Each run, three of the four bar the way (the 5:00, 10:00 and 15:00
 * bosses); the Captain-Commander, Shunsui Kyōraku, waits at the end.
 */

export interface GoteiInfo {
  id: string;
  name: string;
  /** Under the name on the boss bar and the title card. */
  title: string;
  /** Aura colour around the boss. */
  aura: number;
}

export const GOTEI_INFO: readonly GoteiInfo[] = [
  { id: 'kenpachi', name: 'Kenpachi Zaraki', title: 'Captain of the 11th Division', aura: 0xffe08a },
  { id: 'mayuri', name: 'Mayuri Kurotsuchi', title: 'Captain of the 12th Division', aura: 0x9dff8a },
  { id: 'shinji', name: 'Shinji Hirako', title: 'Captain of the 5th Division', aura: 0xffb8e0 },
  { id: 'kensei', name: 'Kensei Muguruma', title: 'Captain of the 9th Division', aura: 0xcfe6ff },
];

export const GOTEI_IDS: readonly string[] = GOTEI_INFO.map((g) => g.id);
export const GOTEI_BY_ID: ReadonlyMap<string, GoteiInfo> = new Map(GOTEI_INFO.map((g) => [g.id, g]));
