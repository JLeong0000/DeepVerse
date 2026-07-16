# Agent 3: Dictionaries/Encyclopedias & Ready-to-Use Distributions

**Status:** COMPLETE
**Last updated:** 2026-07-14

---

## CRITICAL INSTRUCTIONS FOR AGENT

> **YOU WILL BE STOPPED AND RELAUNCHED IF YOU VIOLATE THIS PROTOCOL.**
>
> The ONLY acceptable pattern is: **Search -> Edit -> Search -> Edit -> Search -> Edit.**
> NEVER: Search -> Search. NO EXCEPTIONS. NOT EVEN ONCE.
>
> After EVERY search or fetch, IMMEDIATELY Edit this file with what you learned.
> If you do two searches in a row without an Edit to this file, you are VIOLATING THE PROTOCOL and will be killed.
>
> Work through sections in order. For each section:
> 1. Search/fetch for information
> 2. IMMEDIATELY write findings to this file under that section
> 3. Search/fetch for more information on the same section
> 4. IMMEDIATELY update this file with additional findings
> 5. Move to next section only after writing current section
>
> If a web fetch returns a 403 error, WRITE WHAT YOU HAVE before trying another URL.
>
> Every claim needs a source. Every source needs a clickable URL inline.
> Do NOT collect sources at the end -- put them inline with the facts.
>
> When you are DONE with all sections, change "Status: IN PROGRESS" to "Status: COMPLETE" at the top.

---

## 1. Open Bible dictionaries/encyclopedias

All six works below are **19th/early-20th-century and firmly public domain** in the US (published pre-1929). They fall into two structural families that matter for our schema:
- **Entry/topic-keyed dictionaries** (ISBE, Easton's, Smith's, Hitchcock's) — keyed by a headword/entry title (e.g. "AARON", "Abana"). Best surfaced from a study card by matching a proper noun or place name.
- **Topical/verse-index works** (Nave's Topical Bible, Torrey's Topical Textbook) — keyed by topic but their *value* is a curated list of verse references. Best surfaced by reverse-index (verse -> topics that cite it).

### ISBE — International Standard Bible Encyclopedia (1915)
- **Content:** Large, scholarly encyclopedia. General editor James Orr (1844-1913); published by Howard-Severance Co., Chicago, 1915 (a later revised "ISBE" is 1939 — the **1915 Orr edition is the PD one**). ~5 volumes, thousands of long articles. [archive.org](https://archive.org/details/theinternationalstandardbibleencyclopedia)
- **Keying:** Entry/headword keyed (alphabetical article titles). Articles are long-form prose, often multi-paragraph, with embedded scripture citations.
- **License:** Public Domain. PDF header states "This work is in the Public Domain. Copy Freely." [icotb.org PDF](https://icotb.org/wp-content/uploads/2025/02/James-Orr-International-Standard-Bible-Encyclopedia.pdf)
- **Format available:** Scans/text on archive.org ([cu31924008045423, Cornell scan](https://archive.org/details/cu31924008045423)), full HTML text at [internationalstandardbible.com](https://www.internationalstandardbible.com/); also distributed as a SWORD module (ISBE) — see Section 3. This is the *largest/richest* PD encyclopedia but also the heaviest to parse cleanly (need to confirm best ready-made JSON — see Section 3).

### Easton's Bible Dictionary (1897, "Easton's Illustrated Bible Dictionary")
- **Content:** ~4,000 concise entries by Matthew George Easton. Short, dense definitions of people/places/things with heavy scripture citation. A workhorse for study-card "who/what is X" lookups.
- **Keying:** Entry/headword keyed.
- **License:** Public Domain (author died 1894; work 1897).
- **Format available:** Multiple ready-made JSON packagings (LOW parsing effort): [neuu-org/bible-dictionary-dataset](https://github.com/neuu-org/bible-dictionary-dataset) bundles Easton (1897) + Smith (1863) = 5,998 entries with 35,089 parsed scripture references; [JWBickel/BibleDictionaries on HuggingFace](https://huggingface.co/datasets/JWBickel/BibleDictionaries) provides JSON for Easton + Smith + Hitchcock + Torrey. Also a standard SWORD module (Easton) — Section 3.

### Smith's Bible Dictionary (1863, William Smith)
- **Content:** Larger and more discursive than Easton's; classic Victorian Bible dictionary. Note: the *original* 1863 edition is PD; some later "revised/expanded" editions (e.g. 1884 Peloubet revision) are also PD but distributions vary in which text they carry.
- **Keying:** Entry/headword keyed.
- **License:** Public Domain (1863).
- **Format available:** Same ready-made JSON as Easton's — [neuu-org/bible-dictionary-dataset](https://github.com/neuu-org/bible-dictionary-dataset) (Smith 1863) and [JWBickel/BibleDictionaries](https://huggingface.co/datasets/JWBickel/BibleDictionaries). SWORD module also exists.

### Nave's Topical Bible (Orville J. Nave, early 1900s)
- **Content:** ~20,000+ topics/subtopics referencing 100,000+ Bible verses. [naves-topical-bible.com](https://www.naves-topical-bible.com/) states "over 20,000 topics and subtopics, referencing over 100,000 Bible verses ... indexed by Nave's 5000+ main topic" entries.
- **Keying:** **Topic-keyed, but the payload is verse-reference lists** — this is the value for us as a *verse -> topics* reverse index (surface "this verse relates to topics X, Y, Z"). Minimal prose.
- **License:** Public Domain (early 1900s). [navestopicalbible.org](http://navestopicalbible.org/index.php/Main_Page) notes the underlying data (separate from any one program's format) is Public Domain.
- **Format available:** SWORD module (Nave); HTML at the sites above. JSON conversions less common than the dictionaries — may require light parsing (see Section 3).

### Torrey's New Topical Textbook (R.A. Torrey)
- **Content:** Curated topical index, similar to Nave's but smaller/tighter — topics with supporting verse lists. [biblestudytools](https://www.biblestudytools.com/concordances/torreys-topical-textbook/)
- **Keying:** Topic-keyed; payload is verse lists (reverse-index candidate like Nave's).
- **License:** Public Domain.
- **Format available:** JSON in [JWBickel/BibleDictionaries](https://huggingface.co/datasets/JWBickel/BibleDictionaries) ("Torry's Topical Handbook"); SWORD module also exists. LOW parsing effort.

### Hitchcock's Bible Names Dictionary (Roswell D. Hitchcock, 1869)
- **Content:** Small, single-purpose dictionary: the *meaning/etymology of proper names* (e.g. "Abigail = father of joy"). ~2,500 name entries. Great for enriching a name-based study card with "the name means…".
- **Keying:** Entry/headword keyed (the proper name).
- **License:** Public Domain (1869).
- **Format available:** JSON in [JWBickel/BibleDictionaries](https://huggingface.co/datasets/JWBickel/BibleDictionaries); SWORD module (Hitchcock). LOW parsing effort.

### Bonus PD dictionaries in the same ready-made packaging
The [neuu-org/bible-dictionary-dataset README](https://github.com/neuu-org/bible-dictionary-dataset/blob/main/README.md) confirms exact entry counts (all parsed from CCEL ThML XML): **Easton 3,962; Smith 4,561; Hitchcock 2,619; Hastings Dictionary of the Bible (1898) 5,033; Schaff's Dictionary of the Bible 4,725 — total 20,900 entries.** So Hastings (1898) and Schaff are two additional PD dictionaries available in the same clean JSON with zero extra effort. Each entry carries `name`, `slug`, `definitions[]` (with `source` tag EAS/SMI/etc.), and pre-parsed `scripture_refs[]` (`{reference, original}`). **This is the single lowest-effort source for the entry-keyed dictionaries.** License: source dicts PD (1863-1898); the *dataset + scripts* are CC BY 4.0 (attribution only — see Section 4).

**Important ecosystem note:** neuu-org publishes a family of matching datasets (all CCEL-derived): `bible-topics-dataset`, `bible-gazetteers-dataset` (entities/symbols), `bible-commentaries-dataset` (31,218 commentaries), `bible-crossrefs-dataset` (1.1M+ cross-references), `bible-text-dataset` (17 translations). Covered further in Sections 2-3.

## 2. Aggregator distributions & APIs

### HelloAO / Free Use Bible API (bible.helloao.org)
- **What it is:** "The Bible in JSON" — over 1,000 Bible translations in a clean JSON format with basic formatting + footnotes, hosted on AWS, made by AO Lab. [bible.helloao.org/docs](https://bible.helloao.org/docs/)
- **License stance:** Extremely permissive. The docs state: "No usage limits, no API Keys required, and no copyright restrictions whatsoever (including for modification or commercial uses). We only ask that if you change the content of a translation be sure to call it a different name." [bible.helloao.org/docs](https://bible.helloao.org/docs/) (Caveat: this is HelloAO's blanket statement over the *aggregate*; individual bundled translations/commentaries still carry their own upstream licenses — verify per dataset before commercial bundling.)
- **Bundled study/commentary datasets:** HelloAO exposes a `/api/c/{commentary}` commentary endpoint. Known bundled commentaries (all classic **Public Domain**): **Adam Clarke, Matthew Henry, Jamieson-Fausset-Brown (JFB), John Gill, Keil-Delitzsch, Tyndale** (open-license). [HelloAO API reference](https://bible.helloao.org/docs/reference/) shows `commentaries[]` entries like `{"id":"adam-clarke","name":"Adam Clarke Bible ..."}`; a third-party MCP server confirms the set: "Matthew Henry, JFB, Adam Clarke, John Gill, Keil-Delitzsch, Tyndale (Public ...)" [TJ-Frederick/TheologAI](https://github.com/TJ-Frederick/TheologAI).
- **Keying:** Commentaries are **verse/passage-keyed** (`/api/c/{commentary}/{book}/{chapter}.json`) — ideal for a study card that shows commentary on the exact verse being read. Bibles are book/chapter keyed.
- **Scale:** 1,256 translations across 1,004 languages, plus commentary datasets and an official JS/TS SDK. [faith.tools listing](https://faith.tools/app/288-ao-lab-bible-api)
- **Bulk download:** The whole thing can be pulled as static JSON files (no server needed) — see [HelloAOLab/bible-api repo](https://github.com/HelloAOLab/bible-api). Good fit for offline bundling since output is already flat JSON.

### STEPBible-Data (github.com/STEPBible/STEPBible-Data)
- **What it is:** Data created by Tyndale House Cambridge, curated by STEPBible. **Licensed CC BY 4.0** (attribution only, NOT ShareAlike — see nuance below). [STEPBible-Data repo](https://github.com/STEPBible/STEPBible-Data)
- **Format:** Downloadable **tab-separated text files (TSV)** + Google Sheets mirrors + OSIS SWORD Bible modules. TSV means light parsing on our side, but well-structured.
- **Datasets bundled (the useful-for-context ones):**
  - **TIPNR — Translators Individualised Proper Names with all References:** every proper noun in the Bible, linked to all Hebrew/Greek forms, disambiguated into individual people/places/things, with **exhaustive reference lists**, family relationships (parents/partners/siblings/offspring), and place geolocation (via OpenBible). Each individual has brief/short/article-length **descriptions "created by Claude 3 AI"**. This is a *goldmine* for a person/place study card. (Note the AI-generated descriptions — factual but worth a QA pass.)
  - **TBESH — Translators Brief lexicon, Hebrew:** abridged BDB linked to Extended Strong's.
  - **TBESG — Translators Brief lexicon, Greek:** brief definitions for all Greek Bible words (NT, LXX, Apoc, variants), corrected Abbott-Smith. Backward-compatible with original Strong's.
  - **TFLSJ — Full LSJ Greek lexicon** (up to G5624), formatted.
  - **TAHOT / TAGNT** — Amalgamated tagged Hebrew OT / Greek NT (morphology + disambiguated Strong's).
  - **TVTMS** — versification traditions mapping.
  - **TEHMC / TEGMC** — expanded Hebrew/Greek morphology code explanations (human-readable parsing glosses — useful for tooltips).
  - **TBCWG — Translators Biblical Concept Word Groups** (still being finished): concepts (expanded from unfoldingWord) describing biblical background/usage for synonym groups of disambiguated Hebrew/Greek words — **"created by Claude 3 AI."** Potentially useful for word-meaning context cards.
  - **TFBDB — full BDB Hebrew lexicon**, formatted (a "coming" dataset at time of writing).
  - **Note on TOSN/TOSJ:** the task named "TOSN" (Tyndale/Translators Open Study Notes). As of this fetch the STEPBible-Data README does **not** list a "TOSN" dataset — the study-note-style content in this repo is TBCWG (concept notes) and the TIPNR person/place descriptions. Tyndale's "Open Study Notes" (the study-Bible notes seen in some STEPBible contexts) may be a separate release / not in this CC BY 4.0 TSV repo; treat TOSN as **licensing-unconfirmed** until located separately.
- **Data format detail:** UTF-8 tab-separated. Single-line records by default; multi-line records use a `$`-prefixed header line followed by tab-indented subRecord lines. [STEPBible-Data repo](https://github.com/STEPBible/STEPBible-Data). Straightforward to ingest into SQLite with a small parser.

### OpenBibleData / Robert Hunt (Freely-Given.org)
- **What it is:** A project by Robert Hunt (Marton, New Zealand), started ~2009, behind the **Open English Translation (OET)** and a large aggregated "OpenBibleData" website that cross-links translations, Greek/Hebrew, and context. [Freely-Given.org About](https://freely-given.org/About.html), [OET About](https://oet.bible/About/OET/)
- **License:** "A generous open license" for the OET; site content © Freely-Given.org. The OET/OpenBibleData materials are released under open licenses (the OET itself is designed to be freely usable) — but the aggregation pulls many upstream sources each with its own license, so confirm per component before bundling. The value here is mostly as a **cross-reference/aggregation model and a source of OET text**, less as a drop-in dictionary dataset.
- **Format:** Static HTML website + underlying data files; the OET and its supporting data are on Freely-Given.org / GitHub. More parsing effort than the flat-JSON aggregators above.

### get.bible / getBible data sets
- **What it is:** [get.bible/bible-data-sets](https://get.bible/bible-data-sets/) is a **curated directory** of Bible APIs and datasets (not itself a single dataset). Points to the **getBible API + GitHub repo** which offers **downloadable Bible text in JSON** for many languages (Arabic, Chinese, Czech, Dutch, English, French, German, Greek, Hebrew, Italian, Korean, Russian, Spanish, Swedish, Thai). [get.bible/bible-data-sets](https://get.bible/bible-data-sets/)
- **License:** getBible's own repo is public-domain / freely-licensed Bibles; the directory also lists many commercial/restricted APIs (API.Bible, YouVersion, ESV, NLT) — those are NOT freely bundleable. Useful as a *map* of what exists; the directly bundleable pieces are the PD text repos (getBible GitHub, bible-api.com, ebible.org, Berean Study Bible downloads).
- **Also noted from this page:** SWORD Engine (CrossWire) XML modules, marvel.bible (Hebrew Bible alignment), berean.bible downloads (Berean Study Bible in XLSX/Text — permissive), ebible.org (many PD/CC translations in USFM). These feed Section 3.

### biblenerd/awesome-bible-developer-resources
- **What it is:** A curated GitHub index (92★) of formats, corpora, APIs, lexica, and **conversion tools** for biblical text developers. [biblenerd/awesome-bible-developer-resources](https://github.com/biblenerd/awesome-bible-developer-resources)
- **Licensing note it makes:** "When no badge is shown, assume the resource is copyright © its respective author(s). The underlying corpora within resources may have separate licensing terms." Good discipline reminder — don't assume PD.
- **Most useful for us:** its **Conversion Tools** section (feeds Section 3): `usfm2osis` and `u2o` (USFM→OSIS), **SWORD Module Tools**, **Haiola** (USFM/USFX/USX → HTML/EPUB/SWORD/Word/PDF), and critically a **"SWORD to JSON Converter"** and **"SWORD to JSON"** utilities — the exact tools to turn CrossWire PD dictionary/commentary modules into JSON with minimal effort. Also indexes Lexical Resources (Hebrew/Greek lexica) and format docs (OSIS, TEI, USFM, USX, Zefania).
- **License nuance (important for Section 4):** Although labeled CC BY 4.0, the repo README adds a ShareAlike-flavored request: "Any changes made to data should be recorded and made available to subsequent users" and "Credit it to 'STEP Bible' linked to www.STEPBible.org." [STEPBible-Data repo](https://github.com/STEPBible/STEPBible-Data). Under plain CC BY 4.0 the "make changes available" part is a *request*, not a binding ShareAlike term — but attribution IS binding.

## 3. Existing SQLite/JSON/SWORD packagings we can reuse

**Bottom line up front — lowest-effort ready-made sources, ranked:**
1. **neuu-org JSON datasets** (dictionaries, cross-refs, commentaries, gazetteers) — already clean JSON with pre-parsed scripture refs; CC BY 4.0. Least work.
2. **JWBickel/BibleDictionaries** (Easton/Smith/Hitchcock/Torrey JSON on HuggingFace) — PD, drop-in.
3. **HelloAO static JSON** (PD commentaries: Clarke, Henry, JFB, Gill, Keil-Delitzsch, Tyndale) — flat JSON files.
4. **STEPBible TSV** (TIPNR proper-names, TBESH/TBESG lexicons) — small parser needed, CC BY 4.0.
5. **CrossWire SWORD modules** — richest catalog of PD works, but requires conversion (SWORD→JSON tools exist). Use only for works not covered above (e.g. full ISBE, Fausset's).

### CrossWire SWORD modules (PD commentaries & dictionaries)
- **What:** CrossWire's module repository hosts many **public-domain** dictionaries/commentaries as SWORD modules: ISBE, Easton, Smith, Hitchcock, Nave, Torrey, Fausset's Bible Dictionary, Matthew Henry (Complete + Concise), Adam Clarke, JFB, John Gill, Barnes' Notes, Wesley's Notes, Treasury of Scripture Knowledge (TSK — a massive cross-ref set), Robertson's Word Pictures, etc. (Details on extraction tooling below.)
- **How to extract:** SWORD modules are a compressed binary format (`.zip` containing `mods.d` config + `modules` data). Extraction options:
  - **pysword** (Python library) — reads SWORD modules directly; can iterate verses/entries and emit text/JSON.
  - **SWORD to JSON Converter** listed in the awesome list (Section 2) — purpose-built.
  - **diatheke** (CrossWire's CLI, part of libsword) — dumps module content to plaintext/HTML per key.
  - Modules download from CrossWire's install manager repos (e.g. `crosswire.org` main repo).
- **Concrete extraction tools found:**
  - **[wasdin/SWORD-to-JSON](https://github.com/wasdin/SWORD-to-JSON)** — uses pysword to emit JSON from a SWORD module (ships a PD `kjv.json` example). Bulk-conversion oriented per [deepwiki writeup](https://deepwiki.com/tonyjurg/Sword_Module_Text_Extraction/4.1-sword-to-json-bulk-conversion).
  - **[sword-converter on PyPI](https://libraries.io/pypi/sword-converter)** — "Generate JSON Files **and SQLite Databases** of Bible Texts from SWORD Modules." Directly outputs SQLite, matching our `bible.db` target.
  - **[pysword on PyPI](https://pypi.org/project/pysword/)** — native Python SWORD reader. **Caveat: pysword reads *bibles*, NOT commentaries/dictionaries** ("Read SWORD bibles (not commentaries etc.)"). So for dictionary/commentary modules use **diatheke** or a GenBook/LD-aware extractor, not raw pysword.
  - [zamuwelle/sword-to-json-revive](https://github.com/zamuwelle/sword-to-json-revive) is a maintained fork.

### Ready-made SQLite: HistoricalChristianFaith/Commentaries-Database
- **[HistoricalChristianFaith/Commentaries-Database](https://github.com/HistoricalChristianFaith/Commentaries-Database)** ships a **SQLite file of historical Christian commentaries**, verse-keyed, with a reference PHP implementation showing "commentaries for a user-specified passage." Already consumed by other apps (biblesearch.es, Catena Vetus TUI). **This is a drop-in SQLite already matching our target format** — worth evaluating first for commentary content. Prebuilt SQLite is in the repo's **Releases**; a `compile_data.py` script also outputs CSV/SQLITE/JSON from the source (rtoml files). [repo README](https://github.com/HistoricalChristianFaith/Commentaries-Database)
  - **Content skew:** heavily **patristic / church-father** (Augustine, Chrysostom, Cyril, Ephrem, Bede, Aquinas-era, plus Cornelius a Lapide) organized by author→verse — great for a "what did the early church say about this verse" card, but NOT the classic PD English commentaries (Matthew Henry etc.).
  - **License CAUTION:** the author list includes **modern, in-copyright writers (C.S. Lewis, Douglas Wilson)** alongside PD fathers. The repo mixes PD and non-PD content, so it is **NOT wholesale safe to bundle commercially** — would need to filter to genuinely PD authors. Treat license as per-author, not blanket.

### Existing JSON/DB conversions on GitHub (minimize parsing)
- **neuu-org ecosystem (CC BY 4.0 wrapper over PD sources):** in addition to the dictionaries dataset, `bible-commentaries-dataset` (**31,218 commentaries**), `bible-crossrefs-dataset` (**1.1M+ cross-references** — likely TSK-derived), `bible-gazetteers-dataset` (entities/symbols), `bible-topics-dataset`. All clean JSON. [neuu-org dictionary README lists the family](https://github.com/neuu-org/bible-dictionary-dataset/blob/main/README.md)
- **[JWBickel/BibleDictionaries](https://huggingface.co/datasets/JWBickel/BibleDictionaries)** — Easton/Smith/Hitchcock/Torrey JSON (PD).
- **[simoncozens Open Source Bible Data](http://simoncozens.github.io/open-source-bible-data/)** — an aggregation index of freely available biblical texts/tools/data across many formats; good hub to find more conversions.
- **htmlbible.com** (John Hurt) — web-format PD bundle including Easton, Nave, Matthew Henry (HTML; older, more parsing). [via get.bible](https://get.bible/bible-data-sets/)

### MyBible / MySword / e-Sword / theWord module formats — are they convertible?
- **Already-SQLite formats (easiest):** **MySword** modules ARE SQLite databases (extension `.mybible`); module type is set in the DB. [MySword modules format](https://www.mysword.info/modules-format). **MyBible.zone** (Android) likewise uses SQLite. theWord bible modules use SQLite3 under `.ont` extension. So MySword/MyBible/theWord content can be **read directly with any SQLite tool and re-mapped into our schema** — near-zero binary parsing.
- **e-Sword:** older e-Sword modules are also SQLite-based (newer .bblx/.cmtx etc.); non-password-protected modules convert cleanly.
- **Universal converter:** **[schierlm/BibleMultiConverter](https://github.com/schierlm/BibleMultiConverter)** (Java) converts among a huge range of formats (USFM, OSIS, Zefania, SWORD, MyBible.Zone, etc.) and includes a **SQLiteDump** tool to dump SQLite Bible DBs to a diffable text form — useful for importing MyBible.Zone modules and reverse-engineering unknown schemas.
- **theWord/MySword migration tools** convert e-Sword → theWord/MySword including Dictionary and Commentary modules. [MySword migration tools](https://www.mysword.info/download-mysword/migration-tools), [theWord tools](https://www.thewordbooks.com/index.php/download-tools-and-utilities/)
- **Practical implication:** Because these ecosystems already store PD dictionaries/commentaries in SQLite, the fastest path for a work only available as (say) an e-Sword/MySword module is: open the module's SQLite, `SELECT` the content table, transform, `INSERT` into `bible.db`. **But** the *content licensing* is independent of the format — many popular e-Sword/MySword modules are user-uploaded copyrighted works; only bundle ones that are genuinely PD/open.

## 4. Consolidated licensing analysis + CC BY-SA copyleft risk

### 4a. Categorization of every source surveyed
| Source | License class | Safe to bundle in a closed-source, possibly-commercial `bible.db`? |
|---|---|---|
| ISBE (1915), Easton (1897), Smith (1863), Hitchcock (1869), Nave, Torrey, Hastings (1898), Schaff, Fausset, Matthew Henry, Adam Clarke, JFB, John Gill, Keil-Delitzsch, Barnes, TSK | **Public Domain** | **Yes, unconditionally.** No attribution legally required (courtesy only). |
| HelloAO Free Use Bible API (aggregate) | **PD / "no copyright restrictions"** per its own terms | **Yes** (verify individual upstream translations you pull). |
| neuu-org datasets (dictionaries, commentaries, crossrefs, gazetteers) | **CC BY 4.0** (PD content, CC BY *dataset*) | **Yes** — CC BY = attribution only, no copyleft. |
| JWBickel/BibleDictionaries | **PD** (JSON of PD dicts) | **Yes.** |
| STEPBible-Data (TIPNR, TBESH/TBESG, TFLSJ, etc.) | **CC BY 4.0** | **Yes** — attribution to "STEP Bible" required; no ShareAlike. |
| [Theographic (Bible metadata/relationships)](https://github.com/robertrouse/theographic-bible-metadata) — knowledge graph: 3,000+ people, 1,600+ places w/ GPS, 4,000+ events, timelines; confirmed **CC BY-SA 4.0** ([license file](https://github.com/robertrouse/theographic-bible-metadata/blob/master/LICENSE)) | **CC BY-SA 4.0** | **Yes, with conditions** — see 4c. Does NOT force app open-source. |
| STEPBible **TOSN** (if it is the Tyndale Open Study Notes) | **UNCONFIRMED** — possibly CC BY-NC or CC BY-SA | **Do not bundle until confirmed.** NC would bar commercial use. |
| HistoricalChristianFaith Commentaries-DB | **Mixed** (PD fathers + in-copyright modern authors) | **No, not wholesale** — filter to PD authors only. |
| e-Sword/MySword/theWord community modules | **Per-module, often copyrighted** | **No blanket** — format is open, content usually isn't. |
| API.Bible / YouVersion / ESV / NLT / NIV etc. | **Proprietary** | **No** — licensing/fees required. |

### 4b. What CC BY (attribution-only) requires
CC BY 4.0 is **not copyleft.** For bundling neuu-org / STEPBible data you must: (1) give **attribution** (credit + license notice + link + indication if modified), and (2) not imply endorsement. You may bundle it in a **closed-source commercial app**, relicense your own code however you want, and even keep the *combined product* proprietary. Attribution can live in a credits/about screen.

### 4c. CC BY-SA 4.0 — the ShareAlike obligation, concretely

**Answer up front: Merely DISPLAYING / redistributing CC BY-SA data inside a closed-source app does NOT force the app to be open-source.** ShareAlike attaches to **Adapted Material** (a modified derivative of the licensed *data*), not to independent software that merely shows the data. Your app code is not a derivative of the dataset. The two obligations that *do* apply are (a) **attribution** and (b) if you create an *adaptation of the data*, that **adaptation must itself be licensed BY-SA** (or a BY-SA-compatible license). Code is not "the same Adapted Material" — it's a separate work.

**From the CC BY-SA 4.0 legal code** ([creativecommons.org/licenses/by-sa/4.0/legalcode.en](https://creativecommons.org/licenses/by-sa/4.0/legalcode.en)):
- **"Adapted Material"** = "material ... that is derived from or based upon the Licensed Material and in which the Licensed Material is translated, altered, arranged, transformed, or otherwise modified in a manner requiring permission." So ShareAlike is triggered only when you **modify the data itself**.
- **"Adapter's License"** = "the license You apply to **Your contributions to Adapted Material**." The SA reach is scoped to *your changes to the data*, not your whole product.
- **"Share"** includes public display/distribution — so distributing the data (even unmodified) still requires **attribution**, but distribution alone is not adaptation.

Key implications for us:
- **Unmodified bundling (verbatim display) of Theographic/other BY-SA data:** only requires attribution (credit, license notice/URL, note if changed). App stays closed-source. This is "Share" of Licensed Material, not creation of Adapted Material.
- **If we transform the data** (e.g. merge Theographic relationships into `bible.db` with our own normalization, derive new fields from it): that merged/derived *dataset* is Adapted Material and **must be offered under CC BY-SA 4.0** (or compatible). But that obligation binds the **data table(s)**, not our Svelte/TS application code.
**Exact Section 3(b) ShareAlike wording** ([legal code](https://creativecommons.org/licenses/by-sa/4.0/legalcode.en)): *"if You Share Adapted Material You produce, the following conditions also apply. The Adapter's License You apply must be a Creative Commons license with the same License Elements, this version or later, or a BY-SA Compatible License ... You may not offer or impose any additional or different terms or conditions on, or **apply any Effective Technological Measures to, Adapted Material** that restrict exercise of the rights granted under the Adapter's License."*
- Two consequences: (1) the SA license requirement applies only "if You **Share Adapted Material You produce**" — internal use / verbatim redistribution isn't the trigger; (2) **anti-DRM clause**: if `bible.db` becomes Adapted Material, we may not wrap that data in technical measures (DRM) that block the CC-granted rights. A plain encrypted/obfuscated app bundle is a gray area but the *data* itself must remain extractable under the license.

**Section 4 — Sui Generis Database Rights (the database-specific "adaptation" rule), directly on point for `bible.db`:** *"if You include all or a substantial portion of the database contents in a database in which You have Sui Generis Database Rights, then the database in which You have Sui Generis Database Rights **(but not its individual contents)** is Adapted Material, including for purposes of Section 3(b); and You must comply with the conditions in Section 3(a) if You Share all or a substantial portion of the contents."* ([legal code](https://creativecommons.org/licenses/by-sa/4.0/legalcode.en))
- **Reading for us:** If we ingest a substantial portion of a BY-SA dataset (e.g. Theographic) into `bible.db`, the **database as a compiled whole** may be treated as Adapted Material -> that database must be offered BY-SA. But note the explicit carve-out **"(but not its individual contents)"**: the other independent contents of `bible.db` (our own tables, PD dictionaries, CC BY STEPBible data) are NOT swept into BY-SA merely by co-residing in the same SQLite file. And crucially — **the application code around the database is never Adapted Material.**

**Mere aggregation / "Collection" vs "Adaptation" — the decisive official CC FAQ answer.**

The CC FAQ has a question exactly on our fact pattern: *"If CC SA-licensed content is included in a database, does the entire database have to be licensed under an SA license?"* The answer ([Creative Commons FAQ](https://creativecommons.org/faq/)):

> "CC licenses **never require a reuser of a CC-licensed work to make the original work or resulting works (collections, derivatives, etc.) publicly available.** There are lots of private reuses of works that are permitted ... Regarding ShareAlike, **the condition only applies if a work is modified and if the work is shared publicly.** ... CC licenses **do not require the collection or the compilation itself to be made available under an SA license**, even though each individual work is still licensed individually under an SA license ... were Creative Commons to compile photographs ... under a BY-SA 2.0 license and create a database that it then publicly distributed, CC could license the **collection as a whole under a BY license**, but the photographs would continue to be licensed under BY-SA 2.0."

**This resolves the core question definitively:**
1. **Displaying/bundling CC BY-SA data does NOT force our app open-source.** ShareAlike only bites when we (a) **modify** the data AND (b) **share it publicly**. Our proprietary Svelte/TS code, UI, and business logic are never subject to it.
2. **A "collection/compilation"** (our `bible.db` treated as a gathering of independent works — PD dicts + CC BY STEPBible + CC BY-SA Theographic side by side) can be licensed **as a whole however we want**; each embedded CC BY-SA dataset just keeps its own BY-SA license and attribution.
3. The only hard obligation from including verbatim CC BY-SA data is **attribution** (credit, license notice + URL, note if modified). If we *modify* a BY-SA dataset and *distribute the modified data*, that **modified data must be re-shared as BY-SA** — but that binds only the derived data table, not the app.
4. **Private/internal use** of even modified BY-SA data carries no ShareAlike distribution duty at all.

**Net recommendation for DeepVerse:** Bundling CC BY-SA sources (Theographic, and any BY-SA study notes) in a closed-source, commercial offline app is **legally safe** provided we: (i) attribute each BY-SA source in an about/credits screen with a link to CC BY-SA 4.0; (ii) if we transform a BY-SA dataset, keep *that dataset/table* offered under CC BY-SA (a downloadable data export or a repo satisfies this) and avoid DRM that blocks extracting it; and (iii) never claim the BY-SA-derived data under a more restrictive license. PD and CC BY sources (the bulk of what we'd use — ISBE/Easton/Smith/Nave/Hitchcock/HelloAO commentaries/STEPBible/neuu-org) carry no copyleft at all; CC BY needs only attribution. Avoid: NC-licensed items (bar commercial use), unconfirmed-license items (TOSN), and mixed-license dumps (HistoricalChristianFaith) unless filtered.
