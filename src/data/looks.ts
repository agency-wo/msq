/**
 * The Emperor's wardrobe. Looks are the colours of his coat, cape and star:
 * four are earned with feats, five are bought with gold. Trails are motes he
 * leaves behind as he moves; they are only drawn, and change nothing in a run.
 */

export type LookId = 'default' | 'white' | 'crimson' | 'gilded' | 'schatten' | 'blut' | 'silbern' | 'heilig' | 'kaiser' | 'almighty';

export interface LookDef {
  id: LookId;
  name: string;
  /** Gold, for the looks sold in the Wardrobe. Feat looks have no price. */
  price?: number;
}

export const LOOKS: readonly LookDef[] = [
  { id: 'default', name: 'Black' },
  { id: 'white', name: 'Wandenreich White' },
  { id: 'crimson', name: 'Crimson' },
  { id: 'gilded', name: 'Gilded' },
  { id: 'schatten', name: 'Schatten', price: 800 },
  { id: 'blut', name: 'Blut', price: 1000 },
  { id: 'silbern', name: 'Silbern', price: 1200 },
  { id: 'heilig', name: 'Heilig', price: 1500 },
  { id: 'kaiser', name: 'Kaiser', price: 2000 },
  // The Gauntlet's: every enemy of the Wandenreich put down.
  { id: 'almighty', name: 'The Almighty' },
];

export const LOOK_BY_ID: ReadonlyMap<string, LookDef> = new Map(LOOKS.map((l) => [l.id, l]));

export type TrailId = 'none' | 'reishi' | 'blut' | 'schatten' | 'gold';

export interface TrailDef {
  id: TrailId;
  name: string;
  price: number;
  /** The motes' colour, for the renderer and for the Wardrobe's swatch. */
  tint: number;
  css: string;
}

export const TRAILS: readonly TrailDef[] = [
  { id: 'none', name: 'None', price: 0, tint: 0xffffff, css: '#5a5e6c' },
  { id: 'reishi', name: 'Reishi', price: 500, tint: 0x8fd0ff, css: '#8fd0ff' },
  { id: 'blut', name: 'Blut', price: 700, tint: 0xff3d5e, css: '#ff3d5e' },
  { id: 'schatten', name: 'Schatten', price: 900, tint: 0x2a1840, css: '#9a7aff' },
  { id: 'gold', name: 'Gold dust', price: 1200, tint: 0xffd27a, css: '#ffd27a' },
];

export const TRAIL_BY_ID: ReadonlyMap<string, TrailDef> = new Map(TRAILS.map((t) => [t.id, t]));
