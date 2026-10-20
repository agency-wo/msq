/**
 * Las Noches' defenders: the Arrancar who still hold Aizen's white palace
 * with no king and no queen left to hold it for. Drawn in the game's chibi
 * style as homages to their Bleach designs, each with a released form at
 * half health. Each run, three of the four stand in the Emperor's way (the
 * 5:00, 10:00 and 15:00 bosses); Grimmjow Jaegerjaquez waits at the end.
 */

export interface ArrancarInfo {
  id: string;
  name: string;
  /** Under the name on the boss bar and the title card. */
  title: string;
  /** The warning a few seconds before they arrive. */
  warn: string;
  /** What they say when they release, at half health. */
  release: string;
  /** Aura colour around the boss. */
  aura: number;
}

export const ARRANCAR_INFO: readonly ArrancarInfo[] = [
  {
    id: 'rudbornn',
    name: 'Rudbornn Chelute',
    title: 'Commander of the Exequias',
    warn: 'Skull-masked soldiers file in: Rudbornn Chelute',
    release: 'Rudbornn releases: Árbol',
    aura: 0xd8d0b8,
  },
  {
    id: 'dordoni',
    name: 'Dordoni Alessandro del Socaccio',
    title: 'Privaron Espada · 103',
    warn: 'A whirlwind comes down the hall: Dordoni',
    release: 'Dordoni releases: Giralda',
    aura: 0x9fe0d0,
  },
  {
    id: 'cirucci',
    name: 'Cirucci Sanderwicci',
    title: 'Privaron Espada · 105',
    warn: 'A blade on a cord whispers past: Cirucci',
    release: 'Cirucci releases: Golondrina',
    aura: 0xc8a0ff,
  },
  {
    id: 'gantenbainne',
    name: 'Gantenbainne Mosqueda',
    title: 'Privaron Espada · 107',
    warn: 'Heavy steps, a dragon’s heat: Gantenbainne',
    release: 'Gantenbainne releases: Dragra',
    aura: 0xffb070,
  },
];

export const ARRANCAR_IDS: readonly string[] = ARRANCAR_INFO.map((a) => a.id);
export const ARRANCAR_BY_ID: ReadonlyMap<string, ArrancarInfo> = new Map(ARRANCAR_INFO.map((a) => [a.id, a]));
