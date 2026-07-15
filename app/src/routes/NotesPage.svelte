<script>
  import { allNotes, addNote, updateNote, deleteNote,
           allGroups, addGroup, renameGroup, deleteGroup,
           exportNotes, importNotes } from '../lib/store.js';
  import { formatRef } from '../lib/refs.js';
  import { noteHtml } from '../lib/markdown.js';
  import { fade } from 'svelte/transition';
  import GroupFolder from '../components/notes/GroupFolder.svelte';
  import GroupExpanded from '../components/notes/GroupExpanded.svelte';
  import ContextMenu from '../components/notes/ContextMenu.svelte';
  import NoteOverlay from '../components/notes/NoteOverlay.svelte';

  let notes = $state([]);
  let groups = $state([]);
  let filter = $state('');
  let fileInput;
  let boardEl = $state();
  let boardNonce = $state(0);

  // selection (note ids) + anchor for shift-range
  let selected = $state(new Set());
  let anchorId = $state(null);

  let menu = $state(null);        // context menu { x, y, items }
  let renamingId = $state(null);  // group being inline-renamed
  let overlay = $state(null);     // { note, initialGroupId } — note null ⇒ creating

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
  let orderedNoteIds = $derived(looseNotes.map(n => n.id));

  // ---- overlay (create / edit) ----
  function openNewNote() { overlay = { note: null, initialGroupId: openGroup_ ? openGroup_.group.id : null }; }
  function openNote(note) { overlay = { note, initialGroupId: null }; }
  async function saveOverlay(body, groupId, color) {
    if (groupId === '__new') { const g = addGroup(); groupId = g.id; }
    if (overlay.note) await updateNote(overlay.note.id, body, { group_id: groupId, color });
    else await addNote({ target_type: 'free', ref: null, body, group_id: groupId, color });
    await load();
  }
  async function deleteOverlay() { if (overlay.note) { await deleteNote(overlay.note.id); await load(); } }

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
    anchorId = note.id;
    return false; // plain click → caller opens the overlay
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
         { label: 'Edit', action: () => openNote(note) },
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

  // expansion — grow-to-fill group folder
  let openGroup_ = $state(null); // { group, originRect }
  function openGroup(group, e) {
    const folderEl = e.currentTarget.closest('.folder');
    const b = boardEl.getBoundingClientRect();
    const r = folderEl.getBoundingClientRect();
    openGroup_ = { group, originRect: { top: r.top - b.top, left: r.left - b.left, width: r.width, height: r.height } };
  }
  function closeGroup() { openGroup_ = null; boardNonce++; }

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

<svelte:window onkeydown={(e) => { if (e.key === 'Escape' && !menu && !overlay && selected.size) clearSelection(); }} />

{#snippet noteTile(note, delayMs, colorN)}
  <div class="tile" class:sel={selected.has(note.id)}
    oncontextmenu={(e) => noteMenu(e, note)} role="presentation"
    in:fade={{ duration: 200, delay: delayMs }}>
    <button class="sq postit" style="background: var(--sy{colorN})"
      onclick={(e) => { if (!noteClick(e, note)) openNote(note); }}>
      <div class="body md">{@html noteHtml(note.body)}</div>
    </button>
  </div>
{/snippet}

<div class="scroll"><div class="page">
  <div class="head">
    <h1>Memo</h1>
    <div class="actions">
      <input class="filter" placeholder="Filter memos…" bind:value={filter} />
      <button class="btn" onclick={openNewNote}>+ Memo</button>
      <button class="btn" onclick={async () => { addGroup(); await load(); }}>+ Group</button>
      <button class="btn" onclick={doExport}>Export</button>
      <button class="btn" onclick={() => fileInput.click()}>Import</button>
      <input type="file" accept="application/json" bind:this={fileInput} onchange={doImport} hidden />
    </div>
  </div>

  {#if notes.length === 0 && groups.length === 0}
    <p class="empty">No memos yet. Add one with “+ Memo”, or jot one against a verse in Study mode.</p>
  {:else}
    <div class="board" class:expanded={!!openGroup_} bind:this={boardEl}
      onclick={(e) => { if (e.target.classList.contains('board')) clearSelection(); }}
      role="presentation">
      {#key boardNonce}
      {#each visibleGroups as group, i (group.id)}
        <div in:fade={{ duration: 200, delay: i * 45 }}>
          <GroupFolder {group} notes={membersOf(group.id)}
            renaming={renamingId === group.id}
            onopen={(e) => openGroup(group, e)}
            onrename={(name) => doRename(group, name)}
            onrenamedone={() => (renamingId = null)}
            oncontextmenu={(e) => groupMenu(e, group)} />
        </div>
      {/each}

      {#each looseNotes as note, j (note.id)}{@render noteTile(note, (visibleGroups.length + j) * 45, note.color ?? ((j % 4) + 1))}{/each}
      {/key}

      {#if openGroup_}
        <div class="dim-out"></div>
        <GroupExpanded group={openGroup_.group} originRect={openGroup_.originRect} onclose={closeGroup}>
          {#each membersOf(openGroup_.group.id) as note, k (note.id)}
            {@render noteTile(note, k * 55, note.color ?? ((k % 4) + 1))}
          {/each}
          {#if membersOf(openGroup_.group.id).length === 0}<p class="empty">This group is empty.</p>{/if}
        </GroupExpanded>
      {/if}
    </div>
  {/if}
</div></div>

{#if menu}
  <ContextMenu x={menu.x} y={menu.y} items={menu.items} onclose={() => (menu = null)} />
{/if}

{#if overlay}
  <NoteOverlay note={overlay.note} groups={groups} initialGroupId={overlay.initialGroupId}
    onsave={saveOverlay} ondelete={deleteOverlay} onclose={() => (overlay = null)} />
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
  .empty { color: var(--dim); font-style: italic; margin-top: 20px; }

  .board { position: relative; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 20px 18px; margin-top: 22px; align-items: start; }
  /* while a group is open the panel fills the board, so give it a real height to grow into */
  .board.expanded { min-height: calc(100vh - 210px); }
  .dim-out { position: absolute; inset: 0; background: var(--bg); opacity: 0; z-index: 10; animation: fadeOut .26s ease forwards; }
  @keyframes fadeOut { to { opacity: .94; } }

  /* uniform tile: square on top, caption below (matches GroupFolder) */
  .tile { display: flex; flex-direction: column; align-items: center; gap: 7px; }
  .sq { width: 100%; aspect-ratio: 1 / 1; border: none; border-radius: 10px; padding: 12px 12px 14px;
    cursor: pointer; overflow: hidden; text-align: left; display: block; font-family: inherit; }
  .tile.sel .sq { outline: 2px solid var(--a); outline-offset: 2px; }
  .sq .body { font-size: 12.5px; line-height: 1.4; height: 100%; overflow: hidden;
    -webkit-mask-image: linear-gradient(180deg, #000 78%, transparent); mask-image: linear-gradient(180deg, #000 78%, transparent); }

  .md :global(p) { margin: 0 0 5px; } .md :global(p:last-child) { margin-bottom: 0; }
  .md :global(ul), .md :global(ol) { margin: 3px 0; padding-left: 18px; } .md :global(li) { margin: 1px 0; }
  .md :global(h3), .md :global(h4), .md :global(h5) { margin: 4px 0 3px; font-size: 1.05em; }
  .md :global(code) { font-family: ui-monospace, Menlo, monospace; font-size: .9em; background: rgba(0,0,0,.06); padding: 1px 4px; border-radius: 3px; }
  .md :global(strong) { font-weight: 700; }
</style>
