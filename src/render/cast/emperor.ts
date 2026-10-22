import {
  disc,
  type Draw,
  eyes,
  fig,
  head,
  hp,
  INK,
  limb,
  type Pt,
  ribbon,
  shape,
  SKIN,
  SKIN_SHADE,
  star,
  stroke,
} from './kit';

/**
 * The Emperor, after Yhwach as the manga draws him in the war: tall, long
 * black hair falling in waves past his shoulders, a heavy moustache under
 * stern brows, red eyes, the tall pointed collar standing up beside his head,
 * a long coat with the star at his chest, and a cape (drawn on its own so it
 * can trail as he moves). One look per Wardrobe colourway.
 */

/** The colours of one of the Emperor's looks. */
export interface HeroLook {
  cape: string;
  coat: string;
  /** The coat's shadow side. */
  shade: string;
  trim: string;
  star: string;
  sleeve: string;
  cuff: string;
  collar: string;
  lining: string;
}

/** Every look the Emperor can wear (see data/looks.ts): three from feats, five bought in the Wardrobe. */
export const HERO_LOOKS: Readonly<Record<string, HeroLook>> = {
  default: { cape: '#0b0a10', coat: '#262833', shade: '#0b0a10', trim: '#c9cdd8', star: '#eef2fa', sleeve: '#16171e', cuff: '#d9d2c4', collar: '#101117', lining: '#8a1e2c' },
  // Wandenreich White: the knights' white uniform, lined in black, a blue star.
  white: { cape: '#e9ecf3', coat: '#f6f6f2', shade: '#b8bdc9', trim: '#1a1c26', star: '#59b8ff', sleeve: '#e3e7ef', cuff: '#1a1c26', collar: '#f4f6fa', lining: '#1a1c26' },
  crimson: { cape: '#3a0a12', coat: '#7a1a28', shade: '#3a0a12', trim: '#f0c8c8', star: '#ffd6d6', sleeve: '#4a0e18', cuff: '#d9c4c4', collar: '#2a0810', lining: '#0b0b11' },
  gilded: { cape: '#0b0a10', coat: '#262833', shade: '#0b0a10', trim: '#e8c060', star: '#ffd25a', sleeve: '#16171e', cuff: '#e8c870', collar: '#101117', lining: '#c9a040' },
  // Schatten: the shadow realm the Wandenreich hid in. Violet-black, a violet star.
  schatten: { cape: '#140c22', coat: '#3a2a5a', shade: '#140c22', trim: '#c4a8ff', star: '#ece2ff', sleeve: '#221636', cuff: '#c9b8ff', collar: '#140c22', lining: '#5a2a9a' },
  // Blut: black, the trim running red like the veins of Blut Arterie.
  blut: { cape: '#0b0709', coat: '#2c1418', shade: '#0b0709', trim: '#ff3d5e', star: '#ffd0d8', sleeve: '#1a0c10', cuff: '#ff5a70', collar: '#120a0c', lining: '#b0142e' },
  // Silbern: the silver of the Wandenreich's capital, trimmed in ice blue.
  silbern: { cape: '#b4bccb', coat: '#eef2f8', shade: '#9aa4b6', trim: '#3c78c8', star: '#bfe6ff', sleeve: '#d8dee8', cuff: '#4a7ab8', collar: '#e4e9f1', lining: '#3a6ab0' },
  // Heilig: holy white and gold.
  heilig: { cape: '#ece6d2', coat: '#fffdf6', shade: '#cfc4a4', trim: '#c9a040', star: '#ffd25a', sleeve: '#f2ecdc', cuff: '#c9a040', collar: '#faf6ea', lining: '#c9a040' },
  // Kaiser: a black coat under a royal purple cape, gold at every edge.
  kaiser: { cape: '#2c1040', coat: '#26262e', shade: '#0b0a10', trim: '#e8c060', star: '#ffd25a', sleeve: '#16171e', cuff: '#e8c870', collar: '#101117', lining: '#7a3aaa' },
  // The Almighty: black on black, lined in blood, the star itself red; won in the Gauntlet.
  almighty: { cape: '#0b0a10', coat: '#16141c', shade: '#0b0a10', trim: '#c8102e', star: '#ff3050', sleeve: '#0e0c12', cuff: '#c8102e', collar: '#0b0a10', lining: '#c8102e' },
};

/** The look ids the atlas draws. */
export const HERO_LOOK_IDS: readonly string[] = Object.keys(HERO_LOOKS);

/** The cape hangs from his shoulders here (fractions of the sprite box): the renderer turns it about this point. */
export const CAPE_PIVOT = { x: 0.5, y: 0.27 } as const;

const HAIR = '#0b0a0f';
/** The light on black hair: one tone up from ink. */
const STRAND = '#3b3a46';
const C: Pt = [0, 14];

/** The cape on its own: shoulders to ankles, the lining showing along the hem, folds falling from the shoulders. */
export function heroCape(look: HeroLook): Draw {
  return fig((g, cx) => {
    shape(g, [
      [cx - 11, 26],
      [cx + 11, 26],
      [cx + 23, 58],
      [cx + 30, 95],
      [cx + 10, 91],
      [cx, 96],
      [cx - 10, 91],
      [cx - 30, 95],
      [cx - 23, 58],
    ], look.lining, INK, 1.4);
    shape(g, [
      [cx - 11, 26],
      [cx + 11, 26],
      [cx + 22, 58],
      [cx + 27, 91],
      [cx + 10, 87.5],
      [cx, 92],
      [cx - 10, 87.5],
      [cx - 27, 91],
      [cx - 22, 58],
    ], look.cape);
    for (const d of [-1, 1]) {
      stroke(g, [[cx + d * 8, 34], [cx + d * 14, 62], [cx + d * 16, 88]], 1.3, look.lining);
      stroke(g, [[cx + d * 15, 42], [cx + d * 21.5, 70], [cx + d * 24, 89]], 1.1, look.lining);
    }
  });
}

/** Head scale: he is small on screen, so his face is drawn a little larger than the kit's. */
const K = 1.14;

/** Everything but the cape; `stride` draws him mid-step, legs apart. */
export function heroBody(look: HeroLook, stride = false): Draw {
  return fig((g, cx) => {
    const c: Pt = [cx, C[1]];
    // Hair falling behind the shoulders, in long waves, strands catching the light.
    shape(g, hp(c, [[-1.3, -0.5], [1.3, -0.5], [1.5, 1.2], [1.95, 2.1], [1.55, 3.1], [1.85, 4.1], [1.1, 3.6], [0.7, 2.4], [-0.7, 2.4], [-1.1, 3.6], [-1.85, 4.1], [-1.55, 3.1], [-1.95, 2.1], [-1.5, 1.2]], K), HAIR);
    for (const d of [-1, 1]) stroke(g, hp(c, [[d * 1.25, 0.6], [d * 1.6, 1.9], [d * 1.35, 3], [d * 1.6, 3.8]], K), 1, STRAND);
    // Boots under the long coat.
    for (const d of [-1, 1]) {
      const fx = cx + d * (stride ? (d > 0 ? 15 : 13) : 9);
      const fy = stride && d > 0 ? -2 : 0;
      limb(g, [cx + d * 4.5, 64], [fx, 93 + fy], 7, 6, INK);
      shape(g, [[fx - 3.8, 90 + fy], [fx + 3.8, 90 + fy], [fx + 4 + d * 1.4, 97 + fy], [fx - 4 + d * 0.4, 97 + fy]], INK);
    }
    // The coat, long, split up the front from the knee.
    shape(g, [
      [cx - 12, 27],
      [cx + 12, 27],
      [cx + 15, 50],
      [cx + 19, 86],
      [cx + 3, 88],
      [cx + 0.5, 66],
      [cx - 2.5, 88],
      [cx - 19, 86],
      [cx - 15, 50],
    ], look.coat, INK, 1.3);
    // Its shadow side, cut hard.
    shape(g, [[cx - 12, 27], [cx - 6, 28], [cx - 7.5, 86.8], [cx - 19, 86], [cx - 15, 50]], look.shade);
    stroke(g, [[cx - 17.5, 83], [cx - 3, 85]], 1.4, look.trim);
    stroke(g, [[cx + 3.4, 85], [cx + 17.8, 83]], 1.4, look.trim);
    stroke(g, [[cx + 0.4, 30], [cx + 0.4, 66]], 1.1, look.trim);
    // Belt.
    shape(g, [[cx - 14.6, 45], [cx + 14.6, 45], [cx + 14.8, 48.8], [cx - 14.8, 48.8]], INK);
    shape(g, [[cx - 1.8, 44.6], [cx + 2.4, 44.6], [cx + 2.4, 49.2], [cx - 1.8, 49.2]], look.trim);
    // The star at his chest.
    star(g, cx + 0.4, 35.5, 4.2, look.star, 0.4);
    // Sleeves held a little out from the coat, pale cuffs, his hands.
    for (const d of [-1, 1]) {
      const sh: Pt = [cx + d * 12, 29.5];
      const el: Pt = [cx + d * 17.5, 43];
      const wr: Pt = [cx + d * 19, 53];
      limb(g, sh, el, 7, 6.2, look.sleeve);
      limb(g, el, wr, 6.2, 5.8, look.sleeve);
      stroke(g, [[sh[0] + d * 0.6, sh[1] + 3], [el[0] - d * 0.6, el[1]]], 0.9, look.shade === look.sleeve ? STRAND : look.shade);
      shape(g, [[wr[0] - 3, wr[1] - 1], [wr[0] + 3, wr[1] - 1], [wr[0] + 3, wr[1] + 2], [wr[0] - 3, wr[1] + 2]], look.cuff);
      disc(g, wr[0], wr[1] + 4.2, 2.6, SKIN);
    }
    // The tall collar: pointed flaps standing up beside the head, lining facing out.
    for (const d of [-1, 1]) {
      shape(g, [[cx + d * 4.5, 27], [cx + d * 13.5, 10.5], [cx + d * 13, 29]], look.collar, INK, 1.1);
      shape(g, [[cx + d * 7.5, 26], [cx + d * 12.8, 13.5], [cx + d * 12, 27.5]], look.lining);
    }
    limb(g, [cx, 19], [cx, 26], 5.2, 5.8, SKIN);
    head(g, cx, c[1], { turn: 0.15, jaw: 0.4, skin: SKIN, shade: SKIN_SHADE, w: K, h: K });
    // Stern brows, red eyes.
    eyes(g, cx, c[1] + 1.4, { turn: 0.15, color: '#d01830', brow: HAIR, tilt: 1.6, gap: 3 });
    // The moustache, heavy, its ends sweeping down past the mouth.
    for (const d of [-1, 1]) {
      shape(g, [[cx + 0.2, c[1] + 4.4], [cx + d * 5.2, c[1] + 4.2], [cx + d * 7, c[1] + 9.4], [cx + d * 4.2, c[1] + 6.6], [cx + 0.2, c[1] + 6]], HAIR);
    }
    // The crown of hair, parted at the centre, waves framing the face.
    shape(g, hp(c, [[-1.25, 0.7], [-1.2, -0.55], [-0.55, -1.2], [0.55, -1.2], [1.2, -0.55], [1.25, 0.7], [0.95, 0.05], [0.65, -0.45], [0.08, -0.75], [-0.05, -0.75], [-0.65, -0.45], [-0.95, 0.05]], K), HAIR);
    stroke(g, hp(c, [[-0.2, -1.05], [-0.7, -0.6], [-0.95, 0.2]], K), 0.9, STRAND);
    stroke(g, hp(c, [[0.2, -1.05], [0.7, -0.6], [0.95, 0.2]], K), 0.9, STRAND);
    ribbon(g, hp(c, [[-1.05, 0.1], [-1.35, 0.9], [-1.2, 1.7], [-1.5, 2.4]], K), 3.4, 1.6, HAIR, false);
    ribbon(g, hp(c, [[1.05, 0.1], [1.35, 0.9], [1.2, 1.7], [1.5, 2.4]], K), 3.4, 1.6, HAIR, false);
  });
}

/** Cape and body together, for the DOM portraits. */
export function heroDraw(look: HeroLook): Draw {
  const cape = heroCape(look);
  const body = heroBody(look);
  return (g, w, h) => {
    cape(g, w, h);
    body(g, w, h);
  };
}

/**
 * The Almighty's eyes: once A · The Almighty is his, each eye shows several
 * pupils, as it does in the story. Laid over the body's own eyes.
 */
export const evoPupils: Draw = fig((g, cx) => {
  const y = C[1] + 1.45;
  const x0 = cx + 0.15 * 1.3;
  for (const d of [-1, 1]) {
    const x = x0 + d * 3 * (d === -1 ? 0.85 : 1);
    shape(g, [[x - 2.4, y + 0.3], [x - 0.5, y - 1.1], [x + 2.4, y - 0.3], [x + 0.5, y + 0.9]], '#ff4a64');
    for (const [dx, dy] of [[-0.9, 0.2], [0.9, 0.1], [0, -0.55]] as const) disc(g, x + dx, y + dy, 0.45, '#2a0008');
  }
});

/** Where the cloak's eyes open (tier 2), in the 60 by 72 sprite's pixels, over the cape. */
export const EVO_EYES: readonly (readonly [number, number, number])[] = [
  [17, 34, 0.75],
  [43, 34, 0.75],
  [14, 46, 1],
  [46, 46, 1],
  [12, 57, 0.95],
  [48, 57, 0.95],
  [18, 64, 0.8],
  [42, 64, 0.8],
];
