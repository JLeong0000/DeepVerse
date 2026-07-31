<script>
  // The library frame: search field and breadcrumb above, one surface below. No sidebar —
  // start -> a route's index -> an article, with the breadcrumb as the way back.
  import { lib, pushNode, replaceTop, popNode } from '../lib/library.svelte.js';
  import { getRandomArticle } from '../lib/db.js';
  import Breadcrumb from '../components/library/Breadcrumb.svelte';
  import StartSurface from '../components/library/StartSurface.svelte';

  let term = $state('');
  let inputEl = $state(null);

  let current = $derived(lib.stack.at(-1));

  // The search crumb is a projection of `term`, not a second source of truth — so whenever the
  // stack moves off it from *outside* the field (a crumb click truncates the trail, ✦ Wander in
  // pushes an article), the field must not keep showing text that no longer has a crumb behind
  // it. Gated on focus rather than firing unconditionally: the field itself also drives the stack
  // below the threshold while the user is still backspacing through it, and clearing then would
  // eat the character they're mid-edit on.
  $effect(() => {
    if (current.kind !== 'search' && document.activeElement !== inputEl) term = '';
  });

  function onInput() {
    const q = term.trim();
    if (q.length < 2) {
      if (current.kind === 'search') popNode();
      return;
    }
    if (current.kind === 'search') replaceTop({ kind: 'search', q });
    else pushNode({ kind: 'search', q });
  }

  function wander() {
    const a = getRandomArticle();
    if (a) pushNode({ kind: 'article', id: a.id, title: a.title });
  }

  function onKey(e) {
    if (e.key === '/' && e.target !== inputEl) { e.preventDefault(); inputEl?.focus(); }
    if (e.key === 'Escape') {
      if (lib.mapOpen) { lib.mapOpen = false; return; }
      if (e.target === inputEl) {
        term = '';
        if (current.kind === 'search') popNode();
      }
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="frame">
  <div class="searchrow">
    <input bind:this={inputEl} bind:value={term} oninput={onInput} class="search" type="text"
      placeholder="Search the library — press / to focus…" autocomplete="off" />
    <button class="wander" onclick={wander}>✦ Wander in</button>
  </div>
  <Breadcrumb onmap={() => (lib.mapOpen = true)} />
</div>

<div class="surface">
  <div class="inner">
    <!-- surfaces land here in Tasks 8–13 -->
    {#if current.kind === 'start'}
      <StartSurface />
    {:else}
      <p class="stub">{current.kind}</p>
    {/if}
  </div>
</div>

<style>
  .frame { border-bottom: 1px solid var(--rule); background: var(--panel); padding: 10px 30px 12px; }
  .searchrow { display: flex; gap: 8px; }
  .search { flex: 1; font-family: inherit; font-size: 13.5px; padding: 8px 11px;
    border: 1px solid var(--rule); border-radius: 6px; background: var(--bg); color: var(--ink); }
  .search:focus { outline: none; border-color: var(--a); }
  .wander { background: transparent; border: 1px solid var(--rule); border-radius: 6px;
    padding: 0 14px; font-family: inherit; font-size: 12px; color: var(--a); cursor: pointer;
    white-space: nowrap; font-variant: small-caps; letter-spacing: .06em; }
  .wander:hover { border-color: var(--a); background: var(--bg); }
  .surface { flex: 1; min-height: 0; overflow-y: auto; padding: 22px 30px 40px; }
  /* content centres at 1100px, matching Home.svelte's .page — a 74ch measure left-aligned in a
     full-width pane leaves the right half empty and reads as broken */
  .inner { max-width: 1100px; margin: 0 auto; }
  .frame :global(.navrow) { max-width: 1100px; margin-left: auto; margin-right: auto; }
  .searchrow { max-width: 1100px; margin-left: auto; margin-right: auto; }
  .stub { color: var(--dim); font-style: italic; }
</style>
