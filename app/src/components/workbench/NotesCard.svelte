<script>
  import { notesForRef, addNote, updateNote, deleteNote } from '../../lib/store.js';
  import { study } from '../../lib/study.svelte.js';

  // target the selected verse, or the chapter when no verse is selected
  let target = $derived(study.verse != null
    ? { type: 'verse', ref: `${study.book}.${study.chapter}.${study.verse}` }
    : { type: 'chapter', ref: `${study.book}.${study.chapter}` });

  let notes = $state([]);
  let draft = $state('');

  $effect(() => {
    const ref = target.ref;
    notesForRef(ref).then(n => (notes = n));
  });

  async function save() {
    const body = draft.trim();
    if (!body) return;
    await addNote({ target_type: target.type, ref: target.ref, body });
    draft = '';
    notes = await notesForRef(target.ref);
  }
  async function edit(note, e) {
    const body = e.target.value.trim();
    if (body && body !== note.body) { await updateNote(note.id, body); }
    else if (!body) { await deleteNote(note.id); notes = await notesForRef(target.ref); }
  }
</script>

<div class="wrap">
  <div class="tgt">Note on <b>{target.ref}</b> <span class="dim">({target.type})</span></div>
  {#each notes as note (note.id)}
    <textarea class="note" value={note.body} onblur={(e) => edit(note, e)}></textarea>
  {/each}
  <textarea class="note draft" placeholder="Add a note… (markdown)" bind:value={draft}></textarea>
  <button class="save" onclick={save} disabled={!draft.trim()}>Save note</button>
</div>

<style>
  .wrap { padding: 10px 11px; display: flex; flex-direction: column; gap: 7px; }
  .tgt { font-size: 12px; color: var(--dim); } .tgt b { color: var(--ink); } .dim { opacity: .7; }
  .note { font-family: inherit; font-size: 13px; line-height: 1.5; padding: 7px 9px; border: 1px solid var(--rule);
    border-radius: 5px; background: var(--bg); color: var(--ink); resize: vertical; min-height: 42px; }
  .note.draft { min-height: 54px; }
  .save { align-self: flex-start; border: 1px solid var(--rule); background: transparent; color: var(--ink);
    border-radius: 4px; padding: 4px 11px; cursor: pointer; font-family: inherit; font-size: 12px; }
  .save:hover:not(:disabled) { border-color: var(--a); } .save:disabled { opacity: .4; cursor: default; }
</style>
