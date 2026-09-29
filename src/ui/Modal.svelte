<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onMount, tick } from 'svelte';
  import { fade } from 'svelte/transition';
  import { cubicOut, backOut } from 'svelte/easing';
  import { EDGE, papyrus, TILE } from './papyrus';
  import { KEY_H, KEY_W, stone } from './stone';

  let { title, onclose, children, wide = false }: { title: string; onclose: () => void; children: Snippet; wide?: boolean } = $props();
  let dialog: HTMLDivElement;
  const paper = papyrus();
  const key = stone().key;
  let returnFocus: Element | null = null;

  onMount(() => {
    returnFocus = document.activeElement;
    void tick().then(() => dialog.querySelector<HTMLElement>('button, [href], input, textarea')?.focus());
    return () => (returnFocus as HTMLElement | null)?.focus?.();
  });

  const still = () => document.documentElement.classList.contains('reduced-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** The panel is set down like a tablet: it rises, settles and straightens. */
  function setDown(_: Element, { out = false } = {}) {
    if (still()) return { duration: 0 };
    return {
      duration: out ? 160 : 380,
      easing: out ? cubicOut : backOut,
      css: (t: number, u: number) => `opacity: ${Math.min(1, t * 1.6)}; transform: translateY(${u * (out ? 8 : 22)}px) scale(${0.96 + 0.04 * t}) rotate(${u * -0.6}deg)`,
    };
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onclose();
      return;
    }
    if (e.key !== 'Tab') return;
    // Trap focus inside the dialog.
    const items = [...dialog.querySelectorAll<HTMLElement>('button, [href], input, textarea, select')].filter((x) => !x.hasAttribute('disabled'));
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
</script>

<div class="backdrop" transition:fade={{ duration: still() ? 0 : 200 }} role="presentation" onpointerdown={(e) => e.target === e.currentTarget && onclose()}>
  <div
    class="modal"
    class:wide
    in:setDown
    out:setDown={{ out: true }}
    role="dialog"
    aria-modal="true"
    aria-label={title}
    tabindex="-1"
    bind:this={dialog}
    {onkeydown}
    style:--paper-tex="url({paper.sheet})"
    style:--edge-l="url({paper.edgeLeft})"
    style:--edge-r="url({paper.edgeRight})"
    style:--tile="{TILE}px"
    style:--edge="{EDGE}px"
    style:--key="url({key})"
    style:--key-w="{KEY_W * 0.75}px"
    style:--key-h="{KEY_H * 0.75}px"
  >
    <!-- A scroll held open between two rods. -->
    <span class="rod turned-rod" aria-hidden="true"></span>
    <div class="sheet">
      <header>
        <h2>{title}</h2>
        <button class="close" onclick={onclose} aria-label="Close">✕</button>
      </header>
      {@render children()}
    </div>
    <span class="rod turned-rod" aria-hidden="true"></span>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: radial-gradient(ellipse at 50% 45%, rgba(33, 27, 23, 0.45), rgba(20, 14, 10, 0.72));
    backdrop-filter: blur(3px);
    display: grid;
    place-items: center;
    z-index: 50;
    padding: 16px;
  }
  .modal {
    --rod: 16px;
    position: relative;
    display: flex;
    flex-direction: column;
    width: min(520px, 100%);
    max-height: 90dvh;
    filter: drop-shadow(0 18px 30px rgba(0, 0, 0, 0.45)) drop-shadow(0 2px 3px rgba(0, 0, 0, 0.35));
    /* Inner panels become washes over the papyrus rather than cream boxes. */
    --paper: rgba(255, 248, 228, 0.42);
    --panel: rgba(255, 248, 228, 0.5);
    --rule: rgba(92, 60, 26, 0.32);
    --muted: #5a4632;
  }
  .modal:focus { outline: none; }
  .modal.wide {
    width: min(760px, 100%);
  }
  .sheet {
    flex: 1;
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
    margin: calc(var(--rod) / -2) 0;
    padding: calc(var(--rod) / 2 + 1rem) 1.6rem calc(var(--rod) / 2 + 1.4rem);
    color: #2a1d12;
    background:
      linear-gradient(90deg, rgba(96, 60, 22, 0.28), rgba(96, 60, 22, 0) 7%, rgba(96, 60, 22, 0) 93%, rgba(96, 60, 22, 0.3)),
      var(--paper-tex) 0 0 / var(--tile) var(--tile);
    background-attachment: scroll, local;
    box-shadow: inset 0 14px 12px -12px rgba(52, 30, 8, 0.5), inset 0 -14px 12px -12px rgba(52, 30, 8, 0.5);
    -webkit-mask:
      var(--edge-l) left top / var(--edge) var(--tile) repeat-y,
      linear-gradient(#000, #000) center / calc(100% - 2 * var(--edge) + 2px) 100% no-repeat,
      var(--edge-r) right top / var(--edge) var(--tile) repeat-y;
    mask:
      var(--edge-l) left top / var(--edge) var(--tile) repeat-y,
      linear-gradient(#000, #000) center / calc(100% - 2 * var(--edge) + 2px) 100% no-repeat,
      var(--edge-r) right top / var(--edge) var(--tile) repeat-y;
    scrollbar-width: thin;
    scrollbar-color: rgba(96, 60, 22, 0.45) transparent;
  }
  .rod {
    z-index: 1;
    flex: none;
    margin: 0 -16px;
  }
  .close:focus-visible {
    outline-width: 2px;
    border-radius: 50%;
  }
  header {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding-bottom: calc(var(--key-h) + 0.7rem);
    margin-bottom: 0.4rem;
  }
  /* The running key in black glaze, as on the beam over the world. */
  header::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0.3rem;
    box-sizing: content-box;
    height: var(--key-h);
    background: var(--key) 0 0 / var(--key-w) var(--key-h) repeat-x;
    border-top: 1px solid #1d130c;
    border-bottom: 1px solid #1d130c;
    opacity: 0.92;
  }
  h2 {
    margin: 0;
    font-family: var(--display);
    font-weight: 600;
    font-size: 1.7rem;
    letter-spacing: 0.04em;
    color: #231710;
  }
  .close {
    border: none;
    border-radius: 50%;
    background: transparent;
    box-shadow: none;
    color: rgba(42, 29, 18, 0.8);
  }
  :global(.high-contrast) .sheet {
    background: #fffaf0;
  }
</style>
