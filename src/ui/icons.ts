/**
 * Card icons, drawn as simple glowing glyphs on a small canvas. Schrift
 * powers show their letter inside a ring of reishi instead of a glyph.
 */

type Ctx = CanvasRenderingContext2D;
type Glyph = (g: Ctx) => void;

const TAU = Math.PI * 2;
const SERIF = '"Didot", "Bodoni 72", "Bodoni MT", Georgia, "Times New Roman", serif';

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

function starPath(g: Ctx, cx: number, cy: number, outer: number, inner: number, points: number): void {
  g.beginPath();
  for (let k = 0; k < points * 2; k++) {
    const a = (k / (points * 2)) * TAU - Math.PI / 2;
    const r = k % 2 ? inner : outer;
    g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
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
    poly(g, [
      [8, 40],
      [24, 22],
      [40, 8],
      [26, 26],
    ]);
    g.beginPath();
    g.moveTo(12, 30);
    g.lineTo(18, 36);
    g.stroke();
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
    poly(g, [
      [28, 4],
      [14, 26],
      [23, 26],
      [18, 44],
      [34, 20],
      [25, 20],
    ]);
  },
  beam: (g) => {
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(6, 38);
    g.lineTo(42, 10);
    g.stroke();
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(10, 10);
    g.lineTo(38, 38);
    g.stroke();
  },
  bomb: (g) => {
    g.beginPath();
    g.arc(22, 27, 13, 0, TAU);
    g.fill();
    g.beginPath();
    g.moveTo(30, 17);
    g.quadraticCurveTo(36, 10, 40, 12);
    g.stroke();
    starPath(g, 40, 10, 5, 2, 4);
    g.fill();
  },
  flame: (g) => {
    g.beginPath();
    g.moveTo(24, 6);
    g.bezierCurveTo(36, 18, 38, 30, 24, 42);
    g.bezierCurveTo(10, 30, 14, 20, 20, 14);
    g.bezierCurveTo(20, 22, 26, 24, 24, 6);
    g.fill();
  },
  meteor: (g) => {
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(8, 8);
    g.lineTo(26, 26);
    g.stroke();
    g.beginPath();
    g.arc(31, 31, 9, 0, TAU);
    g.fill();
  },
  thorn: (g) => {
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU;
      poly(g, [
        [24 + Math.cos(a) * 20, 24 + Math.sin(a) * 20],
        [24 + Math.cos(a + 0.35) * 6, 24 + Math.sin(a + 0.35) * 6],
        [24 + Math.cos(a - 0.35) * 6, 24 + Math.sin(a - 0.35) * 6],
      ]);
    }
  },
  gust: (g) => {
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      g.moveTo(6, 16 + k * 9);
      g.quadraticCurveTo(28, 10 + k * 9, 36, 16 + k * 9);
      g.quadraticCurveTo(42, 22 + k * 9, 34, 24 + k * 9);
      g.stroke();
    }
  },
  cloud: (g) => {
    for (const [x, y, r] of [
      [17, 27, 9],
      [27, 20, 11],
      [33, 30, 8],
      [22, 33, 7],
    ] as const) {
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();
    }
  },
  drone: (g) => {
    g.beginPath();
    g.arc(24, 24, 9, 0, TAU);
    g.fill();
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU + Math.PI / 4;
      g.beginPath();
      g.moveTo(24 + Math.cos(a) * 9, 24 + Math.sin(a) * 9);
      g.lineTo(24 + Math.cos(a) * 19, 24 + Math.sin(a) * 19);
      g.stroke();
    }
  },
  wings: (g) => {
    for (const dir of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.moveTo(24, 30);
        g.quadraticCurveTo(24 + dir * (10 + k * 4), 8 + k * 6, 24 + dir * (20 - k), 14 + k * 6);
        g.stroke();
      }
    }
  },
  drop: (g) => {
    g.beginPath();
    g.moveTo(24, 6);
    g.bezierCurveTo(34, 20, 38, 28, 24, 42);
    g.bezierCurveTo(10, 28, 14, 20, 24, 6);
    g.fill();
  },
  petal: (g) => {
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU - Math.PI / 2;
      g.save();
      g.translate(24 + Math.cos(a) * 10, 24 + Math.sin(a) * 10);
      g.rotate(a);
      g.beginPath();
      g.ellipse(0, 0, 9, 5, 0, 0, TAU);
      g.fill();
      g.restore();
    }
  },
  snow: (g) => {
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI;
      g.beginPath();
      g.moveTo(24 + Math.cos(a) * 19, 24 + Math.sin(a) * 19);
      g.lineTo(24 - Math.cos(a) * 19, 24 - Math.sin(a) * 19);
      g.stroke();
    }
    g.beginPath();
    g.arc(24, 24, 4, 0, TAU);
    g.fill();
  },
  missile: (g) => {
    g.save();
    g.translate(24, 24);
    g.rotate(-Math.PI / 4);
    g.fillRect(-14, -5, 22, 10);
    poly(g, [
      [8, -5],
      [18, 0],
      [8, 5],
    ]);
    poly(g, [
      [-14, -5],
      [-20, -10],
      [-14, 0],
    ]);
    poly(g, [
      [-14, 5],
      [-20, 10],
      [-14, 0],
    ]);
    g.restore();
  },
  helm: (g) => {
    g.beginPath();
    g.moveTo(10, 38);
    g.quadraticCurveTo(8, 12, 24, 10);
    g.quadraticCurveTo(40, 12, 38, 38);
    g.closePath();
    g.fill();
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.fillRect(14, 22, 20, 4);
    g.restore();
    poly(g, [
      [22, 10],
      [24, 2],
      [26, 10],
    ]);
  },
  tube: (g) => {
    g.save();
    g.translate(24, 24);
    g.rotate(Math.PI / 4);
    g.strokeRect(-5, -16, 10, 30);
    g.fillRect(-5, 0, 10, 14);
    g.restore();
  },
  cross: (g) => {
    g.beginPath();
    g.arc(24, 24, 17, 0, TAU);
    g.stroke();
    starPath(g, 24, 25, 13, 5.5, 5);
    g.fill();
  },
  glove: (g) => {
    g.beginPath();
    g.moveTo(14, 40);
    g.lineTo(14, 20);
    g.quadraticCurveTo(14, 16, 18, 16);
    g.lineTo(18, 10);
    g.quadraticCurveTo(21, 6, 24, 10);
    g.lineTo(24, 16);
    g.lineTo(30, 16);
    g.quadraticCurveTo(36, 18, 34, 26);
    g.lineTo(34, 40);
    g.closePath();
    g.fill();
  },
  might: (g) => {
    g.fillRect(22, 6, 4, 26);
    g.fillRect(14, 30, 20, 4);
    g.fillRect(22, 34, 4, 7);
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
  reroll: (g) => {
    // Two arrows chasing each other round a circle: draw again.
    for (const start of [0, Math.PI]) {
      const end = start + Math.PI - 0.45;
      g.beginPath();
      g.arc(24, 24, 13, start + 0.3, end);
      g.stroke();
      const x = 24 + Math.cos(end) * 13;
      const y = 24 + Math.sin(end) * 13;
      const t = end + Math.PI / 2;
      poly(g, [
        [x + Math.cos(t) * 7, y + Math.sin(t) * 7],
        [x + Math.cos(end) * 5, y + Math.sin(end) * 5],
        [x - Math.cos(end) * 5, y - Math.sin(end) * 5],
      ]);
    }
  },
  twin: (g) => {
    g.beginPath();
    g.arc(17, 24, 10, 0, TAU);
    g.stroke();
    g.beginPath();
    g.arc(31, 24, 10, 0, TAU);
    g.stroke();
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
    starPath(g, 24, 25, 17, 7, 5);
    g.fill();
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

function setup(canvas: HTMLCanvasElement, size: number): Ctx | null {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  const g = canvas.getContext('2d');
  if (!g) return null;
  g.scale(dpr, dpr);
  g.clearRect(0, 0, size, size);
  return g;
}

/**
 * Draw a card icon at 48x48 CSS pixels. With a `letter`, it is that Schrift
 * letter in a ring of reishi; otherwise the named glyph.
 */
export function drawIcon(canvas: HTMLCanvasElement, name: string, color: string, letter?: string): void {
  const g = setup(canvas, 48);
  if (!g) return;
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = 3;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.shadowColor = color;
  g.shadowBlur = 8;
  if (letter) {
    g.lineWidth = 2;
    g.beginPath();
    g.arc(24, 24, 19, 0, TAU);
    g.stroke();
    g.shadowBlur = 6;
    g.fillStyle = '#f4f1ea';
    g.font = `700 28px ${SERIF}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(letter, 24, 26);
    return;
  }
  (GLYPHS[name] ?? GLYPHS.star)(g);
}

/** The title emblem: a five-pointed star of reishi inside a ring. */
export function drawEmblem(canvas: HTMLCanvasElement, size: number): void {
  const g = setup(canvas, size);
  if (!g) return;
  const c = size / 2;
  g.shadowColor = '#59b8ff';
  g.shadowBlur = size * 0.12;
  g.strokeStyle = '#9fdcff';
  g.lineWidth = size * 0.035;
  g.beginPath();
  g.arc(c, c, c * 0.82, 0, TAU);
  g.stroke();
  g.fillStyle = '#e6f6ff';
  starPath(g, c, c * 1.04, c * 0.62, c * 0.24, 5);
  g.fill();
}
