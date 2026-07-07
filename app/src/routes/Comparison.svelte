<script>
  // Comparison mode: two versions of the same passage. Two layouts, toggled by "sync scroll":
  //   ON  → verse-aligned grid (each verse one row, both versions side by side).
  //   OFF → gridless: two independently-scrolling columns for continuous reading.
  import { getChapter, listBooks } from '../lib/db.js';
  import { study, goToPassage } from '../lib/study.svelte.js';
  import { bookName } from '../lib/refs.js';

  const VERSIONS = ['NIV', 'NKJV', 'NLT'];
  const books = listBooks('NIV');
  let left = $state('NIV');
  let right = $state('NLT');
  let aligned = $state(true); // "sync scroll" on = grid

  let maxChapter = $derived(books.find(b => b.book === study.book)?.chapters || 1);
  let leftVerses = $derived(getChapter(left, study.book, study.chapter));
  let rightVerses = $derived(getChapter(right, study.book, study.chapter));
  // merge by verse number for the grid (union, in case of versification differences)
  let rows = $derived.by(() => {
    const l = new Map(leftVerses.map(v => [v.verse, v.text]));
    const r = new Map(rightVerses.map(v => [v.verse, v.text]));
    return [...new Set([...l.keys(), ...r.keys()])].sort((a, b) => a - b)
      .map(n => ({ verse: n, left: l.get(n) || '', right: r.get(n) || '' }));
  });
  const setLeft = (e) => (left = e.target.value);
  const setRight = (e) => (right = e.target.value);
</script>

<div class="compare">
  <div class="cmpbar">
    <select class="chip" value={study.book} onchange={(e) => goToPassage({ book: e.target.value, chapter: 1 })}>
      {#each books as b}<option value={b.book}>{b.name}</option>{/each}
    </select>
    <div class="nav">
      <button onclick={() => study.chapter > 1 && goToPassage({ book: study.book, chapter: study.chapter - 1 })} disabled={study.chapter <= 1}>‹</button>
      <span>{bookName(study.book)} {study.chapter}</span>
      <button onclick={() => study.chapter < maxChapter && goToPassage({ book: study.book, chapter: study.chapter + 1 })} disabled={study.chapter >= maxChapter}>›</button>
    </div>
    <label class="synctoggle"><input type="checkbox" bind:checked={aligned} /> sync scroll</label>
  </div>

  {#if aligned}
    <div class="gridwrap">
      <div class="grid">
        <div class="ghead"><select class="chip" value={left} onchange={setLeft}>{#each VERSIONS as v}<option value={v}>{v}</option>{/each}</select></div>
        <div class="ghead"><select class="chip" value={right} onchange={setRight}>{#each VERSIONS as v}<option value={v}>{v}</option>{/each}</select></div>
        {#each rows as row (row.verse)}
          <div class="gcell"><span class="n">{row.verse}</span>{row.left}</div>
          <div class="gcell gright"><span class="n">{row.verse}</span>{row.right}</div>
        {/each}
      </div>
    </div>
  {:else}
    <div class="cols">
      {#each [{ v: left, set: setLeft, verses: leftVerses }, { v: right, set: setRight, verses: rightVerses }] as col}
        <div class="col">
          <div class="colhd"><select class="chip" value={col.v} onchange={col.set}>{#each VERSIONS as v}<option value={v}>{v}</option>{/each}</select></div>
          <div class="text">
            {#each col.verses as row (row.verse)}
              <div class="v"><span class="n">{row.verse}</span>{row.text}</div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .compare { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .cmpbar { flex: none; display: flex; align-items: center; gap: 12px; padding: 8px 14px; border-bottom: 1px solid var(--rule); font-size: 12px; }
  .chip { font-family: inherit; color: var(--ink); background: var(--bg); border: 1px solid var(--rule); border-radius: 3px; padding: 2px 6px; font-size: 12px; }
  .nav { display: flex; align-items: center; gap: 8px; color: var(--dim); font-variant: small-caps; letter-spacing: .05em; }
  .nav button { border: 1px solid var(--rule); background: transparent; color: var(--ink); border-radius: 4px; width: 24px; height: 22px; cursor: pointer; }
  .nav button:disabled { opacity: .35; }
  .synctoggle { margin-left: auto; display: flex; align-items: center; gap: 5px; color: var(--dim);
    font-variant: small-caps; letter-spacing: .04em; font-size: 11px; cursor: pointer; }
  .synctoggle input { accent-color: var(--a); cursor: pointer; }
  .n { color: var(--dim); font-size: .72em; vertical-align: super; margin-right: 4px; }

  /* aligned grid */
  .gridwrap { flex: 1; min-height: 0; overflow-y: auto; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; align-items: start; }
  .ghead { position: sticky; top: 0; z-index: 5; padding: 7px 14px; border-bottom: 1px solid var(--rule);
    background: color-mix(in srgb, var(--panel) 82%, var(--bg)); }
  .ghead + .ghead, .gcell.gright { border-left: 1px solid var(--rule); }
  .gcell { padding: 12px 16px; font-size: 15px; line-height: 1.6; border-bottom: 1px solid var(--rule); }

  /* gridless independent columns */
  .cols { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; }
  .col { display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
  .col + .col { border-left: 1px solid var(--rule); }
  .colhd { flex: none; padding: 7px 14px; border-bottom: 1px solid var(--rule); background: color-mix(in srgb, var(--panel) 82%, var(--bg)); }
  .text { flex: 1; min-height: 0; overflow-y: auto; padding: 12px 18px; font-size: 15px; line-height: 1.7; }
  .v { margin: 8px 0; }
  @media (max-width: 640px) { .grid, .cols { grid-template-columns: 1fr; } .gcell, .text { font-size: 14px; } }
</style>
