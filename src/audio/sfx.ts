import type { SoundName } from '../game/world';

/** Minimum seconds between two plays of the same sound, so a swarm dying is a crackle, not a roar. */
const GAP: Partial<Record<SoundName, number>> = {
  shoot: 0.07,
  hit: 0.05,
  kill: 0.045,
  orb: 0.05,
  blade: 0.3,
  pulse: 0.12,
  strike: 0.1,
  beam: 0.12,
  fire: 0.15,
  thorn: 0.2,
  gust: 0.3,
  warn: 0.25,
  blast: 0.15,
  explode: 0.08,
  bite: 0.2,
  charm: 0.2,
  punch: 0.12,
  rise: 0.25,
};

/**
 * Procedural sound effects with the Web Audio API: nothing to download.
 * iOS only allows audio after a user gesture, so `unlock()` is called from
 * the first tap; it also respects the phone's silent switch.
 */
export class Sfx {
  enabled = true;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private readonly last = new Map<SoundName, number>();
  private orbStep = 0;
  private orbAt = 0;

  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      const master = ctx.createGain();
      master.gain.value = 0.32;
      master.connect(ctx.destination);
      const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.ctx = ctx;
      this.master = master;
      this.noise = noise;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  get unlocked(): boolean {
    return this.ctx?.state === 'running';
  }

  /** The shared AudioContext (the music plays through it too), once the first tap has created it. */
  get context(): AudioContext | null {
    return this.ctx;
  }

  /** One second of white noise, for drums and breath. */
  get noiseBuffer(): AudioBuffer | null {
    return this.noise;
  }

  play(name: SoundName): void {
    const ctx = this.ctx;
    if (!this.enabled || !ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (now - (this.last.get(name) ?? -1) < (GAP[name] ?? 0.08)) return;
    this.last.set(name, now);
    switch (name) {
      case 'shoot':
        this.tone('triangle', 1250, 700, 0.06, 0.035);
        break;
      case 'blade':
        this.tone('sine', 480, 920, 0.14, 0.05);
        break;
      case 'pulse':
        this.tone('sine', 230, 110, 0.18, 0.06);
        break;
      case 'strike':
        this.burst(0.16, 0.09, 2600, 'bandpass');
        this.tone('square', 190, 60, 0.14, 0.03);
        break;
      case 'hit':
        this.tone('square', 330, 220, 0.03, 0.015);
        break;
      case 'kill':
        this.tone('triangle', 540, 250, 0.07, 0.03);
        break;
      case 'orb': {
        // Collecting in quick succession climbs the scale.
        this.orbStep = now - this.orbAt < 0.4 ? Math.min(this.orbStep + 1, 12) : 0;
        this.orbAt = now;
        const f = 880 * Math.pow(2, this.orbStep / 12);
        this.tone('sine', f, f, 0.08, 0.03);
        break;
      }
      case 'level':
        [523, 659, 784, 1047].forEach((f, i) => this.tone('sine', f, f, 0.16, 0.07, i * 0.06));
        break;
      case 'chest':
        this.tone('triangle', 660, 990, 0.25, 0.07);
        this.tone('triangle', 990, 1320, 0.25, 0.05, 0.1);
        break;
      case 'hurt':
        this.tone('sawtooth', 160, 70, 0.18, 0.07);
        this.burst(0.12, 0.08, 600, 'lowpass');
        break;
      case 'boss':
        this.tone('sawtooth', 72, 55, 1.2, 0.1);
        this.tone('sine', 110, 88, 1.2, 0.07);
        break;
      case 'nuke':
        this.burst(0.8, 0.18, 1200, 'lowpass');
        this.tone('sine', 90, 30, 0.8, 0.14);
        break;
      case 'freeze':
        this.tone('sine', 1600, 400, 0.4, 0.05);
        break;
      case 'heal':
        this.tone('sine', 660, 990, 0.2, 0.06);
        break;
      case 'magnet':
        this.tone('sine', 300, 1200, 0.3, 0.05);
        break;
      case 'explode':
        this.burst(0.3, 0.12, 900, 'lowpass');
        this.tone('sine', 120, 40, 0.3, 0.09);
        break;
      case 'bankai':
        // A low gong under a rising shimmer.
        this.tone('sine', 98, 82, 1.6, 0.16);
        this.tone('triangle', 196, 164, 1.2, 0.06);
        [784, 988, 1175, 1568].forEach((f, i) => this.tone('sine', f, f, 0.5, 0.045, 0.1 + i * 0.08));
        break;
      case 'warn':
        this.tone('square', 880, 660, 0.12, 0.03);
        this.tone('square', 880, 660, 0.12, 0.03, 0.16);
        break;
      case 'beam':
        this.tone('sawtooth', 1800, 300, 0.22, 0.04);
        this.burst(0.15, 0.05, 4000, 'highpass');
        break;
      case 'fire':
        this.burst(0.3, 0.09, 1400, 'bandpass');
        break;
      case 'thorn':
        this.tone('triangle', 1500, 900, 0.1, 0.03);
        break;
      case 'gust':
        this.burst(0.5, 0.06, 700, 'bandpass');
        break;
      case 'shield':
        this.tone('triangle', 1200, 1600, 0.15, 0.05);
        this.tone('sine', 400, 380, 0.25, 0.04);
        break;
      case 'blast':
        this.burst(0.55, 0.16, 700, 'lowpass');
        this.tone('sine', 80, 32, 0.55, 0.13);
        break;
      case 'bite':
        // Two quick snaps.
        this.burst(0.07, 0.1, 500, 'lowpass');
        this.burst(0.07, 0.1, 380, 'lowpass');
        this.tone('square', 140, 70, 0.12, 0.04);
        break;
      case 'charm':
        this.tone('sine', 880, 1320, 0.18, 0.04);
        this.tone('sine', 1100, 1650, 0.18, 0.03, 0.07);
        break;
      case 'punch':
        this.burst(0.18, 0.14, 420, 'lowpass');
        this.tone('sine', 110, 45, 0.2, 0.12);
        break;
      case 'rise':
        this.tone('sawtooth', 70, 140, 0.35, 0.05);
        break;
      case 'almighty':
        // Time stopping: a falling drone under a high, still chord.
        this.tone('sine', 140, 46, 1.4, 0.16);
        this.tone('triangle', 70, 35, 1.4, 0.08);
        [1047, 1319, 1568].forEach((f, i) => this.tone('sine', f, f * 0.98, 1.1, 0.035, i * 0.05));
        break;
    }
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private burst(dur: number, vol: number, freq: number, type: BiquadFilterType): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || !this.noise) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }
}
