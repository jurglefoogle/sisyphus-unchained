<script lang="ts">
  import type { Game } from '../app/game';
  import type { GameView } from '../app/view';
  import { iconUrl, imageUrl } from '../world/library';
  import Drawer from './Drawer.svelte';
  import { EDGE, papyrus, TILE } from './papyrus';
  import { act, price, readyOffers, still } from './purchase';

  /**
   * The Improve list as a papyrus scroll hung from a rod beneath the header.
   * Rolled up, the best offers within reach hang from it as sillyboi, the
   * title tags of ancient scrolls, each bought with one click. Unrolled, the
   * roll travels down the column and the full list is written on the sheet.
   */
  let {
    game,
    view,
    open,
    narrow,
    sheetHeight,
    ontoggle,
    onprestige,
  }: {
    game: Game;
    view: GameView;
    open: boolean;
    narrow: boolean;
    /** The unrolled sheet, in CSS pixels. */
    sheetHeight: number;
    ontoggle: () => void;
    onprestige: () => void;
  } = $props();

  const paper = papyrus();
  const offers = $derived(readyOffers(view, narrow ? 2 : 3));
  const ready = $derived(view.rows.filter((r) => r.affordable && !r.disabled).length);
  /** The scroll hangs once there is something to write on it. */
  const shown = $derived(view.rows.length > 0 || open);
  const CORDS = [14, 24, 18];

  function buy(e: MouseEvent, i: number) {
    const o = offers[i];
    if (!o) return;
    const tag = e.currentTarget as HTMLElement;
    const r = act(game, view, o.row, o.count, onprestige);
    if (!r || !r.ok || still()) return;
    tag.animate([{ filter: 'brightness(1.25)', transform: 'translateY(3px)' }, { filter: 'none', transform: 'none' }], { duration: 420, easing: 'ease-out' });
  }

  // On phones, a flick upward rolls the sheet away.
  let flick: number | null = null;
  function flickStart(e: PointerEvent) {
    if (narrow && open) flick = e.clientY;
  }
  function flickEnd(e: PointerEvent) {
    if (flick !== null && flick - e.clientY > 50) ontoggle();
    flick = null;
  }
</script>

{#if shown}
  <div
    class="frame"
    class:open
    class:narrow
    style:--sheet-h="{sheetHeight}px"
    style:--paper="url({paper.sheet})"
    style:--tag-paper="url({paper.tag})"
    style:--edge-l="url({paper.edgeLeft})"
    style:--edge-r="url({paper.edgeRight})"
    style:--tile="{TILE}px"
    style:--edge="{EDGE}px"
  >
    <aside id="drawer" class="sheet" aria-label="Purchases" inert={!open} onpointerdown={flickStart} onpointerup={flickEnd}>
      <div class="sheet-head">
        <span class="eyebrow">Make the next attempt count</span>
        <button class="close" onclick={ontoggle} aria-label="Roll up improvements">✕</button>
      </div>
      <Drawer {game} {view} {onprestige} />
    </aside>

    <div class="rod" aria-hidden="true"><span class="bracket left"></span><span class="bracket right"></span></div>

    <button class="roll" onclick={ontoggle} aria-expanded={open} aria-controls="drawer" aria-label={open ? 'Roll up improvements' : `Unroll improvements${ready ? `, ${ready} within reach` : ''}`} onpointerdown={flickStart} onpointerup={flickEnd}>
      {#if ready && !open}<span class="seal" aria-hidden="true">{ready}</span>{/if}
    </button>

    <div class="tags" inert={open}>
      {#each offers as o, i (o.row.key)}
        {@const p = price(o.cost)}
        <div class="hang" style:--cord="{CORDS[i % CORDS.length]}px" style:--delay="{-i * 1.7}s">
          <span class="cord" aria-hidden="true"></span>
          <button class="tag" onclick={(e) => buy(e, i)} aria-label="{o.row.title}: buy{o.count > 1 ? ` ${o.count}` : ''} for {p.amount} {p.icon === 'ui_insight' ? 'Insight' : 'Obols'}">
            <span class="eyelet" aria-hidden="true"></span>
            <span class="title">
              {#if o.row.icon}<img class="icon" class:art={o.row.icon.startsWith('work_')} src={imageUrl(o.row.icon)} alt="" />{/if}
              <span>{o.row.title}</span>
            </span>
            {#if o.cost}<span class="cost"><img src={iconUrl(p.icon)} alt="" />{p.amount}</span>{/if}
          </button>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .frame {
    --rod: 18px;
    --roll: 38px;
    --ease: cubic-bezier(0.32, 0.72, 0.2, 1);
    --time: 0.74s;
    position: absolute;
    top: calc(var(--hud-h) + 6px);
    right: 34px;
    width: var(--scroll-w);
    z-index: 10;
    pointer-events: none;
    filter: drop-shadow(0 10px 12px rgba(24, 14, 6, 0.36)) drop-shadow(0 2px 2px rgba(24, 14, 6, 0.3));
  }
  .frame.narrow {
    left: 22px;
    right: 22px;
    width: auto;
    --roll: 32px;
  }

  /* ------------------------------------------------------------- the sheet */
  .sheet {
    position: absolute;
    top: calc(var(--rod) / 2);
    left: 0;
    right: 0;
    height: var(--sheet-h);
    overflow-y: auto;
    overscroll-behavior: contain;
    pointer-events: auto;
    padding-bottom: calc(var(--roll) + 0.5rem);
    /* Edges darkened by handling, fixed while the fibres scroll with the text. */
    background:
      linear-gradient(90deg, rgba(96, 60, 22, 0.3), rgba(96, 60, 22, 0) 8%, rgba(96, 60, 22, 0) 92%, rgba(96, 60, 22, 0.32)),
      linear-gradient(180deg, rgba(255, 246, 222, 0.16), rgba(255, 246, 222, 0) 30%, rgba(96, 60, 22, 0) 80%, rgba(96, 60, 22, 0.16)),
      var(--paper) 0 0 / var(--tile) var(--tile);
    background-attachment: scroll, scroll, local;
    box-shadow: inset 0 14px 14px -12px rgba(52, 30, 8, 0.55);
    -webkit-mask:
      var(--edge-l) left top / var(--edge) var(--tile) repeat-y,
      linear-gradient(#000, #000) center / calc(100% - 2 * var(--edge) + 2px) 100% no-repeat,
      var(--edge-r) right top / var(--edge) var(--tile) repeat-y;
    mask:
      var(--edge-l) left top / var(--edge) var(--tile) repeat-y,
      linear-gradient(#000, #000) center / calc(100% - 2 * var(--edge) + 2px) 100% no-repeat,
      var(--edge-r) right top / var(--edge) var(--tile) repeat-y;
    clip-path: inset(0 0 100% 0);
    visibility: hidden;
    transition: clip-path calc(var(--time) * 0.8) var(--ease), visibility 0s linear calc(var(--time) * 0.8);
    scrollbar-width: thin;
    scrollbar-color: rgba(96, 60, 22, 0.45) transparent;
    z-index: 1;
  }
  .open .sheet {
    clip-path: inset(0 0 0 0);
    visibility: visible;
    transition: clip-path var(--time) var(--ease), visibility 0s;
  }
  .sheet-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.9rem 1rem 0 1.7rem;
    color: rgba(58, 38, 20, 0.78);
  }
  .eyebrow {
    font-size: 0.66rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }
  .close {
    width: 36px;
    height: 36px;
    min-height: 36px;
    padding: 0;
    border: 0;
    background: transparent;
    box-shadow: none;
    color: rgba(58, 38, 20, 0.8);
    font-size: 1rem;
  }

  /* --------------------------------------------------------------- the rod */
  /* Turned wood, dark with handling, with bronze finials. */
  .rod {
    position: absolute;
    top: 0;
    left: -20px;
    right: -20px;
    height: var(--rod);
    border-radius: calc(var(--rod) / 2);
    z-index: 3;
    background:
      repeating-linear-gradient(90deg, transparent 0 29px, rgba(20, 10, 3, 0.2) 29px 30px, transparent 30px 71px, rgba(255, 214, 160, 0.08) 71px 72px),
      linear-gradient(180deg, #24140a 0%, #5e3a20 20%, #9b6a43 36%, #6a4326 56%, #3a2312 80%, #1a0e06 100%);
    box-shadow: 0 2px 3px rgba(20, 10, 3, 0.45);
  }
  .rod::before,
  .rod::after {
    content: '';
    position: absolute;
    top: -5px;
    width: 20px;
    height: calc(var(--rod) + 10px);
    border-radius: 46% / 50%;
    background:
      linear-gradient(90deg, transparent 44%, rgba(40, 24, 6, 0.55) 46%, transparent 50%),
      radial-gradient(ellipse at 36% 30%, #fbe6b0 0%, #d8ad64 20%, #a57b3b 46%, #6a4718 76%, #2e1d08 100%);
    box-shadow: inset 0 -2px 3px rgba(20, 10, 2, 0.45), 0 1px 2px rgba(20, 10, 3, 0.4);
  }
  .rod::before { left: -14px; }
  .rod::after { right: -14px; }
  /* Bronze straps, riveted to the band on the beam above, that carry the rod. */
  .bracket {
    position: absolute;
    top: -15px;
    width: 10px;
    height: calc(15px + var(--rod) + 3px);
    border-radius: 1px 1px 5px 5px;
    background: linear-gradient(90deg, #4a3210 0%, #a57b3b 30%, #f0d08e 48%, #b88a45 64%, #5c3e14 100%);
    box-shadow: 0 2px 3px rgba(20, 10, 3, 0.5);
  }
  .bracket.left { left: 16%; }
  .bracket.right { right: 16%; }
  .bracket::before {
    content: '';
    position: absolute;
    top: 0;
    left: -7px;
    width: 24px;
    height: 11px;
    border-radius: 2px;
    background:
      radial-gradient(circle at 4px 5.5px, #fbe6b0 0 0.8px, #6a4718 1.6px 2px, transparent 2.4px),
      radial-gradient(circle at 20px 5.5px, #fbe6b0 0 0.8px, #6a4718 1.6px 2px, transparent 2.4px),
      linear-gradient(180deg, #e2bd78 0%, #b88a45 40%, #7c5626 100%);
    box-shadow: inset 0 1px rgba(255, 240, 200, 0.6), 0 1px 2px rgba(20, 10, 3, 0.55);
  }

  /* -------------------------------------------------------------- the roll */
  /* The rolled papyrus: a cylinder, lit from above, its ends showing the turns of the sheet. */
  .roll {
    position: absolute;
    top: calc(var(--rod) - 6px);
    left: -5px;
    right: -5px;
    height: var(--roll);
    min-height: 0;
    padding: 0;
    border: 0;
    border-radius: 5px / 50%;
    z-index: 2;
    pointer-events: auto;
    cursor: pointer;
    background:
      linear-gradient(180deg, transparent 0 81%, rgba(70, 40, 12, 0.5) 81% 83%, transparent 83%),
      linear-gradient(180deg, rgba(40, 22, 6, 0.78) 0%, rgba(46, 26, 8, 0.22) 15%, rgba(255, 246, 222, 0.5) 31%, rgba(255, 246, 222, 0.1) 46%, rgba(80, 50, 18, 0.18) 62%, rgba(46, 26, 8, 0.5) 84%, rgba(26, 14, 3, 0.86) 100%),
      var(--paper) 0 0 / var(--tile) var(--tile);
    background-position: 0 0, 0 0, 0 0;
    box-shadow: 0 4px 6px rgba(24, 14, 6, 0.4), inset 0 0 0 0.5px rgba(40, 22, 6, 0.4);
    transform: translateY(0) scaleY(1.1);
    transition:
      transform calc(var(--time) * 0.8) var(--ease),
      background-position calc(var(--time) * 0.8) var(--ease);
  }
  .open .roll {
    transform: translateY(calc(var(--sheet-h) - var(--rod) / 2 - var(--roll) / 2 + 6px)) scaleY(0.9);
    background-position: 0 0, 0 0, 0 calc(var(--sheet-h) * -0.9);
    transition:
      transform var(--time) var(--ease),
      background-position var(--time) var(--ease);
  }
  .roll::before,
  .roll::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: 14px;
    border-radius: 50%;
    background:
      radial-gradient(ellipse at 50% 50%, #2a1808 0 14%, transparent 16%),
      repeating-radial-gradient(ellipse at 50% 50%, #e7d2a4 0 7%, #8a6234 7% 9%, #d4b986 9% 15%),
      #cdb07c;
    box-shadow: inset -1px -2px 3px rgba(40, 22, 6, 0.45);
  }
  .roll::before { left: -5px; }
  .roll::after { right: -5px; }
  .roll:focus-visible {
    outline: 2px solid var(--ivory);
    outline-offset: 3px;
  }
  /* A clay seal pressed onto the roll, numbered with what is within reach. */
  .seal {
    position: absolute;
    right: 18%;
    top: 50%;
    width: 24px;
    height: 24px;
    margin-top: -12px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-family: var(--display);
    font-weight: 700;
    font-size: 0.85rem;
    color: #f6dccb;
    background: radial-gradient(circle at 36% 30%, #e08466 0%, #b23e24 40%, #83240f 74%, #5a150a 100%);
    box-shadow: inset 0 -2px 3px rgba(40, 8, 2, 0.45), 0 1px 2px rgba(30, 10, 2, 0.5);
    transform: scaleY(0.88);
  }

  /* -------------------------------------------------------------- the tags */
  .tags {
    position: absolute;
    top: calc(var(--rod) - 6px + var(--roll) - 3px);
    left: 8px;
    right: 8px;
    display: flex;
    justify-content: flex-end;
    align-items: flex-start;
    gap: 8px;
    z-index: 1;
    transition: opacity 0.2s ease, transform 0.2s ease;
  }
  .open .tags {
    opacity: 0;
    transform: translateY(-8px);
    visibility: hidden;
    transition: opacity 0.14s ease, transform 0.14s ease, visibility 0s 0.14s;
  }
  .hang {
    position: relative;
    flex: 0 1 calc((100% - 16px) / 3);
    min-width: 0;
    padding-top: var(--cord);
    transform-origin: 50% 0;
    animation: sway 6s ease-in-out var(--delay) infinite alternate;
  }
  .narrow .hang { flex-basis: calc((100% - 8px) / 2); }
  @keyframes sway {
    from { transform: rotate(-0.9deg); }
    to { transform: rotate(0.9deg); }
  }
  .cord {
    position: absolute;
    left: 50%;
    top: 0;
    width: 1.5px;
    height: calc(var(--cord) + 4px);
    margin-left: -0.75px;
    background: linear-gradient(90deg, #3e2811, #7a5a32, #3e2811);
  }
  /* A sillybos: thin parchment, cut by hand, with a bronze eyelet for its cord. */
  .tag {
    position: relative;
    display: grid;
    gap: 0.2rem;
    width: 100%;
    min-height: 0;
    padding: 0.7rem 0.55rem 0.5rem;
    border: 0;
    border-radius: 0;
    text-align: left;
    color: #22160d;
    pointer-events: auto;
    cursor: pointer;
    background:
      linear-gradient(180deg, rgba(255, 250, 236, 0.35), rgba(120, 82, 36, 0.12)),
      var(--tag-paper) 0 0 / var(--tile) var(--tile);
    box-shadow: inset 0 0 0 1px rgba(92, 60, 26, 0.28), inset 0 -8px 10px -8px rgba(80, 50, 18, 0.35);
    clip-path: polygon(0 3%, 14% 0, 33% 2%, 52% 0.5%, 74% 2.5%, 100% 0, 99% 34%, 100% 71%, 98.5% 100%, 72% 98%, 45% 100%, 21% 98.5%, 0.5% 100%, 1.5% 62%);
    transition: transform 0.15s ease, filter 0.15s ease;
  }
  .tag:hover {
    filter: brightness(1.06);
    transform: translateY(1px);
  }
  .tag:active {
    transform: translateY(3px);
  }
  .tag:focus-visible {
    outline: 2px solid var(--clay);
    outline-offset: -3px;
  }
  .eyelet {
    position: absolute;
    left: 50%;
    top: 3px;
    width: 7px;
    height: 7px;
    margin-left: -3.5px;
    border-radius: 50%;
    background: radial-gradient(circle, #2a1808 0 35%, #c89c55 40%, #7a5626 80%);
  }
  .title {
    display: flex;
    align-items: flex-start;
    gap: 0.35rem;
    font-family: var(--display);
    font-weight: 700;
    font-size: 0.95rem;
    line-height: 1.1;
  }
  .title span {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .title .icon {
    width: 18px;
    height: 18px;
    flex: none;
    margin-top: 1px;
    opacity: 0.85;
    mix-blend-mode: multiply;
  }
  .title .icon.art {
    width: 24px;
    height: 24px;
    margin-top: -3px;
    opacity: 1;
    mix-blend-mode: normal;
  }
  .cost {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
    color: #7a3316;
    font-weight: 700;
  }
  .cost img {
    width: 1em;
    height: 1em;
  }

  /* Reduced motion: the scroll is simply open or closed. */
  :global(.reduced-motion) .frame *,
  :global(.reduced-motion) .frame *::before,
  :global(.reduced-motion) .frame *::after {
    transition: none !important;
    animation: none !important;
  }
  @media (prefers-reduced-motion: reduce) {
    .frame *,
    .frame *::before,
    .frame *::after {
      transition: none !important;
      animation: none !important;
    }
  }
</style>
