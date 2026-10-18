/** Mana needed to go from `level` to `level + 1`: quick early levels, then a steady climb. */
export function xpToNext(level: number): number {
  return Math.round(4 + 2.5 * level + 0.32 * level * level);
}

/** Total mana needed to reach `level` from level 1. */
export function xpForLevel(level: number): number {
  let sum = 0;
  for (let l = 1; l < level; l++) sum += xpToNext(l);
  return sum;
}
