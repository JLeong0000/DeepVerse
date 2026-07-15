# Attributions

Third-party data sources bundled or processed into DeepVerse, with their licenses.

## Theographic Bible Metadata

- Author: Robert Rouse
- License: CC BY-SA 4.0
- Source: https://github.com/robertrouse/theographic-bible-metadata
- Used for: per-chapter people / places / events / writer context (`chapter_context` and `chapter_entity` tables).

## Matthew Henry Commentary

- License: CC Public Domain Mark 1.0
- Source: HelloAO Free Use Bible API — https://bible.helloao.org
- Used for: per-chapter recaps (`chapter_recap` table), primary source.

## Adam Clarke Commentary

- License: CC Public Domain Mark 1.0
- Source: HelloAO Free Use Bible API — https://bible.helloao.org
- Used for: per-chapter recaps (`chapter_recap` table), fallback where Matthew Henry is absent.

## Editorial recaps

- Author: DeepVerse (original)
- Used for: per-chapter recaps (`chapter_recap` table, `source = 'editorial'`) for the 14 chapters no public-domain commentary covers cleanly — Matthew 19–28, Isaiah 58, Numbers 36, Proverbs 28, Psalm 73 — written from the chapter text (`build/data/recaps-editorial.json`).
