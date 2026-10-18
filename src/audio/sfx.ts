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
