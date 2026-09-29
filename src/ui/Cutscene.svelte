<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { ACTORS, type Scene, type SceneFx } from '../content/scenes';
  import { artUrl, iconUrl } from '../world/library';

  /**
   * A skippable scene played over the running game: a scene painting behind,
   * Sisyphus on the ground at left, a god looming at right, and a dialogue
   * scroll. Click, Space, Enter or → advances (finishing the line first);
   * Escape skips.
   */
  let {
    scene,
    reducedMotion = false,
    flashFree = false,
    onfx = () => {},
    onbeat = () => {},
    onclose,
  }: {
    scene: Scene;
    reducedMotion?: boolean;
    flashFree?: boolean;
    onfx?: (fx: SceneFx) => void;
    onbeat?: (index: number) => void;
    onclose: (reason: 'complete' | 'skip', index: number) => void;
  } = $props();

  const CHARS_PER_SECOND = 48;

  let index = $state(0);
  let shown = $state(0);
  let flash = $state(0);
  let seal = $state(0);
  let advanceButton: HTMLButtonElement;
  let stageEl: HTMLDivElement;

  const SHAKE: Keyframe[] = [
    { transform: 'none' },
    { transform: 'translate(-6px, 3px)' },
    { transform: 'translate(5px, -4px)' },
    { transform: 'translate(-3px, 2px)' },
    { transform: 'translate(2px, -1px)' },
    { transform: 'none' },
  ];
  function shake() {
    if (!reducedMotion) stageEl?.animate(SHAKE, { duration: 450, easing: 'ease-out' });
  }

  /** Stage state at a beat: settings carry over until a beat changes them. */
  const stage = $derived.by(() => {
    let bg = '';
    let cast: string[] = [];
    let prop: string | null = null;
    let propAt: 'center' | 'hands' = 'center';
    for (let i = 0; i <= index; i++) {
      const b = scene.beats[i];
      if (b.bg) bg = b.bg;
      if (b.cast) cast = b.cast;
      if (b.prop !== undefined) {
        prop = b.prop;
        propAt = b.propAt ?? 'center';
      }
    }
    return { bg, cast, prop, propAt };
  });
  const beat = $derived(scene.beats[index]);
  const speaker = $derived(beat.who ? ACTORS[beat.who] : null);
  /** An offstage speaker on stage, shown as a glow from below. */
  const voice = $derived(stage.cast.find((id) => ACTORS[id].kind === 'voice'));
  const typing = $derived(shown < beat.text.length);
  const ms = (n: number) => (reducedMotion ? 0 : n);
  /** Motes drifting through the painting's light: fixed at mount, varied by index. */
  const MOTES = Array.from({ length: 14 }, (_, i) => ({
    x: (i * 37 + 11) % 100,
    delay: -((i * 1.9) % 14),
    duration: 11 + ((i * 7) % 9),
    size: 2 + ((i * 5) % 4),
    drift: ((i % 3) - 1) * 4,
  }));

  function artFor(id: string): string {
    return artUrl(beat.pose?.[id] ?? ACTORS[id].art);
  }

  // Reveal the line a few characters at a time.
  $effect(() => {
    const text = beat.text;
    if (reducedMotion) {
      shown = text.length;
      return;
    }
    shown = 0;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      shown = Math.min(text.length, Math.floor(((now - start) / 1000) * CHARS_PER_SECOND));
      if (shown < text.length) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });

  // Effects fire as their beat begins.
  $effect(() => {
    const fx = beat.fx;
    if (!fx) return;
    untrack(() => {
      onfx(fx);
      if (fx === 'bolt') {
        flash += 1;
        shake();
      } else if (fx === 'thud') {
        shake();
      } else if (fx === 'seal') {
        seal += 1;
      }
    });
  });

  function advance() {
    if (typing) {
      shown = beat.text.length;
    } else if (index < scene.beats.length - 1) {
      index += 1;
      onbeat(index);
    } else {
      onclose('complete', index);
    }
  }

  const ADVANCE_KEYS = new Set([' ', 'Enter', 'ArrowRight']);
  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onclose('skip', index);
    } else if (ADVANCE_KEYS.has(e.key)) {
      // Swallow the key so a focused button doesn't also click on keyup.
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) advance();
    }
  }
  function onkeyup(e: KeyboardEvent) {
    if (ADVANCE_KEYS.has(e.key)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  onMount(() => {
    advanceButton.focus();
    window.addEventListener('keydown', onkeydown, true);
    window.addEventListener('keyup', onkeyup, true);
    return () => {
      window.removeEventListener('keydown', onkeydown, true);
      window.removeEventListener('keyup', onkeyup, true);
    };
  });
</script>

<div class="cutscene" class:reduced={reducedMotion} role="dialog" aria-modal="true" aria-label={scene.title}>
  <div class="band top">
    <span class="title">{scene.title}</span>
    <button class="skip" onclick={() => onclose('skip', index)}>Skip <span aria-hidden="true">⏭</span></button>
  </div>

  <div class="stage" bind:this={stageEl}>
    {#key stage.bg}
      <img class="bg" src={artUrl(stage.bg)} alt="" transition:fade={{ duration: ms(700) }} />
    {/key}

    {#if voice}
      <div class="voice" class:speaking={beat.who === voice} transition:fade={{ duration: ms(600) }}></div>
    {/if}

    {#each stage.cast.filter((id) => ACTORS[id].kind !== 'voice') as id, i (id)}
      {@const actor = ACTORS[id]}
      <img
        class="actor {actor.kind}"
        class:left={i === 0}
        class:right={i > 0}
        class:speaking={beat.who === id}
        src={artFor(id)}
        alt={actor.name}
        transition:fly={{ x: i === 0 ? -80 : 120, y: actor.kind === 'bust' ? 40 : 0, duration: ms(500), opacity: 0 }}
      />
    {/each}

    {#if stage.prop}
      {#key stage.prop}
        <img class="prop" class:at-hands={stage.propAt === 'hands'} src={artUrl(stage.prop)} alt="" transition:fly={{ y: -60, duration: ms(600), opacity: 0 }} />
      {/key}
    {/if}

    {#if !reducedMotion}
      <div class="motes" aria-hidden="true">
        {#each MOTES as m, i (i)}
          <span style:left="{m.x}%" style:--size="{m.size}px" style:--drift="{m.drift}vw" style:animation-delay="{m.delay}s" style:animation-duration="{m.duration}s"></span>
        {/each}
      </div>
    {/if}
    <div class="finish" aria-hidden="true"></div>

    {#key seal}
      {#if seal > 0 && stage.prop}
        <img class="seal" src={iconUrl('decree_seal')} alt="" />
      {/if}
    {/key}
  </div>

  {#key flash}
    {#if flash > 0}<div class="flash" class:soft={flashFree || reducedMotion}></div>{/if}
  {/key}

  <button class="scroll" bind:this={advanceButton} onclick={advance} aria-label={typing ? 'Show the whole line' : 'Continue'}>
    {#if speaker}{#key beat.who}<span class="name" in:fly={{ x: -14, duration: ms(260), opacity: 0 }}>{speaker.name}</span>{/key}{/if}
    <span class="line" class:narration={!speaker} aria-live="polite">
      {#if !speaker}<em>{beat.text.slice(0, shown)}</em>{:else}{beat.text.slice(0, shown)}{/if}<span class="rest" aria-hidden="true">{beat.text.slice(shown)}</span>
    </span>
    <span class="progress" aria-hidden="true">{index + 1} / {scene.beats.length}{typing ? '' : index < scene.beats.length - 1 ? ' ▸' : ' ✓'}</span>
  </button>

  <div class="band bottom"></div>
</div>

<style>
  .cutscene {
    position: fixed;
    inset: 0;
    z-index: 70;
    background: var(--ink);
    color: var(--parchment);
    display: grid;
    grid-template-rows: auto 1fr auto;
    overflow: hidden;
    --band: clamp(34px, 7vh, 64px);
    --scroll-h: clamp(104px, 19vh, 160px);
  }

  /* Letterbox bands carry a Greek key, as on a vase's lip and foot. */
  .band {
    height: var(--band);
    background:
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='20' viewBox='0 0 40 20'%3E%3Cpath d='M0 18H10V4H26V14H16V10H20' fill='none' stroke='%23a57b3b' stroke-width='2'/%3E%3Cpath d='M20 18H30V4H46' fill='none' stroke='%23a57b3b' stroke-width='2'/%3E%3C/svg%3E") repeat-x center / auto 45%,
      var(--ink);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 1rem;
    position: relative;
    z-index: 3;
  }
  .title {
    font-family: var(--display);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    font-size: 0.85rem;
    background: var(--ink);
    padding: 0.2rem 0.6rem;
    color: var(--pale-clay);
  }
  .skip {
    background: var(--ink);
    color: var(--parchment);
    border: 1px solid var(--bronze);
  }

  .stage {
    position: relative;
    overflow: hidden;
    container-type: size;
    --figure-left: max(2cqw, 50cqw - 34rem);
    --figure-h: 46cqh;
  }
  .bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    animation: pan 30s ease-in-out infinite alternate;
  }

  .actor {
    position: absolute;
    bottom: calc(var(--scroll-h) * 0.55);
    filter: brightness(0.55) saturate(0.7);
    transition: filter 0.3s, transform 0.3s;
    pointer-events: none;
  }
  .actor.speaking {
    filter: none;
  }
  .actor.figure {
    height: var(--figure-h);
    bottom: calc(var(--scroll-h) + 1.4rem);
    left: var(--figure-left);
  }
  .actor.figure.speaking {
    transform: translateY(-4px);
  }
  .actor.bust {
    height: 78%;
    bottom: calc(var(--scroll-h) * 0.35);
    right: max(0%, calc(50% - 36rem));
    transform: scaleX(-1);
    filter: brightness(0.55) saturate(0.7) drop-shadow(0 0 30px rgba(246, 236, 220, 0.25));
  }
  /* The god is present, not pasted: a slow breath lifts the bust. */
  .actor.bust {
    transform-origin: 50% 100%;
    animation: breathe 5.5s ease-in-out infinite alternate;
  }
  .reduced .actor.bust {
    animation: none;
  }
  @keyframes breathe {
    to { scale: 1.012; translate: 0 -3px; }
  }
  .actor.bust.speaking {
    filter: drop-shadow(0 0 40px rgba(246, 236, 220, 0.45));
    transform: scaleX(-1) translateY(-6px);
  }
  /* Hades speaks from below: an ember glow where a portrait would stand. */
  .voice {
    position: absolute;
    right: max(0%, calc(50% - 36rem));
    bottom: calc(var(--scroll-h) * 0.35);
    width: min(56cqw, 40rem);
    height: 100%;
    background:
      radial-gradient(ellipse 60% 45% at 50% 100%, rgba(217, 156, 108, 0.6), rgba(182, 93, 53, 0.4) 40%, transparent 75%),
      radial-gradient(ellipse 45% 55% at 50% 42%, rgba(33, 27, 23, 0.75), transparent 70%);
    opacity: 0.6;
    transition: opacity 0.4s;
    pointer-events: none;
  }
  /* A pair of embers for eyes, in the dark above the glow. */
  .voice::before,
  .voice::after {
    content: '';
    position: absolute;
    top: 36%;
    width: 2.2%;
    aspect-ratio: 2.4;
    border-radius: 50%;
    background: #f0b27a;
    box-shadow: 0 0 12px 4px rgba(182, 93, 53, 0.9);
  }
  .voice::before { left: 45%; }
  .voice::after { left: 52.5%; }
  .voice.speaking {
    opacity: 1;
    animation: ember 2.4s ease-in-out infinite alternate;
  }
  .reduced .voice.speaking {
    animation: none;
  }
  @keyframes ember {
    from { filter: brightness(0.9); }
    to { filter: brightness(1.25); }
  }

  .prop {
    position: absolute;
    /* Between the mortal and the god, not over either. */
    left: 41%;
    bottom: calc(var(--scroll-h) * 0.8);
    height: 38%;
    translate: -50% 0;
    filter: drop-shadow(0 10px 18px rgba(33, 27, 23, 0.5));
  }
  /* On the ground, just past the figure's reach (the figure art is square). */
  .prop.at-hands {
    /* As tall as he is, as on the vases; his palms meet its upper face. */
    left: calc(var(--figure-left) + var(--figure-h) * 0.64);
    bottom: calc(var(--scroll-h) + 1.4rem - var(--figure-h) * 0.1);
    height: calc(var(--figure-h) * 1.1);
    translate: none;
  }
  .seal {
    position: absolute;
    left: 58%;
    top: 22%;
    width: min(22vw, 160px);
    animation: stamp 0.5s cubic-bezier(0.2, 1.6, 0.4, 1) both;
  }

  .flash {
    position: fixed;
    inset: 0;
    z-index: 4;
    pointer-events: none;
    background: var(--ivory);
    animation: flash 0.7s ease-out forwards;
  }
  .flash.soft {
    background: var(--bronze);
    animation-duration: 0.9s;
  }

  .scroll:focus-visible {
    outline: 2px solid var(--pale-clay);
    outline-offset: 3px;
  }
  .scroll {
    position: absolute;
    left: 50%;
    bottom: calc(var(--band) + 0.6rem);
    translate: -50% 0;
    z-index: 2;
    width: min(92vw, 52rem);
    min-height: var(--scroll-h);
    display: grid;
    align-content: start;
    gap: 0.35rem;
    text-align: left;
    padding: 1.05rem 2.8rem 1.6rem;
    /* A painted tablet: warm slip lit from above, an inner bronze rule and an ink foot. */
    background:
      radial-gradient(120% 140% at 30% 0%, rgba(255, 248, 232, 0.9), transparent 60%),
      var(--parchment);
    color: var(--ink);
    border: 2px solid var(--ink);
    outline: 1px solid var(--bronze);
    outline-offset: -7px;
    border-radius: 6px;
    box-shadow: 0 3px 0 var(--ink), 0 14px 44px rgba(0, 0, 0, 0.55);
    font: inherit;
    cursor: pointer;
  }
  /* Palmettes in the two upper corners, as on a vase's handle zone. */
  .scroll::before,
  .scroll::after {
    content: '';
    position: absolute;
    top: 12px;
    width: 22px;
    height: 22px;
    opacity: 0.55;
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cg fill='%23a57b3b'%3E%3Cpath d='M12 22c-1-5-1-10 0-18 1 8 1 13 0 18z'/%3E%3Cpath d='M12 22c-3-4-6-8-8-14 4 4 6 8 8 14z'/%3E%3Cpath d='M12 22c3-4 6-8 8-14-4 4-6 8-8 14z'/%3E%3Cpath d='M12 22c-4-2-8-4-10-8 4 1 7 4 10 8z'/%3E%3Cpath d='M12 22c4-2 8-4 10-8-4 1-7 4-10 8z'/%3E%3C/g%3E%3C/svg%3E") center / contain no-repeat;
    pointer-events: none;
  }
  .scroll::before { left: 12px; rotate: -35deg; }
  .scroll::after { right: 12px; rotate: 35deg; }
  .name {
    font-family: var(--display);
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--clay);
    font-size: 0.9rem;
  }
  .line {
    font-size: clamp(1.05rem, 2.3vh, 1.35rem);
    line-height: 1.45;
  }
  .line.narration {
    text-align: center;
    color: var(--muted);
    padding-top: 0.6rem;
  }
  /* The unrevealed text keeps its space so the scroll never jumps. */
  .rest {
    visibility: hidden;
  }
  .progress {
    position: absolute;
    right: 0.9rem;
    bottom: 0.4rem;
    font-size: 0.75rem;
    color: var(--muted);
  }

  .reduced .bg {
    animation: none;
  }

  /* Dust in the painting's light, rising slowly. */
  .motes {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
  }
  .motes span {
    position: absolute;
    bottom: -2%;
    width: var(--size);
    height: var(--size);
    border-radius: 50%;
    background: rgba(246, 236, 220, 0.75);
    box-shadow: 0 0 6px rgba(246, 222, 170, 0.6);
    animation: rise linear infinite;
  }
  @keyframes rise {
    0% { transform: translate(0, 0); opacity: 0; }
    15% { opacity: 0.8; }
    85% { opacity: 0.6; }
    100% { transform: translate(var(--drift), -85cqh); opacity: 0; }
  }
  /* The same fired finish as the game: fine grain in the slip, darker at the rim. */
  .finish {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(ellipse 75% 70% at 50% 45%, transparent 55%, rgba(33, 27, 23, 0.45) 100%),
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.13 0 0 0 0 0.1 0 0 0 0 0.09 0 0 0 0.55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    mix-blend-mode: multiply;
    opacity: 0.55;
  }

  @keyframes pan {
    from { transform: scale(1.06) translateX(-1.5%); }
    to { transform: scale(1.1) translateX(1.5%); }
  }
  @keyframes flash {
    from { opacity: 0.85; }
    to { opacity: 0; }
  }
  @keyframes stamp {
    from { transform: scale(2.4) rotate(-30deg); opacity: 0; }
    to { transform: scale(1) rotate(-10deg); opacity: 1; }
  }

  @media (max-width: 760px) {
    .stage { --figure-h: 40cqh; }
    .actor.bust { height: 52%; bottom: calc(var(--scroll-h) * 0.6); }
    .prop { height: 26%; bottom: calc(var(--scroll-h) * 1.1); }
    .title { display: none; }
    .scroll { padding: 0.9rem 1.2rem 1.5rem; }
    .scroll::before,
    .scroll::after { display: none; }
  }
</style>
