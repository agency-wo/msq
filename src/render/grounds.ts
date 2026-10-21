/**
 * The stage grounds, drawn as a manga background is: flat mid tones, hard ink
 * lines, screentone dots for shade, nothing airbrushed. Each stays in the
 * middle of the tonal range and sparse, so the black swarm and its bone masks
 * read first, the way they do on a Magic Survival field. One 1024 px tile per
 * stage covering 512 world units; everything that crosses an edge is drawn
 * again on the far side so the tile repeats without a seam.
 */

type Ctx = CanvasRenderingContext2D;
type Pt = readonly [number, number];

const TAU = Math.PI * 2;

function seeded(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Call `fn` at (x, y) and at each copy across the tile's edges that a feature of radius r would reach. */
function wrapped(S: number, x: number, y: number, r: number, fn: (x: number, y: number) => void): void {
  for (const dx of [-S, 0, S]) {
    for (const dy of [-S, 0, S]) {
      const X = x + dx;
      const Y = y + dy;
      if (X + r < 0 || X - r > S || Y + r < 0 || Y - r > S) continue;
      fn(X, Y);
    }
  }
}

/** Screentone: a grid of dots, every other row offset, inside the current clip. */
function tone(g: Ctx, x0: number, y0: number, w: number, h: number, step: number, r: number, color: string): void {
  g.fillStyle = color;
  g.beginPath();
  for (let y = y0 - step; y < y0 + h + step; y += step) {
    const odd = Math.round((y - y0) / step) % 2 !== 0;
    for (let x = x0 - step + (odd ? step / 2 : 0); x < x0 + w + step; x += step) {
      g.moveTo(x + r, y);
      g.arc(x, y, r, 0, TAU);
    }
  }
  g.fill();
}

/** A brush stroke through `pts`: fattest in the middle, tapering to points at both ends. */
function brush(g: Ctx, pts: readonly Pt[], width: number, color: string): void {
  if (pts.length < 2) return;
  const left: Pt[] = [];
  const right: Pt[] = [];
  const n = pts.length - 1;
  for (let k = 0; k <= n; k++) {
    const a = pts[Math.max(0, k - 1)];
    const b = pts[Math.min(n, k + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const t = k / n;
    const half = (width / 2) * Math.pow(Math.sin(Math.PI * t), 0.55);
    const nx = (-dy / len) * half;
    const ny = (dx / len) * half;
    left.push([pts[k][0] + nx, pts[k][1] + ny]);
    right.push([pts[k][0] - nx, pts[k][1] - ny]);
  }
  g.fillStyle = color;
  g.beginPath();
  left.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  for (let k = right.length - 1; k >= 0; k--) g.lineTo(right[k][0], right[k][1]);
  g.closePath();
  g.fill();
}

/** A jagged crack of `segs` kinks from (x, y), with a short branch off the middle. */
function crack(g: Ctx, x: number, y: number, len: number, angle: number, rnd: () => number, color: string, width: number): void {
  const pts: Pt[] = [[x, y]];
  let a = angle;
  let px = x;
  let py = y;
  const segs = 5;
  for (let k = 0; k < segs; k++) {
    a += (rnd() - 0.5) * 1.1;
    px += Math.cos(a) * (len / segs);
    py += Math.sin(a) * (len / segs);
    pts.push([px, py]);
  }
  brush(g, pts, width, color);
  const m = pts[2];
  const b = a + (rnd() < 0.5 ? 1 : -1) * (0.7 + rnd() * 0.5);
  brush(g, [m, [m[0] + Math.cos(b) * len * 0.3, m[1] + Math.sin(b) * len * 0.3], [m[0] + Math.cos(b + 0.3) * len * 0.45, m[1] + Math.sin(b + 0.3) * len * 0.45]], width * 0.7, color);
}

/** A wavy line right across the tile (it wraps horizontally), as points. */
function wave(S: number, y: number, amp: number, freq: number, phase: number, steps = 48): Pt[] {
  const pts: Pt[] = [];
  for (let k = 0; k <= steps; k++) {
    const x = (k / steps) * S;
    pts.push([x, y + Math.sin((x / S) * TAU * freq + phase) * amp + Math.sin((x / S) * TAU * (freq * 2 + 1) + phase * 1.7) * amp * 0.3]);
  }
  return pts;
}

/** Fill the whole tile with a flat tone. */
function base(g: Ctx, S: number, color: string): void {
  g.fillStyle = color;
  g.fillRect(0, 0, S, S);
}

/**
 * Hueco Mundo: the endless pale sand under its black night. Long dune crests
 * in brush, screentone in the lee of each, half-buried bone, the white twigs
 * of a dead quartz tree.
 */
export function huecoGround(g: Ctx, S: number): void {
  const rnd = seeded(808);
  base(g, S, '#57585b');
  for (let k = 0; k < 6; k++) {
    const y = (k + 0.3 + rnd() * 0.4) * (S / 6);
    const freq = 1 + Math.floor(rnd() * 2);
    const phase = rnd() * TAU;
    const crest = wave(S, y, 26 + rnd() * 16, freq, phase);
    // The lee side: screentone in a band under the crest.
    g.save();
    g.beginPath();
    crest.forEach(([x, cy], i) => (i ? g.lineTo(x, cy) : g.moveTo(x, cy)));
    for (let i = crest.length - 1; i >= 0; i--) g.lineTo(crest[i][0], crest[i][1] + 44 + Math.sin(i * 0.7) * 8);
    g.closePath();
    g.clip();
    tone(g, 0, y - 80, S, 200, 9, 1.7, '#44464a');
    g.restore();
    // The crest itself, a pale stroke; it runs off both sides, so draw it a tile over each way as well.
    for (const dx of [-S, 0, S]) {
      brush(
        g,
        crest.map(([x, cy]) => [x + dx, cy] as Pt),
        5,
        '#7b7c7c',
      );
    }
  }
  // Half-buried bone: skull plates and ribs.
  for (let k = 0; k < 5; k++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const s = 0.8 + rnd() * 0.6;
    const rot = rnd() * TAU;
    wrapped(S, x, y, 40, (X, Y) => {
      g.save();
      g.translate(X, Y);
      g.rotate(rot);
      g.scale(s, s);
      g.fillStyle = '#b4afa3';
      if (k % 2 === 0) {
        g.beginPath();
        g.ellipse(0, 0, 13, 10, 0, Math.PI, TAU);
        g.lineTo(13, 3);
        g.lineTo(-13, 3);
        g.closePath();
        g.fill();
        g.fillStyle = '#2c2d31';
        g.beginPath();
        g.ellipse(-5, -3, 3, 2.4, 0, 0, TAU);
        g.ellipse(5, -3, 3, 2.4, 0, 0, TAU);
        g.fill();
      } else {
        g.strokeStyle = '#b4afa3';
        g.lineWidth = 3;
        g.lineCap = 'round';
        for (let r = 0; r < 4; r++) {
          g.beginPath();
          g.arc(0, 18, 14 + r * 6, Math.PI * 1.15, Math.PI * 1.5);
          g.stroke();
        }
      }
      g.restore();
    });
  }
  // A dead quartz tree's white twigs, fallen flat.
  for (let k = 0; k < 2; k++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const seed = 600 + k;
    wrapped(S, x, y, 70, (X, Y) => {
      // Its own generator, fresh for each copy, so the copies across an edge match.
      const tr = seeded(seed);
      const branch = (bx: number, by: number, a: number, len: number, depth: number): void => {
        const ex = bx + Math.cos(a) * len;
        const ey = by + Math.sin(a) * len;
        brush(g, [[bx, by], [(bx + ex) / 2, (by + ey) / 2], [ex, ey]], Math.max(1.4, depth * 1.6), '#c9c6bd');
        if (depth > 0) {
          branch(ex, ey, a - 0.5 - tr() * 0.3, len * 0.62, depth - 1);
          branch(ex, ey, a + 0.5 + tr() * 0.3, len * 0.62, depth - 1);
        }
      };
      branch(X, Y, tr() * TAU, 26, 3);
    });
  }
  // Grit.
  g.fillStyle = '#3e4044';
  for (let k = 0; k < 140; k++) {
    g.beginPath();
    g.arc(rnd() * S, rnd() * S, 1 + rnd() * 1.4, 0, TAU);
    g.fill();
  }
}

/**
 * The Seireitei: a courtyard of big slate flagstones in staggered rows,
 * grouted in ink, worn and cracked, with strips of raked gravel.
 */
export function seireiteiGround(g: Ctx, S: number): void {
  const rnd = seeded(4141);
  base(g, S, '#4d4f55');
  const rows = 8;
  const rh = S / rows;
  for (let r = 0; r < rows; r++) {
    const y = r * rh;
    if (r === 3) {
      // A strip of raked gravel: dense pale dots and rake lines.
      g.save();
      g.beginPath();
      g.rect(0, y, S, rh);
      g.clip();
      base(g, S, '#5a5c61');
      tone(g, 0, y, S, rh, 7, 1.3, '#6c6e72');
      g.strokeStyle = '#46484d';
      g.lineWidth = 2;
      for (let k = 1; k < 4; k++) {
        g.beginPath();
        g.moveTo(0, y + (k * rh) / 4);
        g.lineTo(S, y + (k * rh) / 4);
        g.stroke();
      }
      g.restore();
      continue;
    }
    const off = r % 2 === 0 ? 0 : rh * 0.75;
    for (let x = -off; x < S; x += rh * 1.5) {
      const shade = ['#4b4d53', '#51535a', '#474950', '#4e5056'][Math.floor(rnd() * 4)];
      g.fillStyle = shade;
      g.fillRect(x + 3, y + 3, rh * 1.5 - 6, rh - 6);
      if (rnd() < 0.35) {
        // A worn corner in screentone.
        g.save();
        g.beginPath();
        g.moveTo(x + 3, y + rh - 3);
        g.lineTo(x + 3 + rh * 0.7, y + rh - 3);
        g.lineTo(x + 3, y + rh * 0.3);
        g.closePath();
        g.clip();
        tone(g, x, y, rh * 1.5, rh, 8, 1.5, '#3c3e44');
        g.restore();
      }
    }
    // Grout in ink.
    g.fillStyle = '#2a2b30';
    g.fillRect(0, y, S, 3);
    for (let x = -off; x < S + rh; x += rh * 1.5) {
      g.fillRect(x - 1, y, 3, rh);
    }
  }
  for (let k = 0; k < 9; k++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const len = 50 + rnd() * 30;
    const a = rnd() * TAU;
    wrapped(S, x, y, 60, (X, Y) => crack(g, X, Y, len, a, seeded(300 + k), '#2a2b30', 2.6));
  }
}

/**
 * Las Noches: the polished floor of Aizen's palace, pale under the sky painted
 * on the dome, sand drifted along the seams, the long shadows of its pillars
 * laid across in screentone.
 */
export function lasnochesGround(g: Ctx, S: number): void {
  const rnd = seeded(7070);
  base(g, S, '#5e6370');
  const tile = 256;
  // Tile seams: a pale line and an ink line beside it.
  for (let k = 0; k <= S; k += tile) {
    g.fillStyle = '#767c8a';
    g.fillRect(k - 2, 0, 2, S);
    g.fillRect(0, k - 2, S, 2);
    g.fillStyle = '#3e434e';
    g.fillRect(k, 0, 2, S);
    g.fillRect(0, k, S, 2);
  }
  // Pillar shadows: diagonal bands of screentone, wrapping round the tile.
  for (const off of [120, 560]) {
    g.save();
    g.beginPath();
    for (const dx of [-S, 0, S]) {
      g.moveTo(off + dx, 0);
      g.lineTo(off + dx + 150, 0);
      g.lineTo(off + dx + 150 - S, S);
      g.lineTo(off + dx - S, S);
      g.closePath();
    }
    g.clip();
    tone(g, 0, 0, S, S, 9, 2, '#474c58');
    g.restore();
  }
  // Sand drifted in the corners of the seams.
  for (let k = 0; k < 6; k++) {
    const x = Math.floor(rnd() * 4) * tile + 10;
    const y = Math.floor(rnd() * 4) * tile + 10;
    wrapped(S, x, y, 120, (X, Y) => {
      brush(g, [[X, Y + 30], [X + 40, Y + 18], [X + 90, Y + 8]], 10, '#858b98');
      brush(g, [[X + 6, Y + 52], [X + 30, Y + 44], [X + 64, Y + 38]], 6, '#7d8390');
    });
  }
}

/**
 * Silbern: the Wandenreich's city laid over the Seireitei. Slate flagstones
 * with silver seams, the Quincy cross cut into the stone, and pools of the
 * shadow it rose from.
 */
export function silbernGround(g: Ctx, S: number): void {
  const rnd = seeded(2626);
  base(g, S, '#555a63');
  const tile = 256;
  for (let y = 0; y < S; y += tile) {
    for (let x = 0; x < S; x += tile) {
      g.fillStyle = ['#535861', '#585d66', '#51565f'][Math.floor(rnd() * 3)];
      g.fillRect(x + 2, y + 2, tile - 4, tile - 4);
    }
  }
  g.fillStyle = '#737a88';
  for (let k = 0; k <= S; k += tile) {
    g.fillRect(k - 1, 0, 2, S);
    g.fillRect(0, k - 1, S, 2);
  }
  // Pools of shadow in screentone.
  for (let k = 0; k < 4; k++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const r = 70 + rnd() * 60;
    wrapped(S, x, y, r, (X, Y) => {
      const pr = seeded(900 + k);
      g.save();
      g.beginPath();
      for (let i = 0; i <= 18; i++) {
        const a = (i / 18) * TAU;
        const rr = r * (0.75 + pr() * 0.3);
        if (i === 0) g.moveTo(X + Math.cos(a) * rr, Y + Math.sin(a) * rr * 0.7);
        else g.lineTo(X + Math.cos(a) * rr, Y + Math.sin(a) * rr * 0.7);
      }
      g.closePath();
      g.clip();
      tone(g, X - r, Y - r, r * 2, r * 2, 8, 2.1, '#3b3f47');
      g.restore();
    });
  }
  // The Quincy cross cut into the stone: a five-pointed star in a ring, in ink.
  for (const [x, y] of [
    [tile * 0.5, tile * 1.5],
    [tile * 2.5, tile * 3.5],
  ] as const) {
    g.strokeStyle = '#30343b';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(x, y, 44, 0, TAU);
    g.stroke();
    g.beginPath();
    for (let k = 0; k <= 5; k++) {
      const a = -Math.PI / 2 + ((k * 2) % 5) * (TAU / 5);
      if (k === 0) g.moveTo(x + Math.cos(a) * 40, y + Math.sin(a) * 40);
      else g.lineTo(x + Math.cos(a) * 40, y + Math.sin(a) * 40);
    }
    g.stroke();
  }
}

/**
 * The Soul King Palace: big marble tiles with thin gold seams, round inlays,
 * and the scrolling clouds of a temple painting drifting over them.
 */
export function palaceGround(g: Ctx, S: number): void {
  const rnd = seeded(9191);
  base(g, S, '#66625a');
  const tile = 512;
  g.fillStyle = '#857552';
  for (let k = 0; k <= S; k += tile) {
    g.fillRect(k - 1.5, 0, 3, S);
    g.fillRect(0, k - 1.5, S, 3);
  }
  // Round inlays where the seams cross: a gold ring, an ink ring inside.
  for (let y = 0; y <= S; y += tile) {
    for (let x = 0; x <= S; x += tile) {
      g.strokeStyle = '#857552';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(x, y, 26, 0, TAU);
      g.stroke();
      g.strokeStyle = '#3e3b35';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(x, y, 18, 0, TAU);
      g.stroke();
    }
  }
  // Scroll clouds: rows of scalloped curls in pale line, with screentone under them.
  for (let k = 0; k < 3; k++) {
    const x = rnd() * S;
    const y = rnd() * S;
    wrapped(S, x, y, 160, (X, Y) => {
      g.save();
      g.beginPath();
      g.ellipse(X, Y + 8, 140, 30, 0, 0, TAU);
      g.clip();
      tone(g, X - 150, Y - 30, 300, 80, 8, 1.6, '#57534c');
      g.restore();
      g.strokeStyle = '#8b8677';
      g.lineWidth = 4;
      g.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const cx = X - 120 + i * 48;
        g.beginPath();
        g.arc(cx, Y, 22, Math.PI, TAU);
        g.stroke();
        g.beginPath();
        g.arc(cx + 6, Y - 2, 9, Math.PI * 1.1, Math.PI * 2.3);
        g.stroke();
      }
    });
  }
}

/**
 * The Wahrwelt: black stone the Emperor raised from the Soul King's palace,
 * split by red cracks of reiatsu, set with pale stars, and here and there an
 * eye of The Almighty half open in the rock.
 */
export function wahrweltGround(g: Ctx, S: number): void {
  const rnd = seeded(3131);
  base(g, S, '#2c2026');
  tone(g, 0, 0, S, S, 12, 1.6, '#35282f');
  for (let k = 0; k < 12; k++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const len = 70 + rnd() * 60;
    const a = rnd() * TAU;
    wrapped(S, x, y, len, (X, Y) => {
      const r2 = seeded(k * 97 + 5);
      crack(g, X, Y, len, a, r2, '#7a1828', 5);
      const r3 = seeded(k * 97 + 5);
      crack(g, X, Y, len, a, r3, '#c43046', 1.8);
    });
  }
  g.fillStyle = '#b9b4c4';
  for (let k = 0; k < 40; k++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const r = 1.4 + rnd() * 1.8;
    g.beginPath();
    g.moveTo(x, y - r * 2);
    g.lineTo(x + r * 0.5, y - r * 0.5);
    g.lineTo(x + r * 2, y);
    g.lineTo(x + r * 0.5, y + r * 0.5);
    g.lineTo(x, y + r * 2);
    g.lineTo(x - r * 0.5, y + r * 0.5);
    g.lineTo(x - r * 2, y);
    g.lineTo(x - r * 0.5, y - r * 0.5);
    g.closePath();
    g.fill();
  }
  // Eyes in the rock, half open.
  for (let k = 0; k < 3; k++) {
    const x = rnd() * S;
    const y = rnd() * S;
    wrapped(S, x, y, 50, (X, Y) => {
      g.fillStyle = '#16100f';
      g.beginPath();
      g.moveTo(X - 34, Y);
      g.quadraticCurveTo(X, Y - 16, X + 34, Y);
      g.quadraticCurveTo(X, Y + 12, X - 34, Y);
      g.fill();
      g.fillStyle = '#a3182c';
      g.beginPath();
      g.arc(X, Y - 1, 7, 0, TAU);
      g.fill();
      g.fillStyle = '#0a0708';
      g.fillRect(X - 1.5, Y - 7, 3, 12);
      g.strokeStyle = '#52404a';
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(X - 38, Y + 1);
      g.quadraticCurveTo(X, Y - 20, X + 38, Y + 1);
      g.stroke();
    });
  }
}

/**
 * Karakura Town at night: asphalt, the dashed line down the middle of the
 * road, a zebra crossing, a manhole cover, and the cracks of an old street.
 */
export function karakuraGround(g: Ctx, S: number): void {
  const rnd = seeded(5353);
  base(g, S, '#46474c');
  // Worn patches of screentone.
  for (let k = 0; k < 6; k++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const r = 50 + rnd() * 50;
    const rot = rnd() * Math.PI;
    wrapped(S, x, y, r, (X, Y) => {
      g.save();
      g.beginPath();
      g.ellipse(X, Y, r, r * 0.6, rot, 0, TAU);
      g.clip();
      tone(g, X - r, Y - r, r * 2, r * 2, 8, 1.5, '#3a3b40');
      g.restore();
    });
  }
  // The road's centre line, dashed, top to bottom.
  g.fillStyle = '#a3a097';
  for (let y = 0; y < S; y += 128) g.fillRect(S / 2 - 5, y + 20, 10, 70);
  // A zebra crossing over the road.
  for (let k = 0; k < 7; k++) g.fillRect(S / 2 - 230 + k * 68, 760, 36, 120);
  // A manhole cover.
  const mx = 220;
  const my = 300;
  g.fillStyle = '#35363a';
  g.beginPath();
  g.arc(mx, my, 40, 0, TAU);
  g.fill();
  g.strokeStyle = '#5c5d62';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(mx, my, 34, 0, TAU);
  g.stroke();
  g.save();
  g.beginPath();
  g.arc(mx, my, 30, 0, TAU);
  g.clip();
  for (let k = -30; k <= 30; k += 10) {
    g.beginPath();
    g.moveTo(mx + k, my - 32);
    g.lineTo(mx + k, my + 32);
    g.moveTo(mx - 32, my + k);
    g.lineTo(mx + 32, my + k);
    g.stroke();
  }
  g.restore();
  for (let k = 0; k < 8; k++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const len = 46 + rnd() * 30;
    const a = rnd() * TAU;
    wrapped(S, x, y, 60, (X, Y) => crack(g, X, Y, len, a, seeded(700 + k), '#2b2c30', 2.4));
  }
}
