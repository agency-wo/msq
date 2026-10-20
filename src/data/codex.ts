import { BANKAI_BY_ID, BANKAI_IDS } from './bankai';
import { ENEMY_INDEX, ENEMY_LIST, type EnemyId } from './enemies';
import { GOTEI_BY_ID, GOTEI_IDS } from './gotei';
import { HERO_BY_ID, HERO_IDS } from './heroes';
import { ARRANCAR_BY_ID, ARRANCAR_IDS } from './arrancar';
import { POWER_BY_ID } from './powers';
import { ROYAL_BY_ID, ROYAL_IDS } from './royal';

/**
 * The Codex's book of enemies: everything you can face, by stage, with the
 * named bosses (each bearer, captain and guardian) as entries of their own.
 * An entry opens once you have defeated it.
 */

export type CodexSection = 'hueco' | 'seireitei' | 'lasnoches' | 'silbern' | 'palace' | 'wahrwelt' | 'events';

export interface CodexEnemy {
  /** Kill-count key: an enemy id, or `bearer:zanka`, `captain:tengen`, `royal:kirio`. */
  key: string;
  name: string;
  section: CodexSection;
  /** For the portrait. */
  type: number;
  variant: number;
  boss: boolean;
}

/** The key a kill is counted under: named bosses by who they are, everything else by kind. */
export function enemyKey(type: number, variant: number): string {
  const id = ENEMY_LIST[type]?.id ?? '';
  if (id === 'bearer' || id === 'captain') return `${id}:${BANKAI_IDS[variant] ?? ''}`;
  if (id === 'royal') return `royal:${ROYAL_IDS[variant] ?? ''}`;
  if (id === 'gotei') return `gotei:${GOTEI_IDS[variant] ?? ''}`;
  if (id === 'defender') return `defender:${HERO_IDS[variant] ?? ''}`;
  if (id === 'arrancar') return `arrancar:${ARRANCAR_IDS[variant] ?? ''}`;
  return id;
}

function plain(id: EnemyId, section: CodexSection): CodexEnemy {
  const type = ENEMY_INDEX[id];
  return { key: id, name: ENEMY_LIST[type].name, section, type, variant: 0, boss: !!ENEMY_LIST[type].boss };
}

export const CODEX_ENEMIES: readonly CodexEnemy[] = [
  ...(['hollow', 'hound', 'brute', 'volatile'] as const).map((id) => plain(id, 'hueco')),
  // The Sternritter who stole a bankai (Zanka no Tachi was never a knight's).
  ...BANKAI_IDS.filter((b) => b !== 'zanka').map((b) => ({
    key: `bearer:${b}`,
    name: `${BANKAI_BY_ID.get(b)?.thief ?? b} (${POWER_BY_ID.get(b)?.name ?? b})`,
    section: 'hueco' as const,
    type: ENEMY_INDEX.bearer,
    variant: BANKAI_IDS.indexOf(b),
    boss: true,
  })),
  plain('ayon', 'hueco'),
  plain('nel', 'hueco'),
  plain('harribel', 'hueco'),
  ...(['officer', 'flash', 'caster', 'guard', 'ashen'] as const).map((id) => plain(id, 'seireitei')),
  ...BANKAI_IDS.filter((b) => b !== 'zanka').map((b) => ({
    key: `captain:${b}`,
    name: BANKAI_BY_ID.get(b)?.owner ?? b,
    section: 'seireitei' as const,
    type: ENEMY_INDEX.captain,
    variant: BANKAI_IDS.indexOf(b),
    boss: true,
  })),
  plain('unohana', 'seireitei'),
  plain('commander', 'seireitei'),
  ...(['numeros', 'exequias', 'gillian'] as const).map((id) => plain(id, 'lasnoches')),
  ...ARRANCAR_IDS.map((id, v) => ({
    key: `arrancar:${id}`,
    name: ARRANCAR_BY_ID.get(id)?.name ?? id,
    section: 'lasnoches' as const,
    type: ENEMY_INDEX.arrancar,
    variant: v,
    boss: true,
  })),
  plain('grimmjow', 'lasnoches'),
  ...(['brawler', 'specimen', 'jizo'] as const).map((id) => plain(id, 'silbern')),
  ...GOTEI_IDS.map((g, v) => ({
    key: `gotei:${g}`,
    name: GOTEI_BY_ID.get(g)?.name ?? g,
    section: 'silbern' as const,
    type: ENEMY_INDEX.gotei,
    variant: v,
    boss: true,
  })),
  plain('kyoraku', 'silbern'),
  ...(['inkwisp', 'inkling', 'sentinel', 'weaver', 'asauchi', 'attendant'] as const).map((id) => plain(id, 'palace')),
  ...ROYAL_IDS.map((r, v) => ({
    key: `royal:${r}`,
    name: ROYAL_BY_ID.get(r)?.name ?? r,
    section: 'palace' as const,
    type: ENEMY_INDEX.royal,
    variant: v,
    boss: true,
  })),
  plain('ichibe', 'palace'),
  ...HERO_IDS.map((d, v) => ({
    key: `defender:${d}`,
    name: HERO_BY_ID.get(d)?.name ?? d,
    section: 'wahrwelt' as const,
    type: ENEMY_INDEX.defender,
    variant: v,
    boss: true,
  })),
  plain('ichigo', 'wahrwelt'),
  plain('rift', 'events'),
  plain('golden', 'events'),
];

export const CODEX_ENEMY_KEYS: ReadonlySet<string> = new Set(CODEX_ENEMIES.map((e) => e.key));
