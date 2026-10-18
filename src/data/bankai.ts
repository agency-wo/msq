import { stats, type PowerDef } from './powerTypes';

/**
 * The six stolen bankai. Each run, three of them are carried by medallion
 * bearers (the bosses); beating a bearer gives you its bankai, no choice.
 * They level from 1 to 5 through the normal level-up cards.
 */

export interface BankaiInfo {
  id: string;
  /** Whose bankai it is. */
  owner: string;
  /** Who stole it with a medallion. */
  thief: string;
  /** Colour of the bearer's aura and of the medallion pickup. */
  aura: number;
}

export const BANKAI_INFO: readonly BankaiInfo[] = [
  { id: 'senbonzakura', owner: 'Byakuya Kuchiki', thief: 'Äs Nödt', aura: 0xff9cc2 },
  { id: 'hyorinmaru', owner: 'Tōshirō Hitsugaya', thief: 'Cang Du', aura: 0x8fd8ff },
  { id: 'raikoben', owner: 'Suì-Fēng', thief: 'BG9', aura: 0xffd27a },
  { id: 'tengen', owner: 'Sajin Komamura', thief: 'Bambietta Basterbine', aura: 0xc9b58a },
  { id: 'gonryo', owner: 'Chōjirō Sasakibe', thief: 'Driscoll Berci', aura: 0xfff3a0 },
  { id: 'zanka', owner: 'Genryūsai Yamamoto', thief: 'the Emperor', aura: 0xff7a3c },
];

export const BANKAI_IDS: readonly string[] = BANKAI_INFO.map((b) => b.id);
export const BANKAI_BY_ID: ReadonlyMap<string, BankaiInfo> = new Map(BANKAI_INFO.map((b) => [b.id, b]));

export const BANKAI_POWERS: readonly PowerDef[] = [
  {
    // count petals in orbit (hit like blades); every cooldown they converge (radius, duration, tick)
    id: 'senbonzakura',
    kind: 'senbonzakura',
    group: 'bankai',
    name: 'Senbonzakura Kageyoshi',
    credit: 'Byakuya Kuchiki',
    desc: 'Thousands of petal blades swirl around you; every few seconds they converge and shred the thickest crowd.',
    icon: 'petal',
    color: '#ffb8d2',
    maxLevel: 5,
    base: stats({ damage: 10, cooldown: 6, count: 30, radius: 80, duration: 1.2, tick: 0.12 }),
    levels: [
      { desc: '+8 petals', add: { count: 8 } },
      { desc: '+4 damage', add: { damage: 4 } },
      { desc: 'Converges 1 s sooner', add: { cooldown: -1 } },
      { desc: '+10 petals, +4 damage', add: { count: 10, damage: 4 } },
    ],
  },
  {
    // count dragons, speed px/s, radius = dragon size, duration = freeze seconds
    id: 'hyorinmaru',
    kind: 'hyorinmaru',
    group: 'bankai',
    name: 'Daiguren Hyōrinmaru',
    credit: 'Tōshirō Hitsugaya',
    desc: 'Ice dragons sweep the field and freeze what they touch; frozen enemies take 50% more damage.',
    icon: 'snow',
    color: '#9fe0ff',
    maxLevel: 5,
    base: stats({ damage: 40, cooldown: 2.6, count: 2, speed: 300, radius: 22, duration: 1.2 }),
    levels: [
      { desc: '+12 damage', add: { damage: 12 } },
      { desc: '+1 dragon', add: { count: 1 } },
      { desc: 'Cooldown -0.4 s', add: { cooldown: -0.4 } },
      { desc: '+16 damage, +1 dragon', add: { damage: 16, count: 1 } },
    ],
  },
  {
    // count missiles at the thickest crowd, radius = blast, duration = warning
    id: 'raikoben',
    kind: 'raikoben',
    group: 'bankai',
    name: 'Jakuhō Raikōben',
    credit: 'Suì-Fēng',
    desc: 'A colossal missile hits the thickest crowd every few seconds, leaving fire behind.',
    icon: 'missile',
    color: '#ffd27a',
    maxLevel: 5,
    base: stats({ damage: 160, cooldown: 4.5, count: 1, radius: 170, duration: 1 }),
    levels: [
      { desc: '+40 damage', add: { damage: 40 } },
      { desc: 'Blast +20', add: { radius: 20 } },
      { desc: 'Cooldown -0.6 s', add: { cooldown: -0.6 } },
      { desc: '+60 damage, +1 missile', add: { damage: 60, count: 1 } },
    ],
  },
  {
    // radius = reach of the cleave, amount = half-angle of the arc (radians)
    id: 'tengen',
    kind: 'tengen',
    group: 'bankai',
    name: "Kokujō Tengen Myō'ō",
    credit: 'Sajin Komamura',
    desc: 'A giant armored warrior rises behind you and cleaves a huge arc in front.',
    icon: 'helm',
    color: '#d9c089',
    maxLevel: 5,
    base: stats({ damage: 90, cooldown: 3.4, radius: 240, amount: 1.15 }),
    levels: [
      { desc: '+25 damage', add: { damage: 25 } },
      { desc: 'Reach +25', add: { radius: 25 } },
      { desc: 'Cooldown -0.5 s', add: { cooldown: -0.5 } },
      { desc: '+40 damage', add: { damage: 40 } },
    ],
  },
  {
    // a bolt every `tick` s on an enemy on screen; every cooldown, `count` pillars ring you
    id: 'gonryo',
    kind: 'gonryo',
    group: 'bankai',
    name: 'Kōkō Gonryō Rikyū',
    credit: 'Chōjirō Sasakibe',
    desc: 'The sky fills with lightning: bolts keep striking enemies on screen, and pillars of light ring you.',
    icon: 'strike',
    color: '#fff3a0',
    maxLevel: 5,
    base: stats({ damage: 22, cooldown: 5, count: 8, radius: 30, tick: 0.22 }),
    levels: [
      { desc: '+6 damage', add: { damage: 6 } },
      { desc: 'Bolts strike faster', add: { tick: -0.04 } },
      { desc: '+4 pillars', add: { count: 4 } },
      { desc: '+10 damage, bolts strike faster', add: { damage: 10, tick: -0.04 } },
    ],
  },
  {
    // a fire slash every cooldown (radius = width); a heat aura deals `amount` every `tick`
    id: 'zanka',
    kind: 'zanka',
    group: 'bankai',
    name: 'Zanka no Tachi',
    credit: 'Genryūsai Yamamoto',
    desc: 'A blade of fire erases everything along a long line, and a heat aura scorches anything that comes close.',
    icon: 'flame',
    color: '#ff9a5a',
    maxLevel: 5,
    base: stats({ damage: 70, cooldown: 2.2, radius: 48, amount: 16, tick: 0.3 }),
    levels: [
      { desc: '+20 damage', add: { damage: 20 } },
      { desc: 'Hotter aura', add: { amount: 6 } },
      { desc: 'Cooldown -0.4 s', add: { cooldown: -0.4 } },
      { desc: '+30 damage, hotter aura', add: { damage: 30, amount: 8 } },
    ],
  },
];
