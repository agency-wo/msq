import { formatTime } from '../core/math';
import type { StageId } from '../data/stages';
import { drawEmperor } from '../render/atlas';
import { drawIcon } from './icons';
import { drawVista } from './vistas';

/** What the result card shows. */
export interface ShareRun {
  stage: StageId;
  stageName: string;
  /** How far the Emperor evolved, so he is drawn that way. */
  evolution: number;
  mode: string;
  victory: boolean;
  quit: boolean;
  time: number;
  level: number;
  kills: number;
  powers: readonly { icon: string; color: string; letter?: string; level: number; attr: string | null; bankai: boolean }[];
  top: { name: string; share: number } | null;
  /** "Daily Trial · October 19 · Frail + Giants" on a daily run. */
  daily: string | null;
}

const W = 1080;
const H = 1350;
const SERIF = '"Didot", "Bodoni 72", "Bodoni MT", Georgia, "Times New Roman", serif';
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const BONE = '#efeae0';
const QUINCY = '#9fdcff';
const SITE = 'play.minarankstudio.com';

/** Letters spread apart by hand, since canvas letter spacing is not supported everywhere yet. */
function spaced(g: CanvasRenderingContext2D, text: string, x: number, y: number, gap: number): void {
  let cx = x;
  for (const ch of text) {
    g.fillText(ch, cx, y);
    cx += g.measureText(ch).width + gap;
  }
}

/**
 * A 1080x1350 picture of a finished run: the stage's vista with the Emperor
 * in front, the verdict, the time, level and kills, the build as icons, the
 * daily rules or the top damage dealer, and where to play.
 */
export function drawShareCard(r: ShareRun): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  if (!g) return c;
  g.fillStyle = '#07080c';
  g.fillRect(0, 0, W, H);
  const vista = document.createElement('canvas');
  drawVista(vista, r.stage, W / 2, 300, 2);
  g.drawImage(vista, 0, 0, W, 600);
  // Ink at the top for the title, and the vista fading into ink below it.
  const shade = g.createLinearGradient(0, 0, 0, 230);
  shade.addColorStop(0, 'rgba(7,8,12,0.8)');
  shade.addColorStop(1, 'rgba(7,8,12,0)');
  g.fillStyle = shade;
  g.fillRect(0, 0, W, 230);
  const fade = g.createLinearGradient(0, 270, 0, 520);
  fade.addColorStop(0, 'rgba(7,8,12,0)');
  fade.addColorStop(1, 'rgba(7,8,12,1)');
  g.fillStyle = fade;
  g.fillRect(0, 270, W, 330);
  // The Emperor as far as he evolved, standing on the right.
  const hero = document.createElement('canvas');
  drawEmperor(hero, r.evolution, 560, 1);
  g.save();
  g.shadowColor = r.victory ? 'rgba(255,203,92,0.6)' : 'rgba(89,184,255,0.45)';
  g.shadowBlur = 40;
  g.drawImage(hero, W - 560, 96);
  g.restore();
  g.fillStyle = BONE;
  g.font = `700 54px ${SERIF}`;
  spaced(g, 'QUINCY', 60, 104, 14);
  g.fillStyle = QUINCY;
  g.font = `800 22px ${SANS}`;
  spaced(g, 'SURVIVAL', 64, 142, 14);
  g.fillStyle = r.victory ? '#ffcb5c' : r.quit ? '#c9cbd4' : '#ff8b9b';
  g.font = `700 140px ${SERIF}`;
  g.fillText(r.victory ? 'Victory' : r.quit ? 'Withdrawn' : 'Fallen', 60, 640);
  g.fillStyle = QUINCY;
  g.font = `800 34px ${SANS}`;
  spaced(g, (r.mode ? `${r.stageName} · ${r.mode}` : r.stageName).toUpperCase(), 64, 700, 5);
  g.fillStyle = BONE;
  g.font = `700 200px ${SERIF}`;
  g.fillText(formatTime(r.time), 56, 900);
  g.fillStyle = '#c9cbd4';
  g.font = `700 42px ${SANS}`;
  g.fillText(`Level ${r.level}  ·  ${r.kills.toLocaleString('en-US')} kills`, 62, 966);
  // The build: two rows of icons at most, levels in the corner, awakened ones framed in gold.
  const size = 92;
  const gap = 14;
  const perRow = Math.floor((W - 120 + gap) / (size + gap));
  r.powers.slice(0, perRow * 2).forEach((pw, k) => {
    const x = 60 + (k % perRow) * (size + gap);
    const y = 1010 + Math.floor(k / perRow) * (size + gap + 8);
    g.fillStyle = 'rgba(14,16,24,0.95)';
    g.fillRect(x, y, size, size);
    g.strokeStyle = pw.attr ? '#ffcb5c' : pw.bankai ? 'rgba(255,203,92,0.7)' : 'rgba(239,234,224,0.25)';
    g.lineWidth = 3;
    g.strokeRect(x + 1.5, y + 1.5, size - 3, size - 3);
    const icon = document.createElement('canvas');
    drawIcon(icon, pw.icon, pw.color, pw.letter, 2);
    g.drawImage(icon, x + 4, y + 4, size - 8, size - 8);
    g.fillStyle = '#07080c';
    g.fillRect(x + size - 34, y + size - 30, 34, 30);
    g.fillStyle = pw.attr ? '#ffcb5c' : BONE;
    g.font = `800 22px ${SANS}`;
    g.textAlign = 'center';
    g.fillText(String(pw.level), x + size - 17, y + size - 8);
    g.textAlign = 'left';
  });
  g.fillStyle = '#c9cbd4';
  g.font = `700 32px ${SANS}`;
  const note = r.daily ?? (r.top ? `Top damage: ${r.top.name} · ${r.top.share}%` : '');
  if (note) g.fillText(note, 62, 1268);
  g.fillStyle = QUINCY;
  g.font = `800 28px ${SANS}`;
  g.textAlign = 'right';
  g.fillText(SITE, W - 60, H - 40);
  g.textAlign = 'left';
  return c;
}

function shareText(r: ShareRun): string {
  const where = r.mode ? `${r.stageName} (${r.mode})` : r.stageName;
  const what = r.victory ? `Cleared ${where}` : `Survived ${formatTime(r.time)} in ${where}`;
  return `${what} at level ${r.level} in Quincy Survival. https://${SITE}`;
}

/**
 * Share the run's card through the phone's share sheet; where there is none
 * (most desktops), save it as a PNG instead.
 */
export async function shareRun(r: ShareRun): Promise<'shared' | 'saved' | 'cancelled' | 'failed'> {
  const blob = await new Promise<Blob | null>((resolve) => drawShareCard(r).toBlob(resolve, 'image/png'));
  if (!blob) return 'failed';
  const file = new File([blob], 'quincy-survival.png', { type: 'image/png' });
  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Quincy Survival', text: shareText(r) });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'saved';
}
