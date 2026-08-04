# Attributions

Third-party data sources bundled or processed into DeepVerse, with their licenses.

## Theographic Bible Metadata

- Author: Robert Rouse
- License: CC BY-SA 4.0
- Source: https://github.com/robertrouse/theographic-bible-metadata
- Used for: per-chapter people / places / events / writer context (`chapter_context` and `chapter_entity` tables).

## Bible Summary

- Author: Chris Juby
- Source: https://biblesummary.info — "every chapter of Scripture summarised in 140 characters or less"
- License: **bulk-use permission granted by the author, confirmed 2026-07-17.** All 1,189 summaries are quotable and redistributable **with attribution**. This supersedes the earlier "permission being sought — do not republish" constraint that ran 2026-07-15 → 2026-07-17.
- Used for: the plain per-chapter recap shown at the top of the Context tab (`chapter_recap` table, `source = 'bible-summary'`). The summary text is kept locally as a static snapshot in `build/data/recaps-biblesummary.json`; the build reads it directly and makes no network calls. The app attributes biblesummary.info in the recap card.

## Editorial recaps (fallback)

- Author: DeepVerse (original)
- Used for: a defensive fallback in `chapter_recap` (`build/data/recaps-editorial.json`) for any chapter Bible Summary is missing. Bible Summary covers all 1,189 chapters, so this currently does not fire. It was originally a licensing safeguard; since permission was confirmed it remains only as a gap-filler.

## Tyndale Open Study Notes

- Author: © 2022 Tyndale House Publishers
- License: CC BY-SA 4.0 (no NonCommercial restriction)
- Source: https://tyndaleopenresources.com
- Used for: per-verse study notes shown in the Context tab (`study_notes` table). Source XML is
  gitignored; the parsed notes are committed in `build/data/studynotes.json`. ShareAlike applies to
  the derived note data (attribute + keep BY-SA); it does not affect the app code. The app shows a
  "Tyndale Open Study Notes · CC BY-SA 4.0" label on the section.

## Tyndale Open Bible Dictionary

- Author: © 2023 Tyndale House Publishers
- License: CC BY-SA 4.0
- Source: https://tyndaleopenresources.com
- Used for: verse-driven dictionary articles, theme articles, profiles, and book introductions —
  shown both in the Context tab and as the browsable **Library** route (`#/library`). Tables:
  `dict_articles`, `dict_verse`, `dict_xref`, `tyndale_passages`, `book_intros`.
- Changes made (required by the source README). The reader-facing summary of this list is
  `TYNDALE_CHANGES` in `app/src/lib/sources.js`; if a change here alters what a reader sees,
  update that string too:
  1. **Article XML flattened to plain text** with subheadings marked, so the app can render them as
     headings. Tables are preserved for charts only, which cannot flatten.
  2. **Scripture references re-keyed** from Tyndale's own book codes to OSIS.
  3. **Three of the source's own scripture links corrected.** Each is evidenced from Tyndale's own
     words in `build/lib/tyndale.mjs` (`ERRATA`), and the build asserts each occurrence count so a
     future release that fixes them fails the parse instead of silently correcting nothing:
     - `Judges, Book of` — two links reading `Jos 1:8` pointed at `Josh.1.8`; retargeted to
       `Judg.1.8` and the visible text changed to `Jgs 1:8`. The passage recounts Judges 1.
     - `Judges, Book of` — one link `Jos.1.21` retargeted to `Judg.1.21`. Joshua 1 has 18 verses,
       so Joshua 1:21 does not exist.
     - `Ecclesiastes, Book of` — a link whose text already read `Romans 13` pointed at
       `Eccl.13.1-14`; retargeted to `Rom.13.1-14`. Ecclesiastes has 12 chapters.
  4. **Textboxes and charts stored alongside articles** and linked to their host article.
  5. **Cross-references lifted into a graph** (`dict_xref`) from the source's own `?item=` link
     markup. Nothing is inferred from prose.
  6. **Maps and Pictures are not ingested** (see `docs/DATA-PIPELINE.md`). One consequence is
     visible in the data: the single `?item=` link naming a Map (`Succoth` → *Key Places in the
     Exodus*) has no destination and is dropped at build time.

  Apocryphal references are **not** dropped: the deuterocanon is carried as KJVA text (see below),
  so those citations resolve. Raw source XML is gitignored; the parsed intermediates are committed
  in `build/data/sources/tyndale-*.json.gz`. ShareAlike applies to the derived dictionary data
  (attribute + keep BY-SA); it does not affect the app code. Like the study notes above, the
  dictionary's perspective is evangelical/conservative, disclosed in-app via the source label.

## King James Version + Apocrypha

- Author: translators of the 1611 Authorized Version; standardized 1769 text
- License: **Public Domain**
- Source: eBible.org — https://ebible.org/find/details.php?id=eng-kjv
- Used for: the deuterocanonical books in `verses` (`version = 'KJVA'`) — 5,650 verses across 14
  books (Tobit, Judith, Additions to Esther, Wisdom, Sirach, Baruch, the Prayer of Azariah,
  Susanna, Bel and the Dragon, 1–2 Maccabees, 1–2 Esdras and the Prayer of Manasseh). NIV, NKJV and
  NLT carry 66 books each and none of the deuterocanon, so before this every apocryphal citation in
  the Tyndale dictionary was a reference the reader could not follow.
- **UK caveat:** letters patent give Cambridge University Press, Oxford University Press and
  Collins the exclusive right to **print** the KJV in the United Kingdom. The decree is a printing
  privilege only and has no effect on use outside the UK. The text itself is public domain.
- No attribution is legally required, but the app shows one anyway (`KJV_APOCRYPHA` in
  `app/src/lib/sources.js`): a reader seeing 17th-century English beside three modern translations
  is owed the reason.
- Changes made: the KJV's square brackets around words supplied by the translators are removed (36
  occurrences — the app has no italic channel in a preview snippet, and the other three
  translations carry no such marks). **2 Esdras chapter 7 is dropped whole:** the KJV was made from
  Latin manuscripts missing 2 Esd 7:36–105, a gap not filled until 1875, so its chapter 7
  renumbers everything after verse 35 and would silently show the wrong verse for the citations
  Tyndale makes. The app shows an explanation in its place.
- **Still uncovered:** 3 Maccabees and 4 Maccabees (two verse citations each) and the Apocalypse of
  Baruch (one). None appears in the KJV Apocrypha — 3 and 4 Maccabees are Orthodox-canon books and
  the Apocalypse of Baruch is in no modern Bible. Those five citations render an explanation of
  what the book is rather than sitting inert.
