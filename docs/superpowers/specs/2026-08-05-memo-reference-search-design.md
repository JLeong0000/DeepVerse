# Memo reference search: match references, not substrings

Date: 2026-08-05
Status: Approved design, ready for implementation

## Problem

The Memo page filter tests the query as a substring of the **rendered** reference
(`app/src/routes/NotesPage.svelte:52`):

```js
return n.ref ? formatRef(n.ref).toLowerCase().includes(q) : false;
```

Comparing the whole rendered string is the defect. `Psalm` is in `Psalms`, but
`Psalm 23` is **not** in `Psalms 23:1` — the `s` lands between the book and the
number, so the match dies on a book the user spelled correctly. Measured:

- **Finds nothing:** `psalm 23`, `1 Cor 13`. 18 of the 66 display names contain a
  space, so the whole numbered-book family is unreachable this way.
- **Finds the wrong memo:** `john 3:1` surfaces a memo on John **3:16**, because
  `"john 3:16"` contains `"john 3:1"`. Verse boundaries do not exist to a
  substring.

Separating the book from the numbers fixes both: match the book text against book
*names*, and compare chapter and verse as numbers.

## Goals

1. The book part of a query matches by containment against the display name.
2. Chapter and verse are compared numerically, so verse boundaries hold.
3. A query matches any memo whose reference **overlaps** it.
4. No regression for plain text search.

## Non-goals

- **No abbreviation or alias table.** `jn`, `mt`, `revelations`,
  `song of solomon` match nothing. Explicitly not wanted.
- **No OSIS-code matching and no space-stripping.** `1Cor` matches nothing;
  `1 Cor` matches 1 Corinthians. Codes like `Ps` and `Gen` still work, but only
  because they are containments of `Psalms` and `Genesis`, not because codes are
  consulted.
- **`parseReference` is not touched.** See below.
- No change to the date range, the sort, or anything outside `matches()`.

## Why `parseReference` is left alone

`parseReference` (`refs.js:88`) already parses free-form references and drives
Home's jump-to-verse box. It is the wrong tool here, and adapting it would damage
it:

- It resolves to **one** book (first hit across exact-code, exact-name,
  prefix-code, prefix-name). A jump box must navigate somewhere, so one winner is
  correct. A filter needs the **set** — `j` legitimately means 12 books.
- It **defaults a bare book to chapter 1**: `parseReference('John')` returns
  `{ book: 'John', chapter: 1 }`. Correct for navigation, wrong for filtering,
  where `john` must mean *every* John memo.
- It matches **codes and prefixes with spaces stripped**, so `1Cor` resolves.
  This design requires `1Cor` to match nothing.

Every rule differs, so there is no shared helper worth extracting. The two
functions coexist and the jump box carries zero risk.

## `refs.js` — three additions

### `matchBooks(text)` → `string[]`

Every book whose display name **contains** `text`, case-insensitive, with spaces
significant. The entire book-matching rule.

```js
export function matchBooks(text) {
  const q = String(text || '').trim().toLowerCase();
  if (!q) return [];
  return BOOKS.filter(([, name]) => name.toLowerCase().includes(q)).map(([code]) => code);
}
```

Measured behaviour:

| Query | Result |
|---|---|
| `j` | 12 — Joshua, Judges, Job, Jeremiah, Joel, Jonah, John, James, Jude, 1 John, 2 John, 3 John |
| `jo` | 8 — Joshua, Job, Joel, Jonah, John, 1 John, 2 John, 3 John |
| `john` | 4 — John, 1 John, 2 John, 3 John |
| `ohn` | 4 — same as `john`; containment is not anchored |
| `psalm` | Psalms |
| `ps` | Psalms |
| `1 Cor` | 1 Corinthians |
| `1Cor` | none — no display name contains it |

### `parseRefQuery(input)` → `{ books, chapter, verse, verseEnd } | null`

Splits a trailing `chapter` or `chapter:verse` (optionally `:verse-verse`) off the
book text, then resolves the book text through `matchBooks`.

```js
export function parseRefQuery(input) {
  const raw = String(input || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!raw) return null;
  const m = raw.match(/^(.*?)\s*(\d+)(?::(\d+)(?:\s*-\s*(\d+))?)?\s*$/);
  let bookText = raw, chapter = null, verse = null, verseEnd = null;
  if (m && m[1].trim()) {
    bookText = m[1].trim();
    chapter = +m[2];
    verse = m[3] ? +m[3] : null;
    verseEnd = m[4] ? +m[4] : verse;
  }
  const books = matchBooks(bookText);
  return books.length ? { books, chapter, verse, verseEnd } : null;
}
```

`null` chapter/verse mean **unconstrained**, which is the substantive difference
from `parseReference`. Returning `null` overall is what lets the filter fall back
to plain text search.

The `m[1].trim()` guard keeps a bare number as book text rather than a chapter:
`1` parses as book text and matches the eight books whose names contain "1"
(1 Samuel … 1 John), consistent with containment.

### `refOverlaps(memoRef, query)` → `boolean`

Parses a stored ref into a span and intersects it with the query. Memo refs take
exactly three shapes, all built in `NotesCard.svelte:10-16` — `John.12` (chapter),
`John.3.16` (verse), `John.3.16-18` (range). **Ranges are always within one
chapter**, so there are no cross-chapter spans.

```js
export function refOverlaps(memoRef, query) {
  const [book, ch, v] = String(memoRef).split('.');
  if (!query.books.includes(book)) return false;
  if (query.chapter == null) return true;
  if (+ch !== query.chapter) return false;
  if (query.verse == null) return true;
  if (v == null) return true;              // a chapter memo covers every verse in it
  const [lo, hi] = String(v).split('-');
  const start = +lo, end = hi ? +hi : +lo;
  return start <= query.verseEnd && end >= query.verse;   // spans intersect
}
```

| Query | Memo | Match | Why |
|---|---|---|---|
| `john` | `1John.3.2` | yes | `john` is in "1 John"; no chapter constraint |
| `john 3` | `John.3.16` | yes | no verse constraint |
| `john 3` | `John.12` | no | chapter differs |
| `john 3:17` | `John.3.16-18` | yes | 17 falls inside 16–18 |
| `john 3:1` | `John.3.16` | **no** | the false positive, fixed |
| `john 3:24` | `John.3` | yes | a chapter memo covers every verse in it |
| `1 Cor 13` | `1Cor.13.4` | yes | the false negative, fixed |
| `1Cor` | anything | no | no display name contains `1Cor` |

## `NotesPage.svelte`

The query parses once per keystroke, not once per memo:

```js
const refQuery = $derived(parseRefQuery(filter.trim()));
```

and the reference arm of `matches()` (line 52) becomes:

```js
return !!(refQuery && n.ref && refOverlaps(n.ref, refQuery));
```

**Text and reference remain a union** — a memo matches on body *or* reference,
exactly as today. Nothing findable by body text stops being findable, and a
half-typed `Joh` still searches bodies while also matching the John-ish books.

## Accepted consequences

Both were raised and accepted before approval.

- **`john 3` also matches 1 John 3, 2 John 3 and 3 John 3.** A direct result of
  containment. Narrow it by typing `1 john 3`.
- **`3:16` stops working.** Today it finds John 3:16 and Romans 3:16 together as a
  substring. A query with no book is not a reference, so it falls through to
  body-text search only. No no-book special case is added.

## Testing

`refs.test.js` (existing, covers `parseReference`) gains:

- `matchBooks` — the eight rows of the table above, including `1Cor` → `[]` and
  the `j`/`jo`/`john` narrowing counts (12/8/4).
- `parseRefQuery` — `john` yields `chapter: null` (**not** 1, the difference from
  `parseReference`); `john 3:16-18` yields the full span; `1 john` parses as book
  text with no chapter; an unmatched book yields `null`.
- `refOverlaps` — every row of the overlap table.

`NotesPage.test.js` gains integration cases: `john 3:1` does **not** surface a memo
on John 3:16, and `1 Cor` **does** surface a memo on 1 Cor 13:4.

Full suite (app 306, build 152) must stay green.
