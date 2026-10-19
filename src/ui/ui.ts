import { formatTime } from '../core/math';
import { UPGRADES } from '../data/archives';
import { BANKAI_BY_ID, BANKAI_IDS } from '../data/bankai';
import { DAILY_CLEAR_GOLD, DAILY_MOD_BY_ID, DAILY_SURVIVE_GOLD, DAILY_SURVIVE_TIME, dayLabel, type DailySpec } from '../data/daily';
import { PASSIVE_BY_ID } from '../data/passives';
import { POWER_BY_ID, STARTING_POWER, type PowerDef } from '../data/powers';
import type { Rarity, RelicDef } from '../data/relics';
import { RESONANCE_BY_ID, RESONANCES } from '../data/resonances';
import { PACT_BY_ID, type PactDef } from '../data/shrines';
import { MAX_TRIAL, STAGES, stageById, TRIAL_NAMES, trialBlurb, type StageId } from '../data/stages';
import { CHAPTERS, type Chapter } from '../data/story';
import type { ChestKind, Offer } from '../game/offers';
import type { Banner, World } from '../game/world';
import { drawEmperor, drawSprite } from '../render/atlas';
import { enemySpriteName } from '../render/names';
import { nextCost, startOptions, upgradeLevel } from '../save/archives';
import { almightyUnlocked, endlessOpen, stageUnlocked, trialsOpen, type DailyRecord, type SaveData, type Settings } from '../save/save';
import { chapterUnlocked } from '../save/story';
import { drawEmblem, drawIcon } from './icons';
import { shareRun } from './share';
import { drawVista } from './vistas';

/**
 * Everything outside the game world is plain DOM with an external stylesheet:
 * no inline styles or scripts, so it works under a strict CSP. Dynamic values
 * go through the CSSOM (element.style), which CSP allows.
 */

export type Toggle = keyof Settings;

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

const RARITY_COLOR: Readonly<Record<Rarity, string>> = { common: '#d8d2c4', rare: '#7cc4ff', legendary: '#ffcb5c' };
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
  /** Attacks awakened for the first time (names): new starting options. */
  starts: string[];
  /** Story chapters this run unlocked (titles), told next. */
  chapters: string[];
  /** A Daily Trial: the best shown is today's, plus any bonus gold the run earned. */
  daily: boolean;
  dailyBonus: number;
  /** "Daily Trial · October 19 · Frail + Giants", or "" for any other run. */
  dailyLine: string;
  damage: DamageRow[];
  /** Pacts made at shrines, by id. */
  pacts: string[];
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
  private readonly bannerEl: HTMLElement;
  private readonly screen: HTMLElement;
  private readonly rotateEl: HTMLElement;
  private readonly debugEl: HTMLElement;
  private toastTimer = 0;
  private bannerTimer = 0;
  private unlockAt = 0;
  private last = UI.fresh();

  private static fresh() {
    return { level: -1, kills: -1, sec: -1, xp: -1, boss: -2, bossUid: -1, streak: -1, tier: -1, build: -1, danger: false };
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
    left.append(this.lvl, this.kills, this.rush);
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
    this.bannerEl = el('div', 'banner');
    this.bannerEl.setAttribute('aria-live', 'polite');
    this.screen = el('div', 'screen hidden');
    this.rotateEl = el('div', 'rotate hidden');
    this.rotateEl.append(el('div', 'rotate-icon'), el('p', 'rotate-text', 'Turn your phone upright to play'));
    this.debugEl = el('div', 'debug hidden');
    root.append(vignette, this.hud, this.toastEl, this.bannerEl, this.screen, this.rotateEl, this.debugEl);
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
    if (w.boss.active && w.boss.uid !== this.last.bossUid) {
      this.last.bossUid = w.boss.uid;
      this.bossName.textContent = w.boss.name;
      this.bossSub.textContent = w.boss.sub;
      drawSprite(this.bossPortrait, enemySpriteName(w.boss.type, w.boss.variant), 40);
    }
  }

  /** The powers you hold, as small icons with their level; awakened ones ringed in gold. */
  private drawTray(w: World): void {
    const items: HTMLElement[] = [];
    for (const ps of w.powers) {
      const d = ps.def;
      const kind = d.group === 'bankai' ? ' bankai' : d.group === 'ultimate' ? ' ultimate' : '';
      const item = el('span', `tray-item${kind}${ps.attr ? ' awake' : ''}`);
      let icon = this.trayIcons.get(d.id);
      if (!icon) {
        icon = el('canvas', 'tray-icon');
        drawIcon(icon, d.icon, d.color, d.letter);
        this.trayIcons.set(d.id, icon);
      }
      item.append(icon, el('span', 'tray-lv', d.group === 'ultimate' ? 'A' : String(ps.level)));
      items.push(item);
    }
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

  /** A title card that slides across the middle of the screen; the game keeps running. */
  banner(b: Banner): void {
    const KICKER: Record<Banner['kind'], string> = {
      bankai: 'Bankai',
      almighty: 'A · Awakened',
      resonance: 'Resonance',
      event: 'Event',
      evolve: 'The Emperor',
      boss: 'Boss',
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
      onSettings: () => void;
      onStage: (id: StageId) => void;
      onMode: () => void;
      onDaily: () => void;
      daily: DailySpec;
      installHint: boolean;
    },
  ): void {
    const p = this.open('title');
    // Gold at the top, always in view.
    const top = el('div', 'topbar');
    const purse = el('span', 'topbar-gold');
    const coin = el('canvas', 'topbar-icon');
    drawIcon(coin, 'coin', '#ffd27a');
    purse.append(coin, el('span', '', gold(save.gold)));
    top.append(purse);
    // The Emperor, painted from his own sprite in front of the reishi star.
    const hero = el('div', 'title-hero');
    const emblem = el('canvas', 'emblem');
    drawEmblem(emblem, 140);
    const portrait = el('canvas', 'hero-portrait');
    drawEmperor(portrait, save.evolution, 208);
    hero.append(emblem, portrait);
    const logo = el('div', 'logo');
    logo.append(el('div', 'logo-top', 'QUINCY'), el('div', 'logo-bottom', 'SURVIVAL'));
    const play = button('btn primary', 'Play');
    play.addEventListener('click', this.guard(h.onPlay));
    const nav = el('nav', 'title-nav');
    nav.setAttribute('aria-label', 'More');
    nav.append(
      this.navButton('archives-btn', 'vault', 'Archives', '#ffd27a', h.onArchives),
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
    h: { onToggle: (k: Toggle) => boolean; onBack: () => void; onExport: () => void; onImport: () => void },
  ): void {
    const p = this.open('settings');
    p.append(el('h2', 'board-title', 'Settings'), this.toggles(settings, h.onToggle));
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
  ): void {
    const p = this.open('board');
    p.append(el('div', 'board-kicker', 'Auswählen'), el('h2', 'board-title', `Level ${level}`));
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
   * The Wandenreich Archives: gold balance, permanent upgrades with their next
   * level's price, and the choice of starting Schrift. Redrawn after each
   * purchase without the tap lock, so buying several in a row feels instant.
   */
  showArchives(
    save: SaveData,
    h: { onBuy: (id: string) => void; onStart: (id: string) => void; onBack: () => void },
    relock = true,
  ): void {
    const p = this.open('archives');
    p.append(el('div', 'board-kicker', 'Wandenreich'), el('h2', 'board-title', 'Archives'));
    const balance = el('p', 'gold-line');
    const coin = el('canvas', 'gold-icon');
    drawIcon(coin, 'coin', '#ffd27a');
    balance.append(coin, el('span', '', `${gold(save.gold)} gold`));
    p.append(balance, el('p', 'archives-hint', 'Every run pays gold. What you learn here stays with you.'));
    const list = el('div', 'upgrades');
    for (const u of UPGRADES) {
      const level = upgradeLevel(save, u.id);
      const max = u.costs.length;
      const cost = nextCost(save, u.id);
      const row = el('div', 'upgrade');
      row.style.setProperty('--accent', u.color);
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
    const back = button('btn primary', 'Back');
    back.addEventListener('click', this.guard(h.onBack));
    p.append(back);
    if (relock) this.lock(150);
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

  showChest(kind: ChestKind, relics: readonly RelicDef[], onPick: (id: string | null) => void): void {
    const p = this.open(`board chest-${kind}`);
    p.append(
      el('div', 'board-kicker', kind === 'black' ? 'Boss reward' : 'Treasure'),
      el('h2', 'board-title', kind === 'black' ? 'Black chest' : 'Relic chest'),
    );
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
    for (const r of w.relics) build.append(this.chip(r.icon, RARITY_COLOR[r.rarity], r.name));
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
    drawEmperor(portrait, r.evolution, 132);
    head.append(portrait);
    p.append(head, el('div', 'board-kicker', kicker), el('h2', 'board-title', r.victory ? 'Victory' : 'Fallen'));
    if (r.unlocked) p.append(el('p', 'unlock-note', `New stage unlocked: ${r.unlocked}`));
    if (r.almighty) p.append(el('p', 'unlock-note', 'Every bankai taken back. A · The Almighty is unlocked: it awakens once three Schrift reach Lv 7.'));
    if (r.starts.length > 0) p.append(el('p', 'unlock-note', `New starting Schrift in the Archives: ${r.starts.join(', ')}`));
    if (r.chapters.length > 0) p.append(el('p', 'unlock-note', `New in the Chronicle: ${r.chapters.join(', ')}`));
    if (r.dailyBonus > 0) p.append(el('p', 'unlock-note', `Daily Trial bonus: +${r.dailyBonus} gold`));
    const [best, beaten] = r.daily ? ["Today's best", 'New daily best'] : r.endless ? ['Endless best', 'New Endless best'] : ['Best', 'New best'];
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
      stat(r.newBest ? beaten : best, formatTime(r.bestTime)),
    );
    p.append(stats);
    if (r.goldEarned > 0) {
      const line = el('p', 'gold-line');
      const coin = el('canvas', 'gold-icon');
      drawIcon(coin, 'coin', '#ffd27a');
      line.append(coin, el('span', '', `+${gold(r.goldEarned)} gold · ${gold(r.goldTotal)} to spend in the Archives`));
      p.append(line);
    }
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
  showShrine(pacts: readonly PactDef[], onPick: (id: string | null) => void): void {
    const p = this.open('board shrine');
    p.append(el('div', 'board-kicker', 'Quincy Shrine'), el('h2', 'board-title', 'Make a pact'));
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
      row.style.setProperty('--accent', r.color);
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
      ? 'A · The Almighty is yours: it awakens once three Schrift reach Lv 7.'
      : `Bankai taken back ${n}/${BANKAI_IDS.length}. Take back all six to unlock A · The Almighty.`;
    box.append(medals, el('p', 'collection-text', text));
    return box;
  }

  /**
   * One painted card per stage; locked ones say what opens them. Under a
   * cleared stage, Standard or Endless and the trial stepper. The line
   * underneath describes the pick.
   */
  private stagePicker(save: SaveData, onStage: (id: StageId) => void, onMode: () => void): HTMLElement {
    const box = el('div', 'stages');
    const row = el('div', `stage-row n${STAGES.length}`);
    row.setAttribute('role', 'radiogroup');
    row.setAttribute('aria-label', 'Stage');
    const info = el('p', 'stage-info');
    const buttons: HTMLButtonElement[] = [];
    const modes = el('div', 'mode-row');
    const seg = el('div', 'mode-seg');
    seg.setAttribute('role', 'radiogroup');
    seg.setAttribute('aria-label', 'Mode');
    const standard = button('mode-opt mode-standard', 'Standard');
    const endless = button('mode-opt mode-endless', 'Endless');
    for (const b of [standard, endless]) b.setAttribute('role', 'radio');
    seg.append(standard, endless);
    const trialBox = el('div', 'mode-trial');
    const prev = button('mode-step mode-prev', '‹');
    prev.setAttribute('aria-label', 'Easier trial');
    const label = el('span', 'mode-label', '');
    const next = button('mode-step mode-next', '›');
    next.setAttribute('aria-label', 'Harder trial');
    trialBox.append(prev, label, next);
    modes.append(seg, trialBox);
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
      const isEndless = save.endless && endlessOpen(save, id);
      modes.classList.toggle('hidden', !rec.cleared);
      label.textContent = TRIAL_NAMES[trial];
      prev.disabled = trial <= 0;
      next.disabled = trial >= open || trial >= MAX_TRIAL;
      standard.classList.toggle('on', !isEndless);
      standard.setAttribute('aria-checked', String(!isEndless));
      endless.classList.toggle('on', isEndless);
      endless.setAttribute('aria-checked', String(isEndless));
      const best = rec.best > 0 ? ` Best ${formatTime(rec.best)}${rec.cleared ? ' · cleared' : ''}.` : '';
      const extra = [trialBlurb(trial), isEndless ? `Endless: the night never ends.${rec.endless > 0 ? ` Best ${formatTime(rec.endless)}.` : ''}` : ''].filter(Boolean).join(' ');
      info.textContent = extra ? extra : `${def.blurb}${best}`;
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
    for (const [b, on] of [
      [standard, false],
      [endless, true],
    ] as const) {
      b.addEventListener('click', () => {
        save.endless = on;
        onMode();
        select(current);
      });
    }
    for (const def of STAGES) {
      const open = stageUnlocked(save, def.id);
      const rec = save.stages[def.id];
      const b = button(`stage-btn${open ? '' : ' locked'}`, '');
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
    return box;
  }

  private open(cls: string): HTMLElement {
    this.screen.replaceChildren();
    // "scroll" exempts the screen from the page-wide touchmove block, so tall screens can scroll on iOS.
    this.screen.className = `screen scroll ${cls}`;
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
    b.style.setProperty('--accent', spec.color);
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
        const a = POWER_BY_ID.get(r.a)?.name ?? r.a;
        const b = POWER_BY_ID.get(r.b)?.name ?? r.b;
        return { icon: 'star', color: r.color, letter: r.letters, title: r.name, credit: `${a} + ${b}`, badge: 'Resonance', desc: r.desc, tone: 'resonance' };
      }
      case 'heal':
        return { icon: 'heart', color: '#ff6b8a', title: 'Restore', desc: 'Recover 30% of your health.' };
      case 'gold':
        return { icon: 'coin', color: '#ffd27a', title: 'Gold', desc: '+25 gold.' };
    }
  }
}

const unknownCard: CardSpec = { icon: 'star', color: '#ffffff', title: '?', desc: '' };

/** "Resonates with The Heat" on a card whose power has its resonance partner in your build already. */
function resonanceNote(id: string, owned: ReadonlySet<string>): string | undefined {
  const r = RESONANCES.find((q) => q.a === id || q.b === id);
  if (!r) return undefined;
  const partner = r.a === id ? r.b : r.a;
  return owned.has(partner) ? `Resonates with ${POWER_BY_ID.get(partner)?.name ?? partner}` : undefined;
}

/** Who a bankai belonged to and who stole it, for the results screen and banners. */
export function bankaiLine(id: string): string {
  const info = BANKAI_BY_ID.get(id);
  return info ? `${info.owner}'s bankai, stolen by ${info.thief}` : '';
}
