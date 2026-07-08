# Text-to-Voice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add on-demand, offline audio pronunciation to the Word-of-the-Day word and the selected word in the study-mode original card.

**Architecture:** A new client-side `lib/tts/` module routes a word by language to one of two lazy-loaded local engines — eSpeak-NG WASM for Greek (`grc`, ancient pronunciation) and a Meta MMS ONNX model for Hebrew (modern) — and plays the result through a shared Web Audio context. A reusable `PlayButton.svelte` surfaces it; Aramaic gets no button. Models download on first play and are runtime-cached for offline reuse.

**Tech Stack:** Svelte 5 (runes), Vite, vite-plugin-pwa (Workbox), vitest + @testing-library/svelte + jsdom, `text2wav` (espeak-ng WASM), `onnxruntime-web`.

## Global Constraints

- Runtime deps: only `text2wav` and `onnxruntime-web` may be added. Do NOT add `transformers.js` or any other large library.
- Svelte 5 runes syntax (`$state`, `$derived`, `$props`, `$effect`) — match existing components.
- ES modules only (`app/package.json` is `"type": "module"`).
- Engines and their model assets MUST NOT load until the user's first play of that language; assets MUST be reusable offline after first fetch.
- Reuse existing CSS custom properties (`--a`, `--b`, `--dim`, `--rule`, `--panel`, `--greek`) — no new colors, no emoji as UI chrome.
- Language codes: `grc` = Greek, `hbo` = Hebrew, `arc` = Aramaic; Strong's prefix `G` = Greek, `H` = Hebrew (Hebrew AND Aramaic both use `H`, so `lang` is authoritative for Aramaic).
- Tests colocate next to source as `*.test.js` (existing convention).
- Commit after each task with the message shown in its final step.

---

## File structure

**Create:**
- `app/src/lib/tts/router.js` — `route(lang)` + `canSpeak(lang)` (pure)
- `app/src/lib/tts/vocab.js` — MMS Hebrew char→id tokenizer (pure)
- `app/src/lib/tts/player.js` — shared `AudioContext`, `getContext()`, `play(buffer)`, `stop()`, `playing` state
- `app/src/lib/tts/espeak.js` — Greek engine: `synthesize(text) → Promise<AudioBuffer>`
- `app/src/lib/tts/mms.js` — Hebrew engine: `synthesize(text) → Promise<AudioBuffer>`
- `app/src/lib/tts/index.js` — public API: `speak(text, lang)`, `canSpeak(lang)`, `stop()`
- `app/src/components/common/PlayButton.svelte`
- Tests: `router.test.js`, `vocab.test.js`, `player.test.js`, `index.test.js` (in `lib/tts/`), `PlayButton.test.js` (in `components/common/`)

**Modify:**
- `app/src/lib/db.js` — add `lang` to `getInterlinear` SELECT
- `app/src/components/home/WordOfDay.svelte` — add `<PlayButton>`
- `app/src/components/workbench/OriginalCard.svelte` — add `<PlayButton>` in the selected-word detail line
- `app/vite.config.js` — PWA `globIgnores` + `runtimeCaching` for `/tts/`
- `app/scripts/copy-assets.mjs` — stage tts model assets into `public/tts/`

**Assets (produced in Tasks 5–6):**
- `app/public/tts/mms-heb.onnx` (quantized q8)
- `app/public/tts/ort/*` (onnxruntime-web wasm, for offline)

---

### Task 1: Add `lang` to interlinear query

**Files:**
- Modify: `app/src/lib/db.js` (the `getInterlinear` function, ~line 86)
- Test: `app/src/lib/db.queries.test.js`

**Interfaces:**
- Produces: `getInterlinear(book, chapter, verse)` rows now include a `lang` string field (`'grc'|'hbo'|'arc'`).

- [ ] **Step 1: Write the failing test.** Add to `app/src/lib/db.queries.test.js` (match the existing describe/setup style in that file — reuse its DB fixture/import):

```js
it('getInterlinear returns a lang for each word', () => {
  const words = getInterlinear('JHN', 1, 1); // John 1:1 is Greek
  expect(words.length).toBeGreaterThan(0);
  expect(words[0].lang).toBe('grc');
});
```

- [ ] **Step 2: Run it, verify it fails.**
Run: `cd app && npx vitest run src/lib/db.queries.test.js -t "returns a lang"`
Expected: FAIL — `lang` is `undefined`.

- [ ] **Step 3: Add the column.** In `app/src/lib/db.js`, `getInterlinear`, add `lang` to the SELECT list:

```js
export function getInterlinear(book, chapter, verse) {
  return query(`SELECT position, original, translit, gloss, strongs, morph, lemma, lang
    FROM words WHERE book=? AND chapter=? AND verse=? ORDER BY position`, [book, chapter, verse]);
}
```

- [ ] **Step 4: Run it, verify it passes.**
Run: `cd app && npx vitest run src/lib/db.queries.test.js -t "returns a lang"`
Expected: PASS. Then run the full file to confirm no regression: `npx vitest run src/lib/db.queries.test.js`.

- [ ] **Step 5: Commit.**
```bash
git add app/src/lib/db.js app/src/lib/db.queries.test.js
git commit -m "feat(app): expose word lang from getInterlinear"
```

---

### Task 2: Language router + `canSpeak`

**Files:**
- Create: `app/src/lib/tts/router.js`
- Test: `app/src/lib/tts/router.test.js`

**Interfaces:**
- Produces:
  - `route(lang) → 'espeak' | 'mms' | null` — engine key for a language/Strong's value.
  - `canSpeak(lang) → boolean` — `true` iff `route(lang)` is non-null.

- [ ] **Step 1: Write the failing test.** Create `app/src/lib/tts/router.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { route, canSpeak } from './router.js';

describe('tts router', () => {
  it('routes Greek to espeak', () => {
    expect(route('grc')).toBe('espeak');
    expect(route('G3056')).toBe('espeak');
  });
  it('routes Hebrew to mms', () => {
    expect(route('hbo')).toBe('mms');
    expect(route('H7225')).toBe('mms');
  });
  it('returns null for Aramaic, empty, and unknown', () => {
    expect(route('arc')).toBe(null);
    expect(route('')).toBe(null);
    expect(route(undefined)).toBe(null);
    expect(route('xyz')).toBe(null);
  });
  it('canSpeak mirrors route', () => {
    expect(canSpeak('grc')).toBe(true);
    expect(canSpeak('hbo')).toBe(true);
    expect(canSpeak('arc')).toBe(false);
    expect(canSpeak('')).toBe(false);
  });
});
```

- [ ] **Step 2: Run it, verify it fails.**
Run: `cd app && npx vitest run src/lib/tts/router.test.js`
Expected: FAIL — cannot find module `./router.js`.

- [ ] **Step 3: Implement.** Create `app/src/lib/tts/router.js`:

```js
// Route a language code or Strong's number to a TTS engine key.
// `lang` is authoritative: Hebrew and Aramaic share the Strong's 'H' prefix, so only
// lang==='arc' identifies Aramaic (which we cannot voice).
export function route(lang) {
  const v = String(lang || '');
  if (v === 'grc' || v[0] === 'G') return 'espeak';
  if (v === 'hbo' || v[0] === 'H') return 'mms';
  return null; // 'arc', empty, unknown -> no audio
}

export function canSpeak(lang) {
  return route(lang) !== null;
}
```

- [ ] **Step 4: Run it, verify it passes.**
Run: `cd app && npx vitest run src/lib/tts/router.test.js`
Expected: PASS.

- [ ] **Step 5: Commit.**
```bash
git add app/src/lib/tts/router.js app/src/lib/tts/router.test.js
git commit -m "feat(tts): language-to-engine router + canSpeak"
```

---

### Task 3: MMS Hebrew tokenizer

**Files:**
- Create: `app/src/lib/tts/vocab.js`
- Test: `app/src/lib/tts/vocab.test.js`

**Background:** The MMS Hebrew VITS model uses a 33-token character vocabulary. Its tokenizer lowercases/normalizes, drops any character not in the vocab (this is how niqqud is discarded), then interleaves a blank token (id 0) before and after every character. Verified output: `בראשית` → `[0,8,0,10,0,3,0,7,0,2,0,6,0]`.

**Interfaces:**
- Produces: `tokenize(text) → number[]` — input_ids for the MMS Hebrew ONNX model.

- [ ] **Step 1: Write the failing test.** Create `app/src/lib/tts/vocab.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { tokenize } from './vocab.js';

describe('mms hebrew tokenizer', () => {
  it('matches the captured input_ids for בראשית', () => {
    expect(tokenize('בראשית')).toEqual([0, 8, 0, 10, 0, 3, 0, 7, 0, 2, 0, 6, 0]);
  });
  it('strips niqqud so pointed == unpointed', () => {
    expect(tokenize('בְּרֵאשִׁית')).toEqual(tokenize('בראשית'));
  });
  it('drops unknown characters rather than erroring', () => {
    expect(tokenize('ב!ר')).toEqual(tokenize('בר'));
  });
});
```

- [ ] **Step 2: Run it, verify it fails.**
Run: `cd app && npx vitest run src/lib/tts/vocab.test.js`
Expected: FAIL — cannot find module `./vocab.js`.

- [ ] **Step 3: Implement.** Create `app/src/lib/tts/vocab.js`. The map below is the MMS Hebrew `vocab.json` (token→id); confirm/repopulate it from the model's tokenizer during Task 6 if any id mismatches, but these five (the letters of בראשית) are verified: ב=8, ר=10, א=3, ש=7, י=2, ת=6, blank=0.

```js
// MMS Hebrew (facebook/mms-tts-heb) character vocabulary: token -> id.
// ILLUSTRATIVE ONLY — before implementing, REPLACE this whole object with the verbatim
// contents of the model's real vocab.json:
//   curl -s https://huggingface.co/facebook/mms-tts-heb/resolve/main/vocab.json
// Only these are independently verified: blank/pad=0, i=2, alef=3, tav=6, shin=7, bet=8, resh=10.
// The other ids below are GUESSES and will mispronounce words other than the test word.
// The blank token id 0 is interleaved
// around every character. Characters absent from the map are dropped (this is how
// niqqud/cantillation get discarded — they are not in the vocab).
const VOCAB = {
  ' ': 0, // blank / pad
  'י': 2, 'א': 3, 'ו': 4, 'ל': 5, 'ת': 6, 'ש': 7, 'ב': 8, 'ה': 9, 'ר': 10,
  'מ': 11, 'נ': 12, 'ע': 13, 'ד': 14, 'ח': 15, 'כ': 16, 'ק': 17, 'ם': 18,
  'ג': 19, 'פ': 20, 'ן': 21, 'ס': 22, 'צ': 23, 'ט': 24, 'ז': 25, 'ך': 26,
  'ף': 27, 'ץ': 28, ' ': 29, 'ﬤ': 30, 'ּ': 31, 'װ': 32,
};

export function tokenize(text) {
  const ids = [0];
  for (const ch of String(text)) {
    const id = VOCAB[ch];
    if (id === undefined) continue; // drop unknown (incl. niqqud)
    ids.push(id, 0);
  }
  return ids;
}
```

- [ ] **Step 4: Run it, verify it passes.**
Run: `cd app && npx vitest run src/lib/tts/vocab.test.js`
Expected: PASS. Note: the test only exercises the 6 verified letters, so it passing does NOT validate the guessed ids — you MUST have replaced the map with the real `vocab.json` (per the comment in Step 3) for other Hebrew words to sound right. If the blank/pad token in the real vocab is not id 0, update the two literal `0`s in `tokenize` and the expected arrays in the test to match.

- [ ] **Step 5: Commit.**
```bash
git add app/src/lib/tts/vocab.js app/src/lib/tts/vocab.test.js
git commit -m "feat(tts): MMS Hebrew character tokenizer"
```

---

### Task 4: Shared audio player

**Files:**
- Create: `app/src/lib/tts/player.js`
- Test: `app/src/lib/tts/player.test.js`

**Interfaces:**
- Produces:
  - `getContext() → AudioContext` — lazily-created shared context (also used by engines to build/decode buffers).
  - `play(audioBuffer) → void` — stops any current playback, then plays the buffer.
  - `stop() → void` — stops current playback.
  - `playing` — a Svelte store (`svelte/store` `writable(false)`) reflecting playback state.

- [ ] **Step 1: Write the failing test.** Create `app/src/lib/tts/player.test.js` (stubs Web Audio, absent in jsdom):

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

let started, stopped;
class FakeSource {
  constructor() { this.onended = null; }
  connect() {}
  start() { started++; }
  stop() { stopped++; if (this.onended) this.onended(); }
}
class FakeContext {
  constructor() { this.destination = {}; }
  createBufferSource() { return new FakeSource(); }
}

beforeEach(() => {
  started = 0; stopped = 0;
  vi.stubGlobal('AudioContext', FakeContext);
  vi.resetModules();
});

it('play starts a source and sets playing true', async () => {
  const { play, playing } = await import('./player.js');
  play({});
  expect(started).toBe(1);
  expect(get(playing)).toBe(true);
});

it('a second play stops the first', async () => {
  const { play } = await import('./player.js');
  play({}); play({});
  expect(stopped).toBe(1);
  expect(started).toBe(2);
});
```

- [ ] **Step 2: Run it, verify it fails.**
Run: `cd app && npx vitest run src/lib/tts/player.test.js`
Expected: FAIL — cannot find module `./player.js`.

- [ ] **Step 3: Implement.** Create `app/src/lib/tts/player.js`:

```js
import { writable } from 'svelte/store';

export const playing = writable(false);

let ctx = null;
let current = null; // the active AudioBufferSourceNode

export function getContext() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function stop() {
  if (current) {
    try { current.stop(); } catch { /* already stopped */ }
    current = null;
  }
  playing.set(false);
}

export function play(audioBuffer) {
  stop();
  const c = getContext();
  const src = c.createBufferSource();
  src.buffer = audioBuffer;
  src.connect(c.destination);
  src.onended = () => { if (current === src) { current = null; playing.set(false); } };
  current = src;
  src.start();
  playing.set(true);
}
```

- [ ] **Step 4: Run it, verify it passes.**
Run: `cd app && npx vitest run src/lib/tts/player.test.js`
Expected: PASS.

- [ ] **Step 5: Commit.**
```bash
git add app/src/lib/tts/player.js app/src/lib/tts/player.test.js
git commit -m "feat(tts): shared Web Audio player"
```

---

### Task 5: Greek engine (eSpeak-NG WASM) + asset wiring

**Files:**
- Modify: `app/package.json` (add `text2wav` dependency)
- Create: `app/src/lib/tts/espeak.js`

**Interfaces:**
- Consumes: `getContext()` from `./player.js`.
- Produces: `synthesize(text) → Promise<AudioBuffer>` (Greek, voice `grc`).

**Note:** eSpeak WASM synthesis is not unit-tested (heavy, non-deterministic); this task ends with a manual smoke check in the running app.

- [ ] **Step 1: Add the dependency.**
Run: `cd app && npm install text2wav`
Then confirm the `grc` voice is present in the package's bundled voice data:
Run: `cd app && node -e "import('text2wav').then(async m => { const w = await m.default('λόγος', {voice:'grc'}); console.log('grc ok, bytes:', w.length); }).catch(e => { console.error('grc FAILED:', e.message); process.exit(1); })"`
Expected: prints `grc ok, bytes: <n>` with n in the tens of thousands.
If it fails with an unknown-voice error, `text2wav`'s bundled data lacks `grc` — switch to `espeakng.js` (steveseguin/espeakng.js, raw-PCM API) instead and adapt Step 2 to build an AudioBuffer from its PCM. Do not proceed until one produces `grc` audio.

- [ ] **Step 2: Implement.** Create `app/src/lib/tts/espeak.js` (dynamic import keeps the WASM out of the initial bundle and off the PWA precache):

```js
import { getContext } from './player.js';

let engine = null; // memoized text2wav fn

async function load() {
  if (!engine) engine = (await import('text2wav')).default;
  return engine;
}

// Greek: espeak-ng 'grc' (ancient) reads polytonic NT text with ancient vowel values.
export async function synthesize(text) {
  const t2w = await load();
  const wav = await t2w(String(text), { voice: 'grc' }); // Uint8Array, WAV bytes
  // decodeAudioData needs an ArrayBuffer copy (not a shared view)
  const buf = wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength);
  return await getContext().decodeAudioData(buf);
}
```

- [ ] **Step 3: Manual smoke check (deferred to Task 10's app run).** No unit test. Verify wiring compiles:
Run: `cd app && npx vite build 2>&1 | tail -5`
Expected: build succeeds (a `text2wav` chunk appears). Real audio is verified in Task 10.

- [ ] **Step 4: Commit.**
```bash
git add app/package.json app/package-lock.json app/src/lib/tts/espeak.js
git commit -m "feat(tts): Greek engine via espeak-ng WASM (grc)"
```

---

### Task 6: Hebrew engine (MMS ONNX via onnxruntime-web) + asset production

**Files:**
- Modify: `app/package.json` (add `onnxruntime-web`)
- Create: `app/src/lib/tts/mms.js`
- Asset: `app/public/tts/mms-heb.onnx`

**Interfaces:**
- Consumes: `tokenize()` from `./vocab.js`; `getContext()` from `./player.js`.
- Produces: `synthesize(text) → Promise<AudioBuffer>` (Hebrew, MMS, 16 kHz).

**Note:** ONNX synthesis is not unit-tested; ends with a smoke check.

- [ ] **Step 1: Obtain the ONNX model.** First check for a published conversion to avoid re-converting:
Run: `curl -sI "https://huggingface.co/onnx-community/mms-tts-heb/resolve/main/onnx/model_quantized.onnx" | head -1`
- If `200`, download it to `app/public/tts/mms-heb.onnx`.
- If `404`, convert locally with Optimum (Python, one-time):
```bash
python3 -m pip install "optimum[onnxruntime]" transformers
optimum-cli export onnx --model facebook/mms-tts-heb --task text-to-audio /tmp/mms-heb-onnx
python3 -c "from onnxruntime.quantization import quantize_dynamic, QuantType; quantize_dynamic('/tmp/mms-heb-onnx/model.onnx','/tmp/mms-heb.onnx',weight_type=QuantType.QUInt8)"
mkdir -p app/public/tts && cp /tmp/mms-heb.onnx app/public/tts/mms-heb.onnx
```
Confirm the file exists and is ~40 MB: `ls -lh app/public/tts/mms-heb.onnx`.
(If the Optimum export raises the known MMS type error, export with `--task feature-extraction` fails too — instead use transformers.js's conversion script: `git clone https://github.com/huggingface/transformers.js && python transformers.js/scripts/convert.py --model_id facebook/mms-tts-heb --quantize` and copy its `onnx/model_quantized.onnx`.)

- [ ] **Step 2: Add the dependency.**
Run: `cd app && npm install onnxruntime-web`

- [ ] **Step 3: Implement.** Create `app/src/lib/tts/mms.js`:

```js
import { tokenize } from './vocab.js';
import { getContext } from './player.js';

const SAMPLE_RATE = 16000;
let sessionPromise = null;

async function load() {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const ort = await import('onnxruntime-web');
      ort.env.wasm.wasmPaths = '/tts/ort/'; // vendored for offline (Task 10)
      return ort.InferenceSession.create('/tts/mms-heb.onnx');
    })();
  }
  return sessionPromise;
}

// Hebrew: MMS VITS. Modern pronunciation; niqqud is discarded by the tokenizer.
export async function synthesize(text) {
  const ort = await import('onnxruntime-web');
  const session = await load();
  const ids = tokenize(text);
  const input = new ort.Tensor('int64', BigInt64Array.from(ids, BigInt), [1, ids.length]);
  const feeds = { [session.inputNames[0]]: input };
  const out = await session.run(feeds);
  const waveform = out[session.outputNames[0]].data; // Float32Array PCM @ 16kHz
  const buffer = getContext().createBuffer(1, waveform.length, SAMPLE_RATE);
  buffer.copyToChannel(waveform instanceof Float32Array ? waveform : Float32Array.from(waveform), 0);
  return buffer;
}
```

- [ ] **Step 4: Smoke check the model loads under Node ORT (fast sanity, before browser).**
Run: `cd app && node -e "const ort=require('onnxruntime-web'); ort.InferenceSession.create('public/tts/mms-heb.onnx').then(s=>console.log('ok inputs:',s.inputNames,'outputs:',s.outputNames)).catch(e=>{console.error('FAIL',e.message);process.exit(1)})"`
Expected: prints input/output names (typically `['input_ids']` / `['waveform']`). If the input name differs, the code already reads `session.inputNames[0]` so no change needed.

- [ ] **Step 5: Commit.**
```bash
git add app/package.json app/package-lock.json app/src/lib/tts/mms.js app/public/tts/mms-heb.onnx
git commit -m "feat(tts): Hebrew engine via MMS ONNX (onnxruntime-web)"
```

---

### Task 7: Public TTS API (`speak` / `canSpeak` / `stop`)

**Files:**
- Create: `app/src/lib/tts/index.js`
- Test: `app/src/lib/tts/index.test.js`

**Interfaces:**
- Consumes: `route`, `canSpeak` from `./router.js`; `synthesize` from `./espeak.js` and `./mms.js`; `play`, `stop`, `playing` from `./player.js`.
- Produces:
  - `speak(text, lang) → Promise<void>` — routes, synthesizes, plays. Rejects if `route(lang)` is null or synthesis fails.
  - `canSpeak(lang) → boolean` (re-exported).
  - `stop() → void` (re-exported).
  - `playing` store (re-exported).

- [ ] **Step 1: Write the failing test.** Create `app/src/lib/tts/index.test.js` (mock the engines + player):

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

const espeakSynth = vi.fn(async () => 'greek-buffer');
const mmsSynth = vi.fn(async () => 'hebrew-buffer');
const play = vi.fn();
vi.mock('./espeak.js', () => ({ synthesize: espeakSynth }));
vi.mock('./mms.js', () => ({ synthesize: mmsSynth }));
vi.mock('./player.js', () => ({ play, stop: vi.fn(), playing: {} }));

beforeEach(() => { espeakSynth.mockClear(); mmsSynth.mockClear(); play.mockClear(); });

describe('speak', () => {
  it('routes Greek to espeak then plays', async () => {
    const { speak } = await import('./index.js');
    await speak('λόγος', 'grc');
    expect(espeakSynth).toHaveBeenCalledWith('λόγος');
    expect(play).toHaveBeenCalledWith('greek-buffer');
  });
  it('routes Hebrew to mms then plays', async () => {
    const { speak } = await import('./index.js');
    await speak('בראשית', 'hbo');
    expect(mmsSynth).toHaveBeenCalledWith('בראשית');
    expect(play).toHaveBeenCalledWith('hebrew-buffer');
  });
  it('rejects unsupported language without playing', async () => {
    const { speak } = await import('./index.js');
    await expect(speak('ריא', 'arc')).rejects.toThrow();
    expect(play).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it, verify it fails.**
Run: `cd app && npx vitest run src/lib/tts/index.test.js`
Expected: FAIL — cannot find module `./index.js`.

- [ ] **Step 3: Implement.** Create `app/src/lib/tts/index.js`:

```js
import { route, canSpeak } from './router.js';
import { play, stop, playing } from './player.js';
import { synthesize as espeak } from './espeak.js';
import { synthesize as mms } from './mms.js';

const ENGINES = { espeak, mms };

export { canSpeak, stop, playing };

export async function speak(text, lang) {
  const key = route(lang);
  if (!key) throw new Error(`No TTS engine for lang: ${lang}`);
  // Drop trailing punctuation/markers (mirrors getWordOfDay); the study card's word comes
  // straight from getInterlinear and may carry a trailing ¶ / . / · etc.
  const clean = String(text).replace(/[¶.,;:·’'"]+$/u, '').trim();
  const buffer = await ENGINES[key](clean);
  play(buffer);
}
```

- [ ] **Step 4: Run it, verify it passes.**
Run: `cd app && npx vitest run src/lib/tts/index.test.js`
Expected: PASS.

- [ ] **Step 5: Commit.**
```bash
git add app/src/lib/tts/index.js app/src/lib/tts/index.test.js
git commit -m "feat(tts): public speak/canSpeak/stop API"
```

---

### Task 8: PlayButton component

**Files:**
- Create: `app/src/components/common/PlayButton.svelte`
- Test: `app/src/components/common/PlayButton.test.js`

**Interfaces:**
- Consumes: `speak`, `canSpeak` from `../../lib/tts/index.js`.
- Props: `text: string`, `lang: string`.
- Behavior: renders a speaker button only when `canSpeak(lang)`; on click calls `speak(text, lang)` and stops event propagation; renders nothing otherwise.

- [ ] **Step 1: Write the failing test.** Create `app/src/components/common/PlayButton.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PlayButton from './PlayButton.svelte';

const speak = vi.fn(async () => {});
vi.mock('../../lib/tts/index.js', () => ({
  speak,
  canSpeak: (lang) => lang === 'grc' || lang === 'hbo' || String(lang)[0] === 'G' || String(lang)[0] === 'H',
}));

beforeEach(() => speak.mockClear());

describe('PlayButton', () => {
  it('renders nothing for Aramaic', () => {
    const { queryByRole } = render(PlayButton, { text: 'ריא', lang: 'arc' });
    expect(queryByRole('button')).toBeNull();
  });
  it('renders and speaks for Greek', async () => {
    const { getByRole } = render(PlayButton, { text: 'λόγος', lang: 'grc' });
    await fireEvent.click(getByRole('button'));
    expect(speak).toHaveBeenCalledWith('λόγος', 'grc');
  });
  it('stops propagation so it does not trigger a parent click', async () => {
    const parent = vi.fn();
    const { getByRole, container } = render(PlayButton, { text: 'λόγος', lang: 'grc' });
    container.addEventListener('click', parent);
    await fireEvent.click(getByRole('button'));
    expect(parent).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it, verify it fails.**
Run: `cd app && npx vitest run src/components/common/PlayButton.test.js`
Expected: FAIL — cannot find `./PlayButton.svelte`.

- [ ] **Step 3: Implement.** Create `app/src/components/common/PlayButton.svelte`:

```svelte
<script>
  import { speak, canSpeak } from '../../lib/tts/index.js';

  let { text, lang } = $props();
  let state = $state('idle'); // 'idle' | 'loading' | 'playing' | 'error'

  async function onClick(e) {
    e.stopPropagation();
    if (state === 'loading') return;
    state = 'loading';
    try {
      await speak(text, lang);
      state = 'playing';
    } catch (err) {
      console.warn('[tts] playback failed:', err);
      state = 'error';
      setTimeout(() => { if (state === 'error') state = 'idle'; }, 1200);
    }
  }
</script>

{#if canSpeak(lang)}
  <button class="play {state}" onclick={onClick} aria-label="Hear pronunciation" title="Hear pronunciation">
    {#if state === 'loading'}·{:else if state === 'error'}!{:else}▶{/if}
  </button>
{/if}

<style>
  .play {
    border: none; background: none; cursor: pointer; padding: 0 2px;
    color: var(--dim); font-size: 11px; line-height: 1; opacity: .75;
  }
  .play:hover { opacity: 1; color: var(--a); }
  .play.playing { color: var(--a); opacity: 1; }
  .play.error { color: var(--b); }
</style>
```

- [ ] **Step 4: Run it, verify it passes.**
Run: `cd app && npx vitest run src/components/common/PlayButton.test.js`
Expected: PASS.

- [ ] **Step 5: Commit.**
```bash
git add app/src/components/common/PlayButton.svelte app/src/components/common/PlayButton.test.js
git commit -m "feat(app): reusable PlayButton component"
```

---

### Task 9: Wire PlayButton into WordOfDay and OriginalCard

**Files:**
- Modify: `app/src/components/home/WordOfDay.svelte`
- Modify: `app/src/components/workbench/OriginalCard.svelte`

**Interfaces:**
- Consumes: `PlayButton.svelte`. WordOfDay passes `w.original` / `w.lang || w.strongs`; OriginalCard passes the selected word's `original` / `lang || strongs`.

- [ ] **Step 1: Wire WordOfDay.** In `app/src/components/home/WordOfDay.svelte`:
Add to the `<script>` imports:
```js
import PlayButton from '../common/PlayButton.svelte';
```
Change the `.row` line to include the button (it sits next to the original word; `PlayButton` already calls `stopPropagation`, so tapping it won't trigger the card's `openStudy`):
```svelte
    <div class="row"><span class="grk">{w.original}</span><PlayButton text={w.original} lang={w.lang || w.strongs} /><span class="tl">{readTranslit(w.translit)}</span></div>
```

- [ ] **Step 2: Wire OriginalCard.** In `app/src/components/workbench/OriginalCard.svelte`:
Add to the `<script>` imports:
```js
import PlayButton from '../common/PlayButton.svelte';
```
In the `.wtop` line (the selected-word detail header), add the button after the translit span:
```svelte
      <div class="wtop"><span class="grk big">{detail.word.original}</span> <span class="tl">{readTranslit(detail.word.translit)}</span>
        <PlayButton text={detail.word.original} lang={detail.word.lang || detail.word.strongs} />
        <span class="strong">{detail.word.strongs}</span>{#if detail.word.morph} <span class="morph">{detail.word.morph}</span>{/if}</div>
```
(Note: `detail.word` originates from `getInterlinear` rows, which now carry `lang` after Task 1.)

- [ ] **Step 3: Verify existing component tests still pass.**
Run: `cd app && npx vitest run`
Expected: PASS (no regressions). Then build: `npx vite build 2>&1 | tail -3` → succeeds.

- [ ] **Step 4: Commit.**
```bash
git add app/src/components/home/WordOfDay.svelte app/src/components/workbench/OriginalCard.svelte
git commit -m "feat(app): add pronunciation button to Word-of-Day and study card"
```

---

### Task 10: PWA config, asset staging, and end-to-end verification

**Files:**
- Modify: `app/vite.config.js`
- Modify: `app/scripts/copy-assets.mjs`
- Asset: `app/public/tts/ort/*` (onnxruntime-web wasm, vendored for offline)

**Interfaces:**
- Consumes: model assets under `public/tts/` from Tasks 5–6.

- [ ] **Step 1: Vendor onnxruntime-web wasm for offline.** Extend `app/scripts/copy-assets.mjs` to copy ort wasm into `public/tts/ort/` (append after the existing copies; match the file's style):
```js
// onnxruntime-web wasm — vendored so Hebrew TTS works offline (no CDN fetch).
const ortSrc = path.resolve(appRoot, 'node_modules/onnxruntime-web/dist');
const ortDest = path.join(publicDir, 'tts', 'ort');
fs.mkdirSync(ortDest, { recursive: true });
for (const f of fs.readdirSync(ortSrc)) {
  if (f.endsWith('.wasm') || f.endsWith('.mjs')) fs.copyFileSync(path.join(ortSrc, f), path.join(ortDest, f));
}
console.log('copy-assets: onnxruntime-web wasm -> public/tts/ort/');
```

- [ ] **Step 2: Exclude tts assets from precache + runtime-cache them.** In `app/vite.config.js`, inside the `VitePWA({ workbox: { … } })` block, add `globIgnores` and a `/tts/` entry in `runtimeCaching` (mirror the existing `bible.db` rule):
```js
        globIgnores: ['**/tts/**'],
        runtimeCaching: [
          // ...existing bible.db rule stays...
          {
            urlPattern: ({ url }) => url.pathname.includes('/tts/'),
            handler: 'CacheFirst',
            options: { cacheName: 'tts-assets', expiration: { maxEntries: 8 } },
          },
        ],
```
(Insert the new object into the existing `runtimeCaching` array — do not remove the current bible.db rule.)

- [ ] **Step 3: Build and confirm asset placement.**
Run: `cd app && npm run build 2>&1 | tail -8`
Expected: build succeeds; `copy-assets` logs the ort copy. Then:
Run: `ls -lh app/dist/tts/ app/dist/tts/ort/ 2>/dev/null && grep -c "tts/" app/dist/sw.js || true`
Expected: `mms-heb.onnx` and ort `.wasm` present under `dist/tts/`; the service worker does not precache them (they are runtime-cached).

- [ ] **Step 4: End-to-end verification in the real app.** Use the `/verify` skill (or `run` skill) to drive the app:
  1. Start dev: `cd app && npm run dev`.
  2. On Home, click the Word-of-Day play button → hear audio (Greek or Hebrew depending on the day's word). If the day's word is Aramaic, confirm **no** button renders.
  3. Open study mode, select a Greek word (e.g. John 1:1 λόγος) → play → hear ancient-Greek pronunciation.
  4. Select a Hebrew word (e.g. Genesis 1:1 בראשית) → play → hear Hebrew.
  5. Reload with DevTools offline after first play → confirm audio still works (runtime cache).
  6. Confirm playing a second word stops the first.
Expected: all six behaviors hold.

- [ ] **Step 5: Commit.**
```bash
git add app/vite.config.js app/scripts/copy-assets.mjs
git commit -m "feat(app): lazy-load + offline-cache TTS model assets"
```

---

## Notes for the implementer

- **Two derisking gates come early:** Task 5 Step 1 (does `text2wav` ship `grc`?) and Task 6 Step 1 (obtain/convert the Hebrew ONNX). If either fails, stop and report — the fallbacks are noted inline, but don't paper over a failure.
- The pure-logic tasks (1–4, 7, 8) are strict TDD and fully deterministic. The engine tasks (5, 6) can't be unit-tested; their real verification is Task 10 Step 4.
- Keep engines lazy: nothing in `espeak.js` / `mms.js` should run at import time — only inside `synthesize()` / `load()`.
