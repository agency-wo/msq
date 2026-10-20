/**
 * The soundtrack, as data: each track is a short loop of bars in 16th-note
 * steps, written note by note (no samples, nothing to download). music.ts
 * turns these events into Web Audio voices. Pure functions, so tests can
 * check every bar without an AudioContext.
 */

export type TrackId =
  | 'title'
  | 'hueco'
  | 'seireitei'
  | 'lasnoches'
  | 'silbern'
  | 'palace'
  | 'wahrwelt'
  | 'karakura'
  | 'boss'
  | 'bossSei'
  | 'bossPalace'
  | 'final'
  | 'victory'
  | 'defeat';

export type Inst = 'pad' | 'choir' | 'bass' | 'lead' | 'flute' | 'bell' | 'stab' | 'kick' | 'snare' | 'hat' | 'taiko' | 'pluck' | 'clap';

export interface NoteEvent {
  inst: Inst;
  /** Step within the bar, 0-15. */
  step: number;
  /** MIDI note number (ignored by drums). */
  midi: number;
  /** Length in steps. */
  len: number;
  /** 0-1. */
  vel: number;
}

export interface Track {
  id: TrackId;
  bpm: number;
  /** Bars in the loop. */
  bars: number;
  /** One-shot stingers stop after their last bar instead of looping. */
  loop: boolean;
  /** Pitch classes (0 = C) the melody stays in, for the tests. */
  scale: readonly number[];
  bar(index: number): NoteEvent[];
}

export const STEPS_PER_BAR = 16;

const NAMES: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 'A4' -> 69, 'C#5' -> 73, 'Eb5' -> 75. */
export function midi(name: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`Bad note name: ${name}`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + NAMES[m[1]] + acc;
}

type Line = readonly (readonly [step: number, note: string, len: number])[];

function line(inst: Inst, notes: Line, vel: number): NoteEvent[] {
  return notes.map(([step, note, len]) => ({ inst, step, midi: midi(note), len, vel }));
}

function chord(inst: Inst, notes: readonly string[], step: number, len: number, vel: number): NoteEvent[] {
  return notes.map((n) => ({ inst, step, midi: midi(n), len, vel }));
}

function hits(inst: Inst, steps: readonly number[], vel: number, accent: readonly number[] = []): NoteEvent[] {
  return steps.map((step) => ({ inst, step, midi: 0, len: 1, vel: accent.includes(step) ? Math.min(1, vel * 1.6) : vel }));
}

// ------------------------------------------------------------------ title

/** "Auswählen": the Emperor's theme. C minor, slow and regal: choir, low strings, bells. */
const TITLE_CHORDS: readonly (readonly string[])[] = [
  ['C3', 'G3', 'Eb4'],
  ['C3', 'G3', 'Eb4'],
  ['Ab2', 'Eb3', 'C4'],
  ['Ab2', 'Eb3', 'C4'],
  ['F2', 'C3', 'Ab3'],
  ['F2', 'C3', 'Ab3'],
  ['G2', 'D3', 'B3'],
  ['G2', 'D3', 'B3'],
];
const TITLE_BELLS: readonly Line[] = [
  [
    [0, 'G4', 4],
    [4, 'C5', 4],
    [8, 'Eb5', 6],
    [14, 'D5', 2],
  ],
  [[0, 'C5', 12]],
  [
    [0, 'Ab4', 4],
    [4, 'C5', 4],
    [8, 'Eb5', 4],
    [12, 'F5', 4],
  ],
  [[0, 'Eb5', 12]],
  [
    [0, 'F5', 4],
    [4, 'Eb5', 4],
    [8, 'D5', 4],
    [12, 'C5', 4],
  ],
  [[0, 'Ab4', 12]],
  [
    [0, 'G4', 4],
    [4, 'B4', 4],
    [8, 'D5', 4],
    [12, 'F5', 4],
  ],
  [
    [0, 'D5', 8],
    [8, 'B4', 8],
  ],
];

const title: Track = {
  id: 'title',
  bpm: 72,
  bars: 8,
  loop: true,
  scale: [0, 2, 3, 5, 7, 8, 10, 11],
  bar(i) {
    const c = TITLE_CHORDS[i % 8];
    return [
      ...chord('choir', c.slice(1), 0, 16, 0.55),
      { inst: 'bass', step: 0, midi: midi(c[0]) - 12, len: 8, vel: 0.5 },
      { inst: 'bass', step: 8, midi: midi(c[1]) - 12, len: 8, vel: 0.4 },
      ...line('bell', TITLE_BELLS[i % 8], 0.55),
      ...(i % 2 === 0 ? hits('taiko', [0], 0.35) : []),
    ];
  },
};

// ------------------------------------------------------------ Hueco Mundo

/** "White Moon": Hueco Mundo. D Phrygian, eerie and sparse: a heartbeat kick, a cold bell over a slow pad. */
const HUECO_CHORDS: readonly (readonly string[])[] = [
  ['D3', 'A3', 'F4'],
  ['D3', 'A3', 'F4'],
  ['Eb3', 'Bb3', 'G4'],
  ['D3', 'A3', 'F4'],
  ['Bb2', 'F3', 'D4'],
  ['C3', 'G3', 'E4'],
  ['D3', 'A3', 'F4'],
  ['A2', 'E3', 'C#4'],
];
const HUECO_BELLS: readonly Line[] = [
  [
    [0, 'A5', 6],
    [8, 'D6', 8],
  ],
  [
    [4, 'C6', 4],
    [8, 'Bb5', 8],
  ],
  [
    [0, 'G5', 6],
    [8, 'Eb6', 8],
  ],
  [
    [4, 'D6', 4],
    [8, 'A5', 8],
  ],
  [
    [0, 'F5', 6],
    [8, 'Bb5', 8],
  ],
  [
    [4, 'C6', 4],
    [8, 'G5', 8],
  ],
  [
    [0, 'A5', 4],
    [4, 'F5', 4],
    [8, 'D5', 8],
  ],
  [
    [0, 'E5', 6],
    [8, 'C#6', 8],
  ],
];

const hueco: Track = {
  id: 'hueco',
  bpm: 88,
  bars: 8,
  loop: true,
  scale: [2, 3, 5, 7, 9, 10, 0, 4, 1],
  bar(i) {
    const c = HUECO_CHORDS[i % 8];
    return [
      ...chord('pad', c, 0, 16, 0.4),
      { inst: 'bass', step: 0, midi: midi(c[0]) - 12, len: 5, vel: 0.55 },
      { inst: 'bass', step: 6, midi: midi(c[0]) - 12, len: 3, vel: 0.4 },
      { inst: 'bass', step: 10, midi: midi(c[1]) - 12, len: 5, vel: 0.45 },
      ...hits('kick', [0, 10], 0.55),
      ...hits('hat', [2, 6, 10, 14], 0.3),
      ...(i % 2 === 1 ? hits('snare', [12], 0.3) : []),
      ...line('bell', HUECO_BELLS[i % 8], 0.5),
    ];
  },
};

// -------------------------------------------------------------- Seireitei

/** "Gotei Thirteen": Seireitei. The Japanese in scale on E, taiko and a breathy flute over an open-fifth drone. */
const SEI_DRONES: readonly (readonly string[])[] = [
  ['E3', 'B3'],
  ['E3', 'B3'],
  ['E3', 'B3'],
  ['E3', 'B3'],
  ['A2', 'E3'],
  ['A2', 'E3'],
  ['F2', 'C3'],
  ['E3', 'B3'],
];
const SEI_FLUTE: readonly Line[] = [
  [
    [0, 'E5', 8],
    [8, 'F5', 4],
    [12, 'A5', 4],
  ],
  [
    [0, 'B5', 12],
    [12, 'A5', 4],
  ],
  [
    [0, 'C6', 6],
    [6, 'B5', 2],
    [8, 'A5', 8],
  ],
  [
    [0, 'F5', 4],
    [4, 'E5', 12],
  ],
  [
    [0, 'A5', 8],
    [8, 'B5', 4],
    [12, 'C6', 4],
  ],
  [
    [0, 'E6', 12],
    [12, 'C6', 4],
  ],
  [
    [0, 'B5', 4],
    [4, 'A5', 4],
    [8, 'F5', 4],
    [12, 'E5', 4],
  ],
  [[0, 'E5', 16]],
];

const seireitei: Track = {
  id: 'seireitei',
  bpm: 104,
  bars: 8,
  loop: true,
  scale: [4, 5, 9, 11, 0],
  bar(i) {
    const d = SEI_DRONES[i % 8];
    const fill = i % 4 === 3;
    return [
      ...chord('pad', d, 0, 16, 0.38),
      { inst: 'bass', step: 0, midi: midi(d[0]) - 12, len: 7, vel: 0.55 },
      { inst: 'bass', step: 8, midi: midi(d[1]) - 12, len: 7, vel: 0.45 },
      ...hits('taiko', fill ? [0, 6, 8, 12, 13, 14, 15] : [0, 6, 8, 11, 12], 0.6, [0, 8]),
      ...hits('hat', [0, 2, 4, 6, 8, 10, 12, 14], 0.18, [4, 12]),
      ...line('flute', SEI_FLUTE[i % 8], 0.6),
    ];
  },
};

// ------------------------------------------------------------- silbern

/**
 * "Silbern": the Wandenreich's city over the Seireitei. D minor and martial:
 * a snare that marches, brass stabs on the off-beats, a choir under it all and
 * a lead like a call to arms.
 */
const SIL_CHORDS: readonly (readonly string[])[] = [
  ['D3', 'F3', 'A3'],
  ['A#2', 'D3', 'F3'],
  ['C3', 'E3', 'G3'],
  ['A2', 'C3', 'E3'],
  ['D3', 'F3', 'A3'],
  ['G2', 'A#2', 'D3'],
  ['A#2', 'D3', 'F3'],
  ['A2', 'C3', 'E3'],
];
const SIL_LEAD: readonly Line[] = [
  [
    [0, 'D5', 4],
    [4, 'F5', 2],
    [6, 'E5', 2],
    [8, 'D5', 4],
    [12, 'A4', 4],
  ],
  [
    [0, 'A#4', 4],
    [4, 'D5', 2],
    [6, 'F5', 2],
    [8, 'A5', 6],
    [14, 'G5', 2],
  ],
  [
    [0, 'G5', 4],
    [4, 'E5', 2],
    [6, 'C5', 2],
    [8, 'E5', 4],
    [12, 'G5', 4],
  ],
  [
    [0, 'A5', 8],
    [8, 'G5', 2],
    [10, 'F5', 2],
    [12, 'E5', 4],
  ],
  [
    [0, 'D5', 2],
    [2, 'D5', 2],
    [4, 'F5', 4],
    [8, 'A5', 4],
    [12, 'D6', 4],
  ],
  [
    [0, 'C6', 4],
    [4, 'A#5', 4],
    [8, 'A5', 4],
    [12, 'G5', 4],
  ],
  [
    [0, 'F5', 4],
    [4, 'A#5', 4],
    [8, 'A5', 2],
    [10, 'G5', 2],
    [12, 'F5', 4],
  ],
  [
    [0, 'E5', 8],
    [8, 'A4', 4],
    [12, 'D5', 4],
  ],
];

const silbern: Track = {
  id: 'silbern',
  bpm: 108,
  bars: 8,
  loop: true,
  scale: [2, 4, 5, 7, 9, 10, 0],
  bar(i) {
    const c = SIL_CHORDS[i % 8];
    const roll = i % 4 === 3;
    return [
      ...chord('pad', c, 0, 16, 0.3),
      ...chord('choir', c, 0, 16, 0.2),
      { inst: 'bass', step: 0, midi: midi(c[0]) - 12, len: 6, vel: 0.5 },
      { inst: 'bass', step: 8, midi: midi(c[0]) - 12, len: 6, vel: 0.45 },
      ...hits('kick', [0, 8], 0.4),
      ...hits('snare', roll ? [4, 12, 13, 14, 15] : [4, 12], 0.35, [4, 12]),
      ...hits('hat', [2, 6, 10, 14], 0.14),
      ...chord('stab', c, 2, 2, 0.22),
      ...chord('stab', c, 10, 2, 0.22),
      ...line('lead', SIL_LEAD[i % 8], 0.42),
    ];
  },
};

// ------------------------------------------------------------- the palace

/**
 * "Above the Clouds": the Soul King Palace. D major pentatonic, unhurried:
 * harp-like bells in broken chords over choir and pads, a soft pulse, a
 * flute that answers every other bar.
 */
const PAL_CHORDS: readonly (readonly string[])[] = [
  ['D3', 'F#3', 'A3'],
  ['B2', 'D3', 'F#3'],
  ['G2', 'B2', 'D3'],
  ['A2', 'C#3', 'E3'],
  ['D3', 'F#3', 'A3'],
  ['B2', 'D3', 'F#3'],
  ['E3', 'G3', 'B3'],
  ['A2', 'D3', 'E3'],
];
const PAL_BELLS: readonly Line[] = [
  [
    [0, 'D5', 2],
    [2, 'F#5', 2],
    [4, 'A5', 2],
    [6, 'B5', 2],
    [8, 'A5', 2],
    [10, 'F#5', 2],
    [12, 'E5', 4],
  ],
  [
    [0, 'B4', 2],
    [2, 'D5', 2],
    [4, 'F#5', 2],
    [6, 'A5', 2],
    [8, 'B5', 4],
    [12, 'A5', 4],
  ],
  [
    [0, 'D5', 2],
    [2, 'E5', 2],
    [4, 'B4', 2],
    [6, 'D5', 2],
    [8, 'E5', 2],
    [10, 'F#5', 2],
    [12, 'A5', 4],
  ],
  [
    [0, 'E5', 2],
    [2, 'A5', 2],
    [4, 'E6', 4],
    [8, 'D6', 2],
    [10, 'B5', 2],
    [12, 'A5', 4],
  ],
  [
    [0, 'F#5', 2],
    [2, 'A5', 2],
    [4, 'D6', 2],
    [6, 'E6', 2],
    [8, 'D6', 2],
    [10, 'A5', 2],
    [12, 'F#5', 4],
  ],
  [
    [0, 'D5', 2],
    [2, 'F#5', 2],
    [4, 'B5', 4],
    [8, 'A5', 2],
    [10, 'F#5', 2],
    [12, 'D5', 4],
  ],
  [
    [0, 'E5', 2],
    [2, 'B5', 2],
    [4, 'E6', 2],
    [6, 'B5', 2],
    [8, 'A5', 4],
    [12, 'E5', 4],
  ],
  [
    [0, 'A5', 4],
    [4, 'E5', 4],
    [8, 'D6', 8],
  ],
];
const PAL_FLUTE: readonly Line[] = [
  [
    [0, 'A5', 6],
    [6, 'B5', 2],
    [8, 'D6', 8],
  ],
  [
    [0, 'E6', 4],
    [4, 'D6', 4],
    [8, 'A5', 8],
  ],
  [
    [0, 'F#5', 6],
    [6, 'A5', 2],
    [8, 'B5', 8],
  ],
  [
    [0, 'A5', 8],
    [8, 'D6', 8],
  ],
];

const palace: Track = {
  id: 'palace',
  bpm: 92,
  bars: 8,
  loop: true,
  scale: [2, 4, 6, 9, 11],
  bar(i) {
    const c = PAL_CHORDS[i % 8];
    return [
      ...chord('pad', c, 0, 16, 0.32),
      ...chord('choir', c, 0, 16, 0.22),
      { inst: 'bass', step: 0, midi: midi(c[0]) - 12, len: 14, vel: 0.4 },
      ...hits('kick', [0, 8], 0.3),
      ...hits('hat', [4, 12], 0.12),
      ...line('bell', PAL_BELLS[i % 8], 0.42),
      ...(i % 2 === 1 ? line('flute', PAL_FLUTE[(i >> 1) % 4], 0.45) : []),
    ];
  },
};

// ------------------------------------------------------------- wahrwelt

/**
 * "Wahrwelt": the world the Emperor made from the Soul King's palace. B minor,
 * slow and heavy: a choir that never stops, taiko like a heartbeat, deep bells,
 * and a lead that climbs and falls back.
 */
const WAHR_CHORDS: readonly (readonly string[])[] = [
  ['B2', 'D3', 'F#3'],
  ['G2', 'B2', 'D3'],
  ['E2', 'G2', 'B2'],
  ['F#2', 'A2', 'C#3'],
  ['B2', 'D3', 'F#3'],
  ['D3', 'F#3', 'A3'],
  ['G2', 'B2', 'D3'],
  ['F#2', 'A2', 'C#3'],
];
const WAHR_LEAD: readonly Line[] = [
  [
    [0, 'B4', 6],
    [6, 'C#5', 2],
    [8, 'D5', 8],
  ],
  [
    [0, 'F#5', 6],
    [6, 'E5', 2],
    [8, 'D5', 8],
  ],
  [
    [0, 'E5', 4],
    [4, 'G5', 4],
    [8, 'F#5', 4],
    [12, 'E5', 4],
  ],
  [[0, 'C#5', 16]],
  [
    [0, 'B4', 4],
    [4, 'D5', 4],
    [8, 'F#5', 4],
    [12, 'B5', 4],
  ],
  [
    [0, 'A5', 8],
    [8, 'F#5', 8],
  ],
  [
    [0, 'G5', 4],
    [4, 'F#5', 4],
    [8, 'E5', 4],
    [12, 'D5', 4],
  ],
  [[0, 'C#5', 16]],
];

const wahrwelt: Track = {
  id: 'wahrwelt',
  bpm: 76,
  bars: 8,
  loop: true,
  scale: [11, 1, 2, 4, 6, 7, 9],
  bar(i) {
    const c = WAHR_CHORDS[i % 8];
    return [
      ...chord('pad', c, 0, 16, 0.36),
      ...chord('choir', c, 0, 16, 0.3),
      { inst: 'bass', step: 0, midi: midi(c[0]) - 12, len: 16, vel: 0.5 },
      ...hits('taiko', i % 2 === 1 ? [0, 3, 8, 11] : [0, 8], 0.55, [0]),
      { inst: 'bell', step: 0, midi: midi(c[0]) + 12, len: 8, vel: 0.3 },
      ...line('lead', WAHR_LEAD[i % 8], 0.4),
    ];
  },
};

// ------------------------------------------------------------- las noches

/**
 * "Las Noches": Aizen's white palace under its painted sky. A minor with the
 * raised seventh of the Arrancar's Spanish airs: a guitar's arpeggios over
 * the falling A, G, F, E of the cadence, palmas, a dry box drum and a lead
 * that leans on the semitone above E.
 */
const LN_CHORDS: readonly (readonly string[])[] = [
  ['A2', 'E3', 'A3', 'C4'],
  ['G2', 'D3', 'G3', 'B3'],
  ['F2', 'C3', 'F3', 'A3'],
  ['E2', 'B2', 'E3', 'G#3'],
  ['A2', 'E3', 'A3', 'C4'],
  ['G2', 'D3', 'G3', 'B3'],
  ['F2', 'C3', 'F3', 'A3'],
  ['E2', 'B2', 'E3', 'G#3'],
];
const LN_LEAD: readonly Line[] = [
  [
    [0, 'E5', 4],
    [4, 'F5', 2],
    [6, 'E5', 2],
    [8, 'D5', 4],
    [12, 'C5', 4],
  ],
  [
    [0, 'D5', 4],
    [4, 'C5', 2],
    [6, 'B4', 2],
    [8, 'C5', 8],
  ],
  [
    [0, 'C5', 4],
    [4, 'B4', 2],
    [6, 'A4', 2],
    [8, 'B4', 4],
    [12, 'C5', 4],
  ],
  [
    [0, 'B4', 6],
    [6, 'G#4', 2],
    [8, 'A4', 8],
  ],
  [
    [0, 'A5', 4],
    [4, 'G5', 2],
    [6, 'F5', 2],
    [8, 'E5', 8],
  ],
  [
    [0, 'F5', 4],
    [4, 'E5', 2],
    [6, 'D5', 2],
    [8, 'E5', 8],
  ],
  [
    [0, 'D5', 4],
    [4, 'C5', 4],
    [8, 'B4', 4],
    [12, 'A4', 4],
  ],
  [
    [0, 'G#4', 8],
    [8, 'B4', 4],
    [12, 'E5', 4],
  ],
];

const lasnoches: Track = {
  id: 'lasnoches',
  bpm: 96,
  bars: 8,
  loop: true,
  scale: [9, 11, 0, 2, 4, 5, 7, 8],
  bar(i) {
    const c = LN_CHORDS[i % 8];
    const cadence = i % 4 === 3;
    // The guitar: arpeggios up and down the chord, and on the E chord a strum.
    const order = [0, 1, 2, 3, 2, 1, 2, 3];
    const guitar: NoteEvent[] = cadence
      ? [0, 1, 2, 3].map((k) => ({ inst: 'pluck' as const, step: k, midi: midi(c[k]) + 12, len: 8, vel: 0.5 }))
      : order.map((k, n) => ({ inst: 'pluck' as const, step: n * 2, midi: midi(c[k]) + 12, len: 3, vel: n % 4 === 0 ? 0.48 : 0.36 }));
    return [
      ...chord('pad', c.slice(1), 0, 16, 0.22),
      { inst: 'bass', step: 0, midi: midi(c[0]), len: 6, vel: 0.42 },
      { inst: 'bass', step: 8, midi: midi(c[0]), len: 6, vel: 0.36 },
      ...guitar,
      ...hits('clap', cadence ? [0, 3, 6, 8, 10, 12, 14] : [4, 10, 12], 0.32, [12]),
      ...hits('kick', [0, 7, 10], 0.24),
      ...hits('hat', [2, 6, 10, 14], 0.08),
      ...(i % 2 === 1 || i >= 4 ? line('lead', LN_LEAD[i % 8], 0.34) : []),
    ];
  },
};

// --------------------------------------------------------------- karakura

/**
 * "Karakura": the world of the living, and it sounds like it: E minor rock,
 * a backbeat on the kick and snare, eighth-note bass, power chords and a
 * lead that keeps climbing.
 */
const KK_ROOTS: readonly string[] = ['E2', 'C3', 'D3', 'B2', 'E2', 'C3', 'G2', 'D3'];
const KK_LEAD: readonly Line[] = [
  [
    [0, 'E5', 2],
    [2, 'G5', 2],
    [4, 'B5', 4],
    [8, 'A5', 2],
    [10, 'G5', 2],
    [12, 'E5', 4],
  ],
  [
    [0, 'E5', 2],
    [2, 'G5', 2],
    [4, 'A5', 4],
    [8, 'G5', 4],
    [12, 'C6', 4],
  ],
  [
    [0, 'D6', 4],
    [4, 'B5', 2],
    [6, 'A5', 2],
    [8, 'F#5', 8],
  ],
  [
    [0, 'B5', 4],
    [4, 'A5', 4],
    [8, 'F#5', 4],
    [12, 'D#5', 4],
  ],
  [
    [0, 'E5', 2],
    [2, 'G5', 2],
    [4, 'B5', 4],
    [8, 'D6', 4],
    [12, 'E6', 4],
  ],
  [
    [0, 'E6', 4],
    [4, 'D6', 2],
    [6, 'C6', 2],
    [8, 'B5', 8],
  ],
  [
    [0, 'G5', 4],
    [4, 'A5', 4],
    [8, 'B5', 4],
    [12, 'D6', 4],
  ],
  [
    [0, 'F#5', 8],
    [8, 'A5', 4],
    [12, 'B5', 4],
  ],
];

const karakura: Track = {
  id: 'karakura',
  bpm: 138,
  bars: 8,
  loop: true,
  scale: [4, 6, 7, 9, 11, 0, 2, 3],
  bar(i) {
    const root = midi(KK_ROOTS[i % 8]);
    const power = [root + 12, root + 19, root + 24];
    return [
      ...power.map((m) => ({ inst: 'stab' as const, step: 0, midi: m, len: 6, vel: 0.5 })),
      ...power.map((m) => ({ inst: 'stab' as const, step: 8, midi: m, len: 6, vel: 0.42 })),
      ...[0, 2, 4, 6, 8, 10, 12, 14].map((step) => ({ inst: 'bass' as const, step, midi: root, len: 2, vel: step % 4 === 0 ? 0.5 : 0.38 })),
      ...hits('kick', [0, 6, 8, 10], 0.5, [0, 8]),
      ...hits('snare', [4, 12], 0.5),
      ...hits('hat', [0, 2, 4, 6, 8, 10, 12, 14], 0.12, [4, 12]),
      ...line('lead', KK_LEAD[i % 8], 0.36),
    ];
  },
};

// ------------------------------------------------------------------ bosses

/** "Medallion": the boss theme. A minor, driving: an eighth-note bass, brass stabs, choir and a fast lead. */
const BOSS_CHORDS: readonly (readonly string[])[] = [
  ['A3', 'C4', 'E4'],
  ['F3', 'A3', 'C4'],
  ['D3', 'F3', 'A3'],
  ['E3', 'G#3', 'B3'],
];
const BOSS_LEAD: readonly Line[] = [
  [
    [0, 'A4', 2],
    [2, 'C5', 2],
    [4, 'E5', 2],
    [6, 'A5', 4],
    [10, 'G#5', 2],
    [12, 'E5', 4],
  ],
  [
    [0, 'F5', 2],
    [2, 'E5', 2],
    [4, 'F5', 2],
    [6, 'A5', 4],
    [10, 'C6', 2],
    [12, 'A5', 4],
  ],
  [
    [0, 'D5', 2],
    [2, 'F5', 2],
    [4, 'A5', 2],
    [6, 'D6', 4],
    [10, 'C6', 2],
    [12, 'A5', 4],
  ],
  [
    [0, 'B5', 4],
    [4, 'G#5', 4],
    [8, 'E5', 4],
    [12, 'B4', 4],
  ],
];

function bossBar(i: number, opts: { taiko: boolean; flute: boolean; final: boolean }): NoteEvent[] {
  const c = BOSS_CHORDS[i % 4];
  const root = midi(c[0]) - 12;
  const bass: NoteEvent[] = [];
  for (let s = 0; s < 16; s += 2) bass.push({ inst: 'bass', step: s, midi: s % 4 === 2 ? root + 12 : root, len: 2, vel: 0.5 });
  const lead = line(opts.flute ? 'flute' : 'lead', BOSS_LEAD[i % 4], opts.flute ? 0.6 : 0.55);
  // The second time round, the lead climbs an octave.
  if (i % 8 >= 4) for (const n of lead) n.midi += 12;
  return [
    ...chord('choir', c, 0, 16, opts.final ? 0.45 : 0.3),
    ...bass,
    ...[0, 3, 6, 10].flatMap((s) => chord('stab', c, s, 2, 0.45)),
    ...hits('kick', [0, 4, 8, 12], 0.7),
    ...hits('snare', opts.final && i % 4 === 3 ? [4, 12, 13, 14, 15] : [4, 12], 0.45),
    ...hits('hat', [2, 6, 10, 14], 0.3),
    ...(opts.taiko ? hits('taiko', [0, 7, 8], 0.5, [0]) : []),
    ...lead,
  ];
}

const AMINOR = [9, 11, 0, 2, 4, 5, 8];

const boss: Track = { id: 'boss', bpm: 136, bars: 8, loop: true, scale: AMINOR, bar: (i) => bossBar(i, { taiko: false, flute: false, final: false }) };
const bossSei: Track = { id: 'bossSei', bpm: 136, bars: 8, loop: true, scale: AMINOR, bar: (i) => bossBar(i, { taiko: true, flute: true, final: false }) };
const finale: Track = { id: 'final', bpm: 144, bars: 8, loop: true, scale: AMINOR, bar: (i) => bossBar(i, { taiko: true, flute: false, final: true }) };

/** The boss theme a fourth higher, in D minor, with bells ringing the chord high above it: the Royal Guard. */
const DMINOR = AMINOR.map((p) => (p + 5) % 12);
function bossPalaceBar(i: number): NoteEvent[] {
  const bar = bossBar(i, { taiko: false, flute: false, final: false }).map((e) => (e.midi > 0 ? { ...e, midi: e.midi + 5 } : e));
  const root = midi(BOSS_CHORDS[i % 4][0]) + 5 + 24;
  for (const [k, step] of [2, 6, 10, 14].entries()) bar.push({ inst: 'bell', step, midi: k % 2 ? root + 7 : root, len: 2, vel: 0.35 });
  return bar;
}
const bossPalace: Track = { id: 'bossPalace', bpm: 140, bars: 8, loop: true, scale: DMINOR, bar: bossPalaceBar };

// ---------------------------------------------------------------- stingers

const victory: Track = {
  id: 'victory',
  bpm: 96,
  bars: 2,
  loop: false,
  scale: [0, 4, 7, 2, 11],
  bar(i) {
    if (i === 0) {
      return [
        ...chord('choir', ['C4', 'E4', 'G4'], 0, 16, 0.5),
        { inst: 'bass', step: 0, midi: midi('C2'), len: 16, vel: 0.5 },
        ...line('bell', [
          [0, 'G5', 2],
          [2, 'C6', 2],
          [4, 'E6', 4],
          [8, 'D6', 2],
          [10, 'E6', 2],
          [12, 'G6', 4],
        ], 0.6),
        ...hits('taiko', [0, 8], 0.5),
      ];
    }
    return [...chord('choir', ['C4', 'G4', 'C5', 'E5'], 0, 16, 0.5), { inst: 'bell', step: 0, midi: midi('C6'), len: 16, vel: 0.6 }];
  },
};

const defeat: Track = {
  id: 'defeat',
  bpm: 70,
  bars: 2,
  loop: false,
  scale: [9, 0, 4, 5, 2],
  bar(i) {
    if (i === 0) {
      return [
        ...chord('pad', ['A2', 'E3', 'C4'], 0, 16, 0.75),
        ...chord('choir', ['A3', 'E4'], 0, 16, 0.5),
        ...line('bell', [
          [0, 'E5', 4],
          [4, 'C5', 4],
          [8, 'A4', 8],
        ], 0.8),
        ...hits('taiko', [0], 0.45),
      ];
    }
    return [...chord('pad', ['F2', 'C3', 'A3'], 0, 12, 0.7), { inst: 'bell', step: 0, midi: midi('A4'), len: 12, vel: 0.75 }];
  },
};

export const TRACKS: Readonly<Record<TrackId, Track>> = {
  title,
  hueco,
  seireitei,
  lasnoches,
  silbern,
  palace,
  wahrwelt,
  karakura,
  boss,
  bossSei,
  bossPalace,
  final: finale,
  victory,
  defeat,
};

/** Melodic instruments, whose notes the tests hold to each track's scale. */
export const MELODIC: ReadonlySet<Inst> = new Set<Inst>(['lead', 'flute', 'bell', 'pluck']);
