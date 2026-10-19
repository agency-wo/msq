/**
 * Quincy shrines: between the bosses, a shrine offers three pacts. Each one
 * gives something real and takes something real; you may also walk away.
 * Every pact can be made once a run. The effects live in World.takePact.
 */

export interface PactDef {
  id: string;
  name: string;
  /** What you get. */
  gain: string;
  /** What it costs. */
  cost: string;
  icon: string;
  color: string;
}

export const PACTS: readonly PactDef[] = [
  { id: 'blood', name: 'Blut Arterie', gain: '+30% damage for the rest of the run.', cost: '25% less health: blood that strikes cannot also guard.', icon: 'drop', color: '#ff5a72' },
  { id: 'iron', name: 'Blut Vene', gain: '+40% health and 2 health a second.', cost: '15% less damage: blood that guards cannot also strike.', icon: 'shield', color: '#dfe7f2' },
  { id: 'haste', name: 'Hirenkyaku', gain: '+20% speed and 10% shorter cooldowns.', cost: 'Enemies move 12% faster.', icon: 'feather', color: '#9fdcff' },
  { id: 'greed', name: 'Gintō Hoard', gain: 'The run pays 60% more gold.', cost: 'Enemies are 20% sturdier.', icon: 'coin', color: '#ffd27a' },
  { id: 'offering', name: 'Auswählen', gain: 'Your strongest attack gains two levels.', cost: 'Your weakest attack loses two: taken from the unworthy, given to the chosen.', icon: 'candle', color: '#ffcb5c' },
  { id: 'hunter', name: 'Jagdarmee', gain: 'The next boss leaves an extra black chest.', cost: 'The hunting army drives it to you now.', icon: 'crown', color: '#ff8a4a' },
  { id: 'gamble', name: 'Gamble', gain: 'Even odds: a legendary relic.', cost: 'Or half your health, gone.', icon: 'reroll', color: '#c9a8ff' },
  { id: 'renewal', name: 'Renewal', gain: 'Full health and one more reroll.', cost: 'You lose your progress toward the next level.', icon: 'heart', color: '#ff9cc2' },
  { id: 'echoes', name: 'Pact of Echoes', gain: 'One more arrow, blade and strike on every attack.', cost: '20% less damage.', icon: 'twin', color: '#bfe6ff' },
  { id: 'wandenreich', name: 'Wandenreich Pact', gain: 'Level up 30% faster.', cost: 'From now on, chests hold only gold.', icon: 'banner', color: '#9fdcff' },
];

export const PACT_BY_ID: ReadonlyMap<string, PactDef> = new Map(PACTS.map((p) => [p.id, p]));

/** When the first shrine of a run appears; later ones come as random events. */
export const FIRST_SHRINE_AT = 220;
