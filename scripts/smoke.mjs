// End-to-end smoke test. Serves the production build (dist/) with the studio site's
// exact Content-Security-Policy, opens it in headless Microsoft Edge emulating an
// iPhone, plays with real touch events, and saves screenshots to .smoke/.
// Fails on any console error, page error or CSP violation.
//   npm run build && npm run smoke
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { preview } from 'vite';

const OUT = join(process.cwd(), '.smoke');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const PORT = 4317;
const BASE = `http://localhost:${PORT}/`;
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const BANKAI = ['senbonzakura', 'hyorinmaru', 'raikoben', 'tengen', 'gonryo', 'zanka'];

const server = await preview({ preview: { port: PORT, strictPort: true, open: false } });
const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: IPHONE_UA,
});
await context.addInitScript(() => {
  window.__csp = [];
  document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} -> ${e.blockedURI}`));
});
const page = await context.newPage();
const problems = [];
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`[console.error] ${m.text()}`);
});
page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`));

const cdp = await context.newCDPSession(page);
const touch = (type, x, y) =>
  cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
const wait = (ms) => page.waitForTimeout(ms);
const state = () => page.evaluate(() => window.__msq?.state);
const shot = (name) => page.screenshot({ path: join(OUT, `${name}.png`) });
const stats = () =>
  page.evaluate(() => {
    const m = window.__msq;
    const w = m?.world;
    return w
      ? {
          state: m.state,
          fps: m.fps,
          cpu: Math.round(m.cost * 10) / 10,
          t: Math.round(w.t),
          level: w.level,
          kills: w.kills,
          enemies: w.en.n,
          zones: w.zones.n,
          marks: w.marks.n,
          sprites: m.drawn,
          powers: w.powers.map((p) => `${p.def.id}${p.level}`).join(' '),
        }
      : { state: m?.state };
  });

const shotsTaken = new Set();
let rerollTested = false;
/** Screenshot each kind of board the first time it shows up. */
async function shotBoard() {
  const kind = await page.evaluate(() => {
    const s = document.querySelector('.screen');
    if (!s) return null;
    if (s.classList.contains('chest-brown') || s.classList.contains('chest-black')) return 'chest';
    if (s.classList.contains('shrine')) return 'shrine';
    const kicker = s.querySelector('.board-kicker')?.textContent ?? '';
    return kicker.startsWith('Awaken') ? 'attribute' : 'levelup';
  });
  if (kind && !shotsTaken.has(kind)) {
    shotsTaken.add(kind);
    await shot(`board-${kind}`);
  }
}

/** Hold a finger down and steer in a slow circle for `ms`, answering any board that opens. */
async function steer(ms, { cx = 195, cy = 620, radius = 45 } = {}) {
  const start = Date.now();
  let down = false;
  let picks = 0;
  while (Date.now() - start < ms) {
    const s = await state();
    if (s === 'over') break;
    if (s === 'levelup' || s === 'chest' || s === 'shrine') {
      if (down) {
        await touch('touchEnd');
        down = false;
      }
      await wait(450); // boards ignore taps for a moment after opening
      await shotBoard();
      if (!rerollTested && (await page.isVisible('.btn.reroll'))) {
        // Second Auswählen: redraw the board once and check it came back with one reroll fewer.
        rerollTested = true;
        await shot('board-reroll');
        const before = await page.textContent('.btn.reroll');
        await page.tap('.btn.reroll');
        await wait(450);
        log('reroll', { before, after: (await page.isVisible('.btn.reroll')) ? await page.textContent('.btn.reroll') : 'none left', cards: await page.$$eval('.screen .card', (c) => c.length) });
      }
      picks += await page.evaluate(() => (window.__msq.pick(0) > 0 ? 1 : 0));
      continue;
    }
    const a = ((Date.now() - start) / 1000) * 1.4;
    const x = cx + Math.cos(a) * radius;
    const y = cy + Math.sin(a) * radius;
    if (!down) {
      await touch('touchStart', cx, cy);
      down = true;
    }
    await touch('touchMove', x, y);
    await wait(50);
  }
  if (down) await touch('touchEnd');
  return picks;
}

/** Read through any story cards that are up, screenshotting the first; returns the chapter titles. */
async function passStory(name) {
  const told = [];
  for (let k = 0; k < 4; k++) {
    if (!(await page.isVisible('.screen.story').catch(() => false))) break;
    await wait(700); // story cards ignore taps for a moment
    told.push(await page.textContent('.screen.story .board-title'));
    if (k === 0 && name) await shot(name);
    await page.tap('.screen.story .btn.primary');
    await wait(350);
  }
  return told;
}

const summary = { steps: [] };
const log = (step, data = {}) => {
  summary.steps.push({ step, ...data });
  console.log(step, JSON.stringify(data));
};

try {
  // 1. Title screen, with the iPhone install hint.
  await page.goto(`${BASE}?debug&seed=7`);
  await page.waitForSelector('.screen.title .btn.primary');
  await wait(400);
  log('title', {
    music: await page.evaluate(() => window.__msq.music),
    installHint: await page.isVisible('.install'),
    stages: await page.$$eval('.stage-btn', (bs) => bs.map((b) => `${b.textContent}${b.classList.contains('locked') ? ' (locked)' : ''}`)),
  });
  await shot('01-title');
  // A locked stage explains itself instead of starting.
  await page.tap('.stage-btn.locked');
  await wait(300);
  log('locked stage tap', { toast: await page.textContent('.toast'), state: await state() });

  // 2. Start with a tap: the prologue is told first, then play: joystick, auto-casting, the Auswählen board.
  await page.tap('.screen.title .btn.primary');
  await page.waitForSelector('.screen.story');
  log('prologue', { chapters: await passStory('01b-prologue') });
  // The first run's first tip: how to move.
  await wait(1600);
  log('tip', { text: await page.textContent('.tip-bubble.show').catch(() => null) });
  await shot('01c-first-tip');
  await wait(300);
  let picks = await steer(12000);
  log('early run', { ...(await stats()), picks, music: await page.evaluate(() => window.__msq.music) });
  await shot('02-early');

  // 3. Pause from the HUD button, then resume.
  await page.tap('.icon-btn');
  await wait(300);
  log('paused', { state: await state() });
  await shot('03-pause');
  await page.tap('.screen.pause .btn.primary');
  await wait(250);

  // 4. Phone turned sideways: the rotate overlay covers the game and it pauses.
  await page.setViewportSize({ width: 844, height: 390 });
  await wait(400);
  log('landscape', { overlay: await page.isVisible('.rotate'), state: await state() });
  await page.setViewportSize({ width: 390, height: 844 });
  await wait(300);

  // 5. A mid-game build: many Schrift at once (zones, beams, bombs, drones).
  await page.goto(`${BASE}?debug&seed=7&play&god&t=520&give=xaxis6,explode6,heat6,fear6,wind6,death6,knowledge6,visionary6`);
  await wait(500);
  picks = await steer(9000);
  log('schrift build', { ...(await stats()), picks });
  await shot('04-schrift');

  // 5b. The second wave of Schrift: maw, cages, charm, fist, doubles, zombies.
  await page.goto(`${BASE}?debug&seed=7&play&god&t=400&give=glutton6,jail6,love6,power6,yourself6,zombie6`);
  await wait(500);
  picks = await steer(9000, { radius: 20 });
  log('schrift wave 2', {
    ...(await stats()),
    picks,
    allies: await page.evaluate(() => {
      const w = window.__msq.world;
      let n = 0;
      for (let i = 0; i < w.en.n; i++) if (w.en.charmT[i] > 0) n++;
      return n;
    }),
  });
  await shot('04b-schrift-wave2');

  // 5c. Resonances: Firestorm (burning gusts) and Railgun (lightning down every beam).
  await page.goto(`${BASE}?debug&seed=7&play&god&t=420&give=heat7,wind7,xaxis7,thunder7&res=firestorm,railgun`);
  await wait(500);
  await steer(8000, { radius: 20 });
  log('resonances', {
    ...(await stats()),
    owned: await page.evaluate(() => [...window.__msq.world.resonances]),
    fires: await page.evaluate(() => {
      const Z = window.__msq.world.zones;
      let n = 0;
      for (let i = 0; i < Z.n; i++) if (Z.kind[i] === 0) n++;
      return n;
    }),
  });
  await shot('04c-resonances');

  // 5c2. The Antithesis: a wound turned back, half healed and the rest dealt to the sturdiest enemies.
  await page.goto(`${BASE}?debug&seed=7&play&god&t=420&give=antithesis7,balance5&res=scales`);
  await wait(800);
  const woundAt = await page.evaluate(() => {
    const w = window.__msq.world;
    w.player.hp = w.player.maxHp * 0.5;
    w.takenSince = w.player.maxHp * 0.4;
    return w.player.hp;
  });
  await steer(7500, { radius: 20 });
  log('antithesis', {
    ...(await stats()),
    healed: Math.round((await page.evaluate(() => window.__msq.world.player.hp)) - woundAt),
    pending: await page.evaluate(() => window.__msq.world.takenSince),
    dealt: Math.round(await page.evaluate(() => window.__msq.world.damageReport().find((r) => r.id === 'antithesis')?.total ?? 0)),
  });
  await shot('04c2-antithesis');

  // 5d. Run events: a rift, a golden runner, a Reishi Storm, an ambush.
  for (const kind of ['rift', 'golden', 'storm', 'ambush']) {
    await page.goto(`${BASE}?debug&seed=7&play&god&t=200&give=xaxis5`);
    await wait(400);
    await page.evaluate((k) => window.__msq.world.startEvent(k), kind);
    await wait(1200);
    log(`event ${kind}`, { ...(await stats()), banner: (await page.isVisible('.banner.show.event')) ? await page.textContent('.banner .banner-title') : null });
    await shot(`04d-event-${kind}`);
  }

  // 6. Medallion bearers: each fights with its bankai and warns before it hits.
  for (const id of ['tengen', 'raikoben', 'gonryo']) {
    await page.goto(`${BASE}?debug&seed=3&play&god&t=297&bearers=${id}`);
    await wait(400);
    await steer(7000, { radius: 20 });
    log(`bearer ${id}`, { ...(await stats()), bossBar: await page.isVisible('.bossbar'), music: await page.evaluate(() => window.__msq.music) });
    await shot(`05-bearer-${id}`);
  }

  // 7. Taking back a bankai: the gold title card.
  await page.goto(`${BASE}?debug&seed=5&play&god&t=330`);
  await wait(600);
  await page.evaluate(() => window.__msq.world.grantBankai('senbonzakura'));
  await wait(450);
  log('bankai banner', { visible: await page.isVisible('.banner.show.bankai') });
  await shot('06-bankai-banner');

  // 8. Every bankai in action.
  for (const id of BANKAI) {
    await page.goto(`${BASE}?debug&seed=9&play&god&t=480&bankai=${id}`);
    await wait(400);
    await steer(5000, { radius: 30 });
    log(`bankai ${id}`, await stats());
    await shot(`07-bankai-${id}`);
  }

  // 9. Seireitei: unlocked once Hueco Mundo is cleared; picking it previews its ground on the title screen.
  await page.goto(`${BASE}?debug&seed=7`);
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('msq.save') ?? '{}');
    save.stages = { hueco: { best: 1210, cleared: true }, seireitei: { best: 0, cleared: false } };
    save.taken = ['senbonzakura', 'hyorinmaru', 'zanka', 'tengen'];
    save.gold = 5000;
    save.meta = { arterie: 2, reroll: 1 };
    save.awakened = ['xaxis', 'explode', 'fear'];
    save.evolution = 2;
    save.feats = ['kills-1k', 'clear-hueco', 'clear-palace'];
    save.featBest = { 'level-100': 64, 'bankai-run': 2 };
    save.looks = ['default', 'white'];
    save.look = 'white';
    save.codex = {
      powers: ['heilig', 'xaxis', 'explode', 'fear', 'heat', 'wind', 'iron', 'senbonzakura', 'hyorinmaru', 'zanka', 'tengen'],
      relics: ['crown', 'tube', 'sandals'],
      resonances: ['firestorm'],
      kills: { hollow: 420, hound: 80, brute: 30, volatile: 12, 'bearer:zanka': 2, 'bearer:tengen': 1, menos: 1, vasto: 1, rift: 2 },
    };
    localStorage.setItem('msq.save', JSON.stringify(save));
  });
  await page.reload();
  await page.waitForSelector('.screen.title .btn.primary');
  await wait(300);
  await page.tap('.stage-btn:nth-child(2)');
  await wait(500);
  log('title seireitei', {
    selected: await page.textContent('.stage-btn.on'),
    info: await page.textContent('.stage-info'),
    medals: await page.$$eval('.medal.got', (m) => m.length),
    collection: await page.textContent('.collection-text'),
  });
  await shot('09-title-seireitei');

  // Hueco Mundo is cleared in this save: its trials and Endless are open.
  await page.tap('.stage-btn:nth-child(1)');
  await wait(250);
  await page.tap('.mode-next');
  await page.tap('.mode-endless');
  await wait(250);
  log('modes', { label: await page.textContent('.mode-label'), endless: await page.isVisible('.mode-endless.on'), info: await page.textContent('.stage-info') });
  await shot('09a-modes');
  await page.tap('.mode-rush');
  await wait(250);
  log('rush mode', { on: await page.isVisible('.mode-rush.on'), info: await page.textContent('.stage-info') });
  await shot('09a2-rush-mode');
  await page.tap('.mode-prev');
  await page.tap('.mode-standard');
  await page.tap('.stage-btn:nth-child(2)');
  await wait(250);

  // The Wandenreich Archives: buy an upgrade, pick a starting Schrift.
  await page.tap('.archives-btn');
  await page.waitForSelector('.screen.archives .upgrade');
  await wait(300);
  const readSave = () => page.evaluate(() => JSON.parse(localStorage.getItem('msq.save') ?? '{}'));
  await shot('09b-archives');
  const goldBefore = (await readSave()).gold;
  await page.tap('.upgrade:nth-child(1) .upgrade-buy');
  await wait(250);
  await page.tap('.start-chip:nth-child(2)');
  await wait(250);
  const after = await readSave();
  log('archives', {
    goldBefore,
    goldAfter: after.gold,
    arterie: after.meta.arterie,
    start: after.start,
    rows: await page.$$eval('.upgrade', (r) => r.length),
    starts: await page.$$eval('.start-chip', (c) => c.map((x) => x.textContent)),
  });
  await shot('09c-archives-bought');
  // The Armory: buy a relic for good and equip it; then a verse of the Kaiser Gesang.
  await page.tap('.archives-tab.tab-armory');
  await page.waitForSelector('.screen.archives .armory-row');
  await wait(250);
  const buyable = await page.$('.armory-row .upgrade-buy:not([disabled])');
  if (buyable) {
    await buyable.tap();
    await wait(250);
    const equip = await page.$('.armory-row .upgrade-buy.equip');
    if (equip) await equip.tap();
    await wait(250);
  }
  await shot('09d-armory');
  const armory = await readSave();
  await page.tap('.archives-tab.tab-gesang');
  await page.waitForSelector('.screen.archives .gesang');
  await wait(250);
  const sing = await page.$('.gesang-buy:not([disabled])');
  if (sing) {
    await sing.tap();
    await wait(250);
  }
  await shot('09e-gesang');
  const sung = await readSave();
  log('armory and gesang', {
    relics: await page.evaluate(() => document.querySelectorAll('.armory-row').length),
    armory: armory.armory,
    startRelic: armory.startRelic,
    gesang: sung.gesang,
    gold: sung.gold,
    verse: await page.textContent('.gesang-verse'),
  });
  await page.tap('.screen.archives .btn.primary');
  await page.waitForSelector('.screen.title .btn.primary');
  await wait(300);

  // The Codex: what this save has met, tab by tab.
  await page.tap('.codex-btn');
  await page.waitForSelector('.screen.codex .codex-entry');
  await wait(250);
  const codex = { found: await page.textContent('.screen.codex .archives-hint') };
  await shot('09g-codex');
  for (const tab of [2, 3, 4]) {
    await page.tap(`.codex-tab:nth-child(${tab})`);
    await wait(200);
    codex[`tab${tab}`] = await page.$$eval('.screen.codex .codex-entry:not(.locked)', (e) => e.length);
  }
  await shot('09h-codex-enemies');
  log('codex', codex);
  await page.tap('.screen.codex .btn.primary');
  await page.waitForSelector('.screen.title .btn.primary');
  await wait(300);

  // Feats: progress and rewards; the looks they open are worn from the Wardrobe.
  await page.tap('.feats-btn');
  await page.waitForSelector('.screen.feats .feat');
  await wait(250);
  log('feats', {
    earned: await page.textContent('.screen.feats .archives-hint'),
    bars: await page.$$eval('.feat-bar', (b) => b.length),
  });
  await shot('09i-feats');
  await page.tap('.screen.feats .btn.primary');
  await page.waitForSelector('.screen.title .btn.primary');
  await wait(300);

  // The Wardrobe, from the Emperor's portrait: buy a look and a trail (each goes on at once).
  await page.tap('.hero-btn');
  await page.waitForSelector('.screen.wardrobe .look-chip');
  await wait(300);
  await shot('09j-wardrobe');
  const sale = await page.$('.look-chip.for-sale:not([disabled])');
  if (sale) {
    await sale.tap();
    await wait(300);
  }
  const trail = await page.$('.trail-chip.locked:not([disabled])');
  if (trail) {
    await trail.tap();
    await wait(300);
  }
  const dressed = await readSave();
  log('wardrobe', {
    looks: await page.$$eval('.look-chip', (c) => c.map((x) => x.textContent)),
    trails: await page.$$eval('.trail-chip', (c) => c.map((x) => x.textContent)),
    look: dressed.look,
    trail: dressed.trail,
    gold: dressed.gold,
  });
  await shot('09k-wardrobe-dressed');
  await page.tap('.screen.wardrobe .btn.primary');
  await page.waitForSelector('.screen.title .btn.primary');
  await wait(300);

  // The Chronicle: chapters told so far, and the locked ones.
  await page.tap('.chronicle-btn');
  await page.waitForSelector('.screen.chronicle .chapter');
  await wait(250);
  log('chronicle', {
    open: await page.$$eval('.screen.chronicle button.chapter', (c) => c.map((x) => x.textContent)),
    locked: await page.$$eval('.screen.chronicle .chapter.locked', (c) => c.length),
  });
  await shot('09d-chronicle');
  await page.tap('.screen.chronicle .btn.primary');
  await page.waitForSelector('.screen.title .btn.primary');
  await wait(300);

  await page.tap('.screen.title .btn.primary');
  await wait(300);
  log('invasion', { chapters: await passStory('09e-invasion') });
  await wait(300);
  log('run with upgrades', await page.evaluate(() => {
    const w = window.__msq.world;
    return { first: w.powers[0]?.def.id, atk: w.stats.atk, rerolls: w.rerolls, stage: w.stage.id };
  }));
  picks = await steer(9000);
  log('seireitei early', { ...(await stats()), picks, stage: await page.evaluate(() => window.__msq.world.stage.id) });
  await shot('10-seireitei-early');

  // Quit: the results pay out gold for the run.
  await page.tap('.icon-btn');
  await wait(300);
  await page.tap('.screen.pause .btn.danger');
  await page.waitForSelector('.screen.results');
  await wait(400);
  log('results gold', { line: await page.textContent('.screen.results .gold-line').catch(() => null), saved: (await readSave()).gold });
  await shot('10b-results-gold');

  // The Daily Trial: today's stage, Schrift and rules; the run keeps its own record for the day.
  await wait(500); // the results ignore taps for a moment
  await page.tap('.screen.results .menu-btn');
  await wait(300);
  await passStory();
  await page.waitForSelector('.screen.title .daily-btn');
  await wait(300);
  const dailyNote = await page.textContent('.daily-btn .btn-note');
  await page.tap('.daily-btn');
  await page.waitForSelector('.screen.daily .btn.primary');
  await wait(300);
  log('daily', {
    note: dailyNote,
    day: await page.textContent('.screen.daily .board-title'),
    schrift: await page.$$eval('.screen.daily .daily-chip', (c) => c.map((x) => x.textContent)),
    rules: await page.$$eval('.daily-mod .chapter-title', (r) => r.map((x) => x.textContent)),
    status: await page.$$eval('.screen.daily .archives-hint', (h) => h.map((x) => x.textContent)),
  });
  await shot('09f-daily');
  await page.tap('.screen.daily .btn.primary');
  await wait(300);
  await passStory();
  log('daily run', await page.evaluate(() => {
    const w = window.__msq.world;
    return { stage: w.stage.id, powers: w.powers.map((p) => p.def.id), mods: [...w.mods], trial: w.trial, endless: w.endless };
  }));
  await steer(6000);
  await shot('10c-daily-run');
  await page.tap('.icon-btn');
  await wait(300);
  await page.tap('.screen.pause .btn.danger');
  await page.waitForSelector('.screen.results');
  await wait(800);
  log('daily results', {
    kicker: await page.textContent('.screen.results .board-kicker'),
    best: await page.$$eval('.screen.results .stat-label', (s) => s.map((x) => x.textContent)),
    record: (await readSave()).daily,
    damage: await page.$$eval('.screen.results .dmg-row', (r) => r.map((x) => x.textContent)),
  });
  await shot('10d-results-daily');
  // Share: headless Edge has no share sheet, so the card is saved as a download instead.
  await page.evaluate(() => Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }));
  const [card] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.tap('.share-btn')]);
  await card.saveAs(join(OUT, '10e-share-card.png'));
  log('share', { file: card.suggestedFilename(), toast: await page.textContent('.toast') });

  // Mid-run: flash-steps, Kidō fire, a seated officer (elite at 7:30).
  await page.goto(`${BASE}?debug&seed=7&play&god&stage=seireitei&t=445&give=xaxis5,explode5,wind5`);
  await wait(400);
  await steer(9000, { radius: 25 });
  log('seireitei mid', await stats());
  await shot('11-seireitei-mid');

  // Hueco Mundo's last boss: Tier Harribel (Ola Azul, Sonído), then Tiburón released and Cascada.
  await page.goto(`${BASE}?debug&seed=7&play&god&stage=hueco&t=1196&give=xaxis6,explode6,heat6`);
  await wait(400);
  await steer(9000, { radius: 15 });
  log('harribel', { ...(await stats()), bossBar: await page.isVisible('.bossbar'), boss: await page.textContent('.boss-name'), sub: await page.textContent('.boss-sub') });
  await shot('12a-harribel');
  const queen = () =>
    page.evaluate(() => {
      const w = window.__msq.world;
      for (let i = 0; i < w.en.n; i++) if (w.en.type[i] === 25 && !w.en.dead[i]) return i;
      return -1;
    });
  await page.evaluate((i) => {
    const E = window.__msq.world.en;
    E.hp[i] = E.maxHp[i] * 0.45;
  }, await queen());
  await steer(6000, { radius: 15 });
  log('tiburon', {
    ...(await stats()),
    radius: await page.evaluate((i) => (i >= 0 ? window.__msq.world.en.r[i] : 0), await queen()),
    water: await page.evaluate(() => {
      const M = window.__msq.world.marks;
      let n = 0;
      for (let i = 0; i < M.n; i++) if (M.kind[i] === 15) n++;
      return n;
    }),
  });
  await shot('12b-tiburon');

  // Silbern: the second invasion's captains, then the Captain-Commander and his bankai.
  for (const id of ['kenpachi', 'mayuri', 'shinji', 'kensei']) {
    await page.goto(`${BASE}?debug&seed=3&play&god&stage=silbern&t=298&bearers=${id}`);
    await wait(400);
    await steer(6500, { radius: 20 });
    log(`silbern ${id}`, { ...(await stats()), boss: (await page.isVisible('.bossbar')) ? await page.textContent('.boss-name') : null, inverted: await page.evaluate(() => window.__msq.world.invertT > 0) });
    await shot(`12d-silbern-${id}`);
  }
  await page.goto(`${BASE}?debug&seed=7&play&god&stage=silbern&t=1196&give=xaxis6,explode6,heat6`);
  await wait(400);
  await steer(8000, { radius: 15 });
  log('kyoraku', { ...(await stats()), boss: await page.textContent('.boss-name'), sub: await page.textContent('.boss-sub') });
  await shot('12e-kyoraku');
  await page.evaluate(() => {
    const w = window.__msq.world;
    for (let i = 0; i < w.en.n; i++) if (w.en.type[i] === 29 && !w.en.dead[i]) w.en.hp[i] = w.en.maxHp[i] * 0.45;
  });
  await steer(6000, { radius: 15 });
  log('karamatsu', { ...(await stats()), marks: await page.evaluate(() => window.__msq.world.marks.n) });
  await shot('12f-karamatsu');

  // Wahrwelt: its defenders, then Ichigo and his Hollow mask.
  for (const id of ['renji', 'rukia', 'uryu', 'aizen']) {
    await page.goto(`${BASE}?debug&seed=3&play&god&stage=wahrwelt&t=298&bearers=${id}`);
    await wait(400);
    await steer(6500, { radius: 20 });
    log(`wahrwelt ${id}`, { ...(await stats()), boss: (await page.isVisible('.bossbar')) ? await page.textContent('.boss-name') : null, copies: await page.evaluate(() => { const w = window.__msq.world; let n = 0; for (let i = 0; i < w.en.n; i++) if (w.en.type[i] === 33 && !w.en.dead[i]) n++; return n; }) });
    await shot(`12g-wahrwelt-${id}`);
  }
  await page.goto(`${BASE}?debug&seed=7&play&god&stage=wahrwelt&t=1196&give=xaxis6,explode6,heat6`);
  await wait(400);
  await steer(8000, { radius: 15 });
  log('ichigo', { ...(await stats()), boss: await page.textContent('.boss-name'), sub: await page.textContent('.boss-sub') });
  await shot('12h-ichigo');
  await page.evaluate(() => {
    const w = window.__msq.world;
    for (let i = 0; i < w.en.n; i++) if (w.en.type[i] === 32 && !w.en.dead[i]) w.en.hp[i] = w.en.maxHp[i] * 0.45;
  });
  await steer(5000, { radius: 15 });
  log('hollow mask', { ...(await stats()), radius: await page.evaluate(() => { const w = window.__msq.world; for (let i = 0; i < w.en.n; i++) if (w.en.type[i] === 32 && !w.en.dead[i]) return w.en.r[i]; return 0; }) });
  await shot('12i-hollow-mask');

  // The captains defend their own bankai in Seireitei.
  for (const id of ['senbonzakura', 'hyorinmaru', 'raikoben', 'tengen', 'gonryo']) {
    await page.goto(`${BASE}?debug&seed=3&play&god&stage=seireitei&t=298&bearers=${id}`);
    await wait(400);
    await steer(6000, { radius: 20 });
    log(`captain ${id}`, { ...(await stats()), boss: (await page.isVisible('.bossbar')) ? await page.textContent('.boss-name') : null });
    await shot(`11b-captain-${id}`);
  }

  // The Captain-Commander: heat, fire lines, pillars of flame, the ashen dead.
  await page.goto(`${BASE}?debug&seed=7&play&god&stage=seireitei&t=1196&give=xaxis6,explode6,heat6,knowledge6`);
  await wait(400);
  await steer(12000, { radius: 15 });
  log('captain-commander', { ...(await stats()), bossBar: await page.isVisible('.bossbar'), boss: await page.textContent('.boss-name') });
  await shot('12-commander');
  // Below half health the Emperor takes Zanka no Tachi from him.
  await page.evaluate(() => {
    const w = window.__msq.world;
    for (let i = 0; i < w.en.n; i++) if (w.en.type[i] === 13 && !w.en.dead[i]) w.en.hp[i] = w.en.maxHp[i] * 0.45;
  });
  await steer(3000, { radius: 15 });
  log('zanka taken', {
    stolen: await page.evaluate(() => window.__msq.world.zankaStolen),
    zanka: await page.evaluate(() => window.__msq.world.powers.some((ps) => ps.def.id === 'zanka')),
  });
  await shot('12c-zanka-taken');

  // A · The Almighty: time stops, an eye opens, then everything on screen is struck down.
  await page.goto(`${BASE}?debug&seed=7&play&god&t=500&almighty&give=xaxis5,explode5`);
  let stopped = false;
  for (let k = 0; k < 80 && !stopped; k++) {
    stopped = await page.evaluate(() => window.__msq.world.almightyT > 0.5);
    if (!stopped) await steer(250, { radius: 20 });
  }
  log('almighty stop', { stopped, ...(await stats()) });
  await shot('15-almighty-stop');

  // The Soul King Palace: its servants, each guardian, Ichibē, and a fragment taken back.
  await page.goto(`${BASE}?debug&seed=7&play&god&stage=palace&give=xaxis5,explode5`);
  await steer(7000, { radius: 25 });
  log('palace early', { ...(await stats()), stage: await page.evaluate(() => window.__msq.world.stage.id), music: await page.evaluate(() => window.__msq.music) });
  await shot('18-palace-early');
  for (const id of ['tenjiro', 'kirio', 'oetsu', 'senjumaru']) {
    await page.goto(`${BASE}?debug&seed=7&play&god&stage=palace&t=296&bearers=${id}&give=xaxis5,explode5`);
    await steer(8000, { radius: 25 });
    log(`royal ${id}`, { ...(await stats()), boss: (await page.isVisible('.bossbar')) ? await page.textContent('.boss-name') : null, sub: await page.textContent('.boss-sub').catch(() => null) });
    await shot(`18b-royal-${id}`);
  }
  await page.goto(`${BASE}?debug&seed=7&play&god&stage=palace&t=1196&give=xaxis7,explode7,heat7,knowledge7`);
  await steer(9000, { radius: 25 });
  log('ichibe', { ...(await stats()), boss: await page.textContent('.boss-name').catch(() => null), sealed: await page.$$eval('.tray-item.sealed', (s) => s.length) });
  await shot('18c-ichibe');
  // Answer any board that is open, then drop a fragment at the Emperor's feet.
  for (let k = 0; k < 20 && (await state()) !== 'playing'; k++) {
    await wait(450);
    await page.evaluate(() => window.__msq.pick(0));
  }
  await page.evaluate(() => {
    const w = window.__msq.world;
    w.addPickup('fragment', w.player.x, w.player.y, undefined, 'rightarm');
  });
  let owned = false;
  for (let k = 0; k < 20 && !owned; k++) {
    await wait(100);
    owned = await page.evaluate(() => window.__msq.world.powers.some((p) => p.def.id === 'rightarm'));
  }
  log('fragment', { banner: await page.textContent('.banner .banner-title').catch(() => null), owned });
  await shot('18d-fragment');

  // Boss Rush: the stage's bosses back to back, eight level-ups to start.
  await page.goto(`${BASE}?debug&seed=7&play&god&rush&stage=hueco`);
  await steer(16000, { radius: 25 });
  log('boss rush', { ...(await stats()), rush: await page.evaluate(() => window.__msq.world.bossRush), boss: (await page.isVisible('.bossbar')) ? await page.textContent('.boss-name') : null });
  await shot('19-boss-rush');

  // A Quincy shrine: walk into it and make a pact.
  await page.goto(`${BASE}?debug&seed=7&play&god&give=explode4,fear3`);
  await wait(800);
  await page.evaluate(() => {
    const w = window.__msq.world;
    w.addPickup('shrine', w.player.x, w.player.y);
  });
  await page.waitForSelector('.screen.shrine .card');
  await wait(450);
  const pacts = await page.$$eval('.screen.shrine .card-title', (t) => t.map((x) => x.textContent));
  await shot('17-shrine');
  await page.tap('.screen.shrine .card:nth-child(1)');
  await wait(300);
  log('shrine', { pacts, made: await page.evaluate(() => [...window.__msq.world.pacts]), state: await state() });

  // The Emperor evolves: three awakened Schrift bring wings and eyes; The Almighty, his shadow.
  await page.goto(`${BASE}?debug&seed=7&play&god&give=heilig7,explode7,fear7`);
  await steer(4500, { radius: 20 });
  log('evolve eyes', { tier: await page.evaluate(() => window.__msq.world.evolution) });
  await shot('16-evolve-eyes');
  await page.goto(`${BASE}?debug&seed=7&play&god&almighty`);
  await steer(4500, { radius: 20 });
  for (let k = 0; k < 40 && (await page.evaluate(() => window.__msq.world.almightyT > 0)); k++) await wait(100);
  log('evolve shadow', { tier: await page.evaluate(() => window.__msq.world.evolution) });
  await shot('16b-evolve-shadow');

  // 10. Stress: 1500 enemies, every Schrift maxed, two bankai. Software WebGL here, so FPS is only a floor.
  await page.goto(`${BASE}?debug&stress=1500&bankai=senbonzakura,gonryo`);
  await wait(6000);
  const samples = [];
  for (let i = 0; i < 6; i++) {
    await wait(1000);
    samples.push(await stats());
  }
  log('stress', { samples: samples.map((s) => `${s.state} ${s.fps}fps cpu${s.cpu}ms ${s.enemies}e ${s.zones}z ${s.sprites}spr`) });
  await shot('08-stress');

  // Same in Seireitei, where casters keep enemy fire in the air.
  await page.goto(`${BASE}?debug&stress=1500&stage=seireitei&bankai=zanka,hyorinmaru`);
  await wait(6000);
  const seiSamples = [];
  for (let i = 0; i < 4; i++) {
    await wait(1000);
    seiSamples.push(await stats());
  }
  log('stress seireitei', { samples: seiSamples.map((s) => `${s.state} ${s.fps}fps cpu${s.cpu}ms ${s.enemies}e ${s.sprites}spr`) });
  await shot('13-stress-seireitei');

  // And in the palace, where ink splits and threads fly.
  await page.goto(`${BASE}?debug&stress=1500&stage=palace&bankai=zanka,hyorinmaru`);
  await wait(6000);
  const palSamples = [];
  for (let i = 0; i < 4; i++) {
    await wait(1000);
    palSamples.push(await stats());
  }
  log('stress palace', { samples: palSamples.map((s) => `${s.state} ${s.fps}fps cpu${s.cpu}ms ${s.enemies}e ${s.sprites}spr`) });
  await shot('13b-stress-palace');

  // 11. Offline: the service worker serves the whole game with the network off.
  await page.goto(`${BASE}?debug`);
  const sw = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return !!reg.active;
  });
  await wait(800);
  await context.setOffline(true);
  await page.reload();
  const offlineOk = await page
    .waitForSelector('.screen.title .btn.primary', { timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  await context.setOffline(false);
  log('offline', { serviceWorker: sw, offlineTitle: offlineOk });

  summary.csp = await page.evaluate(() => window.__csp);
} catch (err) {
  problems.push(`[smoke] ${err instanceof Error ? err.stack : String(err)}`);
} finally {
  summary.problems = problems;
  writeFileSync(join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
  await browser.close();
  await server.close();
}

const csp = summary.csp ?? [];
if (csp.length) console.log('CSP violations:', csp);
if (problems.length) console.log('Problems:\n' + problems.join('\n'));
console.log(problems.length || csp.length ? 'SMOKE FAILED' : 'SMOKE PASSED');
process.exit(problems.length || csp.length ? 1 : 0);
