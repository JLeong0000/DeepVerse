# "See other instances" (Original card, Study mode) — Design

Date: 2026-07-13
Branch: notes-groups

## Goal

In Study mode, at the end of the selected-word description in the Original card
(`OriginalCard.svelte`), add a "See other instances →" button. Clicking it opens an
overlay listing the verses where that word (Strong's lemma) appears — grouped by English
sense, reference-only, each clickable — excluding the current verse.

This reuses `getWordSenses(strongs)` (built for the Word-of-the-Day search) and the
grouped-verse rendering from that feature.

## Entry point

`OriginalCard.svelte` already shows a word detail (`.wdetail`) when a word is selected,
ending with:

```
Occurs {total}× in the Bible ({books} books)
```

Add a "See other instances →" button immediately after that line. Show it only when the
word occurs outside the current verse:

```
occInThisVerse = words.filter(w => w.strongs === detail.word.strongs).length  // words = interlinear already loaded
hasOthers      = detail.conc.total > occInThisVerse
```

No extra query — `words` (the current verse's interlinear) and `detail.conc.total` (from
`countLemma`) are already in the component.

## Overlay: `components/workbench/WordInstances.svelte` (new)

Props: `{ strongs, original, ref, onclose }` where `ref = { book, chapter, verse }` is the
current verse.

- Centered modal following the existing overlay conventions (`NoteOverlay.svelte`): fixed
  `.backdrop` (click to close) + `.modal`, `fadeIn`/`pop` animations, `<svelte:window
  onkeydown>` for Escape.
- Header: the word (`original`) + a muted "other instances · {total}" count.
- Body: `<SenseVerses senses={senses} onjump={jump} />` (shared component below).
- Data: call `getWordSenses(strongs)`; for each sense, filter its `occurrences` to drop any
  whose `ref` matches the current verse (book+chapter+verse), recompute `count` from the
  filtered length, and drop senses that become empty. `total` = sum of remaining counts.
- `jump(occ)` → `openStudy({ ...occ.ref, word: { position: occ.position } })` then
  `onclose()`. (In Study mode this re-targets the reader to the new verse and pre-selects
  the word.)

## Shared component: `components/common/SenseVerses.svelte` (new, extracted)

The grouped-verse rendering currently lives inline in `WordSearch.svelte`. Extract it
verbatim (markup + `expanded`/`SHOWN` expand state + styles) into a presentational
component so both the search detail and the new overlay use it — no duplication.

Props: `{ senses, onjump }` where `senses = [{ gloss, count, occurrences: [{ ref, position }] }]`.

- Renders each sense: `"gloss"  N×` header, then up to `SHOWN = 8` reference-only links
  (`formatRef`), with an "and N more" button that expands the group inline.
- Owns its own per-group `expanded` state (previously in `WordSearch`).
- `cleanGloss` applied to the gloss for display, as `WordSearch` did.

### `WordSearch.svelte` refactor

Replace the inline `.senses`/`.sense`/`.verses` markup and the `expanded`/`expand`/`SHOWN`
state + related styles with `<SenseVerses senses={selected.senses} onjump={jump} />`. The
`jump` function and detail header/definition rendering are unchanged. Behavior is identical.

## Second entry point: Differences card sense chips

The Differences card's B · sense-spread chips (e.g. "keep 20×", "guard 7×") open the same
`WordInstances` overlay for that word. Each `.schip` becomes a `<button>` that sets
`instancesFor = { strongs, original }` from the row; the overlay renders with the current
verse excluded, identical to the Original-card path.

Note the grouping nuance: the chips show *sense-clustered* counts (build-side `senseKey`),
while `getWordSenses` groups by *raw* `gloss_norm`, so the overlay's groups/counts are finer
than the chip that opened it. This is intentional — the overlay shows exactly where the word
appears rendered each way. Documented, not reconciled.

## Routing fix (required for these overlays)

`Study.svelte` previously applied `route.params` only in `onMount`, so `openStudy` jumps did
nothing when Study was already the active view — which is exactly the case for these overlays'
verse links. Changed the `onMount` to a `$effect` on `route.params` so a jump applies whether
or not Study is already mounted. `openStudy` is otherwise unchanged; Home/word-of-day/notes
jumps are unaffected (they still trigger the same effect on mount).

## Out of scope (YAGNI)

No verse-text previews (reference-only per decision); no new data-layer query (the current-
verse filter is a few lines in `WordInstances`); no server-side recomputation of counts.

## Verification

- `cd app && npx vitest run` — existing suite green (no data-layer change; `getWordSenses`
  already covered).
- `cd app && npx vite build` — exits 0.
- Browser smoke (Study mode): open a chapter with a recurring word, tap it in the
  interlinear, confirm "See other instances →" appears, opens the overlay with sense-grouped
  verses that exclude the current verse, "and N more" expands, and a verse link jumps the
  reader and pre-selects the word. Confirm the button is absent for a word that only occurs
  in the current verse. Re-verify the Word-of-the-Day search detail still renders verses
  correctly after the `SenseVerses` extraction.
