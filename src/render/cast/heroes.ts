import {
  along,
  arm,
  blob,
  BLOOD,
  bodyFrame,
  coat,
  type Ctx,
  DARK,
  disc,
  eyes,
  fig,
  GOLD,
  hakama,
  head,
  hp,
  INK,
  katana,
  kosode,
  limb,
  mouth,
  oval,
  PAPER,
  petals,
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
 * The Emperor's last opponents as manga homages: the Wahrwelt's defenders
 * (Renji, Rukia, Uryū, Aizen) and Ichigo; Karakura's (Sado, Orihime,
 * Yoruichi, Isshin) and Kisuke Urahara; and the runaways Ganju with Bonnie,
 * Don Kanonji and Kon.
 */

const RENJI_RED = '#c8283a';
const ORANGE = '#f08a30';
const SNOW = '#eaf4fb';
const AIZEN_BROWN = '#6a4a2a';
const DARK_SKIN = '#8a5a3a';
const DARK_SKIN_SHADE = '#5a3a26';
const URAHARA_GREEN = '#3a5a3a';

function neckHead(g: Ctx, cx: number, o: { turn?: number; y?: number; w?: number; h?: number; jaw?: number; skin?: string; shade?: string } = {}): Pt {
  const y = o.y ?? 14;
  limb(g, [cx + 0.3, y + 5], [cx, y + 12], 4.6, 5.2, o.skin ?? SKIN);
  head(g, cx, y, { turn: o.turn, w: o.w, h: o.h, jaw: o.jaw, skin: o.skin, shade: o.shade });
  return [cx, y];
}

/** A lieutenant's badge on the left arm: a white band, a black mark. */
function badge(g: Ctx, sl: Pt): void {
  shape(g, [[sl[0] - 4.6, sl[1] + 6], [sl[0] + 2.4, sl[1] + 6], [sl[0] + 2.2, sl[1] + 10.4], [sl[0] - 4.4, sl[1] + 10.4]], PAPER, INK, 0.9);
  shape(g, [[sl[0] - 1.8, sl[1] + 7], [sl[0] - 0.2, sl[1] + 7], [sl[0] - 0.2, sl[1] + 9.4], [sl[0] - 1.8, sl[1] + 9.4]], INK);
}

// ----------------------------------------------------------------- Renji

function renjiHead(g: Ctx, cx: number, C: Pt): void {
  // The ponytail, spiked, tied high.
  for (const [u, v] of [[-0.6, -3.1], [0.2, -3.4], [0.9, -3], [1.6, -2.5], [-1.2, -2.6]] as const) shape(g, hp(C, [[-0.25, -1.3], [u, v], [0.35, -1.25]]), RENJI_RED, INK, 0.9);
  neckHead(g, cx, { turn: 0.2, y: C[1], jaw: 0.5 });
  eyes(g, cx, C[1] + 1.2, { turn: 0.2, color: '#5a2a2a', brow: INK, tilt: 1.6 });
  // The tattoos over his brows.
  for (const d of [-1, 1]) stroke(g, hp(C, [[d * 0.2, -0.32], [d * 0.6, -0.52], [d * 0.85, -0.38], [d * 1.05, -0.55]]), 1, INK);
  mouth(g, cx, C[1] + 5.2, 'grin', 2.6, 0.2);
  shape(g, hp(C, [[-1.15, 0.2], [-1.2, -0.7], [-0.5, -1.2], [0.5, -1.25], [1.2, -0.7], [1.15, 0.2], [0.9, -0.45], [-0.9, -0.45]]), RENJI_RED, INK, 1);
  // The white bandana across his forehead.
  shape(g, hp(C, [[-1.2, -0.75], [1.2, -0.8], [1.18, -0.5], [-1.18, -0.45]]), PAPER, INK, 0.9);
  ribbon(g, hp(C, [[-1.1, -0.6], [-1.9, -0.2], [-2.5, 0.4]]), 2.4, 1.4, PAPER);
}

/** Zabimaru released: a long blade of jagged segments, snaking up from his hand. */
function zabimaru(g: Ctx, hand: Pt, n: number, k: number): void {
  let p: Pt = hand;
  for (let j = 0; j < n; j++) {
    const a = -1.1 + j * 0.22;
    const q: Pt = [p[0] + Math.cos(a) * 7.5 * k, p[1] + Math.sin(a) * 7.5 * k];
    shape(g, [along(p, q, 0, -2.4 * k), along(p, q, 0.8, -3.4 * k), q, along(p, q, 0.8, 2.2 * k), along(p, q, 0, 2 * k)], STEEL, INK, 0.9);
    // The teeth along the back of each segment.
    shape(g, [along(p, q, 0.5, -2.6 * k), along(p, q, 0.85, -5.6 * k), along(p, q, 0.9, -3 * k)], STEEL, INK, 0.6);
    p = q;
  }
}

/** Renji Abarai: crimson hair tied high in a spiked ponytail, a white bandana, the tattoos on his brow and his bare arms, and Zabimaru released, its jagged segments raised high. */
export const renji = fig((g, cx) => {
  const B = bodyFrame(cx, { broad: 1.12 });
  hakama(g, B, { stance: 16 });
  kosode(g, B);
  arm(g, B.sl, [cx - 17, 52], { sleeve: 'bare', elbow: -3, fist: true, w: 1.15 });
  const hand: Pt = [cx + 19, 44];
  arm(g, B.sr, hand, { sleeve: 'bare', elbow: 3, fist: true, w: 1.15 });
  for (const [a, b] of [[B.sl, [cx - 17, 52]], [B.sr, hand]] as const) for (const t of [0.3, 0.55, 0.8]) stroke(g, [along(a, b, t, -2), along(a, b, t + 0.05, 2)], 1);
  badge(g, B.sl);
  zabimaru(g, hand, 6, 1);
  renjiHead(g, cx, [cx, 15]);
});

/** Renji in Sōō Zabimaru: the baboon king's crimson fur mantle round his shoulders and a great arm of bone with claws in place of his right hand. */
export const renjiBankai = fig((g, cx) => {
  const B = bodyFrame(cx, { broad: 1.15 });
  hakama(g, B, { stance: 16 });
  kosode(g, B);
  arm(g, B.sl, [cx - 17, 54], { sleeve: 'bare', elbow: -3, fist: true, w: 1.15 });
  // The bone arm: a giant's forearm of bone, clawed.
  const el: Pt = [cx + 22, 42];
  const fist: Pt = [cx + 30, 64];
  limb(g, B.sr, el, 7, 8, '#d8cfb8');
  limb(g, el, fist, 10, 13, '#d8cfb8');
  for (const t of [0.2, 0.45, 0.7]) stroke(g, [along(el, fist, t, -5), along(el, fist, t, 5)], 1.1);
  for (let j = 0; j < 4; j++) {
    const a = Math.PI / 2 + (j - 1.5) * 0.4;
    shape(g, [[fist[0] - 2, fist[1] + 3], [fist[0] + 2, fist[1] + 3], [fist[0] + Math.cos(a) * 16, fist[1] + Math.sin(a) * 16]], BONE, INK, 0.9);
  }
  // The mantle of crimson fur.
  for (let j = 0; j < 14; j++) {
    const a = Math.PI * (0.95 + (j / 13) * 1.1);
    shape(g, [[cx + Math.cos(a - 0.12) * 12, 32 + Math.sin(a - 0.12) * 9], [cx + Math.cos(a) * 24, 34 + Math.sin(a) * 16], [cx + Math.cos(a + 0.12) * 12, 32 + Math.sin(a + 0.12) * 9]], RENJI_RED, INK, 0.9);
  }
  // The collar of the mantle, standing round his neck.
  blob(g, [[cx - 25, 35], [cx - 17, 22], [cx, 19], [cx + 17, 22], [cx + 25, 35], [cx + 14, 30], [cx, 28], [cx - 14, 30]], RENJI_RED, INK, 1.1);
  renjiHead(g, cx, [cx, 15]);
});

const BONE = '#ece6d6';

// ----------------------------------------------------------------- Rukia

function rukiaHead(g: Ctx, cx: number, C: Pt, white: boolean): void {
  const hair = white ? SNOW : INK;
  shape(g, hp(C, [[-1.2, -0.3], [1.2, -0.3], [1.3, 0.95], [-1.3, 0.95]]), hair, INK, 1);
  neckHead(g, cx, { turn: 0.25, y: C[1], w: 0.94, skin: white ? '#f4f7fa' : SKIN, shade: white ? '#b8c8d8' : SKIN_SHADE });
  eyes(g, cx, C[1] + 1.4, { turn: 0.25, color: white ? '#8ab8e0' : '#6a4ab0', brow: hair === SNOW ? '#b8c8d8' : INK, tilt: 0.9, kind: 'wide' });
  mouth(g, cx, C[1] + 5.4, 'line', 1.4, 0.25);
  // Short hair, a lock falling between the eyes.
  shape(g, hp(C, [[-1.2, 0.75], [-1.15, -0.6], [-0.4, -1.15], [0.5, -1.15], [1.15, -0.6], [1.2, 0.75], [0.9, -0.15], [0.3, -0.4], [0.15, 0.55], [0, -0.4], [-0.6, -0.25], [-0.95, 0.15]]), hair, INK, 1);
  if (white) {
    // The ice flower in her hair.
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU;
      const [x, y] = hp(C, [[-0.85, -0.75]])[0];
      shape(g, [[x, y], [x + Math.cos(a) * 4, y + Math.sin(a) * 4], [x + Math.cos(a + 0.5) * 2, y + Math.sin(a + 0.5) * 2]], '#bfe6ff', INK, 0.6);
    }
  }
}

/** Rukia Kuchiki: small, short black hair with one lock between her violet eyes, the lieutenant's badge, and Sode no Shirayuki, white from hilt to tip, its long ribbon looping round her, snow in the air. */
export const rukia = fig((g, cx) => {
  scaled(g, cx, 96, 0.88, () => {
    const B = bodyFrame(cx, { broad: 0.86 });
    const hand: Pt = [cx + 18, 46];
    hakama(g, B, { stance: 13 });
    kosode(g, B);
    arm(g, B.sl, [cx - 14, 52], { sleeve: 'square', elbow: -2 });
    arm(g, B.sr, hand, { sleeve: 'square', elbow: 3 });
    badge(g, B.sl);
    katana(g, hand, -0.75, { len: 34, blade: SNOW, grip: SNOW, guard: SNOW });
    // The ribbon from the pommel, looping round her.
    ribbon(g, [[hand[0] - 5, hand[1] + 3], [cx + 4, 58], [cx - 14, 62], [cx - 26, 54], [cx - 30, 70], [cx - 22, 84], [cx - 34, 92]], 5.4, 4, SNOW);
    rukiaHead(g, cx, [cx, 14], false);
  });
  petals(g, 21, 12, [cx - 46, 10, cx + 46, 92], SNOW);
});

/** Rukia in Hakka no Togame: her bankai at absolute zero. Hair, skin and a long robe all turned to white, the robe trailing behind her like frost, an ice flower in her hair, cold mist at her feet. */
export const rukiaBankai = fig((g, cx) => {
  scaled(g, cx, 96, 0.9, () => {
    // The robe, falling to the ground and trailing away in a frost train.
    shape(g, [[cx - 9, 26], [cx + 9, 26], [cx + 15, 70], [cx + 22, 96], [cx - 10, 96], [cx - 38, 98], [cx - 30, 90], [cx - 16, 70]], SNOW, INK, 1.2);
    stroke(g, [[cx - 4, 34], [cx - 8, 92]], 1, '#b8c8d8');
    stroke(g, [[cx + 5, 34], [cx + 10, 92]], 1, '#b8c8d8');
    for (const d of [-1, 1]) arm(g, [cx + d * 9.5, 28], [cx + d * 15, 50], { sleeve: 'wide', color: SNOW, elbow: d * 2, skin: '#f4f7fa' });
    katana(g, [cx + 15, 50], 1.25, { len: 30, blade: SNOW, grip: SNOW, guard: SNOW });
    rukiaHead(g, cx, [cx, 14], true);
  });
  // Cold mist at her feet.
  for (let k = 0; k < 6; k++) oval(g, cx - 34 + k * 13, 95 - (k % 2) * 2, 9, 3, 0, '#d6ecfa');
});

// ------------------------------------------------------------------ Uryū

/** Uryū Ishida: glasses, straight black hair falling across his brow, the Wandenreich's white uniform with its cape, and a bow of blue reishi drawn with an arrow on the string. */
export const uryu = fig((g, cx) => {
  const B = coat(g, cx, { cape: PAPER, hem: 84, stance: 12, broad: 0.95 });
  const handL: Pt = [cx - 21, 40];
  arm(g, B.sl, handL, { sleeve: 'tight', color: PAPER, elbow: -2 });
  // The bow, and the arrow drawn back to his cheek.
  g.beginPath();
  g.moveTo(handL[0] + 3, handL[1] - 22);
  g.quadraticCurveTo(handL[0] - 10, handL[1], handL[0] + 3, handL[1] + 22);
  g.strokeStyle = '#8cc8f0';
  g.lineWidth = 3;
  g.stroke();
  stroke(g, [[handL[0] + 3, handL[1] - 22], [cx + 6, 24], [handL[0] + 3, handL[1] + 22]], 0.7, '#d6ecfa');
  shape(g, [[handL[0] - 10, handL[1] - 1], [cx + 6, 23.4], [cx + 6, 24.6], [handL[0] - 10, handL[1] + 1]], '#d6ecfa', INK, 0.5);
  arm(g, B.sr, [cx + 6, 25], { sleeve: 'tight', color: PAPER, elbow: 10 });
  const C: Pt = [cx, 14];
  neckHead(g, cx, { turn: -0.2, y: C[1], w: 0.95 });
  eyes(g, cx, C[1] + 1.2, { turn: -0.2, color: '#3a4a6a', brow: INK, tilt: 1.2 });
  // Glasses.
  for (const d of [-1, 1]) {
    g.strokeStyle = INK;
    g.lineWidth = 0.9;
    g.strokeRect(cx - 0.26 + d * 2.9 - 2.4, C[1] - 0.2, 4.8, 3);
  }
  mouth(g, cx, C[1] + 5.2, 'line', 1.6, -0.2);
  shape(g, hp(C, [[-1.15, 0.3], [-1.15, -0.6], [-0.5, -1.15], [0.5, -1.15], [1.15, -0.6], [1.15, 0.3], [0.85, -0.35], [-0.1, -0.5], [-0.55, 0.45], [-0.75, -0.3]]), INK);
});

// ----------------------------------------------------------------- Aizen

/** Sōsuke Aizen: long wavy brown hair with one lock over his brow, a calm smile, the white of a prisoner bound in black restraints, and Kyōka Suigetsu at his side. */
export const aizen = fig((g, cx) => {
  const C: Pt = [cx, 14];
  shape(g, hp(C, [[-1.25, -0.3], [1.25, -0.3], [1.5, 1.5], [1.25, 2.4], [-1.25, 2.4], [-1.5, 1.5]]), AIZEN_BROWN, INK, 1);
  const B = bodyFrame(cx);
  hakama(g, B, { stance: 13, hakama: PAPER, tabi: INK });
  kosode(g, B, { kosode: PAPER, obi: INK, collar: INK });
  // The restraints: black straps across his chest and round his arms.
  for (const d of [-1, 1]) shape(g, [[cx + d * 10, 26], [cx + d * 7, 26], [cx - d * 9, 46], [cx - d * 6, 47]], INK);
  shape(g, [[cx - 9, 37], [cx + 9, 37], [cx + 9, 40], [cx - 9, 40]], INK);
  sheath(g, [cx + 8, 50], 2.2);
  arm(g, B.sl, [cx - 15, 54], { sleeve: 'square', color: PAPER, elbow: -2 });
  arm(g, B.sr, [cx + 14, 54], { sleeve: 'square', color: PAPER, elbow: 2 });
  for (const s of [B.sl, B.sr]) shape(g, [[s[0] - 4, s[1] + 12], [s[0] + 4, s[1] + 12], [s[0] + 4, s[1] + 15], [s[0] - 4, s[1] + 15]], INK);
  neckHead(g, cx, { turn: 0.2, y: C[1] });
  eyes(g, cx, C[1] + 1.2, { turn: 0.2, color: '#5a3a2a', brow: AIZEN_BROWN, tilt: 0.4 });
  mouth(g, cx, C[1] + 5.2, 'smile', 1.8, 0.2);
  shape(g, hp(C, [[-1.2, 0.5], [-1.15, -0.6], [-0.4, -1.15], [0.5, -1.15], [1.15, -0.6], [1.2, 0.5], [0.85, -0.3], [-0.85, -0.3]]), AIZEN_BROWN, INK, 1);
  // The one lock that falls across his brow.
  ribbon(g, hp(C, [[0.1, -0.8], [0.25, -0.3], [0.05, 0.2]]), 1.8, 1, AIZEN_BROWN, false);
});

// ---------------------------------------------------------------- Ichigo

function ichigoBody(g: Ctx, cx: number): void {
  const B = bodyFrame(cx, { broad: 1.08 });
  hakama(g, B, { stance: 16 });
  // The long black coat over his robes, its hem torn and flaring.
  shape(g, [[cx - 11, 26], [cx + 11, 26], [cx + 18, 60], [cx + 24, 86], [cx + 16, 82], [cx + 12, 88], [cx + 6, 60], [cx - 6, 60], [cx - 12, 88], [cx - 17, 82], [cx - 24, 86], [cx - 18, 60]], INK);
  stroke(g, [[cx - 13, 40], [cx - 18, 80]], 1.1, DARK);
  stroke(g, [[cx + 13, 40], [cx + 18, 80]], 1.1, DARK);
  kosode(g, B);
  // Both blades: the great cleaver in his right hand, the short one in his left.
  const hand: Pt = [cx + 19, 48];
  arm(g, B.sr, hand, { sleeve: 'square', elbow: 3, fist: true });
  g.save();
  g.translate(hand[0], hand[1]);
  g.rotate(-1.15);
  shape(g, [[-8, -1.4], [1, -1.4], [1, 1.4], [-8, 1.4]], INK);
  shape(g, [[1, -4.4], [42, -5.4], [46, 0.4], [40, 5.2], [1, 4.4]], STEEL, INK, 1.1);
  stroke(g, [[4, 2.6], [40, 3]], 1, STEEL_SHADE);
  g.restore();
  const handL: Pt = [cx - 19, 52];
  arm(g, B.sl, handL, { sleeve: 'square', elbow: -3, fist: true });
  katana(g, handL, 2.4, { len: 18, width: 2.8, guard: INK, curve: 0.5 });
}

function ichigoHair(g: Ctx, C: Pt): void {
  shape(g, hp(C, [[-1.15, 0.2], [-1.7, -0.3], [-1.15, -0.65], [-1.5, -1.25], [-0.7, -1.05], [-0.6, -1.8], [-0.05, -1.2], [0.35, -1.9], [0.6, -1.15], [1.35, -1.55], [1.1, -0.75], [1.75, -0.55], [1.15, 0.25], [0.85, -0.3], [0.4, -0.2], [0.15, 0.3], [-0.1, -0.3], [-0.55, -0.2], [-0.85, 0.3]]), ORANGE, INK, 1);
}

/** Ichigo Kurosaki: spiked orange hair, a scowl, the long black coat over his robes, and both of his blades. */
export const ichigo = fig((g, cx) => {
  ichigoBody(g, cx);
  const C: Pt = [cx, 15];
  neckHead(g, cx, { turn: 0.2, y: C[1], jaw: 0.5 });
  eyes(g, cx, C[1] + 1.2, { turn: 0.2, color: '#6a3a1a', brow: ORANGE, tilt: 1.8 });
  // The scowl line between his brows.
  stroke(g, [[cx + 0.2, C[1] - 1.8], [cx + 0.4, C[1] - 0.6]], 0.8);
  mouth(g, cx, C[1] + 5.2, 'frown', 1.8, 0.2);
  ichigoHair(g, C);
});

/** Ichigo with his Hollow mask: white, red stripes down its left side, black eyes with yellow irises, its teeth bared. */
export const ichigoMask = fig((g, cx) => {
  ichigoBody(g, cx);
  const C: Pt = [cx, 15];
  limb(g, [cx + 0.3, C[1] + 5], [cx, C[1] + 12], 4.6, 5.2, SKIN);
  shape(g, hp(C, [[-1.15, 0.1], [-1.1, -0.85], [0, -1.15], [1.1, -0.85], [1.15, 0.1], [0.75, 0.85], [0.2, 1.1], [-0.6, 0.95]]), BONE, INK, 1.2);
  // The red stripes down its left side.
  for (const u of [-0.95, -0.6]) shape(g, hp(C, [[u, -0.9], [u + 0.18, -0.9], [u + 0.22, 0.85], [u + 0.04, 0.8]]), BLOOD);
  for (const d of [-1, 1]) {
    oval(g, cx + 0.3 + d * 2.8, C[1] + 0.6, 2.4, 1.6, d * 0.2, INK);
    disc(g, cx + 0.3 + d * 2.8, C[1] + 0.6, 0.8, '#f0c830');
  }
  shape(g, hp(C, [[-0.55, 0.55], [0.6, 0.55], [0.5, 0.85], [-0.45, 0.85]]), INK);
  for (let k = -2; k <= 2; k++) stroke(g, hp(C, [[k * 0.2, 0.55], [k * 0.2, 0.85]]), 0.6, BONE);
  ichigoHair(g, C);
});

// ------------------------------------------------------------------ Sado

const CHAD_SHIRT = '#3a3a52';

function chadBody(g: Ctx, cx: number, late: boolean): void {
  const B = bodyFrame(cx, { broad: 1.3 });
  for (const d of [-1, 1]) limb(g, [cx + d * 6, 52], [cx + d * 14, 93], 9, 7, '#2a2a36');
  for (const d of [-1, 1]) shape(g, [[cx + d * 14 - 4, 92], [cx + d * 14 + 4, 92], [cx + d * 14 + 4.8, 97], [cx + d * 14 - 4.8, 97]], INK);
  shape(g, [[B.sl[0], B.sl[1]], [B.sr[0], B.sr[1]], [cx + 12, 54], [cx - 12, 54]], CHAD_SHIRT, INK, 1.2);
  stroke(g, [[cx, 26], [cx, 52]], 1, DARK);
  // The Giant's right arm: black armour, a shield at the shoulder.
  const r0: Pt = [cx + 14, 30];
  const rFist: Pt = [cx + 26, 62];
  limb(g, r0, rFist, 10, 12, '#1c1c26');
  stroke(g, [along(r0, rFist, 0.3, -5), along(r0, rFist, 0.3, 5)], 1.4, '#5a5a6a');
  shape(g, [[cx + 8, 22], [cx + 26, 20], [cx + 30, 34], [cx + 16, 40]], '#1c1c26', INK, 1.3);
  stroke(g, [[cx + 12, 26], [cx + 26, 25]], 1.2, '#c8283a');
  disc(g, rFist[0], rFist[1] + 2, 7, '#1c1c26');
  // The Devil's left arm: white and red, a blade of a shield on its forearm.
  const l0: Pt = [cx - 14, 30];
  const lFist: Pt = [cx - 24, 60];
  limb(g, l0, lFist, 9, 10, PAPER);
  for (const t of [0.3, 0.55, 0.8]) stroke(g, [along(l0, lFist, t, -4), along(l0, lFist, t + 0.06, 4)], 1.6, '#c8283a');
  shape(g, [along(l0, lFist, 0.4, 5), along(l0, lFist, 0.6, 14), along(l0, lFist, 1, 6)], PAPER, INK, 1.1);
  disc(g, lFist[0], lFist[1] + 2, 6, PAPER);
  if (late) {
    // La Muerte: both fists burning.
    for (const f of [rFist, lFist]) {
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k - 2) * 0.45;
        shape(g, [[f[0] + Math.cos(a - 0.3) * 6, f[1] + Math.sin(a - 0.3) * 6], [f[0] + Math.cos(a) * 16, f[1] + Math.sin(a) * 16], [f[0] + Math.cos(a + 0.3) * 6, f[1] + Math.sin(a + 0.3) * 6]], '#ff6a3c', INK, 0.8);
      }
    }
  }
  const C: Pt = [cx, 14];
  neckHead(g, cx, { turn: 0.1, y: C[1], w: 1.1, jaw: 1, skin: DARK_SKIN, shade: DARK_SKIN_SHADE });
  mouth(g, cx, C[1] + 5.4, 'line', 2, 0.1);
  // Wavy hair falling over his eyes.
  shape(g, hp(C, [[-1.2, 0.5], [-1.3, -0.6], [-0.6, -1.2], [0.6, -1.2], [1.3, -0.6], [1.2, 0.5], [0.85, 0.3], [0.55, 0.6], [0.2, 0.35], [-0.15, 0.6], [-0.5, 0.35], [-0.85, 0.55]], 1.05), '#2a1a12', INK, 1);
}

/** Yasutora Sado: tall and broad, his eyes hidden under his hair, his Fullbring on both arms, the Giant's right, black with a shield at the shoulder, and the Devil's left, white and red. */
export const chad = fig((g, cx) => chadBody(g, cx, false));

/** Sado with both arms together, La Muerte, his fists burning. */
export const chadLate = fig((g, cx) => chadBody(g, cx, true));

// --------------------------------------------------------------- Orihime

function orihimeBody(g: Ctx, cx: number): void {
  const C: Pt = [cx, 14];
  // Long orange hair to her waist.
  shape(g, hp(C, [[-1.2, -0.4], [1.2, -0.4], [1.45, 2.4], [1.3, 4.5], [0.5, 3.8], [-0.5, 3.8], [-1.3, 4.5], [-1.45, 2.4]]), ORANGE, INK, 1);
  for (const d of [-1, 1]) {
    limb(g, [cx + d * 4, 62], [cx + d * 8, 92], 4.6, 3.8, SKIN);
    shape(g, [[cx + d * 8 - 2.6, 84], [cx + d * 8 + 2.6, 84], [cx + d * 8 + 2.6, 92], [cx + d * 8 - 2.6, 92]], PAPER);
    shape(g, [[cx + d * 8 - 3, 92], [cx + d * 8 + 3, 92], [cx + d * 8 + 3.6, 96], [cx + d * 8 - 3.2, 96]], INK);
  }
  // The school uniform: a grey skirt, a white blouse with a red bow.
  shape(g, [[cx - 9, 46], [cx + 9, 46], [cx + 13, 64], [cx - 13, 64]], '#6a6a7a', INK, 1.1);
  for (const x of [-6, -2, 2, 6]) stroke(g, [[cx + x * 0.8, 48], [cx + x * 1.3, 63]], 0.8, INK);
  shape(g, [[cx - 9.5, 26], [cx + 9.5, 26], [cx + 9, 47], [cx - 9, 47]], PAPER, INK, 1.1);
  shape(g, [[cx - 3, 26], [cx + 3, 26], [cx, 31]], '#c8283a', INK, 0.7);
  arm(g, [cx - 9, 28], [cx - 13, 50], { sleeve: 'tight', color: PAPER, elbow: -2 });
  arm(g, [cx + 9, 28], [cx + 13, 50], { sleeve: 'tight', color: PAPER, elbow: 2 });
  neckHead(g, cx, { turn: 0.15, y: C[1], w: 0.94 });
  eyes(g, cx, C[1] + 1.4, { turn: 0.15, color: '#6a4a2a', brow: ORANGE, tilt: 0.2, kind: 'wide' });
  mouth(g, cx, C[1] + 5.4, 'smile', 1.4, 0.15);
  shape(g, hp(C, [[-1.2, 0.7], [-1.15, -0.6], [-0.4, -1.15], [0.5, -1.15], [1.15, -0.6], [1.2, 0.7], [0.85, -0.2], [0.1, -0.5], [-0.85, -0.2]]), ORANGE, INK, 1);
  // The two blue flower pins of Shun Shun Rikka.
  for (const d of [-1, 1]) {
    const [x, y] = hp(C, [[d * 0.95, -0.45]])[0];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU;
      disc(g, x + Math.cos(a) * 1.4, y + Math.sin(a) * 1.4, 0.9, '#5aa8e8');
    }
  }
}

/** Orihime Inoue: long orange hair, the two blue flower pins that hold Shun Shun Rikka, her school uniform. */
export const orihime = fig((g, cx) => orihimeBody(g, cx));

/** Orihime later: all six of Shun Shun Rikka's spirits about her inside the golden oval of Sōten Kisshun. */
export const orihimeLate = fig((g, cx) => {
  g.beginPath();
  g.ellipse(cx, 52, 30, 44, 0, 0, TAU);
  g.strokeStyle = GOLD;
  g.lineWidth = 3;
  g.stroke();
  g.beginPath();
  g.ellipse(cx, 52, 26, 40, 0, 0, TAU);
  g.strokeStyle = '#f0d890';
  g.lineWidth = 1;
  g.stroke();
  orihimeBody(g, cx);
  // The six spirits: little winged figures round the oval.
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + 0.3;
    const x = cx + Math.cos(a) * 32;
    const y = 52 + Math.sin(a) * 44;
    shape(g, [[x - 4, y - 2], [x, y - 1], [x + 4, y - 2], [x + 1, y + 1], [x - 1, y + 1]], '#bfe6ff', INK, 0.7);
    disc(g, x, y - 3, 1.7, SKIN);
    limb(g, [x, y - 1], [x, y + 4], 2, 1.4, '#5aa8e8');
  }
});

// --------------------------------------------------------------- Yoruichi

const YORU_HAIR = '#5a3a8a';
const YORU_SASH = '#e07a2a';

/** Yoruichi Shihōin, the Flash Goddess: dark skin, violet hair tied back, gold eyes, the backless black of the Onmitsukidō with an orange sash. */
export const yoruichi = fig((g, cx) => {
  const C: Pt = [cx, 14];
  ribbon(g, [[cx - 2, 8], [cx - 10, 10], [cx - 18, 18], [cx - 24, 30]], 6, 2.4, YORU_HAIR);
  const B = bodyFrame(cx, { broad: 0.9 });
  hakama(g, B, { stance: 16 });
  kosode(g, B, { obi: YORU_SASH, collar: INK });
  arm(g, B.sl, [cx - 19, 40], { sleeve: 'bare', skin: DARK_SKIN, elbow: -3, fist: true });
  arm(g, B.sr, [cx + 16, 52], { sleeve: 'bare', skin: DARK_SKIN, elbow: 3, fist: true });
  neckHead(g, cx, { turn: 0.3, y: C[1], w: 0.94, skin: DARK_SKIN, shade: DARK_SKIN_SHADE });
  eyes(g, cx, C[1] + 1.3, { turn: 0.3, color: '#e0a020', brow: YORU_HAIR, tilt: 1.1 });
  mouth(g, cx, C[1] + 5.2, 'smile', 1.6, 0.4);
  shape(g, hp(C, [[-1.15, 0.4], [-1.12, -0.6], [-0.4, -1.15], [0.5, -1.15], [1.12, -0.6], [1.15, 0.3], [0.8, -0.35], [-0.8, -0.3]]), YORU_HAIR, INK, 1);
});

/** Yoruichi in Shunkō's last form, Raijin Senki: her hair standing up white and wild, lightning all about her, claws, crouched to spring. */
export const yoruichiLate = fig((g, cx) => {
  const C: Pt = [cx - 2, 22];
  for (let k = 0; k < 5; k++) zigzag(g, [cx - 40 + k * 20, 6 + (k % 2) * 14], [cx - 30 + k * 18, 70 + (k % 3) * 8], k * 7 + 3, 1.6, '#ffe27a', 5);
  // Hair standing up in a white mane.
  for (let k = 0; k < 9; k++) {
    const a = -Math.PI / 2 + (k - 4) * 0.3;
    shape(g, [[C[0] + Math.cos(a - 0.25) * 6, C[1] + Math.sin(a - 0.25) * 6], [C[0] + Math.cos(a) * 22, C[1] + Math.sin(a) * 22], [C[0] + Math.cos(a + 0.25) * 6, C[1] + Math.sin(a + 0.25) * 6]], PAPER, INK, 0.9);
  }
  for (const d of [-1, 1]) {
    limb(g, [cx + d * 5, 60], [cx + d * 17, 74], 6.4, 5, INK);
    limb(g, [cx + d * 17, 74], [cx + d * 13, 94], 5, 4, DARK_SKIN);
  }
  shape(g, [[cx - 10, 32], [cx + 10, 32], [cx + 8, 60], [cx - 8, 60]], INK);
  shape(g, [[cx - 8.6, 54], [cx + 8.6, 54], [cx + 8.4, 57.6], [cx - 8.4, 57.6]], YORU_SASH);
  for (const d of [-1, 1]) {
    const hand: Pt = [cx + d * 24, 54];
    arm(g, [cx + d * 10, 34], hand, { sleeve: 'bare', skin: DARK_SKIN, elbow: d * 3 });
    for (let k = 0; k < 4; k++) shape(g, [[hand[0] - 1, hand[1]], [hand[0] + 1, hand[1]], [hand[0] + d * (1 + k * 1.6), hand[1] + 8]], PAPER, INK, 0.5);
  }
  neckHead(g, C[0], { turn: 0.3, y: C[1], w: 0.94, skin: DARK_SKIN, shade: DARK_SKIN_SHADE });
  eyes(g, C[0], C[1] + 1.2, { turn: 0.3, color: '#f0c020', brow: PAPER, tilt: 2, kind: 'wide' });
  mouth(g, C[0], C[1] + 5, 'teeth', 2.2, 0.3);
});

// ------------------------------------------------------------------ Isshin

function isshinBody(g: Ctx, cx: number, sash: boolean): void {
  const B = bodyFrame(cx, { broad: 1.12 });
  hakama(g, B, { stance: 15 });
  kosode(g, B);
  if (sash) {
    // The captain's haori again, worn like a sash over one shoulder, its tail flying.
    ribbon(g, [[cx - 10, 26], [cx, 34], [cx + 10, 44], [cx + 22, 50], [cx + 32, 46], [cx + 40, 52]], 9, 6, PAPER);
    for (let k = 0; k < 4; k++) shape(g, [[cx + 26 + k * 3.4, 49 - k * 0.3], [cx + 27.2 + k * 3.4, 50.5], [cx + 26 + k * 3.4, 52], [cx + 24.8 + k * 3.4, 50.5]], INK);
  }
  arm(g, B.sl, [cx - 17, 50], { sleeve: 'square', elbow: -3, fist: true });
  const hand: Pt = [cx + 19, 44];
  arm(g, B.sr, hand, { sleeve: 'square', elbow: 3, fist: true });
  // Engetsu: broad and heavy, a round guard.
  disc(g, hand[0] + 2, hand[1] - 1.4, 3.6, GOLD);
  katana(g, hand, -0.95, { len: 40, width: 4.4, curve: 1.2, guard: GOLD });
  const C: Pt = [cx, 14];
  neckHead(g, cx, { turn: 0.2, y: C[1], jaw: 0.6 });
  eyes(g, cx, C[1] + 1.2, { turn: 0.2, color: '#3a2a1a', brow: INK, tilt: 1.2 });
  mouth(g, cx, C[1] + 5.2, 'grin', 2.6, 0.2);
  for (const [u, v] of [[-0.3, 0.88], [0, 0.95], [0.3, 0.88], [0.5, 0.75], [-0.5, 0.75]] as const) {
    const [x, y] = hp(C, [[u, v]])[0];
    disc(g, x, y, 0.38, INK);
  }
  shape(g, hp(C, [[-1.15, 0.1], [-1.25, -0.6], [-0.7, -1.2], [0.1, -1.3], [0.8, -1.15], [1.25, -0.6], [1.15, 0.1], [0.85, -0.45], [0.3, -0.65], [-0.4, -0.5], [-0.85, -0.3]]), INK);
}

/** Isshin Kurosaki: a doctor who was once Captain Isshin Shiba of the 10th Division. Short black hair, stubble, a grin, the Soul Reaper's black, and Engetsu, broad and heavy, in his hand. */
export const isshin = fig((g, cx) => isshinBody(g, cx, false));

/** Isshin with the captain's haori on him again. */
export const isshinLate = fig((g, cx) => isshinBody(g, cx, true));

// ----------------------------------------------------------------- Urahara

function uraharaBody(g: Ctx, cx: number): void {
  const B = bodyFrame(cx);
  hakama(g, B, { stance: 13, hakama: '#2a3a2a', tabi: '#c8a868' });
  kosode(g, B, { kosode: '#2a3a2a', obi: PAPER, collar: '#2a3a2a' });
  // The dark green haori, short, white diamonds along its hem.
  for (const d of [-1, 1]) {
    shape(g, [[cx + d * 3.6, 24.4], [cx + d * 14, 26], [cx + d * 17, 72], [cx + d * 5, 73], [cx + d * 4.6, 32]], URAHARA_GREEN, INK, 1.1);
    for (let k = 0; k < 3; k++) {
      const x = cx + d * (7.5 + k * 3.4);
      shape(g, [[x, 68.5], [x + 1.3, 70], [x, 71.5], [x - 1.3, 70]], PAPER);
    }
  }
  // Benihime as a cane, the geta under his feet.
  const hand: Pt = [cx + 17, 52];
  shape(g, [[hand[0] - 1.2, 40], [hand[0] + 1.2, 40], [hand[0] + 2, 96], [hand[0] - 0.2, 96]], '#6a4a2a', INK, 0.8);
  shape(g, [[hand[0] - 2, 36], [hand[0] + 4, 36], [hand[0] + 4, 40], [hand[0] - 2, 40]], '#6a4a2a', INK, 0.8);
  arm(g, B.sl, [cx - 6, 50], { sleeve: 'square', color: URAHARA_GREEN, elbow: -5 });
  arm(g, B.sr, hand, { sleeve: 'square', color: URAHARA_GREEN, elbow: 3 });
  for (const d of [-1, 1]) shape(g, [[cx + d * 13 - 5, 96], [cx + d * 13 + 5, 96], [cx + d * 13 + 5, 98.5], [cx + d * 13 - 5, 98.5]], '#8a6a3a', INK, 0.7);
  const C: Pt = [cx, 15];
  neckHead(g, cx, { turn: 0.15, y: C[1] });
  // The eyes lost under his hat's brim.
  eyes(g, cx, C[1] + 0.6, { turn: 0.15, kind: 'glare' });
  mouth(g, cx, C[1] + 5.2, 'smile', 1.8, 0.4);
  for (const [u, v] of [[-0.3, 0.88], [0, 0.95], [0.3, 0.88]] as const) {
    const [x, y] = hp(C, [[u, v]])[0];
    disc(g, x, y, 0.35, INK);
  }
  shape(g, hp(C, [[-1.3, 0.6], [-1.2, -0.2], [1.2, -0.2], [1.3, 0.6], [0.9, 0.1], [-0.9, 0.1]]), '#d8c070', INK, 0.9);
  // The striped bucket hat, tipped low.
  shape(g, hp(C, [[-1.7, -0.05], [-1.2, -1.15], [1.2, -1.2], [1.7, -0.05], [1.1, -0.3], [-1.1, -0.25]]), URAHARA_GREEN, INK, 1.1);
  for (const v of [-0.95, -0.6]) shape(g, hp(C, [[-1.28, v], [1.28, v - 0.03], [1.36, v + 0.16], [-1.36, v + 0.18]]), PAPER);
}

/** Kisuke Urahara: the shopkeeper of Karakura, once Captain of the 12th Division. A striped bucket hat over his eyes, a dark green haori with white diamonds at the hem, wooden geta, and a cane that is Benihime. */
export const urahara = fig((g, cx) => uraharaBody(g, cx));

/** Urahara's bankai: Kannonbiraki Benihime Aratame stands behind him, a great figure in red with a needle that remakes whatever it touches. */
export const uraharaBankai = fig((g, cx) => {
  // The figure behind him: a woman in red, long black hair, a white face, a needle in her hand.
  const F: Pt = [cx - 6, 20];
  shape(g, [[F[0] - 14, 26], [F[0] + 14, 26], [F[0] + 30, 92], [F[0] - 32, 92]], '#b0202e', INK, 1.3);
  shape(g, [[F[0] - 9, 8], [F[0] + 9, 8], [F[0] + 12, 40], [F[0] - 12, 40]], INK);
  oval(g, F[0], F[1], 7, 8.6, 0, '#f4f0e8');
  g.strokeStyle = INK;
  g.lineWidth = 1.1;
  g.beginPath();
  g.ellipse(F[0], F[1], 7, 8.6, 0, 0, TAU);
  g.stroke();
  for (const d of [-1, 1]) stroke(g, [[F[0] + d * 4.4, F[1] - 0.6], [F[0] + d * 1.4, F[1]]], 1.1);
  shape(g, [[F[0] - 1.4, F[1] + 4.6], [F[0] + 1.4, F[1] + 4.6], [F[0], F[1] + 5.8]], BLOOD);
  limb(g, [F[0] - 14, 30], [F[0] - 32, 16], 6, 4.4, '#b0202e');
  stroke(g, [[F[0] - 33, 16], [F[0] - 44, 2]], 1.6, STEEL);
  uraharaBody(g, cx + 10);
});

// ------------------------------------------------------------- runaways

/** Ganju Shiba on Bonnie: the Shiba clan's fireworks man in his bandana, riding his great boar, a sack of fireworks over his shoulder. */
export const ganju = fig((g, cx) => {
  // Bonnie.
  for (const x of [-16, -6, 10, 18]) limb(g, [cx + x, 70], [cx + x - 2, 94], 6, 5, '#6a4a2a');
  blob(g, [[cx - 30, 62], [cx - 20, 46], [cx + 14, 44], [cx + 30, 56], [cx + 26, 76], [cx - 24, 78]], '#6a4a2a', INK, 1.6);
  for (const d of [-1, 1]) shape(g, [[cx - 28, 62 + d * 4], [cx - 40, 58 + d * 8], [cx - 30, 66 + d * 2]], BONE, INK, 1);
  disc(g, cx - 22, 56, 1.8, INK);
  // Ganju astride.
  limb(g, [cx + 2, 46], [cx + 10, 62], 6, 5, INK);
  shape(g, [[cx - 6, 26], [cx + 8, 26], [cx + 9, 48], [cx - 7, 48]], INK);
  limb(g, [cx + 6, 30], [cx + 16, 40], 5, 4, SKIN);
  blob(g, [[cx + 6, 6], [cx + 22, 8], [cx + 24, 26], [cx + 10, 28]], '#c8a868', INK, 1.4);
  neckHead(g, cx + 1, { turn: 0.3, y: 16, w: 1.1, jaw: 1 });
  eyes(g, cx + 1, 17, { turn: 0.3, brow: INK, tilt: 1.4 });
  mouth(g, cx + 1, 21.4, 'grin', 2.4, 0.3);
  shape(g, hp([cx + 1, 16], [[-1.15, -0.3], [-1.1, -1], [1.1, -1], [1.15, -0.3]]), '#c8283a', INK, 1);
  ribbon(g, hp([cx + 1, 16], [[-1.1, -0.6], [-1.9, -0.3], [-2.5, 0.3]]), 2.6, 1.4, '#c8283a');
});

/** Don Kanonji, Karakura's runaway: the television spiritualist in his dark glasses and caped coat, a skull-topped cane in one hand and the show's prize money in the other. */
export const kanonji = fig((g, cx) => {
  shape(g, [[cx - 10, 24], [cx + 10, 24], [cx + 22, 86], [cx - 22, 86]], '#2a2a46', INK, 1.4);
  for (const d of [-1, 1]) limb(g, [cx + d * 5, 60], [cx + d * 10, 94], 6, 5, INK);
  shape(g, [[cx - 10, 26], [cx + 10, 26], [cx + 12, 64], [cx - 12, 64]], PAPER, INK, 1.2);
  shape(g, [[cx - 11, 46], [cx + 11, 46], [cx + 11, 50], [cx - 11, 50]], INK);
  // The cane, its skull.
  limb(g, [cx + 18, 44], [cx + 20, 94], 2, 2, '#6a4a2a');
  disc(g, cx + 18, 42, 3.4, BONE);
  disc(g, cx + 17, 41.6, 0.8, INK);
  disc(g, cx + 19.4, 41.6, 0.8, INK);
  limb(g, [cx + 10, 30], [cx + 18, 46], 5, 4, PAPER);
  // The prize money.
  limb(g, [cx - 10, 30], [cx - 18, 24], 5, 4, PAPER);
  shape(g, [[cx - 26, 14], [cx - 14, 14], [cx - 14, 24], [cx - 26, 24]], '#7ab868', INK, 1);
  const C = neckHead(g, cx, { turn: 0.1, y: 14, w: 1.05, jaw: 0.5 });
  for (const d of [-1, 1]) disc(g, cx + 0.2 + d * 2.9, C[1] + 1, 2.4, INK);
  stroke(g, [[cx - 0.8, C[1] + 0.6], [cx + 1.2, C[1] + 0.6]], 0.8);
  mouth(g, cx, C[1] + 5, 'grin', 3, 0.1);
  shape(g, hp(C, [[-1.2, 0], [-1.3, -1.1], [0, -1.7], [1.3, -1.1], [1.2, 0], [0.8, -0.6], [-0.8, -0.6]]), INK);
});

/** Kon: a mod soul in a stuffed lion, mane bristling, arms up, running for it. */
export const kon = fig((g, cx) => {
  const PLUSH = '#e8c060';
  for (const d of [-1, 1]) limb(g, [cx + d * 5, 70], [cx + d * 10, 92], 7, 7, PLUSH);
  blob(g, [[cx - 12, 52], [cx + 12, 52], [cx + 14, 78], [cx - 14, 78]], PLUSH, INK, 1.6);
  for (const d of [-1, 1]) limb(g, [cx + d * 11, 56], [cx + d * 22, 38], 6, 6, PLUSH);
  // The mane, and his face stitched on.
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU;
    shape(g, [[cx + Math.cos(a - 0.3) * 12, 34 + Math.sin(a - 0.3) * 12], [cx + Math.cos(a) * 21, 34 + Math.sin(a) * 20], [cx + Math.cos(a + 0.3) * 12, 34 + Math.sin(a + 0.3) * 12]], '#c87a2a', INK, 1);
  }
  disc(g, cx, 34, 15, PLUSH);
  g.strokeStyle = INK;
  g.lineWidth = 1.4;
  g.beginPath();
  g.arc(cx, 34, 15, 0, TAU);
  g.stroke();
  for (const d of [-1, 1]) disc(g, cx + d * 5.6, 31, 2.4, INK);
  mouth(g, cx, 40, 'teeth', 5, 0);
  stroke(g, [[cx, 46], [cx, 52]], 1.2);
});

