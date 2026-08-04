# Memo dating: sort by date, filter by date range, show the date on the card

Date: 2026-08-05
Status: Approved design, ready for planning

## Problem

Memos already carry both dates. `addNote` stamps `created_at` and `updated_at`
(`app/src/lib/store.js:23`), `updateNote` bumps `updated_at` on every edit
(`store.js:36`), and IndexedDB carries an `updated_at` index (`store.js:13`).

None of it is exposed. The Memo page (`app/src/routes/NotesPage.svelte`) is
hard-wired to newest-updated-first with no control (`NotesPage.svelte:27`), its
tiles show no date at all, and neither does the Study-mode Memo card
(`NotesCard.svelte:63`). Only Home's "Recent memos" shows a date, via a private
`relDate()` helper (`RecentNotes.svelte:14`).

There is also no way to ask "what did I write in July" — the filter box matches
body text and the rendered reference, nothing else.

## Goals

1. Sort the Memo page by **created** or **updated**, newest or oldest first.
2. Filter the Memo page to a **date range** (either end open).
3. Show the date on the memo tile, the Study-mode Memo card, and Home.
4. One shared date helper instead of a per-component copy.

## Non-goals

- **No schema change.** Both fields already exist on every memo; nothing to
  migrate, no DB version bump.
- **No reference-search fix.** The filter's reference matching is broken in both
  directions (see "Deferred" below). Deliberately untouched here.
- No sorting or filtering on Home or in the workbench — both stay as they are.
- No persistence of the sort/range choice. Session-only, so `SETTINGS_KEYS`
  (`store.js:67`) and the profile backup are unaffected.

## `app/src/lib/dates.js` (new)

Two pure functions. `display.js` is about original-language words and is the
wrong home; these are used by three components, so they get their own module.

### `memoDateLabel(note, field)` → `"edited 3 days ago"`

Lifts `relDate()` out of `RecentNotes.svelte:14` unchanged in its thresholds
(`today` / `yesterday` / `N days ago` / `last week` / `N weeks ago` / a
`Mar 4`-style date past a month), with two changes:

- **Year.** Past the current year the label includes it. Today a 2024 memo
  renders a bare "Mar 4", which reads as this year.
- **Verb.** Prefixed `created` or `edited` depending on `field`, **except** that
  a memo with `created_at === updated_at` always reads `created` — an untouched
  memo must never claim to have been edited.

### `inRange(iso, from, to)` → boolean

`from` and `to` are `YYYY-MM-DD` local calendar dates straight off an
`<input type="date">`. Either may be empty for an open end. Both ends inclusive.

The subtlety that justifies a tested function rather than an inline comparison:
the bounds must be built as **local** midnight and local end-of-day —
`new Date(from + 'T00:00:00')` and `new Date(to + 'T23:59:59.999')`. A bare
`new Date('2026-08-05')` parses as **UTC**, which silently shifts both edges by
the viewer's timezone offset and drops evening memos out of their own day.

**Rejected:** an `IDBKeyRange` query on the `updated_at` index. It cannot express
the local-time bounds, `created_at` has no index, and `load()` already holds
every memo in memory — so the range is an in-memory filter alongside the text
filter.

## Memo page — `NotesPage.svelte`

### Sort

One `<select>` in `.actions`, beside the filter box, with four options:

```
Updated · newest first   (default)
Updated · oldest first
Created · newest first
Created · oldest first
```

`load()` (line 27) drops its `.reverse()` for a comparator on the chosen field.
Group folders and the expanded group view both derive from the same `notes`
array through `membersOf` (line 41), so they inherit the order with no extra
work.

### Date range

A second row under the header: `from` and `to` date inputs plus an `x` that
clears both. The range applies to **whichever field the sort selects**, so the
sort control is the page's single legend for what "date" means — there is no
second which-date control to keep in sync.

### How the two filters compose

A memo must pass the text match **and** the date range. The existing
"filtering flattens the board" rule (lines 38–40 — groups hide, every match
shows as one flat list) currently triggers on `q` alone; it now triggers on
either filter being active.

When the filters exclude everything, the board shows `No memos match.` Today an
over-narrow filter just empties the page with no explanation.

## The date on the cards

- **Memo tile** (`NotesPage.svelte:121-130`) — a line pinned below the body,
  styled after Home's sticky (9.5px, opacity .55). The square is fixed
  aspect-ratio, so `.sq` becomes a flex column and `.sq .body` goes `flex: 1`,
  giving up one line of height; the fade mask is unchanged. Shows the field the
  page is sorted by. Because `noteTile` is a snippet, the expanded group view
  gets it too.
- **Study-mode Memo card** (`NotesCard.svelte:63-70`) — the same line per note,
  fixed to `updated_at` (no sort control on that surface).
- **Home "Recent memos"** (`RecentNotes.svelte:41`) — drops its private
  `relDate` for the shared helper. Same position, same styling; gains the verb
  prefix and the year fix.

## Verification

`npm test` — new `dates.test.js` plus the existing suite. The tests pin:

- each `memoDateLabel` threshold boundary (0 / 1 / 6 / 7 / 13 / 30 days),
- the year rollover,
- `created_at === updated_at` reading `created` even when asked for `updated`,
- `inRange` inclusivity at both edges, both open ends, and a non-UTC timezone
  (the local-midnight bug is invisible under `TZ=UTC`).

Then a manual pass: all four sort orders; group folders following the sort; a
range open at each end; a range matching nothing (expect `No memos match.`); a
fresh memo reading "created today" and an edited one reading "edited today".

## Deferred — reference search

Out of scope, recorded so the next session starts from here. The filter matches
the query as a substring of the **rendered** reference (`NotesPage.svelte:36`)
while the app already has a real parser, `parseReference` (`refs.js:88`), used
by Home's jump-to-verse box. The substring approach fails both ways:

- **False negatives.** `ps 23`, `psalm 23`, `1cor`, `1corinthians` all match
  nothing; `parseReference` resolves every one. 18 of the 66 display names
  contain a space, so the whole numbered-book family is unreachable by the way
  people type.
- **False positives.** Substrings ignore verse boundaries: `john 3:1` surfaces a
  memo on John **3:16**. `1` matches every memo in 1 Corinthians, Psalms 1, and
  any verse 1.

`parseReference` is not a drop-in. It is greedy by design — `j` → Joshua 1,
`1` → 1 Samuel 1 — which is right for a jump box you watch as you type and wrong
for a live filter that would snap to Joshua on the way to typing "john". The
filter box also serves double duty over memo **body text**, and `Job`, `Acts`
and `Mark` are ordinary English words as well as books.

A real fix needs a policy — when a query counts as a reference (book-ish token
*and* a number? a minimum length?) and whether a reference hit replaces or
unions with the text hit — plus an abbreviation/alternate-name table, which
does not exist today (`jn`, `mt`, `revelations`, `song of solomon` all miss even
with the parser). That is its own design.
