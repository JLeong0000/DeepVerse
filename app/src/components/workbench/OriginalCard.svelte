<script>
  import { getInterlinear, getVerseDifferences, getLexicon, countLemma, getChapterLanguages } from '../../lib/db.js';
  import { study, selectWord } from '../../lib/study.svelte.js';
  import { bookName } from '../../lib/refs.js';
  import { parseDefinition, readTranslit } from '../../lib/display.js';
  import PlayButton from '../common/PlayButton.svelte';
  import WordInstances from './WordInstances.svelte';
  import GlossedText from '../common/GlossedText.svelte';

  let instancesOpen = $state(false);

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

  // word detail is driven by the shared selection (tap here OR click a Differences button)
  let detail = $derived.by(() => {
    const w = study.word;
    if (!w?.strongs) return null;
    return { word: w, lex: getLexicon(w.strongs), conc: countLemma(w.strongs) };
  });
  // STEPBible definitions cram all senses onto one line. Greek uses "__" delimiters + Roman/arabic/lettered
  // markers; Hebrew (BDB) uses inline "1) / 1a) / 1a1)" numbering. parseDefinition handles both and returns
  // {level, marker, text} rows so we can indent instead of showing one run-on line.
  let defSenses = $derived.by(() => parseDefinition(detail?.lex?.definition));
  // occurrences of this word OUTSIDE the current verse — gates the "See other instances" link
  let otherInstances = $derived(
    detail ? detail.conc.total - words.filter(w => w.strongs === detail.word.strongs).length : 0);

  let detailEl = $state(null);
  $effect(() => { if (detail && detailEl) detailEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });

  const markClass = (p) => { const t = markMap.get(p); return t === 'A' ? 'mA' : t === 'B' ? 'mB' : t === 'AB' ? 'mAB' : ''; };
</script>

{#if study.verse == null}
  <div class="empty">Select a verse.</div>
{:else}
  {#if langs.length > 1}<div class="langnote">This chapter mixes {langs.join(' + ')}.</div>{/if}
  <div class="interlin">
    {#each words as w (w.position)}
      <div class="iw {markClass(w.position)}" onclick={() => selectWord({ strongs: w.strongs, ...w })} role="button" tabindex="0"
        class:active={study.word?.position === w.position && study.word?.strongs === w.strongs}>
        <span class="g grk">{w.original}</span>
        <span class="p">{readTranslit(w.translit)}</span>
        <span class="e">{w.gloss}</span>
      </div>
    {/each}
  </div>
  {#if detail}
    <div class="wdetail" bind:this={detailEl}>
      <div class="wtop"><span class="grk big">{detail.word.original}</span> <span class="tl">{readTranslit(detail.word.translit)}</span>
        <PlayButton text={detail.word.original} lang={detail.word.lang || detail.word.strongs} />
        <span class="strong">{detail.word.strongs}</span>{#if detail.word.morph} <span class="morph">{detail.word.morph}</span>{/if}</div>
      {#if detail.lex}
        {#if detail.lex.gloss}<div class="gloss">{detail.lex.gloss}</div>{/if}
        {#each defSenses as s}
          {#if s.level === -1}
            <div class="lead"><GlossedText text={s.text} /></div>
          {:else}
            <div class="sense lv{s.level}"><span class="mk">{s.marker}</span> <GlossedText text={s.text} /></div>
          {/if}
        {/each}
      {:else}<div class="sense dim">No lexicon entry.</div>{/if}
      {#if detail.conc}<div class="conc">Occurs <b>{detail.conc.total}×</b> in the Bible ({detail.conc.byBook.length} books)</div>{/if}
      {#if otherInstances > 0}
        <button class="instances" onclick={() => (instancesOpen = true)}>See other instances →</button>
      {/if}
    </div>
    {#if instancesOpen}
      <WordInstances strongs={detail.word.strongs} original={detail.word.original} translit={detail.word.translit}
        ref={{ book: study.book, chapter: study.chapter, verse: study.verse }}
        onclose={() => (instancesOpen = false)} />
    {/if}
  {/if}
{/if}

<style>
  .empty { color: var(--dim); font-size: 12px; font-style: italic; padding: 9px 11px; }
  .langnote { font-size: 11px; color: var(--dim); padding: 8px 11px 0; font-style: italic; }
  .interlin { display: grid; grid-template-columns: repeat(auto-fill, minmax(78px, 1fr)); gap: 3px; padding: 11px; }
  .iw { display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 1px;
    padding: 5px 4px; border: 1px solid transparent; border-radius: 5px; cursor: pointer; text-align: center;
    min-width: 0; }
  /* long words (e.g. ζωοποιηθήσονται) must wrap inside their cell, not bleed into the neighbor */
  .iw .g, .iw .p, .iw .e { max-width: 100%; overflow-wrap: anywhere; }
  .iw:hover { border-color: var(--rule); background: color-mix(in srgb, var(--panel) 50%, var(--bg)); }
  .iw.active { border-color: var(--a); background: color-mix(in srgb, var(--panel) 60%, var(--bg)); }
  .iw .g { font-family: var(--greek); font-size: 16px; }
  .iw .p { font-size: 9.5px; font-style: italic; color: var(--dim); }
  .iw .e { font-size: 10.5px; color: var(--dim); }
  .iw.mA .g { border-bottom: 2px solid var(--a); } .iw.mB .g { border-bottom: 2px solid var(--b); }
  .iw.mAB .g { border-bottom: 2px solid var(--b); box-shadow: inset 0 -4px 0 -2px var(--a); }
  .wdetail { border-top: 1px solid var(--rule); padding: 10px 12px; font-size: 12.5px; }
  .grk { font-family: var(--greek); } .big { font-size: 18px; }
  .tl { color: var(--dim); font-style: italic; }
  .strong { color: var(--dim); font-size: .85em; margin-left: 6px; } .morph { color: var(--dim); font-size: .85em; }
  .morph::before { content: '·'; margin: 0 .35em; opacity: .55; }
  .gloss { margin-top: 6px; font-weight: 600; }
  .lead { margin-top: 4px; line-height: 1.5; color: var(--dim); }
  .sense { margin-top: 5px; line-height: 1.5; padding-left: 18px; text-indent: -18px; } /* hanging indent to the marker */
  .sense.lv0 { padding-left: 18px; margin-top: 8px; } .sense.lv0 .mk { font-weight: 700; }
  .sense.lv1 { padding-left: 20px; }
  .sense.lv2 { padding-left: 40px; text-indent: -22px; }
  .sense.dim { color: var(--dim); font-style: italic; padding-left: 0; text-indent: 0; }
  .sense .mk { color: var(--a); font-weight: 600; margin-right: 6px; }
  .conc { margin-top: 8px; color: var(--dim); border-top: 1px solid var(--rule); padding-top: 7px; }
  .instances { margin-top: 8px; background: none; border: none; padding: 0; cursor: pointer;
    font-family: inherit; font-size: 12.5px; color: var(--a); display: block; }
  .instances:hover { text-decoration: underline; }
</style>
