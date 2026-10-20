/**
 * Karakura Town's defenders: the last of the world of the living to stand
 * against the One World. Drawn in the game's chibi style as homages to their
 * Bleach designs, each showing more at half health. Each run, three of the
 * four stand in the Emperor's way (the 5:00, 10:00 and 15:00 bosses); Kisuke
 * Urahara waits at the end.
 */

export interface KarakuraInfo {
  id: string;
  name: string;
  /** Under the name on the boss bar and the title card. */
  title: string;
  /** The warning a few seconds before they arrive. */
  warn: string;
  /** What happens at half health. */
  late: string;
  /** Aura colour around the boss. */
  aura: number;
}

export const KARAKURA_INFO: readonly KarakuraInfo[] = [
  {
    id: 'chad',
    name: 'Yasutora Sado',
    title: 'Fullbring · the Giant and the Devil',
    warn: 'Heavy footsteps, a quiet promise: Yasutora Sado',
    late: 'Chad’s arms burn: the Giant and the Devil together',
    aura: 0xff7a6a,
  },
  {
    id: 'orihime',
    name: 'Orihime Inoue',
    title: 'Shun Shun Rikka · She Who Rejects',
    warn: 'Six small lights circle a girl in the street: Orihime',
    late: 'Orihime calls all six of Shun Shun Rikka',
    aura: 0xffc878,
  },
  {
    id: 'yoruichi',
    name: 'Yoruichi Shihōin',
    title: 'The Flash Goddess',
    warn: 'Something too fast to see: Yoruichi Shihōin',
    late: 'Shunkō: Yoruichi is wrapped in lightning',
    aura: 0xc8a8ff,
  },
  {
    id: 'isshin',
    name: 'Isshin Kurosaki',
    title: 'Once Captain of the 10th Division',
    warn: 'A doctor with a captain’s blade: Isshin Kurosaki',
    late: 'Isshin puts on a captain’s haori again',
    aura: 0xffaa64,
  },
];

export const KARAKURA_IDS: readonly string[] = KARAKURA_INFO.map((k) => k.id);
export const KARAKURA_BY_ID: ReadonlyMap<string, KarakuraInfo> = new Map(KARAKURA_INFO.map((k) => [k.id, k]));
