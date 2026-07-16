# Bible-context research (reference for the unbuilt context/cultural + geo layers)

Source research behind DeepVerse's Context tab and the still-unbuilt context/cultural and geo/map
features. The Context tab shipped only a **slice** of what's below (Theographic who/where/what, per-chapter
recap, Tyndale **study notes**); the rest is validated but **not yet imported**. Keep this folder as the
map for that remaining work.

## What's here

| File | What it is | Status for future dev |
|---|---|---|
| **`synthesis.md`** | Master synthesis — every open Bible-context resource, ranked build order, licensing verdicts, the "nation X / custom Y" narrative-card gap | **Live** — the roadmap. Start here. |
| **`source-trust.md`** | Per-source trust + licensing map | **Live** — also linked by the `deepverse-data` skill |
| **`tyndale-validation.md`** | Hands-on validation of the full Tyndale Open set | **Live** — only `StudyNotes` imported; **ThemeNotes (299), BookIntroSummaries, BookIntros, and the Tyndale Open Bible Dictionary are validated but NOT imported** |
| **`references-distributions.md`** | PD dictionaries/encyclopedias + ready-to-use distributions | **Live** — PD dictionary import is unbuilt |
| **`background-data.md`** | Cultural/historical/geographic knowledge graphs (Theographic, OpenBible, timeline) | **Live** — geo + timeline layers unbuilt |
| **`commentaries.md`** | Open commentaries + chapter/book summaries | **Live** — book-intro/synopsis sources unbuilt |

## What shipped vs. what remains (as of 2026-07-16)

**Shipped** (in `bible.db`): `chapter_context` + `chapter_entity` (Theographic who/where/what),
`chapter_recap` (Bible Summary + editorial fallback), `study_notes` (Tyndale study notes).

**Remaining** (this research is the reference for it): Tyndale theme articles, book intros, and the
Tyndale Open Bible Dictionary; PD dictionaries (Easton/ISBE/Smith/Hitchcock) for entity enrichment;
timeline/chronology; OpenBible confidence-gated geography (→ Map/Discover phase); the generated
"nation X / custom Y" narrative cards (synthesis §6 gap).

## Related planning docs

- `docs/superpowers/specs/2026-07-15-tyndale-study-notes-display-design.md` — the shipped study-notes slice
- `docs/superpowers/plans/2026-07-16-geo-map-skills.md` — geo/map query skills (data-blocked; uses `background-data.md`)
- `docs/FEATURES-AND-IDEAS.md` — the tracker's "Roadmap remaining for the context/cultural layer" line
