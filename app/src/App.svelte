<script>
  import { onMount } from 'svelte';
  import { toggleTheme, isDark } from './lib/theme.js';
  import { loadDb } from './lib/db.js';
  import { route, go } from './lib/router.svelte.js';
  import { study } from './lib/study.svelte.js';
  import { lib, pushNode, resetLibrary } from './lib/library.svelte.js';
  import Home from './routes/Home.svelte';
  import Study from './routes/Study.svelte';
  import Comparison from './routes/Comparison.svelte';
  import NotesPage from './routes/NotesPage.svelte';
  import SettingsPage from './routes/SettingsPage.svelte';
  import Library from './routes/Library.svelte';
  import Loading from './components/common/Loading.svelte';
  import { fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  let dark = $state(false);
  let loaded = $state(false);   // db ready: routes render + book starts fading out (phase 1)
  let splashUp = $state(true);  // splash overlay present: dropped after phase 1 to reveal UI (phase 2)
  let error = $state(null);

  // ---- URL <-> state sync (browser back/forward + shareable links) ----
  // #/home  ·  #/study/John/12[/25]  ·  #/compare/John/12  ·  #/notes
  function serialize() {
    const v = route.view;
    if (v === 'study') return `#/study/${study.book}/${study.chapter}${study.verse ? '/' + study.verse : ''}`;
    if (v === 'compare') return `#/compare/${study.book}/${study.chapter}`;
    if (v === 'library') {
      const n = lib.stack.at(-1);
      // The article's anchor (a "## Cattle" subhead a door pointed at) rides along so a bookmarked
      // or reloaded link scrolls to the same place the original door landed on, not just the top
      // of the article.
      if (n.kind === 'article') return `#/library/article/${encodeURIComponent(n.id)}${n.anchor ? '/' + encodeURIComponent(n.anchor) : ''}`;
      if (n.kind === 'hub') return `#/library/book/${n.book}`;
      if (n.kind === 'passage') return `#/library/${n.pkind}/${encodeURIComponent(n.title)}`;
      // A dictionary letter can itself be '#' (Task 4's bucket for non-A–Z sort titles). Encoding
      // it keeps that literal character from riding along as a second, meaningless fragment marker.
      if (n.kind === 'route') return `#/library/${n.route}${n.letter ? '/' + encodeURIComponent(n.letter) : ''}`;
      return '#/library';
    }
    return `#/${v}`;
  }
  function applyHash() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    const view = ['home', 'study', 'compare', 'notes', 'settings', 'library'].includes(parts[0]) ? parts[0] : 'home';
    route.view = view;
    if ((view === 'study' || view === 'compare') && parts[1] && parts[2]) {
      study.book = parts[1];
      study.chapter = +parts[2];
      study.verse = parts[3] ? +parts[3] : null;
      study.verseEnd = null; study.word = null;
    }
    if (view === 'library' && parts[1]) {
      resetLibrary();
      if (parts[1] === 'article' && parts[2]) {
        const id = decodeURIComponent(parts[2]);
        pushNode({ kind: 'article', id, title: id, anchor: parts[3] ? decodeURIComponent(parts[3]) : null });
      } else if (parts[1] === 'book' && parts[2]) {
        pushNode({ kind: 'hub', book: parts[2] });
      } else if ((parts[1] === 'theme' || parts[1] === 'profile') && parts[2]) {
        // `book` is the anchor PassageIndex/SearchSurface both attach to a passage node, but no
        // consumer reads it back off the node — getPassage(kind, title) is already a safe lookup
        // key on its own (titles are unique within a kind) — and it isn't knowable synchronously
        // here anyway: applyHash can run before the db is loaded. PassageSurface fills it in once
        // the row loads, the same way ArticleSurface backfills a restored article's title.
        pushNode({ kind: 'passage', pkind: parts[1], title: decodeURIComponent(parts[2]) });
      } else if (['dict', 'themes', 'profiles', 'books'].includes(parts[1])) {
        pushNode({ kind: 'route', route: parts[1], letter: parts[2] ? decodeURIComponent(parts[2]) : undefined });
      }
    }
    navKey = keyOf();
  }
  // keyed on the current node's identity, not stack depth: a path-map branch jump truncates then
  // pushes and can land on the same depth, which would skip the history entry. A passage node has
  // no `id`, only a `book` (shared by every other passage anchored in it) and a `title` (unique
  // only *within* a pkind, per getPassage's own contract — "The Son of Man" is both a theme and a
  // profile) — keying on title alone would still collide a theme with a same-titled profile at the
  // same depth back into the very same bug this identity check exists to avoid.
  // n.q (the search term) is deliberately excluded here: Library.svelte's onInput already uses
  // replaceTop for every keystroke on an existing search node (a term change is not a new step —
  // see its comment), but libIdent used to fold n.q into the identity anyway, so a term change
  // looked like a new node to keyOf() and pushed a history entry per keystroke regardless. One
  // search crumb should cost one history entry no matter how the term inside it changes.
  const libIdent = (n) => (n.kind === 'passage' ? `${n.pkind}:${n.title}` : (n.id ?? n.book ?? n.route ?? ''));
  const libKey = () => {
    const n = lib.stack.at(-1);
    return `${lib.stack.length}:${n.kind}:${libIdent(n)}${n.letter ?? ''}`;
  };
  const keyOf = () => `${route.view}/${study.book}/${study.chapter}/${route.view === 'library' ? libKey() : ''}`;
  let navKey = keyOf();

  // The URL alone only ever encodes the current *leaf* (an article id, a hub's book, ...) — never
  // the trail that led there, which is exactly why `applyHash` collapses to a 2-deep stack on a
  // fresh load. That collapse is correct for a bookmark/reload (no prior state exists to recover),
  // but the same `applyHash` used to run for *every* Back/Forward too, discarding the real,
  // already-in-memory trail on every step. Back is supposed to walk the trail, not re-derive a
  // shorter one from the URL each time. Fix: carry the real trail in `history.state` (structured
  // clone via $state.snapshot, since lib.stack is a reactive proxy) on every push/replace, and on
  // Back/Forward prefer restoring that verbatim over reparsing the URL.
  const snapshot = () => ({
    view: route.view, book: study.book, chapter: study.chapter, verse: study.verse,
    stack: $state.snapshot(lib.stack),
  });
  function restoreState(state) {
    route.view = state.view;
    study.book = state.book; study.chapter = state.chapter; study.verse = state.verse;
    study.verseEnd = null; study.word = null;
    lib.stack = state.stack;
    navKey = keyOf();
  }

  // Parse a deep link synchronously, before the URL-sync effect below ever runs. That effect's
  // first pass fires with route.view still at its module default ('home') if this hasn't run
  // yet — and it would then replaceState a real deep link (#/library, #/study/Genesis/3, ...)
  // over with '#/home' before onMount gets a chance to read the original hash. Confirmed by
  // reproducing on a fresh tab: the effect fired first, saw route.view === 'home', and clobbered
  // location.hash from the requested deep link to '#/home' — onMount's own applyHash() call then
  // read that already-corrupted hash and settled on 'home' too. Every hash-parametrized view
  // (study/compare/notes/settings/library) was equally exposed; it wasn't specific to library.
  if (location.hash.length > 2) applyHash();

  // A new view/book/chapter pushes a history entry; a verse-only change replaces (no history spam).
  // applyHash()/restoreState() both resync navKey, so a back/forward/manual hash change only
  // replaces (never re-pushes).
  $effect(() => {
    void `${route.view}/${study.book}/${study.chapter}/${study.verse}/${lib.stack.length}/${lib.stack.at(-1)?.id ?? ''}`; // establish reactive deps
    const url = serialize();
    if (keyOf() !== navKey) { history.pushState(snapshot(), '', url); navKey = keyOf(); }
    else { history.replaceState(snapshot(), '', url); }
  });

  // Back/Forward between two of our own entries fires *both* `popstate` (carrying the trail via
  // `event.state`) and `hashchange` (the fragment differs) — checking `history.state` directly,
  // rather than either event's own payload, means it doesn't matter which fires first or that
  // `hashchange` events carry no state at all: `history.state` already reflects the entry we've
  // landed on by the time either handler runs, so both call this and agree. A manual hash edit or
  // a bookmark fires only `hashchange`, with `history.state` null — the browser created that entry,
  // not us — which is the one remaining case that needs the URL-only rebuild.
  function onHistoryNav() {
    if (history.state) restoreState(history.state);
    else applyHash();
  }

  onMount(async () => {
    dark = isDark();
    window.addEventListener('popstate', onHistoryNav);
    window.addEventListener('hashchange', onHistoryNav);
    // Sequential splash-out: db ready → book fades to blank (phase 1) → then the blank
    // overlay is dropped so the UI fades in (phase 2). The delay clears the book fade first.
    try { await loadDb(); loaded = true; setTimeout(() => { splashUp = false; }, 430); }
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
      <button class="navlink" class:active={route.view === 'library'} onclick={() => go('library')}>Library</button>
      <button class="navlink" class:active={route.view === 'compare'} onclick={() => go('compare')}>Compare</button>
      <button class="navlink" class:active={route.view === 'notes'} onclick={() => go('notes')}>Memo</button>
    </nav>
    <div class="right">
      <button class="toggle" onclick={flip} aria-label="Toggle theme">{dark ? '☀' : '☾'}</button>
      <button class="toggle gear" class:active={route.view === 'settings'} onclick={() => go('settings')} aria-label="Settings">⚙</button>
    </div>
  </div>

  <div class="content">
    {#if error}
      <div class="gate err">Failed to load bible.db: {error}</div>
    {:else if loaded}
      {#if route.view === 'study'}
        <Study />
      {:else if route.view === 'compare'}
        <Comparison />
      {:else if route.view === 'notes'}
        <NotesPage />
      {:else if route.view === 'settings'}
        <SettingsPage />
      {:else if route.view === 'library'}
        <Library />
      {:else}
        <Home />
      {/if}
    {/if}
  </div>

  <!-- Splash overlay covers the header + UI while bible.db loads. On ready the book
       fades to blank (.splash → .hide), then the blank overlay is dropped and its
       out:fade reveals the UI — two sequential phases, not a crossfade. -->
  {#if splashUp && !error}
    <div class="loadscreen" out:fade={{ duration: 450, easing: cubicOut }}>
      <div class="splash" class:hide={loaded}>
        <Loading />
      </div>
    </div>
  {/if}
</div>

<style>
  .approot { height: 100vh; display: flex; flex-direction: column; }
  .content { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .top { flex: none; display: flex; align-items: center; gap: 18px; padding: 9px 22px; border-bottom: 1px solid var(--rule); }
  .plain { background: none; border: none; padding: 0; cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; gap: 8px; }
  .logo { border-radius: 5px; display: block; }
  nav { display: flex; gap: 4px; }
  .navlink {
    background: none; border: none; cursor: pointer; font-family: inherit; color: var(--dim);
    font-variant: small-caps; letter-spacing: .06em; font-size: 12px; padding: 3px 8px; border-radius: 5px;
  }
  .navlink:hover { color: var(--ink); }
  .navlink.active { color: var(--a); }
  .right { margin-left: auto; display: flex; align-items: center; gap: 6px; }
  .toggle.active { color: var(--a); }
  /* ⚙ sits optically high in its em-box; larger glyph + line-height 1 recenters it in the circle */
  .gear { font-size: 18px; line-height: 1; }
  .gate { padding: 40px 30px; }
  .err { color: var(--a); }
  .loadscreen {
    position: fixed; inset: 0; z-index: 50;
    background: var(--bg);
    display: flex; flex-direction: column;
  }
  .splash { flex: 1; min-height: 0; display: flex; flex-direction: column; transition: opacity 400ms ease; }
  .splash.hide { opacity: 0; }
</style>
