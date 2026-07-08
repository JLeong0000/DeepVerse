<script>
  import { parseReference } from '../../lib/refs.js';
  import { openStudy } from '../../lib/router.svelte.js';

  let value = $state('');
  let error = $state(false);

  function submit(e) {
    e.preventDefault();
    const ref = parseReference(value);
    if (!ref) { error = true; return; }
    openStudy({ book: ref.book, chapter: ref.chapter, verse: ref.verse });
    value = '';
  }
</script>

<form class="jump" onsubmit={submit}>
  <span class="ic" aria-hidden="true">→</span>
  <input class:err={error} placeholder="Jump to verse…" bind:value spellcheck="false"
    oninput={() => (error = false)} aria-label="Jump to a verse, e.g. John 3:16" />
</form>

<style>
  .jump { display: flex; align-items: center; gap: 6px; border: 1px solid var(--rule); border-radius: 6px;
    background: var(--panel); padding: 5px 9px; transition: border-color .12s; }
  .jump:focus-within { border-color: var(--a); }
  .ic { color: var(--dim); font-size: 13px; }
  input { border: none; background: transparent; outline: none; color: var(--ink); font-family: inherit;
    font-size: 13px; width: 150px; }
  input::placeholder { color: var(--dim); font-style: italic; }
  input.err { color: var(--a); }
</style>
