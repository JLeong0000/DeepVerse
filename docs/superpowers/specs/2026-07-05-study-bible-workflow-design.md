# Study Bible Workflow — Design (Phase 1)

**Project:** DeepVerse · **Date:** 2026-07-05 · **Status:** for review
**Scope:** Segment 1 (Study Bible workflow), Phase 1 (data-driven, no AI).

---

## 1. Purpose & scope

A personal, offline study tool that puts an English Bible next to its original
languages and surfaces **where the English hides a distinction the original makes**.
It is not a general reader — its reason to exist is the English↔original comparison,
done from real data (no AI in Phase 1).

**In scope (Phase 1):**
- **Study mode** split screen: English reader + a **Workbench** of data-driven lenses.
- Original-language view (Greek / Hebrew / Aramaic), auto-selected per chapter.
- The **interpretive-difference engine** (Type A + Type B) with in-text underlines + detail cards.
- Context Level 1 (per-verse) + Level 2 (per-chapter): cross-references, key words, stats — *structured data, not prose*.
- Stats + word-selector concordance counts.
- Notes (verse- or chapter-linked) + a Notes page. Local, no auth.
- Rearrangeable workbench cards, card hotkeys, arrangeable split.

**Out of scope (later phases):**
- **Comparison mode** (Bible↔Bible) beyond a stub — deferred.
- **Level 3 context** (book / timeline / culture) — needs more data.
- **AI prose** (the "why it matters" narrative) — pre-generated Claude, later.
- **Cloud sync / accounts / multi-user hosting** — local-first only.
- **The Map / Discover segment** — Segment 2.

---

## 2. Architecture

Fully **client-side, static, local-first** (decision "A").

- **Bundle:** app code (Vite) + `bible.db` (static asset, ~31 MB gzipped) + SQLite-WASM.
- **Data access:** `sql.js` loads `bible.db` into memory; all queries run in-browser.
  *Upgrade path:* `wa-sqlite` + OPFS (query from disk) if mobile memory becomes a concern.
- **Notes:** IndexedDB. **No auth, no backend, no server DB.**
- **Deployment:** run locally (`npm run dev` / installed PWA) or host the static bundle on
  **Cloudflare Pages** (free, unlimited bandwidth) for multi-device access.
- **Offline:** service worker caches the shell + `bible.db`; fully usable offline.
- **Forward-compat:** pre-generated AI explanations would ship as static data; a future live
  "ask" feature = one optional serverless function, no change to the static core.

---

## 3. Data foundation — `bible.db` v2

Current `bible.db` (built, validated): `verses` (92,833 · NIV/NKJV/NLT), `words` (interlinear),
`lexicon` (Strong's), `cross_refs` (344,799). **Phase 1 requires a v2 rebuild** adding:

1. **Fix versification-notation bug.** Refs like `Dan.4.1(3.31)#01` are currently dropped
   (Daniel 4 & 6 missing; likely Psalm titles, Joel, Malachi, Hosea too). Regex →
   `/^(\w+)\.(\d+)\.(\d+)(?:\([^)]*\))?#(\d+)/`.
2. **3-way language tag.** Re-derive `words.lang ∈ {grc, hbo, arc}` from morphology
   (Aramaic = morph prefix `A`), so chapter-language auto-detect is a pure query.
3. **Load MACULA semantic data** → new tables:
   - `word_domain(strongs, lemma, louw_nida, domain, frame)` — from macula-greek (+ macula-hebrew via git-lfs).
   - `synonyms(strongs_a, strongs_b, distance)` — from `Proximity.tsv` (spans G/H/A).
   - `word_sense(strongs, sense_id, gloss)` — from the word-senses file (Type-B precision).
4. **Precompute `differences`** (see §8) into a table at build time.
5. **Gloss normalization** helper (strip articles/punctuation) for Type-B counts.
6. **Completeness validation build-gate.** Assert per-book chapter counts and per-chapter
   max verse vs a canonical versification reference; verify every original book+chapter is
   present; reconcile English verses vs original words; **fail the build on any gap.**

`build/build-db.mjs` is the single source that produces `bible.db`; the app never parses raw sources.

---

## 4. Modes

- **Study mode** (this spec): split screen, Workbench active.
- **Comparison mode** (stub only): Bible ↔ another Bible, **no workbench** — left = one full-height
  version, right = another. Extra features TBD. Not built beyond a mode toggle + dual reader in Phase 1.
- We do **not** compare English versions inside the Workbench; that is Comparison mode's job.

---

## 5. Visual design language — DECIDED: Scholarly print (light + dark)

Per unslop-ui: the look is **not** specified yet and must **not** be defaulted. Building UI without a
chosen brief yields the median training-data look that reads as AI-made. Two default traps to avoid
explicitly:
- untouched **shadcn / Tailwind** defaults;
- the current "tasteful default" — warm **cream** background + a display **serif** (Fraunces / Instrument
  Serif / Playfair) + **sage/forest green** accent (Claude's house style). Swapping the old purple-gradient
  slop for this is not unslopping.

**Chosen: Direction 2 — Scholarly print** (below). Ink-on-paper, a genuine text serif for scripture,
small-caps labels, apparatus-style accent inks; dense and bookish (a printed reference Bible / critical
edition) — deliberately **not** the cozy cream + display-serif AI look. The guardrails above still apply.

**Light + dark mode with a switcher.** Both modes stay in the scholarly identity: dark mode is a **warm,
candlelit-manuscript dark** (parchment ink on warm near-black), never a cold slate/grey dark. Default to
the OS `prefers-color-scheme`; a manual ☀/☾ toggle overrides; the choice persists locally.
- *Light (warm paper):* bg `#f2ede2` / panel `#f7f3ea`, ink `#201d18`, rules `#d8cdb8`; A oxblood `#8a2f2f`, B indigo `#33407a`.
- *Dark (candlelit):* bg `#1c1813` / panel `#24201a`, ink `#e6ddc9`, rules `#3a3327`; A `#d98070`, B `#93a3da` (accents brightened for contrast).
- *Type:* a real text serif for scripture (Iowan Old Style / Charter / Georgia class — **not** Fraunces/Playfair display) + a proper Greek/Hebrew Unicode face (SBL Greek/Hebrew) for originals.

For the record, the three directions considered:

**Direction 1 — Technical instrument** (best structural fit for a data-dense workbench)
- *Reference:* a code IDE / analytics console (Linear, a DB console, a terminal).
- *Color:* muted functional base (dark or light) + one sharp, deliberately chosen accent (not framework
  blue/purple, not sage). A/B difference marks = two distinct functional hues chosen on purpose.
- *Type:* a technical grotesque sans for UI (not Inter/Geist-on-autopilot) + a mono for the
  interlinear/data/Greek-Hebrew alignment.
- *Layout intent:* dense, panel-based, keyboard-first — matches the workbench, hotkeys, rearrangeable cards.

**Direction 2 — Scholarly print** ✅ CHOSEN
- *Reference:* a serious printed study Bible / critical edition (Nestle-Aland, a quality reference Bible).
- *Color:* near-black ink on warm off-white, restrained; apparatus-style accent ink for A/B. *Guard:* stay
  dense and bookish — NOT cozy-blog cream+serif.
- *Type:* a genuine text serif for scripture (a reading/book face, not a display serif) + a quiet sans for chrome.
- *Layout intent:* generous margins, footnote-apparatus feel, authoritative.

**Direction 3 — Calm reading-first**
- *Reference:* a minimal reader (iA Writer, Readwise Reader).
- *Color:* restrained neutral + a single deliberate accent.
- *Type:* one well-chosen reading face; workbench typography quieter/secondary.
- *Layout intent:* spacious, text-is-hero; the workbench recedes until invoked. (*Tension:* fights the data density.)

**Decision:** Scholarly print, light + dark, with an OS-aware ☀/☾ switcher (persisted). Rejected as too
tool-like / too sparse respectively: Technical instrument and Calm reading-first. A stated choice, per unslop-ui.

## 6. Home / Landing view

The app opens to a **Home** page (not straight into Study mode). Scholarly-print theme, light/dark.
**Open editorial layout — not boxed cards**; sections breathe, separated by hairline rules. All data local.
**Responsive:** full-width greeting row on top; then a **50/50 split** — **left:** resume + word-of-the-day
*card*; **right:** reading activity (streaks + contribution graph). A **bottom row** then splits into a
**To-study list** (left ⅓) + **Recent notes** sticky-note **grid** (right ⅔). Collapses to a single column
on mobile. Sections:
- **Greeting** — "Welcome back, {name}" where **{name} is user-editable** (click to type; stored locally).
  The greeting phrase **randomizes** among a few variants for fun (e.g. "Welcome back", "Grace and peace",
  "Back to the Word", "The Word awaits"); the subline sometimes shows a verse.
- **Resume** — last-read position (`{version, book, chapter, verse}` from local state) → "Continue reading"
  jumps into Study mode there.
- **Reading activity** — a GitHub-style contribution graph of reading days, **auto-tracked** (any day a
  chapter is opened counts), colored by chapters-read intensity in a **scholarly ink/oxblood ramp** (not
  GitHub green). Plus current **streak**, days-this-year, total chapters.
- **Word of the day** — a small **card** in the left column (between Resume and Reading activity); a
  data-derived nugget from the `differences` table (a rotating Type A/B word, e.g. ψυχή soul/life); tap →
  study that verse. Small curated fallback set. **No AI.**
- **To study** — bottom-left (⅓): an **editable checklist** of things to look into (add / edit-inline /
  delete; free text). **Check-off flow:** check → strikethrough → after **3s** the item slides out and is
  **archived** with its completion date; **unchecking within the 3s cancels** the archive. A **"View past
  items →"** link (top-right of the section header) opens a **modal** listing all completed items with dates
  (read-only; can promote to a standalone page later if it grows search/restore/filter). Stored locally.
- **Recent notes** — bottom-right (⅔): latest notes from IndexedDB as a **grid of sticky notes** (wraps to
  multiple columns; pinned/tilted, warm paper, hover straightens; ref + snippet + date; click to jump).
  Single column on mobile.

All Home entry points (Resume, a note, word-of-the-day) enter Study mode.

## 7. Layout & interaction (Study mode)

Two panes: **Reader** and **Workbench**.

- **Arrangeable split:** side-by-side (L/R) or stacked (top/bottom); user can swap which pane is on
  which side/top. Orientation + side persist in local storage.
- **Reader:** paginated by chapter; version selector (NIV/NKJV/NLT). **In-text colored underlines**
  mark significant words: **blue = Type A**, **purple = Type B**, **both = double underline** (blue
  under purple). Unmarked = nothing (presence is binary — no "none" category). Tap an underlined word
  → opens its Differences card. Selecting a verse drives the whole Workbench.
- **Workbench:** a vertical stack of **draggable cards** (⠿ to reorder; order persists).
  - **Card hotkeys:** `1`,`2`,`3`… map to the cards in current display order (jump/toggle).
  - Cards respond to the current selection (verse / word).

---

## 8. Workbench cards (components)

Each card is an isolated unit: a query + a render. Cards can be reordered without affecting each other.

1. **Original-language view.** The selected verse read as a full **interlinear** (every word, in order):
   original, translit/pronunciation, gloss, and tap-any-word → parsing + Strong's + lexicon + concordance.
   Its value vs the Differences card: breadth (the *whole* verse, incl. words the engine didn't flag) vs
   depth (only the flagged words). **Collapsed by default** — Differences + in-text underlines are the
   primary surface; open this when you want to read/explore the original. Auto-detects chapter language(s)
   via `SELECT DISTINCT lang FROM words WHERE book=? AND chapter=?` (offer a toggle for Aramaic-mixed chapters).
   *Default card order:* Differences (open) → Original (collapsed) → Context → Stats → Notes; all reorderable.

2. **Differences (the difference engine).** Lists the interpretive differences in the selected verse,
   each badged **A** or **B**, driven by the precomputed `differences` table. Every original-language word
   is shown with its **transliteration/pronunciation** (`words.translit`):
   - **Type A — synonym collapse.** A content word (noun/verb/adj) whose Strong's has a near-synonym
     — via `synonyms.distance < threshold` and/or shared Louw-Nida domain — that the translation did
     *not* use. Renders: `"loves" → φιλέω (used) vs ἀγαπάω (near-synonym)` + the sense contrast.
   - **Type B — semantic-range spread.** A content word whose lemma maps to ≥2 meaningfully distinct
     normalized English glosses across the corpus (refined by `word_sense`). Renders the sense
     distribution bar (e.g. ψυχή → soul 32× / life 31× / self) + "this rendering chose X, hiding Y."
   - Thresholds are tunable constants, calibrated during implementation against known cases
     (John 21:15-17 love; ψυχή soul/life; λόγος; σάρξ). Precomputing into `differences` keeps runtime
     a lookup and the results reviewable.

3. **Context & cross-references (L1 + L2).** L1 per-verse: `cross_refs` for the verse (vote-ranked,
   click to jump) + the verse's key content words. L2 per-chapter: aggregate — cross-ref density,
   key/recurring words, chapter word stats. Structured data only (no prose).

4. **Stats + word selector.** Verse/chapter word & phrase counts, Strong's frequency. **Word selector:**
   pick a word (e.g. right-click → count) → count occurrences of that English word across the entire
   selected version, and (optionally) count its underlying original **lemma** across the whole Bible
   (concordance). Whole-corpus queries — a reason the whole DB is client-side.

5. **Notes.** Create/edit a note linked to the selected **verse** (`book.ch.v`) or the current
   **chapter** (`book.ch`). Stored in IndexedDB.

**Notes page** (separate view): lists every note, grouped/filterable, edit in place, click to jump
back to the linked verse/chapter. **Export/import** notes as a JSON file for personal cross-device
portability (still no auth).

---

## 9. Data flow

1. App loads → fetch + cache `bible.db` → `sql.js` opens it in memory.
2. Reader renders a chapter (verses for the selected version) + applies underlines from a single
   `differences` query for the chapter.
3. User selects a verse/word → each visible card runs its scoped query and renders.
4. Notes read/write go to IndexedDB (independent of `bible.db`).
5. Layout/arrangement/version prefs persist in local storage.

---

## 10. Local state (IndexedDB + localStorage)

**Notes** (IndexedDB):
```
note { id uuid; target_type "verse"|"chapter"; ref "John.12.25"|"John.12"; body markdown; created_at, updated_at }
```
Indexed by `ref` (show notes on a verse/chapter) and `updated_at` (Notes-page + Home "recent" ordering).
Export = dump all notes to JSON; import = merge by `id`.

**App state** (localStorage, small):
- `last_position` — `{version, book, chapter, verse}` → Home "Resume".
- `reading_activity` — `{ "YYYY-MM-DD": chaptersReadCount }`, auto-incremented when a chapter is opened →
  streak + contribution graph.
- `to_study` — checklist items `{ id, text, done, completed_at }`; active list = not-yet-archived, archive
  = completed items (retained with `completed_at`) shown in the "View past items" modal.
- `prefs` — user `name` (for the Home greeting), theme (light/dark/system), split orientation + side, card order.

---

## 11. Error handling

- **Missing interlinear for a verse** (versification edge or a gap): the Original-language and
  Differences cards show "no original-language data for this verse" rather than empty/broken. The
  v2 validation gate should make this rare.
- **Lexicon miss** (~9% of tagged words): show the interlinear gloss without a definition; never block.
- **`bible.db` fails to load:** clear error state with a retry; app shell still renders.
- **Aramaic dual-language chapter:** default to the verse's own language; offer a toggle.
- **NKJV fused-marker artifacts** (known): acceptable in Phase 1; not corrected here.

---

## 12. Testing & validation

- **DB build gate** (§3.6): completeness assertions fail the build on any dropped chapter/verse.
- **Difference-engine fixtures:** assert Type A fires on John 21:15-17 (agapaō vs phileō) and
  Type B fires on ψυχή (soul/life), σάρξ, λόγος; assert function words ("as", "then", "in") never fire.
- **Language auto-detect:** Gen 1 → hbo, Matt 1 → grc, Dan 2 → hbo+arc switch at 2:4b.
- **Query latency:** whole-version word count and cross-Bible concordance return acceptably fast in
  `sql.js` (spot-check; add indexes as needed).
- **Notes:** create/edit/delete, export→import round-trip preserves all notes.

---

## 13. Open items (resolve during implementation)

- `sql.js` in-memory vs `wa-sqlite`+OPFS — start `sql.js`, measure, upgrade if needed.
- Exact Type-A/B thresholds — calibrate against the fixture cases.
- `macula-hebrew` needs git-lfs for OT semantic domains; Greek NT works without it (Type A/B for the
  OT is degraded until then — acceptable interim).
- Difference precompute granularity (per word vs per verse) — likely per word, keyed to `words`.
- **Type-B sense-spread counts** (e.g. ψυχή "soul 32× / life 31×") come from the **STEPBible interlinear
  gloss** (version-independent), NOT the exact NIV/NKJV/NLT rendering — word-level alignment to a specific
  copyrighted English version isn't available (MACULA aligns to a base text, not NIV). Present + label as
  the word's *translation-spread across the NT/OT*, not "how NIV renders it."
- **Word affordance rule:** buttons imply a *choice*. **Type A** shows the used word + near-synonym(s) as
  **buttons** to compare ("used" inked, alternatives plain). **Type B** is a single word → rendered
  **inline / underlined** (clickable, no button box). Both open the word's detail. The Original card's
  interlinear words are tappable cells (also not buttons).
