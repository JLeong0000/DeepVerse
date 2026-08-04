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

And the one date label that does ship is wrong. `relDate` counts elapsed
milliseconds rather than calendar days, so a memo written **yesterday at 8am**
currently reads `today` on Home, and one from **two days ago at 11pm** reads
`yesterday`.

## Goals

1. Sort the Memo page by **created** or **updated**, newest or oldest first.
2. Filter the Memo page to a **date range** (either end open).
3. Show the date on the memo tile, the Study-mode Memo card, and Home.
4. One shared date helper instead of a per-component copy.
5. Every date the user sees or filters on is a **local calendar day**, from one
   shared definition — so a memo labelled `today` is always inside a range
   starting today.

## Non-goals

- **No schema change.** Both fields already exist on every memo; nothing to
  migrate, no DB version bump. Storage stays UTC — see below for why local-time
  strings would break the `updated_at` index.
- **No reference-search fix.** The filter's reference matching is broken in both
  directions (see "Deferred" below). Deliberately untouched here.
- No sorting or filtering on Home or in the workbench — both stay as they are.
- No persistence of the sort/range choice. Session-only, so `SETTINGS_KEYS`
  (`store.js:67`) and the profile backup are unaffected.

## `app/src/lib/dates.js` (new)

Three pure functions. `display.js` is about original-language words and is the
wrong home; these are used by three components, so they get their own module.

### Storage stays UTC; every derivation is local

Memos keep storing `new Date().toISOString()` — a UTC instant. **No change to
`addNote` / `updateNote`.** Two reasons a local-time string is the wrong trade:

- The `updated_at` IndexedDB index (`store.js:13`) is usable only because
  ISO-UTC strings sort lexicographically *and* chronologically. Offset-bearing
  strings break that: `2026-08-05T00:54+08:00` sorts after
  `2026-08-04T17:00:00Z` as text, yet they are the same instant.
- Every memo already written is UTC. A format switch means two formats in one
  store with no migration.

Nothing is lost — an instant renders into any timezone exactly. **The rule is
that no calendar arithmetic happens on a UTC value.** Every function below
converts to local first, and `localDay()` is the single place that conversion
lives.

A memo does **not** record where it was written. It renders in the reader's
current timezone, so a memo written at 9pm in Singapore reads as 1pm if you open
it in London. Accepted: correct as an instant, and the alternative (a `tz_offset`
field) buys nothing until memos and reader cross timezones.

### `localDay(value)` → `Date` at local midnight

Takes an ISO instant, a `YYYY-MM-DD` string, or a `Date`; returns local midnight
of that calendar day.

The trap it exists to contain: bare `new Date('2026-08-05')` parses as **UTC**,
so it is not local midnight anywhere except Greenwich. Measured under
`TZ=Asia/Singapore` (UTC+8) it yields **Aug 5 at 08:00 local** — the right date
at the wrong time, so a `from` bound built that way silently excludes every memo
written before 8am. West of Greenwich it is worse: the same expression lands on
the *previous* calendar date, so bounds are off by a whole day.

A date-only string must therefore be built from its parts —
`new Date(y, m - 1, d)` — or parsed with an explicit `T00:00:00`, which the
runtime treats as local.

### `memoDateLabel(note, field)` → `"edited 3 days ago"`

Keeps `relDate()`'s thresholds from `RecentNotes.svelte:14` (`today` /
`yesterday` / `N days ago` / `last week` / `N weeks ago` / a `Mar 4`-style date
past a month) and changes three things:

- **BUG — calendar days, not elapsed time.** The shipped version computes
  `Math.floor((Date.now() - new Date(iso)) / 86400000)`, which counts
  *durations*. Verified in `TZ=Asia/Singapore`: a memo from **yesterday 8am**
  renders `today` (16.9h elapsed), and one from **two days ago at 11pm** renders
  `yesterday` (25.9h elapsed). The fix is
  `(localDay(now) - localDay(iso)) / 86400000` — floor both to local midnight,
  then subtract; never divide an elapsed duration.
- **Year.** Past the current year the label includes it. Today a 2024 memo
  renders a bare "Mar 4", which reads as this year.
- **Verb.** Prefixed `created` or `edited` depending on `field`, **except** that
  a memo with `created_at === updated_at` always reads `created` — an untouched
  memo must never claim to have been edited.

### `inRange(iso, from, to)` → boolean

`from` and `to` are `YYYY-MM-DD` local calendar dates straight off an
`<input type="date">`. Either may be empty for an open end. Both ends inclusive,
compared as local calendar days via `localDay` — `localDay(iso)` must fall
between `localDay(from)` and `localDay(to)`.

Sharing `localDay` with `memoDateLabel` is what keeps the two consistent: a memo
whose tile reads `today` is always inside a range with `from` set to today. Two
independent notions of "day" would drift apart at exactly the hours a user is
most likely to be writing memos.

**Rejected:** an `IDBKeyRange` query on the `updated_at` index. It cannot express
local-day bounds, `created_at` has no index, and `load()` already holds every
memo in memory — so the range is an in-memory filter alongside the text filter.

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
- **the calendar-day regression** — yesterday 8am reads `yesterday`, not
  `today`; two days ago at 11pm reads `2 days ago`, not `yesterday`,
- the year rollover,
- `created_at === updated_at` reading `created` even when asked for `updated`,
- `inRange` inclusivity at both edges and both open ends,
- agreement between the two: a memo `memoDateLabel` calls `today` is inside a
  range whose `from` is today.

**These tests must run under a non-UTC timezone.** Under `TZ=UTC` local and UTC
days coincide and every bug in this spec is invisible. `dates.test.js` pins an
explicit zone rather than inheriting the machine's, so it behaves the same on CI
as on the dev laptop — `Asia/Singapore` (UTC+8), where the calendar-day bug was
reproduced.

Mechanism: set `process.env.TZ` in a `beforeAll` in `dates.test.js` and restore
it in `afterAll`. Scoped to the one file deliberately — putting
`env: { TZ: ... }` in the `test` block of `vite.config.js:120` would re-timezone
every existing test, which is a larger blast radius than this work earns.

**Verified end-to-end** (vitest 2.1.9, jsdom, this worktree): a `beforeAll`
override of `process.env.TZ` takes effect on the global `Date`, and the same
probe confirmed the `localDay` trap above — `new Date('2026-08-05')` reporting
`getHours() === 8` under UTC+8.

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
