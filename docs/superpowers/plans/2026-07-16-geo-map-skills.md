# Geo/Map Query Skills — Plan (deferred, data-blocked)

> **Status: NOT READY TO BUILD.** This plan is recorded now so the geo/map skills are authored in the
> same pass as the Map/Discover (Segment 2) data import. It is blocked on prerequisite data that is not
> yet in `bible.db`. Do not start until the "Prerequisite data" gate below is green.

**Goal:** Extend the DeepVerse query skills to the Map/Discover corpus so the developer can ask geographic
and journey questions here in Claude Code, grounded in the geodata.

**Architecture:** Same as the study-phase skills (`docs/superpowers/plans/2026-07-16-ai-query-skills.md`):
markdown `SKILL.md` files under `.claude/skills/`, querying `data/bible.db` via `sqlite3`, output to the
conversation. These reuse the `deepverse-data` foundation skill (schema, grounding rules, source/trust
map) — so most of the infrastructure already exists once the study-phase skills ship.

**Spec:** `docs/superpowers/specs/2026-07-16-ai-query-skills-design.md` §5.

## Prerequisite data (the gate — none of this exists in the DB yet)

- [ ] **OpenBible geocoding** (`ancient.jsonl`) imported — every identifiable biblical place with
      coordinates, confidence rating, Wikidata link. (CC BY 4.0; region polygons are ODbL — honor if used.)
- [ ] **DARE period map tiles** available as self-hosted PMTiles (for the app map; not required for the
      skills themselves, but they land in the same phase).
- [ ] *(optional)* PD dictionaries (Easton/ISBE/Smith) imported for place/entity enrichment.
- [ ] A geo table exists in `bible.db` (e.g. `places` keyed to verse refs / `chapter_entity` coords),
      with a documented schema. **Extend `deepverse-data`'s schema + source sections to cover it first.**

Note: `chapter_entity` already carries `latitude`/`longitude`/`feature_type`/`blurb`/`approx_year` for
place entities (Theographic) — a minimal `place-blurb` could be prototyped on that alone before the full
OpenBible import, if wanted.

## Skills to build (when the gate is green)

### `place-blurb`
A biblical place → a grounded "what happened here / why it matters" answer.
- Resolve the place (name → place id / coords).
- Pull the verses set at that place, its `chapter_entity.blurb`, and (if imported) its dictionary article.
- Answer from those sources only; cite refs; surface confidence/approximate-location caveats.

### `journey-narrator`
A route or journey (Paul's missionary journeys, the Exodus, the Exile) → a narrative threading the stops.
- Assemble the ordered places/events (Theographic events + place coords).
- Narrate the sequence grounded in the verse basis for each leg; cite refs.
- Do not invent legs or distances the data can't back.

### `period-culture`
Cultural context of a region in a given biblical period.
- Reuse `context-background`'s machinery, keyed by place + era instead of chapter.
- Grounded in dictionary/cultural articles + entity data; surface approximate-date caveats.

## When building

1. First extend `deepverse-data` (schema reference + source/trust map) to document the new geo tables and
   their licensing (OpenBible CC BY / ODbL polygons). Every geo skill references it.
2. Then author each skill with the same TDD-of-queries discipline as the study-phase plan: write the
   playbook queries, verify them against the real geo tables with concrete expected output, commit.
3. Re-run the study-phase plan's final gate style check with geo questions.
