# DeepVerse — Data Provenance & Recovery Runbook

What to do if `bible.db`, the committed intermediates, or the raw `backup-data/` ever get lost or
corrupted: where every dataset came from, how to re-fetch it, how it's parsed, and — critically — the
cleanup each source needed (so a from-scratch rebuild reproduces the fixes instead of regressing them).

Read `docs/DATA-PIPELINE.md` first for the normal build flow. This doc is the disaster-recovery companion.

---

## Recovery in three tiers (do the least you need)

**Tier 1 — intermediates are intact (`build/data/sources/*.json.gz` present).**
Just rebuild. Nothing to fetch.
```
./install.sh                 # build bible.db from intermediates + install app deps
# or:  cd build && node build-db.mjs && node validate-db.mjs
```

**Tier 2 — intermediates lost, but `backup-data/` (raw sources) is intact.**
Re-derive the intermediates, then build.
```
cd build
node extract-sources.mjs     # backup-data/ -> build/data/sources/*.json.gz
node build-db.mjs && node validate-db.mjs
```

**Tier 3 — everything is gone (no `backup-data/` either).**
Re-fetch each raw source into `backup-data/` (§ below), then do Tier 2. The committed
`build/data/*.json` (study notes, recaps) and `data/bibles/` (verses) are in git, so those only need
re-fetching if you're rebuilding them from scratch too (§ "Committed derived data").

After any tier, the app picks up the new DB via its `copy-assets` step (`cd app && npm run dev`).

---

## Sources the build consumes (Tier 3 re-fetch targets)

All are CC-BY / CC-BY-SA and re-downloadable. Restore each to the path shown under `backup-data/`.

### 1. STEPBible-Data — words + lexicon
- **Feeds:** `words` (interlinear, 447k), `lexicon` (24.9k).
- **Origin / license:** https://github.com/STEPBible/STEPBible-Data — CC BY.
- **Fetch:** `git clone https://github.com/STEPBible/STEPBible-Data backup-data/STEPBible-Data`
- **Files used:** `Translators Amalgamated OT+NT/TAGNT Mat-Jhn…`, `TAGNT Act-Rev…` (Greek NT);
  `TAHOT Gen-Deu / Jos-Est / Job-Sng / Isa-Mal…` (Hebrew/Aramaic OT); `Lexicons/TBESG…`, `Lexicons/TBESH…`.
- **Parser:** `extract-sources.mjs` → `loadWords` / `loadLex`.

### 2. Clear-Bible / macula-greek — Greek semantics + synonym distances
- **Feeds:** `word_domain` (Greek Louw-Nida), `word_sense`, `synonyms`.
- **Origin / license:** https://github.com/Clear-Bible/macula-greek — CC BY.
- **Fetch:** `git clone https://github.com/Clear-Bible/macula-greek backup-data/macula-greek`
- **Files used:** `SBLGNT/tsv/macula-greek-SBLGNT.tsv` (per-word `domain`/`ln`/`frame`);
  `sources/Clear/synonyms/Proximity.tsv` (Strong↔Strong synonym-distance matrix, spans G/H/A).
- **Parser:** `extract-sources.mjs` (macula-greek block) via `lib/macula.mjs`.

### 3. Clear-Bible / macula-hebrew — Hebrew/Aramaic semantics (SDBH)
- **Feeds:** `word_domain` rows for `hbo` + `arc`.
- **Origin / license:** https://github.com/Clear-Bible/macula-hebrew — CC BY.
- **Fetch:** `git clone https://github.com/Clear-Bible/macula-hebrew backup-data/macula-hebrew`
- **Files used:** `WLC/lowfat/*.xml` (~406 MB). Note: the lowfat XML is plain in-repo — **no git-lfs
  fetch is required** (an early plan wrongly assumed it was).
- **Parser:** `lib/macula-hebrew.mjs` (`loadHebrewDomains`, reads `lexdomain`).

### 4. OpenBible — cross-references
- **Feeds:** `cross_refs` (344.8k, vote-ranked).
- **Origin / license:** https://www.openbible.info/labs/cross-references/ — CC BY (Viz.Bible / OpenBible.info).
- **Fetch:** download the cross-references file → `backup-data/openbible/cross_references.txt`.
- **Parser:** `extract-sources.mjs` (cross-refs block).

### 5. Theographic Bible Metadata — chapter context / entities
- **Feeds:** `chapter_context` (writer + counts), `chapter_entity` (people/places/groups/events, coords, Easton blurbs).
- **Origin / license:** https://github.com/robertrouse/theographic-bible-metadata — CC BY-SA 4.0 (Robert Rouse).
- **Fetch:** `node build/fetch-theographic.mjs` — downloads the 8 JSON tables to `backup-data/theographic/`
  (`ROOT` is resolved relative to the script, so it runs from any clone).
- **Parser:** `lib/theographic.mjs` (`loadTheographic`).

---

## Committed derived data (in git already; re-fetch only for a full from-scratch rebuild)

These are already committed, so normal recovery does **not** touch them. Instructions are here only for
the rare "regenerate from original source" case.

### 6. Tyndale Open Study Notes → `study_notes`
- **Committed as:** `build/data/studynotes.json` (16,913 notes).
- **Origin / license:** https://tyndaleopenresources.com — CC BY-SA 4.0 (© 2022 Tyndale House).
- **Regenerate:** download the resource, place `StudyNotes.xml` at
  `backup-data/tyndale/Tyndale Open Study Notes/StudyNotes.xml`, run `node build/parse-studynotes.mjs`.
- **Loader into DB:** `lib/studynotes.mjs`.

### 7. Bible Summary recaps → `chapter_recap`
- **Committed as:** `build/data/recaps-biblesummary.json` (all 1,189 chapters) + `recaps-editorial.json`
  (14 hand-authored fallbacks).
- **Origin / license:** Chris Juby, https://biblesummary.info — **bulk use requires the author's
  permission (being sought). Do not publish/ship until confirmed.** There is intentionally **no fetch
  script** (removed) — this is a static local snapshot; it will not auto-update.
- **Loader into DB:** `lib/recaps.mjs`.

### 8. English Bible text (NIV / NKJV / NLT) → `verses`
- **Committed as:** `data/bibles/{NIV,NKJV,NLT}/*.json` (per-book, keyed `chapter:verse`).
- **⚠️ Copyright:** NIV/NKJV/NLT are copyrighted — keep private (personal use only), never publish.
- **NIV (1984)** — parsed from the user's own text-PDF (`backup-data/bibles-licensed/NIV-*.pdf`) via
  `build/parse-niv.mjs`. 31,086 verses. (The 2011 NIV is tightly licensed and deliberately not used.)
- **NKJV** — same, `backup-data/bibles-licensed/NKJV-*.pdf` via `build/parse-nkjv.mjs`. ~30,800 verses.
- **NLT (current 2015)** — harvested from the official free API, not a PDF:
  `node --env-file=../.env build/harvest-nlt.mjs` (needs `NLT_API_TO_API` in `.env`). Writes to
  `data/bibles/NLT-current/`; the current committed set was then moved to `data/bibles/NLT/`.

**Not consumed by the current build** (present in `backup-data/` for history only): `morphhb`,
`bibles-pd` (public-domain texts, deferred), `commentaries` (abandoned Matthew Henry / Adam Clarke recaps).

---

## The cleanup each source needed (reproduce these — they are why a naive re-parse breaks)

These fixes already live in the parsers/loaders. Documented here so a rebuild — or any parser edit —
doesn't silently regress them. **`build/validate-db.mjs` is the safety net**: it fails the build if any
book/chapter is missing.

**Reference / language (STEPBible + macula):**
- **Versification drop → Daniel 4 & 6 missing.** The old ref regex required `#` right after the verse
  number, so dual-versification refs like `Dan.4.1(3.31)#01` were silently dropped — losing the fully
  Aramaic Daniel 4 & 6 (and likely Psalm titles / Joel / Malachi / Hosea). Fixed in `lib/refs.mjs`; the
  validation gate now catches any such gap.
- **3-way language tag {grc, hbo, arc}.** OT was lumped as `hbo`; Aramaic is recovered from the morph
  marker (`lib/lang.mjs` `deriveLang`). Daniel 2:4b is the Hebrew→Aramaic switch point.
- **Strong's key normalization.** Three incompatible formats — `words.strongs` `H7225G` (uppercase
  suffix), Proximity `H2416d` (lowercase), macula `strongnumberx` `0871a` (no prefix) — reconciled to a
  base `H####` via `baseHeb` (`lib/macula.mjs`).
- **Hebrew content-word test.** Morph carries an inconsistent leading `H`/`A` language marker;
  `isHebrewContent` strips it (present only before an uppercase POS letter). Without this ~115k Hebrew
  content words are wrongly excluded from the difference engine.

**Difference engine (OT precision — `lib/differences.mjs`):**
- Proper-noun filter anchored to `Np% / HNp% / ANp%` (a naive `%Np%` also matched Niphal-Perfect
  **verbs**, excluding 22 real verbs).
- Require the two near-synonyms to differ in English sense; plus a **frequency floor** (the dominant
  noise lever). Band-tuning alone does not separate signal from noise for Hebrew.
- Stemmer min-length guard (a bare `-ing` strip turned `king`→`k`, causing false Type-B splits; also
  fixed latent Greek `basileus`).

**NKJV PDF parse (`parse-nkjv.mjs` — the hardest source):**
- Book-boundary mislabeling (running header names the book at page *end*) produced 321 NULL-chapter rows;
  recovered 1 Sam 31 / 2 Sam 1.
- Ps 119:100 merged into 99 (displaced verse number) — fixed.
- Fused footnote *letter* callers stripped from ~363 verses (a–f tight-join heuristic, provably removes
  only a–f). Residual: rare fused cross-ref letters in cross-ref-heavy verses (e.g. Ps 23:1 "amy
  shepherd") are unsafe to auto-strip — left as-is.
- ~812 block-quote/poetry verses recovered (passage font shared with section headings; disambiguated by
  capitalization). Rev 22:1 "CONCORDANCE" bleed removed.

**NIV PDF parse (`parse-niv.mjs`):** font-size-based verse detection; `PSALM N` heading fix.

**NLT API (`harvest-nlt.mjs`):** **must pass `&version=NLT`** or the API silently returns Spanish NTV for
some books (Genesis). Strips `<h*>` chapter/subheads, `psa-title` psalm titles, and `<span class="tn">`
footnotes.

**Theographic (`lib/theographic.mjs`):** its precomputed `peopleCount` is an inflated Airtable rollup
(Gen 1 → "26 people"); the loader stores *derived listable* counts instead. Known artifact: name
collisions tag some places as persons (Ruth 1 "Moab"/"Judah").

**Tyndale (`parse-studynotes.mjs`):** 20 books use **non-OSIS** codes (`IIPet`, `ISam`, `Hagg`, `Jon`,
`Pr`, …). A `BOOK_FIX` normalization map is required or Proverbs + every numbered book silently fails to
join by OSIS ref.

**Recaps history:** the first attempt used HelloAO's Matthew Henry / Adam Clarke — its Ruth 1 = 3 John
misalignment and systematic wrong-book corruption were caught by an alignment QA, and the commentary was
rejected as too homiletic. Bible Summary replaced it.

---

## Standing rule

**Validate every source before importing.** This rule has already caught the HelloAO/Clarke corruption,
the Tyndale non-OSIS codes, and the Theographic inflated counts — each would otherwise have shipped as
silent breakage. When adding any new source, follow the required steps in `docs/DATA-PIPELINE.md`.

---

## Sources for this document

Repo: `docs/ATTRIBUTIONS.md`, `docs/DATA-PIPELINE.md`, `build/extract-sources.mjs`, `build/build-db.mjs`,
`build/harvest-nlt.mjs`, `build/fetch-theographic.mjs`, `build/parse-*.mjs`, `build/lib/*.mjs`.
Session history (wiki-brain): `deepverse-20260705-0029` (feasibility + text pipeline, NIV hunt),
`deepverse-20260705-0247` (bible.db stress-test, versification bug), `deepverse-20260708-1824`
(OT engine + Strong's/morph cleanup), `deepverse-20260716-0044` (Theographic, Tyndale, recaps).
