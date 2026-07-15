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
- License: quoting individual summaries with attribution is permitted; **bulk use of all 1,189 requires the author's permission** (being sought). Do not redistribute publicly (e.g. a public repo or shipped build) until confirmed.
- Used for: the plain per-chapter recap shown at the top of the Context tab (`chapter_recap` table, `source = 'bible-summary'`). The summary text is kept locally as a static snapshot in `build/data/recaps-biblesummary.json`; the build reads it directly and makes no network calls. The app attributes biblesummary.info in the recap card.

## Editorial recaps (fallback)

- Author: DeepVerse (original)
- Used for: a defensive fallback in `chapter_recap` (`build/data/recaps-editorial.json`) for any chapter Bible Summary is missing. Bible Summary covers all 1,189 chapters, so this currently does not fire.

## Tyndale Open Study Notes

- Author: © 2022 Tyndale House Publishers
- License: CC BY-SA 4.0 (no NonCommercial restriction)
- Source: https://tyndaleopenresources.com
- Used for: per-verse study notes shown in the Context tab (`study_notes` table). Source XML is
  gitignored; the parsed notes are committed in `build/data/studynotes.json`. ShareAlike applies to
  the derived note data (attribute + keep BY-SA); it does not affect the app code. The app shows a
  "Tyndale Open Study Notes · CC BY-SA 4.0" label on the section.
