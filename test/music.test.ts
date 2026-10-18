import { describe, expect, it } from 'vitest';
import { MELODIC, midi, STEPS_PER_BAR, TRACKS } from '../src/audio/compose';

describe('the soundtrack', () => {
  it('names notes the usual way', () => {
    expect(midi('A4')).toBe(69);
    expect(midi('C4')).toBe(60);
    expect(midi('C#5')).toBe(73);
    expect(midi('Eb5')).toBe(75);
    expect(() => midi('H2')).toThrow();
  });

  it('every bar of every track is valid, and melodies stay in the track\'s scale', () => {
    for (const track of Object.values(TRACKS)) {
      expect(track.bars).toBeGreaterThan(0);
      for (let b = 0; b < track.bars * 2; b++) {
        const events = track.bar(b % track.bars);
        expect(events.length).toBeGreaterThan(0);
        for (const e of events) {
          expect(e.step).toBeGreaterThanOrEqual(0);
          expect(e.step).toBeLessThan(STEPS_PER_BAR);
          expect(e.len).toBeGreaterThan(0);
          expect(e.vel).toBeGreaterThan(0);
          expect(e.vel).toBeLessThanOrEqual(1);
          expect(Number.isFinite(e.midi)).toBe(true);
          if (MELODIC.has(e.inst)) expect(track.scale).toContain(((e.midi % 12) + 12) % 12);
        }
      }
    }
  });

  it('bosses drive harder than the stages; stingers play once', () => {
    expect(TRACKS.boss.bpm).toBeGreaterThan(TRACKS.hueco.bpm);
    expect(TRACKS.bossSei.bpm).toBeGreaterThan(TRACKS.seireitei.bpm);
    expect(TRACKS.final.bpm).toBeGreaterThanOrEqual(TRACKS.boss.bpm);
    expect(TRACKS.victory.loop).toBe(false);
    expect(TRACKS.defeat.loop).toBe(false);
    for (const id of ['title', 'hueco', 'seireitei', 'boss', 'bossSei', 'final'] as const) expect(TRACKS[id].loop).toBe(true);
  });

  it('Seireitei sounds like Seireitei: taiko and flute; Hueco Mundo does not use them', () => {
    const insts = (id: keyof typeof TRACKS) => new Set(Array.from({ length: TRACKS[id].bars }, (_, b) => TRACKS[id].bar(b)).flat().map((e) => e.inst));
    expect(insts('seireitei').has('taiko')).toBe(true);
    expect(insts('seireitei').has('flute')).toBe(true);
    expect(insts('bossSei').has('flute')).toBe(true);
    expect(insts('hueco').has('flute')).toBe(false);
    expect(insts('boss').has('taiko')).toBe(false);
  });
});
