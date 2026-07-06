# DeepVerse — START HERE (handoff for the next agent)

You're picking up a personal Bible study app called **DeepVerse**. This session did the research,
built the data foundation, designed the whole product, and wrote the implementation plans. Read this,
then the spec, then the plans. Everything you need is on disk — no prior chat context required.

## What DeepVerse is

A personal, **offline-first, client-side PWA** for deep Bible study. Its reason to exist is the
**English ↔ original-language (Greek/Hebrew/Aramaic) comparison** — surfacing where the English hides a
distinction the original makes. Not a general reader; a study *workbench*. Personal use, local-first,
no accounts, no backend.

The signature feature is the **interpretive-difference engine**, and the key insight (proven against the
data) is that there are **two types** of difference:
- **Type A — synonym collapse:** multiple different original words → one English word (e.g. "love" ←
  ἀγαπάω / φιλέω in John 21:15-17).
- **Type B — semantic-range spread:** *one* original word → multiple English meanings, no synonym involved
  (e.g. ψυχή rendered "soul" 32× **and** "life" 31×). This half is the more valuable one and would be
  missed by a synonyms-only approach.

## Two segments (product scope)

1. **Study Bible workflow** — Home + split-screen Study mode + workbench. **This is Phase 1, fully designed.**
2. **Map / Discover workflow** — period-accurate map overlaid on the modern map. **Deferred (later segment).**

## Where everything lives

| What | Path |
|---|---|
| **Design spec** (read this after this file) | `docs/superpowers/specs/2026-07-05-study-bible-workflow-design.md` |
| **Feature/ideas tracker** (informal, full history of decisions) | `docs/FEATURES-AND-IDEAS.md` |
| **Plan 1 — bible.db v2 rebuild** (do this FIRST) | `docs/superpowers/plans/2026-07-05-bible-db-v2.md` |
| **Plan 2 — app Phase 1** | `docs/superpowers/plans/2026-07-05-app-phase1.md` |
| **Mockups** (open in a browser) | `docs/mockups/home.html`, `docs/mockups/study-mode.html`, `docs/mockups/difference-types.html` |
| **The data spine** (built v1; v2 is Plan 1) | `data/bible.db` (gitignored artifact) |
| **Compiled Bible text** (per-book JSON) | `data/bibles/{NIV,NKJV,NLT}/` |
| **Raw sources** (CC-BY, gitignored) | `sources/STEPBible-Data`, `sources/openbible`, `sources/macula-greek`, `sources/morphhb` |
| **Build scripts** | `build/` (Node, `node:sqlite`) |

## Current state (what's done)

- **Text data ✓** — NIV (1984), NKJV, NLT (current 2015) parsed to per-book JSON in `data/bibles/`.
  (NIV/NKJV/NLT were user-sourced PDFs; NLT current came from the free api.nlt.to. NIV is stuck at 1984 —
  the 2011 NIV is not freely licensable; don't chase it.)
- **bible.db v1 ✓** — `verses` (92,833), `words` (interlinear 425k), `lexicon` (23,746), `cross_refs`
  (344,799). Built by `build/build-db.mjs`.
- **MACULA Greek ✓ cloned** — has Louw-Nida domains + a Strong↔Strong synonym **proximity matrix**
  (`sources/macula-greek/sources/Clear/synonyms/Proximity.tsv`) spanning Greek/Hebrew/Aramaic.
- **Design ✓ complete** — Home + Study mode fully specced and mocked.
- **Two known data issues to fix in bible.db v2** (see Plan 1): a versification-notation parser bug drops
  Daniel 4 & 6 (and likely Psalm titles/Joel/Malachi/Hosea); and Aramaic is currently lumped into `hbo`.

## The design in one screen (see mockups + spec for detail)

- **Look:** "Scholarly print" — ink-on-paper, text serif for scripture, small-caps labels, apparatus-style
  accent inks (**A = oxblood, B = indigo**). **Light + dark** with an icon-only ☾/☀ switcher; dark is a
  **warm candlelit-manuscript** dark, not cold slate. (Chosen deliberately per unslop-ui — avoid shadcn
  defaults AND the cream+display-serif+sage "tasteful default".)
- **Home** (`docs/mockups/home.html`): full-width **"Welcome back, {name}"** (editable, randomized phrase);
  **50/50** top = Continue + Word-of-the-day card | Reading-activity contribution graph (ink/oxblood ramp,
  auto-tracked); **bottom** = editable **To-study** checklist (⅓, check-off→3s→archive→"View past items"
  modal) + **Recent notes** sticky-note grid (⅔); responsive to single-column mobile.
- **Study mode** (`docs/mockups/study-mode.html`): arrangeable split (Reader ↔ Workbench, L/R or top/bottom,
  swappable). Reader = paginated chapter + version selector + **in-text A/B underlines** (blue/purple,
  both = double underline). Workbench = stacked draggable cards with number **hotkeys**: **Differences**
  (Type A = comparison **buttons**, Type B = **inline** word — buttons only where there's a choice),
  **Original** interlinear (collapsed by default; read the whole verse, tap any word), **Context/cross-refs**,
  **Stats/word-selector**, **Notes**. Greek shows **pronunciation** (translit).
- **Difference types** (`docs/mockups/difference-types.html`): shows the A vs B rendering with real data.

## Architecture (decided)

Fully **client-side**: static bundle + `bible.db` (~31 MB gzipped) + **sql.js** (WASM SQLite) queried in
the browser; notes/prefs/activity in **IndexedDB + localStorage**; service worker for offline. Deploy
locally (`npm run dev` / installed PWA) or Cloudflare Pages. **No backend, no auth.** (Whole DB ships
client-side because features need whole-corpus queries: word counts over a version, cross-Bible
concordance, cross-refs.) OPFS/`wa-sqlite` is the mobile upgrade path.

## Phases / roadmap

- **Phase 1 (build now):** bible.db v2 (Plan 1) → the app: Home + Study mode, **data-driven, NO AI**,
  Scholarly-print light/dark. Comparison mode is a stub only. This is the whole of Plan 1 + Plan 2.
- **Phase 2 (later):** the **AI prose layer** — pre-generated + RAG-grounded + human-reviewed Claude
  explanations ("why the nuance matters"), and **Level-3 context** (book/timeline/culture — needs new
  data). Also **MACULA Hebrew** (via git-lfs) to extend the difference engine to the OT.
- **Segment 2 (later):** the **Map / Discover** workflow (OpenBible geocoding `ancient.jsonl` + DARE
  period map tiles as self-hosted PMTiles).

**AI note:** most of the app needs NO AI (pure SQL over bible.db). AI is only for prose. When added,
pre-generated Claude (grounded) is the plan; a lightweight local model is explicitly *not* recommended
(weak on Koine Greek). See spec §1 and the tracker.

## What to do next

1. Read the spec (`docs/superpowers/specs/2026-07-05-study-bible-workflow-design.md`).
2. Execute **Plan 1** (`docs/superpowers/plans/2026-07-05-bible-db-v2.md`) — rebuild `bible.db` v2. It has
   a validation gate; `npm run build` must exit 0.
3. Then execute **Plan 2** (`docs/superpowers/plans/2026-07-05-app-phase1.md`) — the app.
4. Before UI work, open the mockups in a browser to see the target.

> This project is **not a git repo yet** — running `git init` was offered and not yet done. Do it before
> the first commit (the plans assume git). `.gitignore` already excludes `sources/`, `node_modules/`,
> `data/*.db`, `.superpowers/`.
