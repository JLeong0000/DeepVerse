# Source Trust & Dependability Assessment — Context-tab data

**Date:** 2026-07-15
**Question:** How dependable / trustworthy are the datasets we plan to port for the Context tab, and how should that shape how we present them?

## Core principle: trust depends on the KIND of claim, not just the source

Everything splits into two categories with very different reliability:

- **Structural / text-derived data** — *which* people, places, groups are named in a chapter; cross-references; verse text. Derived mechanically from Scripture itself → **highly dependable** regardless of source. This is the backbone of the Context tab.
- **Interpretive / historical / chronological data** — dates, "customs," place *identifications*, cultural background. Scholarship layered on top of the text → reliability ranges from excellent to century-outdated to undocumented.

## Per-source assessment

| Source | Role | Trust | Caveat |
|---|---|---|---|
| **OpenBible.info** geodata | Geography | **High** | Stephen Smith, since 2006; 70+ sources, 400+ citations; explicit **per-place confidence score**. Transparent about disputed sites — gate display on confidence. [methodology](https://www.openbible.info/blog/2021/11/rethinking-the-bible-atlas/) |
| **Tyndale Open** (TOSN + dictionary) | Cultural/thematic background | **High** | Professionally edited, reputable publisher (Life Application / NLT Study Bible lineage). Confirmed **CC BY-SA 4.0** (commercial OK). Evangelical/conservative perspective — disclose. Best "custom was Y" source. [details](https://freely-given.org/OBD/TOSN/details.htm) |
| **Theographic** | Backbone (who/where/what per chapter) | **Mixed** | Solid for entity↔chapter links (text-derived, peer-used). **Dates are weak** — see below. Solo project (Robert Rouse); "verified against scholarly sources" is a self-claim, not an external audit. |
| **PD dictionaries** (Easton's 1897, ISBE 1915, Smith's 1863, Hitchcock's 1869) | Entity definitions | **Medium** | Reliable for word meanings / traditional facts, but **100–160 years old** — outdated on archaeology, ANE history, dating; Victorian assumptions. Good for "who/what is X"; not a modern history authority. |
| **Matthew Henry / PD commentary** (chapter recap) | Recap | **Medium — good content, needs QA** | 300-year-old Puritan/Reformed homiletics. Recaps are accurate & well-structured where aligned, but the HelloAO packaging is **incomplete (65/66 books — no Song of Solomon; 1,167/1,189 chapters)** and has **≥1 confirmed misaligned recap (Ruth 1 = 3 John)**. Usable with a validation pass + gap fallback + labeling. Full evaluation: [matthew-henry-recap-eval.md](matthew-henry-recap-eval.md). |
| **HelloAO / Free Use API** | Delivery layer | **Inherits upstream** | Aggregator; adds no authority. Verify each bundled dataset's provenance independently. |

## The one real weak spot: Theographic's chronology

Excellent as a structural backbone, but its DATES are its weakest layer — by its own documentation ([data-field docs](https://github.com/robertrouse/theographic-bible-metadata/blob/master/docs/json-fields-documentation.md)):

- **Verse years** from *Torrey's Treasury of Scripture Knowledge* (PD, traditional chronology), flagged **"not aligned with the events table."**
- **People birth/death years** are **"estimated," no source cited**, status "Populated" (incomplete), not "Validated." (A sample birth year of −4003 = 4004 BC → Ussher-style traditional anchor.)
- **Events dates** marked **"Incomplete."**

→ Use Theographic freely for *who/where/what appears in this chapter*; treat BC/AD **dates as approximate/traditional, not authoritative** — omit, round hard, or label.

## Impact on the "nation X, custom was Y" cards

- **"nation X"** (place layer) is **well-grounded** — OpenBible + Theographic places, with confidence scores.
- **"custom was Y"** (cultural layer) is trustworthy from **Tyndale**, dated from the **PD dictionaries** → prefer TOSN for cultural claims, source-tag the rest.

## Recommendations to keep the tab trustworthy

1. **Source-tag and date every card** ("Tyndale Open Study Notes" / "Easton's Bible Dictionary, 1897"). Also satisfies CC BY-SA attribution.
2. **Gate geographic identifications on OpenBible confidence** — don't present a debated site as settled.
3. **Handle dates conservatively** — Theographic's weakest layer; label or omit precise years.
4. **Keep interpretation visibly interpretive** — recap (Matthew Henry) + cultural notes are perspectives, not neutral fact.
5. **Lead with the strong, text-derived layer** (who/where/what per chapter) — most defensible, most distinctive, inherits none of the dating/era caveats.

**Net:** structure is dependable, geography is excellent and self-rating, cultural notes are as good as their (disclosed) source, and dates are the thing to be careful with. Nothing is untrustworthy to *display* — but several layers must be presented as sourced, dated, and interpretive rather than as fact.
