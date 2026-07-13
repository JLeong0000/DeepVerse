# Word Search (Word-of-the-Day card) — Design

Date: 2026-07-13
Branch: notes-groups

## Goal

Add an English-word search to the Word-of-the-Day (WotD) card. Typing an English
word suggests the Hebrew/Greek lemmas that are actually translated that way in the
Bible. Selecting a suggestion opens a detail view showing, for that lemma:

1. The lexicon explanation (dictionary definition).
2. Text-to-voice (the existing `PlayButton`).
3. How else the word is rendered in English (its sense spread).
4. The verses where it is used, grouped under each sense and linkable into Study.

Items 3 and 4 are merged into one structure: each English sense is a group header
(with its occurrence count), and the linkable verses hang beneath it.

## Entry point

A search button (🔍) is added to the `.head` row of `WordOfDay.svelte`, next to the
existing `B · sense-spread` tag. Clicking it opens a modal overlay. The button is only
present on Home (where the WotD card lives). If `getWordOfDay()` returns null the card
does not render and neither does the button — acceptable (search is an affordance on the
card, not a global feature this iteration).

## Component: `components/home/WordSearch.svelte`

A single centered modal that follows the existing overlay conventions from
`NoteOverlay.svelte`: fixed `.backdrop` (click to close) + `.modal` (`--panel`/`--rule`
tokens, `fadeIn`/`pop` animations), `<svelte:window onkeydown>` for Escape. Props:
`{ onclose }`.

The modal has two internal states driven by local `$state`:

### Search state (default)

- A text `<input>` at the top, autofocused on open.
- Below it, a suggestion list rendered from `searchWords(query)`:
  each row shows `original · translit · "primary gloss" · N×` plus a small language tag
  (`langLabel`). Rows are buttons.
- Empty query → a muted hint line ("Type an English word…"). No results → "No words
  found for '…'".
- The query is debounced ~120ms before filtering (in-memory filter is cheap; debounce
  only avoids re-render thrash while typing fast).

Keyboard (combobox behavior — implemented as one unit):
- **↓ / ↑** move a highlight through the visible suggestions; the highlighted row is
  scrolled into view (`scrollIntoView({ block: 'nearest' })`). Highlight defaults to
  index 0 whenever the list changes.
- **Enter** opens the highlighted suggestion (so type-then-Enter opens the top match).
- **Escape** closes the overlay.

### Detail state

Entered by selecting a suggestion. Content comes from `getWordSenses(strongs)`:

- A back control (← arrow) returning to search state; on return, focus goes back to the
  input.
- Header: the lemma (`original`), `PlayButton` with `text={original} lang={lang}`, and
  the transliteration (`readTranslit`).
- The lexicon definition (`definition`). If absent, the definition block is omitted.
- Sense groups, ranked by count desc. Each group: `"gloss"  N×` header, then up to
  **8** linkable verse references (`formatRef`) in canonical order. If a group has more
  than 8, an **"and N more"** button appends the remainder inline (per-group expand
  state).
- Clicking a verse calls `openStudy({ ...ref, word: { position } })` then `onclose()` —
  identical to the WotD "seen in" links, so the interlinear word is pre-selected on jump.

Keyboard: **Escape** in detail state returns to search (does not close the overlay).

## Data layer (`lib/db.js`)

Two new exported functions, backed by one memoized in-memory index (same pattern as the
existing `_wordFreq` memo). Rationale: `words.gloss_norm` has no SQL index, so a `LIKE`
scan of 447k rows per keystroke would be janky. Build the index once, filter it in JS.

### `_wordIndex` (module-private, memoized)

Reset to `null` in `_setDbForTest` alongside `_wordFreq`.

Built lazily on first use from two queries:

1. Lexicon map: `SELECT code, lemma, translit, lang, definition FROM lexicon`.
2. Sense aggregation:
   `SELECT strongs, gloss_norm, lang, COUNT(*) n FROM words WHERE strongs<>'' GROUP BY strongs, gloss_norm`.

Aggregated into `Map<strongs, entry>` where each `entry` is:

```
{
  strongs,
  lang,                      // language of the words rows
  lemma, translit, definition,   // from lexicon (with homograph-letter fallback, as getLexicon does)
  original,                  // display form: lemma if present, else the highest-count gloss_norm's original
  total,                     // sum of all sense counts
  senses: [{ gloss, count }] // grouped by raw gloss_norm, sorted count desc
  searchText                 // lowercased join of all gloss_norm values, for substring matching
}
```

Lexicon display fields use the same homograph fallback as `getLexicon` (strip a trailing
letter, e.g. `G0996G` → `G0996`). If no lexicon row exists, `lemma`/`translit`/`definition`
fall back to empty and `original` uses a representative word form (pull `MIN(original)` per
strongs in the sense query, kept only for this fallback).

### `searchWords(query)`

- Normalize `query` to lowercase, trim. If shorter than 2 chars, return `[]`.
- Filter `_wordIndex` entries whose `searchText` contains the query as a substring.
- Rank by `total` desc; return the top **12** as
  `[{ strongs, original, translit, lang, gloss, total }]` where `gloss` is the entry's
  top sense (`senses[0].gloss`).

### `getWordSenses(strongs)`

- Look up the memo entry for display fields (`lemma`, `translit`, `lang`, `original`,
  `definition`, `total`).
- Query occurrences:
  `SELECT gloss_norm, book, chapter, verse, position FROM words WHERE strongs=?`.
- Group by `gloss_norm`; within each group collect
  `{ ref: { version: 'NIV', book, chapter, verse }, position }`, sorted canonically
  (`bookOrder` → chapter → verse, as `getSenseOccurrence` does).
- Sort groups by occurrence count desc.
- Return
  `{ original, translit, lang, definition, total, senses: [{ gloss, count, occurrences }] }`.

`getLexicon`, `PlayButton`, `openStudy`, `formatRef`, `langLabel`, `readTranslit`,
`cleanGloss` already exist and are reused.

## Grouping semantics & known limitation

Senses are grouped by **raw `gloss_norm`** with no stemming or clustering. For nouns this
is clean (ψυχή → "soul" 41×, "life" 35×, "souls" 18×). For verbs, `gloss_norm` embeds
inflection and auxiliaries, so a single lemma fragments into many near-duplicate senses
(ἀγαπάω → "loving" 21×, "loved" 13×, "love" 12×, "you will love" 10×, …). This is accepted
for this iteration: frequency ranking floats the meaningful renderings to the top and the
per-group "and N more" plus the suggestion cap keep the panel bounded. Sense clustering
(à la the build-side `senseKey`) is a possible future refinement and is out of scope here.

## Out of scope (YAGNI)

No shipped SQL index on `gloss_norm` (the in-memory memo covers it); no fuzzy/stemmed
matching; no search history; no language filter; no global (app-nav) search entry point.

## Testing

Add to `app/src/lib/db.queries.test.js`, exercised against the real shipped db like the
existing query tests:

- `searchWords('love')` surfaces G0026 (ἀγάπη) and G5368 (φιλέω); results ranked by
  `total` desc; capped at 12; `searchWords('l')` returns `[]` (min length).
- `searchWords('life')` surfaces G5590 (ψυχή) — verifies broad match against secondary
  senses, not just the primary lexicon gloss.
- `getWordSenses('G5590')` groups into "soul" and "life" with counts matching the db,
  senses sorted by count desc, occurrences in canonical order and shaped
  `{ ref, position }`.

## Verification

- `cd app && npx vitest run` — new + existing tests green.
- `cd app && npx vite build` — exits 0.
- Browser smoke: open Home, click the WotD search icon, type "love", arrow to a
  suggestion, Enter, confirm definition + PlayButton + sense groups + a working verse
  link into Study.
