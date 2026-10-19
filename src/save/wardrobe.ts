import { LOOK_BY_ID, TRAIL_BY_ID, type LookId, type TrailId } from '../data/looks';
import type { SaveData } from './save';

/** The Emperor's wardrobe, read from and written to the save: looks and trails bought with gold. */

/** Buy a look that is for sale and put it on. False if it is a feat look, already owned, or unaffordable. */
export function buyLook(save: SaveData, id: LookId): boolean {
  const look = LOOK_BY_ID.get(id);
  if (!look?.price || save.looks.includes(id) || save.gold < look.price) return false;
  save.gold -= look.price;
  save.looks.push(id);
  save.look = id;
  return true;
}

/** Wear a look already owned. */
export function wearLook(save: SaveData, id: LookId): boolean {
  if (!save.looks.includes(id)) return false;
  save.look = id;
  return true;
}

/** Buy a trail and put it on. False if it is already owned or unaffordable. */
export function buyTrail(save: SaveData, id: TrailId): boolean {
  const trail = TRAIL_BY_ID.get(id);
  if (!trail || save.trails.includes(id) || save.gold < trail.price) return false;
  save.gold -= trail.price;
  save.trails.push(id);
  save.trail = id;
  return true;
}

/** Wear a trail already owned ('none' always is). */
export function wearTrail(save: SaveData, id: TrailId): boolean {
  if (!save.trails.includes(id)) return false;
  save.trail = id;
  return true;
}

/** Something in the Wardrobe the gold on hand can buy. */
export function wardrobeAffordable(save: SaveData): boolean {
  for (const [id, look] of LOOK_BY_ID) if (look.price && !save.looks.includes(id as LookId) && look.price <= save.gold) return true;
  for (const [id, trail] of TRAIL_BY_ID) if (trail.price > 0 && !save.trails.includes(id as TrailId) && trail.price <= save.gold) return true;
  return false;
}
