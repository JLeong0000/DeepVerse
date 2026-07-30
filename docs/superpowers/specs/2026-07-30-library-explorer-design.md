# Library explorer (`#/library`) — design

**Date:** 2026-07-30
**Status:** approved design, pending implementation plan
**Phase:** 2 of the Tyndale cultural layer
**Follows:** `2026-07-29-tyndale-cultural-layer-design.md` (Phase 1, shipped at `51ae790`)
**Mockup:** `docs/mockups/library.html` — interactive, built from real `bible.db` content

## Goal

A browsable explorer for the Tyndale corpus already in `bible.db`: 6,010 dictionary articles, 298
theme articles, 125 profiles, 66 book introductions. Phase 1 surfaces all of it verse-first while
reading. This surfaces it **subject-first**, so the user can arrive with a question instead of
waiting for a verse to raise one.

**The objective is lookup, with wandering as the reward.** The user's framing was "a game with
multiple routes to completing the objective." Interrogating that produced two decisions that shape
everything below:

- **Arrive fast.** Search is the primary route and spans all four datasets at once.
- **Then wander.** Tyndale's own cross-references become the way through, and the trail you leave
  is navigable.

**Not a game.** No progress tracking, no read-marks, no coverage counters, no to-study integration.
The only state is a session trail and a small recently-viewed list. 6,010 articles makes "12 of
6,010 read" demoralising rather than motivating, and coverage was explicitly not the goal.

## What the data actually is

Five findings from probing `bible.db` reshaped the design. Recording them because each one
invalidates an assumption in the Phase 1 spec's Explorer section.

### 1. "Profiles — 125 people" is wrong

The 125 include `The Philistines`, `Assyria`, `Corinth`, `Hellenistic Kingdoms`, `The Medes and
Persians`, `Maccabees`. They are people **and peoples and places**. The UI says so rather than
claiming a roster of individuals.

### 2. The dictionary is 38% stubs

2,271 of 6,010 articles have bodies under 120 characters; **576 are bare `See X.` redirects**
(`Ulcer* → See Sore.`). A flat A–Z list is mostly redirect noise. The substantial corpus is
**1,839 articles** at ≥500 characters.

### 3. `sort_title` is not unique

**131 colliding groups, 265 articles.** `sort_title` strips the disambiguating parenthetical, so
`Asher (Person)`, `Asher (Place)` and `Asher (Tribe)` all sort as `asher`. Any index must
**display `title` and only sort by `sort_title`**, or it prints the same word three times.

### 4. There is a real cross-reference graph

Tyndale wrote 3,619 `See …` clauses naming 5,299 targets. Normalised the way `scripture.js`
normalises (curly apostrophes, the `*` marker, `#N` sense pointers, `See also`), **95.0% resolve**:

| tier | rule | resolved |
|---|---|---|
| 1 | exact normalised `title` | 4,940 |
| 2 | `sort_title` | 2 |
| 3 | a comma-delimited title segment claimed by exactly one article | 2 |
| 4 | `Article (Subhead)` → article + its `## Subhead` block | 92 |
| | **measured total** | **5,036 / 5,299 (95.0%)** |

A further **97 targets name a real article with an unmatched subhead** (`Plants (Vine)` where no
`## Vine` block exists). The measured 95.0% **excludes** them. The build should link them to the
host article with the anchor dropped — a correct, useful link — which lifts coverage above 95%;
the figure is stated conservatively so a later measurement cannot appear to regress.

Tier 3 exists for one visible case: `See Mark of the Beast.` resolves only as the second headword
of `Mark of God*, Mark of the Beast`. The remaining 5% are **genuine source defects** — `Jesus
Christ, Life and Teachings of` is cited 19 times and does not exist. They degrade to plain text.

### 5. The graph is not shaped like a map

| | |
|---|---|
| distinct edges | 5,052 |
| articles with ≥1 edge | 4,046 (67%) |
| **isolated articles** | **1,964 (33%)** |
| connected components | 602 |
| largest component | 2,478 |
| **second largest** | **15** |
| median degree | 1 (max 150, `Plants`) |

A whole-corpus graph view was rejected on these numbers: a third of the corpus would render as
floating dust, and the structure is one hairball plus 601 specks with no legible mid-scale shape.
Local neighbourhoods are the opposite — **1-hop median 2 nodes, p90 5** — which is what the path
map draws.

## Interface

Single column, **one surface at a time**, no sidebar. A persistent frame carries the search field
and the breadcrumb; the surface below it is the start page, a route's index, or an article.

```
        [ Search the library — press / to focus… ]        [✦ Wander in]

Start › Dictionary · B › Beast › Book of Revelation   3 DEEP    ⁂ View path map
────────────────────────────────────────────────────────────────────────────────
   the current surface, centred at max-width 1100px (matching Home.svelte's .page)
```

An earlier two-pane design (index rail + reading pane) was built and rejected: the rail could not
hold 6,010 entries legibly, and full width turns the dictionary index into a scannable three-column
letter grid.

### The breadcrumb is the navigation stack

There is no second source of truth. Every surface pushes a crumb; clicking a crumb truncates the
stack to it. This is also what makes browser back/forward correct for free.

- **No "return to start" control.** The `Start` crumb is it.
- **Search is a surface, not a mode.** Typing pushes a search crumb; clearing pops it.
- **Truncation** once the stack exceeds 6 crumbs, into 6 slots: first crumb, an expander, last four
  — `Start › … › D › E › F › G`. A stack of exactly 6 renders in full.
  `Start` and the current article always survive. The `…` carries a tooltip listing what is hidden
  and expands in place on click; any navigation re-collapses it. **Crumb buttons carry their real
  stack index, not their rendered position**, so truncation cannot misroute a click.
- **Depth badge** appears at 3+ articles deep. "1 deep" on every article is noise.

### The four routes

Each index is shaped to its dataset. Four datasets, four shapes — not four copies of one list.

| route | index | why |
|---|---|---|
| **Dictionary** 6,010 | A–Z letter grid, then a 3-column list of `title` + first-line gloss; the 576 pure redirects render as compact `Bed → Furniture` lines, not full rows | 38% stubs makes a flat list unreadable |
| **Themes** 298 | canonical order, grouped under book headings, anchor ref beside each | no taxonomy exists in the source; `book` and canonical position do |
| **Profiles** 125 | alphabetical, honestly labelled; the 84 with a same-title dictionary article show a second door | the data is not 125 people |
| **Books** 66 | a canonical grid opening onto a **hub** per book | the one route where the data supports a destination |

The **book hub** is `book_intros` (Purpose / Author / Date / Setting + long-form intro) plus every
theme and profile anchored in that book, plus the dictionary articles citing it most — ranked from
`dict_verse`, not a hand-made list. This is what makes "multiple routes to one objective" literal:
`Corinth` is reachable via Dictionary A–Z, the Profiles list, the 1 Corinthians hub, and a `See …`
hop from `Achaia`.

**Search spans all four**, grouped by kind. Making the user first guess which route holds the
answer would tax the primary objective. `/` focuses the field; ↑↓ and Enter traverse results, per
`WordSearch.svelte`.

### The article surface

- **Cross-references are linkified only inside a `See …` clause** — never in loose prose.
  `Calf`, `Clay`, `Hour`, `Evening` and `Command` are all real article titles; linkifying titles
  wherever they occur would turn every paragraph into a minefield. Tyndale wrote `See X.`
  deliberately; that is the only context safe to trust. Unresolvable targets stay plain text.
- **`See Animals (Cattle).` opens the article scrolled to its `## Cattle` block**, reusing
  `parseArticleBlocks` and the `focusId` mechanism `ArticleModal` already has for supplements.
- **Scripture refs expand an inline preview** (`getRefPreview`) directly beneath the block that
  names them, with an explicit **Open in Study →**. Leaving should be a decision, not a side effect
  of curiosity. A preview rendered at the foot of the article reads as unrelated content.
- **"Where this leads"** — a row of the article's outbound cross-references as explicit doors.
  This is what converts an article with links in it into a junction. Targets named by the source
  but absent from the corpus are listed honestly below the doors rather than hidden.
- **Dead ends say so.** Roughly a third of articles have no outbound links; an empty box reads as
  a bug, so it names the state and offers search, another route, or `✦ Wander in`.

### Scripture book titles read as names

Tyndale files books under an inverted headword — `Revelation, Book of` — which is right for an A–Z
index and wrong everywhere the title is used as a name.

**De-inversion runs off an exact allowlist of ten phrases, covering 62 articles:**
`Book of`, `Book of the`, `Books of`, `Books of First and Second`, `Gospel of`, `Letter of`,
`Letter to`, `Letter to the`, `Letters of`, `Letters to the`.

`Revelation, Book of` → **Book of Revelation**. `Chronicles, Books of First and Second` →
**Books of First and Second Chronicles**.

**A general de-inversion rule is not safe and must not be attempted.** The corpus contains unmarked
inversions (`Paulus, Sergius` → *Sergius Paulus*, `Calf, Golden` → *Golden Calf*, `Baca*, Valley
of`) that are indistinguishable from alternate spellings (`Elect, Election`, `Zidon*, Zidonian*`,
`Phares*, Pharez*`, `Banker, Banking`). Nothing in the data separates them. Same discipline as
`scripture.js`: an exact allowlist, never a prefix.

**The A–Z dictionary index keeps the source form**, because inversion is exactly what makes an
alphabetical browse work — `Book of Revelation` filed under R would be wrong. Every other surface
(heading, breadcrumb, doors, path map, search results, hub chips) shows the name form. This split
is deliberate and matches standard encyclopedia practice.

*Available safe extension, not in scope:* a bare `, the` suffix (`Beatitudes*, the` → *the
Beatitudes*, ~30 articles) is provably unambiguous — no article is named "the" as an alternate —
and could be added to the allowlist later.

### The path map

A modal reached from a **link** (not a button) at the right of the breadcrumb row. It draws the
breadcrumb as a left-to-right spine with each article step's untaken cross-references branching
above and below it.

```
                Book of Revelation            Prophets, False
                         ○                          ⋮
  ○ - - - - - ○ - - - - -●━━━━━━━━━━━━━━━━━━━━━━━━━━●━━━━━━━━━━━━●
Start   Dictionary·B   Beast                   Antichrist   Mark of God*…
                         ○                          ⋮
                    Armageddon            False Christs, False…
```

- **Clicking a branch rewinds the trail to the step it hangs off and continues from there.** From
  `Start › Dictionary · B › Beast › Antichrist › Mark of the Beast`, clicking `Armageddon` (a
  branch off *Beast*) yields `Start › Dictionary · B › Beast › Armageddon`. The breadcrumb stays a
  truthful account of the route taken, never a log of every click.
- **Solid vs dashed spine.** Solid means that step followed a real cross-reference; dashed means
  the user arrived another way — search, a route, or `✦ Wander in`. The shape of the session
  becomes legible.
- **Phantom branches are drawn, not hidden** — dashed, hollow, unclickable. Suppressing the 5%
  that Tyndale names but does not define would overstate how complete the graph is.
- **Non-article crumbs** (`Start`, a route, a search) sit on the spine as dim dashed nodes with no
  branches, so the spine matches the breadcrumb exactly.
- **A neighbour is drawn once**, attached to its earliest step. Revisiting an article shows it
  twice on the spine — honest about the loop.
- **Drag-to-pan** when the spine overruns its frame, with `grab`/`grabbing` cursors and a hint.
  A 3px movement threshold distinguishes a pan from a click, so a drag ending on a node pans
  without navigating; the guard resets so it cannot swallow the next real click.
  `preventDefault` on pointerdown, or dragging selects the SVG labels.
  The grab cursor is applied **only when the content actually overflows**.

A per-article "neighbourhood" force-directed graph was built and **deleted**: every function it had,
the doors row did better, and the path map covers the rest. Recorded so it is not re-proposed.

### Fun, grounded

Four additions, all running on data already in the corpus:

- **"Where this leads"** (above) — the biggest wandering win.
- **`✦ Wander in`** — a random article from the **1,839 substantial** ones. Unweighted, it would
  land on a bare redirect roughly a third of the time and feel broken.
- **Live route cards** — each of the four carries its real count plus a rotating real example, so
  the start page invites rather than lists.
- **Session stats** — "9 articles · deepest chain 5" on the start page, plus the depth badge.

## Data layer

### `dict_xref` — a new table, and why the build step is justified

**5,052 rows, ~250 KB.**

```sql
CREATE TABLE dict_xref (
  src TEXT NOT NULL,          -- dict_articles.id, the citing article
  dst TEXT NOT NULL,          -- dict_articles.id, the cited article
  anchor TEXT,                -- a "## Subhead" to scroll to, else NULL
  seq INTEGER NOT NULL);      -- order of appearance in the source body
CREATE INDEX idx_dict_xref_src ON dict_xref(src);
CREATE INDEX idx_dict_xref_dst ON dict_xref(dst);
```

This was flagged, retracted, then reinstated during design. The reasoning matters:

- **Wandering alone does not need it.** Resolving links for the one article on screen needs only
  that body plus a title→id map — **179 KB** for all 6,141 rows, built lazily. Two precedents do
  exactly this: `verseExists` (`db.js:410`) and `searchWords` (`db.js:147`).
- **The path map does need it.** It resolves neighbours for *every step in the trail*, in both
  directions. Inbound links cannot be derived from the current body at all, and scanning for them
  means pulling **8.4 MB** of prose through sql.js.
- **The agent skill needs it as SQL**, outside the app entirely.

So the table lands here. It **derives links Tyndale wrote explicitly** and invents nothing.

**This triggers the `docs/DATA-PIPELINE.md` checklist**: extraction into a committed intermediate,
`build-db.mjs` wiring, `install.sh` re-verification, a rebuild with `backup-data/` renamed away, and
`npm run copy-assets` in `app/` afterwards to republish the content hash.

### Browse queries (`app/src/lib/db.js`)

`getDictBrowse(letter)`, `getThemeIndex()`, `getProfileIndex()`, `getBookHub(book)`,
`searchLibrary(term)`, `getXrefs(id)`, `getRandomArticle()`. `idx_dict_sort` — created in Phase 1
and unused since — finally gets its consumer.

### Reuse

`ArticleModal.svelte`'s body section is extracted into **`ArticleView.svelte`** so the Context tab's
modal and the library's article surface share one renderer rather than drifting apart. This is the
only existing code restructured, and it is in direct service of the feature.
`parseArticleBlocks` / `articlePreview` (`display.js`), `RefText.svelte` + `scripture.js`,
`getRefPreview`, `goToPassage`, `getPref`/`setPref` are all used as-is.

### Also fixed here

**13 orphaned supplements** — 3 charts and 10 textboxes whose `host_id` never resolved — have no
route to them anywhere in the app today. The Dictionary index lists them.

## Routing and state

- `#/library` and `#/library/<angle>[/<id>]`, added to `applyHash`'s view list in `App.svelte`;
  `serialize()` gains a `library` branch. `keyOf()` extends so an **article change pushes** a
  history entry — that is what makes browser back walk the trail rather than ejecting the user.
- **Nav order:** `Home · Study · Library · Compare · Memo` — Library between Study and Compare.
- **Trail:** in-memory. Browser history is the durable spine.
- **Recently viewed:** persisted via the existing `setPref`, capped at 20.

## Invented constants

Three numbers are **ours, not the data's**. Each is a tunable and must be named as such in code:

| constant | value | rationale |
|---|---|---|
| `SUBSTANTIAL_CHARS` | 500 | the `✦ Wander in` pool boundary; yields 1,839 of 6,010 |
| `MAX_BRANCHES` | 7 | branches drawn per path-map step; `Plants` has 150 and would bury the spine |
| `MAX_CRUMBS` | 6 | breadcrumb slots before middle truncation |

## Theming

Theme vars only — `--dim`, `--ink`, `--rule`, `--panel`, `--bg`, `--a`, `--b` — verified in **both**
light and dark, including SVG fills and strokes, which take vars via CSS classes rather than
presentation attributes. **Every new CSS class name is grepped against the component's `<style>`
before it is added** (the Phase 1 `class:empty` collision).

## Testing

**Queries (`app/src/lib/db.queries.test.js`)** — browse ordering by `sort_title` with `title`
returned; letter filtering; unified search across all four datasets; `getBookHub` assembling intro +
themes + profiles + top-cited articles; `getXrefs` returning both directions.

**Cross-reference resolution (`build/test/`)** — each of the four tiers; `See Mark of the Beast.`
resolving via tier 3; `See Animals (Cattle).` carrying the `Cattle` anchor; a dangling target
(`Jesus Christ, Life and Teachings of`) resolving to nothing rather than throwing; the corpus-wide
rate asserted at ≥95%.

**Title display** — all 62 allowlisted inversions de-invert correctly; **`Elect, Election`,
`Zidon*, Zidonian*`, `Nazarite*, Nazirite`, `Mark of God*, Mark of the Beast` and `Babylon,
Babylonia` are asserted unchanged.** This is the regression guard against a future general rule.

**Breadcrumb** — truncation at exactly 6 vs 7 crumbs; a crumb click in the truncated view landing on
its real stack index; expander state resetting on navigation.

**Path map** — branch click truncating to the correct step; solid/dashed spine classification;
phantom nodes unclickable; drag suppressing the click that follows it.

**Post-build invariants** — `dict_xref` row count; zero rows whose `src` or `dst` is missing from
`dict_articles`; no self-edges.

**Regression** — `build/` and `app/` suites green; rebuild with `backup-data/` renamed away; check
live in the browser in both themes.

## Non-goals

- **A whole-corpus graph view** — see finding 5. 1,964 isolated nodes and a 2,478-node hairball.
- **Inbound "what links here" as a UI surface** — `dict_xref` makes it possible, but it is trivia,
  not a route. The path map already exposes what matters.
- **General title de-inversion** — see above; unsafe.
- **Progress, read-marks, coverage, to-study integration** — explicitly out.
- **The agent skill** — a **separate follow-on spec**. It consumes `dict_xref` (shortest path
  between entries, most central articles, neighbourhood queries), lives outside the app with
  different code and tests, and joins the five existing CLI skills that query `bible.db`. Nothing
  here blocks it; the table ships in this phase.

## Attribution

Unchanged from Phase 1 — Tyndale Open Bible Dictionary, © 2023 Tyndale House Publishers, CC BY-SA
4.0. The existing `.srcinfo` ⓘ pattern carries the credit on the article surface and the book hub.
