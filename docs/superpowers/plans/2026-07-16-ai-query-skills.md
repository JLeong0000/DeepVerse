# DeepVerse AI Query Skills — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build 5 Claude Code project skills that let the developer query the DeepVerse corpus (`data/bible.db`) from Claude Code, answering word / passage / difference / context questions grounded entirely in the data.

**Architecture:** Skills are markdown `SKILL.md` files under `.claude/skills/`. A `deepverse-data` foundation skill documents the schema, connection, gotchas, source/trust map, grounding rules, and a query cookbook. Four topical skills (`word-study`, `passage-study`, `interpretive-differences`, `context-background`) reference the foundation and add a query playbook per question type. Query mechanism is the `sqlite3` CLI. Nothing runs in the app; output is the answer in the Claude Code conversation.

**Tech Stack:** Markdown skills (SKILL.md), `sqlite3` CLI over `data/bible.db`. No app code, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-16-ai-query-skills-design.md`

## Global Constraints

- **Ground every answer in a query.** Never assert a lemma, gloss, domain, date, or etymology the DB can't back. Cite `book ch:v`.
- **Strong's codes are `G`/`H` + zero-padded to 4 digits** (`G0025`, not `G25`). Hebrew codes may carry a letter suffix (`H3039a`) or be multi-valued (`H0001G, H5703`). Never assume a clean integer; match exactly or with `LIKE`.
- **Book codes are OSIS-style abbreviations** (`Gen`, `1Chr`, `Song`, `Matt`, `1Cor`, `Zeph`, `Rev`).
- **Versions:** `NIV` (1984 — surface this caveat), `NKJV`, `NLT` (2015).
- **`differences.detail` is JSON:** Type A = `{"nearSynonyms":[{"strongs","distance"}]}`; Type B = `{"senses":[{"gloss","count"}],"total"}`.
- **Domains:** Louw-Nida for Greek, **SDBH** for Hebrew/Aramaic (`word_domain.ln`, `.domain`).
- **`synonyms` stores pairs unordered** — query `WHERE strongs_a=? OR strongs_b=?`; lower `distance` = closer sense.
- **Surface source caveats:** `chapter_recap` from `bible-summary` is **licensing-pending, do not republish**; approximate dates and name collisions in `chapter_entity`/`chapter_context` (Theographic).
- **DB path is `data/bible.db`** (the full build; the app ships a slimmed copy — skills use the full one).

---

## File Structure

```
.claude/skills/
  deepverse-data/SKILL.md            foundation: schema, gotchas, sources, grounding, cookbook
  word-study/SKILL.md                word/Strong's/lemma questions
  passage-study/SKILL.md             reference → assembled study view
  interpretive-differences/SKILL.md  Type A/B explanation for a verse
  context-background/SKILL.md        chapter recap + who/where/what + study notes
```

Each topical skill's frontmatter `description` must state its trigger conditions so Claude auto-loads it. Each references `deepverse-data` for schema/gotchas rather than repeating them.

---

## Task 1: `deepverse-data` foundation skill

**Files:**
- Create: `.claude/skills/deepverse-data/SKILL.md`

**Interfaces:**
- Produces: the schema reference, gotchas, source/trust map, grounding rules, and query cookbook that Tasks 2–5 reference by name (e.g. "see deepverse-data → Cookbook → reverse concordance").

**SKILL.md must contain, in order:**
1. **Frontmatter** — `name: deepverse-data`; `description:` "Use when answering ANY question about the DeepVerse Bible corpus — words, passages, interpretive differences, cross-references, context, or stats. Documents the bible.db schema, how to query it, the Strong's-code and book-code conventions, source trust/licensing, and the anti-hallucination grounding rules. Load this before the topical DeepVerse skills."
2. **Connect & query** — `sqlite3 data/bible.db "…"`; output to conversation, always cite refs.
3. **Schema reference** — the 12 tables (copy from spec §3), with the `differences.detail` JSON shapes.
4. **Gotchas** (the verified traps) — zero-padded Strong's; Hebrew suffix/multi codes; unordered `synonyms`; OSIS book codes; NIV=1984; the "love case" (naive gloss grouping misses ἀγαπάω/φιλέω — you need `differences`).
5. **Interpretation conventions** — Type A vs B; LN (Greek) vs SDBH (Hebrew/Aramaic); proximity distance; `word_sense` = per-occurrence contextual sense, not a lemma summary.
6. **Source / trust / license map** — STEPBible & OpenBible (CC BY); MACULA domains/proximity; Theographic (CC BY-SA, name-collision + approximate-date caveats); Tyndale study notes (CC BY-SA); Bible Summary recaps (**licensing pending**). Point to `research/bible-context/source-trust.md`.
7. **Grounding rules** — the Global Constraints, restated as the skill's law.
8. **Query cookbook** — the verified queries below, each with a one-line purpose.

- [ ] **Step 1: Write the SKILL.md** with the sections above. Embed these verified cookbook queries verbatim:

```sql
-- Reverse concordance (English word → original lemmas). NOTE: naive gloss grouping
-- misses synonym-collapse pairs (see 'love' — use differences for those).
SELECT strongs, lemma, gloss, count(*) c FROM words
WHERE gloss_norm='love' AND lang='grc' GROUP BY strongs ORDER BY c DESC;

-- Lexicon + semantic domain for a code (MIND the padding: G0025 not G25)
SELECT l.lemma, l.translit, l.gloss, d.ln, d.domain
FROM lexicon l LEFT JOIN word_domain d ON d.strongs=l.code WHERE l.code='G0025';

-- Near-synonyms of a code (pairs are unordered; lower distance = closer)
SELECT strongs_a, strongs_b, distance FROM synonyms
WHERE strongs_a='G0025' OR strongs_b='G0025' ORDER BY distance;

-- Chapter language auto-detect
SELECT DISTINCT lang FROM words WHERE book='Dan' AND chapter=2;

-- Study notes covering a verse (range/covering model)
SELECT ref, body FROM study_notes
WHERE book='John' AND start_chapter<=21 AND end_chapter>=21
  AND start_verse<=15 AND end_verse>=15 ORDER BY seq;
```

- [ ] **Step 2: Verify the cookbook queries run and return expected output**

Run each query via `sqlite3 data/bible.db "…"`. Expected anchors:
- reverse concordance `love`/grc → `G0026 ἀγάπη 110`, `G0025 ἀγαπάω 12`.
- lexicon+domain `G0025` → `ἀγαπάω | agapaō | to love | 25.43 | 025003`.
- synonyms `G0025` → includes `G0026 … 0.394` (closest) and `G5368 … 0.583` (phileō).
- Daniel 2 language → `hbo` and `arc` (both).
- study notes John 21:15 → rows `21:1-25`, `21:15-17`, `21:15`.

Expected: all five return the anchors above. If any differs, fix the query in the SKILL.md to match the DB.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/deepverse-data/SKILL.md
git commit -m "feat(skills): deepverse-data foundation skill for querying bible.db"
```

---

## Task 2: `word-study` skill

**Files:**
- Create: `.claude/skills/word-study/SKILL.md`

**Interfaces:**
- Consumes: deepverse-data (schema, padding gotcha, cookbook).
- Produces: a word-study playbook other skills may reference for lemma resolution.

- [ ] **Step 1: Write the SKILL.md**

Frontmatter `description:` "Use when the user asks about a specific word, its meaning across the Bible, a Strong's number, or a Hebrew/Greek lemma — reverse concordance, glosses, semantic domain, near-synonyms, and Type A/B differences. Builds on deepverse-data." Body = a numbered playbook:
1. Resolve the target to Strong's code(s): from English via `gloss_norm`, or accept a `G####`/`H####` directly (apply padding).
2. Reverse concordance: `SELECT book,chapter,verse FROM words WHERE strongs=? ` (+ counts by version if asked).
3. Meaning: `lexicon` definition + `word_domain` LN/SDBH domain + `frame`.
4. Near-synonyms: `synonyms` (unordered pair query), report distances; flag the closest.
5. Differences: does this code appear in `differences` (Type A and/or B)? Summarize its `detail`.
6. Always cite the codes and a few example refs; never state a sense the data doesn't show.

Include a worked example in the skill: **"love" (Greek)** → G0026/G0025 from concordance; note φιλέω G5368 is *not* caught by `gloss_norm='love'` (glossed "loving"/"dearly love") — the ἀγαπάω/φιλέω contrast lives in `differences`/`synonyms` (distance 0.583), which is the whole reason the differences engine exists.

- [ ] **Step 2: Verify the worked example**

Run the concordance + synonyms + differences queries for G0025/G5368. Expected: concordance returns John 21 refs; `synonyms` gives G0025↔G5368 distance ≈0.583; `differences` has A rows for both at John 21:15 positions 12 & 23.

Expected: matches. If not, correct the playbook queries.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/word-study/SKILL.md
git commit -m "feat(skills): word-study skill"
```

---

## Task 3: `passage-study` skill

**Files:**
- Create: `.claude/skills/passage-study/SKILL.md`

**Interfaces:**
- Consumes: deepverse-data; word-study (for drilling into a word).

- [ ] **Step 1: Write the SKILL.md**

Frontmatter `description:` "Use when the user asks to study, explain, or break down a specific passage or reference (verse, verse range, or chapter) — assembles the English text across versions, the interlinear, interpretive differences, cross-references, study notes, and chapter context in one grounded answer. Builds on deepverse-data." Body = playbook:
1. Parse the reference to `book, chapter, verse(s)` (OSIS book codes).
2. Text: `SELECT version,text FROM verses WHERE book=? AND chapter=? AND verse=?` (all 3 versions).
3. Interlinear: `SELECT position,original,translit,gloss,strongs,lemma FROM words WHERE book=? AND chapter=? AND verse=? ORDER BY position`.
4. Differences on the ref (defer detail to interpretive-differences skill for depth).
5. Cross-refs: `SELECT to_ref,votes FROM cross_refs WHERE from_book=? AND from_chapter=? AND from_verse=? ORDER BY votes DESC LIMIT 10`.
6. Study notes covering the ref (cookbook covering query).
7. Chapter context/recap (from context-background) if the user wants the wider frame.
Present as a structured brief, each section cited.

- [ ] **Step 2: Verify against John 21:15**

Run steps 2–6 for `John 21:15`. Expected: 3 version rows; interlinear with ἀγαπᾷς at position 12 (strongs G0025); differences rows present; cross_refs return ordered by votes; study notes return the 3 covering rows.

Expected: matches. Fix any query that doesn't.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/passage-study/SKILL.md
git commit -m "feat(skills): passage-study skill"
```

---

## Task 4: `interpretive-differences` skill

**Files:**
- Create: `.claude/skills/interpretive-differences/SKILL.md`

**Interfaces:**
- Consumes: deepverse-data (differences.detail shapes, padding), word-study.

- [ ] **Step 1: Write the SKILL.md**

Frontmatter `description:` "Use when the user asks what nuance or distinction a translation hides, why one English word stands for different original words, or why a word is translated a certain way — explains Type A (synonym collapse) and Type B (semantic-range spread) differences for a verse, grounded in the differences table. Builds on deepverse-data." Body = playbook:
1. Pull `differences` rows for the ref: `SELECT position,type,strongs,detail FROM differences WHERE book=? AND chapter=? AND verse=?`.
2. For **Type A**: parse `detail.nearSynonyms`; for each, look up lemma/gloss/domain in `lexicon`+`word_domain`; state the sense that was passed over and the proximity distance.
3. For **Type B**: parse `detail.senses`; present the spread with counts and `total`; name the meanings collapsed.
4. Frame with the house philosophy (verbatim): *a faithful rendering must choose one sense of a rich word and hide the alternatives — surfacing that choice is the point, not "the translation is wrong."*
5. Cite the code, verse, and the alternative codes' glosses.

Worked examples embedded: **A** — John 21:15 ἀγαπάω (G0025) chosen over φιλέω (G5368), distance 0.583, both in domain 25 (love) but different LN subdomains (25.43 vs 25.103). **B** — ψυχή (G5590): soul 61× / life 36×, total 106.

- [ ] **Step 2: Verify both examples**

Run the differences query for John 21:15 and the psyche B row. Expected A: position 12 `A G0025 nearSynonyms G5368 0.583`. Expected B: `G5590 {"senses":[{"soul",61},{"life",36}],"total":106}`. Cross-check G5368/G0025 domains (25.103 / 25.43).

Expected: matches. Fix parsing if not.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/interpretive-differences/SKILL.md
git commit -m "feat(skills): interpretive-differences skill"
```

---

## Task 5: `context-background` skill

**Files:**
- Create: `.claude/skills/context-background/SKILL.md`

**Interfaces:**
- Consumes: deepverse-data (source caveats, licensing).

- [ ] **Step 1: Write the SKILL.md**

Frontmatter `description:` "Use when the user asks for the background, context, setting, or the people/places/events of a chapter — assembles the chapter recap, writer, entity roll-up (people, places with coords, events, groups), and Tyndale study notes, with source and licensing caveats. Builds on deepverse-data." Body = playbook:
1. Recap: `SELECT recap,source FROM chapter_recap WHERE book=? AND chapter=?` — **if `source='bible-summary'`, note it is licensing-pending and must not be republished**.
2. Chapter frame: `SELECT writer,people_count,place_count FROM chapter_context WHERE book=? AND chapter=?`.
3. Entities: `SELECT entity_type,name,latitude,longitude,blurb,approx_year FROM chapter_entity WHERE book=? AND chapter=? ORDER BY sort_verse` — surface name-collision + approximate-date caveats.
4. Study notes for the chapter (covering query, chapter-level).
5. Never invent cultural claims not in a blurb/note/recap.

- [ ] **Step 2: Verify against a real chapter**

Run steps 1–4 for `Gen 1` (and `John 21` for notes). Expected: `chapter_recap` returns one row with a `source`; `chapter_context` returns writer/counts; `chapter_entity` returns rows (or none) with the documented columns; study notes covering query returns rows.

Expected: queries return the documented columns without error. Adjust to the real column set if any query fails.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/context-background/SKILL.md
git commit -m "feat(skills): context-background skill"
```

---

## Self-Review

- **Spec coverage:** foundation (Task 1) ✓; word-study (2) ✓; passage-study (3) ✓; interpretive-differences (4) ✓; context-background (5) ✓; geo/map skills → separate plan (out of scope here, per spec §5/§6) ✓.
- **Placeholder scan:** every task has concrete SQL + verified expected output; no TBD/TODO.
- **Type consistency:** Strong's padding (`G0025`), OSIS book codes, `differences.detail` JSON keys (`nearSynonyms`/`senses`), and table/column names match the real schema throughout.

## Final gate

- [ ] After all 5 tasks: from a fresh Claude Code prompt, ask one question per skill (e.g. "study John 21:15", "what does ψυχή mean", "what nuance is hidden in John 21:15's 'love'", "background on Genesis 1") and confirm each answer is query-backed with correct refs and surfaces caveats where relevant.
