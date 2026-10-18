import { formatTime } from '../core/math';
import { PASSIVE_BY_ID } from '../data/passives';
import { POWER_BY_ID, type PowerDef } from '../data/powers';
import type { Rarity, RelicDef } from '../data/relics';
import type { ChestKind, Offer } from '../game/offers';
import type { World } from '../game/world';
import type { SaveData, Settings } from '../save/save';
import { drawIcon } from './icons';

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

const RARITY_COLOR: Readonly<Record<Rarity, string>> = { common: '#c9d1e0', rare: '#6fb6ff', legendary: '#ffb84d' };
const RARITY_LABEL: Readonly<Record<Rarity, string>> = { common: 'Common', rare: 'Rare', legendary: 'Legendary' };

interface CardSpec {
  icon: string;
  color: string;
  title: string;
  badge?: string;
  desc: string;
  tone?: Rarity | 'attr';
}

export interface ResultSummary {
  victory: boolean;
  quit: boolean;
  time: number;
  level: number;
  kills: number;
  bestTime: number;
  newBest: boolean;
  powers: { name: string; icon: string; color: string; level: number; attr: string | null }[];
}

export class UI {
  onPause: () => void = () => undefined;
  private readonly hud: HTMLElement;
  private readonly xpFill: HTMLElement;
  private readonly lvl: HTMLElement;
  private readonly kills: HTMLElement;
  private readonly timer: HTMLElement;
  private readonly bossBar: HTMLElement;
  private readonly bossFill: HTMLElement;
  private readonly toastEl: HTMLElement;
  private readonly screen: HTMLElement;
  private readonly rotateEl: HTMLElement;
  private readonly debugEl: HTMLElement;
  private toastTimer = 0;
  private unlockAt = 0;
  private last = { level: -1, kills: -1, sec: -1, xp: -1, boss: -2 };

  constructor(root: HTMLElement) {
    this.hud = el('div', 'hud hidden');
    const xp = el('div', 'xpbar');
    this.xpFill = el('div', 'xpfill');
    xp.append(this.xpFill);
    const row = el('div', 'hud-row');
    const left = el('div', 'hud-left');
    this.lvl = el('span', 'hud-level', 'Lv 1');
    this.kills = el('span', 'hud-kills', '0');
    left.append(this.lvl, this.kills);
    this.timer = el('div', 'hud-timer', '0:00');
    const pause = button('icon-btn', '');
    pause.setAttribute('aria-label', 'Pause');
    pause.append(el('span', 'pause-glyph'));
    pause.addEventListener('click', () => this.onPause());
    row.append(left, this.timer, pause);
    this.bossBar = el('div', 'bossbar hidden');
    const track = el('div', 'boss-track');
    this.bossFill = el('div', 'boss-fill');
    track.append(this.bossFill);
    this.bossBar.append(el('div', 'boss-name', 'Warden'), track);
    this.hud.append(xp, row, this.bossBar);
    this.toastEl = el('div', 'toast');
    this.toastEl.setAttribute('role', 'status');
    this.screen = el('div', 'screen hidden');
    this.rotateEl = el('div', 'rotate hidden');
    this.rotateEl.append(el('div', 'rotate-icon'), el('p', 'rotate-text', 'Turn your phone upright to play'));
    this.debugEl = el('div', 'debug hidden');
    root.append(this.hud, this.toastEl, this.screen, this.rotateEl, this.debugEl);
  }

  // ------------------------------------------------------------- HUD

  showHud(show: boolean): void {
    this.hud.classList.toggle('hidden', !show);
    if (show) this.last = { level: -1, kills: -1, sec: -1, xp: -1, boss: -2 };
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
      this.lvl.textContent = `Lv ${w.level}`;
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
  }

  toast(text: string, kind: 'boss' | 'info' = 'info'): void {
    this.toastEl.textContent = text;
    this.toastEl.className = `toast show ${kind}`;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toastEl.className = 'toast';
    }, kind === 'boss' ? 3000 : 2200);
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

  get screenOpen(): boolean {
    return !this.screen.classList.contains('hidden');
  }

  showTitle(save: SaveData, h: { onPlay: () => void; onSettings: () => void; installHint: boolean }): void {
    const p = this.open('title');
    const logo = el('div', 'logo');
    logo.append(el('div', 'logo-top', 'QUINCY'), el('div', 'logo-bottom', 'SURVIVAL'));
    const play = button('btn primary', 'Play');
    play.addEventListener('click', this.guard(h.onPlay));
    const settings = button('btn', 'Settings');
    settings.addEventListener('click', this.guard(h.onSettings));
    p.append(logo, el('p', 'tagline', 'Prototype 0.1 · placeholder powers'), play, settings);
    if (save.best.time > 0) p.append(el('p', 'best', `Best ${formatTime(save.best.time)} · Lv ${save.best.level}`));
    p.append(el('p', 'hint', 'Drag anywhere to move. Your powers fire on their own.'));
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

  showLevelUp(level: number, offers: readonly Offer[], onPick: (o: Offer) => void): void {
    const p = this.open('board');
    p.append(el('div', 'board-kicker', 'Level up'), el('h2', 'board-title', `Level ${level}`));
    const list = el('div', 'cards');
    for (const o of offers) list.append(this.card(this.offerSpec(o), () => onPick(o)));
    p.append(list);
    this.lock();
  }

  showAttributes(def: PowerDef, onPick: (attr: string) => void): void {
    const p = this.open('board');
    p.append(el('div', 'board-kicker', 'Awaken · Lv 7'), el('h2', 'board-title', def.name));
    const list = el('div', 'cards');
    for (const a of def.attributes) {
      list.append(this.card({ icon: def.icon, color: def.color, title: a.name, desc: a.desc, tone: 'attr' }, () => onPick(a.id)));
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
    for (const ps of w.powers) build.append(this.chip(ps.def.icon, ps.def.color, `${ps.def.name} ${ps.level}`));
    for (const r of w.relics) build.append(this.chip(r.icon, RARITY_COLOR[r.rarity], r.name));
    const resume = button('btn primary', 'Resume');
    resume.addEventListener('click', this.guard(h.onResume));
    const quit = button('btn danger', 'Quit run');
    quit.addEventListener('click', this.guard(h.onQuit));
    p.append(build, resume, this.toggles(settings, h.onToggle), quit);
    this.lock(200);
  }

  showResults(r: ResultSummary, h: { onRetry: () => void; onMenu: () => void }): void {
    const p = this.open(`results ${r.victory ? 'won' : 'lost'}`);
    const kicker = r.victory ? 'Stage cleared' : r.quit ? 'Run abandoned' : 'You fell';
    p.append(el('div', 'board-kicker', kicker), el('h2', 'board-title', r.victory ? 'Victory' : 'Fallen'));
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
      stat(r.newBest ? 'New best' : 'Best', formatTime(r.bestTime)),
    );
    p.append(stats);
    if (r.powers.length > 0) {
      const build = el('div', 'build');
      for (const pw of r.powers) build.append(this.chip(pw.icon, pw.color, `${pw.name} ${pw.level}${pw.attr ? ` · ${pw.attr}` : ''}`));
      p.append(build);
    }
    const retry = button('btn primary', 'Play again');
    retry.addEventListener('click', this.guard(h.onRetry));
    const menu = button('btn', 'Menu');
    menu.addEventListener('click', this.guard(h.onMenu));
    p.append(retry, menu);
    this.lock(700);
  }

  // --------------------------------------------------------- helpers

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
    drawIcon(icon, spec.icon, spec.color);
    const body = el('div', 'card-body');
    const head = el('div', 'card-head');
    head.append(el('span', 'card-title', spec.title));
    if (spec.badge) head.append(el('span', 'card-badge', spec.badge));
    body.append(head, el('p', 'card-desc', spec.desc));
    b.append(icon, body);
    b.addEventListener('click', this.guard(onPick));
    return b;
  }

  private chip(icon: string, color: string, text: string): HTMLElement {
    const chip = el('div', 'chip');
    const c = el('canvas', 'chip-icon');
    drawIcon(c, icon, color);
    chip.append(c, el('span', 'chip-text', text));
    return chip;
  }

  private toggles(settings: Settings, onToggle: (k: Toggle) => boolean): HTMLElement {
    const box = el('div', 'toggles');
    const items: [Toggle, string][] = [
      ['sound', 'Sound'],
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

  private offerSpec(o: Offer): CardSpec {
    switch (o.kind) {
      case 'power-new': {
        const d = POWER_BY_ID.get(o.id);
        return d ? { icon: d.icon, color: d.color, title: d.name, badge: 'New', desc: d.desc } : unknownCard;
      }
      case 'power-up': {
        const d = POWER_BY_ID.get(o.id);
        return d
          ? { icon: d.icon, color: d.color, title: d.name, badge: `Lv ${o.to - 1} → ${o.to}`, desc: d.levels[o.to - 2]?.desc ?? d.desc }
          : unknownCard;
      }
      case 'power-attr': {
        const d = POWER_BY_ID.get(o.id);
        return d
          ? { icon: d.icon, color: d.color, title: d.name, badge: 'Lv 7 · Awaken', desc: 'Pick one of three attributes that change how it works.', tone: 'attr' }
          : unknownCard;
      }
      case 'passive': {
        const d = PASSIVE_BY_ID.get(o.id);
        return d
          ? { icon: d.icon, color: d.color, title: d.name, badge: o.to === 1 ? 'New' : `Lv ${o.to - 1} → ${o.to}`, desc: d.desc }
          : unknownCard;
      }
      case 'heal':
        return { icon: 'heart', color: '#ff6b8a', title: 'Restore', desc: 'Recover 30% of your health.' };
      case 'gold':
        return { icon: 'coin', color: '#ffd27a', title: 'Gold', desc: '+25 gold.' };
    }
  }
}

const unknownCard: CardSpec = { icon: 'star', color: '#ffffff', title: '?', desc: '' };
