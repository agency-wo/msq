/**
 * Power definitions. Phase 1 placeholders: one per core archetype from the
 * analysis (projectile at nearest, orbit, aura pulse, sky strike). The knight
 * powers designed in Phase 2 replace these without engine changes.
 */

export type PowerKind = 'bolt' | 'orbit' | 'pulse' | 'strike';

export interface PowerStats {
  damage: number;
  /** Seconds between casts (pulse interval for auras). */
  cooldown: number;
  count: number;
  /** Projectile speed (units/s) or orbit speed (radians/s). */
  speed: number;
  pierce: number;
  size: number;
  /** Projectile lifetime or orbit uptime, seconds. */
  duration: number;
  /** Hit radius, orbit radius, pulse radius or blast radius depending on kind. */
  radius: number;
}

export interface PowerAttribute {
  id: string;
  name: string;
  desc: string;
}

export interface PowerDef {
  id: string;
  kind: PowerKind;
  name: string;
  desc: string;
  icon: string;
  color: string;
  base: PowerStats;
  /** Upgrades for Lv 2 through Lv 6. Lv 7 is the attribute pick. */
  levels: readonly { desc: string; add: Partial<PowerStats> }[];
  attributes: readonly [PowerAttribute, PowerAttribute, PowerAttribute];
}

export const POWER_MAX_LEVEL = 7;

export const POWERS: readonly PowerDef[] = [
  {
    id: 'arrow',
    kind: 'bolt',
    name: 'Spirit Arrow',
    desc: 'Fires arrows of light at the nearest enemy.',
    icon: 'arrow',
    color: '#7cc8ff',
    base: { damage: 11, cooldown: 0.8, count: 1, speed: 430, pierce: 0, size: 1, duration: 1.3, radius: 7 },
    levels: [
      { desc: '+1 arrow', add: { count: 1 } },
      { desc: '+5 damage', add: { damage: 5 } },
      { desc: 'Cooldown -0.15 s', add: { cooldown: -0.15 } },
      { desc: '+1 arrow, pierce +1', add: { count: 1, pierce: 1 } },
      { desc: '+7 damage', add: { damage: 7 } },
    ],
    attributes: [
      { id: 'volley', name: 'Volley', desc: 'Every cast also looses a wide fan of 4 arrows.' },
      { id: 'lancer', name: 'Lancer', desc: 'Arrows pierce everything, fly 40% faster and grow 25%.' },
      { id: 'detonate', name: 'Detonate', desc: 'Arrows burst on impact, hitting everything nearby for 60%.' },
    ],
  },
  {
    id: 'halo',
    kind: 'orbit',
    name: 'Halo Blades',
    desc: 'Blades of light circle you and cut what they touch.',
    icon: 'blade',
    color: '#ffd27a',
    base: { damage: 9, cooldown: 3, count: 2, speed: 3.4, pierce: 0, size: 1, duration: 3.5, radius: 62 },
    levels: [
      { desc: '+1 blade', add: { count: 1 } },
      { desc: '+4 damage', add: { damage: 4 } },
      { desc: 'Lasts 1 s longer', add: { duration: 1 } },
      { desc: '+1 blade', add: { count: 1 } },
      { desc: '+5 damage, wider orbit', add: { damage: 5, radius: 12 } },
    ],
    attributes: [
      { id: 'eternal', name: 'Eternal', desc: 'The blades never fade.' },
      { id: 'twin', name: 'Twin Halo', desc: 'A second, wider ring spins the other way.' },
      { id: 'razor', name: 'Razor Wind', desc: 'Blades throw shards outward when they cut.' },
    ],
  },
  {
    id: 'pulse',
    kind: 'pulse',
    name: 'Holy Pulse',
    desc: 'A ring of force pulses out from you.',
    icon: 'pulse',
    color: '#b69cff',
    base: { damage: 6, cooldown: 1.1, count: 1, speed: 0, pierce: 0, size: 1, duration: 0, radius: 74 },
    levels: [
      { desc: '+3 damage', add: { damage: 3 } },
      { desc: 'Radius +11', add: { radius: 11 } },
      { desc: 'Pulses 0.15 s faster', add: { cooldown: -0.15 } },
      { desc: '+4 damage', add: { damage: 4 } },
      { desc: 'Radius +14', add: { radius: 14 } },
    ],
    attributes: [
      { id: 'frost', name: 'Frost Field', desc: 'Pulses slow enemies by 45% for 1.5 s.' },
      { id: 'overcharge', name: 'Overcharge', desc: 'Every 4th pulse hits 5 times harder.' },
      { id: 'repel', name: 'Repel', desc: 'Pulses hurl enemies away from you.' },
    ],
  },
  {
    id: 'judgment',
    kind: 'strike',
    name: 'Judgment',
    desc: 'Pillars of light strike enemies near you.',
    icon: 'strike',
    color: '#fff0a0',
    base: { damage: 28, cooldown: 2.2, count: 1, speed: 0, pierce: 0, size: 1, duration: 0, radius: 34 },
    levels: [
      { desc: '+1 strike', add: { count: 1 } },
      { desc: '+12 damage', add: { damage: 12 } },
      { desc: 'Cooldown -0.3 s', add: { cooldown: -0.3 } },
      { desc: '+1 strike', add: { count: 1 } },
      { desc: '+16 damage, bigger blast', add: { damage: 16, radius: 6 } },
    ],
    attributes: [
      { id: 'chain', name: 'Chain', desc: 'Each strike arcs to 3 more enemies for half damage.' },
      { id: 'tempest', name: 'Tempest', desc: '+4 strikes every cast.' },
      { id: 'execute', name: 'Execution', desc: 'Strikes slay non-boss enemies left under 20% health.' },
    ],
  },
];

export const POWER_BY_ID: ReadonlyMap<string, PowerDef> = new Map(POWERS.map((p) => [p.id, p]));
