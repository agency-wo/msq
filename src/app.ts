import type { TrackId } from './audio/compose';
import { Music } from './audio/music';
import { Sfx } from './audio/sfx';
import { Input } from './core/input';
import { FixedLoop } from './core/loop';
import { POWER_BY_ID, STARTING_POWER } from './data/powers';
import { STAGE_BY_ID, stageById, TRIAL_NAMES, type StageId } from './data/stages';
import { CHAPTER_BY_ID, type Chapter } from './data/story';
import { dailyFor, dailyLine, dateKey, type DailySpec } from './data/daily';
import type { TipId } from './data/tips';
import type { Offer } from './game/offers';
import { runGold } from './game/rewards';
import { RUSH_TIERS, World } from './game/world';
import { installGestureGuards, isIOS, isPhoneLandscape, isStandalone } from './platform/pwa';
import { Renderer } from './render/renderer';
import {
  affordable,
  buyArmory,
  buyUpgrade,
  buyVerse,
  goldMul,
  metaChoices,
  metaMods,
  metaRerolls,
  metaRevives,
  metaStartLevels,
  setStart,
  setStartRelic,
} from './save/archives';
import { buyLook, buyTrail, wardrobeAffordable, wearLook, wearTrail } from './save/wardrobe';
import {
  almightyUnlocked,
  endlessOpen,
  exportCode,
  importCode,
  loadSave,
  recordDaily,
  recordRun,
  rushOpen,
  type SaveData,
  stageUnlocked,
  trialsOpen,
  writeSave,
} from './save/save';
import { chaptersAfter, chaptersBefore, markChapter } from './save/story';
import { evaluateFeats, type RunFacts } from './save/feats';
import { resetTips, takeTip } from './save/tips';
import { type ArchivesTab, type CodexTab, damageRows, type Toggle, UI } from './ui/ui';

type State =
  | 'title'
  | 'settings'
  | 'archives'
  | 'chronicle'
  | 'codex'
  | 'feats'
  | 'wardrobe'
  | 'daily'
  | 'story'
  | 'playing'
  | 'paused'
  | 'levelup'
  | 'chest'
  | 'shrine'
  | 'over';

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
  /** When the next first-time tip may show, and whether an event has happened this run. */
  private tipUntil = 0;
  private sawEvent = false;
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
    this.renderer.setLook(this.save.look);
    this.renderer.setTrail(this.save.trail);
    this.music.play('title');
    this.music.duck(false);
    this.ui.showTitle(this.save, {
      onPlay: () => this.startRun(),
      onArchives: () => this.showArchives(),
      onChronicle: () => this.showChronicle(),
      onCodex: () => this.showCodex('schrift'),
      onFeats: () => this.showFeats(),
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
      archivesDot: affordable(this.save) !== null,
      onWardrobe: () => this.showWardrobe(),
      wardrobeDot: wardrobeAffordable(this.save),
    });
  }

  /** The Emperor's Wardrobe: buy and wear looks and trails. Every change is saved at once. */
  private showWardrobe(relock = true, back: () => void = () => this.showTitle()): void {
    this.state = 'wardrobe';
    const done = (ok: boolean, sound: Parameters<Sfx['play']>[0]): void => {
      if (!ok) return;
      writeSave(this.save);
      this.renderer.setLook(this.save.look);
      this.renderer.setTrail(this.save.trail);
      this.sfx.play(sound);
      this.showWardrobe(false, back);
    };
    this.ui.showWardrobe(
      this.save,
      {
        onLook: (id) => done(wearLook(this.save, id), 'blade'),
        onBuyLook: (id) => done(buyLook(this.save, id), 'chest'),
        onTrail: (id) => done(wearTrail(this.save, id), 'blade'),
        onBuyTrail: (id) => done(buyTrail(this.save, id), 'chest'),
        onBack: back,
      },
      relock,
    );
  }

  /** The Wandenreich Archives: training, the Armory and the Kaiser Gesang. Every change is saved at once. */
  private showArchives(relock = true, tab: ArchivesTab = 'training'): void {
    this.state = 'archives';
    const done = (ok: boolean, sound: Parameters<Sfx['play']>[0]): void => {
      if (!ok) return;
      writeSave(this.save);
      this.sfx.play(sound);
      this.showArchives(false, tab);
    };
    this.ui.showArchives(
      this.save,
      {
        onTab: (t) => this.showArchives(false, t),
        onBuy: (id) => done(buyUpgrade(this.save, id), 'chest'),
        onStart: (id) => done(setStart(this.save, id), 'blade'),
        onArmory: (id) => done(buyArmory(this.save, id), 'chest'),
        onEquip: (id) => done(setStartRelic(this.save, id), 'blade'),
        onVerse: () => done(buyVerse(this.save), 'level'),
        onBack: () => this.showTitle(),
      },
      relock,
      tab,
    );
  }

  /** Feats: what each pays, how close you are, and the looks they open. */
  private showFeats(relock = true): void {
    this.state = 'feats';
    this.ui.showFeats(
      this.save,
      {
        onWardrobe: () => this.showWardrobe(true, () => this.showFeats()),
        onBack: () => this.showTitle(),
      },
      relock,
    );
  }

  private showCodex(tab: CodexTab): void {
    this.state = 'codex';
    this.ui.showCodex(this.save, tab, { onTab: (t) => this.showCodex(t), onBack: () => this.showTitle() });
  }

  private todaysDaily(): DailySpec {
    const open = (id: StageId): boolean => stageUnlocked(this.save, id);
    return dailyFor(dateKey(), open('seireitei'), open('palace'), open('silbern'), open('wahrwelt'));
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

  /** Boss Rush for this run: ?rush (testing), or the title's pick once the stage is cleared. */
  private runRush(stage: StageId): boolean {
    if (this.params.has('rush')) return true;
    return this.save.rush && rushOpen(this.save, stage);
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
      onResetTips: () => {
        resetTips(this.save);
        writeSave(this.save);
      },
    });
  }

  /** Testing switches skip the story and the tips. */
  private get testing(): boolean {
    const p = this.params;
    return p.has('play') || p.has('stress') || p.has('god');
  }

  /** A first-time tip, or null (seen already, tips off, or a testing run). */
  private tipOnce(id: TipId): string | null {
    if (this.testing) return null;
    const text = takeTip(this.save, id);
    if (text) writeSave(this.save);
    return text;
  }

  /** In-run tips for what is happening now, one at a time so they never pile up. */
  private liveTips(w: World): void {
    const now = performance.now();
    if (now < this.tipUntil || this.testing || !this.save.settings.tips) return;
    for (const id of LIVE_TIPS) {
      if (this.save.tips.includes(id) || !this.tipDue(id, w)) continue;
      const text = this.tipOnce(id);
      if (!text) continue;
      this.ui.tip(text);
      this.tipUntil = now + 6500;
      return;
    }
  }

  private tipDue(id: TipId, w: World): boolean {
    switch (id) {
      case 'move':
        return w.t > 1;
      case 'boss':
        return w.boss.active;
      case 'event':
        return this.sawEvent;
      case 'rush':
        return w.rushTier > 0;
      case 'evolve':
        return w.evolution > 0;
      case 'fragment':
        return w.powers.some((ps) => ps.def.group === 'fragment');
      case 'seal':
        return w.sealT > 0;
      default:
        return false;
    }
  }

  private startRun(storyTold = false): void {
    this.sfx.unlock();
    const p = this.params;
    const daily = this.daily;
    const stage = daily ? daily.stage : this.runStage();
    // Story chapters that belong before this run (the prologue, the invasion); testing switches skip them.
    const before = storyTold || this.testing ? [] : chaptersBefore(this.save, stage);
    if (before.length > 0) {
      this.halt('story');
      this.tellChapters(before, () => this.startRun(true));
      return;
    }
    this.renderer.setStage(stage);
    this.renderer.setLook(this.save.look);
    this.renderer.setTrail(this.save.trail);
    this.sawEvent = false;
    this.world = new World({
      stage,
      trial: daily ? 0 : this.runTrial(stage),
      endless: daily ? false : !this.runRush(stage) && this.runEndless(stage),
      bossRush: daily ? false : this.runRush(stage),
      mods: daily?.mods,
      relicsOpen: this.save.relicsOpen,
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
      startLevels: metaStartLevels(this.save),
      choices: metaChoices(this.save),
      // The Armory's relic comes along on every run but the Daily Trial, which is the same for everyone.
      relic: daily ? undefined : (this.save.startRelic ?? undefined),
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
    if (w.pendingShrine) {
      this.openShrine();
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
        const b = w.banners[w.banners.length - 1];
        if (b.kind === 'event') this.sawEvent = true;
        this.ui.banner(b);
        w.banners.length = 0;
      }
      if (this.state === 'playing') this.liveTips(w);
      // During a run (boards and pause included) the music follows the fight; results and story cards keep their own.
      const inRun = this.state === 'playing' || this.state === 'paused' || this.state === 'levelup' || this.state === 'chest' || this.state === 'shrine';
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
    const id = w.stage.id;
    if (!w.boss.active) {
      return id === 'seireitei' ? 'seireitei' : id === 'silbern' ? 'silbern' : id === 'palace' ? 'palace' : id === 'wahrwelt' ? 'wahrwelt' : 'hueco';
    }
    if (w.boss.final) return 'final';
    return id === 'seireitei' || id === 'silbern' ? 'bossSei' : id === 'palace' || id === 'wahrwelt' ? 'bossPalace' : 'boss';
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
    const offers = w.offers();
    const tip = this.tipOnce(offers.some((o) => o.kind === 'resonance') ? 'resonance' : offers.some((o) => o.kind === 'power-attr') ? 'awaken' : 'levelup');
    this.ui.showLevelUp(
      level,
      offers,
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
      new Set(w.powers.map((ps) => ps.def.id)),
      tip,
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
    this.ui.showChest(
      kind,
      w.relicChoices(kind),
      (id) => {
        if (id) w.addRelic(id);
        else w.gold += 50;
        w.pendingChests.shift();
        this.continueFlow();
      },
      this.tipOnce('chest'),
    );
  }

  private continueFlow(): void {
    const w = this.world;
    if (!w) return;
    if (w.pendingLevelUps > 0) this.openLevelUp();
    else if (w.pendingChests.length > 0) this.openChest();
    else if (w.pendingShrine) this.openShrine();
    else this.resume();
  }

  /** A Quincy shrine: three pacts, or walk away. */
  private openShrine(): void {
    const w = this.world;
    if (!w) return;
    this.halt('shrine');
    this.ui.showShrine(
      w.shrineChoices(),
      (id) => {
        w.pendingShrine = false;
        if (id) w.takePact(id);
        this.continueFlow();
      },
      this.tipOnce('shrine'),
    );
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
          goldMul: goldMul(this.save) * w.goldBonus,
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
          evolution: w.evolution,
          bossRush: w.bossRush,
          codex: {
            powers: w.powers.map((ps) => ps.def.id),
            relics: w.relics.map((r) => r.id),
            resonances: [...w.resonances],
            kills: Object.fromEntries(w.killsBy),
          },
        });
    const daily = w.god || !this.daily ? null : recordDaily(this.save, this.daily.date, w.t, victory);
    const feats = w.god ? [] : evaluateFeats(this.save, runFacts(w, victory, !!this.daily));
    if (!w.god) writeSave(this.save);
    this.pendingChapters = w.god ? [] : chaptersAfter(this.save);
    this.ui.showHud(false);
    this.ui.showResults(
      {
        stage: w.stage.id,
        stageName: w.stage.name,
        evolution: w.evolution,
        mode: this.daily
          ? 'Daily Trial'
          : [w.trial > 0 ? TRIAL_NAMES[w.trial] : '', w.endless ? 'Endless' : '', w.bossRush ? 'Boss Rush' : ''].filter(Boolean).join(' · '),
        rush: w.bossRush,
        daily: !!this.daily,
        dailyBonus: daily?.bonus ?? 0,
        dailyLine: this.daily ? dailyLine(this.daily) : '',
        damage: damageRows(w),
        pacts: [...w.pacts],
        feats: feats.map((f) => ({ name: f.name, gold: f.gold, look: f.look ?? null, relic: f.relic ?? null })),
        look: this.save.look,
        endless: w.endless,
        unlocked: record.unlocked ? stageById(record.unlocked).name : null,
        almighty: record.almighty,
        goldEarned: earned,
        goldTotal: this.save.gold,
        afford: w.god ? null : affordable(this.save),
        starts: record.starts.map((id) => POWER_BY_ID.get(id)?.name ?? id),
        chapters: this.pendingChapters.map((c) => c.title),
        victory,
        quit,
        time: w.t,
        level: w.level,
        kills: w.kills,
        bestTime: this.daily
          ? this.save.daily.best
          : w.bossRush
            ? this.save.stages[w.stage.id].rush
            : w.endless
              ? this.save.stages[w.stage.id].endless
              : this.save.stages[w.stage.id].best,
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
    if (state === 'paused' || state === 'levelup' || state === 'chest' || state === 'shrine') this.music.duck(true);
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
      // Back from the background: iOS may have interrupted the audio. Try to wake it (the next tap will, if this cannot).
      else this.sfx.unlock();
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

/** The tips that show while a run goes on, in the order they are checked. */
const LIVE_TIPS: readonly TipId[] = ['move', 'boss', 'event', 'rush', 'evolve', 'fragment', 'seal'];

/** What a finished run did, for the feats. */
function runFacts(w: World, cleared: boolean, daily: boolean): RunFacts {
  const groups = w.powers.map((ps) => ps.def.group);
  let damage = 0;
  for (const d of w.dmgBy) damage += d;
  return {
    stage: w.stage.id,
    cleared,
    endless: w.endless,
    bossRush: w.bossRush,
    daily,
    time: w.t,
    level: w.level,
    kills: w.kills,
    bankai: groups.filter((g) => g === 'bankai').length,
    awakened: w.powers.filter((ps) => ps.attr !== null).length,
    resonances: w.resonances.size,
    rushTier: RUSH_TIERS.filter((n) => w.bestStreak >= n).length,
    almighty: groups.includes('ultimate'),
    fragments: groups.filter((g) => g === 'fragment').length,
    pacts: w.pacts.size,
    damage,
    evolution: w.evolution,
  };
}
