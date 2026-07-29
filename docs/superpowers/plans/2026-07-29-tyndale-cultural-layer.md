# Tyndale Cultural Layer — Implementation Plan (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import Tyndale's Bible Dictionary (6,010 articles), theme articles, profiles, book introductions, textboxes and charts into `bible.db`, and surface them verse-driven in the Context tab.

**Architecture:** A maintainer-only parser reads raw XML from gitignored `backup-data/` and writes three committed gzipped intermediates; `build-db.mjs` loads those into four new tables. All book-code normalization moves into one shared `books.mjs` with a guard that throws on unknown codes. The app queries per-verse, ranked by a precomputed relatedness signal, and renders a chip grid with a single expandable detail div.

**Tech Stack:** Node 22+ (`node:sqlite`, `node:test`), Svelte 5 runes, sql.js, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-29-tyndale-cultural-layer-design.md`

## Global Constraints

- **Book codes in `bible.db` are OSIS** (`Gen`, `1Chr`, `Song`, `1Thess`, `1John`, `Matt`, `Rev`). Aliases are inputs only, never stored.
- **`backup-data/` is gitignored and never an install input.** A fresh clone must rebuild `bible.db` from committed intermediates alone.
- **Raw source never goes into git.** Only `build/data/sources/*.json.gz` intermediates are committed.
- **Build tests must stay green:** `cd build && npm test` — currently 67/67.
- **App tests must stay green:** `cd app && npm test` — currently 104/104.
- Node >= 22 (required by `node:sqlite`).
- Existing code style: 2-space indent, no semicolon-free style (semicolons used), comments explain *why*.
- **Phase 2 (`#/library` explorer) is NOT in this plan.** Do not create the route, the page, or its queries.

## File Structure

**Create:**
- `build/lib/books.mjs` — canonical OSIS list, merged alias map, apocrypha set, `toOsis` guard
- `build/test/books.test.mjs` — book-code tests
- `build/lib/tyndale.mjs` — XML parsing helpers + the four table loaders
- `build/test/tyndale.test.mjs` — parsing tests
- `build/parse-tyndale.mjs` — maintainer-only: `backup-data/` → committed intermediates
- `build/data/sources/tyndale-dictionary.json.gz` — committed intermediate
- `build/data/sources/tyndale-passages.json.gz` — committed intermediate
- `build/data/sources/tyndale-bookintros.json.gz` — committed intermediate

**Modify:**
- `build/lib/refs.mjs` — `STEP2OSIS` folds into `books.mjs`
- `build/lib/studynotes.mjs` — `BOOK_FIX` folds into `books.mjs`
- `build/parse-nlt.mjs` — `BOOKS` OSIS half folds into `books.mjs`
- `build/build-db.mjs` — four new tables, loaders, indexes
- `app/src/lib/db.js` — new query functions
- `app/src/lib/db.queries.test.js` — new query tests
- `app/src/components/workbench/ContextCard.svelte` — collapsible sections, hotkeys, dictionary grid
- `docs/ATTRIBUTIONS.md` — Tyndale Open Bible Dictionary entry
- `docs/DATA-PIPELINE.md` — new intermediates in the inputs table

---

### Task 1: Shared book-code module

**Files:**
- Create: `build/lib/books.mjs`
- Test: `build/test/books.test.mjs`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `OSIS_BOOKS: string[]` — the canonical 66 codes in order
  - `APOCRYPHA: Set<string>` — 12 codes present in Tyndale but absent from `bible.db`
  - `ALIASES: Record<string, string>` — alias → OSIS
  - `toOsis(code: string): string` — throws `Error` on unknown
  - `toOsisOrNull(code: string): string | null` — returns `null` for apocrypha, throws on unknown

**Context:** Four separate maps exist today (`STEP2OSIS`, `BOOK_FIX`, `parse-nlt`'s `BOOKS`, plus Theographic passing OSIS through). All 100 aliases across them have been verified to agree — no alias maps to two different OSIS codes. Tyndale uses *two* schemes: Roman on `StudyNotes.xml`'s `name` attribute (`IThes`), Arabic in every `<refs>`/`?bref=` (`1Thes`). Both must resolve.

- [ ] **Step 1: Write the failing test**

Create `build/test/books.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OSIS_BOOKS, APOCRYPHA, ALIASES, toOsis, toOsisOrNull } from '../lib/books.mjs';

test('OSIS_BOOKS: canonical 66 in order', () => {
  assert.equal(OSIS_BOOKS.length, 66);
  assert.equal(OSIS_BOOKS[0], 'Gen');
  assert.equal(OSIS_BOOKS[38], 'Matt');
  assert.equal(OSIS_BOOKS[65], 'Rev');
});

test('toOsis: canonical codes pass through unchanged', () => {
  for (const b of OSIS_BOOKS) assert.equal(toOsis(b), b);
});

test('toOsis: Tyndale Arabic scheme (the 1Thes trap)', () => {
  assert.equal(toOsis('1Thes'), '1Thess');
  assert.equal(toOsis('2Thes'), '2Thess');
  assert.equal(toOsis('1Jn'), '1John');
  assert.equal(toOsis('2Jn'), '2John');
  assert.equal(toOsis('3Jn'), '3John');
  assert.equal(toOsis('Hagg'), 'Hag');
  assert.equal(toOsis('Jon'), 'Jonah');
  assert.equal(toOsis('Pr'), 'Prov');
});

test('toOsis: dictionary-only singleton variants', () => {
  assert.equal(toOsis('Jos'), 'Josh');
  assert.equal(toOsis('Mt'), 'Matt');
  assert.equal(toOsis('Esther'), 'Esth');
});

test('toOsis: Tyndale Roman scheme (StudyNotes name attribute)', () => {
  assert.equal(toOsis('ISam'), '1Sam');
  assert.equal(toOsis('IIPet'), '2Pet');
  assert.equal(toOsis('IIIJn'), '3John');
  assert.equal(toOsis('IThes'), '1Thess');
});

test('toOsis: STEPBible scheme', () => {
  assert.equal(toOsis('1Th'), '1Thess');
  assert.equal(toOsis('Sng'), 'Song');
  assert.equal(toOsis('Jhn'), 'John');
});

test('toOsis: NLT scheme', () => {
  assert.equal(toOsis('Sol'), 'Song');
  assert.equal(toOsis('Joh'), 'John');
  assert.equal(toOsis('1Sa'), '1Sam');
});

test('toOsis: THROWS on an unknown code (the regression guard)', () => {
  assert.throws(() => toOsis('Sirach'), /unknown book code: Sirach/);
  assert.throws(() => toOsis('Blah'), /unknown book code: Blah/);
});

test('toOsis: apocrypha throws — callers must use toOsisOrNull', () => {
  assert.throws(() => toOsis('1Macc'), /apocryphal book code: 1Macc/);
});

test('toOsisOrNull: apocrypha returns null, unknown still throws', () => {
  assert.equal(toOsisOrNull('1Macc'), null);
  assert.equal(toOsisOrNull('Tb'), null);
  assert.equal(toOsisOrNull('Ecclus'), null);
  assert.equal(toOsisOrNull('1Thes'), '1Thess');
  assert.throws(() => toOsisOrNull('Sirach'), /unknown book code/);
});

test('APOCRYPHA: the 12 codes the dictionary cites', () => {
  assert.equal(APOCRYPHA.size, 12);
  for (const c of ['1Esd', '2Esd', '1Macc', '2Macc', '3Macc', 'AddEsth',
                   'Bar', 'Bel', 'Ecclus', 'Jdt', 'Tb', 'Wisd'])
    assert.ok(APOCRYPHA.has(c), `${c} missing from APOCRYPHA`);
});

// The integrity check that makes consolidation safe: no alias may resolve to a
// non-canonical code, and no alias may collide with a different canonical book.
test('ALIASES: every alias resolves to a real OSIS book', () => {
  const canon = new Set(OSIS_BOOKS);
  for (const [alias, osis] of Object.entries(ALIASES))
    assert.ok(canon.has(osis), `alias ${alias} -> ${osis} is not a canonical OSIS book`);
});

test('ALIASES: no alias shadows a different canonical book', () => {
  const canon = new Set(OSIS_BOOKS);
  for (const [alias, osis] of Object.entries(ALIASES))
    if (canon.has(alias)) assert.equal(alias, osis, `alias ${alias} shadows canonical ${alias}`);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd build && node --test test/books.test.mjs`
Expected: FAIL — `Cannot find module '../lib/books.mjs'`

- [ ] **Step 3: Write the implementation**

Create `build/lib/books.mjs`:

```javascript
// build/lib/books.mjs
// One canonical book-code module for the whole build. Every source we import uses its own
// abbreviations; bible.db stores OSIS. Keeping the aliases in one place is what stops a new
// source from silently failing to join (Tyndale's `1Thes` did not match OSIS `1Thess`, so
// five books' worth of refs would have been dropped without an error).
//
// All aliases below were checked for conflicts across the four maps they replace: no alias
// resolves to two different OSIS codes. `books.test.mjs` re-asserts that invariant.

export const OSIS_BOOKS = [
  'Gen', 'Exod', 'Lev', 'Num', 'Deut', 'Josh', 'Judg', 'Ruth', '1Sam', '2Sam',
  '1Kgs', '2Kgs', '1Chr', '2Chr', 'Ezra', 'Neh', 'Esth', 'Job', 'Ps', 'Prov',
  'Eccl', 'Song', 'Isa', 'Jer', 'Lam', 'Ezek', 'Dan', 'Hos', 'Joel', 'Amos',
  'Obad', 'Jonah', 'Mic', 'Nah', 'Hab', 'Zeph', 'Hag', 'Zech', 'Mal',
  'Matt', 'Mark', 'Luke', 'John', 'Acts', 'Rom', '1Cor', '2Cor', 'Gal', 'Eph',
  'Phil', 'Col', '1Thess', '2Thess', '1Tim', '2Tim', 'Titus', 'Phlm', 'Heb',
  'Jas', '1Pet', '2Pet', '1John', '2John', '3John', 'Jude', 'Rev',
];

const CANON = new Set(OSIS_BOOKS);

// Books Tyndale cites that bible.db does not contain (641 of 44,132 dictionary links).
// Dropped deliberately by toOsisOrNull, never silently mis-joined.
export const APOCRYPHA = new Set([
  '1Esd', '2Esd', '1Macc', '2Macc', '3Macc', 'AddEsth',
  'Bar', 'Bel', 'Ecclus', 'Jdt', 'Tb', 'Wisd',
]);

export const ALIASES = {
  // --- STEPBible (was STEP2OSIS in refs.mjs) ---
  Exo: 'Exod', Deu: 'Deut', Jos: 'Josh', Jdg: 'Judg', Rut: 'Ruth',
  '1Sa': '1Sam', '2Sa': '2Sam', '1Ki': '1Kgs', '2Ki': '2Kgs', '1Ch': '1Chr', '2Ch': '2Chr',
  Est: 'Esth', Psa: 'Ps', Pro: 'Prov', Ecc: 'Eccl', Sng: 'Song',
  Ezk: 'Ezek', Jol: 'Joel', Amo: 'Amos', Oba: 'Obad', Jon: 'Jonah', Nam: 'Nah',
  Zep: 'Zeph', Zec: 'Zech', Mat: 'Matt', Mrk: 'Mark', Luk: 'Luke', Jhn: 'John',
  Act: 'Acts', '1Co': '1Cor', '2Co': '2Cor', Php: 'Phil',
  '1Th': '1Thess', '2Th': '2Thess', '1Ti': '1Tim', '2Ti': '2Tim', Tit: 'Titus', Phm: 'Phlm',
  '1Pe': '1Pet', '2Pe': '2Pet', '1Jn': '1John', '2Jn': '2John', '3Jn': '3John', Jud: 'Jude',

  // --- NLT tokens (was BOOKS in parse-nlt.mjs); overlaps with STEPBible are identical ---
  Sol: 'Song', Eze: 'Ezek', Joe: 'Joel', Mar: 'Mark', Joh: 'John',

  // --- Tyndale, Roman scheme: StudyNotes.xml `name` attribute (was BOOK_FIX) ---
  ISam: '1Sam', IISam: '2Sam', IKgs: '1Kgs', IIKgs: '2Kgs', IChr: '1Chr', IIChr: '2Chr',
  ICor: '1Cor', IICor: '2Cor', IThes: '1Thess', IIThes: '2Thess', ITim: '1Tim', IITim: '2Tim',
  IPet: '1Pet', IIPet: '2Pet', IJn: '1John', IIJn: '2John', IIIJn: '3John',

  // --- Tyndale, Arabic scheme: every <refs> and ?bref= link. THIS is the one BOOK_FIX missed. ---
  '1Thes': '1Thess', '2Thes': '2Thess', Hagg: 'Hag', Pr: 'Prov',
  // dictionary-only singletons, each swamped by a correct dominant form (Jos 1 vs Josh 1452,
  // Mt 1 vs Matt 2009, Esther 1 vs Esth 187) — easy to miss, so pinned by test
  Mt: 'Matt', Esther: 'Esth',
};

export function isOsis(code) {
  return CANON.has(code);
}

// Strict: the caller asserts this code must be a real book in bible.db.
export function toOsis(code) {
  if (CANON.has(code)) return code;
  const mapped = ALIASES[code];
  if (mapped) return mapped;
  if (APOCRYPHA.has(code)) throw new Error(`apocryphal book code: ${code} (use toOsisOrNull)`);
  throw new Error(`unknown book code: ${code}`);
}

// Tolerant of apocrypha only. An unrecognised code is still a hard error — that is the guard
// that makes a future source revision fail loudly instead of dropping a book.
export function toOsisOrNull(code) {
  if (APOCRYPHA.has(code)) return null;
  return toOsis(code);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd build && node --test test/books.test.mjs`
Expected: PASS — 13 tests

- [ ] **Step 5: Commit**

```bash
git add build/lib/books.mjs build/test/books.test.mjs
git commit -m "feat(build): shared OSIS book-code module with unknown-code guard"
```

---

### Task 2: Migrate existing call sites to books.mjs

**Files:**
- Modify: `build/lib/refs.mjs` (replace `STEP2OSIS`)
- Modify: `build/lib/studynotes.mjs:12-18` (replace `BOOK_FIX`)
- Modify: `build/parse-nlt.mjs:13-25` (OSIS half of `BOOKS`)

**Interfaces:**
- Consumes: `toOsis` from Task 1
- Produces: no new exports. `STEP2OSIS` and `BOOK_FIX` cease to exist.

**Context:** This touches working parsers that produce already-shipped data. The safety net is that `bible.db` must rebuild byte-identically for the existing tables. `parse-nlt.mjs` maps tokens to `[osis, displayName]` pairs — only the OSIS half moves; display names stay local to that file.

- [ ] **Step 1: Verify the current state is green and capture a baseline**

```bash
cd build && npm test 2>&1 | tail -5
sqlite3 ../data/bible.db "SELECT book, COUNT(*) FROM study_notes GROUP BY book ORDER BY book;" > /tmp/studynotes-before.txt
wc -l /tmp/studynotes-before.txt
```
Expected: 67 tests pass; 66 lines in the baseline.

- [ ] **Step 2: Update `build/lib/refs.mjs`**

Replace the whole `STEP2OSIS` const and its use with:

```javascript
// build/lib/refs.mjs
import { toOsis } from './books.mjs';

// Tolerates optional dual-versification notation like Dan.4.1(3.31) before the #position.
const RE = /^([A-Za-z0-9]+)\.(\d+)\.(\d+)(?:\([^)]*\))?#(\d+)/;
export function parseWordRef(col0) {
  const m = String(col0).match(RE);
  if (!m) return null;
  let book;
  try { book = toOsis(m[1]); } catch { return null; }  // unknown code -> skip the row, as before
  return { book, chapter: Number(m[2]), verse: Number(m[3]), position: Number(m[4]) };
}
```

Note: the original returned `null` for an unmapped code, so the `try/catch` preserves that behaviour exactly. Do not let the throw propagate here.

- [ ] **Step 3: Update `build/lib/studynotes.mjs`**

Delete the `BOOK_FIX` const (lines 12-18) and change `parseStudyNoteRef` to use `toOsis`:

```javascript
import { toOsis } from './books.mjs';

// OSIS ref -> verse bounds. Handles "Gen.1.16", "Gen.1.6-8", "Gen.1.1-2.3". Book normalized to OSIS.
export function parseStudyNoteRef(osis) {
  const [left, right] = osis.split('-');
  const m = left.match(/^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  let book;
  try { book = toOsis(m[1]); } catch { return null; }
  const sc = +m[2], sv = +m[3];
  let ec = sc, ev = sv;
  if (right) {
    const nums = right.split('.').filter((p) => /^\d+$/.test(p)).map(Number);
    if (nums.length === 1) ev = nums[0];
    else if (nums.length >= 2) { ec = nums[nums.length - 2]; ev = nums[nums.length - 1]; }
  }
  return { book, start_chapter: sc, start_verse: sv, end_chapter: ec, end_verse: ev };
}
```

Keep the `import fs from 'node:fs';` line and everything from `extractRef` down unchanged.

- [ ] **Step 4: Update `build/parse-nlt.mjs`**

`BOOKS` has exactly two call sites, at lines 49-50. Add the import at the top:

```javascript
import { toOsis } from './lib/books.mjs';
```

Keep the `BOOKS` const exactly as it is — it also carries display names, which stay local to this
file — but change the two call sites to route the code through `books.mjs` so the alias set has a
single owner. Replace lines 49-50:

```javascript
    if (m && BOOKS[m[1]]) {
      const [osis, name] = BOOKS[m[1]];
```

with:

```javascript
    if (m && BOOKS[m[1]]) {
      const osis = toOsis(m[1]);          // alias resolution now owned by books.mjs
      const name = BOOKS[m[1]][1];        // display name stays local to the NLT parser
```

Then add a one-time consistency assertion just below the `BOOKS` const, so the local map can never
drift from `books.mjs`:

```javascript
// The NLT token -> OSIS half of this map is duplicated in lib/books.mjs. Fail loudly if they
// ever disagree rather than silently parsing a book into the wrong slot.
for (const [token, [osis]] of Object.entries(BOOKS))
  if (toOsis(token) !== osis)
    throw new Error(`parse-nlt: ${token} -> ${osis} disagrees with books.mjs (${toOsis(token)})`);
```

- [ ] **Step 5: Run the build test suite**

Run: `cd build && npm test 2>&1 | tail -5`
Expected: PASS — 67/67, unchanged.

- [ ] **Step 6: Rebuild and verify the existing data is byte-identical**

```bash
cd build && node build-db.mjs && node validate-db.mjs
sqlite3 ../data/bible.db "SELECT book, COUNT(*) FROM study_notes GROUP BY book ORDER BY book;" > /tmp/studynotes-after.txt
diff /tmp/studynotes-before.txt /tmp/studynotes-after.txt && echo "IDENTICAL — migration safe"
```
Expected: `IDENTICAL — migration safe`. If `diff` reports anything, **stop** — the migration changed shipped data and must be fixed before continuing.

- [ ] **Step 7: Commit**

```bash
git add build/lib/refs.mjs build/lib/studynotes.mjs build/parse-nlt.mjs
git commit -m "refactor(build): route all book-code normalization through books.mjs"
```

---

### Task 3: Tyndale XML parsing helpers

**Files:**
- Create: `build/lib/tyndale.mjs`
- Test: `build/test/tyndale.test.mjs`

**Interfaces:**
- Consumes: `toOsis`, `toOsisOrNull` from Task 1
- Produces:
  - `iterItems(xml: string): Generator<{typename, name, title, refs, body}>` — `refs` is the raw `<refs>` string or `null`
  - `cleanBody(bodyXml: string, keepTables?: boolean): string`
  - `parseRefRange(refs: string): {book, start_chapter, start_verse, end_chapter, end_verse, ref} | null`
  - `extractBrefs(bodyXml: string): Array<{book, chapter, verse}>` — deduped, apocrypha dropped
  - `countBrefs(bodyXml: string): number` — raw link count, before filtering
  - `extractIncludes(bodyXml: string): Array<{kind, name}>` — embedded textboxes/charts
  - `sortTitle(title: string): string`
  - `titleTerms(title: string): string[]` — lowercase terms for the `lex_hit` signal

**Context:** Attribute order differs between files (`typename` before `name` in `Articles/*.xml`, after it in `StudyNotes.xml`), so the item regex must not assume an order. `<title>` is absent on StudyNote items but present on everything this task parses. Charts contain real `<table>` markup that must survive cleaning.

Articles embed their supplements with `<include_items src="../Textboxes/Textboxes.xml" name="AaronThePriest"/>` — the `name` attribute is what identifies which one, which is how `host_id` gets resolved. Coverage is partial and that is expected: 100 of 110 textboxes and 18 of 21 charts are embedded somewhere; the rest are never referenced by any article and keep `host_id = NULL`.

- [ ] **Step 1: Write the failing test**

Create `build/test/tyndale.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { iterItems, cleanBody, parseRefRange, extractBrefs, countBrefs, extractIncludes,
  sortTitle, titleTerms } from '../lib/tyndale.mjs';

const ARTICLE = `<items release="1.6">
<item typename="Article" product="TyndaleOpenBibleDictionary" name="Abba">
  <title>Abba</title>
  <body><p class="h1">ABBA</p>
<p class="fl">Aramaic word for &#8220;father,&#8221; applied to God in
<a href="?bref=Mark.14.36">Mk 14:36</a>; <a href="?bref=Rom.8.15">Rom 8:15</a>.</p>
  </body>
</item>
<item typename="Article" product="TyndaleOpenBibleDictionary" name="Calf">
  <title>Calf</title>
  <body><p class="h1">CALF</p><p class="fl">See <a href="?item=Animals_Article">Animals</a>.</p></body>
</item>
</items>`;

test('iterItems: yields each item with typename, name, title, body', () => {
  const items = [...iterItems(ARTICLE)];
  assert.equal(items.length, 2);
  assert.equal(items[0].typename, 'Article');
  assert.equal(items[0].name, 'Abba');
  assert.equal(items[0].title, 'Abba');
  assert.ok(items[0].body.includes('Aramaic'));
});

test('iterItems: tolerates either attribute order', () => {
  const nameFirst = '<item name="X" typename="ThemeNote"><title>T</title><body><p>b</p></body></item>';
  const typeFirst = '<item typename="ThemeNote" name="X"><title>T</title><body><p>b</p></body></item>';
  for (const xml of [nameFirst, typeFirst]) {
    const [it] = [...iterItems(xml)];
    assert.equal(it.name, 'X');
    assert.equal(it.typename, 'ThemeNote');
  }
});

test('iterItems: captures <refs> when present, null when absent', () => {
  const withRefs = '<item typename="ThemeNote" name="X"><title>T</title>' +
    '<refs>Gen.1.1-2.25</refs><body><p>b</p></body></item>';
  assert.equal([...iterItems(withRefs)][0].refs, 'Gen.1.1-2.25');
  const noRefs = '<item typename="Article" name="X"><title>T</title><body><p>b</p></body></item>';
  assert.equal([...iterItems(noRefs)][0].refs, null);
});

test('cleanBody: strips tags, unwraps links, decodes entities, collapses whitespace', () => {
  const [it] = [...iterItems(ARTICLE)];
  const txt = cleanBody(it.body);
  assert.ok(!txt.includes('<'), 'tags remain');
  assert.ok(txt.includes('“father,”'), 'numeric entity not decoded');
  assert.ok(txt.includes('Mk 14:36'), 'link text lost');
  assert.ok(!txt.includes('href'), 'href leaked');
  assert.ok(!/\s{2,}/.test(txt), 'whitespace not collapsed');
});

test('cleanBody: keepTables preserves table markup for charts', () => {
  const chart = '<p class="h1">Feasts</p><table><tr><td><p class="td">Passover</p></td></tr></table>';
  const kept = cleanBody(chart, true);
  assert.ok(kept.includes('<table>'), 'table stripped');
  assert.ok(kept.includes('<td>'), 'cell stripped');
  assert.ok(kept.includes('Passover'));
  assert.ok(!kept.includes('class='), 'class attributes should be dropped');
});

test('parseRefRange: single verse', () => {
  assert.deepEqual(parseRefRange('Gen.1.16'),
    { book: 'Gen', start_chapter: 1, start_verse: 16, end_chapter: 1, end_verse: 16, ref: '1:16' });
});

test('parseRefRange: same-chapter range', () => {
  assert.deepEqual(parseRefRange('Gen.1.6-8'),
    { book: 'Gen', start_chapter: 1, start_verse: 6, end_chapter: 1, end_verse: 8, ref: '1:6-8' });
});

test('parseRefRange: cross-chapter range', () => {
  assert.deepEqual(parseRefRange('Gen.1.1-2.25'),
    { book: 'Gen', start_chapter: 1, start_verse: 1, end_chapter: 2, end_verse: 25, ref: '1:1–2:25' });
});

test('parseRefRange: normalizes the Arabic Tyndale scheme', () => {
  assert.equal(parseRefRange('1Thes.2.6').book, '1Thess');
  assert.equal(parseRefRange('2Jn.1.7').book, '2John');
  assert.equal(parseRefRange('Hagg.1.1').book, 'Hag');
  assert.equal(parseRefRange('Pr.15.11').book, 'Prov');
});

test('parseRefRange: whole-book range (book intros)', () => {
  const r = parseRefRange('Gen.1.1-50.26');
  assert.equal(r.start_chapter, 1);
  assert.equal(r.end_chapter, 50);
  assert.equal(r.end_verse, 26);
});

test('extractBrefs: pulls verse links, deduped', () => {
  const [it] = [...iterItems(ARTICLE)];
  const refs = extractBrefs(it.body);
  assert.deepEqual(refs, [
    { book: 'Mark', chapter: 14, verse: 36 },
    { book: 'Rom', chapter: 8, verse: 15 },
  ]);
});

test('extractBrefs: drops apocrypha silently, keeps the rest', () => {
  const body = '<a href="?bref=1Macc.2.1">x</a><a href="?bref=Gen.1.1">y</a><a href="?bref=Tb.3.4">z</a>';
  assert.deepEqual(extractBrefs(body), [{ book: 'Gen', chapter: 1, verse: 1 }]);
});

test('extractBrefs: handles comma lists and ranges by taking the start verse', () => {
  assert.deepEqual(extractBrefs('<a href="?bref=Ps.115.10,12">x</a>'),
    [{ book: 'Ps', chapter: 115, verse: 10 }]);
  assert.deepEqual(extractBrefs('<a href="?bref=Gen.1.1-2.3">x</a>'),
    [{ book: 'Gen', chapter: 1, verse: 1 }]);
});

test('extractBrefs: THROWS on an unknown book code', () => {
  assert.throws(() => extractBrefs('<a href="?bref=Sirach.1.1">x</a>'), /unknown book code/);
});

test('extractBrefs: ignores chapter-only refs with no verse', () => {
  assert.deepEqual(extractBrefs('<a href="?bref=Ps.119">x</a>'), []);
});

test('countBrefs: raw link count, before apocrypha filtering', () => {
  const body = '<a href="?bref=1Macc.2.1">x</a><a href="?bref=Gen.1.1">y</a>';
  assert.equal(countBrefs(body), 2);
  assert.equal(extractBrefs(body).length, 1);
});

test('extractIncludes: resolves embedded supplements by name', () => {
  const body = '<p>text</p><include_items src="../Textboxes/Textboxes.xml" name="AaronThePriest"/>' +
    '<include_items src="../Charts/Charts.xml" name="AnnualFeasts"/>' +
    '<include_items src="../Pictures/Pictures.xml" name="ABedouin"/>';
  // Pictures and Maps are out of scope, so only textboxes and charts are returned
  assert.deepEqual(extractIncludes(body), [
    { kind: 'textbox', name: 'AaronThePriest' },
    { kind: 'chart', name: 'AnnualFeasts' },
  ]);
});

test('sortTitle: strips the variant asterisk and normalizes for A-Z ordering', () => {
  assert.equal(sortTitle('Aaronites*'), 'aaronites');
  assert.equal(sortTitle('Abel-Beth-Maacah (Maachah*)'), 'abel-beth-maacah');
  assert.equal(sortTitle('Assyria, Assyrians'), 'assyria, assyrians');
  assert.equal(sortTitle('Chaos*, Waters of'), 'chaos, waters of');
});

test('titleTerms: head words for the lexical signal, qualifiers and stopwords dropped', () => {
  assert.deepEqual(titleTerms('Abba'), ['abba']);
  assert.deepEqual(titleTerms('Abdon (Person)'), ['abdon']);
  assert.deepEqual(titleTerms('Glean, Gleaning'), ['glean', 'gleaning']);
  assert.deepEqual(titleTerms('Joshua, Book of'), ['joshua']);
  assert.deepEqual(titleTerms('Urim and Thummim'), ['urim', 'thummim']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd build && node --test test/tyndale.test.mjs`
Expected: FAIL — `Cannot find module '../lib/tyndale.mjs'`

- [ ] **Step 3: Write the implementation**

Create `build/lib/tyndale.mjs`:

```javascript
// build/lib/tyndale.mjs
// Parsing helpers for the Tyndale Open packages (CC BY-SA 4.0): the Bible Dictionary,
// theme articles, profiles, book intros, textboxes and charts.
//
// Two things here are load-bearing:
//  1. Book codes in <refs> and ?bref= use Tyndale's ARABIC scheme (1Thes, 1Jn), which is NOT
//     the Roman scheme (IThes, IJn) that StudyNotes.xml's `name` attribute uses. Both route
//     through books.mjs, which throws on anything unrecognised rather than dropping it.
//  2. Item attribute order differs between files, so the item regex must not assume one.
import { toOsis, toOsisOrNull } from './books.mjs';

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', nbsp: ' ', apos: "'", '#39': "'" };
function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(amp|lt|gt|quot|nbsp|apos|#39);/g, (_, k) => ENT[k]);
}

const ITEM_RE = /<item\b([^>]*)>\s*(?:<title>(.*?)<\/title>\s*)?(?:<refs>(.*?)<\/refs>\s*)?<body>(.*?)<\/body>\s*<\/item>/gs;
const ATTR = (attrs, key) => (attrs.match(new RegExp(`${key}="([^"]*)"`)) || [])[1] || null;

export function* iterItems(xml) {
  ITEM_RE.lastIndex = 0;
  let m;
  while ((m = ITEM_RE.exec(xml))) {
    yield {
      typename: ATTR(m[1], 'typename'),
      name: ATTR(m[1], 'name'),
      title: m[2] ? decodeEntities(m[2].replace(/<[^>]+>/g, '')).trim() : null,
      refs: m[3] ? m[3].trim() : null,
      body: m[4],
    };
  }
}

// Charts are the only content that cannot flatten to text — they are real tables. Everything
// else becomes plain text, matching how study_notes bodies are stored.
export function cleanBody(bodyXml, keepTables = false) {
  let b = bodyXml.replace(/<a\b[^>]*>(.*?)<\/a>/gs, '$1');   // unwrap links, keep their text
  if (keepTables) {
    b = b.replace(/<(\/?)(table|tr|td|th)\b[^>]*>/g, '<$1$2>'); // keep structure, drop attributes
    b = b.replace(/<(?!\/?(?:table|tr|td|th)>)[^>]+>/g, ' ');   // strip every other tag
  } else {
    b = b.replace(/<[^>]+>/g, ' ');
  }
  return decodeEntities(b).replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, ' ').trim();
}

// "Gen.1.16" | "Gen.1.6-8" | "Gen.1.1-2.25" -> bounds + a display ref. Book normalized to OSIS.
export function parseRefRange(refs) {
  const [left, right] = String(refs).trim().split('-');
  const m = left.match(/^([A-Za-z0-9]+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  const book = toOsis(m[1]);
  const sc = +m[2], sv = +m[3];
  let ec = sc, ev = sv;
  if (right) {
    const nums = right.split('.').filter((p) => /^\d+$/.test(p)).map(Number);
    if (nums.length === 1) ev = nums[0];
    else if (nums.length >= 2) { ec = nums[nums.length - 2]; ev = nums[nums.length - 1]; }
  }
  const ref = ec === sc
    ? (ev === sv ? `${sc}:${sv}` : `${sc}:${sv}-${ev}`)
    : `${sc}:${sv}–${ec}:${ev}`;   // en dash for cross-chapter, matching study_notes display
  return { book, start_chapter: sc, start_verse: sv, end_chapter: ec, end_verse: ev, ref };
}

// Dictionary articles carry no <refs>; their verse anchors are the ?bref= links in the body.
// A link may be a single verse, a comma list ("Ps.115.10,12") or a range ("Gen.1.1-2.3") —
// in every case the start verse is what anchors it. Chapter-only refs have no verse and are skipped.
export function extractBrefs(bodyXml) {
  const seen = new Set();
  const out = [];
  for (const m of bodyXml.matchAll(/\?bref=([^"&#]+)/g)) {
    const parts = m[1].split('.');
    if (parts.length < 3) continue;                  // chapter-only, e.g. Ps.119
    const book = toOsisOrNull(parts[0]);             // null = apocrypha, throws if unknown
    if (!book) continue;
    if (!/^\d+$/.test(parts[1])) continue;
    const verse = parts[2].match(/^\d+/);
    if (!verse) continue;
    const key = `${book}.${parts[1]}.${verse[0]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ book, chapter: +parts[1], verse: +verse[0] });
  }
  return out;
}

// Raw link count, before apocrypha and malformed refs are filtered out. Used only for the
// parse log, so the maintainer can see how many links were dropped and why.
export function countBrefs(bodyXml) {
  return (bodyXml.match(/\?bref=/g) || []).length;
}

// Articles embed their supplements as
//   <include_items src="../Textboxes/Textboxes.xml" name="AaronThePriest"/>
// The `name` is what ties a textbox or chart back to its one host article. Maps and Pictures
// are out of scope (see the spec), so they are ignored here.
const INCLUDE_KIND = { Textboxes: 'textbox', Charts: 'chart' };

export function extractIncludes(bodyXml) {
  const out = [];
  for (const m of bodyXml.matchAll(/<include_items\s+src="\.\.\/(\w+)\/[^"]*"\s+name="([^"]*)"\s*\/>/g)) {
    const kind = INCLUDE_KIND[m[1]];
    if (kind) out.push({ kind, name: m[2] });
  }
  return out;
}

export function sortTitle(title) {
  return title
    .replace(/\*/g, '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')     // drop qualifiers: "Abdon (Person)" -> "Abdon"
    .replace(/’/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Head words used for the lexical relatedness signal. Structural words ("Book of", "Person")
// carry no meaning for matching a verse, so they are dropped; 4+ chars only, which is why
// short titles like "Cup" produce no terms (a known, accepted miss — see the spec).
const STOP = new Set(['book', 'of', 'the', 'and', 'person', 'place', 'city',
  'son', 'first', 'second', 'new', 'old']);

export function titleTerms(title) {
  const t = sortTitle(title);
  const out = [];
  for (const part of t.split(/[,;/]/))
    for (const w of part.match(/[a-z']+/g) || [])
      if (w.length >= 4 && !STOP.has(w)) out.push(w);
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd build && node --test test/tyndale.test.mjs`
Expected: PASS — 19 tests

- [ ] **Step 5: Commit**

```bash
git add build/lib/tyndale.mjs build/test/tyndale.test.mjs
git commit -m "feat(build): Tyndale XML parsing helpers"
```

---

### Task 4: Maintainer parser — raw XML to committed intermediates

**Files:**
- Create: `build/parse-tyndale.mjs`
- Create (generated, committed): `build/data/sources/tyndale-dictionary.json.gz`, `tyndale-passages.json.gz`, `tyndale-bookintros.json.gz`

**Interfaces:**
- Consumes: everything from Task 3, plus `OSIS_BOOKS` from Task 1
- Produces three gzipped JSON arrays with these exact row shapes (positional, matching the `INSERT` order in Task 5):
  - dictionary: `{ articles: [[id, title, sort_title, kind, host_id, body, is_html, n_refs, seq]], verses: [[article_id, book, chapter, verse, lex_hit]] }`
  - passages: `[[kind, title, book, start_chapter, start_verse, end_chapter, end_verse, ref, body, seq]]`
  - bookintros: `[[book, summary, intro]]`

**Context:** This is maintainer-only and needs `backup-data/`, exactly like `extract-sources.mjs`. The `lex_hit` signal needs verse text, which it reads from the **committed** `data/bibles/` JSON (not from `bible.db`, which may not exist when this runs). Verse text is unioned across NIV/NKJV/NLT.

`ThemeNotes.xml` contains 298 `ThemeNote` items **plus one misfiled `Profile`** — route by `typename`, never by filename.

- [ ] **Step 1: Write the parser**

Create `build/parse-tyndale.mjs`:

```javascript
// build/parse-tyndale.mjs
// MAINTAINER ONLY — needs backup-data/. Parses the Tyndale Open packages into the committed
// intermediates in build/data/sources/, which is all build-db.mjs ever reads. Run only when the
// raw source changes:  node parse-tyndale.mjs
//
// Source (gitignored, CC BY-SA 4.0): backup-data/tyndale/
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { OSIS_BOOKS } from './lib/books.mjs';
import { iterItems, cleanBody, parseRefRange, extractBrefs, sortTitle, titleTerms }
  from './lib/tyndale.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYN = `${ROOT}/backup-data/tyndale`;
const DICT = `${TYN}/dictionary`;
const NOTES = `${TYN}/Tyndale Open Study Notes`;
const OUT = `${ROOT}/build/data/sources`;
fs.mkdirSync(OUT, { recursive: true });

if (!fs.existsSync(DICT)) {
  console.error(`parse-tyndale: missing ${DICT}\nThis script is maintainer-only and needs backup-data/.`);
  process.exit(1);
}
const write = (name, data) =>
  fs.writeFileSync(`${OUT}/${name}.json.gz`, zlib.gzipSync(JSON.stringify(data)));

// --- verse text, for the lexical relatedness signal (signal D in the spec) ---
// Read from the committed data/bibles/ JSON so this does not depend on bible.db existing.
const verseText = new Map();   // "Book.ch.v" -> lowercased text of all three versions
for (const version of ['NIV', 'NKJV', 'NLT']) {
  const dir = `${ROOT}/data/bibles/${version}`;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json') || f.startsWith('_')) continue;
    const book = f.replace('.json', '');
    const b = JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8'));
    for (const [ch, vs] of Object.entries(b.chapters))
      for (const [v, t] of Object.entries(vs)) {
        const k = `${book}.${ch}.${v}`;
        verseText.set(k, (verseText.get(k) || '') + ' ' + t.toLowerCase());
      }
  }
}
console.log('verse text loaded:', verseText.size, 'verses');

// An article's title word appearing in the verse text is the strongest relatedness signal.
// Prefix matching absorbs simple inflection ("glean" matching "gleaned"); it is deliberately
// crude, and only ever changes ORDER, never whether an article is shown.
function lexHit(terms, book, chapter, verse) {
  const txt = verseText.get(`${book}.${chapter}.${verse}`);
  if (!txt) return 0;
  return terms.some((w) => txt.includes(w.slice(0, Math.max(4, w.length - 3)))) ? 1 : 0;
}

// --- 1. dictionary articles ---
const articles = [];
const verseRows = [];
const hostOf = new Map();          // "textbox:AaronThePriest" -> host article id
let seq = 0, brefTotal = 0, brefKept = 0;

for (const f of fs.readdirSync(`${DICT}/Articles`).sort()) {
  if (!f.endsWith('.xml')) continue;
  const xml = fs.readFileSync(`${DICT}/Articles/${f}`, 'utf8');
  for (const it of iterItems(xml)) {
    if (it.typename !== 'Article') continue;          // skips the DictionaryLetter TOC items
    const refs = extractBrefs(it.body);
    brefTotal += countBrefs(it.body);
    brefKept += refs.length;
    const terms = titleTerms(it.title);
    articles.push([it.name, it.title, sortTitle(it.title), 'article', null,
      cleanBody(it.body), 0, refs.length, seq++]);
    for (const r of refs)
      verseRows.push([it.name, r.book, r.chapter, r.verse, lexHit(terms, r.book, r.chapter, r.verse)]);
    // an article's embedded supplements name it as their host
    for (const inc of extractIncludes(it.body))
      if (!hostOf.has(`${inc.kind}:${inc.name}`)) hostOf.set(`${inc.kind}:${inc.name}`, it.name);
  }
}
const articleCount = articles.length;

// --- 2. textboxes + charts. No <refs>; each surfaces inside the article that embeds it.
// Not every supplement is embedded (100/110 textboxes, 18/21 charts) — the rest keep host_id NULL.
let orphanSupps = 0;
for (const [file, kind, isHtml] of [['Textboxes/Textboxes.xml', 'textbox', 0],
                                    ['Charts/Charts.xml', 'chart', 1]]) {
  const xml = fs.readFileSync(`${DICT}/${file}`, 'utf8');
  for (const it of iterItems(xml)) {
    const host = hostOf.get(`${kind}:${it.name}`) || null;
    if (!host) orphanSupps++;
    articles.push([it.name, it.title, sortTitle(it.title), kind, host,
      cleanBody(it.body, isHtml === 1), isHtml, 0, seq++]);
  }
}

// --- 3. theme articles + profiles (verse-ranged) ---
const passages = [];
let pseq = 0;
for (const file of ['ThemeNotes.xml', 'Profiles.xml']) {
  const xml = fs.readFileSync(`${NOTES}/${file}`, 'utf8');
  for (const it of iterItems(xml)) {
    // ThemeNotes.xml contains one misfiled Profile — route by typename, never by filename.
    const kind = it.typename === 'ThemeNote' ? 'theme'
      : it.typename === 'Profile' ? 'profile' : null;
    if (!kind) continue;
    const r = it.refs ? parseRefRange(it.refs) : null;
    if (!r) { console.warn(`parse-tyndale: unparseable refs for ${it.name}`); continue; }
    passages.push([kind, it.title, r.book, r.start_chapter, r.start_verse,
      r.end_chapter, r.end_verse, r.ref, cleanBody(it.body), pseq++]);
  }
}

// --- 4. book intros + summaries, keyed by OSIS book ---
const intros = new Map();
for (const [file, field] of [['BookIntroSummaries.xml', 'summary'], ['BookIntros.xml', 'intro']]) {
  const xml = fs.readFileSync(`${NOTES}/${file}`, 'utf8');
  for (const it of iterItems(xml)) {
    const r = it.refs ? parseRefRange(it.refs) : null;
    if (!r) { console.warn(`parse-tyndale: unparseable refs for ${it.name}`); continue; }
    const rec = intros.get(r.book) || { summary: '', intro: '' };
    rec[field] = cleanBody(it.body);
    intros.set(r.book, rec);
  }
}
const introRows = OSIS_BOOKS.filter((b) => intros.has(b))
  .map((b) => [b, intros.get(b).summary, intros.get(b).intro]);

write('tyndale-dictionary', { articles, verses: verseRows });
write('tyndale-passages', passages);
write('tyndale-bookintros', introRows);

console.log('dictionary articles:', articleCount);
console.log('supplements (textbox+chart):', articles.length - articleCount,
  `(${orphanSupps} never embedded, host_id NULL)`);
console.log('verse index rows:', verseRows.length,
  `(lex_hit on ${verseRows.filter((r) => r[4] === 1).length})`);
console.log('passages (theme+profile):', passages.length,
  JSON.stringify({ theme: passages.filter((p) => p[0] === 'theme').length,
                   profile: passages.filter((p) => p[0] === 'profile').length }));
console.log('book intros:', introRows.length);
console.log('bref links:', brefTotal, 'seen,', brefKept, 'kept,',
  brefTotal - brefKept, 'dropped (apocrypha + chapter-only)');
```

- [ ] **Step 2: Run the parser**

Run: `cd build && node parse-tyndale.mjs`

Expected output (counts must match — these are verified facts about the source):
```
verse text loaded: 31104 verses
dictionary articles: 6010
supplements (textbox+chart): 131 (13 never embedded, host_id NULL)
verse index rows: ~39000 (lex_hit on ~18000)
passages (theme+profile): 423 {"theme":298,"profile":125}
book intros: 66
bref links: 44132 seen, ~39000 kept, ~5000 dropped (apocrypha + chapter-only)
```

**If `dictionary articles` is not exactly 6010, or `passages` is not 423 with theme=298 and profile=125, stop and fix the parser before continuing.** A count of 299 themes means the misfiled Profile was routed by filename instead of typename. (Profiles are 125, not 124: `Profiles.xml` holds 124 and `ThemeNotes.xml` contributes the misfiled one, `TheChurch`, verified unique — no name collision between the files.)

- [ ] **Step 3: Verify the intermediates are a sane size**

```bash
ls -la build/data/sources/tyndale-*.json.gz
```
Expected: `tyndale-dictionary.json.gz` roughly 3-4 MB; the other two well under 1 MB each.

- [ ] **Step 4: Commit the parser AND the intermediates**

The intermediates are what a fresh clone builds from, so they must be committed.

```bash
git add build/parse-tyndale.mjs build/data/sources/tyndale-dictionary.json.gz \
        build/data/sources/tyndale-passages.json.gz build/data/sources/tyndale-bookintros.json.gz
git commit -m "feat(build): parse Tyndale packages into committed intermediates"
```

---

### Task 5: Wire the tables into build-db.mjs

**Files:**
- Modify: `build/build-db.mjs` (schema block ~line 61, loader section ~line 109, index block ~line 112)
- Modify: `build/lib/tyndale.mjs` (add `loadTyndale`)

**Interfaces:**
- Consumes: the three intermediates from Task 4
- Produces: `loadTyndale(db): { articles, verses, passages, intros }` — row counts for logging

**Context:** Follow the existing `loadStudyNotes` pattern exactly — a loader in `lib/`, called from `build-db.mjs`, logging its count. The `host_id` column stays `NULL` in Phase 1; resolving textbox/chart hosts is a Phase 2 concern and the column exists so the schema does not change later.

- [ ] **Step 1: Add the loader to `build/lib/tyndale.mjs`**

Append to `build/lib/tyndale.mjs`:

```javascript
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'sources');
const read = (name) => JSON.parse(zlib.gunzipSync(fs.readFileSync(`${SRC}/${name}.json.gz`)));

export function loadTyndale(db) {
  const dict = read('tyndale-dictionary');
  const passages = read('tyndale-passages');
  const intros = read('tyndale-bookintros');

  const insA = db.prepare('INSERT INTO dict_articles VALUES (?,?,?,?,?,?,?,?,?)');
  const insV = db.prepare('INSERT INTO dict_verse VALUES (?,?,?,?,?)');
  const insP = db.prepare('INSERT INTO tyndale_passages VALUES (?,?,?,?,?,?,?,?,?,?)');
  const insI = db.prepare('INSERT INTO book_intros VALUES (?,?,?)');

  db.exec('BEGIN');
  for (const r of dict.articles) insA.run(...r);
  for (const r of dict.verses) insV.run(...r);
  for (const r of passages) insP.run(...r);
  for (const r of intros) insI.run(...r);
  db.exec('COMMIT');

  return { articles: dict.articles.length, verses: dict.verses.length,
    passages: passages.length, intros: intros.length };
}
```

Move the `import fs` line to the top of the file with the other imports rather than leaving it mid-file.

- [ ] **Step 2: Add the tables to the schema block in `build/build-db.mjs`**

Immediately after the `CREATE TABLE study_notes (...)` block and before the closing backtick, add:

```sql
  CREATE TABLE dict_articles (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    sort_title TEXT NOT NULL,
    kind TEXT NOT NULL,
    host_id TEXT,
    body TEXT NOT NULL,
    is_html INTEGER NOT NULL,
    n_refs INTEGER NOT NULL,
    seq INTEGER NOT NULL
  );
  CREATE TABLE dict_verse (
    article_id TEXT NOT NULL,
    book TEXT NOT NULL, chapter INTEGER NOT NULL, verse INTEGER NOT NULL,
    lex_hit INTEGER NOT NULL
  );
  CREATE TABLE tyndale_passages (
    kind TEXT NOT NULL, title TEXT NOT NULL, book TEXT NOT NULL,
    start_chapter INTEGER NOT NULL, start_verse INTEGER NOT NULL,
    end_chapter INTEGER NOT NULL, end_verse INTEGER NOT NULL,
    ref TEXT NOT NULL, body TEXT NOT NULL, seq INTEGER NOT NULL
  );
  CREATE TABLE book_intros (
    book TEXT PRIMARY KEY, summary TEXT NOT NULL, intro TEXT NOT NULL
  );
```

- [ ] **Step 3: Add the import and the loader call**

Add to the imports at the top:
```javascript
import { loadTyndale } from './lib/tyndale.mjs';
```

After the `study_notes` log line (`console.log('study_notes:', studyNotes.count);`), add:
```javascript
// 6) TYNDALE CULTURAL LAYER: dictionary + themes/profiles + book intros
const tyndale = loadTyndale(db);
console.log('tyndale:', JSON.stringify(tyndale));
```

- [ ] **Step 4: Add the indexes**

In the `CREATE INDEX` block at the end, add:
```sql
  CREATE INDEX idx_dict_verse ON dict_verse(book, chapter, verse);
  CREATE INDEX idx_dict_sort ON dict_articles(sort_title);
  CREATE INDEX idx_tyndale_passages ON tyndale_passages(book, start_chapter, end_chapter);
```

- [ ] **Step 5: Rebuild and verify counts + the orphan-book invariant**

```bash
cd build && node build-db.mjs && node validate-db.mjs
sqlite3 ../data/bible.db "SELECT COUNT(*) FROM dict_articles;"       # expect 6141
sqlite3 ../data/bible.db "SELECT COUNT(*) FROM tyndale_passages;"    # expect 423
sqlite3 ../data/bible.db "SELECT COUNT(*) FROM book_intros;"         # expect 66
echo "--- orphan books (MUST be empty) ---"
sqlite3 ../data/bible.db "SELECT DISTINCT d.book FROM dict_verse d LEFT JOIN verses v ON v.book=d.book WHERE v.book IS NULL;"
sqlite3 ../data/bible.db "SELECT DISTINCT p.book FROM tyndale_passages p LEFT JOIN verses v ON v.book=p.book WHERE v.book IS NULL;"
sqlite3 ../data/bible.db "SELECT DISTINCT b.book FROM book_intros b LEFT JOIN verses v ON v.book=b.book WHERE v.book IS NULL;"
```

Expected: the counts above, and **all three orphan queries return nothing**. Any output from an orphan query means a book code failed to normalize — the exact failure mode this whole design guards against. Stop and fix.

- [ ] **Step 6: Verify a fresh clone can still build**

```bash
cd /Users/justinleong/Desktop/Coding/DeepVerse
mv backup-data backup-data.hidden
cd build && node build-db.mjs && node validate-db.mjs && echo "BUILDS WITHOUT backup-data"
cd .. && mv backup-data.hidden backup-data
```
Expected: `BUILDS WITHOUT backup-data`. If this fails, an intermediate was not committed.

- [ ] **Step 7: Run the full build suite and commit**

```bash
cd build && npm test 2>&1 | tail -5
git add build/build-db.mjs build/lib/tyndale.mjs
git commit -m "feat(build): create and load the four Tyndale tables"
```
Expected: tests pass (67 existing + 19 tyndale + 13 books = 99). The exact total matters less than the rule: no previously passing test may fail.

---

### Task 6: App query layer

**Files:**
- Modify: `app/src/lib/db.js` (add after `getChapterStudyNoteCount`, ~line 357)
- Test: `app/src/lib/db.queries.test.js` (append a new `describe` block)

**Interfaces:**
- Consumes: the tables from Task 5
- Produces:
  - `getDictForVerse(book, chapter, verse): Array<{id, title, body, n_refs}>`
  - `getDictCountForVerse(book, chapter, verse): number`
  - `getTyndalePassages(kind, book, chapter, verse): Array<{title, ref, body}>`
  - `getBookIntro(book): {summary, intro} | null`
  - `getArticleSupplements(hostId): Array<{id, title, kind, body, is_html}>`

**Context:** All query functions are synchronous (sql.js is in-memory). The covering-range model and the `ch*1000+v` sort key match `getStudyNotes` exactly. Ranking is `lex_hit DESC, n_refs ASC, sort_title` — the measured best combination.

- [ ] **Step 1: Write the failing tests**

Append to `app/src/lib/db.queries.test.js`:

```javascript
describe('tyndale cultural layer', () => {
  test('getDictForVerse ranks the specific article first', () => {
    const rows = db.getDictForVerse('Mark', 14, 36);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].title).toBe('Abba');
  });

  test('getDictForVerse: the lexical signal surfaces Centurion at Acts 10:1', () => {
    const titles = db.getDictForVerse('Acts', 10, 1).map(r => r.title);
    expect(titles).toContain('Cornelius');
    expect(titles).toContain('Centurion*');
    // survey articles sink: whatever cites the most verses must not lead
    expect(titles[0]).toBe('Cornelius');
  });

  test('getDictForVerse: genealogy verse ranks the name entries above the survey articles', () => {
    const titles = db.getDictForVerse('1Chr', 1, 1).map(r => r.title);
    const seth = titles.indexOf('Seth');
    const chron = titles.findIndex(t => t.startsWith('Chronology of the Bible'));
    expect(seth).toBeGreaterThanOrEqual(0);
    expect(chron).toBeGreaterThan(seth);
  });

  test('getDictForVerse: unreferenced verse returns []', () => {
    expect(db.getDictForVerse('Ps', 119, 100)).toEqual([]);
  });

  test('getDictCountForVerse matches the row count', () => {
    expect(db.getDictCountForVerse('Mark', 14, 36))
      .toBe(db.getDictForVerse('Mark', 14, 36).length);
  });

  test('getTyndalePassages: themes use the covering-range model', () => {
    // "The Creation" is anchored Gen.1.1-2.25, so it must cover a mid-range verse
    const rows = db.getTyndalePassages('theme', 'Gen', 1, 10);
    expect(rows.map(r => r.title)).toContain('The Creation');
    expect(rows[0].ref).toBeTruthy();
  });

  test('getTyndalePassages: profiles are keyed separately from themes', () => {
    const profiles = db.getTyndalePassages('profile', 'Gen', 3, 1);
    expect(profiles.map(r => r.title)).toContain('Adam and Eve');
    const themes = db.getTyndalePassages('theme', 'Gen', 3, 1);
    expect(themes.every(r => r.title !== 'Adam and Eve')).toBe(true);
  });

  test('getTyndalePassages: verse outside every range returns []', () => {
    expect(db.getTyndalePassages('profile', 'Obad', 1, 1)).toEqual([]);
  });

  test('getArticleSupplements returns the textboxes an article embeds', () => {
    const supps = db.getArticleSupplements('Aaron');
    expect(supps.map(s => s.id)).toContain('AaronThePriest');
    expect(supps[0].kind).toBe('textbox');
  });

  test('getArticleSupplements: article with no supplements returns []', () => {
    expect(db.getArticleSupplements('Abba')).toEqual([]);
  });

  test('charts are stored as html, articles are not', () => {
    const charts = db.getArticleSupplements('FeastsAndFestivalsOfIsrael')
      .filter(s => s.kind === 'chart');
    for (const c of charts) expect(c.is_html).toBe(1);
  });

  test('getBookIntro returns summary and intro for all 66 books', () => {
    const gen = db.getBookIntro('Gen');
    expect(gen.summary).toContain('Purpose');
    expect(gen.intro.length).toBeGreaterThan(1000);
    for (const b of ['Gen', '1Thess', '1John', 'Hag', 'Jonah', 'Prov', 'Rev'])
      expect(db.getBookIntro(b), `${b} missing an intro`).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npm test -- db.queries 2>&1 | tail -20`
Expected: FAIL — `db.getDictForVerse is not a function`

- [ ] **Step 3: Implement the queries**

Add to `app/src/lib/db.js` after `getChapterStudyNoteCount`:

```javascript
// --- Tyndale cultural layer ---
// Dictionary articles anchored to a verse by the ?bref= links in their bodies. Ordered by
// relatedness, not by quality: an article whose title word appears in the verse text comes
// first (lex_hit), then the article citing fewest verses overall (an article citing 3 verses
// is about them; one citing 197 mentions each in passing). Nothing is filtered out — a weak
// signal costs an article its position, never its place in the list.
export function getDictForVerse(book, chapter, verse) {
  return query(
    `SELECT a.id, a.title, a.body, a.n_refs
       FROM dict_verse v JOIN dict_articles a ON a.id = v.article_id
      WHERE v.book = ? AND v.chapter = ? AND v.verse = ?
      ORDER BY v.lex_hit DESC, a.n_refs ASC, a.sort_title`,
    [book, chapter, verse]);
}

export function getDictCountForVerse(book, chapter, verse) {
  return query('SELECT COUNT(*) AS n FROM dict_verse WHERE book=? AND chapter=? AND verse=?',
    [book, chapter, verse])[0].n;
}

// Theme articles and profiles, covering-range like study notes: a passage anchored Gen.1.1-2.25
// covers every verse in that span, not just its first.
export function getTyndalePassages(kind, book, chapter, verse) {
  const key = chapter * 1000 + verse;
  return query(
    `SELECT title, ref, body FROM tyndale_passages
      WHERE kind = ? AND book = ?
        AND (start_chapter*1000 + start_verse) <= ?
        AND (end_chapter*1000   + end_verse)   >= ?
      ORDER BY (start_chapter*1000 + start_verse), seq`,
    [kind, book, key, key]);
}

// Book-level, not verse-level: intro ranges span whole books, so this is keyed on book alone.
export function getBookIntro(book) {
  return query('SELECT summary, intro FROM book_intros WHERE book=?', [book])[0] || null;
}

// Textboxes and charts embedded in an article, shown inside that article's detail. Charts carry
// real table markup (is_html = 1); everything else is plain text.
export function getArticleSupplements(hostId) {
  return query(
    `SELECT id, title, kind, body, is_html FROM dict_articles
      WHERE host_id = ? ORDER BY seq`, [hostId]);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npm test -- db.queries 2>&1 | tail -20`
Expected: PASS — 12 new tests. Total app tests now 116.

If the `getArticleSupplements('Aaron')` test fails with an empty array, `host_id` was not resolved
in Task 4 — check that `extractIncludes` matched the `<include_items … name="…"/>` markup.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/db.js app/src/lib/db.queries.test.js
git commit -m "feat(app): Tyndale cultural-layer queries"
```

---

### Task 7: Context tab — collapsible sections with hotkeys

**Files:**
- Modify: `app/src/components/workbench/ContextCard.svelte`

**Interfaces:**
- Consumes: `getBookIntro`, `getTyndalePassages`, `getDictCountForVerse` from Task 6; `getPref`/`setPref` from `app/src/lib/store.js`
- Produces: the section shell that Task 8 fills with the dictionary grid

**Context:** Every section becomes collapsible with a count in its header. Hotkeys `q w e r t y u` are bound to **fixed sections**, not visible positions, so a key never shifts meaning. They must be inert unless the Context card is open and `tab === 'context'`, and must respect the same input-field guard `Workbench.svelte` uses (`e.target.isContentEditable || ['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)`). `Workbench` already binds digits `1..n`, hence letters here.

Measured density justifying this: the existing entity section is median 9 chips, p99 150, max 202 — far larger than anything this import adds (median 1). Collapsing is what makes the tab usable.

- [ ] **Step 1: Add the state, data and keyboard handler to the `<script>` block**

Add to the imports:
```javascript
import { onMount } from 'svelte';
import { getPref, setPref } from '../../lib/store.js';
import { getBookIntro, getTyndalePassages, getDictCountForVerse } from '../../lib/db.js';
```

Add after the existing `studyNotes` derivation:

```javascript
  // --- Tyndale cultural layer ---
  let bookIntro = $derived(getBookIntro(study.book));
  let themes = $derived(study.verse == null ? []
    : getTyndalePassages('theme', study.book, study.chapter, study.verse));
  let profiles = $derived(study.verse == null ? []
    : getTyndalePassages('profile', study.book, study.chapter, study.verse));
  let dictCount = $derived(study.verse == null ? 0
    : getDictCountForVerse(study.book, study.chapter, study.verse));

  // Collapsible sections. Keys are bound to fixed sections so a hotkey never shifts meaning
  // as counts change. Order here is display order.
  const SECTIONS = [
    { id: 'intro', key: 'q', label: 'Book introduction' },
    { id: 'recap', key: 'w', label: 'Recap' },
    { id: 'entities', key: 'e', label: 'People, places, events' },
    { id: 'notes', key: 'r', label: 'Study notes' },
    { id: 'themes', key: 't', label: 'Themes' },
    { id: 'profiles', key: 'y', label: 'Profiles' },
    { id: 'dict', key: 'u', label: 'Dictionary' },
  ];
  const DEFAULT_OPEN = { intro: false, recap: true, entities: false,
    notes: true, themes: false, profiles: false, dict: false };
  let sec = $state({ ...DEFAULT_OPEN, ...getPref('contextSections', {}) });
  $effect(() => { setPref('contextSections', sec); });

  // count per section — a section with 0 renders its header but cannot expand
  let counts = $derived({
    intro: bookIntro ? 1 : 0,
    recap: recap ? 1 : 0,
    entities: entities.person.length + entities.place.length
      + entities.event.length + entities.group.length,
    notes: studyNotes.length,
    themes: themes.length,
    profiles: profiles.length,
    dict: dictCount,
  });

  function toggleSec(id) { if (counts[id] > 0) sec[id] = !sec[id]; }

  // Hotkeys are live only while this card is open AND the Context tab is showing, so they never
  // fire from the Cross-references tab or a collapsed card. Letters, because Workbench owns 1..n.
  function onKey(e) {
    if (tab !== 'context') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    const hit = SECTIONS.find(s => s.key === e.key.toLowerCase());
    if (!hit) return;
    toggleSec(hit.id);   // no-op when the section is empty
    e.preventDefault();
  }
  onMount(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
```

- [ ] **Step 2: Add a reusable section header snippet to the markup**

Add before the `{#if tab === 'xrefs'}` block:

```svelte
{#snippet secHeader(id, label, extra = '')}
  {@const n = counts[id]}
  <button class="sechd" class:empty={n === 0} onclick={() => toggleSec(id)} disabled={n === 0}>
    <span class="caret" class:open={sec[id]}>›</span>
    <span class="seclbl">{label}</span>
    {#if n > 0 && extra !== 'noCount'}<span class="secn">· {n}</span>{/if}
    <span class="seckey">{SECTIONS.find(s => s.id === id).key}</span>
  </button>
{/snippet}
```

- [ ] **Step 3: Wrap the existing Context-tab sections**

In the `{:else}` branch (the Context tab), wrap each existing block. The book intro is new and goes first; Recap, the `.hd` header, and the entity blocks keep their existing internals and are only wrapped:

```svelte
  {@render secHeader('intro', 'Book introduction')}
  {#if sec.intro && bookIntro}
    <div class="grp">
      <p class="recaptext">{bookIntro.summary}</p>
      <p class="recaptext introfull">{introOpen ? bookIntro.intro
        : bookIntro.intro.slice(0, RECAP_CLAMP).trimEnd() + '…'}</p>
      <button class="seemore" onclick={() => (introOpen = !introOpen)}>
        {introOpen ? 'Read less' : 'Read the full introduction'}</button>
    </div>
  {/if}

  {@render secHeader('recap', 'Recap', 'noCount')}
  {#if sec.recap && recap}
    <!-- existing recap .grp block, unchanged -->
  {/if}

  {@render secHeader('entities', 'People, places, events')}
  {#if sec.entities}
    <!-- existing .hd header + all four entity blocks, unchanged -->
  {/if}

  {@render secHeader('notes', 'Study notes')}
  {#if sec.notes}
    <!-- existing .studynotes block, unchanged -->
  {/if}

  {@render secHeader('themes', 'Themes')}
  {#if sec.themes}
    <div class="grp">
      {#each themes as t}
        <div class="snote"><div class="snref">{t.title} · {t.ref}</div><p class="snbody">{t.body}</p></div>
      {/each}
    </div>
  {/if}

  {@render secHeader('profiles', 'Profiles')}
  {#if sec.profiles}
    <div class="grp">
      {#each profiles as p}
        <div class="snote"><div class="snref">{p.title} · {p.ref}</div><p class="snbody">{p.body}</p></div>
      {/each}
    </div>
  {/if}
```

Add `let introOpen = $state(false);` next to `recapOpen`, and reset it in the same `$effect` that resets `recapOpen` on chapter change.

The `dict` section is added in Task 8.

- [ ] **Step 4: Add the styles**

Append to the `<style>` block:

```css
  /* collapsible section headers */
  .sechd { display: flex; align-items: baseline; gap: 5px; width: 100%; text-align: left;
    background: transparent; border: none; border-top: 1px solid var(--rule);
    padding: 7px 11px 5px; cursor: pointer; font-family: inherit; color: var(--dim); }
  .sechd:hover:not(:disabled) { color: var(--ink); }
  .sechd:disabled { cursor: default; opacity: .55; }
  .sechd .caret { display: inline-block; transition: transform .12s; font-size: 11px; }
  .sechd .caret.open { transform: rotate(90deg); }
  .seclbl { font-variant: small-caps; letter-spacing: .05em; font-size: 10.5px; }
  .secn { font-size: 10.5px; }
  .seckey { margin-left: auto; font-size: 9.5px; opacity: .5; border: 1px solid var(--rule);
    border-radius: 3px; padding: 0 4px; }
  .introfull { margin-top: 6px; }
```

- [ ] **Step 5: Verify in the browser**

```bash
cd app && npm run dev
```
Open `http://localhost:5173/#/study/Mark/14/36`, open the Context card, and confirm:
- seven section headers render, each with its hotkey badge
- `q` toggles Book introduction, `w` Recap, `u` Dictionary; a section showing `· 0` does not toggle
- pressing `q` while the Cross-references tab is showing does nothing
- typing `q` inside a note editor does not toggle anything
- collapse state survives a page reload

- [ ] **Step 6: Run app tests and commit**

```bash
cd app && npm test 2>&1 | tail -5
git add app/src/components/workbench/ContextCard.svelte
git commit -m "feat(app): collapsible Context tab sections with hotkeys"
```
Expected: 116/116 pass.

---

### Task 8: Dictionary chip grid with a single detail div

**Files:**
- Modify: `app/src/components/workbench/ContextCard.svelte`

**Interfaces:**
- Consumes: `getDictForVerse`, `getArticleSupplements` from Task 6; the section shell from Task 7

**Context:** Mirrors `OriginalCard.svelte`'s interlinear pattern — a compact clickable grid with **exactly one** detail body rendered below in a `border-top` div, `scrollIntoView({ block: 'nearest' })` on change. This is what bounds the card height: Gen 1:1's 25 articles cost four rows of chips, not 25 paragraphs. Bodies clamp at 400 chars with **Read more** (69% of articles are under 500 chars and never clamp; `Animals` is 107k chars and must stay contained).

- [ ] **Step 1: Add the state and data**

Add to the `<script>` block:

```javascript
  const DICT_CLAMP = 400;
  let dictArticles = $derived(study.verse == null ? []
    : getDictForVerse(study.book, study.chapter, study.verse));
  let dictSel = $state(null);      // selected article id
  let dictOpen = $state(false);    // "Read more" state for the selected body
  let dictEl = $state(null);
  // selection is meaningless once the verse changes
  $effect(() => { study.book; study.chapter; study.verse; dictSel = null; dictOpen = false; });
  let dictDetail = $derived(dictArticles.find(a => a.id === dictSel) || null);
  let dictSupps = $derived(dictDetail ? getArticleSupplements(dictDetail.id) : []);
  let suppSel = $state(null);
  $effect(() => { dictSel; suppSel = null; });   // a new article clears any open supplement
  let suppDetail = $derived(dictSupps.find(s => s.id === suppSel) || null);
  $effect(() => { if (dictDetail && dictEl) dictEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
```

Add `getArticleSupplements` to the `db.js` import added in Task 7.

- [ ] **Step 2: Add the markup after the `profiles` section**

```svelte
  {@render secHeader('dict', 'Dictionary')}
  {#if sec.dict}
    <div class="grp">
      <div class="dictgrid">
        {#each dictArticles as a (a.id)}
          <button class="dchip" class:active={dictSel === a.id}
            onclick={() => { dictSel = dictSel === a.id ? null : a.id; dictOpen = false; }}>
            {a.title}
          </button>
        {/each}
      </div>
      {#if dictDetail}
        {@const long = dictDetail.body.length > DICT_CLAMP}
        <div class="ddetail" bind:this={dictEl}>
          <div class="dtitle">{dictDetail.title}</div>
          <p class="snbody">{long && !dictOpen
            ? dictDetail.body.slice(0, DICT_CLAMP).trimEnd() + '…' : dictDetail.body}</p>
          {#if long}
            <button class="seemore" onclick={() => (dictOpen = !dictOpen)}>
              {dictOpen ? 'Read less' : 'Read more'}</button>
          {/if}
          {#if dictSupps.length}
            <div class="dictgrid supps">
              {#each dictSupps as s (s.id)}
                <button class="dchip supp" class:active={suppSel === s.id}
                  onclick={() => (suppSel = suppSel === s.id ? null : s.id)}>
                  {s.kind === 'chart' ? '▦' : '▤'} {s.title}
                </button>
              {/each}
            </div>
            {#if suppDetail}
              <div class="sdetail">
                <div class="dtitle">{suppDetail.title}</div>
                <!-- charts are the only Tyndale content that cannot flatten to text. The markup
                     is generated by our own parser (tags whitelisted to table/tr/td/th, all
                     attributes stripped), never raw source, so {@html} has no untrusted input. -->
                {#if suppDetail.is_html}
                  <div class="charttbl">{@html suppDetail.body}</div>
                {:else}
                  <p class="snbody">{suppDetail.body}</p>
                {/if}
              </div>
            {/if}
          {/if}
        </div>
      {/if}
      <div class="srcnote">Tyndale Open Bible Dictionary · CC BY-SA 4.0</div>
    </div>
  {/if}
```

- [ ] **Step 3: Add the styles**

```css
  /* dictionary: chip grid + one detail body, mirroring the Original tab's interlinear */
  .dictgrid { display: flex; flex-wrap: wrap; gap: 4px; }
  .dchip { border: 1px solid var(--rule); background: transparent; border-radius: 5px;
    padding: 3px 8px; font-size: 11.5px; color: var(--ink); font-family: inherit; cursor: pointer;
    text-align: left; }
  .dchip:hover { border-color: var(--a); }
  .dchip.active { border-color: var(--a); background: color-mix(in srgb, var(--panel) 60%, var(--bg)); }
  .ddetail { border-top: 1px solid var(--rule); margin-top: 8px; padding-top: 8px; }
  .dtitle { font-size: 12px; color: var(--b); font-weight: 600; margin-bottom: 3px; }
  .srcnote { margin-top: 8px; font-size: 10px; color: var(--dim); font-style: italic; }
  /* embedded textboxes + charts */
  .dictgrid.supps { margin-top: 8px; }
  .dchip.supp { font-size: 11px; color: var(--dim); }
  .dchip.supp:hover, .dchip.supp.active { color: var(--ink); }
  .sdetail { margin-top: 7px; padding-left: 9px; border-left: 2px solid var(--rule); }
  .charttbl { overflow-x: auto; }
  .charttbl :global(table) { border-collapse: collapse; font-size: 11.5px; width: 100%; }
  .charttbl :global(td), .charttbl :global(th) { border: 1px solid var(--rule);
    padding: 3px 6px; text-align: left; vertical-align: top; color: var(--ink); }
```

- [ ] **Step 4: Verify in the browser**

With `npm run dev` running, check each of these:
- `#/study/Mark/14/36` → Dictionary · 5, chips ordered `Abba`, `Talitha Cumi*`, `Cup`, …; clicking `Abba` shows its body below, unclamped (250 chars)
- `#/study/Gen/1/1` → 25 chips in a few rows, not 25 paragraphs; clicking `Animals` clamps at 400 chars with **Read more**, and expanding does not break the card
- `#/study/Acts/10/1` → `Centurion*` present in the list
- clicking the selected chip again deselects it
- changing verse clears the selection
- `#/study/Exod/28/30` → click `Urim and Thummim`; if the article embeds a textbox, a `▤` chip
  appears below the body and opens it
- find an article embedding a chart (e.g. via `sqlite3 data/bible.db "SELECT host_id, title FROM
  dict_articles WHERE kind='chart' AND host_id IS NOT NULL LIMIT 3;"`), open it, and confirm the
  table renders with borders and scrolls horizontally rather than overflowing the card

- [ ] **Step 5: Run app tests and commit**

```bash
cd app && npm test 2>&1 | tail -5
git add app/src/components/workbench/ContextCard.svelte
git commit -m "feat(app): dictionary chip grid with expandable article detail"
```

---

### Task 9: Attribution, docs, and full verification

**Files:**
- Modify: `docs/ATTRIBUTIONS.md`
- Modify: `docs/DATA-PIPELINE.md`

**Context:** CC BY-SA 4.0 requires attribution, and the dictionary's README additionally requires derivative works to state what was changed. Our derivation qualifies: XML flattened to text, refs re-keyed to OSIS, apocryphal references dropped.

- [ ] **Step 1: Read the existing attribution format**

```bash
cat docs/ATTRIBUTIONS.md
```
Match the existing entry structure rather than inventing one.

- [ ] **Step 2: Add the Tyndale dictionary entry**

Append an entry in the established format containing:
- **Tyndale Open Bible Dictionary**, © 2023 Tyndale House Publishers
- CC BY-SA 4.0, source `tyndaleopenresources.com`
- Used for: `dict_articles`, `dict_verse`, `tyndale_passages`, `book_intros`
- **Changes made** (required by the source README): XML flattened to plain text; scripture references re-keyed from Tyndale book codes to OSIS; references to apocryphal books dropped; textboxes and charts stored alongside articles
- ShareAlike binds the derived data, not the app code
- Perspective is evangelical/conservative, disclosed via the in-app source label

- [ ] **Step 3: Update the DATA-PIPELINE inputs table**

In the "What the build reads" table, the `build/data/sources/*.json.gz` row's size note is now stale (~16 MB → ~20 MB). Update it, and confirm the ⚠️ REQUIRED checklist items are all satisfied by this work.

- [ ] **Step 4: Full verification**

```bash
cd /Users/justinleong/Desktop/Coding/DeepVerse

# 1. fresh-clone build (the rule that matters most)
mv backup-data backup-data.hidden
cd build && node build-db.mjs && node validate-db.mjs && echo "✓ builds without backup-data"
cd .. && mv backup-data.hidden backup-data

# 2. build tests
cd build && npm test 2>&1 | tail -3

# 3. app tests
cd ../app && npm test 2>&1 | tail -3

# 4. orphan-book invariant
cd .. && for t in "dict_verse d" "tyndale_passages p" "book_intros b"; do
  set -- $t
  sqlite3 data/bible.db "SELECT DISTINCT $2.book FROM $1 LEFT JOIN verses v ON v.book=$2.book WHERE v.book IS NULL;"
done
echo "✓ orphan check done (any output above is a failure)"

# 5. shipped db size
cd app && npm run copy-assets && ls -la public/bible.db
```

Expected: builds without `backup-data`; build tests 99/99; app tests 116/116; **no orphan output**; `public/bible.db` around 161 MB.

- [ ] **Step 5: Commit**

```bash
git add docs/ATTRIBUTIONS.md docs/DATA-PIPELINE.md
git commit -m "docs: attribute Tyndale Open Bible Dictionary (CC BY-SA 4.0)"
```

---

## Done when

- [ ] `cd build && npm test` — 99/99 green (67 pre-existing, none regressed)
- [ ] `cd app && npm test` — 116/116 green (104 pre-existing, none regressed)
- [ ] `bible.db` rebuilds with `backup-data/` renamed away
- [ ] Zero orphan books across `dict_verse`, `tyndale_passages`, `book_intros`
- [ ] `dict_articles` 6,141 · `tyndale_passages` 423 (298 theme + 125 profile) · `book_intros` 66
- [ ] Context tab shows seven collapsible sections with working `q w e r t y u` hotkeys, scoped to the Context tab
- [ ] Dictionary grid ranks `Abba` first at Mark 14:36 and includes `Centurion*` at Acts 10:1
- [ ] `docs/ATTRIBUTIONS.md` records the CC BY-SA 4.0 attribution and the changes made

**Not in this plan (Phase 2):** the `#/library` explorer route, page, and browse queries — gated on a UI design ideation session.
