<script lang="ts">
  import type { Game } from '../app/game';
  import type { GameView, PurchaseRow } from '../app/view';

  let { game, view, onprestige }: { game: Game; view: GameView; onprestige: () => void } = $props();

  function act(row: PurchaseRow, count = 1) {
    const a = row.action;
    switch (a.kind) {
      case 'levels':
        return game.buyLevels(a.track, count);
      case 'flywheel':
        return game.buyFlywheel();
      case 'foreman':
        return game.hireForeman();
      case 'work':
        return game.buyWork(a.workId);
      case 'site':
        return game.openSite(a.siteId);
      case 'upgrade':
        return game.buyUpgrade(a.upgradeId);
      case 'prelude':
        return game.buyPreludeUpgrade(a.upgradeId);
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

  {#if view.rows.length === 0}
    <p class="muted empty">{view.prelude.active ? 'Push. See how far you get.' : 'Reach the summit to earn your first Obols.'}</p>
  {/if}

  <ul>
    {#each view.rows as row (row.key)}
      <li class="row" class:affordable={row.affordable && !row.disabled} data-accent={row.accent ?? 'plain'}>
        <div class="row-head">
          <strong>{row.title}</strong>
          {#if row.level}<span class="level">{row.level}</span>{/if}
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
                <button disabled={!opt.affordable} onclick={() => act(row, opt.count)} aria-label="{row.title}: {opt.label} for {opt.cost} Obols">
                  <span>{opt.label}</span><small>{opt.cost}</small>
                </button>
              {/each}
            {:else}
              <button disabled={!row.affordable} onclick={() => act(row)}>
                <span>{row.action.kind === 'prestige' ? 'Review' : row.action.kind === 'site' ? 'Open' : 'Buy'}</span>
                {#if row.cost}<small>{row.cost}</small>{/if}
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
        <p><strong>{r.name}</strong> <span class="muted">— {r.joke}</span></p>
      {/each}
    </section>
  {/if}
</div>

<style>
  .drawer-body {
    padding: 0.75rem 0.9rem 1.5rem;
  }
  h2 {
    margin: 0;
    font-size: 1.2rem;
  }
  h3 {
    margin: 1rem 0 0.4rem;
    font-size: 1rem;
  }
  .muted {
    color: var(--muted);
    margin: 0.2rem 0 0.4rem;
  }
  .empty {
    margin-top: 1rem;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0.75rem 0 0;
    display: grid;
    gap: 0.6rem;
  }
  .row {
    border: 2px solid rgba(33, 27, 23, 0.25);
    border-radius: var(--radius);
    padding: 0.55rem 0.65rem;
    background: rgba(255, 255, 255, 0.35);
  }
  .row.affordable {
    border-color: var(--ink);
  }
  .row[data-accent='machine'] {
    border-left: 6px solid var(--bronze);
  }
  .row[data-accent='work'] {
    border-left: 6px solid var(--clay);
  }
  .row[data-accent='decree'] {
    border-left: 6px solid var(--ink);
  }
  .row[data-accent='grip'] {
    border-left: 6px solid var(--muted);
  }
  .row[data-accent='insight'] {
    border-left: 6px solid #6b4f8a;
  }
  .row-head {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .level {
    color: var(--muted);
  }
  .effect,
  .note,
  .wait {
    margin: 0.2rem 0;
    font-size: 0.9rem;
  }
  .note,
  .wait {
    color: var(--muted);
  }
  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.35rem;
  }
  .buttons button {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    line-height: 1.1;
    padding: 0.2rem 0.7rem;
  }
  .buttons button:not(:disabled) {
    background: var(--clay);
    color: var(--ivory);
  }
  .buttons small {
    font-size: 0.78rem;
  }
  .bar {
    height: 8px;
    background: rgba(33, 27, 23, 0.15);
    border-radius: 4px;
    overflow: hidden;
    margin: 0.3rem 0;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--bronze);
  }
</style>
