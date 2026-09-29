<script lang="ts">
  import type { Game } from '../app/game';
  import type { GameView } from '../app/view';
  import { iconUrl } from '../world/library';
  import Modal from './Modal.svelte';

  /**
   * What Sisyphus remembers between runs: the eight permanent upgrades,
   * bought in order with Insight, kept apart from the run's purchases.
   */
  let { game, view, onclose, onprestige }: { game: Game; view: GameView; onclose: () => void; onprestige: () => void } = $props();

  const still = () => document.documentElement.classList.contains('reduced-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;

  function buy(e: MouseEvent, id: string) {
    const btn = e.currentTarget as HTMLElement;
    const r = game.buyUpgrade(id, `${view.revision}:insight:${id}`);
    if (!r.ok || still()) return;
    btn.closest('.upgrade')?.animate(
      [{ offset: 0, background: '#efe4f7', boxShadow: 'inset 0 0 0 2px #8d6fae, 0 0 22px rgba(141, 111, 174, 0.45)' }],
      { duration: 700, easing: 'ease-out' },
    );
  }

  const owned = $derived(view.insightShop.filter((u) => u.state === 'owned').length);
</script>

<Modal title="Insight" {onclose} wide>
  <div class="summary">
    <p class="balance"><img src={iconUrl('ui_insight')} alt="" /><strong>{view.insight}</strong><span>Insight to spend</span></p>
    <p class="muted">Permanent income {view.insightFactor} · {owned} of {view.insightShop.length} remembered. Spending Insight never lowers the income factor.</p>
  </div>

  <ol>
    {#each view.insightShop as u (u.id)}
      <li class="upgrade {u.state}" class:affordable={u.affordable}>
        <div class="head">
          <strong>{u.title}</strong>
          {#if u.state === 'owned'}
            <span class="tag">Remembered</span>
          {:else if u.state === 'next'}
            <button
              class="pin"
              aria-pressed={u.pinned}
              title={u.pinned ? 'Unpin goal' : 'Pin as goal'}
              aria-label={u.pinned ? `Unpin ${u.title}` : `Pin ${u.title} as your goal`}
              onclick={() => game.pinGoal(u.pinned ? null : `upgrade:${u.id}`)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l-1 6 4 4H6l4-4z M12 13v8" /></svg>
            </button>
          {/if}
        </div>
        <p class="effect">{u.effect}</p>
        {#if u.state === 'next'}
          <button class="buy" disabled={!u.affordable} onclick={(e) => buy(e, u.id)} aria-label="{u.title} for {u.cost} Insight">
            <span>Buy</span><small class="cost"><img src={iconUrl('ui_insight')} alt="" />{u.cost}</small>
          </button>
          {#if !u.affordable}<p class="note">Need {u.cost - view.insight} more Insight.</p>{/if}
        {:else if u.state === 'locked'}
          <p class="note"><img src={iconUrl('ui_lock')} alt="" />{u.cost} Insight · after {u.after}</p>
        {/if}
      </li>
    {/each}
  </ol>

  {#if view.prestige.available}
    <div class="again">
      <p>Begin Again now to claim <strong>{view.prestige.award} Insight</strong> (income {view.prestige.factorBefore} → {view.prestige.factorAfter}).</p>
      <button onclick={onprestige}>Review Begin Again</button>
    </div>
  {:else}
    <p class="muted foot">More Insight comes from Begin Again once this run beats its record of {view.prestige.record} Obols.</p>
  {/if}
</Modal>

<style>
  .summary {
    display: grid;
    gap: 0.2rem;
    margin-bottom: 0.9rem;
  }
  .balance {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    font-family: var(--display);
  }
  .balance img {
    width: 34px;
    height: 34px;
  }
  .balance strong {
    font-size: 1.8rem;
    line-height: 1;
  }
  .balance span {
    color: var(--muted);
    font-size: 0.95rem;
  }
  .muted {
    color: var(--muted);
    margin: 0;
    font-size: 0.9rem;
  }
  ol {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
    gap: 0.6rem;
  }
  .upgrade {
    border-left: 4px solid #6b4f8a;
    padding: 0.7rem 0.8rem;
    background: rgba(255, 252, 245, 0.48);
    box-shadow: inset 0 -1px var(--rule);
  }
  .upgrade.owned {
    background: rgba(107, 79, 138, 0.08);
  }
  .upgrade.locked {
    border-left-color: var(--rule);
    opacity: 0.7;
  }
  .upgrade.affordable {
    background: #fff7e8;
    box-shadow: inset 0 0 0 1px #8d6fae;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 32px;
  }
  .head strong {
    flex: 1;
    font-family: var(--display);
    font-size: 1.1rem;
    line-height: 1.15;
  }
  .tag {
    font-size: 0.72rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #6b4f8a;
  }
  .effect,
  .note {
    margin: 0.25rem 0;
    font-size: 0.9rem;
    line-height: 1.4;
  }
  .note {
    color: var(--muted);
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  .note img {
    width: 18px;
    height: 18px;
    opacity: 0.6;
  }
  .buy {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.4rem;
    padding: 0 0.9rem;
    border-radius: 3px;
    font-weight: 700;
    background: transparent;
  }
  .buy:not(:disabled) {
    background: linear-gradient(180deg, #a9532b 0%, var(--clay) 55%, #813a1c 100%);
    color: var(--ivory);
    box-shadow: inset 0 1px rgba(255, 226, 190, 0.35), 0 2px 0 var(--ink);
  }
  .buy:not(:disabled):active {
    transform: translateY(1px);
    box-shadow: inset 0 1px 3px rgba(33, 27, 23, 0.4);
  }
  .cost {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    font-size: 0.85rem;
    font-weight: 400;
  }
  .cost img {
    width: 1.05em;
    height: 1.05em;
  }
  .buy:not(:disabled) .cost img {
    filter: invert(94%) sepia(8%) saturate(400%) hue-rotate(340deg);
  }
  .pin {
    width: 44px;
    height: 44px;
    margin: -6px -4px -6px 0;
    padding: 0;
    display: grid;
    place-items: center;
    border-radius: 50%;
    border: 1px solid var(--rule);
    background: transparent;
    flex: none;
  }
  .pin svg {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: var(--muted);
    stroke-width: 1.8;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .pin[aria-pressed='true'] {
    background: var(--clay);
    border-color: var(--clay);
  }
  .pin[aria-pressed='true'] svg {
    stroke: var(--ivory);
    fill: var(--ivory);
  }
  .again {
    margin-top: 1rem;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
    padding: 0.6rem 0.75rem;
    border: 1px dashed #8d6fae;
  }
  .again p {
    flex: 1;
    margin: 0;
    min-width: 200px;
  }
  .foot {
    margin-top: 1rem;
    font-style: italic;
  }
</style>
