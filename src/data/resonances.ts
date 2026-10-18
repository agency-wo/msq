/**
 * Resonances: two awakened Schrift (both at Lv 7) resonate into something
 * new. Each attack has exactly one partner. A resonance never replaces
 * either power: both keep working exactly as before, attributes and all,
 * and the resonance adds an effect that ties them together. It shows up as
 * a card on the level-up board once both are awakened and takes no slot.
 */

export interface ResonanceDef {
  id: string;
  name: string;
  /** The two powers, by id. */
  a: string;
  b: string;
  /** Shown in the card's icon ring. */
  letters: string;
  desc: string;
  color: string;
}

export const RESONANCES: readonly ResonanceDef[] = [
  {
    id: 'firestorm',
    name: 'Firestorm',
    a: 'heat',
    b: 'wind',
    letters: 'HW',
    desc: 'Your gusts catch fire: they set what they touch burning and leave trails of flame behind them.',
    color: '#ff9a4a',
  },
  {
    id: 'railgun',
    name: 'Railgun',
    a: 'xaxis',
    b: 'thunder',
    letters: 'XT',
    desc: 'Every beam calls lightning down along its whole line.',
    color: '#bfefff',
  },
  {
    id: 'armageddon',
    name: 'Armageddon',
    a: 'explode',
    b: 'visionary',
    letters: 'EV',
    desc: 'Every meteor shatters on impact into reishi bombs flung across the crowd.',
    color: '#ffb87a',
  },
  {
    id: 'plague',
    name: 'Plague',
    a: 'death',
    b: 'zombie',
    letters: 'DZ',
    desc: 'Your clouds infect whatever breathes them, and your zombies leave a lethal cloud when they crumble.',
    color: '#9dff8a',
  },
  {
    id: 'nightmare',
    name: 'Nightmare Prison',
    a: 'fear',
    b: 'jail',
    letters: 'FJ',
    desc: 'Every cage throws a ring of fear thorns as it drops, and caged enemies take 50% more damage.',
    color: '#c8a8ff',
  },
  {
    id: 'seelepfeil',
    name: 'Seele Pfeil',
    a: 'heilig',
    b: 'seele',
    letters: 'Q',
    desc: 'Your spinning blades shoot holy arrows outward as they turn.',
    color: '#bfe6ff',
  },
  {
    id: 'devour',
    name: 'Devouring Fist',
    a: 'glutton',
    b: 'power',
    letters: 'GP',
    desc: 'Each punch bites: its shockwave swallows weakened enemies whole and heals you for each.',
    color: '#ffb08a',
  },
  {
    id: 'narcissus',
    name: 'Narcissus',
    a: 'love',
    b: 'yourself',
    letters: 'LY',
    desc: 'Your doubles fire heart rays as well as arrows; what they hit falls for you.',
    color: '#ffb8d8',
  },
  {
    id: 'sonic',
    name: 'Sonic Drones',
    a: 'roar',
    b: 'knowledge',
    letters: 'RK',
    desc: 'Every ring you roar also bursts out from each of your drones.',
    color: '#d7c3ff',
  },
];

export const RESONANCE_BY_ID: ReadonlyMap<string, ResonanceDef> = new Map(RESONANCES.map((r) => [r.id, r]));
