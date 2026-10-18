import { formatTime } from '../core/math';
import { UPGRADES } from '../data/archives';
import { BANKAI_BY_ID, BANKAI_IDS } from '../data/bankai';
import { PASSIVE_BY_ID } from '../data/passives';
import { POWER_BY_ID, type PowerDef } from '../data/powers';
import type { Rarity, RelicDef } from '../data/relics';
import { RESONANCE_BY_ID } from '../data/resonances';
import { STAGES, stageById, type StageId } from '../data/stages';
import { CHAPTERS, type Chapter } from '../data/story';
import type { ChestKind, Offer } from '../game/offers';
import type { Banner, World } from '../game/world';
import { nextCost, startOptions, upgradeLevel } from '../save/archives';
import { almightyUnlocked, stageUnlocked, type SaveData, type Settings } from '../save/save';
import { chapterUnlocked } from '../save/story';
import { drawEmblem, drawIcon } from './icons';

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
  tone?: Rarity | 'attr' | 'bankai' | 'resonance';
}

export interface ResultSummary {
  stageName: string;
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
  private readonly timer: HTMLElement;
  private readonly bossBar: HTMLElement;
  private readonly bossName: HTMLElement;
  private readonly bossFill: HTMLElement;
  private readonly toastEl: HTMLElement;
  private readonly bannerEl: HTMLElement;
  private readonly screen: HTMLElement;
  private readonly rotateEl: HTMLElement;
  private readonly debugEl: HTMLElement;
  private toastTimer = 0;
  private bannerTimer = 0;
  private unlockAt = 0;
  private last = { level: -1, kills: -1, sec: -1, xp: -1, boss: -2, bossName: '' };

  constructor(root: HTMLElement) {
    const vignette = el('div', 'vignette');
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
    this.bossName = el('div', 'boss-name', '');
    const track = el('div', 'boss-track');
    this.bossFill = el('div', 'boss-fill');
    track.append(this.bossFill);
    this.bossBar.append(this.bossName, track);
    this.hud.append(xp, row, this.bossBar);
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
    if (show) this.last = { level: -1, kills: -1, sec: -1, xp: -1, boss: -2, bossName: '' };
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
    if (w.boss.active && w.boss.name !== this.last.bossName) {
      this.last.bossName = w.boss.name;
      this.bossName.textContent = w.boss.name;
    }
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
    const kicker = b.kind === 'bankai' ? 'Bankai' : b.kind === 'almighty' ? 'A · Awakened' : b.kind === 'resonance' ? 'Resonance' : 'Boss';
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
      installHint: boolean;
    },
  ): void {
    const p = this.open('title');
    const emblem = el('canvas', 'emblem');
    drawEmblem(emblem, 84);
    const logo = el('div', 'logo');
    logo.append(el('div', 'logo-top', 'QUINCY'), el('div', 'logo-bottom', 'SURVIVAL'));
    const play = button('btn primary', 'Play');
    play.addEventListener('click', this.guard(h.onPlay));
    const archives = button('btn archives-btn', '');
    archives.append(el('span', '', 'Archives'), el('span', 'btn-note', `${gold(save.gold)} gold`));
    archives.addEventListener('click', this.guard(h.onArchives));
    const row = el('div', 'row-btns');
    const chronicle = button('btn', 'Chronicle');
    chronicle.addEventListener('click', this.guard(h.onChronicle));
    const settings = button('btn', 'Settings');
    settings.addEventListener('click', this.guard(h.onSettings));
    row.append(chronicle, settings);
    p.append(
      emblem,
      logo,
      el('p', 'tagline', 'The Emperor takes back what he gave.'),
      this.stagePicker(save, h.onStage),
      play,
      archives,
      row,
      this.collection(save),
    );
    p.append(el('p', 'hint', 'Drag anywhere to move. Your powers fire on their own. Each stage lasts 20 minutes.'));
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

  showLevelUp(level: number, offers: readonly Offer[], onPick: (o: Offer) => void, reroll?: { left: number; onReroll: () => void }): void {
    const p = this.open('board');
    p.append(el('div', 'board-kicker', 'Auswählen'), el('h2', 'board-title', `Level ${level}`));
    const list = el('div', 'cards');
    for (const o of offers) list.append(this.card(this.offerSpec(o), () => onPick(o)));
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
    const resume = button('btn primary', 'Resume');
    resume.addEventListener('click', this.guard(h.onResume));
    const quit = button('btn danger', 'Quit run');
    quit.addEventListener('click', this.guard(h.onQuit));
    p.append(build, resume, this.toggles(settings, h.onToggle), quit);
    this.lock(200);
  }

  showResults(r: ResultSummary, h: { onRetry: () => void; onMenu: () => void }): void {
    const p = this.open(`results ${r.victory ? 'won' : 'lost'}`);
    const kicker = r.victory ? `${r.stageName} cleared` : r.quit ? 'Run abandoned' : `Fallen in ${r.stageName}`;
    p.append(el('div', 'board-kicker', kicker), el('h2', 'board-title', r.victory ? 'Victory' : 'Fallen'));
    if (r.unlocked) p.append(el('p', 'unlock-note', `New stage unlocked: ${r.unlocked}`));
    if (r.almighty) p.append(el('p', 'unlock-note', 'Every bankai taken back. A · The Almighty is unlocked: it awakens once three Schrift reach Lv 7.'));
    if (r.starts.length > 0) p.append(el('p', 'unlock-note', `New starting Schrift in the Archives: ${r.starts.join(', ')}`));
    if (r.chapters.length > 0) p.append(el('p', 'unlock-note', `New in the Chronicle: ${r.chapters.join(', ')}`));
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
    if (r.goldEarned > 0) {
      const line = el('p', 'gold-line');
      const coin = el('canvas', 'gold-icon');
      drawIcon(coin, 'coin', '#ffd27a');
      line.append(coin, el('span', '', `+${gold(r.goldEarned)} gold · ${gold(r.goldTotal)} to spend in the Archives`));
      p.append(line);
    }
    if (r.powers.length > 0) {
      const build = el('div', 'build');
      for (const pw of r.powers) {
        build.append(this.chip(pw.icon, pw.color, `${pw.name} ${pw.level}${pw.attr ? ` · ${pw.attr}` : ''}`, pw.letter, pw.bankai));
      }
      for (const id of r.resonances) build.append(this.resonanceChip(id));
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

  /** One button per stage; locked ones say what opens them. The line underneath describes the pick. */
  private stagePicker(save: SaveData, onStage: (id: StageId) => void): HTMLElement {
    const box = el('div', 'stages');
    const row = el('div', 'stage-row');
    row.setAttribute('role', 'radiogroup');
    row.setAttribute('aria-label', 'Stage');
    const info = el('p', 'stage-info');
    const buttons: HTMLButtonElement[] = [];
    const select = (id: StageId): void => {
      STAGES.forEach((def, k) => {
        const on = def.id === id;
        buttons[k].classList.toggle('on', on);
        buttons[k].setAttribute('aria-checked', String(on));
      });
      const def = stageById(id);
      const rec = save.stages[id];
      const best = rec.best > 0 ? ` Best ${formatTime(rec.best)}${rec.cleared ? ' · cleared' : ''}.` : '';
      info.textContent = `${def.blurb}${best}`;
    };
    for (const def of STAGES) {
      const open = stageUnlocked(save, def.id);
      const b = button(`stage-btn${open ? '' : ' locked'}`, '');
      b.setAttribute('role', 'radio');
      b.append(el('span', 'stage-name', def.name), el('span', 'stage-sub', open ? (save.stages[def.id].cleared ? 'Cleared' : '20:00') : 'Locked'));
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
    box.append(row, info);
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

  private offerSpec(o: Offer): CardSpec {
    switch (o.kind) {
      case 'power-new': {
        const d = POWER_BY_ID.get(o.id);
        return d ? powerCard(d, 'New', d.desc) : unknownCard;
      }
      case 'power-up': {
        const d = POWER_BY_ID.get(o.id);
        if (!d) return unknownCard;
        const label = d.group === 'bankai' ? `Bankai ${o.to - 1} → ${o.to}` : `Lv ${o.to - 1} → ${o.to}`;
        return powerCard(d, label, d.levels[o.to - 2]?.desc ?? d.desc);
      }
      case 'power-attr': {
        const d = POWER_BY_ID.get(o.id);
        return d ? powerCard(d, 'Lv 7 · Awaken', 'Pick one of three attributes that change how it works.', 'attr') : unknownCard;
      }
      case 'passive': {
        const d = PASSIVE_BY_ID.get(o.id);
        return d
          ? { icon: d.icon, color: d.color, letter: d.letter, credit: d.credit, title: d.name, badge: o.to === 1 ? 'New' : `Lv ${o.to - 1} → ${o.to}`, desc: d.desc }
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

/** Who a bankai belonged to and who stole it, for the results screen and banners. */
export function bankaiLine(id: string): string {
  const info = BANKAI_BY_ID.get(id);
  return info ? `${info.owner}'s bankai, stolen by ${info.thief}` : '';
}
