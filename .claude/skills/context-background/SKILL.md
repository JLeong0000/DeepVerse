---
name: context-background
description: Use when the user asks for the background, context, setting, or the people/places/events of a chapter — assembles the chapter recap, writer, entity roll-up (people, places with coordinates, events, groups), and Tyndale study notes, with source and licensing caveats. Builds on the deepverse-data skill.
---

# Chapter context & background

Load `deepverse-data` first (source/trust map, licensing caveats). Query `data/bible.db`. OSIS book codes.

## Playbook

1. **Recap:** `SELECT recap,source FROM chapter_recap WHERE book=? AND chapter=?;`
   - `source='bible-summary'` is **licensed (confirmed 2026-07-17) — quotable with attribution** (Chris Juby, biblesummary.info).
   - `source='editorial'` is the hand-authored fallback.
2. **Chapter frame:** `SELECT writer,people_count,place_count FROM chapter_context WHERE book=? AND chapter=?;`
   `writer` = traditional author (Theographic).
3. **Entities:**
   `SELECT entity_type,name,latitude,longitude,blurb,approx_year FROM chapter_entity WHERE book=? AND chapter=? ORDER BY sort_verse;`
   - `entity_type` ∈ person / place / event / group. Places carry coords.
   - **Caveats:** dates are approximate; names can collide (two different people/places, same name).
4. **Study notes for the chapter** (covering/range model, chapter-level):
   `SELECT ref,body FROM study_notes WHERE book=? AND start_chapter<=? AND end_chapter>=? ORDER BY seq;`
   Tyndale Open Study Notes (CC BY-SA).
5. **Never invent** cultural or historical claims not present in a blurb, note, or recap. If the user
   wants "what was the custom of nation X," and no blurb/note supports it, say the data doesn't carry it.

## Notes

- Everything is keyed `(book, chapter)` — this is chapter-grain context, not verse-grain.
- For the deeper *interpretive* layer of a verse (why a word choice matters), use `interpretive-differences`.
- Attribution for anything surfaced: `docs/ATTRIBUTIONS.md`.
