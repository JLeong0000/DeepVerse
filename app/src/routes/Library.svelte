<script>
  // The library frame: search field and breadcrumb above, one surface below. No sidebar —
  // start -> a route's index -> an article, with the breadcrumb as the way back.
  import { tick } from 'svelte';
  import { lib, pushNode, replaceTop, popNode, flattenSearchResults } from '../lib/library.svelte.js';
  import { getRandomArticle, searchLibrary } from '../lib/db.js';
  import Breadcrumb from '../components/library/Breadcrumb.svelte';
  import StartSurface from '../components/library/StartSurface.svelte';
  import DictionaryIndex from '../components/library/DictionaryIndex.svelte';
  import PassageIndex from '../components/library/PassageIndex.svelte';
  import BookIndex from '../components/library/BookIndex.svelte';
  import BookHub from '../components/library/BookHub.svelte';
  import ArticleSurface from '../components/library/ArticleSurface.svelte';
  import PassageSurface from '../components/library/PassageSurface.svelte';
  import SearchSurface from '../components/library/SearchSurface.svelte';
  import PathMap from '../components/library/PathMap.svelte';

  let term = $state('');
  let inputEl = $state(null);
  let searchHighlight = $state(0);   // ↑↓ traversal position, per WordSearch.svelte's pattern

  let current = $derived(lib.stack.at(-1));
  // The exact nodes Enter/↑↓ walk, in the same order SearchSurface renders them in.
  let searchNodes = $derived(current.kind === 'search' ? flattenSearchResults(searchLibrary(current.q)) : []);

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
    searchHighlight = 0;   // a new term is a new result set — same as WordSearch resetting on input
    if (q.length < 2) {
      if (current.kind === 'search') popNode();
      return;
    }
    if (current.kind === 'search') replaceTop({ kind: 'search', q });
    else pushNode({ kind: 'search', q });
  }

  // ↑↓ move the selection among the current search results; Enter opens the selected one — same
  // traversal pattern as WordSearch.svelte's onListKey, adapted to results living in a sibling
  // surface (several .cols2 groups) rather than one flat listEl of its own. Scroll-follow mirrors
  // WordSearch's tick()-then-scrollIntoView exactly; the highlighted row is found by class instead
  // of by listEl child index, since SearchSurface's results aren't one flat list.
  async function onSearchKey(e) {
    if (current.kind !== 'search') return;
    if (e.key === 'ArrowDown') { e.preventDefault(); searchHighlight = Math.min(searchHighlight + 1, searchNodes.length - 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); searchHighlight = Math.max(searchHighlight - 1, 0); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const n = searchNodes[searchHighlight];
      if (n) { pushNode(n); inputEl?.blur(); }   // blur lets the existing effect clear the field, same as a result click would
      return;
    }
    else return;
    await tick();
    document.querySelector('.surface .entry.hi')?.scrollIntoView({ block: 'nearest' });
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
  <!-- Wander belongs to the start of a trail, not to the frame. Sitting in the search row on every
       surface, it read as the field's submit button — the thing Enter would press — when it does
       the opposite of searching. The "or" is what separates the two: adjacency alone made them
       look like one control. -->
  <Breadcrumb onmap={() => (lib.mapOpen = true)}>
    {#snippet trailing()}
      {#if current.kind === 'start'}
        <span class="wrap"><button class="wander" onclick={wander}>✦ Wander in</button>
          <span class="orsep">or</span></span>
      {/if}
      <input bind:this={inputEl} bind:value={term} oninput={onInput} onkeydown={onSearchKey} class="search" type="text"
        placeholder="Search the library — / to focus…" autocomplete="off" />
    {/snippet}
  </Breadcrumb>
</div>

<div class="surface">
  <!-- An article and a passage are one column of prose; the indexes are three columns of links.
       The prose surfaces carry their own measure, so the frame centres it rather than leaving it
       pinned to the left of a 1100px grid it never fills. -->
  <div class="inner" class:reading={current.kind === 'article' || current.kind === 'passage'}>
    <!-- surfaces land here in Tasks 8–13 -->
    {#if current.kind === 'start'}
      <StartSurface />
    {:else if current.kind === 'route' && current.route === 'dict'}
      <DictionaryIndex letter={current.letter ?? null} />
    {:else if current.kind === 'route' && (current.route === 'themes' || current.route === 'profiles')}
      <PassageIndex kind={current.route} />
    {:else if current.kind === 'route' && current.route === 'books'}
      <BookIndex />
    {:else if current.kind === 'hub'}
      <BookHub book={current.book} />
    {:else if current.kind === 'article'}
      <ArticleSurface id={current.id} anchor={current.anchor ?? null} />
    {:else if current.kind === 'passage'}
      <PassageSurface pkind={current.pkind} title={current.title} />
    {:else if current.kind === 'search'}
      <SearchSurface q={current.q} highlight={searchHighlight} />
    {:else}
      <p class="stub">{current.kind}</p>
    {/if}
  </div>
</div>

{#if lib.mapOpen}
  <PathMap />
{/if}

<style>
  .frame { border-bottom: 1px solid var(--rule); background: var(--panel); padding: 10px 30px 12px; }
  .wrap { display: inline-flex; align-items: center; gap: 10px; white-space: nowrap; }
  .orsep { font-size: 11.5px; color: var(--dim); font-style: italic; }
  /* a fixed measure, not flex: the field is a control on this row, not the row itself */
  .search { width: 260px; font-family: inherit; font-size: 12.5px; padding: 5px 10px;
    border: 1px solid var(--rule); border-radius: 6px; background: var(--bg); color: var(--ink); }
  .search:focus { outline: none; border-color: var(--a); }
  /* on its own row it takes the width instead of holding a fixed measure — see Breadcrumb's
     matching breakpoint, which is what gives it that row */
  @media (max-width: 760px) {
    .search { flex: 1; width: auto; min-width: 0; }
  }
  .wander { background: transparent; border: 1px solid var(--rule); border-radius: 6px;
    padding: 4px 12px; font-family: inherit; font-size: 12px; color: var(--a); cursor: pointer;
    white-space: nowrap; font-variant: small-caps; letter-spacing: .06em; }
  .wander:hover { border-color: var(--a); background: var(--bg); }
  .surface { flex: 1; min-height: 0; overflow-y: auto; padding: 22px 30px 40px; }
  /* content centres at 1100px, matching Home.svelte's .page — a 74ch measure left-aligned in a
     full-width pane leaves the right half empty and reads as broken */
  .inner { max-width: 1100px; margin: 0 auto; }
  /* 74ch is the reading measure the article body already used; holding it here instead centres the
     title, the prose, the doors and the source together, rather than centring a 1100px box whose
     text only occupies the left 60% of it. */
  .inner.reading { max-width: 74ch; }
  .frame :global(.navrow) { max-width: 1100px; margin-left: auto; margin-right: auto; }
  .stub { color: var(--dim); font-style: italic; }
</style>
