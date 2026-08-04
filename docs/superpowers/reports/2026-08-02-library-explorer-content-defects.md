# Content defects fixed without consultation — `#/library` (Phase 2)

**Branch:** `feat/library-explorer` · 36 commits, `6ed3f83..44aecd0`
**Scope of this list:** user-facing defects **about the content** that I ruled on myself, without asking.

**Excluded deliberately:**
- The `dict_xref` supplement-widening decision — that one *was* escalated and you chose it.
- Code quality, performance, test structure, prop design, CSS duplication.
- Anything still deferred (listed at the end, so this isn't a victory lap).

Every scale figure below was verified by querying `bible.db`, not estimated.

---

## 1. The app or its docs asserted things about the corpus that were false

### 1.1 Four fabricated verse counts on the start page
The plan **and** the approved mockup both claimed `Nazarite*, Nazirite` cites 19 verses, `Babylon, Babylonia` 118, `Shepherd` 41, `Beast` 34.

Real figures: **11, 7, 31, 26.**

I verified this independently rather than accepting the implementer's finding — `n_refs`, the `dict_verse` row count and the distinct-verse count all agree, so there was no metric ambiguity to hide behind. These were invented.

### 1.2 The mockup was 21 wrong claims out of 137
After 1.1, I ordered a full audit of every database-checkable claim in `docs/mockups/library.html` rather than patching only the four that were pointed at. Result: **137 claims audited, 21 wrong.**

- **All ten** per-article citation counts — some off by 6×
- The `dict_xref` headline statistics
- Five profile references, two "also a dictionary article" flags
- **A title that does not exist in the corpus**: `Command`. The real entry is `Command, Commandment`.

The mockup's own subtitle read *"Every citation figure is real, queried from `data/bible.db`. Nothing is invented."*

### 1.3 Three articles declared real articles non-existent
`Garlic`, `Jerubbesheth` and `Jezaniah` showed the tooltip *"named by the source, but no such article exists"* over `Food and Food Preparation` and `Plants (Onion)` — **both of which exist.**

### 1.4 …and simultaneously said they named nothing at all
The same three pages rendered *"A dead end — this article names no other entry"* directly beneath a visible sentence naming two entries. Two contradictory falsehoods on one screen. Caught only by the whole-branch review, because each half came from a different task.

### 1.5 The book hub inflated a count by up to 73×
`Dictionary articles citing this book most · 12` used the same `· N` grammar as the true totals beside it (`Themes anchored here · 8`). The 12 was a SQL `LIMIT`. The real figures: **263** for Revelation, **874** for Genesis.

### 1.6 Search counts overclaimed, twice
The plan rendered `Dictionary · 20` when ~300 articles matched — overstating precision. The first fix replaced it with `20+`, which overstated quantity: searching `zeb` returns *exactly* 20 with nothing hidden, and it still said `20+`. Now honest in both directions, verified against corpus terms the reviewer chose rather than the ones it was handed.

---

## 2. Tyndale's own text was rendered wrongly

### 2.1 791 articles had the spaces stripped out of their cross-references
`See Antichrist;Armageddon;Mark of the Beast;Revelation, Book of.` — the separator space was consumed by Svelte's whitespace handling. **805 clauses across 791 articles.**

The Study tab's existing renderer produced `; ` correctly, so the new library renderer *corrupted the source text where the renderer it replaced did not*.

### 2.2 All 66 book introductions leaked raw markdown
Clicking "Read more" on any book hub printed literal `## Setting`, `## Summary`, `## Author`, `## Date and Destination` inline in the prose. Every one of the 66 `book_intros.intro` rows carries those subheads.

It survived because the *collapsed* preview stripped them correctly — the implementer confirmed the text appeared without noticing it was malformed.

### 2.3 The three orphan charts rendered as raw markup
Opening a chart supplement printed `<table> <tr> <td> Order </td>…` as visible text.

---

## 3. Content the reader could not reach

### 3.1 `“I Am” Sayings` was invisible in the A–Z index
Its `sort_title` starts with a curly quote, so it fell into a 27th bucket the hardcoded `A–Z` rail never rendered — unreachable from **the one surface whose entire job is completeness.** Now has a `#` tab.

### 3.2 `Minister, Ministry` rendered as a full entry that is nothing but a redirect
A 121-character body consisting solely of a `See` clause, one character past the plan's `< 120` cutoff. I replaced the length proxy with a structural rule; the true bare-redirect count is **577, not the 576** stated in the spec.

### 3.3 The 13 orphaned supplements were listed as dead text
The spec calls out that nothing else in the app can reach them — and the plan then rendered them as non-clickable `<span>`s. Now buttons.

### 3.4 Book hub theme and profile chips were dead text
On the route the spec calls *"the one route where the data supports a destination,"* **8 of Revelation's 9 passage items were a cul-de-sac.** Task 11 built the hub before Task 12b made passages readable, and nobody went back.

### 3.5 Anchored doors never scrolled
A door reading `Animals § Cattle` opened `Animals` at the top, with the `Cattle` heading **7,828 px below the fold** among 62 headings. No other task owned this.

---

## 4. Content shown in the wrong place, or the wrong content

### 4.1 Verse previews opened under paragraphs that never cited the verse
**849 placements across 253 articles.** Block matching used `includes()`, so `Rom 5:1` matched a paragraph citing only `Rom 5:12–21`. Separately, **388 articles** showed the same preview duplicated — one click on `Animals` opened four identical boxes, two visible at once.

### 4.2 The `Rahab` profile linked to the sea monster
`LIMIT 1` over the non-unique `sort_title` picked `RahabMonster` instead of `RahabPerson` for the profile of the woman of Jericho. `Rahab` is the only ambiguous twin in the corpus.

### 4.3 `Book of Revelation` displayed as the raw code `Rev`
The breadcrumb printed the OSIS book code where the mockup shows the book name.

---

## 5. The breadcrumb's account of your route — a content claim in itself

### 5.1 Browser Back destroyed the trail
A six-step trail reading `Start › Dictionary·B › Beast › Antichrist › Book of Revelation` collapsed to `Start › Book of Revelation` on the **first** Back press, and every press after. Right article, false story about how you got there — in a feature whose stated principle is that the breadcrumb *is* the navigation stack.

Missed initially because a three-step test doesn't expose it; the collapse only shows from four steps in.

### 5.2 The path map was completely unclickable whenever it could pan
Pointer capture was acquired on every pointerdown, so Chromium retargeted the click away from the node. A plain click — no drag — did nothing. Branch-jump and spine-truncate were dead **exactly for the long trails that make a path map worth opening.**

### 5.3 Scripture-ref clicks silently moved your Study position
On two separate surfaces, clicking a reference produced no visible response while quietly repositioning the Study view. You'd see a dead click, then later open Study and find yourself somewhere you never chose. Both plan snippets omitted the same wiring.

### 5.4 Typing a search term created one history entry per keystroke
Typing `revelation` pushed **nine** entries. Backing out of a search meant scrubbing through your own typing.

---

## Not fixed — deliberately

> **Both of the first two were resolved after this report was written (2026-08-03). Kept, struck
> through, because the reasons they were deferred are the useful part.**

1. ~~**The build-side regex gap, 5 articles.**~~ ✅ **RESOLVED.** `BibleManuscriptsandTextoftheOldTestament` and `Brood` had a door with no matching inline link; `Garlic`, `Jerubbesheth`, `Jezaniah` fired the UI's clause regex where the build's did not, so `dict_xref` held no rows for them. The deferral reasoned that fixing it meant another rebuild plus re-deriving every pinned total. That is what happened — but for a different reason: the resolver was rebuilt on the source's own `?item=` link markup, and the clause regex that caused the gap was deleted rather than widened. All five now have edges (`Garlic` 2, the others 1 each). **The class of defect is gone, not just these five instances** — there is no longer a prose-level regex that can disagree with the markup.

2. ~~**Four verses absent from the NIV**~~ ✅ **MOSTLY RESOLVED**, and the item was miscounted: it says four and lists three. `Est 11:1` and `Est 12:1` are not Esther at all — they are the Additions to Esther, and now render as `AddEsth 11:1` / `12:1` from the KJVA text. `Acts 8:37` has NKJV text and is absent from the NIV as a genuine textual-variant omission, not a data gap; the reader sees the other versions.

3. **Five of the mockup's ten demo article bodies are paraphrased**, not corpus text, which cascades into its illustrative cross-reference graph. I ruled against rewriting them — hand-editing prose to match a source is itself a way to introduce errors — and instead scoped the mockup's "nothing is invented" claim to what is now true: counts, figures and titles are queried; demo bodies are abridged and their `See` clauses illustrative.

---

## The pattern

**The plan's own code contained a defect in nearly every one of the sixteen tasks.** Two independent surfaces shipped the same missing-`onnavigate` bug. A CSS selector (`:first-of-type`) that never matched anything was copied from the mockup into the plan. An SVG label was drawn outside its own viewBox.

More than once a test *claimed* to guard a fix and did not — the pointer-capture guard couldn't work because jsdom implements neither `PointerEvent` nor pointer capture, and a `toHaveLength(1)` assertion for a rule about *which step* a node attaches to never checked the step. Both were caught by deleting the fixed line and observing the suite stay green.
