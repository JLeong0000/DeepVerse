<script>
  import { notesForRef, addNote, updateNote, deleteNote, allGroups, addGroup } from '../../lib/store.js';
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
  let editing = $state(null); // snapshot of the note being edited; survives selection changes
  let editBuf = $state('');
  let groups = $state([]);
  let groupSel = $state(''); // '' = no group, a group id, or '__new'

  $effect(() => { notesForRef(target.ref).then(n => (notes = n)); });
  $effect(() => { groups = allGroups(); });

  async function refresh() { notes = await notesForRef(target.ref); }
  // resolve the dropdown value into a group id (creating a group if "New group…" was picked)
  function resolveGroup() {
    if (groupSel === '__new') { const g = addGroup(); groups = allGroups(); groupSel = g.id; return g.id; }
    return groupSel || null;
  }

  // Notes commit only via explicit buttons here (no blur-save), so a draft persists as you
  // change the verse selection and lands on whatever verse is selected when you press Save.
  async function saveNew() {
    if (noteIsEmpty(draft)) return;
    await addNote({ target_type: target.type, ref: target.ref, body: draft, group_id: resolveGroup() });
    draft = ''; draftNonce++; groupSel = ''; await refresh();
  }

  function startEdit(note) { editing = { ...note }; editBuf = note.body; groupSel = note.group_id ?? ''; }
  function cancelEdit() { editing = null; editBuf = ''; groupSel = ''; }
  async function saveEdit() {
    if (noteIsEmpty(editBuf)) return;
    // Save retargets the note to the currently-selected verse and applies the chosen group.
    await updateNote(editing.id, editBuf, { ref: target.ref, target_type: target.type, group_id: resolveGroup() });
    editing = null; editBuf = ''; groupSel = ''; await refresh();
  }
  async function removeEdit() {
    await deleteNote(editing.id);
    editing = null; editBuf = ''; groupSel = ''; await refresh();
  }
</script>

<div class="wrap">
  <div class="tgt">
    <span>Note on <b>{target.label}</b> <span class="dim">({target.type === 'chapter' ? 'chapter' : (target.ref.includes('-') ? 'verse range' : 'verse')})</span></span>
    {@render groupSelect()}
  </div>

  {#each notes as note (note.id)}
    {#if editing?.id !== note.id}
      <div class="note">
        <div class="body md">{@html noteHtml(note.body)}</div>
        <button class="edit" onclick={() => startEdit(note)}>Edit</button>
      </div>
    {/if}
  {/each}

  {#if editing}
    <NoteEditor bind:value={editBuf} placeholder="Add a note…" autofocus />
    <div class="actions">
      <button class="save" onclick={saveEdit} disabled={noteIsEmpty(editBuf)}>Save</button>
      <button class="ghost" onclick={cancelEdit}>Cancel</button>
      <button class="ghost danger" onclick={removeEdit}>Delete</button>
    </div>
  {:else}
    {#key draftNonce}
      <NoteEditor bind:value={draft} placeholder="Add a note…" />
    {/key}
    <button class="save" onclick={saveNew} disabled={noteIsEmpty(draft)}>Save note</button>
  {/if}
</div>

{#snippet groupSelect()}
  <select class="grp" bind:value={groupSel} title="Save into a group">
    <option value="">No group</option>
    {#each groups as g}<option value={g.id}>{g.name}</option>{/each}
    <option value="__new">New group…</option>
  </select>
{/snippet}

<style>
  .wrap { padding: 10px 11px; display: flex; flex-direction: column; gap: 8px; }
  .tgt { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 12px; color: var(--dim); }
  .tgt b { color: var(--ink); } .dim { opacity: .7; }
  .note { display: flex; align-items: flex-start; gap: 8px; padding: 8px 10px; border: 1px solid var(--rule);
    border-radius: 6px; background: color-mix(in srgb, var(--panel) 50%, var(--bg)); }
  .note:hover { border-color: var(--a); }
  .note .body { flex: 1; font-size: 13px; line-height: 1.5; }
  .edit { flex: none; border: 1px solid transparent; background: transparent; color: var(--dim);
    border-radius: 4px; padding: 1px 7px; cursor: pointer; font-family: inherit; font-size: 12px; }
  .edit:hover { border-color: var(--rule); color: var(--ink); }
  .actions { display: flex; gap: 6px; align-items: center; }
  .grp { font-family: inherit; font-size: 12px; padding: 3px 6px; border: 1px solid var(--rule);
    border-radius: 4px; background: var(--bg); color: var(--ink); }
  .save { align-self: flex-start; border: 1px solid var(--rule); background: transparent; color: var(--ink);
    border-radius: 4px; padding: 4px 11px; cursor: pointer; font-family: inherit; font-size: 12px; }
  .save:hover:not(:disabled) { border-color: var(--a); } .save:disabled { opacity: .4; cursor: default; }
  .ghost { border: 1px solid transparent; background: transparent; color: var(--dim); border-radius: 4px;
    padding: 4px 9px; cursor: pointer; font-family: inherit; font-size: 12px; }
  .ghost:hover { border-color: var(--rule); color: var(--ink); }
  .ghost.danger:hover { border-color: #c0392b; color: #c0392b; }

  /* rendered-markdown primitives (shared look for note bodies) */
  .md :global(p) { margin: 0 0 6px; } .md :global(p:last-child) { margin-bottom: 0; }
  .md :global(ul), .md :global(ol) { margin: 4px 0; padding-left: 20px; }
  .md :global(li) { margin: 2px 0; }
  .md :global(h3), .md :global(h4), .md :global(h5) { margin: 6px 0 4px; font-size: 1.05em; }
  .md :global(code) { font-family: ui-monospace, Menlo, monospace; font-size: .9em; background: color-mix(in srgb, var(--panel) 60%, var(--bg)); padding: 1px 4px; border-radius: 3px; }
  .md :global(strong) { font-weight: 700; }
</style>
