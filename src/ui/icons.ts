/** Card icons, drawn as simple glowing glyphs on a small canvas. */

type Ctx = CanvasRenderingContext2D;
type Glyph = (g: Ctx) => void;

const TAU = Math.PI * 2;

function poly(g: Ctx, pts: readonly (readonly [number, number])[], fill = true): void {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  if (fill) g.fill();
  else g.stroke();
}

function heartPath(g: Ctx, cx: number, cy: number, s: number): void {
  g.beginPath();
  g.moveTo(cx, cy + 12 * s);
  g.bezierCurveTo(cx - 20 * s, cy - 2 * s, cx - 10 * s, cy - 18 * s, cx, cy - 7 * s);
  g.bezierCurveTo(cx + 10 * s, cy - 18 * s, cx + 20 * s, cy - 2 * s, cx, cy + 12 * s);
  g.closePath();
}

const GLYPHS: Record<string, Glyph> = {
  arrow: (g) => {
    g.beginPath();
    g.moveTo(11, 37);
    g.lineTo(33, 15);
    g.stroke();
    poly(g, [
      [38, 10],
      [26, 13],
      [35, 22],
    ]);
    g.beginPath();
    g.moveTo(11, 37);
    g.lineTo(9, 30);
    g.moveTo(11, 37);
    g.lineTo(18, 39);
    g.stroke();
  },
  blade: (g) => {
    g.beginPath();
    g.arc(24, 24, 15, -2.6, 1.0);
    g.arc(28, 21, 11, 1.0, -2.6, true);
    g.closePath();
    g.fill();
  },
  pulse: (g) => {
    for (const [r, a] of [
      [6, 1],
      [13, 0.65],
      [20, 0.35],
    ] as const) {
      g.globalAlpha = a;
      g.beginPath();
      g.arc(24, 24, r, 0, TAU);
      g.stroke();
    }
    g.globalAlpha = 1;
  },
  strike: (g) => {
    g.fillRect(21, 5, 6, 30);
    poly(g, [
      [24, 33],
      [36, 41],
      [24, 38],
      [12, 41],
    ]);
  },
  might: (g) => {
    g.fillRect(22, 6, 4, 26);
    g.fillRect(14, 30, 20, 4);
    g.fillRect(22, 34, 4, 7);
    g.beginPath();
    g.arc(24, 43, 2.5, 0, TAU);
    g.fill();
  },
  hourglass: (g) => {
    poly(g, [
      [13, 8],
      [35, 8],
      [24, 24],
    ]);
    poly(
      g,
      [
        [13, 40],
        [35, 40],
        [24, 24],
      ],
      false,
    );
    g.fillRect(11, 6, 26, 3);
    g.fillRect(11, 39, 26, 3);
  },
  heart: (g) => {
    heartPath(g, 24, 25, 1);
    g.fill();
  },
  wing: (g) => {
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      g.moveTo(10 + k * 6, 38);
      g.quadraticCurveTo(16 + k * 7, 18 - k * 3, 38, 10 + k * 2);
      g.stroke();
    }
  },
  circles: (g) => {
    g.beginPath();
    g.arc(24, 24, 7, 0, TAU);
    g.fill();
    g.beginPath();
    g.arc(24, 24, 15, 0, TAU);
    g.stroke();
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU + Math.PI / 4;
      g.beginPath();
      g.moveTo(24 + Math.cos(a) * 18, 24 + Math.sin(a) * 18);
      g.lineTo(24 + Math.cos(a) * 22, 24 + Math.sin(a) * 22);
      g.stroke();
    }
  },
  eye: (g) => {
    g.beginPath();
    g.moveTo(6, 24);
    g.quadraticCurveTo(24, 6, 42, 24);
    g.quadraticCurveTo(24, 42, 6, 24);
    g.closePath();
    g.stroke();
    g.beginPath();
    g.arc(24, 24, 6, 0, TAU);
    g.fill();
  },
  ring: (g) => {
    g.beginPath();
    g.arc(24, 28, 12, 0, TAU);
    g.stroke();
    poly(g, [
      [24, 6],
      [31, 13],
      [24, 19],
      [17, 13],
    ]);
  },
  magnet: (g) => {
    g.lineWidth = 6;
    g.beginPath();
    g.arc(24, 22, 12, Math.PI, 0);
    g.stroke();
    g.beginPath();
    g.moveTo(12, 22);
    g.lineTo(12, 36);
    g.moveTo(36, 22);
    g.lineTo(36, 36);
    g.stroke();
  },
  twin: (g) => {
    poly(g, [
      [16, 10],
      [25, 24],
      [16, 38],
      [7, 24],
    ]);
    poly(g, [
      [32, 10],
      [41, 24],
      [32, 38],
      [23, 24],
    ]);
  },
  banner: (g) => {
    g.fillRect(12, 6, 3, 36);
    poly(g, [
      [15, 8],
      [38, 8],
      [31, 16],
      [38, 24],
      [15, 24],
    ]);
  },
  shield: (g) => {
    g.beginPath();
    g.moveTo(24, 6);
    g.lineTo(39, 12);
    g.quadraticCurveTo(39, 32, 24, 42);
    g.quadraticCurveTo(9, 32, 9, 12);
    g.closePath();
    g.fill();
  },
  candle: (g) => {
    g.fillRect(18, 20, 12, 22);
    g.beginPath();
    g.moveTo(24, 6);
    g.quadraticCurveTo(31, 14, 24, 18);
    g.quadraticCurveTo(17, 14, 24, 6);
    g.fill();
  },
  crown: (g) => {
    poly(g, [
      [8, 36],
      [8, 14],
      [17, 24],
      [24, 10],
      [31, 24],
      [40, 14],
      [40, 36],
    ]);
  },
  clock: (g) => {
    g.beginPath();
    g.arc(24, 24, 16, 0, TAU);
    g.stroke();
    g.beginPath();
    g.moveTo(24, 24);
    g.lineTo(24, 13);
    g.moveTo(24, 24);
    g.lineTo(32, 28);
    g.stroke();
  },
  star: (g) => {
    const pts: [number, number][] = [];
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * TAU - Math.PI / 2;
      const r = k % 2 ? 7 : 17;
      pts.push([24 + Math.cos(a) * r, 25 + Math.sin(a) * r]);
    }
    poly(g, pts);
  },
  feather: (g) => {
    g.beginPath();
    g.moveTo(12, 40);
    g.quadraticCurveTo(14, 14, 38, 8);
    g.quadraticCurveTo(34, 30, 12, 40);
    g.closePath();
    g.fill();
  },
  coin: (g) => {
    g.beginPath();
    g.arc(24, 24, 15, 0, TAU);
    g.stroke();
    g.beginPath();
    g.arc(24, 24, 8, 0, TAU);
    g.fill();
  },
};

/** Draw a named glyph into `canvas` at 48x48 CSS pixels, sharp on high-density screens. */
export function drawIcon(canvas: HTMLCanvasElement, name: string, color: string): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const size = 48;
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  const g = canvas.getContext('2d');
  if (!g) return;
  g.scale(dpr, dpr);
  g.clearRect(0, 0, size, size);
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = 3;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.shadowColor = color;
  g.shadowBlur = 8;
  (GLYPHS[name] ?? GLYPHS.star)(g);
}
