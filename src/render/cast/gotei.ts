import {
  along,
  arm,
  BLOOD,
  bodyFrame,
  crystal,
  type Ctx,
  DARK,
  disc,
  eyes,
  fig,
  GOLD,
  GOLD_SHADE,
  hakama,
  haori,
  haoriSleeve,
  head,
  hp,
  INK,
  katana,
  kosode,
  LIGHT,
  limb,
  mouth,
  PAPER,
  petals,
  type Pt,
  ribbon,
  scaled,
  shape,
  SKIN,
  STEEL,
  stroke,
  zigzag,
} from './kit';

/**
 * The Gotei 13 as manga homages: the captains who fight the Emperor in the
 * first invasion, the Captain-Commander, Unohana, and Silbern's captains.
 * Each is known by a silhouette first (hair, what they carry, how the haori
 * falls), the face second.
 */

const SILVER = '#bfc5d0';
const SCAR = '#9a3a3a';

/** Neck and head at the standard place; returns the head centre. */
function neckHead(g: Ctx, cx: number, o: { turn?: number; y?: number; w?: number; h?: number; jaw?: number; skin?: string } = {}): Pt {
  const y = o.y ?? 14;
  limb(g, [cx + 0.3, y + 5], [cx, y + 12], 4.6, 5.2, o.skin ?? SKIN);
  head(g, cx, y, { turn: o.turn, w: o.w, h: o.h, jaw: o.jaw, skin: o.skin });
  return [cx, y];
}

/**
 * Byakuya Kuchiki: long straight black hair held by the white kenseikan, the
 * silver scarf streaming out behind him, calm narrow eyes, Senbonzakura held
 * low, its petals drifting round him.
 */
export const byakuya = fig((g, cx) => {
  const B = bodyFrame(cx);
  const C: Pt = [cx, 14];
  // The scarf, streaming away on the wind.
  ribbon(g, [[cx - 2, 25], [cx - 9, 31], [cx - 13, 40], [cx - 17, 49], [cx - 24, 55], [cx - 31, 57], [cx - 36, 62]], 7.5, 4.5, SILVER);
  // Hair falling behind the shoulders.
  shape(g, hp(C, [[-1.1, -0.4], [1.1, -0.4], [1.3, 1.65], [0.6, 1.5], [-0.6, 1.5], [-1.35, 1.75]]), INK);
  hakama(g, B);
  kosode(g, B);
  haori(g, B, { flutter: -5 });
  const elL = arm(g, B.sl, [cx - 14.5, 53], { sleeve: 'tight', elbow: -2 });
  haoriSleeve(g, B.sl, elL);
  const hand: Pt = [cx + 19, 49];
  const elR = arm(g, B.sr, hand, { sleeve: 'tight', elbow: 2 });
  haoriSleeve(g, B.sr, elR);
  // The white tekkō on the sword hand.
  disc(g, hand[0], hand[1], 2.4, PAPER);
  katana(g, hand, 1.05, { len: 37 });
  // The scarf where it wraps his neck.
  shape(g, [[cx - 6.6, 22.5], [cx + 6.6, 22], [cx + 7, 26.5], [cx - 7, 27]], SILVER, INK, 1);
  neckHead(g, cx, { turn: 0.3 });
  eyes(g, cx, 15, { turn: 0.3, color: '#3d4258', brow: INK, tilt: 0.5 });
  mouth(g, cx, 19.4, 'line', 1.8, 0.3);
  // The fringe: straight, parted, a strand falling between the eyes.
  shape(g, hp(C, [[-1.12, 0.05], [-1.05, -0.85], [-0.4, -1.22], [0.5, -1.22], [1.1, -0.82], [1.14, 0.1], [0.82, -0.42], [0.32, -0.52], [0.16, 0.28], [-0.04, -0.52], [-0.62, -0.42]]), INK);
  // Kenseikan: white tubes clipping the hair at the crown, and one at the temple.
  for (const [u, v, a] of [
    [-0.72, -0.98, -0.55],
    [-0.22, -1.18, -0.15],
    [0.32, -1.14, 0.25],
  ] as const) {
    const [x, y] = hp(C, [[u, v]])[0];
    g.save();
    g.translate(x, y);
    g.rotate(a);
    shape(g, [[-1.1, -3.6], [1.1, -3.6], [1.1, 1.4], [-1.1, 1.4]], PAPER, INK, 0.8);
    g.restore();
  }
  shape(g, hp(C, [[-1.36, -0.05], [-1.08, -0.05], [-1.08, 0.95], [-1.36, 0.95]]), PAPER, INK, 0.8);
  petals(g, 7, 11, [cx - 46, 18, cx + 46, 92], '#f2a2bd');
});

/**
 * Genryūsai Yamamoto, the Captain-Commander: bald and scarred, long white
 * brows and a beard bound with a band, the haori hung from his shoulders
 * like a cloak, and Ryūjin Jakka sealed as the cane in his hand.
 */
function yamamotoDraw(g: Ctx, cx: number, strike: boolean): void {
  const B = bodyFrame(cx, { broad: 1.05 });
  const C: Pt = [cx, 14.5];
  // The haori, draped from the shoulders as a cloak, falling wide.
  shape(g, [[cx - 12, 25], [cx + 12, 25], [cx + 25, 84], [cx + 9, 87], [cx - 8, 88], [cx - 27, 83]], PAPER, INK, 1.1);
  for (let k = 0; k <= 13; k++) {
    const x = cx - 25 + k * 3.9;
    const y = 83.6 + (k / 13) * 1.4;
    shape(g, [[x, y - 1.6], [x + 1.3, y], [x, y + 1.6], [x - 1.3, y]], INK);
  }
  stroke(g, [[cx - 15, 36], [cx - 20, 80]], 1.1, LIGHT);
  stroke(g, [[cx + 14, 36], [cx + 18, 80]], 1.1, LIGHT);
  hakama(g, B, { stance: 12 });
  kosode(g, B, { obi: '#7a5aa8' });
  // His cane: Ryūjin Jakka sealed in plain wood, planted at his side; striking, the blade drawn and burning.
  const hand: Pt = strike ? [cx + 20, 36] : [cx + 18, 50];
  if (!strike) {
    shape(g, [[hand[0] - 1.4, 38], [hand[0] + 1.4, 38], [hand[0] + 2.4, 96], [hand[0] - 0.4, 96]], '#8a5a2c', INK, 0.9);
    shape(g, [[hand[0] - 1.8, 34.5], [hand[0] + 1.8, 34.5], [hand[0] + 1.8, 39], [hand[0] - 1.8, 39]], INK);
  }
  arm(g, B.sl, [cx - 9, 50], { sleeve: 'square', elbow: -3 });
  arm(g, B.sr, hand, { sleeve: 'square', elbow: 3, fist: true });
  if (strike) {
    const tip = katana(g, hand, -0.45, { len: 42, width: 3.2, curve: 1.2 });
    // Ryūjin Jakka's flames running up the blade.
    for (let k = 1; k <= 5; k++) {
      const p = along(hand, tip, k / 5.6);
      const s2 = 3.4 + k * 0.6;
      shape(g, [[p[0] - s2 * 0.6, p[1] + s2 * 0.4], [p[0] + s2 * 0.2, p[1] - s2 * 1.6], [p[0] + s2 * 0.8, p[1] + s2 * 0.3]], '#ff7a3c', INK, 0.7);
      shape(g, [[p[0] - s2 * 0.2, p[1] + s2 * 0.2], [p[0] + s2 * 0.15, p[1] - s2 * 0.8], [p[0] + s2 * 0.4, p[1] + s2 * 0.2]], '#ffd27a');
    }
  }
  // The cloak's shoulders over the arms.
  shape(g, [[cx - 13.5, 24.5], [cx - 4, 23.5], [cx - 9, 35], [cx - 18.5, 38]], PAPER, INK, 1.1);
  shape(g, [[cx + 13.5, 24.5], [cx + 4, 23.5], [cx + 9, 35], [cx + 18.5, 38]], PAPER, INK, 1.1);
  neckHead(g, cx, { turn: 0.15, y: C[1], w: 1.02 });
  // Scars: an X on the crown.
  stroke(g, hp(C, [[-0.55, -0.85], [0.1, -0.42]]), 1, SCAR);
  stroke(g, hp(C, [[0.05, -0.85], [-0.5, -0.4]]), 1, SCAR);
  // Long white brows that hang past the eyes.
  for (const d of [-1, 1]) {
    shape(g, hp(C, [[d * 0.12, -0.3], [d * 0.95, -0.36], [d * 1.45, 0.3], [d * 0.78, 0.06], [d * 0.18, -0.02]]), PAPER, INK, 0.8);
  }
  eyes(g, cx, C[1] + 1.4, { turn: 0.15, kind: 'closed' });
  // The beard: long, white, bound near its end with a purple band.
  shape(g, [[cx - 5.4, C[1] + 3.2], [cx + 5.6, C[1] + 3.2], [cx + 6.2, 24], [cx + 4, 38], [cx + 1.4, 46], [cx - 0.6, 46], [cx - 3.4, 38], [cx - 6, 24]], PAPER, INK, 1);
  stroke(g, [[cx - 1.6, 22], [cx - 0.8, 40]], 0.9, LIGHT);
  stroke(g, [[cx + 2, 22], [cx + 1.8, 38]], 0.9, LIGHT);
  shape(g, [[cx - 3.4, 38], [cx + 3.8, 38], [cx + 3.4, 41], [cx - 3, 41]], '#7a5aa8', INK, 0.8);
  // The moustache.
  shape(g, [[cx - 5, C[1] + 3.8], [cx + 0.2, C[1] + 2.6], [cx + 5.4, C[1] + 3.8], [cx + 6, C[1] + 6.4], [cx + 0.2, C[1] + 4.6], [cx - 5.6, C[1] + 6.4]], PAPER, INK, 0.8);
}

export const yamamoto = fig((g, cx) => yamamotoDraw(g, cx, false));
/** In the strike frame. */
export const yamamotoStrike = fig((g, cx) => yamamotoDraw(g, cx, true));

/**
 * Kenpachi Zaraki: a head of stiff black spikes with a bell tied to each tip,
 * the patch over his right eye, the old scar down the left, a wolf's grin,
 * the haori torn to rags at the hem, and his long nicked blade over his
 * shoulder.
 */
export const kenpachi = fig((g, cx) => {
  const B = bodyFrame(cx, { broad: 1.22 });
  const C: Pt = [cx, 15];
  // The blade first: held high and back over his shoulder.
  const hand: Pt = [cx + 20, 32];
  katana(g, hand, -2.3, { len: 46, width: 3, nicks: true, guard: INK });
  // The spikes, behind the head.
  const tips = hp(C, [[-2.5, -1.4], [-1.6, -2.2], [-0.45, -2.55], [0.8, -2.45], [1.95, -1.85], [2.7, -0.85], [-2.9, -0.3], [2.85, 0.35]]);
  const roots = hp(C, [[-0.7, -0.55], [0.7, -0.6]]);
  for (const t of tips) shape(g, [roots[0], [t[0] - 1.2, t[1] + 1.6], [t[0] + 1.2, t[1]], roots[1]], INK);
  for (const t of tips) {
    disc(g, t[0], t[1] + 0.6, 2.1, GOLD);
    stroke(g, [[t[0] - 1.6, t[1] + 1], [t[0] + 1.6, t[1] + 1]], 0.6);
  }
  hakama(g, B, { stance: 16 });
  kosode(g, B);
  haori(g, B, { sleeves: 'sleeveless', torn: true, flutter: 6, hem: 76 });
  arm(g, B.sl, [cx - 17, 53], { sleeve: 'bare', elbow: -3, fist: true, w: 1.3 });
  arm(g, B.sr, hand, { sleeve: 'bare', elbow: 4, fist: true, w: 1.3 });
  neckHead(g, cx, { turn: -0.2, y: C[1], jaw: 0.7, w: 1.06 });
  // The patch, its cord across the brow.
  stroke(g, hp(C, [[-1.05, -0.32], [1.05, -0.18]]), 0.9);
  shape(g, hp(C, [[0.12, -0.16], [0.85, -0.12], [0.78, 0.42], [0.2, 0.38]]), INK);
  eyes(g, cx - 3.6, C[1] + 1, { turn: -0.2, gap: 0, brow: INK, tilt: 1.5 });
  // The scar down over the left eye.
  stroke(g, hp(C, [[-0.85, -0.6], [-0.55, 0.75]]), 1, SCAR);
  mouth(g, cx, C[1] + 5, 'grin', 2.8, -0.2);
  // A fringe of short spikes over the brow.
  shape(g, hp(C, [[-1.08, -0.2], [-0.8, -0.85], [-0.45, -0.3], [-0.05, -0.95], [0.3, -0.35], [0.75, -0.9], [1.1, -0.15], [1.02, -0.92], [0, -1.22], [-1, -0.92]]), INK);
});

const ICE = '#9cc9ea';
const ICE_DEEP = '#5f93c2';

/**
 * Tōshirō Hitsugaya in Daiguren Hyōrinmaru: small, white hair in stiff
 * spikes, teal eyes, the green sash of his sword across his chest, and the
 * bankai's ice about him: great wings of jagged crystal at his back and an
 * ice dragon's claw for a sword arm.
 */
export const hitsugaya = fig((g, cx) => {
  // The wings, behind everything: two fans of shards.
  for (const d of [-1, 1]) {
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + d * (0.5 + k * 0.32);
      crystal(g, [cx + d * 4, 40], a, 30 - k * 3.2, 7 - k * 0.6, k % 2 ? ICE_DEEP : ICE);
    }
  }
  scaled(g, cx, 96, 0.84, () => {
    const B = bodyFrame(cx, { broad: 0.92 });
    const C: Pt = [cx, 14];
    hakama(g, B, { stance: 12 });
    kosode(g, B);
    haori(g, B, { flutter: 4 });
    const elL = arm(g, B.sl, [cx - 14, 52], { sleeve: 'tight', elbow: -2 });
    haoriSleeve(g, B.sl, elL);
    // The sword arm, cased in ice to a dragon's claw.
    const hand: Pt = [cx + 21, 44];
    const elR = arm(g, B.sr, hand, { sleeve: 'tight', elbow: 3 });
    haoriSleeve(g, B.sr, elR, { long: 12 });
    katana(g, hand, -0.55, { len: 34, blade: '#eaf4fb' });
    shape(g, [[elR[0] - 2, elR[1] - 2], [hand[0] + 3, hand[1] - 4.5], [hand[0] + 6.5, hand[1] - 1], [hand[0] + 4, hand[1] + 3.5], [elR[0] + 1, elR[1] + 4]], ICE, INK, 1);
    for (let k = 0; k < 3; k++) crystal(g, [hand[0] + 2 + k * 1.2, hand[1] - 3 + k * 2.8], -0.3 + k * 0.4, 6, 2, '#eaf4fb');
    // The green sash across his chest.
    shape(g, [[cx - 11, 29], [cx - 7.5, 26], [cx + 11.5, 45], [cx + 8, 48]], '#3f8a5a', INK, 0.9);
    neckHead(g, cx, { turn: 0.2, y: C[1] });
    eyes(g, cx, C[1] + 1.2, { turn: 0.2, color: '#2a8a8a', brow: '#e8edf2', tilt: 1.3 });
    mouth(g, cx, C[1] + 5.2, 'frown', 1.8, 0.2);
    // White hair in hard spikes.
    shape(g, hp(C, [[-1.12, 0.25], [-1.6, -0.55], [-1.05, -0.62], [-1.3, -1.35], [-0.6, -1.05], [-0.4, -1.75], [0.05, -1.15], [0.5, -1.8], [0.62, -1.08], [1.32, -1.42], [1.08, -0.6], [1.62, -0.42], [1.12, 0.22], [0.9, -0.42], [0.42, -0.25], [0.2, 0.32], [-0.12, -0.3], [-0.55, -0.2], [-0.8, 0.3]]), PAPER, INK, 1);
  });
  petals(g, 3, 8, [cx - 40, 30, cx + 40, 92], '#eaf4fb');
});

/**
 * Suì-Fēng with Jakuhō Raikōben: short black hair, two long braids bound in
 * white cloth and ending in gold rings, the backless Onmitsukidō cut, and her
 * bankai, a missile as long as she is tall, braced on her right arm.
 */
export const soifon = fig((g, cx) => {
  const B = bodyFrame(cx, { broad: 0.86 });
  const C: Pt = [cx - 1, 15];
  hakama(g, B, { stance: 13 });
  kosode(g, B);
  haori(g, B, { sleeves: 'sleeveless', hem: 66, flutter: -4 });
  arm(g, B.sl, [cx - 14, 50], { sleeve: 'bare', elbow: -2 });
  // Raikōben: braced on the right arm, its nose aimed high and forward.
  const hand: Pt = [cx + 12, 40];
  arm(g, B.sr, hand, { sleeve: 'bare', elbow: 4 });
  g.save();
  g.translate(hand[0], hand[1]);
  g.rotate(-0.62);
  shape(g, [[-10, -5], [26, -5.4], [34, 0], [26, 5.4], [-10, 5]], GOLD, INK, 1.1);
  shape(g, [[-12, -6.5], [-7, -6.5], [-7, 6.5], [-12, 6.5]], GOLD_SHADE, INK, 1);
  for (const x of [3, 12, 21]) stroke(g, [[x, -5.2], [x, 5.2]], 0.9);
  shape(g, [[-4, -5], [4, -5], [-2, -12], [-8, -12]], GOLD, INK, 1);
  shape(g, [[-4, 5], [4, 5], [-2, 12], [-8, 12]], GOLD, INK, 1);
  g.restore();
  // The braids, bound in white, swinging out from behind her head.
  for (const [d, k] of [[-1, 1], [1, 0.85]] as const) {
    const spine: Pt[] = [[C[0] + d * 3, C[1] + 3], [C[0] + d * 11, C[1] + 9], [C[0] + d * 17 * k, C[1] + 20 * k], [C[0] + d * 20 * k, C[1] + 31 * k]];
    ribbon(g, spine, 3.6, 2.8, PAPER);
    for (let j = 1; j < 4; j++) stroke(g, [along(spine[j - 1], spine[j], 0.5, -1.6), along(spine[j - 1], spine[j], 0.5, 1.6)], 0.8);
    const end = spine[spine.length - 1];
    g.beginPath();
    g.arc(end[0], end[1] + 2.6, 2.6, 0, Math.PI * 2);
    g.strokeStyle = GOLD;
    g.lineWidth = 1.6;
    g.stroke();
  }
  neckHead(g, C[0], { turn: 0.3, y: C[1], w: 0.95 });
  eyes(g, C[0], C[1] + 1.2, { turn: 0.3, color: '#4a3a5a', brow: INK, tilt: 1.4 });
  mouth(g, C[0], C[1] + 5.2, 'line', 1.6, 0.3);
  // Short black hair, cut sharp at the jaw.
  shape(g, hp(C, [[-1.1, 0.55], [-1.12, -0.6], [-0.5, -1.15], [0.55, -1.15], [1.12, -0.6], [1.12, 0.5], [0.9, -0.3], [0.35, -0.35], [0.05, 0.12], [-0.2, -0.38], [-0.82, -0.28]]), INK);
});

/**
 * Sajin Komamura: a towering captain with a wolf's head, its ears up and its
 * muzzle long, a ruff of fur at the collar, armoured forearms, the haori, and
 * a broad blade.
 */
export const komamura = fig((g, cx) => {
  const B = bodyFrame(cx, { broad: 1.55, top: 28, waist: 54 });
  const FUR = '#9a6a3c';
  const C: Pt = [cx + 1, 15];
  const K = 1.4;
  hakama(g, B, { stance: 17 });
  kosode(g, B);
  haori(g, B, { flutter: -5, hem: 82 });
  const handL: Pt = [cx - 20, 55];
  const elL = arm(g, B.sl, handL, { sleeve: 'tight', elbow: -3, w: 1.4, skin: FUR, fist: true });
  haoriSleeve(g, B.sl, elL, { long: 18 });
  const hand: Pt = [cx + 24, 46];
  const elR = arm(g, B.sr, hand, { sleeve: 'tight', elbow: 3, w: 1.4, skin: FUR, fist: true });
  haoriSleeve(g, B.sr, elR, { long: 18 });
  // Armoured forearms.
  for (const [e, h] of [[elL, handL], [elR, hand]] as const) {
    const m: Pt = [(e[0] + h[0]) / 2, (e[1] + h[1]) / 2];
    shape(g, [[m[0] - 3.6, m[1] - 4.5], [m[0] + 3.6, m[1] - 4.5], [m[0] + 3, m[1] + 4], [m[0] - 3, m[1] + 4]], '#5c6270', INK, 1);
  }
  katana(g, hand, -0.95, { len: 44, width: 4.6, curve: 1 });
  // The ruff, then the wolf's head.
  shape(g, [[cx - 14, 30], [cx - 9, 22], [cx - 4, 26], [cx, 21], [cx + 4, 26], [cx + 9, 22], [cx + 14, 30], [cx + 7, 33], [cx - 7, 33]], FUR, INK, 1);
  shape(g, hp(C, [[-1.15, 0.2], [-1.25, -0.6], [-1.05, -1.75], [-0.45, -1.05], [0.45, -1.05], [1.05, -1.75], [1.25, -0.6], [1.15, 0.3], [0.7, 0.9], [-0.6, 0.9]], K), FUR, INK, 1.1);
  // The muzzle, long and pale beneath, the nose black.
  shape(g, hp(C, [[-0.5, 0.15], [0.55, 0.15], [0.62, 1.15], [0.1, 1.4], [-0.45, 1.15]], K), '#d8c3a0', INK, 1);
  shape(g, hp(C, [[-0.22, 0.95], [0.32, 0.95], [0.18, 1.2], [-0.12, 1.2]], K), INK);
  // Inner ears and eyes.
  for (const d of [-1, 1]) shape(g, hp(C, [[d * 0.62, -0.95], [d * 1, -1.5], [d * 0.92, -0.75]], K), INK);
  eyes(g, C[0], C[1] - 0.6, { turn: 0, color: '#c8901e', brow: INK, gap: 4.6, tilt: 1.5 });
});

/**
 * Chōjirō Sasakibe, lieutenant of the 1st Division: grey hair combed back, a
 * clipped grey moustache, the lieutenant's armband, and the rapier of
 * Gonryōmaru held out in a fencer's line, its bankai's lightning about him.
 */
export const sasakibe = fig((g, cx) => {
  const B = bodyFrame(cx - 2, { broad: 0.95 });
  const C: Pt = [cx - 2, 14];
  zigzag(g, [cx - 40, 20], [cx - 22, 60], 5, 1.6, '#f2d45a');
  zigzag(g, [cx + 40, 78], [cx + 26, 40], 9, 1.6, '#f2d45a');
  hakama(g, B, { stance: 15 });
  kosode(g, B);
  // The off hand at the small of his back.
  arm(g, B.sl, [cx - 7, 46], { sleeve: 'square', elbow: -5 });
  // The lieutenant's badge on the left arm.
  shape(g, [[B.sl[0] - 4.4, 33], [B.sl[0] + 2.8, 33], [B.sl[0] + 2.6, 37.5], [B.sl[0] - 4.2, 37.5]], PAPER, INK, 0.9);
  shape(g, [[B.sl[0] - 1.6, 34], [B.sl[0] + 0.2, 34], [B.sl[0] + 0.2, 36.6], [B.sl[0] - 1.6, 36.6]], INK);
  // The sword arm out straight, the rapier's thin blade in line with it.
  const hand: Pt = [cx + 22, 36];
  arm(g, B.sr, hand, { sleeve: 'square', elbow: 1 });
  g.save();
  g.translate(hand[0], hand[1]);
  g.rotate(-0.42);
  shape(g, [[-5, -1], [1, -1], [1, 1], [-5, 1]], INK);
  g.beginPath();
  g.arc(1.6, 0, 3, -Math.PI / 2, Math.PI / 2);
  g.strokeStyle = GOLD;
  g.lineWidth = 1.2;
  g.stroke();
  shape(g, [[2, -0.8], [30, -0.3], [32, 0], [30, 0.4], [2, 0.8]], '#e6ebf2', INK, 0.6);
  g.restore();
  neckHead(g, C[0], { turn: 0.35, y: C[1] });
  eyes(g, C[0], C[1] + 1, { turn: 0.35, color: '#3a3a44', brow: '#9a9aa4', tilt: 0.8 });
  // The moustache, clipped.
  shape(g, [[C[0] - 2.6, C[1] + 4], [C[0] + 4.6, C[1] + 3.8], [C[0] + 5, C[1] + 5.4], [C[0] + 0.6, C[1] + 4.8], [C[0] - 3, C[1] + 5.6]], '#9a9aa4', INK, 0.7);
  // Grey hair combed straight back.
  shape(g, hp(C, [[-1.1, 0.1], [-1.15, -0.55], [-0.7, -1.12], [0.3, -1.2], [1.05, -0.85], [1.15, -0.25], [0.7, -0.62], [0, -0.62], [-0.6, -0.4], [-0.92, 0.25]]), '#9a9aa4', INK, 1);
  stroke(g, hp(C, [[-0.6, -0.8], [0.5, -0.98]]), 0.7, '#5a5a64');
});

function sheathAt(g: Ctx, at: Pt, ang: number): void {
  g.save();
  g.translate(at[0], at[1]);
  g.rotate(ang);
  shape(g, [[-6, -1.3], [0, -1.3], [0, 1.3], [-6, 1.3]], PAPER, INK, 0.6);
  shape(g, [[0, -2.2], [1.2, -2.2], [1.2, 2.2], [0, 2.2]], GOLD);
  shape(g, [[1.2, -1.5], [26, -1.2], [26, 1.2], [1.2, 1.5]], INK);
  g.restore();
}

/**
 * Retsu Unohana, Captain of the 4th Division: her black hair in one thick
 * braid laid down her front, a calm closed-eyed smile, the haori, her hands
 * folded and Minazuki at her side.
 */
export const unohana = fig((g, cx) => {
  const B = bodyFrame(cx, { broad: 0.9 });
  const C: Pt = [cx, 14];
  shape(g, hp(C, [[-1.15, -0.3], [1.15, -0.3], [1.2, 0.9], [-1.2, 0.9]]), INK);
  hakama(g, B, { stance: 9 });
  kosode(g, B);
  haori(g, B, { flutter: 3, hem: 84 });
  sheathAt(g, [cx + 8, 50], 2.2);
  const elL = arm(g, B.sl, [cx - 2, 52], { sleeve: 'tight', elbow: -5 });
  const elR = arm(g, B.sr, [cx + 2, 53], { sleeve: 'tight', elbow: 5 });
  haoriSleeve(g, B.sl, elL, { long: 20 });
  haoriSleeve(g, B.sr, elR, { long: 20 });
  neckHead(g, cx, { turn: 0.1, y: C[1], w: 0.94 });
  eyes(g, cx, C[1] + 1.2, { turn: 0.1, kind: 'closed' });
  mouth(g, cx, C[1] + 5.2, 'smile', 1.6, 0.1);
  // Hair parted in the middle, drawn down over the shoulders into the braid.
  shape(g, hp(C, [[-1.15, 0.6], [-1.12, -0.6], [-0.4, -1.18], [0.45, -1.18], [1.12, -0.6], [1.15, 0.6], [0.85, -0.25], [0.05, -0.62], [-0.85, -0.25]]), INK);
  // The braid, a plait of overlapping lobes down her front.
  for (let k = 0; k < 7; k++) {
    const y = 24 + k * 4.4;
    shape(g, [[cx - 0.4, y - 2.6], [cx + 3.2, y], [cx - 0.2, y + 3], [cx - 3.4, y + 0.4]], INK, DARK, 0.6);
  }
  shape(g, [[cx - 2, 54], [cx + 2.2, 54], [cx + 1.4, 60], [cx - 1.4, 60]], INK);
});

/**
 * Unohana as the first Kenpachi: the braid undone and her hair let loose,
 * the old scar across her chest bared at last, her eyes open, and Minazuki's
 * blade drawn and running red.
 */
export const unohanaKenpachi = fig((g, cx) => {
  const B = bodyFrame(cx, { broad: 0.9 });
  const C: Pt = [cx, 14];
  // Loose hair falling to the waist, lifting on one side.
  shape(g, hp(C, [[-1.2, -0.4], [1.2, -0.4], [1.7, 2.2], [2.4, 4.2], [1.2, 3.6], [0.4, 2.2], [-0.6, 2.4], [-1.6, 4.4], [-1.9, 2]]), INK);
  hakama(g, B, { stance: 15 });
  kosode(g, B);
  // The scar across her chest where the collar has opened.
  shape(g, [[cx - 4, 27], [cx + 4, 27], [cx + 1, 37]], SKIN);
  stroke(g, [[cx - 3, 28.4], [cx + 2.6, 34]], 1, SCAR);
  stroke(g, [[cx + 2.6, 28.6], [cx - 1.2, 33.2]], 0.9, SCAR);
  arm(g, B.sl, [cx - 15, 49], { sleeve: 'square', elbow: -2 });
  const hand: Pt = [cx + 18, 52];
  arm(g, B.sr, hand, { sleeve: 'square', elbow: 3 });
  const tip = katana(g, hand, 0.7, { len: 38 });
  stroke(g, [[hand[0] + 14, hand[1] + 9], [tip[0] - 2, tip[1] - 2]], 1.4, BLOOD);
  disc(g, tip[0] + 1, tip[1] + 4, 1.1, BLOOD);
  neckHead(g, cx, { turn: 0.25, y: C[1], w: 0.94 });
  eyes(g, cx, C[1] + 1.2, { turn: 0.25, color: '#2a2a3a', brow: INK, tilt: 1.5 });
  mouth(g, cx, C[1] + 5.2, 'smile', 1.4, 0.25);
  shape(g, hp(C, [[-1.15, 0.5], [-1.12, -0.6], [-0.4, -1.18], [0.45, -1.18], [1.12, -0.6], [1.15, 0.5], [0.7, -0.3], [0.1, -0.7], [-0.2, 0.15], [-0.5, -0.4], [-0.9, -0.1]]), INK);
});

const MAYURI_PURPLE = '#6a4a9a';

/**
 * Mayuri Kurotsuchi: the face painted white with black about the eyes and
 * mouth, gold eyes, the gold headpiece rising in two points over his head,
 * a purple scarf, one fingernail grown long, and Ashisogi Jizō's three
 * golden prongs. He leans forward, curious.
 */
export const mayuri = fig((g, cx) => {
  const B = bodyFrame(cx, { broad: 0.95, top: 27 });
  const C: Pt = [cx + 3, 16];
  hakama(g, B, { stance: 13 });
  kosode(g, B);
  haori(g, B, { flutter: -4 });
  const elL = arm(g, B.sl, [cx - 16, 45], { sleeve: 'tight', elbow: -3 });
  haoriSleeve(g, B.sl, elL);
  // The long nail on the raised hand.
  stroke(g, [[cx - 16, 44], [cx - 21, 37]], 1.2, '#2a2a34');
  const hand: Pt = [cx + 18, 52];
  const elR = arm(g, B.sr, hand, { sleeve: 'tight', elbow: 2 });
  haoriSleeve(g, B.sr, elR);
  // Ashisogi Jizō: three golden prongs from a guard with a baby's face.
  g.save();
  g.translate(hand[0], hand[1]);
  g.rotate(0.95);
  shape(g, [[-6, -1.1], [1, -1.1], [1, 1.1], [-6, 1.1]], INK);
  disc(g, 2.6, 0, 2.8, GOLD);
  for (const v of [-3.4, 0, 3.4]) shape(g, [[4, v - 1], [22 + (v === 0 ? 6 : 0), v * 1.6 - 0.4], [24 + (v === 0 ? 6 : 0), v * 1.6], [4, v + 1]], GOLD, INK, 0.7);
  g.restore();
  // The scarf.
  shape(g, [[cx - 7.5, 24], [cx + 8.5, 23.5], [cx + 9, 29], [cx - 8, 29.5]], MAYURI_PURPLE, INK, 1);
  // The headpiece behind the head: a gold plate rising in two points.
  shape(g, hp(C, [[-1.4, 0.2], [-1.9, -2.3], [-0.9, -1.2], [0, -1.5], [0.9, -1.2], [1.9, -2.3], [1.4, 0.2]]), GOLD, INK, 1.1);
  neckHead(g, C[0], { turn: 0.35, y: C[1], skin: '#f6f3ea' });
  // Black paint about the eyes and lips.
  shape(g, hp(C, [[-0.95, -0.15], [1.1, -0.2], [1, 0.45], [-0.9, 0.5]]), INK);
  eyes(g, C[0], C[1] + 1.2, { turn: 0.35, color: '#e2b04a', kind: 'wide' });
  mouth(g, C[0], C[1] + 5, 'teeth', 2.8, 0.35);
  // The blue-black hair showing under the plate, a short fringe.
  shape(g, hp(C, [[-1.1, -0.2], [-0.8, -1], [0.8, -1], [1.12, -0.2], [0.5, -0.65], [-0.5, -0.65]]), '#2a3050');
});

/**
 * Shinji Hirako: a straight blond bob cut level above his eyes, half-lidded
 * eyes over a grin of teeth, and Sakanade spun on one finger by the ring at
 * the end of its hilt.
 */
export const shinji = fig((g, cx) => {
  const B = bodyFrame(cx);
  const C: Pt = [cx, 14];
  const BLOND = '#d9b84a';
  shape(g, hp(C, [[-1.25, -0.4], [1.25, -0.4], [1.3, 1.05], [-1.3, 1.05]]), BLOND, INK, 1);
  hakama(g, B, { stance: 14 });
  kosode(g, B);
  haori(g, B, { flutter: 5 });
  const elL = arm(g, B.sl, [cx - 14, 52], { sleeve: 'tight', elbow: -2 });
  haoriSleeve(g, B.sl, elL);
  // Sakanade, hanging from a finger by its ring, turning.
  const hand: Pt = [cx + 18, 36];
  const elR = arm(g, B.sr, hand, { sleeve: 'tight', elbow: 4 });
  haoriSleeve(g, B.sr, elR, { long: 12 });
  g.beginPath();
  g.arc(hand[0] + 1, hand[1] - 3, 2.6, 0, Math.PI * 2);
  g.strokeStyle = GOLD;
  g.lineWidth = 1.4;
  g.stroke();
  katana(g, [hand[0] + 3, hand[1] + 5], 1.25, { len: 32, guard: GOLD });
  g.beginPath();
  g.ellipse(hand[0] + 6, hand[1] + 14, 15, 5, 0.3, 0.2, 2.6);
  g.strokeStyle = PAPER;
  g.lineWidth = 1;
  g.stroke();
  neckHead(g, cx, { turn: 0.2, y: C[1] });
  eyes(g, cx, C[1] + 1.4, { turn: 0.2, color: '#3a3020', tilt: 0.4 });
  // Half-lidded: the lids drawn low.
  stroke(g, [[cx - 4.4, C[1] + 0.9], [cx - 0.8, C[1] + 1.1]], 1.3);
  stroke(g, [[cx + 1.4, C[1] + 1.1], [cx + 5, C[1] + 0.9]], 1.3);
  mouth(g, cx, C[1] + 4.6, 'teeth', 3.2, 0.2);
  // The fringe, cut dead straight.
  shape(g, hp(C, [[-1.25, 0.4], [-1.15, -0.7], [-0.5, -1.18], [0.5, -1.18], [1.15, -0.7], [1.25, 0.4], [1.02, -0.15], [-1.02, -0.15]]), BLOND, INK, 1);
});

/**
 * Kensei Muguruma: short spiked silver hair, a scowl, bare arms under a
 * sleeveless haori, the 69 inked on his chest, and Tachikaze, a combat knife
 * with a knuckle guard, in his fist.
 */
export const kensei = fig((g, cx) => {
  const B = bodyFrame(cx, { broad: 1.15 });
  const C: Pt = [cx, 14];
  hakama(g, B, { stance: 15 });
  kosode(g, B);
  // The open front, and the 69.
  shape(g, [[cx - 4.6, 25], [cx + 4.6, 25], [cx + 2.6, 42], [cx - 2.6, 42]], SKIN);
  sixtyNine(g, cx, 33.5);
  haori(g, B, { sleeves: 'sleeveless', flutter: -5, hem: 72 });
  arm(g, B.sl, [cx - 17, 50], { sleeve: 'bare', elbow: -3, fist: true, w: 1.25 });
  const hand: Pt = [cx + 20, 40];
  arm(g, B.sr, hand, { sleeve: 'bare', elbow: 5, fist: true, w: 1.25 });
  // Tachikaze: a short blade from the fist, a guard over the knuckles.
  shape(g, [[hand[0] - 2.6, hand[1] - 3.4], [hand[0] + 2.8, hand[1] - 3.4], [hand[0] + 3, hand[1] + 3.4], [hand[0] - 2.6, hand[1] + 3.4]], '#7a808c', INK, 0.9);
  katana(g, [hand[0] + 1, hand[1]], -0.9, { len: 18, width: 3.2, curve: 0.4, guard: INK });
  neckHead(g, cx, { turn: -0.15, y: C[1], jaw: 0.6 });
  eyes(g, cx, C[1] + 1.2, { turn: -0.15, color: '#5a6070', brow: '#b9bec8', tilt: 1.8 });
  mouth(g, cx, C[1] + 5.2, 'frown', 2, -0.15);
  shape(g, hp(C, [[-1.12, 0.1], [-1.5, -0.6], [-0.95, -0.85], [-1.05, -1.4], [-0.35, -1.05], [0, -1.6], [0.35, -1.05], [1.05, -1.4], [0.95, -0.85], [1.5, -0.6], [1.12, 0.1], [0.7, -0.45], [-0.7, -0.45]]), '#b9bec8', INK, 1);
});

/** The 69 on Kensei's chest, in brush strokes rather than a font (fonts are not loaded in every context). */
function sixtyNine(g: Ctx, x: number, y: number): void {
  g.strokeStyle = INK;
  g.lineWidth = 1.2;
  for (const [dx, flip] of [[-1.9, 1], [1.9, -1]] as const) {
    g.beginPath();
    g.arc(x + dx, y + flip * 1.4, 1.5, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.moveTo(x + dx - 1.5, y + flip * 1.4);
    g.quadraticCurveTo(x + dx - 1.4, y - flip * 3.4, x + dx + 1.2, y - flip * 3.6);
    g.stroke();
  }
}

const PINK = '#e88aa8';

/**
 * Shunsui Kyōraku, Captain-Commander: the straw hat tipped low, wavy brown
 * hair tied back, stubble, the patch over his right eye, the pink flowered
 * kimono thrown over his haori, and Katen Kyōkotsu's two blades, one in each
 * hand.
 */
function kyorakuDraw(g: Ctx, cx: number, strike: boolean): void {
  const B = bodyFrame(cx, { broad: 1.08 });
  const C: Pt = [cx, 15];
  // The ponytail, swinging out behind.
  ribbon(g, [[cx - 3, 14], [cx - 9, 20], [cx - 14, 28], [cx - 19, 33]], 6, 2.4, '#5a3a22');
  hakama(g, B, { stance: 15 });
  kosode(g, B);
  haori(g, B, { flutter: -3, hem: 82 });
  // The pink kimono over it all, hung from his shoulders.
  shape(g, [[cx - 12, 25], [cx - 5, 24], [cx - 6, 44], [cx - 10, 72], [cx - 24, 76], [cx - 20, 44]], PINK, INK, 1.1);
  shape(g, [[cx + 12, 25], [cx + 5, 24], [cx + 6, 44], [cx + 9, 70], [cx + 22, 73], [cx + 19, 44]], PINK, INK, 1.1);
  for (const [x, y] of [[cx - 16, 40], [cx - 12, 58], [cx - 19, 66], [cx + 14, 38], [cx + 16, 56], [cx + 12, 66]] as const) flower(g, x, y);
  // Both blades out.
  // Striking, the two blades cross high in front of him.
  const handL: Pt = strike ? [cx - 15, 40] : [cx - 20, 50];
  const handR: Pt = strike ? [cx + 17, 38] : [cx + 21, 52];
  arm(g, B.sl, handL, { sleeve: 'square', color: PINK, elbow: -2 });
  arm(g, B.sr, handR, { sleeve: 'square', color: PINK, elbow: 2 });
  katana(g, handL, strike ? -0.7 : 2.25, { len: 30, width: 4.4, curve: 2.6, guard: INK });
  katana(g, handR, strike ? -2.45 : 0.95, { len: 36, width: 4.6, curve: 2.8, guard: INK });
  neckHead(g, cx, { turn: 0.2, y: C[1], jaw: 0.4 });
  stroke(g, hp(C, [[-1.05, -0.2], [1.05, -0.1]]), 0.9);
  shape(g, hp(C, [[0.1, -0.08], [0.85, -0.04], [0.8, 0.45], [0.18, 0.42]]), INK);
  eyes(g, cx - 3.4, C[1] + 1.2, { turn: 0.2, gap: 0, color: '#3a2a1a', brow: '#5a3a22', tilt: 0.6 });
  mouth(g, cx, C[1] + 5.2, 'smile', 1.8, 0.2);
  // Stubble.
  for (const [u, v] of [[-0.3, 0.9], [0, 0.95], [0.3, 0.9], [0.15, 0.82], [-0.15, 0.82]] as const) {
    const [x, y] = hp(C, [[u, v]])[0];
    disc(g, x, y, 0.35, INK);
  }
  // Wavy hair framing the face.
  shape(g, hp(C, [[-1.2, 0.6], [-1.15, -0.4], [1.15, -0.4], [1.25, 0.6], [0.95, 0.2], [0.75, -0.25], [-0.6, -0.2], [-0.9, 0.25]]), '#5a3a22', INK, 1);
  // The straw hat, wide and tipped low.
  shape(g, hp(C, [[-2.9, -0.5], [0, -1.95], [2.9, -0.4], [2.6, -0.15], [-2.6, -0.25]]), '#c8a868', INK, 1.1);
  for (const u of [-1.6, -0.6, 0.6, 1.6]) stroke(g, hp(C, [[0, -1.85], [u, -0.4]]), 0.6, '#8a6a32');
}

export const kyoraku = fig((g, cx) => kyorakuDraw(g, cx, false));
/** In the strike frame. */
export const kyorakuStrike = fig((g, cx) => kyorakuDraw(g, cx, true));

function flower(g: Ctx, x: number, y: number): void {
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    disc(g, x + Math.cos(a) * 1.4, y + Math.sin(a) * 1.4, 1, PAPER);
  }
  disc(g, x, y, 0.7, GOLD);
}

/**
 * Konjiki Ashisogi Jizō, Mayuri's bankai: a great golden caterpillar that
 * walks on blades, a baby's face crying at its head, a halo floating over it
 * and a purple cowl at its neck. Grotesque, as it should be.
 */
export const jizo = fig((g, cx) => {
  const W = cx * 2;
  // Body segments, swelling then tapering toward the tail.
  const segs = 7;
  for (let k = segs - 1; k >= 0; k--) {
    const x = W * 0.38 + k * 8.4;
    const r = 13 - Math.abs(k - 1.5) * 1.4;
    const y = 60 - Math.sin(k * 0.6) * 3;
    // Blade legs under each segment.
    shape(g, [[x - 3, y + r * 0.6], [x + 2, y + r * 0.6], [x - 2 - (k % 2) * 3, 94], [x - 4, 94]], STEEL, INK, 0.8);
    g.beginPath();
    g.ellipse(x, y, r * 0.75, r, 0, 0, Math.PI * 2);
    g.fillStyle = k % 2 ? GOLD : '#d6a040';
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 1.2;
    g.stroke();
    stroke(g, [[x - r * 0.5, y + r * 0.5], [x + r * 0.5, y + r * 0.5]], 1, GOLD_SHADE);
  }
  // The purple cowl behind the face.
  shape(g, [[W * 0.14, 38], [W * 0.38, 30], [W * 0.46, 48], [W * 0.4, 72], [W * 0.16, 70]], MAYURI_PURPLE, INK, 1.1);
  // The baby's face, too big, its mouth wide.
  const fx = W * 0.27;
  const fy = 52;
  g.beginPath();
  g.ellipse(fx, fy, 13, 15, 0, 0, Math.PI * 2);
  g.fillStyle = '#f1e2c8';
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 1.3;
  g.stroke();
  for (const d of [-1, 1]) {
    g.beginPath();
    g.ellipse(fx + d * 4.6, fy - 2.4, 2.6, 3.4, d * 0.3, 0, Math.PI * 2);
    g.fillStyle = INK;
    g.fill();
    stroke(g, [[fx + d * 4.8, fy + 1], [fx + d * 5.6, fy + 9]], 1.1, '#7a9ac8');
  }
  shape(g, [[fx - 6, fy + 4], [fx + 6, fy + 4], [fx + 4.6, fy + 12], [fx, fy + 14], [fx - 4.6, fy + 12]], '#4a0a16', INK, 1.1);
  stroke(g, [[fx - 4, fy + 5], [fx + 4, fy + 5]], 0.8, PAPER);
  // The halo.
  g.beginPath();
  g.ellipse(fx, 26, 11, 3.2, 0, 0, Math.PI * 2);
  g.strokeStyle = GOLD;
  g.lineWidth = 2.2;
  g.stroke();
});
