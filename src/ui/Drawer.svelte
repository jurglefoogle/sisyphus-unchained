<script lang="ts">
  import type { Game } from '../app/game';
  import type { GameView, PurchaseRow } from '../app/view';
  import { iconUrl, imageUrl } from '../world/library';
  import { act, price, still } from './purchase';

  let { game, view, onprestige }: { game: Game; view: GameView; onprestige: (kind?: 'appeal') => void } = $props();

  /** Rows whose explanation is open. Each row shows one line of effect; the rest waits behind "?". */
  let explained = $state<Record<string, boolean>>({});
  /** Longer than this, the effect is clipped to one line until explained. */
  const ONE_LINE = 42;
  const hasMore = (row: PurchaseRow) => row.effect.length > ONE_LINE || !!row.note || (!!row.wait && !row.disabled);

  /** Buy, and if it went through, stamp the row: warm light in the fibres and a press of the seal. */
  function buy(e: MouseEvent, row: PurchaseRow, count = 1) {
    const btn = e.currentTarget as HTMLElement;
    const r = act(game, view, row, count, onprestige);
    if (!r || !r.ok || still()) return;
    btn.animate([{ transform: 'scale(0.93)' }, { transform: 'scale(1.05)' }, { transform: 'scale(1)' }], { duration: 280, easing: 'ease-out' });
    btn.closest('.row')?.animate(
      [{ offset: 0, backgroundColor: 'rgba(255, 226, 150, 0.55)' }, { backgroundColor: 'rgba(255, 226, 150, 0)' }],
      { duration: 800, easing: 'ease-out' },
    );
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

  {#if view.site.devices.length}
    <details class="devices">
      <summary>{view.site.devices.length} device{view.site.devices.length === 1 ? '' : 's'} at work here</summary>
      <ul>
        {#each view.site.devices as d (d.id)}
          <li><strong>{d.name}</strong> {d.rule} <em>{d.quip}</em></li>
        {/each}
      </ul>
    </details>
  {/if}

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
    {#each view.rows as row, i (row.key)}
      <li style:--i={i} class="row" class:affordable={row.affordable && !row.disabled} class:pinned={row.pinned} data-accent={row.accent ?? 'plain'}>
        <div class="row-head">
          {#if row.icon}<img class="row-icon" class:art={row.icon.startsWith('work_')} src={imageUrl(row.icon)} alt="" />{/if}
          <strong>{row.title}</strong>
          {#if row.level}<span class="level">{row.level}</span>{/if}
          {#if hasMore(row)}
            <button
              class="more"
              aria-expanded={!!explained[row.key]}
              aria-controls="more-{i}"
              title={explained[row.key] ? 'Less' : 'What does this do?'}
              aria-label="{explained[row.key] ? 'Hide details for' : 'Explain'} {row.title}"
              onclick={() => (explained[row.key] = !explained[row.key])}
            >?</button>
          {/if}
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
        <p class="effect" class:clipped={!explained[row.key]}>{row.effect}</p>
        {#if explained[row.key]}
          <div class="more-text" id="more-{i}">
            {#if row.note}<p class="note">{row.note}</p>{/if}
            {#if row.wait && !row.disabled}<p class="wait">{row.wait}</p>{/if}
          </div>
        {/if}
        {#if row.progress !== undefined}
          <div class="bar" role="progressbar" aria-label="{row.title} progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(row.progress * 100)}>
            <span style:width="{row.progress * 100}%"></span>
          </div>
        {/if}
        {#if !row.disabled}
          <div class="buttons">
            {#if row.options}
              {#each row.options as opt (opt.label)}
                {@const p = price(opt.cost, row.currency)}
                <button disabled={!opt.affordable} onclick={(e) => buy(e, row, opt.count)} aria-label="{row.title}: {opt.label}{opt.cost ? ` for ${opt.cost} ${p.name}` : ''}">
                  <span>{opt.label}</span>{#if opt.cost}<small class="cost">{#if p.icon}<img src={iconUrl(p.icon)} alt="" />{:else}<span class="glyph" aria-hidden="true">{p.glyph}</span>{/if}{p.amount}</small>{/if}
                </button>
              {/each}
            {:else}
              <button disabled={!row.affordable} onclick={(e) => buy(e, row)} aria-label="{row.title}{row.cost ? ` for ${row.cost} ${price(row.cost, row.currency).name}` : ''}">
                <span>{row.verb ?? (row.action.kind === 'prestige' ? 'Review' : row.action.kind === 'site' ? 'Open' : row.action.kind === 'steward' ? 'Hire' : 'Buy')}</span>
                {#if row.cost}{@const p = price(row.cost, row.currency)}<small class="cost">{#if p.icon}<img src={iconUrl(p.icon)} alt="" />{:else}<span class="glyph" aria-hidden="true">{p.glyph}</span>{/if}{p.amount}</small>{/if}
              </button>
            {/if}
          </div>
        {/if}
      </li>
    {/each}
  </ul>

  {#if view.relicHunt}
    <section class="relic-hunt">
      <h3>Something in the debris</h3>
      <p><img src={iconUrl('ui_lock')} alt="" /><span><strong>Undiscovered relic</strong><small>{view.relicHunt.site} · permanent income ×1.1</small><small>{view.relicHunt.chance} · {view.relicHunt.guarantee}</small></span></p>
    </section>
  {/if}

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
    padding: 0.4rem 1.5rem 1.5rem 1.7rem;
    color: #2a1d12;
  }
  h2 {
    margin: 0;
    font-family: var(--display);
    font-weight: 600;
    font-size: 1.55rem;
    letter-spacing: 0.02em;
    color: #231710;
  }
  h3 {
    margin: 1.3rem 0 0.4rem;
    font-size: 0.7rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(58, 38, 20, 0.72);
  }
  .muted {
    color: rgba(58, 38, 20, 0.74);
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
    margin: 0.6rem 0 0;
    display: grid;
    /* Rows may be narrower than their longest line: effects clip to one line. */
    grid-template-columns: minmax(0, 1fr);
  }
  /* Entries written down the sheet, each marked in the margin with a paragraphos. */
  .row {
    position: relative;
    padding: 0.55rem 0.3rem 0.6rem 0.2rem;
    background-image: linear-gradient(90deg, transparent, rgba(92, 60, 26, 0.28) 8%, rgba(92, 60, 26, 0.22) 60%, transparent);
    background-size: 100% 1px;
    background-position: 0 100%;
    background-repeat: no-repeat;
    transition: background-color 300ms ease;
    --mark: rgba(58, 38, 20, 0.45);
  }
  .row::before {
    content: '';
    position: absolute;
    left: -1.05rem;
    top: 0.95rem;
    width: 0.75rem;
    height: 2.5px;
    border-radius: 2px;
    background: var(--mark);
    transform: rotate(-4deg);
  }
  .row[data-accent='machine'] { --mark: var(--bronze); }
  .row[data-accent='work'] { --mark: var(--clay); }
  .row[data-accent='decree'] { --mark: #1c130c; }
  .row[data-accent='grip'] { --mark: #b27a4c; }
  .row[data-accent='insight'] { --mark: #6b4f8a; }
  .row[data-accent='seal'] { --mark: #8e2a1c; }
  .devices {
    margin: 0 0 0.7rem;
    font-size: 0.85rem;
  }
  .devices summary {
    cursor: pointer;
    color: #5b4a38;
    letter-spacing: 0.04em;
  }
  .devices ul {
    margin: 0.4rem 0 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.35rem;
  }
  .devices li { line-height: 1.35; }
  .devices em { display: block; color: #6a5641; }
  /* Within reach: the ink is fresh and the fibres warm around it. */
  .row.affordable {
    background-color: rgba(255, 240, 200, 0.22);
    box-shadow: inset 0 0 18px rgba(255, 236, 190, 0.45);
  }
  .row:not(.affordable) .effect { color: rgba(42, 29, 18, 0.78); }
  .row.pinned::after {
    content: '';
    position: absolute;
    inset: 0.3rem -0.4rem 0.3rem -0.5rem;
    border: 1px solid rgba(149, 68, 33, 0.55);
    border-radius: 2px;
    pointer-events: none;
  }
  /* Pins are drops of wax: a faint ring until pressed, then sealed. */
  .pin {
    width: 34px;
    height: 34px;
    min-height: 34px;
    min-width: 34px;
    margin: -5px -4px -5px 0;
    padding: 0;
    display: grid;
    place-items: center;
    border-radius: 50%;
    border: 1px solid rgba(92, 60, 26, 0.35);
    background: transparent;
    box-shadow: none;
    flex: none;
  }
  .pin svg {
    width: 17px;
    height: 17px;
    fill: none;
    stroke: rgba(58, 38, 20, 0.7);
    stroke-width: 1.8;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .pin[aria-pressed='true'] {
    border-color: #6e1f10;
    background: radial-gradient(circle at 36% 30%, #e08466 0%, #b23e24 38%, #83240f 72%, #5a150a 100%);
    box-shadow: inset 0 -2px 3px rgba(40, 8, 2, 0.45), 0 1px 2px rgba(40, 20, 8, 0.4);
  }
  .pin[aria-pressed='true'] svg {
    stroke: #f6dccb;
    fill: #f6dccb;
  }
  .stale-goal {
    margin-top: 0.8rem;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.88rem;
    padding: 0.5rem 0.7rem;
    border: 1px dashed rgba(92, 60, 26, 0.45);
  }
  .stale-goal span { flex: 1; }
  .row-head {
    display: flex;
    align-items: center;
    gap: 0.55rem;
  }
  .row-head strong {
    flex: 1;
    min-width: 0;
    font-family: var(--display);
    font-size: 1.08rem;
    font-weight: 700;
    line-height: 1.15;
    color: #1f140c;
  }
  .row-icon {
    width: 28px;
    height: 28px;
    flex: none;
    opacity: 0.88;
    mix-blend-mode: multiply;
  }
  .row-icon.art {
    width: 38px;
    height: 38px;
    object-fit: contain;
    margin: -5px 0;
    opacity: 1;
    mix-blend-mode: normal;
  }
  .level {
    color: rgba(58, 38, 20, 0.74);
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
  .relic-hunt { margin-top: 1.1rem; border: 1px dashed rgba(92, 60, 26, 0.5); padding: 0.6rem 0.75rem; background: rgba(165, 123, 59, 0.08); }
  .relic-hunt h3 { margin-top: 0; }
  .relic-hunt p { display: flex; align-items: center; gap: 0.65rem; margin: 0; }
  .relic-hunt img { width: 40px; height: 40px; opacity: 0.55; }
  .relic-hunt span { display: grid; gap: 0.08rem; }
  .relic-hunt small { color: rgba(58, 38, 20, 0.74); }
  .effect,
  .note,
  .wait {
    margin: 0.2rem 0;
    font-size: 0.88rem;
    line-height: 1.35;
  }
  .effect.clipped {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .more-text { margin: 0.1rem 0 0.2rem; padding-left: 0.55rem; border-left: 2px solid rgba(92, 60, 26, 0.28); }
  /* A small ink ring: the question the row answers when pressed. Hit area is larger than the ring. */
  .more {
    width: 30px;
    height: 30px;
    min-height: 30px;
    min-width: 30px;
    margin: -4px -2px;
    padding: 0;
    flex: none;
    display: grid;
    place-items: center;
    border-radius: 50%;
    border: 1px solid rgba(92, 60, 26, 0.35);
    background: transparent;
    box-shadow: none;
    color: rgba(58, 38, 20, 0.75);
    font-family: var(--display);
    font-weight: 700;
    font-size: 0.95rem;
    line-height: 1;
    position: relative;
  }
  .more::after { content: ''; position: absolute; inset: -6px; }
  .more[aria-expanded='true'] { color: #f6dccb; border-color: #3a2614; background: #5a4029; }
  .note,
  .wait {
    color: rgba(58, 38, 20, 0.74);
  }
  .wait {
    font-style: italic;
    font-size: 0.82rem;
  }
  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.4rem;
  }
  /* Offers out of reach are only scored into the sheet. */
  .buttons button {
    position: relative;
    overflow: hidden;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 36px;
    padding: 0 0.7rem;
    border-radius: 3px;
    font-weight: 700;
    color: rgba(42, 29, 18, 0.6);
    background: rgba(92, 60, 26, 0.05);
    border: 1px solid rgba(92, 60, 26, 0.3);
    box-shadow: none;
  }
  /* Within reach they are pressed clay seals: a lit lip, a shaded foot and an ink edge. */
  .buttons button:not(:disabled) {
    color: #f7e9d6;
    border-color: #3a170a;
    background:
      radial-gradient(ellipse at 30% 20%, rgba(255, 214, 170, 0.28), transparent 60%),
      linear-gradient(180deg, #a44d27 0%, #8c3b1b 55%, #6c2a11 100%);
    box-shadow: inset 0 1px rgba(255, 220, 180, 0.3), inset 0 -2px 3px rgba(40, 12, 2, 0.35), 0 2px 0 #2a150a, 0 3px 6px rgba(40, 20, 8, 0.25);
    transform: translateY(-1px);
  }
  .buttons button:not(:disabled):active {
    transform: translateY(1px);
    box-shadow: inset 0 1px 3px rgba(33, 12, 4, 0.5), 0 0 0 #2a150a;
  }
  /* When an offer comes within reach, light runs once across the glaze. */
  .buttons button:not(:disabled)::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(105deg, transparent 30%, rgba(255, 236, 200, 0.4) 50%, transparent 70%);
    transform: translateX(-120%);
    animation: sheen 900ms ease-out 120ms 1 both;
    pointer-events: none;
  }
  @keyframes sheen {
    to { transform: translateX(120%); }
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
  .cost .glyph {
    display: inline-grid;
    place-items: center;
    width: 1.05em;
    height: 1.05em;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #e9c98a, #a8773a 70%);
    color: #3c2a16;
    font-size: 0.7em;
    line-height: 1;
  }
  .buttons button:disabled .cost img {
    opacity: 0.6;
  }
  .buttons button:not(:disabled) .cost img {
    filter: invert(94%) sepia(8%) saturate(400%) hue-rotate(340deg);
  }
  .bar {
    height: 6px;
    background: rgba(92, 60, 26, 0.14);
    border-radius: 3px;
    overflow: hidden;
    margin: 0.35rem 0;
    box-shadow: inset 0 1px 2px rgba(58, 38, 20, 0.25);
  }
  /* A bronze glaze with a highlight along its top, and a glint that travels it. */
  .bar span {
    display: block;
    height: 100%;
    border-radius: 3px;
    background:
      linear-gradient(180deg, rgba(255, 236, 196, 0.55), transparent 55%),
      linear-gradient(90deg, #7c5626, var(--bronze) 70%, #c89c55);
    transition: width 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
    position: relative;
    overflow: hidden;
  }
  .bar span::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, rgba(255, 244, 214, 0.7), transparent);
    width: 40%;
    animation: glint 3.2s ease-in-out infinite;
  }
  @keyframes glint {
    0% { transform: translateX(-120%); }
    45%, 100% { transform: translateX(260%); }
  }
</style>
