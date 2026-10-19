/**
 * First-time tips: one line the first time each system shows up. Board tips
 * sit on the board itself; the rest float near the bottom for a few seconds
 * while the run goes on. Each is shown once (Settings can bring them back).
 */
export const TIPS = {
  move: 'Drag anywhere to move. Your powers fire on their own: just stay alive.',
  levelup: 'Pick one card. Powers level up to Lv 7, then awaken.',
  awaken: 'Lv 7: choose how this Schrift awakens. It changes how the power works.',
  resonance: 'Two awakened Schrift resonate: take it and both keep working, now tied together.',
  chest: 'Chests hold relics: pick one. Black chests from bosses hold better ones.',
  shrine: 'A pact gives something real and takes something real. You can always walk away.',
  boss: 'A boss: its attacks are marked on the ground first. Beat it and walk over what it drops.',
  event: 'Events break the rhythm between bosses. The banner says what to do.',
  rush: 'Blut Rush: keep killing without being hit for more damage and speed.',
  evolve: 'The more power the Emperor takes back, the more he changes.',
  fragment: 'Fragments of the Soul King level up through cards, like bankai.',
  seal: 'Ichimonji: a sealed attack is greyed out in your tray until its name comes back.',
} as const;

export type TipId = keyof typeof TIPS;

export const TIP_IDS = Object.keys(TIPS) as TipId[];
