<script>
  import { allNotes, addNote, updateNote, deleteNote,
           allGroups, addGroup, renameGroup, deleteGroup,
           exportNotes, importNotes } from '../lib/store.js';
  import { formatRef } from '../lib/refs.js';
  import { openStudy } from '../lib/router.svelte.js';
  import { noteHtml, noteIsEmpty } from '../lib/markdown.js';
  import NoteEditor from '../components/notes/NoteEditor.svelte';
  import GroupFolder from '../components/notes/GroupFolder.svelte';
  import ContextMenu from '../components/notes/ContextMenu.svelte';

  let notes = $state([]);
  let groups = $state([]);
  let filter = $state('');
  let fileInput;

  // note create / edit
  let composing = $state(false);
  let draft = $state('');
  let editingId = $state(null);
  let editBuf = $state('');

  // selection (note ids) + anchor for shift-range
  let selected = $state(new Set());
  let anchorId = $state(null);

  // context menu
  let menu = $state(null); // { x, y, items }

  // group rename, triggered from the context menu (inline rename on the folder itself)
  let renamingId = $state(null);

  async function load() {
    notes = (await allNotes()).reverse(); // newest first
    groups = allGroups();
  }
  $effect(() => { load(); });

  const q = $derived(filter.trim().toLowerCase());
  function matches(n) {
    if (!q) return true;
    if (n.body.toLowerCase().includes(q)) return true;
    return n.ref ? formatRef(n.ref).toLowerCase().includes(q) : false;
  }
  // when filtering, show a flat list of ALL matching notes (loose + grouped), no folders
  let looseNotes = $derived(q ? notes.filter(matches) : notes.filter(n => !n.group_id));
  let visibleGroups = $derived(q ? [] : groups);
  const membersOf = (gid) => notes.filter(n => n.group_id === gid);
  // board order used for shift-range selection: folders first, then loose notes
  let orderedNoteIds = $derived(looseNotes.map(n => n.id));

  // ---- create / edit ----
  function startCompose() { composing = true; draft = ''; }
  async function saveNew() {
    if (noteIsEmpty(draft)) { composing = false; return; }
    await addNote({ target_type: 'free', ref: null, body: draft });
    composing = false; draft = ''; await load();
  }
  function startEdit(note) { editingId = note.id; editBuf = note.body; }
  async function commitEdit(note) {
    editingId = null;
    if (noteIsEmpty(editBuf)) { await deleteNote(note.id); await load(); }
    else if (editBuf !== note.body) { await updateNote(note.id, editBuf); await load(); }
  }
  function jump(note) {
    if (!note.ref) return;
    const [book, chapter, verse] = note.ref.split('.');
    openStudy({ version: 'NIV', book, chapter: +chapter, verse: verse ? +verse : null });
  }

  // ---- selection ----
  function noteClick(e, note) {
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      const s = new Set(selected);
      s.has(note.id) ? s.delete(note.id) : s.add(note.id);
      selected = s; anchorId = note.id; return true;
    }
    if (e.shiftKey && anchorId) {
      e.preventDefault();
      const a = orderedNoteIds.indexOf(anchorId), b = orderedNoteIds.indexOf(note.id);
      if (a !== -1 && b !== -1) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        selected = new Set(orderedNoteIds.slice(lo, hi + 1));
      }
      return true;
    }
    return false; // plain click → caller handles edit/jump
  }
  function clearSelection() { selected = new Set(); anchorId = null; }

  // ---- context menu ----
  function noteMenu(e, note) {
    e.preventDefault();
    if (!selected.has(note.id)) { selected = new Set([note.id]); anchorId = note.id; }
    const ids = [...selected];
    const moveSub = [
      ...groups.map(g => ({ label: g.name, action: () => moveTo(ids, g.id) })),
      { label: 'New group…', action: () => { const g = addGroup(); moveTo(ids, g.id); } },
      { label: 'Remove from group', action: () => moveTo(ids, null) },
    ];
    const items = ids.length > 1
      ? [{ label: `Move to group`, submenu: moveSub }, { label: `Delete ${ids.length} notes`, danger: true, action: () => removeMany(ids) }]
      : [{ label: 'Move to group', submenu: moveSub },
         { label: 'Edit', action: () => startEdit(note) },
         { label: 'Delete', danger: true, action: () => removeMany(ids) }];
    menu = { x: e.clientX, y: e.clientY, items };
  }
  function groupMenu(e, group) {
    e.preventDefault();
    menu = { x: e.clientX, y: e.clientY, items: [
      { label: 'Rename', action: () => (renamingId = group.id) },
      { label: 'Delete group', danger: true, action: async () => { await deleteGroup(group.id); await load(); } },
    ] };
  }
  async function moveTo(ids, gid) {
    for (const id of ids) { const n = notes.find(x => x.id === id); if (n) await updateNote(id, n.body, { group_id: gid }); }
    clearSelection(); await load();
  }
  async function removeMany(ids) { for (const id of ids) await deleteNote(id); clearSelection(); await load(); }
  async function doRename(group, name) { renameGroup(group.id, name); await load(); }

  // expansion — replaced in Task 6
  let openGroupId = $state(null);
  function openGroup(group) { openGroupId = group.id; }

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
    await load(); e.target.value = ''; alert(`Imported ${n} notes.`);
  }
</script>

<div class="scroll"><div class="page">
  <div class="head">
    <h1>Notes</h1>
    <div class="actions">
      <input class="filter" placeholder="Filter notes… (book or text)" bind:value={filter} />
      <button class="btn" onclick={startCompose}>+ Note</button>
      <button class="btn" onclick={async () => { addGroup(); await load(); }}>+ Group</button>
      <button class="btn" onclick={doExport}>Export</button>
      <button class="btn" onclick={() => fileInput.click()}>Import</button>
      <input type="file" accept="application/json" bind:this={fileInput} onchange={doImport} hidden />
    </div>
  </div>

  {#if composing}
    <div class="composer">
      <NoteEditor bind:value={draft} placeholder="Write a note…" autofocus />
      <div class="crow">
        <button class="btn" onclick={saveNew} disabled={noteIsEmpty(draft)}>Save</button>
        <button class="btn ghost" onclick={() => (composing = false)}>Cancel</button>
      </div>
    </div>
  {/if}

  {#if notes.length === 0 && groups.length === 0}
    <p class="empty">No notes yet. Add one with “+ Note”, or jot one against a verse in Study mode.</p>
  {:else}
    <!-- clicking empty board space clears selection -->
    <div class="board" onclick={(e) => { if (e.target.classList.contains('board')) clearSelection(); }}
      role="presentation">
      {#each visibleGroups as group (group.id)}
        <GroupFolder {group} notes={membersOf(group.id)}
          renaming={renamingId === group.id}
          onopen={() => openGroup(group)}
          onrename={(name) => doRename(group, name)}
          onrenamedone={() => (renamingId = null)}
          oncontextmenu={(e) => groupMenu(e, group)} />
      {/each}

      {#each looseNotes as note (note.id)}
        <div class="sticky" class:sel={selected.has(note.id)}
          oncontextmenu={(e) => noteMenu(e, note)} role="presentation">
          {#if note.ref}
            <div class="r" onclick={(e) => { if (!noteClick(e, note)) jump(note); }} role="button" tabindex="0">
              {formatRef(note.ref)}{note.target_type === 'chapter' ? ' · ch' : ''} →
            </div>
          {:else}
            <div class="r free">Note</div>
          {/if}
          {#if editingId === note.id}
            <NoteEditor bind:value={editBuf} onsave={() => commitEdit(note)} autofocus />
          {:else}
            <div class="body md" onclick={(e) => { if (!noteClick(e, note)) startEdit(note); }} role="button" tabindex="0">{@html noteHtml(note.body)}</div>
          {/if}
          <div class="d">{new Date(note.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
        </div>
      {/each}
    </div>
  {/if}
</div></div>

{#if menu}
  <ContextMenu x={menu.x} y={menu.y} items={menu.items} onclose={() => (menu = null)} />
{/if}

<style>
  .scroll { flex: 1; min-height: 0; overflow-y: auto; }
  .page { padding: 20px 30px 40px; max-width: 1100px; margin: 0 auto; }
  .head { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 8px; }
  h1 { font-size: 26px; font-weight: normal; margin: 0; }
  .actions { display: flex; gap: 8px; align-items: center; }
  .filter { font-family: inherit; font-size: 13px; padding: 5px 10px; border: 1px solid var(--rule); border-radius: 5px; background: var(--bg); color: var(--ink); }
  .btn { border: 1px solid var(--rule); background: transparent; color: var(--ink); border-radius: 5px; padding: 5px 12px; cursor: pointer; font-family: inherit; font-size: 12.5px; }
  .btn:hover { border-color: var(--a); }
  .btn.ghost { color: var(--dim); }
  .empty { color: var(--dim); font-style: italic; margin-top: 20px; }
  .composer { margin: 14px 0 4px; display: flex; flex-direction: column; gap: 8px; max-width: 520px; }
  .crow { display: flex; gap: 8px; }
  .board { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; margin-top: 22px; align-items: start; }
  .sticky { background: var(--panel); border: 1px solid var(--rule); border-radius: 6px; padding: 11px 12px 10px; display: flex; flex-direction: column; gap: 6px; }
  .sticky.sel { outline: 2px solid var(--a); outline-offset: 1px; }
  .r { font-size: 12px; font-variant: small-caps; letter-spacing: .04em; color: var(--a); cursor: pointer; }
  .r:hover { text-decoration: underline; }
  .r.free { color: var(--dim); cursor: default; }
  .body.md { font-size: 13px; line-height: 1.5; color: var(--ink); cursor: text; min-height: 24px; }
  .body.md:hover { color: var(--ink); }
  .d { font-size: 10px; color: var(--dim); }
  .md :global(p) { margin: 0 0 6px; } .md :global(p:last-child) { margin-bottom: 0; }
  .md :global(ul), .md :global(ol) { margin: 4px 0; padding-left: 20px; } .md :global(li) { margin: 2px 0; }
  .md :global(h3), .md :global(h4), .md :global(h5) { margin: 6px 0 4px; font-size: 1.05em; }
  .md :global(code) { font-family: ui-monospace, Menlo, monospace; font-size: .9em; background: color-mix(in srgb, var(--panel) 60%, var(--bg)); padding: 1px 4px; border-radius: 3px; }
</style>
