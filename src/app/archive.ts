import { ARCHIVE_SUBJECTS, type ArchiveSubject } from '../content/archive';
import { catalog, siteDef } from '../content/catalog';
import { DEVICES, WHISPERS } from '../content/devices';
import { MACHINE_CARDS, machineFlag } from '../content/machines';
import { SCENE_FOR_STORY, SCENES, sceneSeenId } from '../content/scenes';
import { en, t } from '../content/strings';
import { ACHIEVEMENTS } from '../core/achievements';
import { formatDuration, formatMoney } from '../core/format';
import type { GameState } from '../core/state';

export interface ArchiveView {
  completion: { id: string; label: string; found: number; total: number }[];
  records: { label: string; value: string }[];
  achievements: { id: string; name: string; desc: string; earned: boolean }[];
  earned: number;
  subjects: (ArchiveSubject & { unlocked: boolean })[];
  relics: { id: string; name: string; joke: string; found: boolean }[];
  /** Every device ever revealed; the rest show only their seal (or their rumour, once heard). */
  codex: { id: string; hill: string; source: string; name: string; rule: string; quip: string; hint: string; found: boolean }[];
  decrees: { id: string; god: string; sis: string }[];
  /** Cutscenes, rewatchable once seen. */
  scenes: { id: string; title: string; when: string; seen: boolean }[];
  /** Every tutorial explanation, kept once it has been shown (spec §01). */
  guide: { id: string; title: string; text: string; seen: boolean }[];
  /** Earlier stones stay viewable here; there is no loadout (spec §03). */
  stones: { siteId: string; stone: string; site: string; material: string; found: boolean }[];
  /** Published odds (spec §02): bonus targets and relic discovery. */
  odds: {
    targets: { id: string; name: string; chance: string; reward: string }[];
    expectedBonus: string;
    relicChance: string;
    relicPity: number;
  };
}

const STONES: Record<string, [string, string]> = {
  first_hill: ['stone_limestone', 'Limestone'],
  tartarus_rim: ['stone_basalt', 'Basalt'],
  leaking_heights: ['stone_marble', 'Marble'],
  bronze_pass: ['stone_bronze', 'Bronze-bound stone'],
  skyward_escarpment: ['stone_star', 'Star-patterned rock'],
  olympian_approach: ['stone_decree', 'Inscribed decree stone'],
};

const TARGET_NAMES: Record<string, string> = {
  debris: 'Debris',
  coin_amphora: 'Coin amphora',
  gilded_offering: 'Gilded offering',
};

/**
 * The instructions the game gives in passing, in the order they appear. `after`
 * is the tutorial flag that reveals them; `when` reveals them from the save
 * instead, for systems that arrive without a prompt.
 */
const GUIDE: { id: string; title: string; after: string | null; when?: (s: GameState) => boolean; text: string }[] = [
  { id: 'push', title: 'Pushing', after: null, text: 'Hold the boulder, Space or the Push button to climb (a toggle is available in Settings). Releasing only pauses the climb; it never loses distance.' },
  { id: 'grip', title: 'Grip and falls', after: 'first_slip', text: 'At first your grip gives out and the stone slips back down. Every fall pays a small obol, and each grip upgrade lets you reach higher. Full grip reaches the summit.' },
  { id: 'summit', title: 'Summit and impact', after: 'first_summit', text: 'The summit pays 70% of a climb and the impact below pays the other 30%, plus any Impact upgrades. A climb’s payout is fixed when it begins, so new purchases raise the next climb. Speed changes apply at once.' },
  { id: 'improve', title: 'Improving a hill', after: 'first_level', text: 'Improve Operation raises the payout; levels 10, 25, 50, 100, 150 and 200 each double it. Strength shortens the ascent down to a two-second floor. Impact raises the impact share. Buy 10 and To Milestone save clicks.' },
  { id: 'flywheel', title: 'The flywheel', after: 'first_wheel', text: 'A flywheel catches the falling stone. It helps after the next descent: once charged, ascents run 25% faster. It never pays for the climb it was bought during.' },
  { id: 'foreman', title: 'The Foreman', after: 'foreman', text: 'The Foreman contract automates every hill you own now or later, and it works while you are away (up to 12 hours). Holding Push still speeds the hill in view by up to 50%. Buy Max appears once you have automation.' },
  { id: 'decrees', title: 'Defiance and decrees', after: 'foreman', text: 'Defiance is everything earned this run; spending never lowers it. Each decree opens the next hill for a price. Older hills keep earning.' },
  { id: 'works', title: 'Mythic works', after: 'foreman', text: 'Each hill has named works, unlocked by its production level. They are bought once per run and multiply all income.' },
  { id: 'relics', title: 'Relics', after: 'first_expansion', text: 'Each hill hides one relic, found on a descent (1 in 80, guaranteed within 60). Opening the next hill delivers a missing one. Relics add ×1.1 income each and survive Begin Again.' },
  { id: 'prestige', title: 'Begin Again', after: 'prestige_prompt', text: 'Begin Again resets the run for Existential Insight, a permanent income bonus paid on new records. Relics, Insight upgrades, discoveries and settings stay.' },
  { id: 'purses', title: 'Each hill’s own money', after: 'first_expansion', text: 'Every hill earns its own currency, which lands in that hill’s purse and is spent only there. Defiance adds up every hill’s earnings at its appraisal, so spending never lowers it. Decrees and openings are priced in the newest hill’s money.' },
  { id: 'trials', title: 'Decree trials', after: 'counterweight', when: (s) => s.empire.sites.length > 1, text: 'Each decree also sets a trial on the hill before it, such as 100 climbs with the counterweight hung. The next hill’s bar fills half from earnings and half from the trial; both must be met.' },
  { id: 'stewards', title: 'Stewards and standing orders', after: null, when: (s) => s.empire.sites.length > 1, text: 'Each hill has a steward who runs its machine for you once hired. The standing order decides the purse: reinvest spends it on the hill’s own improvements, hold keeps it. A steward can be hired early with Insight.' },
  { id: 'seals', title: 'Sealed tablets and the Codex', after: null, when: (s) => s.empire.sites.some((x) => x.hand.length > 0), text: 'Each hill deals a hand of sealed tablets when it opens. Breaking a seal reveals a device that changes that hill for the run. Every device you reveal stays in the Codex. Whispers are hidden devices, earned by playing a certain way; rumours hint at them.' },
  { id: 'visitors', title: 'Visitors and bargains', after: null, when: (s) => s.empire.sites.some((x) => x.devices.some((d) => BARGAINS.has(d))), text: 'A visitor comes to each hill as its crew grows, with two bargains. Take one; it holds for the run, and the other waits for a later run. With Insight you can send for a visitor early.' },
  { id: 'first_hill', title: 'The Counterweight', after: machineFlag('first_hill'), when: (s) => hasMachine(s, 'first_hill'), text: machineText('first_hill') },
  { id: 'tartarus_rim', title: 'Ixion’s Wheel', after: machineFlag('tartarus_rim'), when: (s) => hasMachine(s, 'tartarus_rim'), text: machineText('tartarus_rim') },
  { id: 'leaking_heights', title: 'The Danaids’ Jar', after: machineFlag('leaking_heights'), when: (s) => hasMachine(s, 'leaking_heights'), text: machineText('leaking_heights') },
  { id: 'bronze_pass', title: 'The Foundry', after: machineFlag('bronze_pass'), when: (s) => hasMachine(s, 'bronze_pass'), text: machineText('bronze_pass') },
  { id: 'skyward_escarpment', title: 'The Orrery', after: machineFlag('skyward_escarpment'), when: (s) => hasMachine(s, 'skyward_escarpment'), text: machineText('skyward_escarpment') },
  { id: 'olympian_approach', title: 'The Paperwork Mill', after: machineFlag('olympian_approach'), when: (s) => hasMachine(s, 'olympian_approach'), text: machineText('olympian_approach') },
  { id: 'memory', title: 'Spending Insight', after: null, when: (s) => s.counters.totalRuns > 0, text: 'Besides the eight permanent upgrades, Insight buys Remembrances (five ranks per hill, deepening its machine in every run), Keep on File (a revealed tablet always dealt there), Unseal in Advance and Send for a Visitor.' },
  { id: 'appeals', title: 'Appeals and laurels', after: null, when: (s) => s.appeal.number > 0 || s.records.firstCharterSeconds !== null || s.discoveries.seenStoryIds.includes('charter_purchase'), text: 'After the Charter, File an Appeal begins a harder campaign: prices rise and every hill gets a rule twist with a compensation. Signing the Charter again wins a laurel, and every crew earns 10% more per laurel, for good.' },
  { id: 'goals', title: 'Goals and the empire', after: 'first_level', text: 'Pin any purchase as your goal: the objective line tracks it and never reserves money. The Empire view shows every hill; choosing one only moves your attention.' },
];

const BARGAINS = new Set(DEVICES.filter((d) => d.source === 'bargain').map((d) => d.id));
function hasMachine(s: GameState, siteId: string): boolean {
  const x = s.empire.sites.find((site) => site.id === siteId);
  return !!x && (x.counterweight !== null || !!x.furnace || !!x.jar || !!x.foundry || !!x.sky || !!x.bureau);
}
function machineText(siteId: string): string {
  const c = MACHINE_CARDS.find((m) => m.siteId === siteId)!;
  return `${c.decision} ${c.text}`;
}

const percent = (p: number) => `${+(p * 100).toFixed(2)}%`;

/** Story beats in the order the strings table defines them. */
const STORY_IDS = Object.keys(en)
  .filter((k) => k.startsWith('story.') && k.endsWith('.god'))
  .map((k) => k.slice('story.'.length, -'.god'.length));

/** Subjects unlock when they first appear in play (spec §03). */
function subjectUnlocked(s: GameState, id: string): boolean {
  const d = s.discoveries;
  const work = (w: string) => s.empire.purchasedWorkIds.includes(w) || d.seenWorkIds.includes(w) || d.archiveIds.includes(w);
  switch (id) {
    case 'sisyphus':
    case 'vase_painting':
      return true;
    case 'zeus':
      return d.seenStoryIds.length > 0;
    case 'thanatos':
      return d.archiveIds.includes('thanatos') || s.counters.totalRuns > 0;
    case 'hephaestus':
      return work('talos');
    case 'ichor':
      return work('talos') || d.relicIds.includes('ichor_ampoule');
    default:
      return work(id);
  }
}

export function buildArchive(s: GameState): ArchiveView {
  const owned = s.discoveries.achievementIds;
  const subjects = ARCHIVE_SUBJECTS.map((subject) => ({ ...subject, unlocked: subjectUnlocked(s, subject.id) }));
  const relics = catalog.relics.catalog.map((r) => ({
    id: r.id,
    name: t(`relic.${r.id}`),
    joke: t(`relic.${r.id}.joke`),
    found: s.discoveries.relicIds.includes(r.id),
  }));
  const heardRumours = new Set(s.discoveries.rumourIds);
  const codex = [...DEVICES, ...WHISPERS].map((d) => {
    const whisper = WHISPERS.find((w) => w.id === d.id);
    return {
      id: d.id,
      hill: t(siteDef(d.siteId).displayNameKey),
      source: d.source,
      name: d.name,
      rule: d.rule,
      quip: d.quip,
      hint: whisper ? (heardRumours.has(d.id) ? whisper.rumour : 'Nobody has mentioned it.') : d.hint,
      found: s.discoveries.codexIds.includes(d.id),
    };
  });
  const guide = GUIDE.map((g) => ({
    id: g.id,
    title: g.title,
    text: g.text,
    seen:
      (g.after === null && !g.when) ||
      (g.after !== null && s.discoveries.tutorialIds.includes(g.after)) ||
      !!g.when?.(s) ||
      (g.id === 'prestige' && s.counters.totalRuns > 0) ||
      (g.id === 'grip' && s.prelude.complete),
  }));
  const stones = catalog.sites.map((site, i) => {
    const [stone, material] = STONES[site.id] ?? ['stone_limestone', 'Stone'];
    return {
      siteId: site.id,
      stone,
      site: t(site.displayNameKey),
      material,
      found: i <= s.counters.highestSiteEver || s.empire.sites.some((x) => x.id === site.id),
    };
  });
  const scenes = SCENES.map((scene) => ({
    id: scene.id,
    title: scene.title,
    when: scene.when,
    seen:
      scene.id === 'sentence' ||
      s.discoveries.tutorialIds.includes(sceneSeenId(scene.id)) ||
      Object.entries(SCENE_FOR_STORY).some(([story, id]) => id === scene.id && s.discoveries.seenStoryIds.includes(story)),
  }));
  const decrees = STORY_IDS.filter((id) => s.discoveries.seenStoryIds.includes(id)).map((id) => ({
    id,
    god: t(`story.${id}.god`),
    sis: t(`story.${id}.sis`),
  }));
  return {
    completion: [
      { id: 'guide', label: 'Guide', found: guide.filter((x) => x.seen).length, total: guide.length },
      { id: 'stamps', label: 'Stamps', found: ACHIEVEMENTS.filter((a) => owned.includes(a.id)).length, total: ACHIEVEMENTS.length },
      { id: 'myths', label: 'Mythology', found: subjects.filter((x) => x.unlocked).length, total: subjects.length },
      { id: 'relics', label: 'Relics', found: relics.filter((x) => x.found).length, total: relics.length },
      { id: 'codex', label: 'Codex', found: codex.filter((x) => x.found).length, total: codex.length },
      { id: 'scenes', label: 'Scenes', found: scenes.filter((x) => x.seen).length, total: scenes.length },
      { id: 'stones', label: 'Stones', found: stones.filter((x) => x.found).length, total: stones.length },
    ],
    records: [
      { label: 'Best Defiance run', value: formatMoney(s.wallet.bestRunGross) },
      { label: 'Begin Again', value: String(s.counters.totalRuns) },
      { label: 'Completed climbs', value: String(s.counters.totalClimbs) },
      { label: 'Resolved impacts', value: String(s.counters.totalImpacts) },
      { label: 'Highest chapter', value: `${s.counters.highestSiteEver + 1} / ${catalog.sites.length}` },
      { label: 'Active labor', value: formatDuration(s.counters.totalActiveSeconds) },
      ...timedRecords(s),
    ],
    achievements: ACHIEVEMENTS.map((a) => ({
      id: a.id,
      name: t(`achievement.${a.id}`),
      desc: t(`achievement.${a.id}.desc`),
      earned: owned.includes(a.id),
    })),
    earned: ACHIEVEMENTS.filter((a) => owned.includes(a.id)).length,
    subjects,
    relics,
    codex,
    guide,
    stones,
    odds: {
      targets: catalog.bonusTargets.map((b) => ({
        id: b.id,
        name: TARGET_NAMES[b.id] ?? b.id,
        chance: percent(b.probability),
        reward: b.baseMultiplier > 0 ? `+${b.baseMultiplier}× the cycle's base reward` : 'No bonus',
      })),
      expectedBonus: `${+catalog.bonusTargets.reduce((a, b) => a + b.probability * b.baseMultiplier, 0).toFixed(3)}×`,
      relicChance: percent(catalog.relics.chancePerDescent),
      relicPity: catalog.relics.pityDescents,
    },
    decrees,
    scenes,
  };
}

/** Clocks count play plus counted absence; unknown clocks (older saves) are left out, never guessed. */
function timedRecords(s: GameState): { label: string; value: string }[] {
  const r = s.records;
  const out: { label: string; value: string }[] = [];
  if (r.runSeconds !== null) out.push({ label: 'This run', value: formatDuration(r.runSeconds) });
  if (r.firstCharterSeconds !== null) out.push({ label: 'First Charter', value: formatDuration(r.firstCharterSeconds) });
  for (const key of Object.keys(r.charterSeconds).sort((a, b) => Number(a) - Number(b))) {
    const n = Number(key);
    out.push({ label: n === 0 ? 'Fastest Charter' : `Fastest Charter, Appeal ${n}`, value: formatDuration(r.charterSeconds[key]) });
  }
  return out;
}
