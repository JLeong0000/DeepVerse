<script>
  import { countEnglishWord, countLemma, getLexicon } from '../../lib/db.js';
  import { study } from '../../lib/study.svelte.js';
  import { bookName } from '../../lib/refs.js';

  let term = $state('');
  let result = $state(null);
  function lookup() {
    const w = term.trim();
    if (!w) { result = null; return; }
    result = { word: w, versionCount: countEnglishWord(study.version, w) };
  }

  // when a word is tapped elsewhere (Original/Differences), show its lemma concordance
  let wordConc = $derived.by(() => {
    if (!study.word?.strongs) return null;
    const lex = getLexicon(study.word.strongs);
    return { strongs: study.word.strongs, lemma: lex?.lemma || study.word.original || '', conc: countLemma(study.word.strongs) };
  });
</script>

{#if study.verse == null}
  <div class="empty">Select a verse.</div>
{:else}
  <div class="selector">
    <span class="lbl">Concordance</span>
    <input class="in" placeholder="count an English word across {study.version}…" bind:value={term}
      onkeydown={(e) => e.key === 'Enter' && lookup()} />
    <button class="go" onclick={lookup}>count</button>
  </div>
  {#if result}
    <div class="res">“{result.word}” appears <b>{result.versionCount}×</b> across all of {study.version}.</div>
  {/if}

  {#if wordConc}
    <div class="conc">
      <span class="grk">{wordConc.lemma}</span> <span class="strong">{wordConc.strongs}</span>
      — <b>{wordConc.conc.total}×</b> in the Bible
      <div class="bybook">{#each wordConc.conc.byBook.slice(0, 8) as b}<span>{bookName(b.book)} {b.n}</span>{/each}</div>
    </div>
  {/if}
{/if}

<style>
  .empty { color: var(--dim); font-size: 12px; font-style: italic; padding: 9px 11px; }
  .res, .conc { padding: 8px 11px; font-size: 12.5px; }
  .lbl { font-variant: small-caps; letter-spacing: .05em; color: var(--dim); font-size: 11px; margin-right: 6px; }
  .selector { display: flex; align-items: center; gap: 6px; padding: 4px 11px; }
  .in { flex: 1; font-family: inherit; font-size: 12px; padding: 3px 7px; border: 1px solid var(--rule); border-radius: 4px; background: var(--bg); color: var(--ink); }
  .go { border: 1px solid var(--rule); background: transparent; color: var(--ink); border-radius: 4px; padding: 3px 9px; cursor: pointer; font-family: inherit; font-size: 12px; }
  .go:hover { border-color: var(--a); }
  .conc { border-top: 1px solid var(--rule); }
  .grk { font-family: var(--greek); } .strong { color: var(--dim); font-size: .85em; }
  .bybook { display: flex; flex-wrap: wrap; gap: 4px 10px; margin-top: 5px; color: var(--dim); font-size: 11px; }
</style>
