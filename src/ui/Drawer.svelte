<script lang="ts">
  import type { Game } from '../app/game';
  import type { GameView, PurchaseRow } from '../app/view';
  import { iconUrl, imageUrl } from '../world/library';

  let { game, view, onprestige }: { game: Game; view: GameView; onprestige: () => void } = $props();

  /** Prices are Obols unless they name Insight. */
  function price(cost: string): { icon: string; amount: string } {
    return cost.endsWith(' Insight') ? { icon: 'ui_insight', amount: cost.slice(0, -' Insight'.length) } : { icon: 'ui_obols', amount: cost };
  }

  function act(row: PurchaseRow, count = 1) {
    const a = row.action;
    // One request per offer as displayed: a double click on the same offer buys once.
    const id = `${view.revision}:${view.site.id}:${row.key}:${count}`;
    switch (a.kind) {
      case 'levels':
        return game.buyLevels(a.track, count, id);
      case 'flywheel':
        return game.buyFlywheel(id);
      case 'foreman':
        return game.hireForeman(id);
      case 'work':
        return game.buyWork(a.workId, id);
      case 'site':
        return game.openSite(a.siteId, id);
      case 'upgrade':
        return game.buyUpgrade(a.upgradeId, id);
      case 'prelude':
        return game.buyPreludeUpgrade(a.upgradeId, id);
      case 'prestige':
        return onprestige();
    }
  }
</script>

<div class="drawer-body">
  <div class="site-head">
    <h2>{view.site.name}</h2>
    {#if view.prelude.active}
      <p class="muted">Grip gives out at {Math.round(view.prelude.reach * 100)}% · best {Math.round(view.prelude.best * 100)}%</p>
      <div class="bar" role="progressbar" aria-label="Highest point reached" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(view.prelude.best * 100)}>
        <span style:width="{view.prelude.best * 100}%"></span>
      </div>
    {:else}
      <p class="muted">
        Level {view.site.level}{#if view.site.nextMilestone}&nbsp;· next ×2 at {view.site.nextMilestone}{/if}
      </p>
      <div class="bar" role="progressbar" aria-label="Progress to next milestone" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(view.site.milestoneProgress * 100)}>
        <span style:width="{view.site.milestoneProgress * 100}%"></span>
      </div>
    {/if}
  </div>

  {#if view.goal?.stale}
    <div class="stale-goal">
      <span>Pinned goal no longer available: <strong>{view.goal.title}</strong></span>
      <button onclick={() => game.pinGoal(null)}>Unpin</button>
    </div>
  {/if}

  {#if view.rows.length === 0}
    <p class="muted empty">{view.prelude.active ? 'Push. See how far you get.' : 'Reach the summit to earn your first Obols.'}</p>
  {/if}

  <ul>
    {#each view.rows as row (row.key)}
      <li class="row" class:affordable={row.affordable && !row.disabled} class:pinned={row.pinned} data-accent={row.accent ?? 'plain'}>
        <div class="row-head">
          {#if row.icon}<img class="row-icon" class:art={row.icon.startsWith('work_')} src={imageUrl(row.icon)} alt="" />{/if}
          <strong>{row.title}</strong>
          {#if row.level}<span class="level">{row.level}</span>{/if}
          {#if row.pinKey}
            <button
              class="pin"
              aria-pressed={!!row.pinned}
              title={row.pinned ? 'Unpin goal' : 'Pin as goal'}
              aria-label={row.pinned ? `Unpin ${row.title}` : `Pin ${row.title} as your goal`}
              onclick={() => game.pinGoal(row.pinned ? null : row.pinKey!)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l-1 6 4 4H6l4-4z M12 13v8" /></svg>
            </button>
          {/if}
        </div>
        <p class="effect">{row.effect}</p>
        {#if row.note}<p class="note">{row.note}</p>{/if}
        {#if row.progress !== undefined}
          <div class="bar" role="progressbar" aria-label="{row.title} progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(row.progress * 100)}>
            <span style:width="{row.progress * 100}%"></span>
          </div>
        {/if}
        {#if !row.disabled}
          <div class="buttons">
            {#if row.options}
              {#each row.options as opt (opt.label)}
                {@const p = price(opt.cost)}
                <button disabled={!opt.affordable} onclick={() => act(row, opt.count)} aria-label="{row.title}: {opt.label} for {opt.cost} Obols">
                  <span>{opt.label}</span><small class="cost"><img src={iconUrl(p.icon)} alt="" />{p.amount}</small>
                </button>
              {/each}
            {:else}
              <button disabled={!row.affordable} onclick={() => act(row)} aria-label="{row.title}{row.cost ? ` for ${row.cost}` : ''}">
                <span>{row.action.kind === 'prestige' ? 'Review' : row.action.kind === 'site' ? 'Open' : 'Buy'}</span>
                {#if row.cost}{@const p = price(row.cost)}<small class="cost"><img src={iconUrl(p.icon)} alt="" />{p.amount}</small>{/if}
              </button>
            {/if}
          </div>
          {#if row.wait}<p class="wait">{row.wait}</p>{/if}
        {/if}
      </li>
    {/each}
  </ul>

  {#if view.relics.length}
    <section class="relics">
      <h3>Relics</h3>
      {#each view.relics as r (r.id)}
        <p class="relic"><img src={iconUrl(`relic_${r.id}`)} alt="" /><span><strong>{r.name}</strong> <span class="muted">— {r.joke}</span></span></p>
      {/each}
    </section>
  {/if}
</div>

<style>
  .drawer-body {
    padding: 0.9rem 0.9rem 1.5rem;
  }
  h2 {
    margin: 0;
    font-family: var(--display);
    font-weight: 600;
    font-size: 1.45rem;
    letter-spacing: 0.02em;
  }
  h3 {
    margin: 1.2rem 0 0.4rem;
    font-size: 0.72rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .muted {
    color: var(--muted);
    margin: 0.15rem 0 0.4rem;
    font-size: 0.9rem;
  }
  .empty {
    margin-top: 1rem;
    font-style: italic;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0.9rem 0 0;
    display: grid;
    gap: 0.6rem;
  }
  .row {
    border: 1px solid var(--rule);
    border-left: 4px solid var(--rule);
    border-radius: var(--radius);
    padding: 0.7rem 0.8rem 0.75rem;
    background: rgba(255, 252, 245, 0.7);
  }
  .row.affordable {
    background: #fffaf0;
    box-shadow: 0 0 0 1px var(--bronze), var(--shadow);
  }
  .row[data-accent='machine'] {
    border-left-color: var(--bronze);
  }
  .row[data-accent='work'] {
    border-left-color: var(--clay);
  }
  .row[data-accent='decree'] {
    border-left-color: var(--ink);
  }
  .row[data-accent='grip'] {
    border-left-color: var(--pale-clay);
  }
  .row[data-accent='insight'] {
    border-left-color: #6b4f8a;
  }
  .row.pinned {
    box-shadow: 0 0 0 2px var(--clay), var(--shadow);
  }
  .row.pinned.affordable {
    background: #fff6e2;
  }
  .pin {
    width: 44px;
    height: 44px;
    margin: -6px -4px -6px 0;
    padding: 0;
    display: grid;
    place-items: center;
    border-radius: 50%;
    border: 1px solid var(--rule);
    background: transparent;
    flex: none;
  }
  .pin svg {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: var(--muted);
    stroke-width: 1.8;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .pin[aria-pressed='true'] {
    background: var(--clay);
    border-color: var(--clay);
  }
  .pin[aria-pressed='true'] svg {
    stroke: var(--ivory);
    fill: var(--ivory);
  }
  .stale-goal {
    margin-top: 0.8rem;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.88rem;
    padding: 0.5rem 0.7rem;
    border: 1px dashed var(--rule);
    border-radius: var(--radius);
  }
  .stale-goal span { flex: 1; }
  .row-head {
    display: flex;
    align-items: center;
    gap: 0.55rem;
  }
  .row-head strong {
    flex: 1;
    font-family: var(--display);
    font-size: 1.15rem;
    font-weight: 700;
    line-height: 1.15;
  }
  .row-icon {
    width: 30px;
    height: 30px;
    flex: none;
  }
  .row-icon.art {
    width: 46px;
    height: 46px;
    object-fit: contain;
    margin: -6px 0;
  }
  .level {
    color: var(--muted);
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
  }
  .relic {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin: 0.35rem 0;
  }
  .relic img {
    width: 40px;
    height: 40px;
    flex: none;
  }
  .effect,
  .note,
  .wait {
    margin: 0.25rem 0;
    font-size: 0.9rem;
    line-height: 1.4;
  }
  .note,
  .wait {
    color: var(--muted);
  }
  .wait {
    font-style: italic;
    font-size: 0.82rem;
  }
  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.5rem;
  }
  .buttons button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    border-radius: 999px;
    padding: 0 0.9rem;
    font-weight: 700;
    background: transparent;
  }
  .buttons button:not(:disabled) {
    background: var(--clay);
    color: var(--ivory);
  }
  .cost {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    font-size: 0.85rem;
    font-weight: 400;
    font-variant-numeric: tabular-nums;
    opacity: 0.95;
  }
  .cost img {
    width: 1.05em;
    height: 1.05em;
  }
  .buttons button:not(:disabled) .cost img {
    filter: invert(94%) sepia(8%) saturate(400%) hue-rotate(340deg);
  }
  .bar {
    height: 6px;
    background: rgba(33, 27, 23, 0.14);
    border-radius: 3px;
    overflow: hidden;
    margin: 0.35rem 0;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--bronze);
    transition: width 0.4s ease;
  }
</style>
