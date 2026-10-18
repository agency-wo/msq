import { Sfx } from './audio/sfx';
import { Input } from './core/input';
import { FixedLoop } from './core/loop';
import { POWER_BY_ID } from './data/powers';
import type { Offer } from './game/offers';
import { World } from './game/world';
import { installGestureGuards, isIOS, isPhoneLandscape, isStandalone } from './platform/pwa';
import { Renderer } from './render/renderer';
import { exportCode, importCode, loadSave, recordRun, writeSave, type SaveData } from './save/save';
import { UI, type Toggle } from './ui/ui';

type State = 'title' | 'settings' | 'playing' | 'paused' | 'levelup' | 'chest' | 'over';

function numParam(p: URLSearchParams, key: string): number | undefined {
  const v = p.get(key);
  if (v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Glue between the simulation, renderer, UI and audio, as a small state machine:
 * title -> playing <-> (level-up | chest | paused) -> results.
 *
 * URL switches for testing: ?debug (FPS overlay), ?stress=1500 (swarm + maxed
 * powers, no damage), ?god, ?seed=123, ?t=600 (start at 10:00), ?play (skip title).
 */
export class App {
  private readonly renderer = new Renderer();
  private readonly sfx = new Sfx();
  private readonly params = new URLSearchParams(location.search);
  private readonly debug = this.params.has('debug');
  private save: SaveData = loadSave();
  private input!: Input;
  private ui!: UI;
  private loop!: FixedLoop;
  private world: World | null = null;
  private state: State = 'title';
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
    this.ui.showHud(false);
    this.ui.showTitle(this.save, {
      onPlay: () => this.startRun(),
      onSettings: () => this.showSettings(),
      installHint: isIOS() && !isStandalone(),
    });
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

  private startRun(): void {
    this.sfx.unlock();
    const p = this.params;
    this.world = new World({
      seed: numParam(p, 'seed'),
      stress: numParam(p, 'stress'),
      god: p.has('god'),
      startTime: numParam(p, 't'),
      numbers: this.save.settings.numbers,
    });
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

  private openLevelUp(): void {
    const w = this.world;
    if (!w) return;
    this.halt('levelup');
    const level = w.level - w.pendingLevelUps + 1;
    this.ui.showLevelUp(level, w.offers(), (o: Offer) => {
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
    });
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
    // Test runs (god mode, stress) never touch the real save.
    const newBest = w.god ? false : recordRun(this.save, { time: w.t, level: w.level, kills: w.kills, cleared: victory, gold: w.gold }).newBest;
    if (!w.god) writeSave(this.save);
    this.ui.showHud(false);
    this.ui.showResults(
      {
        victory,
        quit,
        time: w.t,
        level: w.level,
        kills: w.kills,
        bestTime: this.save.best.time,
        newBest,
        powers: w.powers.map((ps) => ({
          name: ps.def.name,
          icon: ps.def.icon,
          color: ps.def.color,
          level: ps.level,
          attr: ps.attr ? (ps.def.attributes.find((a) => a.id === ps.attr)?.name ?? null) : null,
        })),
      },
      { onRetry: () => this.startRun(), onMenu: () => this.showTitle() },
    );
    if (!quit) this.sfx.play(victory ? 'level' : 'boss');
  }

  /** Freeze the simulation and the joystick while a screen is up. */
  private halt(state: State): void {
    this.state = state;
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
