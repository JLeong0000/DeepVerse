# Text-to-Voice for Word-of-Day & Study Card — Design

**Project:** DeepVerse · **Date:** 2026-07-08 · **Status:** DESIGN
**Scope:** Add on-demand audio pronunciation to two places — the **Word of the Day** word
(`components/home/WordOfDay.svelte`) and the **currently-selected word** in the study-mode original
card (`components/workbench/OriginalCard.svelte`). Fully client-side, offline-capable, no backend.

Prerequisite reading: memory `tts-approach` (model choices + evidence), this app's PWA setup
(`app/vite.config.js`, `app/scripts/copy-assets.mjs`), and the two target components above.

---

## 1. Motivation & decision trail

Goal: let the user *hear* the original-language word, not just read it. Two engines were chosen after
empirical testing on the target hardware (MacBook Air M1, 8 GB); the alternatives were ruled out for
concrete reasons, recorded here so they aren't relitigated.

- **Greek → eSpeak-NG `grc` (Ancient Greek) voice.** The only local option that reads NT **polytonic**
  text without dropping diacritic-bearing letters AND uses ancient, non-iotacized pronunciation
  (rough breathing → *h*, eta → *ɛː*). Verified: `οὕτως γὰρ ἠγάπησεν ὁ θεὸς τὸν κόσμον` →
  `hˈuːtɔːs ɡˈar ɛːɡˈapɛːsˌen ho θeˈos ton kˈosmon`. Robotic formant voice, but correct.
- **Hebrew → Meta MMS-TTS (`facebook/mms-tts-heb`), VITS ~36M.** Modern Israeli pronunciation.
  It silently strips niqqud (proven: pointed `בְּרֵאשִׁית` and unpointed `בראשית` produce **identical**
  input_ids `[0,8,0,10,0,3,0,7,0,2,0,6,0]`; the niqqud codepoints are absent from its 33-token vocab).
  Connected speech is intelligible.
- **Aramaic → no audio.** No usable TTS coverage anywhere; the feature omits the control for `arc`.

Ruled out: Kokoro / XTTS-v2 (no Hebrew/Greek at all; XTTS also 1.9 GB/GPU), Piper (no Hebrew voice;
Greek voice low-quality + broken packaging on macos/arm64), cloud (rejected — breaks offline), a
self-hosted backend (rejected — reintroduces the online-only + server-ops cost that offline-first
avoids). See `tts-approach` memory for the full matrix.

## 2. Constraints that shaped the design

1. **Offline-first PWA, static hosting, no server.** Audio must work with no network after first use.
2. **8 GB RAM, runs in-browser alongside the app + sql.js.** Keep the client bundle small; lazy-load
   the heavier Hebrew model only on demand; ship quantized ONNX, not fp32.
3. **Minimal-dependency house style.** The app hand-rolls small utilities rather than pulling large
   libraries. The MMS pipeline is simple enough (char → id → VITS → waveform, 33-token vocab) to run
   directly on `onnxruntime-web` with a hand-rolled tokenizer, avoiding the large `transformers.js`.

## 3. Module architecture

New module `app/src/lib/tts/`, with a narrow public API so UI never touches engine internals:

```
lib/tts/
  index.js    // public API: speak(text, lang) -> Promise, canSpeak(lang) -> bool, stop() -> void
  router.js   // lang -> engine key: 'grc'/G -> 'espeak', 'hbo'/H -> 'mms', 'arc'/unknown -> null
  espeak.js   // Greek: lazy-load espeak-ng WASM (grc), synth -> Float32 PCM + sampleRate
  mms.js      // Hebrew: lazy-load ort-web + mms-heb.onnx, tokenize via vocab.js, synth -> PCM
  vocab.js    // the MMS Hebrew char->id map (33 tokens) + tokenize(text) -> Int array
  player.js   // shared AudioContext; play(PCM, sampleRate); stop(); tracks isPlaying
```

Contracts:
- **`speak(text, lang)`** — routes by lang; lazy-loads + memoizes that engine on first call;
  synthesizes; plays via `player`. Resolves when playback starts; rejects on load/synth failure.
- **`canSpeak(lang)`** — pure, synchronous. `true` only for Greek/Hebrew; `false` for `arc`, empty,
  or unknown. UI gates button rendering on this.
- **`stop()`** — stops current playback (delegates to `player`).
- Each engine module owns its own lazy-load promise (loaded once, reused). `espeak.js` and `mms.js`
  share nothing but `player.js`. No engine loads until its first `speak()` for that language.

## 4. UI component

One reusable component `app/src/components/common/PlayButton.svelte`:

```svelte
<PlayButton text={w.original} lang={w.lang || w.strongs} />
```

- Small speaker icon styled with existing tokens (`--dim` idle, `--a` active); visual weight similar
  to the existing `Study →` affordance. No new color/emoji.
- Renders **nothing** when `!canSpeak(lang)` (Aramaic, unknown, empty).
- States: `idle` → (first tap) brief `loading` spinner while the engine lazy-loads → `playing` →
  back to `idle`. On error: momentary `unavailable` flash, then `idle` (see §7).
- Calls `stop()` before starting a new utterance (also handled centrally in `player`).
- **WordOfDay:** on the `.row` line beside `{w.original}` / translit. Click handler calls
  `event.stopPropagation()` so tapping the speaker does not fire the card's `openStudy(w.ref)`.
- **OriginalCard:** in the `.wtop` detail line beside the selected word's `original` / translit
  (per chosen scope: the selected word only, not every grid tile, not whole-verse).

## 5. Language routing & text prep

- **Routing** uses the `lang` field (`grc` / `hbo` / `arc`), falling back to the Strong's prefix
  (`G` → Greek, `H` → Hebrew) when `lang` is absent. `lang` is authoritative because Hebrew and
  Aramaic share the `H` Strong's prefix — only `lang='arc'` distinguishes Aramaic.
- **DB change:** `getInterlinear` (in `lib/db.js`) gains one column, `lang`, in its SELECT so the
  study card can route reliably and detect Aramaic. WordOfDay already returns `lang`.
- **Greek text prep:** pass `original` through as-is (espeak `grc` handles polytonic). Strip any
  trailing punctuation/markers (WordOfDay already does this; apply the same for the study word).
- **Hebrew text prep:** pass through as-is — MMS normalizes away niqqud/cantillation internally.

## 6. Model delivery & caching

- Engine assets live under `app/public/tts/`: the espeak-ng WASM + its trimmed voice data, and
  `mms-heb.onnx` (quantized q8, ~40 MB). Served as normal static files.
- **Excluded from PWA precache.** `vite.config.js` currently precaches via a `globPatterns` allowlist
  `['**/*.{js,css,html,wasm}']` — the espeak `.wasm` would match and get precached. Add
  `workbox.globIgnores: ['**/tts/**']` so nothing under `tts/` is precached and install stays small.
  (The `mms-heb.onnx` is already skipped both by extension and by the existing 4 MB
  `maximumFileSizeToCacheInBytes` cap, but the ignore makes intent explicit for all tts assets.)
- Add a **runtime caching rule** to the existing `workbox.runtimeCaching` array, mirroring the
  current `bible.db` rule: `urlPattern` matching `/tts/`, `handler: 'CacheFirst'`, its own
  `cacheName`. Caches each asset on first fetch, so every later play is offline — the chosen
  "lazy-load then cache" behavior, using the exact pattern already proven for `bible.db`.
- Build-time staging: extend `app/scripts/copy-assets.mjs` to copy the espeak WASM/data and the
  `mms-heb.onnx` into `public/tts/` (mirrors how it already stages `sql-wasm.wasm` and `bible.db`).

### 6a. One-time asset production (implementation prerequisites, with risk)

These are bounded build tasks, not open research, but each carries a small risk to surface early:

1. **espeak-ng → WASM including `grc`.** Confirm an off-the-shelf espeak-ng WASM build ships the
   `grc` voice; if none does, compile one, trimming voice data to `grc` (+ `el` fallback) to keep
   size down. *Risk:* may require a custom emscripten build.
2. **`facebook/mms-tts-heb` → quantized ONNX.** Export via Optimum to ONNX, quantize to q8 (~40 MB),
   verify it runs under `onnxruntime-web`. The 33-token tokenizer is hand-rolled from the known vocab
   (regression-tested, §8). *Risk:* ONNX op coverage under ort-web (VITS is well-supported; low risk).

## 7. Errors & edge cases

- **Engine load fails** (offline on first play, fetch/compile error): `speak()` rejects; button shows
  a momentary `unavailable` state then returns to `idle`. Logged once to console (not swallowed).
- **Rapid taps / switching words:** `player.stop()` halts any current playback before new synth —
  one voice at a time.
- **Unsupported lang:** button isn't rendered, but `speak()` also guards (rejects) as defense.
- **WotD word is Aramaic** on a given day: no button; the card otherwise renders normally.
- **AudioContext gesture policy:** synthesis is always user-initiated (a tap), so the AudioContext
  is created/resumed inside the click handler — no autoplay-policy issue.

## 8. Testing

- **Unit (vitest, jsdom):**
  - `router`: routing table for `grc`, `hbo`, `arc`, `G…`, `H…`, empty, unknown.
  - `canSpeak`: true for Greek/Hebrew, false otherwise.
  - `vocab.tokenize`: `בראשית` → `[0,8,0,10,0,3,0,7,0,2,0,6,0]` (exact captured ids — regression anchor).
- **Component (@testing-library/svelte):** `PlayButton` renders nothing for `arc`; renders for
  `grc`/`hbo`; calls `speak(text, lang)` with correct args on click; `stopPropagation` in the
  WordOfDay context does not trigger `openStudy`.
- **Not unit-tested:** actual WASM/ONNX synthesis (heavy, non-deterministic). Covered by a manual
  smoke check and the `/verify` skill driving the real app once built.

## 9. Footprint summary

Net change: one new `lib/tts/` module (6 small files), one `PlayButton.svelte`, two one-line
insertions (WordOfDay + OriginalCard), one extra SELECT column (`getInterlinear`), one PWA-config
tweak (`vite.config.js`), and one `copy-assets.mjs` extension. Runtime deps added:
`onnxruntime-web` (Hebrew) + espeak-ng WASM (Greek, static asset, not an npm dep). No backend, no
change to hosting.

## 10. Out of scope (YAGNI)

Per-word speaker buttons on every interlinear tile; whole-verse read-aloud with word highlighting;
caching of generated PCM; playback speed / voice controls; Aramaic audio. Each can be a later spec if
wanted.
