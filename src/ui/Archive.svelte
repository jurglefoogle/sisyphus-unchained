<script lang="ts">
  import type { ArchiveView } from '../app/archive';
  import { artUrl, iconUrl } from '../world/library';
  import Modal from './Modal.svelte';

  let { archive, onclose, onscene }: { archive: ArchiveView; onclose: () => void; onscene: (id: string) => void } = $props();

  type Tab = 'overview' | 'guide' | 'stamps' | 'myths' | 'relics' | 'decrees' | 'scenes' | 'stones' | 'odds';
  let tab = $state<Tab>('overview');
  const tabs: [Tab, string][] = [
    ['overview', 'Overview'],
    ['guide', 'Guide'],
    ['stamps', 'Stamps'],
    ['myths', 'Mythology'],
    ['relics', 'Relics'],
    ['decrees', 'Decrees'],
    ['scenes', 'Scenes'],
    ['stones', 'Stones'],
    ['odds', 'Odds'],
  ];
  let open = $state<string | null>(null);
</script>

<Modal title="Archive" {onclose} wide>
  <div class="tabs" role="tablist" aria-label="Archive sections">
    {#each tabs as [id, label] (id)}
      <button role="tab" aria-selected={tab === id} class:active={tab === id} onclick={() => (tab = id)}>{label}</button>
    {/each}
  </div>

  {#if tab === 'overview'}
    <p class="muted">A record of what this sentence has become. Completion is for the record and grants no production advantage.</p>
    <div class="completion">
      {#each archive.completion as item (item.id)}
        <button onclick={() => (tab = item.id as Tab)} aria-label="Open {item.label}: {item.found} of {item.total}">
          <span><strong>{item.label}</strong><b>{item.found} / {item.total}</b></span>
          <span class="completion-bar" aria-hidden="true"><i style:width="{item.total ? item.found / item.total * 100 : 0}%"></i></span>
        </button>
      {/each}
    </div>
    <h3>Records</h3>
    <dl class="records">
      {#each archive.records as record (record.label)}
        <div><dt>{record.label}</dt><dd>{record.value}</dd></div>
      {/each}
    </dl>
  {:else if tab === 'guide'}
    <p class="muted">Every instruction the game has given you, kept for reference.</p>
    <ul class="entries">
      {#each archive.guide.filter((g) => g.seen) as g (g.id)}
        <li><p><strong>{g.title}.</strong> {g.text}</p></li>
      {/each}
    </ul>
    {#if archive.guide.some((g) => !g.seen)}
      <p class="muted">{archive.guide.filter((g) => !g.seen).length} more entries appear as you discover them.</p>
    {/if}
  {:else if tab === 'stamps'}
    <p class="muted">{archive.earned} of {archive.achievements.length} stamps. Stamps are for the record; they add no income.</p>
    <ul class="stamps">
      {#each archive.achievements as a (a.id)}
        <li class:earned={a.earned}>
          <img src={iconUrl(`achievement_${a.id}`)} alt="" />
          <strong>{a.earned ? a.name : 'Unstamped'}</strong>
          <small>{a.desc}</small>
        </li>
      {/each}
    </ul>
  {:else if tab === 'myths'}
    <ul class="entries">
      {#each archive.subjects as s (s.id)}
        <li class:locked={!s.unlocked}>
          {#if s.unlocked}
            <button class="entry-head" aria-expanded={open === s.id} onclick={() => (open = open === s.id ? null : s.id)}>
              {#if s.portrait}<img class="portrait" src={artUrl(`portrait_${s.portrait}`)} alt="" />{/if}
              <strong>{s.title}</strong>
            </button>
            {#if open === s.id}
              <div class="entry-body">
                <p>{s.body}</p>
                <p><em>In this game:</em> {s.adaptation}</p>
                {#if s.margin}<p class="margin" aria-label="Sisyphus’s note">{s.margin}</p>{/if}
                {#if s.variants}<p class="muted">Variants: {s.variants}</p>{/if}
                <p class="source"><a href={s.source.url} target="_blank" rel="noopener noreferrer">{s.source.label}</a></p>
              </div>
            {/if}
          {:else}
            <p class="entry-head"><img class="lock" src={iconUrl('ui_lock')} alt="" /><span class="muted">Not yet encountered</span></p>
          {/if}
        </li>
      {/each}
    </ul>
  {:else if tab === 'relics'}
    <ul class="entries">
      {#each archive.relics as r (r.id)}
        <li class:locked={!r.found}>
          <p class="entry-head">
            <img class="relic" src={iconUrl(r.found ? `relic_${r.id}` : 'ui_lock')} alt="" />
            {#if r.found}<span><strong>{r.name}</strong> <span class="muted">— {r.joke}</span></span>{:else}<span class="muted">Still in the debris somewhere</span>{/if}
          </p>
        </li>
      {/each}
    </ul>
  {:else if tab === 'stones'}
    <p class="muted">Each operation keeps its assigned stone. Earlier stones are kept here for admiring.</p>
    <ul class="stones">
      {#each archive.stones as st (st.siteId)}
        <li class:locked={!st.found}>
          <img src={st.found ? artUrl(st.stone) : iconUrl('ui_lock')} alt="" />
          <strong>{st.found ? st.material : 'Undiscovered'}</strong>
          <small>{st.found ? st.site : 'A later chapter'}</small>
        </li>
      {/each}
    </ul>
  {:else if tab === 'odds'}
    <p class="muted">Every descent breaks one target. Impact upgrades raise the guaranteed impact payout only; they never change these odds. Pushing by hand never changes them either.</p>
    <table class="odds">
      <thead><tr><th scope="col">Target</th><th scope="col">Chance</th><th scope="col">Reward</th></tr></thead>
      <tbody>
        {#each archive.odds.targets as o (o.id)}
          <tr><td><img src={iconUrl(`target_${o.id}`)} alt="" />{o.name}</td><td>{o.chance}</td><td>{o.reward}</td></tr>
        {/each}
      </tbody>
    </table>
    <p class="muted">Expected bonus per descent: {archive.odds.expectedBonus} base reward. Offline time pays exactly this expectation.</p>
    <h3>Relics</h3>
    <p>While a relic can be found, each descent at its site has a {archive.odds.relicChance} chance to turn it up, and it is guaranteed within {archive.odds.relicPity} descents. Opening the next operation (or signing the Charter, for the last one) delivers any relic still missing.</p>
  {:else if tab === 'scenes'}
    <ul class="entries">
      {#each archive.scenes as sc (sc.id)}
        <li class="scene-row">
          {#if sc.seen}
            <span><strong>{sc.title}</strong> <small class="muted">{sc.when}</small></span>
            <button onclick={() => onscene(sc.id)}>Watch</button>
          {:else}
            <span class="muted">Not yet seen <small>· {sc.when}</small></span>
          {/if}
        </li>
      {/each}
    </ul>
  {:else}
    {#if archive.decrees.length === 0}
      <p class="muted">No decrees yet. Keep pushing; the gods will have something to say.</p>
    {/if}
    <ul class="entries">
      {#each archive.decrees as d (d.id)}
        <li>
          <p class="god">{d.god}</p>
          <p class="sis">— {d.sis}</p>
        </li>
      {/each}
    </ul>
  {/if}
</Modal>

<style>
  .completion {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 0.6rem;
  }
  .completion button {
    display: grid;
    gap: 0.45rem;
    text-align: left;
    background: rgba(255, 252, 245, 0.55);
    border: 1px solid var(--rule);
  }
  .completion button > span:first-child { display: flex; justify-content: space-between; gap: 0.5rem; }
  .completion-bar { height: 5px; overflow: hidden; border-radius: 3px; background: rgba(33, 27, 23, 0.15); }
  .completion-bar i { display: block; height: 100%; background: var(--clay); }
  .records { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.5rem; }
  .records div { border-bottom: 1px solid var(--rule); padding: 0.4rem 0; }
  .records dt { color: var(--muted); font-size: 0.82rem; }
  .records dd { margin: 0.1rem 0 0; font-family: var(--display); font-size: 1.2rem; font-weight: 700; }
  .stones {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 0.6rem;
  }
  .stones li {
    display: grid;
    justify-items: center;
    text-align: center;
    gap: 0.2rem;
    padding: 0.6rem;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
  }
  .stones img { width: 84px; height: 84px; object-fit: contain; }
  .stones li.locked img { width: 40px; height: 40px; margin: 22px 0; opacity: 0.5; }
  .stones small { color: var(--muted); }
  .odds { width: 100%; border-collapse: collapse; margin: 0.5rem 0; font-variant-numeric: tabular-nums; }
  .odds th, .odds td { text-align: left; padding: 0.35rem 0.5rem; border-bottom: 1px solid var(--rule); }
  .odds td img { width: 28px; height: 28px; vertical-align: middle; margin-right: 0.4rem; }
  h3 { font-family: var(--display); font-size: 1.2rem; margin: 1rem 0 0.2rem; }
  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin: 0.6rem 0 0.8rem;
  }
  .tabs button.active {
    background: var(--ink);
    color: var(--ivory);
  }
  .muted {
    color: var(--muted);
  }
  .scene-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  /* Scrawled beside the entry by its least reliable reader. */
  .margin {
    font-style: italic;
    color: var(--clay);
    transform: rotate(-0.6deg);
  }
  .margin::before {
    content: '— S. ';
    font-style: normal;
    font-weight: 600;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .stamps {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 0.6rem;
  }
  .stamps li {
    display: grid;
    justify-items: center;
    text-align: center;
    gap: 0.2rem;
    padding: 0.6rem 0.4rem;
    border: 2px dashed rgba(33, 27, 23, 0.3);
    border-radius: 8px;
  }
  .stamps li.earned {
    border-style: solid;
    border-color: var(--bronze);
    background: rgba(165, 123, 59, 0.08);
  }
  .stamps img {
    width: 64px;
    height: 64px;
  }
  .stamps li:not(.earned) img {
    opacity: 0.25;
    filter: grayscale(1);
  }
  .stamps small {
    color: var(--muted);
    font-size: 0.8rem;
  }
  .entries li {
    border-bottom: 1px solid rgba(33, 27, 23, 0.2);
    padding: 0.5rem 0;
  }
  .entry-head {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin: 0;
    width: 100%;
    text-align: left;
    background: transparent;
    border: none;
    padding: 0.2rem 0;
    font: inherit;
    color: inherit;
    min-height: 44px;
  }
  button.entry-head {
    cursor: pointer;
  }
  .portrait {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    object-fit: cover;
    object-position: 50% 30%;
    background: var(--parchment);
    border: 2px solid var(--pale-clay);
  }
  .lock,
  .relic {
    width: 32px;
    height: 32px;
  }
  .locked .lock,
  .locked .relic {
    opacity: 0.4;
  }
  .entry-body p {
    margin: 0.4rem 0;
  }
  .source {
    font-size: 0.9rem;
  }
  .source a {
    color: var(--clay);
  }
  .god {
    margin: 0;
    font-style: italic;
  }
  .sis {
    margin: 0.2rem 0 0;
    color: var(--muted);
  }
</style>
