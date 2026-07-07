<script>
  import { allNotes, updateNote, deleteNote, exportNotes, importNotes } from '../lib/store.js';
  import { formatRef, bookName, bookOrder } from '../lib/refs.js';
  import { openStudy } from '../lib/router.svelte.js';
  import { noteHtml, noteIsEmpty } from '../lib/markdown.js';
  import NoteEditor from '../components/notes/NoteEditor.svelte';

  let notes = $state([]);
  let filter = $state('');
  let fileInput;
  let editingId = $state(null);
  let editBuf = $state('');

  async function load() { notes = await allNotes(); notes.reverse(); } // newest first
  $effect(() => { load(); });

  let filtered = $derived(
    notes.filter(n => {
      const q = filter.trim().toLowerCase();
      return !q || n.body.toLowerCase().includes(q) || formatRef(n.ref).toLowerCase().includes(q);
    })
  );
  // group by book (canonical order)
  let groups = $derived.by(() => {
    const m = new Map();
    for (const n of filtered) {
      const book = n.ref.split('.')[0];
      if (!m.has(book)) m.set(book, []);
      m.get(book).push(n);
    }
    return [...m.entries()].sort((a, b) => bookOrder(a[0]) - bookOrder(b[0]));
  });

  function startEdit(note) { editingId = note.id; editBuf = note.body; }
  async function commitEdit(note) {
    editingId = null;
    if (noteIsEmpty(editBuf)) { await deleteNote(note.id); await load(); }
    else if (editBuf !== note.body) { await updateNote(note.id, editBuf); await load(); }
  }
  function jump(note) {
    const [book, chapter, verse] = note.ref.split('.');
    openStudy({ version: 'NIV', book, chapter: +chapter, verse: verse ? +verse : null });
  }
  async function doExport() {
    const blob = new Blob([await exportNotes()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `deepverse-notes-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  }
  async function doImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const n = await importNotes(await file.text());
    await load();
    e.target.value = '';
    alert(`Imported ${n} notes.`);
  }
</script>

<div class="scroll"><div class="page">
  <div class="head">
    <h1>Notes</h1>
    <div class="actions">
      <input class="filter" placeholder="Filter notes…" bind:value={filter} />
      <button class="btn" onclick={doExport}>Export</button>
      <button class="btn" onclick={() => fileInput.click()}>Import</button>
      <input type="file" accept="application/json" bind:this={fileInput} onchange={doImport} hidden />
    </div>
  </div>

  {#if notes.length === 0}
    <p class="empty">No notes yet. Open a verse in Study mode and jot one down.</p>
  {:else if filtered.length === 0}
    <p class="empty">No notes match “{filter}”.</p>
  {:else}
    {#each groups as [book, items] (book)}
      <section class="group">
        <div class="grouphd">{bookName(book)}</div>
        <div class="notesgrid">
          {#each items as note (note.id)}
            <div class="sticky">
              <div class="r" onclick={() => jump(note)} role="button" tabindex="0">
                {formatRef(note.ref)}{note.target_type === 'chapter' ? ' · ch' : ''} →
              </div>
              {#if editingId === note.id}
                <NoteEditor bind:value={editBuf} onsave={() => commitEdit(note)} autofocus />
              {:else}
                <div class="body md" onclick={() => startEdit(note)} role="button" tabindex="0">{@html noteHtml(note.body)}</div>
              {/if}
              <div class="d">{new Date(note.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
            </div>
          {/each}
        </div>
      </section>
    {/each}
  {/if}
</div></div>

<style>
  .scroll { flex: 1; min-height: 0; overflow-y: auto; }
  .page { padding: 20px 30px 40px; max-width: 1100px; margin: 0 auto; }
  .head { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 8px; }
  h1 { font-size: 26px; font-weight: normal; margin: 0; }
  .actions { display: flex; gap: 8px; align-items: center; }
  .filter { font-family: inherit; font-size: 13px; padding: 5px 10px; border: 1px solid var(--rule); border-radius: 5px; background: var(--bg); color: var(--ink); }
  .btn { border: 1px solid var(--rule); background: transparent; color: var(--ink); border-radius: 5px; padding: 5px 12px; cursor: pointer; font-family: inherit; font-size: 12.5px; }
  .btn:hover { border-color: var(--a); }
  .empty { color: var(--dim); font-style: italic; margin-top: 20px; }
  .group { margin-top: 22px; }
  .grouphd { font-variant: small-caps; letter-spacing: .06em; color: var(--dim); font-size: 13px; border-bottom: 1px solid var(--rule); padding-bottom: 5px; margin-bottom: 12px; }
  .notesgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
  .sticky { background: var(--panel); border: 1px solid var(--rule); border-radius: 6px; padding: 11px 12px 10px; display: flex; flex-direction: column; gap: 6px; }
  .r { font-size: 12px; font-variant: small-caps; letter-spacing: .04em; color: var(--a); cursor: pointer; }
  .r:hover { text-decoration: underline; }
  .body.md { font-size: 13px; line-height: 1.5; color: var(--ink); cursor: text; min-height: 24px; }
  .body.md:hover { color: var(--ink); }
  .d { font-size: 10px; color: var(--dim); }
  .md :global(p) { margin: 0 0 6px; } .md :global(p:last-child) { margin-bottom: 0; }
  .md :global(ul), .md :global(ol) { margin: 4px 0; padding-left: 20px; } .md :global(li) { margin: 2px 0; }
  .md :global(h3), .md :global(h4), .md :global(h5) { margin: 6px 0 4px; font-size: 1.05em; }
  .md :global(code) { font-family: ui-monospace, Menlo, monospace; font-size: .9em; background: color-mix(in srgb, var(--panel) 60%, var(--bg)); padding: 1px 4px; border-radius: 3px; }
</style>
