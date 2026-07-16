# DeepVerse — Data Pipeline

How data gets into DeepVerse, and the rule you must follow whenever you add a new data source.

## Two kinds of data

1. **Shared corpus** — everything in `bible.db` (verses, interlinear words, lexicon, cross-refs,
   interpretive differences, chapter context/entities, recaps, study notes). Read-only, identical for
   everyone, produced by the build.
2. **Per-user data** — notes/memos, reading activity, the to-study list, prefs. Lives in the browser's
   **IndexedDB + localStorage**, created per-device at runtime. **It is never in the repo, never in the
   build, and never in `bible.db`.** The build deliberately produces none of it; each person's copy is
   their own.

Everything below is about the shared corpus only.

## What the build reads (all committed — a fresh clone can build offline)

| Input | Path | Tracked? |
|---|---|---|
| Bible text (verses) | `data/bibles/{NIV,NKJV,NLT}/*.json` | ✅ committed |
| Parsed source intermediates | `build/data/sources/*.json.gz` | ✅ committed (~16 MB) |
| Recaps, study notes | `build/data/*.json` | ✅ committed |
| **Raw original corpora** | `backup-data/` | ❌ **gitignored — local backup only** |

`backup-data/` (STEPBible, macula-greek/hebrew, openbible, theographic, tyndale, licensed Bibles…) is
~595 MB of raw CC-BY/CC-BY-SA source. It is **not** needed to build — only to *re-derive* an intermediate
when a source changes. Keep it as a personal backup; it never goes into git.

## The flow

```
backup-data/  ──(extract-sources.mjs, maintainer-only)──▶  build/data/sources/*.json.gz  (committed)
                                                                      │
   data/bibles/ + build/data/*.json  ───────────────────────────────┤
                                                                      ▼
                                                    build-db.mjs  ──▶  data/bible.db
                                                                      │
                                                    app copy-assets ──▶ app/public/bible.db (slimmed)
```

- **`build/extract-sources.mjs`** — maintainer-only; needs `backup-data/`. Parses the raw corpora into the
  compact committed intermediates. Run only when a raw source changes.
- **`build/build-db.mjs`** — builds `data/bible.db` from committed inputs only. `differences` is *computed*
  here, never vendored.
- **`install.sh`** (repo root) — fresh-clone setup: build the DB from intermediates, then install app deps.
  Then `./start.sh`.

## ⚠️ REQUIRED when you add a new data source

**Whenever you import a new dataset and the feature is done, you MUST complete all of these before it's
considered shipped — otherwise a fresh clone can no longer rebuild `bible.db`:**

1. **Extract & store.** Add the source's parsing to `build/extract-sources.mjs` (or, for already-parsed
   data, drop a committed JSON in `build/data/`). Run the extract so the compact intermediate lands in
   `build/data/sources/` — and **commit that intermediate.**
2. **Wire the build.** Update `build/build-db.mjs` to create the table and load the new intermediate.
3. **Update setup.** If the new data needs any new step, update `install.sh` (and `start.sh`/`copy-assets`
   if it affects what the app ships).
4. **Keep the raw original only in `backup-data/`** (gitignored). Never commit raw source.
5. **Verify:** rebuild with `backup-data/` renamed away → build still succeeds; `npm test` (build) green.

The raw source stays in `backup-data/` for you; the repo carries only the slim, committed intermediate.

## If data gets lost or corrupted

See **`docs/DATA-RECOVERY.md`** — the provenance + disaster-recovery runbook: where every dataset comes
from, how to re-fetch and re-parse each one, and the cleanup each source required.
