<script lang="ts">
  import { deviceDef, isDevice } from '../content/devices';
  import { onMount, untrack } from 'svelte';
  import { fly } from 'svelte/transition';
  import { backOut as overshoot, cubicOut } from 'svelte/easing';
  import type { Game, Notice } from '../app/game';
  import { recapMachineLines, type GameView } from '../app/view';
  import type { PrestigePreview } from '../core/commands';
  import { insightFactor } from '../core/formulas';
  import { formatDuration, formatMoney, formatMultiplier } from '../core/format';
  import { t } from '../content/strings';
  import { priced } from '../content/currency';
  import { World } from '../world/world';
  import { CoinFlight } from './coinFlight';
  import { artUrl, iconUrl, storyPortrait, storyPortraitName } from '../world/library';
  import { Sound } from '../app/audio';
  import { buildArchive } from '../app/archive';
  import Archive from './Archive.svelte';
  import Credits from './Credits.svelte';
  import Cutscene from './Cutscene.svelte';
  import { SCENE_FOR_STORY, sceneById, sceneSeenId, type Scene, type SceneFx } from '../content/scenes';
  import Scroll from './Scroll.svelte';
  import { KEY_H, KEY_W, STONE_TILE, stone } from './stone';
  import { papyrus, TILE } from './papyrus';
  import Empire from './Empire.svelte';
  import { GamepadInput, PAD, stepFocus } from './gamepad';
  import Modal from './Modal.svelte';
  import Insight from './Insight.svelte';
  import Recovery from './Recovery.svelte';
  import Settings from './Settings.svelte';
  import StartScreen from './StartScreen.svelte';
  import PauseScreen from './PauseScreen.svelte';

  let { game }: { game: Game } = $props();

  let view = $state<GameView>(untrack(() => game.view()));
  let worldHost: HTMLDivElement;
  const rock = stone();
  const slip = papyrus().tag;
  let pushButton: HTMLButtonElement;
  let world = $state.raw<World | null>(null);
  let drawerOpen = $state(false);
  let settingsOpen = $state(false);
  let archiveOpen = $state(false);
  let insightOpen = $state(false);
  let empireOpen = $state(false);
  let empirePanel = $state<Empire | null>(null);
  let creditsOpen = $state(false);
  let scene = $state<Scene | null>(null);
  let afterScene: (() => void) | null = null;
  let recoveryOpen = $state(untrack(() => !!game.loadProblem));
  let announcement = $state('');
  // Rebuilt with each view refresh so stamps earned while it is open appear.
  const archive = $derived(archiveOpen && view ? buildArchive(game.state) : null);
  let stamp = $state<{ id: string; text: string } | null>(null);
  let stampTimer: ReturnType<typeof setTimeout> | undefined;
  let prestige = $state<PrestigePreview | null>(null);
  let appealOpen = $state(false);
  let prestigeMemory = $state<{ award: number; factor: string; relics: number; upgrades: string[]; conveniences: string[] } | null>(null);
  let story = $state<Notice | null>(null);
  let recap = $state<Notice | null>(null);
  let toast = $state<string | null>(null);
  /** A tablet just opened: what it is, what it does, and what it thinks of you. */
  let reveal = $state<{ name: string; rule: string; quip: string; firstTime: boolean } | null>(null);
  let revealTimer: ReturnType<typeof setTimeout> | undefined;
  let caption = $state<string | null>(null);
  let captionSpeaker = $state<string | null>(null);
  let error = $state<string | null>(null);
  let held = $state(false);
  let width = $state(1200);
  let height = $state(800);
  let hudHeight = $state(80);
  let controlsHeight = $state(150);
  let worldReady = $state(false);
  let startOpen = $state(true);
  let openingHandoff = $state(false);
  let purseCoin: HTMLElement | undefined = $state();
  let purseCount: HTMLSpanElement | undefined = $state();
  /** Panels slide in and out; reduced motion places them at once. */
  const enter = (x: number, y: number, duration = 320) => ({ x, y, duration: options.reducedMotion ? 0 : duration, easing: overshoot, opacity: 0 });
  const leave = (x: number, y: number) => ({ x, y, duration: options.reducedMotion ? 0 : 180, easing: cubicOut, opacity: 0 });
  let options = $state(untrack(() => ({ ...game.state.options })));
  const sound = new Sound();

  const narrow = $derived(width < 760);
  const modalOpen = $derived(startOpen || settingsOpen || archiveOpen || insightOpen || !!prestige || appealOpen || !!prestigeMemory || !!recap || creditsOpen || recoveryOpen || !!scene);
  const hasProgress = $derived(
    game.state.prelude.attempts > 0 ||
      game.state.prelude.complete ||
      game.state.counters.totalRuns > 0 ||
      game.state.empire.sites.length > 1 ||
      game.state.discoveries.seenStoryIds.length > 0 ||
      game.state.discoveries.tutorialIds.length > 0,
  );
  const keyLabel = $derived(options.pushKey.replace(/^Key/, '').replace(/^Digit/, ''));
  /** Improve is an overlay, so opening it never recenters the hill or moves the player's target. */
  const scrollWidth = $derived(Math.round(Math.max(320, Math.min(400, width * 0.29))));
  /** Short landscape screens hang the open sheet to the floor: the dock and captions step left of it (its width, margin and rod). */
  const drawerWidth = $derived(drawerOpen && compact && !narrow ? scrollWidth + 48 : 0);
  /** Phones (narrow, or short in landscape) give the sheet everything below the header, over the dock. */
  const compact = $derived(narrow || height < 560);
  const sheetHeight = $derived(
    compact
      ? Math.max(200, Math.round(height - hudHeight - 28))
      : Math.max(260, Math.round(Math.min(height * 0.72, height - hudHeight - controlsHeight - 28))),
  );
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
    if (empireOpen) drawerOpen = false;
    sound.play(empireOpen ? 'sfx_ui_open' : 'sfx_ui_close', 'interface');
  }

  function openCredits() {
    creditsOpen = true;
    releaseInput();
  }

  function enterGame() {
    startOpen = false;
    if (recap) sound.play('sfx_offline_return', 'interface');
    requestAnimationFrame(() => {
      if (!introDue()) pushButton?.focus();
    });
  }

  async function beginNewGame() {
    await game.resetSave();
    view = game.view();
    startOpen = false;
  }
  const seen = (id: string) => game.state.discoveries.tutorialIds.includes(id);

  /** Play a cutscene over the running game, then run `then` (e.g. the credits). */
  function playScene(id: string, then?: () => void) {
    const next = sceneById(id);
    if (!next) return then?.();
    releaseInput();
    story = null;
    afterScene = then ?? null;
    scene = next;
    game.telemetry.record(game.state, 'scene_start', { detail: id });
    sound.duck(3600);
  }
  function closeScene(reason: 'complete' | 'skip' = 'skip', beat = 0) {
    if (!scene) return;
    const id = scene.id;
    game.markSeen(sceneSeenId(id));
    game.telemetry.record(game.state, reason === 'complete' ? 'scene_complete' : 'scene_skip', { detail: `${id}:${beat + 1}` });
    scene = null;
    sound.duck(0.2);
    const then = afterScene;
    afterScene = null;
    if (then) then();
    else showStory();
    if (id === 'sentence' && game.state.prelude.attempts === 0) {
      openingHandoff = true;
      requestAnimationFrame(() => pushButton?.focus());
    }
  }
  function sceneFx(fx: SceneFx) {
    if (fx === 'bolt') sound.play('sfx_decree');
    else if (fx === 'seal') sound.play('sfx_charter');
    else if (fx === 'thud') sound.play('sfx_impact_pottery');
  }
  /** A brand-new game opens on the sentencing. */
  function introDue(): boolean {
    const s = game.state;
    return !seen(sceneSeenId('sentence')) && s.prelude.attempts === 0 && !s.prelude.complete && s.counters.totalRuns === 0;
  }

  function closeCredits(reason: 'complete' | 'skip' = 'skip') {
    game.telemetry.record(game.state, reason === 'complete' ? 'credits_complete' : 'credits_skip');
    creditsOpen = false;
    game.markSeen('credits');
    // The ending returns to where it began; production never stopped.
    selectSite(view.empire[0]?.id ?? null);
  }

  /** Screen readers: a summarized status on request rather than every coin. */
  function announceStatus() {
    const goal = view.objective;
    announcement = `${view.purse.amount} ${view.purse.name}, ${view.automated ? view.rate : 'manual labor'}. ${view.site.name}, level ${view.site.level}. ${goal}`;
  }

  function toggleDrawer() {
    empireOpen = false;
    drawerOpen = !drawerOpen;
    // Focus returns to the roll, which is what opens the scroll again.
    if (!drawerOpen) requestAnimationFrame(() => document.querySelector<HTMLElement>('button[aria-controls="drawer"]')?.focus());
    sound.play(drawerOpen ? 'sfx_ui_open' : 'sfx_ui_close', 'interface');
  }

  function pushDown() {
    openingHandoff = false;
    if (options.toggleMode) setHeld(!held);
    else setHeld(true);
  }
  function pushUp() {
    if (!options.toggleMode) setHeld(false);
  }

  function showStory() {
    if (story || scene || !storyQueue.length) return;
    story = storyQueue.shift()!;
    // A repeat is shorter, but leaves time to read Sisyphus's comeback.
    const hold = story.firstTime ? 7 : story.sis ? 5 : 2.5;
    sound.duck(hold);
    clearTimeout(storyTimer);
    storyTimer = setTimeout(dismissStory, hold * 1000);
  }
  function dismissStory() {
    story = null;
    showStory();
  }

  function onNotice(n: Notice) {
    if (n.kind === 'story' && n.storyId) {
      const sceneId = SCENE_FOR_STORY[n.storyId];
      const creditsDue = n.storyId === 'charter_purchase' && !seen('credits');
      // A first viewing of a big moment gets the full scene instead of the banner.
      if (sceneId && n.firstTime && !seen(sceneSeenId(sceneId))) {
        playScene(sceneId, creditsDue ? openCredits : undefined);
        return;
      }
      storyQueue.push(n);
      showStory();
      if (creditsDue) setTimeout(openCredits, n.firstTime ? 7200 : 2600);
    } else if (n.kind === 'recap') {
      recap = n;
      // Held until the player is past the title; the chime comes with it.
      if (!startOpen) sound.play('sfx_offline_return', 'interface');
    } else if (n.kind === 'relic' && n.relicId) {
      toast = `Relic found: ${t(`relic.${n.relicId}`)} — ${t(`relic.${n.relicId}.joke`)} (income ×1.1)`;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => (toast = null), 6000);
    } else if (n.kind === 'reveal' && n.deviceId && isDevice(n.deviceId)) {
      const d = deviceDef(n.deviceId);
      reveal = { name: d.name, rule: d.rule, quip: d.quip, firstTime: !!n.firstTime };
      clearTimeout(revealTimer);
      revealTimer = setTimeout(() => (reveal = null), 9000);
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
      if (n.storyId === 'ambient' && (story || scene || drawerOpen && narrow)) return;
      caption = n.text;
      captionSpeaker = n.speaker ?? null;
      clearTimeout(captionTimer);
      clearTimeout(stampTimer);
      captionTimer = setTimeout(() => (caption = null), 8000);
    }
  }

  function openPrestige(kind?: 'appeal') {
    if (kind === 'appeal') {
      appealOpen = true;
      return;
    }
    prestige = game.previewPrestige();
  }
  function closePrestige() {
    if (prestige) game.telemetry.record(game.state, 'prestige_dismiss', { detail: prestige.award });
    prestige = null;
  }
  async function confirmPrestige() {
    const before = game.state.prestige.lifetimeInsightAwarded;
    const r = await game.confirmPrestige();
    prestige = null;
    held = false;
    if (!r.ok) {
      error = 'Begin Again is not available right now.';
      return;
    }
    const upgrades = game.state.prestige.permanentUpgradeIds.map((id) => t(`upgrade.${id}`));
    const conveniences: string[] = [];
    if (game.state.empire.foremanOwned) conveniences.push('The Foreman begins this run already hired.');
    if (game.state.empire.sites[0]?.wheelOwned) conveniences.push('The First Hill begins with its flywheel installed.');
    if (game.state.empire.sites[0]?.wheelCharged) conveniences.push('Starting flywheels begin charged.');
    prestigeMemory = {
      award: game.state.prestige.lifetimeInsightAwarded - before,
      factor: formatMultiplier(insightFactor(game.state.prestige.lifetimeInsightAwarded)),
      relics: game.state.discoveries.relicIds.length,
      upgrades,
      conveniences,
    };
  }

  function recapImprove() {
    game.telemetry.record(game.state, 'offline_recap_action', { detail: 'improve' });
    recap = null;
    drawerOpen = true;
  }
  function recapEmpire() {
    game.telemetry.record(game.state, 'offline_recap_action', { detail: 'empire' });
    recap = null;
    empireOpen = true;
  }
  function recapArchive() {
    game.telemetry.record(game.state, 'offline_recap_action', { detail: 'archive' });
    recap = null;
    archiveOpen = true;
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
      selectSite(view.site.prevId);
    } else if (e.key === 'ArrowRight' && view.site.nextId && !drawerOpen) {
      selectSite(view.site.nextId);
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

  /** A chapter card sweeps over the world while the hill changes beneath it. */
  let wipe = $state<{ name: string; chapter: number; phase: 'in' | 'out' } | null>(null);
  let wipeTimer: ReturnType<typeof setTimeout> | undefined;

  function selectSite(id: string | null) {
    if (!id) return;
    held = false;
    const site = view.empire.find((s) => s.id === id);
    if (options.reducedMotion || !site || id === view.site.id || wipe) {
      game.selectSite(id);
      return;
    }
    wipe = { name: site.name, chapter: site.chapter, phase: 'in' };
    clearTimeout(wipeTimer);
    wipeTimer = setTimeout(() => {
      game.selectSite(id);
      wipe = wipe && { ...wipe, phase: 'out' };
      wipeTimer = setTimeout(() => (wipe = null), 520);
    }, 420);
  }

  // -------------------------------------------------------------- controller

  let padPushing = false;
  let rebinding = $state(false);

  /** The layer that owns focus: dialog, frieze, drawer, or the world. */
  function focusLayer(): HTMLElement | null {
    const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]');
    return (
      dialogs.item(dialogs.length - 1) ??
      (view.paused ? document.querySelector<HTMLElement>('.pause-screen') : null) ??
      (empireOpen ? document.querySelector<HTMLElement>('.empire') : null) ??
      (drawerOpen ? document.getElementById('drawer') : null)
    );
  }

  function backOut() {
    if (scene) closeScene();
    else if (creditsOpen) closeCredits();
    else if (recoveryOpen) recoveryOpen = false;
    else if (prestige) prestige = null;
    else if (appealOpen) appealOpen = false;
    else if (recap) recap = null;
    else if (settingsOpen) settingsOpen = false;
    else if (archiveOpen) archiveOpen = false;
    else if (insightOpen) insightOpen = false;
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

  $effect(() => {
    world?.setInsets({ top: hudHeight + 12, right: 0, bottom: controlsHeight + 18, left: 0 });
  });

  $effect(() => {
    if (modalOpen || view.paused) releaseInput();
  });

  $effect(() => {
    void view;
    if (worldReady && !startOpen && !scene && !recoveryOpen && untrack(introDue)) playScene('sentence');
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
    const coins = new CoinFlight(iconUrl('ui_obols'), () => purseCoin ?? null, () => purseCount ?? null, () => sound.tink());
    world.onPayout = (x, y, grand) => coins.launch(x, y, grand);
    world.onChisel = (weight) => sound.chisel(weight);
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
      if (document.hidden) {
        releaseInput();
        // Mobile browsers may discard a hidden tab without a pagehide.
        void game.save();
      }
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
      clearTimeout(wipeTimer);
      sound.setMusic(null);
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      world?.destroy();
      coins.destroy();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', releaseInput);
      window.removeEventListener('pagehide', onHide);
    };
  });
</script>

<svelte:window {onkeydown} {onkeyup} bind:innerWidth={width} bind:innerHeight={height} />

<main class:narrow style:--drawer-width="{drawerWidth}px" style:--scroll-w="{scrollWidth}px" style:--hud-h="{hudHeight}px" style:--controls-h="{controlsHeight}px" style:--limestone="url({rock.limestone})" style:--basalt="url({rock.basalt})" style:--key="url({rock.key})" style:--stone-tile="{STONE_TILE}px" style:--key-w="{KEY_W}px" style:--key-h="{KEY_H}px" style:--slip="url({slip})" style:--tile="{TILE}px">
  <div class="playfield" inert={modalOpen || view.paused}>
  <div class="world" bind:this={worldHost} onpointerdowncapture={swipeStart} onpointerupcapture={swipeEnd} role="presentation"></div>
  {#if !worldReady}<div class="loading" role="status">Preparing the hill…</div>{/if}

  <header class="hud" bind:clientHeight={hudHeight}>
    <div class="hud-left">
      <div class="wallet" aria-live="off">
        {#if view.purse.currency === 'obols'}
          <img class="coin" src={iconUrl('ui_obols')} alt="" bind:this={purseCoin} />
        {:else}
          <span class="coin glyph-coin" aria-hidden="true" title={view.purse.name} bind:this={purseCoin}>{view.purse.glyph}</span>
        {/if}
        <div class="wallet-text">
          <span class="obols" bind:this={purseCount}><span class="visually-hidden">{view.purse.name}: </span>{view.purse.amount}<small> {view.purse.name}</small></span>
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
      <div class="title-row">
        {#if view.site.ownedCount > 1}<button class="step" onclick={() => selectSite(view.site.prevId)} disabled={!view.site.prevId} aria-label="Previous operation"><img class="icon small" src={iconUrl('ui_back')} alt="" /></button>{/if}
        {#key view.site.id}<h1>{view.site.name}{#if view.charterSigned}<img class="approved" src={iconUrl('decree_seal')} alt="Approved by Olympus" title="Approved by Olympus" />{/if}</h1>{/key}
        {#if view.site.ownedCount > 1}<button class="step" onclick={() => selectSite(view.site.nextId)} disabled={!view.site.nextId} aria-label="Next operation"><img class="icon small" src={iconUrl('ui_next')} alt="" /></button>{/if}
      </div>
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
      {#if view.insightMenu}
        {@const ready = view.insightShop.some((u) => u.affordable)}
        <button class="insight" title="Insight upgrades" onclick={() => (insightOpen = true)} aria-label="Insight upgrades: {view.insight} Insight{ready ? ', an upgrade is affordable' : ''}">
          <img class="icon small" src={iconUrl('ui_insight')} alt="" /> {view.insight}
          {#if ready}<span class="insight-ready" aria-hidden="true"></span>{/if}
        </button>
      {/if}
      {#if view.site.ownedCount > 1 || view.decree?.shown}
        <button class="empire-toggle" title="Empire" aria-expanded={empireOpen} onclick={toggleEmpire}>
          <img class="icon small" src={iconUrl('ui_empire')} alt="" />
          <span class="empire-label">{empireOpen ? 'Close' : 'Empire'}</span>
        </button>
      {/if}
      <button class="round" title={view.paused ? 'Resume' : 'Pause'} onclick={() => game.setPaused(!view.paused)} aria-pressed={view.paused}><img class="icon small" src={iconUrl(view.paused ? 'ui_play' : 'ui_pause')} alt="" /><span class="visually-hidden">{view.paused ? 'Resume' : 'Pause'}</span></button>
      <button class="round" title="Archive" onclick={() => (archiveOpen = true)}><img class="icon small" src={iconUrl('ui_archive')} alt="" /><span class="visually-hidden">Archive</span></button>
      <button class="round" title="Settings" onclick={() => (settingsOpen = true)}><img class="icon small" src={iconUrl('ui_settings')} alt="" /><span class="visually-hidden">Settings</span></button>
    </div>
    <div class="fascia" aria-hidden="true"></div>
  </header>

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
    <div class="suggest" role="status" in:fly={enter(0, 16)} out:fly={leave(0, 10)}>
      <img src={iconUrl('ui_prestige')} alt="" />
      <p><strong>Begin Again is worthwhile.</strong> Claim {view.prestige.award} Insight: income {view.prestige.factorBefore} → {view.prestige.factorAfter}.</p>
      <div class="suggest-actions">
        <button onclick={() => game.markSeen('prestige_prompt')}>Not now</button>
        <button class="primary" onclick={() => openPrestige()}>Review</button>
      </div>
    </div>
  {/if}

  {#if caption && options.ambientCaptions}
    <p class="caption" aria-live="polite" in:fly={enter(0, 10, 260)} out:fly={leave(0, 6)}>{#if captionSpeaker}<b class="speaker">{captionSpeaker}</b>{/if}“{caption}”</p>
  {/if}

  {#if wipe}
    <div class="wipe {wipe.phase}" aria-hidden="true">
      <span class="wipe-chapter">Chapter {wipe.chapter}</span>
      <span class="wipe-name">{wipe.name}</span>
    </div>
  {/if}

  {#if view.paused}
    <div class="paused-banner">Paused — production stopped</div>
  {/if}

  <footer class="controls" bind:clientHeight={controlsHeight}>
    <div class="tablet" class:goal-ready={view.goal?.affordable}>
      <div class="slab">
        <div class="goal-stack">
          <p class="objective" class:pinned={!!view.goal}>
            <span class="horizon-label">Now</span>{#if view.goal}<span class="pin-mark" aria-hidden="true">◆</span>{/if}{view.goalStack.now}
          </p>
          {#if view.objectiveProgress !== null}
            <span class="objective-bar" role="progressbar" aria-label="Goal progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(view.objectiveProgress * 100)}><span style:width="{view.objectiveProgress * 100}%"></span></span>
          {/if}
          <p class="horizons" aria-label="Next goal"><span><b>Next</b>{view.goalStack.next}</span></p>
          {#if view.gauge}
            <div class="gauge" class:hot={view.gauge.hot} aria-label="{view.gauge.label}: {view.gauge.text}">
              <b>{view.gauge.label}</b>
              <span class="gauge-bar" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(view.gauge.value * 100)}>
                <span class="fill" style:width="{view.gauge.value * 100}%"></span>
                {#if view.gauge.mark !== null}<span class="mark" style:left="{view.gauge.mark * 100}%"></span>{/if}
              </span>
              <span class="gauge-text">{view.gauge.text}</span>
            </div>
          {/if}
          {#if view.appeal}
            <p class="appeal-line">
              {#if view.appeal.number > 0}<b>Appeal {view.appeal.number}</b> {view.appeal.name}: {view.appeal.rule}{/if}
              {#if view.appeal.laurels > 0}<span class="laurels">{'❦'.repeat(Math.min(view.appeal.laurels, 10))} {view.appeal.laurels} laurel{view.appeal.laurels === 1 ? '' : 's'}</span>{/if}
            </p>
          {/if}
        </div>
        <button
          class="push"
          class:opening-handoff={openingHandoff}
          data-push
          bind:this={pushButton}
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
      </div>
    </div>
    <p id="push-hint" class="control-hint" class:quiet={view.prelude.attempts > 0 || !view.prelude.active}>{options.toggleMode ? `Tap or press ${keyLabel} again to stop` : 'Release to rest'}</p>
  </footer>

  <Scroll {game} {view} open={drawerOpen} hidden={empireOpen} {narrow} {sheetHeight} ontoggle={toggleDrawer} onprestige={openPrestige} />

  {#if story}
    {@const id = story.storyId}
    <div class="story" class:compact={!story.firstTime} role="status" aria-live="polite" in:fly={enter(0, -18, 420)} out:fly={leave(0, -12)}>
      <img class="portrait" src={storyPortrait(id!)} alt={storyPortraitName(id!)} />
      <div>
      <p class="god" class:small={!story.firstTime}>{story.god ?? t(`story.${id}.god`)}</p>
      {#if story.sis}<p class="sis">— {story.sis}</p>{/if}
      </div>
      <button onclick={dismissStory} aria-label="Dismiss">✕</button>
    </div>
  {/if}

  {#if toast}
    <div class="toast" role="status" in:fly={enter(28, 0)} out:fly={leave(20, 0)}>{toast}</div>
  {/if}

  {#if reveal}
    <div class="reveal" role="status" in:fly={enter(36, 0, 460)} out:fly={leave(24, 0)}>
      <button onclick={() => (reveal = null)} aria-label="Dismiss">
        <small>{reveal.firstTime ? 'The seal breaks · new to the Codex' : 'The seal breaks'}</small>
        <strong>{reveal.name}</strong>
        <span>{reveal.rule}</span>
        <em>{reveal.quip}</em>
      </button>
    </div>
  {/if}

  {#if stamp}
    <div class="stamp-toast" role="status" in:fly={enter(36, 0, 460)} out:fly={leave(24, 0)}>
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

  {#if startOpen}
    <StartScreen
      {hasProgress}
      location={view.site.name}
      progress={`${view.site.ownedCount} operation${view.site.ownedCount === 1 ? '' : 's'} · Level ${view.site.level} · ${view.purse.amount} ${view.purse.name}`}
      canViewCredits={view.charterSigned || game.state.discoveries.tutorialIds.includes('credits')}
      oncontinue={enterGame}
      onnew={beginNewGame}
      onsettings={() => (settingsOpen = true)}
      oncredits={openCredits}
    />
  {/if}

  {#if view.paused && !startOpen}
    <PauseScreen
      location={view.site.name}
      onresume={() => game.setPaused(false)}
      onarchive={() => (archiveOpen = true)}
      onsettings={() => (settingsOpen = true)}
      ontitle={() => {
        game.setPaused(false);
        startOpen = true;
      }}
    />
  {/if}

  {#if recap?.recap && !startOpen}
    {@const r = recap.recap}
    <Modal title="While you were away" onclose={() => (recap = null)}>
      <img class="modal-art icon-art" src={iconUrl('ui_offline')} alt="" />
      <p>Time counted: <strong>{formatDuration(r.countedSeconds)}</strong>{#if r.requestedSeconds > r.countedSeconds} (limit reached; {formatDuration(r.requestedSeconds)} away){/if}</p>
      {#each r.earnedBySite.filter((e) => !e.amount.isZero()) as e (e.siteId)}
        <p>{t(`site.${e.siteId}`)}: <strong>{priced(e.amount, e.siteId)}</strong> — already in its purse.</p>
      {/each}
      {#each recapMachineLines(r.machines) as m (m.siteId)}
        <p class="recap-machine">{t(`site.${m.siteId}`)}: {m.text}{#if m.waiting} · <strong>the next blueprint waits for your pick</strong>{/if}</p>
      {/each}
      {#each r.relicIds as id (id)}<p>Relic found: <strong>{t(`relic.${id}`)}</strong></p>{/each}
      {#each r.decreeSiteIds as id (id)}<p>Decree ready: <strong>{t(`site.${id}`)}</strong></p>{/each}
      {#if recap.sis}<p class="recap-quip">“{recap.sis}”</p>{/if}
      <div class="modal-actions">
        <button onclick={() => (recap = null)}>Back to work</button>
        {#if r.relicIds.length}<button onclick={recapArchive}>View Archive</button>{/if}
        {#if r.decreeSiteIds.length}<button onclick={recapEmpire}>View Empire</button>{/if}
        {#if availableUpgrades > 0}<button class="primary" onclick={recapImprove}>Review {availableUpgrades} affordable</button>{/if}
      </div>
    </Modal>
  {/if}

  {#if prestige}
    <Modal title="Begin Again" onclose={closePrestige}>
      <img class="modal-art" src={artUrl('portrait_thanatos')} alt="Thanatos" />
      <p>Renegotiate the sentence. Thanatos returns you to the foot of the First Hill.</p>
      <ul>
        <!-- Live figures: earnings while the dialog is open improve the award (spec §05). -->
        <li>This run: {view.prestige.runGross} Defiance (record {view.prestige.record})</li>
        <li>Insight to claim: <strong>{view.prestige.award}</strong></li>
        <li>Permanent income: {view.prestige.factorBefore} → <strong>{view.prestige.factorAfter}</strong></li>
      </ul>
      <p><strong>Resets:</strong> every hill's purse, operations, stewards, levels, works, the foreman and the current climb (unfinished climbs pay nothing).</p>
      <p><strong>Stays:</strong> relics, Insight and permanent upgrades, discoveries, settings and records.</p>
      <div class="modal-actions">
        <button onclick={closePrestige}>Not yet</button>
        <button class="primary" disabled={view.prestige.award <= 0} onclick={confirmPrestige}>Begin Again</button>
      </div>
    </Modal>
  {/if}

  {#if appealOpen && view.appealOffer}
    {@const a = view.appealOffer}
    <Modal title="Appeal {a.number}: {a.name}" onclose={() => (appealOpen = false)}>
      <img class="modal-art" src={artUrl('portrait_thanatos')} alt="Thanatos" />
      <p>Thanatos files an appeal against the sentence. The same hills, a stiffer hearing.</p>
      <ul>
        <li><strong>The twist:</strong> {a.rule}</li>
        <li>Gates and openings ×{a.gates}; works, the Charter among them, ×{a.works}.</li>
        <li>New tablets join the hills' pools.</li>
        <li>Sign the Charter again to win a laurel: every crew earns {a.laurelPercent}% more, for good.</li>
        {#if a.award > 0}<li>This run's Insight is paid on filing: <strong>{a.award}</strong>.</li>{/if}
      </ul>
      <p><strong>Resets:</strong> this run, as Begin Again does. <strong>Stays:</strong> the Charter's ending, laurels, relics, Insight, Remembrances and discoveries.</p>
      <div class="modal-actions">
        <button onclick={() => (appealOpen = false)}>Not yet</button>
        <button class="primary" onclick={() => ((appealOpen = false), game.fileAppeal(`${view.revision}:appeal`))}>File the Appeal</button>
      </div>
    </Modal>
  {/if}

  {#if prestigeMemory && !scene}
    <Modal title="What Sisyphus remembers" onclose={() => (prestigeMemory = null)}>
      <img class="modal-art" src={artUrl('sisyphus_rest')} alt="Sisyphus" />
      <p>The hill has reset. The lesson has not.</p>
      <ul>
        <li><strong>+{prestigeMemory.award} Insight</strong> claimed · permanent income now {prestigeMemory.factor}</li>
        <li><strong>{prestigeMemory.relics}</strong> relic{prestigeMemory.relics === 1 ? '' : 's'} retained</li>
        <li><strong>{prestigeMemory.upgrades.length}</strong> permanent upgrade{prestigeMemory.upgrades.length === 1 ? '' : 's'} retained</li>
      </ul>
      {#if prestigeMemory.conveniences.length}
        <p><strong>This run begins faster:</strong></p>
        <ul>{#each prestigeMemory.conveniences as item (item)}<li>{item}</li>{/each}</ul>
      {:else}
        <p>Your retained multiplier makes the familiar opening faster. Spend Insight on permanent upgrades from the Insight button at the top.</p>
      {/if}
      <div class="modal-actions">
        <button onclick={() => ((prestigeMemory = null), (archiveOpen = true))}>Review what remains</button>
        <button onclick={() => ((prestigeMemory = null), (insightOpen = true))}>Spend Insight</button>
        <button class="primary" onclick={() => (prestigeMemory = null)}>Begin the next run</button>
      </div>
    </Modal>
  {/if}

  {#if insightOpen}
    <Insight {game} {view} onclose={() => (insightOpen = false)} onprestige={() => ((insightOpen = false), openPrestige())} />
  {/if}

  {#if archive}
    <Archive {archive} onclose={() => (archiveOpen = false)} onscene={(id) => ((archiveOpen = false), playScene(id))} />
  {/if}

  {#if settingsOpen}
    <Settings {game} bind:options bind:rebinding onclose={() => (settingsOpen = false)} oncredits={view.charterSigned || game.state.discoveries.tutorialIds.includes('credits') ? () => ((settingsOpen = false), openCredits()) : undefined} />
  {/if}

  {#if scene}
    <Cutscene
      {scene}
      reducedMotion={options.reducedMotion}
      flashFree={options.flashFree}
      onfx={sceneFx}
      onbeat={(index) => game.telemetry.record(game.state, 'scene_advance', { detail: `${scene!.id}:${index + 1}` })}
      onclose={closeScene}
    />
  {/if}

  {#if creditsOpen}
    <Credits onclose={closeCredits} />
  {/if}

  {#if recoveryOpen}
    <Recovery {game} onclose={() => ((recoveryOpen = false), game.acknowledgeRecovery(), (options = { ...game.state.options }))} />
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
  /* A limestone beam across the top: lettering cut into it, buttons sunk into
     it, and a terracotta band with a running key along its lower face. */
  .hud {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 1rem;
    min-height: 68px;
    padding: max(0.5rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) calc(var(--key-h) + 0.6rem) max(1rem, env(safe-area-inset-left));
    color: #33261a;
    background:
      linear-gradient(180deg, rgba(255, 250, 238, 0.4), rgba(255, 250, 238, 0) 32%, rgba(90, 64, 36, 0) 64%, rgba(90, 64, 36, 0.18)),
      var(--limestone) 0 0 / var(--stone-tile) var(--stone-tile),
      #e0d2b8;
    box-shadow: 0 7px 12px rgba(20, 10, 4, 0.42), 0 2px 2px rgba(20, 10, 4, 0.4);
    pointer-events: none;
  }
  /* The band: black glaze on fired clay, under a lit arris. */
  .fascia {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    box-sizing: content-box;
    height: var(--key-h);
    background: var(--key) 0 0 / var(--key-w) var(--key-h) repeat-x;
    border-top: 1px solid #1d130c;
    border-bottom: 1px solid #1d130c;
    box-shadow: 0 -1px 0 rgba(255, 250, 236, 0.75), inset 0 -2px 3px rgba(40, 14, 4, 0.3);
  }
  .hud-left > *, .menu > *, .chapter { pointer-events: auto; }
  .hud-left { display: flex; gap: 0.6rem; align-items: stretch; min-width: 0; flex-wrap: wrap; }
  /* Cut letters: shadowed along the top of the cut, lit along its foot. */
  .obols,
  .chapter h1 {
    text-shadow: 0 1px 0 rgba(255, 250, 236, 0.8), 0 -1px 0 rgba(70, 48, 26, 0.3);
  }
  .wallet, .decree {
    background: transparent;
    border: 0;
    border-radius: 0;
  }
  .wallet {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.15rem 1rem 0.15rem 0;
    border-right: 1px solid rgba(80, 56, 30, 0.35);
    box-shadow: 1px 0 0 rgba(255, 250, 236, 0.6);
  }
  .coin { width: 2.3rem; height: 2.3rem; flex: none; filter: drop-shadow(0 1px 1px rgba(40, 24, 8, 0.5)); }
  .glyph-coin { display: grid; place-items: center; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #efd395, #a8773a 68%, #6d4a22); color: #3c2a16; font-size: 1.2rem; line-height: 1; box-shadow: inset 0 0 0 2px rgba(60, 40, 18, 0.35); }
  .wallet-text { display: flex; flex-direction: column; line-height: 1.1; }
  .obols {
    font-family: var(--display);
    font-size: 1.65rem;
    font-weight: 600;
    font-variant-numeric: lining-nums tabular-nums;
    letter-spacing: 0.01em;
  }
  .obols small { margin-left: 0.3em; font-family: var(--body); font-size: 0.7rem; font-weight: 400; letter-spacing: 0.12em; text-transform: uppercase; color: #5b4a38; }
  .rate { font-size: 0.8rem; font-style: italic; color: #5b4a38; }
  .decree {
    display: grid;
    align-content: center;
    gap: 0.1rem;
    padding: 0.1rem 0.8rem;
    min-width: 11rem;
    max-width: 16rem;
    font-size: 0.85rem;
  }
  .decree-label { font-size: 0.66rem; letter-spacing: 0.14em; text-transform: uppercase; color: #5b4a38; display: flex; align-items: center; gap: 0.3rem; }
  .decree-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* Bronze inlaid in a groove. */
  .mini-bar {
    height: 5px;
    margin-top: 3px;
    border-radius: 3px;
    overflow: hidden;
    background: rgba(70, 48, 26, 0.16);
    box-shadow: inset 0 1px 2px rgba(50, 32, 14, 0.55), 0 1px 0 rgba(255, 250, 236, 0.65);
  }
  .mini-bar span { display: block; height: 100%; background: linear-gradient(180deg, #f0d08e, #b88a45 45%, #7c5626); }

  .chapter {
    grid-column: 2;
    text-align: center;
    padding: 0 1rem;
  }
  .title-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
  }
  .chapter h1 {
    font-family: var(--display);
    font-weight: 600;
    font-size: clamp(1.3rem, 2.1vw, 1.9rem);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin: 0;
    line-height: 1.05;
    color: #2e2218;
  }
  /* A new hill's name is inscribed: it gathers from wide spacing and settles. */
  .chapter h1 { animation: inscribe 900ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }
  @keyframes inscribe {
    from { opacity: 0; letter-spacing: 0.34em; filter: blur(2px); }
  }
  .chapter h1::before,
  .chapter h1::after {
    content: '';
    display: inline-block;
    width: 1.6em;
    height: 1px;
    background: currentColor;
    opacity: 0.45;
    box-shadow: 0 1px 0 rgba(255, 250, 236, 0.9);
    vertical-align: middle;
    margin: 0 0.6em;
  }
  .chapter-detail { display: block; font-size: 0.8rem; font-style: italic; color: #5b4a38; margin-top: 0.15rem; }
  .record { display: inline-flex; gap: 0.5rem; align-items: center; margin-top: 0.3rem; font-size: 0.7rem; letter-spacing: 0.12em; text-transform: uppercase; color: #5b4a38; }
  .record strong { font-family: var(--display); font-size: 1.05rem; letter-spacing: 0; color: var(--ink); font-variant-numeric: tabular-nums; }
  .record-track { width: 96px; height: 5px; background: rgba(70, 48, 26, 0.16); border-radius: 3px; overflow: hidden; box-shadow: inset 0 1px 2px rgba(50, 32, 14, 0.55), 0 1px 0 rgba(255, 250, 236, 0.65); }
  .record-track span { display: block; height: 100%; background: var(--clay); transition: width 0.4s ease; }

  .menu {
    grid-column: 3;
    justify-self: end;
    display: flex;
    gap: 0.45rem;
    align-items: center;
  }
  /* Buttons sunk into the stone: shaded under the top edge, lit along the lip. */
  .round,
  .empire-toggle,
  .step {
    display: grid;
    place-items: center;
    padding: 0;
    border: 0;
    color: #33261a;
    background: linear-gradient(180deg, rgba(70, 48, 26, 0.2), rgba(70, 48, 26, 0.05));
    box-shadow: inset 0 2px 4px rgba(50, 32, 14, 0.5), inset 0 -1px 0 rgba(255, 250, 236, 0.35), 0 1px 0 rgba(255, 250, 236, 0.75);
    transition: background-color 0.15s ease;
  }
  .round {
    width: 44px;
    height: 44px;
    border-radius: 3px;
  }
  .empire-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    height: 44px;
    min-height: 44px;
    padding: 0 0.85rem 0 0.7rem;
    border-radius: 3px;
    font-family: var(--display);
    font-weight: 700;
    font-size: 1.05rem;
  }
  .step {
    width: 36px;
    height: 36px;
    min-width: 36px;
    min-height: 36px;
    border-radius: 50%;
    flex: none;
  }
  .step:disabled { opacity: 0.35; }
  :is(.round, .empire-toggle, .step):hover:not(:disabled) { background-color: rgba(255, 250, 236, 0.4); }
  .round[aria-pressed='true'],
  .empire-toggle[aria-expanded='true'] {
    background: linear-gradient(180deg, rgba(50, 32, 14, 0.42), rgba(50, 32, 14, 0.2));
    box-shadow: inset 0 3px 6px rgba(30, 18, 6, 0.6), 0 1px 0 rgba(255, 250, 236, 0.75);
  }
  .round .icon, .step .icon, .empire-toggle .icon { margin: 0; }
  .round .icon { width: 22px; height: 22px; }
  /* Insight is a plaque of violet glaze set into the beam. */
  .insight {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    height: 44px;
    padding: 0 0.85rem;
    border: 1px solid #2c1c3c;
    border-radius: 3px;
    font-family: var(--display);
    font-weight: 700;
    font-size: 1.1rem;
    color: #f3eafa;
    background:
      radial-gradient(ellipse at 30% 15%, rgba(236, 220, 255, 0.35), transparent 55%),
      linear-gradient(180deg, #7f62a0 0%, #5d4380 55%, #3f2a5a 100%);
    box-shadow: inset 0 1px rgba(240, 228, 255, 0.35), inset 0 -2px 3px rgba(20, 8, 34, 0.4), 0 2px 0 #24163a, 0 3px 6px rgba(30, 16, 40, 0.3);
  }
  .insight .icon { filter: invert(94%) sepia(8%) saturate(400%) hue-rotate(340deg); }
  /* A bead of gold when an upgrade can be bought. */
  .insight-ready {
    position: absolute;
    top: 5px;
    right: 5px;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, #fff1c4, #d9a441 70%);
    box-shadow: 0 0 0 1.5px #3f2a5a, 0 0 8px rgba(255, 214, 120, 0.9);
  }
  .icon { width: 1.5em; height: 1.5em; vertical-align: -0.35em; }
  .icon.small { width: 1.15em; height: 1.15em; vertical-align: -0.2em; }

  .caption {
    position: absolute;
    bottom: calc(var(--controls-h) + 0.75rem);
    left: calc((100% - var(--drawer-width)) / 2);
    transform: translateX(-50%);
    max-width: min(90vw, 36rem);
    margin: 0;
    font-family: var(--display);
    font-style: italic;
    font-size: 1.02rem;
    color: var(--parchment);
    background:
      radial-gradient(120% 140% at 30% 0%, rgba(255, 236, 210, 0.1), transparent 60%),
      var(--basalt) 0 0 / var(--stone-tile) var(--stone-tile),
      #2c2622;
    box-shadow: inset 0 1px 0 rgba(255, 236, 210, 0.2), inset 0 -2px 0 rgba(0, 0, 0, 0.45), 0 6px 14px rgba(16, 8, 3, 0.4);
    padding: 0.3rem 1.1rem;
    border-radius: 2px;
    text-align: center;
  }
  /* The chapter card: ink with a key border top and bottom, like a frieze band. */
  .wipe {
    position: absolute;
    inset: 0 var(--drawer-width) 0 0;
    z-index: 30;
    display: grid;
    place-content: center;
    gap: 0.4rem;
    text-align: center;
    color: var(--parchment);
    background:
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='20' viewBox='0 0 40 20'%3E%3Cpath d='M0 18H10V4H26V14H16V10H20' fill='none' stroke='%23a57b3b' stroke-width='2'/%3E%3Cpath d='M20 18H30V4H46' fill='none' stroke='%23a57b3b' stroke-width='2'/%3E%3C/svg%3E") repeat-x center calc(50% - 4.2rem) / auto 22px,
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='20' viewBox='0 0 40 20'%3E%3Cpath d='M0 18H10V4H26V14H16V10H20' fill='none' stroke='%23a57b3b' stroke-width='2'/%3E%3Cpath d='M20 18H30V4H46' fill='none' stroke='%23a57b3b' stroke-width='2'/%3E%3C/svg%3E") repeat-x center calc(50% + 4.2rem) / auto 22px,
      var(--ink);
    pointer-events: none;
  }
  .wipe.in { animation: wipe-in 420ms cubic-bezier(0.7, 0, 0.3, 1) both; }
  .wipe.out { animation: wipe-out 520ms cubic-bezier(0.7, 0, 0.3, 1) 80ms both; }
  @keyframes wipe-in {
    from { clip-path: inset(0 100% 0 0); }
    to { clip-path: inset(0 0 0 0); }
  }
  @keyframes wipe-out {
    from { clip-path: inset(0 0 0 0); }
    to { clip-path: inset(0 0 0 100%); }
  }
  .wipe-chapter { font-size: 0.72rem; letter-spacing: 0.3em; text-transform: uppercase; color: var(--pale-clay); }
  .wipe-name { font-family: var(--display); font-size: clamp(1.8rem, 4vw, 3rem); font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; }
  .wipe.in .wipe-name { animation: inscribe 700ms cubic-bezier(0.2, 0.8, 0.2, 1) 120ms both; }
  .paused-banner {
    position: absolute;
    top: 45%;
    left: calc((100% - var(--drawer-width)) / 2);
    transform: translate(-50%, -50%);
    color: var(--parchment);
    background:
      radial-gradient(120% 140% at 30% 0%, rgba(255, 236, 210, 0.1), transparent 60%),
      var(--basalt) 0 0 / var(--stone-tile) var(--stone-tile),
      #2c2622;
    box-shadow: inset 0 1px 0 rgba(255, 236, 210, 0.2), inset 0 -2px 0 rgba(0, 0, 0, 0.45), 0 10px 24px rgba(16, 8, 3, 0.5);
    padding: 0.8rem 1.8rem;
    border-radius: 2px;
    font-family: var(--display);
    font-weight: 600;
    font-size: 1.15rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  .paused-banner::after,
  .story::after {
    content: '';
    position: absolute;
    inset: 4px;
    border: 1px solid rgba(0, 0, 0, 0.55);
    box-shadow: 1px 1px 0 rgba(255, 236, 210, 0.1);
    pointer-events: none;
  }

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
    right: calc(var(--scroll-w) + 3rem);
    z-index: 6;
    display: flex;
    align-items: center;
    gap: 0.7rem;
    max-width: min(92vw, 26rem);
    padding: 0.75rem 0.9rem 0.75rem 1.4rem;
    color: #22160d;
    background:
      linear-gradient(180deg, rgba(255, 250, 236, 0.35), rgba(120, 82, 36, 0.12)),
      var(--slip) 0 0 / var(--tile) var(--tile);
    border: 0;
    border-radius: 1px;
    box-shadow: inset 0 0 0 1px rgba(92, 60, 26, 0.28), inset 0 -10px 12px -10px rgba(80, 50, 18, 0.35), 0 8px 18px rgba(16, 8, 3, 0.4);
    font-size: 0.9rem;
    flex-wrap: wrap;
  }
  .suggest::before {
    content: '';
    position: absolute;
    left: 0.5rem;
    top: 1.35rem;
    width: 0.55rem;
    height: 2.5px;
    border-radius: 2px;
    background: #6b4f8a;
    transform: rotate(-4deg);
  }
  .suggest img { width: 32px; height: 32px; flex: none; }
  .suggest p { margin: 0; flex: 1 1 12rem; line-height: 1.35; }
  .suggest-actions { display: flex; gap: 0.4rem; margin-left: auto; }
  .narrow .suggest { top: auto; bottom: calc(var(--controls-h) + 0.6rem); right: 50%; transform: translateX(50%); }

  /* ----------------------------------------------------------- controls */
  .controls {
    position: absolute;
    left: calc((100% - var(--drawer-width)) / 2);
    width: min(48rem, calc(100% - var(--drawer-width) - 1.5rem));
    bottom: max(0.75rem, env(safe-area-inset-bottom));
    transform: translateX(-50%);
    padding: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    background: transparent;
    border: 0;
    pointer-events: none;
    transition: left 0.2s ease, width 0.2s ease, bottom 0.2s ease;
  }
  .controls > * { pointer-events: auto; }
  /* A tabula ansata: a basalt tablet with dovetail handles, the goal cut into
     it and the push set beside it in glazed clay. */
  .tablet {
    --ansa: 22px;
    position: relative;
    width: 100%;
    padding: 0 var(--ansa);
    filter: drop-shadow(0 6px 10px rgba(16, 8, 3, 0.45)) drop-shadow(0 1px 1px rgba(16, 8, 3, 0.5));
  }
  .tablet::before,
  .tablet::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: calc(var(--ansa) + 2px);
    background:
      radial-gradient(circle at var(--peg) 50%, rgba(0, 0, 0, 0.65) 0 2.5px, rgba(255, 236, 210, 0.16) 3px 3.8px, transparent 4.2px),
      linear-gradient(180deg, rgba(255, 236, 210, 0.05), rgba(0, 0, 0, 0.22)),
      var(--basalt) 0 0 / var(--stone-tile) var(--stone-tile),
      #2c2622;
  }
  .tablet::before { left: 0; --peg: 42%; clip-path: polygon(100% 28%, 0 8%, 0 92%, 100% 72%); }
  .tablet::after { right: 0; --peg: 58%; clip-path: polygon(0 28%, 100% 8%, 100% 92%, 0 72%); }
  .slab {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.6rem 0.6rem 0.6rem 1.1rem;
    border-radius: 2px;
    color: var(--parchment);
    background:
      radial-gradient(120% 140% at 30% 0%, rgba(255, 236, 210, 0.1), transparent 60%),
      var(--basalt) 0 0 / var(--stone-tile) var(--stone-tile),
      #2c2622;
    box-shadow: inset 0 1px 0 rgba(255, 236, 210, 0.22), inset 0 -2px 0 rgba(0, 0, 0, 0.45), inset 1px 0 0 rgba(255, 236, 210, 0.08), inset -1px 0 0 rgba(0, 0, 0, 0.3);
  }
  /* An incised border a little in from the edge; bronze when the goal is within reach. */
  .slab::after {
    content: '';
    position: absolute;
    inset: 4px;
    border: 1px solid rgba(0, 0, 0, 0.55);
    border-radius: 1px;
    box-shadow: 1px 1px 0 rgba(255, 236, 210, 0.1);
    pointer-events: none;
    transition: border-color 0.4s ease, box-shadow 0.4s ease;
  }
  .tablet.goal-ready .slab::after {
    border-color: rgba(214, 170, 98, 0.75);
    box-shadow: 0 0 10px rgba(214, 170, 98, 0.25), inset 0 0 8px rgba(214, 170, 98, 0.12);
  }
  .goal-stack {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 0.3rem;
    text-align: left;
  }
  .objective {
    margin: 0;
    font-family: var(--display);
    font-size: 1.14rem;
    font-weight: 600;
    line-height: 1.2;
    color: var(--ivory);
    text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.6);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .tablet.goal-ready .objective { color: #ffe3ae; }
  .horizon-label {
    margin-right: 0.55rem;
    font-family: var(--body);
    color: var(--pale-clay);
    font-size: 0.64rem;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    vertical-align: 0.14em;
  }
  .pin-mark { color: var(--pale-clay); margin-right: 0.45em; font-size: 0.75em; }
  /* Progress is bronze inlaid in a groove. */
  .objective-bar {
    display: block;
    height: 4px;
    width: 100%;
    border-radius: 2px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.45);
    box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.6), 0 1px 0 rgba(255, 236, 210, 0.1);
  }
  .objective-bar span { display: block; height: 100%; background: linear-gradient(180deg, #f3d595, #c0924b 45%, #7c5626); transition: width 0.4s ease; }
  .horizons {
    display: flex;
    gap: 0.9rem;
    margin: 0;
    min-width: 0;
    font-size: 0.72rem;
    color: rgba(235, 220, 192, 0.72);
  }
  .horizons span {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .horizons b { margin-right: 0.4rem; color: rgba(217, 156, 108, 0.85); text-transform: uppercase; letter-spacing: 0.12em; font-size: 0.6rem; }
  .control-hint {
    margin: -0.1rem 0 0;
    padding: 0.18rem 0.75rem;
    border-radius: 2px;
    background:
      radial-gradient(120% 140% at 30% 0%, rgba(255, 236, 210, 0.1), transparent 60%),
      var(--basalt) 0 0 / var(--stone-tile) var(--stone-tile),
      #2c2622;
    box-shadow: inset 0 1px 0 rgba(255, 236, 210, 0.2), inset 0 -2px 0 rgba(0, 0, 0, 0.45);
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
  /* The push: glazed clay, like the seals on the scroll. */
  .push {
    flex: none;
    min-height: 54px;
    min-width: 11.5rem;
    padding: 0 1.1rem 0 0.95rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    border: 1px solid #2a1006;
    border-radius: 3px;
    font-size: 1.1rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    color: var(--ivory);
    background:
      radial-gradient(ellipse at 30% 15%, rgba(255, 214, 170, 0.3), transparent 60%),
      linear-gradient(180deg, #a84f28 0%, #8e3c1b 55%, #6a2910 100%);
    box-shadow: inset 0 1px rgba(255, 220, 180, 0.35), inset 0 -2px 3px rgba(40, 12, 2, 0.4), 0 2px 0 #1a0b04, 0 3px 6px rgba(0, 0, 0, 0.35);
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }
  .push:active,
  .push.held {
    transform: translateY(1px);
    box-shadow: inset 0 2px 4px rgba(30, 10, 2, 0.55), 0 1px 0 #1a0b04;
  }
  .push.held { background: linear-gradient(180deg, #5e2711, #3e1808); }
  .push .icon { margin: 0; filter: invert(94%) sepia(8%) saturate(400%) hue-rotate(340deg); }
  /* The key's name, cut into the glaze. */
  .push kbd {
    font: inherit;
    font-size: 0.64rem;
    font-weight: 400;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 0.12rem 0.4rem;
    border: 0;
    border-radius: 2px;
    background: rgba(40, 12, 2, 0.32);
    box-shadow: inset 0 1px 2px rgba(20, 6, 0, 0.6), 0 1px 0 rgba(255, 220, 180, 0.25);
    opacity: 0.9;
  }
  @media (pointer: coarse) {
    .push kbd { display: none; }
  }
  .push.opening-handoff {
    outline: 4px solid var(--ivory);
    outline-offset: 4px;
    animation: opening-call 900ms ease-in-out infinite alternate;
  }
  .push.held .icon { animation: nudge 0.6s ease-in-out infinite alternate; }
  @keyframes nudge {
    to { transform: translateX(3px); }
  }
  @keyframes opening-call {
    to { transform: translateY(-3px); box-shadow: 0 5px 0 #1a0b04, 0 0 24px rgba(217, 156, 108, 0.8); }
  }
  :global(.reduced-motion) .push.opening-handoff { animation: none; }

  /* ------------------------------------------------------------- narrow */
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
  .narrow .hud-left { display: contents; }
  .narrow .wallet { grid-column: 1; grid-row: 1; border-right: 0; box-shadow: none; padding-right: 0; }
  .narrow .wallet { min-width: 0; }
  .narrow .obols small { display: none; }
  .narrow .insight { padding: 0 0.55rem; height: 40px; font-size: 1rem; }
  .narrow .decree {
    grid-column: 1 / -1;
    grid-row: 3;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
    max-width: none;
    padding: 0;
    font-size: 0.78rem;
  }
  .narrow .decree-label { flex: none; font-size: 0.6rem; }
  .narrow .decree-name { flex: 1; min-width: 0; }
  .narrow .decree .mini-bar { flex: 0 0 4.5rem; margin: 0; }
  .narrow .toast,
  .narrow .stamp-toast { top: auto; bottom: calc(var(--controls-h) + 0.75rem); left: 0.75rem; right: 0.75rem; }
  .narrow .empire-toggle { height: 40px; min-height: 40px; padding: 0 0.6rem; }
  .narrow .empire-label { display: none; }
  .narrow .step { width: 32px; height: 32px; min-width: 32px; min-height: 32px; }
  .narrow .controls { width: calc(100% - 0.8rem); gap: 0.3rem; bottom: max(0.4rem, env(safe-area-inset-bottom)); }
  .narrow .tablet { --ansa: 14px; }
  .narrow .slab { flex-direction: column; align-items: stretch; gap: 0.5rem; padding: 0.55rem 0.6rem 0.6rem; }
  .narrow .objective { font-size: 0.98rem; }
  .narrow .horizons { gap: 0.6rem; font-size: 0.66rem; }
  .narrow .horizons span { max-width: 100%; }
  .narrow .push { min-width: 0; width: 100%; }
  .narrow .push kbd { display: none; }
  .narrow .story { top: calc(var(--hud-h) + 0.3rem); width: 92%; }
  .narrow .story .portrait { width: 48px; height: 48px; }
  .narrow .story .god { font-size: 0.95rem; }
  @media (max-height: 560px) {
    .chapter-detail,
    .record > span:first-child { display: none; }
    .hud { padding-top: 0.35rem; padding-bottom: 0.2rem; }
    .hud { padding-bottom: calc(var(--key-h) + 0.3rem); }
    .slab { padding-top: 0.4rem; padding-bottom: 0.4rem; }
    .objective { font-size: 0.95rem; }
    .horizons { display: none; }
    .push { min-height: 46px; }
  }
  .story {
    position: absolute;
    top: calc(var(--hud-h) + 0.5rem);
    left: 50%;
    transform: translateX(-50%);
    color: var(--ivory);
    background:
      radial-gradient(120% 140% at 30% 0%, rgba(255, 236, 210, 0.1), transparent 60%),
      var(--basalt) 0 0 / var(--stone-tile) var(--stone-tile),
      #2c2622;
    box-shadow: inset 0 1px 0 rgba(255, 236, 210, 0.2), inset 0 -2px 0 rgba(0, 0, 0, 0.45), 0 12px 26px rgba(16, 8, 3, 0.5);
    padding: 0.9rem 3rem 0.9rem 1.1rem;
    border-radius: 2px;
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
    border: 2px solid #1a120c;
    box-shadow: 0 0 0 2.5px #c89c55, 0 0 0 4px #5c3e14, 0 2px 6px rgba(0, 0, 0, 0.5);
  }
  .story.compact .portrait {
    width: 48px;
    height: 48px;
  }
  .story p {
    margin: 0.2rem 0;
  }
  .story .god {
    font-family: var(--display);
    font-size: 1.28rem;
    line-height: 1.25;
    letter-spacing: 0.02em;
  }
  .story .god.small {
    font-size: 1.08rem;
  }
  .story .sis {
    font-style: italic;
    color: var(--pale-clay);
  }
  .story.compact .sis {
    font-size: 0.9rem;
  }
  .recap-quip {
    font-style: italic;
    color: var(--muted);
  }
  .story button {
    position: absolute;
    top: 0.35rem;
    right: 0.35rem;
    z-index: 1;
    background: transparent;
    color: var(--parchment);
    border: none;
    box-shadow: none;
  }
  .toast {
    position: absolute;
    top: calc(var(--hud-h) + 0.9rem);
    right: calc(var(--scroll-w) + 3rem);
    color: var(--parchment);
    background:
      radial-gradient(120% 140% at 30% 0%, rgba(255, 236, 210, 0.1), transparent 60%),
      var(--basalt) 0 0 / var(--stone-tile) var(--stone-tile),
      #2c2622;
    box-shadow: inset 0 1px 0 rgba(255, 236, 210, 0.2), inset 0 -2px 0 rgba(0, 0, 0, 0.45), 0 8px 18px rgba(16, 8, 3, 0.45);
    padding: 0.6rem 1rem;
    border-radius: 2px;
    max-width: 22rem;
    z-index: 20;
  }
  .stamp-toast {
    position: absolute;
    top: calc(var(--hud-h) + 5rem);
    right: calc(var(--scroll-w) + 3rem);
    z-index: 21;
  }
  .stamp-toast button {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    background: var(--ivory);
    color: var(--ink);
    border: 1px solid #5c3e14;
    padding: 0.4rem 0.9rem 0.4rem 0.4rem;
    border-radius: 2px;
    max-width: 22rem;
    text-align: left;
  }
  .stamp-toast img {
    width: 48px;
    height: 48px;
    flex: none;
    animation: press 520ms 160ms cubic-bezier(0.3, 1.6, 0.5, 1) both;
  }
  .stamp-toast button { box-shadow: 0 2px 0 var(--ink), var(--shadow); }
  .reveal {
    position: absolute;
    top: calc(var(--hud-h) + 0.9rem);
    left: 50%;
    transform: translateX(-50%);
    z-index: 22;
  }
  .reveal button {
    display: grid;
    gap: 0.25rem;
    background: var(--ivory);
    color: var(--ink);
    border: 1px solid #8e2a1c;
    border-top: 4px solid #8e2a1c;
    padding: 0.7rem 1.1rem;
    border-radius: 2px;
    width: min(26rem, calc(100vw - 2rem));
    text-align: left;
    box-shadow: 0 2px 0 var(--ink), var(--shadow);
  }
  .reveal small { color: #8e2a1c; letter-spacing: 0.08em; text-transform: uppercase; font-size: 0.72rem; }
  .reveal strong { font-size: 1.1rem; }
  .reveal em { color: #6a5641; }
  /* The seal comes down on the page: large and light, then pressed in. */
  @keyframes press {
    from { transform: scale(1.8) rotate(-14deg); opacity: 0; }
    60% { opacity: 1; }
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
    flex-wrap: wrap;
    gap: 0.6rem;
    justify-content: flex-end;
  }
  .narrow .modal-actions > :global(button) { flex: 1 1 auto; }
  .appeal-line {
    margin: 0.2rem 0 0;
    font-size: 0.8rem;
    color: var(--muted);
  }
  .appeal-line .laurels {
    margin-left: 0.5rem;
    color: #6b4f8a;
  }
  .gauge {
    display: grid;
    grid-template-columns: auto minmax(60px, 140px) 1fr;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.25rem;
    font-size: 0.72rem;
    color: rgba(235, 220, 192, 0.8);
    min-width: 0;
  }
  .gauge b { color: rgba(217, 156, 108, 0.85); text-transform: uppercase; letter-spacing: 0.12em; font-size: 0.6rem; }
  .gauge-bar {
    position: relative;
    height: 6px;
    border-radius: 3px;
    background: rgba(0, 0, 0, 0.45);
    box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.6);
    overflow: hidden;
  }
  .gauge-bar .fill { display: block; height: 100%; background: linear-gradient(180deg, #d9c6a0, #9c7c4c); transition: width 0.4s ease; }
  .gauge.hot .gauge-bar .fill { background: linear-gradient(180deg, #ffcf7a, #e0782c 55%, #9b3b12); }
  .gauge-bar .mark { position: absolute; top: -1px; bottom: -1px; width: 2px; margin-left: -1px; background: #f6ecd8; box-shadow: 0 0 2px rgba(0, 0, 0, 0.8); }
  .gauge-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  @media (prefers-reduced-motion: reduce) {
    .gauge-bar .fill { transition: none; }
  }
  .recap-machine {
    margin: 0.15rem 0;
    font-size: 0.85rem;
    color: var(--muted);
  }
  .caption .speaker {
    display: block;
    margin-bottom: 0.15rem;
    font-style: normal;
    font-weight: 600;
    font-size: 0.68rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--pale-clay, #d99c6c);
  }
</style>
