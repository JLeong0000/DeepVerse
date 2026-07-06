<script>
  import { onMount } from 'svelte';
  import { toggleTheme, isDark } from './lib/theme.js';
  import { loadDb } from './lib/db.js';
  import { route, go } from './lib/router.svelte.js';
  import { study } from './lib/study.svelte.js';
  import Home from './routes/Home.svelte';
  import Study from './routes/Study.svelte';
  import Comparison from './routes/Comparison.svelte';
  import NotesPage from './routes/NotesPage.svelte';

  let dark = $state(false);
  let loaded = $state(false);
  let error = $state(null);

  // ---- URL <-> state sync (browser back/forward + shareable links) ----
  // #/home  ·  #/study/John/12[/25]  ·  #/compare/John/12  ·  #/notes
  function serialize() {
    const v = route.view;
    if (v === 'study') return `#/study/${study.book}/${study.chapter}${study.verse ? '/' + study.verse : ''}`;
    if (v === 'compare') return `#/compare/${study.book}/${study.chapter}`;
    return `#/${v}`;
  }
  function applyHash() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    const view = ['home', 'study', 'compare', 'notes'].includes(parts[0]) ? parts[0] : 'home';
    route.view = view;
    if ((view === 'study' || view === 'compare') && parts[1] && parts[2]) {
      study.book = parts[1];
      study.chapter = +parts[2];
      study.verse = parts[3] ? +parts[3] : null;
      study.verseEnd = null; study.word = null;
    }
    navKey = keyOf();
  }
  const keyOf = () => `${route.view}/${study.book}/${study.chapter}`; // a new history entry per view/chapter
  let navKey = keyOf();

  // A new view/book/chapter pushes a history entry; a verse-only change replaces (no history spam).
  // applyHash() resyncs navKey, so a back/forward/manual hash change only replaces (never re-pushes).
  $effect(() => {
    void `${route.view}/${study.book}/${study.chapter}/${study.verse}`; // establish reactive deps
    const url = serialize();
    if (keyOf() !== navKey) { history.pushState(null, '', url); navKey = keyOf(); }
    else { history.replaceState(null, '', url); }
  });

  onMount(async () => {
    dark = isDark();
    if (location.hash.length > 2) applyHash();
    // hashchange fires on back/forward (hash URLs) and manual edits/bookmarks; our own pushState
    // does not fire it, so this only reacts to real navigation.
    window.addEventListener('hashchange', applyHash);
    try { await loadDb(); loaded = true; }
    catch (e) { error = String(e); }
  });

  function flip() { dark = toggleTheme(); }
</script>

<div class="approot">
  <div class="top">
    <button class="brand plain" onclick={() => go('home')}>
      <img class="logo" src="/deepverse-192.png" alt="" width="24" height="24" />
      <span>DeepVerse</span>
    </button>
    <nav>
      <button class="navlink" class:active={route.view === 'home'} onclick={() => go('home')}>Home</button>
      <button class="navlink" class:active={route.view === 'study'} onclick={() => go('study')}>Study</button>
      <button class="navlink" class:active={route.view === 'compare'} onclick={() => go('compare')}>Compare</button>
      <button class="navlink" class:active={route.view === 'notes'} onclick={() => go('notes')}>Notes</button>
    </nav>
    <button class="toggle" onclick={flip} aria-label="Toggle theme">{dark ? '☀' : '☾'}</button>
  </div>

  <div class="content">
    {#if error}
      <div class="gate err">Failed to load bible.db: {error}</div>
    {:else if !loaded}
      <div class="gate dim">Loading bible.db…</div>
    {:else if route.view === 'study'}
      <Study />
    {:else if route.view === 'compare'}
      <Comparison />
    {:else if route.view === 'notes'}
      <NotesPage />
    {:else}
      <Home />
    {/if}
  </div>
</div>

<style>
  .approot { height: 100vh; display: flex; flex-direction: column; }
  .content { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .top { flex: none; display: flex; align-items: center; gap: 18px; padding: 9px 22px; border-bottom: 1px solid var(--rule); }
  .plain { background: none; border: none; padding: 0; cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; gap: 8px; }
  .logo { border-radius: 5px; display: block; box-shadow: 0 1px 3px rgba(0,0,0,.3); }
  nav { display: flex; gap: 4px; }
  .navlink {
    background: none; border: none; cursor: pointer; font-family: inherit; color: var(--dim);
    font-variant: small-caps; letter-spacing: .06em; font-size: 12px; padding: 3px 8px; border-radius: 5px;
  }
  .navlink:hover { color: var(--ink); }
  .navlink.active { color: var(--a); }
  .toggle { margin-left: auto; }
  .gate { padding: 40px 30px; }
  .dim { color: var(--dim); }
  .err { color: var(--a); }
</style>
