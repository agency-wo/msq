import { describe, expect, it } from 'vitest';
import { defaultSave, exportCode, importCode, loadSave, migrate, recordRun, writeSave } from '../src/save/save';

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
    expect(recordRun(s, { time: 200, level: 10, kills: 300, cleared: false, gold: 25 }).newBest).toBe(true);
    expect(recordRun(s, { time: 100, level: 30, kills: 900, cleared: false, gold: 0 }).newBest).toBe(false);
    expect(s.best).toEqual({ time: 200, level: 10, kills: 300 });
    expect(s.totals).toEqual({ runs: 2, kills: 1200, clears: 0, gold: 25 });
  });
});
