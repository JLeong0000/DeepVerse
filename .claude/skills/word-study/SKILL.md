---
name: word-study
description: Use when the user asks about a specific word, its meaning across the Bible, a Strong's number, or a Hebrew/Greek lemma — reverse concordance, glosses, semantic domain, near-synonyms, and Type A/B differences. Builds on the deepverse-data skill.
---

# Word study over the DeepVerse corpus

Load `deepverse-data` first (schema, the Strong's zero-padding gotcha, the cookbook). Query `data/bible.db`.

## Playbook

1. **Resolve to Strong's code(s).**
   - From English: `SELECT strongs, lemma, gloss, count(*) c FROM words WHERE gloss_norm=? GROUP BY strongs ORDER BY c DESC;` (add `AND lang='grc'|'hbo'|'arc'` to scope).
   - From a code the user gives: **pad it** — `G25` → `G0025`, `H157` → `H0157`. Hebrew may have a letter suffix (`H3039a`).
2. **Reverse concordance:** `SELECT book,chapter,verse FROM words WHERE strongs=? ORDER BY book,chapter,verse;` — give the count and a few representative refs, not the whole dump unless asked.
3. **Meaning:** `SELECT lemma,translit,gloss,definition FROM lexicon WHERE code=?;` + `SELECT ln,domain,frame FROM word_domain WHERE strongs=?;` (Louw-Nida for Greek, SDBH for Hebrew/Aramaic).
4. **Near-synonyms:** `SELECT strongs_a,strongs_b,distance FROM synonyms WHERE strongs_a=? OR strongs_b=? ORDER BY distance;` — report the closest few with their lemmas; lower distance = closer.
5. **Differences:** does the code appear in `differences`? `SELECT DISTINCT type,detail FROM differences WHERE strongs=?;` — summarize Type A (chosen over near-synonyms) and Type B (sense spread).
6. **Cite** the code(s) and example refs. Never state a sense the data doesn't show.

## Worked example — "love" (Greek)

- Concordance `gloss_norm='love' AND lang='grc'` → `G0026 ἀγάπη` (110×), `G0025 ἀγαπάω` (12×).
- **φιλέω `G5368` does NOT appear** under `gloss_norm='love'` (it's glossed "loving" / "dearly love").
  The ἀγαπάω↔φιλέω contrast surfaces via `synonyms` (`G0025`↔`G5368`, distance ≈ 0.583) and the
  `differences` engine — this is exactly the case naive gloss grouping misses, and why word study here
  must go through `differences`/`synonyms`, not just glosses.
- Domains: `G0025` → LN `25.43`; `G5368` → LN `25.103` — same domain 25 (love), different subdomain.
