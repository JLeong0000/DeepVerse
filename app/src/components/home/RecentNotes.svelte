<script>
  import { recentNotes, allGroups, addGroup, updateNote, deleteNote } from '../../lib/store.js';
  import { formatRef } from '../../lib/refs.js';
  import { noteHtml } from '../../lib/markdown.js';
  import NoteOverlay from '../notes/NoteOverlay.svelte';

  let notes = $state([]);
  let groups = $state([]);
  let overlayNote = $state(null);

  async function load() { notes = await recentNotes(8); groups = allGroups(); }
  $effect(() => { load(); });

  function relDate(iso) {
    const days = Math.floor((Date.now() - new Date(iso)) / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 14) return 'last week';
    if (days < 31) return `${Math.floor(days / 7)} weeks ago`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  async function saveOverlay(body, groupId, color) {
    if (groupId === '__new') { const g = addGroup(); groupId = g.id; }
    await updateNote(overlayNote.id, body, { group_id: groupId, color });
    await load();
  }
  async function deleteOverlay() { await deleteNote(overlayNote.id); await load(); }
</script>

<div class="lbl">Recent memos</div>
{#if notes.length === 0}
  <div class="empty">No memos yet — open a verse in Study mode and jot one down.</div>
{:else}
  <div class="notesgrid">
    {#each notes as note, i}
      <div class="sticky postit" style="background: var(--sy{note.color ?? ((i % 4) + 1)})"
        onclick={() => (overlayNote = note)} role="button" tabindex="0">
        <div class="r">{note.ref ? formatRef(note.ref) : 'Memo'}{note.ref && note.target_type === 'chapter' ? ' · ch' : ''}</div>
        <div class="t md">{@html noteHtml(note.body)}</div>
        <div class="d">{relDate(note.updated_at)}</div>
      </div>
    {/each}
  </div>
{/if}

{#if overlayNote}
  <NoteOverlay note={overlayNote} groups={groups}
    onsave={saveOverlay} ondelete={deleteOverlay} onclose={() => (overlayNote = null)} />
{/if}

<style>
  .notesgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 16px 14px; margin-top: 8px; }
  @media (max-width: 640px) { .notesgrid { grid-template-columns: 1fr; } }
  .sticky { padding: 12px 13px 14px; border-radius: 3px; cursor: pointer; align-self: start; }
  .sticky:nth-child(4n+1) { transform: rotate(-2deg); }
  .sticky:nth-child(4n+2) { transform: rotate(1.5deg); }
  .sticky:nth-child(4n+3) { transform: rotate(-1deg); }
  .sticky:nth-child(4n+4) { transform: rotate(2deg); }
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
