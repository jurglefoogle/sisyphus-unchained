<script lang="ts">
  import { onMount } from 'svelte';
  import { artUrl, iconUrl } from '../world/library';
  import { EDGE, papyrus, TILE } from './papyrus';
  import { KEY_H, KEY_W, stone } from './stone';

  const paper = papyrus();
  const key = stone().key;

  let {
    hasProgress,
    location,
    progress,
    canViewCredits = false,
    oncontinue,
    onnew,
    onsettings,
    oncredits,
  }: {
    hasProgress: boolean;
    location: string;
    progress: string;
    canViewCredits?: boolean;
    oncontinue: () => void;
    onnew: () => void;
    onsettings: () => void;
    oncredits: () => void;
  } = $props();

  let primary = $state<HTMLButtonElement>();
  let confirming = $state(false);

  onMount(() => requestAnimationFrame(() => primary?.focus()));
</script>

<section class="start-screen" aria-labelledby="game-title">
  <div class="sky" style:--title-bg={`url("${artUrl('scene_olympian_approach')}")`} aria-hidden="true"></div>
  <div class="kiln" aria-hidden="true"></div>
  <img class="hero" src={artUrl('sisyphus_rest')} alt="" />
  <img class="stone" src={artUrl('stone_limestone')} alt="" />

  <div
    class="volume"
    style:--paper-tex="url({paper.sheet})"
    style:--edge-l="url({paper.edgeLeft})"
    style:--edge-r="url({paper.edgeRight})"
    style:--tile="{TILE}px"
    style:--edge="{EDGE}px"
    style:--key="url({key})"
    style:--key-w="{KEY_W}px"
    style:--key-h="{KEY_H}px"
  >
  <span class="rod turned-rod" aria-hidden="true"></span>
  <div class="title-card">
    <p class="eyebrow">A myth of labor, leverage and divine paperwork</p>
    <h1 id="game-title"><span>Sisyphus</span><small>Unchained</small></h1>
    <div class="meander" aria-hidden="true"></div>

    {#if confirming}
      <div class="confirm" role="alertdialog" aria-labelledby="new-game-title" aria-describedby="new-game-warning">
        <h2 id="new-game-title">Begin from the bottom?</h2>
        <p id="new-game-warning">Your current run will be copied to recovery storage before a new sentence begins.</p>
        <div class="actions split">
          <button onclick={() => (confirming = false)}>Keep current run</button>
          <button class="danger" onclick={onnew}>Begin new game</button>
        </div>
      </div>
    {:else}
      {#if hasProgress}
        <div class="save-summary">
          <span>Continue at</span>
          <strong>{location}</strong>
          <small>{progress}</small>
        </div>
      {:else}
        <p class="premise">Condemned to push forever. Determined to improve the operation.</p>
      {/if}

      <div class="actions">
        <button class="primary" bind:this={primary} onclick={oncontinue}>
          <img src={iconUrl(hasProgress ? 'ui_play' : 'ui_decree')} alt="" />
          {hasProgress ? 'Continue' : 'Hear the sentence'}
        </button>
        {#if hasProgress}<button onclick={() => (confirming = true)}>New game</button>{/if}
        <button onclick={onsettings}>Settings & accessibility</button>
        {#if canViewCredits}<button onclick={oncredits}>Credits</button>{/if}
      </div>

      <p class="autosave"><img src={iconUrl('ui_save')} alt="" /> Progress saves automatically</p>
    {/if}
  </div>
  <span class="rod turned-rod" aria-hidden="true"></span>
  </div>

  <p class="version">SISYPHUS: UNCHAINED · EARLY BUILD</p>
</section>

<style>
  .start-screen {
    position: fixed;
    inset: 0;
    z-index: 40;
    overflow: hidden;
    display: grid;
    place-items: center;
    color: var(--ink);
    background: #211b17;
    isolation: isolate;
  }
  .sky {
    position: absolute;
    inset: 0;
    z-index: -4;
    background:
      linear-gradient(90deg, rgba(33, 27, 23, .2), rgba(33, 27, 23, .68) 62%, rgba(33, 27, 23, .88)),
      var(--title-bg) center / cover no-repeat;
    transform: scale(1.025);
  }
  .kiln {
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    background:
      radial-gradient(circle at 72% 38%, transparent 0 19%, rgba(33, 27, 23, .25) 58%, rgba(16, 12, 10, .72) 100%),
      repeating-linear-gradient(8deg, transparent 0 31px, rgba(246, 236, 220, .018) 32px 33px);
    box-shadow: inset 0 0 9vw rgba(12, 8, 6, .8);
  }
  .hero {
    position: absolute;
    z-index: -2;
    left: clamp(-6rem, 3vw, 4rem);
    bottom: -15vh;
    height: min(104vh, 60vw);
    filter: drop-shadow(0 1.5rem 2rem rgba(16, 10, 7, .45));
  }
  .stone {
    position: absolute;
    z-index: -3;
    left: clamp(20rem, 35vw, 42rem);
    bottom: -9vh;
    width: min(36vw, 32rem);
    opacity: .72;
    filter: sepia(.15) drop-shadow(0 1rem 2rem rgba(16, 10, 7, .38));
  }
  /* The title is written on a papyrus held open between two rods. */
  .volume {
    display: flex;
    flex-direction: column;
    width: min(31rem, calc(100vw - 3rem));
    margin-left: min(42vw, 35rem);
    filter: drop-shadow(0 2rem 3rem rgba(12, 8, 6, .5)) drop-shadow(0 2px 3px rgba(12, 8, 6, .4));
  }
  .rod { z-index: 1; margin: 0 -16px; }
  .title-card {
    margin: -8px 0;
    padding: calc(clamp(1.5rem, 4vw, 3rem) + 8px) clamp(1.5rem, 4vw, 3rem);
    text-align: center;
    color: #231710;
    background:
      linear-gradient(90deg, rgba(96, 60, 22, .28), rgba(96, 60, 22, 0) 8%, rgba(96, 60, 22, 0) 92%, rgba(96, 60, 22, .3)),
      radial-gradient(120% 70% at 50% 0%, rgba(255, 248, 228, .35), transparent 70%),
      var(--paper-tex) 0 0 / var(--tile) var(--tile);
    box-shadow: inset 0 14px 12px -12px rgba(52, 30, 8, .5), inset 0 -14px 12px -12px rgba(52, 30, 8, .5);
    -webkit-mask:
      var(--edge-l) left top / var(--edge) var(--tile) repeat-y,
      linear-gradient(#000, #000) center / calc(100% - 2 * var(--edge) + 2px) 100% no-repeat,
      var(--edge-r) right top / var(--edge) var(--tile) repeat-y;
    mask:
      var(--edge-l) left top / var(--edge) var(--tile) repeat-y,
      linear-gradient(#000, #000) center / calc(100% - 2 * var(--edge) + 2px) 100% no-repeat,
      var(--edge-r) right top / var(--edge) var(--tile) repeat-y;
  }
  :global(.high-contrast) .title-card { background: #fffaf0; }
  .eyebrow {
    margin: 0 0 .7rem;
    color: #744329;
    font: 600 .72rem/1.2 var(--body);
    letter-spacing: .12em;
    text-transform: uppercase;
  }
  h1 {
    margin: 0;
    font-family: var(--display);
    font-weight: 700;
    line-height: .82;
    text-transform: uppercase;
  }
  h1 span { display: block; font-size: clamp(3.3rem, 7vw, 5.8rem); letter-spacing: -.045em; }
  h1 small { display: block; margin-top: .5rem; color: #9b4d2c; font-size: clamp(1.5rem, 3vw, 2.4rem); letter-spacing: .22em; }
  /* The running key in black glaze, as on the beam over the world. */
  .meander {
    height: var(--key-h);
    margin: 1.25rem 0;
    background: var(--key) 0 0 / var(--key-w) var(--key-h) repeat-x;
    border-block: 1px solid #1d130c;
    box-sizing: content-box;
  }
  .premise { max-width: 24rem; margin: 0 auto 1.25rem; font-size: 1.08rem; font-style: italic; }
  .save-summary { margin: 0 auto 1.25rem; padding: .75rem 1rem; border-block: 1px solid rgba(165, 123, 59, .45); }
  .save-summary span, .save-summary small { display: block; color: #6b5140; }
  .save-summary span { font-size: .72rem; letter-spacing: .12em; text-transform: uppercase; }
  .save-summary strong { display: block; margin: .1rem 0; font-family: var(--display); font-size: 1.35rem; }
  .actions { display: grid; gap: .55rem; }
  .actions button {
    min-height: 2.9rem;
    border: 1px solid rgba(91, 63, 43, .5);
    background: rgba(255, 250, 236, .38);
    box-shadow: 0 1px 0 rgba(91, 63, 43, .25);
    color: var(--ink);
    font: 600 1rem var(--body);
    cursor: pointer;
  }
  .actions button:not(.primary, .danger):hover { background: rgba(217, 156, 108, .34); }
  .actions .primary {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: .65rem;
    min-height: 3.6rem;
    font-family: var(--display);
    font-size: 1.35rem;
    font-weight: 700;
    /* Glazed clay, as for every panel's main action. */
    color: #f7e9d6;
    border-color: #3a170a;
    background:
      radial-gradient(ellipse at 30% 15%, rgba(255, 214, 170, .28), transparent 60%),
      linear-gradient(180deg, #a44d27 0%, #8c3b1b 55%, #6c2a11 100%);
    box-shadow: inset 0 1px rgba(255, 220, 180, .3), inset 0 -2px 3px rgba(40, 12, 2, .35), 0 2px 0 #2a150a;
  }
  .actions .primary:hover { filter: brightness(1.08); }
  .actions img { width: 1.35rem; height: 1.35rem; filter: brightness(0) invert(1) sepia(.25); }
  .actions.split { grid-template-columns: 1fr 1fr; }
  .actions .danger { color: #fff5e8; background: #7a2922; }
  .confirm h2 { margin: .2rem 0 .55rem; font-family: var(--display); font-size: 1.8rem; }
  .confirm p { margin: 0 0 1.2rem; }
  .autosave { display: flex; justify-content: center; align-items: center; gap: .4rem; margin: 1rem 0 0; color: #6b5140; font-size: .78rem; }
  .autosave img { width: 1rem; height: 1rem; opacity: .72; }
  .version { position: absolute; right: 1rem; bottom: .7rem; margin: 0; color: rgba(246, 236, 220, .56); font-size: .66rem; letter-spacing: .12em; }

  @media (max-width: 760px) {
    .sky { background-position: 64% center; }
    .hero { left: -38vw; bottom: -3vh; height: 68vh; opacity: .42; }
    .stone { left: auto; right: -22vw; bottom: -2vh; width: 70vw; opacity: .28; }
    .volume { margin: 0; width: min(29rem, calc(100vw - 2.5rem)); }
    .title-card { padding: calc(1.6rem + 8px) 1.35rem; }
    h1 span { font-size: clamp(3rem, 16vw, 4.6rem); }
    h1 small { font-size: clamp(1.25rem, 7vw, 2rem); }
  }
  @media (max-height: 620px) and (min-width: 700px) {
    .title-card { padding: calc(1.2rem + 8px) 2rem; }
    .eyebrow, .autosave { display: none; }
    .meander { margin: .7rem 0; }
    h1 span { font-size: 3.5rem; }
    h1 small { font-size: 1.35rem; }
  }
  :global(.reduced-motion) .sky { transform: none; }
</style>
