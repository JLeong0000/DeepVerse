# Agent 1: Open Commentaries & Chapter/Book Summaries

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

## 1. Public-domain per-chapter commentaries

### Matthew Henry's Complete Commentary on the Whole Bible (MHC)
- **What it provides:** Devotional/expository commentary on the whole Bible. Rich prose, mostly grouped by passage/pericope rather than strict verse-by-verse.
- **Granularity:** Has **per-book introductions**, and crucially **per-chapter overviews/outlines** at the head of each chapter (Henry begins each chapter with a summary of its contents). Body text is organized by verse-ranges, not single verses. So it is a genuine source of **chapter-level summaries** ("The Contents of chapter X").
- **License:** Public Domain -- "Public Domain--Copy Freely" per [STEPBible MHC](https://www.stepbible.org/version.jsp?version=MHC). Henry died 1714; text long out of copyright.
- **Download / format:**
  - SWORD module `MHC` from CrossWire: [ModInfo MHC](https://crosswire.org/sword/modules/ModInfo.jsp?modName=MHC).
  - Full HTML at CCEL: [ccel.org/ccel/henry/mhc.i.html](https://ccel.org/ccel/henry/mhc.i.html) (also downloadable as ThML/XML, plain text, and epub from CCEL).
  - Verse-keyed HTML at [Bible Hub commentaries](https://biblehub.com/commentaries/) ("Matthew Henry Full").

### Matthew Henry's Concise Commentary (a.k.a. Concise / Comprehensive)
- **What it provides:** The condensed abridgement of the above (originally completed by other hands after Henry's death). Short paragraph per passage.
- **Granularity:** Grouped by verse-ranges per chapter; effectively **per-passage**, often one short block per chapter section. Good raw material for a short chapter recap but not a single-sentence-per-chapter dataset.
- **License:** Public Domain.
- **Download / format:** SWORD module (Concise), and "Matthew Henry Concise" at [Bible Hub commentaries](https://biblehub.com/commentaries/). CCEL hosts it too.

*(General hub note: CrossWire lists all its commentary SWORD modules at [ModDisp Commentaries](https://www2.crosswire.org/sword/modules/ModDisp.jsp?modType=Commentaries&exp=true); Bible Hub aggregates ~verse-keyed HTML for many of these at [biblehub.com/commentaries](https://biblehub.com/commentaries/); a curated dev list lives at [biblenerd/awesome-bible-developer-resources](https://github.com/biblenerd/awesome-bible-developer-resources).)*

### Jamieson-Fausset-Brown (JFB) - Commentary Critical and Explanatory on the Whole Bible
- **What it provides:** Critical/explanatory commentary, whole Bible. Two editions exist: the **single-volume (condensed)** and the **unabridged 3-volume** (more OT content) per [SwordSearcher resources](https://www.swordsearcher.com/resources.html).
- **Granularity:** Per-book intros; body is **per-verse / verse-range**. Each chapter opens with a brief content note. Primarily verse-level.
- **License:** Public Domain (authors mid-1800s).
- **Download / format:** SWORD module `JFB` ([ModInfo JFB](https://crosswire.org/sword/modules/ModInfo.jsp?modName=JFB)); e-Sword module ([e-sword contents](https://www.e-sword.net/contents.html)); verse-keyed HTML at [Bible Hub](https://biblehub.com/commentaries/).

### Barnes' Notes on the Bible (Albert Barnes)
- **What it provides:** Explanatory verse-by-verse notes across most of the Bible (NT complete; OT largely covered).
- **Granularity:** **Per-verse** primarily, with short chapter analysis/introductions in some books. Mostly verse-level, not a chapter-summary dataset.
- **License:** Public Domain (Barnes d. 1870).
- **Download / format:** SWORD module (`Barnes`), e-Sword module, verse-keyed HTML at [Bible Hub commentaries](https://biblehub.com/commentaries/).

### Gill's Exposition of the Entire Bible (John Gill)
- **What it provides:** Very detailed, exhaustive verse-by-verse exposition, whole Bible (Baptist, 18th c.).
- **Granularity:** **Per-verse** (dense). Has short book intros. Not chapter-summary oriented.
- **License:** Public Domain (Gill d. 1771).
- **Download / format:** SWORD module (`Gill`), e-Sword ([e-sword contents](https://www.e-sword.net/contents.html)), verse-keyed HTML at [Bible Hub](https://biblehub.com/commentaries/).

### Geneva Bible Study Notes (Geneva Study Bible)
- **What it provides:** The marginal study notes from the 1560/1599 Geneva Bible.
- **Granularity:** **Per-verse marginal glosses** (short). Some book arguments/intros. Not chapter summaries; brief notes keyed to specific verses.
- **License:** Public Domain (16th c.).
- **Download / format:** SWORD module (`Geneva1599` notes / "Geneva"), verse-keyed HTML at [Bible Hub](https://biblehub.com/commentaries/) ("Geneva Study Bible") and [biblestudytools.com Geneva Study Bible](https://www.biblestudytools.com/commentaries/geneva-study-bible/).

### Scofield Reference Notes (C. I. Scofield, 1909/1917)
- **What it provides:** Dispensationalist study notes and cross-references from the Scofield Reference Bible.
- **Granularity:** **Per-verse / per-passage notes**, plus book introductions and some section headers. Not systematic chapter summaries.
- **License:** Public Domain -- pre-1931 publication; [Scofield Reference Bible Notes on Wikisource](https://en.wikisource.org/wiki/Scofield_Reference_Bible_Notes) states "published before January 1, 1931 ... in the public domain worldwide."
- **Download / format:** Wikisource (HTML/wikitext), SWORD module, and per-chapter HTML at [StudyLight SRN](https://www.studylight.org/commentaries/eng/srn.html).

### Darby's Synopsis of the Books of the Bible (J. N. Darby)
- **What it provides:** Synoptic/overview commentary walking through each book's flow and themes (not verse-atomized).
- **Granularity:** **Per-book and per-section/per-chapter synopsis prose** -- narrative overview rather than verse notes. Useful for book/section-level context; coverage is by passage, sometimes multiple chapters together.
- **License:** Public Domain (Darby d. 1882).
- **Download / format:** SWORD module (`Darby`), verse/passage-keyed HTML at [Bible Hub](https://biblehub.com/commentaries/) ("Darby's Bible Synopsis"), CCEL.

### Adam Clarke's Commentary on the Bible
- **What it provides:** Detailed critical/philological verse-by-verse commentary, whole Bible, with cultural and linguistic notes.
- **Granularity:** **Per-verse** primarily, with a short introduction and a chapter-content note at the head of each chapter (Clarke prefaces chapters with a summary of contents). So it does carry brief **chapter overviews** in addition to dense verse notes.
- **License:** Public Domain (Clarke d. 1832).
- **Download / format:** SWORD module (`Clarke`), e-Sword, verse-keyed HTML at [Bible Hub](https://biblehub.com/commentaries/) ("Clarke's Commentary"), StudyLight.

### The Pulpit Commentary (H.D.M. Spence & Joseph Exell, eds.)
- **What it provides:** Massive 23-volume homiletic commentary (exposition + homiletics + homilies) on the whole Bible, KJV-based, late 19th c.
- **Granularity:** **Per-verse exposition** plus **per-chapter/per-passage homiletic sections**. Each chapter/pericope has introductory exposition. Rich but very verbose; not a concise chapter summary.
- **License:** Public Domain (written late 1800s; now freely downloadable per [biblicalstudies.org.uk - Pulpit Commentary free download](https://biblicalstudies.org.uk/blog/the-pulpit-commentary-now-available-for-free-download/)).
- **Download / format:** PDF volumes at [biblicalstudies.org.uk](https://www.biblicalstudies.org.uk/commentaries_pulpit-commentary.php); SWORD module; verse-keyed HTML at Bible Hub and StudyLight.

### Treasury of Scripture Knowledge (TSK, R.A. Torrey ed.)
- **What it provides:** ~500,000 cross-references and parallel passages keyed to verses. NOT prose commentary -- it is a **cross-reference dataset**.
- **Granularity:** **Per-verse cross-references only.** No chapter summaries, no book intros. Useful for "related verses" features, not for a Context recap.
- **License:** Public Domain (19th c.).
- **Download / format:** SWORD module (`TSK`), per-book HTML at [StudyLight TSK](https://www.studylight.org/commentaries/eng/tsk.html), verse-keyed at Bible Hub; also available as structured cross-reference CSV/JSON datasets (e.g. openbible.info cross-references, itself CC-BY).

### Keil & Delitzsch - Biblical Commentary on the Old Testament (K&D)
- **What it provides:** Scholarly critical-grammatical commentary on the **Old Testament only** (Hebrew-based), 6+ vols. The standard PD OT scholarly commentary.
- **Granularity:** **Per-verse / verse-range** with section and chapter introductions. OT coverage only. Not concise chapter summaries but has section overviews.
- **License:** Public Domain (Keil d. 1888, Delitzsch d. 1890; English translation 19th c.).
- **Download / format:** Full 6-vol scans at [archive.org Keil & Delitzsch](https://archive.org/details/BiblicalCommentaryOldTestament.KeilAndDelitzsch.6); SWORD module (`KD`); e-Sword; verse-keyed HTML at StudyLight/Bible Hub.

### John Wesley's Explanatory Notes on the Whole Bible
- **What it provides:** Concise explanatory notes on the whole Bible (Wesley, 18th c.), deliberately brief.
- **Granularity:** **Per-verse but very short** notes; some book prefaces. Concise style but still verse-keyed, not one-line-per-chapter.
- **License:** Public Domain (Wesley d. 1791).
- **Download / format:** SWORD module (`Wesley`), CCEL, verse-keyed HTML at Bible Hub / [e-Sword](https://www.e-sword.net/contents.html) ("John Wesley's Notes on the Bible").

### Robertson's Word Pictures in the New Testament (A.T. Robertson)
- **What it provides:** Greek word/grammar exposition of the **New Testament only** -- highlights nuances of the Greek text verse by verse.
- **Granularity:** **Per-verse (NT only).** No chapter summaries; word-level Greek notes.
- **License:** Public Domain in the US -- Robertson d. 1934, and the work (1930-33) is pre-1929/renewal status varies; widely distributed as PD (e.g. CCEL, e-Sword, Bible Hub host it as PD). Flag: verify 1930-1933 vols' US copyright/renewal if strict.
- **Download / format:** SWORD module (`RWP`), CCEL, verse-keyed HTML at [Bible Hub](https://biblehub.com/commentaries/) ("Robertson's Word Pictures").

## 2. Open chapter/book outline & structure datasets

Most "Bible JSON/SQLite" datasets provide only the **text structured by book/chapter/verse** -- they give the skeleton (book names, chapter counts, verse counts) but no prose outline/summary. Useful as a structural scaffold for the Context tab, not as content:
- [midvash/bible-data](https://midvash.github.io/bible-data/) -- 33 PD versions, 22 languages, consistent schema, shipped as whole-Bible JSON, per-book JSON, AND `<slug>.sqlite` (indexed). Good structural scaffold; text only, no outlines.
- [churchstudio-org/openbible](https://github.com/churchstudio-org/openbible) -- PD Bible JSON as 3D array `[book][chapter][verse]`, plus per-book files. Structure only.
- [thiagobodruk/bible](https://github.com/thiagobodruk/bible) -- JSON + XML, book/chapter structure. Text only.
- [oflannabhra/bible.json](https://github.com/oflannabhra/bible.json) -- a JSON file describing each **book, its chapters and verse counts** (pure structural metadata; helpful for building the chapter index itself).
- **FLAG - NOT public domain:** [Amosamevor/Bible-json](https://github.com/Amosamevor/Bible-json) and [scott-epperly/Bible-json](https://github.com/scott-epperly/Bible-json) advertise NIV, NLT, NKJV, NASB, ESV etc. Those translations are **copyrighted**; redistributing them is infringement regardless of the repo's "open-source" label. Do not bundle.

These confirm we can get chapter/verse structure trivially, but a genuine *outline dataset* (headings/themes per chapter) needs a dedicated source.

**Pericope / section-heading datasets (thematic outline material):**
- **OpenBible.info section data** -- OpenBible has compiled where 20 English translations place section headings (pericope breaks). See [OpenBible Sankey pericopes blog](https://www.openbible.info/blog/2024/10/explore-bible-sections-pericopes-with-sankey-diagrams/) and [Bible Section Sankey diagrams](https://www.openbible.info/labs/bible-section-sankeys/). OpenBible data is generally released CC-BY; this gives verse offsets of section boundaries (a structural outline), though the *heading wording* from copyrighted translations can't be reused verbatim.
- **[JWBickel/KJV_Pericopes on Hugging Face](https://huggingface.co/datasets/JWBickel/KJV_Pericopes)** -- JSON dataset of KJV pericope divisions (~1K-10K rows), tagged "KJV Bible Pericope." KJV base text is PD; gives passage groupings usable as an outline scaffold.
- **Logos Pericopes Dataset** -- [logos.com Pericopes Dataset](https://www.logos.com/product/27526/pericopes-dataset) -- comprehensive named pericopes for the whole Bible, but this is a **proprietary paid Logos product. NOT usable.**
- **[jcuenod/awesome-bible-data](https://github.com/jcuenod/awesome-bible-data)** and **[Freely-Given-org/OpenBibleData](https://github.com/Freely-Given-org/OpenBibleData)** and [simoncozens open-source-bible-data](http://simoncozens.github.io/open-source-bible-data/) -- curated indexes of open Bible datasets (aligned texts, OSIS XML, versification, some section metadata). Good places to hunt for CC0/CC-BY structural data.

**Bottom line for Section 2:** There is no ready-made open dataset of prose *chapter outlines/themes*. What exists openly is (a) chapter/verse structural skeletons and (b) pericope-boundary data (openbible.info CC-BY, KJV_Pericopes). Thematic per-chapter outlines would have to be derived from the PD commentaries in Section 1 (Henry/Clarke chapter "contents" headers) or the chapter-summary sources in Section 3.

## 3. Chapter-summary-specific sources

### Bible Summary by Chris Juby (biblesummary.info)
- **What it is:** All **1,189 chapters** summarized, **one tweet (≤140 characters) per chapter**, originally posted daily on Twitter/@BibleSummary over ~3+ years. Confirmed by [BBC News](https://www.bbc.com/news/uk-england-tyne-24868490) and [biblesummary.info](https://biblesummary.info/). Also published as a book ("Every Chapter in 140 Characters or Less").
- **Granularity:** **Exactly per-chapter, one short sentence each.** This is the single best-fit existing dataset for a per-chapter recap tab -- but see license.
- **License / EXACT current terms** (from [biblesummary.info/licensing](https://biblesummary.info/licensing/), verbatim reading):
  - **Individual summaries:** free to quote "in any format" **with attribution** -- "@BibleSummary", or "Chris Juby, www.biblesummary.info", or "Summarised by Chris Juby. Visit www.biblesummary.info for the full archive."
  - **Larger sections or the WHOLE project:** **NOT open-licensed.** You must contact Juby for permission. He says he is "likely to give permission ... royalty-free" if your project is: *Small, Offline, Non-profit, helping people engage with Scripture, not pushing a narrow theological agenda, and able to link back to the website wherever summaries are used.*
  - **=> Bulk use is NOT automatically permitted.** DeepVerse is offline and Scripture-engagement-focused (fits his criteria well), but bundling all 1,189 requires an explicit permission conversation. There is no CC/PD grant. **Action item: email Chris Juby to request royalty-free permission** (offline, non-profit angle is favorable). Do not assume rights without it.

### Berean Study Bible / Berean Bible (BSB) summary material
- **License:** The Berean Bible (BSB) text itself is **freely licensed** (open/very permissive, effectively public-domain-like for the text). But the Berean project's headings are section headings, not chapter summaries.
- **Chapter summaries:** The Berean project does **not** publish a distinct one-line-per-chapter summary dataset (it provides the translation text, interlinear, and section headings). Useful as an open Bible *text* source, not as a chapter-recap source.

### Free Use Bible API (bible.helloao.org) -- aggregated open commentary
- **What it is:** [bible.helloao.org](https://bible.helloao.org/docs/reference/) is a free API/dataset bundling many PD Bible translations AND several PD commentaries. Notably its commentary schema includes a per-**chapter `introduction`** field ("The introduction that the commentary provided to the chapter") -- i.e. it has already parsed the **chapter-level intro text** out of PD commentaries (Matthew Henry, Adam Clarke, etc.) into structured JSON.
- **Granularity:** Provides chapter introductions + verse content, structured. This is likely the fastest path to structured **per-chapter overview text** from PD commentaries without parsing raw HTML yourself.
- **License:** Aggregates PD/open sources; check the repo's per-source license notes. The API itself is free to use.
- **Download / format:** JSON via API, and downloadable dataset. See [helloao reference docs](https://bible.helloao.org/docs/reference/).

### PROPRIETARY / NOT public domain -- DO NOT bundle
- **NET Bible notes** -- 60,932 translators' notes ([bible.org NET Bible](https://bible.org/netbible/index.htm?pre.htm)). Excellent but **copyrighted by Biblical Studies Press**. Free to read online with limits; redistribution/bundling requires a license. NOT PD.
- **ESV** (incl. any ESV study headings/summaries) -- Crossway copyright ([ESV on Bible Gateway](https://www.biblegateway.com/versions/English-Standard-Version-ESV-Bible/)). NOT usable.
- **NIV / NLT / NKJV / NASB** -- all copyrighted (Biblica/Tyndale/Thomas Nelson/Lockman). NOT usable.
- **IVP** commentaries (e.g. IVP Bible Background Commentary), **Keener**, **MacArthur**, **Guzik/Enduring Word** (Guzik is free-to-read but retains copyright, not PD) -- all copyrighted. NOT PD; do not bundle.
- **Logos Pericopes Dataset** -- proprietary (noted in Section 2).

### Other open short-summary options to consider
- **Derive our own** ≤140-char chapter summaries from PD commentary chapter-intros (Matthew Henry "Contents", Adam Clarke chapter argument) -- fully license-clean, but requires generation/editing.
- **Berean Bible + section headings** for structural outline (open text).

## 4. Summary table: granularity + license + format

**Chapter-level summary suitability legend:** ✅ = genuine per-chapter summary/overview usable for the Context tab; ◐ = has chapter intros/section overviews mixed with verse notes (extractable); ✗ = verse-level or cross-ref only (no chapter summary).

| Resource | Granularity | License | Download format | Notes |
|---|---|---|---|---|
| Matthew Henry Complete (MHC) | ◐ Book intros + per-chapter "Contents" overview + verse-range prose | Public Domain ([STEP MHC](https://www.stepbible.org/version.jsp?version=MHC)) | SWORD (`MHC`), CCEL ThML/XML/text, Bible Hub HTML, helloao API JSON | Chapter "Contents" headers are real chapter summaries but wordy |
| Matthew Henry Concise | ◐ Per-passage short blocks per chapter | Public Domain | SWORD, Bible Hub HTML, CCEL | Condensed; good raw recap material |
| Jamieson-Fausset-Brown (JFB) | ✗/◐ Book intros + verse notes; brief chapter notes | Public Domain | SWORD (`JFB`), e-Sword, Bible Hub HTML | 1-vol and unabridged 3-vol editions |
| Barnes' Notes | ✗ Per-verse (some chapter analysis) | Public Domain | SWORD (`Barnes`), e-Sword, Bible Hub HTML | Verse-level |
| Gill's Exposition | ✗ Per-verse (dense) | Public Domain | SWORD (`Gill`), e-Sword, Bible Hub HTML | Very verbose verse notes |
| Geneva Study Bible notes | ✗ Per-verse marginal glosses | Public Domain | SWORD, Bible Hub / biblestudytools HTML | Short marginal notes |
| Scofield Reference Notes | ✗ Per-verse/passage notes + book intros | Public Domain (pre-1931, [Wikisource](https://en.wikisource.org/wiki/Scofield_Reference_Bible_Notes)) | Wikisource, SWORD, StudyLight HTML | Dispensationalist |
| Darby's Synopsis | ◐ Per-book/section synopsis prose | Public Domain | SWORD (`Darby`), Bible Hub HTML, CCEL | Overview-style; often multi-chapter |
| Adam Clarke's Commentary | ◐ Chapter argument + per-verse notes | Public Domain | SWORD (`Clarke`), Bible Hub HTML, helloao API JSON | Chapter arguments = chapter overviews |
| Pulpit Commentary | ◐ Per-chapter/passage exposition + homiletics + verse notes | Public Domain ([free DL](https://biblicalstudies.org.uk/blog/the-pulpit-commentary-now-available-for-free-download/)) | PDF (biblicalstudies.org.uk), SWORD, Bible Hub/StudyLight HTML | Huge; verbose |
| Treasury of Scripture Knowledge (TSK) | ✗ Per-verse cross-references only | Public Domain | SWORD (`TSK`), StudyLight, CSV/JSON | Cross-refs, NOT prose |
| Keil & Delitzsch (OT only) | ◐ Section/chapter intros + verse notes | Public Domain | [archive.org scans](https://archive.org/details/BiblicalCommentaryOldTestament.KeilAndDelitzsch.6), SWORD (`KD`), StudyLight | Old Testament only |
| John Wesley's Notes | ✗ Per-verse (very short) + book prefaces | Public Domain | SWORD (`Wesley`), CCEL, Bible Hub, e-Sword | Concise but verse-keyed |
| Robertson's Word Pictures (NT only) | ✗ Per-verse Greek notes | PD in US (verify 1930-33 vols) | SWORD (`RWP`), CCEL, Bible Hub HTML | NT only; word-level |
| **Bible Summary (Chris Juby)** | ✅ **Exactly 1 short sentence per chapter (all 1,189)** | **NOT open** -- individual quotes OK w/ attribution; **bulk use requires permission** ([license](https://biblesummary.info/licensing/)) | Website; book (Kindle/paperback); no bulk data grant | Best fit; must email Juby for royalty-free offline/non-profit permission |
| Free Use Bible API (helloao) | ◐/✅ Serves PD commentaries w/ per-chapter `introduction` field | Aggregates PD/open sources | JSON API + downloadable dataset ([docs](https://bible.helloao.org/docs/reference/)) | Fastest path to structured chapter-intro text |
| midvash/bible-data | Structure only (book/ch/verse) | Public Domain | JSON + per-book JSON + **SQLite** ([site](https://midvash.github.io/bible-data/)) | Structural scaffold; no summaries |
| OpenBible pericope/section data | Section-boundary offsets (outline) | CC-BY (OpenBible) | Data/diagrams ([labs](https://www.openbible.info/labs/bible-section-sankeys/)) | Boundaries only; heading wording from copyrighted versions can't be copied |
| JWBickel/KJV_Pericopes | Pericope groupings (KJV) | KJV text PD | JSON ([HF](https://huggingface.co/datasets/JWBickel/KJV_Pericopes)) | Outline scaffold |
| Berean Bible (BSB) | Text + section headings (no chapter summaries) | Open/free license | JSON (helloao), berean.bible | Open *text*, not a recap source |
| **NET Bible notes** | Translators' notes | ✗ **Copyright BSP** | online only | NOT PD -- do not bundle |
| **ESV / NIV / NLT / NKJV / NASB** | Text + study headings | ✗ **Copyrighted** | n/a | NOT usable |
| **IVP / Keener / MacArthur / Guzik** | Modern commentary | ✗ **Copyrighted** (Guzik free-to-read but not PD) | n/a | NOT PD -- do not bundle |
| **Logos Pericopes Dataset** | Named pericopes whole Bible | ✗ **Proprietary (paid)** | Logos only | NOT usable |

### Key takeaways for the Context tab
1. **Only one existing dataset is truly "one summary per chapter": Chris Juby's Bible Summary** -- and it is **not openly licensed**; bulk use needs his explicit (likely-granted, royalty-free) permission for an offline non-profit app. This is the highest-value action item.
2. **License-clean fallback:** the PD commentaries with real chapter-level overviews are **Matthew Henry (Complete "Contents" + Concise), Adam Clarke (chapter arguments), Darby (synopsis), Pulpit, Keil & Delitzsch (OT)**. These are verbose; you'd extract/condense the chapter-intro portions. The **Free Use Bible API (helloao)** already exposes a per-chapter `introduction` field, making extraction easy.
3. Everything else (Barnes, Gill, Geneva, Scofield, Wesley, Robertson, JFB) is **verse-level** and **TSK is cross-references only** -- not chapter summaries.
4. **Structure/outline** is trivially available (midvash bible-data SQLite, openbible pericope boundaries CC-BY) but contains **no prose summaries**.
5. Do **not** bundle NET, ESV, NIV, NLT, NKJV, NASB, IVP, Keener, MacArthur, Guzik, or Logos datasets -- all copyrighted/proprietary.
