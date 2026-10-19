import { stats, type PowerDef } from './powerTypes';

/**
 * Fragments of the Soul King: won in his palace, one from each Royal Guard
 * you defeat (one you do not hold yet). Like bankai they never appear as new
 * cards; they level from 1 to 3 through the normal level-up cards.
 */
export const FRAGMENT_POWERS: readonly PowerDef[] = [
  {
    // every cooldown: enemies within radius stand still for duration (bosses slowed) and take damage
    id: 'rightarm',
    kind: 'stillness',
    group: 'fragment',
    name: 'Right Arm of the Soul King',
    credit: 'The Soul King',
    desc: 'A wave of stillness: everything around you stops where it stands.',
    icon: 'glove',
    color: '#fff2c2',
    maxLevel: 3,
    base: stats({ damage: 60, cooldown: 12, radius: 190, duration: 2.2 }),
    levels: [
      { desc: 'A wider wave that holds longer', add: { radius: 40, duration: 0.6 } },
      { desc: 'Far harder, and more often', add: { damage: 80, cooldown: -2 } },
    ],
  },
  {
    // every cooldown: threads seize the `count` sturdiest enemies within radius; bound for duration, then vulnerable
    id: 'leftarm',
    kind: 'nerves',
    group: 'fragment',
    name: 'Left Arm of the Soul King',
    credit: 'The Soul King',
    desc: 'Nerve threads seize the sturdiest enemies near you, bind them and lay them open.',
    icon: 'thorn',
    color: '#e8d8ff',
    maxLevel: 3,
    base: stats({ damage: 90, cooldown: 5, count: 3, radius: 280, duration: 2.5 }),
    levels: [
      { desc: '+2 threads', add: { count: 2 } },
      { desc: 'Harder, and binds longer', add: { damage: 90, duration: 1 } },
    ],
  },
  {
    // below 30% health, once per cooldown: invulnerable for duration, heal half, a shockwave of radius and damage
    id: 'heart',
    kind: 'heartsurge',
    group: 'fragment',
    name: 'Heart of the Soul King',
    credit: 'The Soul King',
    desc: 'When you are close to falling, the heart beats: a surge that heals you and throws everything back.',
    icon: 'heart',
    color: '#ffcf7a',
    maxLevel: 3,
    base: stats({ damage: 220, cooldown: 60, radius: 240, duration: 3 }),
    levels: [
      { desc: 'Beats again sooner', add: { cooldown: -15 } },
      { desc: 'A stronger surge', add: { damage: 260, duration: 1 } },
    ],
  },
];

export const FRAGMENT_IDS: readonly string[] = FRAGMENT_POWERS.map((p) => p.id);
