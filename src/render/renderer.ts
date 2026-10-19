// Must come before any other Pixi import: swaps Pixi's `new Function` code paths for
// eval-free versions, so the game runs under a strict Content-Security-Policy.
import 'pixi.js/unsafe-eval';
import { Application, Container, Particle, ParticleContainer, TilingSprite, type Texture } from 'pixi.js';
import { PLAYER, VIEW_H_LANDSCAPE, VIEW_W } from '../config';
import type { Input } from '../core/input';
import { BANKAI_BY_ID, BANKAI_IDS } from '../data/bankai';
import { ENEMY_INDEX, ENEMY_LIST } from '../data/enemies';
import { ROYAL_IDS, ROYAL_INFO } from '../data/royal';
import { DOUBLE_RING, doubleCount } from '../game/casts/schrift2';
import { COMMANDER_HEAT } from '../game/hostile';
import { enemySpriteName } from './names';
import {
  EB_FIRE,
  EB_ICE,
  EB_PETAL,
  EB_WAVE,
  EB_THREAD,
  EB_SWORD,
  FLAG_BOSS,
  FLAG_ELITE,
  FLAG_ZOMBIE,
  FX_ASH,
  FX_AVATAR,
  FX_BEAM,
  FX_BEAMH,
  FX_BOLT,
  FX_CRESCENT,
  FX_DOT,
  FX_FIST,
  FX_FLAME,
  FX_GLOW,
  FX_LIGHTNING,
  FX_MASK,
  FX_MAW,
  FX_METEOR,
  FX_MISSILE,
  FX_PETAL,
  FX_RING,
  FX_SHARD,
  FX_SHOCK,
  FX_SMOKE,
  FX_SNOW,
  FX_SPARK,
  FX_STAR,
  FX_WINGS,
  HOLD_FEAR,
  HOLD_JAIL,
  HOLD_STUN,
  LAYER_ADD,
  MF_ENEMY,
  MK_METEOR,
  MK_MISSILE,
  MS_CIRCLE,
  MS_LINE,
  PK_ARROW,
  PK_BLADE,
  PK_BLOOD,
  PK_BOMB,
  PK_DRAGON,
  PK_DRONE,
  PK_HEART,
  PK_MISSILE,
  PK_PETAL,
  PK_THORN,
  ZK_CAGE,
  ZK_FIRE,
  ZK_FROST,
  ZK_GUST,
  ZK_HEAT,
  ZK_PETALS,
  ZK_POISON,
  ZF_BLAZE,
  ZF_FOLLOW,
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

interface View {
  cx: number;
  cy: number;
  halfW: number;
  halfH: number;
}

/** A stable pseudo-random number in [0, 1) for an integer: where each ambient mote lives. */
function hash01(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

/** Ambient motes in view at once. */
const MOTES = 28;

/** Fragments of the Soul King on the ground, by colour. */
const FRAGMENT_TINT: Readonly<Record<string, number>> = { rightarm: 0xfff2c2, leftarm: 0xe8d8ff, heart: 0xffcf7a };

type LayerName =
  | 'zonesN'
  | 'zonesA'
  | 'warn'
  | 'pickups'
  | 'orbs'
  | 'auras'
  | 'shadows'
  | 'enemies'
  | 'player'
  | 'allies'
  | 'proj'
  | 'ebullets'
  | 'fxAdd'
  | 'fx'
  | 'nums'
  | 'hud';

const ORB_SCALE = [0.42, 0.5, 0.62];
const ZONE_TINT: Record<number, number> = {
  [ZK_FIRE]: 0xff7a3c,
  [ZK_POISON]: 0x9dff8a,
  [ZK_GUST]: 0xe6f4ff,
  [ZK_PETALS]: 0xffb8d2,
  [ZK_FROST]: 0x9fe0ff,
  [ZK_HEAT]: 0xff8a3c,
  [ZK_CAGE]: 0xcfe0ff,
};

/** Why an enemy cannot move, by hold kind: freeze, fear, cage, stun. */
const HOLD_TINT: Record<number, number> = { 0: 0x8fd0ff, [HOLD_FEAR]: 0xc9a8ff, [HOLD_JAIL]: 0xc8d8ff, [HOLD_STUN]: 0xffe9a0 };

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
  private L!: Record<LayerName, Layer>;
  private enemySprites: EnemySprite[] = [];
  /** Per enemy type: Hollows promote to Adjuchas, Soul Reapers to seated officers. */
  private eliteSprites: EnemySprite[] = [];
  /** Seireitei's captains, by bankai (Zanka no Tachi is the Captain-Commander himself). */
  private captainSprites: EnemySprite[] = [];
  /** Drawn size against hitbox, by type: Hollows a little larger, so their masks read on a phone. */
  private artScale: number[] = [];
  /** The Royal Guard by variant, and Kirio once she has shed her bulk. */
  private royalSprites: EnemySprite[] = [];
  private kirioSlim: EnemySprite | null = null;
  private bossAura: number[] = [];
  private grounds = new Map<string, Texture>();
  private groundId = '';
  private fxSprites: FxSprite[] = [];
  private digits: Texture[] = [];
  private bankaiAura: number[] = [];
  private camX = 0;
  private camY = 0;

  async init(host: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: window,
      background: '#07080c',
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
    this.ground = new TilingSprite({ texture: this.groundFor('hueco'), width: 16, height: 16 });
    this.groundId = 'hueco';
    const base = this.atlas.base;
    this.L = {
      zonesN: new Layer(base),
      zonesA: new Layer(base, true),
      warn: new Layer(base),
      pickups: new Layer(base),
      orbs: new Layer(base),
      auras: new Layer(base, true),
      shadows: new Layer(base),
      enemies: new Layer(base),
      player: new Layer(base),
      allies: new Layer(base),
      proj: new Layer(base, true),
      ebullets: new Layer(base, true),
      fxAdd: new Layer(base, true),
      fx: new Layer(base),
      nums: new Layer(base),
      hud: new Layer(base),
    };
    const L = this.L;
    this.layers = Object.values(L);
    this.worldRoot.addChild(
      L.zonesN.view,
      L.zonesA.view,
      L.warn.view,
      L.pickups.view,
      L.orbs.view,
      L.auras.view,
      L.shadows.view,
      L.enemies.view,
      L.player.view,
      L.allies.view,
      L.proj.view,
      L.ebullets.view,
      L.fxAdd.view,
      L.fx.view,
      L.nums.view,
    );
    this.app.stage.addChild(this.ground, this.worldRoot, L.hud.view);
    // Indexed by enemy type, matching ENEMY_LIST order. `ref` is the radius the art was drawn for.
    const sprite = (name: string, ref: number): EnemySprite => ({ tex: f[name], flash: f[`${name}_f`], ref });
    const REF: Record<string, number> = {
      hollow: 11,
      hound: 9,
      brute: 18,
      volatile: 12,
      bearer: 30,
      menos: 44,
      vasto: 34,
      officer: 11,
      flash: 9,
      caster: 11,
      guard: 19,
      grandmaster: 28,
      commander: 30,
      ashen: 11,
      rift: 22,
      golden: 11,
      inkwisp: 8,
      inkling: 6.5,
      weaver: 9,
      asauchi: 8,
      attendant: 13,
      royal: 28,
      ichibe: 30,
    };
    // Types drawn per variant (or per stage) fall back to one of their sprites here.
    this.enemySprites = ENEMY_LIST.map((d, t) => sprite(enemySpriteName(t), REF[d.id] ?? d.radius));
    this.captainSprites = BANKAI_IDS.map((id, v) => sprite(enemySpriteName(ENEMY_INDEX.captain, v), id === 'zanka' || id === 'tengen' ? 30 : 28));
    this.artScale = ENEMY_LIST.map((d) => (d.boss || d.shinigami || d.behavior === 'flee' || d.id === 'rift' || d.id === 'ashen' ? 1 : 1.1));
    this.royalSprites = ROYAL_IDS.map((id, v) => sprite(enemySpriteName(ENEMY_INDEX.royal, v), id === 'kirio' ? 30 : 28));
    this.kirioSlim = sprite('royal_kirio_slim', 26);
    const adjuchas = sprite('adjuchas', 24);
    const seated = sprite('seated', 24);
    // The palace's servants keep their own look as elites, just bigger.
    const palace = new Set(['sentinel', 'inkwisp', 'inkling', 'weaver', 'asauchi', 'attendant']);
    this.eliteSprites = ENEMY_LIST.map((d, t) => (palace.has(d.id) ? this.enemySprites[t] : d.shinigami ? seated : adjuchas));
    this.bossAura = ENEMY_LIST.map((d) => d.color);
    const fx = (name: string): FxSprite => ({ tex: f[name], w: this.atlas.px[name].w, h: this.atlas.px[name].h });
    const byId: FxSprite[] = [];
    byId[FX_GLOW] = fx('glow');
    byId[FX_RING] = fx('ring');
    byId[FX_SPARK] = fx('spark');
    byId[FX_DOT] = fx('dot');
    byId[FX_BEAM] = fx('beam');
    byId[FX_BOLT] = fx('bolt');
    byId[FX_SHARD] = fx('shard');
    byId[FX_BEAMH] = fx('beamh');
    byId[FX_FLAME] = fx('flame');
    byId[FX_METEOR] = fx('meteor');
    byId[FX_MASK] = fx('mask');
    byId[FX_ASH] = fx('ash');
    byId[FX_CRESCENT] = fx('crescent');
    byId[FX_AVATAR] = fx('avatar');
    byId[FX_WINGS] = fx('wings');
    byId[FX_STAR] = fx('star');
    byId[FX_SNOW] = fx('snow');
    byId[FX_PETAL] = fx('petal');
    byId[FX_MISSILE] = fx('missile');
    byId[FX_MAW] = fx('maw');
    byId[FX_FIST] = fx('fist');
    byId[FX_LIGHTNING] = fx('lightning');
    byId[FX_SHOCK] = fx('shock');
    byId[FX_SMOKE] = fx('smoke');
    this.fxSprites = byId;
    this.digits = Array.from({ length: 10 }, (_, d) => f[`d${d}`]);
    this.bankaiAura = BANKAI_IDS.map((id) => BANKAI_BY_ID.get(id)?.aura ?? 0xffcb5c);
  }

  /** Show a stage's ground (the title screen previews the selected stage too). */
  /** The Emperor's look for the run (opened by feats). */
  private look = 'default';

  setLook(id: string): void {
    this.look = this.atlas.frames[`player_${id}`] ? id : 'default';
  }

  setStage(id: string): void {
    if (id === this.groundId) return;
    this.groundId = id;
    this.ground.texture = this.groundFor(id);
  }

  private groundFor(id: string): Texture {
    let tex = this.grounds.get(id);
    if (!tex) {
      tex = buildGroundTile(id);
      this.grounds.set(id, tex);
    }
    return tex;
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
    const view = { cx, cy, halfW, halfH };
    this.drawAmbient(view, now);
    if (w) {
      this.drawZones(w, alpha, now);
      this.drawMarks(w);
      this.drawPickups(w, now);
      this.drawOrbs(w, alpha, view);
      this.drawEnemies(w, alpha, now, view);
      this.drawPlayer(w, alpha, now);
      this.drawProjectiles(w, alpha, now);
      this.drawEnemyBullets(w, alpha);
      this.drawFx(w, alpha);
      this.drawNumbers(w, view);
      this.drawIndicators(w, view, sw, sh);
      if (w.almightyT > 0) this.drawAlmighty(w, sw, sh);
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

  /**
   * Motes drifting over the ground, fixed in the world so they slide past as
   * you move: sand on the wind in Hueco Mundo, lantern embers rising in the
   * Seireitei. A window of motes one view wide wraps around the camera.
   */
  private drawAmbient(v: View, now: number): void {
    const f = this.atlas.frames;
    const ember = this.groundId === 'seireitei';
    // In the palace, gold dust rises slowly through the light.
    const dust = this.groundId === 'palace';
    const layer = ember || dust ? this.L.auras : this.L.shadows;
    const S = 2 * Math.max(v.halfW, v.halfH) + 80;
    const x0 = v.cx - S / 2;
    const y0 = v.cy - S / 2;
    for (let k = 0; k < MOTES; k++) {
      const a = hash01(k * 3 + 1);
      const b = hash01(k * 3 + 2);
      const c = hash01(k * 3 + 3);
      const vx = dust ? (c - 0.5) * 6 : ember ? (c - 0.5) * 10 : 22 + c * 26;
      const vy = dust ? -(6 + c * 8) : ember ? -(12 + c * 16) : 5 + c * 8;
      const x = x0 + mod(a * 4096 + now * vx - x0, S);
      const y = y0 + mod(b * 4096 + now * vy - y0, S);
      const twinkle = 0.55 + 0.45 * Math.sin(now * (0.8 + a * 1.6) + k);
      const s = (ember ? 2.2 + b * 1.8 : 2.6 + b * 2.6) / 32;
      layer.add(f.glow, x, y, s, s, 0, dust ? 0xffe6b0 : ember ? 0xffa860 : 0xdfe6f5, (dust ? 0.6 : ember ? 0.85 : 0.45) * twinkle);
    }
  }

  private drawZones(w: World, alpha: number, now: number): void {
    const Z = w.zones;
    const f = this.atlas.frames;
    const L = this.L;
    const p = w.player;
    const px = p.ox + (p.x - p.ox) * alpha;
    const py = p.oy + (p.y - p.oy) * alpha;
    for (let i = 0; i < Z.n; i++) {
      const kind = Z.kind[i];
      const follow = (Z.flags[i] & ZF_FOLLOW) !== 0;
      const x = follow ? px : Z.ox[i] + (Z.x[i] - Z.ox[i]) * alpha;
      const y = follow ? py : Z.oy[i] + (Z.y[i] - Z.oy[i]) * alpha;
      const age = Z.max[i] - Z.life[i];
      const a = Math.min(1, age / 0.2, Z.life[i] / 0.4);
      const r = Z.r[i];
      const s = (r * 2.2) / 128;
      const seed = Z.seed[i];
      const tint = ZONE_TINT[kind] ?? 0xffffff;
      switch (kind) {
        case ZK_POISON: {
          L.zonesN.add(f.cloud, x, y, s, s, now * 0.3 + seed, tint, 0.42 * a);
          // Bubbles rising through the dose.
          for (let k = 0; k < 4; k++) {
            const ph = (now * 0.55 + k * 0.25 + seed * 0.013) % 1;
            const bx = x + Math.sin(seed + k * 2.1 + ph * 3) * r * 0.45;
            const by = y + r * 0.35 - ph * r * 0.8;
            const bs = (3 + (k % 2) * 2) / 16;
            L.zonesA.add(f.dot, bx, by, bs, bs, 0, 0xb8ff9a, Math.sin(ph * Math.PI) * 0.6 * a);
          }
          break;
        }
        case ZK_FIRE: {
          const flick = 1 + Math.sin(now * 14 + seed) * 0.05;
          L.zonesA.add(f.firezone, x, y, s * flick, s * flick, seed, tint, 0.75 * a);
          break;
        }
        case ZK_GUST: {
          // Firestorm: a gust carrying The Heat's fire glows orange.
          const blaze = (Z.flags[i] & ZF_BLAZE) !== 0;
          // A translucent swirl with streaks of wind (and fire, for Firestorm) racing round it.
          L.zonesA.add(f.gust, x, y, s, s, now * 6 + seed, blaze ? 0xffb070 : 0xcfe8ff, (blaze ? 0.6 : 0.42) * a);
          L.zonesA.add(f.glow, x, y, (r * 2) / 64, (r * 2) / 64, 0, blaze ? 0xff6a2c : 0x9fd8ff, (blaze ? 0.3 : 0.14) * a);
          for (let k = 0; k < 5; k++) {
            const ang = now * 5 + k * 1.26 + seed;
            const rr = r * (0.45 + (k % 3) * 0.17);
            L.zonesA.add(f.trail, x + Math.cos(ang) * rr, y + Math.sin(ang) * rr, (r * 0.5) / 64, 0.5, ang + Math.PI / 2, blaze ? 0xffc890 : 0xffffff, 0.45 * a, 1, 0.5);
          }
          break;
        }
        case ZK_PETALS: {
          L.zonesA.add(f.gust, x, y, s, s, -now * 5 + seed, tint, 0.7 * a);
          for (let k = 0; k < 10; k++) {
            const ang = now * 4 + (k / 10) * Math.PI * 2 + seed;
            const rr = r * (0.3 + ((k * 37) % 10) / 14);
            L.zonesA.add(f.petal, x + Math.cos(ang) * rr, y + Math.sin(ang) * rr, 0.6, 0.6, ang * 2, 0xffffff, 0.9 * a);
          }
          break;
        }
        case ZK_FROST:
          L.zonesA.add(f.frost, x, y, s, s, seed, tint, 0.6 * a);
          break;
        case ZK_CAGE: {
          // Drops in slightly large and settles.
          const drop = 1 + Math.max(0, 0.25 - age) * 1.2;
          L.zonesA.add(f.cage, x, y, ((r * 2) / 128) * drop, ((r * 2) / 128) * drop, 0, tint, 0.55 * a);
          break;
        }
        case ZK_HEAT: {
          const pulse = 0.28 + Math.sin(now * 5) * 0.06;
          L.zonesA.add(f.ring, x, y, (r * 2) / 110, (r * 2) / 110, 0, tint, pulse);
          L.zonesA.add(f.glow, x, y, (r * 2.2) / 64, (r * 2.2) / 64, 0, 0xff5a1f, 0.16);
          // Flames lick up around the edge of the heat.
          for (let k = 0; k < 10; k++) {
            const ang = (k / 10) * Math.PI * 2 + now * 0.6;
            const flick = 0.75 + Math.sin(now * 13 + k * 1.7) * 0.25;
            L.zonesA.add(f.flame, x + Math.cos(ang) * r, y + Math.sin(ang) * r, (18 * flick) / 192, (14 * flick) / 48, ang, 0xff8a3c, 0.55, 0, 0.5);
          }
          break;
        }
      }
    }
  }

  /** Warnings: red for anything aimed at you, gold for your own big strikes. They fill up as the hit nears. */
  private drawMarks(w: World): void {
    const M = w.marks;
    const f = this.atlas.frames;
    const L = this.L.warn;
    const sq = this.atlas.px.square.w;
    for (let i = 0; i < M.n; i++) {
      const enemy = (M.flags[i] & MF_ENEMY) !== 0;
      const kind = M.kind[i];
      // Of your own strikes, only the slow big ones (meteors, missiles) show where they will land.
      if (!enemy && kind !== MK_METEOR && kind !== MK_MISSILE) continue;
      const tint = enemy ? 0xff2d4a : 0xffcb5c;
      const t = 1 - Math.max(0, M.delay[i]) / M.max[i];
      const x = M.x[i];
      const y = M.y[i];
      const r = M.r[i];
      if (M.shape[i] === MS_CIRCLE) {
        const s = (r * 2) / 128;
        L.add(f.wfill, x, y, s, s, 0, tint, enemy ? 0.26 : 0.14);
        const rs = (r * (0.2 + 0.8 * t)) / 55;
        L.add(f.ring, x, y, rs, rs, 0, tint, enemy ? 0.8 : 0.5);
      } else if (M.shape[i] === MS_LINE) {
        const len = M.len[i];
        const ang = M.ang[i];
        const mx = x + (Math.cos(ang) * len) / 2;
        const my = y + (Math.sin(ang) * len) / 2;
        L.add(f.square, mx, my, len / sq, r / sq, ang, tint, 0.2);
        L.add(f.square, mx, my, len / sq, (r * t) / sq, ang, tint, 0.55);
      } else {
        const ang = M.ang[i];
        const s = r / 128;
        L.add(f.wedge, x, y, s, s * (M.len[i] / (Math.PI / 3)), ang, tint, 0.24, 0, 0.5);
        L.add(f.wedge, x, y, s * t, s * t * (M.len[i] / (Math.PI / 3)), ang, tint, 0.45, 0, 0.5);
      }
    }
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
          L.auras.add(f.glow, q.x, q.y, 1.5, 1.5, 0, 0xff3d5e, 0.45 + Math.sin(now * 4) * 0.15);
          L.pickups.add(f.chestBlack, q.x, q.y + bob, 0.6, 0.6);
          break;
        case 'medallion': {
          const aura = q.bankai ? (BANKAI_BY_ID.get(q.bankai)?.aura ?? 0xffcb5c) : 0xffcb5c;
          L.auras.add(f.glow, q.x, q.y, 2, 2, 0, aura, 0.55 + Math.sin(now * 5) * 0.2);
          L.auras.add(f.ring, q.x, q.y, 0.45, 0.45, now, aura, 0.5);
          L.pickups.add(f.medallion, q.x, q.y + bob, 0.6, 0.6, Math.sin(now * 2) * 0.3);
          break;
        }
        case 'heart':
          L.pickups.add(f.heart, q.x, q.y + bob, 0.5, 0.5);
          break;
        case 'magnet':
          L.pickups.add(f.magnet, q.x, q.y + bob, 0.5, 0.5);
          break;
        case 'nuke':
          L.pickups.add(f.nuke, q.x, q.y + bob, 0.5, 0.5, now * 1.5);
          break;
        case 'fragment': {
          const tint = FRAGMENT_TINT[q.fragment ?? ''] ?? 0xfff2c2;
          L.auras.add(f.glow, q.x, q.y, 2.2, 2.2, 0, tint, 0.55 + Math.sin(now * 5) * 0.2);
          L.auras.add(f.ring, q.x, q.y, 0.5, 0.5, now, 0xffffff, 0.5);
          L.pickups.add(f.fragment, q.x, q.y + bob, 0.7, 0.7, Math.sin(now * 2) * 0.2, tint);
          break;
        }
        case 'shrine':
          L.auras.add(f.glow, q.x, q.y - 6, 1.8, 2.2, 0, 0x59b8ff, 0.4 + Math.sin(now * 3) * 0.12);
          L.shadows.add(f.shadow, q.x, q.y + 14, 0.6, 0.6, 0, 0xffffff, 0.7);
          L.pickups.add(f.shrine, q.x, q.y, 0.6, 0.6);
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
      const flags = E.flags[i];
      const boss = (flags & FLAG_BOSS) !== 0;
      const elite = (flags & FLAG_ELITE) !== 0;
      const type = E.type[i];
      const spr = elite
        ? this.eliteSprites[type]
        : type === ENEMY_INDEX.captain
          ? (this.captainSprites[E.variant[i]] ?? this.enemySprites[type])
          : type === ENEMY_INDEX.royal
            ? ROYAL_IDS[E.variant[i]] === 'kirio' && E.r[i] < 26 && this.kirioSlim
              ? this.kirioSlim
              : (this.royalSprites[E.variant[i]] ?? this.enemySprites[type])
            : type === ENEMY_INDEX.golden && w.stage.id === 'seireitei'
            ? this.enemySprites[ENEMY_INDEX.officer]
            : this.enemySprites[type];
      if (type === ENEMY_INDEX.golden) {
        // A treasure runner: gold, glowing, impossible to miss.
        L.auras.add(f.glow, x, y, (r * 4) / 64, (r * 4) / 64, 0, 0xffd27a, 0.55 + Math.sin(now * 8) * 0.2);
      } else if (type === ENEMY_INDEX.rift) {
        // The rift pulses, and a ring shrinks as it runs out of time.
        const left = Math.max(0, Math.min(1, E.atk2T[i] / 25));
        L.auras.add(f.glow, x, y, (r * 4.4) / 64, (r * 4.4) / 64, 0, w.stage.id === 'seireitei' ? 0xffe2a0 : 0xff2d4a, 0.45 + Math.sin(now * 5) * 0.15);
        L.auras.add(f.ring, x, y, (r * 3.4 * left) / 110 + 0.05, (r * 3.4 * left) / 110 + 0.05, 0, 0xffffff, 0.55);
      }
      const scale = (r / spr.ref / ATLAS_SCALE) * this.artScale[type];
      if (elite) L.auras.add(f.ring, x, y, (r * 2.7) / 128, (r * 2.7) / 128, 0, 0xff2d4a, 0.55 + Math.sin(now * 6) * 0.2);
      if (boss) {
        const bearer = type === ENEMY_INDEX.bearer || type === ENEMY_INDEX.captain;
        const aura = bearer
          ? (this.bankaiAura[E.variant[i]] ?? 0xffcb5c)
          : type === ENEMY_INDEX.royal
            ? (ROYAL_INFO[E.variant[i]]?.aura ?? 0xfff6dc)
            : this.bossAura[type];
        L.auras.add(f.glow, x, y, (r * 3.6) / 64, (r * 3.6) / 64, 0, aura, 0.5 + Math.sin(now * 3) * 0.12);
        if (type === ENEMY_INDEX.commander) {
          // Ryūjin Jakka's heat: anything inside this ring burns.
          const s = (COMMANDER_HEAT * 2) / 110;
          L.auras.add(f.ring, x, y, s, s, 0, 0xff7a3c, 0.45 + Math.sin(now * 6) * 0.12);
        }
        if (bearer && BANKAI_IDS[E.variant[i]] === 'zanka') {
          L.auras.add(f.ring, x, y, (95 * 2) / 110, (95 * 2) / 110, 0, 0xff7a3c, 0.4 + Math.sin(now * 6) * 0.1);
        }
        L.shadows.add(f.shadow, x, y + r * 0.85, (r * 2.2) / 48, (r * 2.2) / 48, 0, 0xffffff, 0.8);
      }
      let tint = type === ENEMY_INDEX.golden ? 0xffd27a : type === ENEMY_INDEX.rift && w.stage.id === 'seireitei' ? 0xfff0d0 : 0xffffff;
      if (E.charmT[i] > 0) tint = flags & FLAG_ZOMBIE ? 0x9fd88a : 0xff9cc8;
      else if (E.freezeT[i] > 0) tint = HOLD_TINT[E.holdKind[i]] ?? 0x8fd0ff;
      else if (frozenAll && !boss) tint = 0x8fd0ff;
      else if (E.slowT[i] > 0) tint = 0xbfe2ff;
      else if (E.vulnT[i] > 0) tint = 0xd8ffcf;
      else if (E.infT[i] > 0) tint = 0xffb8c0;
      const bob = E.freezeT[i] > 0 ? 0 : Math.sin(now * 7 + E.uid[i] * 1.7) * 0.05;
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
    // A faint reishi glow behind you, so a figure in black still stands out on the night ground.
    L.auras.add(f.glow, x, y - 4, 0.95, 1.1, 0, 0x6fa8ff, 0.2);
    if (p.rootT > 0) {
      // Bound by a seal: a golden ring turns under your feet until it lets go.
      L.auras.add(f.ring, x, y + 6, 0.5, 0.5, now * 2, 0xffcb5c, 0.5 + 0.4 * Math.min(1, p.rootT));
      L.auras.add(f.glow, x, y + 6, 1.1, 1.1, 0, 0xffb347, 0.3);
    }
    if (w.superT > 0) L.auras.add(f.glow, x, y, 1.6, 1.6, 0, 0xffd27a, 0.45 + Math.sin(now * 10) * 0.1);
    // The Heart of the Soul King's surge: nothing can touch you while it shines.
    if (w.surgeT > 0) L.auras.add(f.glow, x, y - 4, 2.2, 2.2, 0, 0xffcf7a, 0.5 + Math.sin(now * 12) * 0.15);
    if (w.shieldCharges > 0) L.auras.add(f.ring, x, y - 2, 0.42, 0.42, 0, 0xdfe7f2, 0.35 + 0.1 * w.shieldCharges);
    // The Yourself: translucent doubles standing around you.
    for (const ps of w.powers) {
      if (ps.def.kind !== 'double' || ps.active <= 0) continue;
      const n = doubleCount(w, ps);
      for (let k = 0; k < n; k++) {
        const a = ps.angle + (k / n) * Math.PI * 2;
        const dx = x + Math.cos(a) * DOUBLE_RING;
        const dy = y + Math.sin(a) * DOUBLE_RING;
        L.shadows.add(f.shadow, dx, dy + 15, 0.5, 0.5, 0, 0xffffff, 0.4);
        // A ghost of light in your shape: a blue glow with your features showing through.
        L.allies.add(f.player_f, dx, dy - 4, 0.48 * p.face, 0.48, 0, 0x6fa8ff, 0.3);
        L.allies.add(f.player, dx, dy - 4, 0.46 * p.face, 0.46, 0, 0xcfe6ff, 0.55);
      }
    }
    const justHit = p.iframes > PLAYER.iframes - 0.08;
    const blink = p.iframes > 0 && w.vollT <= 0 && Math.floor(now * 18) % 2 === 0;
    const float = Math.sin(now * 3.2) * 1.2;
    const hy = y - 4 + float;
    // The Emperor's evolutions: the Almighty's shadow and reishi wings behind him, eyes over his cloak.
    const tier = w.evolution;
    // The shadow goes on the lowest layer so the wings still show over it.
    if (tier >= 3) L.zonesN.add(f.evo_shadow, x, hy + 2, 0.5 * (1 + Math.sin(now * 3) * 0.04), 0.5, 0, 0xffffff, 0.9);
    if (tier >= 1) {
      const flap = Math.sin(now * 2.4);
      L.auras.add(f.evo_wings, x, hy - 4, 0.62 * (1 + flap * 0.07), 0.62 * (1 - flap * 0.04), 0, 0xffffff, 0.85 + flap * 0.1);
    }
    const body = this.look === 'default' ? f.player : f[`player_${this.look}`];
    const bodyHit = this.look === 'default' ? f.player_f : f[`player_${this.look}_f`];
    L.player.add(justHit ? bodyHit : body, x, hy, 0.5 * p.face, 0.5, 0, 0xffffff, blink ? 0.45 : 1);
    if (tier >= 2) {
      // Every few seconds the eyes blink together.
      const shut = now % 4.3 < 0.13;
      L.player.add(f.evo_eyes, x, hy, 0.5 * p.face, 0.5, 0, 0xffffff, shut ? 0.12 : blink ? 0.45 : 1);
    }
    // Health under the hero: a framed bar that flares red when it runs low.
    const sq = this.atlas.px.square.w;
    const bw = 34;
    const bh = 4;
    const frac = Math.max(0, p.hp / p.maxHp);
    L.player.add(f.square, x - bw / 2 - 1, y + 21, (bw + 2) / sq, (bh + 2) / sq, 0, 0xd6dcea, 0.32, 0, 0.5);
    L.player.add(f.square, x - bw / 2, y + 21, bw / sq, bh / sq, 0, 0x10131c, 0.95, 0, 0.5);
    if (frac > 0) L.player.add(f.square, x - bw / 2, y + 21, (bw * frac) / sq, bh / sq, 0, 0xff3d5e, 1, 0, 0.5);
    if (frac > 0 && frac < 0.3) L.auras.add(f.glow, x, y + 21, 0.75, 0.22, 0, 0xff2d4a, 0.25 + 0.25 * Math.sin(now * 9));
  }

  /** A motion streak behind a moving projectile, as long as it is fast. */
  private streak(x: number, y: number, vx: number, vy: number, width: number, tint: number, alpha: number): void {
    const speed = Math.hypot(vx, vy);
    if (speed < 60) return;
    const len = Math.min(70, speed * 0.075);
    this.L.proj.add(this.atlas.frames.trail, x, y, len / 64, width / 16, Math.atan2(vy, vx), tint, alpha, 1, 0.5);
  }

  private drawProjectiles(w: World, alpha: number, now: number): void {
    const P = w.pr;
    const f = this.atlas.frames;
    const L = this.L;
    const p = w.player;
    const px = p.ox + (p.x - p.ox) * alpha;
    const py = p.oy + (p.y - p.oy) * alpha;
    for (let i = 0; i < P.n; i++) {
      if (P.life[i] <= 0) continue;
      const x = P.ox[i] + (P.x[i] - P.ox[i]) * alpha;
      const y = P.oy[i] + (P.y[i] - P.oy[i]) * alpha;
      switch (P.kind[i]) {
        case PK_ARROW: {
          const s = (P.r[i] / 7) * 0.5;
          this.streak(x, y, P.vx[i], P.vy[i], P.r[i] * 1.6, 0x9fd8ff, 0.5);
          L.proj.add(f.arrow, x, y, s, s, P.rot[i]);
          break;
        }
        case PK_BLADE: {
          const s = (P.r[i] / 10) * 0.6;
          // An after-image a little behind on the orbit, for the sweep.
          const ring = P.pb[i];
          const back = P.rot[i] - (ring < 0 ? -1 : 1) * 0.28;
          const rad = Math.abs(ring);
          L.proj.add(f.blade, px + Math.cos(back) * rad, py + Math.sin(back) * rad, s * 0.9, s * 0.9, back + now * 9, 0x9fd8ff, 0.35);
          L.proj.add(f.blade, x, y, s, s, P.rot[i] + now * 9);
          break;
        }
        case PK_PETAL: {
          const s = (P.r[i] / 7) * 0.55;
          L.proj.add(f.petal, x, y, s, s, P.rot[i] * 3 + now * 4);
          break;
        }
        case PK_BOMB: {
          const t = P.pb[i] > 0 ? 1 - P.life[i] / P.pb[i] : 1;
          const h = Math.sin(Math.PI * Math.min(1, Math.max(0, t))) * 46;
          L.shadows.add(f.shadow, x, y, 0.36, 0.36, 0, 0xffffff, 0.6);
          // A reishi bomb with a spark that flickers faster as it falls.
          L.auras.add(f.glow, x, y - h, 0.85, 0.85, 0, 0xff9a4a, 0.5 + Math.sin(now * (20 + t * 30)) * 0.2);
          L.allies.add(f.bomb, x, y - h, 0.78, 0.78, now * 6);
          break;
        }
        case PK_THORN: {
          const s = (P.r[i] / 6) * 0.7;
          this.streak(x, y, P.vx[i], P.vy[i], P.r[i] * 1.4, 0xb98bff, 0.45);
          L.proj.add(f.thorn, x, y, s, s, P.rot[i], 0xd8b8ff);
          break;
        }
        case PK_MISSILE:
          this.streak(x, y, P.vx[i], P.vy[i], 8, 0xd8e4ff, 0.4);
          L.proj.add(f.missile, x, y, 0.6, 0.6, P.rot[i]);
          break;
        case PK_DRAGON: {
          const s = (P.r[i] / 22) * 0.75;
          L.proj.add(f.dragon, x, y, s, s, P.rot[i]);
          break;
        }
        case PK_DRONE:
          L.allies.add(f.drone, x, y, 0.6, 0.6, now * 2);
          break;
        case PK_HEART: {
          const s = (P.r[i] * 2.4) / 24;
          this.streak(x, y, P.vx[i], P.vy[i], P.r[i] * 1.6, 0xff9cc8, 0.4);
          L.proj.add(f.loveheart, x, y, s, s, Math.sin(now * 10 + i) * 0.3);
          break;
        }
        case PK_BLOOD: {
          const s = (P.r[i] / 6) * 0.8;
          this.streak(x, y, P.vx[i], P.vy[i], P.r[i] * 1.5, 0xc81e3c, 0.5);
          L.proj.add(f.thorn, x, y, s, s, P.rot[i], 0xff3a50);
          break;
        }
        default:
          this.streak(x, y, P.vx[i], P.vy[i], 6, 0xbfe6ff, 0.4);
          L.proj.add(f.shard, x, y, 0.6, 0.6, P.rot[i], 0xbfe6ff);
          break;
      }
    }
  }

  private drawEnemyBullets(w: World, alpha: number): void {
    const B = w.eb;
    const f = this.atlas.frames;
    const L = this.L.ebullets;
    for (let i = 0; i < B.n; i++) {
      const x = B.ox[i] + (B.x[i] - B.ox[i]) * alpha;
      const y = B.oy[i] + (B.y[i] - B.oy[i]) * alpha;
      const rot = Math.atan2(B.vy[i], B.vx[i]);
      const r = B.r[i];
      switch (B.kind[i]) {
        case EB_PETAL:
          L.add(f.petal, x, y, (r * 2.4) / 20, (r * 2.4) / 20, rot, 0xff9cc2);
          break;
        case EB_ICE:
          L.add(f.icebolt, x, y, (r * 2.6) / 40, (r * 2.6) / 40, rot);
          break;
        case EB_FIRE:
          L.add(f.bala, x, y, (r * 3) / 20, (r * 3) / 20, 0, 0xffa04a);
          break;
        case EB_WAVE:
          L.add(f.crescent, x, y, (r * 2.4) / 256, (r * 3.2) / 128, rot, 0xdfe8ff);
          break;
        case EB_SWORD:
          // The asauchi art points up and to the left; turn its tip along the flight.
          L.add(f.asauchi, x, y, (r * 5) / 48, (r * 5) / 48, rot + (3 * Math.PI) / 4, 0xf2f6ff);
          break;
        case EB_THREAD:
          L.add(f.trail, x, y, (r * 5) / 64, (r * 1.4) / 16, rot, 0xe2ccff);
          break;
        default:
          L.add(f.bala, x, y, (r * 2.8) / 20, (r * 2.8) / 20);
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
      const frame = F.frame[i];
      const spr = this.fxSprites[frame];
      const tint = F.tint[i];
      // Big silhouettes sit behind the player; everything else on top.
      const layer = frame === FX_WINGS || frame === FX_AVATAR ? L.auras : F.layer[i] === LAYER_ADD ? L.fxAdd : L.fx;
      if (frame === FX_LIGHTNING) {
        const flicker = t < 0.5 ? 1 : 0.55 + 0.45 * Math.sin(t * 60);
        layer.add(spr.tex, x, y, (size / spr.w) * (F.rot[i] < 0 ? -1 : 1), F.sy[i] / spr.h, 0, tint, a * flicker, 0.5, 0.98);
      } else if (frame === FX_BEAM) {
        const s = size / spr.w;
        layer.add(spr.tex, x, y, s, s * (0.7 + 0.3 * (1 - t)), 0, tint, a, 0.5, 0.95);
      } else if (frame === FX_CRESCENT) {
        const sx = (size / spr.w) * 0.9;
        layer.add(spr.tex, x, y, sx, ((size * 1.8) / spr.h) * 0.9, F.rot[i], tint, a);
      } else if (frame === FX_WINGS) {
        // Wings hold steady, then fade out over the last half second.
        const s = size / spr.w;
        layer.add(spr.tex, x, y, s, s, 0, tint, Math.min(F.a0[i], F.life[i] / 0.5));
      } else if (frame === FX_METEOR) {
        const s = size / spr.w;
        layer.add(spr.tex, x, y, s, s, F.rot[i] - Math.PI / 4, tint, Math.min(1, F.life[i] / 0.1));
      } else if (frame === FX_MISSILE) {
        layer.add(spr.tex, x, y, size / spr.w, size / spr.w, F.rot[i], tint, 1);
      } else if (F.sy[i] > 0) {
        layer.add(spr.tex, x, y, size / spr.w, F.sy[i] / spr.h, F.rot[i], tint, a);
      } else {
        const s = size / spr.w;
        layer.add(spr.tex, x, y, s, s, F.rot[i], tint, a);
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

  /** Arrows on the screen edge pointing at chests and medallions you cannot see. */
  private drawIndicators(w: World, v: View, sw: number, sh: number): void {
    const f = this.atlas.frames;
    for (const q of w.pickups) {
      if (q.kind !== 'chest' && q.kind !== 'chestBlack' && q.kind !== 'medallion' && q.kind !== 'shrine' && q.kind !== 'fragment') continue;
      const dx = q.x - v.cx;
      const dy = q.y - v.cy;
      if (Math.abs(dx) < v.halfW - 8 && Math.abs(dy) < v.halfH - 8) continue;
      const ang = Math.atan2(dy, dx);
      const kx = (sw / 2 - 24) / Math.max(1e-6, Math.abs(Math.cos(ang)));
      // Arrows at the top stay below the HUD and its power tray.
      const ky = (dy < 0 ? sh / 2 - 118 : sh / 2 - 48) / Math.max(1e-6, Math.abs(Math.sin(ang)));
      const k = Math.min(kx, ky);
      const tint = q.kind === 'chest' ? 0xffd27a : q.kind === 'medallion' || q.kind === 'fragment' ? 0xffe2a0 : q.kind === 'shrine' ? 0x9fdcff : 0xff5a78;
      const s = q.kind === 'medallion' || q.kind === 'shrine' || q.kind === 'fragment' ? 0.9 : 0.7;
      this.L.hud.add(f.pointer, sw / 2 + Math.cos(ang) * k, sh / 2 + Math.sin(ang) * k, s, s, ang, tint, 0.95);
    }
  }

  /** Time stands still: the field dims and an eye opens over it, closing as time starts again. */
  private drawAlmighty(w: World, sw: number, sh: number): void {
    const f = this.atlas.frames;
    const L = this.L.hud;
    const sq = this.atlas.px.square.w;
    const elapsed = w.almightyMax - w.almightyT;
    const open = Math.min(1, elapsed / 0.25, w.almightyT / 0.2);
    L.add(f.square, sw / 2, sh / 2, sw / sq + 2, sh / sq + 2, 0, 0x0a1030, 0.42 * open);
    const s = Math.min(sw * 0.7, 340) / this.atlas.px.eye.w;
    L.add(f.eye, sw / 2, sh * 0.3, s, s * Math.max(0.05, open), 0, 0xffffff, open);
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
