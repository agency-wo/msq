/**
 * The story, told in short chapters that unlock as you play, and one line
 * for each boss as it arrives. Written for this game, in its own words.
 */

/** When a chapter is shown: before a run (on a given stage) or after one, once its condition holds. */
export type ChapterTrigger =
  | { when: 'before'; stage?: string }
  | { when: 'after'; condition: 'bankai' | 'hueco' | 'seireitei' | 'almighty' };

export interface Chapter {
  id: string;
  /** "Prologue", "Chapter II"... */
  kicker: string;
  title: string;
  /** What unlocks it, for the Chronicle's locked entries. */
  hint: string;
  trigger: ChapterTrigger;
  text: readonly string[];
}

export const CHAPTERS: readonly Chapter[] = [
  {
    id: 'prologue',
    kicker: 'Prologue',
    title: 'Nine Hundred Years',
    hint: 'Begin your first run.',
    trigger: { when: 'before' },
    text: [
      'For nine hundred years the Emperor slept, and for nine hundred years the pieces of his soul walked the world without him.',
      'Long ago he gave them away: a letter to each of his knights, a power for each letter. The Schrift made them terrible. It made them proud.',
      'Now he is awake, and he wants them back. Every soul he grinds into the sand returns a little of what he gave. They call it Auswählen, the choosing. He does not choose to be merciful.',
      'He begins in the desert of the Hollows, where nothing remembers his name.',
    ],
  },
  {
    id: 'medallions',
    kicker: 'Chapter I',
    title: 'Medallions',
    hint: 'Take back your first bankai.',
    trigger: { when: 'after', condition: 'bankai' },
    text: [
      'Some of his knights did more than keep his gifts. With medallions of his design they reached into the Soul Reapers and tore out their bankai, the final and truest form of a soul’s blade.',
      'They thought a stolen soul would make them his equals. They ran with their medallions into the desert, where the Hollows obey no one.',
      'The first medallion is warm in the Emperor’s hand. It still remembers whose it was. That does not matter. Everything taken in his name belongs to him.',
    ],
  },
  {
    id: 'lord',
    kicker: 'Chapter II',
    title: 'The Lord of the Desert',
    hint: 'Clear Hueco Mundo.',
    trigger: { when: 'after', condition: 'hueco' },
    text: [
      'The Vasto Lorde was old when the desert was young. It falls without a sound, and the white moon looks away.',
      'Beyond the dunes the sky tears open onto a wall of white stone: the Seireitei, city of the Soul Reapers. Every bankai his knights stole belonged to a captain who waits there.',
      'They will want their bankai back. The Emperor intends to take the rest.',
    ],
  },
  {
    id: 'invasion',
    kicker: 'Chapter III',
    title: 'Invasion',
    hint: 'Set foot in the Seireitei.',
    trigger: { when: 'before', stage: 'seireitei' },
    text: [
      'The gates of the Seireitei do not open for him, so he walks through the walls.',
      'Soldiers in black pour out of every courtyard. Kidō burns the night. Somewhere above the rooftops the captains of the Gotei 13 are already moving, each one carrying a bankai he has not taken yet.',
      'Let them come one at a time. A captain is only a medallion that has not been filled.',
    ],
  },
  {
    id: 'ash',
    kicker: 'Chapter IV',
    title: 'Ash',
    hint: 'Clear the Seireitei.',
    trigger: { when: 'after', condition: 'seireitei' },
    text: [
      'The Captain-Commander set the whole sky on fire to stop him, and for a moment the heat was enough to make the Emperor remember pain.',
      'Then the flames went out. In the ashes of the First Division he picks up a sword that has burned for a thousand years and finds it cold.',
      'The Gotei 13 will rebuild. He will let them. A city that keeps making captains keeps making bankai.',
    ],
  },
  {
    id: 'almighty',
    kicker: 'Chapter V',
    title: 'The Almighty',
    hint: 'Take back all six bankai.',
    trigger: { when: 'after', condition: 'almighty' },
    text: [
      'Six medallions, six stolen souls, all of them his. The last piece settles into place, and the Emperor opens his eyes.',
      'He sees every future at once: every blade that will be swung at him, every step that carries him past it. He sees the ones where he loses, and he closes them.',
      'The Almighty is not a power he was given. It is the one he kept.',
    ],
  },
];

export const CHAPTER_BY_ID: ReadonlyMap<string, Chapter> = new Map(CHAPTERS.map((c) => [c.id, c]));

/**
 * One line per boss, shown on its title card. Hueco Mundo's bearers are the
 * Emperor's own knights, speaking to him; Seireitei's captains defend their city.
 */
export const BOSS_LINES: Readonly<Record<string, string>> = {
  'bearer:senbonzakura': '“A thousand petals, Your Majesty, and not one of them is yours.”',
  'bearer:hyorinmaru': '“The ice answers to me now. Even you will freeze.”',
  'bearer:raikoben': '“You taught us to take. I took the biggest weapon there was.”',
  'bearer:tengen': '“This giant kneels to me. Will you?”',
  'bearer:gonryo': '“Lightning has no master. Neither do I, anymore.”',
  'bearer:zanka': '“I carry a fire that burned for a thousand years. Burn with me.”',
  'captain:senbonzakura': '“My blade was taken once. It will not be taken again.”',
  'captain:hyorinmaru': '“You walked into my city. You will not walk out.”',
  'captain:raikoben': '“One sting finds the mark. The second ends you.”',
  'captain:tengen': '“I gave my heart to this city. You will have to break it.”',
  'captain:gonryo': '“No one reaches the Captain-Commander while I stand.”',
  'boss:menos': 'Its vast mask lowers, and the air in front of it begins to glow red.',
  'boss:vasto': 'The lord of the desert turns its horned mask toward you.',
  'boss:grandmaster': '“Every seal in this city answers to me.”',
  'boss:commander': '“I have burned for a thousand years. Tonight, so will you.”',
};
