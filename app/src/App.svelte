<script>
  import { onMount } from 'svelte';
  import { toggleTheme, isDark } from './lib/theme.js';
  import { loadDb, query } from './lib/db.js';

  let dark = $state(false);
  let verseCount = $state(null);
  let error = $state(null);

  onMount(async () => {
    dark = isDark();
    try {
      await loadDb();
      verseCount = query('SELECT COUNT(*) AS n FROM verses')[0].n;
    } catch (e) {
      error = String(e);
    }
  });

  function flip() { dark = toggleTheme(); }
</script>

<div class="top">
  <span class="brand">DeepVerse</span>
  <button class="toggle" onclick={flip} aria-label="Toggle theme">{dark ? '☀' : '☾'}</button>
</div>

<main class="page">
  <h1>DeepVerse — scaffold</h1>
  {#if error}
    <p class="err">Failed to load bible.db: {error}</p>
  {:else if verseCount === null}
    <p class="dim">Loading bible.db…</p>
  {:else}
    <p>bible.db loaded — <strong>{verseCount.toLocaleString()}</strong> verses.</p>
  {/if}
</main>

<style>
  .top { display: flex; align-items: center; gap: 12px; padding: 9px 18px; }
  .top .toggle { margin-left: auto; }
  .page { padding: 6px 30px 28px; }
  h1 { font-size: 24px; font-weight: normal; }
  .dim { color: var(--dim); }
  .err { color: var(--a); }
</style>
