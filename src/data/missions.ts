import type { EnemyId } from './enemies';
import { FIRST_SHRINE_AT } from './shrines';
import { DIFFICULTY, stageById, type StageDef, type StageId, type TimelineEvent, variety } from './stages';

/**
 * Story Mode: the Thousand-Year Blood War from the Emperor's side, told as
 * short missions in three books: Book I, the war in ten missions; Book II, its
 * last days told again, closer; Book III, Another Telling, where the first war
 * a thousand years ago went the other way, and the story divides into two
 * roads (the Hollows' and the Soul Reapers'), each with an ending of its own. Each is a run of its own on one of the stages, with a
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
  /** Who the mission's roster bosses are drawn from, when not the stage's own (Book II's Gotei climbing to the palace). */
  roster?: StageDef['roster'];
  /** Every elite put down gives back this share of max health (Auswählen). */
  eliteHeal?: number;
  /** The mission whose clear opens this one, when it is not the one before it (where Book III divides). */
  opensAfter?: string;
  /** Book III: which road the mission is on, shown as a heading over the road's first mission. */
  road?: string;
  /** Who a roster boss is in this telling, when not who the stage says (Aizen still on his throne): the line under the name, the warning. */
  roles?: Readonly<Record<string, { title?: string; warn?: string }>>;
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
      'The Wandenreich gave the Soul Reapers five days. On the fifth, its knights walked out of the shadows of the Seireitei with their medallions open. Two captains did not wait for them: they came looking for you, their bankai already drawn, and a bankai has only one holder.',
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
  // ------------------------------------------------ Book II: the last days, told again, closer.
  {
    id: 'auswahlen',
    numeral: 'XI',
    title: 'Auswählen',
    stage: 'wahrwelt',
    length: 480,
    goal: { kind: 'survive' },
    goalText: 'Hold for 8:00, taking back what your fallen knights carried.',
    ring: 'brawler',
    elite: 'guard',
    events: [45, 90, 135, 180, 225, 270, 315, 360, 405, 450].map((at): TimelineEvent => ({ at, kind: 'elite', enemy: 'guard' })),
    mods: ['swarm', 'haste'],
    eliteHeal: 0.06,
    hp: 2,
    spawn: 1.3,
    reward: 1500,
    rules: ['Every elite you put down gives back 6% of your health.', 'A thick, fast swarm, you faster too; an elite every 45 s.'],
    brief: [
      'The knights who served him are falling across the palace, one after another. Their power was always his, only lent to them for a while.',
      'Take it back. Each elite that falls returns a little of what you gave. Hold for eight minutes.',
    ],
    after: [
      'Light came down over the palace, and the knights who had bled for him gave up the last of what he had given them. He did not look at them. He had never needed to.',
    ],
  },
  {
    id: 'successor',
    numeral: 'XII',
    title: 'The Successor',
    stage: 'wahrwelt',
    length: 480,
    goal: { kind: 'bosses', count: 3 },
    goalText: 'Defeat Renji, Rukia and Uryū.',
    ring: 'officer',
    elite: 'brute',
    events: [bearer(120, 0, 1.8), bearer(240, 1, 2.8), bearer(360, 2, 4.2)],
    bearers: ['renji', 'rukia', 'uryu'],
    hp: 1.15,
    reward: 1600,
    rules: ['Uryū’s silver arrow can silence The Almighty for a while.'],
    brief: [
      'He named the boy his successor, and the boy took the name, the coat and the bow. It was always going to end with that bow turned the other way.',
      'Renji and Rukia climb first. Uryū lets them clear the way.',
    ],
    after: [
      'The silver arrowhead was made for his heart. It met the Emperor’s hand instead, and the hand closed on it. The Wandenreich has no need of a successor now.',
    ],
  },
  {
    id: 'climb',
    numeral: 'XIII',
    title: 'The Gotei Climbs',
    stage: 'palace',
    roster: 'gotei',
    length: 540,
    goal: { kind: 'boss' },
    goalText: 'Defeat Shunsui Kyōraku.',
    ring: 'brawler',
    elite: 'attendant',
    events: [
      bearer(120, 0, 2),
      bearer(240, 1, 3),
      bearer(360, 2, 4.5),
      boss(540, 'kyoraku', 13, 'Shunsui Kyōraku pushes back his hat and draws both blades', 'Captain-Commander of the Gotei 13'),
    ],
    bearers: ['kenpachi', 'mayuri', 'shinji'],
    hp: 1.2,
    reward: 1700,
    brief: [
      'They built a stair of their own up to the palace in the sky. Kenpachi first, as ever; Mayuri with whatever he has made since; Shinji turning every direction backwards.',
      'And behind them, the man who commands them all now.',
    ],
    after: ['The new Captain-Commander staked everything on one last game. Even the best gambler loses to a man who can see every hand before it is dealt.'],
  },
  {
    id: 'kyoka',
    numeral: 'XIV',
    title: 'Kyōka Suigetsu',
    stage: 'wahrwelt',
    length: 480,
    goal: { kind: 'bosses', count: 1 },
    goalText: 'Find the real Sōsuke Aizen, and defeat him.',
    ring: 'officer',
    elite: 'guard',
    events: [bearer(150, 0, 3)],
    bearers: ['aizen'],
    hp: 1.2,
    bossDamage: 0.7,
    reward: 1800,
    rules: ['Kyōka Suigetsu fills the field with copies of Aizen; only one of them is real.'],
    brief: [
      'Aizen sat bound in the dark for a very long time, and smiled through all of it. Kyōraku has let him out to stand against the Emperor.',
      'His blade’s illusion lies to every sense there is. The Almighty sees the future, but a future can be dressed up too.',
    ],
    after: ['For one moment the Emperor struck at a man who was not there. Only for a moment. The real one was still smiling when he fell.'],
  },
  {
    id: 'end',
    numeral: 'XV',
    title: 'The End of a Thousand Years',
    stage: 'wahrwelt',
    length: 600,
    goal: { kind: 'boss' },
    goalText: 'Defeat Ichigo Kurosaki, with Uryū and Aizen at his side.',
    ring: 'officer',
    elite: 'brute',
    events: [bearer(240, 0, 2.8), bearer(244, 1, 3.4), boss(600, 'ichigo', 16, 'Ichigo Kurosaki comes, his blades already drawn', 'Substitute Soul Reaper')],
    bearers: ['uryu', 'aizen'],
    almighty: true,
    hp: 1.2,
    spawn: 1.3,
    bossDamage: 0.85,
    reward: 2500,
    rules: ['You hold A · The Almighty from the first second.', 'Uryū and Aizen come together; Ichigo comes last.'],
    brief: [
      'It ends where every telling of him was always going to end: the boy, the arrow and the illusion, all three at once.',
      'Hold the future in your hands, and do not let it slip, not even for a moment.',
    ],
    after: [
      'The arrow, the illusion and the blade came together, as they do in the telling everyone knows. In this one the Emperor saw all three coming, and the thousand years ended the way he had always said they would.',
    ],
  },
  // ------------------------------------------------ Book III: Another Telling. The first war went the other way.
  {
    id: 'firstwar',
    numeral: 'XVI',
    title: 'A Thousand Years Ago',
    stage: 'seireitei',
    length: 540,
    goal: { kind: 'boss' },
    goalText: 'Defeat Genryūsai Yamamoto in his prime.',
    ring: 'officer',
    elite: 'guard',
    events: [
      bearer(150, 0, 1.5),
      boss(300, 'unohana', 3.5, 'The first Kenpachi draws her blade: Yachiru Unohana', 'The First Kenpachi', false),
      boss(540, 'commander', 9, 'Yamamoto, young and burning, steps out of the flames', 'Founder of the Gotei 13'),
    ],
    bearers: ['gonryo'],
    hp: 1.1,
    reward: 1800,
    opensAfter: 'telling',
    rules: ['Chōjirō Sasakibe stands with the founder, as he has from the first day.', 'Clear this one and the telling divides into two roads.'],
    brief: [
      'A thousand years ago the Emperor marched on the Soul Reapers and lost. Yamamoto’s fire broke him, and the Quincy waited nine hundred years in the dark for him to come back.',
      'In this telling he does not lose. His lieutenant and the first Kenpachi stand at the Captain-Commander’s side, and the old man is not yet old.',
    ],
    after: [
      'The founder of the Gotei 13 fell before the Gotei was a hundred years old. There was no long wait in the dark and no hidden empire in the shadows: the Emperor simply won, and the story everyone knows was never told.',
      'From here the telling divides. One road runs down into Hueco Mundo, where a traitor sits on a white throne. The other climbs to the Soul Reapers who were left.',
    ],
  },
  {
    id: 'throne',
    numeral: 'XVII',
    title: 'The King of Las Noches',
    stage: 'lasnoches',
    length: 540,
    goal: { kind: 'bosses', count: 3 },
    goalText: 'Defeat Grimmjow, Harribel and Sōsuke Aizen.',
    ring: 'numeros',
    elite: 'exequias',
    events: [
      boss(180, 'grimmjow', 3.5, 'The Sexta Espada is spoiling for a fight', 'Sexta Espada', false),
      boss(330, 'harribel', 3.5, 'The Tres Espada rises from her seat', 'Tres Espada', false),
      bearer(480, 0, 6),
    ],
    roster: 'heroes',
    bearers: ['aizen'],
    roles: { aizen: { title: 'King of Las Noches', warn: 'Aizen rises from the white throne' } },
    hp: 1.2,
    reward: 1900,
    opensAfter: 'firstwar',
    road: 'The Hollow Road',
    rules: ['Aizen never fell: his Espada still stand before his throne.'],
    brief: [
      'In this telling Aizen was never beaten. He went home to Las Noches with the Hōgyoku in his chest, and his Espada still stand before the white throne.',
      'The Sexta first, spoiling for a fight as ever; then the Tres Espada; then the man who meant to be king of every world.',
    ],
    after: [
      'Two would-be kings met in the white palace. Only one of them could see the future, and the Hōgyoku had never learned to want anything but more. Las Noches has a new throne, and the Arrancar bow to it.',
    ],
  },
  {
    id: 'hollowarmy',
    numeral: 'XVIII',
    title: 'The Desert Does Not Kneel',
    stage: 'hueco',
    length: 480,
    goal: { kind: 'survive' },
    goalText: 'Hold the desert for 8:00 against every Hollow in it.',
    ring: 'brute',
    elite: 'gillian',
    events: [40, 80, 120, 160, 200, 240, 280, 320, 360, 400, 440].map((at): TimelineEvent => ({ at, kind: 'elite', enemy: 'gillian' })),
    mods: ['giants'],
    hp: 1.3,
    spawn: 1.25,
    reward: 2000,
    road: 'The Hollow Road',
    rules: ['Giants: bigger, slower, sturdier enemies.', 'A Menos Grande walks out of the sand every 40 s.'],
    brief: [
      'The Arrancar bowed to the new throne. The Hollows of the desert did not: they have never knelt to anyone, and they come up out of the sand in their thousands, the Menos walking among them.',
      'Hold the desert for eight minutes, and Hueco Mundo is yours in every way that matters.',
    ],
    after: ['By morning the desert was quiet, which in Hueco Mundo is the nearest thing to peace. Only one thing in that world was still not afraid of him.'],
  },
  {
    id: 'mask',
    numeral: 'XIX',
    title: 'The Hollow in the Boy',
    stage: 'lasnoches',
    length: 600,
    goal: { kind: 'boss' },
    goalText: 'Defeat Ichigo Kurosaki, the Hollow in him awake.',
    ring: 'numeros',
    elite: 'exequias',
    events: [
      boss(200, 'nel', 4.5, 'Neliel stands in your way, for Ichigo’s sake', 'Former Tres Espada', false),
      boss(600, 'ichigo', 15, 'Ichigo Kurosaki comes across the sand, the mask already forming', 'Substitute Soul Reaper'),
    ],
    hp: 1.35,
    reward: 2600,
    road: 'The Hollow Road',
    rules: ['Neliel fights for Ichigo before he comes.', 'The end of the Hollow Road.'],
    brief: [
      'A boy came to Hueco Mundo once before, to bring a friend home. He has come again, and this time the Hollow in him came too.',
      'Neliel remembers him kindly. She will stand in your way first.',
    ],
    after: [
      'The mask broke last. Under it was a boy who had always been half of everything: Soul Reaper, Hollow, human, Quincy. The Emperor took back the Quincy half and left the rest to the sand.',
      'So ends the Hollow Road: the Emperor on the white throne, king of everything that hungers, and the Soul Reapers above still waiting for a war that comes to them last.',
    ],
  },
  {
    id: 'unbroken',
    numeral: 'XX',
    title: 'The Gotei Unbroken',
    stage: 'seireitei',
    length: 540,
    goal: { kind: 'bosses', count: 4 },
    goalText: 'Defeat Kenpachi, Mayuri, Shinji and Kensei.',
    ring: 'officer',
    elite: 'guard',
    events: [bearer(120, 0, 2), bearer(240, 1, 3), bearer(360, 2, 4.5), bearer(480, 3, 6)],
    roster: 'gotei',
    bearers: ['kenpachi', 'mayuri', 'shinji', 'kensei'],
    hp: 1.3,
    reward: 1900,
    opensAfter: 'firstwar',
    road: 'The Soul Reaper Road',
    rules: ['No medallions in this telling: every captain fights with their bankai from the first moment.'],
    brief: [
      'Without its founder, the Gotei 13 rebuilt itself the hard way, one captain at a time, and a thousand years later it is harder than it ever was with him.',
      'There are no medallions this time. Every captain keeps their bankai, and every one of them has waited their whole life for you.',
    ],
    after: ['They never lost their bankai, and still they lost. The Seireitei falls quiet, as it would have a thousand years ago if the old man had not been there.'],
  },
  {
    id: 'zero',
    numeral: 'XXI',
    title: 'Zero Division',
    stage: 'palace',
    length: 540,
    goal: { kind: 'boss' },
    goalText: 'Defeat the Royal Guard, two at a time, and then Ichibē.',
    ring: 'attendant',
    elite: 'sentinel',
    events: [
      bearer(150, 0, 3),
      bearer(152, 1, 3),
      bearer(330, 2, 5),
      bearer(332, 3, 5),
      boss(540, 'ichibe', 14, 'Ichibē Hyōsube opens his brush case', 'Commander of the Royal Guard'),
    ],
    bearers: ['tenjiro', 'kirio', 'oetsu', 'senjumaru'],
    hp: 1.35,
    reward: 2200,
    road: 'The Soul Reaper Road',
    rules: ['The Royal Guard come two at a time.'],
    brief: [
      'The Soul King’s own guard did not wait for the Emperor to climb to them. They came down to meet him, two by two, and their leader behind them with ink on his brush.',
    ],
    after: ['Ichibē named everything, and everything answered to its name. The Emperor had chosen his own long ago, and it answered to no one else.'],
  },
  {
    id: 'kingseat',
    numeral: 'XXII',
    title: 'The Soul King’s Seat',
    stage: 'wahrwelt',
    length: 600,
    goal: { kind: 'boss' },
    goalText: 'Defeat Renji, Rukia and Uryū together, and then Ichigo.',
    ring: 'officer',
    elite: 'brute',
    events: [bearer(240, 0, 3), bearer(242, 1, 3.5), bearer(244, 2, 4), boss(600, 'ichigo', 17, 'Ichigo Kurosaki climbs the last stair', 'Substitute Soul Reaper')],
    bearers: ['renji', 'rukia', 'uryu'],
    almighty: true,
    hp: 1.15,
    spawn: 1.1,
    reward: 3000,
    road: 'The Soul Reaper Road',
    rules: ['You hold A · The Almighty from the first second.', 'Renji, Rukia and Uryū come together.', 'The end of the Soul Reaper Road.'],
    brief: [
      'With the Gotei gone and the Royal Guard fallen, only the friends are left. They climb together, as they always have, and the boy who brought them together comes last.',
    ],
    after: [
      'The Emperor sat where the Soul King had sat, and did what the Soul King never would: he made the worlds one, with no more death and no more fear in any of them.',
      'So ends the Soul Reaper Road. A thousand years late, or a thousand years early; in this telling it makes no difference.',
    ],
  },
];

/** Where each book starts in MISSIONS: Book I is the war in ten, Book II its last days in five; Book III (Another Telling) follows. */
export const BOOK_ONE = 10;
export const BOOK_TWO = 15;

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
    roster: m.roster ?? base.roster,
    lastBearer: undefined,
  };
}

/** A mission's place in the campaign: open once the one before it is cleared (the first always). */
export function missionOpen(cleared: ReadonlySet<string>, id: string): boolean {
  const m = MISSION_BY_ID.get(id);
  if (!m) return false;
  const before = missionBefore(m);
  return !before || cleared.has(before.id);
}

/** The mission whose clear opens this one: its opensAfter, or the one before it (none for Mission I). */
export function missionBefore(m: MissionDef): MissionDef | undefined {
  if (m.opensAfter) return MISSION_BY_ID.get(m.opensAfter);
  const k = MISSIONS.indexOf(m);
  return k > 0 ? MISSIONS[k - 1] : undefined;
}
