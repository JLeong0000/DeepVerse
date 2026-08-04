# DeepVerse — Data Pipeline

How data gets into DeepVerse, and the rule you must follow whenever you add a new data source.

## Two kinds of data

1. **Shared corpus** — everything in `bible.db` (verses, interlinear words, lexicon, cross-refs,
   interpretive differences, chapter context/entities, recaps, study notes, and the Tyndale
   dictionary layer: `dict_articles`, `dict_verse`, `dict_xref`, `tyndale_passages`, `book_intros`).
   Read-only, identical for everyone, produced by the build.
2. **Per-user data** — notes/memos, reading activity, the to-study list, prefs. Lives in the browser's
   **IndexedDB + localStorage**, created per-device at runtime. **It is never in the repo, never in the
   build, and never in `bible.db`.** The build deliberately produces none of it; each person's copy is
   their own.

Everything below is about the shared corpus only.

## What the build reads (all committed — a fresh clone can build offline)

| Input | Path | Tracked? |
|---|---|---|
| Bible text (verses) | `data/bibles/{NIV,NKJV,NLT}/*.json` | ✅ committed |
| Parsed source intermediates | `build/data/sources/*.json.gz` | ✅ committed (~20 MB) |
| Recaps, study notes | `build/data/*.json` | ✅ committed |
| **Raw original corpora** | `backup-data/` | ❌ **gitignored — local backup only** |

`backup-data/` (STEPBible, macula-greek/hebrew, openbible, theographic, tyndale, ebible, licensed
Bibles…) is **~2.8 GB** of raw CC-BY/CC-BY-SA/public-domain source. It is **not** needed to build —
only to *re-derive* an intermediate when a source changes. Keep it as a personal backup; it never
goes into git, and it is not recoverable if deleted, so never rename, move or delete it.

## The flow

```
                  ┌─ extract-sources.mjs ─────┐
backup-data/  ────┼─ parse-tyndale.mjs ───────┼──▶  build/data/sources/*.json.gz  (committed)
 (maintainer      └─ extract-apocrypha.mjs ───┘                       │
  only)                                                              │
   data/bibles/ + build/data/*.json  ────────────────────────────────┤
                                                                     ▼
                                                    build-db.mjs  ──▶  data/bible.db
                                                                     │
                                                    app copy-assets ──▶ app/public/bible.db (slimmed)
```

**Three maintainer-only extractors** write into `build/data/sources/`. Each needs `backup-data/`,
each exits with a clear message if it is absent, and none is part of `npm run build`:

| Script | Reads | Writes |
|---|---|---|
| `build/extract-sources.mjs` | STEPBible, macula-greek/hebrew, openbible, theographic | `words`, `lexicon`, `synonyms`, `word_sense`, `word_domain`, `cross_refs`, `chapter_context`, `chapter_entity` `.json.gz` |
| `build/parse-tyndale.mjs` | `backup-data/tyndale/` | `tyndale-dictionary.json.gz`, `tyndale-passages.json.gz`, `tyndale-bookintros.json.gz` |
| `build/extract-apocrypha.mjs` | `backup-data/ebible/eng-kjv_vpl.zip` | `apocrypha.json.gz` |

- **`build/build-db.mjs`** — builds `data/bible.db` from committed inputs only; it never reads
  `backup-data/`. `differences` and `dict_xref` are *computed* here, never vendored.
- **`install.sh`** (repo root) — fresh-clone setup: build the DB from intermediates, then install app deps.
  Then `./start.sh`.
- **`npm run build`** in `build/` is exactly `build-db.mjs && validate-db.mjs`. Nothing else.

## ⚠️ REQUIRED when you add a new data source

**Whenever you import a new dataset and the feature is done, you MUST complete all of these before it's
considered shipped — otherwise a fresh clone can no longer rebuild `bible.db`:**

1. **Extract & store.** Add the source's parsing to `build/extract-sources.mjs`, or write a new
   maintainer-only extractor beside it if the source is big enough to deserve its own (that is why
   `parse-tyndale.mjs` and `extract-apocrypha.mjs` are separate scripts). A new extractor must:
   guard on its input existing and exit with a message naming the missing path; read only from
   `backup-data/`; write only `.json.gz` into `build/data/sources/`; and carry its licence and
   provenance in a header comment. For already-parsed data, a committed JSON in `build/data/` is
   fine. Run the extract so the intermediate lands in `build/data/sources/` — and **commit it.**
2. **Wire the build.** Update `build/build-db.mjs` to create the table and load the new intermediate.
3. **Document it.** Add the extractor to the table above, and add the source to
   `docs/ATTRIBUTIONS.md` with its licence — including a "Changes made" list if the licence is
   CC BY-SA, which *requires* an accurate one. If the app shows the source's name or licence, put
   the string in `app/src/lib/sources.js` so the doc and the UI cannot drift apart.
4. **Update setup.** If the new data needs any new step, update `install.sh` (and `start.sh`/`copy-assets`
   if it affects what the app ships).
5. **Keep the raw original only in `backup-data/`** (gitignored). Never commit raw source.
6. **Verify the fresh-clone build.** `build-db.mjs` and everything under `build/lib/` must contain
   no path into `backup-data/`:

   ```bash
   grep -rn backup-data build/build-db.mjs build/validate-db.mjs build/lib/
   #  expect exactly one hit: the comment on build-db.mjs:5 saying no tree is needed
   cd build && npm run build && npm test
   ```

   **Do not test this by renaming `backup-data/` away.** It is ~2.8 GB of gitignored, unrecoverable
   local backup; the grep above proves the same property with no risk to it.

The raw source stays in `backup-data/` for you; the repo carries only the slim, committed intermediate.

## If data gets lost or corrupted

See **`docs/DATA-RECOVERY.md`** — the provenance + disaster-recovery runbook: where every dataset comes
from, how to re-fetch and re-parse each one, and the cleanup each source required.
