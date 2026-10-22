import { cooldown } from '../game/casts/common';
import { BASE_HP, CDR_CAP } from '../game/stats';
import type { World } from '../game/world';

/**
 * The pause screen's stat sheet: what the Emperor's numbers are right now,
 * every bonus and every power, in words a player reads at a glance.
 */

export interface StatTile {
  label: string;
  value: string;
  /** A line under the value: what it comes to, a cap reached. */
  note?: string;
}

export interface PowerStatRow {
  name: string;
  icon: string;
  color: string;
  letter?: string;
  level: number;
  /** One hit before a critical, with every bonus in; "—" for powers that do not strike. */
  hit: string;
  /** Seconds between casts after cooldown reduction; "—" for powers that are always on. */
  every: string;
}

/** 1.2, 12, 1.2k: compact numbers. */
function num(n: number): string {
  if (n >= 1e4) return `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}k`;
  if (n >= 100) return String(Math.round(n));
  if (n >= 10) return n.toFixed(1).replace(/\.0$/, '');
  return n.toFixed(2).replace(/0$/, '').replace(/\.0$/, '');
}

/** Health as a whole number that never reads above the maximum shown beside it, nor 0 while you still stand. */
export function health(hp: number, max: number): number {
  const m = Math.round(max);
  if (hp <= 0) return 0;
  return Math.max(1, Math.min(m, Math.round(hp)));
}

/** +12%, −8%, 0%. */
function pct(x: number): string {
  const v = Math.round(x * 100);
  if (v === 0) return '0%';
  return `${v > 0 ? '+' : '−'}${Math.abs(v)}%`;
}

export function statSheet(w: World): StatTile[] {
  const s = w.stats;
  const p = w.player;
  const buffs: string[] = [];
  if (w.vollT > 0) buffs.push('Vollständig');
  if (w.superT > 0) buffs.push('Superstar');
  if (w.surgeT > 0) buffs.push('the Heart');
  return [
    { label: 'Attack', value: String(Math.round(s.atk)), note: `every hit ×${num(w.dmgMul)}${buffs.length ? ` with ${buffs.join(', ')}` : ''}` },
    { label: 'Critical hits', value: `${Math.round(s.critChance * 100)}%`, note: `×${num(s.critMult)} damage` },
    { label: 'Cooldowns', value: s.cdr > 0 ? `−${Math.round(s.cdr * 100)}%` : '0%', note: s.cdr >= CDR_CAP - 1e-6 ? 'at the cap' : `the cap is −${Math.round(CDR_CAP * 100)}%` },
    { label: 'Health', value: `${health(p.hp, p.maxHp)} / ${Math.round(p.maxHp)}`, note: s.regen > 0 ? `+${num(s.regen)} a second` : `base ${BASE_HP}` },
    { label: 'Damage taken', value: pct(s.dmgTaken - 1) },
    { label: 'Extra shots', value: `+${s.count}` },
    { label: 'Size', value: pct(s.size - 1) },
    { label: 'Duration', value: pct(s.duration - 1) },
    { label: 'Projectile speed', value: pct(s.projSpeed - 1) },
    { label: 'Move speed', value: pct(s.moveSpeed - 1) },
    { label: 'Pickup range', value: pct(s.pickup - 1) },
    { label: 'Mana gain', value: pct(s.xpGain - 1) },
  ];
}

export function powerRows(w: World): PowerStatRow[] {
  return w.powers.map((ps) => {
    const st = ps.stats;
    return {
      name: ps.def.name,
      icon: ps.def.icon,
      color: ps.def.color,
      letter: ps.def.letter,
      level: ps.level,
      hit: st.damage > 0 ? num(st.damage * w.dmgMul) : '—',
      every: st.cooldown > 0 ? `${num(cooldown(w, st.cooldown))} s` : '—',
    };
  });
}
