---
name: interpretive-differences
description: Use when the user asks what nuance or distinction a translation hides, why one English word stands for different original words, or why a word is translated a certain way — explains Type A (synonym collapse) and Type B (semantic-range spread) differences for a verse, grounded in the differences table. Builds on the deepverse-data skill.
---

# Interpretive differences (the signature feature)

Load `deepverse-data` first (the `differences.detail` JSON shapes, Strong's padding). Query `data/bible.db`.

**Philosophy (frame every answer with this):** a faithful rendering must choose one sense of a rich word
and hide the alternatives — surfacing that choice is the point, *not* "the translation is wrong."

## Playbook

1. **Pull the rows:**
   `SELECT position,type,strongs,detail FROM differences WHERE book=? AND chapter=? AND verse=?;`
2. **Type A — synonym collapse.** Parse `detail.nearSynonyms`. For each near-synonym code, look up its
   sense: `SELECT lemma,gloss FROM lexicon WHERE code=?;` + `SELECT ln,domain FROM word_domain WHERE strongs=?;`.
   State: the word chosen, the near-synonym(s) passed over, each one's sense, and the proximity `distance`
   (lower = closer, so a close synonym that was *not* chosen is the sharpest contrast).
3. **Type B — semantic-range spread.** Parse `detail.senses` + `total`. Present the collapsed meanings
   with their counts — the reader is seeing one of several senses this single word carries.
4. **Cite** the verse, the code, and the alternative codes' glosses.

## Worked examples

**Type A — John 21:15, ἀγαπάω `G0025`.**
`detail` = `{"nearSynonyms":[{"strongs":"G5368","distance":0.583}]}`. The text uses ἀγαπάω (LN 25.43);
the near-synonym φιλέω `G5368` (LN 25.103) — same domain 25 (love), different subdomain — was passed
over. English "love" collapses that choice. (φιλέω itself appears later in the same exchange, position 23.)

**Type B — ψυχή `G5590`.**
`detail` = `{"senses":[{"gloss":"soul","count":61},{"gloss":"life","count":36}],"total":106}`. One Greek
word rendered "soul" 61× and "life" 36× — the classic case where English must pick a side of a word that
holds both at once.
