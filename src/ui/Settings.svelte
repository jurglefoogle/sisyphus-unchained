<script lang="ts">
  import type { Game } from '../app/game';
  import type { GameState, Options } from '../core/state';
  import { formatMoney } from '../core/format';
  import Modal from './Modal.svelte';
  import { untrack } from 'svelte';

  let {
    game,
    options = $bindable(),
    rebinding = $bindable(false),
    onclose,
    oncredits,
  }: { game: Game; options: Options; rebinding?: boolean; onclose: () => void; oncredits?: () => void } = $props();

  let logCount = $state(untrack(() => game.telemetry.count()));
  const RESERVED = new Set(['Escape', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
  const keyName = (code: string) => code.replace(/^Key/, '').replace(/^Digit/, '');

  /** Capture the next key for Push. Escape cancels; navigation keys stay reserved. */
  function startRebind() {
    rebinding = true;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      window.removeEventListener('keydown', onKey, true);
      rebinding = false;
      if (e.code === 'Escape' || RESERVED.has(e.code) || !/^[A-Za-z0-9]{1,24}$/.test(e.code)) return;
      set('pushKey', e.code);
    };
    window.addEventListener('keydown', onKey, true);
  }

  function exportLog() {
    const blob = new Blob([game.telemetry.export()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sisyphus-playtest-log-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  let exportText = $state('');
  let importText = $state('');
  let importPreview = $state<{ state: GameState } | null>(null);
  let importError = $state<string | null>(null);
  let resetConfirm = $state('');
  let busy = $state(false);

  function set<K extends keyof Options>(key: K, value: Options[K]) {
    options = { ...options, [key]: value };
    game.setOption(key, value);
  }

  function doExport() {
    exportText = game.exportSave();
    const blob = new Blob([exportText], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sisyphus-unchained-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function inspect() {
    importError = null;
    importPreview = null;
    const r = game.inspectImport(importText);
    if (r.ok) importPreview = { state: r.state };
    else importError = r.error;
  }

  async function applyImport() {
    if (!importPreview || busy) return;
    busy = true;
    try {
      await game.applyImport(importPreview.state);
      options = { ...game.state.options };
      onclose();
    } catch {
      importError = 'The save could not be imported. Please try again.';
    } finally { busy = false; }
  }

  async function reset() {
    if (busy || resetConfirm !== 'RESET') return;
    busy = true;
    try {
      await game.resetSave();
      options = { ...game.state.options };
      onclose();
    } catch {
      importError = 'Progress could not be reset. Please try again.';
    } finally { busy = false; }
  }
</script>

<Modal title="Settings" {onclose}>
  <fieldset>
    <legend>Controls and comfort</legend>
    <label><input type="checkbox" checked={options.toggleMode} onchange={(e) => set('toggleMode', e.currentTarget.checked)} /> Push toggles on and off instead of holding</label>
    <label><input type="checkbox" checked={options.reducedMotion} onchange={(e) => set('reducedMotion', e.currentTarget.checked)} /> Reduced motion (no shake, bursts or camera easing)</label>
    <label><input type="checkbox" checked={options.screenShake} onchange={(e) => set('screenShake', e.currentTarget.checked)} /> Screen shake on impacts</label>
    <label><input type="checkbox" checked={options.flashFree} onchange={(e) => set('flashFree', e.currentTarget.checked)} /> Flash-free decree effects</label>
    <label>
      Effects
      <select
        value={options.richEffects ? options.effectsQuality : 'off'}
        onchange={(e) => {
          const v = e.currentTarget.value;
          set('richEffects', v !== 'off');
          if (v !== 'off') set('effectsQuality', v === 'balanced' ? 'balanced' : 'full');
        }}
      >
        <option value="full">Full (particles, light, glaze and distortion)</option>
        <option value="balanced">Balanced (lighter light and fewer particles)</option>
        <option value="off">Off (plain painted scene)</option>
      </select>
    </label>
    <label><input type="checkbox" checked={options.ambientCaptions} onchange={(e) => set('ambientCaptions', e.currentTarget.checked)} /> Ambient captions</label>
    <label><input type="checkbox" checked={options.highContrast} onchange={(e) => set('highContrast', e.currentTarget.checked)} /> High-contrast panels</label>
    <button onclick={() => game.platform.toggleFullscreen()}>Toggle fullscreen{game.platform.kind === 'desktop' ? ' (F11)' : ''}</button>
    <label>
      Text size
      <input type="range" min="0.85" max="1.5" step="0.05" value={options.textScale} oninput={(e) => set('textScale', Number(e.currentTarget.value))} />
      <span class="hint">{Math.round(options.textScale * 100)}%</span>
    </label>
  </fieldset>

  <fieldset class="desktop-only">
    <legend>Keys and controller</legend>
    <div class="keyrow">
      <span>Push key</span>
      <kbd>{keyName(options.pushKey)}</kbd>
      <button onclick={startRebind} disabled={rebinding}>{rebinding ? 'Press a key… (Esc cancels)' : 'Change'}</button>
      {#if options.pushKey !== 'Space'}<button onclick={() => set('pushKey', 'Space')}>Reset</button>{/if}
    </div>
    <p class="hint">Controller: A pushes or confirms · B backs out · Y purchases · X empire · LB/RB switch hills · D-pad moves between rows · Start pauses.</p>
  </fieldset>

  <fieldset>
    <legend>Sound</legend>
    <p class="hint">Set the mood of your eternal shift. Sound starts after your first interaction.</p>
    {#each [['effectsVolume', 'Effects'], ['musicVolume', 'Music'], ['interfaceVolume', 'Interface']] as const as [key, label] (key)}
      <label>
        {label}
        <input type="range" min="0" max="1" step="0.05" value={options[key]} oninput={(e) => set(key, Number(e.currentTarget.value))} />
        <span class="hint">{Math.round(options[key] * 100)}%</span>
      </label>
    {/each}
  </fieldset>

  <fieldset>
    <legend>Save</legend>
    <p class="hint">
      {game.platform.kind === 'desktop'
        ? 'Progress saves automatically to your user folder, with rotating backups. Export a copy to keep it safe or continue on another device.'
        : 'Progress saves automatically in this browser. Export a copy to keep it safe or continue on another device.'}
    </p>
    <button onclick={doExport}>Export save</button>
    {#if game.platform.revealSaves}<button onclick={game.platform.revealSaves}>Open save folder</button>{/if}
    {#if exportText}
      <textarea readonly rows="3" aria-label="Exported save">{exportText}</textarea>
    {/if}
    {#if game.loadProblem}
      <p class="hint">A damaged save was kept.</p>
      <textarea readonly rows="2" aria-label="Damaged save">{game.loadProblem.raw}</textarea>
    {/if}

    <label for="import">Import a save</label>
    <textarea id="import" rows="3" bind:value={importText} oninput={() => { importPreview = null; importError = null; }} placeholder="Paste exported save text" spellcheck="false"></textarea>
    <button onclick={inspect} disabled={!importText.trim() || busy}>Check import</button>
    {#if importError}<p class="bad" role="alert">{importError}</p>{/if}
    {#if importPreview}
      {@const s = importPreview.state}
      <div class="preview">
        <p>Run: {formatMoney(s.wallet.runGross)} Defiance, {formatMoney(s.empire.sites[0]?.purse ?? s.wallet.runGross)} Obols on the First Hill, {s.empire.sites.length} hill(s)</p>
        <p>Record: {formatMoney(s.wallet.bestRunGross)} · Insight {s.prestige.lifetimeInsightAwarded} · Relics {s.discoveries.relicIds.length}</p>
        <p>Saved {new Date(s.lastSettledUtc).toLocaleString()}</p>
        <button class="danger" disabled={busy} onclick={applyImport}>{busy ? 'Saving…' : 'Replace current progress'}</button>
      </div>
    {/if}
  </fieldset>

  <fieldset>
    <legend>Playtest log</legend>
    <label><input type="checkbox" checked={options.telemetry} onchange={(e) => set('telemetry', e.currentTarget.checked)} /> Record a local playtest log</label>
    <p class="hint">Stays in this browser and is never sent anywhere. It lists milestones such as purchases and hills opened, with times and balances, and nothing personal. {logCount} entries.</p>
    <div class="keyrow">
      <button onclick={exportLog} disabled={!logCount}>Export log</button>
      <button onclick={() => (game.telemetry.clear(), (logCount = 0))} disabled={!logCount}>Clear log</button>
    </div>
  </fieldset>

  {#if oncredits}
    <fieldset>
      <legend>Ending</legend>
      <button onclick={oncredits}>Watch the credits again</button>
    </fieldset>
  {/if}

  <fieldset>
    <legend>Reset save</legend>
    <p class="hint">Erases all progress, including Insight and relics. This is not Begin Again. A recovery copy is kept, but export a copy first if you might want it back.</p>
    <button onclick={doExport}>Export a copy first</button>
    <label>Type RESET to confirm <input bind:value={resetConfirm} /></label>
    <button class="danger" disabled={resetConfirm !== 'RESET' || busy} onclick={reset}>Erase progress</button>
  </fieldset>
  <p class="hint version">Sisyphus: Unchained {__APP_VERSION__} · {game.platform.kind === 'desktop' ? 'desktop' : 'browser'} · save stored in {game.store.kind}</p>
</Modal>

<style>
  /* Sections are headed like the scroll's: small capitals over a hairline. */
  fieldset {
    /* A fieldset never shrinks below its content by default; on phones it must. */
    min-width: 0;
    border: 1px solid rgba(92, 60, 26, 0.22);
    border-radius: 3px;
    padding: 0.8rem;
    margin: 0.75rem 0 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.55rem;
    background: linear-gradient(135deg, rgba(255, 252, 242, 0.34), rgba(130, 82, 30, 0.05));
    box-shadow: inset 0 1px rgba(255, 255, 255, 0.35);
  }
  legend {
    width: 100%;
    padding: 0 0.15rem 0.38rem;
    margin-bottom: 0.05rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #69462a;
    border-bottom: 1px solid var(--rule);
  }
  label {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    min-height: 32px;
  }
  input[type='checkbox'] {
    width: 22px;
    height: 22px;
    flex-shrink: 0;
  }
  label:has(input[type='checkbox']) {
    margin: 0 -0.25rem;
    padding: 0.34rem 0.45rem;
    border-radius: 3px;
    line-height: 1.25;
  }
  label:has(input[type='checkbox']):hover { background: rgba(149, 68, 33, 0.07); }
  input:not([type]) { min-width: 0; width: 100%; }
  select {
    flex: 1;
    min-width: 0;
    max-width: 100%;
    min-height: 40px;
    padding: 0.35rem 2rem 0.35rem 0.55rem;
    border: 1px solid rgba(74, 45, 20, 0.48);
    border-radius: 3px;
    background-color: rgba(255, 250, 237, 0.72);
    text-overflow: ellipsis;
  }
  label:has(input[type='range']) { display: grid; grid-template-columns: 5rem 1fr 2.5rem; }
  label:has(input:not([type])) { flex-wrap: wrap; }
  textarea {
    width: 100%;
    font-family: monospace;
    font-size: 0.75rem;
  }
  fieldset > button { justify-self: start; }
  fieldset:last-of-type {
    border-color: rgba(122, 31, 18, 0.34);
    background: linear-gradient(135deg, rgba(255, 245, 231, 0.36), rgba(122, 31, 18, 0.06));
  }
  .hint {
    margin: 0;
    color: var(--muted);
    font-size: 0.9rem;
  }
  .bad {
    color: #7a1f12;
  }
  .preview {
    border-left: 4px solid var(--bronze);
    padding-left: 0.6rem;
  }
  .version {
    margin-top: 1rem;
    font-size: 0.85rem;
  }
  .keyrow {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }
  kbd {
    font-family: var(--body);
    min-width: 2.5rem;
    text-align: center;
    padding: 0.2rem 0.6rem;
    border: 1px solid rgba(33, 27, 23, 0.6);
    border-bottom-width: 3px;
    border-radius: 2px;
    background: rgba(255, 252, 244, 0.6);
  }
  @media (hover: none) and (pointer: coarse) {
    .desktop-only { display: none; }
  }
  .danger {
    background: #7a1f12;
    color: var(--ivory);
  }
  @media (max-width: 600px) {
    fieldset { padding: 0.7rem; margin-top: 0.6rem; }
    fieldset > button { width: 100%; justify-self: stretch; }
    label:has(select) { align-items: stretch; flex-direction: column; gap: 0.25rem; }
    label:has(input[type='range']) { grid-template-columns: 4.4rem minmax(0, 1fr) 2.4rem; }
    .keyrow button { flex: 1 1 auto; }
  }
</style>
