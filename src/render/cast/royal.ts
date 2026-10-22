import {
  arm,
  blob,
  bodyFrame,
  type Ctx,
  DARK,
  disc,
  eyes,
  fig,
  GOLD,
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
  oval,
  PAPER,
  type Pt,
  ribbon,
  shape,
  SKIN,
  stroke,
  TAU,
} from './kit';

/**
 * The Royal Guard of the Soul King's palace, as manga homages: Tenjirō,
 * Kirio in both her shapes, Ōetsu, Senjumaru, and Ichibē Hyōsube, who ends
 * the stage. Gods of their crafts, each dressed in their own fashion.
 */

const ROSE = '#e06a7a';

function neckHead(g: Ctx, cx: number, o: { turn?: number; y?: number; w?: number; h?: number; jaw?: number } = {}): Pt {
  const y = o.y ?? 14;
  limb(g, [cx + 0.3, y + 5], [cx, y + 12], 4.6, 5.2, SKIN);
  head(g, cx, y, { turn: o.turn, w: o.w, h: o.h, jaw: o.jaw });
  return [cx, y];
}

/** Tenjirō Kirinji, god of hot springs: a towering black pompadour, sideburns, a fierce grin, a long white coat, and a great blade at his back. */
export const tenjiro = fig((g, cx) => {
  const C: Pt = [cx, 20];
  // The blade on his back, the hilt over his shoulder.
  katana(g, [cx - 10, 24], 1.0, { len: 50, width: 3.6 });
  const B = bodyFrame(cx, { top: 31, broad: 1.08 });
  hakama(g, B, { stance: 15 });
  kosode(g, B);
  haori(g, B, { flutter: 5, hem: 86, diamonds: false });
  const elL = arm(g, B.sl, [cx - 16, 58], { sleeve: 'tight', elbow: -2, fist: true });
  haoriSleeve(g, B.sl, elL);
  const elR = arm(g, B.sr, [cx + 18, 54], { sleeve: 'tight', elbow: 3, fist: true });
  haoriSleeve(g, B.sr, elR);
  neckHead(g, cx, { turn: 0.15, y: C[1], jaw: 0.7 });
  eyes(g, cx, C[1] + 1.2, { turn: 0.15, color: INK, brow: INK, tilt: 1.8 });
  mouth(g, cx, C[1] + 5, 'grin', 3, 0.15);
  // Sideburns, and the pompadour swept up and forward, taller than his head.
  for (const d of [-1, 1]) shape(g, hp(C, [[d * 1.12, -0.2], [d * 1.18, 0.75], [d * 0.92, 0.6], [d * 0.9, -0.2]]), INK);
  shape(g, hp(C, [[-1.15, -0.1], [-1.25, -1.2], [-1.1, -2.2], [-0.4, -2.75], [0.6, -2.85], [1.5, -2.55], [1.75, -2.1], [1.2, -1.9], [1.2, -0.4], [1.12, -0.1], [0.6, -0.7], [-0.6, -0.65]]), INK);
  stroke(g, hp(C, [[-0.7, -1.2], [0.1, -2.5], [1.3, -2.4]]), 1, DARK);
});

/** Kirio Hikifune, goddess of grain: round and beaming, a great dark bun, rosy cheeks, a rice ball in her hand. */
export const kirio = fig((g, cx) => {
  const C: Pt = [cx, 18];
  for (const d of [-1, 1]) limb(g, [cx + d * 10, 80], [cx + d * 13, 95], 9, 8, INK);
  // The round body in a pale kimono and a rose sash.
  blob(g, [[cx - 26, 46], [cx - 18, 30], [cx + 18, 30], [cx + 26, 46], [cx + 26, 74], [cx + 12, 86], [cx - 12, 86], [cx - 26, 74]], PAPER, INK, 1.6);
  shape(g, [[cx - 25, 56], [cx + 25, 56], [cx + 25.6, 63], [cx - 25.6, 63]], ROSE, INK, 1);
  stroke(g, [[cx - 4, 32], [cx + 3, 54]], 1.1, LIGHT);
  // Round arms, one holding up a rice ball.
  limb(g, [cx - 22, 38], [cx - 26, 62], 10, 8, PAPER);
  disc(g, cx - 26, 64, 3.6, SKIN);
  limb(g, [cx + 22, 38], [cx + 28, 44], 10, 8, PAPER);
  disc(g, cx + 29, 42, 3.6, SKIN);
  shape(g, [[cx + 29, 30], [cx + 37, 41], [cx + 21, 41]], PAPER, INK, 1.1);
  shape(g, [[cx + 25, 37], [cx + 33, 37], [cx + 33, 41], [cx + 25, 41]], INK);
  neckHead(g, cx, { turn: 0, y: C[1], w: 1.35, h: 1.15, jaw: 1 });
  for (const d of [-1, 1]) disc(g, cx + d * 5.4, C[1] + 3.4, 1.8, ROSE);
  eyes(g, cx, C[1] + 1.2, { turn: 0, kind: 'closed', gap: 3.6 });
  mouth(g, cx, C[1] + 5.6, 'smile', 2.4, 0);
  // Hair drawn up into the great bun.
  shape(g, hp(C, [[-1.35, 0.1], [-1.3, -0.7], [-0.5, -1.1], [0.5, -1.1], [1.3, -0.7], [1.35, 0.1], [0.9, -0.5], [-0.9, -0.5]], 1.2), INK);
  oval(g, cx, C[1] - 13, 9, 7, 0, INK);
  stroke(g, [[cx - 6, C[1] - 13], [cx + 6, C[1] - 15]], 1, DARK);
});

/** Kirio after she sheds her bulk: slender, her dark hair let down to her waist, eyes open now. */
export const kirioSlim = fig((g, cx) => {
  const C: Pt = [cx, 14];
  shape(g, hp(C, [[-1.2, -0.4], [1.2, -0.4], [1.4, 2.5], [1.5, 4.6], [0.4, 3.8], [-0.4, 3.8], [-1.5, 4.6], [-1.4, 2.5]]), INK);
  const B = bodyFrame(cx, { broad: 0.86 });
  hakama(g, B, { stance: 11, hakama: PAPER, tabi: INK });
  kosode(g, B, { kosode: PAPER, obi: ROSE, collar: INK });
  arm(g, B.sl, [cx - 15, 52], { sleeve: 'square', color: PAPER, elbow: -2 });
  arm(g, B.sr, [cx + 17, 46], { sleeve: 'square', color: PAPER, elbow: 3 });
  neckHead(g, cx, { turn: 0.2, y: C[1], w: 0.92 });
  eyes(g, cx, C[1] + 1.2, { turn: 0.2, color: '#5a3a2a', brow: INK, tilt: 1 });
  mouth(g, cx, C[1] + 5.2, 'line', 1.4, 0.2);
  shape(g, hp(C, [[-1.15, 0.6], [-1.12, -0.6], [-0.4, -1.15], [0.5, -1.15], [1.12, -0.6], [1.15, 0.6], [0.85, -0.2], [0, -0.55], [-0.85, -0.2]]), INK);
});

/** Ōetsu Nimaiya, god of the sword: a knitted cap, round dark glasses, a wide grin, a heavy gold chain, loose clothes, and a sword hilt over his shoulder. */
export const oetsu = fig((g, cx) => {
  const C: Pt = [cx, 14];
  katana(g, [cx + 11, 25], 2.1, { len: 40, guard: GOLD });
  const B = bodyFrame(cx, { broad: 1.05 });
  hakama(g, B, { stance: 15, hakama: '#3a3a46' });
  // A loose white jacket worn open over black.
  kosode(g, B);
  for (const d of [-1, 1]) shape(g, [[cx + d * 3.4, 24.5], [cx + d * 13.5, 26], [cx + d * 15, 58], [cx + d * 6, 58], [cx + d * 5, 34]], PAPER, INK, 1.1);
  arm(g, B.sl, [cx - 17, 54], { sleeve: 'wide', color: PAPER, elbow: -2, fist: true });
  arm(g, B.sr, [cx + 20, 40], { sleeve: 'wide', color: PAPER, elbow: 4 });
  // The chain: heavy gold links.
  for (let k = 0; k < 7; k++) {
    const t = k / 6;
    const x = cx - 5 + t * 10;
    const y = 27 + Math.sin(t * Math.PI) * 8;
    g.beginPath();
    g.ellipse(x, y, 1.6, 1.1, 0.3, 0, TAU);
    g.strokeStyle = GOLD;
    g.lineWidth = 1.2;
    g.stroke();
  }
  neckHead(g, cx, { turn: 0.25, y: C[1] });
  // Round dark glasses.
  for (const d of [-1, 1]) disc(g, cx + 0.3 + d * 2.9, C[1] + 1.2, 2.3, INK);
  stroke(g, [[cx - 0.6, C[1] + 0.8], [cx + 1.2, C[1] + 0.8]], 0.8);
  mouth(g, cx, C[1] + 5, 'grin', 3.2, 0.25);
  // The knitted cap.
  shape(g, hp(C, [[-1.2, -0.1], [-1.15, -0.85], [-0.5, -1.35], [0.5, -1.35], [1.15, -0.85], [1.2, -0.1]]), '#3a3a46', INK, 1.1);
  shape(g, hp(C, [[-1.22, -0.25], [1.22, -0.25], [1.22, 0.05], [-1.22, 0.05]]), '#5a5a6a', INK, 0.8);
});

const SENJU_VIOLET = '#6a4a9a';

/** Senjumaru Shutara, the great weaver: a towering sculpted updo pinned with gold, a violet sash, and slender jointed arms spread out behind her like a spider's. */
export const senjumaru = fig((g, cx) => {
  const C: Pt = [cx, 22];
  // The extra arms, long and jointed, fanning out behind her.
  for (const d of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const sh: Pt = [cx + d * 7, 38 + k * 6];
      const el: Pt = [cx + d * (26 + k * 4), 24 + k * 16];
      const tip: Pt = [cx + d * (38 + k * 3), 40 + k * 20];
      limb(g, sh, el, 2.4, 2, '#5a5a6a');
      limb(g, el, tip, 2, 1.4, '#5a5a6a');
      disc(g, el[0], el[1], 2, GOLD);
    }
  }
  const B = bodyFrame(cx, { broad: 0.88, top: 33 });
  hakama(g, B, { stance: 10, hakama: '#2a1a36' });
  kosode(g, B, { kosode: '#2a1a36', obi: SENJU_VIOLET, collar: PAPER });
  arm(g, B.sl, [cx - 10, 60], { sleeve: 'wide', color: '#2a1a36', elbow: -4 });
  arm(g, B.sr, [cx + 10, 60], { sleeve: 'wide', color: '#2a1a36', elbow: 4 });
  neckHead(g, cx, { turn: 0.1, y: C[1], w: 0.9 });
  eyes(g, cx, C[1] + 1.2, { turn: 0.1, kind: 'closed' });
  mouth(g, cx, C[1] + 5.2, 'line', 1.4, 0.1);
  // The updo: built high in sculpted lobes, gold pins fanning out of it.
  for (let k = 0; k < 7; k++) {
    const a = -Math.PI / 2 + (k - 3) * 0.36;
    const base: Pt = [cx + Math.cos(a) * 7, C[1] - 10 + Math.sin(a) * 7];
    const tip: Pt = [cx + Math.cos(a) * 18, C[1] - 10 + Math.sin(a) * 13];
    limb(g, base, tip, 1.2, 1, GOLD);
    disc(g, tip[0], tip[1], 1.6, GOLD);
  }
  blob(g, [[cx - 11, C[1] - 4], [cx - 12, C[1] - 13], [cx - 6, C[1] - 19], [cx + 6, C[1] - 19], [cx + 12, C[1] - 13], [cx + 11, C[1] - 4], [cx, C[1] - 7]], INK);
  stroke(g, [[cx - 7, C[1] - 13], [cx, C[1] - 17], [cx + 7, C[1] - 13]], 1, DARK);
  shape(g, hp(C, [[-1.15, 0.2], [-1.1, -0.6], [-0.4, -1.12], [0.4, -1.12], [1.1, -0.6], [1.15, 0.2], [0.8, -0.35], [-0.8, -0.35]]), INK);
});

/** Ichibē Hyōsube, the monk who named everything: a great bald head, a bushy black beard and brows, dark robes and prayer beads round a round belly, and his giant brush. */
function ichibeDraw(g: Ctx, cx: number, strike: boolean): void {
  const C: Pt = [cx, 20];
  // The brush, longer than he is tall, its head soaked in ink; striking, swung down in a stroke that leaves ink in the air.
  const hand: Pt = strike ? [cx + 24, 44] : [cx + 22, 52];
  if (strike) ribbon(g, [[hand[0] - 30, hand[1] - 46], [hand[0] - 6, hand[1] - 56], [hand[0] + 18, hand[1] - 40], [hand[0] + 26, hand[1] - 14]], 7, 2.4, INK, false);
  g.save();
  g.translate(hand[0], hand[1]);
  g.rotate(strike ? 0.85 : 0);
  g.translate(-hand[0], -hand[1]);
  shape(g, [[hand[0] - 1.6, hand[1] + 40], [hand[0] + 1.6, hand[1] + 40], [hand[0] + 9, hand[1] - 30], [hand[0] + 5.8, hand[1] - 30]], '#8a5a2c', INK, 1);
  blob(g, [[hand[0] + 4, hand[1] - 30], [hand[0] + 12, hand[1] - 32], [hand[0] + 14, hand[1] - 42], [hand[0] + 9, hand[1] - 54], [hand[0] + 4, hand[1] - 42]], INK);
  g.restore();
  for (const d of [-1, 1]) limb(g, [cx + d * 12, 80], [cx + d * 16, 95], 11, 10, INK);
  // Dark robes over a round belly.
  blob(g, [[cx - 28, 46], [cx - 20, 32], [cx + 20, 32], [cx + 28, 46], [cx + 30, 72], [cx + 18, 88], [cx - 18, 88], [cx - 30, 72]], '#2a2a36', INK, 1.6);
  shape(g, [[cx - 6, 33], [cx + 6, 33], [cx + 9, 62], [cx - 9, 62]], SKIN, INK, 1);
  stroke(g, [[cx - 24, 50], [cx - 22, 80]], 1.2, DARK);
  stroke(g, [[cx + 24, 50], [cx + 22, 80]], 1.2, DARK);
  // Prayer beads.
  for (let k = 0; k <= 12; k++) {
    const a = Math.PI * (0.1 + (k / 12) * 0.8);
    disc(g, cx + Math.cos(a) * 15, 31 + Math.sin(a) * 15, 1.9, '#7a3a2a');
  }
  // Arms in wide dark sleeves, a shade lighter than the robe so they stand off it.
  for (const [sh, h] of [[[cx - 24, 40], [cx - 27, 64]], [[cx + 24, 40], hand]] as const) {
    limb(g, sh, h, 12, 10, INK);
    limb(g, sh, h, 9.6, 7.6, DARK);
    disc(g, h[0], h[1] + 1, 4.4, SKIN);
    g.strokeStyle = INK;
    g.lineWidth = 1.1;
    g.beginPath();
    g.arc(h[0], h[1] + 1, 4.4, 0, TAU);
    g.stroke();
  }
  neckHead(g, cx, { turn: 0.1, y: C[1], w: 1.5, h: 1.35, jaw: 0.6 });
  // The great brows.
  for (const d of [-1, 1]) blob(g, hp(C, [[d * 0.15, -0.05], [d * 1.1, -0.45], [d * 1.55, -0.05], [d * 1.2, 0.2], [d * 0.3, 0.15]], 1.4), INK);
  eyes(g, cx, C[1] + 2, { turn: 0.1, color: INK, gap: 4.4, tilt: 1 });
  // The beard, bushy and black, from ear to ear.
  blob(g, hp(C, [[-1.15, 0.35], [-0.6, 0.7], [0, 0.6], [0.6, 0.7], [1.15, 0.35], [1.2, 1.2], [0.6, 1.8], [0, 1.95], [-0.6, 1.8], [-1.2, 1.2]], 1.4), INK);
  mouth(g, cx, C[1] + 8.6, 'grin', 3.6, 0.1);
}

export const ichibe = fig((g, cx) => ichibeDraw(g, cx, false));
/** In the strike frame. */
export const ichibeStrike = fig((g, cx) => ichibeDraw(g, cx, true));

