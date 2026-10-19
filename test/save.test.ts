import { describe, expect, it } from 'vitest';
import { defaultSave, exportCode, importCode, loadSave, migrate, recordRun, stageUnlocked, writeSave } from '../src/save/save';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length(): number {
    return this.data.size;
  }
  clear(): void {
    this.data.clear();
  }
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe('save', () => {
  it('turns garbage into a valid default save', () => {
    expect(migrate(null)).toEqual(defaultSave());
    expect(migrate('nope')).toEqual(defaultSave());
    const fixed = migrate({ best: { time: -5, level: 'x' }, settings: { sound: false, numbers: 3 } });
    expect(fixed.best.time).toBe(0);
    expect(fixed.best.level).toBe(0);
    expect(fixed.settings.sound).toBe(false);
    expect(fixed.settings.numbers).toBe(true);
  });

  it('round-trips through storage', () => {
    const storage = new MemoryStorage();
    const s = defaultSave();
    s.best.time = 321;
    expect(writeSave(s, storage)).toBe(true);
    expect(loadSave(storage).best.time).toBe(321);
  });

  it('survives corrupted storage', () => {
    const storage = new MemoryStorage();
    storage.setItem('msq.save', '{broken');
    expect(loadSave(storage)).toEqual(defaultSave());
    expect(loadSave(null)).toEqual(defaultSave());
  });

  it('round-trips through an export code and rejects other text', () => {
    const s = defaultSave();
    s.totals.kills = 9001;
    s.settings.shake = false;
    expect(importCode(exportCode(s))).toEqual(s);
    expect(importCode('hello')).toBeNull();
    expect(importCode('MSQ1.!!!')).toBeNull();
  });

  it('records the longest survival as the best run', () => {
    const s = defaultSave();
    expect(recordRun(s, { stage: 'hueco', time: 200, level: 10, kills: 300, cleared: false, gold: 25 }).newBest).toBe(true);
    expect(recordRun(s, { stage: 'hueco', time: 100, level: 30, kills: 900, cleared: false, gold: 0 }).newBest).toBe(false);
    expect(s.best).toEqual({ time: 200, level: 10, kills: 300 });
    expect(s.stages.hueco.best).toBe(200);
    expect(s.totals).toEqual({ runs: 2, kills: 1200, clears: 0, gold: 25 });
  });

  it('opens Seireitei only once Hueco Mundo is cleared', () => {
    const s = defaultSave();
    expect(stageUnlocked(s, 'hueco')).toBe(true);
    expect(stageUnlocked(s, 'seireitei')).toBe(false);
    expect(recordRun(s, { stage: 'hueco', time: 700, level: 30, kills: 3000, cleared: false, gold: 0 }).unlocked).toBeNull();
    expect(stageUnlocked(s, 'seireitei')).toBe(false);
    expect(recordRun(s, { stage: 'hueco', time: 1202, level: 60, kills: 9000, cleared: true, gold: 0 }).unlocked).toBe('seireitei');
    expect(stageUnlocked(s, 'seireitei')).toBe(true);
    // Clearing it again unlocks nothing new.
    expect(recordRun(s, { stage: 'hueco', time: 1203, level: 60, kills: 9000, cleared: true, gold: 0 }).unlocked).toBeNull();
    // Per-stage bests stay separate.
    recordRun(s, { stage: 'seireitei', time: 300, level: 20, kills: 900, cleared: false, gold: 0 });
    expect(s.stages.seireitei.best).toBe(300);
    expect(s.stages.hueco.best).toBe(1203);
  });

  it('carries an old save (before stages) over: its record and clear count as Hueco Mundo', () => {
    const old = { v: 1, best: { time: 1201, level: 55, kills: 8000 }, totals: { runs: 4, kills: 20000, clears: 1, gold: 100 } };
    const s = migrate(old);
    expect(s.stages.hueco).toEqual({ best: 1201, cleared: true, clearTrial: 0, endless: 0 });
    expect(s.stages.seireitei).toEqual({ best: 0, cleared: false, clearTrial: -1, endless: 0 });
    expect(stageUnlocked(s, 'seireitei')).toBe(true);
    expect(s.stage).toBe('hueco');
  });
});
