import { describe, expect, it } from 'vitest';
import { BANKAI_IDS } from '../src/data/bankai';
import { STAGES } from '../src/data/stages';
import { BOSS_LINES, CHAPTERS } from '../src/data/story';
import { World } from '../src/game/world';
import { defaultSave, migrate, recordRun } from '../src/save/save';
import { chapterUnlocked, chaptersAfter, chaptersBefore, markChapter } from '../src/save/story';

describe('the story', () => {
  it('tells the prologue before the very first run, and the invasion before the first Seireitei run', () => {
    const s = defaultSave();
    expect(chaptersBefore(s, 'hueco').map((c) => c.id)).toEqual(['prologue']);
    expect(chaptersBefore(s, 'seireitei').map((c) => c.id)).toEqual(['prologue', 'invasion']);
    markChapter(s, 'prologue');
    expect(chaptersBefore(s, 'hueco')).toEqual([]);
    expect(chaptersBefore(s, 'seireitei').map((c) => c.id)).toEqual(['invasion']);
    markChapter(s, 'invasion');
    markChapter(s, 'invasion');
    expect(s.chapters).toEqual(['prologue', 'invasion']);
    expect(chaptersBefore(s, 'seireitei')).toEqual([]);
  });

  it('unlocks chapters after runs as the milestones are reached, each told once', () => {
    const s = defaultSave();
    const run = { stage: 'hueco' as const, time: 400, level: 30, kills: 3000, cleared: false, gold: 0 };
    recordRun(s, run);
    expect(chaptersAfter(s)).toEqual([]);
    recordRun(s, { ...run, bankai: ['tengen'] });
    expect(chaptersAfter(s).map((c) => c.id)).toEqual(['medallions']);
    markChapter(s, 'medallions');
    recordRun(s, { ...run, time: 1205, cleared: true });
    expect(chaptersAfter(s).map((c) => c.id)).toEqual(['lord']);
    markChapter(s, 'lord');
    recordRun(s, { ...run, stage: 'seireitei', time: 1210, cleared: true, bankai: BANKAI_IDS.slice() });
    expect(chaptersAfter(s).map((c) => c.id)).toEqual(['ash', 'almighty']);
  });

  it('tells of the heir once The Antithesis has been taken back', () => {
    const s = defaultSave();
    const run = { stage: 'hueco' as const, time: 400, level: 30, kills: 3000, cleared: false, gold: 0 };
    recordRun(s, run);
    expect(chaptersAfter(s).map((c) => c.id)).not.toContain('heir');
    recordRun(s, { ...run, codex: { powers: ['heilig', 'antithesis'], relics: [], resonances: [], kills: {} } });
    expect(chaptersAfter(s).map((c) => c.id)).toContain('heir');
  });

  it('the Chronicle shows what an old save has already done, and hides the rest', () => {
    const old = migrate({ stages: { hueco: { best: 1210, cleared: true } }, taken: ['zanka'] });
    const open = CHAPTERS.filter((c) => chapterUnlocked(old, c)).map((c) => c.id);
    expect(open).toEqual(['prologue', 'medallions', 'lord']);
    expect(migrate({ chapters: ['lord', 'nope', 3, 'lord'] }).chapters).toEqual(['lord']);
  });

  it('every boss has a line, and it reaches the title card', () => {
    for (const id of BANKAI_IDS) expect(BOSS_LINES[`bearer:${id}`]).toBeTruthy();
    for (const stage of STAGES) {
      for (const id of stage.bearerPool ?? BANKAI_IDS) if (stage.captains) expect(BOSS_LINES[`captain:${id}`]).toBeTruthy();
      for (const e of stage.events) if (e.kind === 'boss') expect(BOSS_LINES[`boss:${e.enemy}`]).toBeTruthy();
    }
    const w = new World({ seed: 3, startTime: 297, god: true });
    for (let i = 0; i < 4 * 60; i++) w.step(0, 0);
    const banner = w.banners.find((b) => b.kind === 'boss');
    expect(banner?.quote).toBe(BOSS_LINES[`bearer:${w.bearers[0]}`]);
  });
});
