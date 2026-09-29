<script lang="ts">
  import { onMount } from 'svelte';
  import { iconUrl } from '../world/library';

  let {
    location,
    onresume,
    onarchive,
    onsettings,
    ontitle,
  }: {
    location: string;
    onresume: () => void;
    onarchive: () => void;
    onsettings: () => void;
    ontitle: () => void;
  } = $props();

  let resume = $state<HTMLButtonElement>();
  onMount(() => requestAnimationFrame(() => resume?.focus()));
</script>

<div class="pause-screen" role="dialog" aria-modal="true" aria-labelledby="pause-title">
  <div class="tablet">
    <p class="eyebrow">{location}</p>
    <h2 id="pause-title">Labor suspended</h2>
    <p>The stone, in a rare show of solidarity, is also taking a moment.</p>
    <div class="actions">
      <button class="primary" bind:this={resume} onclick={onresume}><img src={iconUrl('ui_play')} alt="" />Resume</button>
      <button onclick={onarchive}><img src={iconUrl('ui_archive')} alt="" />Archive</button>
      <button onclick={onsettings}><img src={iconUrl('ui_settings')} alt="" />Settings</button>
      <button onclick={ontitle}><img src={iconUrl('ui_back')} alt="" />Return to title</button>
    </div>
  </div>
</div>

<style>
  .pause-screen {
    position: fixed;
    inset: 0;
    z-index: 45;
    display: grid;
    place-items: center;
    padding: 1rem;
    background: rgba(20, 14, 11, .58);
    backdrop-filter: blur(5px) saturate(.72);
  }
  .tablet {
    width: min(29rem, 100%);
    padding: 2.1rem;
    color: var(--ink);
    text-align: center;
    background: linear-gradient(145deg, rgba(246, 236, 220, .98), rgba(235, 220, 192, .97));
    border: 1px solid var(--bronze);
    outline: 1px solid rgba(33, 27, 23, .44);
    outline-offset: -.5rem;
    box-shadow: 0 1.5rem 4rem rgba(12, 8, 6, .42);
  }
  .eyebrow { margin: 0; color: #8a4a2c; font-size: .72rem; letter-spacing: .14em; text-transform: uppercase; }
  h2 { margin: .2rem 0 .5rem; font-family: var(--display); font-size: 2.25rem; text-transform: uppercase; }
  .tablet > p:last-of-type { margin: 0 auto 1.25rem; max-width: 22rem; font-style: italic; }
  .actions { display: grid; grid-template-columns: 1fr 1fr; gap: .55rem; }
  button {
    min-height: 3rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: .55rem;
    border: 1px solid rgba(91, 63, 43, .55);
    color: var(--ink);
    background: rgba(246, 236, 220, .62);
    font: 600 1rem var(--body);
    cursor: pointer;
  }
  button:hover { background: rgba(217, 156, 108, .34); }
  button.primary { grid-column: 1 / -1; min-height: 3.5rem; color: var(--ivory); background: #5b2e20; border-color: var(--bronze); font-family: var(--display); font-size: 1.25rem; }
  button.primary:hover { background: #753a27; }
  img { width: 1.15rem; height: 1.15rem; }
  .primary img { filter: brightness(0) invert(1) sepia(.25); }
  @media (max-width: 460px) {
    .tablet { padding: 1.6rem 1.25rem; }
    .actions { grid-template-columns: 1fr; }
    button.primary { grid-column: auto; }
  }
</style>
