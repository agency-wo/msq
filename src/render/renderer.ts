// Must come before any other Pixi import: swaps Pixi's `new Function` code paths for
// eval-free versions, so the game runs under a strict Content-Security-Policy.
import 'pixi.js/unsafe-eval';
import { Application, Container, Particle, ParticleContainer, TilingSprite, type Texture } from 'pixi.js';
import { PLAYER, VIEW_H_LANDSCAPE, VIEW_W } from '../config';
import type { Input } from '../core/input';
import {
  FLAG_BOSS,
  FLAG_ELITE,
  FX_BEAM,
  FX_BOLT,
  FX_DOT,
  FX_GLOW,
  FX_RING,
  FX_SHARD,
  FX_SPARK,
  LAYER_ADD,
  PK_ARROW,
  PK_BLADE,
} from '../game/constants';
import type { World } from '../game/world';
import { ATLAS_SCALE, buildAtlas, buildGroundTile, type Atlas } from './atlas';

/** Particle colour is tint in BGR order plus alpha in the top byte, written straight to a Uint32 buffer. */
function packColor(rgb: number, alpha: number): number {
  const a = alpha <= 0 ? 0 : alpha >= 1 ? 255 : (alpha * 255) | 0;
  const bgr = ((rgb & 0xff) << 16) | (rgb & 0xff00) | ((rgb >>> 16) & 0xff);
  return bgr + a * 16777216;
}

/** One ParticleContainer whose particles are pooled and re-filled every frame. */
class Layer {
  readonly view: ParticleContainer;
  private readonly pool: Particle[] = [];
  private used = 0;

  constructor(base: Texture, additive = false) {
    this.view = new ParticleContainer({
      texture: base,
      dynamicProperties: { position: true, rotation: true, vertex: true, uvs: true, color: true },
    });
    if (additive) this.view.blendMode = 'add';
  }

  begin(): void {
    this.used = 0;
  }

  add(tex: Texture, x: number, y: number, sx: number, sy: number, rot = 0, tint = 0xffffff, alpha = 1, ax = 0.5, ay = 0.5): void {
    let p = this.pool[this.used];
    if (!p) {
      p = new Particle({ texture: tex });
      this.pool.push(p);
    }
    p.texture = tex;
    p.x = x;
    p.y = y;
    p.scaleX = sx;
    p.scaleY = sy;
    p.rotation = rot;
    p.anchorX = ax;
    p.anchorY = ay;
    p.color = packColor(tint, alpha);
    this.used++;
  }

  /** particleChildren always mirrors pool[0..used), so only its length ever changes. */
  end(): void {
    const children = this.view.particleChildren;
    if (children.length === this.used) return;
    if (children.length > this.used) children.length = this.used;
    else for (let i = children.length; i < this.used; i++) children.push(this.pool[i]);
    this.view.update();
  }

  get count(): number {
    return this.used;
  }
}

interface EnemySprite {
  tex: Texture;
  flash: Texture;
  /** Radius the art was drawn for. */
  ref: number;
}

interface FxSprite {
  tex: Texture;
  w: number;
  h: number;
}

const ORB_SCALE = [0.42, 0.5, 0.62];

export class Renderer {
  readonly app = new Application();
  zoom = 1;
  /** Particles drawn last frame, for the debug overlay. */
  drawn = 0;
  shakeEnabled = true;
  private atlas!: Atlas;
  private ground!: TilingSprite;
  private readonly worldRoot = new Container();
  private layers: Layer[] = [];
  private L!: Record<'pickups' | 'orbs' | 'auras' | 'shadows' | 'enemies' | 'player' | 'proj' | 'fxAdd' | 'fx' | 'nums' | 'hud', Layer>;
  private enemySprites: EnemySprite[] = [];
  private fxSprites: FxSprite[] = [];
  private digits: Texture[] = [];
  private camX = 0;
  private camY = 0;

  async init(host: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: window,
      background: '#07080d',
      antialias: false,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      autoStart: false,
      preference: 'webgl',
      powerPreference: 'high-performance',
    });
    host.appendChild(this.app.canvas);
    this.atlas = buildAtlas();
    const f = this.atlas.frames;
    this.ground = new TilingSprite({ texture: buildGroundTile(), width: 16, height: 16 });
    const base = this.atlas.base;
    this.L = {
      pickups: new Layer(base),
      orbs: new Layer(base),
      auras: new Layer(base, true),
      shadows: new Layer(base),
      enemies: new Layer(base),
      player: new Layer(base),
      proj: new Layer(base, true),
      fxAdd: new Layer(base, true),
      fx: new Layer(base),
      nums: new Layer(base),
      hud: new Layer(base),
    };
    const L = this.L;
    this.layers = Object.values(L);
    this.worldRoot.addChild(
      L.pickups.view,
      L.orbs.view,
      L.auras.view,
      L.shadows.view,
      L.enemies.view,
      L.player.view,
      L.proj.view,
      L.fxAdd.view,
      L.fx.view,
      L.nums.view,
    );
    this.app.stage.addChild(this.ground, this.worldRoot, L.hud.view);
    // Indexed by enemy type, matching ENEMY_LIST order.
    this.enemySprites = [
      { tex: f.wisp, flash: f.wisp_f, ref: 11 },
      { tex: f.runner, flash: f.runner_f, ref: 9 },
      { tex: f.brute, flash: f.brute_f, ref: 18 },
      { tex: f.bomber, flash: f.bomber_f, ref: 12 },
      { tex: f.warden, flash: f.warden_f, ref: 40 },
    ];
    // Indexed by FX_* id.
    const fx = (name: string): FxSprite => ({ tex: f[name], w: this.atlas.px[name].w, h: this.atlas.px[name].h });
    const fxById: FxSprite[] = [];
    fxById[FX_GLOW] = fx('glow');
    fxById[FX_RING] = fx('ring');
    fxById[FX_SPARK] = fx('spark');
    fxById[FX_DOT] = fx('dot');
    fxById[FX_BEAM] = fx('beam');
    fxById[FX_BOLT] = fx('bolt');
    fxById[FX_SHARD] = fx('shard');
    this.fxSprites = fxById;
    this.digits = Array.from({ length: 10 }, (_, d) => f[`d${d}`]);
  }

  /** The atlas canvas, for drawing card icons in the DOM. */
  get atlasCanvas(): HTMLCanvasElement {
    return this.atlas.canvas;
  }

  render(w: World | null, alpha: number, input: Input, now: number, frameSeconds: number): void {
    const sw = this.app.screen.width;
    const sh = this.app.screen.height;
    const zoom = sw <= sh ? sw / VIEW_W : sh / VIEW_H_LANDSCAPE;
    this.zoom = zoom;
    const halfW = sw / zoom / 2;
    const halfH = sh / zoom / 2;
    if (w) {
      w.viewHalfW = halfW;
      w.viewHalfH = halfH;
      const p = w.player;
      this.camX = p.ox + (p.x - p.ox) * alpha;
      this.camY = p.oy + (p.y - p.oy) * alpha;
    } else {
      // Title screen: the ground drifts slowly.
      this.camX += 14 * frameSeconds;
      this.camY -= 9 * frameSeconds;
    }
    const cx = this.camX;
    const cy = this.camY;
    const shake = w && this.shakeEnabled ? w.shake : 0;
    const ox = shake ? (Math.random() - 0.5) * shake : 0;
    const oy = shake ? (Math.random() - 0.5) * shake : 0;
    const rootX = sw / 2 - (cx + ox) * zoom;
    const rootY = sh / 2 - (cy + oy) * zoom;
    this.worldRoot.scale.set(zoom);
    this.worldRoot.position.set(rootX, rootY);
    this.ground.width = sw;
    this.ground.height = sh;
    this.ground.tileScale.set(zoom / ATLAS_SCALE);
    this.ground.tilePosition.set(rootX, rootY);

    for (const layer of this.layers) layer.begin();
    if (w) {
      const view = { cx, cy, halfW, halfH };
      this.drawPickups(w, now);
      this.drawOrbs(w, alpha, view);
      this.drawEnemies(w, alpha, now, view);
      this.drawPlayer(w, alpha, now);
      this.drawProjectiles(w, alpha, now);
      this.drawFx(w, alpha);
      this.drawNumbers(w, view);
      this.drawIndicators(w, view, sw, sh);
    }
    this.drawJoystick(input);
    let drawn = 0;
    for (const layer of this.layers) {
      layer.end();
      drawn += layer.count;
    }
    this.drawn = drawn;
    this.app.renderer.render(this.app.stage);
  }

  private drawPickups(w: World, now: number): void {
    const f = this.atlas.frames;
    const L = this.L;
    for (const q of w.pickups) {
      const bob = Math.sin(now * 3 + q.born) * 2;
      switch (q.kind) {
        case 'chest':
          L.auras.add(f.glow, q.x, q.y, 1.1, 1.1, 0, 0xffc860, 0.35 + Math.sin(now * 4) * 0.1);
          L.pickups.add(f.chest, q.x, q.y + bob, 0.5, 0.5);
          break;
        case 'chestBlack':
          L.auras.add(f.glow, q.x, q.y, 1.5, 1.5, 0, 0xc070ff, 0.5 + Math.sin(now * 4) * 0.15);
          L.pickups.add(f.chestBlack, q.x, q.y + bob, 0.6, 0.6);
          break;
        case 'heart':
          L.pickups.add(f.heart, q.x, q.y + bob, 0.5, 0.5);
          break;
        case 'magnet':
          L.pickups.add(f.magnet, q.x, q.y + bob, 0.5, 0.5);
          break;
        case 'nuke':
          L.pickups.add(f.nuke, q.x, q.y + bob, 0.5, 0.5, now * 1.5);
          break;
      }
    }
  }

  private drawOrbs(w: World, alpha: number, v: View): void {
    const O = w.orbs;
    const f = this.atlas.frames;
    const tex = [f.orb0, f.orb1, f.orb2];
    const L = this.L.orbs;
    const minX = v.cx - v.halfW - 10;
    const maxX = v.cx + v.halfW + 10;
    const minY = v.cy - v.halfH - 10;
    const maxY = v.cy + v.halfH + 10;
    for (let i = 0; i < O.n; i++) {
      const x = O.ox[i] + (O.x[i] - O.ox[i]) * alpha;
      const y = O.oy[i] + (O.y[i] - O.oy[i]) * alpha;
      if (x < minX || x > maxX || y < minY || y > maxY) continue;
      const t = O.tier[i];
      L.add(tex[t], x, y, ORB_SCALE[t], ORB_SCALE[t]);
    }
  }

  private drawEnemies(w: World, alpha: number, now: number, v: View): void {
    const E = w.en;
    const f = this.atlas.frames;
    const L = this.L;
    const frozenAll = w.freezeAllT > 0;
    for (let i = 0; i < E.n; i++) {
      if (E.dead[i]) continue;
      const r = E.r[i];
      const x = E.ox[i] + (E.x[i] - E.ox[i]) * alpha;
      const y = E.oy[i] + (E.y[i] - E.oy[i]) * alpha;
      if (x < v.cx - v.halfW - r - 12 || x > v.cx + v.halfW + r + 12) continue;
      if (y < v.cy - v.halfH - r - 12 || y > v.cy + v.halfH + r + 12) continue;
      const spr = this.enemySprites[E.type[i]];
      const scale = r / spr.ref / ATLAS_SCALE;
      const flags = E.flags[i];
      const boss = (flags & FLAG_BOSS) !== 0;
      if (flags & FLAG_ELITE) {
        L.auras.add(f.ring, x, y, (r * 2.7) / 128, (r * 2.7) / 128, 0, 0xff3b5c, 0.55 + Math.sin(now * 6) * 0.2);
      }
      if (boss) {
        L.auras.add(f.glow, x, y, (r * 3.4) / 64, (r * 3.4) / 64, 0, 0xa060ff, 0.45 + Math.sin(now * 3) * 0.12);
        L.shadows.add(f.shadow, x, y + r * 0.85, (r * 2.2) / 48, (r * 2.2) / 48, 0, 0xffffff, 0.8);
      }
      let tint = 0xffffff;
      if (E.freezeT[i] > 0 || (frozenAll && !boss)) tint = 0x8fd0ff;
      else if (E.slowT[i] > 0) tint = 0xbfe2ff;
      else if (flags & FLAG_ELITE) tint = 0xffd0d0;
      const bob = Math.sin(now * 7 + E.uid[i] * 1.7) * 0.05;
      L.enemies.add(E.flash[i] > 0 ? spr.flash : spr.tex, x, y, scale * (1 + bob), scale * (1 - bob), 0, tint);
    }
  }

  private drawPlayer(w: World, alpha: number, now: number): void {
    const p = w.player;
    const f = this.atlas.frames;
    const L = this.L;
    const x = p.ox + (p.x - p.ox) * alpha;
    const y = p.oy + (p.y - p.oy) * alpha;
    L.shadows.add(f.shadow, x, y + 15, 0.55, 0.55, 0, 0xffffff, 0.7);
    const justHit = p.iframes > PLAYER.iframes - 0.08;
    const blink = p.iframes > 0 && Math.floor(now * 18) % 2 === 0;
    const float = Math.sin(now * 3.2) * 1.2;
    L.player.add(justHit ? f.player_f : f.player, x, y - 4 + float, 0.5 * p.face, 0.5, 0, 0xffffff, blink ? 0.45 : 1);
    const sq = this.atlas.px.square.w;
    const bw = 28;
    const bh = 3.2;
    const frac = Math.max(0, p.hp / p.maxHp);
    L.player.add(f.square, x - bw / 2, y + 21, bw / sq, bh / sq, 0, 0x10131c, 0.85, 0, 0.5);
    if (frac > 0) L.player.add(f.square, x - bw / 2, y + 21, (bw * frac) / sq, bh / sq, 0, 0xff3d5e, 1, 0, 0.5);
  }

  private drawProjectiles(w: World, alpha: number, now: number): void {
    const P = w.pr;
    const f = this.atlas.frames;
    const L = this.L.proj;
    for (let i = 0; i < P.n; i++) {
      if (P.life[i] <= 0) continue;
      const x = P.ox[i] + (P.x[i] - P.ox[i]) * alpha;
      const y = P.oy[i] + (P.y[i] - P.oy[i]) * alpha;
      const kind = P.kind[i];
      if (kind === PK_ARROW) {
        const s = (P.r[i] / 7) * 0.5;
        L.add(f.arrow, x, y, s, s, P.rot[i]);
      } else if (kind === PK_BLADE) {
        const s = (P.r[i] / 10) * 0.55;
        L.add(f.blade, x, y, s, s, P.rot[i] + now * 9);
      } else {
        L.add(f.shard, x, y, 0.6, 0.6, P.rot[i], 0xffe6a0);
      }
    }
  }

  private drawFx(w: World, alpha: number): void {
    const F = w.fx;
    const L = this.L;
    const p = w.player;
    const px = p.ox + (p.x - p.ox) * alpha;
    const py = p.oy + (p.y - p.oy) * alpha;
    for (let i = 0; i < F.n; i++) {
      const t = 1 - F.life[i] / F.max[i];
      let x = F.ox[i] + (F.x[i] - F.ox[i]) * alpha;
      let y = F.oy[i] + (F.y[i] - F.oy[i]) * alpha;
      if (F.follow[i]) {
        x += px;
        y += py;
      }
      const size = F.s0[i] + (F.s1[i] - F.s0[i]) * t;
      const a = F.a0[i] * (1 - t * t);
      const spr = this.fxSprites[F.frame[i]];
      const layer = F.layer[i] === LAYER_ADD ? L.fxAdd : L.fx;
      const frame = F.frame[i];
      if (frame === FX_BEAM) {
        const s = size / spr.w;
        layer.add(spr.tex, x, y, s, s * (0.7 + 0.3 * (1 - t)), 0, F.tint[i], a, 0.5, 0.95);
      } else if (F.sy[i] > 0) {
        layer.add(spr.tex, x, y, size / spr.w, F.sy[i] / spr.h, F.rot[i], F.tint[i], a);
      } else {
        const s = size / spr.w;
        layer.add(spr.tex, x, y, s, s, F.rot[i], F.tint[i], a);
      }
    }
  }

  private drawNumbers(w: World, v: View): void {
    if (!w.showNumbers) return;
    const N = w.nums;
    const L = this.L.nums;
    for (let i = 0; i < N.cap; i++) {
      const life = N.life[i];
      if (life <= 0) continue;
      const x0 = N.x[i];
      const y = N.y[i];
      if (Math.abs(x0 - v.cx) > v.halfW + 20 || Math.abs(y - v.cy) > v.halfH + 20) continue;
      let value = Math.round(N.val[i]);
      if (value < 1) value = 1;
      const crit = N.crit[i] === 1;
      const pop = life > 0.6 ? 1.25 : 1;
      const s = (crit ? 0.62 : 0.44) * pop;
      const tint = crit ? 0xffd54a : 0xffffff;
      const a = Math.min(1, life / 0.25);
      let digits = 0;
      let tmp = value;
      do {
        digits++;
        tmp = Math.floor(tmp / 10);
      } while (tmp > 0);
      const advance = 22 * s * 0.72;
      let x = x0 + ((digits - 1) * advance) / 2;
      tmp = value;
      for (let d = 0; d < digits; d++) {
        L.add(this.digits[tmp % 10], x, y, s, s, 0, tint, a);
        tmp = Math.floor(tmp / 10);
        x -= advance;
      }
    }
  }

  /** Arrows on the screen edge pointing at chests you cannot see. */
  private drawIndicators(w: World, v: View, sw: number, sh: number): void {
    const f = this.atlas.frames;
    for (const q of w.pickups) {
      if (q.kind !== 'chest' && q.kind !== 'chestBlack') continue;
      const dx = q.x - v.cx;
      const dy = q.y - v.cy;
      if (Math.abs(dx) < v.halfW - 8 && Math.abs(dy) < v.halfH - 8) continue;
      const ang = Math.atan2(dy, dx);
      const kx = (sw / 2 - 24) / Math.max(1e-6, Math.abs(Math.cos(ang)));
      const ky = (dy < 0 ? sh / 2 - 84 : sh / 2 - 48) / Math.max(1e-6, Math.abs(Math.sin(ang)));
      const k = Math.min(kx, ky);
      const tint = q.kind === 'chest' ? 0xffd27a : 0xd59bff;
      this.L.hud.add(f.pointer, sw / 2 + Math.cos(ang) * k, sh / 2 + Math.sin(ang) * k, 0.7, 0.7, ang, tint, 0.9);
    }
  }

  private drawJoystick(input: Input): void {
    if (!input.stickActive) return;
    const f = this.atlas.frames;
    const ringScale = input.radius / 55;
    this.L.hud.add(f.ring, input.baseX, input.baseY, ringScale, ringScale, 0, 0xffffff, 0.3);
    let dx = input.knobX - input.baseX;
    let dy = input.knobY - input.baseY;
    const len = Math.hypot(dx, dy);
    if (len > input.radius) {
      dx *= input.radius / len;
      dy *= input.radius / len;
    }
    this.L.hud.add(f.disc, input.baseX + dx, input.baseY + dy, 46 / 64, 46 / 64, 0, 0xffffff, 0.42);
  }
}

interface View {
  cx: number;
  cy: number;
  halfW: number;
  halfH: number;
}
