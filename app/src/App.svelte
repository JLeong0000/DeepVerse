<script>
  import { onMount } from 'svelte';
  import { toggleTheme, isDark } from './lib/theme.js';
  import { loadDb } from './lib/db.js';
  import { route, go } from './lib/router.svelte.js';
  import Home from './routes/Home.svelte';
  import Study from './routes/Study.svelte';
  import Comparison from './routes/Comparison.svelte';
  import NotesPage from './routes/NotesPage.svelte';

  let dark = $state(false);
  let loaded = $state(false);
  let error = $state(null);

  onMount(async () => {
    dark = isDark();
    try { await loadDb(); loaded = true; }
    catch (e) { error = String(e); }
  });

  function flip() { dark = toggleTheme(); }
</script>

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

<style>
  .top { display: flex; align-items: center; gap: 18px; padding: 9px 22px; border-bottom: 1px solid var(--rule); }
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
