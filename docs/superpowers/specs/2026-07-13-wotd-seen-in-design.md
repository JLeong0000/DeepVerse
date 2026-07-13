# Word of the Day — "Seen in" occurrences

## Goal

Show a couple of real places the Word-of-the-Day word is used, as clickable
verse links. Clicking scrolls to the verse in Study and opens that word's
study card.

## Behavior

The card's bottom section becomes a two-column grid:

- **Left — "Other interpretations"**: the existing sense chips, unchanged.
- **Right — "Seen in"**: 2–3 clickable links, **one representative verse per
  top sense**, so the reader sees the *same* word rendered differently across
  scripture. Each link reads: `"good" — Matt 5:45 →`.

Clicking a link calls
`openStudy({ version:'NIV', book, chapter, verse, word: { position } })`, which
scrolls to the verse and pre-selects the interlinear word so its
original-language card opens (existing Study behavior — see `Study.svelte:21`).

The top region (original word / count / featured sense + definition) is
unchanged.

## Data — `app/src/lib/db.js`

New export `getWordOccurrences(strongs, senses, limit = 3)`:

- For each sense (in the given order — already sorted by count desc), find the
  first `words` row where `strongs` matches and `gloss_norm` equals the sense's
  **raw** `gloss`. (Sense glosses are themselves `gloss_norm` values produced at
  build time, so this is a direct equality match — `cleanGloss` is display-only
  and must NOT be applied to the match key.) Order occurrences canonically
  (`refs.bookOrder`, then chapter, verse) so the pick is stable.
- Return `{ ref: { version:'NIV', book, chapter, verse }, gloss, position }`
  per pick (`gloss` = the raw occurrence gloss for display via `cleanGloss`),
  deduped by verse, capped at `limit`.
- If senses yield fewer than 2 picks, backfill with the first occurrences of
  the lemma (any gloss).

`getWordOfDay` is unchanged; it already returns `strongs` and `senses`, so
`WordOfDay.svelte` calls `getWordOccurrences` itself.

## UI — `app/src/components/home/WordOfDay.svelte`

- Compute `const seen = getWordOccurrences(w.strongs, senses)`.
- Replace the single full-width `.others` block with a two-column grid:
  `Other interpretations | Seen in`. Collapses to one column on narrow cards
  (reuse the existing `@container` breakpoint pattern).
- Each "Seen in" row is a `<button>` styled like the existing `.ref` jump
  buttons (small-caps, accent color, underline on hover), showing the gloss in
  quotes, `formatRef(occ.ref)`, and a `→`.

## Home — `app/src/routes/Home.svelte`

- Remove `<HiddenTreasures />` and its import. (The component file stays in the
  tree; only the Home usage is removed.)

## Out of scope

- One representative verse per sense (not multiple verses per sense).
- No new DB columns or changes to `getWordOfDay`.
- Book names via existing `formatRef` (abbreviations).
