import type { EnemyId } from './enemies';
import { FIRST_SHRINE_AT } from './shrines';
import { DIFFICULTY, stageById, type StageDef, type StageId, type TimelineEvent, variety } from './stages';

/**
 * Story Mode: the Thousand-Year Blood War from the Emperor's side, told as
 * ten short missions. Each is a run of its own on one of the stages, with a
 * goal (a boss to fall, a span to survive, a number of bosses to put down),
 * its own rules and timeline, a briefing before and a page after. Mission I
 * is always open; clearing one opens the next. Written for this game, in its
 * own words; where it follows the series it follows it closely, and the last
 * mission is another telling, as the Karakura stage is.
 */

export type MissionGoal = { kind: 'boss' } | { kind: 'survive' } | { kind: 'bosses'; count: number };

export interface MissionDef {
  id: string;
  /** "IV". */
  numeral: string;
  title: string;
  stage: StageId;
  /** Seconds. A 'survive' mission is won when the clock gets here. */
  length: number;
  goal: MissionGoal;
  /** One line for the list and the briefing. */
  goalText: string;
  /** The boss events (and any extra elites) on top of the mission's swarm skeleton. */
  events: readonly TimelineEvent[];
  /** The swarm's ring and elite enemies. */
  ring: EnemyId;
  elite: EnemyId;
  /** Roster members forced into the bearer slots, in order (else drawn as the stage draws them). */
  bearers?: readonly string[];
  /** Daily Trial rules that bend this mission (see data/daily.ts). */
  mods?: readonly string[];
  /** The Schrift the mission opens with instead of the Archives' pick, and a second one held from the start. */
  start?: string;
  extra?: string;
  /** The Emperor holds The Almighty from the first second. */
  almighty?: boolean;
  /** Multipliers on the stage's swarm health and spawns, and on how hard the mission's bosses hit. */
  hp?: number;
  spawn?: number;
  bossDamage?: number;
  /** Gold paid the first time the mission is cleared. */
  reward: number;
  /** Rules worth saying out loud on the briefing, beyond the goal. */
  rules?: readonly string[];
  brief: readonly string[];
  after: readonly string[];
}

const boss = (at: number, enemy: EnemyId, hpMul: number, warn: string, sub: string, final = true): TimelineEvent => ({ at, kind: 'boss', enemy, hpMul, final, warn, sub });
const bearer = (at: number, tier: number, hpMul: number): TimelineEvent => ({ at, kind: 'bearer', tier, hpMul });

export const MISSIONS: readonly MissionDef[] = [
  {
    id: 'desert',
    numeral: 'I',
    title: 'The Desert of the Hollows',
    stage: 'hueco',
    length: 420,
    goal: { kind: 'boss' },
    goalText: 'Defeat Tier Harribel.',
    ring: 'hollow',
    elite: 'brute',
    events: [boss(420, 'harribel', 1.2, 'Tier Harribel comes out of Las Noches to meet you', 'Third Espada · Queen of Hueco Mundo')],
    // The first mission is where the campaign begins: its queen fights hard, but not as she does at the end of a stage.
    bossDamage: 0.55,
    reward: 300,
    brief: [
      'The Wandenreich has made its camp in the desert of the Hollows. Since Aizen fell, the Arrancar have had a queen here, and she will not kneel to a stranger who walks out of the shadows.',
      'Let the desert come at you. At the end of it, Tier Harribel.',
    ],
    after: [
      'The sea she carried in her blade broke on him like a wave on stone. He has her chained in her own palace: a queen is worth more alive, and Hueco Mundo is his.',
    ],
  },
  {
    id: 'jagdarmee',
    numeral: 'II',
    title: 'The Jagdarmee',
    stage: 'hueco',
    length: 480,
    goal: { kind: 'survive' },
    goalText: 'Survive for 8:00.',
    ring: 'hound',
    elite: 'brute',
    events: [120, 180, 240, 300, 360, 420].map((at): TimelineEvent => ({ at, kind: 'elite', enemy: at < 240 ? 'hollow' : 'brute' })),
    mods: ['swarm'],
    extra: 'jail',
    reward: 400,
    rules: ['You hold The Jail, Quilge Opie’s letter, beside Heilig Pfeil.', 'The Swarm: 35% more enemies, each 15% weaker.', 'An elite every minute from 2:00.'],
    brief: [
      'Quilge Opie leads the Jagdarmee, the hunting army, and the hunt has no end: every Arrancar the desert still hides is to be caged, and those who will not serve are to be destroyed.',
      'Hold the desert while the hunt sweeps it clean. Nothing comes to save you; nothing is meant to.',
    ],
    after: [
      'When the hunt was over, the desert was quiet. The Arrancar who were left had a choice, and most of them made it: they would fight for the Emperor at the Seireitei, or not at all.',
    ],
  },
  {
    id: 'medallions',
    numeral: 'III',
    title: 'Medallions',
    stage: 'hueco',
    length: 450,
    goal: { kind: 'bosses', count: 3 },
    goalText: 'Defeat three of the Sternritter who stole a bankai.',
    ring: 'hollow',
    elite: 'brute',
    events: [bearer(150, 0, 0.8), bearer(270, 1, 1.6), bearer(390, 2, 2.6)],
    reward: 500,
    brief: [
      'Five of his knights came back from the Seireitei with medallions full of stolen bankai. They have begun to believe that what they hold is theirs.',
      'Remind three of them. Whatever was taken in his name belongs to him.',
    ],
    after: ['Three medallions, warm in his hand. Each still remembers whose it was; that does not matter. The rest of his knights saw it done, and understood.'],
  },
  {
    id: 'paintedsky',
    numeral: 'IV',
    title: 'The Painted Sky',
    stage: 'lasnoches',
    length: 420,
    goal: { kind: 'boss' },
    goalText: 'Defeat Grimmjow Jaegerjaquez.',
    ring: 'numeros',
    elite: 'gillian',
    events: [bearer(150, 0, 1.2), bearer(270, 1, 2.4), boss(420, 'grimmjow', 9, 'Grimmjow Jaegerjaquez is grinning at you', 'Sexta Espada')],
    reward: 600,
    brief: [
      'Under the dome of Las Noches the sky is a painting, blue and still, the way Aizen wanted it. The Arrancar who are left defend his halls as if he were coming back.',
      'Two of them stand in the way, and behind them the Sexta, who has never once been told he cannot win.',
    ],
    after: ['Grimmjow went down laughing, as if the fight had been worth it. Under the painted sky the palace of the Hollows is empty, and the way to the Seireitei is open.'],
  },
  {
    id: 'invasion',
    numeral: 'V',
    title: 'The First Invasion',
    stage: 'seireitei',
    length: 480,
    goal: { kind: 'boss' },
    goalText: 'Defeat the Captain-Commander.',
    ring: 'officer',
    elite: 'guard',
    events: [bearer(150, 0, 1.3), bearer(300, 1, 2.6), boss(480, 'commander', 11, 'The Captain-Commander draws Ryūjin Jakka', 'Captain-Commander of the Gotei 13')],
    hp: 1.1,
    reward: 700,
    brief: [
      'The Wandenreich gave the Soul Reapers five days. On the fifth, its knights walked out of the shadows of the Seireitei and took the captains’ bankai with their medallions.',
      'For a thousand years one man has held the city: Genryūsai Shigekuni Yamamoto, whose flame has no equal. He is waiting at the First Division. Go to him.',
    ],
    after: [
      'Ryūjin Jakka burned hotter than the sun, and still it was not enough. The Emperor took the bankai from the old man’s hands as he fell, and the oldest fire in Soul Society went out.',
      'Then, in the ruin of the First Division, he named his successor: a Quincy who had fought beside the Soul Reapers, and would now stand beside him.',
    ],
  },
  {
    id: 'silbern',
    numeral: 'VI',
    title: 'Silbern',
    stage: 'silbern',
    length: 480,
    goal: { kind: 'boss' },
    goalText: 'Defeat Shunsui Kyōraku, the new Captain-Commander.',
    ring: 'officer',
    elite: 'specimen',
    events: [bearer(150, 0, 1.3), bearer(300, 1, 2.6), boss(480, 'kyoraku', 11, 'Shunsui Kyōraku tips back his hat', 'Captain-Commander of the Gotei 13')],
    hp: 1.15,
    reward: 800,
    brief: [
      'The Wandenreich’s city was never anywhere else. Silbern lay in the shadow of the Seireitei all along, and now it rises through it, white stone over white walls.',
      'The Gotei 13 has a new Captain-Commander, a man who smiles and does not fight fair. Two of his captains first.',
    ],
    after: ['Kyōraku’s games are played to the end, and he lost this one. Above Silbern the way to the Soul King Palace stands open, as the Emperor always meant it to.'],
  },
  {
    id: 'palace',
    numeral: 'VII',
    title: 'The Palace in the Sky',
    stage: 'palace',
    length: 480,
    goal: { kind: 'boss' },
    goalText: 'Defeat Ichibē Hyōsube.',
    ring: 'inkwisp',
    elite: 'attendant',
    events: [bearer(150, 0, 1.4), bearer(300, 1, 2.8), boss(480, 'ichibe', 11, 'Ichibē Hyōsube lifts his brush', 'The One Who Names')],
    hp: 1.2,
    reward: 900,
    brief: [
      'The Royal Guard, the Zero Division, keep the Soul King above the clouds. Each of them is worth the whole Gotei 13, or so they say.',
      'Two of them, then the monk who named everything in Soul Society, and who believes he can take the Emperor’s name away.',
    ],
    after: [
      'Ichibē’s ink ran out before the Emperor did. At the heart of the palace the Soul King waits in his crystal, as he has for a million years, and the Emperor goes in to him.',
    ],
  },
  {
    id: 'father',
    numeral: 'VIII',
    title: 'Father and Son',
    stage: 'wahrwelt',
    length: 540,
    goal: { kind: 'boss' },
    goalText: 'Defeat Ichigo Kurosaki.',
    ring: 'officer',
    elite: 'brute',
    events: [bearer(90, 0, 1.5), bearer(210, 1, 2.6), bearer(330, 2, 4), boss(540, 'ichigo', 14, 'Ichigo Kurosaki draws both his blades', 'Substitute Soul Reaper')],
    bearers: ['renji', 'uryu', 'aizen'],
    hp: 1.25,
    reward: 1000,
    brief: [
      'The Soul King is dead, and from his palace the Emperor has raised the Wahrwelt, the true world, where life and death will be one. Only a handful stand against him.',
      'Renji Abarai. Uryū Ishida, who turned on him. Sōsuke Aizen, out of his prison for this alone. And last of all the boy he calls his son.',
    ],
    after: [
      'In the version the series tells, the boy won, with a silver arrow and a moment of stillness. This time the Emperor did not stop. Ichigo Kurosaki fell, and the Wahrwelt was whole.',
    ],
  },
  {
    id: 'almighty',
    numeral: 'IX',
    title: 'The Almighty',
    stage: 'wahrwelt',
    length: 600,
    goal: { kind: 'survive' },
    goalText: 'Survive for 10:00 with The Almighty in your hands.',
    ring: 'hollow',
    elite: 'brute',
    events: [120, 240, 360, 480, 540].map((at): TimelineEvent => ({ at, kind: 'elite', enemy: 'brute' })),
    almighty: true,
    hp: 1.35,
    spawn: 1.5,
    reward: 1100,
    rules: ['You hold A · The Almighty from the first second.', 'Half again as many enemies, a third sturdier.'],
    brief: [
      'Everything that was ever given has come back to him: every letter, every stolen bankai, the Soul King’s power. Now every soul in every world comes at once to take it from him.',
      'The Almighty sees every future. Choose the one where you are still standing in ten minutes.',
    ],
    after: ['When the last of them fell there was nobody left who remembered how the worlds had been kept apart. He did. He chose not to.'],
  },
  {
    id: 'telling',
    numeral: 'X',
    title: 'Another Telling',
    stage: 'karakura',
    length: 480,
    goal: { kind: 'boss' },
    goalText: 'Defeat Kisuke Urahara.',
    ring: 'gigai',
    elite: 'sentry',
    events: [bearer(150, 0, 1.5), bearer(300, 1, 2.8), boss(480, 'urahara', 10, 'Kisuke Urahara tips his hat to you', 'Once Captain of the 12th Division')],
    hp: 1.3,
    reward: 1200,
    brief: [
      'In this telling the war did not end in the Wahrwelt. The last of the world of the living waits in an ordinary town, behind a shopkeeper who always has one more plan.',
      'His friends first. Then the man who planned for this day more carefully than anyone.',
    ],
    after: [
      'Even Urahara’s last plan was a plan for losing well. Karakura Town is quiet. The worlds are one. In this telling, the Emperor’s war is over.',
    ],
  },
];

export const MISSION_BY_ID: ReadonlyMap<string, MissionDef> = new Map(MISSIONS.map((m) => [m.id, m]));

/** The swarm's skeleton for a mission's length: rings, elites, chests, runes and the first shrine, as a full stage has them. */
function missionSkeleton(m: MissionDef): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (let t = 90; t < m.length; t += 120) events.push({ at: t, kind: 'ring', enemy: m.ring, count: DIFFICULTY.ringBase + Math.floor(t / DIFFICULTY.ringEvery) });
  if (!m.events.some((e) => e.kind === 'elite')) {
    for (let t = DIFFICULTY.firstElite; t < m.length; t += DIFFICULTY.eliteEvery) events.push({ at: t, kind: 'elite', enemy: m.elite });
  }
  for (let t = 170; t < m.length; t += 150) events.push({ at: t, kind: 'chest' });
  for (let t = 240; t < m.length; t += 180) events.push({ at: t, kind: 'rune', rune: 'magnet' });
  if (FIRST_SHRINE_AT < m.length) events.push({ at: FIRST_SHRINE_AT, kind: 'shrine' });
  // The stage's own charging formations and hazard bursts.
  events.push(...variety(m.length, stageById(m.stage).formation, m.events.filter((e) => e.kind === 'bearer' || e.kind === 'boss').map((e) => e.at)));
  return events;
}

/** The stage a mission is played on: the stage's ground, swarm and roster, with the mission's length, timeline and tuning. */
export function missionStage(m: MissionDef): StageDef {
  const base = stageById(m.stage);
  return {
    ...base,
    length: m.length,
    events: [...missionSkeleton(m), ...m.events].sort((a, b) => a.at - b.at),
    hp: base.hp * (m.hp ?? 1),
    spawn: base.spawn * (m.spawn ?? 1),
    lastBearer: undefined,
  };
}

/** A mission's place in the campaign: open once the one before it is cleared (the first always). */
export function missionOpen(cleared: ReadonlySet<string>, id: string): boolean {
  const k = MISSIONS.findIndex((m) => m.id === id);
  return k === 0 || (k > 0 && cleared.has(MISSIONS[k - 1].id));
}
