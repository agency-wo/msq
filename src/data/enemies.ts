export type EnemyId =
  | 'hollow'
  | 'hound'
  | 'brute'
  | 'volatile'
  | 'bearer'
  | 'menos'
  | 'vasto'
  | 'officer'
  | 'flash'
  | 'caster'
  | 'guard'
  | 'grandmaster'
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
  | 'harribel';

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
 * the bosses. The swarm, the bearers and the Hollow bosses are original
 * designs; the captains, the Royal Guard and Tier Harribel are chibi homages.
 * Index order matters: enemies store their type as a byte.
 */
export const ENEMY_LIST: readonly EnemyDef[] = [
  { id: 'hollow', name: 'Lesser Hollow', hp: 10, speed: 46, radius: 11, damage: 8, xp: 1, behavior: 'chase', color: 0xe8e2d6 },
  // Faster than you on purpose: hounds punish standing still or kiting lazily.
  { id: 'hound', name: 'Hound Hollow', hp: 8, speed: 135, radius: 9, damage: 6, xp: 1, behavior: 'chase', color: 0xe8e2d6 },
  { id: 'brute', name: 'Brute Hollow', hp: 70, speed: 34, radius: 18, damage: 14, xp: 4, behavior: 'chase', color: 0xe8e2d6 },
  { id: 'volatile', name: 'Volatile Hollow', hp: 18, speed: 80, radius: 12, damage: 22, xp: 2, behavior: 'chase', bomber: true, color: 0xff6a3c },
  { id: 'bearer', name: 'Medallion Bearer', hp: 2600, speed: 44, radius: 30, damage: 25, xp: 60, behavior: 'chase', boss: true, color: 0xffcb5c },
  { id: 'menos', name: 'Menos Grande', hp: 2600, speed: 30, radius: 44, damage: 30, xp: 80, behavior: 'chase', boss: true, color: 0xff2d4a },
  { id: 'vasto', name: 'Vasto Lorde', hp: 2600, speed: 52, radius: 34, damage: 35, xp: 120, behavior: 'chase', boss: true, color: 0xff2d4a },
  { id: 'officer', name: 'Unseated Officer', hp: 12, speed: 50, radius: 11, damage: 9, xp: 1, behavior: 'chase', shinigami: true, color: 0xd8dce8 },
  { id: 'flash', name: 'Flash-Step Scout', hp: 10, speed: 72, radius: 9, damage: 7, xp: 1, behavior: 'blink', shinigami: true, color: 0xc9b8ff },
  { id: 'caster', name: 'Kidō Caster', hp: 16, speed: 42, radius: 11, damage: 8, xp: 2, behavior: 'ranged', shinigami: true, color: 0xff8a4a },
  { id: 'guard', name: 'Heavy Guard', hp: 90, speed: 32, radius: 19, damage: 16, xp: 5, behavior: 'chase', shinigami: true, color: 0xd8dce8 },
  {
    id: 'grandmaster',
    name: 'Kidō Grandmaster',
    hp: 2600,
    speed: 40,
    radius: 32,
    damage: 32,
    xp: 150,
    behavior: 'chase',
    boss: true,
    shinigami: true,
    color: 0xffb37a,
  },
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
  { id: 'golden', name: 'Golden Hollow', hp: 400, speed: 105, radius: 13, damage: 0, xp: 40, behavior: 'flee', color: 0xffd27a },
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
  // Hueco Mundo's final boss: Tier Harribel, the Tres Espada, who has ruled Las Noches since Aizen fell.
  { id: 'harribel', name: 'Tier Harribel', hp: 2600, speed: 50, radius: 30, damage: 36, xp: 170, behavior: 'chase', boss: true, color: 0x5ac8ff },
];

export const ENEMY_INDEX: Readonly<Record<EnemyId, number>> = {
  hollow: 0,
  hound: 1,
  brute: 2,
  volatile: 3,
  bearer: 4,
  menos: 5,
  vasto: 6,
  officer: 7,
  flash: 8,
  caster: 9,
  guard: 10,
  grandmaster: 11,
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
};
