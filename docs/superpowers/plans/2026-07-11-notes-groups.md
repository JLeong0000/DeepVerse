# Notes Tab Groups & Motion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user-created groups (iOS-style folders), standalone free notes, direct note creation, multi-select + right-click actions, and iOS-style expand/domino motion to the Notes tab.

**Architecture:** Groups live in `localStorage` (like the existing to-study list); notes gain an optional `group_id` field in the existing IndexedDB store (no migration, filtered in memory). `NotesPage.svelte` is reworked from book-sections into a flat "board" of folder + note tiles, with three new components: `GroupFolder.svelte` (tile), `GroupExpanded.svelte` (expand panel), `ContextMenu.svelte` (right-click menu).

**Tech Stack:** Svelte 5 (runes: `$state`/`$derived`/`$effect`, `$props`, `{#snippet}` optional), Vite, idb, vitest + fake-indexeddb. Design tokens: `--ink`, `--dim`, `--rule`, `--panel`, `--bg`, `--a`.

## Global Constraints

- Svelte 5 runes only (`$state`, `$derived`, `$effect`, `$props`, `$bindable`) — match existing components.
- No new runtime dependencies. Motion uses Svelte built-in transitions (`svelte/transition`) only.
- Match existing style: 2-space indent, terminal-dense one-line CSS rules, design tokens above (no hard-coded colors except the existing danger red `#c0392b`).
- Notes are never destroyed by group operations; deleting a group unassigns its notes.
- The Study-mode card (`components/workbench/NotesCard.svelte`) is OUT OF SCOPE — do not touch it.
- Verify commands run from `app/`: `npm test` (unit), `npm run build` (compile check).

---

## File Structure

- Modify: `app/src/lib/store.js` — group fns (localStorage) + `group_id` in `updateNote` patch. `addNote` already accepts `ref: null`.
- Modify: `app/src/lib/store.test.js` — new group + free-note + assignment tests.
- Modify: `app/src/routes/NotesPage.svelte` — flat board, + Note / + Group, selection, filter-flat, wiring.
- Create: `app/src/components/notes/GroupFolder.svelte` — folder tile (2×2 previews, inline rename).
- Create: `app/src/components/notes/GroupExpanded.svelte` — expand panel (grow + domino + close).
- Create: `app/src/components/notes/ContextMenu.svelte` — cursor-positioned right-click menu + submenu.

---

## Task 1: Store layer — groups, free notes, group assignment

**Files:**
- Modify: `app/src/lib/store.js` (after the to-study section, ~line 131; and `updateNote` ~line 27)
- Test: `app/src/lib/store.test.js`

**Interfaces:**
- Consumes: existing `uuid`, `notesDb()`, `addNote`, `updateNote`, `allNotes`, `_clearAllForTest`.
- Produces:
  - `allGroups(): {id,name,created_at,updated_at}[]` — sorted by `created_at` asc.
  - `addGroup(name?: string): Group` — default name `'New Group'`.
  - `renameGroup(id, name): void`
  - `deleteGroup(id): Promise<void>` — unassigns member notes (`group_id = null`).
  - `updateNote(id, body, patch)` now also copies `patch.group_id` when present.
  - `addNote({target_type:'free', ref:null, body})` supported (already works; asserted by test).

- [ ] **Step 1: Write failing tests**

Add to `app/src/lib/store.test.js` (new `describe` block after the existing notes block):

```js
describe('groups (localStorage) + free notes', () => {
  test('addGroup / allGroups ordering / renameGroup', async () => {
    const a = store.addGroup('Faith');
    const b = store.addGroup();               // default name
    expect(b.name).toBe('New Group');
    const ids = store.allGroups().map(g => g.id);
    expect(ids).toEqual([a.id, b.id]);        // created_at ascending
    store.renameGroup(a.id, 'Grace');
    expect(store.allGroups().find(g => g.id === a.id).name).toBe('Grace');
  });

  test('addNote supports a free note (null ref)', async () => {
    const n = await store.addNote({ target_type: 'free', ref: null, body: 'loose thought' });
    expect(n.ref).toBeNull();
    expect((await store.allNotes()).map(x => x.id)).toContain(n.id);
  });

  test('updateNote assigns and unassigns group_id', async () => {
    const g = store.addGroup('G');
    const n = await store.addNote({ target_type: 'free', ref: null, body: 'x' });
    await store.updateNote(n.id, 'x', { group_id: g.id });
    expect((await store.allNotes()).find(x => x.id === n.id).group_id).toBe(g.id);
    await store.updateNote(n.id, 'x', { group_id: null });
    expect((await store.allNotes()).find(x => x.id === n.id).group_id).toBeNull();
  });

  test('deleteGroup unassigns member notes but keeps them', async () => {
    const g = store.addGroup('G');
    const n = await store.addNote({ target_type: 'free', ref: null, body: 'keep me' });
    await store.updateNote(n.id, 'keep me', { group_id: g.id });
    await store.deleteGroup(g.id);
    expect(store.allGroups()).toEqual([]);
    const note = (await store.allNotes()).find(x => x.id === n.id);
    expect(note).toBeTruthy();
    expect(note.group_id).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd app && npx vitest run src/lib/store.test.js`
Expected: FAIL — `store.addGroup is not a function`.

- [ ] **Step 3: Implement in `store.js`**

Extend `updateNote` to copy `group_id` (add one line inside the existing patch handling):

```js
export async function updateNote(id, body, patch = {}) {
  const db = await notesDb();
  const note = await db.get('notes', id);
  if (!note) return null;
  note.body = body;
  if (patch.ref !== undefined) note.ref = patch.ref;
  if (patch.target_type !== undefined) note.target_type = patch.target_type;
  if (patch.group_id !== undefined) note.group_id = patch.group_id;
  note.updated_at = new Date().toISOString();
  await db.put('notes', note);
  return note;
}
```

Add a groups section after the to-study section (before the `// test seam` comment):

```js
// ---------- Note groups (localStorage) ----------
const GROUPS = 'note_groups';
function readGroups() { try { return JSON.parse(localStorage.getItem(GROUPS)) || []; } catch { return []; } }
function writeGroups(list) { localStorage.setItem(GROUPS, JSON.stringify(list)); }

export function allGroups() {
  return readGroups().sort((a, b) => a.created_at.localeCompare(b.created_at));
}
export function addGroup(name = 'New Group') {
  const now = new Date().toISOString();
  const g = { id: uuid(), name, created_at: now, updated_at: now };
  const list = readGroups(); list.push(g); writeGroups(list);
  return g;
}
export function renameGroup(id, name) {
  const list = readGroups(); const g = list.find(x => x.id === id);
  if (g) { g.name = name; g.updated_at = new Date().toISOString(); writeGroups(list); }
}
export async function deleteGroup(id) {
  writeGroups(readGroups().filter(g => g.id !== id));
  const db = await notesDb();
  for (const n of await db.getAll('notes')) {
    if (n.group_id === id) { n.group_id = null; await db.put('notes', n); }
  }
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `cd app && npx vitest run src/lib/store.test.js`
Expected: PASS (all groups tests + existing notes tests green).

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/store.js app/src/lib/store.test.js
git commit -m "feat(notes): store layer for groups, free notes, group_id assignment"
```

---

## Task 2: ContextMenu component

**Files:**
- Create: `app/src/components/notes/ContextMenu.svelte`

**Interfaces:**
- Produces a component with props:
  - `x: number`, `y: number` — viewport cursor coords.
  - `items: { label, action, danger?, disabled?, submenu? }[]` — `submenu` is another `items` array.
  - `onclose: () => void` — called after an action or on dismiss.
- Behavior: fixed-position menu at (x,y); closes on outside pointerdown, Esc, or after an item action. A `submenu` item expands a nested panel on hover.

- [ ] **Step 1: Implement the component**

```svelte
<script>
  let { x = 0, y = 0, items = [], onclose } = $props();
  let openSub = $state(null); // index of item whose submenu is open

  function run(item) {
    if (item.disabled || item.submenu) return;
    item.action?.();
    onclose?.();
  }
  function onKey(e) { if (e.key === 'Escape') onclose?.(); }
</script>

<svelte:window onkeydown={onKey} />
<!-- backdrop swallows the outside click that dismisses the menu -->
<div class="backdrop" onpointerdown={() => onclose?.()} oncontextmenu={(e) => { e.preventDefault(); onclose?.(); }}></div>

<div class="menu" style="left:{x}px; top:{y}px" onpointerdown={(e) => e.stopPropagation()}>
  {#each items as item, i}
    <div class="row" class:danger={item.danger} class:disabled={item.disabled}
      role="menuitem" tabindex="0"
      onmouseenter={() => (openSub = item.submenu ? i : null)}
      onclick={() => run(item)}>
      <span>{item.label}</span>
      {#if item.submenu}<span class="chev">▸</span>{/if}
      {#if item.submenu && openSub === i}
        <div class="menu sub">
          {#each item.submenu as sub}
            <div class="row" class:danger={sub.danger} role="menuitem" tabindex="0"
              onclick={(e) => { e.stopPropagation(); sub.action?.(); onclose?.(); }}>{sub.label}</div>
          {/each}
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .backdrop { position: fixed; inset: 0; z-index: 60; }
  .menu { position: fixed; z-index: 61; min-width: 168px; background: var(--panel); border: 1px solid var(--rule);
    border-radius: 8px; padding: 4px; box-shadow: 0 8px 30px rgba(0,0,0,.28); font-size: 13px; }
  .row { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 10px;
    padding: 6px 10px; border-radius: 5px; color: var(--ink); cursor: pointer; white-space: nowrap; }
  .row:hover { background: color-mix(in srgb, var(--a) 16%, transparent); }
  .row.danger { color: #c0392b; } .row.disabled { opacity: .4; cursor: default; }
  .chev { opacity: .6; font-size: 11px; }
  .menu.sub { position: absolute; left: 100%; top: -5px; margin-left: 2px; }
</style>
```

- [ ] **Step 2: Verify it compiles**

Run: `cd app && npm run build`
Expected: build succeeds (component is not yet imported anywhere; that's fine — build compiles all components).

- [ ] **Step 3: Commit**

```bash
git add app/src/components/notes/ContextMenu.svelte
git commit -m "feat(notes): cursor-positioned ContextMenu with submenu"
```

---

## Task 3: GroupFolder tile

**Files:**
- Create: `app/src/components/notes/GroupFolder.svelte`

**Interfaces:**
- Props:
  - `group: {id,name}`, `notes: Note[]` (members),
  - `onopen: () => void` — plain click on the square opens the group,
  - `onrename: (name: string) => void` — commit a new name,
  - `oncontextmenu: (e: MouseEvent) => void` — right-click the tile.
- Renders a rounded square with a 2×2 preview grid (first up-to-4 members) + a "+k" badge when `notes.length > 4`, and a click-to-edit name below.

- [ ] **Step 1: Implement**

```svelte
<script>
  import { noteHtml } from '../../lib/markdown.js';
  let { group, notes = [], onopen, onrename, oncontextmenu } = $props();

  let editing = $state(false);
  let nameBuf = $state('');
  const slots = $derived(notes.slice(0, 4));
  const overflow = $derived(Math.max(0, notes.length - 4));

  function startRename(e) { e.stopPropagation(); nameBuf = group.name; editing = true; }
  function commit() {
    editing = false;
    const v = nameBuf.trim();
    if (v && v !== group.name) onrename?.(v);
  }
</script>

<div class="folder" oncontextmenu={(e) => { e.preventDefault(); oncontextmenu?.(e); }}>
  <button class="square" onclick={() => onopen?.()} aria-label={`Open ${group.name}`}>
    <div class="grid">
      {#each Array(4) as _, i}
        <div class="slot" class:filled={!!slots[i]}>
          {#if slots[i]}<div class="mini md">{@html noteHtml(slots[i].body)}</div>{/if}
        </div>
      {/each}
    </div>
    {#if overflow > 0}<span class="more">+{overflow}</span>{/if}
  </button>

  {#if editing}
    <input class="name-edit" bind:value={nameBuf} autofocus
      onclick={(e) => e.stopPropagation()}
      onblur={commit} onkeydown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') editing = false; }} />
  {:else}
    <button class="name" onclick={startRename}>{group.name}</button>
  {/if}
</div>

<style>
  .folder { display: flex; flex-direction: column; align-items: center; gap: 7px; }
  .square { width: 100%; aspect-ratio: 1 / 1; position: relative; border: 1px solid var(--rule); border-radius: 18px;
    background: color-mix(in srgb, var(--panel) 70%, var(--bg)); padding: 12%; cursor: pointer; }
  .square:hover { border-color: var(--a); }
  .grid { width: 100%; height: 100%; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 8%; }
  .slot { border-radius: 22%; background: color-mix(in srgb, var(--rule) 40%, transparent);
    border: 1px dashed color-mix(in srgb, var(--rule) 80%, transparent); overflow: hidden; }
  .slot.filled { background: var(--panel); border-style: solid; }
  .mini { font-size: 6px; line-height: 1.25; padding: 4px; color: var(--ink); overflow: hidden; }
  .mini :global(p) { margin: 0; }
  .more { position: absolute; right: 8px; bottom: 8px; font-size: 10px; color: var(--dim);
    background: var(--bg); border-radius: 8px; padding: 0 5px; }
  .name, .name-edit { font-family: inherit; font-size: 12.5px; color: var(--ink); text-align: center; }
  .name { background: none; border: none; cursor: pointer; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .name:hover { color: var(--a); }
  .name-edit { border: 1px solid var(--a); border-radius: 4px; padding: 1px 6px; background: var(--bg); width: 90%; }
</style>
```

- [ ] **Step 2: Verify compile**

Run: `cd app && npm run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/notes/GroupFolder.svelte
git commit -m "feat(notes): GroupFolder tile with 2x2 previews and inline rename"
```

---

## Task 4: NotesPage board — free notes, groups, no motion yet

**Files:**
- Modify: `app/src/routes/NotesPage.svelte`

**Interfaces:**
- Consumes: `allNotes`, `addNote`, `updateNote`, `deleteNote`, `allGroups`, `addGroup`, `renameGroup`, `deleteGroup` from store; `GroupFolder`, `ContextMenu`, `NoteEditor`.
- Produces: the interactive board (tiles + selection + context menu + composer). Task 6 (expand) consumes `openGroup(group)`; Task 5 (motion) wraps the tile list.

This task replaces the book-section rendering with a flat board and wires groups, selection, and the context menu. Expansion (opening a group full-screen) is stubbed to a no-op placeholder replaced in Task 6.

- [ ] **Step 1: Rewrite the `<script>`**

Replace the current script (lines 1–59) with:

```svelte
<script>
  import { allNotes, addNote, updateNote, deleteNote,
           allGroups, addGroup, renameGroup, deleteGroup,
           exportNotes, importNotes } from '../lib/store.js';
  import { formatRef, bookName } from '../lib/refs.js';
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
      { label: 'Rename', action: () => renameInline(group) },
      { label: 'Delete group', danger: true, action: async () => { await deleteGroup(group.id); await load(); } },
    ] };
  }
  async function moveTo(ids, gid) {
    for (const id of ids) { const n = notes.find(x => x.id === id); if (n) await updateNote(id, n.body, { group_id: gid }); }
    clearSelection(); await load();
  }
  async function removeMany(ids) { for (const id of ids) await deleteNote(id); clearSelection(); await load(); }
  async function doRename(group, name) { renameGroup(group.id, name); await load(); }
  let renameTarget = $state(null); // GroupFolder handles inline; this is a fallback for menu "Rename"
  function renameInline(group) { renameTarget = group.id; }

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
```

- [ ] **Step 2: Rewrite the markup**

Replace the current markup (the `<div class="scroll">…</div>` block) with:

```svelte
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
          onopen={() => openGroup(group)}
          onrename={(name) => doRename(group, name)}
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
```

Note: the menu "Rename" fallback (`renameTarget`) is cosmetic; the primary rename is GroupFolder's inline name click. Keep `renameInline` wired but it is acceptable for the menu "Rename" to be a no-op visual for now if inline rename covers the need — remove the menu "Rename" item if it cannot focus the inline input. (Decision: keep menu item "Rename" but have it open inline by setting a prop; if that adds complexity, drop the menu "Rename" item and rely on clicking the folder name.)

- [ ] **Step 3: Update styles**

Keep the existing `.scroll/.page/.head/h1/.actions/.filter/.btn/.empty/.sticky/.r/.body/.d/.md` styles. Add:

```css
.btn.ghost { color: var(--dim); }
.composer { margin: 14px 0 4px; display: flex; flex-direction: column; gap: 8px; max-width: 520px; }
.crow { display: flex; gap: 8px; }
.board { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; margin-top: 22px; align-items: start; }
.sticky.sel { outline: 2px solid var(--a); outline-offset: 1px; }
.r.free { color: var(--dim); cursor: default; }
```

Remove the now-unused `.group` and `.grouphd` and `.notesgrid` rules (they were for book sections). Remove the `bookOrder` import usage (no longer grouping by book) — keep `bookName`/`formatRef` imports only if still referenced; `bookName` is no longer used, so drop it from the import.

- [ ] **Step 4: Verify build + drive the tab**

Run: `cd app && npm run build` → succeeds.
Then drive it (dev server + Playwright or manual): create a free note, create a group, right-click a note → Move to group, Cmd/Ctrl+click two notes → right-click → Delete 2 notes, filter by a book name shows flat results. Confirm no console errors.

- [ ] **Step 5: Commit**

```bash
git add app/src/routes/NotesPage.svelte
git commit -m "feat(notes): flat board with free notes, groups, multi-select + right-click menu"
```

---

## Task 5: Domino load-in motion

**Files:**
- Modify: `app/src/routes/NotesPage.svelte`

**Interfaces:**
- Consumes: board tiles from Task 4. Produces: staggered fade-in on the board.

- [ ] **Step 1: Add the transition**

At the top of the `<script>`, add:

```js
  import { fade } from 'svelte/transition';
```

Wrap each tile with a keyed index for stagger. Compute a flat index across folders then notes:

```svelte
<!-- folders -->
{#each visibleGroups as group, i (group.id)}
  <div in:fade={{ duration: 220, delay: i * 45 }}>
    <GroupFolder … />
  </div>
{/each}
<!-- notes: offset by number of folders -->
{#each looseNotes as note, j (note.id)}
  <div class="sticky" class:sel={…} in:fade={{ duration: 220, delay: (visibleGroups.length + j) * 45 }} …>
    …
  </div>
{/each}
```

(Move the `sticky` classes/handlers onto the same element that carries `in:fade`, or wrap folders in a plain `<div>` carrying the transition as shown. Keep grid layout intact — the wrapper for folders is a grid item.)

- [ ] **Step 2: Verify**

Run: `cd app && npm run build` → succeeds. Drive the tab: on load, tiles fade in left-to-right. Filtering re-triggers the stagger.

- [ ] **Step 3: Commit**

```bash
git add app/src/routes/NotesPage.svelte
git commit -m "feat(notes): domino (staggered) fade-in for board tiles"
```

---

## Task 6: GroupExpanded — grow-to-fill + placeholder fade + domino notes

**Files:**
- Create: `app/src/components/notes/GroupExpanded.svelte`
- Modify: `app/src/routes/NotesPage.svelte`

**Interfaces:**
- `GroupExpanded` props:
  - `group`, `notes` (members), `originRect: {top,left,width,height}` (folder rect relative to the board container), `containerRect: {width,height}`,
  - `onclose: () => void`,
  - `oncontextmenu: (e, note) => void`, `onedit: (note) => void`, `onjump: (note) => void` — reuse board note interactions.
- Behavior: mounts covering `originRect`, transitions on next frame to fill the container; the group's note cards fade in left-to-right (stagger). A header shows name + Close.

- [ ] **Step 1: Implement GroupExpanded**

```svelte
<script>
  import { fade } from 'svelte/transition';
  import { noteHtml } from '../../lib/markdown.js';
  import { formatRef } from '../../lib/refs.js';
  let { group, notes = [], originRect, onclose } = $props();

  let expanded = $state(false);
  $effect(() => { requestAnimationFrame(() => (expanded = true)); });

  const style = $derived(expanded
    ? 'top:0; left:0; width:100%; height:100%;'
    : `top:${originRect.top}px; left:${originRect.left}px; width:${originRect.width}px; height:${originRect.height}px;`);
</script>

<div class="panel" style={style}>
  <div class="hd">
    <b>{group.name}</b>
    <button class="close" onclick={() => onclose?.()}>Close</button>
  </div>
  {#if expanded}
    <div class="grid">
      {#each notes as note, i (note.id)}
        <div class="sticky" in:fade={{ duration: 200, delay: i * 60 }}>
          <div class="r">{note.ref ? formatRef(note.ref) : 'Note'}</div>
          <div class="body md">{@html noteHtml(note.body)}</div>
        </div>
      {/each}
      {#if notes.length === 0}<p class="empty">This group is empty.</p>{/if}
    </div>
  {/if}
</div>

<style>
  .panel { position: absolute; z-index: 20; background: var(--bg); border: 1px solid var(--rule);
    border-radius: 16px; overflow: hidden; transition: top .32s cubic-bezier(.22,1,.36,1),
      left .32s cubic-bezier(.22,1,.36,1), width .32s cubic-bezier(.22,1,.36,1), height .32s cubic-bezier(.22,1,.36,1); }
  .hd { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--rule); }
  .close { border: 1px solid var(--rule); background: transparent; color: var(--ink); border-radius: 5px; padding: 4px 12px; cursor: pointer; font-family: inherit; font-size: 12.5px; }
  .close:hover { border-color: var(--a); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; padding: 16px; align-items: start; }
  .sticky { background: var(--panel); border: 1px solid var(--rule); border-radius: 6px; padding: 11px 12px 10px; }
  .r { font-size: 12px; font-variant: small-caps; letter-spacing: .04em; color: var(--a); margin-bottom: 6px; }
  .body.md { font-size: 13px; line-height: 1.5; color: var(--ink); }
  .empty { color: var(--dim); font-style: italic; }
  .md :global(p) { margin: 0 0 6px; } .md :global(p:last-child) { margin-bottom: 0; }
</style>
```

(Placeholders fade out for free because the folder tile is hidden under the growing panel; the growth from `originRect` to full container reads as the folder growing. This satisfies "grows to fill" + "placeholders fade out" without a separate FLIP of the 2×2.)

- [ ] **Step 2: Wire into NotesPage**

Make the board container `position: relative` and measured. In the script, replace the Task 4 expansion stub:

```js
  let boardEl;                       // bind:this on the .board
  let openGroup_ = $state(null);     // { group, originRect }
  function openGroup(group, e) {
    const folderEl = e.currentTarget.closest('.tile') || e.currentTarget;
    const b = boardEl.getBoundingClientRect();
    const r = folderEl.getBoundingClientRect();
    openGroup_ = { group, originRect: { top: r.top - b.top, left: r.left - b.left, width: r.width, height: r.height } };
  }
```

Have `GroupFolder`'s `onopen` pass the event: change GroupFolder to `onopen?.(e)` on the square click, and in NotesPage `onopen={(e) => openGroup(group, e)}`. Wrap each board tile in a `.tile` div so `closest('.tile')` resolves. Add near the end of the board markup (inside the relative container):

```svelte
{#if openGroup_}
  <div class="dim-out"></div>
  <GroupExpanded group={openGroup_.group} notes={membersOf(openGroup_.group.id)}
    originRect={openGroup_.originRect} onclose={() => (openGroup_ = null)} />
{/if}
```

Add styles:

```css
.board { position: relative; }
.dim-out { position: absolute; inset: 0; background: var(--bg); opacity: .001; z-index: 10; animation: fadeOut .28s forwards; }
@keyframes fadeOut { to { opacity: .96; } }
```

The `.dim-out` overlay fades the board tiles out (covers them) while the panel (z-index 20) grows above it — "fade out only the notes container, not the page."

- [ ] **Step 3: Verify build + drive**

Run: `cd app && npm run build` → succeeds. Drive: click a folder → board fades out, panel grows from the folder to fill the board, notes fade in one-by-one; Close returns to the board (which dominoes back in). Escape/close works. No console errors.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/notes/GroupExpanded.svelte app/src/routes/NotesPage.svelte
git commit -m "feat(notes): grow-to-fill group expansion with domino note reveal"
```

---

## Self-Review Notes

- **Spec coverage:** free notes (T1/T4), groups CRUD (T1/T4), move single+multi (T4), context menu right-click (T2/T4), multi-select Cmd/Shift (T4), folder 2×2 + rename (T3), flat search (T4), domino load-in (T5), grow-to-fill + placeholder fade + domino notes (T6). All covered.
- **Type consistency:** `group_id` used consistently; `updateNote(id, body, {group_id})` matches T1 signature; `membersOf`, `looseNotes`, `visibleGroups` defined once in T4 and reused in T5/T6.
- **Known simplification:** placeholder fade in T6 is achieved by the growing panel occluding the folder rather than a separate 2×2 crossfade — acceptable per spec intent. If a literal 2×2 fade is wanted later, add a `crossfade` between folder slots and expanded cards.
- **Ordering caveat:** shift-range selection operates over `looseNotes` only (notes visible on the board); notes inside groups are selected within the expanded view (not wired for multi-select in T6 — the expanded view is read/act-per-note; extend if needed).
```
