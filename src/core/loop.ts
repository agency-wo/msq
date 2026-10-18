import { DT } from '../config';

/**
 * Fixed-timestep loop. The simulation always advances in 1/60 s steps, so a
 * 120 Hz iPhone and a 60 Hz one play at the same speed; rendering gets the
 * leftover fraction of a step to interpolate positions smoothly.
 */
export class FixedLoop {
  /** While false the simulation is frozen (menus, level-up board) but frames still render. */
  simulate = false;
  /** Smoothed milliseconds of CPU per frame spent in step + render (the budget at 60 Hz is 16.7). */
  cost = 0;
  private acc = 0;
  private last = -1;
  private handle = 0;
  private readonly step: () => boolean;
  private readonly render: (alpha: number, frameSeconds: number) => void;

  /** `step` returns false to stop stepping for the rest of this frame (e.g. a level-up just opened). */
  constructor(step: () => boolean, render: (alpha: number, frameSeconds: number) => void) {
    this.step = step;
    this.render = render;
  }

  start(): void {
    const tick = (now: number): void => {
      this.handle = requestAnimationFrame(tick);
      const started = performance.now();
      if (this.last < 0) this.last = now;
      // A long gap (tab switch, slow frame) is capped so the game never fast-forwards.
      const frame = Math.min(0.25, (now - this.last) / 1000);
      this.last = now;
      if (this.simulate) {
        this.acc += frame;
        let steps = 0;
        while (this.acc >= DT) {
          this.acc -= DT;
          if (!this.step() || ++steps >= 4) {
            this.acc = 0;
            break;
          }
        }
      } else {
        this.acc = 0;
      }
      this.render(this.simulate ? this.acc / DT : 1, frame);
      this.cost = this.cost * 0.9 + (performance.now() - started) * 0.1;
    };
    this.handle = requestAnimationFrame(tick);
  }

  stop(): void {
    cancelAnimationFrame(this.handle);
  }

  /** Forget elapsed time, e.g. when the app comes back from the background. */
  resetClock(): void {
    this.last = -1;
    this.acc = 0;
  }
}
