import { formatTime } from '../core/math';
import { ARMORY_COST, GESANG_VERSES, UPGRADES } from '../data/archives';
import { BANKAI_BY_ID, BANKAI_IDS } from '../data/bankai';
import { CODEX_ENEMIES, type CodexSection } from '../data/codex';
import { DAILY_CLEAR_GOLD, DAILY_MOD_BY_ID, DAILY_SURVIVE_GOLD, DAILY_SURVIVE_TIME, dayLabel, type DailySpec } from '../data/daily';
import { PASSIVE_BY_ID } from '../data/passives';
import { POWER_BY_ID, POWERS, STARTING_POWER, type PowerDef } from '../data/powers';
import { type Rarity, RELIC_BY_ID, type RelicDef, RELICS } from '../data/relics';
import { RESONANCE_BY_ID, RESONANCES, resonanceParts, type ResonanceDef } from '../data/resonances';
import { PACT_BY_ID, type PactDef } from '../data/shrines';
import { SPOILS } from '../data/spoils';
import { MAX_TRIAL, STAGES, stageById, TRIAL_NAMES, trialBlurb, type StageId } from '../data/stages';
import { CHAPTERS, type Chapter } from '../data/story';
import type { ChestKind, Offer } from '../game/offers';
import type { Banner, World } from '../game/world';
import { drawEmperor, drawSprite } from '../render/atlas';
import { bossSpriteName, enemySpriteName } from '../render/names';
import { armoryRelics, nextCost, nextVerseCost, startOptions, upgradeLevel, wonSpoils } from '../save/archives';
import { almightyUnlocked, endlessOpen, rushOpen, stageUnlocked, trialsOpen, type DailyRecord, type SaveData, type Settings } from '../save/save';
import { chapterUnlocked } from '../save/story';
import { LOOKS, TRAILS, type LookId, type TrailId } from '../data/looks';
import { codexFound, codexTotal, featProgress, FEATS } from '../save/feats';
import { drawEmblem, drawIcon, drawTrailSwatch } from './icons';
import { shareRun } from './share';
import { drawVista } from './vistas';

/**
 * Everything outside the game world is plain DOM with an external stylesheet:
 * no inline styles or scripts, so it works under a strict CSP. Dynamic values
 * go through the CSSOM (element.style), which CSP allows.
 */

export type Toggle = keyof Settings;

export type CodexTab = 'schrift' | 'resonances' | 'relics' | 'spoils' | 'enemies';

const CODEX_TABS: readonly [CodexTab, string][] = [
  ['schrift', 'Schrift'],
  ['resonances', 'Resonances'],
  ['relics', 'Relics'],
  ['spoils', 'Spoils'],
  ['enemies', 'Enemies'],
];

/** The boss a spoil of war comes from, for its portrait and its name. */
function spoilBoss(r: RelicDef): { name: string; sprite: string } {
  const e = CODEX_ENEMIES.find((x) => x.key === r.boss);
  // The Codex names a knight with the bankai he stole; here the knight is enough.
  return e ? { name: e.name.replace(/ \(.*\)$/, ''), sprite: enemySpriteName(e.type, e.variant) } : { name: 'a boss', sprite: '' };
}

/** A relic's colour: its rarity's, or a spoil's own. */
function relicColor(r: RelicDef): string {
  return r.color ?? RARITY_COLOR[r.rarity];
}

const POWER_SECTIONS: readonly [string, (d: PowerDef) => boolean, string][] = [
  ['Schrift', (d) => d.group === 'schrift' || d.group === 'art', 'Take it from a level-up board.'],
  ['Support', (d) => d.group === 'utility', 'Take it from a level-up board.'],
  ['Bankai', (d) => d.group === 'bankai', 'Take it back from the one who carries it.'],
  ['Fragments of the Soul King', (d) => d.group === 'fragment', 'Left by the Royal Guard in the Soul King Palace.'],
  ['The Almighty', (d) => d.group === 'ultimate', 'Take back five powers in one run: bankai, fragments and awakened Schrift all count.'],
];

const ENEMY_SECTIONS: readonly [CodexSection, string][] = [
  ['hueco', 'Hueco Mundo'],
  ['seireitei', 'Seireitei'],
  ['lasnoches', 'Las Noches'],
  ['silbern', 'Silbern'],
  ['palace', 'Soul King Palace'],
  ['wahrwelt', 'Wahrwelt'],
  ['karakura', 'Karakura Town'],
  ['events', 'Events'],
];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function button(cls: string, text: string): HTMLButtonElement {
  const b = el('button', cls, text);
  b.type = 'button';
  return b;
}

/** Scroll a sideways strip so `item` sits in its middle, when the strip scrolls at all. */
function centerIn(strip: HTMLElement, item: HTMLElement | null): void {
  if (!item || strip.scrollWidth <= strip.clientWidth) return;
  const a = item.getBoundingClientRect();
  const r = strip.getBoundingClientRect();
  strip.scrollLeft += a.left - r.left - (r.width - a.width) / 2;
}

/** A row's own colour, plus a faint wash of it behind the panel and its icon tile. */
function setAccent(e: HTMLElement, color: string): void {
  e.style.setProperty('--accent', color);
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return;
  const n = parseInt(m[1], 16);
  e.style.setProperty('--accent-soft', `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, 0.16)`);
}

const RARITY_COLOR: Readonly<Record<Rarity, string>> = { common: '#d8d2c4', rare: '#7cc4ff', legendary: '#ffcb5c' };

/** The Archives' tabs. */
export type ArchivesTab = 'training' | 'armory' | 'gesang';
const ARCHIVES_TABS: readonly (readonly [ArchivesTab, string])[] = [
  ['training', 'Training'],
  ['armory', 'Armory'],
  ['gesang', 'Kaiser Gesang'],
];

export interface ArchivesHandlers {
  onTab: (tab: ArchivesTab) => void;
  /** Training: buy an upgrade's next level, pick the starting Schrift. */
  onBuy: (id: string) => void;
  onStart: (id: string) => void;
  /** Armory: buy a relic into it; equip one (null takes it off). */
  onArmory: (id: string) => void;
  onEquip: (id: string | null) => void;
  /** Kaiser Gesang: sing the next verse. */
  onVerse: () => void;
  onBack: () => void;
}
const RARITY_LABEL: Readonly<Record<Rarity, string>> = { common: 'Common', rare: 'Rare', legendary: 'Legendary' };

interface CardSpec {
  icon: string;
  color: string;
  title: string;
  letter?: string;
  credit?: string;
  badge?: string;
  desc: string;
  tone?: Rarity | 'attr' | 'bankai' | 'resonance' | 'pact';
  /** A pact's price, in red under the description. */
  cost?: string;
  /** Level after picking this card, out of the most it can reach. */
  pips?: readonly [number, number];
  /** One extra line, such as the resonance this power is half of. */
  note?: string;
}

/** One power's line in the damage report. */
export interface DamageRow {
  name: string;
  icon: string;
  color: string;
  letter?: string;
  total: number;
  dps: number;
}

/** The world's damage report with names and icons, for the pause and results screens. */
export function damageRows(w: World): DamageRow[] {
  return w.damageReport().map((r) => {
    const d = POWER_BY_ID.get(r.id);
    return d
      ? { name: d.name, icon: d.icon, color: d.color, letter: d.letter, total: r.total, dps: r.dps }
      : { name: 'Other', icon: 'star', color: '#9a9fae', total: r.total, dps: r.dps };
  });
}

/** 12.3k, 1.24M: big numbers in a narrow column. */
function short(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}k`;
  return String(Math.round(n));
}

export interface ResultSummary {
  stage: StageId;
  stageName: string;
  /** How far the Emperor evolved: he is drawn that way on the results and the card. */
  evolution: number;
  /** "Trial II", "Endless", or "" for a normal run. */
  mode: string;
  endless: boolean;
  /** A stage this run unlocked, by name. */
  unlocked: string | null;
  /** This run took back the last missing bankai: A · The Almighty is now unlocked. */
  almighty: boolean;
  /** Gold the run paid out, and the balance after it. */
  goldEarned: number;
  goldTotal: number;
  /** Something in the Archives the balance now buys ("Licht Regen drills Lv 2"), or null. */
  afford: string | null;
  /** Attacks awakened for the first time (names): new starting options. */
  starts: string[];
  /** Story chapters this run unlocked (titles), told next. */
  chapters: string[];
  /** A Daily Trial: the best shown is today's, plus any bonus gold the run earned. */
  daily: boolean;
  /** A Boss Rush: the record shown is the fastest clear. */
  rush: boolean;
  dailyBonus: number;
  /** "Daily Trial · October 19 · Frail + Giants", or "" for any other run. */
  dailyLine: string;
  damage: DamageRow[];
  /** Pacts made at shrines, by id. */
  pacts: string[];
  /** Feats this run earned, with what each paid. */
  feats: { name: string; gold: number; look: string | null; relic: string | null }[];
  /** The Emperor's look, for his portrait and the card. */
  look: string;
  victory: boolean;
  quit: boolean;
  time: number;
  level: number;
  kills: number;
  bestTime: number;
  newBest: boolean;
  powers: { name: string; icon: string; color: string; letter?: string; level: number; attr: string | null; bankai: boolean }[];
  /** Resonance ids owned at the end. */
  resonances: string[];
}

/** 1,240 rather than 1240. */
function gold(n: number): string {
  return Math.floor(n).toLocaleString('en-US');
}

function powerCard(def: PowerDef, badge: string | undefined, desc: string, tone?: CardSpec['tone']): CardSpec {
  return {
    icon: def.icon,
    color: def.color,
    title: def.name,
    letter: def.letter,
    credit: def.group === 'bankai' ? `${def.credit ?? ''}'s bankai` : def.credit,
    badge,
    desc,
    tone: tone ?? (def.group === 'bankai' ? 'bankai' : undefined),
  };
}

export class UI {
  onPause: () => void = () => undefined;
  private readonly hud: HTMLElement;
  private readonly xpFill: HTMLElement;
  private readonly lvl: HTMLElement;
  private readonly kills: HTMLElement;
  private readonly rush: HTMLElement;
  /** Powers taken back toward The Almighty, until it awakens. */
  private readonly almighty: HTMLElement;
  private readonly timer: HTMLElement;
  private readonly bossBar: HTMLElement;
  private readonly bossPortrait: HTMLCanvasElement;
  private readonly bossName: HTMLElement;
  private readonly bossSub: HTMLElement;
  private readonly bossFill: HTMLElement;
  private readonly tray: HTMLElement;
  /** Tray icons, drawn once per power and reused whenever the tray is rebuilt. */
  private readonly trayIcons = new Map<string, HTMLCanvasElement>();
  private readonly vignette: HTMLElement;
  private readonly toastEl: HTMLElement;
  private readonly tipEl: HTMLElement;
  private tipTimer = 0;
  private readonly bannerEl: HTMLElement;
  private readonly screen: HTMLElement;
  private readonly rotateEl: HTMLElement;
  private readonly debugEl: HTMLElement;
  private toastTimer = 0;
  private bannerTimer = 0;
  private unlockAt = 0;
  private last = UI.fresh();

  private static fresh() {
    return { level: -1, kills: -1, sec: -1, xp: -1, boss: -2, bossUid: -1, bossPhase: -1, streak: -1, tier: -1, build: -1, danger: false };
  }

  constructor(root: HTMLElement) {
    const vignette = el('div', 'vignette');
    this.vignette = vignette;
    this.hud = el('div', 'hud hidden');
    const xp = el('div', 'xpbar');
    this.xpFill = el('div', 'xpfill');
    xp.append(this.xpFill);
    const row = el('div', 'hud-row');
    const left = el('div', 'hud-left');
    this.lvl = el('span', 'hud-level', '1');
    this.kills = el('span', 'hud-kills', '0');
    this.rush = el('span', 'hud-rush hidden', '');
    this.almighty = el('span', 'hud-almighty hidden', '');
    this.almighty.setAttribute('aria-label', 'Powers taken back toward The Almighty');
    left.append(this.lvl, this.kills, this.almighty, this.rush);
    this.timer = el('div', 'hud-timer', '0:00');
    const pause = button('icon-btn', '');
    pause.setAttribute('aria-label', 'Pause');
    pause.append(el('span', 'pause-glyph'));
    pause.addEventListener('click', () => this.onPause());
    row.append(left, this.timer, pause);
    this.tray = el('div', 'hud-tray');
    this.bossBar = el('div', 'bossbar hidden');
    this.bossPortrait = el('canvas', 'boss-portrait');
    const bossInfo = el('div', 'boss-info');
    this.bossName = el('div', 'boss-name', '');
    this.bossSub = el('div', 'boss-sub', '');
    const track = el('div', 'boss-track');
    this.bossFill = el('div', 'boss-fill');
    track.append(this.bossFill);
    bossInfo.append(this.bossName, this.bossSub, track);
    this.bossBar.append(this.bossPortrait, bossInfo);
    this.hud.append(xp, row, this.tray, this.bossBar);
    this.toastEl = el('div', 'toast');
    this.toastEl.setAttribute('role', 'status');
    this.tipEl = el('div', 'tip-bubble');
    this.tipEl.setAttribute('role', 'status');
    this.bannerEl = el('div', 'banner');
    this.bannerEl.setAttribute('aria-live', 'polite');
    this.screen = el('div', 'screen hidden');
    this.rotateEl = el('div', 'rotate hidden');
    this.rotateEl.append(el('div', 'rotate-icon'), el('p', 'rotate-text', 'Turn your phone upright to play'));
    this.debugEl = el('div', 'debug hidden');
    root.append(vignette, this.hud, this.toastEl, this.tipEl, this.bannerEl, this.screen, this.rotateEl, this.debugEl);
  }

  // ------------------------------------------------------------- HUD

  showHud(show: boolean): void {
    this.hud.classList.toggle('hidden', !show);
    this.last = UI.fresh();
    this.vignette.classList.remove('danger');
  }

  /** Called every frame; touches the DOM only when a value actually changed. */
  updateHud(w: World): void {
    const sec = Math.floor(w.t);
    if (sec !== this.last.sec) {
      this.last.sec = sec;
      this.timer.textContent = formatTime(sec);
    }
    if (w.level !== this.last.level) {
      this.last.level = w.level;
      this.lvl.textContent = String(w.level);
    }
    if (w.buildVersion !== this.last.build) {
      this.last.build = w.buildVersion;
      this.drawTray(w);
      const a = w.almightyProgress();
      this.almighty.classList.toggle('hidden', a === null);
      if (a) this.almighty.textContent = `${Math.min(a.have, a.need)}/${a.need}`;
    }
    // Low health: the edges of the screen pulse red.
    const danger = w.player.hp > 0 && w.player.hp < w.player.maxHp * 0.3;
    if (danger !== this.last.danger) {
      this.last.danger = danger;
      this.vignette.classList.toggle('danger', danger);
    }
    // Blut Rush: the chain counter shows from 10 kills, coloured by tier.
    const streak = w.streak >= 10 ? w.streak : 0;
    if (streak !== this.last.streak || w.rushTier !== this.last.tier) {
      this.last.streak = streak;
      this.last.tier = w.rushTier;
      this.rush.textContent = streak > 0 ? `Blut ×${streak}` : '';
      this.rush.className = `hud-rush${streak > 0 ? '' : ' hidden'}${w.rushTier > 0 ? ` tier${w.rushTier}` : ''}`;
    }
    if (w.kills !== this.last.kills) {
      this.last.kills = w.kills;
      this.kills.textContent = String(w.kills);
    }
    const xp = Math.round(Math.min(1, w.xp / w.xpNext) * 200) / 200;
    if (xp !== this.last.xp) {
      this.last.xp = xp;
      this.xpFill.style.transform = `scaleX(${xp})`;
    }
    const boss = w.boss.active ? Math.round(Math.max(0, w.boss.hp / w.boss.max) * 200) / 200 : -1;
    if (boss !== this.last.boss) {
      this.bossBar.classList.toggle('hidden', boss < 0);
      if (boss >= 0) this.bossFill.style.transform = `scaleX(${boss})`;
      this.last.boss = boss;
    }
    if (w.boss.active && (w.boss.uid !== this.last.bossUid || w.boss.phase !== this.last.bossPhase)) {
      if (w.boss.uid !== this.last.bossUid) {
        this.bossName.textContent = w.boss.name;
        this.bossSub.textContent = w.boss.sub;
      }
      this.last.bossUid = w.boss.uid;
      this.last.bossPhase = w.boss.phase;
      // The portrait changes with the boss: a bankai, a mask, a release.
      drawSprite(this.bossPortrait, bossSpriteName(w.boss.type, w.boss.variant, w.boss.phase), 40);
    }
  }

  /** The powers you hold, as small icons with their level; awakened ones ringed in gold. */
  private drawTray(w: World): void {
    const items: HTMLElement[] = [];
    w.powers.forEach((ps, slot) => {
      const d = ps.def;
      const kind = d.group === 'bankai' ? ' bankai' : d.group === 'fragment' ? ' fragment' : d.group === 'ultimate' ? ' ultimate' : '';
      // Ichimonji: the sealed power shows greyed out and struck through until its name comes back.
      const sealed = slot === w.sealSlot && w.sealT > 0 ? ' sealed' : '';
      const item = el('span', `tray-item${kind}${ps.attr ? ' awake' : ''}${sealed}`);
      let icon = this.trayIcons.get(d.id);
      if (!icon) {
        icon = el('canvas', 'tray-icon');
        drawIcon(icon, d.icon, d.color, d.letter);
        this.trayIcons.set(d.id, icon);
      }
      item.append(icon, el('span', 'tray-lv', d.group === 'ultimate' ? 'A' : String(ps.level)));
      items.push(item);
    });
    this.tray.replaceChildren(...items);
  }

  toast(text: string, kind: 'boss' | 'info' = 'info'): void {
    this.toastEl.textContent = text;
    this.toastEl.className = `toast show ${kind}`;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(
      () => {
        this.toastEl.className = 'toast';
      },
      kind === 'boss' ? 3000 : 2200,
    );
  }

  /** A first-time tip near the bottom of the screen for a few seconds; the run goes on underneath. */
  tip(text: string): void {
    this.tipEl.textContent = text;
    this.tipEl.className = 'tip-bubble show';
    window.clearTimeout(this.tipTimer);
    this.tipTimer = window.setTimeout(() => {
      this.tipEl.className = 'tip-bubble';
    }, 6000);
  }

  /** A title card that slides across the middle of the screen; the game keeps running. */
  banner(b: Banner): void {
    const KICKER: Record<Banner['kind'], string> = {
      bankai: 'Bankai',
      almighty: 'A · Awakened',
      resonance: 'Resonance',
      event: 'Event',
      evolve: 'The Emperor',
      fragment: 'Fragment of the Soul King',
      boss: 'Boss',
      spoil: 'Spoils of war',
    };
    const kicker = KICKER[b.kind];
    this.bannerEl.replaceChildren(
      el('div', 'banner-kicker', kicker),
      el('div', 'banner-title', b.title),
      el('div', 'banner-sub', b.sub),
    );
    if (b.quote) this.bannerEl.append(el('div', 'banner-quote', b.quote));
    this.bannerEl.className = `banner show ${b.kind}`;
    window.clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(
      () => {
        this.bannerEl.className = `banner ${b.kind}`;
      },
      b.quote ? 3800 : 2600,
    );
  }

  setRotate(show: boolean): void {
    this.rotateEl.classList.toggle('hidden', !show);
  }

  setDebug(text: string | null): void {
    this.debugEl.classList.toggle('hidden', text === null);
    if (text !== null && this.debugEl.textContent !== text) this.debugEl.textContent = text;
  }

  // --------------------------------------------------------- screens

  hideScreen(): void {
    this.screen.className = 'screen hidden';
    this.screen.replaceChildren();
  }

  showTitle(
    save: SaveData,
    h: {
      onPlay: () => void;
      onArchives: () => void;
      onChronicle: () => void;
      onCodex: () => void;
      onFeats: () => void;
      onSettings: () => void;
      onStage: (id: StageId) => void;
      onMode: () => void;
      onDaily: () => void;
      daily: DailySpec;
      installHint: boolean;
      /** Something in the Archives is affordable: the button carries a gold dot. */
      archivesDot: boolean;
      /** The Emperor's portrait opens the Wardrobe; a dot when something there is affordable. */
      onWardrobe: () => void;
      wardrobeDot: boolean;
    },
  ): void {
    const p = this.open('title');
    // Gold at the top, always in view.
    const top = el('div', 'topbar');
    const purse = el('span', 'topbar-gold');
    const coin = el('canvas', 'topbar-icon');
    drawIcon(coin, 'coin', '#ffd27a');
    purse.append(coin, el('span', '', gold(save.gold)));
    const feats = el('span', 'topbar-feats');
    const crown = el('canvas', 'topbar-icon');
    drawIcon(crown, 'crown', '#ffcb5c');
    feats.append(crown, el('span', '', `${save.feats.length}/${FEATS.length}`));
    top.append(purse, feats);
    // The Emperor, painted from his own sprite in front of the reishi star.
    const hero = el('div', 'title-hero');
    const emblem = el('canvas', 'emblem');
    drawEmblem(emblem, 140);
    const portrait = el('canvas', 'hero-portrait');
    drawEmperor(portrait, save.evolution, 208, undefined, save.look);
    const wardrobe = button('hero-btn', '');
    wardrobe.setAttribute('aria-label', h.wardrobeDot ? 'The Emperor’s Wardrobe: something to buy' : 'The Emperor’s Wardrobe');
    wardrobe.append(portrait, el('span', `wardrobe-pill${h.wardrobeDot ? ' has-dot' : ''}`, 'Wardrobe'));
    wardrobe.addEventListener('click', this.guard(h.onWardrobe));
    hero.append(emblem, wardrobe);
    const logo = el('div', 'logo');
    logo.append(el('div', 'logo-top', 'QUINCY'), el('div', 'logo-bottom', 'SURVIVAL'));
    const play = button('btn primary', 'Play');
    play.addEventListener('click', this.guard(h.onPlay));
    const nav = el('nav', 'title-nav');
    nav.setAttribute('aria-label', 'More');
    const archives = this.navButton(`archives-btn${h.archivesDot ? ' has-dot' : ''}`, 'vault', 'Archives', '#ffd27a', h.onArchives);
    if (h.archivesDot) archives.setAttribute('aria-label', 'Archives: something to buy');
    nav.append(
      archives,
      this.navButton('codex-btn', 'book', 'Codex', '#d8c8ff', h.onCodex),
      this.navButton('feats-btn', 'crown', 'Feats', '#ffcb5c', h.onFeats),
      this.navButton('chronicle-btn', 'feather', 'Chronicle', '#9fdcff', h.onChronicle),
      this.navButton('settings-btn', 'gear', 'Settings', '#c9cbd4', h.onSettings),
    );
    p.append(
      top,
      hero,
      logo,
      el('p', 'tagline', 'The Emperor takes back what he gave.'),
      this.stagePicker(save, h.onStage, h.onMode),
      play,
      this.dailyCard(save, h.daily, h.onDaily),
      nav,
      this.collection(save),
    );
    // New players get the controls in one line; everyone else already knows.
    if (save.totals.runs === 0) p.append(el('p', 'hint', 'Drag anywhere to move. Your powers fire on their own. Each stage lasts 20 minutes.'));
    if (h.installHint) {
      const box = el('div', 'install');
      box.append(el('strong', '', 'Play full-screen'), el('span', '', 'Tap Share, then Add to Home Screen.'));
      p.append(box);
    }
    this.lock(150);
  }

  showSettings(
    settings: Settings,
    h: { onToggle: (k: Toggle) => boolean; onBack: () => void; onExport: () => void; onImport: () => void; onResetTips: () => void },
  ): void {
    const p = this.open('settings');
    p.append(el('h2', 'board-title', 'Settings'), this.toggles(settings, h.onToggle));
    const again = button('btn small', 'Show the tips again');
    again.addEventListener('click', () => {
      h.onResetTips();
      this.toast('Tips will show again');
    });
    p.append(again);
    const save = el('div', 'row-btns');
    const exp = button('btn small', 'Copy save code');
    exp.addEventListener('click', h.onExport);
    const imp = button('btn small', 'Load save code');
    imp.addEventListener('click', h.onImport);
    save.append(exp, imp);
    const back = button('btn primary', 'Back');
    back.addEventListener('click', this.guard(h.onBack));
    p.append(save, back);
    this.lock(150);
  }

  showLevelUp(
    level: number,
    offers: readonly Offer[],
    onPick: (o: Offer) => void,
    reroll?: { left: number; onReroll: () => void },
    owned: ReadonlySet<string> = new Set(),
    tip: string | null = null,
  ): void {
    const p = this.open('board');
    p.append(el('div', 'board-kicker', 'Auswählen'), el('h2', 'board-title', `Level ${level}`));
    if (tip) p.append(el('p', 'board-tip', tip));
    const list = el('div', 'cards');
    for (const o of offers) list.append(this.card(this.offerSpec(o, owned), () => onPick(o)));
    p.append(list);
    if (reroll && reroll.left > 0) {
      const b = button('btn small reroll', `Reroll · ${reroll.left} left`);
      b.addEventListener('click', this.guard(reroll.onReroll));
      p.append(b);
    }
    this.lock();
  }

  /**
   * The Wandenreich Archives, in three tabs: Training (permanent upgrades and
   * the starting Schrift), the Armory (relics bought for good, one equipped
   * for every run) and the Kaiser Gesang (verses without end). Redrawn after
   * each purchase without the tap lock, so buying several in a row feels instant.
   */
  showArchives(save: SaveData, h: ArchivesHandlers, relock = true, tab: ArchivesTab = 'training'): void {
    const p = this.open('archives', !relock);
    p.append(el('div', 'board-kicker', 'Wandenreich'), el('h2', 'board-title', 'Archives'));
    const balance = el('p', 'gold-line');
    const coin = el('canvas', 'gold-icon');
    drawIcon(coin, 'coin', '#ffd27a');
    balance.append(coin, el('span', '', `${gold(save.gold)} gold`));
    p.append(balance);
    const tabs = el('div', 'codex-tabs archives-tabs');
    tabs.setAttribute('role', 'tablist');
    for (const [id, label] of ARCHIVES_TABS) {
      const b = button(`codex-tab archives-tab tab-${id}${tab === id ? ' on' : ''}`, label);
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(tab === id));
      b.addEventListener('click', () => h.onTab(id));
      tabs.append(b);
    }
    p.append(tabs);
    if (tab === 'armory') this.archivesArmory(p, save, h);
    else if (tab === 'gesang') this.archivesGesang(p, save, h);
    else this.archivesTraining(p, save, h);
    const back = button('btn primary', 'Back');
    back.addEventListener('click', this.guard(h.onBack));
    p.append(back);
    if (relock) this.lock(150);
  }

  /** Training: the permanent upgrades, then the choice of starting Schrift. */
  private archivesTraining(p: HTMLElement, save: SaveData, h: ArchivesHandlers): void {
    p.append(el('p', 'archives-hint', 'Every run pays gold. What you learn here stays with you.'));
    const list = el('div', 'upgrades');
    for (const u of UPGRADES) {
      const level = upgradeLevel(save, u.id);
      const max = u.costs.length;
      const cost = nextCost(save, u.id);
      const row = el('div', 'upgrade');
      setAccent(row, u.color);
      const icon = el('canvas', 'upgrade-icon');
      drawIcon(icon, u.icon, u.color);
      const body = el('div', 'upgrade-body');
      const pips = el('div', 'pips');
      for (let k = 0; k < max; k++) pips.append(el('span', k < level ? 'pip on' : 'pip'));
      body.append(el('div', 'upgrade-name', u.name), pips, el('p', 'upgrade-desc', `${u.per}${max > 1 ? ' per level' : ''}. ${u.desc}`));
      const buy = button('upgrade-buy', cost === null ? 'Max' : gold(cost));
      if (cost === null || save.gold < cost) {
        buy.disabled = true;
        buy.classList.add(cost === null ? 'maxed' : 'poor');
      } else {
        buy.addEventListener('click', this.guard(() => h.onBuy(u.id)));
      }
      buy.setAttribute('aria-label', cost === null ? `${u.name}: maxed` : `Buy ${u.name} level ${level + 1} for ${cost} gold`);
      row.append(icon, body, buy);
      list.append(row);
    }
    p.append(list, el('h3', 'archives-sub', 'Start with'));
    const starts = el('div', 'start-chips');
    const options = startOptions(save);
    for (const id of options) {
      const def = POWER_BY_ID.get(id);
      if (!def) continue;
      const chip = button(`start-chip${save.start === id ? ' on' : ''}`, '');
      chip.setAttribute('aria-pressed', String(save.start === id));
      const c = el('canvas', 'chip-icon');
      drawIcon(c, def.icon, def.color, def.letter);
      chip.append(c, el('span', 'chip-text', def.name));
      chip.addEventListener('click', this.guard(() => h.onStart(id)));
      starts.append(chip);
    }
    p.append(starts);
    if (options.length <= 1) p.append(el('p', 'archives-hint', 'Awaken an attack to Lv 7 in a run and you can start with it.'));
  }

  /** The Armory: buy relics for good, equip one, and every run (but the Daily Trial) starts with it. */
  private archivesArmory(p: HTMLElement, save: SaveData, h: ArchivesHandlers): void {
    const now = save.startRelic ? RELIC_BY_ID.get(save.startRelic) : undefined;
    p.append(
      el(
        'p',
        'archives-hint',
        now
          ? `Every run starts with the ${now.name}. Daily Trials start with nothing, the same for everyone.`
          : 'Buy relics into the Armory, then equip one: every run but the Daily Trial starts with it.',
      ),
    );
    const list = el('div', 'upgrades armory');
    for (const r of armoryRelics(save)) {
      const owned = save.armory.includes(r.id);
      const on = save.startRelic === r.id;
      const color = RARITY_COLOR[r.rarity];
      const row = el('div', `upgrade armory-row${on ? ' on' : ''}`);
      setAccent(row, color);
      const icon = el('canvas', 'upgrade-icon');
      drawIcon(icon, r.icon, color);
      const body = el('div', 'upgrade-body');
      body.append(el('div', 'upgrade-name', r.name), el('div', 'armory-rarity', RARITY_LABEL[r.rarity]), el('p', 'upgrade-desc', r.desc));
      let b: HTMLButtonElement;
      if (!owned) {
        const cost = ARMORY_COST[r.rarity];
        b = button('upgrade-buy', gold(cost));
        b.setAttribute('aria-label', `Buy the ${r.name} into the Armory for ${cost} gold`);
        if (save.gold < cost) {
          b.disabled = true;
          b.classList.add('poor');
        } else {
          b.addEventListener('click', this.guard(() => h.onArmory(r.id)));
        }
      } else {
        b = button(`upgrade-buy ${on ? 'equipped' : 'equip'}`, on ? 'Equipped' : 'Equip');
        b.setAttribute('aria-pressed', String(on));
        b.setAttribute('aria-label', on ? `${r.name}: equipped, tap to take it off` : `Equip the ${r.name}`);
        b.addEventListener('click', this.guard(() => h.onEquip(on ? null : r.id)));
      }
      row.append(icon, body, b);
      list.append(row);
    }
    p.append(list);
    // Spoils of war: won from the bosses, never bought. Each can be equipped like a relic.
    const won = wonSpoils(save);
    p.append(el('h3', 'section-title', `Spoils of war · ${won.length} of ${SPOILS.length}`));
    if (won.length === 0) {
      p.append(el('p', 'archives-hint', 'Every boss leaves a spoil of its own when it falls. Win one and it waits here, ready to equip.'));
      return;
    }
    const spoils = el('div', 'upgrades armory');
    for (const r of won) {
      const on = save.startRelic === r.id;
      const from = spoilBoss(r);
      const row = el('div', `upgrade armory-row spoil-row${on ? ' on' : ''}`);
      setAccent(row, relicColor(r));
      const icon = el('canvas', 'upgrade-icon');
      if (!from.sprite || !drawSprite(icon, from.sprite, 40)) drawIcon(icon, r.icon, relicColor(r));
      const body = el('div', 'upgrade-body');
      body.append(el('div', 'upgrade-name', r.name), el('div', 'armory-rarity', `From ${from.name}`), el('p', 'upgrade-desc', r.desc));
      const b = button(`upgrade-buy ${on ? 'equipped' : 'equip'}`, on ? 'Equipped' : 'Equip');
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', on ? `${r.name}: equipped, tap to take it off` : `Equip ${r.name}`);
      b.addEventListener('click', this.guard(() => h.onEquip(on ? null : r.id)));
      row.append(icon, body, b);
      spoils.append(row);
    }
    p.append(spoils);
  }

  /** The Kaiser Gesang: a hundred verses, each dearer than the last, each a little more strength in every run. */
  private archivesGesang(p: HTMLElement, save: SaveData, h: ArchivesHandlers): void {
    const box = el('div', 'gesang');
    const bar = el('div', 'gesang-bar');
    const fill = el('div', 'gesang-fill');
    fill.style.width = `${(save.gesang / GESANG_VERSES) * 100}%`;
    bar.append(fill);
    const cost = nextVerseCost(save);
    const sing = button('btn gesang-buy', cost === null ? 'Every verse is sung' : `Sing verse ${save.gesang + 1} · ${gold(cost)} gold`);
    if (cost === null || save.gold < cost) {
      sing.disabled = true;
      sing.classList.add('poor');
    } else {
      sing.addEventListener('click', this.guard(h.onVerse));
    }
    box.append(
      el(
        'p',
        'gesang-lore',
        'The Kaiser Gesang foretold the sealed Emperor’s return: his heartbeat first, then his mind, then his power. Every verse you sing makes every run a little stronger.',
      ),
      el('div', 'gesang-verse', `${save.gesang} / ${GESANG_VERSES}`),
      el('div', 'gesang-label', 'Verses sung'),
      bar,
      el('p', 'gesang-bonus', save.gesang > 0 ? `Every run: +${save.gesang}% damage and +${save.gesang}% health.` : 'Each verse: +1% damage and +1% health in every run.'),
      sing,
    );
    p.append(box);
  }

  showAttributes(def: PowerDef, onPick: (attr: string) => void): void {
    const p = this.open('board');
    p.append(el('div', 'board-kicker', 'Awaken · Lv 7'), el('h2', 'board-title', def.name));
    const list = el('div', 'cards');
    for (const a of def.attributes ?? []) {
      list.append(this.card({ icon: def.icon, color: def.color, letter: def.letter, title: a.name, desc: a.desc, tone: 'attr' }, () => onPick(a.id)));
    }
    p.append(list);
    this.lock();
  }

  showChest(kind: ChestKind, relics: readonly RelicDef[], onPick: (id: string | null) => void, tip: string | null = null): void {
    const p = this.open(`board chest-${kind}`);
    p.append(
      el('div', 'board-kicker', kind === 'black' ? 'Boss reward' : 'Treasure'),
      el('h2', 'board-title', kind === 'black' ? 'Black chest' : 'Relic chest'),
    );
    if (tip) p.append(el('p', 'board-tip', tip));
    const list = el('div', 'cards');
    if (relics.length === 0) {
      list.append(this.card({ icon: 'coin', color: '#ffd27a', title: 'Gold', desc: 'Only gold inside: +50.' }, () => onPick(null)));
    }
    for (const r of relics) {
      const spec: CardSpec = { icon: r.icon, color: RARITY_COLOR[r.rarity], title: r.name, badge: RARITY_LABEL[r.rarity], desc: r.desc, tone: r.rarity };
      list.append(this.card(spec, () => onPick(r.id)));
    }
    p.append(list);
    this.lock();
  }

  showPause(w: World, settings: Settings, h: { onResume: () => void; onQuit: () => void; onToggle: (k: Toggle) => boolean }): void {
    const p = this.open('pause');
    p.append(el('h2', 'board-title', 'Paused'));
    const build = el('div', 'build');
    for (const ps of w.powers) build.append(this.chip(ps.def.icon, ps.def.color, `${ps.def.name} ${ps.level}`, ps.def.letter, ps.def.group === 'bankai'));
    for (const id of w.resonances) build.append(this.resonanceChip(id));
    for (const r of w.relics) build.append(this.chip(r.icon, relicColor(r), r.name));
    for (const id of w.pacts) {
      const chip = this.pactChip(id);
      if (chip) build.append(chip);
    }
    const resume = button('btn primary', 'Resume');
    resume.addEventListener('click', this.guard(h.onResume));
    const quit = button('btn danger', 'Quit run');
    quit.addEventListener('click', this.guard(h.onQuit));
    p.append(build);
    const rows = damageRows(w);
    if (rows.length > 0) p.append(el('h3', 'section-title', 'Damage'), this.damageList(rows));
    p.append(resume, this.toggles(settings, h.onToggle), quit);
    this.lock(200);
  }

  showResults(r: ResultSummary, h: { onRetry: () => void; onMenu: () => void }): void {
    const p = this.open(`results ${r.victory ? 'won' : 'lost'}`);
    const where = r.mode ? `${r.stageName} · ${r.mode}` : r.stageName;
    const kicker = r.victory ? `${where} cleared` : r.quit ? 'Run abandoned' : r.endless ? `${where}` : `Fallen in ${where}`;
    // The Emperor above the verdict: lit gold in victory, grey in defeat.
    const head = el('div', 'results-head');
    const portrait = el('canvas', 'results-portrait');
    drawEmperor(portrait, r.evolution, 132, undefined, r.look);
    head.append(portrait);
    p.append(head, el('div', 'board-kicker', kicker), el('h2', 'board-title', r.victory ? 'Victory' : 'Fallen'));
    if (r.unlocked) p.append(el('p', 'unlock-note', `New stage unlocked: ${r.unlocked}`));
    if (r.almighty) p.append(el('p', 'unlock-note', 'Every bankai taken back: from now on A · The Almighty awakens at three powers taken back in a run, not five.'));
    if (r.starts.length > 0) p.append(el('p', 'unlock-note', `New starting Schrift in the Archives: ${r.starts.join(', ')}`));
    if (r.chapters.length > 0) p.append(el('p', 'unlock-note', `New in the Chronicle: ${r.chapters.join(', ')}`));
    if (r.dailyBonus > 0) p.append(el('p', 'unlock-note', `Daily Trial bonus: +${r.dailyBonus} gold`));
    for (const f of r.feats) {
      const extra = [f.look ? `the ${LOOKS.find((l) => l.id === f.look)?.name ?? f.look} look` : '', f.relic ? (RELIC_BY_ID.get(f.relic)?.name ?? f.relic) : '']
        .filter(Boolean)
        .join(' and ');
      p.append(el('p', 'unlock-note feat-note', `Feat: ${f.name} · +${gold(f.gold)} gold${extra ? ` · opens ${extra}` : ''}`));
    }
    const [best, beaten] = r.rush
      ? ['Fastest clear', 'New fastest clear']
      : r.daily
        ? ["Today's best", 'New daily best']
        : r.endless
          ? ['Endless best', 'New Endless best']
          : ['Best', 'New best'];
    const stats = el('div', 'stats');
    const stat = (label: string, value: string): HTMLElement => {
      const s = el('div', 'stat');
      s.append(el('span', 'stat-value', value), el('span', 'stat-label', label));
      return s;
    };
    stats.append(
      stat('Survived', formatTime(r.time)),
      stat('Level', String(r.level)),
      stat('Kills', String(r.kills)),
      stat(r.newBest ? beaten : best, r.rush && r.bestTime === 0 ? '—' : formatTime(r.bestTime)),
    );
    p.append(stats);
    if (r.goldEarned > 0) {
      const line = el('p', 'gold-line');
      const coin = el('canvas', 'gold-icon');
      drawIcon(coin, 'coin', '#ffd27a');
      line.append(coin, el('span', '', `+${gold(r.goldEarned)} gold · ${gold(r.goldTotal)} to spend in the Archives`));
      p.append(line);
    }
    if (r.afford) p.append(el('p', 'archives-hint afford-hint', `Enough gold for ${r.afford}.`));
    if (r.damage.length > 0) p.append(el('h3', 'section-title', 'Damage'), this.damageList(r.damage));
    if (r.powers.length > 0) {
      const build = el('div', 'build');
      for (const pw of r.powers) {
        build.append(this.chip(pw.icon, pw.color, `${pw.name} ${pw.level}${pw.attr ? ` · ${pw.attr}` : ''}`, pw.letter, pw.bankai));
      }
      for (const id of r.resonances) build.append(this.resonanceChip(id));
      for (const id of r.pacts) {
        const chip = this.pactChip(id);
        if (chip) build.append(chip);
      }
      p.append(build);
    }
    const retry = button('btn primary', 'Play again');
    retry.addEventListener('click', this.guard(h.onRetry));
    const row = el('div', 'row-btns');
    const share = button('btn share-btn', 'Share');
    share.addEventListener('click', this.guard(() => void this.share(r)));
    const menu = button('btn menu-btn', 'Menu');
    menu.addEventListener('click', this.guard(h.onMenu));
    row.append(share, menu);
    p.append(retry, row);
    this.lock(700);
  }

  /** The share sheet with the run's card, or a saved PNG where there is no share sheet. */
  private async share(r: ResultSummary): Promise<void> {
    const sum = r.damage.reduce((s, d) => s + d.total, 0);
    const top = r.damage.find((d) => d.name !== 'Other');
    const result = await shareRun({
      stage: r.stage,
      stageName: r.stageName,
      evolution: r.evolution,
      look: r.look,
      mode: r.mode,
      victory: r.victory,
      quit: r.quit,
      time: r.time,
      level: r.level,
      kills: r.kills,
      powers: r.powers,
      top: top && sum > 0 ? { name: top.name, share: Math.round((top.total / sum) * 100) } : null,
      daily: r.dailyLine || null,
    });
    if (result === 'saved') this.toast('Result card saved');
    else if (result === 'failed') this.toast('Could not make the card');
  }

  /** A Quincy shrine: three pacts, each a gain at a price, or walk away. */
  showShrine(pacts: readonly PactDef[], onPick: (id: string | null) => void, tip: string | null = null): void {
    const p = this.open('board shrine');
    p.append(el('div', 'board-kicker', 'Quincy Shrine'), el('h2', 'board-title', 'Make a pact'));
    if (tip) p.append(el('p', 'board-tip', tip));
    const list = el('div', 'cards');
    for (const d of pacts) {
      list.append(this.card({ icon: d.icon, color: d.color, title: d.name, desc: d.gain, cost: d.cost, tone: 'pact' }, () => onPick(d.id)));
    }
    list.append(this.card({ icon: 'feather', color: '#9a9fae', title: 'Walk away', desc: 'Leave the shrine as it is.' }, () => onPick(null)));
    p.append(list);
    this.lock();
  }

  private pactChip(id: string): HTMLElement | null {
    const d = PACT_BY_ID.get(id);
    if (!d) return null;
    const chip = this.chip(d.icon, d.color, d.name);
    chip.classList.add('pact');
    return chip;
  }

  /** Damage by power: a bar each, the biggest first, with its share and damage per second. */
  private damageList(rows: readonly DamageRow[]): HTMLElement {
    const box = el('div', 'damage');
    const top = rows[0]?.total ?? 0;
    const sum = rows.reduce((s, r) => s + r.total, 0);
    for (const r of rows.slice(0, 10)) {
      const row = el('div', 'dmg-row');
      setAccent(row, r.color);
      const icon = el('canvas', 'dmg-icon');
      drawIcon(icon, r.icon, r.color, r.letter);
      const body = el('div', 'dmg-body');
      const head = el('div', 'dmg-head');
      const pct = sum > 0 ? Math.round((r.total / sum) * 100) : 0;
      head.append(el('span', 'dmg-name', r.name), el('span', 'dmg-num', `${short(r.total)} · ${pct}% · ${short(r.dps)}/s`));
      const bar = el('div', 'dmg-bar');
      const fill = el('div', 'dmg-fill');
      fill.style.transform = `scaleX(${top > 0 ? r.total / top : 0})`;
      bar.append(fill);
      body.append(head, bar);
      row.append(icon, body);
      box.append(row);
    }
    return box;
  }

  // --------------------------------------------------------- helpers

  /** Today's Daily Trial: where, with what, under which rules, and what it has paid so far. */
  showDaily(spec: DailySpec, record: DailyRecord, h: { onBegin: () => void; onBack: () => void }): void {
    const p = this.open('daily');
    p.append(el('div', 'board-kicker', 'Daily Trial'), el('h2', 'board-title', dayLabel(spec.date)));
    const where = el('p', 'archives-hint', `${stageById(spec.stage).name}. Today's seed, opening Schrift and rules are the same for every player.`);
    // You open with Heilig Pfeil and today's Schrift, which is lit.
    const opener = el('div', 'start-chips');
    for (const id of [STARTING_POWER, spec.schrift]) {
      const def = POWER_BY_ID.get(id);
      if (!def) continue;
      const chip = el('div', id === spec.schrift ? 'start-chip daily-chip on' : 'start-chip daily-chip');
      const c = el('canvas', 'chip-icon');
      drawIcon(c, def.icon, def.color, def.letter);
      chip.append(c, el('span', 'chip-text', def.name));
      opener.append(chip);
    }
    const mods = el('div', 'chapters');
    for (const id of spec.mods) {
      const mod = DAILY_MOD_BY_ID.get(id);
      if (!mod) continue;
      const row = el('div', 'chapter daily-mod');
      row.append(el('span', 'chapter-kicker', 'Rule'), el('span', 'chapter-title', mod.name), el('span', 'chapter-hint', mod.desc));
      mods.append(row);
    }
    const today = record.date === spec.date ? record : { best: 0, survived: false, cleared: false };
    const status = [
      today.best > 0 ? `Today's best ${formatTime(today.best)}.` : 'Not played yet today.',
      today.survived ? '' : `Survive ${formatTime(DAILY_SURVIVE_TIME)}: +${DAILY_SURVIVE_GOLD} gold.`,
      today.cleared ? 'Cleared today.' : `Clear it: +${DAILY_CLEAR_GOLD} gold.`,
    ]
      .filter(Boolean)
      .join(' ');
    const begin = button('btn primary', 'Begin');
    begin.addEventListener('click', this.guard(h.onBegin));
    const back = button('btn', 'Back');
    back.addEventListener('click', this.guard(h.onBack));
    p.append(where, opener, mods, el('p', 'archives-hint', status), begin, back);
    this.lock(150);
  }

  /** A story chapter as a card: kicker, title, a few short paragraphs, Continue. */
  showStory(c: Chapter, onDone: () => void, label = 'Continue'): void {
    const p = this.open('story');
    p.append(el('div', 'board-kicker', c.kicker), el('h2', 'board-title', c.title));
    const body = el('div', 'story-text');
    for (const para of c.text) body.append(el('p', '', para));
    const done = button('btn primary', label);
    done.addEventListener('click', this.guard(onDone));
    p.append(body, done);
    this.lock(600);
  }

  /**
   * The Codex: every Schrift and its awakenings, the resonances, the relics and
   * every enemy, opened as you meet them. Unknown entries are silhouettes with
   * a hint of where to look.
   */
  showCodex(save: SaveData, tab: CodexTab, h: { onTab: (t: CodexTab) => void; onBack: () => void }): void {
    const p = this.open('codex');
    const c = save.codex;
    const powers = POWERS.filter((d) => POWER_SECTIONS.some(([, test]) => test(d)));
    p.append(el('div', 'board-kicker', 'The Emperor’s'), el('h2', 'board-title', 'Codex'), el('p', 'archives-hint', `Discovered ${codexFound(save)} of ${codexTotal()}.`));
    const tabs = el('div', 'codex-tabs');
    tabs.setAttribute('role', 'tablist');
    for (const [id, label] of CODEX_TABS) {
      const b = button(`codex-tab${id === tab ? ' on' : ''}`, label);
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(id === tab));
      b.addEventListener('click', () => h.onTab(id));
      tabs.append(b);
    }
    const list = el('div', 'codex-list');
    if (tab === 'schrift') {
      for (const [title, test, hint] of POWER_SECTIONS) {
        list.append(el('h3', 'section-title', title));
        for (const d of powers.filter(test)) {
          if (!c.powers.includes(d.id)) {
            list.append(this.codexEntry(d.icon, d.color, null, hint, d.letter));
            continue;
          }
          const e = this.codexEntry(d.icon, d.color, d.name, d.desc, d.letter, d.credit);
          if (d.attributes) {
            const awaken = el('div', 'codex-awaken');
            for (const a of d.attributes) awaken.append(el('div', '', `${a.name}: ${a.desc}`));
            e.querySelector('.codex-body')?.append(awaken);
          }
          list.append(e);
        }
      }
    } else if (tab === 'resonances') {
      for (const r of RESONANCES) {
        const a = POWER_BY_ID.get(r.a)?.name ?? r.a;
        list.append(
          c.resonances.includes(r.id)
            ? this.codexEntry('star', r.color, r.name, r.desc, r.letters, partsLine(r))
            : this.codexEntry(
                'star',
                r.color,
                null,
                r.c ? `${a} resonates with two other powers at once, once all three are strong enough.` : `${a} resonates with one other power once both are strong enough.`,
                '?',
              ),
        );
      }
    } else if (tab === 'relics') {
      for (const r of RELICS) {
        list.append(
          c.relics.includes(r.id)
            ? this.codexEntry(r.icon, RARITY_COLOR[r.rarity], r.name, r.desc, undefined, RARITY_LABEL[r.rarity])
            : this.codexEntry(
                r.icon,
                RARITY_COLOR[r.rarity],
                null,
                r.locked && !save.relicsOpen.includes(r.id)
                  ? 'Opened by a feat, then found in chests.'
                  : `A ${RARITY_LABEL[r.rarity].toLowerCase()} relic, found in chests.`,
              ),
        );
      }
    } else if (tab === 'spoils') {
      for (const [section, title] of ENEMY_SECTIONS) {
        const here = SPOILS.filter((r) => CODEX_ENEMIES.find((e) => e.key === r.boss)?.section === section);
        if (here.length === 0) continue;
        list.append(el('h3', 'section-title', title));
        for (const r of here) {
          const won = c.relics.includes(r.id);
          const from = spoilBoss(r);
          const row = el('div', `codex-entry spoil${won ? '' : ' locked'}`);
          setAccent(row, relicColor(r));
          const portrait = el('canvas', 'codex-portrait');
          if (from.sprite) drawSprite(portrait, from.sprite, 44);
          const body = el('div', 'codex-body');
          body.append(el('div', 'codex-name', won ? r.name : '? ? ?'), el('div', 'codex-sub', `From ${from.name}`));
          body.append(el('p', 'codex-text', won ? r.desc : `Defeat ${from.name} to win it.`));
          row.append(portrait, body);
          list.append(row);
        }
      }
    } else {
      for (const [section, title] of ENEMY_SECTIONS) {
        list.append(el('h3', 'section-title', title));
        for (const e of CODEX_ENEMIES.filter((x) => x.section === section)) {
          const kills = c.kills[e.key] ?? 0;
          const row = el('div', `codex-entry ${e.boss ? 'boss' : 'enemy'}${kills > 0 ? '' : ' locked'}`);
          const portrait = el('canvas', 'codex-portrait');
          drawSprite(portrait, enemySpriteName(e.type, e.variant), 44);
          const body = el('div', 'codex-body');
          body.append(el('div', 'codex-name', kills > 0 ? e.name : '? ? ?'), el('div', 'codex-sub', kills > 0 ? `Defeated ${gold(kills)}` : 'Not yet defeated'));
          row.append(portrait, body);
          list.append(row);
        }
      }
    }
    const back = button('btn primary', 'Back');
    back.addEventListener('click', this.guard(h.onBack));
    p.append(tabs, list, back);
    // Five tabs are more than most phones fit side by side: keep the chosen one in view.
    requestAnimationFrame(() => centerIn(tabs, tabs.querySelector<HTMLElement>('.codex-tab.on')));
    this.lock(150);
  }

  /** One Codex line: an icon, a name (or ? ? ? while unknown), a small line above the text. */
  private codexEntry(icon: string, color: string, name: string | null, text: string, letter?: string, sub?: string): HTMLElement {
    const row = el('div', `codex-entry${name === null ? ' locked' : ''}`);
    if (name !== null) setAccent(row, color);
    const c = el('canvas', 'codex-icon');
    drawIcon(c, icon, color, letter);
    const body = el('div', 'codex-body');
    body.append(el('div', 'codex-name', name ?? '? ? ?'));
    if (sub && name !== null) body.append(el('div', 'codex-sub', sub));
    body.append(el('p', 'codex-text', text));
    row.append(c, body);
    return row;
  }

  /**
   * The Emperor's Wardrobe: a large portrait in what he wears, then every look
   * (feat looks once earned, the rest for gold) and every cloak trail. Buying
   * puts it on; tapping an owned one wears it.
   */
  showWardrobe(
    save: SaveData,
    h: {
      onLook: (id: LookId) => void;
      onBuyLook: (id: LookId) => void;
      onTrail: (id: TrailId) => void;
      onBuyTrail: (id: TrailId) => void;
      onBack: () => void;
    },
    relock = true,
  ): void {
    const p = this.open('wardrobe', !relock);
    p.append(el('div', 'board-kicker', 'The Emperor’s'), el('h2', 'board-title', 'Wardrobe'));
    const balance = el('p', 'gold-line');
    const coin = el('canvas', 'gold-icon');
    drawIcon(coin, 'coin', '#ffd27a');
    balance.append(coin, el('span', '', `${gold(save.gold)} gold`));
    const stage = el('div', 'wardrobe-stage');
    const emblem = el('canvas', 'emblem');
    drawEmblem(emblem, 150);
    const portrait = el('canvas', 'hero-portrait wardrobe-portrait');
    drawEmperor(portrait, save.evolution, 230, undefined, save.look);
    const worn = TRAILS.find((t) => t.id === save.trail) ?? TRAILS[0];
    const motes = el('canvas', 'wardrobe-trail');
    drawTrailSwatch(motes, worn.id, worn.css, 150, 30);
    stage.append(emblem, portrait, motes);
    p.append(balance, stage, el('h3', 'section-title', 'Looks'));
    const looks = el('div', 'look-row wardrobe-looks');
    for (const l of LOOKS) {
      const owned = save.looks.includes(l.id);
      const wearing = save.look === l.id;
      const forSale = !owned && l.price !== undefined;
      const b = button(`look-chip${wearing ? ' on' : ''}${owned ? '' : ' locked'}${forSale ? ' for-sale' : ''}`, '');
      const c = el('canvas', 'look-portrait');
      drawEmperor(c, 0, 64, undefined, l.id);
      const feat = FEATS.find((f) => f.look === l.id);
      const sub = owned ? (wearing ? 'Wearing' : 'Wear') : forSale ? `${gold(l.price ?? 0)} gold` : (feat?.name ?? '');
      b.append(c, el('span', 'look-name', owned || forSale ? l.name : '? ? ?'), el('span', 'look-sub', sub));
      b.setAttribute('aria-pressed', String(wearing));
      if (owned) b.addEventListener('click', this.guard(() => h.onLook(l.id)));
      else if (forSale && save.gold >= (l.price ?? Infinity)) {
        b.setAttribute('aria-label', `Buy the ${l.name} look for ${l.price} gold`);
        b.addEventListener('click', this.guard(() => h.onBuyLook(l.id)));
      } else b.disabled = true;
      looks.append(b);
    }
    p.append(looks, el('h3', 'section-title', 'Trails'), el('p', 'archives-hint', 'Motes the Emperor leaves behind as he moves. They change nothing in a fight.'));
    const trails = el('div', 'trail-row');
    for (const t of TRAILS) {
      const owned = save.trails.includes(t.id);
      const wearing = save.trail === t.id;
      const b = button(`trail-chip${wearing ? ' on' : ''}${owned ? '' : ' locked'}`, '');
      const c = el('canvas', 'trail-swatch');
      drawTrailSwatch(c, t.id, t.css);
      b.append(c, el('span', 'look-name', t.name), el('span', 'look-sub', owned ? (wearing ? 'Wearing' : 'Wear') : `${gold(t.price)} gold`));
      b.setAttribute('aria-pressed', String(wearing));
      if (owned) b.addEventListener('click', this.guard(() => h.onTrail(t.id)));
      else if (save.gold >= t.price) {
        b.setAttribute('aria-label', `Buy the ${t.name} trail for ${t.price} gold`);
        b.addEventListener('click', this.guard(() => h.onBuyTrail(t.id)));
      } else b.disabled = true;
      trails.append(b);
    }
    const back = button('btn primary', 'Back');
    back.addEventListener('click', this.guard(h.onBack));
    p.append(trails, back);
    if (relock) this.lock(150);
  }

  /**
   * Feats: each with what it pays and how close you are (lifetime counts, or
   * the best single run), grouped. The looks they open are worn from the Wardrobe.
   */
  showFeats(save: SaveData, h: { onWardrobe: () => void; onBack: () => void }, relock = true): void {
    const p = this.open('feats', !relock);
    const toWardrobe = button('btn small feats-wardrobe', 'Looks: open the Wardrobe');
    toWardrobe.addEventListener('click', this.guard(h.onWardrobe));
    p.append(
      el('div', 'board-kicker', 'The Emperor’s'),
      el('h2', 'board-title', 'Feats'),
      el('p', 'archives-hint', `Earned ${save.feats.length} of ${FEATS.length}. Each pays once.`),
      toWardrobe,
    );
    for (const group of ['Journey', 'Stages', 'One run', 'Modes'] as const) {
      p.append(el('h3', 'section-title', group));
      const list = el('div', 'feat-list');
      for (const f of FEATS.filter((x) => x.group === group)) {
        const done = save.feats.includes(f.id);
        const row = el('div', `feat${done ? ' done' : ''}`);
        const icon = el('canvas', 'feat-icon');
        drawIcon(icon, 'crown', done ? '#ffcb5c' : '#5a5e6c');
        const body = el('div', 'feat-body');
        const reward = [
          `+${gold(f.gold)} gold`,
          f.look ? `${LOOKS.find((l) => l.id === f.look)?.name ?? f.look} look` : '',
          f.relic ? (RELIC_BY_ID.get(f.relic)?.name ?? f.relic) : '',
        ]
          .filter(Boolean)
          .join(' · ');
        body.append(el('div', 'feat-name', f.name), el('div', 'feat-desc', f.desc), el('div', 'feat-reward', reward));
        if (!done && f.goal > 1) {
          const v = Math.min(f.goal, featProgress(save, f));
          const bar = el('div', 'feat-bar');
          const fill = el('div', 'feat-fill');
          fill.style.transform = `scaleX(${v / f.goal})`;
          bar.append(fill);
          body.append(bar, el('div', 'feat-count', `${gold(v)} / ${gold(f.goal)}`));
        }
        row.append(icon, body);
        list.append(row);
      }
      p.append(list);
    }
    const back = button('btn primary', 'Back');
    back.addEventListener('click', this.guard(h.onBack));
    p.append(back);
    if (relock) this.lock(150);
  }

  /** Every chapter: the told ones to reread, the rest as a hint of what unlocks them. */
  showChronicle(save: SaveData, h: { onOpen: (id: string) => void; onBack: () => void }): void {
    const p = this.open('chronicle');
    p.append(el('div', 'board-kicker', 'The Emperor'), el('h2', 'board-title', 'Chronicle'));
    const list = el('div', 'chapters');
    for (const c of CHAPTERS) {
      if (chapterUnlocked(save, c)) {
        const b = button('chapter', '');
        b.append(el('span', 'chapter-kicker', c.kicker), el('span', 'chapter-title', c.title));
        b.addEventListener('click', this.guard(() => h.onOpen(c.id)));
        list.append(b);
      } else {
        const d = el('div', 'chapter locked');
        d.append(el('span', 'chapter-kicker', c.kicker), el('span', 'chapter-title', '? ? ?'), el('span', 'chapter-hint', c.hint));
        list.append(d);
      }
    }
    const back = button('btn primary', 'Back');
    back.addEventListener('click', this.guard(h.onBack));
    p.append(list, back);
    this.lock(150);
  }

  /** Today's Daily Trial on the title: its rules, and how today has gone so far. */
  private dailyCard(save: SaveData, spec: DailySpec, onDaily: () => void): HTMLButtonElement {
    const b = button('daily-btn daily-card', '');
    const icon = el('canvas', 'daily-icon');
    drawIcon(icon, 'calendar', '#ff8b9b');
    const text = el('span', 'daily-text');
    text.append(el('span', 'daily-title', 'Daily Trial'), el('span', 'btn-note', spec.mods.map((m) => DAILY_MOD_BY_ID.get(m)?.name ?? m).join(' + ')));
    const today = save.daily.date === spec.date ? save.daily : null;
    const status = today?.cleared ? 'Cleared' : today && today.best > 0 ? formatTime(today.best) : 'New';
    b.append(icon, text, el('span', `daily-status${today?.cleared ? ' done' : ''}`, status));
    b.addEventListener('click', this.guard(onDaily));
    return b;
  }

  /** An icon and a label in the title's bottom row. */
  private navButton(cls: string, glyph: string, label: string, color: string, onTap: () => void): HTMLButtonElement {
    const b = button(`nav-btn ${cls}`, '');
    const icon = el('canvas', 'nav-icon');
    drawIcon(icon, glyph, color);
    b.append(icon, el('span', 'nav-label', label));
    b.addEventListener('click', this.guard(onTap));
    return b;
  }

  /** The six bankai as medallions, lit once taken back in any run, and what all six unlock. */
  private collection(save: SaveData): HTMLElement {
    const box = el('div', 'collection');
    const medals = el('div', 'medals');
    for (const id of BANKAI_IDS) {
      const got = save.taken.includes(id);
      const m = el('span', got ? 'medal got' : 'medal');
      m.style.setProperty('--c', `#${(BANKAI_BY_ID.get(id)?.aura ?? 0xffcb5c).toString(16).padStart(6, '0')}`);
      m.title = POWER_BY_ID.get(id)?.name ?? id;
      medals.append(m);
    }
    const n = BANKAI_IDS.filter((id) => save.taken.includes(id)).length;
    const text = almightyUnlocked(save)
      ? 'Every bankai taken back: A · The Almighty now awakens at three powers taken back in a run.'
      : `Bankai taken back ${n}/${BANKAI_IDS.length}. A · The Almighty awakens at five powers taken back in a run; take back all six bankai and it wakes at three.`;
    box.append(medals, el('p', 'collection-text', text));
    return box;
  }

  /**
   * One painted card per stage; locked ones say what opens them. Under a
   * cleared stage, Standard, Endless or Boss Rush. The card underneath names
   * the pick, with the trial stepper beside the name, and describes it.
   */
  private stagePicker(save: SaveData, onStage: (id: StageId) => void, onMode: () => void): HTMLElement {
    const box = el('div', 'stages');
    const row = el('div', `stage-row n${STAGES.length}${STAGES.length > 3 ? ' strip' : ''}`);
    row.setAttribute('role', 'radiogroup');
    row.setAttribute('aria-label', 'Stage');
    const info = el('div', 'stage-info');
    const infoHead = el('div', 'stage-info-head');
    const infoName = el('strong', 'stage-info-name', '');
    const infoText = el('p', 'stage-info-text', '');
    const buttons: HTMLButtonElement[] = [];
    const modes = el('div', 'mode-row');
    const seg = el('div', 'mode-seg');
    seg.setAttribute('role', 'radiogroup');
    seg.setAttribute('aria-label', 'Mode');
    const standard = button('mode-opt mode-standard', 'Standard');
    const endless = button('mode-opt mode-endless', 'Endless');
    const rush = button('mode-opt mode-rush', 'Boss Rush');
    for (const b of [standard, endless, rush]) b.setAttribute('role', 'radio');
    seg.append(standard, endless, rush);
    const trialBox = el('div', 'mode-trial');
    const prev = button('mode-step mode-prev', '‹');
    prev.setAttribute('aria-label', 'Easier trial');
    const label = el('span', 'mode-label', '');
    const next = button('mode-step mode-next', '›');
    next.setAttribute('aria-label', 'Harder trial');
    trialBox.append(prev, label, next);
    modes.append(seg);
    infoHead.append(infoName, trialBox);
    info.append(infoHead, infoText);
    let current: StageId = 'hueco';
    const select = (id: StageId): void => {
      current = id;
      STAGES.forEach((def, k) => {
        const on = def.id === id;
        buttons[k].classList.toggle('on', on);
        buttons[k].setAttribute('aria-checked', String(on));
      });
      const def = stageById(id);
      const rec = save.stages[id];
      const open = trialsOpen(save, id);
      const trial = Math.min(save.trial, open);
      const isRush = save.rush && rushOpen(save, id);
      const isEndless = !isRush && save.endless && endlessOpen(save, id);
      modes.classList.toggle('hidden', !rec.cleared);
      trialBox.classList.toggle('hidden', !rec.cleared);
      label.textContent = TRIAL_NAMES[trial];
      prev.disabled = trial <= 0;
      next.disabled = trial >= open || trial >= MAX_TRIAL;
      standard.classList.toggle('on', !isEndless && !isRush);
      standard.setAttribute('aria-checked', String(!isEndless && !isRush));
      endless.classList.toggle('on', isEndless);
      endless.setAttribute('aria-checked', String(isEndless));
      rush.classList.toggle('on', isRush);
      rush.setAttribute('aria-checked', String(isRush));
      const best = rec.best > 0 ? ` Best ${formatTime(rec.best)}${rec.cleared ? ' · cleared' : ''}.` : '';
      const extra = [
        trialBlurb(trial),
        isEndless ? `Endless: the night never ends.${rec.endless > 0 ? ` Best ${formatTime(rec.endless)}.` : ''}` : '',
        isRush ? `Boss Rush: every boss, back to back.${rec.rush > 0 ? ` Fastest clear ${formatTime(rec.rush)}.` : ''}` : '',
      ]
        .filter(Boolean)
        .join(' ');
      infoName.textContent = def.name;
      infoText.textContent = extra ? extra : `${def.blurb}${best}`;
    };
    prev.addEventListener('click', () => {
      save.trial = Math.max(0, Math.min(save.trial, trialsOpen(save, current)) - 1);
      onMode();
      select(current);
    });
    next.addEventListener('click', () => {
      save.trial = Math.min(trialsOpen(save, current), Math.min(save.trial, trialsOpen(save, current)) + 1);
      onMode();
      select(current);
    });
    for (const [b, mode] of [
      [standard, 'standard'],
      [endless, 'endless'],
      [rush, 'rush'],
    ] as const) {
      b.addEventListener('click', () => {
        save.endless = mode === 'endless';
        save.rush = mode === 'rush';
        onMode();
        select(current);
      });
    }
    for (const def of STAGES) {
      const open = stageUnlocked(save, def.id);
      const rec = save.stages[def.id];
      const b = button(`stage-btn${open ? (rec.cleared ? ' cleared' : '') : ' locked'}`, '');
      b.setAttribute('role', 'radio');
      const vista = el('canvas', 'stage-vista');
      drawVista(vista, def.id);
      const text = el('span', 'stage-label');
      const sub = !open ? 'Locked' : rec.cleared ? 'Cleared' : rec.best > 0 ? `Best ${formatTime(rec.best)}` : '20:00';
      text.append(el('span', 'stage-name', def.name), el('span', 'stage-sub', sub));
      b.append(vista, text);
      if (!open) {
        const lock = el('canvas', 'stage-lock');
        drawIcon(lock, 'lock', '#d8dce8');
        b.append(lock);
      }
      b.addEventListener('click', () => {
        if (!open) {
          this.toast(`Clear ${stageById(def.unlockedBy).name} to unlock ${def.name}`);
          return;
        }
        select(def.id);
        onStage(def.id);
      });
      buttons.push(b);
      row.append(b);
    }
    select(stageUnlocked(save, save.stage) ? save.stage : 'hueco');
    box.append(row, modes, info);
    // With more stages than fit, the strip scrolls; bring the chosen one into view once it is on screen.
    requestAnimationFrame(() => {
      const k = STAGES.findIndex((d) => d.id === current);
      const card = buttons[k];
      if (!card || row.scrollWidth <= row.clientWidth) return;
      const a = card.getBoundingClientRect();
      const r = row.getBoundingClientRect();
      if (a.left < r.left || a.right > r.right) row.scrollLeft += a.left - r.left - 8;
    });
    return box;
  }

  private open(cls: string, keepScroll = false): HTMLElement {
    this.screen.replaceChildren();
    // "scroll" exempts the screen from the page-wide touchmove block, so tall screens can scroll on iOS.
    this.screen.className = `screen scroll ${cls}`;
    // The screen element is reused: a new screen opens at its top, one redrawn after a purchase keeps the player's place.
    if (!keepScroll) this.screen.scrollTop = 0;
    const panel = el('div', 'panel');
    this.screen.append(panel);
    return panel;
  }

  /** Ignore taps for a moment after a board opens, so a thumb that was steering cannot pick a card by accident. */
  private lock(ms = 380): void {
    this.unlockAt = performance.now() + ms;
    this.screen.classList.add('locked');
    window.setTimeout(() => this.screen.classList.remove('locked'), ms);
  }

  private guard(fn: () => void): () => void {
    return () => {
      if (performance.now() < this.unlockAt) return;
      fn();
    };
  }

  private card(spec: CardSpec, onPick: () => void): HTMLButtonElement {
    const b = button(`card${spec.tone ? ` tone-${spec.tone}` : ''}`, '');
    setAccent(b, spec.color);
    const icon = el('canvas', 'card-icon');
    drawIcon(icon, spec.icon, spec.color, spec.letter);
    const body = el('div', 'card-body');
    const head = el('div', 'card-head');
    const titles = el('div', 'card-titles');
    titles.append(el('span', 'card-title', spec.title));
    if (spec.credit) titles.append(el('span', 'card-credit', spec.credit));
    head.append(titles);
    if (spec.badge) head.append(el('span', 'card-badge', spec.badge));
    body.append(head, el('p', 'card-desc', spec.desc));
    if (spec.cost) body.append(el('p', 'card-cost', spec.cost));
    if (spec.pips) {
      const [lv, max] = spec.pips;
      const pips = el('div', 'card-pips');
      pips.setAttribute('aria-label', `Level ${lv} of ${max}`);
      for (let k = 0; k < max; k++) pips.append(el('span', k < lv ? 'pip on' : 'pip'));
      body.append(pips);
    }
    if (spec.note) body.append(el('div', 'card-note', spec.note));
    b.append(icon, body);
    b.addEventListener('click', this.guard(onPick));
    return b;
  }

  private resonanceChip(id: string): HTMLElement {
    const def = RESONANCE_BY_ID.get(id);
    const chip = this.chip('star', def?.color ?? '#ffffff', def?.name ?? id, def?.letters);
    chip.classList.add('resonance');
    return chip;
  }

  private chip(icon: string, color: string, text: string, letter?: string, bankai = false): HTMLElement {
    const chip = el('div', bankai ? 'chip bankai' : 'chip');
    const c = el('canvas', 'chip-icon');
    drawIcon(c, icon, color, letter);
    chip.append(c, el('span', 'chip-text', text));
    return chip;
  }

  private toggles(settings: Settings, onToggle: (k: Toggle) => boolean): HTMLElement {
    const box = el('div', 'toggles');
    const items: [Toggle, string][] = [
      ['sound', 'Sound'],
      ['music', 'Music'],
      ['numbers', 'Damage numbers'],
      ['shake', 'Screen shake'],
      ['tips', 'First-time tips'],
    ];
    for (const [key, label] of items) {
      const b = button('toggle', '');
      b.setAttribute('role', 'switch');
      const sync = (on: boolean): void => {
        b.setAttribute('aria-checked', String(on));
        b.classList.toggle('on', on);
      };
      b.append(el('span', 'toggle-label', label), el('span', 'toggle-switch'));
      sync(settings[key]);
      b.addEventListener('click', () => sync(onToggle(key)));
      box.append(b);
    }
    return box;
  }

  private offerSpec(o: Offer, owned: ReadonlySet<string>): CardSpec {
    switch (o.kind) {
      case 'power-new': {
        const d = POWER_BY_ID.get(o.id);
        return d ? { ...powerCard(d, 'New', d.desc), pips: [1, d.maxLevel], note: resonanceNote(d.id, owned) } : unknownCard;
      }
      case 'power-up': {
        const d = POWER_BY_ID.get(o.id);
        if (!d) return unknownCard;
        const label = d.group === 'bankai' ? `Bankai ${o.to - 1} → ${o.to}` : `Lv ${o.to - 1} → ${o.to}`;
        return { ...powerCard(d, label, d.levels[o.to - 2]?.desc ?? d.desc), pips: [o.to, d.maxLevel], note: resonanceNote(d.id, owned) };
      }
      case 'power-attr': {
        const d = POWER_BY_ID.get(o.id);
        if (!d) return unknownCard;
        const names = (d.attributes ?? []).map((a) => a.name).join(' · ');
        return { ...powerCard(d, 'Lv 7 · Awaken', `Choose one: ${names}.`, 'attr'), pips: [d.maxLevel, d.maxLevel], note: resonanceNote(d.id, owned) };
      }
      case 'passive': {
        const d = PASSIVE_BY_ID.get(o.id);
        return d
          ? {
              icon: d.icon,
              color: d.color,
              letter: d.letter,
              credit: d.credit,
              title: d.name,
              badge: o.to === 1 ? 'New' : `Lv ${o.to - 1} → ${o.to}`,
              desc: d.desc,
              pips: [o.to, d.max],
            }
          : unknownCard;
      }
      case 'resonance': {
        const r = RESONANCE_BY_ID.get(o.id);
        if (!r) return unknownCard;
        return { icon: 'star', color: r.color, letter: r.letters, title: r.name, credit: partsLine(r), badge: r.c ? 'Resonance of three' : 'Resonance', desc: r.desc, tone: 'resonance' };
      }
      case 'heal':
        return { icon: 'heart', color: '#ff6b8a', title: 'Restore', desc: 'Recover 30% of your health.' };
      case 'gold':
        return { icon: 'coin', color: '#ffd27a', title: 'Gold', desc: '+25 gold.' };
    }
  }
}

const unknownCard: CardSpec = { icon: 'star', color: '#ffffff', title: '?', desc: '' };

/** "Resonates with The Heat" on a card whose power has its resonance partners in your build already. */
function resonanceNote(id: string, owned: ReadonlySet<string>): string | undefined {
  for (const r of RESONANCES) {
    const parts = resonanceParts(r);
    if (!parts.includes(id)) continue;
    const others = parts.filter((p) => p !== id);
    if (others.every((p) => owned.has(p))) return `Resonates with ${others.map((p) => POWER_BY_ID.get(p)?.name ?? p).join(' and ')}`;
  }
  return undefined;
}

/** "The Explode + The Thunderbolt + The Glutton". */
function partsLine(r: ResonanceDef): string {
  return resonanceParts(r)
    .map((p) => POWER_BY_ID.get(p)?.name ?? p)
    .join(' + ');
}

/** Who a bankai belonged to and who stole it, for the results screen and banners. */
export function bankaiLine(id: string): string {
  const info = BANKAI_BY_ID.get(id);
  return info ? `${info.owner}'s bankai, stolen by ${info.thief}` : '';
}
