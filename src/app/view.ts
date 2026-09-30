import { catalog, siteDef, type WorkDef } from '../content/catalog';
import type { MachineRecap } from '../core/offline';
import { currencyOf, priced } from '../content/currency';
import { appealDef, deviceDef, remembranceFor, tabletPool, visitorFor } from '../content/devices';
import { charterSigned } from '../core/commands';
import { visitorWaiting } from '../core/seals';
import { modifiers } from '../core/effects';
import { canVent, eruptionClimbs, eruptionPower, shownHeat } from '../core/furnace';
import { bestHoles, bestTarget } from '../core/jar';
import { blueprintSize, pouring } from '../core/foundry';
import { activeEdict, clerkCost, clerksToMatch, filing, formValue, statute, throughput } from '../core/bureau';
import { canTurn, climbsPerHouse, houseOf, isConstellation, nextMounted, overhead } from '../core/sky';
import { trialMet, trialNeeded, trialProgress, trialText } from '../core/trials';
import { capitalize, HILLS } from '../content/hills';
import { t } from '../content/strings';
import { formatDuration, formatMoney, formatMultiplier, formatRate, formatTimes, setNotation } from '../core/format';
import {
  ascentSeconds,
  availableInsight,
  bulkCost,
  currentLevel,
  cyclePayout,
  decreeProgress,
  empireIncomePerSecond,
  flywheelCost,
  flywheelFactor,
  bestTrim,
  bestVent,
  drillCost,
  flywheelOffered,
  trackOpen,
  counterweightCost,
  counterweightUnlocked,
  flywheelUnlocked,
  foremanUnlocked,
  frontierSite,
  tabletCost,
  tabletLevel,
  insightFactor,
  isAutomated,
  levelCap,
  levelsToMilestone,
  maxAffordable,
  nextMilestone,
  nextPreludeUpgrade,
  nextRecordTarget,
  nextUnownedSite,
  preludeActive,
  preludeReach,
  prestigeRecord,
  spendableInsight,
  steadyIncomePerSecond,
  stewardCost,
  stewardInsightCost,
  scornCost,
  scornOpen,
  stewardOffered,
  strengthLevelEffective,
  type LevelTrack,
  gateOf,
  unlockCostOf,
  workCostOf,
} from '../core/formulas';
import { Money } from '../core/money';
import { cloneSite, findSite } from '../core/sim';
import type { GameState, SiteState } from '../core/state';

/** Everything the DOM needs, formatted. The UI never does money math. */

export interface BuyOption {
  label: string;
  count: number;
  cost: string;
  affordable: boolean;
}

export type RowAction =
  | { kind: 'levels'; track: LevelTrack }
  | { kind: 'flywheel' }
  | { kind: 'foreman' }
  | { kind: 'work'; workId: string }
  | { kind: 'site'; siteId: string }
  | { kind: 'upgrade'; upgradeId: string }
  | { kind: 'prelude'; upgradeId: string }
  | { kind: 'prestige' }
  | { kind: 'steward'; paidWith: 'local' | 'insight' }
  | { kind: 'stewardOrder' }
  | { kind: 'counterweight' }
  /** Option counts are the change in stones. */
  | { kind: 'trim' }
  | { kind: 'seal'; index: number }
  /** Option counts index the visitor's bargains. */
  | { kind: 'bargain' }
  | { kind: 'vent' }
  /** Option counts are steps of 5 percent heat. */
  | { kind: 'ventAt' }
  /** Option counts: +1 drills, -1 patches. */
  | { kind: 'jar' }
  /** Option counts are steps of 5 percent of the jar. */
  | { kind: 'jarTarget' }
  /** Option counts are tenths of the split. */
  | { kind: 'split' }
  /** Index into the Foundry's queue. */
  | { kind: 'pourNext'; index: number }
  | { kind: 'turn' }
  /** Index among the revealed constellations; option counts move a house (0 mounts or takes down). */
  | { kind: 'mount'; index: number }
  /** Option counts move clerks to (+1) or from (-1) their desks. */
  | { kind: 'duty' }
  | { kind: 'clerk' }
  | { kind: 'summon' }
  | { kind: 'appeal' };

export interface PurchaseRow {
  key: string;
  title: string;
  level?: string;
  effect: string;
  note?: string;
  cost?: string;
  /** The money `cost` and `options` are in: a hill's currency id, or 'insight'. */
  currency?: string;
  /** The button's word when it is not Buy. */
  verb?: string;
  affordable: boolean;
  disabled?: boolean;
  wait?: string;
  action: RowAction;
  options?: BuyOption[];
  accent?: 'machine' | 'work' | 'decree' | 'insight' | 'grip' | 'seal';
  progress?: number;
  /** Library asset id for the row's symbol (see world/library.ts). */
  icon?: string;
  /** Goal key when this purchase can be pinned; `pinned` when it is the goal. */
  pinKey?: string;
  pinned?: boolean;
}

const TRACK_ICONS: Record<LevelTrack, string> = { production: 'ui_milestone', strength: 'ui_strength', impact: 'ui_impact' };

function rowIcon(row: PurchaseRow): string {
  const a = row.action;
  switch (a.kind) {
    case 'levels':
      return TRACK_ICONS[a.track];
    case 'flywheel':
      return 'ui_wheel';
    case 'foreman':
      return 'ui_foreman';
    case 'work':
      return `work_${a.workId}`;
    case 'site':
      return row.key.startsWith('decree-') ? 'ui_decree' : 'ui_empire';
    case 'upgrade':
      return `upgrade_${a.upgradeId}`;
    case 'prelude':
      return 'ui_push';
    case 'prestige':
      return 'ui_prestige';
    case 'steward':
    case 'stewardOrder':
      return 'ui_foreman';
    case 'counterweight':
    case 'trim':
      return TRACK_ICONS.strength;
    case 'seal':
      return 'ui_lock';
    case 'summon':
      return 'ui_insight';
    case 'appeal':
      return 'ui_decree';
    case 'bargain':
      return 'ui_decree';
    case 'vent':
    case 'ventAt':
    case 'jar':
    case 'jarTarget':
    case 'split':
      return TRACK_ICONS.impact;
    case 'pourNext':
    case 'mount':
      return 'ui_decree';
    case 'turn':
    case 'duty':
    case 'clerk':
      return TRACK_ICONS.impact;
  }
}

export interface InsightShopRow {
  id: string;
  title: string;
  effect: string;
  cost: number;
  /** Upgrades are bought in order: owned, the one on offer, or waiting on an earlier one. */
  state: 'owned' | 'next' | 'locked';
  affordable: boolean;
  /** The earlier upgrade a locked one waits for. */
  after?: string;
  pinned: boolean;
}

/** One hill in the Insight menu: its Remembrance rank and the device kept on file. */
export interface MemoryRow {
  siteId: string;
  hill: string;
  name: string;
  rule: string;
  rank: number;
  maxRank: number;
  /** Insight for the next rank, or null at the top. */
  cost: number | null;
  affordable: boolean;
  /** Keep on File: open once for `fileCost`; choosing after that is free. */
  fileOpen: boolean;
  fileCost: number;
  fileAffordable: boolean;
  filed: string | null;
  /** Revealed tablets of this hill that could be kept on file. */
  choices: { id: string; name: string }[];
}

/** The viewed hill's machine at a glance, for the tablet (plan §8). */
export interface MachineGauge {
  label: string;
  /** Fill, 0..1. */
  value: number;
  /** Where the fill is headed or best held (the vent point, the jar's hold), 0..1. */
  mark: number | null;
  text: string;
  /** Something is happening now: erupting, ripe, a blueprint waiting. */
  hot: boolean;
}

/** The next Appeal, for its review before filing. */
export interface AppealOffer {
  number: number;
  name: string;
  rule: string;
  gates: string;
  works: string;
  /** The stakes: every crew's pay under this Appeal, before laurels. */
  pay: string;
  award: number;
  /** What one more laurel multiplies every crew by, and what all of them will. */
  laurel: string;
  laurelsTotal: string;
}

export interface PurseView {
  amount: string;
  /** Currency id; also names the coin art. */
  currency: string;
  name: string;
  glyph: string;
}

export interface GameView {
  revision: number;
  /** The viewed hill's own purse. */
  purse: PurseView;
  /** The viewed hill's income, in its currency. */
  rate: string;
  automated: boolean;
  paused: boolean;
  insight: number;
  /** Every permanent upgrade in order, for the Insight menu. */
  insightShop: InsightShopRow[];
  gauge: MachineGauge | null;
  /** Offered once the Charter is signed in this run. */
  appealOffer: AppealOffer | null;
  /** The Appeal being fought, if any, and laurels won. */
  appeal: { number: number; name: string; rule: string; laurels: number } | null;
  /** Remembrances and files, one per hill held in any run. */
  memory: MemoryRow[];
  /** Scorn, once the Charter has been signed: ranks owned, the pay they give, and the next rank's price. */
  scorn: { rank: number; pay: string; next: string; cost: number; affordable: boolean } | null;
  /** The Insight menu appears once any Insight has been awarded. */
  insightMenu: boolean;
  /** The permanent income factor from lifetime Insight. */
  insightFactor: string;
  site: {
    id: string;
    name: string;
    level: number;
    nextMilestone: number | null;
    milestoneProgress: number;
    prevId: string | null;
    nextId: string | null;
    ownedCount: number;
    wheelOwned: boolean;
    wheelCharged: boolean;
    crew: string;
    steward: string | null;
    /** Devices at work here this run, and whispers heard on this hill. */
    devices: { id: string; name: string; rule: string; quip: string }[];
  };
  decree: { name: string; progress: number; ready: boolean; shown: boolean } | null;
  /** The opening, while the stone still slips. */
  prelude: { active: boolean; reach: number; best: number; attempts: number };
  objective: string;
  /** Progress marker for the objective line (the pinned goal's affordability). */
  objectiveProgress: number | null;
  goal: GoalView | null;
  /** Three horizons keep the immediate action and the larger discovery visible together. */
  goalStack: { now: string; next: string; beyond: string };
  /** The first worthwhile Begin Again, offered once and dismissible (spec §01). */
  suggestPrestige: boolean;
  empire: EmpireSite[];
  /** The Eternal Labor Charter is signed this run: every label is stamped. */
  charterSigned: boolean;
  rows: PurchaseRow[];
  prestige: {
    available: boolean;
    award: number;
    record: string;
    runGross: string;
    factorBefore: string;
    factorAfter: string;
    nextTarget: string;
  };
  relics: { id: string; name: string; joke: string }[];
  relicHunt: { site: string; chance: string; guarantee: string } | null;
}

export interface GoalView {
  key: string;
  title: string;
  cost: string;
  affordable: boolean;
  /** Bought, capped or otherwise no longer a purchase: kept until unpinned. */
  stale: boolean;
  progress: number;
  /** The hill whose purse pays for it (absent for Insight). */
  siteId?: string;
}

export interface EmpireSite {
  id: string;
  chapter: number;
  name: string;
  owned: boolean;
  selected: boolean;
  /** Decree issued, waiting to be opened. */
  offered: boolean;
  /** The next site to be offered: shown as a silhouette with its gate. */
  teased: boolean;
  gate: string;
  level: number;
  /** This hill's purse, with its currency. */
  purse: string;
  glyph: string;
  currency: string;
  steward: string | null;
  /** The steward's standing order: reinvest the purse or hold it. */
  order: 'reinvest' | 'hold' | null;
  rate: string;
  automated: boolean;
  wheel: boolean;
  works: string[];
  phase: string;
  /** Position around the loop, 0..1 (ascent, descent, return). */
  loop: number;
}

const has = (state: GameState, id: string) => state.discoveries.tutorialIds.includes(id);

/** First Begin Again prompt threshold (spec §01). */
export const PRESTIGE_PROMPT_INSIGHT = 10;

// -------------------------------------------------------------------- goals

/** A pinnable purchase. Keys: levels:site:track, flywheel:site, foreman, work:id, site:id, upgrade:id, prelude:id. */
export function goalKey(action: RowAction, siteId: string): string | undefined {
  switch (action.kind) {
    case 'levels':
      return `levels:${siteId}:${action.track}`;
    case 'flywheel':
      return `flywheel:${siteId}`;
    case 'foreman':
      return 'foreman';
    case 'work':
      return `work:${action.workId}`;
    case 'site':
      return `site:${action.siteId}`;
    case 'upgrade':
      return `upgrade:${action.upgradeId}`;
    case 'prelude':
      return `prelude:${action.upgradeId}`;
    case 'steward':
      return action.paidWith === 'local' ? `steward:${siteId}` : undefined;
    case 'counterweight':
      return `counterweight:${siteId}`;
    case 'seal':
      return `seal:${siteId}:${action.index}`;
    case 'prestige':
    case 'stewardOrder':
    case 'trim':
    case 'bargain':
    case 'vent':
    case 'ventAt':
    case 'jar':
    case 'jarTarget':
    case 'split':
    case 'pourNext':
    case 'turn':
    case 'mount':
    case 'duty':
    case 'clerk':
    case 'summon':
    case 'appeal':
      return undefined;
  }
}

const TRACK_TITLES: Record<LevelTrack, string> = { production: 'Improve Operation', strength: 'Strength', impact: 'Impact' };

export function resolveGoal(state: GameState, key: string): GoalView {
  const [kind, a, b] = key.split(':');
  // Every price is paid from one hill's purse, in its currency.
  const money = (title: string, cost: Money | null, stale: boolean, payer: SiteState | undefined, available = true): GoalView => {
    const purse = payer?.purse ?? Money.ZERO;
    return {
      key,
      title,
      cost: cost && payer ? priced(cost, payer.id) : '',
      affordable: !stale && !!cost && !!payer && available && purse.gte(cost),
      stale: stale || !cost || !payer,
      progress: stale || !cost || cost.isZero() ? 1 : Math.min(1, purse.div(cost).toNumber()),
      siteId: payer?.id,
    };
  };
  const first = state.empire.sites[0];
  const siteName = (id: string) => (catalog.sites.some((d) => d.id === id) ? t(siteDef(id).displayNameKey) : id);
  switch (kind) {
    case 'levels': {
      const site = findSite(state, a);
      const track = b as LevelTrack;
      if (!site || !(track in TRACK_TITLES)) return money(`${TRACK_TITLES[track] ?? 'Level'} · ${siteName(a)}`, null, true, site);
      const level = currentLevel(site, track);
      const capped = level >= levelCap(track) || (track === 'strength' && !strengthLevelEffective(state, site, level));
      const where = state.empire.sites.length > 1 ? ` · ${siteName(a)}` : '';
      return money(`${TRACK_TITLES[track]} ${level + 1}${where}`, capped ? null : bulkCost(state, site, track, 1), capped, site);
    }
    case 'flywheel': {
      const site = findSite(state, a);
      return money(`Flywheel · ${siteName(a)}`, site ? flywheelCost(state, site) : null, !site || site.wheelOwned, site);
    }
    case 'counterweight': {
      const site = findSite(state, a);
      return money(`Counterweight · ${siteName(a)}`, site ? counterweightCost(state, site) : null, !site || site.counterweight !== null, site);
    }
    case 'seal': {
      const site = findSite(state, a);
      const index = Number(b);
      const id = site?.hand[index];
      const stale = !site || !id || site.devices.includes(id);
      return money(`Sealed tablet · ${siteName(a)}`, site && id ? tabletCost(state, site, index) : null, stale, site, !!site && site.productionLevel >= tabletLevel(index));
    }
    case 'steward': {
      const site = findSite(state, a);
      const name = HILLS[a] ? capitalize(HILLS[a].steward) : 'Steward';
      return money(`Hire ${name}`, site ? stewardCost(state, site) : null, !site || !!site.steward, site, !!site && stewardOffered(state, site));
    }
    case 'foreman':
      return money('Foreman Contract', catalog.levels.foremanCost, state.empire.foremanOwned, first);
    case 'work': {
      const def = catalog.works.find((w) => w.id === a);
      if (!def) return money(a, null, true, undefined);
      const site = findSite(state, def.siteId);
      const met = !!site && site.productionLevel >= def.requiredLevel;
      return money(t(def.displayNameKey), workCostOf(state, def), state.empire.purchasedWorkIds.includes(a), site, met);
    }
    case 'site': {
      const def = catalog.sites.find((d) => d.id === a);
      if (!def) return money(a, null, true, undefined);
      const payer = def.index > 0 ? findSite(state, catalog.sites[def.index - 1].id) : undefined;
      return money(`Open ${siteName(a)}`, unlockCostOf(state, def), !!findSite(state, a), payer, state.empire.offeredSiteIds.includes(a));
    }
    case 'prelude': {
      const def = catalog.prelude.upgrades.find((u) => u.id === a);
      const stale = !def || state.prelude.complete || state.prelude.upgradeIds.includes(a);
      return money(t(`prelude.${a}`), def ? def.cost : null, stale, first, nextPreludeUpgrade(state)?.id === a);
    }
    case 'upgrade': {
      const def = catalog.insightUpgrades.find((u) => u.id === a);
      const stale = !def || state.prestige.permanentUpgradeIds.includes(a);
      const have = spendableInsight(state);
      return {
        key,
        title: t(`upgrade.${a}`),
        cost: def ? `${def.cost} Insight` : '',
        affordable: !stale && !!def && have >= def.cost,
        stale,
        progress: stale || !def ? 1 : Math.min(1, have / def.cost),
      };
    }
  }
  return money(key, null, true, undefined);
}

function goalObjective(state: GameState, goal: GoalView, fallback: string): string {
  if (goal.stale) return `Pinned goal done or unavailable (${goal.title}). Next: ${fallback}`;
  if (goal.affordable) return `Goal ready: ${goal.title} (${goal.cost}).`;
  let wait = '';
  const payer = goal.siteId ? findSite(state, goal.siteId) : undefined;
  const rate = payer && isAutomated(state) ? steadyIncomePerSecond(state, payer) : Money.ZERO;
  if (payer && !rate.isZero() && goal.progress > 0 && goal.progress < 1) {
    // cost = purse / progress, so the shortfall follows without re-resolving the price.
    const secs = payer.purse.div(goal.progress).sub(payer.purse).div(rate).toNumber();
    if (Number.isFinite(secs) && secs > 0) wait = ` (≈ ${formatDuration(secs)}, estimate)`;
  }
  return `Goal: ${goal.title} — ${goal.cost}${wait}.`;
}

// ------------------------------------------------------------------- empire

function loopFraction(site: SiteState): number {
  const { descentSeconds, returnSeconds } = catalog.cycle;
  // Ascent takes half the loop on the frieze; descent and return share the rest.
  if (site.phase === 'ascending') return 0.5 * Math.min(1, site.phaseProgress);
  if (site.phase === 'descending') return 0.5 + 0.4 * Math.min(1, site.phaseProgress / descentSeconds);
  if (site.phase === 'returning') return 0.9 + 0.1 * Math.min(1, site.phaseProgress / returnSeconds);
  return 0;
}

function empireView(state: GameState): EmpireSite[] {
  const next = nextUnownedSite(state);
  const automated = isAutomated(state);
  return catalog.sites.map((def, i) => {
    const site = findSite(state, def.id);
    const cur = currencyOf(def.id);
    return {
      id: def.id,
      chapter: i + 1,
      name: t(def.displayNameKey),
      owned: !!site,
      selected: state.empire.selectedSiteId === def.id,
      offered: state.empire.offeredSiteIds.includes(def.id),
      teased: !site && next?.id === def.id,
      gate: i > 0 ? priced(gateOf(state, def), catalog.sites[i - 1].id) : '',
      level: site?.productionLevel ?? 0,
      purse: site ? priced(site.purse, def.id) : '',
      glyph: cur.glyph,
      currency: cur.id,
      steward: site?.steward ? capitalize(HILLS[def.id].steward) : null,
      order: site?.steward ? (site.steward.reinvest ? 'reinvest' : 'hold') : null,
      rate: site ? (automated ? `${formatRate(steadyIncomePerSecond(state, site))} ${cur.name}` : 'manual') : '',
      automated: !!site && automated,
      wheel: !!site?.wheelOwned,
      works: catalog.works.filter((w) => w.siteId === def.id && state.empire.purchasedWorkIds.includes(w.id)).map((w) => w.id),
      phase: site?.phase ?? 'locked',
      loop: site ? loopFraction(site) : 0,
    };
  });
}

function incomeDelta(state: GameState, site: SiteState, mutate: (s: SiteState) => void): string {
  const after = cloneSite(site);
  mutate(after);
  if (isAutomated(state)) {
    const before = steadyIncomePerSecond(state, site);
    const next = steadyIncomePerSecond(state, after);
    return `+${formatRate(next.sub(before))}`;
  }
  const before = cyclePayout(state, site).summit.add(cyclePayout(state, site).impact);
  const next = cyclePayout(state, after).summit.add(cyclePayout(state, after).impact);
  return `+${formatMoney(next.sub(before))} per climb`;
}

/** Signed change in this hill's income if `mutate` were applied, as a percentage. */
function incomeChange(state: GameState, site: SiteState, mutate: (s: SiteState) => void): string {
  const after = cloneSite(site);
  mutate(after);
  const before = steadyIncomePerSecond(state, site).toNumber();
  const next = steadyIncomePerSecond(state, after).toNumber();
  if (!(before > 0)) return '';
  const pctChange = ((next - before) / before) * 100;
  if (Math.abs(pctChange) < 0.05) return '±0%';
  return `${pctChange > 0 ? '+' : '−'}${Math.abs(pctChange).toFixed(1)}%`;
}

/** Ixion's Wheel: its heat, a vent by hand, and the steward's vent point. */
function furnaceRows(state: GameState, site: SiteState): PurchaseRow[] {
  const f = site.furnace;
  if (!f) return [];
  const m = modifiers(state, site.id);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const climbs = eruptionClimbs(m);
  const plural = (n: number) => `${n} climb${n === 1 ? '' : 's'}`;
  const rows: PurchaseRow[] = [];
  const ventable = canVent(f);
  rows.push({
    key: 'furnace',
    title: 'Ixion\'s Wheel',
    level: f.erupting > 0 ? 'Erupting' : `${pct(shownHeat(m, f))} heat`,
    effect:
      f.erupting > 0
        ? `Impacts pay ×${f.power.toFixed(2)} for ${plural(f.erupting)} more.`
        : `Every impact heats the wheel. At full heat it erupts: impacts ×${eruptionPower(m, 1).toFixed(2)} for ${plural(climbs)}.`,
    note: ventable
      ? `Vent now for ×${eruptionPower(m, f.heat).toFixed(2)}. Hotter pays more, but heats ever more slowly.`
      : f.erupting > 0
        ? undefined
        : `Too cold to vent below ${pct(catalog.furnace.minVent)}.`,
    verb: 'Vent',
    affordable: ventable,
    disabled: !ventable,
    action: { kind: 'vent' },
    accent: 'machine',
  });
  if (site.steward) {
    const best = bestVent(state, site);
    const at = f.ventAt;
    rows.push({
      key: 'ventAt',
      title: `${capitalize(HILLS[site.id].steward)} vent at`,
      level: pct(at),
      effect: Math.abs(at - best) < 1e-9 ? 'About the best point for the wheel as it stands.' : `The wheel does best venting near ${pct(best)}.`,
      affordable: true,
      action: { kind: 'ventAt' },
      options: [
        { label: 'Cooler', count: -1, cost: '', affordable: at > catalog.furnace.minVent + 1e-9 },
        { label: 'Hotter', count: 1, cost: '', affordable: at < 1 - 1e-9 },
      ],
      accent: 'machine',
    });
  }
  return rows;
}

/** The Paperwork Mill: the backlog, the clerks at their desks, and Zeus's Edict. */
function millRows(state: GameState, site: SiteState): PurchaseRow[] {
  const b = site.bureau;
  if (!b) return [];
  const m = modifiers(state, site.id);
  const filed = filing(m, site.productionLevel);
  const ripe = Math.min(b.backlog / filed, statute(m)) / statute(m);
  const clerks = site.steward ? b.hired : b.onDuty;
  const rate = throughput(m, clerks);
  const match = clerksToMatch(m, site.productionLevel);
  const edict = activeEdict(state);
  const verdict = site.steward
    ? `The Moirai let the backlog ripen, then approve as fast as it is filed.`
    : rate + 1e-9 < filed
      ? `The backlog grows: late fees ripen${ripe >= 1 - 1e-9 ? ', and have reached the statute' : ''}.`
      : 'The desks keep up: the backlog drains and late fees stop.';
  const rows: PurchaseRow[] = [
    {
      key: 'mill',
      title: 'The Paperwork Mill',
      level: `${Math.floor(b.backlog)} filed · ${clerks} of ${b.hired} at desks`,
      effect: `Approved forms pay, with late fees ×${formValue(m, b.backlog, filed).toFixed(2)}. Impacts ×${b.factor.toFixed(2)} now.`,
      note:
        `${verdict} ${match} clerk${match === 1 ? '' : 's'} would keep up.` +
        (b.dueProcess > 0 ? ` Due Process: ${b.dueProcess} milestones in the empire.` : '') +
        (edict ? ` Edict in force: ${edict.name}. ${edict.rule}` : ''),
      affordable: true,
      action: { kind: 'duty' },
      options: site.steward
        ? undefined
        : [
            { label: 'Fewer', count: -1, cost: '', affordable: b.onDuty > 0 },
            { label: 'More', count: 1, cost: '', affordable: b.onDuty < b.hired },
          ],
      accent: 'machine',
    },
  ];
  const cost = clerkCost(state, site.id, b.hired, m);
  rows.push({
    key: 'clerk',
    title: 'Hire a clerk',
    level: `${b.hired} hired`,
    effect: `Each clerk approves ${(catalog.bureau.clerkRate * m.bureauSpeed).toFixed(2)} forms a climb.`,
    verb: 'Hire',
    cost: formatMoney(cost),
    affordable: site.purse.gte(cost),
    action: { kind: 'clerk' },
    accent: 'machine',
  });
  return rows;
}

/** The Orrery: what is overhead, a turn by hand, and where each constellation hangs. */
function orreryRows(state: GameState, site: SiteState): PurchaseRow[] {
  const sky = site.sky;
  if (!sky) return [];
  const m = modifiers(state, site.id);
  const rows: PurchaseRow[] = [];
  const up = overhead(sky);
  const map = sky.houses.map((h, i) => (i === sky.position ? (h ? '◉' : '◎') : h ? '●' : '○')).join('');
  const per = climbsPerHouse(m);
  const left = per - sky.climbs;
  const next = nextMounted(sky);
  const steward = capitalize(HILLS[site.id].steward);
  const turnNote = site.steward
    ? `${steward} turns past dark houses on his own.`
    : sky.cooldown > 0
      ? `Atlas is resting: he will turn again in ${sky.cooldown} climb${sky.cooldown === 1 ? '' : 's'}.`
      : next === null || next === sky.position
        ? 'Mount a constellation to have somewhere to turn to.'
        : undefined;
  rows.push({
    key: 'orrery',
    title: 'The Orrery',
    level: `House ${sky.position + 1} of ${sky.houses.length}`,
    effect: up ? `${deviceDef(up).name} is overhead. ${deviceDef(up).rule}` : 'A dark house is overhead. Nothing is bent.',
    note: `${map} · the sky moves on in ${left} climb${left === 1 ? '' : 's'}.${turnNote ? ` ${turnNote}` : ''}`,
    verb: 'Turn',
    affordable: canTurn(sky),
    disabled: !canTurn(sky),
    action: { kind: 'turn' },
    accent: 'machine',
  });
  const stars = site.devices.filter(isConstellation);
  stars.forEach((id, i) => {
    const def = deviceDef(id);
    const h = houseOf(sky, id);
    rows.push({
      key: `star-${id}`,
      title: def.name,
      level: h >= 0 ? `House ${h + 1}` : 'Not mounted',
      effect: def.rule,
      affordable: true,
      action: { kind: 'mount', index: i },
      options:
        h >= 0
          ? [
              { label: 'Earlier', count: -1, cost: '', affordable: true },
              { label: 'Later', count: 1, cost: '', affordable: true },
              { label: 'Take down', count: 0, cost: '', affordable: true },
            ]
          : [{ label: 'Mount', count: 0, cost: '', affordable: sky.houses.includes(null) }],
      accent: 'machine',
    });
  });
  return rows;
}

/** The Foundry: the split, the blueprint in the mould, and the sealed queue. */
function foundryRows(state: GameState, site: SiteState): PurchaseRow[] {
  const f = site.foundry;
  if (!f) return [];
  const rows: PurchaseRow[] = [];
  const currency = siteDef(site.id).currency;
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  rows.push({
    key: 'split',
    title: 'The Foundry',
    level: `${pct(f.split)} poured`,
    effect:
      f.split === 0
        ? 'Everything is sold as Ingots. Nothing is poured.'
        : `${pct(f.split)} of every payout is poured as bronze; the rest is sold as Ingots.`,
    note: 'Poured pay still counts toward decrees and Insight.',
    affordable: true,
    action: { kind: 'split' },
    options: [
      { label: 'Sell more', count: -1, cost: '', affordable: f.split > 1e-9 },
      { label: 'Pour more', count: 1, cost: '', affordable: f.split < 1 - 1e-9 },
    ],
    accent: 'machine',
  });
  if (f.queue.length === 0) return rows;
  const size = blueprintSize(state, site);
  const head = deviceDef(f.queue[0]);
  const steward = capitalize(HILLS[site.id].steward);
  rows.push({
    key: 'blueprint',
    title: `In the mould: “${head.hint}”`,
    level: f.paused ? 'Waiting' : `${Math.floor(f.bronze.div(size).toNumber() * 100)}%`,
    effect: `${formatMoney(f.bronze)} of ${formatMoney(size)} ${currency} of bronze.`,
    note: f.paused
      ? `A blueprint is finished. Pick the next one to pour, or hire ${steward} to keep the queue running.`
      : pouring(f)
        ? undefined
        : 'Nothing is being poured: move the split toward Pour.',
    verb: f.paused ? 'Pour' : undefined,
    affordable: f.paused,
    disabled: !f.paused,
    action: { kind: 'pourNext', index: 0 },
    accent: 'seal',
  });
  for (let i = 1; i < f.queue.length; i++) {
    rows.push({
      key: `blueprint-${i}`,
      title: `“${deviceDef(f.queue[i]).hint}”`,
      effect: 'A sealed blueprint. What it does, you learn when it is cast.',
      verb: 'Pour next',
      affordable: true,
      action: { kind: 'pourNext', index: i },
      accent: 'seal',
    });
  }
  return rows;
}

/** The Danaids' jar: drill and patch by hand, or set the level the steward holds. */
function jarRows(state: GameState, site: SiteState): PurchaseRow[] {
  const j = site.jar;
  if (!j) return [];
  const m = modifiers(state, site.id);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const rows: PurchaseRow[] = [];
  const best = bestHoles(m, j, site.productionLevel);
  const verdict =
    j.spilled > 1e-9
      ? 'Spilling: too few holes. Spilled water pays nothing.'
      : j.holes > best
        ? 'Too many holes: the jar runs low and the pressure drops.'
        : 'Just short of the brim. It never fills.';
  const cost = drillCost(state, site);
  const holes = `${j.holes} hole${j.holes === 1 ? '' : 's'}`;
  rows.push({
    key: 'jar',
    title: 'The Danaids\' Jar',
    level: `${pct(j.peak)} · ${holes}`,
    effect: `Only the leak pays, and a fuller jar leaks harder. Impacts ×${j.factor.toFixed(2)} now.`,
    note: site.steward
      ? `${capitalize(HILLS[site.id].steward)} drills and patches to hold the level.`
      : j.holes === best
        ? verdict
        : `${verdict} About ${best} holes would suit the jar now.`,
    affordable: true,
    action: { kind: 'jar' },
    options: [
      { label: 'Drill', count: 1, cost: formatMoney(cost), affordable: site.purse.gte(cost) && j.holes < catalog.jar.maxHoles },
      { label: 'Patch', count: -1, cost: '', affordable: true },
    ],
    accent: 'machine',
  });
  if (site.steward) {
    const target = bestTarget(m, j, site.productionLevel);
    rows.push({
      key: 'jarTarget',
      title: `${capitalize(HILLS[site.id].steward)} holds the jar at`,
      level: pct(j.target),
      effect: Math.abs(j.target - target) < 1e-9 ? 'About the best level for the jar as it stands.' : `The jar does best held near ${pct(target)}.`,
      affordable: true,
      action: { kind: 'jarTarget' },
      options: [
        { label: 'Lower', count: -1, cost: '', affordable: j.target > catalog.jar.minTarget + 1e-9 },
        { label: 'Higher', count: 1, cost: '', affordable: j.target < 1 - 1e-9 },
      ],
      accent: 'machine',
    });
  }
  return rows;
}

/** The counterweight: install it, then keep it trimmed as the hill changes. */
function counterweightRows(state: GameState, site: SiteState): PurchaseRow[] {
  const cw = catalog.counterweight;
  if (site.counterweight === null) {
    if (!counterweightUnlocked(site)) return [];
    const cost = counterweightCost(state, site);
    return [
      {
        key: 'counterweight',
        title: 'Counterweight',
        effect: 'A basket of stones over a summit pulley. Each stone speeds the climb and brakes the fall.',
        note: 'Balanced, a climb takes about as long as a fall.',
        cost: formatMoney(cost),
        currency: siteDef(site.id).currency,
        affordable: site.purse.gte(cost),
        wait: waitFor(state, site, cost),
        action: { kind: 'counterweight' },
        accent: 'machine',
      },
    ];
  }
  const trim = site.counterweight;
  const best = bestTrim(state, site);
  const verdict =
    trim === best
      ? 'Balanced: a climb takes about as long as a fall.'
      : trim < best
        ? 'Too light: the climb is doing all the work.'
        : 'Too heavy: the fall is dragging.';
  const byHand = bestTrim(state, site, true) < best ? ' Pushing by hand? A lighter basket suits you.' : '';
  const automated = isAutomated(state);
  const option = (label: string, delta: number) => {
    const to = trim + delta;
    const ok = to >= 0 && to <= cw.maxTrim;
    const change = ok && automated ? incomeChange(state, site, (s) => (s.counterweight = to)) : '';
    return { label: change ? `${label} (${change})` : label, count: delta, cost: '', affordable: ok };
  };
  return [
    {
      key: 'trim',
      title: 'Counterweight',
      level: `${trim} stone${trim === 1 ? '' : 's'}`,
      effect: verdict,
      note: site.steward ? `${capitalize(HILLS[site.id].steward)} keeps it trimmed.${byHand}` : byHand.trim() || undefined,
      affordable: true,
      action: { kind: 'trim' },
      options: [option('Lighter', -1), option('Heavier', 1)],
      accent: 'machine',
    },
  ];
}

/** Dealt tablets: sealed until bought. The next locked one is teased with its crew level. */
function tabletRows(state: GameState, site: SiteState): PurchaseRow[] {
  const rows: PurchaseRow[] = [];
  // The Bronze Pass casts its devices in the Foundry instead.
  if (site.foundry) return rows;
  for (let i = 0; i < site.hand.length; i++) {
    const id = site.hand[i];
    if (site.devices.includes(id)) continue;
    const def = deviceDef(id);
    const level = tabletLevel(i);
    if (site.productionLevel < level) {
      rows.push({
        key: `seal-${i}`,
        title: 'A tablet, still in the ground',
        effect: `Surfaces when the crew reaches ${level}.`,
        affordable: false,
        disabled: true,
        action: { kind: 'seal', index: i },
        accent: 'seal',
      });
      break;
    }
    const cost = tabletCost(state, site, i);
    const read = site.peeked.includes(id);
    // Unseal in Advance: once Insight is known, a seal can be read before it is broken.
    const peek = !read && state.prestige.lifetimeInsightAwarded > 0;
    rows.push({
      key: `seal-${i}`,
      title: read ? `“${def.hint}”: ${def.name}` : `“${def.hint}”`,
      effect: read ? def.rule : 'A sealed tablet. What it does, you learn by breaking the seal.',
      note: peek ? `Or read it first for ${catalog.memory.unseal} Insight (this run).` : undefined,
      cost: formatMoney(cost),
      currency: siteDef(site.id).currency,
      verb: 'Break seal',
      affordable: site.purse.gte(cost),
      wait: waitFor(state, site, cost),
      action: { kind: 'seal', index: i },
      options: peek
        ? [
            { label: 'Break seal', count: 1, cost: formatMoney(cost), affordable: site.purse.gte(cost) },
            { label: 'Read first', count: 0, cost: `${catalog.memory.unseal} Insight`, affordable: spendableInsight(state) >= catalog.memory.unseal },
          ]
        : undefined,
      accent: 'seal',
    });
  }
  return rows;
}

export function machineGauge(state: GameState, site: SiteState): MachineGauge | null {
  const m = modifiers(state, site.id);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  if (site.furnace) {
    const f = site.furnace;
    const erupting = f.erupting > 0;
    return {
      label: 'Heat',
      value: clamp(shownHeat(m, f)),
      mark: f.ventAt,
      text: erupting ? `Erupting ×${f.power.toFixed(2)} · ${f.erupting} climb${f.erupting === 1 ? '' : 's'} left` : `${pct(f.heat)} · vent at ${pct(f.ventAt)}`,
      hot: erupting,
    };
  }
  if (site.jar) {
    const j = site.jar;
    return {
      label: 'Jar',
      value: clamp(j.peak),
      mark: site.steward ? j.target : null,
      text: `${pct(j.peak)} full · ${j.holes} hole${j.holes === 1 ? '' : 's'} · ×${j.factor.toFixed(2)}`,
      hot: j.spilled > 1e-9,
    };
  }
  if (site.foundry) {
    const f = site.foundry;
    if (f.queue.length === 0) return { label: 'Pour', value: 1, mark: null, text: 'Every blueprint cast', hot: false };
    const size = blueprintSize(state, site);
    return {
      label: 'Pour',
      value: clamp(f.bronze.div(size).toNumber()),
      mark: null,
      text: f.paused ? 'Cast: pick the next blueprint' : `“${deviceDef(f.queue[0]).hint}” · ${pct(f.split)} poured`,
      hot: f.paused,
    };
  }
  if (site.sky) {
    const sky = site.sky;
    const up = overhead(sky);
    const per = climbsPerHouse(m);
    return {
      label: 'Sky',
      value: clamp((sky.position + sky.climbs / per) / sky.houses.length),
      mark: null,
      text: `House ${sky.position + 1}: ${up ? deviceDef(up).name : 'dark'}${sky.cooldown > 0 ? ` · Atlas rests ${sky.cooldown}` : ''}`,
      hot: up !== null,
    };
  }
  if (site.bureau) {
    const b = site.bureau;
    const filed = filing(m, site.productionLevel);
    const ripe = clamp(b.backlog / (statute(m) * filed));
    return {
      label: 'Backlog',
      value: ripe,
      mark: null,
      text: `${Math.floor(b.backlog)} forms · fees ×${formValue(m, b.backlog, filed).toFixed(2)}${activeEdict(state) ? ` · ${activeEdict(state)!.name}` : ''}`,
      hot: ripe >= 1 - 1e-9,
    };
  }
  if (site.counterweight !== null) {
    const max = catalog.counterweight.maxTrim;
    const best = bestTrim(state, site);
    return {
      label: 'Trim',
      value: site.counterweight / max,
      mark: best / max,
      text: site.counterweight === best ? `Balanced at ${best}` : `Trim ${site.counterweight} · balanced at ${best}`,
      hot: site.counterweight === best,
    };
  }
  return null;
}

/** One line per hill for the offline recap: what its machine did while you were away. */
export function recapMachineLines(machines: MachineRecap[]): { siteId: string; text: string; waiting: boolean }[] {
  const n = (k: number, one: string, many: string) => `${k.toLocaleString('en-US')} ${k === 1 ? one : many}`;
  return machines.map((m) => {
    const parts: string[] = [];
    if (m.eruptions > 0) parts.push(n(m.eruptions, 'eruption', 'eruptions'));
    if (m.cast > 0) parts.push(`${n(m.cast, 'blueprint', 'blueprints')} cast`);
    if (m.approved > 0) parts.push(`${n(m.approved, 'form', 'forms')} approved`);
    if (m.trial) parts.push(m.trial.after >= m.trial.needed ? 'trial met' : `trial ${m.trial.before} → ${m.trial.after} of ${m.trial.needed}`);
    return { siteId: m.siteId, text: parts.join(' · '), waiting: m.castWaiting };
  });
}

function appealOffer(state: GameState): AppealOffer | null {
  if (!charterSigned(state)) return null;
  const n = state.appeal.laurels + 1;
  const twist = appealDef(n)!;
  return {
    number: n,
    name: twist.name,
    rule: twist.rule,
    gates: formatTimes(catalog.appeals.gateGrowth ** n),
    works: formatTimes(catalog.appeals.workGrowth ** n),
    pay: formatTimes(catalog.appeals.payGrowth ** n),
    award: availableInsight(state),
    laurel: formatTimes(catalog.appeals.laurelMultiplier),
    laurelsTotal: formatTimes(catalog.appeals.laurelMultiplier ** n),
  };
}

/** Send for the hill's visitor early, for Insight, once any has been earned. */
function summonRow(state: GameState, site: SiteState): PurchaseRow | null {
  const v = visitorFor(site.id);
  if (!v || site.summoned || site.productionLevel >= v.arrivesAt || state.prestige.lifetimeInsightAwarded === 0) return null;
  if (v.bargains.some((b) => site.devices.includes(b))) return null;
  const cost = catalog.memory.summon;
  return {
    key: `summon-${v.id}`,
    title: `Send for ${v.name}`,
    effect: `${v.name} comes at crew ${v.arrivesAt}. Sent for, they come now, for this run.`,
    verb: 'Send for',
    cost: `${cost} Insight`,
    currency: 'insight',
    affordable: spendableInsight(state) >= cost,
    action: { kind: 'summon' },
    accent: 'insight',
  };
}

function visitorRow(site: SiteState): PurchaseRow | null {
  const v = visitorWaiting(site);
  if (!v) return null;
  return {
    key: `visitor-${v.id}`,
    title: `${v.name} is here`,
    effect: v.greeting,
    note: 'Take one. The other stays sealed for a later run.',
    affordable: true,
    action: { kind: 'bargain' },
    options: v.bargains.map((b, i) => ({ label: `“${deviceDef(b).hint}”`, count: i, cost: '', affordable: true })),
    accent: 'seal',
  };
}

/** The shortfall in this hill's purse, and how long its own income takes to cover it. */
function waitFor(state: GameState, site: SiteState, cost: Money): string | undefined {
  if (site.purse.gte(cost)) return undefined;
  const short = cost.sub(site.purse);
  const need = `Need ${priced(short, site.id)} more`;
  const rate = isAutomated(state) ? steadyIncomePerSecond(state, site) : Money.ZERO;
  if (rate.isZero()) return need;
  return `${need} · ≈ ${formatDuration(short.div(rate).toNumber())} at this hill's income (estimate)`;
}

function levelRow(state: GameState, site: SiteState, track: LevelTrack): PurchaseRow | null {
  const level = track === 'production' ? site.productionLevel : track === 'strength' ? site.strengthLevel : site.impactLevel;
  const cap = levelCap(track);
  const title = track === 'production' ? 'Improve Operation' : track === 'strength' ? 'Strength' : 'Impact';
  const levelText = `Lv ${level}${track === 'production' ? '' : ` / ${cap}`}`;
  if (level >= cap) {
    return { key: track, title, level: levelText, effect: 'Maximum level', affordable: false, disabled: true, action: { kind: 'levels', track } };
  }
  if (track === 'strength' && !strengthLevelEffective(state, site, level)) {
    return { key: track, title, level: levelText, effect: 'At the ascent floor', affordable: false, disabled: true, action: { kind: 'levels', track } };
  }

  const cost1 = bulkCost(state, site, track, 1)!;
  const purse = site.purse;
  const options: BuyOption[] = [{ label: 'Buy 1', count: 1, cost: formatMoney(cost1), affordable: purse.gte(cost1) }];
  if (track === 'production' && has(state, 'first_level')) {
    const ten = Math.min(10, cap - level);
    const c10 = bulkCost(state, site, track, ten);
    if (ten > 1 && c10) options.push({ label: `Buy ${ten}`, count: ten, cost: formatMoney(c10), affordable: purse.gte(c10) });
    const toM = levelsToMilestone(site);
    const cm = toM > 0 ? bulkCost(state, site, track, toM) : null;
    if (toM > 1 && toM !== ten && cm) {
      options.push({ label: `To ${level + toM}`, count: toM, cost: formatMoney(cm), affordable: purse.gte(cm) });
    }
  }
  if (has(state, 'foreman')) {
    const max = maxAffordable(state, site, track);
    if (max > 1) options.push({ label: `Max ${max}`, count: max, cost: formatMoney(bulkCost(state, site, track, max)!), affordable: true });
  }

  let effect: string;
  if (track === 'production') {
    const nm = nextMilestone(level);
    effect = incomeDelta(state, site, (s) => (s.productionLevel += 1));
    if (nm !== null && nm === level + 1) effect += ' · milestone ×2';
  } else if (track === 'strength') {
    const charged = site.wheelCharged;
    const now = ascentSeconds(state, { ...site, wheelCharged: charged }, false);
    const next = ascentSeconds(state, { ...site, wheelCharged: charged, strengthLevel: level + 1 }, false);
    effect = `Ascent ${now.toFixed(1)}s → ${next.toFixed(1)}s`;
    if (isAutomated(state)) effect += ` · ${incomeDelta(state, site, (s) => (s.strengthLevel += 1))}`;
  } else {
    effect = incomeDelta(state, site, (s) => (s.impactLevel += 1));
  }

  return {
    key: track,
    title,
    level: levelText,
    effect,
    // Payouts are fixed when a climb begins; speed changes apply at once (spec §01).
    note: track === 'strength' ? 'Faster ascent starts immediately.' : 'Raises the payout from the next climb.',
    cost: formatMoney(cost1),
    currency: siteDef(site.id).currency,
    affordable: purse.gte(cost1),
    wait: waitFor(state, site, cost1),
    action: { kind: 'levels', track },
    options,
  };
}

function workRow(state: GameState, def: WorkDef, site: SiteState): PurchaseRow | null {
  const price = workCostOf(state, def);
  if (state.empire.purchasedWorkIds.includes(def.id)) return null;
  const met = site.productionLevel >= def.requiredLevel;
  return {
    key: `work-${def.id}`,
    title: t(def.displayNameKey),
    effect: t(`${def.displayNameKey}.desc`),
    note: met ? undefined : `Requires ${t(siteDef(site.id).displayNameKey)} level ${def.requiredLevel}`,
    cost: formatMoney(price),
    currency: siteDef(site.id).currency,
    affordable: met && site.purse.gte(price),
    disabled: !met,
    wait: met ? waitFor(state, site, price) : undefined,
    action: { kind: 'work', workId: def.id },
    accent: 'work',
  };
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

function preludeObjective(state: GameState): string {
  const p = state.prelude;
  if (!has(state, 'first_slip')) return t('hint.push');
  const next = nextPreludeUpgrade(state);
  if (!next) return t('hint.prelude_summit');
  const name = t(`prelude.${next.id}`);
  if (state.empire.sites[0].purse.gte(next.cost)) return `Open Improve: ${name} will get you higher.`;
  return `Best height ${pct(p.bestHeight)}. ${t('hint.prelude_fall')} ${name}: ${formatMoney(next.cost)} Obols.`;
}

function objective(state: GameState, site: SiteState): string {
  if (preludeActive(state)) return preludeObjective(state);
  if (!has(state, 'first_level')) return t('hint.improve');
  const a = catalog.automation;
  const hill = state.empire.sites[0];
  if (!state.empire.sites.some((s) => s.wheelOwned)) {
    if (!flywheelUnlocked(state)) {
      const nm = nextMilestone(hill.productionLevel);
      const tease = nm !== null && nm >= a.flywheelUnlockLevel ? ` ${t('hint.flywheel_tease')}` : '';
      return nm === null ? t('hint.flywheel_tease') : `Reach level ${nm} for ×2.${tease}`;
    }
    return `${t('hint.flywheel')} Flywheel: ${priced(flywheelCost(state, site), site.id)}.`;
  }
  if (!isAutomated(state)) {
    if (!state.empire.sites.some((s) => s.wheelCharged)) return t('hint.charge');
    if (!foremanUnlocked(state)) {
      return `Reach level ${a.foremanUnlockLevel} (now ${hill.productionLevel}). ${t('hint.foreman_tease')}`;
    }
    return `${t('hint.foreman')} Foreman: ${formatMoney(catalog.levels.foremanCost)} Obols.`;
  }
  const hermes = catalog.works.find((w) => w.siteId === site.id && !state.empire.purchasedWorkIds.includes(w.id));
  if (hermes && site.productionLevel < hermes.requiredLevel) {
    return `Reach level ${hermes.requiredLevel} to commission ${t(hermes.displayNameKey)}.`;
  }
  const next = nextUnownedSite(state);
  if (!next) return 'Every hill is yours. The Charter awaits.';
  const payer = catalog.sites[next.index - 1];
  const from = t(payer.displayNameKey);
  if (state.empire.offeredSiteIds.includes(next.id)) {
    return `Decree issued: open ${t(next.displayNameKey)} for ${priced(unlockCostOf(state, next), payer.id)} from ${from}.`;
  }
  const held = findSite(state, payer.id);
  const gate = gateOf(state, next);
  const earn = `earn ${priced(gate, payer.id)} on ${from}`;
  const to = t(next.displayNameKey);
  // The trial is the new information, so it leads; the line never ends on it half-said.
  if (held && trialNeeded(payer.id) > 0 && !trialMet(held)) {
    const need = trialNeeded(payer.id);
    const trial = `${trialText(held)} (${Math.min(trialProgress(held), need)}/${need})`;
    return held.gross.gte(gate) ? `Trial for ${to}: ${trial}.` : `Trial for ${to}: ${trial}, and ${earn}.`;
  }
  return `Next decree when ${from} has earned ${priced(gate, payer.id)}: ${to}.`;
}

function goalHorizons(state: GameState, site: SiteState, now: string): GameView['goalStack'] {
  if (preludeActive(state)) {
    const grip = nextPreludeUpgrade(state);
    return {
      now,
      next: grip ? `Reach farther with ${t(`prelude.${grip.id}`)}.` : 'Reach the summit and complete the first descent.',
      beyond: 'Turn the returning stone into useful motion.',
    };
  }

  const milestone = nextMilestone(site.productionLevel);
  let next = milestone === null ? `${t(siteDef(site.id).displayNameKey)} is fully improved.` : `Level ${milestone}: double this hill's output.`;
  if (!site.wheelOwned && flywheelOffered(state, site)) next = 'Install and charge the flywheel.';
  else if (!isAutomated(state) && foremanUnlocked(state)) next = 'Hire the Foreman and automate every hill.';

  const nextSite = nextUnownedSite(state);
  let beyond = 'Complete the Eternal Labor Charter.';
  if (nextSite) {
    beyond = state.empire.offeredSiteIds.includes(nextSite.id)
      ? `Open ${t(nextSite.displayNameKey)}.`
      : `Provoke the decree for ${t(nextSite.displayNameKey)}.`;
  } else if (state.empire.purchasedWorkIds.includes('charter')) {
    beyond = 'Improve your records and complete the Archive.';
  }
  return { now, next, beyond };
}

export function buildView(state: GameState): GameView {
  setNotation(state.options.notation);
  const site = findSite(state, state.empire.selectedSiteId) ?? state.empire.sites[0];
  const def = siteDef(site.id);
  const owned = state.empire.sites;
  const idx = owned.findIndex((s) => s.id === site.id);
  const automated = isAutomated(state);
  const rows: PurchaseRow[] = [];

  const prelude = preludeActive(state);
  const nextGrip = nextPreludeUpgrade(state);
  if (prelude && nextGrip && has(state, 'first_slip')) {
    const reach = preludeReach(state);
    rows.push({
      key: `prelude-${nextGrip.id}`,
      title: t(`prelude.${nextGrip.id}`),
      effect: `Reach ${pct(reach)} → ${pct(Math.min(1, reach + nextGrip.reach))} of the hill`,
      note: t(`prelude.${nextGrip.id}.desc`),
      cost: formatMoney(nextGrip.cost),
      currency: 'obols',
      affordable: state.empire.sites[0].purse.gte(nextGrip.cost),
      action: { kind: 'prelude', upgradeId: nextGrip.id },
      accent: 'grip',
    });
  }
  if (!prelude && has(state, 'first_summit')) {
    rows.push(levelRow(state, site, 'production')!);
  }
  if (has(state, 'first_level')) {
    const str = levelRow(state, site, 'strength');
    // The rim has no impact track (Ixion's Wheel replaces it): never price it.
    const imp = trackOpen(site, 'impact') ? levelRow(state, site, 'impact') : null;
    if (str) rows.push(str);
    if (imp) rows.push(imp);
  }
  if (!site.wheelOwned && flywheelOffered(state, site)) {
    const cost = flywheelCost(state, site);
    rows.push({
      key: 'flywheel',
      title: 'Flywheel',
      effect: `Catches the falling stone. Ascent ×${flywheelFactor(state)} faster.`,
      note: 'Helps after the next descent',
      cost: formatMoney(cost),
      currency: def.currency,
      affordable: site.purse.gte(cost),
      wait: waitFor(state, site, cost),
      action: { kind: 'flywheel' },
      accent: 'machine',
    });
  }
  rows.push(...counterweightRows(state, site));
  rows.push(...furnaceRows(state, site));
  rows.push(...jarRows(state, site));
  rows.push(...foundryRows(state, site));
  rows.push(...orreryRows(state, site));
  rows.push(...millRows(state, site));
  if (!automated && foremanUnlocked(state)) {
    const cost = catalog.levels.foremanCost;
    rows.push({
      key: 'foreman',
      title: 'Foreman Contract',
      effect: 'A shade takes over the pushing on every hill, present and future.',
      note: 'Works while away',
      cost: formatMoney(cost),
      currency: 'obols',
      affordable: state.empire.sites[0].purse.gte(cost),
      action: { kind: 'foreman' },
      accent: 'machine',
    });
  }
  for (const w of catalog.works.filter((x) => x.siteId === site.id)) {
    // A work is teased once its site is owned; the next one only after the previous is bought.
    const siteWorks = catalog.works.filter((x) => x.siteId === site.id);
    const prior = siteWorks.slice(0, siteWorks.indexOf(w));
    if (prior.some((p) => !state.empire.purchasedWorkIds.includes(p.id))) continue;
    if (w.id === 'hermes' && !automated && site.productionLevel < w.requiredLevel) continue;
    const row = workRow(state, w, site);
    if (row) rows.push(row);
  }

  const visitor = visitorRow(site) ?? summonRow(state, site);
  if (visitor) rows.push(visitor);
  rows.push(...tabletRows(state, site));

  // The steward: offered for this hill's money once its successor opens, or early for Insight.
  const cast = HILLS[site.id];
  if (site.steward) {
    rows.push({
      key: 'steward-order',
      title: capitalize(cast.steward),
      effect: site.steward.reinvest
        ? `Standing order: ${cast.order}, keeping back what you are saving for here.`
        : 'Standing order: hold. The purse is left for you.',
      note: cast.stewardQuip,
      verb: site.steward.reinvest ? 'Hold' : 'Reinvest',
      affordable: true,
      action: { kind: 'stewardOrder' },
      accent: 'machine',
    });
  } else if (stewardOffered(state, site)) {
    const cost = stewardCost(state, site);
    rows.push({
      key: 'steward',
      title: `Hire ${capitalize(cast.steward)}`,
      effect: `A steward takes over this hill and ${cast.order}. Stewards never break a seal.`,
      note: cast.stewardQuip,
      cost: formatMoney(cost),
      currency: def.currency,
      affordable: site.purse.gte(cost),
      wait: waitFor(state, site, cost),
      action: { kind: 'steward', paidWith: 'local' },
      accent: 'machine',
    });
  } else if (automated && state.prestige.lifetimeInsightAwarded > 0) {
    const cost = stewardInsightCost(site);
    rows.push({
      key: 'steward-early',
      title: `Hire ${capitalize(cast.steward)} early`,
      effect: `For this run, a steward takes over this hill and ${cast.order}.`,
      note: `${cast.stewardQuip} Offered for ${currencyOf(site.id).name} once the next hill opens.`,
      cost: `${cost} Insight`,
      currency: 'insight',
      affordable: spendableInsight(state) >= cost,
      action: { kind: 'steward', paidWith: 'insight' },
      accent: 'insight',
    });
  }

  // The next hill is opened from the frontier, in the frontier's money.
  const next = nextUnownedSite(state);
  const frontier = frontierSite(state);
  let decree: GameView['decree'] = null;
  if (next) {
    const offered = state.empire.offeredSiteIds.includes(next.id);
    const shown = automated || offered;
    decree = { name: t(next.displayNameKey), progress: decreeProgress(state), ready: offered, shown };
    if (offered && site === frontier) {
      rows.push({
        key: `site-${next.id}`,
        title: `Open ${t(next.displayNameKey)}`,
        effect: `A new hill with its own money (${currencyOf(next.id).name}). This hill keeps working.`,
        note: automated ? undefined : 'Without the Foreman only the hill in view moves. Completing automation first is recommended.',
        cost: formatMoney(unlockCostOf(state, next)),
        currency: def.currency,
        affordable: site.purse.gte(unlockCostOf(state, next)),
        wait: waitFor(state, site, unlockCostOf(state, next)),
        action: { kind: 'site', siteId: next.id },
        accent: 'decree',
      });
    } else if (shown && site === frontier) {
      rows.push({
        key: `decree-${next.id}`,
        title: `Decree: ${t(next.displayNameKey)}`,
        effect:
          `Earn ${priced(gateOf(state, next), site.id)} on this hill this run (gross; spending never sets it back)` +
          (trialNeeded(site.id) > 0 ? `, and show the machine: ${trialText(site)}.` : '.'),
        note:
          `${formatMoney(site.gross)} / ${formatMoney(gateOf(state, next))}` +
          (trialNeeded(site.id) > 0 ? ` · trial ${Math.min(trialProgress(site), trialNeeded(site.id))} / ${trialNeeded(site.id)}` : ''),
        affordable: false,
        disabled: true,
        progress: decreeProgress(state),
        action: { kind: 'site', siteId: next.id },
        accent: 'decree',
      });
    }
  }

  // After the Charter, Thanatos files an Appeal.
  if (charterSigned(state) && site === frontierSite(state)) {
    const n = state.appeal.laurels + 1;
    const twist = appealDef(n)!;
    rows.push({
      key: 'appeal',
      title: `File Appeal ${n}: ${twist.name}`,
      effect: `${twist.rule} Gates and openings ${formatTimes(catalog.appeals.gateGrowth ** n)}, works ${formatTimes(catalog.appeals.workGrowth ** n)}, every crew's pay and every hill price ${formatTimes(catalog.appeals.payGrowth ** n)}; new tablets join the hills. Sign the Charter again to win a laurel.`,
      note: `Begins a new run (this run's Insight is paid). Each laurel multiplies every crew's pay ${formatTimes(catalog.appeals.laurelMultiplier)}, and laurels compound.`,
      verb: 'File',
      affordable: true,
      action: { kind: 'appeal' },
      accent: 'decree',
    });
  }

  const award = availableInsight(state);
  const lifetime = state.prestige.lifetimeInsightAwarded;
  if (award > 0 && (automated || has(state, 'foreman'))) {
    rows.push({
      key: 'prestige',
      title: 'Begin Again',
      effect: `Claim ${award} Existential Insight. Income ${formatMultiplier(insightFactor(lifetime))} → ${formatMultiplier(insightFactor(lifetime + award))}.`,
      note: 'Resets this run. Relics and permanent upgrades stay.',
      affordable: true,
      action: { kind: 'prestige' },
      accent: 'insight',
    });
  }

  // Insight upgrades have their own menu, apart from the run's purchases.
  const remembered = state.prestige.permanentUpgradeIds;
  const nextUpgrade = catalog.insightUpgrades.find((u) => !remembered.includes(u.id));
  const spendable = spendableInsight(state);
  const insightShop: InsightShopRow[] = catalog.insightUpgrades.map((u, i) => {
    const prev = catalog.insightUpgrades[i - 1];
    return {
      id: u.id,
      title: t(`upgrade.${u.id}`),
      effect: t(`upgrade.${u.id}.desc`),
      cost: u.cost,
      state: remembered.includes(u.id) ? 'owned' : u === nextUpgrade ? 'next' : 'locked',
      affordable: u === nextUpgrade && spendable >= u.cost,
      after: prev && !remembered.includes(prev.id) ? t(`upgrade.${prev.id}`) : undefined,
      pinned: state.pinnedGoal === goalKey({ kind: 'upgrade', upgradeId: u.id }, site.id),
    };
  });

  const memory: MemoryRow[] = [];
  for (const def of catalog.sites) {
    const mem = remembranceFor(def.id);
    if (!mem || (def.index > 0 && !state.discoveries.archiveIds.includes(`site.${def.id}`))) continue;
    const rank = state.prestige.remembrances[def.id] ?? 0;
    const costs = catalog.memory.remembranceCosts;
    const cost = rank < costs.length ? costs[rank] : null;
    const kept = state.prestige.filed[def.id];
    memory.push({
      siteId: def.id,
      hill: t(def.displayNameKey),
      name: mem.name,
      rule: mem.rule,
      rank,
      maxRank: costs.length,
      cost,
      affordable: cost !== null && spendable >= cost,
      fileOpen: state.prestige.fileSlots.includes(def.id),
      fileCost: catalog.memory.keepOnFile,
      fileAffordable: spendable >= catalog.memory.keepOnFile,
      filed: kept ? deviceDef(kept).name : null,
      choices: tabletPool(def.id)
        .filter((d) => state.discoveries.codexIds.includes(d.id))
        .map((d) => ({ id: d.id, name: d.name })),
    });
  }

  for (const r of rows) {
    r.pinKey = r.key.startsWith('decree-') ? undefined : goalKey(r.action, site.id);
    r.pinned = !!r.pinKey && r.pinKey === state.pinnedGoal;
  }
  const goal = state.pinnedGoal ? resolveGoal(state, state.pinnedGoal) : null;
  const plainObjective = objective(state, site);
  const now = goal ? goalObjective(state, goal, plainObjective) : plainObjective;

  const nm = nextMilestone(site.productionLevel);
  const prevM = [...catalog.levels.milestones].reverse().find((m) => m <= site.productionLevel) ?? 1;
  const pendingRelic = catalog.relics.catalog.find((r) => r.eligibleSiteId === site.id && !state.discoveries.relicIds.includes(r.id));
  const cur = currencyOf(site.id);
  return {
    revision: state.revision,
    purse: { amount: formatMoney(site.purse), currency: cur.id, name: cur.name, glyph: cur.glyph },
    rate: automated ? formatRate(steadyIncomePerSecond(state, site)) : 'manual',
    automated,
    paused: state.paused,
    insight: spendable,
    insightShop,
    memory,
    scorn: scornOpen(state)
      ? {
          rank: state.prestige.scorn,
          pay: formatTimes(catalog.scorn.payMultiplier ** state.prestige.scorn),
          next: formatTimes(catalog.scorn.payMultiplier ** (state.prestige.scorn + 1)),
          cost: scornCost(state),
          affordable: spendable >= scornCost(state),
        }
      : null,
    gauge: machineGauge(state, site),
    appealOffer: appealOffer(state),
    appeal:
      state.appeal.number > 0 || state.appeal.laurels > 0
        ? { number: state.appeal.number, name: appealDef(state.appeal.number)?.name ?? '', rule: appealDef(state.appeal.number)?.rule ?? '', laurels: state.appeal.laurels }
        : null,
    insightMenu: lifetime > 0,
    insightFactor: formatMultiplier(insightFactor(lifetime)),
    site: {
      id: site.id,
      name: t(def.displayNameKey),
      level: site.productionLevel,
      nextMilestone: nm,
      milestoneProgress: nm === null ? 1 : (site.productionLevel - prevM) / (nm - prevM),
      prevId: idx > 0 ? owned[idx - 1].id : null,
      nextId: idx < owned.length - 1 ? owned[idx + 1].id : null,
      ownedCount: owned.length,
      wheelOwned: site.wheelOwned,
      wheelCharged: site.wheelCharged,
      crew: cast.crew,
      steward: site.steward ? capitalize(cast.steward) : null,
      devices: [...site.devices, ...state.discoveries.whisperIds.filter((w) => deviceDef(w).siteId === site.id)].map((id) => {
        const d = deviceDef(id);
        return { id, name: d.name, rule: d.rule, quip: d.quip };
      }),
    },
    decree,
    prelude: {
      active: prelude,
      reach: preludeReach(state),
      best: state.prelude.bestHeight,
      attempts: state.prelude.attempts,
    },
    objective: now,
    objectiveProgress: goal && !goal.stale ? goal.progress : null,
    goal,
    goalStack: goalHorizons(state, site, now),
    suggestPrestige: award >= PRESTIGE_PROMPT_INSIGHT && (automated || has(state, 'foreman')) && !has(state, 'prestige_prompt'),
    empire: empireView(state),
    charterSigned: state.empire.purchasedWorkIds.includes('charter'),
    rows: rows.map((r) => ({ ...r, icon: rowIcon(r) })),
    prestige: {
      available: award > 0,
      award,
      record: formatMoney(prestigeRecord(state)),
      runGross: formatMoney(state.wallet.runGross),
      factorBefore: formatMultiplier(insightFactor(lifetime)),
      factorAfter: formatMultiplier(insightFactor(lifetime + award)),
      nextTarget: formatMoney(nextRecordTarget(state)),
    },
    relics: state.discoveries.relicIds.map((id) => ({ id, name: t(`relic.${id}`), joke: t(`relic.${id}.joke`) })),
    relicHunt: pendingRelic
      ? {
          site: t(def.displayNameKey),
          chance: `${+(catalog.relics.chancePerDescent * 100).toFixed(2)}% per descent`,
          guarantee: pendingRelic.guaranteedBy.startsWith('open:') ? 'guaranteed when the next hill opens' : 'guaranteed by the Charter',
        }
      : null,
  };
}
