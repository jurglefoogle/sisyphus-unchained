<script lang="ts">
  import { onMount } from 'svelte';
  import { artUrl, iconUrl } from '../world/library';

  /** The short, skippable ending after the Eternal Labor Charter (spec §01). Production continues underneath. */
  let { onclose }: { onclose: (reason: 'complete' | 'skip') => void } = $props();
  let skip: HTMLButtonElement;

  const LINES: [string, string][] = [
    ['The Eternal Labor Charter', 'Signed, sealed and countersigned by Olympus.'],
    ['Zeus', 'accepts the enterprise as contractor for its own punishment.'],
    ['Sisyphus', 'remains, technically, a participant.'],
    ['Hermes · Daedalus · Ixion', 'for accounts, linkages and one very reliable wheel.'],
    ['The Danaids · Talos · Atlas', 'for water that never fills, a sealed ankle and the weight of heaven.'],
    ['Thanatos', 'for every new beginning.'],
    ['Sisyphus – Unchained', 'An incremental comedy after the Greek myth. Machines, contracts and income are our invention.'],
    ['Built with', 'PixiJS, Svelte and break_infinity.js (MIT). Type set in Cormorant Garamond and EB Garamond (SIL Open Font License). Full notices ship with the game.'],
    ['The work continues', 'Production never stopped. The stone is still rolling.'],
  ];

  onMount(() => {
    skip.focus();
    const timer = setTimeout(() => onclose('complete'), 26_000);
    return () => clearTimeout(timer);
  });

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onclose('skip');
    }
  }
</script>

<div class="credits" role="dialog" aria-modal="true" aria-label="Credits" tabindex="-1" {onkeydown}>
  <img class="seal" src={iconUrl('decree_seal')} alt="" />
  <div class="roll">
    <img class="art" src={artUrl('work_charter')} alt="The Eternal Labor Charter" />
    {#each LINES as [head, body] (head)}
      <section>
        <h3>{head}</h3>
        <p>{body}</p>
      </section>
    {/each}
  </div>
  <button class="skip" bind:this={skip} onclick={() => onclose('skip')}>Back to the First Hill</button>
</div>

<style>
  .credits {
    position: fixed;
    inset: 0;
    z-index: 60;
    background: radial-gradient(ellipse at 50% 30%, #3a2b20 0%, var(--ink) 70%);
    color: var(--parchment);
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow: hidden;
    text-align: center;
  }
  .seal {
    position: absolute;
    top: 24px;
    right: 24px;
    width: 88px;
    transform: rotate(-10deg);
    opacity: 0.9;
  }
  .roll {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2.2rem;
    padding: 0 1.5rem;
    max-width: 38rem;
    animation: roll 24s linear forwards;
    transform: translateY(100vh);
  }
  .art { width: min(260px, 60vw); filter: drop-shadow(0 6px 18px rgba(0, 0, 0, 0.5)); }
  h3 {
    font-family: var(--display);
    font-weight: 600;
    font-size: 1.9rem;
    letter-spacing: 0.05em;
    margin: 0 0 0.3rem;
    color: var(--pale-clay);
  }
  p { margin: 0; font-size: 1.1rem; line-height: 1.5; font-style: italic; }
  .skip {
    position: absolute;
    bottom: max(24px, env(safe-area-inset-bottom));
    background: var(--parchment);
    color: var(--ink);
  }
  @keyframes roll {
    from { transform: translateY(100vh); }
    to { transform: translateY(-110%); }
  }
  :global(.reduced-motion) .roll {
    animation: none;
    transform: none;
    margin-top: 5vh;
    gap: 0.9rem;
    max-height: 80vh;
    overflow-y: auto;
  }
  :global(.reduced-motion) .art { width: 120px; }
</style>
