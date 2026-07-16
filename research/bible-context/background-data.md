# Agent 2: Cultural/Historical/Geographic Background & Knowledge Graphs

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

## 1. Knowledge graphs & metadata datasets

### Theographic Bible Metadata (robertrouse/theographic-bible-metadata)
- **Repo:** [github.com/robertrouse/theographic-bible-metadata](https://github.com/robertrouse/theographic-bible-metadata) — "A knowledge graph of biblical people, places, periods, and passages."
- **Content:** ~3,000 people, ~1,600 places (with GPS coordinates), 4,000+ events, plus periods (time) and passages. It weaves people/places/periods/passages into a linked graph. [scriptureverse.app](https://www.scriptureverse.app/blog/bible-apps-with-knowledge-graphs-compared) confirms "roughly 3,000 people, 1,600 places with GPS coordinates, and 4,000-plus events."
- **License:** CC BY-SA 4.0 (ShareAlike). Confirmed by downstream users e.g. [getproselytized.com/about](https://getproselytized.com/about): "Geographic and people data from Theographic Bible Metadata (CC BY-SA 4.0)."
- **Format:** CSV (in `/CSV/` folder e.g. People.csv, Places.csv), JSON (documented in [json-fields-documentation.md](https://github.com/robertrouse/theographic-bible-metadata/blob/master/docs/json-fields-documentation.md)), and Neo4j graph import ([neo4j-graph-documentation.md](https://github.com/robertrouse/theographic-bible-metadata/blob/master/docs/neo4j-graph-documentation.md)). Originally sourced from an Airtable base.
- **Granularity:** Entities (person/place/event/period) each link to related passages — so keying is entity->passage. Events carry timeline data. NEED TO VERIFY whether events are keyed to specific verses/chapters (see fetch below).
- Related: [robertrouse/theographic-web](https://github.com/robertrouse/theographic-web) is the web front-end ("linked encyclopedia").
- **Confirmed from [readme.md](https://github.com/robertrouse/theographic-bible-metadata/blob/master/readme.md):** License is explicitly "free to use and copy under a Creative Commons Attribution Share-Alike 4.0 License." Preferred format = nested **JSON** (in `/json` folder); CSV also provided but "do not follow typical database table design" (array-based fields need transforming into lookup tables for SQL). Also exposes a **GraphQL API** via Viz.Bible. Tag line: "Find related information on any passage or subject" — so passages ARE first-class linked entities.

#### ⭐ CHAPTER-LEVEL KEYING (most valuable finding) — from [json-fields-documentation.md](https://raw.githubusercontent.com/robertrouse/theographic-bible-metadata/master/docs/json-fields-documentation.md)
The JSON has these tables (files in `json/`): **Books, Chapters, Easton, Events, People (38 fields), PeopleGroups (7), Periods (9), Places (40), Verses (17).** All entities share `id` / `createdTime` / `fields`. Data originated in Airtable (Python ETL).
- **Chapters table (10 fields)** is directly keyed to chapters via `osisRef` = `book.chapter` (e.g. `"Gen.1"`, `"Rom.16"`). Each chapter record includes: `book` (link), `chapterNum`, `writer` (link to people = traditional author of the chapter), `verses` (links), `peopleCount`, `placesCount` (# distinct people/places mentioned by name IN that chapter). So people and places ARE aggregated per chapter. This is exactly the join key DeepVerse needs — `osisRef` maps 1:1 to a chapter.
- **Books table (16 fields):** per-book `writers`, `placeWritten` (location where book was written — link to places), `yearWritten` (approx year — NOTE: currently in "unusable format as of 2026/01/05, undergoing a fix," will become isoYear integer), `peopleCount`, `placeCount`. Good for a per-book context header ("written in X, ~year Y").
- **Easton table (12 fields):** parsed entries from **Easton's Bible Dictionary (1897, public domain)** — `dictText` definition, linked to corresponding `people` and `places` records. This gives free-text encyclopedic background per person/place, PD-licensed at source. Source XML: ccel.org/ccel/easton/ebd2.xml.
- **Events table (19 fields)** = a full **biblical timeline**. Each event: `title`, `startDate` (ISO date/astronomical year, negative = BC), `duration`, `participants`(→people), `locations`(→places), `verses`(→scriptural basis), `predecessor`+`lag`+`lagType` (SS/FS dependency between events), `partOf` (parent event / narrative arc), `notes`, `sortKey` (float combining year + verse order for chronological sort), `rangeFlag` (year approximate). Example: `{"title":"Tower of Babel","startDate":"-2245","locations":[...],"verses":[...],"eventID":53}`. Because events link to `verses`, and verses roll up to chapters, events CAN be surfaced per chapter.
- **People table (38 fields):** `name`, `personID`, `gender`, `birthYear`/`deathYear` (ISO astronomical year strings — `-4003` = 4004 BC, `"30"` = AD 30), `birthPlace`/`deathPlace`(→places), family links (`father`,`mother`,`siblings`), `memberOf`(→peopleGroups), `events`(→events), all `verses` mentioning them, and `dictionaryLink` (URL to Easton's entry at biblestudytools.com). `isProperName` distinguishes named people from "Wife of…".
- **Places table (40 fields):** rich geo record. `kjvName`/`esvName`/`aliases`/`displayTitle`, `latitude`/`longitude` (best-available, reconciled from OpenBible + Recogito), `openBibleLat`/`openBibleLong` (raw from OpenBible.info), `recogitoLat`/`recogitoLon`+`recogitoUri` (links to GeoNames/Pleiades/other historical gazetteers via Recogito, e.g. `http://sws.geonames.org/357994`), `featureType`/`featureSubType` (Region/City/Water/River/Country…), `precision`, `verseCount`, `verses`(→verses mentioning it), `eventsHere`(→events), `peopleBorn`/`peopleDied`, `booksWritten`, `hasBeenHere` (list of people who visited), and `dictText`/`dictionaryText`/`dictionaryLink` (Easton's entry). Example: Egypt with lat/long, 564 verse mentions, featureType Region/Country. This is a strong geographic backbone (see Section 2).
- **PeopleGroups (7 fields):** tribes/nations/families — `groupName`, `members`(→people), `verses`, `events`. e.g. "Apostles (The Eleven)".
- **Verses table (17 fields)** = the finest join grain. Keyed by `osisRef` (e.g. `"Gen.2.8"`), with `verseNum`, `verseText` (KJV), `book`+`chapter` links, and per-verse links to `people`, `places`, `peopleGroups`, and `event`. Also `yearNum` = year for the verse from **Torrey's Treasury of Scripture Knowledge** (public domain; note: "Not aligned with the events table"). So: verse → chapter is a hard FK, and every person/place/event/group is attached to its verse(s). To build a chapter Context tab, aggregate all verses whose `chapter` FK matches → union their people/places/events. The Chapters table already precomputes `peopleCount`/`placesCount`.
- **Periods table (9 fields):** biblical time periods (eras) with iso year data (the `yearWritten` link in Books points here; being migrated to isoYear integers).

**Summary of Theographic keying for DeepVerse:** The dataset is a normalized graph where `osisRef` (book.chapter.verse) is the anchor. Chapter-level context = trivially derivable (Chapters table + Verses FK rollup). People/places carry Easton's Dictionary background text + geo coords. Events form a datable timeline linked to verses. This is the single best-fit open dataset for a per-chapter Context tab. CC BY-SA 4.0 (copyleft — see Section 5).

### MetaV (KJV Bible database with metadata)
- **Repos:** [theonize/KJV-bible-database-with-metadata-MetaV-](https://github.com/theonize/KJV-bible-database-with-metadata-MetaV-) (a fork of Theographic) and [gusheng/MetaV](https://github.com/gusheng/MetaV).
- **Content:** "MetaV contains the 'Who, Where, and When' of every single passage in the Bible at **word-level detail**." Underlies the "visual Bible explorer." Links people, places, periods, passages down to individual words.
- **Format:** **CSV** (in `/CSV/` folder). Table structure (from [readme](https://github.com/theonize/KJV-bible-database-with-metadata-MetaV-)):
  - `MainIndex` — the core: one row PER WORD of the 1769 Cambridge KJV, with `BookID`, `Chapter`, `VerseID`, `VerseNum`, `VersePos` (word position), `WordID`, `Word`, `PlaceID`(→Places), `PersonID`(→People), and **`YearNum`** (approx year of the event / prophecy; negative=BC). So person/place/year are keyed all the way down to the word, and therefore to chapter.
  - `Books`, `BookAliases` — standard book metadata.
  - `CrossRefIndex` — cross-references from **R.A. Torrey's Treasury of Scripture Knowledge (Public Domain)**.
  - `People` — mashup of complete-bible-genealogy.com and marshallgenealogy.org/bible; Name, Gender, BirthYear, IsProperName, etc.
  - `Places` — with coordinates (see Section 2).
- **License:** "It pulls from a variety of other sources which are available for use under **Public Domain, Creative Commons, or other open use license**." Underlying chronology source = **Annals of the World, James Ussher** + Torrey's TSK (both Public Domain). NOTE: because it's a Theographic fork, the compilation likely inherits CC BY-SA; the constituent PD sources (Ussher, Torrey, 1769 KJV) are individually PD. `YearNum` (Ussher-based per-word year) is a notable free chronology signal.

### viz.bible
- [viz.bible](https://viz.bible/) — data visualizations/infographics platform. Robert Rouse (Theographic author) is associated; Viz.Bible data underlies Theographic and hosts its GraphQL API. The downloadable dataset IS the Theographic repo above (same CC BY-SA 4.0). Viz.Bible itself is a gallery/site, not a separate dataset.

### TIPNR — Translators/Tyndale Individuated Proper Names with References (part of STEPBible-Data)
- **Repo:** [github.com/STEPBible/STEPBible-Data](https://github.com/STEPBible/STEPBible-Data). TIPNR = "Tyndale/Translators Individualised Proper Names with all References."
- **License:** **CC BY 4.0** (attribution only, NOT ShareAlike) per the [STEPBible repo](https://github.com/STEPBible/STEPBible-Data) — much friendlier for bundling than Theographic's BY-SA.
- **Content:** ~**4,299** biblical people, places, and "things" (proper names), each with ALL scripture references where the name occurs, disambiguated (individuated) so that e.g. the many people named "Zechariah" are separate records. Confirmed by [get.bible/bible-data-sets](https://get.bible/bible-data-sets/) ("TIPNR – every name…") and [studybible-mcp](https://github.com/djayatillake/studybible-mcp) ("Translators Proper Names, 4,299 biblical people, places, and things… CC BY 4.0").
- **Format:** Tab-separated (TSV / tab-delimited `.txt`) in the STEPBible-Data repo. Keyed name→references (so it maps names to verse refs; can roll up to chapter).
- STEPBible also has other datasets: TAGNT/TAGOT (tagged Greek/Hebrew), TFBDB (BDB lexicon), TOTMM — all CC BY 4.0.

## 2. Geographic datasets

### ⭐ OpenBible.info Bible Geocoding Data (the canonical open Bible gazetteer)
- **Project:** [openbible.info/geo](https://www.openbible.info/geo/) — "comprehensively identifies the possible modern locations of every place mentioned in the Bible as precisely as possible."
- **Repo:** [github.com/openbibleinfo/Bible-Geocoding-Data](https://github.com/openbibleinfo/Bible-Geocoding-Data). Also "catalogs the expression of these places in ten English translations… links the data to semantic databases like **Wikidata** where possible."
- **License:** **CC BY 4.0** (attribution only). Confirmed by downstream users e.g. [silbible.com](https://silbible.com/home): "Place geography from Bible Geocoding Data (openbible.info), licensed under CC BY 4.0." OpenBible explicitly "release[d] geocoding data under a Creative Commons license to allow people to reuse it" ([OpenBible blog](https://www.openbible.info/blog/category/geo/page/3/)).
- **⭐ CHAPTER KEYING:** OpenBible provides per-book AND per-chapter place listings — e.g. [openbible.info/geo/preview/matt](https://www.openbible.info/geo/preview/matt) has a "Chapters with Places" section and downloadable **KML per book**. So places ARE grouped by chapter natively. This is directly usable for "places in this chapter."
- **Format & files (from [repo readme](https://github.com/openbibleinfo/Bible-Geocoding-Data)):** Draws from **70+ modern sources** with **400+ unique sources cited** (commentaries, dictionaries, atlases). Files are **JSON Lines** (`.jsonl`, one JSON object per line):
  - `ancient.jsonl` — ancient places as mentioned in the Bible, disambiguated, **"catalogs them by verse reference"**, with confidence ratings on modern-location identifications.
  - `modern.jsonl` — modern locations identifiable with ancient places (lat/long points).
  - `geometry.jsonl` + thousands of GeoJSON/KML files — geometry for rivers/regions (not single points).
  - `image.jsonl` — image metadata; a 180 MB `thumbnails.zip` has a 512×512 image per location.
  - `source.jsonl` — the cited sources.
  - `all.kml` — quick preview in Google Earth.
  - Rich schema: identifications carry `class` (human/natural — e.g. political region "Judea" vs natural "Arabah"), `contained_in`/`contains` relationships, `geometry_radius_meters` for fuzzy regions, and **Wikidata** links.
- **License nuance:** dataset = **CC BY 4.0**, BUT it embeds **OpenStreetMap** geometry licensed **ODbL 1.0** ("similar to CC-BY-SA"), and image licenses vary. So the geometry/region shapes carry a share-alike-like obligation — the point coordinates/text are the clean CC BY part.
- This is the SAME coordinate source Theographic's Places table ingests (`openBibleLat`/`openBibleLong`). Using Theographic gives you OpenBible coords already reconciled with Recogito/GeoNames. For a lean bundle, Theographic's Places table (lat/long + featureType per place, chapter-linked via verses) may be sufficient without importing the full jsonl.

### STEPBible TIPNR (place/name identification) & other gazetteers
- STEPBible's **TIPNR** (CC BY 4.0, above) individuates proper names including **places**, mapping each to all its verse references — good for name→reference resolution, but it is NOT primarily a coordinate dataset; OpenBible remains the coordinate authority. Multiple apps pair them: [fisherstudy.org](https://fisherstudy.org/) lists "Proper Names (TIPNR) from STEPBible" + "Biblical Places & Geography: OpenBible.info Bible Geocoding (CC BY)."
- **Recogito / Pleiades / GeoNames:** Theographic's Places link out to these via `recogitoUri` (e.g. GeoNames `sws.geonames.org/357994`). Pleiades (ancient-world gazetteer) is **CC BY 3.0**; GeoNames is **CC BY 4.0** — both usable for deeper ancient-place identification if needed.
- **OpenStreetMap** (ODbL) supplies the region/river polygons inside OpenBible geometry files.

## 3. Cultural/historical background commentaries & open IVP alternatives

**The gold standard is copyrighted:** the *IVP Bible Background Commentary* (OT vol. by John Walton/Victor Matthews/Mark Chavalas; NT vol. by Craig Keener) is verse/passage-keyed ancient-Near-East & Greco-Roman background — but it is fully copyrighted by InterVarsity Press and NOT available under any open license. Any bundling must use open substitutes below.

### Tyndale Open Study Notes (TOSN) — the leading open, verse-keyed option
- **Home:** [tyndaleopenresources.com](https://tyndaleopenresources.com/) — Tyndale House Publishers open-licensed the study apparatus of the NLT Study/Life Application line. Bundle includes: **verse-level study notes**, **book introductions**, **people profiles**, **theme articles**, and a **Bible dictionary** — "explain the meaning and **background** of the Bible text in clear, modern English." Dictionary "contains articles on the **cultural context**."
- **License:** **CC BY-SA 4.0** (Attribution-ShareAlike). Confirmed on [freely-given.org/OBD/TOSN/details.htm](https://freely-given.org/OBD/TOSN/details.htm): "Creative Commons Attribution-ShareAlike 4.0 International License. Thanks to Tyndale House Publishers for their generous open-licensing of these Bible study and related notes." (SHARE-ALIKE — same copyleft concern as Theographic; see Section 5.)
- **Format:** downloadable **XML files** (zipped) from tyndaleopenresources.com (confirmed by an [Accordance forum thread](https://forums.accordancebible.com/topic/35123-tyndale-open-study-notes-import-xml-files/): "The contents are XML files"). Also served via **STEPBible** as version **TNotes** ([stepbible.org TNotes](https://www.stepbible.org/version.jsp?version=TNotes)).
- **Granularity (⭐ the key question):** MIXED. Study notes are **verse/passage-keyed** (concise comments per verse), which rolls up to chapter. Book introductions are book-keyed. **Theme articles** and **people/place profiles** and **dictionary articles** are STANDALONE (topic-keyed, not verse-keyed) but are cross-linked from the passages where the topic appears. So for a Context tab: verse notes give per-chapter background directly; theme/dictionary articles attach via the people/places/concepts that a chapter mentions.
- **This is the single best open substitute for the IVP Background Commentary** for cultural/historical context, because (a) it explicitly covers "background" and "cultural context," and (b) the study notes are verse-keyed. Downside: CC BY-SA copyleft.

### Public-domain verse-keyed commentaries (fallback background text)
These are pre-1924, so weaker on modern archaeology/ANE studies than IVP, but they ARE verse-keyed and fully public domain (no attribution/copyleft burden). Good filler where TOSN is silent:
- **Jamieson-Fausset-Brown (JFB)** — 1-volume whole-Bible commentary, verse notes, PD. Machine-readable text via [CCEL](https://ccel.org/j/jfb/jfb/JFB00H.htm) (scanned by Woodside Bible Fellowship, structured into per-verse notes with Scripture-reference markers).
- **Barnes' Notes on the Whole Bible** — verse-keyed, PD, available from [StudyLight](https://www.studylight.org/commentaries/eng/bnb.html).
- **International Critical Commentary (ICC)** — PD volumes on [archive.org](https://archive.org/details/internationalcriticalcommentary).
- **[sacred-texts.com/bib/cmt](https://sacred-texts.com/bib/cmt/index.htm)** indexes ~15 PD commentaries, all KJV-verse-linked.
- **Easton's Bible Dictionary (1897, PD)** — already embedded IN Theographic (see Section 1) linked per person/place; also standalone. Gives short encyclopedic background entries.
- Aggregators: [freecommentaries.com](https://freecommentaries.com/) (6600 commentaries), [biblicalstudies.org.uk](https://biblicalstudies.org.uk/blog/1000-free-biblical-commentaries-now-available/) (~800 PD from Tyndale House catalogue).
- **Caveat:** these are free-text prose keyed to verses, NOT structured facts. Usable for a "commentary" pane but require NLP/extraction to turn into structured "custom was Y" cards. TOSN is better structured for background.

### Tyndale Open Bible Dictionary (TOBD)
- Part of the same release ([bibleanalyzer listing](https://www.bibleanalyzer.com/store/tyndale-open-bible-dictionary)): "Dictionary articles on all the significant **people, places, and concepts** in the Bible. Also contains articles on the **cultural context**." Based on the *Tyndale Bible Dictionary* (Elwell/Comfort). CC BY-SA 4.0, XML. Topic-keyed (article per entry), linkable from chapter entities.
- Confirmed from [tyndaleopenresources.com](https://tyndaleopenresources.com/): TOBD has "Dictionary articles on all the significant people, places, and concepts… articles on the **cultural context of scripture** and on important theological terms." Both TOSN and TOBD are "freely available for download, translation, and publication" under CC BY-SA 4.0. Translation/derivative works are asked to be shared back under the same terms.

## 4. Timelines & chronology datasets

### Best structured timeline: Theographic Events table (repeat from §1)
- The **Events table** ([Theographic](https://github.com/robertrouse/theographic-bible-metadata), CC BY-SA 4.0) is already a datable, chronologically-sortable timeline: `startDate` (ISO astronomical year), `duration`, `predecessor`/`lag`/`lagType`, `partOf`, `sortKey`, `rangeFlag`, linked to participants/locations/verses. This is the readiest-to-use structured timeline and it keys to verses (→chapters).
- **People** birthYear/deathYear and **Periods** table add era framing. **Books.yearWritten** gives per-book dating (being migrated to isoYear ints).

### Per-verse year: MetaV YearNum (Ussher + Torrey, Public Domain)
- MetaV's `MainIndex.YearNum` assigns an approximate year to each word/verse, sourced from **James Ussher's *Annals of the World*** and **Torrey's Treasury of Scripture Knowledge** — both **Public Domain**. Negative=BC. Also present in Theographic's Verses table as `yearNum` (from Torrey). Lets you label any chapter with an approximate year.

### Ussher chronology as a clean dataset (ussherR)
- **[ussherR](https://search.r-project.org/CRAN/refmans/ussherR/html/usshfull.html)** — a CRAN R package: "Cleaned and tidied data drawn from Archbishop James Ussher's chronology… *The Annals of the World* (1658)." Provides tabular event/date data (Ussher is PD; the R package itself is open-source). Extractable to CSV.

### Hebrew Kings regnal chronology (Thiele)
- The scholarly standard for reign dates of the kings of Israel/Judah is **Edwin Thiele, *The Mysterious Numbers of the Hebrew Kings*** ([Wikipedia](https://en.wikipedia.org/wiki/The_Mysterious_Numbers_of_the_Hebrew_Kings)). The BOOK is copyrighted, but the resulting regnal date figures are facts (not copyrightable) and are widely tabulated (e.g. [thebiblicaltimeline.org](https://www.thebiblicaltimeline.org/blog/kings-chronicles/)). A CC BY 4.0 re-derivation exists: Lietuvietis, "Absolute Chronological Charts… for Thiele's Chronology" ([academia.edu](https://www.academia.edu/43170207/), CC BY 4.0). You can compile a small reign-dates table yourself from these facts without licensing issues.

### Meta-resource
- **[jcuenod/awesome-bible-data](https://github.com/jcuenod/awesome-bible-data)** — curated list of "generously licensed Bible data." Reviewed its README: it is heavily weighted to **texts, tagged original languages, lexicons, cross-references, versification, and second-temple/early-church writings** — NOT structured cultural/geographic/timeline metadata. It does NOT list a chapter-keyed background dataset beyond STEPBible; so Theographic + OpenBible + TOSN (found above) remain the core. Notable side-items for context: second-temple literature ([Online-Critical-Pseudepigrapha](https://github.com/OnlineCriticalPseudepigrapha/Online-Critical-Pseudepigrapha), [Sefaria-Export](https://github.com/Sefaria/Sefaria-Export)) and [Ante-/Post-Nicene Fathers](https://github.com/gregorycrane/nicenefathers) give primary-source cultural background but are un-keyed prose. Also [Open Source Bible Data](http://simoncozens.github.io/open-source-bible-data/) by Simon Cozens.

## 5. Summary table + ShareAlike implications

### Summary table

| Resource | Content | Granularity (keying) | License | Format |
|---|---|---|---|---|
| **Theographic Bible Metadata** | ~3,000 people, ~1,600 places (GPS), 4,000+ events, periods, passages; Easton's dictionary text embedded | **Chapter (osisRef) + verse FK rollup**; entity↔passage graph; Chapters table has peopleCount/placesCount | **CC BY-SA 4.0** | JSON (nested), CSV, Neo4j, GraphQL API |
| **MetaV** | Who/where/when per WORD; people, places, YearNum, cross-refs | **Word → verse → chapter**; PlaceID/PersonID/YearNum per word | CC BY-SA (compile) over PD sources (Ussher, Torrey, 1769 KJV) | CSV |
| **STEPBible TIPNR** | ~4,299 individuated proper names (people/places/things) + all refs | **Name → verse references** | **CC BY 4.0** | TSV / tab-delimited txt |
| **OpenBible.info Geocoding** | Every identifiable biblical place; coords, confidence, Wikidata links, region geometry, thumbnails; 70+ sources | **Place, cataloged by verse reference**; per-book/per-chapter place views + KML | **CC BY 4.0** (embedded OSM geometry = ODbL) | JSON Lines, GeoJSON, KML |
| **Tyndale Open Study Notes (TOSN)** | Verse study notes, book intros, people profiles, theme articles (incl. cultural background) | **Verse/passage-keyed notes** (→chapter); theme/profile articles topic-keyed | **CC BY-SA 4.0** | XML (zip); STEP TNotes |
| **Tyndale Open Bible Dictionary** | Articles on people, places, concepts, **cultural context**, theology | Topic-keyed (article per entry), linkable from chapter entities | **CC BY-SA 4.0** | XML |
| **PD commentaries (JFB, Barnes, ICC)** | Verse-by-verse historical/cultural comment (pre-1924) | **Verse-keyed** free-text prose | Public Domain | HTML/text (CCEL, StudyLight, archive.org) |
| **Easton's Bible Dictionary (1897)** | Encyclopedic entries on people/places | Entry-keyed (linked per person/place) | Public Domain | Embedded in Theographic; XML at CCEL |
| **ussherR / Ussher Annals** | Ancient chronology, dated events (creation→NT) | Event/date rows | PD source (Ussher 1658); OSS package | R data → CSV |
| **Thiele Hebrew-Kings dates** | Regnal dates of kings of Israel/Judah | Per-king reign spans (facts) | Facts uncopyrightable; CC BY 4.0 re-derivation exists | tabular (compile yourself) |

### Recommended stack for a per-chapter Context tab
1. **Theographic** as the structured backbone (people/places/events/timeline, chapter-keyed via osisRef, coords included). CC BY-SA.
2. **OpenBible.info** if you want richer geo (confidence, region polygons, Wikidata) — CC BY 4.0, but Theographic already carries its coords.
3. **TOSN + TOBD** for the narrative cultural/historical "the custom was Y" text (best open IVP substitute) — CC BY-SA, verse-keyed notes + topic articles.
4. **STEPBible TIPNR** (CC BY 4.0) if you want a copyleft-free name index.
5. **MetaV YearNum / Ussher / Thiele** for a per-chapter approximate date and reign spans (mostly PD).

The realistic gap: none of these ships pre-written "this chapter happens in nation X whose custom was Y" cards. You assemble that by joining (a) the chapter's places/people/events (Theographic) with (b) the relevant TOSN notes/TOBD cultural articles keyed to that passage/topic. That join is straightforward because everything anchors on osisRef / verse references.

### What CC BY-SA (ShareAlike) means for bundling into a distributed offline app
CC BY-SA 4.0 (Theographic, MetaV, TOSN, TOBD) is a **copyleft** license. Practical implications for `bible.db`:
- **Attribution (BY):** you must credit each source (name, license, link) somewhere reachable in the app (e.g. an About/Licenses screen) and indicate if you modified the data. Required for CC BY 4.0 sources (OpenBible, TIPNR) too.
- **ShareAlike (SA):** if you distribute an **"adaptation"** (a derivative — e.g. you reshape, extend, merge, or transform the BY-SA data into your own schema, or generate new keyed cards from it), that adapted database must itself be released under **CC BY-SA 4.0 (or a compatible license)**. Downstream users must be free to copy/redistribute your adapted data under the same terms. You cannot slap an all-rights-reserved or restrictive EULA on the portion of `bible.db` that is derived from BY-SA data.
- **What SA does NOT force:** it is data/content-copyleft, not code-copyleft (unlike GPL). Bundling a CC BY-SA database inside your app does **not** make your **application source code** BY-SA. Merely aggregating the dataset alongside your proprietary app ("mere aggregation" / a "collection") is allowed; SA reaches the adapted *data*, not the surrounding program. Your app UI, engine, and other original code stay under whatever license you choose.
- **Mixing licenses:** CC BY 4.0 data (OpenBible, TIPNR, GeoNames) can be combined with BY-SA data, but the SA obligation then governs the combined/adapted dataset. Pure PD data (Easton, Ussher, Torrey, JFB, Barnes, KJV) carries **no** obligations — safest to lean on PD where BY-SA is undesirable.
- **OpenBible geometry caveat:** its region/river polygons embed **OpenStreetMap (ODbL)**, a share-alike-style database license with its own attribution + share-alike terms on derived geometry. If you only use OpenBible's point coordinates/text (CC BY), you avoid ODbL; if you ship the polygons, honor ODbL.
- **Net recommendation:** treat the background portion of `bible.db` as a CC BY-SA 4.0 dataset (bundle a LICENSES/attribution manifest listing Theographic, OpenBible, Tyndale Open Resources, STEPBible, and the PD sources), keep app code under your own license, and offer the derived data for download under CC BY-SA to satisfy SA's "same terms" redistribution requirement.
