<script>
  // Comparison mode (spec §4) — a stub: two full-height readers of the same passage in two
  // versions, side by side. No workbench, no difference underlines.
  import { getChapter, listBooks } from '../lib/db.js';
  import { study, goToPassage } from '../lib/study.svelte.js';
  import { bookName } from '../lib/refs.js';

  const VERSIONS = ['NIV', 'NKJV', 'NLT'];
  const books = listBooks('NIV');
  let left = $state('NIV');
  let right = $state('NLT');

  let leftVerses = $derived(getChapter(left, study.book, study.chapter));
  let rightVerses = $derived(getChapter(right, study.book, study.chapter));
  let maxChapter = $derived(books.find(b => b.book === study.book)?.chapters || 1);

  // synchronized scrolling: scrolling one pane scrolls the other to the same fraction.
  let syncScroll = $state(true);
  let textEls = $state([]);
  let lock = false;
  function sync(from) {
    if (!syncScroll || lock) return;
    const a = textEls[from], b = textEls[from === 0 ? 1 : 0];
    if (!a || !b) return;
    lock = true;
    const denom = a.scrollHeight - a.clientHeight;
    const ratio = denom > 0 ? a.scrollTop / denom : 0;
    b.scrollTop = ratio * (b.scrollHeight - b.clientHeight);
    requestAnimationFrame(() => { lock = false; });
  }
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
  <label class="synctoggle"><input type="checkbox" bind:checked={syncScroll} /> sync scroll</label>
</div>

<div class="cmp">
  {#each [{ v: left, set: (x) => (left = x), verses: leftVerses }, { v: right, set: (x) => (right = x), verses: rightVerses }] as col, i}
    <div class="col">
      <div class="colhd">
        <select class="chip" value={col.v} onchange={(e) => col.set(e.target.value)}>
          {#each VERSIONS as v}<option value={v}>{v}</option>{/each}
        </select>
      </div>
      <div class="text" bind:this={textEls[i]} onscroll={() => sync(i)}>
        {#each col.verses as row (row.verse)}
          <div class="v"><span class="n">{row.verse}</span>{row.text}</div>
        {/each}
      </div>
    </div>
  {/each}
</div>
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
  .cmp { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; }
  .col { display: flex; flex-direction: column; min-height: 0; overflow: hidden; border-right: 1px solid var(--rule); }
  .col:last-child { border-right: none; }
  .colhd { padding: 6px 14px; border-bottom: 1px solid var(--rule); background: color-mix(in srgb, var(--panel) 70%, var(--bg)); }
  .text { padding: 12px 18px; overflow-y: auto; font-size: 15px; line-height: 1.7; }
  .v { margin: 8px 0; }
  .n { color: var(--dim); font-size: .72em; vertical-align: super; margin-right: 3px; }
  @media (max-width: 720px) { .cmp { grid-template-columns: 1fr; } }
</style>
