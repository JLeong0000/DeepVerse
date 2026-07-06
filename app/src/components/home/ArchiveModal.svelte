<script>
  import { archivedStudy } from '../../lib/store.js';
  let { open = false, onclose } = $props();

  const fmt = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  let items = $derived(open ? archivedStudy() : []);
</script>

<div class="overlay" class:open onclick={(e) => { if (e.target === e.currentTarget) onclose(); }} role="presentation">
  <div class="modal">
    <span class="x" onclick={onclose} role="button" tabindex="0">×</span>
    <h3>Past study items</h3>
    <div class="msub">Completed — checked off from your To-study list</div>
    <div class="pastlist">
      {#if items.length === 0}
        <div class="empty">Nothing archived yet.</div>
      {:else}
        {#each items as it}
          <div class="pastitem"><span class="pt">{it.text}</span><span class="pd">{fmt(it.completed_at)}</span></div>
        {/each}
      {/if}
    </div>
  </div>
</div>

<style>
  .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.42); display: none; align-items: center; justify-content: center; z-index: 60; }
  .overlay.open { display: flex; }
  .modal { background: var(--bg); color: var(--ink); border: 1px solid var(--rule); border-radius: 9px; width: min(460px,92%); max-height: 78vh; overflow: auto; padding: 18px 22px 20px; box-shadow: 0 14px 46px rgba(0,0,0,.45); }
  h3 { font-size: 15px; font-variant: small-caps; letter-spacing: .06em; margin: 0 0 2px; }
  .msub { color: var(--dim); font-size: 12px; margin-bottom: 14px; }
  .x { float: right; cursor: pointer; color: var(--dim); font-size: 18px; line-height: 1; }
  .pastitem { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-top: 1px dashed var(--rule); font-size: 13px; }
  .pastitem:first-child { border-top: none; }
  .pt { opacity: .9; } .pd { color: var(--dim); font-size: 11px; white-space: nowrap; }
  .empty { color: var(--dim); font-size: 13px; font-style: italic; padding: 8px 0; }
</style>
