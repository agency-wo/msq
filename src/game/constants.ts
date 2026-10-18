/** Ids shared by the simulation and the renderer. Plain numbers so they fit in typed arrays. */

export const FLAG_ELITE = 1;
export const FLAG_BOSS = 2;

/** Projectile kinds. */
export const PK_ARROW = 0;
export const PK_BLADE = 1;
export const PK_SHARD = 2;

/** Projectile flag: arrows burst on impact (Detonate), blades throw shards (Razor Wind). */
export const PF_SPECIAL = 1;

/** Visual effect sprites; the renderer maps each to an atlas frame. */
export const FX_GLOW = 0;
export const FX_RING = 1;
export const FX_SPARK = 2;
export const FX_DOT = 3;
export const FX_BEAM = 4;
export const FX_BOLT = 5;
export const FX_SHARD = 6;

/** Effect blend layers. */
export const LAYER_NORMAL = 0;
export const LAYER_ADD = 1;
