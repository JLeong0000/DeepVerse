<script>
  import { getInterlinear, getVerseDifferences, getLexicon, countLemma, getChapterLanguages } from '../../lib/db.js';
  import { study, selectWord } from '../../lib/study.svelte.js';
  import { bookName } from '../../lib/refs.js';

  let words = $derived(study.verse == null ? [] : getInterlinear(study.book, study.chapter, study.verse));
  let langs = $derived(getChapterLanguages(study.book, study.chapter));
  // position -> 'A' | 'B' | 'AB'
  let markMap = $derived.by(() => {
    const m = new Map();
    if (study.verse == null) return m;
    for (const d of getVerseDifferences(study.book, study.chapter, study.verse)) {
      const prev = m.get(d.position);
      m.set(d.position, prev && prev !== d.type ? 'AB' : d.type);
    }
    return m;
  });

  let sel = $state(null); // { word, lex, concordance }
  function tap(w) {
    selectWord({ strongs: w.strongs, ...w });
    sel = { word: w, lex: getLexicon(w.strongs), conc: w.strongs ? countLemma(w.strongs) : null };
  }
  const markClass = (p) => { const t = markMap.get(p); return t === 'A' ? 'mA' : t === 'B' ? 'mB' : t === 'AB' ? 'mAB' : ''; };
</script>

{#if study.verse == null}
  <div class="empty">Select a verse.</div>
{:else}
  {#if langs.length > 1}<div class="langnote">This chapter mixes {langs.join(' + ')}.</div>{/if}
  <div class="interlin">
    {#each words as w (w.position)}
      <div class="iw {markClass(w.position)}" onclick={() => tap(w)} role="button" tabindex="0" class:active={sel?.word.position === w.position}>
        <span class="g grk">{w.original}</span>
        <span class="p">{w.translit}</span>
        <span class="e">{w.gloss}</span>
      </div>
    {/each}
  </div>
  {#if sel}
    <div class="wdetail">
      <div class="wtop"><span class="grk big">{sel.word.original}</span> <span class="tl">{sel.word.translit}</span>
        <span class="strong">{sel.word.strongs}</span> <span class="morph">{sel.word.morph}</span></div>
      {#if sel.lex}<div class="def">{sel.lex.gloss}{sel.lex.definition ? ` — ${sel.lex.definition.slice(0, 160)}` : ''}</div>
      {:else}<div class="def dim">No lexicon entry.</div>{/if}
      {#if sel.conc}<div class="conc">Occurs <b>{sel.conc.total}×</b> in the Bible ({sel.conc.byBook.length} books)</div>{/if}
    </div>
  {/if}
{/if}

<style>
  .empty { color: var(--dim); font-size: 12px; font-style: italic; padding: 9px 11px; }
  .langnote { font-size: 11px; color: var(--dim); padding: 8px 11px 0; font-style: italic; }
  .interlin { display: flex; flex-wrap: wrap; gap: 4px 6px; padding: 11px; }
  .iw { display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 4px 6px; border: 1px solid transparent; border-radius: 5px; cursor: pointer; }
  .iw:hover { border-color: var(--rule); background: color-mix(in srgb, var(--panel) 50%, var(--bg)); }
  .iw.active { border-color: var(--a); }
  .iw .g { font-family: var(--greek); font-size: 16px; }
  .iw .p { font-size: 9.5px; font-style: italic; color: var(--dim); }
  .iw .e { font-size: 10.5px; color: var(--dim); }
  .iw.mA .g { border-bottom: 2px solid var(--a); } .iw.mB .g { border-bottom: 2px solid var(--b); }
  .iw.mAB .g { border-bottom: 2px solid var(--b); box-shadow: inset 0 -4px 0 -2px var(--a); }
  .wdetail { border-top: 1px solid var(--rule); padding: 10px 12px; font-size: 12.5px; }
  .grk { font-family: var(--greek); } .big { font-size: 18px; }
  .tl { color: var(--dim); font-style: italic; }
  .strong { color: var(--dim); font-size: .85em; margin-left: 6px; } .morph { color: var(--dim); font-size: .85em; }
  .def { margin-top: 5px; line-height: 1.5; } .def.dim { color: var(--dim); font-style: italic; }
  .conc { margin-top: 5px; color: var(--dim); }
</style>
