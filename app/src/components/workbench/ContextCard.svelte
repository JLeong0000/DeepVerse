<script>
  import { getCrossRefs, getChapterCrossRefStats, getRefPreview } from '../../lib/db.js';
  import { study, goToPassage } from '../../lib/study.svelte.js';
  import { formatRef, bookName, bookOrder } from '../../lib/refs.js';

  const LIMIT = 14;
  let chapStats = $derived(getChapterCrossRefStats(study.book, study.chapter));

  // top cross-refs for the verse, each with a NIV preview, grouped into OT / NT.
  let groups = $derived.by(() => {
    if (study.verse == null) return [];
    const refs = getCrossRefs(study.book, study.chapter, study.verse).slice(0, LIMIT).map(r => ({
      to_ref: r.to_ref,
      votes: r.votes,
      firstRef: r.to_ref.split('-')[0],
      range: r.to_ref.includes('-'),
      preview: getRefPreview(r.to_ref),
    }));
    const ot = refs.filter(r => bookOrder(r.firstRef.split('.')[0]) < 39);
    const nt = refs.filter(r => bookOrder(r.firstRef.split('.')[0]) >= 39);
    return [['New Testament', nt], ['Old Testament', ot]].filter(([, list]) => list.length);
  });
  let total = $derived(study.verse == null ? 0 : getCrossRefs(study.book, study.chapter, study.verse).length);

  function jump(firstRef) {
    const [book, chapter, verse] = firstRef.split('.');
    if (book && chapter) goToPassage({ book, chapter: +chapter, verse: verse ? +verse : null });
  }
</script>

{#if study.verse == null}
  <div class="empty">Select a verse.</div>
{:else}
  <div class="hd">
    <span class="q">ⓘ</span> Passages that connect to <b>{bookName(study.book)} {study.chapter}:{study.verse}</b>
    <span class="sub">· {total} cross-references, ranked by relevance</span>
    <div class="tip">
      Cross-references are curated links between passages that quote, echo, or teach the same thing —
      a NT verse pointing back to the OT it fulfils, gospel parallels, a shared theme. They are not the
      Bible referencing itself; they come from <b>OpenBible.info</b>’s community-compiled dataset, and the
      number is how many people voted a link relevant (higher = stronger). Click one to jump there.
    </div>
  </div>
  {#if groups.length === 0}
    <div class="empty">No cross-references for this verse.</div>
  {:else}
    {#each groups as [label, list]}
      <div class="grp">
        <div class="grplbl">{label}</div>
        {#each list as r}
          <button class="xref" onclick={() => jump(r.firstRef)}>
            <span class="rtop"><span class="ref">{formatRef(r.firstRef)}{r.range ? ' ff.' : ''}</span>
              {#if r.votes > 0}<span class="votes" title="community relevance votes">{r.votes}</span>{/if}</span>
            {#if r.preview}<span class="prev">{r.preview.length > 120 ? r.preview.slice(0, 120) + '…' : r.preview}</span>{/if}
          </button>
        {/each}
      </div>
    {/each}
    {#if total > LIMIT}<div class="more">+{total - LIMIT} more, lower-ranked</div>{/if}
  {/if}
  <div class="l2">Whole chapter: {chapStats.total} cross-references across {chapStats.versesWithRefs} verses.</div>
{/if}

<style>
  .empty { color: var(--dim); font-size: 12px; font-style: italic; padding: 9px 11px; }
  .hd { position: relative; padding: 9px 11px 4px; font-size: 12px; color: var(--ink); line-height: 1.5; }
  .hd .sub { color: var(--dim); font-size: .92em; }
  .hd .q { cursor: help; color: var(--b); margin-right: 2px; }
  .hd .tip { position: absolute; z-index: 40; left: 11px; right: 11px; top: 100%; margin-top: 2px;
    background: var(--bg); border: 1px solid var(--rule); border-radius: 6px; padding: 10px 12px;
    box-shadow: 0 10px 30px rgba(0,0,0,.4); font-size: 12px; line-height: 1.5; color: var(--ink);
    opacity: 0; visibility: hidden; transition: opacity .12s; }
  .hd:hover .tip { opacity: 1; visibility: visible; }
  .grp { padding: 4px 11px 6px; }
  .grplbl { font-variant: small-caps; letter-spacing: .05em; font-size: 10.5px; color: var(--dim); margin: 6px 0 4px; }
  .xref { display: flex; flex-direction: column; align-items: stretch; gap: 2px; width: 100%; text-align: left;
    border: 1px solid var(--rule); background: transparent; border-radius: 5px; padding: 6px 9px; cursor: pointer;
    color: var(--ink); font-family: inherit; margin-bottom: 5px; }
  .xref:hover { border-color: var(--a); }
  .rtop { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
  .ref { color: var(--a); font-size: 12.5px; } .votes { color: var(--dim); font-size: .78em; }
  .prev { color: var(--dim); font-size: 11.5px; line-height: 1.45; }
  .more { padding: 0 11px 6px; font-size: 11px; color: var(--dim); }
  .l2 { padding: 6px 11px 10px; font-size: 11px; color: var(--dim); border-top: 1px solid var(--rule); margin-top: 4px; }
</style>
