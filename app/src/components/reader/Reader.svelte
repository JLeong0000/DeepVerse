<script>
  import { getChapter, getChapterDifferenceMap, listBooks } from '../../lib/db.js';
  import { recordRead, setPref } from '../../lib/store.js';
  import { study, selectVerse, setVersion, goToPassage, selectedRange } from '../../lib/study.svelte.js';
  import { bookName } from '../../lib/refs.js';
  import VerseLine from './VerseLine.svelte';

  const VERSIONS = ['NIV', 'NKJV', 'NLT'];
  const books = listBooks('NIV');

  let verses = $derived(getChapter(study.version, study.book, study.chapter));
  let diffMap = $derived(getChapterDifferenceMap(study.book, study.chapter));
  let bookIdx = $derived(books.findIndex(b => b.book === study.book));
  let maxChapter = $derived(books[bookIdx]?.chapters || 1);
  let range = $derived(selectedRange()); // [lo, hi] | null

  // scroll the selected verse into view when it changes programmatically (e.g. a cross-ref jump).
  let engEl = $state(null);
  $effect(() => {
    const v = study.verse; study.book; study.chapter;
    if (v == null || !engEl) return;
    const el = engEl.querySelector(`[data-verse="${v}"]`);
    if (el) requestAnimationFrame(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  });

  // count a reading day once per chapter open (depends only on version/book/chapter, NOT verse)
  $effect(() => {
    const { version, book, chapter } = study;
    recordRead(book, chapter);
    setPref('last_position', { version, book, chapter, verse: null });
  });

  // at chapter 1, roll back to the last chapter of the previous book.
  function prevChapter() {
    if (study.chapter > 1) goToPassage({ book: study.book, chapter: study.chapter - 1 });
    else if (bookIdx > 0) goToPassage({ book: books[bookIdx - 1].book, chapter: books[bookIdx - 1].chapters });
  }
  // at the last chapter, roll over to chapter 1 of the next book.
  function nextChapter() {
    if (study.chapter < maxChapter) goToPassage({ book: study.book, chapter: study.chapter + 1 });
    else if (bookIdx < books.length - 1) goToPassage({ book: books[bookIdx + 1].book, chapter: 1 });
  }
</script>

<div class="reader">
  <div class="rtop">
    <select class="sel-book" value={study.book} onchange={(e) => goToPassage({ book: e.target.value, chapter: 1 })}>
      {#each books as b}<option value={b.book}>{b.name}</option>{/each}
    </select>
    <div class="chapnav">
      <button class="nav" onclick={prevChapter} disabled={study.chapter <= 1 && bookIdx <= 0} aria-label="Previous chapter">‹</button>
      <span class="chaplabel">{bookName(study.book)} {study.chapter}</span>
      <button class="nav" onclick={nextChapter} disabled={study.chapter >= maxChapter && bookIdx >= books.length - 1} aria-label="Next chapter">›</button>
    </div>
    <select class="chip" value={study.version} onchange={(e) => setVersion(e.target.value)}>
      {#each VERSIONS as v}<option value={v}>{v}</option>{/each}
    </select>
  </div>

  <div class="eng" bind:this={engEl}>
    {#each verses as row (row.verse)}
      <VerseLine verse={row.verse} text={row.text} diffs={diffMap.get(row.verse) || []}
        selected={range != null && row.verse >= range[0] && row.verse <= range[1]} onselect={selectVerse} />
    {/each}
  </div>
</div>

<style>
  .reader { display: flex; flex-direction: column; height: 100%; }
  .rtop { display: flex; align-items: center; gap: 10px; padding: 8px 13px; border-bottom: 1px solid var(--rule);
    background: color-mix(in srgb, var(--panel) 70%, var(--bg)); font-size: 12px; }
  .sel-book, .chip { font-family: inherit; color: var(--ink); background: var(--bg); border: 1px solid var(--rule);
    border-radius: 3px; padding: 2px 6px; font-size: 12px; }
  .chapnav { display: flex; align-items: center; gap: 8px; margin: 0 auto; }
  .chaplabel { font-variant: small-caps; letter-spacing: .05em; color: var(--dim); }
  .nav { border: 1px solid var(--rule); background: transparent; color: var(--ink); border-radius: 4px;
    width: 24px; height: 22px; cursor: pointer; }
  .nav:disabled { opacity: .35; cursor: default; }
  .eng { padding: 12px 18px; font-size: 15px; line-height: 1.7; overflow-y: auto; flex: 1; }
</style>
