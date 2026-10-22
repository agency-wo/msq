export type EnemyId =
  | 'hollow'
  | 'hound'
  | 'brute'
  | 'volatile'
  | 'bearer'
  | 'ayon'
  | 'nel'
  | 'officer'
  | 'flash'
  | 'caster'
  | 'guard'
  | 'unohana'
  | 'captain'
  | 'commander'
  | 'ashen'
  | 'rift'
  | 'golden'
  | 'sentinel'
  | 'inkwisp'
  | 'inkling'
  | 'weaver'
  | 'asauchi'
  | 'attendant'
  | 'royal'
  | 'ichibe'
  | 'harribel'
  | 'brawler'
  | 'specimen'
  | 'gotei'
  | 'kyoraku'
  | 'jizo'
  | 'defender'
  | 'ichigo'
  | 'mirage'
  | 'numeros'
  | 'exequias'
  | 'gillian'
  | 'arrancar'
  | 'grimmjow'
  | 'gigai'
  | 'sentry'
  | 'karakura'
  | 'urahara'
  | 'cero';

/**
 * chase: walks at you · blink: walks, and every few seconds flash-steps closer ·
 * ranged: keeps its distance and shoots · flee: runs from you · charge: stops,
 * winds up, and lunges.
 */
export type EnemyBehavior = 'chase' | 'blink' | 'ranged' | 'flee' | 'charge';

export interface EnemyDef {
  id: EnemyId;
  name: string;
  hp: number;
  /** Units per second. */
  speed: number;
  radius: number;
  /** Contact damage. */
  damage: number;
  /** Mana dropped. */
  xp: number;
  behavior: EnemyBehavior;
  /** Explodes on contact instead of chewing on you. */
  bomber?: boolean;
  boss?: boolean;
  /** Soul Reapers (Seireitei) rather than Hollows: changes the elite look and the elite attack. */
  shinigami?: boolean;
  /** Death-burst colour. */
  color: number;
}

/**
 * Hueco Mundo's Hollows, Seireitei's Soul Reapers, the palace's servants, and
 * the bosses. The swarm and the Hollow bosses are original designs; every
 * named character (the Sternritter, the captains, the Royal Guard, Harribel,
 * the defenders, the runaways) is a manga homage. Index order matters:
 * enemies store their type as a byte.
 */
export const ENEMY_LIST: readonly EnemyDef[] = [
  { id: 'hollow', name: 'Lesser Hollow', hp: 10, speed: 46, radius: 11, damage: 8, xp: 1, behavior: 'chase', color: 0xe8e2d6 },
  // Faster than you on purpose: hounds punish standing still or kiting lazily.
  { id: 'hound', name: 'Hound Hollow', hp: 8, speed: 135, radius: 9, damage: 6, xp: 1, behavior: 'chase', color: 0xe8e2d6 },
  { id: 'brute', name: 'Brute Hollow', hp: 70, speed: 34, radius: 18, damage: 14, xp: 4, behavior: 'chase', color: 0xe8e2d6 },
  // Shrieker's leeches: they burst when they reach you.
  { id: 'volatile', name: 'Shrieker’s Leech', hp: 18, speed: 80, radius: 12, damage: 22, xp: 2, behavior: 'chase', bomber: true, color: 0xff6a3c },
  // The Sternritter who stole a bankai (variant = which bankai, so which knight; see data/bankai.ts).
  { id: 'bearer', name: 'Sternritter', hp: 2600, speed: 44, radius: 30, damage: 25, xp: 60, behavior: 'chase', boss: true, color: 0xffcb5c },
  // Hueco Mundo's own: Ayon, the beast Harribel's Fracción make from their left arms, and Neliel, once the Tercera Espada.
  { id: 'ayon', name: 'Ayon', hp: 2600, speed: 34, radius: 42, damage: 32, xp: 80, behavior: 'chase', boss: true, color: 0xc8863a },
  { id: 'nel', name: 'Neliel Tu Oderschvank', hp: 2600, speed: 50, radius: 30, damage: 34, xp: 120, behavior: 'chase', boss: true, color: 0x5ad8b0 },
  { id: 'officer', name: 'Unseated Officer', hp: 12, speed: 50, radius: 11, damage: 9, xp: 1, behavior: 'chase', shinigami: true, color: 0xd8dce8 },
  { id: 'flash', name: 'Onmitsukidō Agent', hp: 10, speed: 72, radius: 9, damage: 7, xp: 1, behavior: 'blink', shinigami: true, color: 0xc9b8ff },
  { id: 'caster', name: 'Kidō Corps Officer', hp: 16, speed: 42, radius: 11, damage: 8, xp: 2, behavior: 'ranged', shinigami: true, color: 0xff8a4a },
  { id: 'guard', name: 'Heavy Guard', hp: 90, speed: 32, radius: 19, damage: 16, xp: 5, behavior: 'chase', shinigami: true, color: 0xd8dce8 },
  // Retsu Unohana, Captain of the 4th Division: the healer, and before that the first Kenpachi.
  { id: 'unohana', name: 'Retsu Unohana', hp: 2600, speed: 44, radius: 30, damage: 32, xp: 150, behavior: 'chase', boss: true, shinigami: true, color: 0x9fe6c0 },
  // Seireitei's bankai bosses: the captains themselves, fighting with their own bankai (variant = which one).
  { id: 'captain', name: 'Captain', hp: 2600, speed: 46, radius: 30, damage: 25, xp: 60, behavior: 'chase', boss: true, shinigami: true, color: 0xf4f6fb },
  // Seireitei's final boss: the Captain-Commander and the flames of Ryūjin Jakka.
  {
    id: 'commander',
    name: 'Genryūsai Yamamoto',
    hp: 2600,
    speed: 38,
    radius: 34,
    damage: 36,
    xp: 160,
    behavior: 'chase',
    boss: true,
    shinigami: true,
    color: 0xff7a3c,
  },
  // The charred dead the Captain-Commander raises against you.
  { id: 'ashen', name: 'Ashen Dead', hp: 30, speed: 70, radius: 12, damage: 12, xp: 1, behavior: 'chase', color: 0xc08a5a },
  // Run events: a rift that pours out enemies until destroyed, and a treasure runner that flees.
  { id: 'rift', name: 'Garganta', hp: 900, speed: 0, radius: 26, damage: 0, xp: 30, behavior: 'chase', color: 0xff2d4a },
  // A runaway carrying treasure: a gorged Adjuchas, Ganju and Bonnie, or Kon, by stage.
  { id: 'golden', name: 'Runaway', hp: 400, speed: 105, radius: 13, damage: 0, xp: 40, behavior: 'flee', color: 0xffd27a },
  // The Soul King Palace. Its servants are original designs.
  { id: 'sentinel', name: 'Palace Sentinel', hp: 22, speed: 42, radius: 13, damage: 10, xp: 2, behavior: 'charge', color: 0xf0e2b0 },
  { id: 'inkwisp', name: 'Ink Wisp', hp: 16, speed: 54, radius: 12, damage: 9, xp: 1, behavior: 'chase', color: 0x3a3050 },
  { id: 'inkling', name: 'Inkling', hp: 6, speed: 84, radius: 8, damage: 5, xp: 1, behavior: 'chase', color: 0x3a3050 },
  { id: 'weaver', name: 'Spirit Weaver', hp: 20, speed: 40, radius: 11, damage: 7, xp: 2, behavior: 'ranged', color: 0xd8c8ff },
  { id: 'asauchi', name: 'Asauchi Blade', hp: 12, speed: 74, radius: 9, damage: 8, xp: 1, behavior: 'blink', color: 0xe8eef8 },
  { id: 'attendant', name: 'Royal Attendant', hp: 60, speed: 34, radius: 17, damage: 12, xp: 6, behavior: 'chase', color: 0xfff0c8 },
  // The Royal Guard (variant = which of them, see data/royal.ts) and Ichibē, who ends the stage.
  { id: 'royal', name: 'Royal Guard', hp: 2600, speed: 46, radius: 30, damage: 26, xp: 70, behavior: 'chase', boss: true, color: 0xfff6dc },
  { id: 'ichibe', name: 'Ichibē Hyōsube', hp: 2600, speed: 36, radius: 36, damage: 38, xp: 180, behavior: 'chase', boss: true, color: 0x9a7aff },
  // Hueco Mundo's final boss: Tier Harribel, the Third Espada, who has ruled Las Noches since Aizen fell.
  { id: 'harribel', name: 'Tier Harribel', hp: 2600, speed: 50, radius: 30, damage: 36, xp: 170, behavior: 'chase', boss: true, color: 0x5ac8ff },
  // Silbern, the second invasion. The swarm's new faces are original designs.
  { id: 'brawler', name: 'Eleventh Division Brawler', hp: 16, speed: 66, radius: 12, damage: 12, xp: 2, behavior: 'chase', shinigami: true, color: 0xd8dce8 },
  { id: 'specimen', name: 'Twelfth Division Specimen', hp: 40, speed: 30, radius: 15, damage: 10, xp: 3, behavior: 'chase', color: 0x9dff8a },
  // Silbern's captains (variant = which of them, see data/gotei.ts) and the Captain-Commander who ends the stage.
  { id: 'gotei', name: 'Captain', hp: 2600, speed: 46, radius: 30, damage: 26, xp: 70, behavior: 'chase', boss: true, shinigami: true, color: 0xf4f6fb },
  { id: 'kyoraku', name: 'Shunsui Kyōraku', hp: 2600, speed: 42, radius: 32, damage: 36, xp: 180, behavior: 'chase', boss: true, shinigami: true, color: 0xff9ac8 },
  // Mayuri's bankai, Konjiki Ashisogi Jizō: a giant that keeps its distance and breathes poison.
  { id: 'jizo', name: 'Konjiki Ashisogi Jizō', hp: 420, speed: 26, radius: 34, damage: 20, xp: 20, behavior: 'ranged', color: 0xe8c840 },
  // The Wahrwelt's defenders (variant = which of them, see data/heroes.ts) and Ichigo Kurosaki, who ends the stage.
  { id: 'defender', name: 'Defender', hp: 2600, speed: 48, radius: 30, damage: 28, xp: 80, behavior: 'chase', boss: true, shinigami: true, color: 0xf4f6fb },
  { id: 'ichigo', name: 'Ichigo Kurosaki', hp: 2600, speed: 52, radius: 31, damage: 40, xp: 200, behavior: 'chase', boss: true, shinigami: true, color: 0xff6a3c },
  // Kyōka Suigetsu's copies of Aizen: gone at a touch, and worth nothing.
  { id: 'mirage', name: 'Kyōka Suigetsu', hp: 1, speed: 48, radius: 28, damage: 8, xp: 0, behavior: 'chase', shinigami: true, color: 0xb89aff },
  // Las Noches. Its soldiers are original designs; the Arrancar who lead them, and Grimmjow, are homages.
  { id: 'numeros', name: 'Arrancar Soldier', hp: 13, speed: 54, radius: 11, damage: 9, xp: 1, behavior: 'chase', color: 0xe8e6de },
  { id: 'exequias', name: 'Exequias Executioner', hp: 16, speed: 42, radius: 11, damage: 8, xp: 2, behavior: 'ranged', color: 0xd8d0b8 },
  // The lowest of the Menos Grande, lumbering through the halls with a Cero ready.
  { id: 'gillian', name: 'Menos Grande', hp: 110, speed: 24, radius: 24, damage: 16, xp: 6, behavior: 'ranged', color: 0x2c2238 },
  // Las Noches' defenders (variant = which of them, see data/arrancar.ts) and Grimmjow, who ends the stage.
  { id: 'arrancar', name: 'Arrancar', hp: 2600, speed: 48, radius: 30, damage: 27, xp: 75, behavior: 'chase', boss: true, color: 0xe8e6de },
  { id: 'grimmjow', name: 'Grimmjow Jaegerjaquez', hp: 2600, speed: 56, radius: 31, damage: 38, xp: 190, behavior: 'chase', boss: true, color: 0x59b8ff },
  // Karakura Town. Its gigai and sentries are original designs; its defenders and Urahara are homages.
  { id: 'gigai', name: 'Empty Gigai', hp: 15, speed: 50, radius: 11, damage: 10, xp: 1, behavior: 'chase', color: 0xe8dcc8 },
  { id: 'sentry', name: 'Kidō Sentry', hp: 18, speed: 30, radius: 11, damage: 9, xp: 2, behavior: 'ranged', color: 0xffd27a },
  // Karakura's defenders (variant = which of them, see data/karakura.ts) and Urahara, who ends the stage.
  { id: 'karakura', name: 'Defender', hp: 2600, speed: 50, radius: 30, damage: 30, xp: 85, behavior: 'chase', boss: true, color: 0xffc878 },
  { id: 'urahara', name: 'Kisuke Urahara', hp: 2600, speed: 48, radius: 31, damage: 40, xp: 220, behavior: 'chase', boss: true, shinigami: true, color: 0x7ac88a },
  // An Adjuchas, one of the Menos that can fire a Cero: it keeps its distance and fires down a long, warned line. Original design.
  { id: 'cero', name: 'Adjuchas', hp: 34, speed: 40, radius: 13, damage: 10, xp: 3, behavior: 'ranged', color: 0xe8e2d6 },
];

export const ENEMY_INDEX: Readonly<Record<EnemyId, number>> = {
  hollow: 0,
  hound: 1,
  brute: 2,
  volatile: 3,
  bearer: 4,
  ayon: 5,
  nel: 6,
  officer: 7,
  flash: 8,
  caster: 9,
  guard: 10,
  unohana: 11,
  captain: 12,
  commander: 13,
  ashen: 14,
  rift: 15,
  golden: 16,
  sentinel: 17,
  inkwisp: 18,
  inkling: 19,
  weaver: 20,
  asauchi: 21,
  attendant: 22,
  royal: 23,
  ichibe: 24,
  harribel: 25,
  brawler: 26,
  specimen: 27,
  gotei: 28,
  kyoraku: 29,
  jizo: 30,
  defender: 31,
  ichigo: 32,
  mirage: 33,
  numeros: 34,
  exequias: 35,
  gillian: 36,
  arrancar: 37,
  grimmjow: 38,
  gigai: 39,
  sentry: 40,
  karakura: 41,
  urahara: 42,
  cero: 43,
};
