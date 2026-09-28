<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onMount, tick } from 'svelte';

  let { title, onclose, children, wide = false }: { title: string; onclose: () => void; children: Snippet; wide?: boolean } = $props();
  let dialog: HTMLDivElement;
  let returnFocus: Element | null = null;

  onMount(() => {
    returnFocus = document.activeElement;
    void tick().then(() => dialog.querySelector<HTMLElement>('button, [href], input, textarea')?.focus());
    return () => (returnFocus as HTMLElement | null)?.focus?.();
  });

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

<div class="backdrop" role="presentation" onpointerdown={(e) => e.target === e.currentTarget && onclose()}>
  <div class="modal" class:wide role="dialog" aria-modal="true" aria-label={title} tabindex="-1" bind:this={dialog} {onkeydown}>
    <header>
      <h2>{title}</h2>
      <button class="close" onclick={onclose} aria-label="Close">✕</button>
    </header>
    {@render children()}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(33, 27, 23, 0.6);
    backdrop-filter: blur(3px);
    display: grid;
    place-items: center;
    z-index: 50;
    padding: 16px;
  }
  .modal {
    background: var(--paper);
    border: 1px solid var(--ink);
    outline: 1px solid var(--bronze);
    outline-offset: -6px;
    border-radius: 14px;
    width: min(520px, 100%);
    max-height: 90dvh;
    overflow: auto;
    padding: 1.1rem 1.4rem 1.4rem;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
    overscroll-behavior: contain;
  }
  .modal.wide {
    width: min(760px, 100%);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid rgba(33, 27, 23, 0.2);
  }
  h2 {
    margin: 0;
    font-family: var(--display);
    font-weight: 600;
    font-size: 1.6rem;
    letter-spacing: 0.03em;
  }
  .close {
    border: none;
    background: transparent;
  }
</style>
