import type { TrackId } from './audio/compose';
import { Music } from './audio/music';
import { Sfx } from './audio/sfx';
import { Input } from './core/input';
import { FixedLoop } from './core/loop';
import { POWER_BY_ID, STARTING_POWER } from './data/powers';
import { STAGE_BY_ID, stageById, TRIAL_NAMES, type StageId } from './data/stages';
import { CHAPTER_BY_ID, type Chapter } from './data/story';
import { dailyFor, dateKey, type DailySpec } from './data/daily';
import type { Offer } from './game/offers';
import { runGold } from './game/rewards';
import { World } from './game/world';
import { installGestureGuards, isIOS, isPhoneLandscape, isStandalone } from './platform/pwa';
import { Renderer } from './render/renderer';
import { buyUpgrade, goldMul, metaMods, metaRerolls, metaRevives, setStart } from './save/archives';
import {
  almightyUnlocked,
  endlessOpen,
  exportCode,
  importCode,
  loadSave,
  recordDaily,
  recordRun,
  stageUnlocked,
  trialsOpen,
  writeSave,
  type SaveData,
} from './save/save';
import { chaptersAfter, chaptersBefore, markChapter } from './save/story';
import { UI, type Toggle } from './ui/ui';

type State = 'title' | 'settings' | 'archives' | 'chronicle' | 'daily' | 'story' | 'playing' | 'paused' | 'levelup' | 'chest' | 'over';

function numParam(p: URLSearchParams, key: string): number | undefined {
  const v = p.get(key);
  if (v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function listParam(p: URLSearchParams, key: string): string[] {
  const v = p.get(key);
  return v ? v.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) : [];
}

/**
 * Glue between the simulation, renderer, UI and audio, as a small state machine:
 * title -> playing <-> (level-up | chest | paused) -> results.
 *
 * URL switches for testing: ?debug (FPS overlay), ?stress=1500 (swarm + maxed
 * powers, no damage), ?god, ?seed=123, ?t=600 (start at 10:00), ?play (skip title),
 * ?give=explode7,xaxis5 (own powers), ?bankai=zanka (grant a bankai), ?bearers=tengen,gonryo,
 * ?stage=seireitei (play a stage, locked or not), ?almighty (start with A · The Almighty),
 * ?start=xaxis (open the run with that Schrift, awakened or not), ?res=firestorm,railgun (own resonances),
 * ?trial=3 and ?endless (play a trial or Endless, opened or not).
 */
export class App {
  private readonly renderer = new Renderer();
  private readonly sfx = new Sfx();
  private readonly music = new Music(this.sfx);
  private readonly params = new URLSearchParams(location.search);
  private readonly debug = this.params.has('debug');
  private save: SaveData = loadSave();
  private input!: Input;
  private ui!: UI;
  private loop!: FixedLoop;
  private world: World | null = null;
  private state: State = 'title';
  /** The Daily Trial being played, if the current run is one (Play again replays it). */
  private daily: DailySpec | null = null;
  /** Chapters a finished run unlocked, told when the player moves on from the results. */
  private pendingChapters: Chapter[] = [];
  private fps = 0;
  private fpsFrames = 0;
  private fpsTime = 0;

  async start(): Promise<void> {
    const host = document.getElementById('game');
    const uiRoot = document.getElementById('ui');
    if (!host || !uiRoot) throw new Error('Missing #game or #ui');
    await this.renderer.init(host);
    this.input = new Input(host);
    this.input.enabled = false;
    this.ui = new UI(uiRoot);
    this.ui.onPause = () => this.pause();
    this.applySettings();
    installGestureGuards();
    this.loop = new FixedLoop(
      () => this.step(),
      (alpha, frame) => this.frame(alpha, frame),
    );
    this.bindLifecycle();
    this.loop.start();
    if (this.debug) this.exposeDebug();
    if (this.params.has('stress') || this.params.has('play')) this.startRun();
    else this.showTitle();
  }

  // ------------------------------------------------------------ flow

  private showTitle(): void {
    this.halt('title');
    this.world = null;
    this.daily = null;
    this.ui.showHud(false);
    if (!stageUnlocked(this.save, this.save.stage)) this.save.stage = 'hueco';
    this.renderer.setStage(this.save.stage);
    this.music.play('title');
    this.music.duck(false);
    this.ui.showTitle(this.save, {
      onPlay: () => this.startRun(),
      onArchives: () => this.showArchives(),
      onChronicle: () => this.showChronicle(),
      onSettings: () => this.showSettings(),
      onStage: (id: StageId) => {
        this.save.stage = id;
        writeSave(this.save);
        this.renderer.setStage(id);
      },
      onMode: () => writeSave(this.save),
      onDaily: () => this.showDaily(),
      daily: this.todaysDaily(),
      installHint: isIOS() && !isStandalone(),
    });
  }

  /** The Wandenreich Archives: buy upgrades, pick the starting Schrift. Every change is saved at once. */
  private showArchives(relock = true): void {
    this.state = 'archives';
    this.ui.showArchives(
      this.save,
      {
        onBuy: (id) => {
          if (!buyUpgrade(this.save, id)) return;
          writeSave(this.save);
          this.sfx.play('chest');
          this.showArchives(false);
        },
        onStart: (id) => {
          if (!setStart(this.save, id)) return;
          writeSave(this.save);
          this.sfx.play('blade');
          this.showArchives(false);
        },
        onBack: () => this.showTitle(),
      },
      relock,
    );
  }

  private todaysDaily(): DailySpec {
    return dailyFor(dateKey(), stageUnlocked(this.save, 'seireitei'));
  }

  private showDaily(): void {
    this.state = 'daily';
    const spec = this.todaysDaily();
    this.ui.showDaily(spec, this.save.daily, {
      onBegin: () => {
        this.daily = spec;
        this.startRun();
      },
      onBack: () => this.showTitle(),
    });
  }

  private showChronicle(): void {
    this.state = 'chronicle';
    this.ui.showChronicle(this.save, {
      onOpen: (id) => {
        const c = CHAPTER_BY_ID.get(id);
        if (c) this.ui.showStory(c, () => this.showChronicle(), 'Back');
      },
      onBack: () => this.showTitle(),
    });
  }

  /** Tell these chapters one after another (marking each as told), then carry on. */
  private tellChapters(list: readonly Chapter[], then: () => void): void {
    const [first, ...rest] = list;
    if (!first) {
      then();
      return;
    }
    this.state = 'story';
    this.ui.showHud(false);
    this.ui.showStory(first, () => {
      markChapter(this.save, first.id);
      writeSave(this.save);
      this.tellChapters(rest, then);
    });
  }

  /** The trial for this run: ?trial= (testing), else the pick, capped at what the stage has opened. */
  private runTrial(stage: StageId): number {
    const forced = numParam(this.params, 'trial');
    if (forced !== undefined) return Math.max(0, Math.min(5, Math.floor(forced)));
    return Math.min(this.save.trial, trialsOpen(this.save, stage));
  }

  private runEndless(stage: StageId): boolean {
    if (this.params.has('endless')) return true;
    return this.save.endless && endlessOpen(this.save, stage);
  }

  /** ?stage= wins (testing, even if locked); otherwise the stage picked on the title screen. */
  private runStage(): StageId {
    const forced = this.params.get('stage');
    if (forced && STAGE_BY_ID.has(forced)) return forced as StageId;
    return stageUnlocked(this.save, this.save.stage) ? this.save.stage : 'hueco';
  }

  private showSettings(): void {
    this.state = 'settings';
    this.ui.showSettings(this.save.settings, {
      onToggle: this.toggle,
      onBack: () => this.showTitle(),
      onExport: () => this.exportSave(),
      onImport: () => this.importSave(),
    });
  }

  private startRun(storyTold = false): void {
    this.sfx.unlock();
    const p = this.params;
    const daily = this.daily;
    const stage = daily ? daily.stage : this.runStage();
    // Story chapters that belong before this run (the prologue, the invasion); testing switches skip them.
    const testing = p.has('play') || p.has('stress') || p.has('god');
    const before = storyTold || testing ? [] : chaptersBefore(this.save, stage);
    if (before.length > 0) {
      this.halt('story');
      this.tellChapters(before, () => this.startRun(true));
      return;
    }
    this.renderer.setStage(stage);
    this.world = new World({
      stage,
      trial: daily ? 0 : this.runTrial(stage),
      endless: daily ? false : this.runEndless(stage),
      mods: daily?.mods,
      seed: daily ? daily.seed : numParam(p, 'seed'),
      stress: numParam(p, 'stress'),
      god: p.has('god'),
      startTime: numParam(p, 't'),
      numbers: this.save.settings.numbers,
      bearers: listParam(p, 'bearers'),
      almighty: almightyUnlocked(this.save),
      meta: metaMods(this.save),
      revives: metaRevives(this.save),
      rerolls: metaRerolls(this.save),
      // The Daily Trial opens with Heilig Pfeil and today's Schrift; ?start= tries any attack (testing); otherwise the Archives' pick.
      start: daily ? STARTING_POWER : (p.get('start') ?? this.save.start),
      extra: daily?.schrift,
    });
    if (p.has('almighty')) this.world.grantAlmighty();
    // Testing: ?give=explode7,xaxis5 owns powers at those levels; ?bankai=senbonzakura,zanka grants bankai.
    for (const entry of listParam(p, 'give')) {
      const m = /^([a-z]+)(\d*)$/.exec(entry);
      if (m) this.world.give(m[1], m[2] ? Number(m[2]) : 1);
    }
    for (const id of listParam(p, 'bankai')) this.world.grantBankai(id);
    for (const id of listParam(p, 'res')) this.world.addResonance(id);
    this.world.banners.length = 0;
    this.ui.hideScreen();
    this.ui.showHud(true);
    this.resume();
  }

  private step(): boolean {
    const w = this.world;
    if (!w || this.state !== 'playing') return false;
    w.step(this.input.mx, this.input.my);
    if (w.over) {
      this.finishRun(false);
      return false;
    }
    if (w.pendingLevelUps > 0) {
      this.openLevelUp();
      return false;
    }
    if (w.pendingChests.length > 0) {
      this.openChest();
      return false;
    }
    return true;
  }

  private frame(alpha: number, frameSeconds: number): void {
    const w = this.world;
    if (w) {
      if (w.sounds.size > 0) {
        for (const s of w.sounds) this.sfx.play(s);
        w.sounds.clear();
      }
      if (w.messages.length > 0) {
        for (const m of w.messages) this.ui.toast(m.text, m.kind);
        w.messages.length = 0;
      }
      if (w.banners.length > 0) {
        // Only the latest title card is shown; they never queue up behind each other.
        this.ui.banner(w.banners[w.banners.length - 1]);
        w.banners.length = 0;
      }
      // During a run (boards and pause included) the music follows the fight; results and story cards keep their own.
      const inRun = this.state === 'playing' || this.state === 'paused' || this.state === 'levelup' || this.state === 'chest';
      if (inRun) this.music.play(this.runTrack(w));
    }
    this.renderer.render(w, alpha, this.input, performance.now() / 1000, frameSeconds);
    if (w) this.ui.updateHud(w);
    this.fpsFrames++;
    this.fpsTime += frameSeconds;
    if (this.fpsTime >= 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsTime);
      this.fpsFrames = 0;
      this.fpsTime = 0;
      if (this.debug) this.ui.setDebug(this.debugText());
    }
  }

  /** The stage's theme, its boss theme while a boss is up, the finale for the last boss. */
  private runTrack(w: World): TrackId {
    const sei = w.stage.id === 'seireitei';
    if (!w.boss.active) return sei ? 'seireitei' : 'hueco';
    if (w.boss.final) return 'final';
    return sei ? 'bossSei' : 'boss';
  }

  private openLevelUp(): void {
    const w = this.world;
    if (!w) return;
    this.halt('levelup');
    const level = w.level - w.pendingLevelUps + 1;
    // Second Auswählen: redraw the whole board, a limited number of times per run.
    const reroll =
      w.rerolls > 0
        ? {
            left: w.rerolls,
            onReroll: () => {
              w.rerolls--;
              this.sfx.play('blade');
              this.openLevelUp();
            },
          }
        : undefined;
    this.ui.showLevelUp(
      level,
      w.offers(),
      (o: Offer) => {
        if (o.kind === 'power-attr') {
          const def = POWER_BY_ID.get(o.id);
          if (!def) return;
          this.ui.showAttributes(def, (attr) => {
            w.chooseAttribute(o.id, attr);
            this.sfx.play('level');
            this.levelDone();
          });
          return;
        }
        w.applyOffer(o);
        this.levelDone();
      },
      reroll,
    );
  }

  private levelDone(): void {
    const w = this.world;
    if (!w) return;
    w.pendingLevelUps = Math.max(0, w.pendingLevelUps - 1);
    this.continueFlow();
  }

  private openChest(): void {
    const w = this.world;
    if (!w) return;
    this.halt('chest');
    const kind = w.pendingChests[0];
    this.ui.showChest(kind, w.relicChoices(kind), (id) => {
      if (id) w.addRelic(id);
      else w.gold += 50;
      w.pendingChests.shift();
      this.continueFlow();
    });
  }

  private continueFlow(): void {
    const w = this.world;
    if (!w) return;
    if (w.pendingLevelUps > 0) this.openLevelUp();
    else if (w.pendingChests.length > 0) this.openChest();
    else this.resume();
  }

  private resume(): void {
    if (!this.world) return;
    this.ui.hideScreen();
    this.state = 'playing';
    this.music.duck(false);
    this.input.enabled = true;
    this.loop.resetClock();
    this.loop.simulate = true;
    if (isPhoneLandscape()) this.pause();
  }

  private pause(): void {
    const w = this.world;
    if (!w || this.state !== 'playing') return;
    this.halt('paused');
    this.ui.showPause(w, this.save.settings, {
      onResume: () => this.resume(),
      onQuit: () => this.finishRun(true),
      onToggle: this.toggle,
    });
  }

  private finishRun(quit: boolean): void {
    const w = this.world;
    if (!w) return;
    this.halt('over');
    const victory = w.over === 'victory';
    // Test runs (god mode, stress) never touch the real save and pay nothing.
    const earned = w.god
      ? 0
      : runGold({
          stage: w.stage.id,
          time: w.t,
          level: w.level,
          bossKills: w.bossKills,
          cleared: victory,
          pickupGold: w.gold,
          goldMul: goldMul(this.save),
          trial: w.trial,
        });
    const record = w.god
      ? { newBest: false, unlocked: null, almighty: false, starts: [] as string[] }
      : recordRun(this.save, {
          stage: w.stage.id,
          time: w.t,
          level: w.level,
          kills: w.kills,
          cleared: victory,
          gold: earned,
          bankai: w.powers.filter((ps) => ps.def.group === 'bankai').map((ps) => ps.def.id),
          awakened: w.powers.filter((ps) => ps.attr !== null).map((ps) => ps.def.id),
          trial: w.trial,
          endless: w.endless,
          daily: !!this.daily,
        });
    const daily = w.god || !this.daily ? null : recordDaily(this.save, this.daily.date, w.t, victory);
    if (!w.god) writeSave(this.save);
    this.pendingChapters = w.god ? [] : chaptersAfter(this.save);
    this.ui.showHud(false);
    this.ui.showResults(
      {
        stageName: w.stage.name,
        mode: this.daily ? 'Daily Trial' : [w.trial > 0 ? TRIAL_NAMES[w.trial] : '', w.endless ? 'Endless' : ''].filter(Boolean).join(' · '),
        daily: !!this.daily,
        dailyBonus: daily?.bonus ?? 0,
        endless: w.endless,
        unlocked: record.unlocked ? stageById(record.unlocked).name : null,
        almighty: record.almighty,
        goldEarned: earned,
        goldTotal: this.save.gold,
        starts: record.starts.map((id) => POWER_BY_ID.get(id)?.name ?? id),
        chapters: this.pendingChapters.map((c) => c.title),
        victory,
        quit,
        time: w.t,
        level: w.level,
        kills: w.kills,
        bestTime: this.daily ? this.save.daily.best : w.endless ? this.save.stages[w.stage.id].endless : this.save.stages[w.stage.id].best,
        newBest: daily ? daily.newBest : record.newBest,
        resonances: [...w.resonances],
        powers: w.powers.map((ps) => ({
          name: ps.def.name,
          icon: ps.def.icon,
          color: ps.def.color,
          letter: ps.def.letter,
          level: ps.level,
          attr: ps.attr ? (ps.def.attributes?.find((a) => a.id === ps.attr)?.name ?? null) : null,
          bankai: ps.def.group === 'bankai',
        })),
      },
      {
        onRetry: () => this.afterResults(() => this.startRun()),
        onMenu: () => this.afterResults(() => this.showTitle()),
      },
    );
    this.music.duck(false);
    this.music.play(victory ? 'victory' : 'defeat');
    if (!quit) this.sfx.play(victory ? 'level' : 'boss');
  }

  /** Tell the chapters the last run unlocked, then go on. */
  private afterResults(then: () => void): void {
    const list = this.pendingChapters;
    this.pendingChapters = [];
    this.tellChapters(list, then);
  }

  /** Freeze the simulation and the joystick while a screen is up. */
  private halt(state: State): void {
    this.state = state;
    if (state === 'paused' || state === 'levelup' || state === 'chest') this.music.duck(true);
    this.loop.simulate = false;
    this.input.release();
    this.input.enabled = false;
  }

  // -------------------------------------------------------- settings

  private readonly toggle = (k: Toggle): boolean => {
    this.save.settings[k] = !this.save.settings[k];
    writeSave(this.save);
    this.applySettings();
    return this.save.settings[k];
  };

  private applySettings(): void {
    const s = this.save.settings;
    this.sfx.enabled = s.sound;
    this.music.setEnabled(s.music);
    this.renderer.shakeEnabled = s.shake;
    if (this.world) this.world.showNumbers = s.numbers;
  }

  private exportSave(): void {
    const code = exportCode(this.save);
    const fallback = (): void => {
      window.prompt('Copy your save code:', code);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(code).then(() => this.ui.toast('Save code copied'), fallback);
    } else {
      fallback();
    }
  }

  private importSave(): void {
    const code = window.prompt('Paste a save code:');
    if (!code) return;
    const data = importCode(code);
    if (!data) {
      this.ui.toast('That is not a save code');
      return;
    }
    this.save = data;
    writeSave(this.save);
    this.applySettings();
    this.ui.toast('Save loaded');
    this.showSettings();
  }

  // ------------------------------------------------------- lifecycle

  private bindLifecycle(): void {
    // iOS only starts audio inside a user gesture.
    const unlock = (): void => this.sfx.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('touchend', unlock);
    window.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause();
      this.music.setHidden(document.hidden);
      this.loop.resetClock();
    });
    window.addEventListener('pagehide', () => this.pause());
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' && e.key.toLowerCase() !== 'p') return;
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    });
    const checkRotate = (): void => {
      const sideways = isPhoneLandscape();
      this.ui.setRotate(sideways);
      if (sideways) this.pause();
    };
    window.addEventListener('resize', checkRotate);
    window.addEventListener('orientationchange', checkRotate);
    checkRotate();
  }

  // ----------------------------------------------------------- debug

  private debugText(): string {
    const w = this.world;
    const cpu = `cpu ${this.loop.cost.toFixed(1)} ms`;
    if (!w) return `${this.fps} fps · ${cpu}`;
    return `${this.fps} fps · ${cpu} · ${w.en.n} enemies · ${w.pr.n} shots · ${w.orbs.n} orbs · ${w.fx.n} fx · ${this.renderer.drawn} sprites`;
  }

  /** window.__msq, for the automated smoke test (only with ?debug). */
  private exposeDebug(): void {
    const read = {
      music: () => ({ track: this.music.track, notes: this.music.notes }),
      state: () => this.state,
      fps: () => this.fps,
      cost: () => this.loop.cost,
      drawn: () => this.renderer.drawn,
      world: () => this.world,
    };
    Object.assign(window, {
      __msq: {
        get state() {
          return read.state();
        },
        get fps() {
          return read.fps();
        },
        get cost() {
          return read.cost();
        },
        get drawn() {
          return read.drawn();
        },
        get world() {
          return read.world();
        },
        get music() {
          return read.music();
        },
        /** Click the nth visible card; returns how many cards are showing. */
        pick(index = 0): number {
          const cards = document.querySelectorAll<HTMLButtonElement>('.screen .card');
          cards[index]?.click();
          return cards.length;
        },
      },
    });
  }
}
