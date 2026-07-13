<script>
  // English-word search over the corpus. Type an English word -> lemma suggestions (Hebrew/Greek
  // words rendered that way); pick one -> its lexicon definition, pronunciation, sense spread, and
  // the verses under each sense. Opened from the Word-of-the-day card header. Overlay conventions
  // (backdrop + modal, Escape) follow NoteOverlay.svelte.
  import { tick } from 'svelte';
  import { searchWords, getWordSenses } from '../../lib/db.js';
  import { langLabel, readTranslit, cleanGloss, parseDefinition } from '../../lib/display.js';
  import { openStudy } from '../../lib/router.svelte.js';
  import PlayButton from '../common/PlayButton.svelte';
  import SenseVerses from '../common/SenseVerses.svelte';

  let { onclose } = $props();

  let term = $state('');
  let results = $state([]);
  let highlight = $state(0);
  let selected = $state(null);        // detail view; null = search view
  let inputEl, listEl;
  let debounceId;

  function onInput() {
    clearTimeout(debounceId);
    debounceId = setTimeout(() => { results = searchWords(term); highlight = 0; }, 120);
  }

  function open(hit) {
    const s = getWordSenses(hit.strongs);
    // parse the lexicon entry into indented {level, marker, text} rows (same as OriginalCard)
    s.defSenses = parseDefinition(s.definition);
    selected = s;
  }
  async function back() { selected = null; await tick(); inputEl?.focus(); }
  function jump(occ) {
    openStudy({ ...occ.ref, word: { position: occ.position } });
    onclose?.();
  }

  function onWinKey(e) {
    if (e.key !== 'Escape') return;
    if (selected) back(); else onclose?.();
  }
  async function onListKey(e) {
    if (!results.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); highlight = Math.min(highlight + 1, results.length - 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); highlight = Math.max(highlight - 1, 0); }
    else if (e.key === 'Enter') { e.preventDefault(); open(results[highlight]); return; }
    else return;
    await tick();
    listEl?.children[highlight]?.scrollIntoView({ block: 'nearest' });
  }

  $effect(() => { inputEl?.focus(); });
</script>

<svelte:window onkeydown={onWinKey} />
<div class="backdrop" onclick={() => onclose?.()} role="presentation"></div>
<div class="modal" role="dialog" aria-modal="true">
  {#if !selected}
    <input bind:this={inputEl} bind:value={term} oninput={onInput} onkeydown={onListKey}
      class="search" type="text" placeholder="Search an English word…" autocomplete="off" />
    {#if term.trim().length < 2}
      <p class="hint">Type an English word to find the Hebrew or Greek behind it.</p>
    {:else if !results.length}
      <p class="hint">No words found for “{term.trim()}”.</p>
    {:else}
      <div class="list" bind:this={listEl}>
        {#each results as r, i}
          <button class="sug" class:hi={i === highlight} onclick={() => open(r)} onmousemove={() => (highlight = i)}>
            <span class="orig">{r.original}</span>
            <span class="tl">{readTranslit(r.translit)}</span>
            <span class="sg">“{cleanGloss(r.gloss)}”</span>
            <span class="meta">{langLabel(r.lang || r.strongs)} · {r.total}×</span>
          </button>
        {/each}
      </div>
    {/if}
  {:else}
    <button class="back" onclick={back}>← Search</button>
    <div class="dhead">
      <span class="dorig">{selected.original}</span>
      <PlayButton text={selected.original} lang={selected.lang} />
      <span class="tl">{readTranslit(selected.translit)}</span>
      <span class="meta">{langLabel(selected.lang)} · {selected.total}×</span>
    </div>
    {#if selected.defSenses.length}
      <div class="def">
        {#each selected.defSenses as s}
          {#if s.level === -1}
            <div class="lead">{s.text}</div>
          {:else}
            <div class="dsense lv{s.level}"><span class="mk">{s.marker}</span> {s.text}</div>
          {/if}
        {/each}
      </div>
    {/if}
    <SenseVerses senses={selected.senses} onjump={jump} />
  {/if}
</div>

<style>
  .backdrop { position: fixed; inset: 0; z-index: 80; background: rgba(0,0,0,.4); animation: fadeIn .18s ease; }
  .modal { position: fixed; z-index: 81; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: min(560px, calc(100vw - 40px)); max-height: calc(100vh - 80px); overflow-y: auto;
    background: var(--panel); border: 1px solid var(--rule); border-radius: 12px; padding: 16px;
    display: flex; flex-direction: column; gap: 12px; box-shadow: 0 18px 60px rgba(0,0,0,.35);
    animation: pop .2s cubic-bezier(.22,1,.36,1); }
  @keyframes fadeIn { from { opacity: 0; } }
  @keyframes pop { from { opacity: 0; transform: translate(-50%, -48%) scale(.97); } }

  .search { font-family: inherit; font-size: 15px; padding: 9px 11px; border: 1px solid var(--rule);
    border-radius: 7px; background: var(--bg); color: var(--ink); }
  .search:focus { outline: none; border-color: var(--a); }
  .hint { margin: 0; color: var(--dim); font-size: 13px; }

  .list { display: flex; flex-direction: column; gap: 2px; }
  .sug { display: flex; align-items: baseline; gap: 9px; text-align: left; width: 100%;
    background: none; border: none; border-radius: 6px; padding: 7px 9px; cursor: pointer;
    font-family: inherit; color: var(--ink); }
  .sug.hi { background: color-mix(in srgb, var(--a) 12%, transparent); }
  .orig { font-size: 18px; color: var(--a); line-height: 1; }
  .tl { font-style: italic; color: var(--dim); font-size: 12px; }
  .sg { font-weight: 700; font-size: 13px; }
  .meta { margin-left: auto; color: var(--dim); font-size: 11px; font-variant: small-caps; letter-spacing: .04em; white-space: nowrap; }

  .back { align-self: flex-start; background: none; border: none; padding: 0; cursor: pointer;
    font-family: inherit; font-size: 12px; font-variant: small-caps; letter-spacing: .04em; color: var(--a); }
  .back:hover { text-decoration: underline; }
  .dhead { display: flex; align-items: baseline; gap: 9px; }
  .dorig { font-size: 30px; color: var(--a); line-height: 1; }
  /* indented lexicon senses, matching OriginalCard's definition rendering */
  .def { font-size: 12.5px; }
  .lead { line-height: 1.5; color: var(--dim); }
  .dsense { margin-top: 5px; line-height: 1.5; padding-left: 18px; text-indent: -18px; color: var(--dim); }
  .dsense.lv0 { margin-top: 8px; } .dsense.lv0 .mk { font-weight: 700; }
  .dsense.lv1 { padding-left: 20px; }
  .dsense.lv2 { padding-left: 40px; text-indent: -22px; }
  .dsense .mk { color: var(--a); font-weight: 600; margin-right: 6px; }
</style>
