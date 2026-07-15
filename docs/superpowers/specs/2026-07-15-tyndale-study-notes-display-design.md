# Tyndale Study Notes — display design

**Date:** 2026-07-15
**Status:** approved design, pending implementation plan
**Branch:** feat/context-tab

## Goal

Surface all 16,923 Tyndale Open Study Notes (verse/passage-keyed Bible study notes,
CC BY-SA 4.0) in the DeepVerse study webapp **without crowding the reader** and **without
omitting any note**. Notes are shown verse-by-verse, inside the existing Context tab.

## Decisions (from brainstorming)

1. **Interaction model:** verse-driven — a note appears when its verse is selected (like the
   Differences / Cross-references cards), not laid over the reading text.
2. **Placement:** inside the existing **Context tab** of the "Context & cross-references" card,
   below the chapter-level content.
3. **Range model — cover every verse:** a note whose ref is a range (e.g. `Gen.1.1–2.3`) is shown
   for **every** verse in that range, not only its start verse.
4. **Reader stays clean:** **no per-verse markers.** Discoverability is chapter-level (a count),
   because coverage is near-total in annotated chapters (a passage note like `Gen.1.1–2.3` spans a
   whole section) — per-verse dots would light up almost every verse and reintroduce clutter.
5. **Each note shows its span:** every note displays the verse range it covers (e.g. `1:1–2:3`,
   `1:16`).

## Layout (Context tab)

Order within the tab:

```
Recap                       ← chapter (Bible Summary)
People · Places · Events    ← chapter (Theographic)
──────────────────────────
Study Notes · N in chapter  ← verse-driven (Tyndale)   [this feature]
```

### Study Notes section — states

- **Header:** `Study Notes · N in this chapter`, where N = number of distinct notes overlapping the
  current chapter. When N = 0: show a quiet `No study notes for this chapter.` and nothing else.
- **Verse selected, ≥1 covering note:** render each note that covers the verse. Each note shows:
  - its **span label** (the display ref, e.g. `1:1–2:3` or `1:16`) as a small heading, and
  - the note **body**.
  - Multiple covering notes are ordered **broadest/earliest first** (by start ref, then file order):
    a passage-overview note appears above the verse-specific note.
- **Verse selected, no covering note:** `No study note for this verse.` (rare in annotated chapters).
- **No verse selected:** `Select a verse to read its notes.` (plus the header count).
- **Attribution:** a subtle `Tyndale Open Study Notes · CC BY-SA 4.0` label at the foot of the section
  (satisfies the license; see Attribution below).

The **reader pane is unchanged** — no markers, no inline notes.

## Data layer

### Source
`sources/tyndale/Tyndale Open Study Notes/StudyNotes.xml` (gitignored; downloaded from
tyndaleopenresources.com, CC BY-SA 4.0). 16,923 `<item>` records, each:
```xml
<item name="Gen.1.6-8" typename="StudyNote" product="TyndaleOpenStudyNotes">
  <refs>Gen.1.6-8</refs>
  <body><p class="sn-text"><span class="sn-ref"><a href="?bref=Gen.1.6-8">1:6-8</a></span> …text…</p></body>
</item>
```
Book codes are OSIS, matching `verses.book`. Ranges are single-verse, same-chapter (`Gen.1.6-8`), or
cross-chapter (`Gen.1.1-2.3`). No cross-book ranges exist (verified: 0).

### Parse step (run once → committed JSON)
`build/parse-studynotes.mjs` reads the XML and writes committed `build/data/studynotes.json`
(an array of note objects). Committed because Tyndale is openly licensed and this gives a
self-contained build (no network, matching the recap approach). Per note:
- Parse `name`/`refs` OSIS ref into bounds: `book`, `start_chapter`, `start_verse`,
  `end_chapter`, `end_verse` (a single verse has start == end).
- Extract the display **ref** from the leading `<span class="sn-ref">…</span>` (e.g. `1:6-8`), then
  remove that span from the body.
- **Clean the body:** convert `<a href="?bref=…">TEXT</a>` → `TEXT`; strip remaining tags and class
  markup; decode HTML entities; normalize whitespace; preserve the `•` bullets used for sub-points
  and the Bible-excerpt phrase (`span.sn-excerpt`) inline as text.
- `seq` = file order (for stable ordering of notes sharing a start).

Object shape: `{ book, start_chapter, start_verse, end_chapter, end_verse, ref, osis_ref, body, seq }`.

### Table (built by `build/build-db.mjs`)
```sql
CREATE TABLE study_notes (
  book TEXT NOT NULL,
  start_chapter INTEGER NOT NULL, start_verse INTEGER NOT NULL,
  end_chapter INTEGER NOT NULL, end_verse INTEGER NOT NULL,
  ref TEXT NOT NULL,        -- display span, e.g. "1:1–2:3"
  osis_ref TEXT NOT NULL,   -- raw, e.g. "Gen.1.1-2.3"
  body TEXT NOT NULL,
  seq INTEGER NOT NULL
);
CREATE INDEX idx_study_notes ON study_notes(book, start_chapter, end_chapter);
```
A `loadStudyNotes(db)` loader (in `build/lib/`) reads `build/data/studynotes.json` and inserts,
following the existing `tx()` / prepared-statement pattern, logging the row count.

Sort key convention: `sortkey(ch, v) = ch*1000 + v` (max verses/chapter is 176, so 1000 is safe).

### Queries (`app/src/lib/db.js`)
- `getStudyNotes(book, chapter, verse)` → notes covering the verse, ordered broadest/earliest first:
  ```sql
  SELECT ref, osis_ref, body FROM study_notes
  WHERE book = ?
    AND (start_chapter*1000 + start_verse) <= ?      -- ch*1000+verse
    AND (end_chapter*1000   + end_verse)   >= ?
  ORDER BY (start_chapter*1000 + start_verse), seq
  ```
- `getChapterStudyNoteCount(book, chapter)` → distinct notes overlapping the chapter:
  ```sql
  SELECT COUNT(*) AS n FROM study_notes
  WHERE book = ? AND start_chapter <= ? AND end_chapter >= ?
  ```

## UI (`app/src/components/workbench/ContextCard.svelte`)

Extend the Context tab (Svelte 5 runes), matching existing card styling (`--dim`, `--ink`, `--rule`,
`.grp`/`.grplbl` patterns):
- `$derived` count via `getChapterStudyNoteCount(study.book, study.chapter)`.
- `$derived` notes via `getStudyNotes(study.book, study.chapter, study.verse)` when `study.verse != null`.
- Render the section per the states above, after the People/Places/Events block, separated by a rule.
- Each note: a small span-label heading (`ref`) + body paragraph (`white-space: pre-wrap` to keep
  bullet structure). Long bodies are shown in full (study notes are short-to-medium; no truncation
  needed, unlike the recap).

## Attribution (CC BY-SA 4.0)

- In-app: the `Tyndale Open Study Notes · CC BY-SA 4.0` label on the section.
- `docs/ATTRIBUTIONS.md`: add an entry — Tyndale Open Study Notes, © 2022 Tyndale House Publishers,
  CC BY-SA 4.0, source tyndaleopenresources.com, used for per-verse study notes (`study_notes` table).
  Note the ShareAlike obligation applies to the derived note data (attribute + keep BY-SA), not the
  app code. Perspective is evangelical/conservative — acceptable, disclosed via the source label.

## Testing

- **Parse:** unit-check that sample refs parse to correct bounds — `Gen.1.16` → (1,16,1,16),
  `Gen.1.6-8` → (1,6,1,8), `Gen.1.1-2.3` → (1,1,2,3); and that a body is cleaned (no tags, entities
  decoded, sn-ref removed).
- **Queries (vitest, db.queries.test.js):**
  - `getChapterStudyNoteCount('Gen', 1)` = 19; `('1Chr', 26)` = 0.
  - `getStudyNotes('Ruth', 2, 2)` returns the gleaning note (`Lev 19:9-10` appears in body).
  - `getStudyNotes('Gen', 1, 10)` includes the passage note `Gen.1.1-2.3` (covering model works).
  - `getStudyNotes('1Chr', 26, 1)` = [] (bare chapter).
- **Build:** `study_notes` row count logged; `npm run build` validation OK; existing build + app
  tests still pass; app copy contains the table.
- **Visual:** run the app; confirm the Study Notes section renders the count, a selected verse's
  notes with span labels, and the empty states, and that the reader is unchanged.

## Non-goals / future

- Clickable scripture references inside note bodies (jump to ref) — kept as plain text for v1.
- The other Tyndale content — BookIntroSummaries (could enrich the chapter header), ThemeNotes
  (a "themes in this chapter" section), Profiles, and the Dictionary — are **out of scope here**;
  they are natural follow-on additions using the same join approach.
- Reader-pane markers (explicitly rejected).
