/**
 * Uniform spatial grid, rebuilt every step around a moving centre (the player).
 *
 * Built with a counting sort, so it never allocates: `start[c]..start[c+1]`
 * is the slice of `items` holding the entity indices in cell `c`. Entities
 * outside the covered square are not indexed at all; they are far off-screen
 * and nothing needs to collide with them.
 */
export class SpatialGrid {
  readonly cell: number;
  readonly dim: number;
  originX = 0;
  originY = 0;
  readonly start: Int32Array;
  readonly items: Int32Array;
  private readonly counts: Int32Array;
  private readonly cursor: Int32Array;
  private readonly cellOf: Int32Array;

  constructor(cell: number, dim: number, capacity: number) {
    this.cell = cell;
    this.dim = dim;
    this.start = new Int32Array(dim * dim + 1);
    this.counts = new Int32Array(dim * dim);
    this.cursor = new Int32Array(dim * dim);
    this.items = new Int32Array(capacity);
    this.cellOf = new Int32Array(capacity);
  }

  /** Cell index for a world position, or -1 outside the grid. */
  cellIndex(x: number, y: number): number {
    const cx = Math.floor((x - this.originX) / this.cell);
    const cy = Math.floor((y - this.originY) / this.cell);
    if (cx < 0 || cy < 0 || cx >= this.dim || cy >= this.dim) return -1;
    return cy * this.dim + cx;
  }

  /** Index entities [0, n) centred on (cx, cy); entities with skip[i] set are left out. */
  build(xs: Float32Array, ys: Float32Array, skip: Uint8Array, n: number, cx: number, cy: number): void {
    const half = (this.dim * this.cell) / 2;
    this.originX = cx - half;
    this.originY = cy - half;
    const counts = this.counts;
    counts.fill(0);
    for (let i = 0; i < n; i++) {
      const c = skip[i] ? -1 : this.cellIndex(xs[i], ys[i]);
      this.cellOf[i] = c;
      if (c >= 0) counts[c]++;
    }
    let acc = 0;
    for (let c = 0; c < counts.length; c++) {
      this.start[c] = acc;
      this.cursor[c] = acc;
      acc += counts[c];
    }
    this.start[counts.length] = acc;
    for (let i = 0; i < n; i++) {
      const c = this.cellOf[i];
      if (c >= 0) this.items[this.cursor[c]++] = i;
    }
  }

  /** Write the indices of every entity in cells overlapping the box into `out`; returns how many. */
  query(minX: number, minY: number, maxX: number, maxY: number, out: Int32Array): number {
    const d = this.dim;
    const s = this.cell;
    const x0 = Math.max(0, Math.floor((minX - this.originX) / s));
    const y0 = Math.max(0, Math.floor((minY - this.originY) / s));
    const x1 = Math.min(d - 1, Math.floor((maxX - this.originX) / s));
    const y1 = Math.min(d - 1, Math.floor((maxY - this.originY) / s));
    const cap = out.length;
    let n = 0;
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const c = cy * d + cx;
        const end = this.start[c + 1];
        for (let k = this.start[c]; k < end; k++) {
          if (n >= cap) return n;
          out[n++] = this.items[k];
        }
      }
    }
    return n;
  }

  /**
   * Nearest indexed entity to (x, y) within maxR that passes `ok`, or -1.
   * Searches outward ring by ring and stops once no closer cell can exist.
   */
  nearest(
    x: number,
    y: number,
    maxR: number,
    xs: Float32Array,
    ys: Float32Array,
    ok?: (i: number) => boolean,
  ): number {
    const d = this.dim;
    const s = this.cell;
    const ccx = Math.floor((x - this.originX) / s);
    const ccy = Math.floor((y - this.originY) / s);
    const maxRing = Math.ceil(maxR / s) + 1;
    let best = -1;
    let bestD2 = maxR * maxR;
    for (let ring = 0; ring <= maxRing; ring++) {
      // A cell in ring r is at least (r - 1) cells away from any point in the centre cell.
      const minDist = (ring - 1) * s;
      if (ring > 1 && minDist * minDist > bestD2) break;
      for (let cy = ccy - ring; cy <= ccy + ring; cy++) {
        if (cy < 0 || cy >= d) continue;
        const edgeRow = cy === ccy - ring || cy === ccy + ring;
        const stepX = edgeRow ? 1 : Math.max(1, 2 * ring);
        for (let cx = ccx - ring; cx <= ccx + ring; cx += stepX) {
          if (cx < 0 || cx >= d) continue;
          const c = cy * d + cx;
          const end = this.start[c + 1];
          for (let k = this.start[c]; k < end; k++) {
            const i = this.items[k];
            const dx = xs[i] - x;
            const dy = ys[i] - y;
            const d2 = dx * dx + dy * dy;
            if (d2 < bestD2 && (!ok || ok(i))) {
              bestD2 = d2;
              best = i;
            }
          }
        }
      }
    }
    return best;
  }
}
