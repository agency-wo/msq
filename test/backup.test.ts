import { describe, expect, it } from 'vitest';
import { BACKUP_DAYS, BACKUP_RUNS, backupDue, backupFile, defaultSave, exportCode, importCode, markBackedUp, migrate, snoozeBackup } from '../src/save/save';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 22, 12);

describe('save backup', () => {
  it('asks for a first backup once there is progress to lose', () => {
    const s = defaultSave();
    expect(backupDue(s, NOW)).toBe(false);
    s.totals.runs = BACKUP_RUNS;
    expect(backupDue(s, NOW)).toBe(true);
  });

  it('waits for runs and days after a backup, and sleeps when asked', () => {
    const s = defaultSave();
    s.totals.runs = 10;
    markBackedUp(s, NOW);
    expect(backupDue(s, NOW + (BACKUP_DAYS + 1) * DAY)).toBe(false);
    s.totals.runs += BACKUP_RUNS;
    expect(backupDue(s, NOW + DAY)).toBe(false);
    expect(backupDue(s, NOW + BACKUP_DAYS * DAY)).toBe(true);
    snoozeBackup(s);
    expect(backupDue(s, NOW + BACKUP_DAYS * DAY)).toBe(false);
    s.totals.runs += BACKUP_RUNS;
    expect(backupDue(s, NOW + BACKUP_DAYS * DAY)).toBe(true);
  });

  it('writes a dated file that loads back, header and all', () => {
    const s = defaultSave();
    s.gold = 4321;
    s.totals.runs = 7;
    const f = backupFile(s, NOW);
    expect(f.name).toBe('quincy-survival-save-2026-10-22.txt');
    expect(f.text.split('\n')[0]).toContain('Load a backup file');
    const back = importCode(f.text);
    expect(back?.gold).toBe(4321);
    expect(back?.totals.runs).toBe(7);
    // The bare code still loads, with spaces round it.
    expect(importCode(`  ${exportCode(s)}  `)?.gold).toBe(4321);
    expect(importCode('nothing here')).toBeNull();
  });

  it('migrates the backup record, dropping nonsense', () => {
    expect(migrate({ v: 1 }).backup).toEqual({ at: 0, runs: 0, snooze: 0 });
    expect(migrate({ v: 1, backup: { at: -5, runs: 'x', snooze: 4.7 } }).backup).toEqual({ at: 0, runs: 0, snooze: 4 });
    const s = defaultSave();
    markBackedUp(s, NOW);
    expect(migrate(JSON.parse(JSON.stringify(s))).backup.at).toBe(NOW);
  });
});
