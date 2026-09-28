<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { EmpireSite } from '../app/view';
  import { artUrl, iconUrl } from '../world/library';

  /**
   * The empire frieze (spec §04): the six fixed operations unfolding
   * horizontally. Navigation only; nothing here changes production. Only the
   * selected site shows Sisyphus; the others show a shade or their machinery.
   * Drag, the mouse wheel, arrow keys or controller shoulder buttons scroll it.
   */
  let {
    sites,
    charterSigned,
    onselect,
    ondecree,
    onclose,
  }: {
    sites: EmpireSite[];
    charterSigned: boolean;
    onselect: (id: string) => void;
    ondecree: () => void;
    onclose: () => void;
  } = $props();

  let strip: HTMLDivElement;
  let returnFocus: Element | null = null;
  let drag: { x: number; left: number; moved: boolean } | null = null;
  let suppressClick = false;

  const selectedIndex = $derived(Math.max(0, sites.findIndex((s) => s.selected)));

  /** The loop drawn on each card: up the slope, down the chute, back along the floor. */
  function stonePoint(loop: number): { x: number; y: number } {
    if (loop < 0.5) {
      const u = loop / 0.5;
      return { x: 26 + 104 * u, y: 84 - 56 * u };
    }
    if (loop < 0.9) {
      const u = (loop - 0.5) / 0.4;
      const e = u * u;
      return { x: 130 + 46 * u, y: 28 + 56 * e };
    }
    const u = (loop - 0.9) / 0.1;
    return { x: 176 - 150 * u, y: 84 };
  }

  export function scrollBy(dir: number) {
    const card = strip.querySelector<HTMLElement>('.card');
    strip.scrollBy({ left: dir * ((card?.offsetWidth ?? 240) + 16), behavior: 'smooth' });
  }

  function onwheel(e: WheelEvent) {
    // Vertical wheels scroll the frieze sideways.
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      strip.scrollLeft += e.deltaY;
    }
  }

  function onpointerdown(e: PointerEvent) {
    if (e.pointerType === 'touch') return; // native touch scrolling already pans
    drag = { x: e.clientX, left: strip.scrollLeft, moved: false };
  }
  function onpointermove(e: PointerEvent) {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 6) drag.moved = true;
    if (drag.moved) strip.scrollLeft = drag.left - dx;
  }
  function onpointerup() {
    suppressClick = !!drag?.moved;
    drag = null;
  }

  function choose(site: EmpireSite) {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    if (site.owned) onselect(site.id);
    else if (site.offered) ondecree();
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      e.preventDefault();
      onclose();
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const cards = [...strip.querySelectorAll<HTMLElement>('.card')];
      const i = cards.indexOf(document.activeElement as HTMLElement);
      const next = cards[Math.min(cards.length - 1, Math.max(0, (i < 0 ? selectedIndex : i) + (e.key === 'ArrowLeft' ? -1 : 1)))];
      if (next) {
        e.preventDefault();
        e.stopPropagation();
        next.focus();
        next.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
      }
    }
  }

  onMount(() => {
    returnFocus = document.activeElement;
    void tick().then(() => {
      const cards = strip.querySelectorAll<HTMLElement>('.card');
      const current = cards[selectedIndex];
      current?.scrollIntoView({ inline: 'center', block: 'nearest' });
      current?.focus({ preventScroll: true });
    });
    return () => (returnFocus as HTMLElement | null)?.focus?.();
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section class="empire" aria-label="Empire" {onkeydown}>
  <header>
    <h2>The Enterprise</h2>
    <p class="hint">Drag, scroll or use the arrows. Choosing a site only moves your attention; production never changes.</p>
    <button class="close" onclick={onclose} aria-label="Close empire view">✕</button>
  </header>
  <div
    class="strip"
    bind:this={strip}
    role="list"
    {onwheel}
    {onpointerdown}
    {onpointermove}
    {onpointerup}
    onpointerleave={onpointerup}
  >
    {#each sites as site, i (site.id)}
      {@const near = Math.abs(i - selectedIndex) <= 1}
      {@const p = stonePoint(site.loop)}
      <div role="listitem" class="slot">
        <button
          class="card"
          class:selected={site.selected}
          class:locked={!site.owned}
          class:near
          aria-current={site.selected ? 'true' : undefined}
          aria-disabled={!site.owned && !site.offered}
          onclick={() => choose(site)}
          aria-label={site.owned
            ? `${site.name}, chapter ${site.chapter}, level ${site.level}${site.automated ? `, ${site.rate}` : ', manual'}${site.selected ? ', selected' : ''}`
            : site.offered
              ? `${site.name}: decree issued, open it from the purchases`
              : site.teased
                ? `${site.name}: next decree at ${site.gate} Defiance`
                : `Chapter ${site.chapter}: undiscovered`}
        >
          <span class="scene" style:background-image="url({artUrl(`scene_${site.id}`)})"></span>
          {#if site.owned}
            <svg class="loop" viewBox="0 0 200 100" aria-hidden="true">
              <path d="M26 84 L130 28 Q150 30 176 84 Z" class="hill" />
              <path d="M26 84 L130 28" class="route" />
              <path d="M130 28 Q150 30 176 84 L26 84" class="chute" />
              {#if site.wheel}<circle cx="176" cy="84" r="9" class="wheel" class:spin={near && site.automated} />{/if}
              <circle cx={p.x} cy={p.y - 6} r="7" class="stone" class:live={near} />
            </svg>
            <span class="worker">
              {#if site.selected}
                <img src={artUrl('sisyphus_push')} alt="" /><small>Sisyphus</small>
              {:else if site.automated}
                <img src={artUrl('shade_attendant')} alt="" /><small>Shade</small>
              {:else}
                <small class="idle">Idle · needs a push</small>
              {/if}
            </span>
            {#if charterSigned}
              <img class="seal" src={iconUrl('decree_seal')} alt="Approved by Olympus" title="Approved by Olympus" />
            {/if}
          {:else}
            <span class="mystery" aria-hidden="true">
              <img src={iconUrl(site.offered ? 'ui_decree' : 'ui_lock')} alt="" />
            </span>
          {/if}
          <span class="label">
            <span class="chapter">Chapter {site.chapter}</span>
            <strong>{site.owned || site.teased || site.offered ? site.name : '· · ·'}</strong>
            {#if site.owned}
              <span class="stats">Lv {site.level} · {site.automated ? site.rate : 'manual'}</span>
              {#if near && site.works.length}
                <span class="works">
                  {#each site.works as w (w)}<img src={artUrl(`work_${w}`)} alt={w} title={w} />{/each}
                </span>
              {/if}
            {:else if site.offered}
              <span class="stats ready">Decree issued · open it</span>
            {:else if site.teased}
              <span class="stats">Decree at {site.gate} Defiance</span>
            {/if}
          </span>
        </button>
      </div>
    {/each}
  </div>
</section>

<style>
  .empire {
    position: absolute;
    left: 0;
    right: var(--drawer-width, 0px);
    top: calc(var(--hud-h) + 4px);
    bottom: var(--controls-h);
    z-index: 12;
    display: flex;
    flex-direction: column;
    background: linear-gradient(180deg, rgba(33, 27, 23, 0.9), rgba(33, 27, 23, 0.82));
    color: var(--ivory);
    border-top: 1px solid var(--bronze);
    border-bottom: 1px solid var(--bronze);
    backdrop-filter: blur(2px);
  }
  header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.6rem 1rem 0.2rem;
  }
  h2 {
    font-family: var(--display);
    font-weight: 600;
    font-size: 1.6rem;
    margin: 0;
    letter-spacing: 0.04em;
    color: var(--parchment);
  }
  .hint {
    margin: 0;
    flex: 1;
    font-size: 0.85rem;
    color: rgba(246, 236, 220, 0.72);
    font-style: italic;
  }
  .close {
    background: transparent;
    color: var(--ivory);
    border-color: rgba(246, 236, 220, 0.5);
  }
  .strip {
    flex: 1;
    display: flex;
    gap: 16px;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 0.8rem 1rem 1rem;
    scroll-snap-type: x proximity;
    cursor: grab;
    align-items: stretch;
    scrollbar-color: var(--bronze) transparent;
  }
  .strip:active { cursor: grabbing; }
  .slot {
    flex: 0 0 auto;
    display: flex;
    scroll-snap-align: center;
  }
  .card {
    position: relative;
    width: clamp(220px, 26vw, 300px);
    min-height: 240px;
    max-height: 420px;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding: 0;
    overflow: hidden;
    text-align: left;
    color: var(--ink);
    background: var(--parchment);
    border: 1.5px solid var(--bronze);
    border-radius: 14px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    user-select: none;
  }
  .card.selected {
    border-color: var(--pale-clay);
    box-shadow: 0 0 0 3px var(--pale-clay), 0 8px 24px rgba(0, 0, 0, 0.35);
  }
  .card:focus-visible { outline: 3px solid var(--ivory); outline-offset: 3px; }
  .card.locked { background: #3a302a; color: var(--parchment); }
  .card[aria-disabled='true'] { cursor: default; }
  .scene {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: 55% 60%;
  }
  .locked .scene { filter: brightness(0.12) sepia(0.4); }
  .card:not(.near) .scene { filter: saturate(0.6) brightness(0.9); }
  .locked:not(.near) .scene { filter: brightness(0.1); }
  .loop {
    position: absolute;
    left: 6%;
    right: 6%;
    top: 12%;
    width: 88%;
    pointer-events: none;
  }
  .loop .hill { fill: rgba(33, 27, 23, 0.28); }
  .loop .route { stroke: var(--ink); stroke-width: 3; fill: none; stroke-linecap: round; }
  .loop .chute { stroke: var(--ink); stroke-width: 1.5; stroke-dasharray: 4 5; fill: none; opacity: 0.7; }
  .loop .stone { fill: var(--ink); stroke: var(--parchment); stroke-width: 2; }
  .loop .stone.live { transition: cx 110ms linear, cy 110ms linear; }
  .loop .wheel { fill: none; stroke: var(--bronze); stroke-width: 3; stroke-dasharray: 6 4; transform-origin: 176px 84px; }
  .loop .wheel.spin { animation: spin 2.4s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .worker {
    position: absolute;
    left: 10px;
    top: 10px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px 4px 4px;
    background: rgba(246, 236, 220, 0.86);
    border: 1px solid var(--rule);
    border-radius: 999px;
    font-size: 0.8rem;
  }
  .worker img { height: 28px; width: auto; }
  .worker .idle { padding-left: 4px; font-style: italic; color: var(--muted); }
  .seal {
    position: absolute;
    right: 10px;
    top: 10px;
    width: 52px;
    height: 52px;
    transform: rotate(-12deg);
    filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.4));
  }
  .mystery {
    position: absolute;
    inset: 0 0 35% 0;
    display: grid;
    place-items: center;
  }
  .mystery img { width: 56px; height: 56px; opacity: 0.55; filter: invert(0.9); }
  .label {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0.6rem 0.8rem 0.7rem;
    background: linear-gradient(180deg, rgba(243, 232, 212, 0.9), var(--paper));
    border-top: 1px solid var(--rule);
  }
  .locked .label { background: rgba(33, 27, 23, 0.85); border-top-color: rgba(246, 236, 220, 0.15); }
  .chapter { font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--clay); }
  .locked .chapter { color: var(--pale-clay); }
  strong { font-family: var(--display); font-size: 1.25rem; font-weight: 600; line-height: 1.1; }
  .stats { font-size: 0.85rem; color: var(--muted); font-variant-numeric: tabular-nums; }
  .locked .stats { color: rgba(246, 236, 220, 0.7); }
  .stats.ready { color: var(--pale-clay); font-weight: 600; }
  .works { display: flex; gap: 4px; margin-top: 4px; }
  .works img { height: 30px; width: 30px; object-fit: contain; background: var(--ivory); border: 1px solid var(--rule); border-radius: 6px; }

  @media (max-width: 760px) {
    .hint { display: none; }
    .card { width: 72vw; min-height: 200px; }
  }
  :global(.reduced-motion) .loop .wheel.spin { animation: none; }
  :global(.reduced-motion) .loop .stone.live { transition: none; }
</style>
