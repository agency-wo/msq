import {
  along,
  arm,
  blob,
  type Body,
  bodyFrame,
  type Ctx,
  DARK,
  disc,
  eyes,
  fig,
  hakama,
  head,
  hp,
  INK,
  kosode,
  LIGHT,
  limb,
  mouth,
  oval,
  PAPER,
  type Pt,
  ribbon,
  scaled,
  shape,
  sheath,
  SKIN,
  SKIN_SHADE,
  STEEL,
  STEEL_SHADE,
  stroke,
  TAU,
  zigzag,
} from './kit';

/**
 * Hueco Mundo and Las Noches as manga homages: Ayon, Neliel, Tier Harribel,
 * the Privaron Espada and Rudbornn who hold the palace, Grimmjow, and the
 * runaways Pesche and Dondochakka. The Arrancar wear the white of Las Noches
 * with the black sash, and what is left of each one's mask.
 */

const BONE = '#ece6d6';
const BONE_SHADE = '#a99f8b';
const BLOOD_RED = '#c8102e';

function neckHead(g: Ctx, cx: number, o: { turn?: number; y?: number; w?: number; jaw?: number; skin?: string; shade?: string } = {}): Pt {
  const y = o.y ?? 14;
  limb(g, [cx + 0.3, y + 5], [cx, y + 12], 4.6, 5.2, o.skin ?? SKIN);
  head(g, cx, y, { turn: o.turn, w: o.w, jaw: o.jaw, skin: o.skin, shade: o.shade });
  return [cx, y];
}

/** The white of Las Noches: white hakama and jacket, a black sash, dark tabi. */
function whiteUniform(g: Ctx, cx: number, o: { broad?: number; stance?: number; open?: boolean; skin?: string } = {}): Body {
  const B = bodyFrame(cx, { broad: o.broad });
  hakama(g, B, { stance: o.stance ?? 14, hakama: PAPER, tabi: INK });
  kosode(g, B, { kosode: PAPER, obi: INK, collar: INK, open: o.open, skin: o.skin });
  return B;
}

/** A Hollow hole, punched through. */
function hole(g: Ctx, x: number, y: number, r: number): void {
  disc(g, x, y, r, INK);
  disc(g, x - r * 0.2, y - r * 0.2, r * 0.45, DARK);
}

// ------------------------------------------------------------------ Ayon

function ayonBody(g: Ctx, cx: number, rage: boolean): void {
  const FUR = rage ? '#4a2420' : '#3a2a22';
  const MANE = '#a07a40';
  const k = rage ? 1.08 : 1;
  // Sung-Sun's serpent for a tail, curling up behind.
  ribbon(g, [[cx + 18, 74], [cx + 32, 80], [cx + 42, 70], [cx + 44, 56], [cx + 38, 46]], 8, 5, '#5a8a4a');
  shape(g, [[cx + 34, 44], [cx + 44, 40], [cx + 46, 47], [cx + 39, 50]], '#5a8a4a', INK, 1);
  disc(g, cx + 42, 43.5, 0.9, BLOOD_RED);
  // Legs, short and thick.
  for (const d of [-1, 1]) {
    limb(g, [cx + d * 10 * k, 70], [cx + d * 16 * k, 94], 13 * k, 11 * k, FUR);
    for (let j = -1; j <= 1; j++) shape(g, [[cx + d * 16 * k + j * 3.6 - 1.2, 96], [cx + d * 16 * k + j * 3.6 + 1.2, 96], [cx + d * 16 * k + j * 4.6, 100]], BONE, INK, 0.8);
  }
  // The hunched torso.
  blob(g, [[cx - 24 * k, 40], [cx - 14 * k, 26], [cx + 14 * k, 26], [cx + 24 * k, 40], [cx + 20 * k, 66], [cx, 74], [cx - 20 * k, 66]], FUR, INK, 1.6);
  stroke(g, [[cx - 8, 38], [cx - 10, 60]], 1.2, DARK);
  stroke(g, [[cx + 9, 36], [cx + 11, 58]], 1.2, DARK);
  hole(g, cx, 50, 5.5 * k);
  if (rage) {
    // Veins burning red across the swollen body.
    for (const [a, b] of [[[cx - 18, 36], [cx - 6, 56]], [[cx + 16, 34], [cx + 6, 60]], [[cx - 12, 62], [cx + 2, 70]], [[cx + 20, 52], [cx + 12, 66]]] as const) zigzag(g, a, b, Math.round(a[0]), 1.3, BLOOD_RED, 4);
  }
  // Long arms dragging their claws.
  for (const d of [-1, 1]) {
    const sh: Pt = [cx + d * 22 * k, 34];
    const el: Pt = [cx + d * 32 * k, 56];
    const hand: Pt = [cx + d * 30 * k, 80];
    limb(g, sh, el, 11 * k, 9 * k, FUR);
    limb(g, el, hand, 9 * k, 8 * k, FUR);
    for (let j = 0; j < 4; j++) {
      const a = Math.PI / 2 + d * (0.5 - j * 0.32);
      shape(g, [[hand[0] - 1.2, hand[1]], [hand[0] + 1.2, hand[1]], [hand[0] + Math.cos(a) * 11, hand[1] + Math.sin(a) * 11]], BONE, INK, 0.9);
    }
  }
  // Mila Rose's mane round a face that is almost nothing.
  const C: Pt = [cx, 24];
  for (let j = 0; j < 12; j++) {
    const a = (j / 12) * TAU;
    shape(g, [[C[0] + Math.cos(a - 0.3) * 8, C[1] + Math.sin(a - 0.3) * 8], [C[0] + Math.cos(a) * 15, C[1] + Math.sin(a) * 14], [C[0] + Math.cos(a + 0.3) * 8, C[1] + Math.sin(a + 0.3) * 8]], MANE, INK, 1);
  }
  disc(g, C[0], C[1], 9, MANE);
  oval(g, C[0], C[1] + 1, 6.4, 7.6, 0, INK);
  // Apache's antlers.
  for (const d of [-1, 1]) {
    const base: Pt = [C[0] + d * 5, C[1] - 7];
    const tip: Pt = [C[0] + d * 22, C[1] - 22];
    limb(g, base, tip, 3.2, 2, BONE);
    for (const t of [0.35, 0.65]) {
      const p = along(base, tip, t);
      limb(g, p, [p[0] + d * 3, p[1] - 10], 2.2, 1.4, BONE);
    }
  }
  if (rage) {
    // The face split wide open, teeth all down it.
    shape(g, [[C[0] - 2, C[1] - 6], [C[0] + 2, C[1] - 6], [C[0] + 5, C[1] + 8], [C[0], C[1] + 13], [C[0] - 5, C[1] + 8]], '#4a0a16', INK, 1.1);
    for (let j = 0; j < 5; j++) {
      const y = C[1] - 3 + j * 3;
      for (const d of [-1, 1]) shape(g, [[C[0] + d * (2 + j * 0.5), y], [C[0] + d * (2 + j * 0.5), y + 2], [C[0] + d * 0.4, y + 1]], BONE);
    }
  }
  disc(g, C[0] - 2.8, C[1] - 1, 1.3, rage ? '#ffd0c0' : '#f0b030');
  disc(g, C[0] + 2.8, C[1] - 1, 1.3, rage ? '#ffd0c0' : '#f0b030');
}

/** Ayon: the beast Harribel's three Fracción make of their own left arms. Apache's antlers, Mila Rose's mane, Sung-Sun's serpent for a tail, a face that is almost nothing, a hole through its chest. */
export const ayon = fig((g, cx) => ayonBody(g, cx, false));

/** Ayon enraged: swollen, its veins burning red, its face split open down the middle into a mouth of teeth. */
export const ayonRage = fig((g, cx) => ayonBody(g, cx, true));

// ------------------------------------------------------------------ Nel

const NEL_HAIR = '#5ab8a0';

function nelMaskHorns(g: Ctx, C: Pt, big: boolean): void {
  // The ram's skull of her mask, its horns curling down past her ears.
  const k = big ? 1.4 : 1;
  for (const d of [-1, 1]) {
    ribbon(g, [[C[0] + d * 4, C[1] - 8], [C[0] + d * 10 * k, C[1] - 9], [C[0] + d * 13 * k, C[1] - 3], [C[0] + d * 11 * k, C[1] + 3], [C[0] + d * 7.5 * k, C[1] + 2]], 4.4 * k, 2.4, BONE);
  }
  shape(g, hp(C, [[-1.05, -0.6], [-0.7, -1.3], [0, -1.5], [0.7, -1.3], [1.05, -0.6], [0.6, -0.85], [0, -0.95], [-0.6, -0.85]]), BONE, INK, 1);
  stroke(g, hp(C, [[0.2, -1.4], [0.35, -1.0], [0.15, -0.9]]), 0.8);
}

/** Neliel Tu Oderschvank grown again: long sea-green hair, the ram's skull of her mask, the crimson mark across her face, white clothes, her sword at her side. */
export const nel = fig((g, cx) => {
  const C: Pt = [cx, 14];
  shape(g, hp(C, [[-1.2, -0.4], [1.2, -0.4], [1.5, 2.5], [1.7, 4.4], [0.6, 3.6], [-0.6, 3.6], [-1.7, 4.4], [-1.5, 2.5]]), NEL_HAIR, INK, 1);
  const B = whiteUniform(g, cx, { broad: 0.88, stance: 12 });
  sheath(g, [cx + 7, 50], 2.1);
  arm(g, B.sl, [cx - 15, 52], { sleeve: 'tight', color: PAPER, elbow: -2 });
  arm(g, B.sr, [cx + 13, 50], { sleeve: 'tight', color: PAPER, elbow: 3 });
  neckHead(g, cx, { turn: 0.2, y: C[1], w: 0.94 });
  eyes(g, cx, C[1] + 1.3, { turn: 0.2, color: '#5a3a6a', brow: NEL_HAIR, tilt: 0.4 });
  // The crimson mark across her face.
  shape(g, hp(C, [[-0.95, 0.42], [1, 0.38], [1, 0.52], [-0.95, 0.56]]), BLOOD_RED);
  mouth(g, cx, C[1] + 5.4, 'smile', 1.5, 0.2);
  shape(g, hp(C, [[-1.15, 0.5], [-1.1, -0.6], [-0.4, -1.15], [0.5, -1.15], [1.12, -0.6], [1.18, 0.5], [0.85, -0.2], [0.2, -0.5], [-0.05, 0.2], [-0.3, -0.45], [-0.85, -0.2]]), NEL_HAIR, INK, 1);
  nelMaskHorns(g, C, false);
});

/** Neliel released, Gamuza: the centaur form, a white ram's body below the waist, her mask grown into a horned helm, and the double-bladed lance she throws as Lanzador Verde. */
export const nelGamuza = fig((g, cx) => {
  const C: Pt = [cx - 6, 14];
  // The lance, held high across her: a blade at each end.
  g.save();
  g.translate(cx - 2, 30);
  g.rotate(-0.55);
  shape(g, [[-34, -1.1], [34, -1.1], [34, 1.1], [-34, 1.1]], '#6a5a3a', INK, 0.8);
  for (const d of [-1, 1]) shape(g, [[d * 33, -3.4], [d * 46, 0], [d * 33, 3.4], [d * 35, 0]], STEEL, INK, 0.9);
  g.restore();
  // The ram's body: barrel, four legs, black hooves.
  for (const [x, back] of [[cx - 16, 0], [cx - 6, 1], [cx + 18, 0], [cx + 28, 1]] as const) {
    limb(g, [x, 66], [x + (back ? 2 : -1), 92], 6, 4.4, back ? LIGHT : PAPER);
    shape(g, [[x - 3, 92], [x + 3, 92], [x + 3.4, 97], [x - 3.4, 97]], INK);
  }
  blob(g, [[cx - 22, 54], [cx - 6, 48], [cx + 22, 48], [cx + 34, 56], [cx + 32, 70], [cx + 10, 74], [cx - 18, 72]], PAPER, INK, 1.4);
  stroke(g, [[cx - 4, 70], [cx + 26, 68]], 1.1, LIGHT);
  ribbon(g, [[cx + 32, 54], [cx + 40, 60], [cx + 42, 70]], 5, 2, NEL_HAIR);
  // Her upper body rising from the ram's shoulders.
  shape(g, [[cx - 14, 26], [cx + 2, 26], [cx + 3, 52], [cx - 15, 52]], PAPER, INK, 1.2);
  shape(g, [[cx - 14, 26], [cx - 9, 27], [cx - 10, 52], [cx - 15, 52]], LIGHT);
  ribbon(g, [[C[0] + 2, C[1] + 2], [C[0] + 10, C[1] + 14], [C[0] + 14, C[1] + 30], [C[0] + 20, C[1] + 40]], 8, 3, NEL_HAIR);
  arm(g, [cx - 13, 28], [cx - 22, 40], { sleeve: 'tight', color: PAPER, elbow: -2 });
  arm(g, [cx + 1, 28], [cx + 6, 26], { sleeve: 'tight', color: PAPER, elbow: 3 });
  neckHead(g, C[0], { turn: 0.3, y: C[1], w: 0.94 });
  eyes(g, C[0], C[1] + 1.3, { turn: 0.3, color: '#5a3a6a', brow: NEL_HAIR, tilt: 1.2 });
  shape(g, hp(C, [[-0.95, 0.42], [1, 0.38], [1, 0.52], [-0.95, 0.56]]), BLOOD_RED);
  mouth(g, C[0], C[1] + 5.4, 'line', 1.4, 0.3);
  nelMaskHorns(g, C, true);
});

// -------------------------------------------------------------- Harribel

const HARRIBEL_SKIN = '#8a5a3a';
const HARRIBEL_SHADE = '#5a3a26';
const BLONDE = '#e0c060';

function harribelHair(g: Ctx, C: Pt): void {
  shape(g, hp(C, [[-1.2, 0.3], [-1.35, -0.6], [-0.9, -0.85], [-1, -1.35], [-0.3, -1.1], [0.1, -1.5], [0.4, -1.1], [1.05, -1.3], [0.95, -0.82], [1.4, -0.55], [1.2, 0.3], [0.85, -0.3], [0.2, -0.55], [-0.4, -0.35], [-0.85, -0.2]]), BLONDE, INK, 1);
  // Three braids.
  for (const u of [-0.95, 0.95, 1.2]) {
    const top = hp(C, [[u, 0.2]])[0];
    for (let k = 0; k < 4; k++) shape(g, [[top[0] - 1.3, top[1] + k * 2.6], [top[0] + 1.3, top[1] + k * 2.6], [top[0] + 0.9, top[1] + k * 2.6 + 2.6], [top[0] - 0.9, top[1] + k * 2.6 + 2.6]], BLONDE, INK, 0.6);
  }
}

/** Tier Harribel, the Third Espada: dark skin, short ragged blonde hair with three braids, narrow green eyes over the tall white collar that hides her face below them, and Tiburón, a broad blade with a hollow down its middle. */
export const harribel = fig((g, cx) => {
  const C: Pt = [cx, 14];
  const B = whiteUniform(g, cx, { broad: 0.95, stance: 13 });
  arm(g, B.sl, [cx - 15, 50], { sleeve: 'tight', color: PAPER, elbow: -2, skin: HARRIBEL_SKIN });
  const hand: Pt = [cx + 18, 46];
  arm(g, B.sr, hand, { sleeve: 'tight', color: PAPER, elbow: 3, skin: HARRIBEL_SKIN });
  // Tiburón, the hollow running down its blade.
  g.save();
  g.translate(hand[0], hand[1]);
  g.rotate(1.2);
  shape(g, [[-6, -1.2], [1, -1.2], [1, 1.2], [-6, 1.2]], INK);
  shape(g, [[1, -4.6], [36, -3.8], [40, 0], [36, 3.8], [1, 4.6]], STEEL, INK, 1);
  shape(g, [[8, -1.6], [32, -1.2], [32, 1.2], [8, 1.6]], INK);
  g.restore();
  neckHead(g, cx, { turn: 0.15, y: C[1], skin: HARRIBEL_SKIN, shade: HARRIBEL_SHADE });
  eyes(g, cx, C[1] + 0.6, { turn: 0.15, color: '#3a8a5a', brow: BLONDE, tilt: 0.9 });
  // The collar, standing up over her mouth and jaw.
  shape(g, [[cx - 7.6, 30], [cx - 7, 16.4], [cx + 7.4, 16.4], [cx + 8, 30]], PAPER, INK, 1.2);
  stroke(g, [[cx, 17], [cx + 0.4, 30]], 0.9, LIGHT);
  harribelHair(g, C);
});

/** Harribel with Tiburón released: plates of bone over her shoulders and chest, a guard of bone across her face, and Tiburón become a great shark-tooth blade on her right arm, water spiralling round it. */
export const harribelReleased = fig((g, cx) => {
  const C: Pt = [cx, 15];
  ribbon(g, [[cx + 16, 72], [cx + 34, 62], [cx + 40, 44], [cx + 34, 26], [cx + 24, 18]], 5, 2.4, '#7ab8e8');
  const B = bodyFrame(cx, { broad: 0.95 });
  hakama(g, B, { stance: 13, hakama: PAPER, tabi: INK });
  kosode(g, B, { kosode: HARRIBEL_SKIN, obi: BONE, collar: HARRIBEL_SKIN });
  // Bone plates.
  for (const d of [-1, 1]) shape(g, [[cx + d * 3, 26], [cx + d * 14, 25], [cx + d * 16, 34], [cx + d * 9, 38], [cx + d * 2, 36]], BONE, INK, 1.1);
  shape(g, [[cx - 9, 46], [cx + 9, 46], [cx + 11, 54], [cx - 11, 54]], BONE, INK, 1.1);
  arm(g, B.sl, [cx - 16, 50], { sleeve: 'bare', skin: HARRIBEL_SKIN, elbow: -2 });
  const hand: Pt = [cx + 18, 44];
  arm(g, B.sr, hand, { sleeve: 'bare', skin: HARRIBEL_SKIN, elbow: 3 });
  // The shark-tooth blade along the forearm.
  shape(g, [[hand[0] - 6, hand[1] + 6], [hand[0] + 10, hand[1] - 26], [hand[0] + 16, hand[1] - 34], [hand[0] + 14, hand[1] - 18], [hand[0] + 4, hand[1] + 8]], BONE, INK, 1.2);
  shape(g, [[hand[0] + 3, hand[1] - 6], [hand[0] + 11, hand[1] - 22], [hand[0] + 9, hand[1] - 8]], INK);
  neckHead(g, cx, { turn: 0.15, y: C[1], skin: HARRIBEL_SKIN, shade: HARRIBEL_SHADE });
  eyes(g, cx, C[1] + 0.6, { turn: 0.15, color: '#3a8a5a', brow: BLONDE, tilt: 1.2 });
  // The guard of bone over her jaw.
  shape(g, hp(C, [[-1.05, 0.35], [1.05, 0.3], [0.85, 1.1], [0, 1.3], [-0.85, 1.1]]), BONE, INK, 1);
  for (let k = -2; k <= 2; k++) stroke(g, hp(C, [[k * 0.32, 0.4], [k * 0.3, 0.9]]), 0.6);
  harribelHair(g, C);
});

// ------------------------------------------------------- the Privaron

/** Rudbornn Chelute, commander of the Exequias: his face a skull under a tall crown of bone, the white uniform, a long black cloak. */
export const rudbornn = fig((g, cx) => {
  shape(g, [[cx - 12, 24], [cx + 12, 24], [cx + 24, 92], [cx - 24, 92]], INK);
  const B = whiteUniform(g, cx, { stance: 12 });
  arm(g, B.sl, [cx - 15, 52], { sleeve: 'square', color: PAPER, elbow: -2 });
  arm(g, B.sr, [cx + 16, 50], { sleeve: 'square', color: PAPER, elbow: 3, fist: true });
  shape(g, [[cx - 13, 24], [cx - 5, 22], [cx - 10, 36], [cx - 18, 40]], INK);
  shape(g, [[cx + 13, 24], [cx + 5, 22], [cx + 10, 36], [cx + 18, 40]], INK);
  skull(g, [cx, 14], 1);
  // The crown of bone rising over the skull.
  for (const [u, h] of [[-0.8, 1.6], [-0.4, 2.3], [0, 2.8], [0.4, 2.3], [0.8, 1.6]] as const) {
    const base = hp([cx, 14], [[u, -0.8]])[0];
    shape(g, [[base[0] - 1.6, base[1]], [base[0] + 1.6, base[1]], [base[0], base[1] - h * 5]], BONE, INK, 0.9);
  }
});

/** A skull for a face, as the Exequias' commander wears his mask. */
function skull(g: Ctx, C: Pt, k: number): void {
  shape(g, hp(C, [[-1.1, 0.1], [-1.05, -0.75], [0, -1.15], [1.05, -0.75], [1.1, 0.1], [0.7, 0.75], [0.6, 1.15], [-0.6, 1.15], [-0.7, 0.75]], k), BONE, INK, 1.1);
  for (const d of [-1, 1]) oval(g, C[0] + d * 2.6 * k, C[1] + 0.2 * k, 1.9 * k, 2.3 * k, 0, INK);
  shape(g, [[C[0] - 0.7 * k, C[1] + 3 * k], [C[0] + 0.7 * k, C[1] + 3 * k], [C[0], C[1] + 4.4 * k]], INK);
  for (let j = -2; j <= 2; j++) stroke(g, [[C[0] + j * 1.4 * k, C[1] + 5.6 * k], [C[0] + j * 1.4 * k, C[1] + 8 * k]], 0.6);
}

/** Rudbornn released, Árbol: branches of bone growing out of his back, a skull at every tip. */
export const rudbornnArbol = fig((g, cx) => {
  const tips: Pt[] = [[cx - 40, 14], [cx - 30, 4], [cx - 14, 0], [cx + 14, 0], [cx + 30, 4], [cx + 40, 14], [cx - 44, 34], [cx + 44, 34]];
  for (const t of tips) {
    const root: Pt = [cx + (t[0] - cx) * 0.15, 34];
    limb(g, root, along(root, t, 0.55, (t[0] - cx) * 0.05), 4, 2.6, BONE_SHADE);
    limb(g, along(root, t, 0.55, (t[0] - cx) * 0.05), t, 2.6, 1.8, BONE_SHADE);
  }
  for (const t of tips) skull(g, t, 0.55);
  shape(g, [[cx - 12, 24], [cx + 12, 24], [cx + 24, 92], [cx - 24, 92]], INK);
  const B = whiteUniform(g, cx, { stance: 13 });
  arm(g, B.sl, [cx - 17, 48], { sleeve: 'square', color: PAPER, elbow: -2, fist: true });
  arm(g, B.sr, [cx + 17, 48], { sleeve: 'square', color: PAPER, elbow: 2, fist: true });
  skull(g, [cx, 14], 1);
});

const SCARF = '#6ab8a8';

/** Dordoni Alessandro del Socaccio, Privaron Espada 103: moustache, slicked-back hair, the crown of his mask, a white suit and a long scarf. */
export const dordoni = fig((g, cx) => {
  const C: Pt = [cx, 14];
  ribbon(g, [[cx - 2, 25], [cx - 12, 30], [cx - 22, 28], [cx - 32, 34], [cx - 40, 32]], 5, 3, SCARF);
  const B = whiteUniform(g, cx, { stance: 15 });
  arm(g, B.sl, [cx - 18, 44], { sleeve: 'tight', color: PAPER, elbow: -4 });
  arm(g, B.sr, [cx + 17, 38], { sleeve: 'tight', color: PAPER, elbow: 4 });
  shape(g, [[cx - 6.4, 23], [cx + 6.4, 23], [cx + 6.8, 27], [cx - 6.8, 27]], SCARF, INK, 1);
  neckHead(g, cx, { turn: 0.25, y: C[1], jaw: 0.5 });
  eyes(g, cx, C[1] + 1, { turn: 0.25, color: '#3a2a1a', brow: INK, tilt: 1 });
  // The moustache, curled.
  for (const d of [-1, 1]) shape(g, [[cx + 0.5, C[1] + 3.8], [cx + d * 4.4, C[1] + 3.4], [cx + d * 6.6, C[1] + 2.2], [cx + d * 5, C[1] + 4.8], [cx + 0.5, C[1] + 5]], INK);
  shape(g, [[cx - 0.6, C[1] + 6], [cx + 1.8, C[1] + 6], [cx + 0.6, C[1] + 8.4]], INK);
  // Hair slicked back, and the mask's crown on top.
  shape(g, hp(C, [[-1.15, 0], [-1.12, -0.6], [-0.4, -1.12], [0.6, -1.1], [1.15, -0.6], [1.2, -0.1], [0.4, -0.65], [-0.6, -0.55]]), INK);
  shape(g, hp(C, [[-0.7, -0.95], [-0.8, -1.55], [-0.35, -1.25], [0, -1.7], [0.35, -1.25], [0.8, -1.55], [0.75, -0.95]]), BONE, INK, 0.9);
});

/** Dordoni released, Giralda: his legs become two spinning whirlwinds, a bird's horned helm over his head. */
export const dordoniGiralda = fig((g, cx) => {
  const C: Pt = [cx, 16];
  for (const d of [-1, 1]) {
    const top: Pt = [cx + d * 7, 50];
    const tip: Pt = [cx + d * 24, 97];
    // A whirlwind cone, wide at the hip and spinning down to a point.
    shape(g, [along(top, tip, 0, -9), along(top, tip, 0.5, -5.5), tip, along(top, tip, 0.5, 5.5), along(top, tip, 0, 9)], PAPER, INK, 1.2);
    for (let k = 1; k < 6; k++) {
      const t = k / 6;
      const w = 9 - t * 8;
      stroke(g, [along(top, tip, t - 0.05, -w), along(top, tip, t + 0.04, 0), along(top, tip, t + 0.02, w * 0.8)], 1, LIGHT);
    }
    // Speed lines flung off the spin.
    for (let k = 0; k < 3; k++) stroke(g, [along(top, tip, 0.25 + k * 0.22, d * (12 + k)), along(top, tip, 0.3 + k * 0.22, d * (18 + k))], 0.9, STEEL);
  }
  const B = bodyFrame(cx, { top: 28 });
  kosode(g, B, { kosode: PAPER, obi: INK, collar: INK });
  arm(g, B.sl, [cx - 19, 42], { sleeve: 'tight', color: PAPER, elbow: -4, fist: true });
  arm(g, B.sr, [cx + 19, 40], { sleeve: 'tight', color: PAPER, elbow: 4, fist: true });
  neckHead(g, cx, { turn: 0.25, y: C[1], jaw: 0.5 });
  eyes(g, cx, C[1] + 1.4, { turn: 0.25, color: '#3a2a1a', brow: INK, tilt: 1.4 });
  for (const d of [-1, 1]) shape(g, [[cx + 0.5, C[1] + 4.2], [cx + d * 4.4, C[1] + 3.8], [cx + d * 6.6, C[1] + 2.6], [cx + d * 5, C[1] + 5.2], [cx + 0.5, C[1] + 5.4]], INK);
  // The helm: a bird's skull with horns sweeping back.
  shape(g, hp(C, [[-1.2, 0.2], [-1.15, -0.7], [0, -1.3], [1.15, -0.7], [1.2, 0.2], [0.8, -0.2], [-0.8, -0.2]]), BONE, INK, 1);
  for (const d of [-1, 1]) shape(g, hp(C, [[d * 0.9, -0.7], [d * 2.8, -2], [d * 1.3, -0.4]]), BONE, INK, 0.9);
});

const CIRUCCI_HAIR = '#8a5ab8';
const CIRUCCI_DRESS = '#2a1a36';

/** Cirucci Sanderwicci, Privaron Espada 105: a dark frilled dress, violet hair in curls, and Golondrina sealed, a blade like a disc on a long cord. */
export const cirucci = fig((g, cx) => {
  const C: Pt = [cx, 16];
  scaled(g, cx, 96, 0.92, () => {
    shape(g, hp(C, [[-1.3, -0.4], [1.3, -0.4], [1.6, 1.6], [1.2, 2.6], [-1.2, 2.6], [-1.6, 1.6]]), CIRUCCI_HAIR, INK, 1);
    for (const d of [-1, 1]) limb(g, [cx + d * 4, 66], [cx + d * 9, 93], 4.4, 3.8, INK);
    // The frilled dress.
    shape(g, [[cx - 9, 28], [cx + 9, 28], [cx + 10, 46], [cx + 20, 68], [cx - 20, 68], [cx - 10, 46]], CIRUCCI_DRESS, INK, 1.1);
    for (let k = 0; k < 7; k++) shape(g, [[cx - 20 + k * 5.7, 68], [cx - 17 + k * 5.7, 72], [cx - 14.3 + k * 5.7, 68]], PAPER, INK, 0.6);
    const hand: Pt = [cx + 16, 46];
    arm(g, [cx - 9, 30], [cx - 15, 48], { sleeve: 'tight', color: CIRUCCI_DRESS, elbow: -2 });
    arm(g, [cx + 9, 30], hand, { sleeve: 'tight', color: CIRUCCI_DRESS, elbow: 3 });
    // Golondrina: a disc of blades on its cord.
    stroke(g, [hand, [cx + 26, 62], [cx + 32, 76]], 0.9, STEEL_SHADE);
    disc(g, cx + 32, 80, 6, STEEL);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU;
      shape(g, [[cx + 32 + Math.cos(a) * 5, 80 + Math.sin(a) * 5], [cx + 32 + Math.cos(a + 0.4) * 9, 80 + Math.sin(a + 0.4) * 9], [cx + 32 + Math.cos(a + 0.7) * 5, 80 + Math.sin(a + 0.7) * 5]], STEEL, INK, 0.6);
    }
    disc(g, cx + 32, 80, 2, INK);
    neckHead(g, cx, { turn: 0.2, y: C[1], w: 0.9 });
    eyes(g, cx, C[1] + 1.3, { turn: 0.2, color: '#8a3a8a', brow: INK, tilt: 0.8 });
    mouth(g, cx, C[1] + 5.2, 'smile', 1.4, 0.4);
    shape(g, hp(C, [[-1.2, 0.4], [-1.15, -0.6], [-0.4, -1.15], [0.5, -1.15], [1.15, -0.6], [1.2, 0.4], [0.9, -0.15], [-0.9, -0.15]]), CIRUCCI_HAIR, INK, 1);
    // Curls, and the mask's band across her hair.
    for (const d of [-1, 1]) for (const v of [0.9, 1.9]) disc(g, cx + d * 8, C[1] + v * 7, 2.6, CIRUCCI_HAIR);
    stroke(g, hp(C, [[-1.15, -0.62], [1.15, -0.62]]), 2, BONE);
  });
});

/** Cirucci released, Golondrina: great wings of razor feathers spread wide behind her. */
export const cirucciGolondrina = fig((g, cx) => {
  for (const d of [-1, 1]) {
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI / 2 + d * (0.35 + k * 0.28);
      const len = 40 - Math.abs(k - 2) * 4;
      const base: Pt = [cx + d * 5, 36];
      const tip: Pt = [base[0] + Math.cos(a) * len, base[1] + Math.sin(a) * len];
      shape(g, [along(base, tip, 0, -2.6), along(base, tip, 0.85, -2.2), tip, along(base, tip, 0.85, 2), along(base, tip, 0, 2.6)], k % 2 ? '#4a2a5a' : CIRUCCI_DRESS, INK, 0.9);
      stroke(g, [along(base, tip, 0.2), along(base, tip, 0.9)], 0.6, '#8a5ab8');
    }
  }
  const C: Pt = [cx, 16];
  scaled(g, cx, 96, 0.92, () => {
    shape(g, hp(C, [[-1.3, -0.4], [1.3, -0.4], [1.8, 2.4], [1.3, 3.6], [-1.3, 3.6], [-1.8, 2.4]]), CIRUCCI_HAIR, INK, 1);
    for (const d of [-1, 1]) limb(g, [cx + d * 4, 64], [cx + d * 10, 93], 4.4, 3.4, CIRUCCI_DRESS);
    shape(g, [[cx - 9, 28], [cx + 9, 28], [cx + 10, 46], [cx + 16, 66], [cx - 16, 66], [cx - 10, 46]], CIRUCCI_DRESS, INK, 1.1);
    arm(g, [cx - 9, 30], [cx - 18, 42], { sleeve: 'tight', color: CIRUCCI_DRESS, elbow: -2 });
    arm(g, [cx + 9, 30], [cx + 18, 42], { sleeve: 'tight', color: CIRUCCI_DRESS, elbow: 2 });
    for (const d of [-1, 1]) for (let k = 0; k < 3; k++) shape(g, [[cx + d * 18, 42], [cx + d * (20 + k * 2), 50 + k * 2], [cx + d * 17, 43]], STEEL, INK, 0.6);
    neckHead(g, cx, { turn: 0.2, y: C[1], w: 0.9 });
    eyes(g, cx, C[1] + 1.3, { turn: 0.2, color: '#8a3a8a', brow: INK, tilt: 1.4 });
    mouth(g, cx, C[1] + 5.2, 'teeth', 2.2, 0.3);
    shape(g, hp(C, [[-1.2, 0.4], [-1.15, -0.6], [-0.4, -1.15], [0.5, -1.15], [1.15, -0.6], [1.2, 0.4], [0.9, -0.15], [-0.9, -0.15]]), CIRUCCI_HAIR, INK, 1);
    stroke(g, hp(C, [[-1.15, -0.62], [1.15, -0.62]]), 2, BONE);
  });
});

const GANTEN_SKIN = '#7a4a30';
const GANTEN_SHADE = '#4a2a1a';

function gantenHead(g: Ctx, C: Pt, helm: boolean): void {
  // The mane of locks.
  for (let k = 0; k < 9; k++) {
    const a = Math.PI * (0.95 + k * 0.14);
    const r = 10 + (k % 2) * 3;
    limb(g, [C[0] + Math.cos(a) * 4, C[1] + Math.sin(a) * 4], [C[0] + Math.cos(a) * r, C[1] + Math.sin(a) * r * 0.9 + 6], 3.2, 2.4, INK);
  }
  limb(g, [C[0] + 0.3, C[1] + 5], [C[0], C[1] + 12], 4.8, 5.4, GANTEN_SKIN);
  head(g, C[0], C[1], { turn: 0.15, jaw: 0.8, skin: GANTEN_SKIN, shade: GANTEN_SHADE });
  eyes(g, C[0], C[1] + 1, { turn: 0.15, color: '#2a1a10', brow: INK, tilt: 1.3 });
  // The mask's jaw at his chin, like a beard of bone.
  shape(g, hp(C, [[-0.9, 0.55], [0.95, 0.5], [0.8, 1.35], [0, 1.6], [-0.75, 1.35]]), BONE, INK, 1);
  for (let k = -2; k <= 2; k++) stroke(g, hp(C, [[k * 0.3, 0.6], [k * 0.28, 1.05]]), 0.6);
  if (helm) {
    shape(g, hp(C, [[-1.2, -0.1], [-1.15, -0.9], [0, -1.35], [1.15, -0.9], [1.2, -0.1], [0.7, -0.5], [-0.7, -0.5]]), '#8a3a2a', INK, 1);
    for (const d of [-1, 1]) shape(g, hp(C, [[d * 0.7, -1], [d * 1.6, -2.4], [d * 1.05, -0.8]]), BONE, INK, 0.9);
  }
}

/** Gantenbainne Mosqueda, Privaron Espada 107: broad and dark skinned, a mane of locks, his mask's jaw at his chin. */
export const gantenbainne = fig((g, cx) => {
  const B = whiteUniform(g, cx, { broad: 1.25, stance: 16, open: true, skin: GANTEN_SKIN });
  arm(g, B.sl, [cx - 19, 52], { sleeve: 'bare', skin: GANTEN_SKIN, elbow: -3, fist: true, w: 1.3 });
  arm(g, B.sr, [cx + 21, 44], { sleeve: 'bare', skin: GANTEN_SKIN, elbow: 3, fist: true, w: 1.3 });
  gantenHead(g, [cx, 14], false);
});

/** Gantenbainne released, Dragra: scaled dragon armour over his arms and shoulders, claws, a horned helm. */
export const gantenDragra = fig((g, cx) => {
  const SCALE = '#8a3a2a';
  const B = whiteUniform(g, cx, { broad: 1.3, stance: 17 });
  for (const d of [-1, 1]) {
    const hand: Pt = [cx + d * 23, 50];
    arm(g, d < 0 ? B.sl : B.sr, hand, { sleeve: 'bare', skin: SCALE, elbow: d * 3, w: 1.7, fist: true });
    for (let k = 0; k < 4; k++) {
      const p = along(d < 0 ? B.sl : B.sr, hand, 0.2 + k * 0.2);
      shape(g, [[p[0] - 3, p[1]], [p[0] + d * 4, p[1] - 4], [p[0] + 3, p[1]]], '#c86a3a', INK, 0.7);
    }
    for (let k = 0; k < 3; k++) shape(g, [[hand[0] - 1.4, hand[1]], [hand[0] + 1.4, hand[1]], [hand[0] + d * (3 + k * 3), hand[1] + 10 - k]], BONE, INK, 0.8);
    shape(g, [[cx + d * 6, 24], [cx + d * 19, 22], [cx + d * 22, 33], [cx + d * 11, 34]], SCALE, INK, 1.1);
  }
  gantenHead(g, [cx, 14], true);
});

// -------------------------------------------------------------- Grimmjow

const GRIMM_HAIR = '#3a90d8';

/** Grimmjow Jaegerjaquez, the Sexta Espada: spiked blue hair swept back, teal marks under his eyes, the jaw of his mask on his right cheek, the white jacket open over the hole in his belly, hands in his pockets. */
export const grimmjow = fig((g, cx) => {
  const C: Pt = [cx, 14];
  const B = bodyFrame(cx, { broad: 1.08 });
  hakama(g, B, { stance: 15, hakama: PAPER, tabi: INK });
  // His bare chest and belly, the hole through it.
  shape(g, [[cx - 8, 25], [cx + 8, 25], [cx + 8.6, 50], [cx - 8.6, 50]], SKIN, INK, 1);
  stroke(g, [[cx - 6, 34], [cx + 6, 34]], 0.8, SKIN_SHADE);
  hole(g, cx + 0.5, 43, 3.6);
  shape(g, [[cx - 9, 47], [cx + 9, 47], [cx + 9, 50.5], [cx - 9, 50.5]], INK);
  // The jacket, open, its collar turned up.
  for (const d of [-1, 1]) {
    shape(g, [[cx + d * 4, 24], [cx + d * 13, 25], [cx + d * 14.5, 50], [cx + d * 7.5, 50], [cx + d * 6, 32]], PAPER, INK, 1.1);
    shape(g, [[cx + d * 4.5, 24], [cx + d * 9.6, 17.8], [cx + d * 11.4, 25.2]], PAPER, INK, 1);
    // Hands in his pockets.
    arm(g, [cx + d * 12.4, 27], [cx + d * 10, 47], { sleeve: 'tight', color: PAPER, elbow: d * 4 });
  }
  neckHead(g, cx, { turn: 0.25, y: C[1], jaw: 0.6 });
  // Teal marks under the eyes.
  for (const d of [-1, 1]) shape(g, [[cx + 0.3 + d * 1.2, C[1] + 2.4], [cx + 0.3 + d * 4.6, C[1] + 2.2], [cx + 0.3 + d * 3.6, C[1] + 3.6]], '#3ab8a8');
  eyes(g, cx, C[1] + 1, { turn: 0.25, color: '#3a90d8', brow: GRIMM_HAIR, tilt: 1.8 });
  mouth(g, cx - 1, C[1] + 5, 'smile', 1.8, 0.25);
  // The jaw of his mask along his right cheek.
  shape(g, hp(C, [[0.25, 0.55], [1.15, 0.2], [1.1, 0.9], [0.55, 1.05]]), BONE, INK, 0.9);
  for (const u of [0.45, 0.7, 0.92]) stroke(g, hp(C, [[u, 0.5], [u, 0.88]]), 0.5);
  // Hair spiked up and back.
  shape(g, hp(C, [[-1.15, 0.05], [-1.7, -0.5], [-1.05, -0.8], [-1.35, -1.45], [-0.5, -1.15], [-0.25, -1.85], [0.3, -1.2], [0.95, -1.75], [0.95, -0.95], [1.6, -0.9], [1.15, -0.3], [0.7, -0.6], [-0.4, -0.5]]), GRIMM_HAIR, INK, 1);
});

/** Grimmjow released, Pantera: long wild hair to his waist, a panther's ears and tail, white armour plates, claws, crouched to spring. */
export const grimmjowPantera = fig((g, cx) => {
  const C: Pt = [cx - 4, 20];
  ribbon(g, [[cx + 14, 70], [cx + 30, 74], [cx + 40, 62], [cx + 44, 48]], 4.4, 2.4, PAPER);
  ribbon(g, [[C[0], C[1] - 2], [C[0] + 12, C[1] + 10], [C[0] + 18, C[1] + 28], [C[0] + 28, C[1] + 42]], 12, 4, GRIMM_HAIR);
  // Crouched legs, armoured.
  for (const d of [-1, 1]) {
    limb(g, [cx + d * 6, 58], [cx + d * 16, 74], 8, 6.4, PAPER);
    limb(g, [cx + d * 16, 74], [cx + d * 12, 94], 6.4, 5, PAPER);
    for (let k = 0; k < 3; k++) shape(g, [[cx + d * 12 - 2 + k * 2, 94], [cx + d * 12 - 1 + k * 2, 94], [cx + d * 12 + d * 2 + k * 2, 99]], INK);
  }
  shape(g, [[cx - 11, 32], [cx + 11, 32], [cx + 9, 60], [cx - 9, 60]], SKIN, INK, 1.1);
  hole(g, cx, 52, 3.4);
  for (const d of [-1, 1]) shape(g, [[cx + d * 2, 30], [cx + d * 14, 29], [cx + d * 15, 40], [cx + d * 6, 42]], PAPER, INK, 1);
  for (const d of [-1, 1]) {
    const hand: Pt = [cx + d * 24, 54];
    arm(g, [cx + d * 11, 34], hand, { sleeve: 'tight', color: PAPER, elbow: d * 3, w: 1.2 });
    for (let k = 0; k < 4; k++) shape(g, [[hand[0] - 1, hand[1]], [hand[0] + 1, hand[1]], [hand[0] + d * (2 + k * 1.6), hand[1] + 9]], INK);
  }
  neckHead(g, C[0], { turn: 0.3, y: C[1], jaw: 0.6 });
  for (const d of [-1, 1]) shape(g, [[C[0] + 0.3 + d * 1.2, C[1] + 2.4], [C[0] + 0.3 + d * 4.6, C[1] + 2.2], [C[0] + 0.3 + d * 3.6, C[1] + 3.6]], '#3ab8a8');
  eyes(g, C[0], C[1] + 1, { turn: 0.3, color: '#3a90d8', brow: GRIMM_HAIR, tilt: 2 });
  mouth(g, C[0], C[1] + 5, 'teeth', 2.6, 0.3);
  shape(g, hp([C[0], C[1]], [[-1.2, 0.4], [-1.25, -0.6], [-0.5, -1.2], [0.5, -1.2], [1.25, -0.6], [1.3, 0.6], [0.8, -0.1], [-0.6, -0.2]]), GRIMM_HAIR, INK, 1);
  // A panther's ears.
  for (const d of [-1, 1]) shape(g, hp(C, [[d * 0.4, -1.05], [d * 1.1, -1.9], [d * 1.05, -0.7]]), PAPER, INK, 0.9);
});

/** Pesche and Dondochakka, Las Noches' runaways: the round, masked Dondochakka at a run, the thin bug-masked Pesche on his shoulders, a sack of the palace's silver between them. */
export const pesche = fig((g, cx) => {
  // Dondochakka: round body, stubby legs.
  for (const d of [-1, 1]) limb(g, [cx + d * 8, 78], [cx + d * 14, 95], 7, 6, PAPER);
  oval(g, cx, 66, 20, 18, 0, PAPER);
  g.strokeStyle = INK;
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(cx, 66, 20, 18, 0, 0, TAU);
  g.stroke();
  shape(g, [[cx - 20, 64], [cx + 20, 64], [cx + 20, 69], [cx - 20, 69]], INK);
  // His mask: round, with a horn.
  oval(g, cx - 2, 50, 11, 9, 0, BONE);
  shape(g, [[cx - 4, 42], [cx, 30], [cx + 3, 42]], BONE, INK, 1.2);
  disc(g, cx - 6, 50, 2, INK);
  disc(g, cx + 2, 50, 2, INK);
  // Pesche on his shoulders: thin, a bug's mask with feelers.
  limb(g, [cx + 4, 44], [cx + 6, 24], 5, 4, PAPER);
  oval(g, cx + 6, 18, 6, 5, 0, BONE);
  for (const d of [-1, 1]) limb(g, [cx + 6 + d * 2, 13], [cx + 6 + d * 8, 2], 1.6, 1.2, INK);
  disc(g, cx + 4, 18, 1.4, INK);
  disc(g, cx + 8.4, 18, 1.4, INK);
  // The sack of silver.
  blob(g, [[cx + 18, 54], [cx + 34, 52], [cx + 40, 66], [cx + 30, 76], [cx + 18, 70]], '#c8a868', INK, 1.6);
  stroke(g, [[cx + 22, 56], [cx + 28, 50]], 1.4);
});

