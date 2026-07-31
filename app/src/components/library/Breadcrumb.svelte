<script>
  // The breadcrumb renders the navigation stack directly. Each slot carries its real stack index,
  // so middle truncation cannot misroute a click.
  import { lib, truncateTo, crumbSlots, articleDepth } from '../../lib/library.svelte.js';

  let { onmap } = $props();

  let slots = $derived(crumbSlots(lib.stack, lib.crumbsOpen));
  let depth = $derived(articleDepth(lib.stack));
</script>

<div class="navrow">
  <div class="crumbs">
    {#each slots as s, k}
      {#if k > 0}<span class="sep">›</span>{/if}
      {#if s.ellipsis}
        <button class="ell" title={s.hidden.join(' › ')} onclick={() => (lib.crumbsOpen = true)}>…</button>
      {:else if s.i === lib.stack.length - 1}
        <span class="cur">{s.label}</span>
      {:else}
        <button onclick={() => truncateTo(s.i)}>{s.label}</button>
      {/if}
    {/each}
    <!-- only worth remarking on once you have actually gone somewhere -->
    {#if depth >= 3}<span class="depth">{depth} deep</span>{/if}
  </div>
  {#if lib.stack.length > 1}
    <button class="mapbtn" onclick={onmap}>⁂ View path map</button>
  {/if}
</div>

<style>
  /* trail left, map link right, so the link holds one position instead of sliding as the trail grows */
  .navrow { display: flex; align-items: baseline; justify-content: space-between; gap: 16px;
    min-height: 21px; margin-top: 11px; }
  .crumbs { display: flex; align-items: baseline; gap: 7px; flex-wrap: wrap; min-width: 0;
    font-size: 14px; color: var(--dim); }
  .crumbs button { background: none; border: none; font-family: inherit; font-size: 14px;
    color: var(--b); cursor: pointer; padding: 0; }
  .crumbs button:hover { text-decoration: underline; }
  .sep { opacity: .5; font-size: 12px; }
  .cur { color: var(--ink); }
  .ell { color: var(--dim) !important; letter-spacing: .06em; }
  .ell:hover { color: var(--ink) !important; text-decoration: none !important; }
  .depth { font-size: 10px; color: var(--a); border: 1px solid var(--rule); border-radius: 9px;
    padding: 1px 7px; letter-spacing: .08em; font-variant: small-caps; }
  /* a link, not a button — it is a way of looking at the trail beside it, not an action */
  .mapbtn { background: none; border: none; padding: 0; font-family: inherit; font-size: 12px;
    color: var(--b); cursor: pointer; white-space: nowrap; }
  .mapbtn:hover { text-decoration: underline; text-underline-offset: 2px; }
</style>
