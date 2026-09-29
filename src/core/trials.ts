import { catalog } from '../content/catalog';
import type { SiteState } from './state';

/**
 * Trials (docs/hill-workshops-plan.md §9, How 5): each decree also asks a
 * feat of the frontier hill's machine. Progress is per run and only rises;
 * it counts climbs, eruptions and casts, never seconds, so it settles offline
 * exactly like everything else.
 */

/** Feats needed on this hill before its successor's decree, or 0 for none. */
export function trialNeeded(siteId: string): number {
  return (catalog.trials.needed as Record<string, number>)[siteId] ?? 0;
}

export function trialProgress(site: SiteState): number {
  return site.trial;
}

export function trialMet(site: SiteState): boolean {
  return trialProgress(site) >= trialNeeded(site.id);
}

/** One impact on this hill: count it toward the trial if it qualifies. */
export function trialClimb(site: SiteState, skyEntered: boolean): void {
  const t = catalog.trials;
  // The furnace and the foundry keep their own counts; the trial follows them.
  if (site.furnace) site.trial = Math.max(site.trial, site.furnace.eruptions);
  else if (site.foundry) site.trial = Math.max(site.trial, site.foundry.finished);
  else if (site.id === catalog.sites[0].id && site.counterweight !== null) site.trial += 1;
  else if (site.jar && site.jar.peak >= t.jarHigh) site.trial += 1;
  else if (site.sky && skyEntered && site.sky.houses.filter(Boolean).length >= t.skyMounted) site.trial += 1;
}

/** Batched offline cycles on the First Hill: the counterweight hangs throughout or not at all. */
export function trialCycles(site: SiteState, cycles: number): void {
  if (site.id === catalog.sites[0].id && site.counterweight !== null) site.trial += cycles;
}

/** What the trial asks, for the decree row. */
export function trialText(site: SiteState): string {
  const n = trialNeeded(site.id);
  const t = catalog.trials;
  if (site.furnace) return `${n} eruptions of Ixion's Wheel`;
  if (site.foundry) return `${n} blueprints cast`;
  if (site.jar) return `${n} climbs with the jar at least ${Math.round(t.jarHigh * 100)}% full`;
  if (site.sky) return `${n} houses rising with ${t.skyMounted} or more constellations mounted`;
  return `${n} climbs with the counterweight hung`;
}
