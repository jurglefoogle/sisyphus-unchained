<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { Game, Notice } from '../app/game';
  import type { GameView } from '../app/view';
  import type { PrestigePreview } from '../core/commands';
  import { formatDuration, formatMoney, formatMultiplier } from '../core/format';
  import { t } from '../content/strings';
  import { World } from '../world/world';
  import Drawer from './Drawer.svelte';
  import Modal from './Modal.svelte';
  import Settings from './Settings.svelte';

  let { game }: { game: Game } = $props();

  let view = $state<GameView>(untrack(() => game.view()));
  let worldHost: HTMLDivElement;
  let world = $state.raw<World | null>(null);
  let drawerOpen = $state(false);
  let settingsOpen = $state(false);
  let prestige = $state<PrestigePreview | null>(null);
  let story = $state<Notice | null>(null);
  let recap = $state<Notice | null>(null);
  let toast = $state<string | null>(null);
  let caption = $state<string | null>(null);
  let error = $state<string | null>(null);
  let held = $state(false);
  let width = $state(1200);
  let height = $state(800);
  let options = $state(untrack(() => ({ ...game.state.options })));

  const narrow = $derived(width < 760);
  const storyQueue: Notice[] = [];
  let storyTimer: ReturnType<typeof setTimeout> | undefined;
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  let captionTimer: ReturnType<typeof setTimeout> | undefined;

  function setHeld(next: boolean) {
    held = next;
    game.setManual(next);
  }

  function pushDown() {
    if (options.toggleMode) setHeld(!held);
    else setHeld(true);
  }
  function pushUp() {
    if (!options.toggleMode) setHeld(false);
  }

  function showStory() {
    if (story || !storyQueue.length) return;
    story = storyQueue.shift()!;
    clearTimeout(storyTimer);
    storyTimer = setTimeout(dismissStory, story.firstTime ? 7000 : 2500);
  }
  function dismissStory() {
    story = null;
    showStory();
  }

  function onNotice(n: Notice) {
    if (n.kind === 'story' && n.storyId) {
      storyQueue.push(n);
      showStory();
    } else if (n.kind === 'recap') {
      recap = n;
    } else if (n.kind === 'relic' && n.relicId) {
      toast = `Relic found: ${t(`relic.${n.relicId}`)} — ${t(`relic.${n.relicId}.joke`)} (income ×1.1)`;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => (toast = null), 6000);
    } else if (n.kind === 'toast' && n.text) {
      toast = n.text;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => (toast = null), 6000);
    } else if (n.kind === 'error' && n.text) {
      error = n.text;
    } else if (n.kind === 'info' && n.text) {
      if (n.storyId === 'ambient' && (story || drawerOpen && narrow)) return;
      caption = n.text;
      clearTimeout(captionTimer);
      captionTimer = setTimeout(() => (caption = null), 8000);
    }
  }

  function openPrestige() {
    prestige = game.previewPrestige();
  }
  async function confirmPrestige() {
    const r = await game.confirmPrestige();
    prestige = null;
    held = false;
    if (!r.ok) error = 'Begin Again is not available right now.';
  }

  function isTyping(e: KeyboardEvent) {
    const el = e.target as HTMLElement | null;
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  }

  function onkeydown(e: KeyboardEvent) {
    if (settingsOpen || prestige || recap || isTyping(e)) return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) pushDown();
    } else if (e.key === 'Escape' && drawerOpen) {
      drawerOpen = false;
    } else if (e.key === 'ArrowLeft' && view.site.prevId && !drawerOpen) {
      game.selectSite(view.site.prevId);
      held = false;
    } else if (e.key === 'ArrowRight' && view.site.nextId && !drawerOpen) {
      game.selectSite(view.site.nextId);
      held = false;
    }
  }
  function onkeyup(e: KeyboardEvent) {
    if (e.code === 'Space' && !isTyping(e)) {
      e.preventDefault();
      pushUp();
    }
  }

  function releaseInput() {
    // Focus loss and hidden tabs release manual effort immediately.
    if (held) setHeld(false);
  }

  function selectSite(id: string | null) {
    if (!id) return;
    game.selectSite(id);
    held = false;
  }

  $effect(() => {
    const drawerW = drawerOpen && !narrow ? Math.min(420, width * 0.3) : 0;
    const bottom = narrow ? (drawerOpen ? height * 0.45 : 150) : 110;
    world?.setInsets({ top: narrow ? 90 : 70, right: drawerW, bottom, left: 0 });
  });

  $effect(() => {
    document.documentElement.style.setProperty('--text-scale', String(options.textScale));
    document.documentElement.classList.toggle('high-contrast', options.highContrast);
  });

  onMount(() => {
    const offView = game.onView((v) => (view = v));
    const offNotice = game.onNotice(onNotice);
    world = new World(game);
    if (import.meta.env.DEV) (window as unknown as { world: World }).world = world;
    world.onPush = (down) => (down ? pushDown() : pushUp());
    void world.mount(worldHost);
    const onVis = () => document.hidden && releaseInput();
    const onHide = () => void game.save();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', releaseInput);
    window.addEventListener('pagehide', onHide);
    return () => {
      offView();
      offNotice();
      world?.destroy();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', releaseInput);
      window.removeEventListener('pagehide', onHide);
    };
  });
</script>

<svelte:window {onkeydown} {onkeyup} bind:innerWidth={width} bind:innerHeight={height} />

<main class:narrow>
  <div class="world" bind:this={worldHost}></div>

  <header class="hud">
    <div class="wallet" aria-live="off">
      <span class="obols"><span class="visually-hidden">Obols: </span>{view.obols} <small>Obols</small></span>
      <span class="rate">{view.automated ? view.rate : 'Manual labor'}</span>
    </div>
    {#if view.decree?.shown}
      <div class="decree" title="Next decree">
        <span>{view.decree.ready ? 'Decree ready:' : 'Next:'} {view.decree.name}</span>
        <div class="mini-bar" role="progressbar" aria-label="Impertinence toward {view.decree.name}" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(view.decree.progress * 100)}>
          <span style:width="{view.decree.progress * 100}%"></span>
        </div>
      </div>
    {/if}
    <div class="menu">
      {#if view.insight > 0}<span class="insight" title="Existential Insight">✦ {view.insight}</span>{/if}
      <button onclick={() => game.setPaused(!view.paused)} aria-pressed={view.paused}>{view.paused ? 'Resume' : 'Pause'}</button>
      <button onclick={() => (settingsOpen = true)}>Settings</button>
    </div>
  </header>

  {#if view.site.ownedCount > 1}
    <nav class="sites" aria-label="Operations">
      <button onclick={() => selectSite(view.site.prevId)} disabled={!view.site.prevId} aria-label="Previous operation">◀</button>
      <span>{view.site.name}</span>
      <button onclick={() => selectSite(view.site.nextId)} disabled={!view.site.nextId} aria-label="Next operation">▶</button>
    </nav>
  {/if}

  {#if caption && options.ambientCaptions}
    <p class="caption" aria-live="polite">“{caption}”</p>
  {/if}

  {#if view.paused}
    <div class="paused-banner">Paused — production stopped</div>
  {/if}

  <footer class="controls">
    <p class="objective">{view.objective}</p>
    <div class="control-row">
      <button
        class="push"
        class:held
        aria-pressed={held}
        disabled={view.paused}
        onpointerdown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          pushDown();
        }}
        onpointerup={pushUp}
        onpointercancel={releaseInput}
        onkeydown={(e) => e.key === 'Enter' && !e.repeat && pushDown()}
        onkeyup={(e) => e.key === 'Enter' && pushUp()}
      >
        {view.automated ? 'Help push' : 'Push'}{options.toggleMode ? (held ? ' (on)' : ' (off)') : ''}
      </button>
      <button class="drawer-toggle" aria-expanded={drawerOpen} aria-controls="drawer" onclick={() => (drawerOpen = !drawerOpen)}>
        {drawerOpen ? 'Close' : 'Improve'}
      </button>
    </div>
  </footer>

  <aside id="drawer" class="drawer" class:open={drawerOpen} aria-label="Purchases" inert={!drawerOpen}>
    <Drawer {game} {view} onprestige={openPrestige} />
  </aside>

  {#if story}
    {@const id = story.storyId}
    <div class="story" role="status" aria-live="polite">
      {#if story.firstTime}
        <p class="god">{t(`story.${id}.god`)}</p>
        <p class="sis">— {t(`story.${id}.sis`)}</p>
      {:else}
        <p class="god small">{t(`story.${id}.god`)}</p>
      {/if}
      <button onclick={dismissStory} aria-label="Dismiss">✕</button>
    </div>
  {/if}

  {#if toast}
    <div class="toast" role="status">{toast}</div>
  {/if}

  {#if error}
    <div class="error" role="alert">
      <p>{error}</p>
      <button onclick={() => (error = null)}>OK</button>
    </div>
  {/if}

  {#if recap?.recap}
    {@const r = recap.recap}
    <Modal title="While you were away" onclose={() => (recap = null)}>
      <p>Time counted: <strong>{formatDuration(r.countedSeconds)}</strong>{#if r.requestedSeconds > r.countedSeconds} (limit reached; {formatDuration(r.requestedSeconds)} away){/if}</p>
      <p>Earned: <strong>{formatMoney(r.earned)} Obols</strong> — already in your purse.</p>
      {#each r.relicIds as id (id)}<p>Relic found: <strong>{t(`relic.${id}`)}</strong></p>{/each}
      {#each r.decreeSiteIds as id (id)}<p>Decree ready: <strong>{t(`site.${id}`)}</strong></p>{/each}
      <button onclick={() => (recap = null)}>Back to work</button>
    </Modal>
  {/if}

  {#if prestige}
    <Modal title="Begin Again" onclose={() => (prestige = null)}>
      <p>Renegotiate the sentence. Thanatos returns you to the foot of the First Hill.</p>
      <ul>
        <li>This run: {formatMoney(prestige.runGross)} Defiance (record {formatMoney(prestige.record)})</li>
        <li>Insight to claim: <strong>{prestige.award}</strong></li>
        <li>Permanent income: {formatMultiplier(prestige.factorBefore)} → <strong>{formatMultiplier(prestige.factorAfter)}</strong></li>
      </ul>
      <p><strong>Resets:</strong> Obols, operations, levels, works, the foreman and the current climb (unfinished climbs pay nothing).</p>
      <p><strong>Stays:</strong> relics, Insight and permanent upgrades, discoveries, settings and records.</p>
      <div class="modal-actions">
        <button onclick={() => (prestige = null)}>Not yet</button>
        <button class="primary" disabled={prestige.award <= 0} onclick={confirmPrestige}>Begin Again</button>
      </div>
    </Modal>
  {/if}

  {#if settingsOpen}
    <Settings {game} bind:options onclose={() => (settingsOpen = false)} />
  {/if}
</main>

<style>
  main {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #e9e4dc;
  }
  .world {
    position: absolute;
    inset: 0;
  }
  .hud {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.5rem 0.75rem;
    pointer-events: none;
  }
  .hud > * {
    pointer-events: auto;
  }
  .wallet {
    display: flex;
    flex-direction: column;
    background: var(--panel);
    border: 2px solid var(--ink);
    border-radius: var(--radius);
    padding: 0.25rem 0.75rem;
    min-width: 9rem;
  }
  .obols {
    font-size: 1.5rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .obols small {
    font-size: 0.8rem;
    font-weight: 400;
  }
  .rate {
    font-size: 0.85rem;
    color: var(--muted);
  }
  .decree {
    background: var(--panel);
    border: 2px solid var(--ink);
    border-radius: var(--radius);
    padding: 0.25rem 0.75rem;
    font-size: 0.85rem;
    min-width: 12rem;
  }
  .mini-bar {
    height: 6px;
    background: rgba(33, 27, 23, 0.15);
    border-radius: 3px;
    overflow: hidden;
    margin-top: 3px;
  }
  .mini-bar span {
    display: block;
    height: 100%;
    background: var(--ink);
  }
  .menu {
    margin-left: auto;
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }
  .insight {
    background: var(--panel);
    border: 2px solid var(--ink);
    border-radius: 8px;
    padding: 0.5rem 0.6rem;
  }
  .sites {
    position: absolute;
    top: 4.6rem;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--panel);
    border: 2px solid var(--ink);
    border-radius: var(--radius);
    padding: 0.2rem;
  }
  .caption {
    position: absolute;
    bottom: 7.5rem;
    left: 50%;
    transform: translateX(-50%);
    max-width: min(90vw, 36rem);
    margin: 0;
    font-style: italic;
    background: rgba(246, 236, 220, 0.85);
    padding: 0.3rem 0.8rem;
    border-radius: 8px;
    text-align: center;
  }
  .paused-banner {
    position: absolute;
    top: 45%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--ink);
    color: var(--ivory);
    padding: 0.6rem 1.2rem;
    border-radius: var(--radius);
    font-size: 1.2rem;
  }
  .controls {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 0.5rem 0.75rem 0.75rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    pointer-events: none;
  }
  .controls > * {
    pointer-events: auto;
  }
  .objective {
    margin: 0;
    background: var(--panel);
    border: 2px solid var(--ink);
    border-radius: var(--radius);
    padding: 0.35rem 0.9rem;
    max-width: min(94vw, 44rem);
    text-align: center;
  }
  .control-row {
    display: flex;
    gap: 0.6rem;
  }
  .push {
    min-width: 9rem;
    min-height: 52px;
    font-size: 1.15rem;
    font-weight: 700;
    background: var(--clay);
    color: var(--ivory);
    touch-action: none;
    user-select: none;
  }
  .push.held {
    background: var(--ink);
  }
  .drawer-toggle {
    min-height: 52px;
    min-width: 7rem;
    font-weight: 700;
  }
  .drawer {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(420px, 30vw);
    min-width: 300px;
    background: var(--panel);
    border-left: 2px solid var(--ink);
    overflow-y: auto;
    transform: translateX(100%);
    transition: transform 0.2s ease;
    z-index: 10;
  }
  .drawer.open {
    transform: none;
  }
  .narrow .drawer {
    top: auto;
    left: 0;
    width: 100%;
    min-width: 0;
    height: 45vh;
    border-left: none;
    border-top: 2px solid var(--ink);
    transform: translateY(100%);
  }
  .narrow .drawer.open {
    transform: none;
  }
  .narrow:has(.drawer.open) .controls {
    bottom: 45vh;
  }
  .narrow .hud {
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .story {
    position: absolute;
    top: 5rem;
    left: 50%;
    transform: translateX(-50%);
    background: var(--ink);
    color: var(--ivory);
    padding: 0.8rem 3rem 0.8rem 1.2rem;
    border-radius: var(--radius);
    max-width: min(92vw, 34rem);
    z-index: 20;
  }
  .story p {
    margin: 0.2rem 0;
  }
  .story .god {
    font-size: 1.15rem;
    letter-spacing: 0.02em;
  }
  .story .god.small {
    font-size: 0.95rem;
  }
  .story .sis {
    font-style: italic;
    color: var(--pale-clay);
  }
  .story button {
    position: absolute;
    top: 0.3rem;
    right: 0.3rem;
    background: transparent;
    color: var(--ivory);
    border: none;
  }
  .toast {
    position: absolute;
    top: 5rem;
    right: 1rem;
    background: var(--bronze);
    color: var(--ivory);
    padding: 0.6rem 1rem;
    border-radius: var(--radius);
    max-width: 22rem;
    z-index: 20;
  }
  .error {
    position: absolute;
    top: 1rem;
    left: 50%;
    transform: translateX(-50%);
    background: #7a1f12;
    color: var(--ivory);
    padding: 0.6rem 1rem;
    border-radius: var(--radius);
    max-width: min(92vw, 34rem);
    z-index: 40;
  }
  .error button {
    color: var(--ink);
  }
  .modal-actions {
    display: flex;
    gap: 0.6rem;
    justify-content: flex-end;
  }
  .primary {
    background: var(--clay);
    color: var(--ivory);
  }
</style>
