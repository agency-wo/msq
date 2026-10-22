import {
  along,
  arm,
  coat,
  crystal,
  type Ctx,
  DARK,
  disc,
  eyes,
  fig,
  GOLD,
  head,
  hp,
  INK,
  limb,
  mouth,
  PAPER,
  petals,
  type Pt,
  shape,
  SKIN,
  star,
  STEEL,
  STEEL_SHADE,
  stroke,
  TAU,
  zigzag,
} from './kit';

/**
 * The Wandenreich's knights as manga homages: the five Sternritter who
 * stole a captain's bankai with a medallion, and the medallion bearer (an
 * original design) who stands in for any other. White coats, black boots,
 * each knight known by a silhouette.
 */

const PETAL = '#f2a2bd';
const BOW = '#8cc8f0';

function neckHead(g: Ctx, cx: number, o: { turn?: number; y?: number; w?: number; jaw?: number; skin?: string; shade?: string } = {}): Pt {
  const y = o.y ?? 14;
  limb(g, [cx + 0.3, y + 5], [cx, y + 12], 4.6, 5.2, o.skin ?? SKIN);
  head(g, cx, y, { turn: o.turn, w: o.w, jaw: o.jaw, skin: o.skin, shade: o.shade });
  return [cx, y];
}

/** A Quincy's bow of blue reishi, held out in the left hand. */
function heiligBogen(g: Ctx, hand: Pt, h: number): void {
  g.beginPath();
  g.moveTo(hand[0] + 2, hand[1] - h / 2);
  g.quadraticCurveTo(hand[0] - 7, hand[1], hand[0] + 2, hand[1] + h / 2);
  g.strokeStyle = BOW;
  g.lineWidth = 2.6;
  g.stroke();
  stroke(g, [[hand[0] + 2, hand[1] - h / 2], [hand[0] + 2, hand[1] + h / 2]], 0.8, '#d6ecfa');
}

/**
 * A medallion bearer, an original design: a knight in the long white coat,
 * the hood up and the face lost in its shadow but for two white slits, a
 * black cape, a Heilig Bogen in one hand and the stolen medallion shining at
 * his chest.
 */
export const bearer = fig((g, cx) => {
  const B = coat(g, cx, { cape: INK, hem: 86, stance: 12 });
  const handL: Pt = [cx - 19, 46];
  arm(g, B.sl, handL, { sleeve: 'tight', color: PAPER, elbow: -2 });
  heiligBogen(g, handL, 30);
  arm(g, B.sr, [cx + 14, 54], { sleeve: 'tight', color: PAPER, elbow: 3, fist: true });
  // The medallion.
  disc(g, cx + 0.6, 35, 4.6, GOLD);
  g.beginPath();
  g.arc(cx + 0.6, 35, 4.6, 0, TAU);
  g.strokeStyle = INK;
  g.lineWidth = 1.1;
  g.stroke();
  star(g, cx + 0.6, 35, 3, INK, 0.45);
  // The hood, its opening black.
  const C: Pt = [cx, 15];
  shape(g, hp(C, [[-1.5, 1.6], [-1.6, -0.2], [-1.05, -1.3], [0, -1.7], [1.05, -1.3], [1.6, -0.2], [1.5, 1.6], [0.6, 1.25], [-0.6, 1.25]]), PAPER, INK, 1.2);
  shape(g, hp(C, [[-1, 1.05], [-1.05, -0.1], [-0.55, -0.9], [0.55, -0.9], [1.05, -0.1], [1, 1.05], [0, 1.25]]), INK);
  eyes(g, cx, 15.6, { kind: 'glare', turn: 0.1 });
});

/**
 * Äs Nödt, Sternritter F, "The Fear", who stole Senbonzakura: tall and
 * starved, a high white cowl over a mane of long black spikes, sunken eyes,
 * a mouth with no lips over its teeth, black thorns curling from his hands,
 * and the stolen petals drifting round him.
 */
export const thiefFear = fig((g, cx) => {
  const C: Pt = [cx, 14];
  // The mane, in long spikes down his back.
  const spikes: [number, number][] = [[-2.6, 3.4], [-2.2, 4.6], [-1.4, 5.2], [1.4, 5.2], [2.3, 4.5], [2.7, 3.2], [-2.8, 1.8], [2.9, 1.6]];
  for (const [u, v] of spikes) shape(g, hp(C, [[-0.8, 0], [u, v], [0.8, 0.2]]), INK);
  const B = coat(g, cx, { broad: 0.82, hem: 90, stance: 9, cape: PAPER });
  for (const d of [-1, 1]) {
    const hand: Pt = [cx + d * 18, 55];
    arm(g, d < 0 ? B.sl : B.sr, hand, { sleeve: 'tight', color: PAPER, elbow: d * 2, skin: '#d8ccb8' });
    // Tatarforas's thorns, curling from his fingers.
    for (let k = 0; k < 3; k++) {
      const a = Math.PI / 2 + d * (0.3 + k * 0.45);
      const tip: Pt = [hand[0] + Math.cos(a) * (10 + k * 3), hand[1] + Math.sin(a) * (10 + k * 3)];
      shape(g, [[hand[0] - 0.9, hand[1]], [hand[0] + 0.9, hand[1]], along(hand, tip, 0.6, d * 2), tip], INK);
    }
  }
  // The cowl: high and stiff, wrapped up to his jaw.
  shape(g, [[cx - 9, 27], [cx - 7, 18], [cx + 7, 18], [cx + 9, 27], [cx + 3, 30], [cx - 3, 30]], PAPER, INK, 1.2);
  neckHead(g, cx, { turn: 0.1, y: C[1], w: 0.9, skin: '#e2d6c0', shade: '#9a8a74' });
  // Sunken eyes ringed in black, and the lipless mouth.
  for (const d of [-1, 1]) {
    disc(g, cx + 0.2 + d * 2.6, C[1] + 1, 2, INK);
    disc(g, cx + 0.2 + d * 2.6, C[1] + 1, 0.6, '#c8102e');
  }
  mouth(g, cx, C[1] + 4.2, 'teeth', 2.8, 0.1);
  // The top of the mane, spiking up over his brow.
  shape(g, hp(C, [[-1.05, 0.15], [-1.5, -0.7], [-0.9, -0.9], [-1, -1.6], [-0.3, -1.15], [0, -1.8], [0.35, -1.15], [1.05, -1.6], [0.92, -0.88], [1.5, -0.65], [1.05, 0.15], [0.6, -0.5], [-0.6, -0.5]]), INK);
  petals(g, 13, 12, [cx - 46, 16, cx + 46, 94], PETAL);
});

/**
 * Cang Du, Sternritter I, "The Iron", who stole Hyōrinmaru: long black hair
 * in a braid over one shoulder, narrow eyes above a high collar that hides
 * his mouth, a long-sleeved coat cut in his own fashion, hands turned to
 * steel claws, frost about him.
 */
export const thiefIron = fig((g, cx) => {
  const C: Pt = [cx, 14];
  shape(g, hp(C, [[-1.2, -0.4], [1.2, -0.4], [1.25, 1.1], [-1.25, 1.1]]), INK);
  const B = coat(g, cx, { hem: 88, stance: 13 });
  // Long sleeves falling past the wrists, steel claws out of them.
  for (const d of [-1, 1]) {
    const hand: Pt = [cx + d * 20, 50 - d * 6];
    const el = arm(g, d < 0 ? B.sl : B.sr, hand, { sleeve: 'wide', color: PAPER, elbow: d * 3, skin: STEEL_SHADE });
    void el;
    for (let k = -1; k <= 1; k++) {
      const a = (d < 0 ? Math.PI : 0) + k * 0.45 - d * 0.3;
      shape(g, [[hand[0], hand[1] - 0.8], [hand[0] + Math.cos(a) * 8, hand[1] + Math.sin(a) * 8], [hand[0], hand[1] + 0.8]], STEEL, INK, 0.7);
    }
  }
  // The high collar up to his nose.
  shape(g, [[cx - 7, 27], [cx - 6.6, 16.6], [cx + 6.6, 16.6], [cx + 7, 27]], PAPER, INK, 1.2);
  stroke(g, [[cx, 17], [cx, 27]], 0.9);
  neckHead(g, cx, { turn: 0.15, y: C[1] });
  shape(g, [[cx - 6.4, 16.8], [cx + 6.6, 16.8], [cx + 6.6, 22], [cx - 6.4, 22]], PAPER, INK, 1);
  eyes(g, cx, C[1] + 0.6, { turn: 0.15, color: '#2a2a34', brow: INK, tilt: 1.2 });
  shape(g, hp(C, [[-1.15, 0.2], [-1.12, -0.6], [-0.45, -1.18], [0.5, -1.18], [1.12, -0.6], [1.15, 0.2], [0.8, -0.35], [0, -0.5], [-0.8, -0.35]]), INK);
  // The braid over his shoulder.
  for (let k = 0; k < 6; k++) {
    const x = cx + 6 + k * 0.6;
    const y = 22 + k * 4.2;
    shape(g, [[x - 0.4, y - 2.6], [x + 3, y], [x - 0.2, y + 2.8], [x - 3.2, y + 0.4]], INK, DARK, 0.6);
  }
  for (let k = 0; k < 4; k++) crystal(g, [cx - 30 + k * 18, 82 - (k % 2) * 40], -1.2 + k * 0.9, 8, 3, '#cfe8f8');
});

/**
 * BG9, Sternritter K, "The Knowledge", who stole Raikōben: a closed steel
 * helmet with a single red visor and a grille, armoured shoulders like a
 * machine's, and a bank of launch tubes rising from his back.
 */
export const thiefKnowledge = fig((g, cx) => {
  // Launch tubes behind his shoulders.
  for (const d of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const x = cx + d * (9 + k * 5.2);
      shape(g, [[x - 2.3, 8 + k * 3], [x + 2.3, 8 + k * 3], [x + 2.3, 30], [x - 2.3, 30]], '#5c6270', INK, 1);
      disc(g, x, 8 + k * 3, 1.4, INK);
    }
  }
  const B = coat(g, cx, { broad: 1.35, hem: 84, stance: 15 });
  for (const d of [-1, 1]) {
    const hand: Pt = [cx + d * 22, 54];
    arm(g, d < 0 ? B.sl : B.sr, hand, { sleeve: 'tight', color: '#5c6270', elbow: d * 3, skin: '#7a808c', w: 1.5, fist: true });
    // The great shoulder plates.
    shape(g, [[cx + d * 7, 22], [cx + d * 20, 22], [cx + d * 23, 34], [cx + d * 12, 35]], '#7a808c', INK, 1.2);
    stroke(g, [[cx + d * 10, 26], [cx + d * 20, 26.5]], 0.9);
  }
  // The helmet: a squared box, one visor slit, a grille below.
  shape(g, [[cx - 8, 4], [cx + 8, 4], [cx + 9, 24], [cx - 9, 24]], '#5c6270', INK, 1.3);
  shape(g, [[cx - 8, 10], [cx + 8.4, 10], [cx + 8.4, 14], [cx - 8, 14]], INK);
  shape(g, [[cx - 6, 11], [cx + 6.4, 11], [cx + 6.4, 13], [cx - 6, 13]], '#ff3050');
  for (let k = -2; k <= 2; k++) stroke(g, [[cx + k * 2.6, 17], [cx + k * 2.6, 22]], 1);
});

/**
 * Bambietta Basterbine, Sternritter E, "The Explode", who stole Kokujō
 * Tengen Myō'ō: long straight black hair with a heavy fringe, violet eyes and
 * a smirk, the short-skirted uniform, long black boots, and a burning bomb of
 * reishi in her hand.
 */
export const thiefExplode = fig((g, cx) => {
  const C: Pt = [cx, 15];
  shape(g, hp(C, [[-1.25, -0.4], [1.25, -0.4], [1.45, 2.6], [1.1, 4.2], [0.4, 3.2], [-0.4, 3.2], [-1.1, 4.2], [-1.45, 2.6]]), INK);
  const B = coat(g, cx, { broad: 0.85, skirt: true, stance: 10, boots: INK });
  arm(g, B.sl, [cx - 15, 52], { sleeve: 'tight', color: PAPER, elbow: -2 });
  const hand: Pt = [cx + 18, 36];
  arm(g, B.sr, hand, { sleeve: 'tight', color: PAPER, elbow: 4 });
  // The bomb: a ball of reishi with a hard bright core.
  disc(g, hand[0] + 2, hand[1] - 6, 6.4, '#ff8a3c');
  disc(g, hand[0] + 2, hand[1] - 6, 3.4, '#ffe2a0');
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU;
    shape(g, [[hand[0] + 2 + Math.cos(a) * 6, hand[1] - 6 + Math.sin(a) * 6], [hand[0] + 2 + Math.cos(a + 0.25) * 10, hand[1] - 6 + Math.sin(a + 0.25) * 10], [hand[0] + 2 + Math.cos(a + 0.5) * 6, hand[1] - 6 + Math.sin(a + 0.5) * 6]], '#ff8a3c');
  }
  neckHead(g, cx, { turn: 0.25, y: C[1], w: 0.92 });
  eyes(g, cx, C[1] + 1.4, { turn: 0.25, color: '#7a4ab0', brow: INK, tilt: 0.6 });
  mouth(g, cx, C[1] + 5.4, 'smile', 1.8, 0.5);
  // The fringe, cut straight across.
  shape(g, hp(C, [[-1.25, 0.5], [-1.15, -0.65], [-0.5, -1.18], [0.5, -1.18], [1.15, -0.65], [1.25, 0.5], [1.05, -0.12], [-1.05, -0.12]]), INK);
});

/**
 * Driscoll Berci, Sternritter O, "The Overkill", who stole Kōkō Gonryō
 * Rikyū: a hulking brute with a neck as thick as his head, a flat-topped crew
 * cut, a grin full of teeth, the cape on his back, and the stolen lightning
 * in his fist.
 */
export const thiefOverkill = fig((g, cx) => {
  zigzag(g, [cx + 26, 6], [cx + 22, 44], 3, 2.4, '#f2d45a', 6);
  zigzag(g, [cx + 36, 18], [cx + 24, 46], 8, 1.6, '#f2d45a', 4);
  const B = coat(g, cx, { broad: 1.6, top: 27, hem: 84, stance: 16, cape: INK });
  const handL: Pt = [cx - 24, 58];
  arm(g, B.sl, handL, { sleeve: 'tight', color: PAPER, elbow: -4, w: 1.8, fist: true });
  const hand: Pt = [cx + 24, 46];
  arm(g, B.sr, hand, { sleeve: 'tight', color: PAPER, elbow: 4, w: 1.8, fist: true });
  // A neck as thick as his jaw, sloping into the shoulders.
  shape(g, [[cx - 11, 28], [cx - 6.6, 20], [cx + 6.8, 20], [cx + 11.2, 28]], SKIN, INK, 1.1);
  const C = neckHead(g, cx, { turn: 0.1, y: 16, w: 1.18, jaw: 1 });
  eyes(g, cx, C[1] + 0.6, { turn: 0.1, color: '#2a2a34', brow: INK, tilt: 1.5, gap: 3 });
  mouth(g, cx, C[1] + 4.6, 'teeth', 4.2, 0.1);
  // The crew cut, flat as a board.
  shape(g, hp(C, [[-1.18, -0.35], [-1.18, -1.15], [1.2, -1.15], [1.18, -0.35], [0.9, -0.72], [-0.9, -0.72]]), INK);
});
