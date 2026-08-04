# Memo Dating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the dates memos already carry — sort the Memo page by created or updated, filter it to a date range, and show the date on all three memo surfaces — with every date computed as a local calendar day.

**Architecture:** One new module, `app/src/lib/dates.js`, owns every date decision behind three pure functions (`localDay`, `memoDateLabel`, `inRange`). Storage is untouched: memos keep their UTC ISO timestamps, and `localDay` is the single place a UTC instant becomes a calendar day. The Memo page gains a sort `<select>` and a from/to row; the sorted field drives both the range filter and what the tile prints, so there is one control and one meaning of "date" on the page.

**Tech Stack:** Svelte 5 (runes: `$state`, `$derived`, snippets), Vitest 2.1.9 + jsdom + `@testing-library/svelte`, IndexedDB via `idb` (`fake-indexeddb` in tests).

**Spec:** `docs/superpowers/specs/2026-08-05-memo-dating-design.md`

## Global Constraints

- **Storage is not changed.** `addNote`/`updateNote` keep writing `new Date().toISOString()`. No IndexedDB version bump, no migration, no new field on the note object.
- **No calendar arithmetic on a UTC value.** Every day comparison goes through `localDay()`. Never `Math.floor(elapsedMs / 86400000)` — that counts durations, not days.
- **Never `new Date('YYYY-MM-DD')`.** It parses as UTC. Build date-only values from parts: `new Date(y, m - 1, d)`.
- **`dates.test.js` pins `TZ=Asia/Singapore`.** Under `TZ=UTC` every bug in this plan is invisible. Verified working: a `beforeAll` assignment to `process.env.TZ` takes effect on the global `Date` under vitest 2.1.9 + jsdom.
- **Existing note-label thresholds are preserved** verbatim: `today` / `yesterday` / `N days ago` (<7) / `last week` (<14) / `N weeks ago` (<31) / a `Mar 4`-style date beyond that.
- **Out of scope:** reference search (tracked in `docs/FEATURES-AND-IDEAS.md`), sort/filter on Home or the workbench, persisting the sort or range choice.
- Run all commands from `app/`. Test command: `npx vitest run <path>`.

## File Structure

| File | Responsibility |
|---|---|
| `app/src/lib/dates.js` (create) | Every date decision: local-day conversion, the memo label, the range predicate. Pure, no Svelte, no store imports. |
| `app/src/lib/dates.test.js` (create) | Pins the TZ, the calendar-day regression, the thresholds, and label/range agreement. |
| `app/src/components/home/RecentNotes.svelte` (modify) | Drops its private `relDate`; renders the shared label. |
| `app/src/components/workbench/NotesCard.svelte` (modify) | Adds a date line per note, fixed to `updated_at`. |
| `app/src/routes/NotesPage.svelte` (modify) | Sort control, from/to row, filter composition, empty-match state, date on the tile. |
| `app/src/routes/NotesPage.test.js` (create) | Sort order, range filtering, and the flatten-on-filter behaviour. |

Tasks 1–3 build `dates.js` bottom-up; each is independently testable. Tasks 4–5 convert the two simple consumers. Tasks 6–8 build the Memo page, in the order sort → range → tile, so each has a working page to test against.

---

### Task 1: `localDay` and the timezone harness

The foundation. Every later task depends on this being right, so it ships with the TZ harness that makes its bugs visible.

**Files:**
- Create: `app/src/lib/dates.js`
- Create: `app/src/lib/dates.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `localDay(value: string | Date) => Date` — local midnight of the calendar day `value` falls on. Accepts an ISO instant (`2026-08-04T16:54:00.000Z`), a date-only string (`2026-08-05`), or a `Date`.

- [ ] **Step 1: Write the failing test**

Create `app/src/lib/dates.test.js`:

```js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { localDay } from './dates.js';

// Under TZ=UTC a local day and a UTC day are the same thing, and every bug this module exists to
// prevent becomes invisible. Pin an explicit eastern zone instead of inheriting the machine's, so
// CI and a laptop agree. UTC+8 is where the shipped relDate bug was reproduced.
const ORIGINAL_TZ = process.env.TZ;
beforeAll(() => { process.env.TZ = 'Asia/Singapore'; });
afterAll(() => { process.env.TZ = ORIGINAL_TZ; });

describe('the timezone harness', () => {
  it('actually applies UTC+8 to the global Date', () => {
    const d = new Date('2026-08-04T16:54:00Z');
    expect(d.getDate()).toBe(5);    // already tomorrow in Singapore
    expect(d.getHours()).toBe(0);
  });
});

describe('localDay', () => {
  it('floors a UTC instant to LOCAL midnight, not UTC midnight', () => {
    // 16:54Z on Aug 4 is 00:54 on Aug 5 in Singapore — the local day is the 5th.
    const day = localDay('2026-08-04T16:54:00.000Z');
    expect(day.getFullYear()).toBe(2026);
    expect(day.getMonth()).toBe(7); // August, 0-indexed
    expect(day.getDate()).toBe(5);
    expect(day.getHours()).toBe(0);
    expect(day.getMinutes()).toBe(0);
  });

  it('reads a date-only string as a LOCAL day, not a UTC instant', () => {
    // The trap: bare new Date('2026-08-05') is 08:00 local under UTC+8, so any bound built from it
    // silently excludes everything written before 8am. West of Greenwich it lands a day early.
    expect(new Date('2026-08-05').getHours()).toBe(8); // the wrong way, pinned so it stays visible
    const day = localDay('2026-08-05');
    expect(day.getDate()).toBe(5);
    expect(day.getHours()).toBe(0);
  });

  it('accepts a Date', () => {
    const day = localDay(new Date('2026-08-04T16:54:00.000Z'));
    expect(day.getDate()).toBe(5);
    expect(day.getHours()).toBe(0);
  });

  it('returns a distinct value per calendar day, so two days subtract to exactly one', () => {
    const a = localDay('2026-08-05T23:00:00+08:00');
    const b = localDay('2026-08-04T00:30:00+08:00');
    expect((a - b) / 86400000).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/dates.test.js`
Expected: FAIL — `Failed to resolve import "./dates.js"`.

- [ ] **Step 3: Write the minimal implementation**

Create `app/src/lib/dates.js`:

```js
// Memo timestamps are stored as UTC instants (`new Date().toISOString()`), but every date a reader
// sees is a *local calendar day*: "today" means today on their wall calendar, and the Memo page's
// from/to filter takes local dates off an <input type="date">. So no calendar arithmetic happens on
// a UTC value — it all goes through localDay() first.

// Local midnight of the day `value` falls on. Accepts an ISO instant, a "YYYY-MM-DD" string, or a
// Date. The date-only branch is the whole reason this function exists: `new Date('2026-08-05')`
// parses as UTC, which under UTC+8 is 8am local (so a lower bound built that way drops the first
// eight hours of the day) and west of Greenwich is the previous date entirely.
export function localDay(value) {
  if (typeof value === 'string') {
    const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (parts) return new Date(+parts[1], +parts[2] - 1, +parts[3]);
  }
  const d = new Date(value);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/dates.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dates.js src/lib/dates.test.js
git commit -m "$(cat <<'EOF'
feat(memo): add localDay, the one place a UTC instant becomes a calendar day

Memo timestamps are UTC instants but every date a reader sees is a local
calendar day, so the conversion needs one home rather than a copy per caller.

The tests pin TZ=Asia/Singapore deliberately: under TZ=UTC a local day and a UTC
day coincide and none of this can fail. They also pin the trap itself — bare
new Date('2026-08-05') reporting 08:00 local under UTC+8.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `memoDateLabel` — the calendar-day fix and the verb

Fixes a shipped bug: `RecentNotes.svelte:14` divides elapsed milliseconds by 86400000, so a memo written yesterday morning reads "today".

**Files:**
- Modify: `app/src/lib/dates.js`
- Modify: `app/src/lib/dates.test.js`

**Interfaces:**
- Consumes: `localDay` from Task 1.
- Produces: `memoDateLabel(note, field = 'updated_at', now = Date.now()) => string`, e.g. `"edited 3 days ago"`. `note` is a memo object with `created_at` and `updated_at`; `field` is `'created_at'` or `'updated_at'`. The `now` parameter exists so tests need no fake timers — production callers omit it.

- [ ] **Step 1: Write the failing test**

Append to `app/src/lib/dates.test.js` (and add `memoDateLabel` to the import on line 2):

```js
// 00:54 local on Aug 5 in Singapore — deliberately just after local midnight, where UTC is still
// on the 4th and every off-by-one hides.
const NOW = new Date('2026-08-04T16:54:00.000Z').getTime();
const memo = (created, updated = created) => ({ created_at: created, updated_at: updated });

describe('memoDateLabel', () => {
  // The shipped bug: relDate() computed elapsed-ms / 86400000, which counts durations, not days.
  it('counts calendar days, not elapsed hours', () => {
    // yesterday 8am local = 16.9 hours before NOW — under a millisecond-division it read "today"
    expect(memoDateLabel(memo('2026-08-04T00:00:00.000Z'), 'created_at', NOW)).toBe('created yesterday');
    // two days ago 11pm local = 25.9 hours before NOW — it read "yesterday"
    expect(memoDateLabel(memo('2026-08-03T15:00:00.000Z'), 'created_at', NOW)).toBe('created 2 days ago');
  });

  it('calls the current local day "today" even when UTC still says yesterday', () => {
    // 00:30 local on Aug 5 is 16:30Z on Aug 4
    expect(memoDateLabel(memo('2026-08-04T16:30:00.000Z'), 'created_at', NOW)).toBe('created today');
  });

  it.each([
    ['2026-07-30T04:00:00.000Z', '6 days ago'],   // 6
    ['2026-07-29T04:00:00.000Z', 'last week'],    // 7
    ['2026-07-23T04:00:00.000Z', 'last week'],    // 13
    ['2026-07-22T04:00:00.000Z', '2 weeks ago'],  // 14
    ['2026-07-06T04:00:00.000Z', '4 weeks ago'],  // 30
    ['2026-07-05T04:00:00.000Z', 'Jul 5'],        // 31 — falls through to a date
  ])('keeps the existing threshold at %s -> %s', (iso, expected) => {
    expect(memoDateLabel(memo(iso), 'created_at', NOW)).toBe(`created ${expected}`);
  });

  it('includes the year once the date leaves the current year', () => {
    // Today this renders a bare "Mar 4", which reads as this year.
    expect(memoDateLabel(memo('2025-03-04T04:00:00.000Z'), 'created_at', NOW)).toBe('created Mar 4, 2025');
  });

  it('says "created" for a memo that has never been edited, even when asked for updated_at', () => {
    const untouched = memo('2026-08-04T16:30:00.000Z');
    expect(memoDateLabel(untouched, 'updated_at', NOW)).toBe('created today');
  });

  it('says "edited" only when the memo really was edited', () => {
    const edited = memo('2026-07-29T04:00:00.000Z', '2026-08-04T16:30:00.000Z');
    expect(memoDateLabel(edited, 'updated_at', NOW)).toBe('edited today');
  });

  it('says "created" when showing created_at, even on an edited memo', () => {
    const edited = memo('2026-07-29T04:00:00.000Z', '2026-08-04T16:30:00.000Z');
    expect(memoDateLabel(edited, 'created_at', NOW)).toBe('created last week');
  });

  it('defaults to updated_at', () => {
    const edited = memo('2026-07-29T04:00:00.000Z', '2026-08-04T16:30:00.000Z');
    expect(memoDateLabel(edited, undefined, NOW)).toBe('edited today');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/dates.test.js`
Expected: FAIL — `memoDateLabel is not a function`.

- [ ] **Step 3: Write the minimal implementation**

Append to `app/src/lib/dates.js`:

```js
const DAY_MS = 86400000;

// Whole calendar days between two local midnights. Rounded, not floored: across a DST boundary a
// local day is 23 or 25 hours, so the difference is not an exact multiple of DAY_MS.
function daysBetween(iso, nowMs) {
  return Math.round((localDay(nowMs) - localDay(iso)) / DAY_MS);
}

// How long ago, in the words a reader uses. Thresholds are the ones the app already shipped.
function relDay(iso, nowMs) {
  const days = daysBetween(iso, nowMs);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'last week';
  if (days < 31) return `${Math.floor(days / 7)} weeks ago`;
  const d = new Date(iso);
  const opts = { month: 'short', day: 'numeric' };
  // A bare "Mar 4" reads as this year, so an older memo has to say which year it is.
  if (d.getFullYear() !== new Date(nowMs).getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('en-US', opts);
}

// The date a memo carries, as a reader reads it: "edited 3 days ago", "created today". A memo whose
// two timestamps are identical has never been edited, so it always reads "created" — otherwise an
// untouched memo would claim an edit that never happened. `now` is injectable for tests.
export function memoDateLabel(note, field = 'updated_at', now = Date.now()) {
  const wasEdited = note.created_at !== note.updated_at;
  const verb = field === 'updated_at' && wasEdited ? 'edited' : 'created';
  return `${verb} ${relDay(note[field], now)}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/dates.test.js`
Expected: PASS, 19 tests (5 from Task 1 + 14 here, counting the six `it.each` rows).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dates.js src/lib/dates.test.js
git commit -m "$(cat <<'EOF'
fix(memo): count calendar days in the memo date label, not elapsed hours

relDate divided elapsed milliseconds by 86400000, which measures durations. A
memo written yesterday at 8am is 16.9 hours old and read "today"; one from two
days ago at 11pm read "yesterday". Both are pinned as regressions.

The label also gains a year beyond the current one (a bare "Mar 4" reads as this
year) and a created/edited verb, where a memo whose timestamps are identical
always reads "created" rather than claiming an edit that never happened.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `inRange` — the date-range predicate

**Files:**
- Modify: `app/src/lib/dates.js`
- Modify: `app/src/lib/dates.test.js`

**Interfaces:**
- Consumes: `localDay` from Task 1, `memoDateLabel` from Task 2 (for the agreement test).
- Produces: `inRange(iso, from, to) => boolean`. `from`/`to` are `YYYY-MM-DD` strings from an `<input type="date">`; either may be `''` for an open end. Both ends inclusive.

- [ ] **Step 1: Write the failing test**

Append to `app/src/lib/dates.test.js` (and add `inRange` to the import on line 2):

```js
describe('inRange', () => {
  const AUG_5_EARLY = '2026-08-04T16:30:00.000Z'; // 00:30 local on Aug 5
  const AUG_5_LATE  = '2026-08-05T15:00:00.000Z'; // 23:00 local on Aug 5

  it('includes both ends of the range', () => {
    expect(inRange(AUG_5_EARLY, '2026-08-05', '2026-08-05')).toBe(true);
    expect(inRange(AUG_5_LATE, '2026-08-05', '2026-08-05')).toBe(true);
  });

  it('includes a memo written before 8am local on the from-date', () => {
    // The regression a UTC-parsed bound causes: new Date('2026-08-05') is 08:00 local under UTC+8,
    // so a 00:30 memo would fall outside its own day.
    expect(inRange(AUG_5_EARLY, '2026-08-05', '')).toBe(true);
  });

  it('excludes days outside the range', () => {
    expect(inRange('2026-08-03T04:00:00.000Z', '2026-08-05', '2026-08-05')).toBe(false);
    expect(inRange('2026-08-06T04:00:00.000Z', '2026-08-05', '2026-08-05')).toBe(false);
  });

  it('treats an empty bound as an open end', () => {
    expect(inRange(AUG_5_EARLY, '', '2026-08-05')).toBe(true);
    expect(inRange(AUG_5_EARLY, '2026-08-05', '')).toBe(true);
    expect(inRange(AUG_5_EARLY, '', '')).toBe(true);
    expect(inRange(AUG_5_EARLY, '', '2026-08-04')).toBe(false);
  });

  // The point of sharing localDay: two notions of "day" would disagree exactly at the hours a
  // person is most likely to be writing memos.
  it('agrees with memoDateLabel about which day it is', () => {
    expect(memoDateLabel(memo(AUG_5_EARLY), 'created_at', NOW)).toBe('created today');
    expect(inRange(AUG_5_EARLY, '2026-08-05', '')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/dates.test.js`
Expected: FAIL — `inRange is not a function`.

- [ ] **Step 3: Write the minimal implementation**

Append to `app/src/lib/dates.js`:

```js
// Is `iso` inside the local-calendar-day range [from, to]? Bounds are "YYYY-MM-DD" strings off an
// <input type="date">; either may be empty for an open end, and both ends are inclusive. Comparing
// local midnights (rather than the raw instants) is what makes a memo written at 00:30 fall inside
// its own day.
export function inRange(iso, from, to) {
  const day = localDay(iso).getTime();
  if (from && day < localDay(from).getTime()) return false;
  if (to && day > localDay(to).getTime()) return false;
  return true;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/dates.test.js`
Expected: PASS, 24 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dates.js src/lib/dates.test.js
git commit -m "$(cat <<'EOF'
feat(memo): add inRange, an inclusive local-calendar-day range predicate

Bounds come straight off an <input type="date"> as YYYY-MM-DD and are compared
as local midnights, so a memo written at 00:30 falls inside its own day rather
than the previous one.

Shares localDay with the label, and a test pins the agreement: anything reading
"today" is inside a range starting today.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Home — render the shared label

Smallest consumer, and the one that proves the fix against real rendering.

**Files:**
- Modify: `app/src/components/home/RecentNotes.svelte` (delete lines 14–22, change line 41)

**Interfaces:**
- Consumes: `memoDateLabel` from Task 2.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Delete the private helper**

In `app/src/components/home/RecentNotes.svelte`, delete the whole `relDate` function (lines 14–22):

```js
  function relDate(iso) {
    const days = Math.floor((Date.now() - new Date(iso)) / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 14) return 'last week';
    if (days < 31) return `${Math.floor(days / 7)} weeks ago`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
```

- [ ] **Step 2: Import the shared one**

Add after the existing `noteHtml` import (line 4):

```js
  import { memoDateLabel } from '../../lib/dates.js';
```

- [ ] **Step 3: Render it**

Replace line 41:

```svelte
        <div class="d">{relDate(note.updated_at)}</div>
```

with:

```svelte
        <div class="d">{memoDateLabel(note)}</div>
```

- [ ] **Step 4: Verify the whole suite still passes**

Run: `npx vitest run`
Expected: PASS. No test referenced `relDate` (it was private), so nothing should break. If anything fails, it is a real regression — stop and diagnose rather than adjusting the test.

- [ ] **Step 5: Commit**

```bash
git add src/components/home/RecentNotes.svelte
git commit -m "$(cat <<'EOF'
fix(memo): render Home's recent-memo dates through the shared label

Home carried the only copy of relDate, and therefore the only visible instance
of the elapsed-hours bug: a memo written yesterday morning said "today". It now
reads the shared helper, so it gains calendar-day counting, the year on older
dates, and the created/edited verb.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: The Study-mode Memo card

**Files:**
- Modify: `app/src/components/workbench/NotesCard.svelte` (line 5 area, lines 63–70, style block)

**Interfaces:**
- Consumes: `memoDateLabel` from Task 2.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing test**

Create `app/src/components/workbench/NotesCard.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import { addNote, _clearAllForTest } from '../../lib/store.js';
import { study } from '../../lib/study.svelte.js';
import NotesCard from './NotesCard.svelte';

describe('NotesCard', () => {
  beforeEach(async () => {
    await _clearAllForTest();
    study.book = 'John';
    study.chapter = 3;
    study.verse = 16;
    study.verseEnd = null;
  });

  it('shows when each memo was last touched', async () => {
    await addNote({ target_type: 'verse', ref: 'John.3.16', body: 'the hinge of the chapter' });
    render(NotesCard);
    await waitFor(() => expect(screen.getByText('the hinge of the chapter')).toBeTruthy());
    expect(screen.getByText('created today')).toBeTruthy();
  });
});
```

Note: `_clearAllForTest` (`store.js:188`) is the existing test seam. It clears `localStorage` as well as the notes store, which also resets groups — wanted here.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/workbench/NotesCard.test.js`
Expected: FAIL — `Unable to find an element with the text: created today`.

- [ ] **Step 3: Add the date line**

Add the import after line 4 (`noteHtml`):

```js
  import { memoDateLabel } from '../../lib/dates.js';
```

Replace the note block (lines 63–70):

```svelte
  {#each notes as note (note.id)}
    {#if editing?.id !== note.id}
      <div class="note">
        <div class="body md">{@html noteHtml(note.body)}</div>
        <button class="edit" onclick={() => startEdit(note)}>Edit</button>
      </div>
    {/if}
  {/each}
```

with:

```svelte
  {#each notes as note (note.id)}
    {#if editing?.id !== note.id}
      <div class="note">
        <div class="col">
          <div class="body md">{@html noteHtml(note.body)}</div>
          <div class="d">{memoDateLabel(note)}</div>
        </div>
        <button class="edit" onclick={() => startEdit(note)}>Edit</button>
      </div>
    {/if}
  {/each}
```

- [ ] **Step 4: Move the flex onto the new column**

`.note` is a row (`display: flex`) whose body took `flex: 1`. The body and the date now share a column, so the column takes the flex. Replace this rule (line 101):

```css
  .note .body { flex: 1; font-size: 13px; line-height: 1.5; }
```

with:

```css
  .note .col { flex: 1; min-width: 0; }
  .note .body { font-size: 13px; line-height: 1.5; }
  .note .d { font-size: 10px; opacity: .55; margin-top: 5px; }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/workbench/NotesCard.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/workbench/NotesCard.svelte src/components/workbench/NotesCard.test.js
git commit -m "$(cat <<'EOF'
feat(memo): date each memo in the Study-mode card

The per-verse card listed memo bodies with no indication of when any of them was
written. Fixed to updated_at — there is no sort control on this surface.

The body and the date share a column so the Edit button stays put; the flex that
was on .body moves to that column.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Memo page — the sort control

**Files:**
- Modify: `app/src/routes/NotesPage.svelte` (lines 12–30, 135–139, style block)
- Create: `app/src/routes/NotesPage.test.js`

**Interfaces:**
- Consumes: nothing from `dates.js` yet.
- Produces: `sortField` (a `$derived` string, `'created_at'` or `'updated_at'`) — Tasks 7 and 8 both read it.

- [ ] **Step 1: Write the failing test**

Create `app/src/routes/NotesPage.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { addNote, _clearAllForTest } from '../lib/store.js';
import NotesPage from './NotesPage.svelte';

// Seed a memo with explicit timestamps. addNote stamps "now", so overwrite afterwards through the
// same store the page reads.
async function seed({ body, created, updated = created }) {
  const note = await addNote({ target_type: 'free', ref: null, body });
  const { openDB } = await import('idb');
  const db = await openDB('deepverse', 1);
  await db.put('notes', { ...note, created_at: created, updated_at: updated });
  return note;
}

const bodies = () => screen.getAllByRole('button')
  .map((b) => b.textContent.trim())
  .filter((t) => t.startsWith('memo '));

describe('NotesPage sorting', () => {
  beforeEach(async () => {
    await _clearAllForTest();
    // "memo old" was written first but edited most recently — the two orders disagree, which is the
    // whole point of offering both.
    await seed({ body: 'memo old', created: '2026-01-01T04:00:00.000Z', updated: '2026-08-04T04:00:00.000Z' });
    await seed({ body: 'memo new', created: '2026-07-01T04:00:00.000Z' });
  });

  it('defaults to most recently updated first', async () => {
    render(NotesPage);
    await waitFor(() => expect(bodies().length).toBe(2));
    expect(bodies()[0]).toContain('memo old');
  });

  it('sorts by creation date when asked', async () => {
    render(NotesPage);
    await waitFor(() => expect(bodies().length).toBe(2));
    await fireEvent.change(screen.getByTitle('Sort memos'), { target: { value: 'created_at:desc' } });
    await waitFor(() => expect(bodies()[0]).toContain('memo new'));
  });

  it('reverses the order on an oldest-first choice', async () => {
    render(NotesPage);
    await waitFor(() => expect(bodies().length).toBe(2));
    await fireEvent.change(screen.getByTitle('Sort memos'), { target: { value: 'updated_at:asc' } });
    await waitFor(() => expect(bodies()[0]).toContain('memo new'));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/routes/NotesPage.test.js`
Expected: FAIL — `Unable to find an element by: [title="Sort memos"]`.

- [ ] **Step 3: Replace the load-and-reverse with a derived sort**

In `app/src/routes/NotesPage.svelte`, replace lines 12–13:

```js
  let notes = $state([]);
  let groups = $state([]);
```

with:

```js
  let rawNotes = $state([]);
  let groups = $state([]);
  let sort = $state('updated_at:desc'); // "<field>:<direction>"
```

Replace `load()` (lines 26–29) — the sort is no longer baked into the fetch, so changing it does not re-read IndexedDB:

```js
  async function load() {
    notes = (await allNotes()).reverse(); // newest first
    groups = allGroups();
  }
```

with:

```js
  async function load() {
    rawNotes = await allNotes();
    groups = allGroups();
  }

  const sortField = $derived(sort.split(':')[0]);       // created_at | updated_at
  const sortDir = $derived(sort.split(':')[1]);         // desc | asc
  // Timestamps are ISO-UTC, which sorts lexicographically and chronologically at once.
  let notes = $derived([...rawNotes].sort((a, b) => {
    const order = a[sortField] < b[sortField] ? -1 : a[sortField] > b[sortField] ? 1 : 0;
    return sortDir === 'desc' ? -order : order;
  }));
```

- [ ] **Step 4: Add the control**

In the `.actions` div (lines 135–139), add the select after the filter input:

```svelte
      <input class="filter" placeholder="Filter memos…" bind:value={filter} />
      <select class="sort" bind:value={sort} title="Sort memos">
        <option value="updated_at:desc">Updated · newest first</option>
        <option value="updated_at:asc">Updated · oldest first</option>
        <option value="created_at:desc">Created · newest first</option>
        <option value="created_at:asc">Created · oldest first</option>
      </select>
```

Add to the style block, after the `.filter` rule (line 191):

```css
  .sort { font-family: inherit; font-size: 12.5px; padding: 5px 8px; border: 1px solid var(--rule); border-radius: 5px; background: var(--bg); color: var(--ink); }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/routes/NotesPage.test.js`
Expected: PASS, 3 tests.

- [ ] **Step 6: Run the whole suite**

Run: `npx vitest run`
Expected: PASS. `notes` changed from `$state` to `$derived`; it is read-only everywhere else in the file (`notes.find` at line 102, `membersOf` at line 41), so nothing should break.

- [ ] **Step 7: Commit**

```bash
git add src/routes/NotesPage.svelte src/routes/NotesPage.test.js
git commit -m "$(cat <<'EOF'
feat(memo): let the Memo page sort by created or updated, newest or oldest

The board was hard-wired to newest-updated-first by a .reverse() inside load().
Sorting is now derived from the fetched notes, so changing it re-orders without
re-reading IndexedDB, and the group folders inherit the order through membersOf.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Memo page — the date-range filter

**Files:**
- Modify: `app/src/routes/NotesPage.svelte` (lines 32–40, 132–147, style block)
- Modify: `app/src/routes/NotesPage.test.js`

**Interfaces:**
- Consumes: `inRange` from Task 3, `sortField` from Task 6.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing test**

Append to `app/src/routes/NotesPage.test.js`:

```js
describe('NotesPage date range', () => {
  beforeEach(async () => {
    await _clearAllForTest();
    await seed({ body: 'memo january', created: '2026-01-15T04:00:00.000Z' });
    await seed({ body: 'memo august', created: '2026-08-04T04:00:00.000Z' });
  });

  it('keeps only memos on or after the from-date', async () => {
    render(NotesPage);
    await waitFor(() => expect(bodies().length).toBe(2));
    await fireEvent.change(screen.getByLabelText('from'), { target: { value: '2026-08-01' } });
    await waitFor(() => expect(bodies().length).toBe(1));
    expect(bodies()[0]).toContain('memo august');
  });

  it('keeps only memos on or before the to-date', async () => {
    render(NotesPage);
    await waitFor(() => expect(bodies().length).toBe(2));
    await fireEvent.change(screen.getByLabelText('to'), { target: { value: '2026-01-31' } });
    await waitFor(() => expect(bodies().length).toBe(1));
    expect(bodies()[0]).toContain('memo january');
  });

  it('says so when the range excludes everything', async () => {
    render(NotesPage);
    await waitFor(() => expect(bodies().length).toBe(2));
    await fireEvent.change(screen.getByLabelText('from'), { target: { value: '2027-01-01' } });
    await waitFor(() => expect(screen.getByText('No memos match.')).toBeTruthy());
  });

  it('restores everything when the range is cleared', async () => {
    render(NotesPage);
    await waitFor(() => expect(bodies().length).toBe(2));
    await fireEvent.change(screen.getByLabelText('from'), { target: { value: '2026-08-01' } });
    await waitFor(() => expect(bodies().length).toBe(1));
    await fireEvent.click(screen.getByTitle('Clear date range'));
    await waitFor(() => expect(bodies().length).toBe(2));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/routes/NotesPage.test.js`
Expected: FAIL — `Unable to find a label with the text of: from`.

- [ ] **Step 3: Add the state and fold the range into the match**

Add the import after line 5 (`noteHtml`):

```js
  import { inRange } from '../lib/dates.js';
```

Add beside the `sort` declaration from Task 6:

```js
  let from = $state('');
  let to = $state('');
```

Replace the filter block (lines 32–40):

```js
  const q = $derived(filter.trim().toLowerCase());
  function matches(n) {
    if (!q) return true;
    if (n.body.toLowerCase().includes(q)) return true;
    return n.ref ? formatRef(n.ref).toLowerCase().includes(q) : false;
  }
  // when filtering, show a flat list of ALL matching notes (loose + grouped), no folders
  let looseNotes = $derived(q ? notes.filter(matches) : notes.filter(n => !n.group_id));
  let visibleGroups = $derived(q ? [] : groups);
```

with:

```js
  const q = $derived(filter.trim().toLowerCase());
  const filtering = $derived(q !== '' || from !== '' || to !== '');
  // Text and date narrow together — a memo has to survive both. The range reads whichever field the
  // page is sorted by, so the sort control is the only place "date" gets defined.
  function matches(n) {
    if (!inRange(n[sortField], from, to)) return false;
    if (!q) return true;
    if (n.body.toLowerCase().includes(q)) return true;
    return n.ref ? formatRef(n.ref).toLowerCase().includes(q) : false;
  }
  // when filtering, show a flat list of ALL matching notes (loose + grouped), no folders
  let looseNotes = $derived(filtering ? notes.filter(matches) : notes.filter(n => !n.group_id));
  let visibleGroups = $derived(filtering ? [] : groups);
```

- [ ] **Step 4: Add the range row and the empty-match state**

Replace the head/board opening (lines 132–147):

```svelte
<div class="scroll"><div class="page">
  <div class="head">
    <h1>Memo</h1>
    <div class="actions">
```

...through the `{#if notes.length === 0 && groups.length === 0}` branch, so that the markup reads:

```svelte
<div class="scroll"><div class="page">
  <div class="head">
    <h1>Memo</h1>
    <div class="actions">
      <input class="filter" placeholder="Filter memos…" bind:value={filter} />
      <select class="sort" bind:value={sort} title="Sort memos">
        <option value="updated_at:desc">Updated · newest first</option>
        <option value="updated_at:asc">Updated · oldest first</option>
        <option value="created_at:desc">Created · newest first</option>
        <option value="created_at:asc">Created · oldest first</option>
      </select>
      <button class="btn" onclick={openNewNote}>+ Memo</button>
      <button class="btn" onclick={async () => { addGroup(); await load(); }}>+ Group</button>
    </div>
  </div>

  <div class="range">
    <label>from <input type="date" bind:value={from} /></label>
    <label>to <input type="date" bind:value={to} /></label>
    {#if from || to}
      <button class="clear" title="Clear date range" onclick={() => { from = ''; to = ''; }}>✕</button>
    {/if}
  </div>

  {#if notes.length === 0 && groups.length === 0}
    <p class="empty">No memos yet. Add one with “+ Memo”, or jot one against a verse in Study mode.</p>
  {:else if filtering && looseNotes.length === 0}
    <p class="empty">No memos match.</p>
  {:else}
```

The rest of the template (the board, the `{#key boardNonce}` block, the closing `{/if}`) is unchanged.

- [ ] **Step 5: Style the row**

Add to the style block, after the `.sort` rule from Task 6:

```css
  .range { display: flex; align-items: center; gap: 12px; margin-top: 10px; font-size: 12px; color: var(--dim); }
  .range label { display: inline-flex; align-items: center; gap: 5px; }
  .range input { font-family: inherit; font-size: 12px; padding: 3px 7px; border: 1px solid var(--rule); border-radius: 5px; background: var(--bg); color: var(--ink); }
  .clear { border: none; background: transparent; color: var(--dim); cursor: pointer; font-size: 12px; padding: 2px 5px; line-height: 1; }
  .clear:hover { color: var(--ink); }
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/routes/NotesPage.test.js`
Expected: PASS, 7 tests.

If `getByLabelText('from')` cannot find the input, the wrapping-label association is not resolving under jsdom — give the inputs `id`/`for` pairs (`id="memo-from"`, `<label for="memo-from">`) rather than weakening the test to a `title` lookup.

- [ ] **Step 7: Commit**

```bash
git add src/routes/NotesPage.svelte src/routes/NotesPage.test.js
git commit -m "$(cat <<'EOF'
feat(memo): filter the Memo page to a date range

Answers "what did I write in July", which the box could not ask before — it
matched body text and the rendered reference and nothing else.

Both bounds are optional and inclusive, and the range reads whichever field the
sort control selects, so there is no second which-date control to keep in sync.
An over-narrow filter now says "No memos match." instead of emptying the board
with no explanation.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Memo page — the date on the tile

**Files:**
- Modify: `app/src/routes/NotesPage.svelte` (lines 121–130, style block)
- Modify: `app/src/routes/NotesPage.test.js`

**Interfaces:**
- Consumes: `memoDateLabel` from Task 2, `sortField` from Task 6.
- Produces: nothing.

- [ ] **Step 1: Write the failing test**

Append to `app/src/routes/NotesPage.test.js`:

```js
describe('NotesPage tile date', () => {
  beforeEach(async () => {
    await _clearAllForTest();
    await seed({ body: 'memo edited', created: '2026-01-15T04:00:00.000Z', updated: new Date().toISOString() });
  });

  it('prints the date on the tile', async () => {
    render(NotesPage);
    await waitFor(() => expect(screen.getByText('edited today')).toBeTruthy());
  });

  it('follows the sorted field, so the sort control is the legend', async () => {
    render(NotesPage);
    await waitFor(() => expect(screen.getByText('edited today')).toBeTruthy());
    await fireEvent.change(screen.getByTitle('Sort memos'), { target: { value: 'created_at:desc' } });
    await waitFor(() => expect(screen.getByText('created Jan 15')).toBeTruthy());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/routes/NotesPage.test.js`
Expected: FAIL — `Unable to find an element with the text: edited today`.

- [ ] **Step 3: Add the line to the snippet**

Add the import alongside `inRange` (Task 7):

```js
  import { inRange, memoDateLabel } from '../lib/dates.js';
```

Replace the `noteTile` snippet's button body (lines 125–128):

```svelte
    <button class="sq postit" style="background: var(--sy{colorN})"
      onclick={(e) => { if (!noteClick(e, note)) openNote(note); }}>
      <div class="body md">{@html noteHtml(note.body)}</div>
    </button>
```

with:

```svelte
    <button class="sq postit" style="background: var(--sy{colorN})"
      onclick={(e) => { if (!noteClick(e, note)) openNote(note); }}>
      <div class="body md">{@html noteHtml(note.body)}</div>
      <div class="d">{memoDateLabel(note, sortField)}</div>
    </button>
```

The expanded group view renders the same snippet, so it gets the date too.

- [ ] **Step 4: Give the body room to shrink**

The tile is a fixed square, so the date has to take its line out of the body rather than grow the tile. Replace these two rules (lines 204–208):

```css
  .sq { width: 100%; aspect-ratio: 1 / 1; border: none; border-radius: 10px; padding: 12px 12px 14px;
    cursor: pointer; overflow: hidden; text-align: left; display: block; font-family: inherit; }
  .tile.sel .sq { outline: 2px solid var(--a); outline-offset: 2px; }
  .sq .body { font-size: 12.5px; line-height: 1.4; height: 100%; overflow: hidden;
    -webkit-mask-image: linear-gradient(180deg, #000 78%, transparent); mask-image: linear-gradient(180deg, #000 78%, transparent); }
```

with:

```css
  .sq { width: 100%; aspect-ratio: 1 / 1; border: none; border-radius: 10px; padding: 12px 12px 14px;
    cursor: pointer; overflow: hidden; text-align: left; display: flex; flex-direction: column; font-family: inherit; }
  .tile.sel .sq { outline: 2px solid var(--a); outline-offset: 2px; }
  .sq .body { font-size: 12.5px; line-height: 1.4; flex: 1; min-height: 0; overflow: hidden;
    -webkit-mask-image: linear-gradient(180deg, #000 78%, transparent); mask-image: linear-gradient(180deg, #000 78%, transparent); }
  .sq .d { flex: none; font-size: 9.5px; opacity: .55; margin-top: 6px; }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/routes/NotesPage.test.js`
Expected: PASS, 9 tests.

- [ ] **Step 6: Run the whole suite**

Run: `npx vitest run`
Expected: PASS, all files.

- [ ] **Step 7: Commit**

```bash
git add src/routes/NotesPage.svelte src/routes/NotesPage.test.js
git commit -m "$(cat <<'EOF'
feat(memo): print the date on the memo tile

The tile shows whichever field the page is sorted by, so the sort control
doubles as the legend for what the date means, and the created/edited verb keeps
it legible when the sort changes underneath.

The square is fixed aspect-ratio, so the body flexes and gives up a line rather
than the tile growing; the fade mask is unchanged. The expanded group view
renders the same snippet and picks this up for free.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Manual verification and the tracker entry

Automated tests cannot see layout. This is the pass that catches a date line clipped by the fade mask or a range row that wraps badly.

**Files:**
- Modify: `docs/FEATURES-AND-IDEAS.md`

- [ ] **Step 1: Start the app**

Run: `./start.sh` (from the repo root) or `npm run dev` (from `app/`). Open `http://localhost:5173/#/notes`.

- [ ] **Step 2: Walk the checklist**

- All four sort orders reorder the board.
- A group folder's contents follow the sort (open one, switch sort, reopen).
- The date line is legible on the tile and not swallowed by the body's fade mask.
- Switching Updated → Created changes both the ordering and the tile's verb.
- `from` alone, `to` alone, and both together each narrow the board.
- A range matching nothing shows "No memos match."
- The ✕ appears only when a bound is set, and clears both.
- Filtering by text still flattens the groups into one list.
- Home's recent memos and the Study-mode card both show a date.
- Toggle light/dark — the date passes contrast in both, and the date inputs are not stark white boxes on the dark theme.

- [ ] **Step 3: Record it in the tracker**

Add a section to `docs/FEATURES-AND-IDEAS.md` above the `## 🔎 TO FIX — Memo reference search` heading:

```markdown
## ✅ Memo dating — sort, date range, dates on the cards (2026-08-05)

Memos always carried `created_at` and `updated_at`; nothing surfaced them outside Home.

- **Sort** the Memo page by created or updated, newest or oldest first. Derived from the loaded
  notes, so group folders inherit the order and switching does not re-read IndexedDB.
- **Date range** — optional, inclusive `from`/`to` bounds that filter on whichever field the sort
  selects. Composes with the text filter; an over-narrow filter now says "No memos match."
- **Dates on all three surfaces** — memo tile (following the sorted field), Study-mode card, Home.
- **BUG FIXED — `relDate` counted elapsed hours, not calendar days.** A memo written yesterday at
  8am read "today" on Home; one from two days ago at 11pm read "yesterday". Every date now routes
  through one `localDay()` in `app/src/lib/dates.js`, so the labels and the range filter cannot
  disagree about where a day starts.
- **Storage unchanged** — memos stay UTC ISO. Offset-bearing strings would stop sorting
  lexicographically, which is the only reason the `updated_at` IndexedDB index works.
- Spec `specs/2026-08-05-memo-dating-design.md`, plan `plans/2026-08-05-memo-dating.md`.
```

Update the `> Last updated:` line at the top of the file if the date has moved on.

- [ ] **Step 4: Commit**

```bash
git add docs/FEATURES-AND-IDEAS.md
git commit -m "$(cat <<'EOF'
docs(memo): record memo dating in the tracker

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Spec coverage.** Storage-stays-UTC → Global Constraints + Task 1. `localDay` → Task 1. `memoDateLabel` with the calendar-day fix, the year, and the verb → Task 2. `inRange` → Task 3. Sort control and its four options → Task 6. Date range, filter composition, flatten-on-filter, empty-match state → Task 7. Tile date following the sorted field → Task 8. Workbench card → Task 5. Home → Task 4. TZ-pinned tests → Task 1, carried by every later `dates.test.js` case. Manual pass → Task 9. No spec section is unimplemented.

**Names used consistently.** `localDay`, `memoDateLabel`, `inRange`, `sortField`, `sortDir`, `filtering`, `rawNotes`, `notes` — each defined once, in the task that introduces it, and referenced with the same name and signature afterwards.

**Test scaffolding, verified against the real store before writing this plan** (probe run, then deleted):

- `_clearAllForTest` (`store.js:188`) is the clearing seam. It also clears `localStorage`, so groups reset too.
- The `seed()` helper's second `openDB('deepverse', 1)` coexists with the connection `store.js` caches — confirmed under `fake-indexeddb`, timestamps overwrite cleanly and `allNotes()` reads them back.
- `allNotes()` returns **ascending** by `updated_at` (it reads the index directly), which is why Task 6 replaces the old `.reverse()` with an explicit comparator rather than relying on fetch order.

**One thing left to confirm at implementation time:** `getByLabelText('from')` in Task 7 assumes jsdom resolves a wrapping `<label>`. Task 7 Step 6 says what to do if it does not — add `id`/`for` rather than weaken the query to a `title` lookup.
