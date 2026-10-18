/** Engine constants and tuning shared across the game. World units are roughly CSS pixels at phone scale. */

export const SIM_HZ = 60;
export const DT = 1 / SIM_HZ;

/** World units visible across the screen width in portrait. */
export const VIEW_W = 420;
/** World units visible top to bottom when the screen is landscape (desktop testing). */
export const VIEW_H_LANDSCAPE = 860;

/** Hard pool capacities. Nothing allocates per frame; when a pool is full, new spawns are skipped. */
export const CAP = {
  enemies: 2400,
  projectiles: 1600,
  orbs: 1400,
  fx: 2600,
  numbers: 160,
  pickups: 32,
} as const;

/** Enemies alive at once in a normal run (stress mode ignores this). */
export const MAX_ENEMIES_ALIVE = 1100;

export const GRID_CELL = 48;
/** 96 cells of 48 units = a 4608-unit square around the player is indexed for collisions. */
export const GRID_DIM = 96;

export const PLAYER = {
  radius: 10,
  speed: 128,
  hp: 100,
  /** Seconds of invulnerability after taking a hit, so a swarm cannot delete you in one frame. */
  iframes: 0.45,
  /** Base orb pickup radius. */
  magnet: 80,
} as const;
