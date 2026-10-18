# Quincy Survival (prototype)

A one-thumb survival roguelite in the style of Magic Survival, built as an
installable web app so it plays full-screen and offline on iPhone with no App
Store. Live at **https://play.minarankstudio.com**.

You are the Emperor. Level-ups let you take back the Schrift you gave your
knights (Auswählen): 18 offensive powers with a Lv 7 attribute pick, plus 6
utilities. Some fight for you: The Love charms enemies onto your side, The
Zombie raises the infected dead, The Yourself sends out doubles. Every run,
three random medallion bearers carry stolen bankai; beat one and its bankai is
yours. All art is original and drawn in code.

Stages, 20 minutes each:

- **Hueco Mundo**: Hollows, ending with the Vasto Lorde.
- **Seireitei** (unlocked by clearing Hueco Mundo): Soul Reaper soldiers that
  flash-step and cast Kidō, seated officers that throw sword waves, and the
  Kidō Grandmaster, whose binding seal roots you in place.

## Play on iPhone

Open the site in Safari, tap **Share**, then **Add to Home Screen**. It then
launches full-screen from its own icon, works in airplane mode, and keeps its
save separate from Safari.

## Develop

```sh
npm install
npm run dev          # http://localhost:5173 (add --host to open it from your phone on the same Wi-Fi)
npm run typecheck
npm test
npm run build        # static site in dist/
npm run smoke        # after a build: plays it in headless Edge under the studio's CSP, screenshots to .smoke/
npm run icons        # redraws public/icons
```

Pacing report for tuning (prints level, kills and boss times for a few simulated play styles):

```sh
BALANCE=1 npx vitest run test/balance.test.ts --silent=false
BALANCE=1 STAGE=seireitei MINUTES=21 npx vitest run test/balance.test.ts --silent=false
BENCH=1 npx vitest run test/bench.test.ts --silent=false   # damage per second of every power at Lv 6
```

## Testing switches

Add these to the URL: `?debug` (FPS, CPU per frame and entity counts),
`?stress=1500` (swarm plus every power maxed, no damage), `?god`, `?seed=123`,
`?t=600` (start at 10:00), `?play` (skip the title), `?give=explode7,xaxis5`
(own powers at those levels), `?bankai=zanka,tengen` (start with bankai),
`?bearers=raikoben,gonryo` (choose which bankai the bosses carry),
`?stage=seireitei` (play a stage even if it is still locked).

## How it is built

- `src/game/` is the whole simulation in plain TypeScript with no rendering, so it runs headless in tests.
- `src/data/` holds the content tables: powers with their Lv 7 attributes, passives, relics, enemies and the stages (spawn mixes, events, difficulty). New content goes here.
- `src/render/` draws with PixiJS particle containers from one texture atlas generated in code at startup. All art is original.
- `src/ui/` is plain DOM with an external stylesheet.
- No inline scripts or styles and no `eval`, so it runs under the strict Content-Security-Policy that minarankstudio.com sends.
- A service worker generated at build time precaches every file for offline play.

## Deploy

Every push to `main` builds and publishes to GitHub Pages through
`.github/workflows/deploy.yml`. The custom domain is set in the repository's
Pages settings, and DNS is a `CNAME play -> agency-wo.github.io` record on
Cloudflare, DNS only (grey cloud), so GitHub can issue the HTTPS certificate.
