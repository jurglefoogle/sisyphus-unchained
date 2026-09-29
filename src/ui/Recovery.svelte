<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { Game, RecoveryOption } from '../app/game';
  import Modal from './Modal.svelte';

  /** Recovery choices after a save fails validation (spec §05). The damaged bytes stay exportable. */
  let { game, onclose }: { game: Game; onclose: () => void } = $props();

  const problem = untrack(() => game.loadProblem!);
  let options = $state<RecoveryOption[] | null>(null);
  let busy = $state(false);
  let failed = $state(false);
  let confirmFresh = $state(false);

  onMount(() => {
    void game.recoveryOptions().then((o) => (options = o));
  });

  function exportDamaged() {
    const blob = new Blob([problem.raw], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sisyphus-unchained-damaged-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function restore(key: string) {
    if (busy) return;
    busy = true;
    failed = !(await game.restoreFrom(key));
    busy = false;
    if (!failed) onclose();
  }

  async function fresh() {
    if (busy) return;
    busy = true;
    await game.startFresh();
    busy = false;
    onclose();
  }
</script>

<Modal title="Your save needs attention" {onclose}>
  <p>The latest save could not be loaded: <strong>{problem.error}</strong></p>
  <p class="hint">
    {problem.restored ? 'The newest working backup is loaded so you can keep playing.' : 'No working backup was found, so a new game is running for now.'}
    Nothing has been deleted. The damaged save is kept and can be exported.
  </p>

  <h3>Restore a copy</h3>
  {#if options === null}
    <p class="hint">Looking for backups…</p>
  {:else if options.length === 0}
    <p class="hint">No other working copies were found in this browser.</p>
  {:else}
    <ul>
      {#each options as o (o.key)}
        <li>
          <div>
            <strong>{o.label}</strong>
            <small>Saved {new Date(o.savedAt).toLocaleString()} · {o.sites} hill(s) · {o.runGross} Defiance · record {o.record} · {o.insight} Insight</small>
          </div>
          <button disabled={busy} onclick={() => restore(o.key)}>Restore</button>
        </li>
      {/each}
    </ul>
  {/if}
  {#if failed}<p class="bad" role="alert">That copy could not be restored.</p>{/if}

  <div class="actions">
    <button onclick={exportDamaged}>Export damaged save</button>
    {#if confirmFresh}
      <button class="danger" disabled={busy} onclick={fresh}>Yes, start over</button>
    {:else}
      <button onclick={() => (confirmFresh = true)}>Start a new game</button>
    {/if}
    <button class="primary" onclick={onclose}>Keep playing as is</button>
  </div>
</Modal>

<style>
  .hint { color: var(--muted); }
  h3 { font-family: var(--display); font-size: 1.2rem; margin: 1rem 0 0.4rem; }
  ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.5rem; }
  li {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    padding: 0.5rem 0.7rem;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
  }
  li div { flex: 1; display: grid; gap: 0.15rem; }
  small { color: var(--muted); }
  .actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1rem; justify-content: flex-end; }
  .primary { background: var(--clay); color: var(--ivory); }
  .danger { background: #7a1f12; color: var(--ivory); }
  .bad { color: #7a1f12; }
</style>
