# DeepVerse

A personal, offline-first Bible study workbench. Its reason to exist is the **English ↔ original-language
(Greek / Hebrew / Aramaic) comparison** — surfacing where an English translation hides a distinction the
original makes. It's a client-side PWA: no accounts, no backend, everything runs in your browser.

The signature feature is the **interpretive-difference engine**, which flags two kinds of difference per
verse:
- **Type A — synonym collapse:** several different original words rendered by one English word
  (e.g. "love" ← ἀγαπάω / φιλέω in John 21:15–17).
- **Type B — semantic-range spread:** one original word rendered by several English senses
  (e.g. ψυχή as "soul" and "life").

Alongside the reader and workbench: interlinear, cross-references, per-chapter context (people / places /
events), Tyndale study notes, and optional Greek/Hebrew audio pronunciation.

## Requirements

- **Node.js ≥ 22** (the build uses the built-in `node:sqlite`).
- **macOS or Linux** for the `./install.sh` / `./start.sh` scripts. On Windows, use WSL or Git Bash, or run
  the underlying `npm` commands directly.
- **git-lfs** — *optional*, only for the audio (text-to-speech) models. Everything else works without it.
  See [Audio models](#audio-text-to-speech-models) if you skip it.

## Setup

```bash
git clone https://github.com/JLeong0000/DeepVerse.git
cd DeepVerse
./install.sh     # builds bible.db from committed data, installs app deps, fetches TTS models if git-lfs is present
./start.sh       # launches DeepVerse → http://localhost:5173
```

`install.sh` builds the database entirely from data committed to the repo — no large raw source download is
needed. If git-lfs is installed, it also fetches the audio models automatically; if not, it prints a note and
everything except audio still works.

Your personal data — notes/memos, reading activity, the to-study list, preferences — lives only in your
browser (IndexedDB + localStorage). It is never in the repo and never leaves your device.

## Audio (text-to-speech) models

Greek/Hebrew pronunciation uses two open-weight [MMS](https://huggingface.co/facebook/mms-tts) voice models,
stored in the repo via **git-LFS**:

| File | Voice |
|------|-------|
| `app/public/tts/mms-ell.onnx` | Greek (`grc`) |
| `app/public/tts/mms-heb.onnx` | Hebrew / Aramaic (`hbo` / `arc`) |

Each is roughly **37 MB**. With git-lfs installed, `./install.sh` (or `git lfs pull`) fetches them
automatically. If a clone happened without git-lfs, these paths contain ~133-byte pointer files instead of
the real models, and audio will not load.

### Downloading the models manually (GitHub web GUI, no git-lfs CLI)

You can grab the real files straight from GitHub without the git-lfs command line:

1. Open each file's page on GitHub:
   - https://github.com/JLeong0000/DeepVerse/blob/main/app/public/tts/mms-ell.onnx
   - https://github.com/JLeong0000/DeepVerse/blob/main/app/public/tts/mms-heb.onnx
2. Click **Download** (GitHub serves the real ~37 MB model through the GUI, not the pointer).
   Direct links, if you prefer:
   - https://media.githubusercontent.com/media/JLeong0000/DeepVerse/main/app/public/tts/mms-ell.onnx
   - https://media.githubusercontent.com/media/JLeong0000/DeepVerse/main/app/public/tts/mms-heb.onnx
3. Save each downloaded file over the pointer file at the **same path** — `app/public/tts/mms-ell.onnx` and
   `app/public/tts/mms-heb.onnx`.
4. Restart the dev server (`./start.sh`). No rebuild is needed; the app serves these files directly.

To confirm you have the real models and not the pointers, check the size — a real model is tens of MB, a
pointer is ~133 bytes.

## How the data is built

The corpus (`bible.db`) is compiled from CC-BY / CC-BY-SA sources that were parsed once into compact,
committed intermediates, so a fresh clone builds offline. Details:

- **`docs/DATA-PIPELINE.md`** — the build flow, what's committed vs. what's a local backup, and the required
  steps when adding a new data source.
- **`docs/DATA-RECOVERY.md`** — where every dataset comes from, how to re-fetch and re-parse each, and the
  cleanup each source needed.
- **`docs/ATTRIBUTIONS.md`** — third-party data sources and their licenses.
- **`docs/START-HERE.md`** — full design/architecture handoff.

## Data & licensing

The original-language texts, lexicons, semantic data, cross-references, chapter context, and study notes are
open (CC-BY / CC-BY-SA), attributed in `docs/ATTRIBUTIONS.md`. The English Bible texts (NIV, NKJV, NLT) are
**copyrighted** and included for **personal use only** — do not redistribute them or publish a build. Bible
Summary chapter recaps are used with attribution and are pending the author's permission for bulk use; keep
them private until confirmed.

## Deploying

Being a static client-side PWA, DeepVerse can run as an installed PWA (via `./start.sh`) or be deployed to a
static host such as Cloudflare Pages. If you host it where others can reach it, put it behind access control —
the English translations are not licensed for public distribution.
