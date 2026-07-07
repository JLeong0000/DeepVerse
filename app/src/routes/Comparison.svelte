<script>
  // Comparison mode (spec §4): two versions of the same passage, laid out as a verse-aligned grid so
  // the same verse sits in one row across both columns — the standard parallel-Bible layout, and the
  // clearest way to compare renderings (no sync-scroll needed — it's one scroll container).
  import { getChapter, listBooks } from '../lib/db.js';
  import { study, goToPassage } from '../lib/study.svelte.js';
  import { bookName } from '../lib/refs.js';

  const VERSIONS = ['NIV', 'NKJV', 'NLT'];
  const books = listBooks('NIV');
  let left = $state('NIV');
  let right = $state('NLT');

  let maxChapter = $derived(books.find(b => b.book === study.book)?.chapters || 1);
  // merge both versions by verse number (union, in case of versification differences)
  let rows = $derived.by(() => {
    const l = new Map(getChapter(left, study.book, study.chapter).map(v => [v.verse, v.text]));
    const r = new Map(getChapter(right, study.book, study.chapter).map(v => [v.verse, v.text]));
    return [...new Set([...l.keys(), ...r.keys()])].sort((a, b) => a - b)
      .map(n => ({ verse: n, left: l.get(n) || '', right: r.get(n) || '' }));
  });
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
  </div>

  <div class="gridwrap">
    <div class="grid">
      <div class="ghead gnum"></div>
      <div class="ghead">
        <select class="chip" value={left} onchange={(e) => (left = e.target.value)}>
          {#each VERSIONS as v}<option value={v}>{v}</option>{/each}
        </select>
      </div>
      <div class="ghead">
        <select class="chip" value={right} onchange={(e) => (right = e.target.value)}>
          {#each VERSIONS as v}<option value={v}>{v}</option>{/each}
        </select>
      </div>

      {#each rows as row (row.verse)}
        <div class="gnum">{row.verse}</div>
        <div class="gcell">{row.left}</div>
        <div class="gcell gright">{row.right}</div>
      {/each}
    </div>
  </div>
</div>

<style>
  .compare { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .cmpbar { flex: none; display: flex; align-items: center; gap: 12px; padding: 8px 14px; border-bottom: 1px solid var(--rule); font-size: 12px; }
  .chip { font-family: inherit; color: var(--ink); background: var(--bg); border: 1px solid var(--rule); border-radius: 3px; padding: 2px 6px; font-size: 12px; }
  .nav { display: flex; align-items: center; gap: 8px; color: var(--dim); font-variant: small-caps; letter-spacing: .05em; }
  .nav button { border: 1px solid var(--rule); background: transparent; color: var(--ink); border-radius: 4px; width: 24px; height: 22px; cursor: pointer; }
  .nav button:disabled { opacity: .35; }

  .gridwrap { flex: 1; min-height: 0; overflow-y: auto; }
  .grid { display: grid; grid-template-columns: 34px 1fr 1fr; align-items: start; }
  .ghead { position: sticky; top: 0; z-index: 5; padding: 7px 14px; border-bottom: 1px solid var(--rule);
    background: color-mix(in srgb, var(--panel) 82%, var(--bg)); }
  .ghead.gnum { border-bottom: 1px solid var(--rule); }
  .gnum { color: var(--dim); font-size: 11px; text-align: right; padding: 12px 8px 12px 0; }
  .gcell { padding: 12px 16px 12px 8px; font-size: 15px; line-height: 1.6; border-bottom: 1px solid var(--rule);
    border-left: 1px solid var(--rule); }
  .gright { border-right: none; }
  .grid > .gnum:not(.ghead) { border-bottom: 1px solid var(--rule); }
  @media (max-width: 640px) { .gcell { font-size: 14px; } }
</style>
