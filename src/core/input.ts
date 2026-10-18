const MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);

/**
 * One-thumb floating joystick: touch anywhere, drag to move. The base follows
 * a finger that drags past the rim, so reversing direction is instant. WASD
 * and the arrow keys work too, for testing on a desktop.
 */
export class Input {
  /** Movement vector, length 0..1. */
  mx = 0;
  my = 0;
  /** Joystick state in CSS pixels, for drawing it. */
  stickActive = false;
  baseX = 0;
  baseY = 0;
  knobX = 0;
  knobY = 0;
  readonly radius = 56;
  /** Off while a menu is open, so a lifting thumb never starts a drag. */
  enabled = true;

  private pointer = -1;
  private readonly keys = new Set<string>();
  private readonly el: HTMLElement;

  constructor(el: HTMLElement) {
    this.el = el;
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onUp);
    el.addEventListener('lostpointercapture', this.onUp);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.release();
    });
  }

  release(): void {
    this.pointer = -1;
    this.stickActive = false;
    this.updateVector();
  }

  private readonly onDown = (e: PointerEvent): void => {
    if (!this.enabled || this.pointer !== -1) return;
    this.pointer = e.pointerId;
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      // Older Safari can refuse capture; the move/up listeners still work without it.
    }
    this.baseX = this.knobX = e.clientX;
    this.baseY = this.knobY = e.clientY;
    this.stickActive = true;
    this.updateVector();
    e.preventDefault();
  };

  private readonly onMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointer) return;
    this.knobX = e.clientX;
    this.knobY = e.clientY;
    const dx = this.knobX - this.baseX;
    const dy = this.knobY - this.baseY;
    const len = Math.hypot(dx, dy);
    if (len > this.radius) {
      const k = (len - this.radius) / len;
      this.baseX += dx * k;
      this.baseY += dy * k;
    }
    this.updateVector();
  };

  private readonly onUp = (e: PointerEvent): void => {
    if (e.pointerId === this.pointer) this.release();
  };

  private readonly onKey = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase();
    if (!MOVE_KEYS.has(k)) return;
    if (e.type === 'keydown') this.keys.add(k);
    else this.keys.delete(k);
    this.updateVector();
    e.preventDefault();
  };

  private updateVector(): void {
    let x = 0;
    let y = 0;
    if (this.keys.size > 0) {
      if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
      if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
      if (this.keys.has('w') || this.keys.has('arrowup')) y -= 1;
      if (this.keys.has('s') || this.keys.has('arrowdown')) y += 1;
      const len = Math.hypot(x, y);
      if (len > 0) {
        x /= len;
        y /= len;
      }
    } else if (this.stickActive) {
      const dx = this.knobX - this.baseX;
      const dy = this.knobY - this.baseY;
      const len = Math.hypot(dx, dy);
      const dead = 4;
      if (len > dead) {
        // Full speed at under half the rim, so small thumb movements still run.
        const mag = Math.min(1, (len - dead) / (this.radius * 0.45));
        x = (dx / len) * mag;
        y = (dy / len) * mag;
      }
    }
    this.mx = x;
    this.my = y;
  }
}
