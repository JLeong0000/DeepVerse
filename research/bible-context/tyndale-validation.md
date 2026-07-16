# Tyndale Open — validation pass (hands-on)

**Date:** 2026-07-15
**Question:** Before building the cultural-background layer on Tyndale Open, confirm first-hand: the real download, its actual license, content quality (does it deliver "custom was Y"?), and whether it joins to our chapter/verse scheme.
**Verdict: PASS.** Trustworthy, high-quality, CC BY-SA 4.0 confirmed on the real files, joins cleanly via OSIS refs.

## What was downloaded (into gitignored `sources/tyndale/`)
- **Tyndale Open Study Notes** — `tyndale_open-studynotes.zip` (3 MB) from tyndaleopenresources.com
- **Tyndale Open Bible Dictionary** — `TyndaleOpenBibleDictionary.zip` (24 MB)

## License — confirmed on the actual files
`_README.txt` in both: **CC BY-SA 4.0, © 2022 Tyndale House Publishers.** No NonCommercial restriction. Attribution terms are specific: unmodified redistribution needs clear attribution to Tyndale House; a derivative/translation must state changes and carry: *"Adapted from Tyndale Open Study Notes. The original work by Tyndale House Publishers is available for free at http://www.tyndaleopenresources.com."* → **ShareAlike applies to the data we derive; it does not force our app open-source.**

## Content & structure (all XML)

**Study Notes package** (5 files):
- `StudyNotes.xml` — **16,923** verse/passage notes, keyed by **OSIS ref** (`<item name="Gen.1.6-8"><refs>Gen.1.6-8</refs>`). Historical + theological, and carries genuine **cultural background** — e.g. Gen 1:6-8: *"In the ancient Near East, the cosmos was understood as a three-tier…"* This is exactly the "custom/culture was Y" value.
- `ThemeNotes.xml` — **299** theme articles (`<item name="TheCreation"><title>The Creation</title><refs>Gen.1.1-2.25</refs>`), OSIS-ref'd.
- `BookIntroSummaries.xml` — per-book **Purpose / Author / Date / Setting** (Ruth: "Purpose: … trace the background of King David. Author: Unknown. Date: ~1100 BC. Setting: the period of the judges…"). Ideal for a chapter-context header.
- `BookIntros.xml` — longer per-book background (structure, theology).
- `Profiles.xml` — **124** people articles with key scripture refs.

**Dictionary package:** **6,010** articles (`typename="Article"`) — people, places, AND cultural/topical (e.g. *Passover* = "Important Jewish festival celebrating Israel's redemption from Egypt. See Feasts and Festivals of Israel; Meals, Significance of."). Headword-keyed, with cross-references between articles.

## Joinability to `bible.db`
- Study Notes / Theme Notes / Book Intros use **OSIS refs** (`Gen.1.1`, ranges like `Gen.1.1-2.3`) with the **same book codes** as `verses.book` → join by chapter/verse (parse the ref, including ranges).
- Dictionary is headword-keyed → join via entity names (cross-referable with the Theographic `chapter_entity` names).

## Trust
**High.** Reputable publisher (Tyndale House / NLT Study Bible lineage), professionally edited. Perspective is **evangelical/conservative** — disclose in-app, as with the other sources. See [[source-trust]].

## Considerations for the import (design, not blockers)
1. **Selectivity:** StudyNotes is large (10 MB) and verse-level, mixing cultural + theological notes. For the Context tab, curate — surface the **BookIntroSummary** as a background header and a few **relevant notes / theme articles** per chapter, not every verse note.
2. **"Cultural vs theological" separation:** cultural-background content is embedded within general verse notes; targeting just the cultural ones for a "custom was Y" card needs a heuristic or light curation (not a blocker).
3. **Attribution/ShareAlike:** attribute Tyndale House + carry BY-SA on the derived data (`docs/ATTRIBUTIONS.md`).
4. **XML cleanup:** bodies are HTML-ish with `class` spans and `<a href="?bref=…">` links — strip/normalize at import (straightforward, same as the recap/dictionary cleanup already done).

Data lives in gitignored `sources/tyndale/` (not committed). Ready to import when we build the cultural layer.
