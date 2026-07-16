# Synthesis: Open Bible Context Resources for DeepVerse's Context Tab

**Status:** COMPLETE
**Last updated:** 2026-07-14

---

## 1. Executive summary

- **Two needs, two very different data situations.** NEED #1 (per-chapter recap) is *content-scarce*: exactly one open-ish dataset gives a true one-summary-per-chapter, and it isn't openly licensed. NEED #2 (structured cultural/historical/geographic background) is *content-rich*: a normalized, chapter-keyed knowledge graph already exists and can be joined to dictionaries, geodata, and cultural articles.
- **NEED #1 winner (with a caveat): Chris Juby's Bible Summary** — all 1,189 chapters, one ≤140-char sentence each — is the only genuine 1-per-chapter dataset, but bulk use requires an emailed permission (DeepVerse's offline/non-profit/Scripture-engagement profile fits his stated grant criteria) ([biblesummary.info/licensing](https://biblesummary.info/licensing/)). License-clean fallback: extract/condense the chapter "Contents"/"argument" headers already present in PD commentaries (Matthew Henry, Adam Clarke, Darby, Pulpit, Keil & Delitzsch), which **HelloAO already exposes as a per-chapter `introduction` field** ([bible.helloao.org/docs/reference](https://bible.helloao.org/docs/reference/)).
- **NEED #2 backbone: Theographic Bible Metadata.** Its Chapters table is keyed by `osisRef` (`Gen.1`) with precomputed `peopleCount`/`placesCount` and a Verses FK rollup, so "who/where/what/when for this chapter" is trivially derivable ([json-fields-documentation.md](https://github.com/robertrouse/theographic-bible-metadata/blob/master/docs/json-fields-documentation.md)). Layer OpenBible.info geodata, Tyndale Open Resources (cultural articles), PD dictionaries (entity enrichment), and Theographic's Events table (timeline) on top.
- **Licensing is not a blocker.** Bundling CC BY-SA data (Theographic, Tyndale) into a closed-source, possibly-commercial offline app is legally safe: ShareAlike reaches only the derived *data* (attribute it, keep that data BY-SA, don't DRM-block extraction), never the app's code — confirmed directly by the CC FAQ and BY-SA 4.0 legal code ([Creative Commons FAQ](https://creativecommons.org/faq/), [BY-SA 4.0 legal code](https://creativecommons.org/licenses/by-sa/4.0/legalcode.en)).
- **The honest gap:** no dataset ships pre-written "this chapter happens in nation X, whose custom was Y" cards. That narrative is *generated* by joining a chapter's entities (Theographic) to dictionary/cultural articles (Tyndale/Easton/ISBE) — the join is easy because everything anchors on `osisRef`/verse references. The two real risks are the Tyndale-distribution ambiguity and versification alignment against DeepVerse's existing `bible.db` keys.
- **Fastest shippable v1:** import Theographic alone → you immediately get a per-chapter background pane (people, places w/ coords, events, approximate year). Add HelloAO chapter `introduction` for a recap, and Tyndale/Easton articles for the cultural narrative, in that order.

## 2. Master resource table

One row per distinct resource (deduped across the three research files). **Serves:** R = per-chapter recap (NEED #1), B = cultural/historical background (NEED #2), G = geographic, D = dictionary/entity enrichment.

| Resource | What it provides | Granularity | License | Ready-made format | Serves |
|---|---|---|---|---|---|
| **Bible Summary — Chris Juby** ([site](https://biblesummary.info/), [license](https://biblesummary.info/licensing/)) | 1,189 chapters, one ≤140-char sentence each | **Per-chapter (true 1:1)** | **NOT open** — quotes OK w/ attribution; bulk use needs emailed permission | Website + book; no bulk data grant | **R** |
| **Theographic Bible Metadata** ([repo](https://github.com/robertrouse/theographic-bible-metadata), [fields](https://github.com/robertrouse/theographic-bible-metadata/blob/master/docs/json-fields-documentation.md)) | ~3,000 people, ~1,600 places w/ GPS, 4,000+ events, periods; Easton's dict text embedded; Chapters/Books/Verses tables | **Chapter (`osisRef`) + verse FK rollup**; entity↔passage graph; Chapters has peopleCount/placesCount | **CC BY-SA 4.0** | JSON (nested), CSV, Neo4j, GraphQL | **B, G, D, (R-header)** |
| **HelloAO / Free Use Bible API** ([docs](https://bible.helloao.org/docs/), [ref](https://bible.helloao.org/docs/reference/)) | 1,000+ Bible texts + PD commentaries (Clarke, Henry, JFB, Gill, Keil-Delitzsch, Tyndale) with per-**chapter `introduction`** field | Chapter intro + verse notes, structured | Aggregate "no copyright restrictions"; verify upstream per source | Flat JSON files / API ([repo](https://github.com/HelloAOLab/bible-api)) | **R, B** |
| **Matthew Henry Complete (MHC)** ([STEP](https://www.stepbible.org/version.jsp?version=MHC)) | Whole-Bible commentary; per-chapter "Contents" overview headers | ◐ Chapter "Contents" + verse-range prose | Public Domain | SWORD, CCEL XML, Bible Hub HTML, HelloAO JSON | **R, B** |
| **Adam Clarke's Commentary** ([Bible Hub](https://biblehub.com/commentaries/)) | Critical/philological notes; chapter "argument" at each chapter head | ◐ Chapter argument + verse notes | Public Domain | SWORD (`Clarke`), HelloAO JSON, Bible Hub | **R, B** |
| **Darby's Synopsis** ([Bible Hub](https://biblehub.com/commentaries/)) | Book/section synoptic overview prose | ◐ Per-book/section synopsis | Public Domain | SWORD (`Darby`), Bible Hub HTML, CCEL | **R, B** |
| **Pulpit Commentary** ([free DL](https://biblicalstudies.org.uk/blog/the-pulpit-commentary-now-available-for-free-download/)) | Homiletic exposition + per-chapter/passage intros | ◐ Chapter/passage exposition + verse notes | Public Domain | PDF, SWORD, Bible Hub/StudyLight HTML | **R, B** |
| **Keil & Delitzsch (OT only)** ([archive.org](https://archive.org/details/BiblicalCommentaryOldTestament.KeilAndDelitzsch.6)) | Scholarly OT commentary; section/chapter intros | ◐ Section/chapter intros + verse notes (OT) | Public Domain | archive.org, SWORD (`KD`), HelloAO JSON | **R, B** |
| **JFB / Barnes / Gill / Geneva / Scofield / Wesley / Robertson** ([Bible Hub](https://biblehub.com/commentaries/)) | Verse-by-verse PD commentary/notes | ✗ Verse-level (some book intros) | Public Domain | SWORD, Bible Hub HTML | **B** (verse pane) |
| **Tyndale Open Study Notes (TOSN / "TNotes")** ([tyndaleopenresources.com](https://tyndaleopenresources.com/), [STEP TNotes](https://www.stepbible.org/version.jsp?version=TNotes)) | Verse study notes, book intros, people profiles, theme articles (incl. cultural background) | Verse/passage-keyed notes (→chapter); theme/profile articles topic-keyed | **CC BY-SA 4.0** ([details](https://freely-given.org/OBD/TOSN/details.htm)) | XML (zip); STEP TNotes | **B, R** |
| **Tyndale Open Bible Dictionary (TOBD)** ([tyndaleopenresources.com](https://tyndaleopenresources.com/)) | Articles on people, places, concepts, **cultural context**, theology | Topic-keyed (article per entry), linkable from chapter entities | **CC BY-SA 4.0** | XML | **B, D** |
| **OpenBible.info Bible Geocoding** ([geo](https://www.openbible.info/geo/), [repo](https://github.com/openbibleinfo/Bible-Geocoding-Data)) | Every identifiable biblical place: coords, confidence, Wikidata links, region geometry, thumbnails; 70+ sources; per-chapter place views + KML | **Place, cataloged by verse ref**; per-book/per-chapter place listings | **CC BY 4.0** (embedded OSM geometry = ODbL) | JSON Lines, GeoJSON, KML | **G** |
| **STEPBible TIPNR** ([repo](https://github.com/STEPBible/STEPBible-Data)) | ~4,299 individuated proper names (people/places/things) + all refs, family links, brief AI-written descriptions | **Name → verse references** | **CC BY 4.0** | TSV / tab-delimited txt | **D, G** |
| **neuu-org dictionary dataset** ([repo](https://github.com/neuu-org/bible-dictionary-dataset)) | Easton 3,962 + Smith 4,561 + Hitchcock 2,619 + Hastings 5,033 + Schaff 4,725 = 20,900 entries, pre-parsed scripture refs | Entry/headword-keyed | **CC BY 4.0** (PD content, CC BY dataset) | Clean JSON w/ `scripture_refs[]` | **D** |
| **JWBickel/BibleDictionaries** ([HF](https://huggingface.co/datasets/JWBickel/BibleDictionaries)) | Easton, Smith, Hitchcock, Torrey as JSON | Entry-keyed | Public Domain | Drop-in JSON | **D** |
| **ISBE (1915)** ([archive.org](https://archive.org/details/theinternationalstandardbibleencyclopedia)) | Largest/richest PD encyclopedia, long scholarly articles | Entry/headword-keyed | Public Domain | archive.org scans, HTML, SWORD (heaviest to parse) | **D, B** |
| **Easton's Bible Dictionary (1897)** ([internationalstandardbible etc.]) | ~4,000 concise entries on people/places/things | Entry-keyed (also embedded in Theographic) | Public Domain | JSON (neuu/JWBickel), SWORD, XML at CCEL | **D** |
| **Nave's / Torrey's Topical** ([naves](https://www.naves-topical-bible.com/)) | Topic → curated verse-reference lists | Topic-keyed; payload = verse lists (reverse-index candidate) | Public Domain | SWORD, HTML, some JSON (Torrey in JWBickel) | **B** (topic links) |
| **MetaV** ([repo](https://github.com/theonize/KJV-bible-database-with-metadata-MetaV-)) | Who/where/when per WORD; people, places, `YearNum` (Ussher+Torrey), cross-refs | Word → verse → chapter | CC BY-SA (compile) over PD sources | CSV | **B (year), D** |
| **Treasury of Scripture Knowledge (TSK)** | ~500K cross-references | ✗ Per-verse cross-refs only | Public Domain | SWORD (`TSK`), CSV/JSON | (related-verses, not context) |
| **ussherR / Ussher Annals** ([CRAN](https://search.r-project.org/CRAN/refmans/ussherR/html/usshfull.html)) | Ancient chronology, dated events | Event/date rows | PD source; OSS package | R data → CSV | **B (timeline)** |
| **Thiele Hebrew-Kings dates** ([re-derivation CC BY](https://www.academia.edu/43170207/)) | Regnal dates of kings of Israel/Judah | Per-king reign spans (facts) | Facts uncopyrightable; CC BY re-derivation exists | tabular (compile yourself) | **B (timeline)** |
| **midvash/bible-data** ([site](https://midvash.github.io/bible-data/)) | Bible text structured by book/ch/verse | Structure only | Public Domain | JSON + **SQLite** | (structural scaffold) |
| **OpenBible pericope/section data** ([labs](https://www.openbible.info/labs/bible-section-sankeys/)) | Section-boundary offsets (outline) | Section boundaries | CC BY 4.0 | data/diagrams | (outline scaffold) |
| **HistoricalChristianFaith Commentaries-DB** ([repo](https://github.com/HistoricalChristianFaith/Commentaries-Database)) | Verse-keyed patristic commentary in prebuilt **SQLite** | Verse-keyed | **MIXED** — PD fathers + in-copyright moderns (C.S. Lewis, Wilson) | SQLite release | ⚠ filter before use |
| **NET / ESV / NIV / NLT / NKJV / NASB / IVP / Keener / MacArthur / Guzik / Logos Pericopes** | Modern texts/notes/commentary | various | ✗ **Copyrighted/proprietary** | n/a | ⛔ do not bundle |

## 3. For Context-tab need #1 — per-chapter recap/overview

Ranked realistic options, best fit first:

1. **Chris Juby's Bible Summary — the only true 1-summary-per-chapter dataset, but not openly licensed.** All 1,189 chapters, one ≤140-char sentence each ([biblesummary.info](https://biblesummary.info/), confirmed [BBC](https://www.bbc.com/news/uk-england-tyne-24868490)). Individual summaries may be quoted with attribution, but **larger sections or the whole project are explicitly NOT open-licensed** — you must email Juby for permission ([licensing page](https://biblesummary.info/licensing/)). He states he is *likely to grant royalty-free permission* if the project is small, offline, non-profit, helps people engage Scripture, isn't pushing a narrow agenda, and links back. **DeepVerse fits this profile well** (offline, Scripture-engagement). **Action item: send that email before assuming rights.** This is the highest-value, lowest-effort path *if* permission lands.

2. **PD commentary chapter-headers, surfaced via HelloAO's `introduction` field (license-clean fallback).** Several PD commentaries carry genuine chapter-level overviews at the head of each chapter: **Matthew Henry's "Contents"** header, **Adam Clarke's chapter "argument"**, **Darby's synopsis**, **Pulpit** chapter exposition, and **Keil & Delitzsch** section intros (OT). Crucially, **HelloAO has already parsed a per-chapter `introduction` field** out of these PD commentaries into structured JSON ("The introduction that the commentary provided to the chapter") ([HelloAO reference](https://bible.helloao.org/docs/reference/)) — so you get chapter-level overview text without scraping HTML. These are wordier than one sentence; a light condensation pass (or your own TTS/summarization pipeline) yields a clean recap. Fully license-clean (PD), no permission needed.

3. **Generate your own ≤140-char summaries from the PD chapter-headers.** If Juby declines, condense the HelloAO `introduction` text (option 2) into short recaps yourself. Fully license-clean; the only cost is a generation/QA pass over 1,189 chapters.

Not suitable for NEED #1: Berean/BSB (publishes section headings, not chapter summaries); verse-level PD commentaries (Barnes, Gill, Geneva, Scofield, Wesley, Robertson, JFB); TSK (cross-references only); structural datasets (midvash, pericope boundaries) which carry no prose.

**Recommendation:** pursue Juby permission in parallel, but build v1 on HelloAO chapter `introduction` (option 2) so the feature ships regardless of the email outcome.

## 4. For Context-tab need #2 — structured thematic + cultural/historical/geographic background

**Backbone: Theographic Bible Metadata** ([repo](https://github.com/robertrouse/theographic-bible-metadata), CC BY-SA 4.0). It is a normalized knowledge graph anchored on `osisRef`, which makes per-chapter context nearly free to compute ([json-fields-documentation.md](https://github.com/robertrouse/theographic-bible-metadata/blob/master/docs/json-fields-documentation.md)):

- **Chapters table** keyed by `osisRef` = `book.chapter` (e.g. `"Gen.1"`), with `chapterNum`, `writer` (traditional author), `verses` (links), and **precomputed `peopleCount` / `placesCount`** (distinct named people/places in that chapter). This is the exact join key DeepVerse needs — `osisRef` maps 1:1 to a chapter.
- **Verses table** is the finest grain, keyed by `osisRef` (`"Gen.2.8"`), with FK links to `people`, `places`, `peopleGroups`, and `event`, plus `yearNum` (from Torrey's TSK). Per-chapter context = union of all verses whose `chapter` FK matches → their people/places/events. (Chapters already precomputes the counts.)
- **Books table** gives per-book header material: `writers`, `placeWritten` (where the book was written), `yearWritten`, `peopleCount`, `placeCount` — good for "written in X, ~year Y."

Layers on top of the backbone:

- **Geography — OpenBible.info** ([geo](https://www.openbible.info/geo/), CC BY 4.0). The canonical open gazetteer: every identifiable place with coordinates, confidence ratings, Wikidata links, region geometry, and **native per-book/per-chapter place listings** ([e.g. Matthew preview](https://www.openbible.info/geo/preview/matt) has a "Chapters with Places" section) plus per-book KML. Note: **Theographic's Places table already ingests OpenBible coords** (`openBibleLat`/`openBibleLong`) reconciled with Recogito/GeoNames, so for a lean bundle Theographic's Places may suffice; pull the full `ancient.jsonl`/`modern.jsonl` only if you want confidence ratings and region polygons. Caveat: OpenBible's polygons embed OpenStreetMap geometry under **ODbL** — the point coordinates/text are the clean CC BY part.
- **Cultural narrative layer — Tyndale Open Resources** ([tyndaleopenresources.com](https://tyndaleopenresources.com/), CC BY-SA 4.0). This is the single best open substitute for the (copyrighted) IVP Bible Background Commentary. **TOSN** (Tyndale Open Study Notes) gives **verse/passage-keyed study notes** that roll up to chapter, plus book intros, people profiles, and theme articles. **TOBD** (Tyndale Open Bible Dictionary) adds articles on people, places, concepts, and explicitly the **"cultural context of scripture"** ([details](https://freely-given.org/OBD/TOSN/details.htm)). Study notes attach per chapter directly; theme/dictionary articles attach via the people/places/concepts a chapter mentions.
- **Entity enrichment — PD dictionaries.** For "who/what is X," join a chapter's named entities (from Theographic) to entry-keyed PD dictionaries: **Easton** (already embedded in Theographic's `Easton` table linked per person/place), plus **ISBE, Smith, Hitchcock** (name meanings/etymology). Lowest-effort packaging is the **neuu-org JSON** (20,900 entries with pre-parsed `scripture_refs[]`, CC BY 4.0) ([repo](https://github.com/neuu-org/bible-dictionary-dataset)) or **JWBickel** (PD JSON). **STEPBible TIPNR** (CC BY 4.0) adds copyleft-free individuated proper names with family relationships.
- **Timeline/chronology — Theographic Events table.** A ready-made datable timeline: each event has `title`, `startDate` (ISO astronomical year, negative = BC), `duration`, `participants`→people, `locations`→places, `verses`→scriptural basis, `predecessor`/`lag`/`partOf` dependency links, and `sortKey` for chronological ordering. Because events link to verses (→chapters), they surface per chapter. Supplement with a per-chapter approximate year from Theographic's `yearNum` / MetaV `YearNum` (Ussher + Torrey, PD), and a small Hebrew-Kings reign table compiled from Thiele's (uncopyrightable) figures for OT historical books.

**How the "who/where/what/when" card assembles per chapter:** for a given `osisRef`, pull the chapter's people/places/events/year from Theographic → attach OpenBible coords for a map → attach TOBD/Easton articles for each named entity → attach TOSN notes keyed to that passage for the cultural narrative. Everything anchors on `osisRef`/verse references, so the join is straightforward.

## 5. Licensing & attribution: what's safe to bundle

**Definitive answer to the ShareAlike question for a possibly-commercial, closed-source app: bundling/displaying CC BY-SA content does NOT force your app open-source.** ShareAlike attaches to **Adapted Material** — a modified derivative of the licensed *data* — not to independent software that merely shows the data. Your Svelte/TS code is a separate work, never a derivative of the dataset.

From the CC BY-SA 4.0 legal code ([creativecommons.org/licenses/by-sa/4.0/legalcode.en](https://creativecommons.org/licenses/by-sa/4.0/legalcode.en)):
- **"Adapted Material"** = material "derived from or based upon the Licensed Material and in which the Licensed Material is translated, altered, arranged, transformed, or otherwise modified" — so SA triggers only when you **modify the data itself**.
- **Section 3(b)** requires the SA license *"if You Share Adapted Material You produce"* — verbatim redistribution and internal/private use are not the trigger; the SA license binds only your contributions to the adapted data, and you may not apply DRM ("Effective Technological Measures") that blocks the granted rights.
- **Section 4 (Sui Generis Database Rights):** if you include a substantial portion of a BY-SA dataset in `bible.db`, "the database ... **(but not its individual contents)** is Adapted Material" — the compiled database must be offered BY-SA, but co-resident PD and CC BY tables are **not** swept into BY-SA merely by sharing the file.

The decisive **CC FAQ** answer on exactly this fact pattern ([creativecommons.org/faq](https://creativecommons.org/faq/)): *"CC licenses never require a reuser ... to make the original work or resulting works (collections, derivatives, etc.) publicly available ... the condition only applies if a work is modified and if the work is shared publicly ... CC licenses do not require the collection or the compilation itself to be made available under an SA license"* — a compilation can be licensed as a whole under the compiler's chosen terms, while each embedded BY-SA work keeps its own BY-SA license and attribution.

**License buckets:**
- **Public Domain (no obligations):** ISBE, Easton, Smith, Hitchcock, Nave, Torrey, Hastings, Schaff, Fausset, Matthew Henry, Adam Clarke, JFB, Gill, Keil-Delitzsch, Barnes, Wesley, Scofield, Geneva, TSK, Ussher, Thiele figures, KJV/BSB text. Bundle freely; attribution is courtesy only.
- **CC BY 4.0 (attribution only, no copyleft):** OpenBible.info geocoding, STEPBible TIPNR/TBESH/TBESG, neuu-org datasets, TIPNR-derived data. Bundle in a closed-source commercial app; just credit + license notice + link, and note if modified.
- **CC BY-SA 4.0 (attribution + ShareAlike on derived data only):** Theographic, MetaV (compilation), Tyndale Open Study Notes, Tyndale Open Bible Dictionary. Safe to bundle; obligations are (i) attribute each source in an about/credits screen linking CC BY-SA 4.0; (ii) if you transform the data, keep *that derived table/export* offered under CC BY-SA and don't DRM-block extraction; (iii) never relicense the BY-SA-derived data under more restrictive terms. App code stays under whatever license you choose.
- **HelloAO aggregate:** self-declares "no copyright restrictions" over the aggregate, but each bundled translation/commentary keeps its upstream license — the commentaries it serves are all PD, so those are safe.

**Avoid these infringing/mixed repos:**
- Repos redistributing **NIV/NLT/NKJV/NASB/ESV** (e.g. Amosamevor/Bible-json, scott-epperly/Bible-json) — copyrighted translations, infringement regardless of an "open-source" label.
- **NET Bible notes** (© Biblical Studies Press), **IVP / Keener / MacArthur / Guzik** (Guzik is free-to-read but not PD), **Logos Pericopes Dataset** (proprietary paid) — do not bundle.
- **HistoricalChristianFaith/Commentaries-Database** — ships a convenient prebuilt SQLite but **mixes PD church fathers with in-copyright modern authors (C.S. Lewis, Douglas Wilson)**; only usable if filtered to genuinely PD authors, not wholesale.
- **e-Sword/MySword/theWord community modules** — the *format* is open SQLite, but most modules are user-uploaded copyrighted works; licensing is per-module.

## 6. Contradictions, gaps & open questions

- **No dataset ships pre-written "nation X, custom Y" cards.** The single biggest honest gap: NEED #2's ideal deliverable ("this chapter happens in nation X whose custom was Y") does not exist as a ready dataset. It must be **generated by joining** a chapter's entities (Theographic people/places/events) to dictionary/cultural articles (TOBD/TOSN/Easton/ISBE). The join is clean (`osisRef`/verse anchors), but the *narrative assembly* — selecting which entity's cultural note is most relevant to a chapter and phrasing it — is work DeepVerse must do (likely an LLM generation + QA pass over 1,189 chapters, mirroring the existing TTS/summarization pipeline). This is the same shape of task as generating fallback chapter recaps in §3.
- **Tyndale / TOSN distribution ambiguity — must be resolved before relying on it.** The research conflicts: Agent 2 found TOSN available as XML from [tyndaleopenresources.com](https://tyndaleopenresources.com/) and via STEPBible as version **TNotes** ([STEP TNotes](https://www.stepbible.org/version.jsp?version=TNotes)), CC BY-SA 4.0 ([details](https://freely-given.org/OBD/TOSN/details.htm)). Agent 3 checked the **STEPBible-Data GitHub repo** and found **no "TOSN" dataset listed there** (the repo's study-note-ish content is TBCWG and TIPNR descriptions), and flagged TOSN's license as unconfirmed. **Reconciliation:** these are two different distribution channels — the Tyndale study notes live at tyndaleopenresources.com (XML) and as STEP's `TNotes` version, *not* in the STEPBible-Data CC BY 4.0 TSV repo. Action: download the actual XML from tyndaleopenresources.com and confirm the license text in-package before committing, since Agent 3 could not verify it and NC would bar commercial use.
- **Versification / `osisRef` alignment risk.** Theographic, OpenBible, and STEPBible all key on `osisRef` (`book.chapter.verse`) and standard book abbreviations, but chapter/verse boundaries differ across versification traditions (KJV vs modern; Hebrew vs English numbering in Psalms/Joel/etc.). DeepVerse's existing `bible.db` has its own book+chapter+verse keys. **Before import, verify these align** (or build a mapping table); STEPBible's **TVTMS** (versification traditions mapping) is the tool for this if a mismatch appears. Chapter-level joins (the primary Context-tab grain) are lower-risk than verse-level joins, but Psalms/some OT books need a spot check.
- **MetaV/Theographic year data is mid-migration.** Theographic's `Books.yearWritten` was in an "unusable format as of 2026/01/05, undergoing a fix" (to become `isoYear` integers), and its Verses `yearNum` (Torrey) is explicitly "not aligned with the events table." Treat per-chapter approximate-year as best-effort, not authoritative, and don't cross-join yearNum with Events dates.
- **Robertson's Word Pictures (1930-33) US copyright** should be verified if used strictly — widely distributed as PD but renewal status varies (NT-only, so peripheral to the Context tab anyway).

## 7. Recommended stack, ranked by value-to-effort

**Build order (highest value-to-effort first):**

1. **Import Theographic Bible Metadata (CC BY-SA 4.0) — start here.** Single dataset, and it alone delivers a shippable per-chapter background pane: people, places (with coords), events, approximate year, per-chapter counts, all keyed by `osisRef`. Highest value-to-effort by a wide margin. Ingest the nested JSON (`Chapters`, `Verses`, `People`, `Places`, `Events`, `Easton`); the CSV files use array fields that need normalizing, so prefer JSON.
2. **Add HelloAO chapter `introduction` (PD) for NEED #1 recap.** Flat JSON, already per-chapter, license-clean. Ships the recap tab immediately without waiting on Juby.
3. **Email Chris Juby for Bible Summary permission (parallel, not blocking).** If granted, swap/augment the recap with his true 1-per-chapter sentences. DeepVerse's offline/non-profit profile fits his criteria.
4. **Add PD dictionaries via neuu-org JSON (CC BY 4.0) for entity enrichment.** 20,900 entries with pre-parsed scripture refs; join to Theographic's named entities for "who/what is X" cards. Easton is already in Theographic, so this mainly adds ISBE/Smith/Hitchcock depth.
5. **Add Tyndale Open Resources (TOSN + TOBD, CC BY-SA 4.0) for the cultural narrative** — *after* confirming the license from the actual tyndaleopenresources.com XML download (§6). This is what powers the "custom was Y" text.
6. **Optionally add OpenBible.info full geodata (CC BY 4.0)** only if you want confidence ratings / region polygons beyond the coords Theographic already carries. Honor ODbL if you ship OSM-derived geometry.
7. **Generate the "nation X / custom Y" narrative cards** by joining chapter entities → cultural articles (LLM + QA pass), once the source data (1, 5) is in.

**Fastest path to a shippable v1:** steps 1 + 2 — Theographic (background pane) plus HelloAO chapter `introduction` (recap) — give a working Context tab with zero blocking permission dependencies and only CC BY-SA attribution obligations.

**Proposed minimal schema sketch** (a `chapter_context` layer keyed by `book+chapter`, aligned to DeepVerse's existing `bible.db` keys; store `osisRef` as the bridge to source data):

```sql
-- One row per chapter: the recap + rolled-up counts.
CREATE TABLE chapter_context (
  book        TEXT NOT NULL,      -- match bible.db's existing book key
  chapter     INTEGER NOT NULL,
  osis_ref    TEXT NOT NULL,      -- 'Gen.1' — bridge to Theographic/OpenBible
  recap       TEXT,               -- HelloAO introduction (PD) or Juby summary (if licensed)
  recap_source TEXT,              -- 'helloao:matthew-henry' | 'juby' — for attribution
  writer      TEXT,               -- traditional author (Theographic Chapters.writer)
  approx_year INTEGER,            -- best-effort BC/AD (negative = BC)
  people_count INTEGER,
  places_count INTEGER,
  PRIMARY KEY (book, chapter)
);

-- Entities mentioned in a chapter (people/places/events), for the who/where/what card.
CREATE TABLE chapter_entity (
  book        TEXT NOT NULL,
  chapter     INTEGER NOT NULL,
  entity_type TEXT NOT NULL,      -- 'person' | 'place' | 'event' | 'group'
  entity_id   TEXT NOT NULL,      -- Theographic personID/placeID/eventID
  name        TEXT NOT NULL,
  latitude    REAL,               -- places only (Theographic/OpenBible)
  longitude   REAL,
  dict_ref    TEXT,               -- FK into dictionary_entry for enrichment
  FOREIGN KEY (book, chapter) REFERENCES chapter_context(book, chapter)
);

-- Entry-keyed dictionary/cultural articles (Easton/ISBE/Smith/Hitchcock/TOBD).
CREATE TABLE dictionary_entry (
  entry_id    TEXT PRIMARY KEY,   -- slug
  headword    TEXT NOT NULL,
  body        TEXT NOT NULL,
  source      TEXT NOT NULL,      -- 'easton' | 'isbe' | 'tobd' — drives attribution/license
  license     TEXT NOT NULL       -- 'PD' | 'CC-BY-4.0' | 'CC-BY-SA-4.0'
);

-- Optional: verse-keyed cultural notes (TOSN) for the narrative layer.
CREATE TABLE chapter_note (
  book TEXT, chapter INTEGER, verse INTEGER,
  note TEXT, source TEXT, license TEXT
);
```

Ship a **LICENSES/attribution manifest** listing Theographic (CC BY-SA 4.0), Tyndale Open Resources (CC BY-SA 4.0), OpenBible.info + STEPBible + neuu-org (CC BY 4.0), and the PD sources; offer the BY-SA-derived tables as a downloadable CC BY-SA export to satisfy ShareAlike. Keep app code under DeepVerse's own license.
