/**
 * The Soul King Palace's guardians: the Royal Guard. Like the Gotei 13
 * captains, they are drawn in the game's chibi style as homages to their
 * Bleach designs. Each run, three of the four guard the palace's districts
 * (the 5:00, 10:00 and 15:00 bosses); Ichibē waits at the end. The titles
 * are this game's own descriptions.
 */

export interface RoyalInfo {
  id: string;
  name: string;
  /** Under the name on the boss bar and the title card. */
  title: string;
  /** The warning a few seconds before they arrive. */
  warn: string;
  /** Aura colour around the boss. */
  aura: number;
}

export const ROYAL_INFO: readonly RoyalInfo[] = [
  { id: 'tenjiro', name: 'Tenjirō Kirinji', title: 'Keeper of the Healing Springs', warn: 'Steam rolls in: Tenjirō Kirinji has left his springs', aura: 0x8fe0ff },
  { id: 'kirio', name: 'Kirio Hikifune', title: 'Keeper of the Palace of Grain', warn: 'Kirio Hikifune steps out of the Palace of Grain', aura: 0xffb38a },
  { id: 'oetsu', name: 'Ōetsu Nimaiya', title: 'Forger of Every Blade', warn: 'Ōetsu Nimaiya strikes a pose, his blades already out', aura: 0xffe08a },
  { id: 'senjumaru', name: 'Senjumaru Shutara', title: 'The Great Weaver', warn: 'Threads glint in the air: Senjumaru Shutara', aura: 0xd8b8ff },
];

export const ROYAL_IDS: readonly string[] = ROYAL_INFO.map((r) => r.id);
export const ROYAL_BY_ID: ReadonlyMap<string, RoyalInfo> = new Map(ROYAL_INFO.map((r) => [r.id, r]));
