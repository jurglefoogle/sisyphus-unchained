import { catalog, siteDef, type WorkDef } from '../content/catalog';
import { t } from '../content/strings';
import { formatDuration, formatMoney, formatMultiplier, formatRate } from '../core/format';
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
  flywheelUnlocked,
  foremanUnlocked,
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
  strengthLevelEffective,
  type LevelTrack,
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
  | { kind: 'prestige' };

export interface PurchaseRow {
  key: string;
  title: string;
  level?: string;
  effect: string;
  note?: string;
  cost?: string;
  affordable: boolean;
  disabled?: boolean;
  wait?: string;
  action: RowAction;
  options?: BuyOption[];
  accent?: 'machine' | 'work' | 'decree' | 'insight' | 'grip';
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
  }
}

export interface GameView {
  revision: number;
  obols: string;
  rate: string;
  automated: boolean;
  paused: boolean;
  insight: number;
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
  };
  decree: { name: string; progress: number; ready: boolean; shown: boolean } | null;
  /** The opening, while the stone still slips. */
  prelude: { active: boolean; reach: number; best: number; attempts: number };
  objective: string;
  /** Progress marker for the objective line (the pinned goal's affordability). */
  objectiveProgress: number | null;
  goal: GoalView | null;
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
}

export interface GoalView {
  key: string;
  title: string;
  cost: string;
  affordable: boolean;
  /** Bought, capped or otherwise no longer a purchase: kept until unpinned. */
  stale: boolean;
  progress: number;
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
    case 'prestige':
      return undefined;
  }
}

const TRACK_TITLES: Record<LevelTrack, string> = { production: 'Improve Operation', strength: 'Strength', impact: 'Impact' };

export function resolveGoal(state: GameState, key: string): GoalView {
  const [kind, a, b] = key.split(':');
  const obols = state.wallet.obols;
  const money = (title: string, cost: Money | null, stale: boolean, available = true): GoalView => ({
    key,
    title,
    cost: cost ? `${formatMoney(cost)} Obols` : '',
    affordable: !stale && !!cost && available && obols.gte(cost),
    stale: stale || !cost,
    progress: stale || !cost || cost.isZero() ? 1 : Math.min(1, obols.div(cost).toNumber()),
  });
  const siteName = (id: string) => (catalog.sites.some((d) => d.id === id) ? t(siteDef(id).displayNameKey) : id);
  switch (kind) {
    case 'levels': {
      const site = findSite(state, a);
      const track = b as LevelTrack;
      if (!site || !(track in TRACK_TITLES)) return money(`${TRACK_TITLES[track] ?? 'Level'} · ${siteName(a)}`, null, true);
      const level = currentLevel(site, track);
      const capped = level >= levelCap(track) || (track === 'strength' && !strengthLevelEffective(state, site, level));
      const where = state.empire.sites.length > 1 ? ` · ${siteName(a)}` : '';
      return money(`${TRACK_TITLES[track]} ${level + 1}${where}`, capped ? null : bulkCost(site, track, 1), capped);
    }
    case 'flywheel': {
      const site = findSite(state, a);
      return money(`Flywheel · ${siteName(a)}`, site ? flywheelCost(site) : null, !site || site.wheelOwned);
    }
    case 'foreman':
      return money('Foreman Contract', catalog.levels.foremanCost, state.empire.foremanOwned);
    case 'work': {
      const def = catalog.works.find((w) => w.id === a);
      if (!def) return money(a, null, true);
      const site = findSite(state, def.siteId);
      const met = !!site && site.productionLevel >= def.requiredLevel;
      return money(t(def.displayNameKey), def.cost, state.empire.purchasedWorkIds.includes(a), met);
    }
    case 'site': {
      const def = catalog.sites.find((d) => d.id === a);
      if (!def) return money(a, null, true);
      return money(`Open ${siteName(a)}`, def.unlockCost, !!findSite(state, a), state.empire.offeredSiteIds.includes(a));
    }
    case 'prelude': {
      const def = catalog.prelude.upgrades.find((u) => u.id === a);
      const stale = !def || state.prelude.complete || state.prelude.upgradeIds.includes(a);
      return money(t(`prelude.${a}`), def ? def.cost : null, stale, nextPreludeUpgrade(state)?.id === a);
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
  return money(key, null, true);
}

function goalObjective(state: GameState, goal: GoalView, fallback: string): string {
  if (goal.stale) return `Pinned goal done or unavailable (${goal.title}). Next: ${fallback}`;
  if (goal.affordable) return `Goal ready: ${goal.title} (${goal.cost}).`;
  let wait = '';
  const rate = empireIncomePerSecond(state);
  if (goal.cost.endsWith('Obols') && !rate.isZero() && goal.progress > 0 && goal.progress < 1) {
    // cost = obols / progress, so the shortfall follows without re-resolving the price.
    const secs = state.wallet.obols.div(goal.progress).sub(state.wallet.obols).div(rate).toNumber();
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
    return {
      id: def.id,
      chapter: i + 1,
      name: t(def.displayNameKey),
      owned: !!site,
      selected: state.empire.selectedSiteId === def.id,
      offered: state.empire.offeredSiteIds.includes(def.id),
      teased: !site && next?.id === def.id,
      gate: formatMoney(def.defianceGate),
      level: site?.productionLevel ?? 0,
      rate: site ? (automated ? formatRate(steadyIncomePerSecond(state, site)) : 'manual') : '',
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

function waitFor(state: GameState, cost: Money): string | undefined {
  if (state.wallet.obols.gte(cost)) return undefined;
  const short = cost.sub(state.wallet.obols);
  const need = `Need ${formatMoney(short)} more`;
  const rate = empireIncomePerSecond(state);
  if (rate.isZero()) return need;
  return `${need} · ≈ ${formatDuration(short.div(rate).toNumber())} at current income (estimate)`;
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

  const cost1 = bulkCost(site, track, 1)!;
  const options: BuyOption[] = [{ label: 'Buy 1', count: 1, cost: formatMoney(cost1), affordable: state.wallet.obols.gte(cost1) }];
  if (track === 'production' && has(state, 'first_level')) {
    const ten = Math.min(10, cap - level);
    const c10 = bulkCost(site, track, ten);
    if (ten > 1 && c10) options.push({ label: `Buy ${ten}`, count: ten, cost: formatMoney(c10), affordable: state.wallet.obols.gte(c10) });
    const toM = levelsToMilestone(site);
    const cm = toM > 0 ? bulkCost(site, track, toM) : null;
    if (toM > 1 && toM !== ten && cm) {
      options.push({ label: `To ${level + toM}`, count: toM, cost: formatMoney(cm), affordable: state.wallet.obols.gte(cm) });
    }
  }
  if (has(state, 'foreman')) {
    const max = maxAffordable(state, site, track);
    if (max > 1) options.push({ label: `Max ${max}`, count: max, cost: formatMoney(bulkCost(site, track, max)!), affordable: true });
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
    affordable: state.wallet.obols.gte(cost1),
    wait: waitFor(state, cost1),
    action: { kind: 'levels', track },
    options,
  };
}

function workRow(state: GameState, def: WorkDef, site: SiteState): PurchaseRow | null {
  if (state.empire.purchasedWorkIds.includes(def.id)) return null;
  const met = site.productionLevel >= def.requiredLevel;
  return {
    key: `work-${def.id}`,
    title: t(def.displayNameKey),
    effect: t(`${def.displayNameKey}.desc`),
    note: met ? undefined : `Requires ${t(siteDef(site.id).displayNameKey)} level ${def.requiredLevel}`,
    cost: formatMoney(def.cost),
    affordable: met && state.wallet.obols.gte(def.cost),
    disabled: !met,
    wait: met ? waitFor(state, def.cost) : undefined,
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
  if (state.wallet.obols.gte(next.cost)) return `Open Improve: ${name} will get you higher.`;
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
    return `${t('hint.flywheel')} Flywheel: ${formatMoney(flywheelCost(site))} Obols.`;
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
  if (!next) return 'Every operation is yours. The Charter awaits.';
  if (state.empire.offeredSiteIds.includes(next.id)) {
    return `Decree issued: open ${t(next.displayNameKey)} for ${formatMoney(next.unlockCost)} Obols.`;
  }
  return `Next decree at ${formatMoney(next.defianceGate)} Defiance: ${t(next.displayNameKey)}.`;
}

export function buildView(state: GameState): GameView {
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
      affordable: state.wallet.obols.gte(nextGrip.cost),
      action: { kind: 'prelude', upgradeId: nextGrip.id },
      accent: 'grip',
    });
  }
  if (!prelude && has(state, 'first_summit')) {
    rows.push(levelRow(state, site, 'production')!);
  }
  if (has(state, 'first_level')) {
    const str = levelRow(state, site, 'strength');
    const imp = levelRow(state, site, 'impact');
    if (str) rows.push(str);
    if (imp) rows.push(imp);
  }
  if (!site.wheelOwned && flywheelUnlocked(state)) {
    const cost = flywheelCost(site);
    rows.push({
      key: 'flywheel',
      title: 'Flywheel',
      effect: `Catches the falling stone. Ascent ×${flywheelFactor(state)} faster.`,
      note: 'Helps after the next descent',
      cost: formatMoney(cost),
      affordable: state.wallet.obols.gte(cost),
      wait: waitFor(state, cost),
      action: { kind: 'flywheel' },
      accent: 'machine',
    });
  }
  if (!automated && foremanUnlocked(state)) {
    const cost = catalog.levels.foremanCost;
    rows.push({
      key: 'foreman',
      title: 'Foreman Contract',
      effect: 'A shade takes over the pushing on every hill, present and future.',
      note: 'Works while away',
      cost: formatMoney(cost),
      affordable: state.wallet.obols.gte(cost),
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

  const next = nextUnownedSite(state);
  let decree: GameView['decree'] = null;
  if (next) {
    const offered = state.empire.offeredSiteIds.includes(next.id);
    const shown = automated || offered;
    decree = { name: t(next.displayNameKey), progress: decreeProgress(state), ready: offered, shown };
    if (offered) {
      rows.push({
        key: `site-${next.id}`,
        title: `Open ${t(next.displayNameKey)}`,
        effect: 'A new, heavier operation. Existing sites keep working.',
        note: automated ? undefined : 'Without the Foreman only the selected site moves. Completing automation first is recommended.',
        cost: formatMoney(next.unlockCost),
        affordable: state.wallet.obols.gte(next.unlockCost),
        wait: waitFor(state, next.unlockCost),
        action: { kind: 'site', siteId: next.id },
        accent: 'decree',
      });
    } else if (shown) {
      rows.push({
        key: `decree-${next.id}`,
        title: `Decree: ${t(next.displayNameKey)}`,
        effect: `Earn ${formatMoney(next.defianceGate)} Defiance this run (gross Obols; spending never sets it back).`,
        note: `${formatMoney(state.wallet.runGross)} / ${formatMoney(next.defianceGate)}`,
        affordable: false,
        disabled: true,
        progress: decreeProgress(state),
        action: { kind: 'site', siteId: next.id },
        accent: 'decree',
      });
    }
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

  const nextUpgrade = catalog.insightUpgrades.find((u) => !state.prestige.permanentUpgradeIds.includes(u.id));
  if (nextUpgrade && lifetime > 0) {
    rows.push({
      key: `upgrade-${nextUpgrade.id}`,
      title: t(`upgrade.${nextUpgrade.id}`),
      effect: t(`upgrade.${nextUpgrade.id}.desc`),
      cost: `${nextUpgrade.cost} Insight`,
      affordable: spendableInsight(state) >= nextUpgrade.cost,
      action: { kind: 'upgrade', upgradeId: nextUpgrade.id },
      accent: 'insight',
    });
  }

  for (const r of rows) {
    r.pinKey = r.key.startsWith('decree-') ? undefined : goalKey(r.action, site.id);
    r.pinned = !!r.pinKey && r.pinKey === state.pinnedGoal;
  }
  const goal = state.pinnedGoal ? resolveGoal(state, state.pinnedGoal) : null;
  const plainObjective = objective(state, site);

  const nm = nextMilestone(site.productionLevel);
  const prevM = [...catalog.levels.milestones].reverse().find((m) => m <= site.productionLevel) ?? 1;
  return {
    revision: state.revision,
    obols: formatMoney(state.wallet.obols),
    rate: automated ? formatRate(empireIncomePerSecond(state)) : 'manual',
    automated,
    paused: state.paused,
    insight: spendableInsight(state),
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
    },
    decree,
    prelude: {
      active: prelude,
      reach: preludeReach(state),
      best: state.prelude.bestHeight,
      attempts: state.prelude.attempts,
    },
    objective: goal ? goalObjective(state, goal, plainObjective) : plainObjective,
    objectiveProgress: goal && !goal.stale ? goal.progress : null,
    goal,
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
  };
}
