<script lang="ts">
  import type { Game } from '../app/game';
  import type { GameView } from '../app/view';
  import Drawer from './Drawer.svelte';
  import { EDGE, papyrus, TILE } from './papyrus';

  let { game, view, open, hidden = false, narrow, sheetHeight, ontoggle, onprestige }: {
    game: Game;
    view: GameView;
    open: boolean;
    hidden?: boolean;
    narrow: boolean;
    sheetHeight: number;
    ontoggle: () => void;
    onprestige: (kind?: 'appeal') => void;
  } = $props();

  const paper = papyrus();
  const ready = $derived(view.rows.filter((row) => row.affordable && !row.disabled).length);
  const next = $derived(view.rows.find((row) => !row.disabled));
  const shown = $derived(view.rows.length > 0 || open);
  let closeButton = $state<HTMLButtonElement>();

  $effect(() => {
    if (open) requestAnimationFrame(() => closeButton?.focus());
  });

  let flick: number | null = null;
  function flickStart(event: PointerEvent) {
    if (narrow && open) flick = event.clientY;
  }
  function flickEnd(event: PointerEvent) {
    if (flick !== null && flick - event.clientY > 56) ontoggle();
    flick = null;
  }
</script>

{#if shown}
  <div
    class="frame"
    class:open
    class:away={hidden}
    class:narrow
    inert={hidden}
    style:--sheet-h="{sheetHeight}px"
    style:--paper="url({paper.sheet})"
    style:--edge-l="url({paper.edgeLeft})"
    style:--edge-r="url({paper.edgeRight})"
    style:--tile="{TILE}px"
    style:--edge="{EDGE}px"
  >
    {#if open}
      <button class="scrim" onclick={ontoggle} aria-label="Close improvements"></button>
      <aside id="drawer" class="sheet" aria-label="Improvements" onpointerdown={flickStart} onpointerup={flickEnd}>
        <div class="sheet-head">
          <div><span class="eyebrow">Plan the next attempt</span><strong>Improvements</strong></div>
          <button class="close" bind:this={closeButton} onclick={ontoggle} aria-label="Close improvements">✕</button>
        </div>
        <Drawer {game} {view} {onprestige} />
      </aside>
    {/if}

    <div class="rod" aria-hidden="true"><span class="hanger left"></span><span class="hanger right"></span></div>

    <button
      class="roll"
      onclick={ontoggle}
      aria-expanded={open}
      aria-controls="drawer"
      aria-label={open ? 'Roll up improvements' : `Open improvements${ready ? `, ${ready} within reach` : ''}`}
    >
      <span class="roll-copy" aria-hidden={open}>
        <span class="improve-plaque"><span aria-hidden="true">↳</span><strong>Improve</strong></span>
        <small>{ready ? `${ready} ready now` : next ? next.title : 'Plan the next attempt'}</small>
      </span>
      {#if ready && !open}<span class="seal" aria-hidden="true">{ready}</span>{/if}
      <span class="unroll-mark" aria-hidden="true">⌄</span>
    </button>
  </div>
{/if}

<style>
  .frame {
    --rod-h: 16px;
    --roll-h: 52px;
    position: absolute;
    top: calc(var(--hud-h) + 0.65rem);
    right: 1.3rem;
    width: var(--scroll-w);
    height: var(--sheet-h);
    z-index: 10;
    pointer-events: none;
    filter: drop-shadow(0 10px 14px rgba(24, 14, 6, 0.3)) drop-shadow(0 2px 2px rgba(24, 14, 6, 0.28));
    transition: opacity 160ms ease, transform 220ms ease;
  }
  .frame.away { opacity: 0; visibility: hidden; transform: translateX(12px); }
  .frame.narrow { left: 1.6rem; right: 1.6rem; width: auto; }

  .scrim {
    position: fixed;
    inset: 0;
    z-index: 0;
    min-height: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: rgba(20, 12, 7, 0.08);
    box-shadow: none;
    pointer-events: auto;
    cursor: default;
    animation: veil-in 180ms ease both;
  }

  .rod {
    position: absolute;
    top: 0;
    left: -13px;
    right: -13px;
    height: var(--rod-h);
    z-index: 4;
    border-radius: 9px;
    background:
      repeating-linear-gradient(90deg, transparent 0 38px, rgba(25, 12, 4, 0.15) 39px 40px),
      linear-gradient(180deg, #211006 0%, #6d4425 18%, #ac7750 38%, #664025 65%, #1d0e05 100%);
    box-shadow: 0 3px 4px rgba(20, 10, 3, 0.52), inset 0 1px rgba(255, 225, 175, 0.24), inset 0 -2px rgba(19, 8, 2, 0.32);
  }
  .rod::before, .rod::after {
    content: '';
    position: absolute;
    top: -5px;
    width: 18px;
    height: 26px;
    border-radius: 48%;
    background: radial-gradient(ellipse at 35% 30%, #f1d18a, #b18442 38%, #67451c 72%, #281707);
    box-shadow: inset 0 -2px 3px rgba(30, 13, 2, 0.45);
  }
  .rod::before { left: -11px; }
  .rod::after { right: -11px; }
  .hanger {
    position: absolute;
    top: -10px;
    width: 8px;
    height: 25px;
    border-radius: 2px 2px 5px 5px;
    background: linear-gradient(90deg, #684516, #e0bd73 45%, #76501e);
    box-shadow: 0 1px 2px rgba(20, 10, 3, 0.45);
  }
  .hanger.left { left: 17%; }
  .hanger.right { right: 17%; }

  .sheet {
    position: absolute;
    top: 9px;
    left: 0;
    right: 0;
    z-index: 2;
    height: calc(var(--sheet-h) - 22px);
    padding-bottom: 2rem;
    overflow-y: auto;
    overscroll-behavior: contain;
    pointer-events: auto;
    color: #2a1d12;
    background:
      radial-gradient(ellipse at 52% 44%, rgba(255, 249, 228, 0.2), transparent 56%),
      linear-gradient(90deg, rgba(96, 60, 22, 0.28), transparent 7%, transparent 48%, rgba(112, 74, 34, 0.05) 50%, transparent 52%, transparent 93%, rgba(96, 60, 22, 0.3)),
      linear-gradient(180deg, rgba(255, 246, 222, 0.2), transparent 24%, rgba(96, 60, 22, 0.11)),
      var(--paper) 0 0 / var(--tile) var(--tile);
    box-shadow: inset 0 10px 12px -10px rgba(52, 30, 8, 0.78), inset 8px 0 14px -15px rgba(52, 30, 8, 0.7), inset -8px 0 14px -15px rgba(52, 30, 8, 0.7);
    -webkit-mask: var(--edge-l) left top / var(--edge) var(--tile) repeat-y, linear-gradient(#000, #000) center / calc(100% - 2 * var(--edge) + 2px) 100% no-repeat, var(--edge-r) right top / var(--edge) var(--tile) repeat-y;
    mask: var(--edge-l) left top / var(--edge) var(--tile) repeat-y, linear-gradient(#000, #000) center / calc(100% - 2 * var(--edge) + 2px) 100% no-repeat, var(--edge-r) right top / var(--edge) var(--tile) repeat-y;
    scrollbar-width: thin;
    scrollbar-color: rgba(96, 60, 22, 0.5) transparent;
    transform-origin: top;
    animation: sheet-open 300ms cubic-bezier(0.22, 0.76, 0.24, 1) both;
  }
  .sheet-head {
    position: sticky;
    top: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.7rem;
    padding: 1rem 1rem 0.65rem 1.7rem;
    color: #382719;
    background: linear-gradient(180deg, rgba(242, 226, 190, 0.98), rgba(237, 218, 178, 0.94)), var(--paper) 0 0 / var(--tile) var(--tile);
    box-shadow: 0 1px rgba(92, 60, 26, 0.28), 0 7px 12px -12px rgba(40, 22, 6, 0.8);
  }
  .sheet-head > div { display: grid; gap: 0.08rem; }
  .sheet-head strong { font-family: var(--display); font-size: 1.25rem; line-height: 1; }
  .eyebrow { font-size: 0.6rem; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(58, 38, 20, 0.66); }
  .close { width: 40px; height: 40px; min-height: 40px; flex: none; padding: 0; border: 1px solid rgba(92, 60, 26, 0.25); border-radius: 50%; color: rgba(58, 38, 20, 0.82); background: rgba(255, 250, 232, 0.28); box-shadow: none; font-size: 0.95rem; }

  .roll {
    position: absolute;
    top: 8px;
    left: -4px;
    right: -4px;
    z-index: 3;
    height: var(--roll-h);
    min-height: 0;
    padding: 0 3rem 0 1rem;
    overflow: visible;
    display: flex;
    align-items: center;
    border: 0;
    border-radius: 7px / 50%;
    color: #291a10;
    pointer-events: auto;
    cursor: pointer;
    background:
      linear-gradient(180deg, rgba(38, 20, 5, 0.7), rgba(255, 246, 222, 0.46) 22%, rgba(255, 246, 222, 0.13) 48%, rgba(81, 48, 15, 0.38) 80%, rgba(25, 12, 3, 0.8)),
      var(--paper) 0 0 / var(--tile) var(--tile);
    box-shadow: 0 5px 8px rgba(24, 14, 6, 0.42), inset 0 1px rgba(255, 248, 222, 0.45), inset 0 -2px rgba(42, 23, 7, 0.28), inset 0 0 0 0.5px rgba(40, 22, 6, 0.38);
    transition: transform 300ms cubic-bezier(0.22, 0.76, 0.24, 1), filter 150ms ease;
  }
  .open .roll { transform: translateY(calc(var(--sheet-h) - var(--roll-h) - 2px)); }
  .roll:hover { filter: brightness(1.05); }
  .roll:focus-visible { outline: 2px solid var(--ivory); outline-offset: 3px; }
  .roll::before, .roll::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: 16px;
    border-radius: 50%;
    background: radial-gradient(ellipse, #2a1808 0 12%, #a67a43 13% 17%, transparent 18%), repeating-radial-gradient(ellipse, #f0ddb2 0 7%, #8d6132 7% 9%, #d6b982 9% 15%);
    box-shadow: inset -2px -2px 3px rgba(40, 22, 6, 0.45), 0 1px 2px rgba(25, 12, 3, 0.34);
  }
  .roll::before { left: -5px; }
  .roll::after { right: -5px; }
  .roll-copy { flex: 1; min-width: 0; display: flex; align-items: center; gap: 0.65rem; text-align: left; line-height: 1.02; transition: opacity 120ms ease; }
  .open .roll-copy { opacity: 0; }
  .improve-plaque { flex: none; min-height: 32px; padding: 0 0.8rem 0 0.6rem; display: inline-flex; align-items: center; gap: 0.38rem; color: #fff1dd; border: 1px solid #642410; border-radius: 2px; background: linear-gradient(180deg, #c35d36, #98391e 56%, #6d2412); box-shadow: inset 0 1px rgba(255, 223, 188, 0.45), inset 0 -2px rgba(60, 15, 5, 0.35), 0 2px 3px rgba(45, 22, 8, 0.28); text-shadow: 0 -1px rgba(55, 17, 5, 0.55); }
  .improve-plaque > span { font-size: 1.05rem; transform: rotate(180deg); }
  .improve-plaque strong { font-family: var(--display); font-size: 0.94rem; letter-spacing: 0.12em; text-transform: uppercase; }
  .roll-copy small { min-width: 0; overflow: hidden; color: rgba(58, 38, 20, 0.76); font-size: 0.7rem; font-weight: 600; letter-spacing: 0.02em; text-overflow: ellipsis; white-space: nowrap; }
  .seal { position: absolute; right: 2.15rem; top: 50%; width: 25px; height: 25px; margin-top: -12.5px; display: grid; place-items: center; border-radius: 50%; color: #f8e4d5; background: radial-gradient(circle at 36% 30%, #d97455, #9b2f1b 65%, #5f190e); box-shadow: inset 0 -2px 3px rgba(40, 8, 2, 0.45), 0 1px 2px rgba(30, 10, 2, 0.35); font-size: 0.8rem; font-weight: 700; }
  .unroll-mark { position: absolute; right: 1rem; top: 50%; margin-top: -0.7em; color: rgba(58, 38, 20, 0.58); font-size: 1rem; transition: transform 260ms ease, opacity 120ms ease; }
  .open .unroll-mark { transform: rotate(180deg); opacity: 0.62; }

  @keyframes sheet-open { from { opacity: 0; clip-path: inset(0 0 96% 0); } to { opacity: 1; clip-path: inset(0); } }
  @keyframes veil-in { from { opacity: 0; } to { opacity: 1; } }
  .narrow .scrim { background: rgba(20, 12, 7, 0.18); }
  .frame.narrow:not(.open) { left: auto; width: min(19rem, calc(100% - 3.2rem)); }
  .frame.narrow:not(.open) .roll-copy { gap: 0.45rem; }
  .frame.narrow:not(.open) .improve-plaque { padding-left: 0.5rem; padding-right: 0.65rem; }

  :global(.reduced-motion) .frame *, :global(.reduced-motion) .frame *::before, :global(.reduced-motion) .frame *::after { transition: none !important; animation: none !important; }
  @media (prefers-reduced-motion: reduce) { .frame *, .frame *::before, .frame *::after { transition: none !important; animation: none !important; } }
</style>
