import { describe, expect, it } from 'vitest';
import { SpatialGrid } from '../src/core/grid';
import { Rng } from '../src/core/rng';

function scatter(n: number, seed: number, spread: number) {
  const rng = new Rng(seed);
  const xs = new Float32Array(n);
  const ys = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    xs[i] = rng.range(-spread, spread);
    ys[i] = rng.range(-spread, spread);
  }
  return { xs, ys, skip: new Uint8Array(n) };
}

describe('spatial grid', () => {
  it('finds the true nearest entity, matching brute force', () => {
    const n = 800;
    const { xs, ys, skip } = scatter(n, 11, 900);
    const grid = new SpatialGrid(48, 96, n);
    grid.build(xs, ys, skip, n, 0, 0);
    const rng = new Rng(3);
    for (let t = 0; t < 300; t++) {
      const qx = rng.range(-700, 700);
      const qy = rng.range(-700, 700);
      const maxR = rng.range(20, 600);
      let best = -1;
      let bestD = maxR * maxR;
      for (let i = 0; i < n; i++) {
        const d = (xs[i] - qx) ** 2 + (ys[i] - qy) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      expect(grid.nearest(qx, qy, maxR, xs, ys)).toBe(best);
    }
  });

  it('box queries return every entity inside the box', () => {
    const n = 500;
    const { xs, ys, skip } = scatter(n, 5, 600);
    const grid = new SpatialGrid(48, 96, n);
    grid.build(xs, ys, skip, n, 0, 0);
    const out = new Int32Array(n);
    const count = grid.query(-120, -80, 150, 200, out);
    const found = new Set(Array.from(out.subarray(0, count)));
    for (let i = 0; i < n; i++) {
      if (xs[i] >= -120 && xs[i] <= 150 && ys[i] >= -80 && ys[i] <= 200) expect(found.has(i)).toBe(true);
    }
  });

  it('leaves out skipped entities', () => {
    const xs = new Float32Array([0, 5]);
    const ys = new Float32Array([0, 5]);
    const grid = new SpatialGrid(48, 16, 2);
    grid.build(xs, ys, new Uint8Array([1, 0]), 2, 0, 0);
    expect(grid.nearest(0, 0, 100, xs, ys)).toBe(1);
  });
});
