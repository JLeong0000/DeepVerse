# Tyndale Study Notes Display — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show all 16,923 Tyndale Open Study Notes verse-by-verse inside the Context tab, without crowding the reader.

**Architecture:** Parse `StudyNotes.xml` once into a committed `build/data/studynotes.json`; load it into a new `study_notes` table (start/end verse bounds) in `bible.db`; expose `getStudyNotes` / `getChapterStudyNoteCount` in the app's query layer; render a verse-driven "Study Notes" section in `ContextCard.svelte`.

**Tech Stack:** Node `node:sqlite` build pipeline, `node:test` for build tests, Svelte 5 (runes) + sql.js in the app, vitest for app tests.

**Spec:** `docs/superpowers/specs/2026-07-15-tyndale-study-notes-display-design.md`

## Global Constraints

- OSIS book codes only; must match `verses.book` (e.g. `Gen`, `1Chr`, `Ps`, `Song`).
- Sort-key convention: `sortkey(chapter, verse) = chapter*1000 + verse` (max 176 verses/chapter).
- **Covering model:** a note applies to every verse from its start ref to its end ref (inclusive).
- Each note displays its **span** (the display ref, e.g. `1:1–2:3`, `1:16`).
- **No per-verse reader markers.** Reader pane is untouched.
- Bible Summary/Theographic patterns: parsed source data lives in a committed `build/data/*.json`; the build makes no network calls.
- Attribution: Tyndale Open Study Notes, © 2022 Tyndale House Publishers, CC BY-SA 4.0 — required in-app and in `docs/ATTRIBUTIONS.md`.
- Match existing code style: build loaders use the `tx()` helper + prepared statements + a `console.log(count)`; the UI uses Svelte 5 runes and the card's existing CSS vars (`--dim`, `--ink`, `--rule`, `--b`) and `.grp`/`.grplbl` classes.
- Source XML is already present at `sources/tyndale/Tyndale Open Study Notes/StudyNotes.xml` (gitignored).

---

### Task 1: Parse helpers + parse script → committed JSON

**Files:**
- Create: `build/lib/studynotes.mjs` (pure helpers; loader added in Task 2)
- Create: `build/parse-studynotes.mjs` (one-time parse script)
- Create: `build/test/studynotes.test.mjs`
- Produces (committed): `build/data/studynotes.json`

**Interfaces:**
- Produces: `parseStudyNoteRef(osis) -> { book, start_chapter, start_verse, end_chapter, end_verse } | null`
- Produces: `extractRef(bodyXml) -> string | null` (the display span, e.g. `"1:6-8"`)
- Produces: `cleanNoteBody(bodyXml) -> string` (plain text, sn-ref removed, tags stripped, entities decoded)

- [ ] **Step 1: Write the failing test**

Create `build/test/studynotes.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStudyNoteRef, extractRef, cleanNoteBody } from '../lib/studynotes.mjs';

test('parseStudyNoteRef: single verse', () => {
  assert.deepEqual(parseStudyNoteRef('Gen.1.16'),
    { book: 'Gen', start_chapter: 1, start_verse: 16, end_chapter: 1, end_verse: 16 });
});
test('parseStudyNoteRef: same-chapter range', () => {
  assert.deepEqual(parseStudyNoteRef('Gen.1.6-8'),
    { book: 'Gen', start_chapter: 1, start_verse: 6, end_chapter: 1, end_verse: 8 });
});
test('parseStudyNoteRef: cross-chapter range', () => {
  assert.deepEqual(parseStudyNoteRef('Gen.1.1-2.3'),
    { book: 'Gen', start_chapter: 1, start_verse: 1, end_chapter: 2, end_verse: 3 });
});
test('parseStudyNoteRef: numbered book', () => {
  assert.deepEqual(parseStudyNoteRef('1Chr.2.1'),
    { book: '1Chr', start_chapter: 2, start_verse: 1, end_chapter: 2, end_verse: 1 });
});

const SAMPLE = '<p class="sn-text"><span class="sn-ref"><a href="?bref=Ruth.2.2">2:2</a></span> ' +
  'to pick up the stalks: Harvesters were to leave grain (see <a href="?bref=Lev.19.9-10">Lev 19:9-10</a>). &amp; God provided.</p>';

test('extractRef pulls the display span', () => {
  assert.equal(extractRef(SAMPLE), '2:2');
});
test('cleanNoteBody: strips markup, unwraps links, decodes entities, drops sn-ref', () => {
  assert.equal(cleanNoteBody(SAMPLE),
    'to pick up the stalks: Harvesters were to leave grain (see Lev 19:9-10). & God provided.');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd build && node --test test/studynotes.test.mjs`
Expected: FAIL — `Cannot find module '../lib/studynotes.mjs'`.

- [ ] **Step 3: Write minimal implementation**

Create `build/lib/studynotes.mjs`:

```js
// build/lib/studynotes.mjs
// Parse helpers for Tyndale Open Study Notes (CC BY-SA 4.0). loadStudyNotes is added in Task 2.

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', nbsp: ' ', '#39': "'" };
function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&(amp|lt|gt|quot|nbsp|#39);/g, (_, k) => ENT[k]);
}

// OSIS ref -> verse bounds. Handles "Gen.1.16", "Gen.1.6-8", "Gen.1.1-2.3". OSIS book kept as-is.
export function parseStudyNoteRef(osis) {
  const [left, right] = osis.split('-');
  const m = left.match(/^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  const book = m[1], sc = +m[2], sv = +m[3];
  let ec = sc, ev = sv;
  if (right) {
    const nums = right.split('.').filter((p) => /^\d+$/.test(p)).map(Number);
    if (nums.length === 1) ev = nums[0];               // "8" -> end verse, same chapter
    else if (nums.length >= 2) { ec = nums[nums.length - 2]; ev = nums[nums.length - 1]; } // "2.3"
  }
  return { book, start_chapter: sc, start_verse: sv, end_chapter: ec, end_verse: ev };
}

export function extractRef(bodyXml) {
  const m = bodyXml.match(/<span class="sn-ref">.*?<a\b[^>]*>(.*?)<\/a>.*?<\/span>/s);
  return m ? m[1].replace(/<[^>]+>/g, '').trim() : null;
}

export function cleanNoteBody(bodyXml) {
  let b = bodyXml.replace(/<span class="sn-ref">.*?<\/span>/s, ''); // drop leading ref link
  b = b.replace(/<a\b[^>]*>(.*?)<\/a>/gs, '$1');                    // unwrap links -> text
  b = b.replace(/<[^>]+>/g, ' ');                                   // strip remaining tags
  b = decodeEntities(b);
  return b.replace(/\s+/g, ' ').trim();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd build && node --test test/studynotes.test.mjs`
Expected: PASS (6 tests).

- [ ] **Step 5: Write the parse script**

Create `build/parse-studynotes.mjs`:

```js
// build/parse-studynotes.mjs
// One-time: parse Tyndale Open Study Notes XML -> committed build/data/studynotes.json.
// Source (gitignored, CC BY-SA 4.0): sources/tyndale/Tyndale Open Study Notes/StudyNotes.xml
// Run: node parse-studynotes.mjs
import fs from 'node:fs';
import { parseStudyNoteRef, extractRef, cleanNoteBody } from './lib/studynotes.mjs';

const XML = '../sources/tyndale/Tyndale Open Study Notes/StudyNotes.xml';
const OUT = './data/studynotes.json';
fs.mkdirSync('./data', { recursive: true });

const xml = fs.readFileSync(XML, 'utf8');
const out = [];
let seq = 0, skipped = 0;
const RE = /<item name="([^"]+)"[^>]*>.*?<body>(.*?)<\/body>\s*<\/item>/gs;
let m;
while ((m = RE.exec(xml))) {
  const b = parseStudyNoteRef(m[1]);
  if (!b) { skipped++; continue; }
  const body = cleanNoteBody(m[2]);
  if (!body) { skipped++; continue; }
  out.push({ ...b, ref: extractRef(m[2]) || `${b.start_chapter}:${b.start_verse}`,
    osis_ref: m[1], body, seq: seq++ });
}
fs.writeFileSync(OUT, JSON.stringify(out));
console.log('study notes parsed:', out.length, '| skipped:', skipped);
```

- [ ] **Step 6: Run the parse script and sanity-check output**

Run: `cd build && node parse-studynotes.mjs`
Expected: `study notes parsed: 16923 | skipped: 0` (a handful skipped is acceptable; investigate if >20).

Verify:
```bash
cd /Users/justinleong/Desktop/Coding/DeepVerse
python3 -c "import json; d=json.load(open('build/data/studynotes.json')); print(len(d)); print([x for x in d if x['osis_ref']=='Ruth.2.2'][0])"
```
Expected: ~16923; the Ruth.2.2 note has `ref:'2:2'` and a body mentioning "glean"/"Lev 19:9-10".

- [ ] **Step 7: Commit**

```bash
cd /Users/justinleong/Desktop/Coding/DeepVerse
git add build/lib/studynotes.mjs build/parse-studynotes.mjs build/test/studynotes.test.mjs build/data/studynotes.json
git commit -m "feat(context): parse Tyndale study notes into committed JSON

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `study_notes` table + loader + attribution

**Files:**
- Modify: `build/lib/studynotes.mjs` (add `loadStudyNotes`)
- Modify: `build/build-db.mjs` (CREATE TABLE, call loader, CREATE INDEX)
- Modify: `docs/ATTRIBUTIONS.md`

**Interfaces:**
- Consumes: `build/data/studynotes.json` (from Task 1)
- Produces: `loadStudyNotes(db) -> { count }`; table `study_notes(book, start_chapter, start_verse, end_chapter, end_verse, ref, osis_ref, body, seq)`

- [ ] **Step 1: Add the loader to `build/lib/studynotes.mjs`**

Append:

```js
import fs from 'node:fs';
const NOTES_FILE = new URL('../data/studynotes.json', import.meta.url);

export function loadStudyNotes(db) {
  const notes = JSON.parse(fs.readFileSync(NOTES_FILE, 'utf8'));
  const ins = db.prepare(
    'INSERT INTO study_notes VALUES (?,?,?,?,?,?,?,?,?)');
  db.exec('BEGIN');
  for (const n of notes)
    ins.run(n.book, n.start_chapter, n.start_verse, n.end_chapter, n.end_verse,
      n.ref, n.osis_ref, n.body, n.seq);
  db.exec('COMMIT');
  return { count: notes.length };
}
```

(Note: `import fs` already at top if present — keep a single `import fs from 'node:fs';`.)

- [ ] **Step 2: Add the table to the schema block in `build/build-db.mjs`**

In the `db.exec(\`… CREATE TABLE …\`)` block near the top, add:

```sql
  CREATE TABLE study_notes (
    book TEXT NOT NULL,
    start_chapter INTEGER NOT NULL, start_verse INTEGER NOT NULL,
    end_chapter INTEGER NOT NULL, end_verse INTEGER NOT NULL,
    ref TEXT NOT NULL, osis_ref TEXT NOT NULL, body TEXT NOT NULL, seq INTEGER NOT NULL
  );
```

- [ ] **Step 3: Import and call the loader**

Near the other loader imports at the top of `build/build-db.mjs`:
```js
import { loadStudyNotes } from './lib/studynotes.mjs';
```
After the recap loader call (the `loadRecaps(db)` line), add:
```js
const studyNotes = loadStudyNotes(db);
console.log('study_notes:', studyNotes.count);
```

- [ ] **Step 4: Add the index**

In the final `db.exec(\`CREATE INDEX …\`)` block near the bottom of `build/build-db.mjs`, add:
```sql
  CREATE INDEX idx_study_notes ON study_notes(book, start_chapter, end_chapter);
```

- [ ] **Step 5: Rebuild and verify**

Run: `cd build && node build-db.mjs`
Expected: log line `study_notes: 16923`, then `bible.db v2 built …`.

Verify:
```bash
cd /Users/justinleong/Desktop/Coding/DeepVerse
sqlite3 data/bible.db "SELECT COUNT(*) FROM study_notes;"                      # ~16923
sqlite3 data/bible.db "SELECT COUNT(*) FROM study_notes WHERE book='Gen' AND start_chapter<=1 AND end_chapter>=1;"  # 19
sqlite3 data/bible.db "SELECT ref, substr(body,1,50) FROM study_notes WHERE book='Ruth' AND start_chapter=2 AND start_verse=2;"  # 2:2 gleaning
sqlite3 data/bible.db "SELECT COUNT(*) FROM verses WHERE chapter IS NULL;"     # 0 (no regression)
```

- [ ] **Step 6: Run the build test suite**

Run: `cd build && npm test`
Expected: all pass (43 existing + 6 new from Task 1 = 49), 0 fail.

- [ ] **Step 7: Add the attribution entry**

In `docs/ATTRIBUTIONS.md`, add a section:

```markdown
## Tyndale Open Study Notes

- Author: © 2022 Tyndale House Publishers
- License: CC BY-SA 4.0 (no NonCommercial restriction)
- Source: https://tyndaleopenresources.com
- Used for: per-verse study notes shown in the Context tab (`study_notes` table). Source XML is
  gitignored; the parsed notes are committed in `build/data/studynotes.json`. ShareAlike applies to
  the derived note data (attribute + keep BY-SA); it does not affect the app code. The app shows a
  "Tyndale Open Study Notes · CC BY-SA 4.0" label on the section.
```

- [ ] **Step 8: Sync the app DB copy**

Run: `cd app && npm run copy-assets`
Verify: `sqlite3 app/public/bible.db "SELECT COUNT(*) FROM study_notes;"` → ~16923.

- [ ] **Step 9: Commit**

```bash
cd /Users/justinleong/Desktop/Coding/DeepVerse
git add build/lib/studynotes.mjs build/build-db.mjs docs/ATTRIBUTIONS.md
git commit -m "feat(context): load Tyndale study notes into study_notes table

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Query layer + tests

**Files:**
- Modify: `app/src/lib/db.js`
- Modify: `app/src/lib/db.queries.test.js`

**Interfaces:**
- Consumes: `study_notes` table (from Task 2), the existing `query(sql, params)` helper.
- Produces: `getStudyNotes(book, chapter, verse) -> [{ ref, osis_ref, body }]`;
  `getChapterStudyNoteCount(book, chapter) -> number`

- [ ] **Step 1: Write the failing tests**

In `app/src/lib/db.queries.test.js`, add a new `describe` block (mirror the existing `chapter recap` block's style and db setup):

```js
describe('study notes', () => {
  test('getChapterStudyNoteCount: annotated vs bare chapters', () => {
    expect(db.getChapterStudyNoteCount('Gen', 1)).toBe(19);
    expect(db.getChapterStudyNoteCount('1Chr', 26)).toBe(0);
  });
  test('getStudyNotes: verse-specific note (Ruth 2:2 gleaning)', () => {
    const notes = db.getStudyNotes('Ruth', 2, 2);
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.some(n => /glean/i.test(n.body))).toBe(true);
  });
  test('getStudyNotes: covering model — a mid-passage verse gets the passage note', () => {
    // Gen.1.1-2.3 covers Gen 1:10 even though no note starts at 1:10
    const notes = db.getStudyNotes('Gen', 1, 10);
    expect(notes.some(n => n.osis_ref === 'Gen.1.1-2.3')).toBe(true);
  });
  test('getStudyNotes: bare chapter returns []', () => {
    expect(db.getStudyNotes('1Chr', 26, 1)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run src/lib/db.queries.test.js`
Expected: FAIL — `db.getStudyNotes is not a function`.

- [ ] **Step 3: Implement the queries in `app/src/lib/db.js`**

Add (near `getChapterRecap`, following the same style):

```js
export function getStudyNotes(book, chapter, verse) {
  const key = chapter * 1000 + verse;
  return query(
    `SELECT ref, osis_ref, body FROM study_notes
       WHERE book = ?
         AND (start_chapter*1000 + start_verse) <= ?
         AND (end_chapter*1000   + end_verse)   >= ?
     ORDER BY (start_chapter*1000 + start_verse), seq`,
    [book, key, key]);
}

export function getChapterStudyNoteCount(book, chapter) {
  return query(
    `SELECT COUNT(*) AS n FROM study_notes
       WHERE book = ? AND start_chapter <= ? AND end_chapter >= ?`,
    [book, chapter, chapter])[0].n;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run src/lib/db.queries.test.js`
Expected: PASS (existing 35 + 4 new = 39).

- [ ] **Step 5: Commit**

```bash
cd /Users/justinleong/Desktop/Coding/DeepVerse
git add app/src/lib/db.js app/src/lib/db.queries.test.js
git commit -m "feat(context): getStudyNotes + getChapterStudyNoteCount queries

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Study Notes section in the Context tab

**Files:**
- Modify: `app/src/components/workbench/ContextCard.svelte`

**Interfaces:**
- Consumes: `getStudyNotes`, `getChapterStudyNoteCount` (from Task 3), the `study` store (`study.book`, `study.chapter`, `study.verse`), `bookName` from `refs.js`.

- [ ] **Step 1: Import the queries**

In the `<script>` of `ContextCard.svelte`, add `getStudyNotes, getChapterStudyNoteCount` to the existing import from `'../../lib/db.js'`.

- [ ] **Step 2: Add derived state**

After the existing recap/entity derived state:

```js
let noteCount = $derived(getChapterStudyNoteCount(study.book, study.chapter));
let studyNotes = $derived(study.verse == null ? [] : getStudyNotes(study.book, study.chapter, study.verse));
```

- [ ] **Step 3: Render the section**

In the Context tab markup, AFTER the People/Places/Events block and its closing, add:

```svelte
<div class="grp studynotes">
  <div class="grplbl">Study Notes {#if noteCount > 0}<span class="sub">· {noteCount} in this chapter</span>{/if}</div>
  {#if noteCount === 0}
    <div class="empty">No study notes for this chapter.</div>
  {:else if study.verse == null}
    <div class="empty">Select a verse to read its notes.</div>
  {:else if studyNotes.length === 0}
    <div class="empty">No study note for this verse.</div>
  {:else}
    {#each studyNotes as n}
      <div class="snote">
        <div class="snref">{n.ref}</div>
        <p class="snbody">{n.body}</p>
      </div>
    {/each}
  {/if}
  <div class="snsrc">Tyndale Open Study Notes · CC BY-SA 4.0</div>
</div>
```

- [ ] **Step 4: Add styles**

In the `<style>` block (reuse existing vars):

```css
  .studynotes { border-top: 1px solid var(--rule); margin-top: 6px; padding-top: 8px; }
  .snote { margin: 6px 0; }
  .snref { font-size: 11px; color: var(--b); font-weight: 600; }
  .snbody { font-size: 12px; line-height: 1.55; color: var(--ink); white-space: pre-wrap; margin: 2px 0 0; }
  .snsrc { margin-top: 6px; font-size: 10.5px; color: var(--dim); }
```

(If `.empty` and `.sub` are already defined in this component, reuse them — do not redefine.)

- [ ] **Step 5: Build the app to verify it compiles**

Run: `cd app && npm run build`
Expected: `✓ built …`, no Svelte errors.

- [ ] **Step 6: Full app test suite (no regressions)**

Run: `cd app && npx vitest run`
Expected: all pass (previous 87 + 4 new = 91).

- [ ] **Step 7: Commit**

```bash
cd /Users/justinleong/Desktop/Coding/DeepVerse
git add app/src/components/workbench/ContextCard.svelte
git commit -m "feat(context): show Tyndale study notes in the Context tab

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Visual verification in the running app

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server (fresh port to avoid a cached bible.db)**

Run (background): `cd app && npm run dev -- --port 5210 --strictPort`
Wait for `localhost:5210`.

- [ ] **Step 2: Drive the Context tab**

Navigate to `http://localhost:5210/#/study/Ruth/2/2`, open the "Context & cross-references" card, switch to the **Context** tab. Confirm:
- The **Study Notes** section appears below People/Places/Events, header shows `Study Notes · N in this chapter`.
- Ruth 2:2 shows a note with span `2:2` and a body about gleaning.
- Navigate to `Gen/1/10` — the passage note `1:1–2:3` appears (covering model).
- Navigate to `1Chr/26/1` — section shows `No study notes for this chapter.`
- With no verse selected (`Gen/1`), the section shows `Select a verse to read its notes.`
- The reader pane has **no** new markers.

- [ ] **Step 3: Screenshot + confirm, then stop the server**

Capture a screenshot of the Study Notes section for the record; stop the dev server. No commit (verification only).

---

## Notes for the implementer

- Run every command from the stated directory (`build/`, `app/`, or repo root).
- The source XML is already on disk at `sources/tyndale/…/StudyNotes.xml` (gitignored) — Task 1 reads it directly.
- `bible.db` and `app/public/bible.db` are gitignored build artifacts; never commit them. Committed data is only `build/data/studynotes.json`.
- If the parse count deviates a lot from 16,923, inspect the skipped items before proceeding (a few skips from malformed refs are fine).
