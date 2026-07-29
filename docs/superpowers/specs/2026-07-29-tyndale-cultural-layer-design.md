# Tyndale cultural layer — import & display design

**Date:** 2026-07-29
**Status:** approved design, pending implementation plan
**Precedent:** `2026-07-15-tyndale-study-notes-display-design.md` (study notes, already shipped)

## Goal

Import the remaining Tyndale Open content (CC BY-SA 4.0) — the Bible Dictionary, theme
articles, profiles, book introductions, textboxes and charts — and surface it two ways: verse-driven
inside the Context tab while reading, and as a browsable multi-angle explorer at `#/library`.

Tyndale Open Study Notes (16,913 notes, `study_notes`) are already imported and are the precedent
this follows.

## Sequencing

**Phase 1 — this plan.** The import (validation, book-code consolidation, four tables, build
pipeline) and the Context tab surface (collapsible sections, hotkeys, chip-grid dictionary).
Complete and shippable on its own: everything imported is reachable while reading.

**Phase 2 — gated on a separate UI design ideation session.** The `#/library` explorer. Its data
requirements are settled here and the Phase 1 schema serves it unchanged (`sort_title`, `kind`,
`host_id`, the indexes) — only its interface is open. Phase 1 must not be blocked on it, and no
explorer UI is built before that session.

## Scope

| source file | items | anchor | destination |
|---|---|---|---|
| `dictionary/Articles/{A..Z}.xml` | 6,010 | `?bref=` links in body | Context tab (verse) + explorer |
| `ThemeNotes.xml` | 298 ThemeNote (+1 misfiled Profile) | `<refs>` range | Context tab (verse) + explorer |
| `Profiles.xml` | 124 | `<refs>` range | Context tab (verse) + explorer |
| `BookIntros.xml` | 66 | whole-book range | Context tab (book) + explorer |
| `BookIntroSummaries.xml` | 66 | whole-book range | Context tab (book) + explorer |
| `Textboxes.xml` | 110 | one host article each | inside host article |
| `Charts.xml` | 21 | one host article each | inside host article |

**Excluded:** `Pictures.xml` (210 items — `Pictures/artfiles/` does not exist; the dictionary README
states the images are not licensed for redistribution, so only captions remain). `Maps.xml`
(80 maps whose artfiles are 70 PDFs totalling 20 MB — needs pdf.js and its own design).

## Source validation

The standing rule is to validate before importing. Two findings gate correctness.

### 1. Two different Tyndale book-code schemes

| scheme | where | example |
|---|---|---|
| Roman numerals, on the `name` attribute | `StudyNotes.xml` only | `IThes.2.6`, `IIPet.1.1`, `Pr.15.11` |
| **Arabic, in `<refs>` and `?bref=`** | **every other file, including `StudyNotes.xml`'s own `<refs>`** | `1Thes.2.6`, `1Jn.3.1`, `Hagg.1.1` |

The existing `BOOK_FIX` in `build/lib/studynotes.mjs` handles the *Roman* scheme, because
`parse-studynotes.mjs` keys off the `name` attribute. **Reusing it for this import would fail
silently:** `1Thes`, `2Thes`, `1Jn`, `2Jn`, `3Jn` are not keys in it, so they pass through unmapped
and never join to `verses.book` (`1Thess`, `1John`…). That is the same class of bug as the original
`IIPet` trap — 20 books lost without an error.

The dictionary adds three more variants, each a near-invisible singleton against a dominant correct
form: `Jos` (1 link vs 1,452 `Josh`), `Mt` (1 vs 2,009 `Matt`), `Esther` (1 vs 187 `Esth`).

### 2. Apocrypha

The dictionary cites 12 books absent from `bible.db`: `1Esd`, `2Esd`, `1Macc`, `2Macc`, `3Macc`,
`AddEsth`, `Bar`, `Bel`, `Ecclus`, `Jdt`, `Tb`, `Wisd` — 641 of 44,132 links. These are dropped
deliberately and counted in the parse log, never left to fail quietly.

### 3. Minor

- `CONTENTS.txt` names a `ThemeArticles.xml` that does not exist; the file is `ThemeNotes.xml`.
- It claims 299 theme articles. There are 298 `ThemeNote` items plus one `Profile` misfiled into the
  same file. Route by `typename`, never by filename.
- All 6,010 dictionary `name` attributes are unique (verified) and safe as primary keys.
- Attribute order differs between files (`typename` before `name` in Articles, after it in
  StudyNotes), so the item regex must not assume a fixed order.

### The guard

`toOsis(code)` **throws** on any code that is not canonical OSIS, not a known alias, and not in the
apocrypha set. A future source revision that introduces a new variant fails the build loudly instead
of dropping a book. Verified post-build by an orphan-book assertion (below).

## Book-code consolidation

Four separate maps exist today: `STEP2OSIS` (`build/lib/refs.mjs`), `BOOK_FIX`
(`build/lib/studynotes.mjs`), `BOOKS` (`build/parse-nlt.mjs`), and Theographic passing OSIS through
natively. Each new source has meant another local patch, which is exactly how `1Thes` would get
missed again.

Add **`build/lib/books.mjs`**: canonical OSIS for the 66 books, every known alias from all sources
(STEPBible `1Th`, Tyndale Roman `IThes` *and* Arabic `1Thes`, NLT tokens), the apocrypha set, and:

```js
export function toOsis(code)      // → OSIS, or throws on an unknown code
export function toOsisOrNull(code) // → OSIS, or null for known-apocrypha (no throw)
```

Existing maps fold into it and their call sites switch over. **OSIS stays canonical** — `1Thess` is
what the tables store, since all 31,102 verses key off it; `1Thes` becomes a recognised *input*
alias, not a stored form. This touches working code, which CLAUDE.md §3 normally forbids; it is in
scope because it was explicitly requested, and because per-source maps are the root cause of the
trap this import had to work around.

## Display model

### Why not the study-notes answer

Study notes solved density with a covering-range model and deliberately no per-verse markers, because
coverage was near-total. That does not transfer: the dictionary is entity-keyed, not verse-keyed.

### The verse join

Dictionary articles carry no `<refs>`, but their bodies hold 44,132 `?bref=` scripture links. That
yields a usable index: 16,189 verses (52%) get ≥1 article, median 2, p90 5, max 25. At *chapter*
level it degrades badly (median 20, max 204 at Josh 15), so the join is per-verse only.

### Ranking — relatedness, not quality

An article citing 3 verses is *about* them; one citing 197 mentions each in passing. Four signals
were measured against real verses:

| signal | result |
|---|---|
| A — inverse citation count | good; misses `Centurion` at Acts 10:1, ranks `Chaos, Waters of` over `Creation` at Gen 1:1 |
| B — how early the citation appears in the body | **failed** — surfaces `Animals` at Gen 1:1, `Chronicles, Books of` at 1Chr 1:1 |
| C — citation within the opening ~300 chars | middling; noisy on genealogies |
| D — article title word occurs in the verse text | strong, and complementary to A |

**Chosen: D primary, A as tiebreak.** Best result on every test verse:

```
Mark 14:36   Abba · Talitha Cumi · Cup · Incarnation · Prophecy
Gen 1:1      Creation Myths · Creation · New Creation · Chaos, Waters of
1Chr 1:1     Seth · Enosh · Adam (Person) · Sheth        (verse: "Adam, Seth, Enosh")
Acts 10:1    Cornelius · Italian Band · Caesarea · Centurion · Joppa
Josh 15:21   Jagur · Eder (Place) · Kabzeel · Gerar
Matt 27:26   Isaiah, Book of · Matthew, Gospel of        ← no signal helps; genuinely nothing good
```

The title word appears in the verse text for 47% of article–verse pairs; 62% of covered verses get
≥1 such hit. `lex_hit` is precomputed at build time — substring-matching verse text at query time in
sql.js is not viable.

Known limits, accepted: prefix matching is crude and has both false positives and misses (`Cup` at
Mark 14:36 scores no hit because title words are filtered to ≥4 chars); the signal can only confirm
what a verse *lexically names*, so a verse about an unnamed concept stays unhelped. **Nothing is
filtered out** — ranking only sets order, so a weak signal costs position, never access.

### Density

Measured across all 31,102 verses, per verse:

| section | median | p90 | p99 | max |
|---|---|---|---|---|
| entity chips (existing, Theographic) | 9 | 33 | 150 | 202 |
| dictionary articles (new) | 1 | 4 | 9 | 25 |
| theme articles (new) | 0 | 1 | 2 | 3 |
| profiles (new) | 0 | 1 | 2 | 3 |
| **all new content combined** | **1** | **4** | **9** | **26** |

The Context tab is already dense, and the existing entity section is the cause — 9× everything this
import adds at the median, 37× at p99. Making every section collapsible (required for hotkeys anyway)
resolves it.

## Data layer

### Tables

```sql
CREATE TABLE dict_articles (          -- 6,010 articles + 110 textboxes + 21 charts
  id TEXT PRIMARY KEY,                -- source `name` attr; unique across all files (verified)
  title TEXT NOT NULL,
  sort_title TEXT NOT NULL,           -- title with * and leading articles stripped, for A–Z browse
  kind TEXT NOT NULL,                 -- 'article' | 'textbox' | 'chart'
  host_id TEXT,                       -- textboxes/charts attach to their one host article
  body TEXT NOT NULL,
  is_html INTEGER NOT NULL,           -- 1 for charts (real <table>); 0 = plain text
  n_refs INTEGER NOT NULL,            -- distinct verses cited; the ranking tiebreak
  seq INTEGER NOT NULL);

CREATE TABLE dict_verse (             -- ~39k rows: the ?bref= index
  article_id TEXT NOT NULL,
  book TEXT NOT NULL, chapter INTEGER NOT NULL, verse INTEGER NOT NULL,
  lex_hit INTEGER NOT NULL);          -- precomputed relatedness signal D
CREATE INDEX idx_dict_verse ON dict_verse(book, chapter, verse);

CREATE TABLE tyndale_passages (       -- 298 themes + 125 profiles; mirrors study_notes shape
  kind TEXT NOT NULL,                 -- 'theme' | 'profile'
  title TEXT NOT NULL, book TEXT NOT NULL,
  start_chapter INTEGER NOT NULL, start_verse INTEGER NOT NULL,
  end_chapter INTEGER NOT NULL, end_verse INTEGER NOT NULL,
  ref TEXT NOT NULL,                  -- display span, e.g. "1:1–2:25"
  body TEXT NOT NULL, seq INTEGER NOT NULL);
CREATE INDEX idx_tyndale_passages ON tyndale_passages(book, start_chapter, end_chapter);

CREATE TABLE book_intros (            -- 66
  book TEXT PRIMARY KEY,
  summary TEXT NOT NULL,              -- Purpose / Author / Date / Setting
  intro TEXT NOT NULL);               -- long-form
```

Sort-key convention matches study notes: `sortkey(ch, v) = ch*1000 + v`.

Size: ~11 MB of text plus ~1 MB of index. `data/bible.db` 154 → ~166 MB; the app copy 149 → ~161 MB
(+7%). No table is dropped by `copy-assets.mjs` — all four are queried at runtime.

### Queries (`app/src/lib/db.js`)

```sql
-- getDictForVerse(book, chapter, verse)
SELECT a.id, a.title, a.body, a.n_refs FROM dict_verse v JOIN dict_articles a ON a.id = v.article_id
WHERE v.book = ? AND v.chapter = ? AND v.verse = ?
ORDER BY v.lex_hit DESC, a.n_refs ASC, a.sort_title

-- getTyndalePassages(kind, book, chapter, verse) — covering-range, as study notes
WHERE kind = ? AND book = ?
  AND (start_chapter*1000 + start_verse) <= ? AND (end_chapter*1000 + end_verse) >= ?
ORDER BY (start_chapter*1000 + start_verse), seq
```

Plus `getBookIntro(book)` and `getArticleSupplements(hostId)` for Phase 1. The browse queries
(`getDictBrowse`, `getThemeIndex`, `getProfileIndex`) are Phase 2 and are not written until the
explorer's UI is designed — the schema supports them, but their shape depends on that design.

## Build pipeline

Follows the required `DATA-PIPELINE.md` checklist.

- **`build/lib/books.mjs`** — canonical OSIS + aliases + `toOsis` guard (above).
- **`build/lib/tyndale.mjs`** — shared parsing: item iteration, entity decoding, body cleaning
  (reusing the `cleanNoteBody` approach), `<refs>` range parsing, `?bref=` extraction, `lex_hit`
  computation, and the four loaders. `studynotes.mjs` is left untouched apart from its `BOOK_FIX`
  moving into `books.mjs`.
- **`build/parse-tyndale.mjs`** — maintainer-only; reads `backup-data/tyndale/`, writes three
  gzipped intermediates to `build/data/sources/`, all **committed**:
  `tyndale-dictionary.json.gz` (~3 MB), `tyndale-passages.json.gz`, `tyndale-bookintros.json.gz`.
  Logs parsed/skipped/apocrypha-dropped counts.
- **`build/build-db.mjs`** — creates the four tables, loads via the existing `loadTable`/`tx()`
  pattern, logs row counts.
- **`install.sh`** — no change expected (it already runs `build-db.mjs` against whatever is in
  `build/data/sources/`). Re-verified rather than assumed.
- **`backup-data/` stays gitignored and is never an install input.** A fresh clone rebuilds purely
  from the committed intermediates; verified by renaming `backup-data/` away and rebuilding.

## UI

### Context tab (`ContextCard.svelte`)

Every section becomes collapsible with a count in its header, state persisted through the existing
`getPref`/`setPref`:

```
q  The Book of Genesis   ›   ← book-level (like Recap): Purpose/Author/Date/Setting, Read more
w  Recap                 ›
e  People · Places · Events · 12
   ───────────────────────────
r  Study Notes · 2       ›
t  Themes · 1            ›
y  Profiles · 0
u  Dictionary · 5        ›
```

**Hotkeys** `q w e r t y u` toggle their section, active only when the Context card is open **and**
`tab === 'context'`. They share Workbench's existing input-field guard, and use letters so they never
collide with its `1..n` card toggles. Keys are bound to fixed sections, not to visible position, so
a section's key never shifts. A section with a count of 0 renders its header but cannot expand;
its hotkey is a silent no-op rather than an error or an empty panel.

**Dictionary section, expanded** — follows the `OriginalCard` interlinear pattern rather than a list:
a compact grid of title chips, with exactly **one** article body rendered below in a `border-top`
detail div, `scrollIntoView({ block: 'nearest' })` on change. This bounds height regardless of count
— Gen 1:1's 25 entries cost four rows of chips, not 25 paragraphs. Bodies clamp at ~400 chars with
**Read more** (the `RECAP_CLAMP` pattern); 69% of articles are under 500 chars and never clamp, while
`Animals` at 107k chars stays contained. Textbox and chart chips appear inside their host article's
detail div.

Themes and Profiles render as the same chip-grid-plus-detail, using the covering-range model.

### Explorer (`#/library`) — Phase 2, not built in this plan

**Its interface is deliberately undesigned here.** What follows is the settled *content and data*
scope only, recorded so Phase 1's schema supports it. The layout, navigation and interaction model
are the subject of a dedicated UI design ideation session, which must happen before any of this is
implemented.

A sixth route, added to `applyHash`'s view list in `App.svelte`. Four angles as entry points:

| angle | content | ordering |
|---|---|---|
| **Themes** | 298 theme articles | canonical, by anchor passage |
| **Books** | 66 intros + summaries | canonical book order |
| **Profiles** | 124 people | alphabetical |
| **Dictionary** | all 6,010, A–Z + search | `sort_title` |

Each entry opens its article and offers a jump to its anchor passage via the existing `goToPassage`.
Charts render as real `<table>`; everything else is plain text.

**The source has no thematic categorisation** — no category markup exists in `ThemeNotes.xml`. The
Themes angle therefore lists the 298 as they are. Inventing groupings would be fabrication, against
the project's grounding rule. This constrains the Phase 2 ideation: an "angle" can reorder or filter
what exists, but cannot invent a taxonomy the corpus does not carry.

## Attribution (CC BY-SA 4.0)

`docs/ATTRIBUTIONS.md` gains **Tyndale Open Bible Dictionary**, © 2023 Tyndale House Publishers,
CC BY-SA 4.0, from tyndaleopenresources.com. The dictionary README requires derivative works to state
what changed, and our derivation qualifies, so the entry says so explicitly: XML flattened to text,
scripture refs re-keyed to OSIS, apocryphal references dropped. ShareAlike binds the derived data,
not the app code. Perspective is evangelical/conservative — disclosed via the source label, as with
the study notes.

In-app: the existing `.srcinfo` ⓘ tooltip on each new section and on the explorer.

## Testing

**Parse (`build/test/tyndale.test.mjs`, `books.test.mjs`)**
- Every `<refs>` shape: `Gen.1.1-2.25` → (1,1,2,25); `Gen.1.16` → (1,16,1,16); `2Jn.1.7` → 2John.
- Each alias resolves to a book that exists in `verses.book` — asserted for the whole map, so a typo
  in an alias cannot ship.
- `toOsis` **throws** on an unknown code (the regression guard for the `1Thes` trap).
- Apocrypha dropped, not thrown, and counted.
- The misfiled `Profile` in `ThemeNotes.xml` lands in profiles, not themes.
- Body cleaning: tags stripped, entities decoded, chart `<table>` preserved.

**Ranking**
- `Mark 14:36` ranks `Abba` first; `Acts 10:1` includes `Centurion`; `1Chr 1:1` ranks `Seth`/`Enosh`
  above `Chronology of the Bible`.

**Post-build invariants**
- Zero orphan books: `SELECT DISTINCT book FROM dict_verse LEFT JOIN verses … WHERE verses.book IS
  NULL` returns empty, same for `tyndale_passages` and `book_intros`. This is the check that catches
  a silent join failure.
- Row counts: 6,141 `dict_articles`, 423 `tyndale_passages`, 66 `book_intros`.

**Queries (`app/src/lib/db.queries.test.js`)** — covering-range behaviour, ranking order, book-level
intro lookup, supplement attachment.

**Regression** — `build/` 67/67 and `app/` 104/104 stay green; rebuild with `backup-data/` renamed
away and confirm success; check the Context tab and its hotkeys live in the browser.

Explorer tests belong to Phase 2, alongside its UI design.

## Non-goals

- Maps (80, 20 MB of PDFs) and Pictures (images not licensed) — see Scope.
- Clickable scripture refs inside article bodies — still plain text, as with study notes.
- Reader-pane markers — rejected for study notes, same reasoning here.
- Thematic categorisation of the 298 themes — not in the source.
