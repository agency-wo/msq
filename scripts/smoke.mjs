// End-to-end smoke test. Serves the production build (dist/) with the studio site's
// exact Content-Security-Policy, opens it in headless Microsoft Edge emulating an
// iPhone, plays with real touch events, and saves screenshots to .smoke/.
// Fails on any console error, page error or CSP violation.
//   npm run build && npm run smoke
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { preview } from 'vite';

const OUT = join(process.cwd(), '.smoke');
mkdirSync(OUT, { recursive: true });
const PORT = 4317;
const BASE = `http://localhost:${PORT}/`;
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

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
          sprites: m.drawn,
        }
      : { state: m?.state };
  });

const shotsTaken = new Set();
/** Screenshot each kind of board the first time it shows up. */
async function shotBoard() {
  const kind = await page.evaluate(() => {
    const s = document.querySelector('.screen');
    if (!s) return null;
    if (s.classList.contains('chest-brown') || s.classList.contains('chest-black')) return 'chest';
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
    if (s === 'levelup' || s === 'chest') {
      if (down) {
        await touch('touchEnd');
        down = false;
      }
      await wait(450); // boards ignore taps for a moment after opening
      await shotBoard();
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
  log('title', { installHint: await page.isVisible('.install') });
  await shot('1-title');

  // 2. Start a run with a tap and play: joystick, auto-casting, level-up boards.
  await page.tap('.screen.title .btn.primary');
  await wait(300);
  let picks = await steer(9000);
  log('early run', { ...(await stats()), picks });
  await shot('2-early');
  picks = await steer(9000);
  log('a little later', { ...(await stats()), picks });
  await shot('3-later');

  // 3. Pause from the HUD button, then resume.
  await page.tap('.icon-btn');
  await wait(300);
  log('paused', { state: await state() });
  await shot('4-pause');
  await page.tap('.screen.pause .btn.primary');
  await wait(250);
  log('resumed', { state: await state() });

  // 4. Phone turned sideways: the rotate overlay covers the game and it pauses.
  await page.setViewportSize({ width: 844, height: 390 });
  await wait(400);
  log('landscape', { overlay: await page.isVisible('.rotate'), state: await state() });
  await shot('5-landscape');
  await page.setViewportSize({ width: 390, height: 844 });
  await wait(300);

  // 5. Late game at 10:00 (god mode): a dense swarm, many level-ups, Lv 7 attribute picks.
  await page.goto(`${BASE}?debug&seed=7&play&god&t=600`);
  await wait(500);
  picks = await steer(14000);
  log('late game', { ...(await stats()), picks });
  await shot('6-late');

  // 6. Boss wave: warning toast, the boss, its health bar.
  await page.goto(`${BASE}?debug&seed=3&play&god&t=294`);
  await wait(500);
  await steer(9000);
  log('boss', { ...(await stats()), bossBar: await page.isVisible('.bossbar') });
  await shot('7-boss');

  // 7. Stress: 1500 enemies with every power maxed. Software WebGL here, so the FPS is only a floor.
  await page.goto(`${BASE}?debug&stress=1500`);
  await wait(6000);
  const samples = [];
  for (let i = 0; i < 6; i++) {
    await wait(1000);
    samples.push(await stats());
  }
  log('stress', { samples: samples.map((s) => `${s.state} ${s.fps}fps cpu${s.cpu}ms ${s.enemies}e ${s.sprites}spr`) });
  await shot('8-stress');

  // 8. Offline: the service worker serves the whole game with the network off.
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
  await shot('9-offline');

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
