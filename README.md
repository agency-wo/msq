# Quincy Survival (prototype)

A one-thumb survival roguelite in the style of Magic Survival, built as an
installable web app so it plays full-screen and offline on iPhone with no App
Store. Live at **https://play.minarankstudio.com**.

You are the Emperor. Level-ups let you take back the Schrift you gave your
knights (Auswählen): 19 offensive powers with a Lv 7 attribute pick, plus 6
utilities. Some fight for you: The Love charms enemies onto your side, The
Zombie raises the infected dead, The Yourself sends out doubles, and Uryū
Ishida's Antithesis reverses your wounds: you heal half, and the sturdiest
enemies near you lose the same share of their health. Every run in Hueco
Mundo, three of the Sternritter who stole the captains' bankai with their
medallions come for you (Äs Nödt with Senbonzakura, Cang Du with Hyōrinmaru,
BG9 with Raikōben, Bambietta with Tengen, Driscoll with Gonryō Rikyū); beat
one and its bankai is yours. Every bankai, Fragment of the Soul King and awakened Schrift you take
back in a run counts toward **A · The Almighty** (the HUD shows how many): at
five it awakens (at three once you have taken back all six bankai across your
runs). It stops time every 24 s and
rewrites the future (enemy fire vanishes, everything on screen is struck down).
All art is drawn in code: the Emperor, the Sternritter, the Gotei 13 captains,
the Royal Guard, Tier Harribel and the other named characters are manga
homages to their Bleach designs, lanky figures drawn with one shared kit
(src/render/cast) and known by their silhouettes; everything else (Hollows, Soul Reaper
soldiers, the palace's servants, effects) is an original design. It is all
inked like a printed manga: flat tones, a black line round every figure,
effects in hard-edged bands, grounds in screentone, and a swarm drawn
grotesque (Hollows that are all limbs, spines and teeth; lanky soldiers with
their eyes in shadow). The menus are ink and paper, square, in Anton.

As he takes power back, the Emperor **evolves** in front of you: reishi wings
with the first bankai or awakened Schrift, crimson eyes opening across his
cloak at three, and a shadow of black flame full of eyes with The Almighty.
The title shows him as far as he has ever come.

The HUD shows your build as a tray of icons with their levels, and bosses get
a portrait and a title. The pause and results screens break down the **damage**
each power dealt (total, share and damage per second), and **Share** on the
results turns the run into a picture for the phone's share sheet.

Thirty-five **Feats** give long goals (a hundred thousand kills, every letter
awakened, Trial V, a Boss Rush under 4:00, all three fragments in one run,
every spoil of war...),
each paying gold once; some open one of three new looks for the Emperor
(Wandenreich White, Crimson, Gilded) or a relic that can then turn up in chests
(Founder's Medallion: bankai arrive at Lv 2; Silbern Key: shrines offer four
pacts; Soul King's Seal: fragments arrive a level up). Chests only offer what
the run can still use: no Founder's Medallion where no bankai is left to take
(Silbern, the Palace, the Wahrwelt, or once you hold every bankai the run
could give), the Soul King's Seal only in the Palace while a Fragment can
still drop, no Silbern Key or Sanrei Glove in a Boss Rush.

Every boss leaves a **spoil of war** of its own when it falls, forty in all,
and none of them does what another does: Äs Nödt's Thorn holds everything
near you with fear when you are hit, Cang Du's Iron Scale hardens you after
every hit, Neliel's Mask swallows one shot in six and spits it back as a
Cero, Byakuya's Silver Scarf pays half again as much gold, Suzumebachi's
Stinger kills outright on the Hōmonka, Kenpachi's Eyepatch is for boss fights,
Kyōraku's Flowered Haori turns aside one big blow every 30 s, the Hōgyoku
answers once at a quarter of your health, Zangetsu's Edge throws Getsuga
Tenshō where you are heading, and so on. A spoil works for the rest of the
run (the last boss's is yours at once); once won, it stays in the Codex and
in the Armory, and any run but the Daily Trial can start with it.

New players get a one-line **tip** the first time each system shows up (moving,
level-ups and awakenings, resonances, chests, shrines, bosses, events, Blut
Rush, the Emperor's evolutions, fragments, Ichimonji), on the board itself or
for a few seconds near the bottom. Settings turns them off or brings them back.

The **Codex** fills in as you play: every Schrift with its three awakenings,
the resonances (with a hint for the ones still hidden), the relics, the spoils
of war (each with the portrait of the boss who leaves it), and every enemy and
named boss with how many times you have beaten it.

Powers can **resonate**: once both are strong enough a Resonance card joins
the level-up board. Both keep working as before; the resonance ties them
together. Every attack has one partner (Firestorm: gusts carry The Heat's fire;
Railgun: lightning down every beam; nine pairs), and the story adds more: each
Sternritter's Schrift with the bankai that knight stole (The Fear with
Senbonzakura, The Iron with Hyōrinmaru, The Knowledge with Raikōben, The
Explode with Tengen, The Overkill with Gonryō Rikyū) and the Emperor's own with
The Almighty (Haschwalth's Balance, Royd Lloyd's Yourself, the stolen Zanka no
Tachi, and Uryū's Antithesis, the letter of the heir he named). The knights'
own bonds resonate too: Uryū's Antithesis with Haschwalth's Balance, Giselle's
Zombie with Bambietta's Explode, Bazz-B's Heat with his old friend's Balance,
and Gerard Valkyrie's Miracle with the Heart of the Soul King he turned out to
be. And four resonate in threes: the Bambies (The Explode, The Thunderbolt and
The Glutton: each strike hurries the other two), the Schutzstaffel (The X-Axis
and The Deathdealing grow with your wounds beside The Miracle), Licht Regen
(Heilig Pfeil, Seele Schneider and Quincy: Vollständig: arrows of light rain
while the wings shine) and the Soul King, Whole (his three Fragments answer
twice as often). The Quincy arts resonate as well: Uryū's silver arrowhead
(Heilig Pfeil with The Antithesis: a silver arrow freezes the strongest enemy),
the hymn Sankt Zwinger (Seele Schneider set at the points of The Jail's cages),
Quilge Opie's Sklaverei (under Vollständig, cages drain their prisoners and
feed you), Haschwalth's Freund Schild (a blow The Iron turns aside is handed
back by The Balance), and the Emperor's Blut Vene Anhaben (Blut Vene spread
round you with The Almighty). Two more take a stolen bankai: Hyōrinmaru's
Hyōten Hyakkasō freezes The Wind's gusts, and Gonryō Rikyū answers The
Thunderbolt with its own storm. Blut Arterie runs in The Power's fists.
A passive partner resonates at its last level. Thirty-four in all.

The story is told in short chapters that unlock as you play (the prologue
before your first run, the invasion before your first Seireitei run, others
for your first bankai, each stage cleared, and The Almighty), all rereadable in
the **Chronicle**. Every boss is announced by a warning of its own a few
seconds before it comes, and says one line as it arrives: the bearers are your
own knights, the captains defend their city. Endless brings every boss of a
stage once before any of them returns.

Music is composed note by note and synthesized live with Web Audio (nothing to
download): a regal title theme, the eerie "White Moon" for Hueco Mundo, taiko
and flute for Seireitei, a plucked guitar and palmas for Las Noches, themes of
their own for Silbern, the Palace and the Wahrwelt, rock for Karakura Town, a driving boss theme with
a Seireitei version and a finale, and victory and defeat stingers. It can be turned off in Settings.

Between the bosses, **events** break the rhythm: a Garganta (a Senkaimon
outside Hueco Mundo) pours out enemies until you destroy it, a runaway flees
with treasure (a gorged Adjuchas in Hueco Mundo, Ganju Shiba on his boar
Bonnie in the Seireitei and Silbern, the mod soul Kon in the Palace and the
Wahrwelt), a Reishi Storm rains mana, or an ambush closes in.
**Quincy shrines** turn up too (always one around 3:40): walk into one for a
choice of three pacts, each a real gain at a real price (Blut Arterie: +30%
damage for a quarter of your health; Gintō Hoard: 60% more gold, sturdier
enemies; Jagdarmee: the next boss now, for an extra black chest; and seven
more), or walk away. Each pact can be made once a run.
Chain kills without being hit for **Blut Rush**: three tiers of extra damage and
speed, shown by the counter beside your kills.

It is meant to be hard. The first minutes are fair to a new build, but the
swarm's health, numbers, speed and bite all climb steeply as the run goes on,
elites come every 75 s, and every boss is tougher the higher it stands on the
stage (the first close to an even fight, the last up to 2.6 times its old
health); late in Hueco Mundo the Menos Grande join in with their Ceros. Every
number lives in one place, `DIFFICULTY` in `src/data/stages.ts`.

Clear a stage and its **Trials** open one at a time (I to V: tougher enemies
and bosses, harder hits, 60% more gold per tier), along with **Endless**: the
final boss no longer ends the run, boss waves keep coming and the swarm keeps
growing until you fall. Each stage keeps its best Endless time. **Boss Rush**
opens with the first clear too: the stage's bosses back to back with their
escorts and a thin swarm, eight level-ups to start and four for each boss down,
racing for the fastest clear.

The **Daily Trial** is one run a day, the same for every player: the date picks
the stage, a Schrift held from the start beside Heilig Pfeil (any attack, even
one you have not awakened yet) and two rules that bend the run (Letzt Stil,
The Swarm, Giants, Shunpo, Frail, Barren). Surviving five minutes pays 100 bonus
gold once a day and clearing it pays 300; the day keeps its own best time.

**Story Mode** retells the Thousand-Year Blood War from the Emperor's side in
ten short missions, opened one after another from the Story card on the
title. Each has a briefing, a goal, rules of its own and a page that closes it:
the desert and Tier Harribel; the Jagdarmee's hunt (survive eight minutes with
Quilge's Jail); taking three medallions back; the Sexta under the painted sky;
the First Invasion and Yamamoto; Silbern and Kyōraku; the Royal Guard and
Ichibē; father and son in the Wahrwelt (Renji, Uryū, Aizen, then Ichigo); ten
minutes against everything with The Almighty in hand; and, in another telling,
Karakura Town and Urahara. The first clear of each pays gold; each keeps its
fastest clear. Missions count for totals, the Codex and feats, never for a
stage's own records.

Every run pays gold. Spend it in the **Wandenreich Archives** on permanent
upgrades (attack, health, damage taken, health regeneration, speed, pickup
range, cooldowns, power size and duration, projectile speed, critical chance
and damage, one more of everything, faster level-ups, more gold, two revives,
level-up rerolls), and pick which awakened Schrift a run opens with. A gift
code typed under Settings (Redeem a gift code) pays its gold once per save.

Stages, 20 minutes each:

- **Hueco Mundo**: Hollows, Shriekers' leeches that burst, and three of the
  bankai thieves, each fighting with the bankai and with their own Schrift
  too: Äs Nödt's thorns of fear close in and hold you, Cang Du's skin turns to
  iron, BG9's missiles fall where you are going, Bambietta's bombs land all
  around you, and Driscoll grows with every death near him. Ayon, the beast
  Harribel's Fracción make from their own left arms, comes with the third
  (fists, a charge, a roar of Bala; at half health its face splits open), and
  Neliel Tu Oderschvank stands in the way at 18:00 (Cero Doble spits back what
  she swallowed, Lanzador Verde, then Gamuza, her centaur form). Tier Harribel,
  the Third Espada who has ruled Las Noches since Aizen fell, ends the stage:
  Ola Azul waves, a Sonído rush down a warned lane, and below half health
  Tiburón released and Cascada falling where you stand (in the story, the
  Emperor beats her in front of her own palace).
- **Seireitei** (unlocked by clearing Hueco Mundo): Soul Reaper soldiers,
  Onmitsukidō agents that flash-step, Kidō Corps officers that cast, and
  lieutenants that throw sword waves. The bankai
  bosses here are the captains themselves (Byakuya, Hitsugaya, Suì-Fēng,
  Komamura, Lieutenant Sasakibe), each fighting with their own bankai and an
  art of their own (Senkei's ring of blades, Hyōten Hyakkasō's ice flowers,
  Nigeki Kessatsu: a second sting on the butterfly crest strikes three times
  as hard, Tengen's blade from the sky, a fencer's thrust). Retsu Unohana
  comes with the third, closing her soldiers' wounds, and at half health lets
  her braid down: she was the first Kenpachi, and her cuts heal her.
  Captain-Commander Yamamoto ends the stage
  with Zanka no Tachi's fire and the ashen dead. Bring him below half health
  and the Emperor takes his bankai, as he did in the story: Yamamoto fights on
  with Ennetsu Jigoku's pillars of flame and his fists (Ikkotsu, Sōkotsu).
- **Las Noches** (unlocked by clearing Hueco Mundo, with the Seireitei): inside
  the palace Aizen raised in the desert, white halls under the false sky he
  painted on its dome. Arrancar soldiers, the skull-masked Exequias firing
  Bala, and Menos Grande lumbering in with a warned Cero. Three of four
  Arrancar bar the way, each releasing at half health: Rudbornn Chelute
  (Árbol's Calaveras rise around you, and while they stand by him they take
  half of every blow), Dordoni (Giralda's whirlwinds and a drilling kick),
  Cirucci (Golondrina's blade on its cord, then wings of razor feathers) and
  Gantenbainne (Dragon Rugir, then Dragra's armour). Grimmjow Jaegerjaquez,
  the Sexta Espada, ends it with Desgarrón, Garra de la Pantera, Sonído and
  Gran Rey Cero, and at half health releases Pantera. Pesche and Dondochakka
  are the runaways.
- **Silbern** (unlocked by clearing Seireitei, with the Palace): the second
  invasion. The Wandenreich's city has risen out of the Seireitei's shadow and
  taken its place, and the Gotei 13 fights back in it: Eleventh Division
  brawlers, the Twelfth's specimens that burst into poison, and three of four
  captains. Kenpachi Zaraki slashes, charges and finally takes his sword in
  both hands (Kendō); Mayuri Kurotsuchi's Ashisogi Jizō paralyzes, his gas
  spreads and Konjiki Ashisogi Jizō joins the fight; Shinji Hirako's Sakanade
  turns you around (your controls flip for three seconds); Kensei Muguruma
  throws Tachikaze's wind and Tekken Tachikaze's punches. Captain-Commander
  Shunsui Kyōraku ends the stage with Katen Kyōkotsu's games (Kageoni,
  Takaoni, Bushōgoma) and, at half health, Karamatsu Shinjū.
- **Soul King Palace** (unlocked by clearing Seireitei): sentinels that wind up
  and lunge, ink wisps that split as they die, weavers whose threads hold you,
  flying asauchi and attendants that heal what stands near them. Three of the
  four Royal Guard bar the way (Tenjirō's boiling springs and spear, Kirio who
  sheds her bulk at half health, Ōetsu's rings of swords, Senjumaru's threads
  and closing cloth), each leaving a **Fragment of the Soul King**: the Right
  Arm stills everything around you, the Left Arm binds the sturdiest enemies,
  the Heart surges you back from the brink. Ichibē ends the stage with ink, and
  with Ichimonji, which silences one of your attacks for a while.
- **Wahrwelt** (unlocked by clearing the Soul King Palace): the finale. The
  Emperor has cut down the Soul King and raised the true world from his
  palace, and every world climbs up after him at once, Soul Reapers and
  Hollows together. All four defenders stand in the way every run: Renji
  Abarai (Zabimaru, fangs closing in, the bone cannon, then Sōō Zabimaru's fur
  mantle and bone arm), Rukia Kuchiki (Tsukishiro, Hakuren, then Hakka no
  Togame, white from head to foot) and Uryū Ishida (arrows and Licht Regen; his
  Antithesis turns his wounds back once, and his silver arrow silences The
  Almighty for a while) in a different order at 5:00, 10:00 and 15:00, then
  Sōsuke Aizen at 18:00, let out of Muken (Kyōka Suigetsu's copies, only one
  of them real, and Kurohitsugi). Ichigo Kurosaki ends it with Getsuga
  Tenshō, and at half health his Hollow mask.
- **Karakura Town** (unlocked by clearing the Wahrwelt): the world of the
  living, the last of the three that will not fold into the One World, and the
  hardest stage. Hollows come through Garganta into its streets, Urahara's
  empty gigai shuffle at you and his kidō sentries fire from the corners.
  Three of four defenders stand in the way, each showing more at half health:
  Yasutora Sado (El Directo, La Muerte, the Giant's arm as a shield), Orihime
  Inoue (Koten Zanshun, Santen Kesshun, and Sōten Kisshun, which raises the
  fallen around her), Yoruichi Shihōin (she flash-steps to your side and
  strikes, then Shunkō) and Isshin Kurosaki (Getsuga Tenshō and walls of
  Engetsu's fire, then a captain's haori again). Kisuke Urahara ends it:
  Nake, Shibari Benihime, Raikōhō and Danku, and at half health Kannonbiraki
  Benihime Aratame, which remakes his wounds once. Don Kanonji is the
  runaway; the music is rock.

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
npm run smoke        # after a build: plays it in headless Edge under the studio's CSP, checks every menu fits at 320, 375 and 390 points wide, screenshots to .smoke/
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
`?spoils=getsuga,haori` (hold those spoils of war),
`?bearers=raikoben,gonryo` (choose which bankai the bosses carry; in Hueco Mundo that picks the Sternritter),
`?stage=seireitei` (play a stage even if it is still locked), `?almighty`
(start with A · The Almighty), `?start=xaxis` (open the run with that Schrift),
`?res=firestorm,railgun` (own resonances), `?trial=3`, `?endless` and
`?mission=jagdarmee` (play a Story mission, with `?play`).
Add `META=max` to the balance report for a player with every upgrade, and
`MISSION=desert` to simulate a Story mission.

## How it is built

- `src/game/` is the whole simulation in plain TypeScript with no rendering, so it runs headless in tests.
- `src/data/` holds the content tables: powers with their Lv 7 attributes, passives, relics, enemies and the stages (spawn mixes, events, difficulty). New content goes here.
- `src/render/` draws with PixiJS particle containers from one texture atlas generated in code at startup. Every sprite, icon and vista then goes through the ink pass (`src/render/ink.ts`); the stage grounds are in `src/render/grounds.ts`.
- `src/fonts/` holds Anton (SIL Open Font License, text in `public/fonts/OFL-Anton.txt`), bundled so the game needs nothing from the network.
- `src/ui/` is plain DOM with an external stylesheet, laid out to fit any phone from 320 points wide; each row's colour reaches CSS through custom properties.
- No inline scripts or styles and no `eval`, so it runs under the strict Content-Security-Policy that minarankstudio.com sends.
- A service worker generated at build time precaches every file for offline play.

## Deploy

Every push to `main` builds and publishes to GitHub Pages through
`.github/workflows/deploy.yml`. The custom domain is set in the repository's
Pages settings, and DNS is a `CNAME play -> agency-wo.github.io` record on
Cloudflare, DNS only (grey cloud), so GitHub can issue the HTTPS certificate.
