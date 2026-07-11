<script>
  import { recentNotes } from '../../lib/store.js';
  import { formatRef } from '../../lib/refs.js';
  import { openStudy, go } from '../../lib/router.svelte.js';
  import { noteHtml } from '../../lib/markdown.js';

  let notes = $state([]);
  $effect(() => { recentNotes(8).then(n => (notes = n)); });

  function relDate(iso) {
    const days = Math.floor((Date.now() - new Date(iso)) / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 14) return 'last week';
    if (days < 31) return `${Math.floor(days / 7)} weeks ago`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  function open(note) {
    if (!note.ref) { go('notes'); return; }
    const [book, chapter, verse] = note.ref.split('.');
    openStudy({ version: 'NIV', book, chapter: +chapter, verse: verse ? +verse : null });
  }
</script>

<div class="lbl">Recent notes</div>
{#if notes.length === 0}
  <div class="empty">No notes yet — open a verse in Study mode and jot one down.</div>
{:else}
  <div class="notesgrid">
    {#each notes as note}
      <div class="sticky" onclick={() => open(note)} role="button" tabindex="0">
        <div class="r">{note.ref ? formatRef(note.ref) : 'Note'}{note.ref && note.target_type === 'chapter' ? ' · ch' : ''}</div>
        <div class="t md">{@html noteHtml(note.body)}</div>
        <div class="d">{relDate(note.updated_at)}</div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .notesgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 16px 14px; margin-top: 8px; }
  @media (max-width: 640px) { .notesgrid { grid-template-columns: 1fr; } }
  .sticky { padding: 12px 13px 14px; box-shadow: 2px 3px 7px rgba(0,0,0,.18); cursor: pointer; color: #25201a; align-self: start; }
  :global(html.dark) .sticky { color: var(--ink); box-shadow: 2px 3px 9px rgba(0,0,0,.4); }
  .sticky:nth-child(4n+1) { background: var(--sy1); transform: rotate(-2deg); }
  .sticky:nth-child(4n+2) { background: var(--sy2); transform: rotate(1.5deg); }
  .sticky:nth-child(4n+3) { background: var(--sy3); transform: rotate(-1deg); }
  .sticky:nth-child(4n+4) { background: var(--sy4); transform: rotate(2deg); }
  .sticky:hover { transform: rotate(0) scale(1.03); }
  .sticky .r { font-size: 11px; font-variant: small-caps; letter-spacing: .04em; opacity: .7; }
  .sticky .t { font-size: 12.5px; margin-top: 3px; line-height: 1.35; max-height: 8.5em; overflow: hidden; }
  .sticky .d { font-size: 9.5px; opacity: .55; margin-top: 7px; }
  .md :global(p) { margin: 0 0 3px; } .md :global(p:last-child) { margin-bottom: 0; }
  .md :global(ul), .md :global(ol) { margin: 2px 0; padding-left: 16px; } .md :global(li) { margin: 1px 0; }
  .md :global(h3), .md :global(h4), .md :global(h5) { margin: 3px 0 2px; font-size: 1em; }
  .md :global(strong) { font-weight: 700; }
  .empty { color: var(--dim); font-size: 13px; font-style: italic; margin-top: 8px; }
</style>
