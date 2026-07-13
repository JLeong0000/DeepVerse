# Word of the Day — "Seen in" occurrences

## Goal

Show a couple of real places the Word-of-the-Day word is used, as clickable
verse links. Clicking scrolls to the verse in Study and opens that word's
study card.

## Behavior

The card's bottom section becomes a two-column grid, one row per **other
interpretation**:

- **Left — "Other interpretations"**: the existing sense chips (`"boards" 3×`).
- **Right — "Seen in"**: for each interpretation, a clickable verse link to a
  place the word is rendered that way (`Exodus 27:8 →`). The link does **not**
  repeat the gloss — the chip in the same row already carries it.

Clicking a link calls
`openStudy({ version:'NIV', book, chapter, verse, word: { position } })`, which
scrolls to the verse and pre-selects the interlinear word so its
original-language card opens (existing Study behavior — see `Study.svelte:21`).

The top region (original word / count / featured sense + definition) is
unchanged.

## Data — `app/src/lib/db.js`

New export `getSenseOccurrence(strongs, senseGloss)`:

- Return the first canonical (`refs.bookOrder`, then chapter, verse) `words`
  row where `strongs` matches and `gloss_norm` equals the **raw** sense gloss.
  (Sense glosses are themselves `gloss_norm` values produced at build time, so
  this is a direct equality match — `cleanGloss` is display-only and must NOT be
  applied to the match key.)
- Shape: `{ ref: { version:'NIV', book, chapter, verse }, position }`, or `null`
  if the sense has no occurrence.

`getWordOfDay` is unchanged; it already returns `strongs` and `senses`, so
`WordOfDay.svelte` looks up an occurrence per "other interpretation" itself.

## UI — `app/src/components/home/WordOfDay.svelte`

- Attach an occurrence to each non-top sense:
  `rest = w.senses.slice(1).map(s => ({ ...cleaned, occ: getSenseOccurrence(w.strongs, s.gloss) }))`.
- Replace the single full-width `.others` block with a two-column grid
  (`auto 1fr`): a `Other interpretations | Seen in` header row, then one row per
  interpretation — chip in the left cell, verse-link `<button>` in the right.
- The verse `<button>` is styled like the existing `.ref` jump buttons (accent
  color, underline on hover), showing `formatRef(occ.ref)` and a `→`. If a sense
  has no occurrence, show a `—` placeholder.

## Home — `app/src/routes/Home.svelte`

- Remove `<HiddenTreasures />` and its import. (The component file stays in the
  tree; only the Home usage is removed.)

## Out of scope

- One representative verse per interpretation (not multiple verses per sense).
- The featured/top sense gets no "seen in" link — only the other
  interpretations do.
- No new DB columns or changes to `getWordOfDay`.
- Book names via existing `formatRef` (abbreviations).
