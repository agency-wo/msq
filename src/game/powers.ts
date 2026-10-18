import { upgradeCap, type PowerDef, type PowerStats } from '../data/powers';
import { castGonryo, castHyorinmaru, castRaikoben, castSenbonzakura, castTengen, castZanka, respawnPetals, syncHeatAura } from './casts/bankai';
import {
  castBeam,
  castBolt,
  castCloud,
  castDrones,
  castGust,
  castJet,
  castLob,
  castMeteor,
  castOrbit,
  castPulse,
  castStrike,
  castThorns,
  respawnBlades,
  respawnDrones,
} from './casts/schrift';
import { castIron, castOverkill, castSuperstar, castVollstandig } from './casts/utility';
import type { World } from './world';

/** Runtime state of one owned power. */
export interface PowerState {
  def: PowerDef;
  level: number;
  /** Lv 7 attribute id, or null. */
  attr: string | null;
  stats: PowerStats;
  timer: number;
  /** Second timer for powers with two rhythms (rapid fire, lightning bolts). */
  timer2: number;
  counter: number;
  /** Orbiters: current spin angle. */
  angle: number;
  /** Orbiters: seconds they stay out (Infinity for permanent ones); 0 while resting. */
  active: number;
}

export function computePowerStats(def: PowerDef, level: number): PowerStats {
  const s: PowerStats = { ...def.base };
  const top = Math.min(level, upgradeCap(def));
  for (let l = 2; l <= top; l++) {
    const add = def.levels[l - 2]?.add;
    if (!add) continue;
    for (const key of Object.keys(add) as (keyof PowerStats)[]) s[key] += add[key] ?? 0;
  }
  return s;
}

export function newPowerState(def: PowerDef): PowerState {
  return { def, level: 1, attr: null, stats: computePowerStats(def, 1), timer: 0.35, timer2: 0.5, counter: 0, angle: 0, active: 0 };
}

export function refreshPowerStats(ps: PowerState): void {
  ps.stats = computePowerStats(ps.def, ps.level);
}

export function updatePowers(w: World): void {
  for (let slot = 0; slot < w.powers.length; slot++) {
    const ps = w.powers[slot];
    switch (ps.def.kind) {
      case 'bolt':
        castBolt(w, ps, slot);
        break;
      case 'orbit':
        castOrbit(w, ps, slot);
        break;
      case 'pulse':
        castPulse(w, ps);
        break;
      case 'strike':
        castStrike(w, ps);
        break;
      case 'beam':
        castBeam(w, ps);
        break;
      case 'lob':
        castLob(w, ps, slot);
        break;
      case 'jet':
        castJet(w, ps);
        break;
      case 'meteor':
        castMeteor(w, ps);
        break;
      case 'thorns':
        castThorns(w, ps, slot);
        break;
      case 'gust':
        castGust(w, ps);
        break;
      case 'cloud':
        castCloud(w, ps);
        break;
      case 'drones':
        castDrones(w, ps, slot);
        break;
      case 'iron':
        castIron(w, ps);
        break;
      case 'superstar':
        castSuperstar(w, ps);
        break;
      case 'overkill':
        castOverkill(w, ps);
        break;
      case 'vollstandig':
        castVollstandig(w, ps);
        break;
      case 'senbonzakura':
        castSenbonzakura(w, ps);
        break;
      case 'hyorinmaru':
        castHyorinmaru(w, ps, slot);
        break;
      case 'raikoben':
        castRaikoben(w, ps);
        break;
      case 'tengen':
        castTengen(w, ps);
        break;
      case 'gonryo':
        castGonryo(w, ps);
        break;
      case 'zanka':
        castZanka(w, ps);
        break;
    }
  }
}

/** Rebuild whatever a power keeps in the world (orbiters, auras) after it levels or global size/count change. */
export function syncPower(w: World, slot: number): void {
  const ps = w.powers[slot];
  if (!ps) return;
  switch (ps.def.kind) {
    case 'orbit':
      if (ps.active > 0) respawnBlades(w, slot);
      break;
    case 'drones':
      respawnDrones(w, slot);
      break;
    case 'senbonzakura':
      respawnPetals(w, slot);
      break;
    case 'zanka':
      syncHeatAura(w, slot);
      break;
    default:
      break;
  }
}
