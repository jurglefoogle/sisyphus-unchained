<script lang="ts">
  import type { Game } from '../app/game';
  import type { GameState, Options } from '../core/state';
  import { formatMoney } from '../core/format';
  import Modal from './Modal.svelte';

  let { game, options = $bindable(), onclose }: { game: Game; options: Options; onclose: () => void } = $props();

  let exportText = $state('');
  let importText = $state('');
  let importPreview = $state<{ state: GameState } | null>(null);
  let importError = $state<string | null>(null);
  let resetConfirm = $state('');

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
    if (!importPreview) return;
    await game.applyImport(importPreview.state);
    options = { ...game.state.options };
    onclose();
  }

  async function reset() {
    await game.resetSave();
    onclose();
  }
</script>

<Modal title="Settings" {onclose}>
  <fieldset>
    <legend>Controls and comfort</legend>
    <label><input type="checkbox" checked={options.toggleMode} onchange={(e) => set('toggleMode', e.currentTarget.checked)} /> Push toggles on and off instead of holding</label>
    <label><input type="checkbox" checked={options.reducedMotion} onchange={(e) => set('reducedMotion', e.currentTarget.checked)} /> Reduced motion (no shake, bursts or camera easing)</label>
    <label><input type="checkbox" checked={options.ambientCaptions} onchange={(e) => set('ambientCaptions', e.currentTarget.checked)} /> Ambient captions</label>
    <label><input type="checkbox" checked={options.highContrast} onchange={(e) => set('highContrast', e.currentTarget.checked)} /> High-contrast panels</label>
    <label>
      Text size
      <input type="range" min="0.85" max="1.5" step="0.05" value={options.textScale} oninput={(e) => set('textScale', Number(e.currentTarget.value))} />
    </label>
  </fieldset>

  <fieldset>
    <legend>Save</legend>
    <p class="hint">Saved automatically in this browser ({game.store.kind}). Browser storage can be cleared; export a copy to keep it safe.</p>
    <button onclick={doExport}>Export save</button>
    {#if exportText}
      <textarea readonly rows="3" aria-label="Exported save">{exportText}</textarea>
    {/if}
    {#if game.loadProblem}
      <p class="hint">A damaged save was kept.</p>
      <textarea readonly rows="2" aria-label="Damaged save">{game.loadProblem.raw}</textarea>
    {/if}

    <label for="import">Import a save</label>
    <textarea id="import" rows="3" bind:value={importText} placeholder="Paste exported save text"></textarea>
    <button onclick={inspect} disabled={!importText.trim()}>Check import</button>
    {#if importError}<p class="bad">{importError}</p>{/if}
    {#if importPreview}
      {@const s = importPreview.state}
      <div class="preview">
        <p>Run: {formatMoney(s.wallet.runGross)} Defiance, {formatMoney(s.wallet.obols)} Obols, {s.empire.sites.length} operation(s)</p>
        <p>Record: {formatMoney(s.wallet.bestRunGross)} · Insight {s.prestige.lifetimeInsightAwarded} · Relics {s.discoveries.relicIds.length}</p>
        <p>Saved {new Date(s.lastSettledUtc).toLocaleString()}</p>
        <button class="danger" onclick={applyImport}>Replace current progress</button>
      </div>
    {/if}
  </fieldset>

  <fieldset>
    <legend>Reset save</legend>
    <p class="hint">Erases all progress, including Insight and relics. This is not Begin Again. A recovery copy is kept.</p>
    <label>Type RESET to confirm <input bind:value={resetConfirm} /></label>
    <button class="danger" disabled={resetConfirm !== 'RESET'} onclick={reset}>Erase progress</button>
  </fieldset>
</Modal>

<style>
  fieldset {
    border: 2px solid rgba(33, 27, 23, 0.3);
    border-radius: 8px;
    margin: 0.8rem 0;
    display: grid;
    gap: 0.5rem;
  }
  legend {
    font-weight: 700;
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
  }
  textarea {
    width: 100%;
    font-family: monospace;
    font-size: 0.75rem;
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
  .danger {
    background: #7a1f12;
    color: var(--ivory);
  }
</style>
