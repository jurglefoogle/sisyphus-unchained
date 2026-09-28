<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { Game, Notice } from '../app/game';
  import type { GameView } from '../app/view';
  import type { PrestigePreview } from '../core/commands';
  import { formatDuration, formatMoney, formatMultiplier } from '../core/format';
  import { t } from '../content/strings';
  import { World } from '../world/world';
  import { artUrl, iconUrl, storyPortrait, storyPortraitName } from '../world/library';
  import { Sound } from '../app/audio';
  import { buildArchive } from '../app/archive';
  import Archive from './Archive.svelte';
  import Credits from './Credits.svelte';
  import Drawer from './Drawer.svelte';
  import Empire from './Empire.svelte';
  import { GamepadInput, PAD, stepFocus } from './gamepad';
  import Modal from './Modal.svelte';
  import Recovery from './Recovery.svelte';
  import Settings from './Settings.svelte';

  let { game }: { game: Game } = $props();

  let view = $state<GameView>(untrack(() => game.view()));
  let worldHost: HTMLDivElement;
  let drawerToggle: HTMLButtonElement;
  let world = $state.raw<World | null>(null);
  let drawerOpen = $state(false);
  let settingsOpen = $state(false);
  let archiveOpen = $state(false);
  let empireOpen = $state(false);
  let empirePanel = $state<Empire | null>(null);
  let creditsOpen = $state(false);
  let recoveryOpen = $state(untrack(() => !!game.loadProblem));
  let announcement = $state('');
  // Rebuilt with each view refresh so stamps earned while it is open appear.
  const archive = $derived(archiveOpen && view ? buildArchive(game.state) : null);
  let stamp = $state<{ id: string; text: string } | null>(null);
  let stampTimer: ReturnType<typeof setTimeout> | undefined;
  let prestige = $state<PrestigePreview | null>(null);
  let story = $state<Notice | null>(null);
  let recap = $state<Notice | null>(null);
  let toast = $state<string | null>(null);
  let caption = $state<string | null>(null);
  let error = $state<string | null>(null);
  let held = $state(false);
  let width = $state(1200);
  let height = $state(800);
  let hudHeight = $state(80);
  let controlsHeight = $state(150);
  let worldReady = $state(false);
  let options = $state(untrack(() => ({ ...game.state.options })));
  const sound = new Sound();

  const narrow = $derived(width < 760);
  const modalOpen = $derived(settingsOpen || archiveOpen || !!prestige || !!recap || creditsOpen || recoveryOpen);
  const keyLabel = $derived(options.pushKey.replace(/^Key/, '').replace(/^Digit/, ''));
  const drawerWidth = $derived(drawerOpen && !narrow ? Math.max(300, Math.min(420, width * 0.3)) : 0);
  const availableUpgrades = $derived(view.rows.filter((row) => row.affordable && !row.disabled).length);
  const storyQueue: Notice[] = [];
  let storyTimer: ReturnType<typeof setTimeout> | undefined;
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  let captionTimer: ReturnType<typeof setTimeout> | undefined;

  function setHeld(next: boolean) {
    if (next && (view.paused || modalOpen)) return;
    held = next;
    game.setManual(next);
  }

  function toggleEmpire() {
    empireOpen = !empireOpen;
    sound.play(empireOpen ? 'sfx_ui_open' : 'sfx_ui_close', 'interface');
  }

  function openCredits() {
    creditsOpen = true;
    releaseInput();
  }
  function closeCredits() {
    creditsOpen = false;
    game.markSeen('credits');
    // The ending returns to where it began; production never stopped.
    selectSite(view.empire[0]?.id ?? null);
  }

  /** Screen readers: a summarized status on request rather than every coin. */
  function announceStatus() {
    const goal = view.objective;
    announcement = `${view.obols} Obols, ${view.automated ? view.rate : 'manual labor'}. ${view.site.name}, level ${view.site.level}. ${goal}`;
  }

  function toggleDrawer() {
    empireOpen = false;
    drawerOpen = !drawerOpen;
    if (!drawerOpen) drawerToggle?.focus();
    sound.play(drawerOpen ? 'sfx_ui_open' : 'sfx_ui_close', 'interface');
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
    sound.duck(story.firstTime ? 7 : 2.5);
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
      if (n.storyId === 'charter_purchase' && !game.state.discoveries.tutorialIds.includes('credits')) {
        setTimeout(openCredits, n.firstTime ? 7200 : 2600);
      }
    } else if (n.kind === 'recap') {
      recap = n;
      sound.play('sfx_offline_return', 'interface');
    } else if (n.kind === 'relic' && n.relicId) {
      toast = `Relic found: ${t(`relic.${n.relicId}`)} — ${t(`relic.${n.relicId}.joke`)} (income ×1.1)`;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => (toast = null), 6000);
    } else if (n.kind === 'toast' && n.text) {
      toast = n.text;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => (toast = null), 6000);
    } else if (n.kind === 'achievement' && n.achievementIds?.length) {
      const ids = n.achievementIds;
      stamp = {
        id: ids[0],
        text: ids.length === 1 ? `Stamp earned: ${t(`achievement.${ids[0]}`)}` : `${ids.length} stamps recorded in the Archive`,
      };
      clearTimeout(stampTimer);
      stampTimer = setTimeout(() => (stamp = null), 5000);
    } else if (n.kind === 'error' && n.text) {
      error = n.text;
    } else if (n.kind === 'info' && n.text) {
      if (n.storyId === 'ambient' && (story || drawerOpen && narrow)) return;
      caption = n.text;
      clearTimeout(captionTimer);
      clearTimeout(stampTimer);
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
    const el = e.target;
    return el instanceof Element && !el.closest('[data-push]') && !!el.closest('input, textarea, select, button, a, [contenteditable="true"], [role="slider"]');
  }

  function onkeydown(e: KeyboardEvent) {
    if (modalOpen || rebinding) return;
    if (e.key === 'Escape' && empireOpen) {
      e.preventDefault();
      toggleEmpire();
      return;
    }
    if (e.key === 'Escape' && drawerOpen) {
      e.preventDefault();
      toggleDrawer();
      return;
    }
    if (isTyping(e)) return;
    if (e.code === options.pushKey) {
      e.preventDefault();
      if (!e.repeat) pushDown();
    } else if (empireOpen) {
      return;
    } else if (e.key === 'ArrowLeft' && view.site.prevId && !drawerOpen) {
      game.selectSite(view.site.prevId);
      held = false;
    } else if (e.key === 'ArrowRight' && view.site.nextId && !drawerOpen) {
      game.selectSite(view.site.nextId);
      held = false;
    }
  }
  function onkeyup(e: KeyboardEvent) {
    if (e.code === options.pushKey && held) {
      if (!isTyping(e)) e.preventDefault();
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

  // -------------------------------------------------------------- controller

  let padPushing = false;
  let rebinding = $state(false);

  /** The layer that owns focus: dialog, frieze, drawer, or the world. */
  function focusLayer(): HTMLElement | null {
    return (
      document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]') ??
      (empireOpen ? document.querySelector<HTMLElement>('.empire') : null) ??
      (drawerOpen ? document.getElementById('drawer') : null)
    );
  }

  function backOut() {
    if (creditsOpen) closeCredits();
    else if (recoveryOpen) recoveryOpen = false;
    else if (prestige) prestige = null;
    else if (recap) recap = null;
    else if (settingsOpen) settingsOpen = false;
    else if (archiveOpen) archiveOpen = false;
    else if (empireOpen) toggleEmpire();
    else if (drawerOpen) toggleDrawer();
  }

  function onPad(button: number, pressed: boolean) {
    const layer = focusLayer();
    if (button === PAD.A) {
      const el = document.activeElement as HTMLElement | null;
      if (pressed && layer && el && layer.contains(el) && el.matches('button, [href], input, select, textarea')) {
        el.click();
        return;
      }
      if (layer) return;
      if (pressed && !padPushing) {
        padPushing = true;
        pushDown();
      } else if (!pressed && padPushing) {
        padPushing = false;
        pushUp();
      }
      return;
    }
    if (!pressed) return;
    switch (button) {
      case PAD.B:
        backOut();
        break;
      case PAD.Y:
        if (!modalOpen) {
          toggleDrawer();
          if (drawerOpen) requestAnimationFrame(() => stepFocus(document.getElementById('drawer')!, 1));
        }
        break;
      case PAD.X:
        if (!modalOpen) toggleEmpire();
        break;
      case PAD.START:
        if (!modalOpen) game.setPaused(!view.paused);
        break;
      case PAD.BACK:
        if (!modalOpen) settingsOpen = true;
        break;
      case PAD.LB:
      case PAD.RB:
        if (modalOpen) break;
        if (empireOpen) empirePanel?.scrollBy(button === PAD.LB ? -1 : 1);
        else selectSite(button === PAD.LB ? view.site.prevId : view.site.nextId);
        break;
      case PAD.UP:
      case PAD.LEFT:
        if (layer) stepFocus(layer, -1);
        else if (button === PAD.LEFT) selectSite(view.site.prevId);
        break;
      case PAD.DOWN:
      case PAD.RIGHT:
        if (layer) stepFocus(layer, 1);
        else if (button === PAD.RIGHT) selectSite(view.site.nextId);
        break;
    }
  }

  // ------------------------------------------------------------ touch swipes

  let swipe: { x: number; y: number; t: number } | null = null;
  function swipeStart(e: PointerEvent) {
    if (e.pointerType !== 'touch') return;
    swipe = { x: e.clientX, y: e.clientY, t: performance.now() };
  }
  function swipeEnd(e: PointerEvent) {
    if (!swipe || e.pointerType !== 'touch') return;
    const dx = e.clientX - swipe.x;
    const dy = e.clientY - swipe.y;
    const quick = performance.now() - swipe.t < 600;
    swipe = null;
    if (!quick || Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
    releaseInput();
    selectSite(dx < 0 ? view.site.nextId : view.site.prevId);
  }

  let sheetDrag: number | null = null;
  function sheetStart(e: PointerEvent) {
    if (narrow) sheetDrag = e.clientY;
  }
  function sheetEnd(e: PointerEvent) {
    if (sheetDrag !== null && e.clientY - sheetDrag > 60 && drawerOpen) toggleDrawer();
    sheetDrag = null;
  }

  $effect(() => {
    const bottom = controlsHeight + (narrow && drawerOpen ? height * 0.45 : 0);
    world?.setInsets({ top: hudHeight + 12, right: drawerWidth, bottom, left: 0 });
  });

  $effect(() => {
    if (modalOpen || view.paused) releaseInput();
  });

  $effect(() => {
    sound.setVolumes(options);
  });
  $effect(() => {
    sound.followSite(view.site.id);
  });
  $effect(() => {
    sound.setPushing(held && !view.paused);
  });
  $effect(() => {
    sound.setDrawerOpen(drawerOpen || empireOpen);
  });

  $effect(() => {
    document.documentElement.style.setProperty('--text-scale', String(options.textScale));
    document.documentElement.classList.toggle('high-contrast', options.highContrast);
    document.documentElement.classList.toggle('reduced-motion', options.reducedMotion);
  });

  onMount(() => {
    const offView = game.onView((v) => (view = v));
    const offNotice = game.onNotice(onNotice);
    const offEvents = game.onEvents((events) =>
      sound.onEvents(events, game.state.empire.selectedSiteId, game.state.empire.foremanOwned && game.state.prelude.complete),
    );
    // Browsers keep audio locked until the player interacts.
    const unlock = () => sound.unlock();
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    world = new World(game);
    if (import.meta.env.DEV) (window as unknown as { world: World }).world = world;
    world.onPush = (down) => {
      // On phones the world closes the bottom sheet without also pushing.
      if (down && drawerOpen && narrow) {
        toggleDrawer();
        return;
      }
      if (down) pushDown();
      else pushUp();
    };
    const pad = new GamepadInput(onPad);
    pad.start();
    void world.mount(worldHost).then(() => (worldReady = true)).catch(() => {
      error = 'The scene could not start. Please reload the page to try again. Your saved progress is safe.';
    });
    const onVis = () => {
      if (document.hidden) releaseInput();
      sound.setHidden(document.hidden);
    };
    const onHide = () => game.endSession();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', releaseInput);
    window.addEventListener('pagehide', onHide);
    return () => {
      offView();
      offNotice();
      offEvents();
      pad.stop();
      clearTimeout(storyTimer);
      clearTimeout(toastTimer);
      clearTimeout(captionTimer);
      sound.setMusic(null);
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      world?.destroy();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', releaseInput);
      window.removeEventListener('pagehide', onHide);
    };
  });
</script>

<svelte:window {onkeydown} {onkeyup} bind:innerWidth={width} bind:innerHeight={height} />

<main class:narrow style:--drawer-width="{drawerWidth}px" style:--hud-h="{hudHeight}px" style:--controls-h="{controlsHeight}px">
  <div class="playfield" inert={modalOpen}>
  <div class="world" bind:this={worldHost} onpointerdowncapture={swipeStart} onpointerupcapture={swipeEnd} role="presentation"></div>
  {#if !worldReady}<div class="loading" role="status">Preparing the hill…</div>{/if}

  <header class="hud" bind:clientHeight={hudHeight}>
    <div class="hud-left">
      <div class="wallet" aria-live="off">
        <img class="coin" src={iconUrl('ui_obols')} alt="" />
        <div class="wallet-text">
          <span class="obols"><span class="visually-hidden">Obols: </span>{view.obols}<small> Obols</small></span>
          <span class="rate">{view.automated ? view.rate : 'Manual labor'}</span>
        </div>
      </div>
      {#if view.decree?.shown}
        <div class="decree" title="Next decree">
          <span class="decree-label"><img class="icon small" src={iconUrl('ui_decree')} alt="" />{view.decree.ready ? 'Decree ready' : 'Next decree'}</span>
          <span class="decree-name">{view.decree.name}</span>
          <div class="mini-bar" role="progressbar" aria-label="Impertinence toward {view.decree.name}" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(view.decree.progress * 100)}>
            <span style:width="{view.decree.progress * 100}%"></span>
          </div>
        </div>
      {/if}
    </div>
    <div class="chapter">
      <h1>{view.site.name}{#if view.charterSigned}<img class="approved" src={iconUrl('decree_seal')} alt="Approved by Olympus" title="Approved by Olympus" />{/if}</h1>
      {#if view.prelude.active && view.prelude.attempts > 0}
        <div class="record">
          <span>Best height</span>
          <span class="record-track" role="progressbar" aria-label="Best height" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(view.prelude.best * 100)}><span style:width="{view.prelude.best * 100}%"></span></span>
          <strong>{Math.round(view.prelude.best * 100)}%</strong>
        </div>
      {:else}
        <span class="chapter-detail">{view.prelude.active ? 'Every attempt takes you higher' : `Level ${view.site.level}`}</span>
      {/if}
    </div>
    <div class="menu">
      <button class="visually-hidden-focusable" onclick={announceStatus}>Announce status</button>
      {#if view.insight > 0}<span class="insight" title="Existential Insight"><img class="icon small" src={iconUrl('ui_insight')} alt="Insight" /> {view.insight}</span>{/if}
      <button class="round" title={view.paused ? 'Resume' : 'Pause'} onclick={() => game.setPaused(!view.paused)} aria-pressed={view.paused}><img class="icon small" src={iconUrl(view.paused ? 'ui_play' : 'ui_pause')} alt="" /><span class="visually-hidden">{view.paused ? 'Resume' : 'Pause'}</span></button>
      <button class="round" title="Archive" onclick={() => (archiveOpen = true)}><img class="icon small" src={iconUrl('ui_archive')} alt="" /><span class="visually-hidden">Archive</span></button>
      <button class="round" title="Settings" onclick={() => (settingsOpen = true)}><img class="icon small" src={iconUrl('ui_settings')} alt="" /><span class="visually-hidden">Settings</span></button>
    </div>
  </header>

  {#if view.site.ownedCount > 1 || view.decree?.shown}
    <nav class="sites" aria-label="Operations">
      {#if view.site.ownedCount > 1}
        <button onclick={() => selectSite(view.site.prevId)} disabled={!view.site.prevId} aria-label="Previous operation"><img class="icon small" src={iconUrl('ui_back')} alt="" /></button>
        <span>{view.site.name}</span>
        <button onclick={() => selectSite(view.site.nextId)} disabled={!view.site.nextId} aria-label="Next operation"><img class="icon small" src={iconUrl('ui_next')} alt="" /></button>
      {/if}
      <button class="empire-toggle" aria-expanded={empireOpen} onclick={toggleEmpire}>
        <img class="icon small" src={iconUrl('ui_empire')} alt="" />
        <span>{empireOpen ? 'Close' : 'Empire'}</span>
      </button>
    </nav>
  {/if}

  {#if empireOpen}
    <Empire
      bind:this={empirePanel}
      sites={view.empire}
      charterSigned={view.charterSigned}
      onselect={(id) => {
        selectSite(id);
        empireOpen = false;
      }}
      ondecree={() => {
        empireOpen = false;
        drawerOpen = true;
      }}
      onclose={toggleEmpire}
    />
  {/if}

  {#if view.suggestPrestige && !prestige}
    <div class="suggest" role="status">
      <img src={iconUrl('ui_prestige')} alt="" />
      <p><strong>Begin Again is worthwhile.</strong> Claim {view.prestige.award} Insight: income {view.prestige.factorBefore} → {view.prestige.factorAfter}.</p>
      <div class="suggest-actions">
        <button onclick={() => game.markSeen('prestige_prompt')}>Not now</button>
        <button class="primary" onclick={openPrestige}>Review</button>
      </div>
    </div>
  {/if}

  {#if caption && options.ambientCaptions}
    <p class="caption" aria-live="polite">“{caption}”</p>
  {/if}

  {#if view.paused}
    <div class="paused-banner">Paused — production stopped</div>
  {/if}

  <footer class="controls" bind:clientHeight={controlsHeight}>
    <p class="objective" class:goal-ready={view.goal?.affordable} class:pinned={!!view.goal}>
      {#if view.goal}<span class="pin-mark" aria-hidden="true">◆</span>{/if}{view.objective}
      {#if view.objectiveProgress !== null}
        <span class="objective-bar" role="progressbar" aria-label="Goal progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(view.objectiveProgress * 100)}><span style:width="{view.objectiveProgress * 100}%"></span></span>
      {/if}
    </p>
    <div class="control-row">
      <button
        class="push"
        data-push
        class:held
        aria-pressed={held}
        aria-describedby="push-hint"
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
        <img class="icon" src={iconUrl('ui_push')} alt="" />
        <span>{view.automated ? 'Help push' : 'Push'}{options.toggleMode ? (held ? ' (on)' : ' (off)') : ''}</span>
        <kbd aria-hidden="true">{keyLabel}</kbd>
      </button>
      <button class="drawer-toggle" bind:this={drawerToggle} aria-expanded={drawerOpen} aria-controls="drawer" onclick={toggleDrawer}>
        <img class="icon" src={iconUrl(drawerOpen ? 'ui_close' : 'ui_empire')} alt="" />
        {drawerOpen ? 'Close' : 'Improve'}
        {#if !drawerOpen && availableUpgrades > 0}<span class="purchase-count" aria-label="{availableUpgrades} affordable improvements">{availableUpgrades}</span>{/if}
      </button>
    </div>
    <p id="push-hint" class="control-hint" class:quiet={view.prelude.attempts > 0 || !view.prelude.active}>{options.toggleMode ? `Tap Push or press ${keyLabel} to start and stop` : `Hold Push or ${keyLabel} to climb · release to rest`}</p>
  </footer>

  <aside id="drawer" class="drawer" class:open={drawerOpen} aria-label="Purchases" inert={!drawerOpen}>
    <div class="drawer-heading" onpointerdown={sheetStart} onpointerup={sheetEnd} role="presentation"><span class="eyebrow">Make the next attempt count</span><button onclick={toggleDrawer} aria-label="Close improvements">✕</button></div>
    <Drawer {game} {view} onprestige={openPrestige} />
  </aside>

  {#if story}
    {@const id = story.storyId}
    <div class="story" class:compact={!story.firstTime} role="status" aria-live="polite">
      <img class="portrait" src={storyPortrait(id!)} alt={storyPortraitName(id!)} />
      <div>
      {#if story.firstTime}
        <p class="god">{t(`story.${id}.god`)}</p>
        <p class="sis">— {t(`story.${id}.sis`)}</p>
      {:else}
        <p class="god small">{t(`story.${id}.god`)}</p>
      {/if}
      </div>
      <button onclick={dismissStory} aria-label="Dismiss">✕</button>
    </div>
  {/if}

  {#if toast}
    <div class="toast" role="status">{toast}</div>
  {/if}

  {#if stamp}
    <div class="stamp-toast" role="status">
      <button onclick={() => ((archiveOpen = true), (stamp = null))}>
        <img src={iconUrl(`achievement_${stamp.id}`)} alt="" />
        <span>{stamp.text}</span>
      </button>
    </div>
  {/if}

  {#if error}
    <div class="error" role="alert">
      <p>{error}</p>
      <button onclick={() => (error = null)}>OK</button>
    </div>
  {/if}
  </div>

  {#if recap?.recap}
    {@const r = recap.recap}
    <Modal title="While you were away" onclose={() => (recap = null)}>
      <img class="modal-art icon-art" src={iconUrl('ui_offline')} alt="" />
      <p>Time counted: <strong>{formatDuration(r.countedSeconds)}</strong>{#if r.requestedSeconds > r.countedSeconds} (limit reached; {formatDuration(r.requestedSeconds)} away){/if}</p>
      <p>Earned: <strong>{formatMoney(r.earned)} Obols</strong> — already in your purse.</p>
      {#each r.relicIds as id (id)}<p>Relic found: <strong>{t(`relic.${id}`)}</strong></p>{/each}
      {#each r.decreeSiteIds as id (id)}<p>Decree ready: <strong>{t(`site.${id}`)}</strong></p>{/each}
      <button onclick={() => (recap = null)}>Back to work</button>
    </Modal>
  {/if}

  {#if prestige}
    <Modal title="Begin Again" onclose={() => (prestige = null)}>
      <img class="modal-art" src={artUrl('portrait_thanatos')} alt="Thanatos" />
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

  {#if archive}
    <Archive {archive} onclose={() => (archiveOpen = false)} />
  {/if}

  {#if settingsOpen}
    <Settings {game} bind:options bind:rebinding onclose={() => (settingsOpen = false)} oncredits={view.charterSigned || game.state.discoveries.tutorialIds.includes('credits') ? () => ((settingsOpen = false), openCredits()) : undefined} />
  {/if}

  {#if creditsOpen}
    <Credits onclose={closeCredits} />
  {/if}

  {#if recoveryOpen}
    <Recovery {game} onclose={() => ((recoveryOpen = false), (options = { ...game.state.options }))} />
  {/if}

  <p class="visually-hidden" aria-live="polite">{announcement}</p>
</main>

<style>
  main {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--ink);
  }
  .playfield { position: absolute; inset: 0; }
  .loading { position: absolute; inset: 0; display: grid; place-items: center; background: var(--parchment); z-index: 4; font-style: italic; letter-spacing: 0.04em; }
  .world { position: absolute; inset: 0; }

  /* ---------------------------------------------------------------- HUD */
  .hud {
    position: absolute;
    top: 0;
    left: 0;
    right: var(--drawer-width);
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: start;
    gap: 1rem;
    padding: max(0.75rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) 0.5rem max(1rem, env(safe-area-inset-left));
    pointer-events: none;
    transition: right 0.2s ease;
  }
  .hud-left > *, .menu > *, .chapter { pointer-events: auto; }
  .hud-left { display: flex; gap: 0.6rem; align-items: stretch; min-width: 0; flex-wrap: wrap; }
  .wallet, .decree {
    background: var(--panel);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
  }
  .wallet {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.4rem 0.9rem 0.4rem 0.5rem;
  }
  .coin { width: 2.3rem; height: 2.3rem; flex: none; }
  .wallet-text { display: flex; flex-direction: column; line-height: 1.1; }
  .obols {
    font-family: var(--display);
    font-size: 1.65rem;
    font-weight: 600;
    font-variant-numeric: lining-nums tabular-nums;
    letter-spacing: 0.01em;
  }
  .obols small { margin-left: 0.3em; font-family: var(--body); font-size: 0.7rem; font-weight: 400; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
  .rate { font-size: 0.8rem; font-style: italic; color: var(--muted); }
  .decree {
    display: grid;
    align-content: center;
    gap: 0.1rem;
    padding: 0.35rem 0.8rem;
    min-width: 11rem;
    max-width: 16rem;
    font-size: 0.85rem;
  }
  .decree-label { font-size: 0.66rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); display: flex; align-items: center; gap: 0.3rem; }
  .decree-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mini-bar { height: 4px; background: rgba(33, 27, 23, 0.14); border-radius: 2px; overflow: hidden; margin-top: 2px; }
  .mini-bar span { display: block; height: 100%; background: var(--bronze); }

  .chapter {
    grid-column: 2;
    text-align: center;
    padding: 0.1rem 0.5rem 0;
    color: var(--ink);
    text-shadow: 0 0 12px rgba(246, 236, 220, 0.9), 0 0 2px rgba(246, 236, 220, 0.9);
  }
  .chapter h1 {
    font-family: var(--display);
    font-weight: 600;
    font-size: clamp(1.35rem, 2.4vw, 2.1rem);
    letter-spacing: 0.06em;
    margin: 0;
    line-height: 1.05;
  }
  .chapter h1::before,
  .chapter h1::after {
    content: '';
    display: inline-block;
    width: 1.6em;
    height: 1px;
    background: currentColor;
    opacity: 0.45;
    vertical-align: middle;
    margin: 0 0.6em;
  }
  .chapter-detail { display: block; font-size: 0.8rem; font-style: italic; color: var(--muted); margin-top: 0.15rem; }
  .record { display: inline-flex; gap: 0.5rem; align-items: center; margin-top: 0.3rem; font-size: 0.7rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
  .record strong { font-family: var(--display); font-size: 1.05rem; letter-spacing: 0; color: var(--ink); font-variant-numeric: tabular-nums; }
  .record-track { width: 96px; height: 5px; background: rgba(33, 27, 23, 0.16); border-radius: 3px; overflow: hidden; }
  .record-track span { display: block; height: 100%; background: var(--clay); transition: width 0.4s ease; }

  .menu {
    grid-column: 3;
    justify-self: end;
    display: flex;
    gap: 0.45rem;
    align-items: center;
  }
  .round {
    width: 44px;
    height: 44px;
    padding: 0;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--panel);
    border: 1px solid var(--rule);
    box-shadow: var(--shadow);
  }
  .round .icon { margin: 0; width: 22px; height: 22px; }
  .insight {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    height: 44px;
    padding: 0 0.8rem;
    background: var(--panel);
    border: 1px solid var(--rule);
    border-radius: 22px;
    font-family: var(--display);
    font-weight: 600;
    font-size: 1.1rem;
  }
  .icon { width: 1.5em; height: 1.5em; vertical-align: -0.35em; }
  .icon.small { width: 1.15em; height: 1.15em; vertical-align: -0.2em; }

  .sites {
    position: absolute;
    top: calc(var(--hud-h) + 0.2rem);
    left: calc((100% - var(--drawer-width)) / 2);
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--panel);
    border: 1px solid var(--rule);
    border-radius: 999px;
    box-shadow: var(--shadow);
    padding: 0.15rem;
    font-family: var(--display);
    font-weight: 600;
  }
  .sites button { border: 0; background: transparent; border-radius: 50%; padding: 0; }
  .sites button .icon { margin: 0; }
  .caption {
    position: absolute;
    bottom: calc(var(--controls-h) + 0.75rem);
    left: calc((100% - var(--drawer-width)) / 2);
    transform: translateX(-50%);
    max-width: min(90vw, 36rem);
    margin: 0;
    font-style: italic;
    background: rgba(33, 27, 23, 0.72);
    color: var(--parchment);
    padding: 0.35rem 0.9rem;
    border-radius: 999px;
    text-align: center;
    font-size: 0.9rem;
  }
  .paused-banner {
    position: absolute;
    top: 45%;
    left: calc((100% - var(--drawer-width)) / 2);
    transform: translate(-50%, -50%);
    background: var(--ink);
    color: var(--ivory);
    padding: 0.6rem 1.4rem;
    border-radius: 999px;
    border: 1px solid var(--bronze);
    font-size: 1.1rem;
    letter-spacing: 0.04em;
  }

  .sites .empire-toggle {
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0 0.8rem 0 0.6rem;
    border-left: 1px solid var(--rule);
  }
  .sites .empire-toggle[aria-expanded='true'] { background: var(--ink); color: var(--ivory); }
  .sites .empire-toggle[aria-expanded='true'] .icon { filter: invert(1); }
  .approved {
    width: 1.3em;
    height: 1.3em;
    margin-left: 0.3em;
    vertical-align: -0.2em;
    transform: rotate(-12deg);
  }
  .suggest {
    position: absolute;
    top: calc(var(--hud-h) + 3.6rem);
    right: calc(var(--drawer-width) + 0.75rem);
    z-index: 6;
    display: flex;
    align-items: center;
    gap: 0.7rem;
    max-width: min(92vw, 26rem);
    padding: 0.6rem 0.8rem;
    background: var(--paper);
    border: 1px solid var(--ink);
    border-left: 4px solid #6b4f8a;
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    font-size: 0.9rem;
    flex-wrap: wrap;
  }
  .suggest img { width: 32px; height: 32px; flex: none; }
  .suggest p { margin: 0; flex: 1 1 12rem; line-height: 1.35; }
  .suggest-actions { display: flex; gap: 0.4rem; margin-left: auto; }
  .suggest .primary { background: var(--clay); color: var(--ivory); }
  .objective.pinned { border-color: var(--clay); }
  .objective.goal-ready { background: #fff4dc; box-shadow: 0 0 0 2px var(--bronze), var(--shadow); }
  .pin-mark { color: var(--clay); margin-right: 0.45em; font-size: 0.8em; }
  .objective-bar {
    display: block;
    height: 4px;
    margin: 0.3rem auto 0.05rem;
    width: min(100%, 18rem);
    background: rgba(33, 27, 23, 0.14);
    border-radius: 2px;
    overflow: hidden;
  }
  .objective-bar span { display: block; height: 100%; background: var(--clay); transition: width 0.4s ease; }
  .narrow .suggest { top: auto; bottom: calc(var(--controls-h) + 0.6rem); right: 50%; transform: translateX(50%); }

  /* ----------------------------------------------------------- controls */
  .controls {
    position: absolute;
    left: 0;
    right: var(--drawer-width);
    bottom: 0;
    padding: 0.6rem 0.75rem max(0.8rem, env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    pointer-events: none;
    transition: right 0.2s ease;
  }
  .controls > * { pointer-events: auto; }
  .objective {
    margin: 0;
    background: var(--panel);
    border: 1px solid var(--rule);
    border-radius: 999px;
    padding: 0.45rem 1.2rem;
    max-width: min(94vw, 44rem);
    text-align: center;
    font-size: 0.92rem;
    line-height: 1.35;
    box-shadow: var(--shadow);
  }
  .control-hint {
    margin: -0.1rem 0 0;
    padding: 0.15rem 0.7rem;
    border-radius: 999px;
    background: rgba(33, 27, 23, 0.6);
    color: var(--parchment);
    font-size: 0.72rem;
    letter-spacing: 0.04em;
    text-align: center;
  }
  .control-hint.quiet {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .purchase-count {
    display: inline-grid;
    place-items: center;
    background: var(--clay);
    color: var(--ivory);
    border-radius: 999px;
    min-width: 1.45em;
    height: 1.45em;
    padding: 0 0.3em;
    font-size: 0.78rem;
    font-weight: 700;
    margin-left: 0.15rem;
  }
  .control-row { display: flex; gap: 0.6rem; align-items: center; }
  .push,
  .drawer-toggle {
    min-height: 56px;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-size: 1.1rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    box-shadow: var(--shadow);
  }
  .push {
    min-width: 12rem;
    padding: 0 1.2rem 0 1rem;
    background: linear-gradient(#b0552e, var(--clay));
    color: var(--ivory);
    border: 1.5px solid var(--ink);
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }
  .push .icon { margin: 0; filter: invert(94%) sepia(8%) saturate(400%) hue-rotate(340deg); }
  .push kbd {
    font: inherit;
    font-size: 0.64rem;
    font-weight: 400;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 0.1rem 0.4rem;
    border: 1px solid rgba(246, 236, 220, 0.5);
    border-radius: 4px;
    opacity: 0.85;
  }
  @media (pointer: coarse) {
    .push kbd { display: none; }
  }
  .push.held { background: var(--ink); }
  .push.held .icon { animation: nudge 0.6s ease-in-out infinite alternate; }
  @keyframes nudge {
    to { transform: translateX(3px); }
  }
  .drawer-toggle {
    min-width: 8rem;
    padding: 0 1.1rem 0 0.9rem;
    background: var(--panel);
    border: 1.5px solid var(--ink);
  }
  .drawer-toggle .icon { margin: 0; }

  /* ------------------------------------------------------------- drawer */
  .drawer {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(420px, 30vw);
    min-width: 300px;
    background: var(--paper);
    border-left: 1px solid var(--rule);
    overflow-y: auto;
    transform: translateX(100%);
    transition: transform 0.2s ease;
    z-index: 10;
    box-shadow: -12px 0 40px rgba(33, 27, 23, 0.22);
  }
  .drawer-heading { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; padding: 0.3rem 0.4rem 0.3rem 1rem; position: sticky; top: 0; z-index: 1; background: var(--ink); color: var(--parchment); }
  .eyebrow { font-size: 0.68rem; letter-spacing: 0.16em; text-transform: uppercase; }
  .drawer-heading button { border: 0; background: transparent; color: var(--parchment); }
  .drawer.open { transform: none; }

  /* ------------------------------------------------------------- narrow */
  .narrow .drawer {
    top: auto;
    left: 0;
    width: 100%;
    min-width: 0;
    height: 45vh;
    border-left: none;
    border-top: 1px solid var(--rule);
    border-radius: 16px 16px 0 0;
    transform: translateY(100%);
  }
  .narrow .drawer.open { transform: none; }
  .narrow:has(.drawer.open) .controls { bottom: 45vh; }
  .narrow .hud { grid-template-columns: 1fr auto; gap: 0.4rem; padding-left: 0.6rem; padding-right: 0.6rem; }
  .narrow .chapter { grid-column: 1 / -1; grid-row: 2; padding: 0; }
  .narrow .chapter h1 { font-size: 1.1rem; }
  .narrow .chapter h1::before,
  .narrow .chapter h1::after { width: 0.8em; }
  .narrow .chapter-detail { display: none; }
  .narrow .menu { grid-column: 2; gap: 0.3rem; }
  .narrow .round { width: 40px; height: 40px; min-width: 40px; min-height: 40px; }
  .narrow .wallet { padding: 0.25rem 0.6rem 0.25rem 0.35rem; }
  .narrow .coin { width: 1.8rem; height: 1.8rem; }
  .narrow .obols { font-size: 1.25rem; }
  .narrow .decree { min-width: 0; flex: 1; }
  .narrow .controls { gap: 0.35rem; }
  .narrow .objective { font-size: 0.82rem; padding: 0.35rem 0.9rem; border-radius: 14px; }
  .narrow .push { min-width: 9.5rem; }
  .narrow .push kbd { display: none; }
  .narrow .drawer-toggle { min-width: 0; }
  .narrow .story { top: calc(var(--hud-h) + 0.3rem); width: 92%; }
  .narrow .story .portrait { width: 48px; height: 48px; }
  .narrow .story .god { font-size: 0.95rem; }
  @media (max-height: 560px) {
    .chapter-detail,
    .record > span:first-child { display: none; }
    .hud { padding-top: 0.35rem; padding-bottom: 0.2rem; }
    .controls { padding-top: 0.3rem; padding-bottom: 0.35rem; gap: 0.3rem; }
    .objective { padding: 0.25rem 0.8rem; font-size: 0.8rem; }
    .push,
    .drawer-toggle { min-height: 46px; }
  }
  .story {
    position: absolute;
    top: calc(var(--hud-h) + 0.5rem);
    left: 50%;
    transform: translateX(-50%);
    background: var(--ink);
    color: var(--ivory);
    padding: 0.8rem 3rem 0.8rem 1.2rem;
    border-radius: var(--radius);
    max-width: min(92vw, 34rem);
    z-index: 20;
  }
  .story {
    display: flex;
    gap: 0.9rem;
    align-items: center;
  }
  .story .portrait {
    width: 76px;
    height: 76px;
    flex: none;
    object-fit: cover;
    object-position: 50% 30%;
    border-radius: 50%;
    background: var(--parchment);
    border: 2px solid var(--pale-clay);
  }
  .story.compact .portrait {
    width: 48px;
    height: 48px;
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
    top: calc(var(--hud-h) + 0.5rem);
    right: 1rem;
    background: var(--ink);
    border: 1px solid var(--bronze);
    color: var(--ivory);
    padding: 0.6rem 1rem;
    border-radius: var(--radius);
    max-width: 22rem;
    z-index: 20;
  }
  .stamp-toast {
    position: absolute;
    top: calc(var(--hud-h) + 5rem);
    right: 1rem;
    z-index: 21;
  }
  .stamp-toast button {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    background: var(--ivory);
    color: var(--ink);
    border: 2px solid var(--bronze);
    padding: 0.4rem 0.9rem 0.4rem 0.4rem;
    border-radius: var(--radius);
    max-width: 22rem;
    text-align: left;
  }
  .stamp-toast img {
    width: 48px;
    height: 48px;
    flex: none;
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
  .modal-art {
    display: block;
    width: 96px;
    height: 96px;
    margin: 0 auto 0.4rem;
    object-fit: contain;
  }
  .modal-art.icon-art {
    width: 64px;
    height: 64px;
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
