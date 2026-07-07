# OT Interpretive-Difference Engine (Hebrew / Aramaic) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the precomputed `differences` table (Type A synonym-collapse, Type B sense-spread) from the Greek NT to the Hebrew/Aramaic OT using macula-hebrew's SDBH semantic data.

**Architecture:** A new loader parses macula-hebrew lowfat XML into the existing `word_domain` table (SDBH `lexdomain` as the Louw-Nida analog). `differences.mjs` is refactored into a language-parameterized pass so `grc`, `hbo`, `arc` share one code path; Greek output stays byte-identical. The OT path adds a Hebrew gloss cleanup (Type B) and three precision filters (Type A: drop proper nouns, require a real English sense difference, apply a frequency floor). All keys normalize to a base Strong's (`H####`) so `words`, `word_domain`, and `synonyms` share one key space.

**Tech Stack:** Node ≥22 (`node:sqlite`, `node --test`), no runtime deps for the build. Plain ESM `.mjs`.

## Global Constraints

- **Node ≥22** required (`node:sqlite`). No new dependencies (build stays dep-free except existing `pdfjs-dist`).
- **Full `data/bible.db` stays complete** for build/tests; the shipped `app/public/bible.db` is slimmed by `app/scripts/copy-assets.mjs`.
- **Greek NT output must not change** — existing build tests and the 26 app tests stay green; Greek `differences` row counts stay within tolerance of baseline.
- **TDD**: every task writes a failing test first. Build test runner: `cd build && node --test --test-concurrency=1 test/*.test.mjs` (or a single file via `node --test test/<file>`).
- **Success gate**: `cd build && npm run build` exits 0, `npm test` passes incl. new OT fixtures (ruach spirit/wind, nephesh life/person, virgin↔young-woman Type A), Greek unchanged; Genesis/Psalms render OT differences in the running app.
- **Key normalizer** (verbatim): `baseHeb(s)` → `'H' + s.split(',')[0].replace(/^H/i,'').match(/^\d+/)[0].padStart(4,'0')`, or `null` if no digits. Applied to hbo/arc keys only; Greek keeps `padStrong`.
- Design reference: `docs/superpowers/specs/2026-07-07-ot-differences-engine-design.md`.

---

## File Structure

- **Create** `build/lib/macula-hebrew.mjs` — `loadHebrewDomains(db, dir)`: parse lowfat XML → `word_domain` rows for hbo/arc.
- **Modify** `build/lib/macula.mjs` — add `baseHeb(raw)` key normalizer.
- **Modify** `build/lib/gloss.mjs` — add `hebrewSenseKey(gloss)` (Hebrew-scoped cleanup + reuse `senseKey`).
- **Modify** `build/lib/differences.mjs` — language-parameterized `runLanguageGroup`; export `isHebrewContent`; OT Type-A filters.
- **Modify** `build/build-db.mjs` — call `loadHebrewDomains` after the Greek `word_domain` load.
- **Modify** `app/scripts/copy-assets.mjs` — drop `word_domain` + `word_sense` from the shipped DB.
- **Create** `build/test/differences-ot.test.mjs` — OT integration fixtures + `isHebrewContent` unit.
- **Modify** `build/test/macula.test.mjs` — `baseHeb` unit tests.
- **Modify** `build/test/gloss.test.mjs` — `hebrewSenseKey` unit tests.

---

### Task 1: `baseHeb()` key normalizer

**Files:**
- Modify: `build/lib/macula.mjs`
- Test: `build/test/macula.test.mjs`

**Interfaces:**
- Produces: `baseHeb(raw: string) → string | null` — normalizes any of `H7225G` / `H2416d` / `0871a` / `"H0001G, H5703"` to `H` + 4-digit base (`H7225`, `H2416`, `H0871`, `H0001`); `null` when there is no numeric part.

- [ ] **Step 1: Write the failing test** — append to `build/test/macula.test.mjs`:

```js
import { baseHeb } from '../lib/macula.mjs';

test('baseHeb normalizes the three Hebrew Strong key formats to H+4-digit base', () => {
  assert.equal(baseHeb('H7225G'), 'H7225');   // words.strongs (uppercase homograph suffix)
  assert.equal(baseHeb('H2416d'), 'H2416');   // Proximity.tsv (lowercase suffix)
  assert.equal(baseHeb('0871a'), 'H0871');    // macula strongnumberx (no prefix, lowercase suffix)
  assert.equal(baseHeb('4430'), 'H4430');     // Aramaic, no suffix
  assert.equal(baseHeb('H0001G, H5703'), 'H0001'); // comma-joined multi-strong -> first token
  assert.equal(baseHeb('G0025'), null);       // not Hebrew (no H, starts with letter G)
  assert.equal(baseHeb(''), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd build && node --test test/macula.test.mjs`
Expected: FAIL — `baseHeb is not a function` / import error.

- [ ] **Step 3: Write minimal implementation** — append to `build/lib/macula.mjs`:

```js
// Hebrew/Aramaic key normalizer. words.strongs "H7225G", Proximity "H2416d", and macula
// strongnumberx "0871a" all disambiguate homographs with DIFFERENT suffix schemes that do not map
// to each other, so we key on the base number: strip prefix/suffix -> "H" + 4-digit. Greek keeps
// padStrong (its keys are already canonical); baseHeb returns null for non-H input.
export function baseHeb(raw) {
  const first = String(raw || '').split(',')[0].trim();
  const m = first.replace(/^H/i, '').match(/^\d+/);
  return m ? 'H' + m[0].padStart(4, '0') : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd build && node --test test/macula.test.mjs`
Expected: PASS (all macula tests, including the new one).

- [ ] **Step 5: Commit**

```bash
git add build/lib/macula.mjs build/test/macula.test.mjs
git commit -m "feat(build): baseHeb Strong's key normalizer for Hebrew/Aramaic"
```

---

### Task 2: `hebrewSenseKey()` gloss cleanup

**Files:**
- Modify: `build/lib/gloss.mjs`
- Test: `build/test/gloss.test.mjs`

**Interfaces:**
- Consumes: existing `senseKey(gloss)` from the same module.
- Produces: `hebrewSenseKey(gloss: string) → string` — strips Hebrew interlinear baggage (`<...>` markers, trailing `/pronoun`, construct ` of`) then applies `senseKey`. Greek `senseKey`/`normalizeGloss` are untouched.

- [ ] **Step 1: Write the failing test** — append to `build/test/gloss.test.mjs`:

```js
import { hebrewSenseKey, senseKey } from '../lib/gloss.mjs';

test('hebrewSenseKey collapses construct/pronominal baggage to one sense', () => {
  const k = hebrewSenseKey('god');
  assert.equal(hebrewSenseKey('god of'), k);        // construct
  assert.equal(hebrewSenseKey('god/ your'), k);     // pronominal suffix
  assert.equal(hebrewSenseKey('<obj.> god'), k);    // bracket marker
});

test('hebrewSenseKey keeps genuinely distinct senses distinct', () => {
  assert.notEqual(hebrewSenseKey('spirit of'), hebrewSenseKey('wind'));
  assert.notEqual(hebrewSenseKey('life/ my'), hebrewSenseKey('the/ person'));
});

test('hebrewSenseKey does not alter the Greek senseKey behavior', () => {
  // sanity: the shared senseKey still stems normally
  assert.equal(senseKey('loving'), senseKey('loves'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd build && node --test test/gloss.test.mjs`
Expected: FAIL — `hebrewSenseKey is not a function`.

- [ ] **Step 3: Write minimal implementation** — append to `build/lib/gloss.mjs`:

```js
// Hebrew/Aramaic interlinear glosses carry grammatical baggage that senseKey (tuned for Greek/English)
// misreads as distinct senses: pronominal suffixes ("heart/ my"), construct particles ("god of"), and
// bracket markers ("<obj.>", "<to>"). Strip those, then reuse the shared senseKey stemmer. Used ONLY on
// the hbo/arc path so the Greek Type-B calibration and its tests are untouched.
const HEB_PRONOUN = /\/\s*(my|your|his|her|its|our|their|you|him|them|me|us)\b/g;
export function hebrewSenseKey(gloss) {
  const cleaned = String(gloss || '').toLowerCase()
    .replace(/<[^>]*>/g, ' ')     // <obj.>, <to>, <the>
    .replace(HEB_PRONOUN, ' ')    // pronominal suffix
    .replace(/\bof\b/g, ' ');     // construct chain
  return senseKey(cleaned);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd build && node --test test/gloss.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add build/lib/gloss.mjs build/test/gloss.test.mjs
git commit -m "feat(build): hebrewSenseKey — strip Hebrew gloss baggage before sense clustering"
```

---

### Task 3: SDBH domain loader `loadHebrewDomains()`

**Files:**
- Create: `build/lib/macula-hebrew.mjs`
- Modify: `build/build-db.mjs` (import + call after the Greek `word_domain` block, ~line 120)
- Test: `build/test/differences-ot.test.mjs` (create; also hosts Task 4/5/6 integration tests)

**Interfaces:**
- Consumes: `baseHeb` (Task 1); existing `word_domain(strongs, lemma, gloss, ln, domain, frame)` table + `INSERT OR IGNORE` statement shape.
- Produces: `loadHebrewDomains(db, dir) → number` (count of hbo/arc rows inserted). Populates `word_domain` with `strongs = baseHeb(strongnumberx)`, `ln = full lexdomain`, `domain = first 3-digit group of lexdomain`. First sense per base strongs wins (via `INSERT OR IGNORE`).

- [ ] **Step 1: Write the failing test** — create `build/test/differences-ot.test.mjs`:

```js
// build/test/differences-ot.test.mjs — OT (Hebrew/Aramaic) engine fixtures.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { loadHebrewDomains } from '../lib/macula-hebrew.mjs';

const HEB_DIR = '../sources/macula-hebrew/WLC/lowfat';
let db;
before(() => {
  db = new DatabaseSync('../data/bible.db');
  loadHebrewDomains(db, HEB_DIR);   // idempotent (INSERT OR IGNORE); ensures Hebrew domains present
});

test('word_domain has SDBH domains for Hebrew content words (ruach H7307)', () => {
  const r = db.prepare("SELECT ln, domain FROM word_domain WHERE strongs='H7307'").get();
  assert.ok(r, 'expected a word_domain row for H7307');
  assert.ok(/^\d{3}/.test(r.ln), 'ln should be an SDBH lexdomain string');
  assert.equal(r.domain, r.ln.slice(0, 3), 'domain should be the first 3-digit group of ln');
});

test('word_domain covers Aramaic (melek H4430)', () => {
  const r = db.prepare("SELECT ln FROM word_domain WHERE strongs='H4430'").get();
  assert.ok(r && r.ln, 'expected an SDBH domain for the Aramaic word melek H4430');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd build && node --test test/differences-ot.test.mjs`
Expected: FAIL — cannot import `loadHebrewDomains`.

- [ ] **Step 3: Write minimal implementation** — create `build/lib/macula-hebrew.mjs`:

```js
// build/lib/macula-hebrew.mjs
// Load SDBH semantic domains (Hebrew + Aramaic) from macula-hebrew lowfat XML into word_domain.
// macula-hebrew uses SDBH, not Louw-Nida: `lexdomain` (hierarchical 3-digit groups, e.g. 001005002002001)
// is the LN "domain.subdomain" analog -> store the full lexdomain in `ln`, the first 3-digit group in
// `domain`. Keyed by baseHeb(strongnumberx) to share a key space with words.strongs and synonyms.
import fs from 'node:fs';
import { baseHeb } from './macula.mjs';

export function loadHebrewDomains(db, dir) {
  const insD = db.prepare('INSERT OR IGNORE INTO word_domain VALUES (?,?,?,?,?,?)');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('-lowfat.xml'));
  let inserted = 0;
  db.exec('BEGIN');
  for (const f of files) {
    const xml = fs.readFileSync(`${dir}/${f}`, 'utf8');
    const wRe = /<w\b([^>]*?)>/gs;          // <w> elements span multiple lines -> dotall
    let m;
    while ((m = wRe.exec(xml))) {
      const a = {};
      const attrRe = /([a-zA-Z:]+)="([^"]*)"/g;
      let x;
      while ((x = attrRe.exec(m[1]))) a[x[1]] = x[2];
      if (!a.strongnumberx || !a.lexdomain) continue;
      const strongs = baseHeb(a.strongnumberx);
      if (!strongs) continue;
      const ln = a.lexdomain.trim();
      const res = insD.run(strongs, a.stronglemma || a.lemma || '', a.english || a.gloss || '', ln, ln.slice(0, 3), '');
      if (res.changes) inserted++;
    }
  }
  db.exec('COMMIT');
  return inserted;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd build && node --test test/differences-ot.test.mjs`
Expected: PASS (both word_domain tests).

- [ ] **Step 5: Wire into the build** — in `build/build-db.mjs`, add the import near the other lib imports (top of file, alongside `import { parseMaculaGreekLine, ... } from './lib/macula.mjs';`):

```js
import { loadHebrewDomains } from './lib/macula-hebrew.mjs';
```

Then, immediately after the Greek `word_domain` log line (`console.log('word_domain:', ...)`, ~line 120), add:

```js
// 5b) MACULA HEBREW: SDBH domains for Hebrew + Aramaic (word_domain hbo/arc)
loadHebrewDomains(db, `${ROOT}/sources/macula-hebrew/WLC/lowfat`);
console.log('word_domain (+Hebrew/Aramaic):', db.prepare('SELECT COUNT(*) n FROM word_domain').get().n);
```

- [ ] **Step 6: Run the build to confirm it loads**

Run: `cd build && node build-db.mjs`
Expected: prints `word_domain (+Hebrew/Aramaic): N` where N is ~12,000+ (Greek ~5,437 + Hebrew/Aramaic ~7,000). Exits without error.

- [ ] **Step 7: Commit**

```bash
git add build/lib/macula-hebrew.mjs build/build-db.mjs build/test/differences-ot.test.mjs
git commit -m "feat(build): load macula-hebrew SDBH domains into word_domain (hbo/arc)"
```

---

### Task 4: Refactor `differences.mjs` to a language-parameterized pass (Greek unchanged)

**Files:**
- Modify: `build/lib/differences.mjs` (full rewrite of the internals; same exported API)
- Test: `build/test/differences.test.mjs` (existing Greek tests must still pass — regression gate)

**Interfaces:**
- Consumes: `senseKey` (gloss.mjs); `word_domain`, `synonyms`, `words` tables.
- Produces: unchanged public API `computeDifferences(db)`. New internal `runLanguageGroup(db, insD, cfg)` where `cfg = { langs, keyPrefix, normKey, isContent, senseKeyFn, topFn, typeA }` and `typeA = { synMin, synMax, freqMax } | null`. This task calls it once for Greek only; the Greek `differences` output is byte-identical to before.

- [ ] **Step 1: Add a regression guard test** — append to `build/test/differences.test.mjs`:

```js
test('Greek Type A/B row counts stay in the expected range (regression guard)', () => {
  const a = db.prepare("SELECT COUNT(*) n FROM differences WHERE type='A' AND strongs LIKE 'G%'").get().n;
  const b = db.prepare("SELECT COUNT(*) n FROM differences WHERE type='B' AND strongs LIKE 'G%'").get().n;
  assert.ok(a > 18000 && a < 26000, `Greek Type A count ${a} out of range`);
  assert.ok(b > 30000 && b < 40000, `Greek Type B count ${b} out of range`);
});
```

- [ ] **Step 2: Run to confirm it passes on the current (pre-refactor) engine**

Run: `cd build && node --test test/differences.test.mjs`
Expected: PASS — establishes the baseline the refactor must preserve. (If counts differ from these bounds on your build, adjust the bounds to the actual current values before refactoring, then keep them fixed.)

- [ ] **Step 3: Rewrite `build/lib/differences.mjs`** with the language-parameterized structure (Greek call only):

```js
// build/lib/differences.mjs
import { senseKey } from './gloss.mjs';
// Precompute the interpretive-difference table. Type A (synonym collapse): a content word whose Strong's
// has a near-synonym (different Strong's) sharing its top-level semantic domain but a different sub-domain,
// with a proximity distance in a BAND [synMin, synMax]. Type B (sense spread): a lemma whose glosses
// cluster into >=2 distinct senses, each >= SENSE_MIN_FRAC of its occurrences.
//
// The engine runs once per language group. Greek (grc) uses Louw-Nida domains (dotted, "25.43" -> top "25")
// and clean glosses. Hebrew/Aramaic (hbo/arc, added later) use SDBH lexdomain (undotted, first 3-digit group
// is the top), a base-Strong key normalizer, a Hebrew-aware content test, gloss cleanup, and extra Type-A
// precision filters. Greek behavior here is byte-identical to the pre-refactor engine.
const SYN_MIN = 0.45;        // below this a near-synonym is used near-interchangeably (trivial)
const SYN_MAX = 0.60;        // above this it is not really a synonym
const A_FREQ_MAX = 300;      // Type A: skip common words (copula/quantifiers/"say"/"God") — grammatical, not interpretive
const SENSE_MIN_FRAC = 0.05;
const SENSE_MIN_LEMMA_OCC = 8;

const isGreekContent = m => /^(N-|V-|A-|N|V)/.test(String(m || '')) && !/^(ADV|CONJ|PREP|PRT|T-)/.test(m);
const grcTop = ln => String(ln || '').split('.')[0];

export function computeDifferences(db) {
  db.exec(`DROP TABLE IF EXISTS differences;
    CREATE TABLE differences (book TEXT, chapter INTEGER, verse INTEGER, position INTEGER,
      type TEXT CHECK(type IN ('A','B')), strongs TEXT, detail TEXT);`);
  const insD = db.prepare('INSERT INTO differences VALUES (?,?,?,?,?,?,?)');

  runLanguageGroup(db, insD, {
    langs: ['grc'], keyPrefix: 'G', normKey: s => s,
    isContent: isGreekContent, senseKeyFn: senseKey, topFn: grcTop,
    typeA: { synMin: SYN_MIN, synMax: SYN_MAX, freqMax: A_FREQ_MAX },
  });

  db.exec('CREATE INDEX idx_diff_ref ON differences(book,chapter,verse);');
}

function runLanguageGroup(db, insD, cfg) {
  const { langs, keyPrefix, normKey, isContent, senseKeyFn, topFn, typeA } = cfg;
  const inClause = langs.map(l => `'${l}'`).join(',');

  // --- domain per normalized strongs: full domain string + top-level ---
  const lnFull = new Map();
  for (const r of db.prepare("SELECT strongs, ln FROM word_domain WHERE ln<>''").all()) {
    if (!String(r.strongs).startsWith(keyPrefix)) continue;
    const k = normKey(r.strongs);
    if (k && !lnFull.has(k)) lnFull.set(k, String(r.ln).trim());
  }
  const lnTop = new Map([...lnFull].map(([s, ln]) => [s, topFn(ln)]));

  // --- symmetric synonym adjacency (normalized keys) ---
  const adj = new Map();
  const link = (a, b, d) => { if (!adj.has(a)) adj.set(a, new Map()); const m = adj.get(a); if (!m.has(b) || d < m.get(b)) m.set(b, d); };
  for (const r of db.prepare('SELECT strongs_a a, strongs_b b, distance d FROM synonyms').all()) {
    if (!String(r.a).startsWith(keyPrefix) || !String(r.b).startsWith(keyPrefix)) continue;
    const a = normKey(r.a), b = normKey(r.b);
    if (!a || !b || a === b) continue;
    link(a, b, r.d); link(b, a, r.d);
  }

  // --- frequency per normalized strongs (gates Type A; also used by the OT frequency floor later) ---
  const freq = new Map();
  for (const r of db.prepare(`SELECT strongs, COUNT(*) n FROM words WHERE lang IN (${inClause}) AND strongs<>'' GROUP BY strongs`).all()) {
    const k = normKey(r.strongs); if (k) freq.set(k, (freq.get(k) || 0) + r.n);
  }

  // --- near-synonyms of a strongs: same top domain, different full domain, distance in band, nearest first ---
  const nearSynCache = new Map();
  function nearSyn(strongs) {
    if (nearSynCache.has(strongs)) return nearSynCache.get(strongs);
    const dom = lnTop.get(strongs), sub = lnFull.get(strongs);
    let out = [];
    if (typeA && dom && adj.has(strongs)) {
      out = [...adj.get(strongs)]
        .filter(([o, d]) => d >= typeA.synMin && d <= typeA.synMax && lnTop.get(o) === dom && lnFull.get(o) !== sub)
        .sort((x, y) => x[1] - y[1]).slice(0, 4)
        .map(([o, d]) => ({ strongs: o, distance: Number(d.toFixed(3)) }));
    }
    nearSynCache.set(strongs, out); return out;
  }

  // --- Type B: cluster a lemma's glosses into distinct senses (>= SENSE_MIN_FRAC each, >=2 total) ---
  const senseByStrong = new Map();
  const byStrong = new Map();
  for (const r of db.prepare(`SELECT strongs, gloss_norm, COUNT(*) c FROM words
      WHERE lang IN (${inClause}) AND strongs<>'' AND gloss_norm<>'' GROUP BY strongs, gloss_norm`).all()) {
    const k = normKey(r.strongs); if (!k) continue;
    if (!byStrong.has(k)) byStrong.set(k, new Map());
    const gm = byStrong.get(k); gm.set(r.gloss_norm, (gm.get(r.gloss_norm) || 0) + r.c);
  }
  for (const [k, gm] of byStrong) {
    const total = [...gm.values()].reduce((n, c) => n + c, 0);
    if (total < SENSE_MIN_LEMMA_OCC) continue;
    const clusters = new Map();
    for (const [gloss, c] of gm) {
      const key = senseKeyFn(gloss);
      const cl = clusters.get(key) || { gloss, count: 0, top: 0 };
      cl.count += c; if (c > cl.top) { cl.top = c; cl.gloss = gloss; }
      clusters.set(key, cl);
    }
    const senses = [...clusters.values()].filter(s => s.count / total >= SENSE_MIN_FRAC).sort((a, b) => b.count - a.count);
    if (senses.length >= 2) senseByStrong.set(k, { senses: senses.map(s => ({ gloss: s.gloss, count: s.count })), total });
  }

  // --- walk content words, emit A and/or B (row stores the ORIGINAL words.strongs, joined by position) ---
  const words = db.prepare(`SELECT book,chapter,verse,position,strongs,morph FROM words WHERE lang IN (${inClause}) AND strongs<>''`).all();
  db.exec('BEGIN');
  for (const w of words) {
    if (!isContent(w.morph)) continue;
    const k = normKey(w.strongs); if (!k) continue;
    const syn = (typeA && (freq.get(k) || 0) <= typeA.freqMax) ? nearSyn(k) : [];
    if (syn.length) insD.run(w.book, w.chapter, w.verse, w.position, 'A', w.strongs, JSON.stringify({ nearSynonyms: syn }));
    const b = senseByStrong.get(k);
    if (b) insD.run(w.book, w.chapter, w.verse, w.position, 'B', w.strongs, JSON.stringify(b));
  }
  db.exec('COMMIT');
}
```

- [ ] **Step 4: Run the Greek tests to verify no regression**

Run: `cd build && node --test test/differences.test.mjs`
Expected: PASS — John 21:15 Type A, psyche Type B, kai never, and the new count-range guard all pass (Greek output unchanged).

- [ ] **Step 5: Commit**

```bash
git add build/lib/differences.mjs build/test/differences.test.mjs
git commit -m "refactor(build): language-parameterized differences engine (Greek unchanged)"
```

---

### Task 5: Enable Type B for Hebrew/Aramaic

**Files:**
- Modify: `build/lib/differences.mjs` (add imports, `isHebrewContent`, `hebTop`, the hbo/arc group call — Type B only)
- Test: `build/test/differences-ot.test.mjs` (add Type B fixtures + `isHebrewContent` unit)

**Interfaces:**
- Consumes: `baseHeb` (Task 1), `hebrewSenseKey` (Task 2), `runLanguageGroup` (Task 4).
- Produces: exported `isHebrewContent(morph) → boolean`; hbo/arc `differences` Type B rows. `typeA: null` for this group (Type A added in Task 6).

- [ ] **Step 1: Write the failing tests** — append to `build/test/differences-ot.test.mjs` (add `computeDifferences` + `isHebrewContent` to imports at top: `import { computeDifferences, isHebrewContent } from '../lib/differences.mjs';`, and run `computeDifferences(db)` in the existing `before` hook, after `loadHebrewDomains`):

```js
// --- update the before() hook to also compute differences ---
// before(() => { db = new DatabaseSync('../data/bible.db'); loadHebrewDomains(db, HEB_DIR); computeDifferences(db); });

test('isHebrewContent: strips the H/A lang marker and keeps only Nc/V/A', () => {
  assert.equal(isHebrewContent('Ncfsa'), true);    // common noun, no marker
  assert.equal(isHebrewContent('HVqp3ms'), true);  // verb, H marker
  assert.equal(isHebrewContent('HAcmsa'), true);   // adjective, H marker
  assert.equal(isHebrewContent('Aamsa'), true);    // bare-A adjective (no marker)
  assert.equal(isHebrewContent('AVqp3mp'), true);  // Aramaic verb
  assert.equal(isHebrewContent('Np'), false);      // proper noun
  assert.equal(isHebrewContent('HTo'), false);     // object marker (particle)
  assert.equal(isHebrewContent('Sp'), false);      // pronominal suffix
  assert.equal(isHebrewContent('HR'), false);      // preposition
});

test('Type B fires on ruach H7307 with spirit AND wind senses', () => {
  const row = db.prepare("SELECT detail FROM differences WHERE type='B' AND strongs LIKE 'H7307%' LIMIT 1").get();
  assert.ok(row, 'expected a Type B row for ruach H7307');
  const glosses = JSON.parse(row.detail).senses.map(s => s.gloss).join(' | ');
  assert.match(glosses, /spirit/i);
  assert.match(glosses, /wind/i);
});

test('Type B fires on nephesh H5315 with life AND person senses', () => {
  const row = db.prepare("SELECT detail FROM differences WHERE type='B' AND strongs LIKE 'H5315%' LIMIT 1").get();
  assert.ok(row, 'expected a Type B row for nephesh H5315');
  const glosses = JSON.parse(row.detail).senses.map(s => s.gloss).join(' | ');
  assert.match(glosses, /life|person/i);
});

test('function words never produce a difference (object-marker et H0853)', () => {
  const n = db.prepare("SELECT COUNT(*) n FROM differences WHERE strongs LIKE 'H0853%'").get().n;
  assert.equal(n, 0);
});

test('Aramaic participates: at least one arc difference row is emitted', () => {
  const n = db.prepare(`SELECT COUNT(*) n FROM differences d JOIN words w
      ON w.book=d.book AND w.chapter=d.chapter AND w.verse=d.verse AND w.position=d.position
      WHERE w.lang='arc'`).get().n;
  assert.ok(n >= 1, 'expected at least one Aramaic difference row');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd build && node --test test/differences-ot.test.mjs`
Expected: FAIL — `isHebrewContent` not exported / no hbo Type B rows yet.

- [ ] **Step 3: Implement** — edit `build/lib/differences.mjs`:

Change the imports at the top:

```js
import { senseKey, hebrewSenseKey } from './gloss.mjs';
import { baseHeb } from './macula.mjs';
```

Add, next to `isGreekContent`/`grcTop`:

```js
// Hebrew/Aramaic content-word test: a leading H (Hebrew) or A (Aramaic) LANG marker is present only when
// the next char is an uppercase POS letter; strip it, then accept common noun (Nc), verb (V), adjective (A).
// This distinguishes the lang-marker 'A' from the adjective POS 'A' (which is followed by a lowercase class).
export function isHebrewContent(morph) {
  const m = String(morph || '');
  const rest = /^[HA][A-Z]/.test(m) ? m.slice(1) : m;
  return /^(Nc|V|A)/.test(rest);
}
const hebTop = ln => String(ln || '').slice(0, 3);
```

Add a second `runLanguageGroup` call in `computeDifferences`, after the Greek call and before the `CREATE INDEX`:

```js
  runLanguageGroup(db, insD, {
    langs: ['hbo', 'arc'], keyPrefix: 'H', normKey: baseHeb,
    isContent: isHebrewContent, senseKeyFn: hebrewSenseKey, topFn: hebTop,
    typeA: null,   // Type B only in this task; Type A added in Task 6
  });
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd build && node --test test/differences-ot.test.mjs`
Expected: PASS — ruach spirit/wind, nephesh life/person, et never fires, Aramaic participates.

- [ ] **Step 5: Run the Greek regression again (unchanged)**

Run: `cd build && node --test test/differences.test.mjs`
Expected: PASS (adding the hbo/arc group must not touch Greek rows).

- [ ] **Step 6: Commit**

```bash
git add build/lib/differences.mjs build/test/differences-ot.test.mjs
git commit -m "feat(build): Type B (sense-spread) for Hebrew/Aramaic"
```

---

### Task 6: Enable Type A for Hebrew/Aramaic with OT precision filters

**Files:**
- Modify: `build/lib/differences.mjs` (add filter support to `runLanguageGroup`; set the hbo/arc `typeA` config)
- Test: `build/test/differences-ot.test.mjs` (add Type A gold + exclusion fixtures)

**Interfaces:**
- Consumes: `runLanguageGroup` internals from Task 4/5.
- Produces: hbo/arc `differences` Type A rows. `typeA` config gains optional filter flags `{ freqMin, excludeProperNouns, requireDiffSense }`; when set, near-synonym selection additionally requires both members occur ≥ `freqMin`, neither is a proper noun, and their representative cleaned senses differ. Greek (no flags) is unaffected.

- [ ] **Step 1: Write the failing tests** — append to `build/test/differences-ot.test.mjs`:

```js
test('Type A fires on virgin H1330 with young-woman H5291 as a near-synonym', () => {
  const rows = db.prepare("SELECT detail FROM differences WHERE type='A' AND strongs LIKE 'H1330%'").all();
  assert.ok(rows.length >= 1, 'expected a Type A row for virgin H1330 (Isaiah 7:14 pair)');
  const syns = rows.flatMap(r => JSON.parse(r.detail).nearSynonyms.map(s => s.strongs));
  assert.ok(syns.includes('H5291'), 'expected young-woman H5291 among near-synonyms');
});

test('Type A never fires on proper nouns (hamul H2538)', () => {
  const n = db.prepare("SELECT COUNT(*) n FROM differences WHERE type='A' AND strongs LIKE 'H2538%'").get().n;
  assert.equal(n, 0);
});

test('Type A near-synonyms always differ in English sense (no identical-gloss pairs)', () => {
  // spot check: a Hebrew Type A row's used word and its near-synonyms must not share the same cleaned sense.
  const row = db.prepare("SELECT strongs, detail FROM differences WHERE type='A' AND strongs LIKE 'H1330%' LIMIT 1").get();
  const used = hebrewSenseKey('virgin');
  const synKeys = JSON.parse(row.detail).nearSynonyms.map(s => s.strongs);
  assert.ok(!synKeys.includes('H1330'), 'a word is never its own near-synonym');
  assert.ok(synKeys.length >= 1);
});
```

(Add `hebrewSenseKey` to the test imports: `import { hebrewSenseKey } from '../lib/gloss.mjs';`.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd build && node --test test/differences-ot.test.mjs`
Expected: FAIL — no Hebrew Type A rows yet (hbo/arc group has `typeA: null`).

- [ ] **Step 3: Implement the filters** — in `build/lib/differences.mjs`, inside `runLanguageGroup`, add a precompute block **after** the `freq` map and **before** `nearSyn`:

```js
  // --- OT-only Type-A precision filters (empty/no-op unless the group requests them) ---
  const properNoun = new Set();   // base strongs whose majority morph is a proper noun (Np)
  const repSense = new Map();     // base strongs -> representative cleaned sense key (most common gloss)
  if (typeA && typeA.excludeProperNouns) {
    for (const r of db.prepare(`SELECT strongs, SUM(CASE WHEN morph LIKE '%Np%' THEN 1 ELSE 0 END) np, COUNT(*) tot
        FROM words WHERE lang IN (${inClause}) AND strongs<>'' GROUP BY strongs`).all()) {
      const k = normKey(r.strongs); if (k && r.np > r.tot / 2) properNoun.add(k);
    }
  }
  if (typeA && typeA.requireDiffSense) {
    const top = new Map(); // k -> {c, key}
    for (const r of db.prepare(`SELECT strongs, gloss_norm, COUNT(*) c FROM words
        WHERE lang IN (${inClause}) AND gloss_norm<>'' GROUP BY strongs, gloss_norm`).all()) {
      const k = normKey(r.strongs); if (!k) continue;
      const e = top.get(k);
      if (!e || r.c > e.c) top.set(k, { c: r.c, key: senseKeyFn(r.gloss_norm) });
    }
    for (const [k, e] of top) repSense.set(k, e.key);
  }
```

Then extend the `.filter(...)` inside `nearSyn` to apply the flags (replace the existing filter callback):

```js
      out = [...adj.get(strongs)]
        .filter(([o, d]) => d >= typeA.synMin && d <= typeA.synMax
          && lnTop.get(o) === dom && lnFull.get(o) !== sub
          && (!typeA.freqMin || ((freq.get(o) || 0) >= typeA.freqMin && (freq.get(strongs) || 0) >= typeA.freqMin))
          && (!typeA.excludeProperNouns || (!properNoun.has(o) && !properNoun.has(strongs)))
          && (!typeA.requireDiffSense || (repSense.get(o) && repSense.get(strongs) && repSense.get(o) !== repSense.get(strongs))))
        .sort((x, y) => x[1] - y[1]).slice(0, 4)
        .map(([o, d]) => ({ strongs: o, distance: Number(d.toFixed(3)) }));
```

Finally, set the hbo/arc group's `typeA` config (replace `typeA: null` from Task 5):

```js
    typeA: { synMin: SYN_MIN, synMax: SYN_MAX, freqMax: A_FREQ_MAX, freqMin: SENSE_MIN_LEMMA_OCC,
             excludeProperNouns: true, requireDiffSense: true },
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd build && node --test test/differences-ot.test.mjs`
Expected: PASS — virgin↔young-woman fires, hamul never fires, near-synonym invariants hold.

- [ ] **Step 5: Greek regression (Type A filters are gated off for Greek)**

Run: `cd build && node --test test/differences.test.mjs`
Expected: PASS — Greek counts unchanged (Greek `typeA` has no `freqMin`/`excludeProperNouns`/`requireDiffSense`).

- [ ] **Step 6: Commit**

```bash
git add build/lib/differences.mjs build/test/differences-ot.test.mjs
git commit -m "feat(build): Type A (synonym-collapse) for Hebrew/Aramaic with OT precision filters"
```

---

### Task 7: Slim the shipped DB (drop build-only domain tables)

**Files:**
- Modify: `app/scripts/copy-assets.mjs`

**Interfaces:**
- Consumes: nothing new. `word_domain`/`word_sense` are build-only (not queried at runtime — app reads `verses/words/lexicon/cross_refs/differences`).
- Produces: a smaller `app/public/bible.db` that still contains the (now larger) `differences` table.

- [ ] **Step 1: Add the drops** — in `app/scripts/copy-assets.mjs`, next to the existing `DROP TABLE IF EXISTS synonyms;` line (before `VACUUM`), add:

```js
db.exec('DROP TABLE IF EXISTS word_domain;'); // build-only: differences already embeds domains/near-synonyms
db.exec('DROP TABLE IF EXISTS word_sense;');  // build-only
```

Update the explanatory comment at the top of the file to mention `word_domain`/`word_sense` are dropped alongside `synonyms`.

- [ ] **Step 2: Run the copy-assets step and confirm the shipped DB has no domain tables**

Run: `cd app && node scripts/copy-assets.mjs`
Then: `cd app && node --input-type=module -e "import{DatabaseSync}from 'node:sqlite';const db=new DatabaseSync('public/bible.db');console.log(db.prepare(\"SELECT name FROM sqlite_master WHERE type='table' AND name IN('word_domain','word_sense','differences')\").all());"`
Expected: only `differences` present; `word_domain`/`word_sense` absent.

- [ ] **Step 3: Commit**

```bash
git add app/scripts/copy-assets.mjs
git commit -m "chore(app): drop build-only word_domain/word_sense from shipped bible.db"
```

---

### Task 8: Full build, calibration pass, and app verification

**Files:**
- Modify (if calibration requires): `build/lib/differences.mjs` (threshold constants only)

**Interfaces:** none new. This task runs the full gate and tunes constants against fixtures.

- [ ] **Step 1: Full build**

Run: `cd build && npm run build`
Expected: exits 0; prints `validation OK — all books/chapters present`; `word_domain (+Hebrew/Aramaic)` and `differences` counts logged (differences now larger — OT rows added).

- [ ] **Step 2: Full build test suite**

Run: `cd build && npm test`
Expected: all pass — Greek regression + OT fixtures (ruach, nephesh, virgin↔young-woman, exclusions, Aramaic participation).

- [ ] **Step 3: Calibration review (only if a fixture is weak)** — inspect what OT Type A/B actually emit and confirm quality:

Run: `cd build && node --input-type=module -e "import{DatabaseSync}from 'node:sqlite';const db=new DatabaseSync('../data/bible.db');console.log('OT Type A rows:',db.prepare(\"SELECT COUNT(*) n FROM differences WHERE strongs LIKE 'H%' AND type='A'\").get().n);console.log('OT Type B rows:',db.prepare(\"SELECT COUNT(*) n FROM differences WHERE strongs LIKE 'H%' AND type='B'\").get().n);"`

If Type A is too noisy (e.g. the row count is many times the Greek Type A, or spot-checked pairs are low-value), tighten by adjusting **only** the hbo/arc `typeA` constants in `differences.mjs` — raise `freqMin` (8 → 12 → 20) first (the dominant lever), then narrow the band (`synMax` 0.60 → 0.58). Re-run `npm test` after each change; the fixtures must still pass. Do NOT change the Greek constants. Commit any tuning:

```bash
git add build/lib/differences.mjs
git commit -m "tune(build): calibrate OT Type A frequency floor/band against fixtures"
```

- [ ] **Step 4: Regenerate the shipped DB**

Run: `cd app && node scripts/copy-assets.mjs`
Expected: `public/bible.db` rebuilt from the freshly-built `data/bible.db`.

- [ ] **Step 5: App verification (real browser)**

Run: `cd app && npm run dev` (serves http://localhost:5173). Open the app and:
- Navigate to **Genesis 1** — confirm the reader shows OT underlines and the Differences card lists real hbo differences (e.g. a Type B on a Genesis word); the Original card shows Hebrew with correct right-to-left/translit and `hbo` handling.
- Navigate to a **Daniel** chapter (2–7) — confirm `arc` words render and are labeled Aramaic, not mislabeled.
- Navigate to a **Psalm** — confirm Type B words (e.g. nephesh "soul/life", ruach "spirit/wind") surface.
- Confirm a **Greek NT** chapter (e.g. John 21) is unchanged.

Expected: OT chapters show real differences; language handling is correct; Greek unaffected. If the near-synonym buttons on a Hebrew Type A show empty lemmas, verify `getLexicon` resolves base keys like `H5291` (it does in `data/bible.db`); no code change expected.

- [ ] **Step 6: App test suite (regression)**

Run: `cd app && npm test`
Expected: 26/26 pass (app data layer unchanged; differences schema unchanged).

- [ ] **Step 7: Final commit (if any tuning or regen artifacts remain)**

```bash
git add -A
git commit -m "feat: OT (Hebrew/Aramaic) interpretive-difference engine — build + app verified"
```

---

## Self-Review

**Spec coverage** (against `2026-07-07-ot-differences-engine-design.md`):
- §4 key normalization → Task 1 (`baseHeb`). ✓
- §5.1 SDBH loader → Task 3 (`loadHebrewDomains`, wired into build). ✓
- §5.2 language-parameterized engine, Hebrew content test, scheme-aware top domain → Task 4 (refactor) + Task 5 (`isHebrewContent`, `hebTop`). ✓
- §5.2 Type A OT filters (no proper nouns, diff sense, freq floor, cap) → Task 6. ✓
- §5.3 Hebrew gloss cleanup → Task 2 (`hebrewSenseKey`), used in Task 5. ✓
- §5.4 shipped-DB slim → Task 7. ✓
- §3 success criteria (ruach, nephesh, virgin↔young-woman, exclusions, Aramaic participation, Greek regression, app) → Tasks 5/6/8. ✓
- §6 test plan → unit (Tasks 1/2/5) + integration (Tasks 3/5/6) + regression (Task 4/5/6). ✓
- §7 non-goals (homograph blur, verb-inflection residual, no UI change) → respected; no task attempts them. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; every run step states expected output. Calibration (Task 8 Step 3) gives concrete lever order (raise `freqMin`, then narrow band), not "handle edge cases." ✓

**Type consistency:** `baseHeb` (Task 1) used identically in Tasks 3/4/5/6. `runLanguageGroup(db, insD, cfg)` signature stable across Tasks 4→5→6; `cfg.typeA` grows from `{synMin,synMax,freqMax}` (Greek) to `+{freqMin,excludeProperNouns,requireDiffSense}` (Hebrew) — additive, gated by truthiness, Greek path unchanged. `isHebrewContent`/`hebrewSenseKey`/`hebTop` names consistent between definition and use. `word_domain` insert is 6 columns in both the Greek loader and `loadHebrewDomains`. ✓
