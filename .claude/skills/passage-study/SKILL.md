---
name: passage-study
description: Use when the user asks to study, explain, or break down a specific passage or reference (verse, verse range, or chapter) — assembles the English text across versions, the interlinear, interpretive differences, cross-references, study notes, and chapter context in one grounded answer. Builds on the deepverse-data skill.
---

# Passage study over the DeepVerse corpus

Load `deepverse-data` first. Query `data/bible.db`. Use OSIS book codes (`John`, `1Cor`, `Gen`).

## Playbook

1. **Parse the reference** to `book, chapter, verse(s)`.
2. **Text (all 3 versions):**
   `SELECT version,text FROM verses WHERE book=? AND chapter=? AND verse=? ORDER BY version;`
   Note NIV = 1984.
3. **Interlinear:**
   `SELECT position,original,translit,gloss,strongs,lemma FROM words WHERE book=? AND chapter=? AND verse=? ORDER BY position;`
4. **Interpretive differences on the ref:**
   `SELECT position,type,strongs FROM differences WHERE book=? AND chapter=? AND verse=?;` — for the
   *why*, hand off to the `interpretive-differences` skill (it parses `detail`).
5. **Cross-references:**
   `SELECT to_ref,votes FROM cross_refs WHERE from_book=? AND from_chapter=? AND from_verse=? ORDER BY votes DESC LIMIT 10;`
6. **Study notes covering the ref** (covering/range model):
   `SELECT ref,body FROM study_notes WHERE book=? AND start_chapter<=? AND end_chapter>=? AND start_verse<=? AND end_verse>=? ORDER BY seq;`
7. **Chapter frame** (optional, if the user wants the wider setting): hand off to `context-background`.

Present a structured brief with each section cited. Don't dump every row — summarize, surface what's
interesting (differences, strong cross-refs), and offer to drill in.

## Worked example — John 21:15

- Text: three rows (NIV/NKJV/NLT).
- Interlinear: ἀγαπᾷς at position 12, `strongs G0025`.
- Differences: rows at positions 12 (A, G0025) and 23 (A+B, G5368), among others.
- Cross-refs: returned ordered by `votes` desc.
- Study notes: three covering rows — `21:1-25`, `21:15-17`, `21:15`.
