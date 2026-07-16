# DeepVerse AI Query Skills — design

**Date:** 2026-07-16
**Status:** design (approved shape; pending spec review)
**Supersedes the framing in:** memory `ai-feature-direction`, START-HERE "Phase 2 — AI prose layer"

## 1. What this is (and what it is NOT)

The DeepVerse "AI phase" is **not** an in-app feature. The app stays exactly as it is:
pure, data-driven, offline, `$0`, no chat UI, no backend, no API calls.

Instead, the AI layer is a set of **Claude Code project skills** that let the *developer/user*
query the DeepVerse corpus **here, in Claude Code**. You ask a question; Claude loads the relevant
skill(s), queries `data/bible.db` (and future data as it lands), and answers **in the conversation**.
Nothing is generated into the app, stored, reviewed, or shipped. The "output" of a skill is the answer
you read here.

This replaces both earlier candidate directions: the local-model idea (dropped) and the
"pre-generate prose, bake it into `bible.db`" idea (also dropped — there is no in-app consumer for it).

### Why skills at all (vs. just asking Claude directly)

The hallucination risk on Koine Greek / Biblical Hebrew is real — it is exactly the register where a
model invents plausible-but-wrong lemmas, glosses, and etymologies. The skills exist to force the
opposite discipline: **answer from a query against the data, cite the reference, never recall a
language fact.** They encode the schema, the exact query patterns, the source/trust map, and the
interpretation conventions (Type A/B, Louw-Nida vs SDBH domains, proximity) so that querying the
corpus is reliable and repeatable instead of improvised each time.

## 2. Where the skills live

Claude Code **project** skills, in-repo so they travel with DeepVerse:

```
.claude/skills/
  deepverse-data/           SKILL.md   (foundation — loaded for essentially any DeepVerse query)
  word-study/               SKILL.md
  passage-study/            SKILL.md
  interpretive-differences/ SKILL.md
  context-background/       SKILL.md
```

Query mechanism is the `sqlite3` CLI already on the machine (`sqlite3 data/bible.db "…"`) — no new
dependencies. Topical skills reference the foundation skill rather than repeating the schema.

## 3. The data the skills query (real schema, `data/bible.db`)

12 tables. Everything joins on `(book, chapter, verse[, position])`, on `strongs`, or via `osis_ref`.
Book codes are OSIS-style abbreviations (`Gen`, `1Chr`, `Song`, `Matt`, `1Cor`, `Zeph`, `Rev`).
Versions: `NIV` (1984 — see caveats), `NKJV`, `NLT` (2015).

| Table | Grain | What it gives |
|---|---|---|
| `verses` (93,135) | version+book+ch+v | English text ×3 versions |
| `words` (447,323) | book+ch+v+position | interlinear: `original, translit, gloss, gloss_norm, strongs, morph, lemma, lang` (`grc`/`hbo`/`arc`) |
| `lexicon` (23,746) | `code` (Strong's) | `lemma, translit, gloss, definition` |
| `cross_refs` (344,799) | from-ref → `to_ref` | OpenBible, `votes`-ranked |
| `word_domain` | `strongs` | MACULA semantic domain: `ln` (Louw-Nida), `domain`, `frame` |
| `synonyms` | `strongs_a, strongs_b` | proximity `distance` (0 = identical sense; higher = more distant). Greek+Hebrew+Aramaic |
| `word_sense` | `strongs`, `sense_id` (LN code) | per-occurrence contextual sense + contextual gloss |
| `differences` (205,548) | book+ch+v+position | `type` A/B, `strongs`, `detail` (JSON — see below) |
| `chapter_context` | book+ch | `osis_ref, writer, people_count, place_count` (Theographic) |
| `chapter_entity` | book+ch+type+id | people/places/events/groups: `name, latitude, longitude, feature_type, blurb, approx_year` |
| `chapter_recap` (1,189) | book+ch | one-paragraph `recap` + `source` (`bible-summary` licensing-pending; `editorial` fallback) |
| `study_notes` (16,913) | covering range | Tyndale notes: `ref, osis_ref, body, seq`, covering `start/end chapter/verse` |

### `differences.detail` JSON shape (the signature feature)

- **Type A — synonym collapse:** `{"nearSynonyms":[{"strongs":"G1076","distance":0.561}, …]}`
  → the word at this position was chosen over these near-synonyms; look each up in `word_domain` /
  `lexicon` to say what sense the alternative would have carried.
- **Type B — semantic-range spread:** `{"senses":[{"gloss":"begat","count":41},{"gloss":"born","count":40}, …],"total":97}`
  → one original word rendered many ways; the counts show the spread (the ψυχή soul/life case).

## 4. The five skills

### 4.0 `deepverse-data` (foundation)

The base every query relies on. Contents:

- **Connect & query:** `sqlite3 data/bible.db "…"`; the join keys; book-code convention; version notes.
- **Schema reference:** the table above, with column meanings and the `differences.detail` JSON shapes.
- **Interpretation conventions:** Type A vs B; Louw-Nida (Greek) vs **SDBH** (Hebrew/Aramaic) domains;
  proximity `distance` semantics; `word_sense` = per-occurrence sense, not a lemma summary.
- **Source / trust / license map:** which table came from where and how far to trust it — STEPBible &
  OpenBible (CC BY), MACULA domains/proximity, Theographic (CC BY-SA, name-collision + approximate-date
  caveats), Tyndale study notes (CC BY-SA), Bible Summary recaps (**licensing pending — do not
  republish**). Points to `research/bible-context/source-trust.md`.
- **Grounding rules (non-negotiable):** answer from a query; cite `book ch:v`; never assert a lemma,
  gloss, domain, date, or etymology the DB can't back; surface caveats (NIV=1984; approximate dates;
  name collisions; recap licensing).
- **Query cookbook:** reverse concordance; per-verse & per-chapter assembly; chapter language
  auto-detect (`SELECT DISTINCT lang FROM words WHERE book=? AND chapter=?`); frequency across a
  version / whole corpus; cross-ref pull by votes.

### 4.1 `word-study`
English word or Strong's/lemma → resolve the lemma(s); reverse concordance (every verse it appears in);
gloss variety; `word_domain` (LN/SDBH domain + frame); near-synonyms via `synonyms` (with distances);
Type A/B involvement; frequency by version and whole-corpus.

### 4.2 `passage-study`
A reference → assembled study view: text ×3 versions (`verses`) + interlinear (`words`) + differences
on that ref + `cross_refs` (top by votes) + `study_notes` covering it + the chapter's `chapter_recap`
and `chapter_context`. One coherent answer, each part cited.

### 4.3 `interpretive-differences`
"What distinction does <word> in <verse> hide?" / "why X and not Y?" → pull `differences` rows for the
ref; parse `detail`; for **A**, look up each near-synonym's lemma/gloss/domain and state the sense that
was passed over (+ the proximity distance); for **B**, present the sense spread with counts. Framed by
the house philosophy: *a faithful rendering must choose one sense of a rich word and hide the
alternatives — surfacing that choice is the point, not "the translation is wrong."*

### 4.4 `context-background`
"Background / who / where / what on <chapter>" → `chapter_recap` (with source + licensing note) +
`chapter_context` (writer, counts) + `chapter_entity` (people/places w/ coords, events, groups, blurbs,
approximate years) + `study_notes` for the chapter. Caveats surfaced: approximate dates, name
collisions, recap licensing.

## 5. Segment 2 (Geo/Map) — skills to build then, noted now

To be authored **in the Map/Discover phase**, once its data lands (OpenBible geocoding `ancient.jsonl`,
DARE period tiles, and any PD dictionaries). They reuse the same foundation (schema, grounding rules,
source map), so the map phase inherits the querying infrastructure for free:

- **`place-blurb`** — a biblical place → grounded "what happened here / why it matters" from the verses
  set there + its `chapter_entity` blurb + (future) dictionary article.
- **`journey-narrator`** — a route/journey (Paul's journeys, the Exodus, the Exile) → narrative
  threading the stops, grounded in Theographic events + `chapter_entity` places/coords.
- **`period-culture`** — cultural context of a region in a given biblical period; reuses
  `context-background`'s machinery keyed by place+era instead of chapter.

**Prerequisite data (blocks these):** OpenBible geocoding + DARE tiles imported into the DB; optionally
PD dictionaries (Easton/ISBE/Smith) for entity enrichment. This list is to be copied into the geo/map
phase plan when it is written.

## 6. Out of scope

- No in-app chat, assistant, or serverless proxy. No API cost. No content baked into `bible.db`.
- No local model. No batch pre-generation / review-gate pipeline (there is no in-app consumer).
- Geo/map skills are documented here but **not built** in this phase.

## 7. Success criteria

1. Asking a word / passage / difference / context question here yields an answer that is **entirely
   backed by queries** shown or citable, with correct `book ch:v` references.
2. The foundation skill alone lets Claude query any of the 12 tables correctly (right joins, right book
   codes, right `differences.detail` parsing) without guessing.
3. No answer asserts a Greek/Hebrew fact the DB can't back; caveats (NIV=1984, approximate dates, recap
   licensing) surface when relevant.
4. Adding a new data source later = extend the foundation skill's schema/source sections; topical skills
   keep working.
