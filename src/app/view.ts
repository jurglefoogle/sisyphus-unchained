import { catalog, siteDef, type WorkDef } from '../content/catalog';
import { t } from '../content/strings';
import { formatDuration, formatMoney, formatMultiplier, formatRate } from '../core/format';
import {
  ascentSeconds,
  availableInsight,
  bulkCost,
  cyclePayout,
  decreeProgress,
  empireIncomePerSecond,
  flywheelCost,
  flywheelFactor,
  insightFactor,
  isAutomated,
  levelCap,
  levelsToMilestone,
  maxAffordable,
  nextMilestone,
  nextRecordTarget,
  nextUnownedSite,
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
  accent?: 'machine' | 'work' | 'decree' | 'insight';
  progress?: number;
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
  objective: string;
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

const has = (state: GameState, id: string) => state.discoveries.tutorialIds.includes(id);

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
  const rate = empireIncomePerSecond(state);
  if (rate.isZero()) return undefined;
  const secs = cost.sub(state.wallet.obols).div(rate).toNumber();
  return `≈ ${formatDuration(secs)} (estimate)`;
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

function objective(state: GameState, site: SiteState): string {
  if (!has(state, 'first_summit')) return t('hint.push');
  if (!has(state, 'first_level')) return t('hint.improve');
  if (!state.empire.sites.some((s) => s.wheelOwned)) {
    return has(state, 'first_descent')
      ? `${t('hint.flywheel')} Flywheel: ${formatMoney(flywheelCost(site))} Obols.`
      : t('hint.improve');
  }
  if (!isAutomated(state)) {
    if (!state.empire.sites.some((s) => s.wheelCharged)) return t('hint.charge');
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

  if (has(state, 'first_summit')) {
    rows.push(levelRow(state, site, 'production')!);
  }
  if (has(state, 'first_level')) {
    const str = levelRow(state, site, 'strength');
    const imp = levelRow(state, site, 'impact');
    if (str) rows.push(str);
    if (imp) rows.push(imp);
  }
  if (!site.wheelOwned && (has(state, 'first_descent') || owned.some((s) => s.wheelOwned))) {
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
  if (!automated && owned.some((s) => s.wheelOwned)) {
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
    objective: objective(state, site),
    rows,
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
