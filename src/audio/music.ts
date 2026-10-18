import { STEPS_PER_BAR, TRACKS, type NoteEvent, type Track, type TrackId } from './compose';
import type { Sfx } from './sfx';

/** Seconds of notes queued ahead of the audio clock, and how often the queue is topped up. */
const LOOKAHEAD = 0.25;
const TICK_MS = 50;
const VOLUME = 0.55;
const DUCKED = 0.35;
const FADE = 0.7;

function freq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

interface Playing {
  track: Track;
  bus: GainNode;
  /** Steps played since the track started. */
  step: number;
  /** Audio-clock time of the next step. */
  nextTime: number;
  barIndex: number;
  events: NoteEvent[];
}

/**
 * Procedural music with the Web Audio API: the tracks in compose.ts played by
 * small synthesized instruments, scheduled a quarter second ahead of the
 * audio clock so timing stays steady whatever the game is doing. Shares the
 * sound effects' AudioContext, so the same first tap unlocks it on iOS.
 */
export class Music {
  /** Notes played so far, for the debug overlay and the smoke test. */
  notes = 0;
  private enabled = true;
  private hidden = false;
  private ducked = false;
  private wanted: TrackId | null = null;
  private current: Playing | null = null;
  private master: GainNode | null = null;
  private reverb: GainNode | null = null;

  constructor(private readonly sfx: Sfx) {
    window.setInterval(() => this.tick(), TICK_MS);
  }

  get track(): TrackId | null {
    return this.current?.track.id ?? null;
  }

  /** Ask for a track (null for silence). Switching crossfades; asking again for the same one does nothing. */
  play(id: TrackId | null): void {
    if (id === this.wanted) return;
    this.wanted = id;
    this.sync();
  }

  /** Quieter while a board or the pause menu is open. */
  duck(on: boolean): void {
    if (on === this.ducked) return;
    this.ducked = on;
    this.applyVolume();
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.sync();
  }

  /** The page was hidden or shown again (the phone locked, the app went to the background). */
  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    this.sync();
  }

  private tick(): void {
    const ctx = this.sfx.context;
    if (!ctx || ctx.state !== 'running') return;
    // Audio may have been unlocked since the last request: catch up.
    if (!this.master || (this.current?.track.id ?? null) !== this.target()) this.sync();
    if (this.current) this.schedule(ctx, this.current);
  }

  private target(): TrackId | null {
    return this.enabled && !this.hidden ? this.wanted : null;
  }

  private sync(): void {
    const ctx = this.sfx.context;
    if (!ctx || ctx.state !== 'running') return;
    this.ensureGraph(ctx);
    const want = this.target();
    if ((this.current?.track.id ?? null) !== want) {
      if (this.current) this.fadeOut(ctx, this.current);
      this.current = want ? this.start(ctx, TRACKS[want]) : null;
    }
    this.applyVolume();
  }

  private ensureGraph(ctx: AudioContext): void {
    if (this.master) return;
    const master = ctx.createGain();
    master.gain.value = VOLUME;
    master.connect(ctx.destination);
    // A small echo-reverb: two short feedback delays through a lowpass, mixed back in quietly.
    const send = ctx.createGain();
    const wet = ctx.createGain();
    wet.gain.value = 0.32;
    for (const time of [0.11, 0.173]) {
      const delay = ctx.createDelay(1);
      delay.delayTime.value = time;
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = 2600;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.38;
      send.connect(delay);
      delay.connect(tone);
      tone.connect(feedback);
      feedback.connect(delay);
      tone.connect(wet);
    }
    wet.connect(master);
    this.master = master;
    this.reverb = send;
  }

  private applyVolume(): void {
    const ctx = this.sfx.context;
    if (!ctx || !this.master) return;
    const g = this.master.gain;
    g.cancelScheduledValues(ctx.currentTime);
    g.setTargetAtTime(this.ducked ? VOLUME * DUCKED : VOLUME, ctx.currentTime, 0.15);
  }

  private start(ctx: AudioContext, track: Track): Playing {
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, ctx.currentTime);
    bus.gain.exponentialRampToValueAtTime(1, ctx.currentTime + FADE);
    if (this.master) bus.connect(this.master);
    return { track, bus, step: 0, nextTime: ctx.currentTime + 0.06, barIndex: -1, events: [] };
  }

  private fadeOut(ctx: AudioContext, p: Playing): void {
    const g = p.bus.gain;
    g.cancelScheduledValues(ctx.currentTime);
    g.setValueAtTime(Math.max(0.0001, g.value), ctx.currentTime);
    g.exponentialRampToValueAtTime(0.0001, ctx.currentTime + FADE);
    window.setTimeout(() => p.bus.disconnect(), (FADE + LOOKAHEAD + 0.2) * 1000);
  }

  private schedule(ctx: AudioContext, p: Playing): void {
    const stepDur = 60 / p.track.bpm / 4;
    // Coming back from a stall: skip ahead instead of firing a burst of late notes.
    if (p.nextTime < ctx.currentTime - 0.1) p.nextTime = ctx.currentTime + 0.05;
    while (p.nextTime < ctx.currentTime + LOOKAHEAD) {
      const bar = Math.floor(p.step / STEPS_PER_BAR);
      if (!p.track.loop && bar >= p.track.bars) return;
      if (bar !== p.barIndex) {
        p.barIndex = bar;
        p.events = p.track.bar(bar % p.track.bars);
      }
      const s = p.step % STEPS_PER_BAR;
      for (const e of p.events) if (e.step === s) this.voice(ctx, p.bus, e, p.nextTime, e.len * stepDur);
      p.step++;
      p.nextTime += stepDur;
    }
  }

  // ------------------------------------------------------------ instruments

  private voice(ctx: AudioContext, bus: GainNode, e: NoteEvent, t: number, d: number): void {
    this.notes++;
    const f = freq(e.midi);
    const v = e.vel;
    switch (e.inst) {
      case 'pad':
        this.pad(ctx, bus, f, t, d, v);
        break;
      case 'choir':
        this.choir(ctx, bus, f, t, d, v);
        break;
      case 'bass':
        this.bass(ctx, bus, f, t, d, v);
        break;
      case 'lead':
        this.lead(ctx, bus, f, t, d, v);
        break;
      case 'flute':
        this.flute(ctx, bus, f, t, d, v);
        break;
      case 'bell':
        this.bell(ctx, bus, f, t, v);
        break;
      case 'stab':
        this.stab(ctx, bus, f, t, v);
        break;
      case 'kick':
        this.kick(ctx, bus, t, v);
        break;
      case 'snare':
        this.snare(ctx, bus, t, v);
        break;
      case 'hat':
        this.hat(ctx, bus, t, v);
        break;
      case 'taiko':
        this.taiko(ctx, bus, t, v);
        break;
    }
  }

  /** A gain node shaped attack -> hold for the note -> release, connected to the bus (and the reverb if wet). */
  private env(ctx: AudioContext, bus: GainNode, t: number, attack: number, hold: number, release: number, peak: number, wet = false): GainNode {
    const g = ctx.createGain();
    const top = t + Math.max(attack, hold);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, top);
    g.gain.exponentialRampToValueAtTime(0.0001, top + release);
    g.connect(bus);
    if (wet && this.reverb) g.connect(this.reverb);
    return g;
  }

  private osc(ctx: AudioContext, type: OscillatorType, f: number, t: number, end: number, out: AudioNode, detune = 0): OscillatorNode {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.detune.value = detune;
    o.connect(out);
    o.start(t);
    o.stop(end);
    return o;
  }

  private filter(ctx: AudioContext, type: BiquadFilterType, f: number, out: AudioNode, q = 0.7): BiquadFilterNode {
    const b = ctx.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = q;
    b.connect(out);
    return b;
  }

  /** Slow vibrato on an oscillator's pitch, starting after `delay`. */
  private vibrato(ctx: AudioContext, o: OscillatorNode, t: number, end: number, rate: number, cents: number, delay: number): void {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = rate;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(0, t + delay);
    depth.gain.linearRampToValueAtTime(cents, t + delay + 0.25);
    lfo.connect(depth);
    depth.connect(o.detune);
    lfo.start(t);
    lfo.stop(end);
  }

  private noise(ctx: AudioContext, t: number, dur: number, out: AudioNode): void {
    const buf = this.sfx.noiseBuffer;
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur);
  }

  private pad(ctx: AudioContext, bus: GainNode, f: number, t: number, d: number, v: number): void {
    const g = this.env(ctx, bus, t, 0.5, d, 0.9, v * 0.035, true);
    const lp = this.filter(ctx, 'lowpass', 1400, g);
    const end = t + d + 1;
    this.osc(ctx, 'sawtooth', f, t, end, lp, -7);
    this.osc(ctx, 'sawtooth', f, t, end, lp, 7);
    this.osc(ctx, 'triangle', f / 2, t, end, lp);
  }

  private choir(ctx: AudioContext, bus: GainNode, f: number, t: number, d: number, v: number): void {
    const g = this.env(ctx, bus, t, 0.7, d, 1.2, v * 0.05, true);
    const end = t + d + 1.3;
    const o = this.osc(ctx, 'sine', f, t, end, g);
    this.vibrato(ctx, o, t, end, 5, 6, 0.3);
    const h2 = ctx.createGain();
    h2.gain.value = 0.3;
    h2.connect(g);
    this.osc(ctx, 'sine', f * 2.004, t, end, h2);
    const h3 = ctx.createGain();
    h3.gain.value = 0.12;
    h3.connect(g);
    this.osc(ctx, 'sine', f * 3, t, end, h3);
  }

  private bass(ctx: AudioContext, bus: GainNode, f: number, t: number, d: number, v: number): void {
    const g = this.env(ctx, bus, t, 0.01, d * 0.85, 0.12, v * 0.16);
    const lp = this.filter(ctx, 'lowpass', 750, g);
    const end = t + d + 0.2;
    this.osc(ctx, 'triangle', f, t, end, lp);
    this.osc(ctx, 'sine', f, t, end, lp);
  }

  private lead(ctx: AudioContext, bus: GainNode, f: number, t: number, d: number, v: number): void {
    const g = this.env(ctx, bus, t, 0.015, d * 0.9, 0.15, v * 0.03, true);
    const lp = this.filter(ctx, 'lowpass', 2300, g);
    const end = t + d + 0.2;
    const o = this.osc(ctx, 'square', f, t, end, lp);
    this.vibrato(ctx, o, t, end, 6, 10, 0.12);
  }

  /** A breathy, bending flute: a soft attack sliding up into the note, then vibrato. */
  private flute(ctx: AudioContext, bus: GainNode, f: number, t: number, d: number, v: number): void {
    const g = this.env(ctx, bus, t, 0.07, d * 0.92, 0.25, v * 0.07, true);
    const end = t + d + 0.3;
    const o = this.osc(ctx, 'sine', f, t, end, g, -40);
    o.detune.setValueAtTime(-40, t);
    o.detune.linearRampToValueAtTime(0, t + 0.09);
    this.vibrato(ctx, o, t, end, 5.5, 8, 0.2);
    const h = ctx.createGain();
    h.gain.value = 0.15;
    h.connect(g);
    this.osc(ctx, 'triangle', f * 2, t, end, h);
    const breath = this.env(ctx, bus, t, 0.01, 0.03, 0.05, v * 0.02);
    this.noise(ctx, t, 0.1, this.filter(ctx, 'bandpass', 1800, breath, 1));
  }

  private bell(ctx: AudioContext, bus: GainNode, f: number, t: number, v: number): void {
    const g = this.env(ctx, bus, t, 0.005, 0.01, 1.6, v * 0.06, true);
    const end = t + 1.7;
    this.osc(ctx, 'sine', f, t, end, g);
    const h = ctx.createGain();
    h.gain.value = 0.35;
    h.connect(g);
    this.osc(ctx, 'sine', f * 2.76, t, end, h);
  }

  private stab(ctx: AudioContext, bus: GainNode, f: number, t: number, v: number): void {
    const g = this.env(ctx, bus, t, 0.005, 0.02, 0.22, v * 0.03);
    const lp = this.filter(ctx, 'lowpass', 3200, g);
    lp.frequency.setValueAtTime(3200, t);
    lp.frequency.exponentialRampToValueAtTime(700, t + 0.18);
    const end = t + 0.3;
    this.osc(ctx, 'sawtooth', f, t, end, lp, -12);
    this.osc(ctx, 'sawtooth', f, t, end, lp, 12);
  }

  private kick(ctx: AudioContext, bus: GainNode, t: number, v: number): void {
    const g = this.env(ctx, bus, t, 0.002, 0.01, 0.3, v * 0.5);
    const o = this.osc(ctx, 'sine', 130, t, t + 0.35, g);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
  }

  private snare(ctx: AudioContext, bus: GainNode, t: number, v: number): void {
    const g = this.env(ctx, bus, t, 0.002, 0.01, 0.16, v * 0.22);
    this.noise(ctx, t, 0.2, this.filter(ctx, 'bandpass', 1900, g));
    const body = this.env(ctx, bus, t, 0.002, 0.01, 0.08, v * 0.08);
    const o = this.osc(ctx, 'triangle', 190, t, t + 0.1, body);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
  }

  private hat(ctx: AudioContext, bus: GainNode, t: number, v: number): void {
    const g = this.env(ctx, bus, t, 0.001, 0.005, 0.045, v * 0.08);
    this.noise(ctx, t, 0.06, this.filter(ctx, 'highpass', 7500, g));
  }

  private taiko(ctx: AudioContext, bus: GainNode, t: number, v: number): void {
    const g = this.env(ctx, bus, t, 0.003, 0.01, 0.7, v * 0.55);
    const o = this.osc(ctx, 'sine', 95, t, t + 0.8, g);
    o.frequency.exponentialRampToValueAtTime(52, t + 0.3);
    const skin = this.env(ctx, bus, t, 0.002, 0.01, 0.12, v * 0.12);
    this.noise(ctx, t, 0.15, this.filter(ctx, 'lowpass', 500, skin));
  }
}
