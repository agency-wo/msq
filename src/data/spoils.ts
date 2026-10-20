import type { RelicDef } from './relics';

/**
 * Spoils of war: every boss leaves something of its own when it falls, and
 * nothing else in the game does what it does. A spoil works like a relic for
 * the rest of the run; it never turns up in a chest. Once won, it stays in
 * the Codex and in the Armory, and any run but the Daily Trial can start with
 * it. `boss` is the Codex key of the one who leaves it.
 */
const spoil = (boss: string, id: string, name: string, color: string, icon: string, desc: string, extra: Partial<RelicDef> = {}): RelicDef => ({
  id: `spoil-${id}`,
  name,
  desc,
  rarity: 'legendary',
  icon,
  boss,
  color,
  special: id as RelicDef['special'],
  ...extra,
});

export const SPOILS: readonly RelicDef[] = [
  // Hueco Mundo
  spoil('bearer:senbonzakura', 'fearthorn', 'Äs Nödt’s Thorn', '#b89ad8', 'thorn', 'When you are hit, fear takes everything near you: it cannot move for 1.5 s.'),
  spoil('bearer:hyorinmaru', 'ironscale', 'Cang Du’s Iron Scale', '#b8c2d2', 'shield', 'For 2 s after every hit you take, your skin is iron: 60% less damage.'),
  spoil('bearer:raikoben', 'datacore', 'BG9’s Data Core', '#ffd27a', 'gear', 'The longer a boss fights you, the better you know it: +3% damage to it every 10 s, up to +30%.'),
  spoil('bearer:tengen', 'spark', 'Bambietta’s Spark', '#ff9a4a', 'bomb', 'One in eight enemies you kill explodes, hurting everything around it.'),
  spoil('bearer:gonryo', 'tally', 'Driscoll’s Tally', '#fff3a0', 'might', 'Every boss you defeat this run: +8% damage, up to six.'),
  spoil('ayon', 'horn', 'Ayon’s Antler', '#c8863a', 'helm', 'Every 50 kills: +1 max health for the rest of the run, up to +50.'),
  spoil('nel', 'cerodoble', 'Neliel’s Mask', '#5ad8b0', 'eye', 'Cero Doble: every sixth enemy shot that would hit you is swallowed and spat back as a Cero.'),
  spoil('harribel', 'lagota', 'Tiburón’s Drop', '#5ac8ff', 'drop', 'La Gota: your critical hits splash, hurting everything around what they hit.'),
  // Seireitei
  spoil('captain:senbonzakura', 'scarf', 'Byakuya’s Silver Scarf', '#ff9cc2', 'banner', 'Ginpaku Kazahana no Usuginu, worth ten manors: this run pays 50% more gold.'),
  spoil('captain:hyorinmaru', 'iceflower', 'Hitsugaya’s Ice Flower', '#8fd8ff', 'snow', 'When you fall below half health, everything near you freezes for 3 s. Once every 30 s.'),
  spoil('captain:raikoben', 'stinger', 'Suzumebachi’s Stinger', '#e8c34a', 'strike', 'Every 5 s your next blow leaves the Hōmonka; strike the mark again and a common enemy dies at once (a boss loses 3%).'),
  spoil('captain:tengen', 'tengen', 'Tengen’s Gauntlet', '#c9b58a', 'glove', 'Every 10 s, Tengen’s giant blade comes down in front of you.'),
  spoil('captain:gonryo', 'teacup', 'Sasakibe’s Teacup', '#fff3a0', 'cross', 'Whenever a boss arrives, a moment for tea: you heal a quarter of your health.'),
  spoil('unohana', 'balm', 'Minazuki’s Balm', '#9fe6c0', 'heart', 'Regenerate 1.5 health every second.', { mods: { regen: 1.5 } }),
  spoil('commander', 'ember', 'Ryūjin Jakka’s Ember', '#ff7a3c', 'flame', 'The heat clings to you: everything that comes close burns.'),
  // Silbern
  spoil('gotei:kenpachi', 'eyepatch', 'Kenpachi’s Eyepatch', '#ffe08a', 'eye', 'Off for a real fight: +35% damage while a boss is out, 10% less while none is.'),
  spoil('gotei:mayuri', 'vial', 'Mayuri’s Vial', '#9dff8a', 'cloud', 'Ashisogi Jizō’s poison: one hit in ten leaves a common enemy unable to move for 2 s.'),
  spoil('gotei:shinji', 'mask', 'Shinji’s Hollow Mask', '#ffb8e0', 'helm', 'Nothing can slow you, root you or turn you around.'),
  spoil('gotei:kensei', 'tachikaze', 'Tachikaze’s Knuckle', '#cfe6ff', 'gust', 'As you move, blades of wind cut whatever follows behind you.'),
  spoil('kyoraku', 'haori', 'Kyōraku’s Flowered Haori', '#ff9ac8', 'feather', 'Once every 30 s, a blow that would take a quarter of your health or more slides off.'),
  // Soul King Palace
  spoil('royal:tenjiro', 'spring', 'A Flask of Kirinden Water', '#8fe0ff', 'drop', 'Stand still and the springs heal you: 3% of your health every second.'),
  spoil('royal:kirio', 'riceball', 'Kirio’s Rice Ball', '#ffb38a', 'heart', 'Every level-up heals you 10% and adds 2 max health, up to +60.'),
  spoil('royal:oetsu', 'whetstone', 'Ōetsu’s Whetstone', '#ffe08a', 'blade', 'Every awakened Schrift (Lv 7) strikes 12% harder.'),
  spoil('royal:senjumaru', 'robe', 'Senjumaru’s Woven Robe', '#d8b8ff', 'wing', 'Woven by the Great Weaver: take 12% less damage and move 12% faster.', {
    mods: { dmgTaken: -0.12, moveSpeed: 0.12 },
  }),
  spoil('ichibe', 'brush', 'Ichimonji’s Brush', '#9a7aff', 'book', 'Every 20 s, ink takes the name of the sturdiest enemy in sight: it takes double damage for 6 s.'),
  // Wahrwelt
  spoil('defender:renji', 'taiho', 'Zabimaru’s Fang', '#ff6a4a', 'beam', 'Hikotsu Taihō: every 14 s, the bone cannon fires through the thickest crowd.'),
  spoil('defender:rukia', 'tsukishiro', 'Sode no Shirayuki’s Ribbon', '#cfeeff', 'snow', 'Tsukishiro: every 10 s, the ground under the thickest crowd freezes and cuts.'),
  spoil('defender:uryu', 'arrowhead', 'Uryū’s Silver Arrowhead', '#e8eef8', 'arrow', 'Counts as one more toward The Almighty, and cooldowns -5%.', { mods: { cdr: 0.05 } }),
  spoil('defender:aizen', 'hogyoku', 'The Hōgyoku', '#b89aff', 'star', 'Once a run, when you fall to a quarter of your health, it answers: you heal fully and strike 15% harder from then on.'),
  spoil('ichigo', 'getsuga', 'Zangetsu’s Edge', '#ff6a3c', 'blade', 'Every 8 s, Getsuga Tenshō: a crescent of black power flies where you are heading.'),
];

export const SPOIL_BY_BOSS: ReadonlyMap<string, RelicDef> = new Map(SPOILS.map((s) => [s.boss ?? '', s]));
export const SPOIL_IDS: ReadonlySet<string> = new Set(SPOILS.map((s) => s.id));
