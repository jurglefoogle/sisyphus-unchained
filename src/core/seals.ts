import { catalog } from '../content/catalog';
import {
  ALMOST_FULL_CLIMBS,
  DEVICES,
  NEMESIS_IDLE_CLIMBS,
  ATLAS_COMPLAINT_TURNS,
  WISHED_ON_A_STAR_HOUSES,
  BY_THE_BOOK_ERUPTIONS,
  CALLUSES_SUMMITS,
  OUT_OF_SIGHT_SECONDS,
  deviceDef,
  TAKES_FIVE_SECONDS,
  tabletPool,
  visitorFor,
  WHISPERS,
  type VisitorDef,
} from '../content/devices';
import { nextRandom } from './rng';

const FORM_ONE_SITE = 'olympian_approach';
import type { GameEvent, GameState, JarState, SiteState } from './state';

/**
 * Sealed devices, whispers and visitors (docs/hill-workshops-plan.md §4).
 * The deal is seeded and saved: reloading never changes a hand.
 */

/** Shuffle a hill's tablets with the saved deal stream and keep the first few. */
export function dealHand(state: GameState, siteId: string): string[] {
  const pool = tabletPool(siteId, state.appeal.number).map((d) => d.id);
  for (let i = pool.length - 1; i > 0; i--) {
    const roll = nextRandom(state.random.dealRngState);
    state.random.dealRngState = roll.state;
    const j = Math.floor(roll.value * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  // Keep on File: the device kept for this hill is always dealt (in the last, dearest slot if the shuffle missed it).
  const kept = state.prestige.filed[siteId];
  const at = kept ? pool.indexOf(kept) : -1;
  const last = catalog.devices.dealt - 1;
  if (at > last) [pool[at], pool[last]] = [pool[last], pool[at]];
  return pool.slice(0, catalog.devices.dealt);
}

function addUnique(list: string[], id: string): boolean {
  if (list.includes(id)) return false;
  list.push(id);
  return true;
}

/** Put a device to work on its hill for this run and record it in the Codex. */
export function revealDevice(state: GameState, site: SiteState, deviceId: string, events: GameEvent[]): void {
  if (!addUnique(site.devices, deviceId)) return;
  const firstTime = addUnique(state.discoveries.codexIds, deviceId);
  events.push({ type: 'DeviceRevealed', siteId: site.id, deviceId, firstTime });
  if (firstTime) noteCodex(state, events);
}

// ---------------------------------------------------------------- whispers

/** Insight a whisper pays the first time it is heard. */
export const WHISPER_INSIGHT = 1;

function hear(state: GameState, whisperId: string, events: GameEvent[]): void {
  if (!addUnique(state.discoveries.whisperIds, whisperId)) return;
  const firstTime = addUnique(state.discoveries.codexIds, whisperId);
  if (firstTime) state.prestige.giftedInsight += WHISPER_INSIGHT;
  events.push({ type: 'DeviceRevealed', siteId: deviceDef(whisperId).siteId, deviceId: whisperId, firstTime });
}

function rumour(state: GameState, whisperId: string, events: GameEvent[]): void {
  if (state.discoveries.whisperIds.includes(whisperId)) return;
  if (!addUnique(state.discoveries.rumourIds, whisperId)) return;
  const w = WHISPERS.find((x) => x.id === whisperId);
  if (w) events.push({ type: 'Rumour', whisperId, text: w.rumour });
}

/** A summit reached by hand: counts toward Calluses of Legend. */
export function noteManualSummit(state: GameState, events: GameEvent[]): void {
  state.counters.manualSummits += 1;
  const n = state.counters.manualSummits;
  if (n >= CALLUSES_SUMMITS) hear(state, 'calluses_of_legend', events);
  else if (n >= CALLUSES_SUMMITS / 2) rumour(state, 'calluses_of_legend', events);
}

/** A pause ended after `seconds`: long enough, and Sisyphus Takes Five. */
export function notePauseEnded(state: GameState, seconds: number, events: GameEvent[]): void {
  if (seconds >= TAKES_FIVE_SECONDS) hear(state, 'takes_five', events);
  else if (seconds >= TAKES_FIVE_SECONDS / 2) rumour(state, 'takes_five', events);
}

/** An eruption at full heat: counts toward By the Book. */
export function noteFullEruption(state: GameState, events: GameEvent[]): void {
  state.counters.fullEruptions += 1;
  const n = state.counters.fullEruptions;
  if (n >= BY_THE_BOOK_ERUPTIONS) hear(state, 'by_the_book', events);
  else if (n >= BY_THE_BOOK_ERUPTIONS / 2) rumour(state, 'by_the_book', events);
}

/** An absence of `seconds` with the Tartarus Rim open: long enough, and it is Out of Sight. */
export function noteAbsence(state: GameState, seconds: number, events: GameEvent[]): void {
  if (!state.empire.sites.some((s) => s.furnace)) return;
  if (seconds >= OUT_OF_SIGHT_SECONDS) hear(state, 'out_of_sight', events);
  else if (seconds >= OUT_OF_SIGHT_SECONDS / 2) rumour(state, 'out_of_sight', events);
}

/** After each pour: a long enough run at the brim is Almost Full. */
export function noteJarPour(state: GameState, jar: JarState, events: GameEvent[]): void {
  if (jar.streak >= ALMOST_FULL_CLIMBS) hear(state, 'almost_full', events);
  else if (jar.streak >= ALMOST_FULL_CLIMBS / 2) rumour(state, 'almost_full', events);
}

/** A blueprint finished: `streak` in a row with nothing sold is Perpetual Motion. */
export function noteBlueprint(state: GameState, streak: number, needed: number, events: GameEvent[]): void {
  if (streak >= needed) hear(state, 'perpetual_motion', events);
  else if (streak >= needed - 1 && streak > 0) rumour(state, 'perpetual_motion', events);
}

/** A climb at the split: enough at exactly half is Fair and Balanced. */
export function noteSplitClimb(state: GameState, climbs: number, needed: number, events: GameEvent[]): void {
  if (climbs >= needed) hear(state, 'fair_and_balanced', events);
  else if (climbs >= needed / 2) rumour(state, 'fair_and_balanced', events);
}

/** A mounted house rose while the player pushed: enough in a row is Wished on a Star. */
export function noteWish(state: GameState, streak: number, events: GameEvent[]): void {
  if (streak >= WISHED_ON_A_STAR_HOUSES) hear(state, 'wished_on_a_star', events);
  else if (streak >= WISHED_ON_A_STAR_HOUSES - 1) rumour(state, 'wished_on_a_star', events);
}

/** Atlas was asked to turn the sky. */
export function noteAtlasTurn(state: GameState, events: GameEvent[]): void {
  state.counters.atlasTurns += 1;
  const n = state.counters.atlasTurns;
  if (n >= ATLAS_COMPLAINT_TURNS) hear(state, 'atlas_complaint', events);
  else if (n >= ATLAS_COMPLAINT_TURNS / 2) rumour(state, 'atlas_complaint', events);
}

/** A climb on the Mill: long enough with nothing approved and Nemesis Notices. */
export function noteIdle(state: GameState, idle: number, events: GameEvent[]): void {
  if (idle >= NEMESIS_IDLE_CLIMBS) hear(state, 'nemesis_notices', events);
  else if (idle >= NEMESIS_IDLE_CLIMBS / 2) rumour(state, 'nemesis_notices', events);
}

/** Form 1: every tablet of the other five hills is in the Codex. */
function noteCodex(state: GameState, events: GameEvent[]): void {
  const others = DEVICES.filter((d) => d.source === 'tablet' && !d.appeal && d.siteId !== FORM_ONE_SITE);
  const known = others.filter((d) => state.discoveries.codexIds.includes(d.id)).length;
  if (known === others.length) hear(state, 'form_one', events);
  else if (known >= others.length - 5) rumour(state, 'form_one', events);
}

/** Patching down to one hole is noticed; trying to patch that one is heard. */
export function notePatch(state: GameState, holesLeft: number, triedLast: boolean, events: GameEvent[]): void {
  if (triedLast) hear(state, 'shes_using_that_one', events);
  else if (holesLeft === 1) rumour(state, 'shes_using_that_one', events);
}

// ---------------------------------------------------------------- visitors

/** The visitor waiting on this hill, if they have arrived and no bargain is taken yet this run. */
export function visitorWaiting(site: SiteState): VisitorDef | null {
  const v = visitorFor(site.id);
  if (!v || (site.productionLevel < v.arrivesAt && !site.summoned)) return null;
  return v.bargains.some((b) => site.devices.includes(b)) ? null : v;
}

/** Announce a visitor when the crew first reaches them this run. */
export function checkVisitor(site: SiteState, levelBefore: number, events: GameEvent[]): void {
  const v = visitorFor(site.id);
  if (v && levelBefore < v.arrivesAt && site.productionLevel >= v.arrivesAt && visitorWaiting(site)) {
    events.push({ type: 'VisitorArrived', siteId: site.id, visitorId: v.id });
  }
}
