# DeepVerse — Features & Ideas (living tracker)

> Running capture of what we're building and the ideas/decisions behind it.
> This is the informal tracker; formal designs live in `docs/superpowers/specs/`.
> Last updated: 2026-08-05

## ✅ Phase 1 shipped (2026-07-07)

Segment 1 / Phase 1 (data-driven, no AI) is **done and committed**: `data/bible.db` v2 + the `app/` PWA.
Built beyond the base plans through several rounds of user feedback — highlights: Type-A difference engine
tightened (band + Louw-Nida sub-domain + frequency cap), Type-B sense-clustering (soul/life, love/kiss),
map-aware reader underlines, verse-range notes, WYSIWYG rich-text notes, cross-refs with previews + jump,
hierarchical lexicon definitions, URL history/deep-links, Compare verse-aligned grid ↔ gridless toggle,
reading-activity hover, offline PWA, DeepVerse logo. Non-obvious decisions live in the memory files.

## ✅ OT difference engine + app polish (2026-07-08)

- **OT (Hebrew/Aramaic) interpretive-difference engine** — Type A/B now cover the whole Bible, not just
  the Greek NT. Uses macula-hebrew's **SDBH** semantic domains (not Louw-Nida). Aramaic covered too.
  Spec `specs/2026-07-07-ot-differences-engine-design.md`, plan `plans/2026-07-07-ot-differences-engine.md`,
  memory `ot-differences-engine`. Real fixtures: ruach spirit/wind, nephesh person/life, erets land/earth,
  virgin↔young-woman (Isaiah 7:14). Type A ≈ 25k, Type B ≈ 124k rows (Type B dominated by the accepted
  verb-inflection residual). Greek output preserved.
- **App made OT-aware** — language-aware copy (Hebrew/Aramaic/Greek, OT/NT) replacing hardcoded Greek/NT;
  Hebrew gloss cleanup (strips attached particles); Hebrew lexicon definitions formatted like Greek
  (BDB `1) 1a) 1a1)` hierarchy); transliteration renders the morpheme `/` as a hyphen for pronunciation.
- **Study mode** — reader/workbench split is now **resizable** (drag the divider + `⠿` grip, persisted).
- **Home** — **jump-to-verse** on the greeting line (free-form refs, `parseReference`); more greetings
  (6→35); word-of-day drops its canned closing line. The greeting **verse subtitle is now clickable**
  (opens its cited verse; the non-verse subline stays plain text), and clicking **Word of the day** now
  also selects that day's anchor word in the **Original** interlinear card + scrolls its definition into
  view (reuses the existing word-selection effects, so no new plumbing).
- **Compare** — aligned-grid rules now line up across versions (paired cells share row height).
- **Type-A quality pass** — reader underline + Differences card now surface the **rarest** (most deliberate)
  Type-A/B word per verse, not the first by position ("intelligent" over "written", "nephesh" over "said").
  Absorbs the OT-Type-B-density concern without a separate prune. Display-only (memoized freq), no rebuild.
- **`./start.sh`** launcher added (installs deps if needed → `npm run dev --open`).

**Phase-1 polish is effectively complete.** **Next:** AI prose layer (Phase 2) → Level-3 context → Map/Discover (Segment 2).

## ✅ Context tab + study notes; Notes → "Memo" (2026-07-16)

Built on branch `feat/context-tab`, **merged to main**. Design/validation notes in `research/bible-context/`.

- **Context tab** added to the "Context & cross-references" workbench card. Per chapter, in order:
  - **Recap** — a plain one-paragraph summary from **Bible Summary** (Chris Juby, biblesummary.info), all 1189 chapters (`chapter_recap`, `source='bible-summary'`). Chosen over Matthew Henry / Adam Clarke commentary, which read as interpretation, not plain recaps. Kept **committed locally** in `build/data/recaps-biblesummary.json`. **Licensing: CONFIRMED 2026-07-17** — the author granted bulk-use permission, so all 1,189 are quotable and redistributable with attribution. The 14-chapter hand-authored `recaps-editorial.json` fallback was the licensing safeguard and now survives only as a gap-filler.
  - **Who/where/what** — people, places (with coords), events, groups named in the chapter, from **Theographic Bible Metadata** (CC BY-SA 4.0; `chapter_context` + `chapter_entity`). Stored counts are the derived *listable* counts; name-collision + approximate-date caveats disclosed in the tooltip.
  - **Study Notes** — verse-driven **Tyndale Open Study Notes** (CC BY-SA 4.0; 16,913 notes in `study_notes`, committed as `build/data/studynotes.json`). Covering-range model (a note shows on every verse it spans), each labeled with its span; chapter-level count; reader stays clean (no per-verse markers). Spec `specs/2026-07-15-tyndale-study-notes-display-design.md`, plan `plans/2026-07-15-tyndale-study-notes-display.md`.
  - Attribution shown in-app for each source; see `docs/ATTRIBUTIONS.md`.
- **NKJV parser fixes** (same branch): book-boundary mislabeling (321 NULL-chapter rows + recovered 1 Sam 31 / 2 Sam 1), Ps 119:100 split, fused footnote callers stripped (~363 verses), dropped block-quote/poetry recovered (~812 verses), Rev 22:1 concordance bleed.
- **"Notes" → "Memo":** the **personal-notes** feature is now labeled **Memo** throughout the UI (nav tab, page, workbench card, buttons, placeholders, empty states). Internal route (`#/notes`), store functions, and DB tables are unchanged. The Tyndale **Study Notes** feature is separate and keeps its name.

**Roadmap remaining for the context/cultural layer:** Tyndale theme articles + book intros + the Bible Dictionary (validated, not yet imported); PD dictionaries; OpenBible.info confidence-gated geography. **Source research + build order:** `research/bible-context/` (see its `README.md` index).

## ✅ AI = Claude Code query skills (2026-07-16)

The "AI phase" is **not** an in-app feature — no chat, no backend, no cost, no prose baked into the DB.
It's a set of **Claude Code project skills** (`.claude/skills/`) the developer invokes *in the CLI* to
query the corpus; the answer lands in the conversation. App stays pure-data/offline. Built on branch
`feat/ai-query-skills`:
- **`deepverse-data`** (foundation) — real 12-table schema, gotchas (Strong's are `G0025` zero-padded;
  Hebrew codes carry suffixes/multiples; `synonyms` pairs unordered; OSIS book codes; NIV=1984),
  source/trust/license map, grounding rules (query the data, never recall Greek/Hebrew), verified query
  cookbook.
- **`word-study`**, **`passage-study`**, **`interpretive-differences`**, **`context-background`** — one
  query playbook each, layered on the foundation. All embedded queries verified against `data/bible.db`.
- **Geo/map skills** (`place-blurb`, `journey-narrator`, `period-culture`) designed + recorded in
  `plans/2026-07-16-geo-map-skills.md` for the Map/Discover phase — **deferred**, blocked on OpenBible
  geocoding + DARE tiles landing in the DB.
- Spec `specs/2026-07-16-ai-query-skills-design.md`, plan `plans/2026-07-16-ai-query-skills.md`.

## ✅ The Library — a browsable route for the Tyndale corpus (2026-08-02)

Until now the dictionary only ever appeared *because a verse summoned it* in the Context tab. `#/library`
makes the whole corpus browsable in its own right: **6,010 dictionary articles, 298 theme articles,
125 profiles, 66 book introductions**, plus the 131 textboxes and charts they host.

- **Four routes** — Dictionary (A–Z, with a `#` tab for the one title that starts with a curly quote),
  Themes, Profiles, and per-book hubs. Unified search across all four.
- **Doors** — Tyndale's own cross-references are a real graph (`dict_xref`), lifted from the source's
  `?item=` link markup rather than reconstructed from prose. 5,164 edges, every one resolved; 87 land on
  a named subhead rather than the top of the article.
- **The path map** — a drag-to-pan diagram of the trail you actually took, with branch jumps. The
  breadcrumb *is* the navigation stack, so Back walks the real trail rather than rebuilding it from the URL.
- **Honest about gaps.** 1,913 of the 6,010 articles have no cross-reference edge at all, and the app
  says so rather than implying a connection. Counts that are capped say they are capped.

Spec `specs/2026-07-30-library-explorer-design.md`, plan `plans/2026-07-30-library-explorer.md`.
The **content-defect report** `reports/2026-08-02-library-explorer-content-defects.md` is the one to read
before trusting any figure in this project: an approved mockup shipped **21 wrong claims out of 137**,
including four invented citation counts. Every number in the docs above is now queried from `bible.db`.

## ✅ The Apocrypha (2026-08-03)

The Tyndale dictionary cites the deuterocanon in **461 linkified references across 13 books**, and none of
NIV/NKJV/NLT carries any of it — so every one of those was a reference the reader could not follow. The
**KJV + Apocrypha** (standardized 1769 text, public domain, eBible.org) now supplies them: **5,650 verses
across 14 books**, `version = 'KJVA'`.

- **456 of the 461 now resolve.** The remaining five name books no KJV ever carried — 3 Maccabees (2) and
  4 Maccabees (2), both Orthodox-canon, and the Apocalypse of Baruch (1). Each renders an explanation of
  what the book is instead of sitting inert.
- **2 Esdras 7 is dropped whole.** The KJV was made from Latin manuscripts missing 2 Esd 7:36–105, a gap
  not filled until 1875, so its chapter 7 renumbers everything after verse 35 — keeping it would have
  silently shown the wrong verse for the five citations Tyndale makes into it.
- Each book is labelled in-app with what it is and whose Bible it is in; 3 and 4 Maccabees are said
  outright to be in no modern Bible.
- Licensing: public domain. UK letters patent restrict **printing** the KJV there; no effect on use
  outside the UK. See `docs/ATTRIBUTIONS.md`.

**Also fixed in the same pass:** three of Tyndale's own scripture links were wrong (two `Judges 1` refs
pointing at Joshua, one `Romans 13` tagged as Ecclesiastes). CC BY-SA requires the change be stated —
it is, in `docs/ATTRIBUTIONS.md` and in-app via `TYNDALE_CHANGES`.

## 🗺️ TO BUILD — Maps and Pictures, the two Tyndale content types we do not yet ingest

**Status: both are on the build list (decided 2026-08-04).** Assessed against the source on
2026-08-04; every figure below was counted, not estimated. Maps is the straightforward one and
should go first. Pictures is the harder call — the assessment below argued against it and the
decision was to keep it anyway, so **read the caveats before designing it**: they are the spec.

The dictionary package has five content directories. We carry three (Articles, Textboxes, Charts).
These are the other two.

### The licensing position, first — it is different for each

`_README.txt` licenses the whole package **CC BY-SA 4.0**, redistributable with attribution and
ShareAlike. But `CONTENTS.txt` draws a distinction in the publisher's own words:

> *"In order to preserve the rights of the owners of these images, we are unable to include the
> images themselves in the Tyndale Open Bible Dictionary."*

That sentence is about **Pictures only**. The **map artwork is in the package** — 70 PDFs in
`Maps/artfiles/`, shipped under the same CC BY-SA 4.0 as the text. So maps are ours to use and
redistribute with attribution; the photographs were never ours and do not exist locally to use.
**Do not go looking for the photographs elsewhere — the publisher withheld them deliberately.**

### Maps — BUILD. No blockers found.

`Maps/Maps.xml` holds **80 map items** (not 81 — `CONTENTS.txt` says 80 and the XML agrees),
referencing **70 distinct PDFs**, all present. Eight PDFs are reused by two or three maps.

- **Placement answers itself.** Article bodies carry **80 `include_items` markers naming Maps,
  across 70 distinct articles** — the identical mechanism textboxes and charts already use to bind
  to a host. A map goes in the article that embeds it. No new surface, no new decision.
- **It closes the last dangling link in the corpus.** `Succoth` → *Key Places in the Exodus* is the
  one `?item=` link of 5,237 that resolves to nothing, dropped at build time solely because Maps
  are not ingested. That item exists, with art and a full caption.
- **The artwork survives conversion well.** Each PDF is a grayscale terrain raster (620–1371 px)
  with the place labels as **vector** outlines, so rendering the page — not extracting the embedded
  bitmap — yields crisp text at any size. Measured on a 14-map sample: **≈4.0 MB of WebP at 900 px**
  for all 70, ≈6.6 MB at 1200 px. That is **+2.6 % on the 151 MB the app already ships**, and it
  lands as static files, *not* in `bible.db` — so no sql.js memory cost.
- **No heavy runtime dependency.** Conversion is a maintainer-only step whose output is committed,
  exactly like every other intermediate, so the converter never has to be portable or shipped.
  (`pdfjs-dist` is already in `build/package.json`.)
- **Captions alone are not the answer.** 66 of the 80 have a `caption-text`; the other **14 are a
  heading only** ("Key Places in 1 Kings"). A caption without its map is a title, not content.

**⚠️ A real bug found while assessing this.** **11 of the 80 `<img src>` values do not match the
filename on disk by case** — `artfiles/1sam-ovr.pdf` vs `1Sam-Ovr.pdf`, `josh-ovr.pdf` vs
`Josh-ovr.pdf`, and nine more. Every one resolves on macOS, whose filesystem is case-insensitive,
and **404s on Linux and on essentially every web server**. Whoever ingests these must normalise the
reference against the real filename at build time rather than trusting the source's `src` string.
This is latent today only because we do not read those paths at all.

### Pictures — BUILD, but scope it to the ~51 items that carry their own weight.

`Pictures/Pictures.xml` holds **210 items** (not 211) and the directory contains **no `artfiles/`** —
just the one XML, and **the images are never coming**: the publisher withheld them to protect their
owners' rights. **Do not go looking for them elsewhere.** So this feature is captions alone, and the
assessment found most of those captions are not worth showing:

- **194 of the 210 have a `caption-head` byte-identical to the item's own `<title>`.** For those,
  the "caption" is the title printed twice.
- **Only 67 of 210 carry any `caption-text` at all. The other 143 would render as a bare title** —
  "A Bedouin in Syria", and nothing else.
- **16 of those 67 are deictic and incoherent without the photograph**: *"…found in caves like
  these"*, *"Small alabaster containers like this one…"*, *"This replication shows Acts 20:28."*
- **There are no photo credits in the XML.** Zero items mention one, so "captions and photo
  credits" overstates what is actually there — it is captions, and mostly not even that.

That leaves **roughly 51 items** whose caption is a sentence that stands on its own, most of them
manuscript sigla ("Two leaves of Romans in Chester Beatty Papyrus II — P46").

**Design constraints, which follow directly from the counts above:**

1. **Ingest the ~51, not the 210.** The filter is structural and cheap: keep an item only if it has
   a `caption-text`, that text is not deictic, and the text is not a restatement of the title.
   Ingesting all 210 would put a caption for a missing photograph on **166 articles**.
2. **Never render a bare title.** The 143 head-only items have nothing to say; 194 items have a
   caption-head identical to their own title. Neither is content.
3. **Say the image is absent, and why.** The reader must not be left thinking the app failed to
   load a picture. The 3-Maccabees preview is the precedent — it names the thing and explains the
   absence, and that pattern is already built and tested.
4. **Do not present these as "Pictures."** With no images, the honest framing is something like
   *what the print edition illustrated here* — a note, not a gallery.
5. **There are no photo credits to show.** Zero of the 210 items mention one, so nothing in this
   feature is an attribution obligation; CC BY-SA on the caption text is the only requirement.

**Recorded dissent:** the assessment recommended against building this at all — ~51 mostly-trivia
sentences, at the cost of a surface that describes things the reader cannot see. Kept on the list
by decision. If it is built and the result reads thin, constraint 1 is the dial to turn.

## The app in two segments

1. **Study Bible workflow** — deep study of a passage (English ↔ Greek/Hebrew/Aramaic, context, differences). *Current focus.*
2. **Map / Discover workflow** — interactive period-accurate map overlaid on the modern map; where each story happened, who wrote it, contextual links. *Later.*

Both run in one static, offline-first **PWA** backed by `data/bible.db` (no server DB required).

### Architecture & deployment (decided)
- **Approach A — fully client-side.** Static bundle (app code + `bible.db` + SQLite-WASM). Browser downloads `bible.db` (~31 MB gzipped) once, caches it, runs all SQL locally via `sql.js` (OPFS/`wa-sqlite` is the upgrade path for mobile). No backend, no DB server.
- **Local-first, no auth.** Notes stored in **IndexedDB**; single-user, one machine. **No auth, no backend, no cost.** Optional **notes export/import** (download/load a file) for personal cross-device portability — still no auth.
- **Deployment:** run **locally** (`npm run dev` / installed PWA) for personal use, or host the static bundle on **Cloudflare Pages** (free, unlimited bandwidth — ideal for the 31 MB asset) if it's wanted on phone/other devices. Vercel/Netlify also work (personal bandwidth is trivial).
- **Sharing:** sharing the *app* (others run their own instance, keep their own local notes) is trivial. Only a *hosted multi-user service with synced accounts* would need auth + backend — explicitly out of scope; local-first doesn't block adding it later (Supabase notes table + auth).
- **AI later stays compatible:** pre-generated Claude explanations ship as static data; a future live "ask" feature = one optional serverless function, no change to the static core.

---

## Segment 1 — Study Bible workflow

### Two modes
- **Study mode** — English ↔ Original. Split screen + Workbench (below). The main build.
- **Comparison mode** — Bible ↔ another Bible (English-to-English). **No workbench:** left = one full-height version, right = another full-height version. Extra features TBD; not exploring now.
- We do **not** compare across English versions *inside* the Workbench — that's Comparison mode's job.

### Home / Landing view (app entry point)
Opens here before Study mode. **Open editorial layout, not boxed cards.** All local. Sections:
- **Greeting** — "Welcome back, {name}", name user-editable (click to type, stored locally); greeting phrase **randomizes** among variants ("Grace and peace", "Back to the Word"…). Full-width row on top.
- **Resume** — last-read position → "Continue reading" into Study mode.
- **Word of the day** — data-derived nugget from the `differences` table (rotating Type A/B word, e.g. ψυχή soul/life) + small curated fallback. No AI. Card, left column.
- **Reading activity** — GitHub-style contribution graph (auto-tracked: any day you open a chapter counts), **scholarly ink/oxblood ramp, not green**; + current streak / days-this-year / chapters-read.
- **To study** — editable checklist of things to look into (add/edit/check-off/delete), stored locally.
- **Recent notes** — latest notes as **sticky notes** (pinned/tilted, warm paper), grid; click → jump to passage.
- **Responsive:** 50/50 top (left: Continue + Word-of-day · right: Reading activity); bottom row: To-study (⅓) + Recent notes grid (⅔); single column on mobile.

### Layout: split screen (Study mode)
- **Left = English reader.** Paginated chapter-by-chapter. Version selector (NIV / NKJV / NLT).
- **Right = "Workbench."** Responds to what you select on the left (verse / word / phrase).

### Workbench components
1. **Original-language view.** Greek (NT) / Hebrew (OT) / Aramaic (parts of Daniel, Ezra, etc.). Auto-selects the language(s) that actually went into the current chapter; selector when a chapter has more than one. → pure data (`words`).
2. **Deep-dive context — 3 levels (phased):**
   - **Level 1 — per-verse context.** *(Phase 1)*
   - **Level 2 — per-chapter context.** *(Phase 1)*
   - **Level 3 — per-book / timeline / culture context.** *(Phase 2 — needs more data.)*
   - Direction: **structured assembled data** (cross-refs, key words + meanings, parallel-version diffs, stats) rather than prose. Open concern below.
3. **Interpretive-difference overview.** NOT translation-style nuance — "so"/manner is **out**. Focus = **words where the English collapses a distinction the original makes**: one English word ← multiple distinct original words that change interpretation. Canonical: "love" = ἀγαπάω *agapaō* vs φιλέω *phileō* (John 21:15-17); also "word" = λόγος vs ῥῆμα, etc. Show these at a glance, zoom into any one. **Open crux: how to auto-detect which words are interpretively significant** — see stress-test findings / open questions.
4. **Stats + word selector.** A word-selector box: pick a word in the text (e.g. right-click → count) → count occurrences across the **entire selected version**, and optionally count the **original-language lemma** across the whole Bible (concordance-style). Plus word/phrase counts, Strong's frequency.
5. **Notes.** Create a note linked to **a specific verse** or **the current chapter**. → local storage (IndexedDB), no server.

### Notes (cross-cutting feature)
- Notes attach to a verse (`book.ch.v`) or a whole chapter (`book.ch`).
- Created/edited from within the workbench while reading.
- A **separate Notes page** aggregates every note created so far → browse, view, edit, jump back to the linked verse/chapter.
- Stored locally (IndexedDB); survives offline. Future: optional export / sync.

### UI requirements
- **Rearrangeable workbench** — the workbench and the panels/cards inside it (original-language view, context, difference overview, stats, notes) can be reordered/rearranged by the user (drag ⠿). Layout persists locally.
- **Card hotkeys** — number keys `1`, `2`, `3`… map to each card in order (1st card = 1, 2nd = 2, …) to jump to / toggle it. Order follows the user's current arrangement.
- **Arrangeable split** — the two panes (Bible reader ↔ Workbench) can be laid out **side-by-side (L/R) or stacked (top/bottom)**, and the user can **swap which side each pane is on** (e.g. Bible-left/Workbench-right, or Workbench-left/Bible-right, or Bible-top/Workbench-bottom). Orientation + side persist locally.
- **Layout finalized:** B (stacked cards) + in-text colored underlines, **no heatmap**.
- **Visual design language DECIDED: Scholarly print** — ink-on-paper, text serif for scripture, small-caps labels, apparatus-style accent inks (A=oxblood, B=indigo); dense/bookish, NOT the cream+display-serif AI default. **Light + dark with an OS-aware ☀/☾ switcher (persisted); dark = warm candlelit-manuscript, not cold slate.** (Rejected: Technical instrument, Calm reading-first.)

### Difference-UI decisions
- **In-text colored underlines are the primary indicator** — significant words underlined where you read (blue = Type A, purple = Type B). The Workbench "Differences" cards (B layout) give the readable detail.
- **Heatmap likely redundant / dropped for now.** A separate heatmap gutter overlaps with the underlines at single-column chapter scale; the underlines already are the "at a glance." Revisit a scan-gutter only if navigating very long chapters proves painful.
- **Difference presence is binary, not a 4th "none" category.** A word/verse has: Type A, Type B, both, or nothing. "Nothing" renders as *absence* (no mark) — never a gray swatch. Keeps the reader clean and makes the loaded spots pop.
- Layout direction: **B (stacked cards) + in-text underlines**, no heatmap. (Pending final confirm.)

### Key design principle (the big open concern)
- **Risk:** so much data that the workbench becomes unintuitive and the user has to *dig*.
- **Fix direction:** progressive disclosure — glanceable summary first, driven by the current selection, zoom on demand. *Being worked out via visual mockups.*

---

## AI decision

- **Most of the Workbench needs NO AI** — original-language view, difference alignment, cross-refs, lexicon, word/phrase counts are all pure SQL over `bible.db`.
- **AI is only needed for *prose*** — "what this means / why the nuance matters" and Level-3 context.
- **When we add it: (a) pre-generated Claude, grounded + cached** (reviewable, $0 to serve, offline, strong on Koine Greek) — **preferred**.
- **(b) lightweight local model + RAG** — *not* recommended as primary: small local models are weak/hallucinatory on biblical Greek/Hebrew; more engineering for worse output. Only if fully-offline-private becomes a hard requirement (and even then a Claude-API "ask" proxy beats a small local model).
- **Plan:** build data-first with zero AI, then layer pre-generated Claude explanations.

---

## Data foundation — `data/bible.db` (built, validated)

- **verses** — 98,785, keyed `version, book, chapter, verse`: NIV 1984 (31,086), NKJV (31,102) and
  NLT 2015 (30,947) over the 66-book canon, plus KJVA (5,650) over the 14 deuterocanonical books.
- **words** — 425,437 interlinear (Greek 141,720 + Hebrew/Aramaic 283,717): original, translit, gloss, Strong's, morphology, lemma. Keyed `book, chapter, verse, position`.
- **lexicon** — 23,746 Strong's entries (91% of tagged words resolve to a definition).
- **cross_refs** — 344,799 (OpenBible, vote-ranked).
- Everything joins by verse ref + word position. ~91 MB / ~31 MB gzipped.
- Raw sources in `backup-data/` (gitignored, STEPBible CC-BY, OpenBible CC-BY); parsed into committed
  `build/data/sources/*.json.gz` intermediates that the builder reads. Parsers + builder in `build/`. See `docs/DATA-PIPELINE.md`.

### Not yet in the DB — the build list
- **Tyndale Maps** — 80 maps, 70 PDFs, ~4 MB of WebP. Assessed, no blockers. **Next up.**
- **Tyndale Pictures** — caption-only, scoped to ~51 items. Assessed; see the constraints above.
- OpenBible **geocoding** (`ancient.jsonl`) + **DARE map tiles** → the Map/Discover segment.
  Distinct from Tyndale Maps above, which is far smaller and needs none of this.
- Public-domain versions (WEB / KJV / BSB). Note the KJV **Apocrypha** is already in, as `KJVA`.
- Level-3 context data (timeline / culture / authorship).
- `macula-hebrew` syntax trees (needs git-lfs).

---

## Stress test — what bible.db must prove (for Segment 1)
As we flesh out the Study Bible workflow, hammer the DB against the real queries it must serve, e.g.:
- Reverse concordance: every verse where a given Strong's / lemma appears (word study).
- Per-verse & per-chapter assembly: verse text (×3 versions) + interlinear + lexicon + cross-refs in one round-trip, fast.
- English↔original alignment: map each original word's gloss to the English rendering, flag divergences.
- Aggregates: word/phrase counts, Strong's frequency across a book / the whole Bible.
- Which original language(s) a given chapter contains (auto-select logic).
- Latency/size when this runs client-side (sql.js / wa-sqlite in the PWA).

---

## Stress-test findings (2026-07-05) — the interpretive-difference feature (#2)
- ✅ **Raw distinction data is present & perfect.** John 21:15-17 cleanly shows ἀγαπάω *agapaō* (G25) vs φιλέω *phileō* (G5368) with distinct glosses ("love you" vs "I dearly love"). The workbench can *display* "this verse uses φιλέω, not ἀγαπάω" today.
- ✅ **Reverse concordance works.** "love" ← multiple lemmas (ἀγάπη G26, ἀγαπάω G25, ἀγαπητός G27, φιλέω G5368…).
- ⚠️ **Auto-*detecting* which words are significant is the hard part.**
  - Naive "English gloss → many lemmas" surfaces FUNCTION-word noise ("as"←22, "then"←21, "that", "in") — exactly what we want to exclude.
  - Filtering to content words (noun/verb/adj via `morph`) helps — surfaces "mind", "servants", "understanding", "desire" — but still gloss-string based, which is fragile and **misses the "love" case** (agapaō/phileō have different gloss strings so they don't group).
  - **The principled signal = semantic domains (Louw-Nida), which are NOT in bible.db.** They'd come from **MACULA** (macula-greek is cloned; macula-hebrew is git-lfs-parked).
- **Implication:** feature is achievable; robust significance-flagging needs a data addition (MACULA semantic domains) and/or a curated notable-word list.
- **DECISION: add MACULA semantic domains.** Verified `macula-greek` has, per word: `domain`, `ln` (Louw-Nida), `frame`, plus `strong`/`lemma`/`gloss`. e.g. ἀγαπάω → LN `25.43`. **Bonus:** `sources/Clear/synonyms/Proximity.tsv` is a precomputed pairwise **Strong's↔Strong's synonym-distance matrix spanning Greek (G) + Hebrew (H) + Aramaic (A)** — directly powers "word chosen over near-synonym X." Also present: word-senses, alignment mappings, figures-of-speech.
- **Next data task:** load MACULA `domain`/`ln`/`frame` + the Proximity matrix into `bible.db`. (Greek from cloned `macula-greek`; Hebrew needs `macula-hebrew` via git-lfs.)
- **Reshapes feature #2:** difference detail = "this verse uses φιλέω [G5368]; near-synonym ἀγαπάω [G25] (dist 0.x) carries a different sense" — data-driven, no AI needed for the core.

### TWO types of interpretive difference (a difference does NOT require synonyms)
- **Type A — Synonym collapse:** multiple *different* original words → one English word. e.g. "love" ← ἀγαπάω / φιλέω; "servant" ← δοῦλος / διάκονος. Detected via **MACULA proximity + Louw-Nida domains**.
- **Type B — Semantic-range spread:** *one* original word → multiple English meanings (the word is broader than any single English word), **no synonym involved**. Proven in data: ψυχή [G5590] rendered "soul" 32× **and** "life" 31×; λόγος word/speech/saying/account (70 renderings); σάρξ flesh/body/sinful-nature. Detected via **gloss variety (normalized) + MACULA word-senses**.
- **Type B is likely the more valuable half** (the ψυχή soul/life "aha") and would be missed by a synonyms-only approach.
- **Caveat:** raw gloss-variety is noisy (articles/punctuation inflate counts — "flesh" vs "flesh," vs "[the] flesh"). Normalize glosses and/or use MACULA `wordsenses` for Type-B precision.
- **Philosophy:** faithful translation ≠ lossless; a faithful rendering must *choose* one sense of a rich word and hide the alternatives — surfacing that choice is the feature, not "the translation is wrong."

## bible.db v2 — pending data tasks (batch into one rebuild)
1. **BUG — versification notation dropped verses.** Parser regex required `#` right after the verse number, so refs with STEPBible dual-versification like `Dan.4.1(3.31)#01` were silently skipped → **Daniel 4 & 6 entirely missing** (fully Aramaic chapters), plus likely Psalm titles, Joel, Malachi, Hosea, etc. Fix: allow optional `(alt)` → `/^(\w+)\.(\d+)\.(\d+)(?:\([^)]*\))?#(\d+)/`. Rebuild.
2. **3-way language tag.** Currently all OT loaded as `lang='hbo'`; Aramaic is lumped in. Aramaic is detectable via morph prefix `A` (verified: Daniel 2 shows the exact 2:4b Hebrew→Aramaic switch). Re-derive `lang ∈ {grc, hbo, arc}` from morph so chapter language auto-detect is a pure query (no metadata table needed).
3. **Load MACULA** — `domain`, `ln` (Louw-Nida), `frame`, word-senses, and the `Proximity.tsv` synonym matrix → powers Type-A/B difference detection. (Greek cloned; Hebrew needs git-lfs.)
4. **Gloss normalization** — strip articles/punctuation for clean Type-B sense-spread counts (ψυχή etc.).
5. **Completeness validation (build gate).** After rebuild, assert nothing was silently dropped: for every book, check chapter count and per-chapter max verse against a canonical versification reference; verify every original-language book+chapter is present (would have caught Dan 4/6); reconcile the English verse set vs the original-language word set and report orphans. **Fail the build on any gap.**

**Language auto-detect verdict:** no per-book metadata to maintain — it's derivable from `words.lang`/`morph`. Coarse (grc/hbo) works today; Aramaic after task #2.

## 🔎 TO FIX — Memo reference search matches strings, not references

The Memo filter box tests the query as a substring of the **rendered** reference
(`NotesPage.svelte:36`), even though `parseReference` (`refs.js:88`) already exists and is used by
Home's jump-to-verse box. It fails both ways:

- **False negatives** — `ps 23`, `psalm 23`, `1cor`, `1corinthians` match nothing; `parseReference`
  resolves all four. 18 of the 66 display names contain a space, so the entire numbered-book family
  (`1 Corinthians`, `1 John`, `Song of Songs`…) is unreachable by the way people actually type.
- **False positives** — substrings ignore verse boundaries, so `john 3:1` surfaces a memo on John
  **3:16**, and `1` matches every memo in 1 Corinthians, Psalms 1, and any verse 1.

**Not a drop-in swap.** `parseReference` is greedy by design (`j` → Joshua 1, `1` → 1 Samuel 1) —
right for a jump box you watch as you type, wrong for a live filter that would snap to Joshua on the
way to typing "john". The same box also searches memo **body text**, and `Job`/`Acts`/`Mark` are
ordinary English words. A fix needs a policy (when does a query count as a reference; does a
reference hit replace or union with the text hit) plus an abbreviation/alternate-name table, which
does not exist — `jn`, `mt`, `revelations`, `song of solomon` miss even with the parser. Own design.

Found while specifying `specs/2026-08-05-memo-dating-design.md`, which deliberately leaves it alone.

## Open questions / to resolve
- Final form of the Workbench (avoiding overload) — **in progress via mockups.**
- What exactly Level-1/2 "context" surfaces (which structured elements, in what order).
- Version note: NIV is 1984 (2011 not freely licensable); NKJV has rare fused-marker artifacts in cross-ref-heavy verses.
