<script>
  import { notesForRef, addNote, updateNote, deleteNote } from '../../lib/store.js';
  import { study, selectedRange } from '../../lib/study.svelte.js';
  import { noteHtml, noteIsEmpty } from '../../lib/markdown.js';
  import NoteEditor from '../notes/NoteEditor.svelte';

  // the note attaches to the current selection: a single verse, a verse range, or (if nothing
  // is selected) the whole chapter.
  let target = $derived.by(() => {
    const r = selectedRange();
    if (!r) return { type: 'chapter', ref: `${study.book}.${study.chapter}`, label: `${study.book} ${study.chapter}` };
    const [lo, hi] = r;
    if (lo === hi) return { type: 'verse', ref: `${study.book}.${study.chapter}.${lo}`, label: `${study.book} ${study.chapter}:${lo}` };
    return { type: 'verse', ref: `${study.book}.${study.chapter}.${lo}-${hi}`, label: `${study.book} ${study.chapter}:${lo}–${hi}` };
  });

  let notes = $state([]);
  let draft = $state('');
  let draftNonce = $state(0); // bump to remount (clear) the new-note editor
  let editingId = $state(null);
  let editBuf = $state('');

  $effect(() => { notesForRef(target.ref).then(n => (notes = n)); });

  async function refresh() { notes = await notesForRef(target.ref); }
  async function saveNew() {
    if (noteIsEmpty(draft)) return;
    await addNote({ target_type: target.type, ref: target.ref, body: draft });
    draft = ''; draftNonce++; await refresh();
  }
  function startEdit(note) { editingId = note.id; editBuf = note.body; }
  async function commitEdit(note) {
    editingId = null;
    if (noteIsEmpty(editBuf)) { await deleteNote(note.id); await refresh(); }
    else if (editBuf !== note.body) { await updateNote(note.id, editBuf); await refresh(); }
  }
</script>

<div class="wrap">
  <div class="tgt">Note on <b>{target.label}</b> <span class="dim">({target.type === 'chapter' ? 'chapter' : (target.ref.includes('-') ? 'verse range' : 'verse')})</span></div>

  {#each notes as note (note.id)}
    {#if editingId === note.id}
      <NoteEditor bind:value={editBuf} onsave={() => commitEdit(note)} autofocus />
    {:else}
      <div class="note md" onclick={() => startEdit(note)} role="button" tabindex="0">{@html noteHtml(note.body)}</div>
    {/if}
  {/each}

  {#key draftNonce}
    <NoteEditor bind:value={draft} onsave={saveNew} placeholder="Add a note…" />
  {/key}
  <button class="save" onclick={saveNew} disabled={noteIsEmpty(draft)}>Save note</button>
</div>

<style>
  .wrap { padding: 10px 11px; display: flex; flex-direction: column; gap: 8px; }
  .tgt { font-size: 12px; color: var(--dim); } .tgt b { color: var(--ink); } .dim { opacity: .7; }
  .note.md { font-size: 13px; line-height: 1.5; padding: 8px 10px; border: 1px solid var(--rule); border-radius: 6px;
    background: color-mix(in srgb, var(--panel) 50%, var(--bg)); cursor: text; }
  .note.md:hover { border-color: var(--a); }
  .save { align-self: flex-start; border: 1px solid var(--rule); background: transparent; color: var(--ink);
    border-radius: 4px; padding: 4px 11px; cursor: pointer; font-family: inherit; font-size: 12px; }
  .save:hover:not(:disabled) { border-color: var(--a); } .save:disabled { opacity: .4; cursor: default; }

  /* rendered-markdown primitives (shared look for note bodies) */
  .md :global(p) { margin: 0 0 6px; } .md :global(p:last-child) { margin-bottom: 0; }
  .md :global(ul), .md :global(ol) { margin: 4px 0; padding-left: 20px; }
  .md :global(li) { margin: 2px 0; }
  .md :global(h3), .md :global(h4), .md :global(h5) { margin: 6px 0 4px; font-size: 1.05em; }
  .md :global(code) { font-family: ui-monospace, Menlo, monospace; font-size: .9em; background: color-mix(in srgb, var(--panel) 60%, var(--bg)); padding: 1px 4px; border-radius: 3px; }
  .md :global(strong) { font-weight: 700; }
</style>
