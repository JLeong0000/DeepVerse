---
name: deepverse-data
description: Use when answering ANY question about the DeepVerse Bible corpus — words, passages, interpretive differences, cross-references, context, or stats. Documents the bible.db schema, how to query it, the Strong's-code and book-code conventions, source trust/licensing, and the anti-hallucination grounding rules. Load this before the topical DeepVerse skills (word-study, passage-study, interpretive-differences, context-background).
---

# Querying the DeepVerse corpus

DeepVerse's data lives in a single SQLite file. Answer questions by **querying it**, not by recalling
Bible facts — especially for Greek/Hebrew, where recall invents plausible-but-wrong lemmas and glosses.

## Connect & query

```bash
sqlite3 data/bible.db "SELECT ..."
```

Full DB is `data/bible.db` (the app ships a slimmed copy at `app/public/bible.db` — use the full one).
Output goes to this conversation. **Always cite `book ch:v`** for anything you assert.

## Grounding rules (non-negotiable)

1. Every claim is backed by a query you ran. If the data doesn't show it, don't say it.
2. Never assert a lemma, gloss, semantic domain, date, or etymology the DB can't back.
3. Cite references (`John 21:15`) and Strong's codes.
4. Surface caveats: NIV text is **1984**; `chapter_entity`/`chapter_context` dates are **approximate**
   and names can **collide** (Theographic). `chapter_recap` from `bible-summary` is **licensed (confirmed
   2026-07-17) — may be quoted/republished with attribution** (Chris Juby, biblesummary.info).

## Gotchas (verified — these will bite you)

- **Strong's codes are `G`/`H` + zero-padded to 4 digits.** `G0025`, not `G25`. A query for `G25`
  silently returns nothing.
- **Hebrew codes carry suffixes / multiples.** `H3039a`, `H0001G`, even `H0001G, H5703`. Don't assume a
  clean integer — match exactly, or `LIKE 'H0001%'` when you want a family.
- **`synonyms` pairs are unordered.** A code can be in `strongs_a` OR `strongs_b`. Query both.
- **Book codes are OSIS abbreviations** — `Gen`, `Exod`, `1Chr`, `Song`, `Matt`, `1Cor`, `Zeph`, `Rev`.
- **Naive gloss grouping misses synonym collapse.** `gloss_norm='love'` returns ἀγάπη/ἀγαπάω but NOT
  φιλέω (glossed "loving"/"dearly love"). The ἀγαπάω↔φιλέω contrast lives in `differences`/`synonyms` —
  that gap is the whole reason the differences engine exists.

## Schema (12 tables)

Everything joins on `(book, chapter, verse[, position])`, on `strongs`, or via `osis_ref`.

| Table | Grain | Columns of interest |
|---|---|---|
| `verses` | version+book+ch+v | `text` (NIV 1984 / NKJV / NLT 2015) |
| `words` | book+ch+v+position | `original, translit, gloss, gloss_norm, strongs, morph, lemma, lang` (`grc`/`hbo`/`arc`) |
| `lexicon` | `code` (Strong's) | `lemma, translit, gloss, definition` |
| `cross_refs` | from-ref → `to_ref` | `votes` (OpenBible, higher = stronger) |
| `word_domain` | `strongs` | `ln` (Louw-Nida code), `domain`, `frame` |
| `synonyms` | `strongs_a, strongs_b` | `distance` (0 = identical sense; higher = more distant) |
| `word_sense` | `strongs, sense_id` (LN code) | contextual `gloss` per occurrence |
| `differences` | book+ch+v+position | `type` A/B, `strongs`, `detail` (JSON) |
| `chapter_context` | book+ch | `osis_ref, writer, people_count, place_count` |
| `chapter_entity` | book+ch+type+id | `name, latitude, longitude, feature_type, blurb, approx_year, sort_verse` |
| `chapter_recap` | book+ch | `recap, source` (`bible-summary` = licensed, quotable w/ attribution; `editorial` = fallback) |
| `study_notes` | covering range | `ref, osis_ref, body, seq`; `start/end_chapter`, `start/end_verse` |

### `differences.detail` JSON shapes

- **Type A — synonym collapse:** `{"nearSynonyms":[{"strongs":"G5368","distance":0.583}]}` — this word
  was chosen over these near-synonyms. Look each up in `word_domain`/`lexicon` for the sense passed over.
- **Type B — semantic-range spread:** `{"senses":[{"gloss":"soul","count":61},{"gloss":"life","count":36}],"total":106}`
  — one original word rendered many ways; counts show the spread.

## Interpretation conventions

- **Type A** = multiple different original words → one English word (synonym collapse). **Type B** = one
  original word → multiple English meanings (semantic-range spread). Type B is the more valuable half.
- **Domains:** Louw-Nida for Greek, **SDBH** for Hebrew/Aramaic. Same field (`word_domain.ln`/`.domain`),
  different taxonomy — don't compare a Greek LN code to a Hebrew SDBH code.
- **`word_sense`** is the per-occurrence contextual sense (an LN code + the contextual gloss), not a
  summary of the lemma.

## Source / trust / license map

- `verses`, `words`, `lexicon`, `cross_refs` — STEPBible + OpenBible (CC BY). NIV=1984.
- `word_domain`, `synonyms`, `word_sense` — MACULA (Greek Louw-Nida; Hebrew/Aramaic SDBH).
- `chapter_context`, `chapter_entity` — Theographic (CC BY-SA). **Approximate dates; name collisions.**
- `study_notes` — Tyndale Open Study Notes (CC BY-SA), covering-range model (a note shows on every verse
  it spans).
- `chapter_recap` — `bible-summary` (Chris Juby) **licensed, confirmed 2026-07-17 — quotable with attribution**; `editorial` =
  hand-authored fallback.
- Deeper trust/licensing notes: `research/bible-context/source-trust.md`, `docs/ATTRIBUTIONS.md`.

## Query cookbook

```sql
-- Reverse concordance (English word → original lemmas). Naive gloss grouping misses
-- synonym-collapse pairs (see 'love') — use `differences`/`synonyms` for those.
SELECT strongs, lemma, gloss, count(*) c FROM words
WHERE gloss_norm='love' AND lang='grc' GROUP BY strongs ORDER BY c DESC;

-- Lexicon + semantic domain for a code (PAD IT: G0025, not G25)
SELECT l.lemma, l.translit, l.gloss, d.ln, d.domain
FROM lexicon l LEFT JOIN word_domain d ON d.strongs=l.code WHERE l.code='G0025';

-- Near-synonyms of a code (pairs unordered; lower distance = closer sense)
SELECT strongs_a, strongs_b, distance FROM synonyms
WHERE strongs_a='G0025' OR strongs_b='G0025' ORDER BY distance;

-- Which original language(s) a chapter contains
SELECT DISTINCT lang FROM words WHERE book='Dan' AND chapter=2;

-- Study notes covering a verse (covering/range model)
SELECT ref, body FROM study_notes
WHERE book='John' AND start_chapter<=21 AND end_chapter>=21
  AND start_verse<=15 AND end_verse>=15 ORDER BY seq;

-- Frequency of a code across the whole corpus (or add version join via words↔verses for a version)
SELECT count(*) FROM words WHERE strongs='G0025';
```

## Topical skills built on this

`word-study`, `passage-study`, `interpretive-differences`, `context-background`. They reference this
skill's schema, gotchas, and cookbook rather than repeating them.
