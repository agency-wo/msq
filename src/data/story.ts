/**
 * The story, told in short chapters that unlock as you play, and one line
 * for each boss as it arrives. Written for this game, in its own words.
 */

/** When a chapter is shown: before a run (on a given stage) or after one, once its condition holds. */
export type ChapterTrigger =
  | { when: 'before'; stage?: string }
  | { when: 'after'; condition: 'bankai' | 'hueco' | 'seireitei' | 'almighty' | 'palace' | 'heir' | 'silbern' | 'wahrwelt' | 'lasnoches' };

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
      'With medallions of his design, five of his Sternritter reached into the captains of the Gotei 13 and tore out their bankai, the final and truest form of a soul’s blade: Äs Nödt, Cang Du, BG9, Bambietta and Driscoll.',
      'They thought a stolen soul made them something more than his knights. In the desert where the Wandenreich makes its camp, they wait to see whether he will ask for it back.',
      'He does not ask. The first medallion is warm in the Emperor’s hand. It still remembers whose it was. That does not matter. Everything taken in his name belongs to him.',
    ],
  },
  {
    id: 'lord',
    kicker: 'Chapter II',
    title: 'The Queen of Las Noches',
    hint: 'Clear Hueco Mundo.',
    trigger: { when: 'after', condition: 'hueco' },
    text: [
      'Since Aizen fell, the desert has had a queen: Tier Harribel, the Third Espada, keeping what was left of the Arrancar safe behind the white walls of Las Noches.',
      'She met the Emperor in front of her own palace, and the sea she carried in her blade could not reach him. He leaves her in chains in her own halls. A queen is worth more alive.',
      'Beyond the dunes the sky tears open onto a wall of white stone: the Seireitei, city of the Soul Reapers. Every bankai his knights stole belonged to a captain who waits there.',
      'They will want their bankai back. The Emperor intends to take the rest.',
    ],
  },
  {
    id: 'lasnoches',
    kicker: 'Interlude',
    title: 'The Painted Sky',
    hint: 'Set foot in Las Noches.',
    trigger: { when: 'before', stage: 'lasnoches' },
    text: [
      'Harribel fell at the doors of Las Noches, and the doors stayed open. Inside is the palace Aizen raised out of the sand: white hall after white hall, under a blue sky he painted on the inside of its dome so that his Espada would never see the night.',
      'Aizen is gone and the queen is beaten. The Arrancar who are left have no one to hold the palace for, and they hold it anyway: the Exequias in their skull masks, three of the Privaron who were once Espada, and a Sexta Espada who has been waiting a long time for someone worth fighting.',
    ],
  },
  {
    id: 'sexta',
    kicker: 'Interlude',
    title: 'The Sexta',
    hint: 'Clear Las Noches.',
    trigger: { when: 'after', condition: 'lasnoches' },
    text: [
      'Grimmjow lies in the sand of a day that never ends, still grinning. He would rather lose to a king, he says, than kneel to one.',
      'The Emperor leaves him there. Nothing in Las Noches was worth taking. He came so that no throne in Hueco Mundo would be left standing but his.',
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
    id: 'heir',
    kicker: 'Interlude',
    title: 'The Heir',
    hint: 'Take back The Antithesis.',
    trigger: { when: 'after', condition: 'heir' },
    text: [
      'Nine years ago the Auswählen took back the power of every Quincy of mixed blood, and their lives with it. One boy of mixed blood lived through it: Uryū Ishida.',
      'The Emperor named him his successor and gave him a letter, the same letter as his own. A: The Antithesis, which turns back what has already happened.',
      'An heir is only a promise. Everything the Emperor gives, he takes back in the end, and this letter has come home with the rest.',
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
  {
    id: 'silbern',
    kicker: 'Chapter VI',
    title: 'Silbern',
    hint: 'Set foot in Silbern.',
    trigger: { when: 'before', stage: 'silbern' },
    text: [
      'The second time, he did not come through the walls. The Wandenreich had been there all along, in the Seireitei’s own shadow, and now its city rose and took the Seireitei’s place: Silbern, white towers where the barracks stood.',
      'Yamamoto is gone. Shunsui Kyōraku wears the Captain-Commander’s haori now, and the captains who are left have had time to get ready.',
      'They fight in streets that are no longer theirs. The Emperor lets them. Every captain who falls here is one fewer waiting below the palace.',
    ],
  },
  {
    id: 'games',
    kicker: 'Chapter VII',
    title: 'Children’s Games',
    hint: 'Clear Silbern.',
    trigger: { when: 'after', condition: 'silbern' },
    text: [
      'Kyōraku fought the way he always has: lazily, and then all at once, with children’s games that kill. Shadows that bite. A game of who stands higher. A stage play of grief.',
      'When it is over his straw hat lies in the road, and the Gotei 13 has no Captain-Commander again.',
      'Above Silbern the sky has already opened. The palace is waiting.',
    ],
  },
  {
    id: 'palace',
    kicker: 'Chapter VIII',
    title: 'The Palace in the Sky',
    hint: 'Set foot in the Soul King Palace.',
    trigger: { when: 'before', stage: 'palace' },
    text: [
      'Above the Seireitei, where no road reaches, the Soul King’s palace hangs among the clouds. Its guardians have never once let anyone pass.',
      'They were chosen for what they made: the springs that mend, the grain that feeds, the blades every Soul Reaper carries, the robes they wear, and the names that hold the world together.',
      'The Emperor climbs anyway. Whatever sits on that throne was a man once. He means to remind it.',
    ],
  },
  {
    id: 'soulking',
    kicker: 'Chapter IX',
    title: 'The Soul King',
    hint: 'Clear the Soul King Palace.',
    trigger: { when: 'after', condition: 'palace' },
    text: [
      'The one who names things lies still in his own spilled ink. Without him, the palace has no word for what is climbing its last stair.',
      'Behind the final door the Soul King waits, as he has waited for longer than the world has had a name: no arms, no heart, no will of his own.',
      'The Emperor holds the fragments he took on the way up. Everything ever given away, he has taken back. Now he takes the rest.',
    ],
  },
  {
    id: 'wahrwelt',
    kicker: 'Chapter X',
    title: 'Wahrwelt',
    hint: 'Set foot in the Wahrwelt.',
    trigger: { when: 'before', stage: 'wahrwelt' },
    text: [
      'He cut the Soul King in two and took him in, and the palace above the clouds became his: the Wahrwelt, the true world.',
      'They come up after him anyway. Soul Reapers and Hollows side by side, a Quincy he once named his heir, the prisoner who wanted the same throne long before him, and a boy with orange hair and two blades.',
      'The Emperor once called that boy his son. Every Quincy is his, in the end.',
    ],
  },
  {
    id: 'oneworld',
    kicker: 'Chapter XI',
    title: 'One World',
    hint: 'Clear the Wahrwelt.',
    trigger: { when: 'after', condition: 'wahrwelt' },
    text: [
      'The last of them falls, and nothing stands between the Emperor and the world he wants: Soul Society, Hueco Mundo and the world of the living made one, with no death in any of them.',
      'In another telling, a silver arrow found his heart, and a boy’s blade did the rest.',
      'Not in this one.',
    ],
  },
];

export const CHAPTER_BY_ID: ReadonlyMap<string, Chapter> = new Map(CHAPTERS.map((c) => [c.id, c]));

/**
 * One line per boss, shown on its title card. Hueco Mundo's bearers are the
 * Emperor's own knights, speaking to him; Seireitei's captains defend their city.
 */
export const BOSS_LINES: Readonly<Record<string, string>> = {
  'bearer:senbonzakura': '“A thousand petals, Your Majesty, and every one of them carries my fear.”',
  'bearer:hyorinmaru': '“My skin is iron and the ice answers to me now. Strike, if you like.”',
  'bearer:raikoben': '“Analysis complete. The chance you take this back is low.”',
  'bearer:tengen': '“Everything I touch explodes, and this giant kneels to me. Will you?”',
  'bearer:gonryo': '“Every kill makes me stronger. You would make a big one.”',
  'bearer:zanka': '“I carry a fire that burned for a thousand years. Burn with me.”',
  'captain:senbonzakura': '“My blade was taken once. It will not be taken again.”',
  'captain:hyorinmaru': '“You walked into my city. You will not walk out.”',
  'captain:raikoben': '“One sting finds the mark. The second ends you.”',
  'captain:tengen': '“I gave my heart to this city. You will have to break it.”',
  'captain:gonryo': '“No one reaches the Captain-Commander while I stand.”',
  'boss:ayon': 'It has no voice. Three women gave an arm each to make it, and it knows whose queen you came for.',
  'boss:nel': '“I used to be the Tercera. For as long as it takes to stop you, I can be again.”',
  'boss:harribel': '“This desert is under my protection. Go back the way you came.”',
  'gotei:kenpachi': '“Finally, someone worth cutting. Don’t you dare die too quick.”',
  'gotei:mayuri': '“The Quincy king himself, alive. I shall take very careful notes.”',
  'gotei:shinji': '“Careful where you step. Up might not be up for long.”',
  'gotei:kensei': '“You stole the Seireitei out from under us. Time to take it back.”',
  'boss:kyoraku': '“I’d rather not do this. But the old man left me his haori, so here we are.”',
  'heroes:renji': '“I trained up in that palace for exactly this. Let’s see you dodge it.”',
  'heroes:rukia': '“Everything my sword touches freezes. You will not be different.”',
  'heroes:uryu': '“You named me your heir. I came all this way to give it back.”',
  'heroes:aizen': '“I never meant this throne for you. Look closely: am I even here?”',
  'boss:ichigo': '“I don’t care whose blood is in me. You’re not taking anyone else.”',
  'arrancar:rudbornn': '“The Exequias carry out sentences. Yours was passed the moment you walked in.”',
  'arrancar:dordoni': '“A king, here, in my halls? Then dance with me, señor, until one of us cannot.”',
  'arrancar:cirucci': '“The Privaron were thrown away once already. I will not be thrown away by you.”',
  'arrancar:gantenbainne': '“I fight for the ones who cannot. Come, then. I will not step aside.”',
  'boss:grimmjow': '“Finally, something worth tearing apart. Try not to bore me, king.”',
  'boss:unohana': '“Please hold still. I would hate to make your wounds worse than they need to be.”',
  'boss:commander': '“I have burned for a thousand years. Tonight, so will you.”',
  'royal:tenjiro': '“Nobody leaves my springs the way they came in.”',
  'royal:kirio': '“You look starved, little emperor. Let me feed you something you won’t forget.”',
  'royal:oetsu': '“Every blade down there, I made. Yours I’ll just have to break.”',
  'royal:senjumaru': '“Every thread in this palace is mine, and you are standing on one.”',
  'boss:ichibe': '“I named the dark itself, once. Let us find out what name you answer to.”',
};
