# Notes Tab: Groups, Free Notes & iOS-style Motion

Date: 2026-07-11
Status: Approved design, ready for planning

## Problem

The Notes tab (`app/src/routes/NotesPage.svelte`) only lists notes that were
created in Study mode against a Bible verse, auto-organized into read-only
sections by Bible book. There is no way to create a note from the tab itself,
and no way to organize notes by the user's own topics. We want iOS-home-screen
style **folders (groups)**, standalone **free notes**, direct **note creation**
from the tab, and the motion that makes the folder metaphor feel alive.

## Goals

1. Create a note directly from the Notes tab (no verse required).
2. Create, rename, and delete user-defined **groups** (folders).
3. Move one or many notes into / out of a group.
4. Multi-select notes and act on the selection via a right-click context menu.
5. iOS-style folder tiles (2×2 previews) and an expand-to-fill interaction.
6. Domino (staggered, left-to-right) fade-in on the board and inside an opened
   group.

## Non-goals

- Drag-and-drop (an explicit "Move to group" action is used instead).
- Manual drag-reordering of tiles.
- Nested groups (a group cannot contain a group).
- Syncing groups across devices / export-import of groups (export stays
  notes-only for now).
- Changing Study-mode note behavior (`NotesCard.svelte`) — out of scope.

## Data model

### Groups — `localStorage`

Groups are few and small, so they follow the existing `study` / `prefs`
localStorage pattern in `store.js` (not IndexedDB — no DB version bump).

Key: `deepverse.groups`. Shape:

```js
{ id, name, created_at, updated_at }
```

New store functions:

- `allGroups()` → array, sorted by `created_at` ascending.
- `addGroup(name)` → creates and returns a group. Default name `"New Group"`.
- `renameGroup(id, name)` → updates `name` + `updated_at`.
- `deleteGroup(id)` → deletes the group **and unassigns its notes**
  (`group_id = null`). Notes are never destroyed by deleting a group.

### Notes — IndexedDB (existing store, no migration)

- New optional field `group_id` on the note object. Absent / `null` = loose.
  Filtered in memory (the tab already loads `allNotes()`), so **no new index
  and no DB version bump**.
- **Free notes**: `addNote({ target_type: 'free', ref: null, body })`. A `null`
  `ref` is stored fine; the record is simply absent from the `ref` index
  (which free notes never need).
- Group assignment reuses `updateNote(id, body, patch)` with
  `patch = { group_id }`. `updateNote` already accepts a `patch`; extend it to
  copy `group_id` when present in the patch (alongside the existing `ref` /
  `target_type`). Passing `group_id: null` unassigns.

Backward compatibility: existing notes have no `group_id` (loose) and a real
`ref` (verse notes) — both render unchanged.

## Notes tab layout

The book-section layout is **replaced** by a single responsive grid ("board")
whose tiles are **group folders and loose notes intermixed**.

- Tile order: **folders first** (by `created_at`), then **loose notes**
  (newest-first). Predictable, since there is no drag-reordering.
- Toolbar gains **+ Note** and **+ Group** buttons alongside the existing
  Filter / Export / Import.
- Empty state copy updated (mentions creating a note or group here).

### Loose note tile

The existing `.sticky` card. Differences:

- A **free note** (no `ref`) shows a plain "Note" label where the verse-ref
  jump line normally is, and has no jump behavior. Verse notes are unchanged
  (ref line jumps, body click edits).
- Tiles participate in **selection** (see below).

### Group folder tile

- Rounded square sized to match a note tile's footprint (~220px column).
- Inside: a **2×2 grid of 4 slots**. The first N slots (N = min(count, 4)) show
  a mini preview of a note (truncated first line / plain-text snippet); the
  remaining slots are empty dashed placeholders.
- If the group holds more than 4 notes, a subtle **"+k"** badge indicates the
  overflow (extras are not previewed).
- Below the square: the group **name**. Clicking the name makes it inline-
  editable (an input), committing on Enter / blur (empty name reverts to the
  previous name).

### Add free note

**+ Note** opens an inline `NoteEditor` composer at the top of the board.
Explicit **Save** creates a free note (`ref: null`). Same no-blur-save style as
the Study-mode card: the editor does not save on blur; only the Save button
commits. Cancel discards.

## Selection & context menu

Replaces any per-tile "⋯" affordance with right-click.

- **Plain click** on a note is unchanged (body edits, ref line jumps).
- **Cmd/Ctrl+click** toggles a note in/out of the selection.
- **Shift+click** selects the range (in visible board order) between the last
  clicked note and this one.
- Selected tiles show a highlighted outline.
- **Esc**, or a click on empty board space, clears the selection.

**Right-click a note** opens a cursor-positioned context menu. If the target is
not already selected, it becomes the sole selection first, so the menu always
operates on the current selection:

- Single note: **Move to group ▸** (list of groups + "New group…" +
  "Remove from group" when grouped), **Edit**, **Delete**.
- Multiple notes: header "N notes", **Move to group ▸**, **Remove from group**,
  **Delete** (no Edit).

**Right-click a folder** opens: **Rename**, **Delete**.

The menu closes on outside-click, Esc, or after an action. Implemented as a
small reusable `ContextMenu.svelte` (fixed-position overlay at the cursor, with
a nested submenu for "Move to group").

"Move to group → New group…" creates a group (default name) and moves the
selection into it in one step; the group can then be renamed inline.

## Motion

### Domino load-in

On mount and whenever the board re-appears (e.g. collapsing an open group),
board tiles fade + rise in **left-to-right, staggered by index** using a Svelte
`in:` transition with `delay: index * ~50ms`. Applies to both folder and note
tiles in board order.

### Open a group (expand to fill)

Clicking a folder:

1. The rest of the board fades out — **only the notes container**, not the
   page (opacity → 0, pointer-events off).
2. The clicked folder **grows to fill the notes container**. Implemented FLIP-
   style: capture the folder's bounding rect relative to the container, render
   an expanded panel, and animate from that rect to the full-container rect
   (transform / size transition).
3. During the grow, the folder's 2×2 **placeholders fade out**.
4. Once expanded, the group's **full note cards fade in left-to-right, domino**
   (staggered `in:` delay), same feel as the board load-in.
5. The expanded panel shows a header with the **group name + Close** button.
   Close reverses: the panel shrinks back to the folder's position and the
   board fades / dominoes back in.

Inside the expanded group, notes use the same tile + selection + context-menu
behavior as the board (so you can move notes out of the group, delete, etc.).

Extracted components to keep `NotesPage.svelte` focused:

- `GroupFolder.svelte` — the folder tile (2×2 previews, inline rename).
- `GroupExpanded.svelte` — the expanded panel (grow animation + domino notes +
  header/close).
- `ContextMenu.svelte` — the right-click menu + submenu.

## Search / filter

- The filter matches note **body** and **book name / formatted ref**, guarding
  free notes that have no `ref` (so typing a book like "John" surfaces John
  notes; free notes match on body only).
- While the filter is non-empty, the board shows a **flat grid of all matching
  notes** (loose *and* those inside groups), with **no folders** — mirroring
  iOS home-screen search. Clearing the filter restores the folder/board view.

## Store API summary

```
// groups (localStorage; deleteGroup is async — it also touches notes in IDB)
allGroups(): Group[]
addGroup(name?): Group
renameGroup(id, name): void
async deleteGroup(id): Promise<void>   // unassigns member notes (group_id = null)

// notes (IndexedDB, existing store)
addNote({ target_type, ref, body })   // ref may be null (free note)
updateNote(id, body, patch)           // patch may include { group_id }
```

## Testing

- **Store unit tests** (`store.test.js`, jsdom + fake-indexeddb, localStorage):
  - `addGroup` / `renameGroup` / `allGroups` ordering.
  - `deleteGroup` unassigns member notes (notes survive, `group_id === null`).
  - `addNote` with `ref: null` stores a free note and it appears in
    `allNotes()`.
  - `updateNote(id, body, { group_id })` assigns and unassigns.
- **Manual / driven verification** for the interactive + animated parts:
  create note, create group, move (single + multi-select), rename, delete,
  open/close expansion, domino, filter → flat results.

## Phased build

1. **Functional (no motion):** store fns (groups, free notes, group_id),
   `+ Note` composer, board replacing book sections, `GroupFolder` tiles
   (static), selection + `ContextMenu` (move / rename / delete), flat search.
   Verify with unit tests + driving the tab.
2. **Motion:** domino load-in, `GroupExpanded` grow-to-fill + placeholder fade
   + domino notes + close.
