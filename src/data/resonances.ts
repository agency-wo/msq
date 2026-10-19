/**
 * Resonances: two powers resonate into something new. Neither is replaced:
 * both keep working exactly as before, attributes and all, and the resonance
 * adds an effect that ties them together. It shows up as a card on the
 * level-up board once both are strong enough, and takes no slot.
 *
 * The first nine pair the attacks, each with one partner. The rest follow
 * the story: each Sternritter's Schrift with the bankai that knight stole
 * with a medallion, the bonds between the knights themselves (Uryū and
 * Haschwalth, Giselle and Bambietta, Bazz-B and Haschwalth), Gerard Valkyrie
 * and the Soul King's heart, and the Emperor's own powers with The Almighty.
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
  /** Levels each power needs (default: its last level). Bankai resonate from Lv 3. */
  needA?: number;
  needB?: number;
  /** From the story, not one of the nine core pairs: an attack can have more than one of these. */
  story?: boolean;
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
  // Each Sternritter and the bankai that knight stole.
  {
    id: 'fearpetals',
    name: 'Petals of Terror',
    a: 'fear',
    b: 'senbonzakura',
    letters: 'FS',
    desc: 'Äs Nödt stole Senbonzakura. Its petals carry The Fear: what they cut freezes in terror and takes more damage.',
    color: '#d8a8ff',
    needB: 3,
    story: true,
  },
  {
    id: 'ironice',
    name: 'Frozen Steel',
    a: 'iron',
    b: 'hyorinmaru',
    letters: 'IH',
    desc: 'Cang Du stole Hyōrinmaru. When your iron skin turns a blow aside, ice bursts out and freezes everything close.',
    color: '#bfe8ff',
    needB: 3,
    story: true,
  },
  {
    id: 'barrage',
    name: 'Raikōben Barrage',
    a: 'knowledge',
    b: 'raikoben',
    letters: 'KR',
    desc: 'BG9 stole Suì-Fēng’s bankai. Every other volley, each of your drones also calls a Raikōben missile down on the enemy nearest it.',
    color: '#ffe08a',
    needB: 3,
    story: true,
  },
  {
    id: 'giantblast',
    name: 'Exploding Giant',
    a: 'explode',
    b: 'tengen',
    letters: 'ET',
    desc: 'Bambietta stole Komamura’s bankai. Every sweep of the armoured giant’s blade explodes all along its arc.',
    color: '#ffb070',
    needB: 3,
    story: true,
  },
  {
    id: 'overthunder',
    name: 'Overkill Storm',
    a: 'overkill',
    b: 'gonryo',
    letters: 'OG',
    desc: 'Driscoll Berci stole Sasakibe’s bankai. Every 40 enemies you defeat, its lightning strikes eight more.',
    color: '#fff3a0',
    needB: 3,
    story: true,
  },
  {
    id: 'scales',
    name: 'The Scales Turned',
    a: 'antithesis',
    b: 'balance',
    letters: 'AB',
    desc: 'Uryū and Haschwalth fought letter against letter, A against B. Whenever you are hurt, a quarter of the wound is undone at once, and the nearest enemy loses three times the share of health you lost.',
    color: '#d8ecff',
    story: true,
  },
  {
    id: 'bambietta',
    name: 'Risen Bambietta',
    a: 'zombie',
    b: 'explode',
    letters: 'ZE',
    desc: 'Giselle made a zombie of Bambietta. Everything The Explode’s blasts hit is infected, and rises on your side when it dies.',
    color: '#ff8a7a',
    story: true,
  },
  {
    id: 'oldfriends',
    name: 'Old Friends',
    a: 'heat',
    b: 'balance',
    letters: 'HB',
    desc: 'Bazz-B and Haschwalth grew up together and joined the Wandenreich side by side. Every burst of The Balance sets what it hits burning with The Heat.',
    color: '#ffb07a',
    story: true,
  },
  {
    id: 'kingsheart',
    name: 'Heart of the King',
    a: 'heart',
    b: 'miracle',
    letters: 'HM',
    desc: 'Gerard Valkyrie was the Soul King’s heart all along. The Heart beats below 45% health, twice as often, and while it beats The Miracle is at its height.',
    color: '#ffd89a',
    story: true,
  },
  // The Emperor's own.
  {
    id: 'otherhalf',
    name: 'The Other Half',
    a: 'balance',
    b: 'almighty',
    letters: 'BA',
    desc: 'Haschwalth holds The Almighty while the Emperor sleeps. Every rewritten future heals you by a quarter and strikes 30% harder.',
    color: '#cfe0ff',
    story: true,
  },
  {
    id: 'bodydouble',
    name: 'Body Double',
    a: 'yourself',
    b: 'almighty',
    letters: 'YA',
    desc: 'Royd Lloyd once stood in for the Emperor himself. When the future is rewritten, each of your doubles strikes everything around it too.',
    color: '#ffe6a0',
    story: true,
  },
  {
    id: 'tenchikaijin',
    name: 'Tenchi Kaijin',
    a: 'zanka',
    b: 'almighty',
    letters: 'ZA',
    desc: 'The Emperor took Zanka no Tachi from the Captain-Commander. Every rewritten future sets what it strikes burning, heaven and earth turned to ash.',
    color: '#ff8a4a',
    needA: 3,
    story: true,
  },
  {
    id: 'successor',
    name: 'The Successor',
    a: 'antithesis',
    b: 'almighty',
    letters: 'AA',
    desc: 'The Emperor named Uryū his successor and gave him the letter A. A rewritten future leaves your wounds out: you heal what you were missing (up to half your health), and everything on screen loses that share of its health (bosses a quarter).',
    color: '#e8f4ff',
    story: true,
  },
];

export const RESONANCE_BY_ID: ReadonlyMap<string, ResonanceDef> = new Map(RESONANCES.map((r) => [r.id, r]));
