import { catalog } from '../content/catalog';
import { Money } from './money';
import type { GameEvent, GameState } from './state';

/**
 * Launch achievements (spec §03). Each is a milestone or a joke: a stamp and an
 * archive entry, never a multiplier. Triggers read authoritative state only,
 * so load, import and offline settlement reconcile anything missed.
 */
export interface AchievementDef {
  id: string;
  earned: (s: GameState) => boolean;
}

const MILLION = Money.of(1e6);
const BILLION = Money.of(1e9);
const TRILLION = Money.of(1e12);

const anyLevel = (s: GameState, level: number) => s.empire.sites.some((site) => site.productionLevel >= level);
const workBought = (id: string) => (s: GameState) =>
  s.empire.purchasedWorkIds.includes(id) || s.discoveries.seenWorkIds.includes(id);

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_summit', earned: (s) => s.counters.totalClimbs >= 1 },
  { id: 'first_return', earned: (s) => s.counters.totalImpacts >= 1 },
  { id: 'first_purchase', earned: (s) => s.discoveries.tutorialIds.includes('first_level') || anyLevel(s, 2) },
  { id: 'ten_levels', earned: (s) => anyLevel(s, 10) },
  { id: 'first_wheel', earned: (s) => s.empire.sites.some((site) => site.wheelCharged) },
  { id: 'first_auto', earned: (s) => s.empire.foremanOwned },
  { id: 'first_hermes', earned: workBought('hermes') },
  { id: 'first_expansion', earned: (s) => s.empire.sites.length >= 2 },
  { id: 'first_daedalus', earned: workBought('daedalus') },
  { id: 'first_ixion', earned: workBought('ixion') },
  { id: 'first_danaids', earned: workBought('danaids') },
  { id: 'first_talos', earned: workBought('talos') },
  { id: 'first_atlas', earned: workBought('atlas') },
  { id: 'first_relic', earned: (s) => s.discoveries.relicIds.length >= 1 },
  { id: 'full_relics', earned: (s) => catalog.relics.catalog.every((r) => s.discoveries.relicIds.includes(r.id)) },
  // Begin Again only runs with a positive award, so completed runs count awards.
  { id: 'first_prestige', earned: (s) => s.counters.totalRuns >= 1 },
  { id: 'record_prestige', earned: (s) => s.counters.totalRuns >= 2 },
  {
    id: 'old_site_50',
    earned: (s) => s.empire.sites.length >= 2 && (s.empire.sites.find((x) => x.id === catalog.sites[0].id)?.productionLevel ?? 0) >= 50,
  },
  { id: 'million', earned: (s) => s.wallet.runGross.gte(MILLION) },
  { id: 'billion', earned: (s) => s.wallet.runGross.gte(BILLION) },
  { id: 'trillion', earned: (s) => s.wallet.runGross.gte(TRILLION) },
  { id: 'all_sites', earned: (s) => s.empire.sites.length >= catalog.sites.length },
  { id: 'level_100', earned: (s) => anyLevel(s, 100) },
  { id: 'charter', earned: workBought('charter') },
];

/** Record every achievement the state now satisfies; returns how many were new. */
export function reconcileAchievements(state: GameState, events: GameEvent[]): number {
  const owned = state.discoveries.achievementIds;
  let added = 0;
  for (const a of ACHIEVEMENTS) {
    if (owned.includes(a.id) || !a.earned(state)) continue;
    owned.push(a.id);
    events.push({ type: 'AchievementUnlocked', achievementId: a.id });
    added++;
  }
  return added;
}
