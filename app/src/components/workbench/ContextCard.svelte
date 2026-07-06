<script>
  import { getCrossRefs, getChapterCrossRefStats } from '../../lib/db.js';
  import { study, goToPassage } from '../../lib/study.svelte.js';
  import { formatRef } from '../../lib/refs.js';

  let refs = $derived(study.verse == null ? [] : getCrossRefs(study.book, study.chapter, study.verse));
  let chapStats = $derived(getChapterCrossRefStats(study.book, study.chapter));

  // a cross-ref target may be a range like "Rom.5.8" or "1John.4.9-1John.4.10"; jump to its start
  function jump(toRef) {
    const first = String(toRef).split('-')[0];
    const [book, chapter, verse] = first.split('.');
    if (book && chapter) goToPassage({ book, chapter: +chapter, verse: verse ? +verse : null });
  }
</script>

{#if study.verse == null}
  <div class="empty">Select a verse.</div>
{:else}
  <div class="l2">Chapter: {chapStats.total} cross-references across {chapStats.versesWithRefs} verses</div>
  {#if refs.length === 0}
    <div class="empty">No cross-references for this verse.</div>
  {:else}
    <div class="xlist">
      {#each refs.slice(0, 12) as r}
        <button class="xref" onclick={() => jump(r.to_ref)}>
          <span class="ref">{formatRef(r.to_ref.split('-')[0])}{r.to_ref.includes('-') ? '…' : ''}</span>
          {#if r.votes > 0}<span class="votes">{r.votes}</span>{/if}
        </button>
      {/each}
    </div>
    {#if refs.length > 12}<div class="more">+{refs.length - 12} more</div>{/if}
  {/if}
{/if}

<style>
  .empty { color: var(--dim); font-size: 12px; font-style: italic; padding: 9px 11px; }
  .l2 { font-size: 11px; color: var(--dim); padding: 9px 11px 4px; font-variant: small-caps; letter-spacing: .04em; }
  .xlist { display: flex; flex-wrap: wrap; gap: 5px; padding: 4px 11px 11px; }
  .xref { display: inline-flex; align-items: baseline; gap: 6px; border: 1px solid var(--rule); background: transparent;
    border-radius: 4px; padding: 2px 8px; cursor: pointer; color: var(--ink); font-family: inherit; font-size: 12.5px; }
  .xref:hover { border-color: var(--a); }
  .ref { color: var(--a); } .votes { color: var(--dim); font-size: .82em; }
  .more { padding: 0 11px 10px; font-size: 11px; color: var(--dim); }
</style>
