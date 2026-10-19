import { describe, expect, it } from 'vitest';
import { TIP_IDS, TIPS } from '../src/data/tips';
import { defaultSave, migrate } from '../src/save/save';
import { resetTips, takeTip } from '../src/save/tips';

describe('first-time tips', () => {
  it('each shows once', () => {
    const s = defaultSave();
    expect(takeTip(s, 'move')).toBe(TIPS.move);
    expect(takeTip(s, 'move')).toBeNull();
    expect(takeTip(s, 'boss')).toBe(TIPS.boss);
    expect(s.tips).toEqual(['move', 'boss']);
  });

  it('none show while tips are off, and Settings can bring them all back', () => {
    const s = defaultSave();
    s.settings.tips = false;
    expect(takeTip(s, 'levelup')).toBeNull();
    s.settings.tips = true;
    for (const id of TIP_IDS) takeTip(s, id);
    expect(takeTip(s, 'chest')).toBeNull();
    resetTips(s);
    expect(takeTip(s, 'chest')).toBe(TIPS.chest);
  });

  it('the save keeps what was seen and drops anything unknown', () => {
    const s = migrate({ v: 1, tips: ['move', 'nope', 4, 'move'], settings: { tips: false } });
    expect(s.tips).toEqual(['move']);
    expect(s.settings.tips).toBe(false);
    expect(migrate({ v: 1 }).settings.tips).toBe(true);
  });
});
