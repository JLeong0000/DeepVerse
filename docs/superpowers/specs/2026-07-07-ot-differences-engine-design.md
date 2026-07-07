# OT Interpretive-Difference Engine (Hebrew / Aramaic) — Design

**Project:** DeepVerse · **Date:** 2026-07-07 · **Status:** DESIGN
**Scope:** Extend the precomputed `differences` table (Type A + Type B) from the Greek NT to the
Hebrew/Aramaic OT, using macula-hebrew's SDBH semantic data. Build-side only; no app UI changes
beyond confirming the reader/cards render OT rows with correct `hbo`/`arc` handling.

Prerequisite reading: `build/lib/differences.mjs` (current Greek engine), memory
`differences-engine-calibration`, spec `2026-07-05-study-bible-workflow-design.md` §8, §13.

---

## 1. Motivation & current state

Type A (synonym collapse) and Type B (sense spread) currently cover **Greek NT only**
(`build/lib/differences.mjs`, `WHERE lang='grc'`). Greek works because macula-greek supplies
Louw-Nida (LN) domains + a Strong↔Strong proximity matrix, and Greek interlinear glosses are clean.

The OT is the biggest remaining data gap (START-HERE "what's next" #1). macula-hebrew is already
cloned in `sources/macula-hebrew` as real lowfat XML (no git-lfs fetch needed) and covers **both**
Hebrew and Aramaic.

## 2. Key data findings (validated against the corpus, 2026-07-07)

These findings shaped the design; they are non-obvious and were confirmed by prototype, not assumed.

1. **Hebrew uses SDBH, not Louw-Nida.** Each `<w>` in the lowfat XML carries `lexdomain`
   (hierarchical, variable-length 3-digit groups, e.g. `001005002002001`), `coredomain`
   (space-separated contextual codes), `sensenumber`, `sdbh`, and `strongnumberx`. `lexdomain` is a
   clean structural analog to LN's `domain.subdomain`: **top-level = first 3-digit group**,
   **sub-domain = the full string**.
2. **Aramaic is covered.** Daniel 2: 1,240 `arc` words, ~600 with `lexdomain`, ~520 with
   `sensenumber`. So `arc` gets a real engine, not a stub.
3. **The proximity matrix already spans Hebrew** (`Proximity.tsv`, ~7,530 Hebrew nodes). Distances are
   computed the same way across languages, so the band is broadly transferable (final constants tuned).
4. **Three Strong's key formats must be reconciled** (see §4).
5. **Hebrew morph codes carry an inconsistent leading `H`/`A` language marker** (`HVqp3ms` vs
   `Vqw3ms`). The current `isContent` regex would wrongly exclude ~115k Hebrew nouns/verbs/adjectives.
6. **A naive port of the Greek rules produces mostly noise** — three noise sources Greek never had:
   - **Proper nouns** leak from the proximity matrix (`hamulites↔hamul`, `zephon↔zephonites`).
   - **Construct / pronominal-suffix gloss baggage** creates fake senses (`god`/`god of`/`god your`;
     `heart`/`heart my`).
   - **Identical-gloss "synonyms"** — spelling/dialect variants that are not an interpretive *choice*
     (`trembling↔trembling`, `rebuke↔rebuke`).
   Critically, **band-tuning alone cannot separate signal from noise**: gold (`virgin↔young-woman`
   @0.453 — the Isaiah 7:14 בְּתוּלָה/עַלְמָה pair) sits at the *same distance* as junk
   (`hamulites↔hamul` @0.453). The real levers are the three extra filters in §5, plus a **frequency
   floor**, which cuts Type-A candidate pairs ~3× (1,484 → ~548) while keeping all validated gold.

## 3. Success criteria

`cd build && npm run build` exits 0, and `npm test` passes new OT fixtures:

- **Type B (must-ship):**
  - `ruach` H7307 fires B with senses including **spirit** and **wind** (breath acceptable as a third).
  - `nephesh` H5315 fires B with senses including **life** and **person**.
  - Function words (waw "and", the article, object-marker אֵת) never fire.
- **Type A (best-effort-calibrated):**
  - At least one validated gold pair fires, e.g. `virgin`↔`young-woman` (H1330↔H5291) or
    `iniquity`↔`transgression` (H5771↔H6588).
  - Proper-noun pairs (`hamul`↔`hamulites`) and identical-gloss pairs (`trembling`↔`trembling`)
    never fire.
- **Aramaic:** `arc` words are correctly classified, receive SDBH domains, and are processed by the
  engine (arc difference rows emit where the data supports them). A *clean, gold* arc semantic fixture
  is **not** promised — the 4,827-word Aramaic corpus contains no genuine content-word sense-spread
  (candidates are all verb-inflection artifacts or quantifiers). The arc criterion is correct
  classification + participation, not a specific curated example.
- **App:** opening Genesis and Psalms (`cd app && npm run dev`) shows real OT differences with correct
  `hbo`/`arc` language handling; existing Greek NT differences are unchanged (regression-free).

Type B is the primary deliverable; Type A is shipped calibrated but is understood to be more
approximate than Greek (documented limitation).

## 4. Strong's key normalization

Three formats key the same lemma differently:

| Source | Example | Shape |
|---|---|---|
| `words.strongs` (hbo/arc) | `H7225G`, `H1254A` | `H` + 4 digits + **UPPERCASE** homograph suffix (morphhb) |
| `Proximity.tsv` | `H2416d`, `H5777` | `H` + 4 digits + **lowercase** suffix |
| macula-hebrew `strongnumberx` | `7225`, `0871a`, `4430` | bare digits (variable pad) + lowercase suffix |

The uppercase (morphhb) and lowercase (macula/Clear) suffix schemes come from different projects and
**do not map to each other**, so for Hebrew/Aramaic we normalize to the **base Strong's number**:

```
baseHeb(s) = 'H' + firstToken(s).replace(/^H/i,'').match(/^\d+/)[0].padStart(4,'0')
```

`H7225G` → `H7225`, `H2416d` → `H2416`, `0871a` → `H0871`. Comma-joined multi-Strong glosses
(`"H0001G, H5703"`) take the first token.

**Greek is unchanged.** Greek keys are already canonical (`G0976`) and have no numeric-suffix
ambiguity in this data, so the Greek path keeps its existing `padStrong` handling. `baseHeb()` is the
hbo/arc normalizer only; it is never applied to `G…` keys (which would fail its `H`-prefix
assumption). The language-parameterized walk selects the normalizer by language.

**Tradeoff (documented limitation):** stripping suffixes merges homographs (e.g. חַי "living" vs its
homograph), so a base Strong's gets the SDBH domain of whichever sense loaded first. This is the same
pragmatic simplification the Greek path made implicitly (Greek had no suffixes) and is acceptable for
a precomputed hint layer. Not worth per-occurrence alignment between macula and morphhb tokenizations.

## 5. Engine design

### 5.1 New loader: `build/lib/macula-hebrew.mjs`

Parses `sources/macula-hebrew/WLC/lowfat/*.xml`, extracts per-`<w>` attributes
(`strongnumberx`, `lemma`/`stronglemma`, `english`, `lexdomain`, `coredomain`, `sensenumber`), and
loads rows into the **existing** `word_domain(strongs, lemma, gloss, ln, domain, frame)` table
(first sense per base Strong's wins, mirroring the Greek loader):

- `strongs` = `base(strongnumberx)`
- `ln` = full `lexdomain` string (the SDBH sub-domain analog; no dots)
- `domain` = top-level = first 3-digit group of `lexdomain`
- `lemma`, `gloss` = Hebrew lemma + English gloss (display only)
- `frame` = '' (SDBH has no LN semantic frames)

Called from `build-db.mjs` right after the Greek `word_domain` load. `word_sense` (hbo/arc) may be
loaded analogously from `sensenumber` for future use, but is **not required** by this design.

### 5.2 `differences.mjs` — OT path

Refactor the existing single-language walk into a language-parameterized pass so `grc`, `hbo`, and
`arc` share one code path. Greek behavior must be **byte-for-byte unchanged** (26 app + existing build
tests stay green).

**Shared key handling.** Introduce `base()` (§4). Greek keys are already canonical (`G0976`); `base()`
is a no-op-equivalent for them (Greek Strong's have no numeric-suffix ambiguity in this data).

**`topDomain` becomes scheme-aware.** LN is dotted (`25.43` → top `25`); SDBH is undotted
(`001005…` → top `001`). Compute top from `word_domain.domain` (already the precomputed top) rather
than re-splitting `ln`, so the scheme difference is contained in the loader.

**Hebrew-aware content-word test.** Replace `isContent` with a version that strips a leading `H`/`A`
language marker, then accepts POS in {`Nc` common noun, `V` verb, `A` adjective}, and **excludes**
proper nouns (`Np`), particles (`T`), prepositions (`R`), pronouns/suffixes (`P`, `S`), the article
(`D`), and conjunctions. Greek morphs (no lang marker) keep working through the same function.

**Type A (lang IN hbo, arc):** same shape as Greek — near-synonym (different base Strong's) that
shares top-level `domain` but differs in full `ln`, with proximity distance in `[SYN_MIN, SYN_MAX]` —
**plus** the OT-only filters proven necessary in §2.6:

1. **No proper nouns.** Exclude any base Strong's whose majority morph is `Np`.
2. **Different English sense.** The used word and the near-synonym must reduce to **different cleaned
   sense keys** (§5.3). Drops `trembling↔trembling`-style variants (a real *choice* implies a real
   English difference).
3. **Frequency floor.** Both members occur ≥ `A_FREQ_MIN` (≈ `SENSE_MIN_LEMMA_OCC`, 8). Drops
   hapax/near-hapax proximity noise — the dominant lever.
4. **Frequency cap** `A_FREQ_MAX` recalibrated for Hebrew's steeper Zipf (OT ≈ 305k words vs NT ≈
   138k). Starting point 300; tuned against fixtures.

Band constants (`SYN_MIN`/`SYN_MAX`) start at the Greek values `[0.45, 0.60]` and are tuned TDD; the
floor + sense filter do most of the quality work, so the band stays gentle.

**Type B (lang IN hbo, arc):** identical to Greek — a lemma's cleaned glosses cluster into ≥2 senses,
each ≥ `SENSE_MIN_FRAC` (5%), total ≥ `SENSE_MIN_LEMMA_OCC` (8) — using the Hebrew gloss cleanup
(§5.3) so pronominal-suffix / construct baggage does not inflate sense counts.

### 5.3 Hebrew gloss cleanup: `build/lib/gloss.mjs`

Add a Hebrew-scoped pre-clean applied **only on the hbo/arc path** (the Greek `senseKey`/
`normalizeGloss` and their 26 passing tests are untouched, avoiding NT regressions):

- strip `<...>` markers (`<obj.>`, `<to>`),
- strip trailing pronominal suffix `/my`, `/your`, `/his`, `/her`, `/its`, `/our`, `/their`, and the
  free-pronoun equivalents,
- strip construct `of`,

then reuse the existing `senseKey` stemmer. Effect (validated): `god`/`god of`/`god your` → one sense;
`spirit`/`wind`/`breath` stay three; `dabar` surfaces `word` + `matters`.

### 5.4 Shipped-DB slimming: `app/scripts/copy-assets.mjs`

`word_domain` (and `word_sense`) are build-only and not queried at runtime, but currently still ship.
Adding OT rows would bloat them, so **add `DROP TABLE word_domain; DROP TABLE word_sense;`** to the
copy-assets slim step (alongside the existing `synonyms` drop) before `VACUUM`. The runtime payload is
the precomputed `differences` table, which grows with OT rows as intended.

## 6. Testing (TDD)

Build-side, `build/test/*.test.mjs`, `node --test --test-concurrency=1`:

1. **Unit — `base()`**: the three key formats normalize to the same `H####`.
2. **Unit — Hebrew content test**: `HVqp3ms`/`HNcmpa` = content; `Np`/`HTo`/`Sp`/`HR` = not.
3. **Unit — Hebrew gloss cleanup**: `god of`→`god`; `heart/ my`→`heart`; `spirit`≠`wind`.
4. **Integration (on built DB) — Type B fixtures**: ruach H7307 (spirit+wind), nephesh H5315
   (life+person); object-marker/waw never fire.
   **Aramaic**: assert `arc` words carry SDBH domains and that the engine emits ≥1 `arc` difference
   row (participation check, per §3 — no curated arc semantic fixture).
5. **Integration — Type A fixtures**: a gold pair fires (virgin↔young-woman or iniquity↔transgression);
   proper-noun and identical-gloss pairs never fire.
6. **Regression**: Greek fixtures (agapaō/phileō A, psyche B, kai never) unchanged; total Greek row
   count within tolerance of the pre-change baseline.

Thresholds are finalized by iterating these fixtures (the "tune against fixtures" step), matching how
the Greek engine was calibrated.

## 7. Non-goals / deferred

- No use of SDBH `coredomain` beyond `lexdomain` (contextual codes not needed for this cut).
- No per-occurrence macula↔morphhb alignment (base-Strong's join is the accepted simplification).
- No app UI changes; Type A/B rendering already exists and is language-agnostic.
- Homograph domain-blur (§4) accepted, not resolved.
- **Verb-inflection residual in Type B** (`say`/`said`, `see`/`saw` read as two senses because the
  coarse stemmer misses irregular/ablaut forms) is accepted, matching the existing Greek engine's
  documented residual. Improving the stemmer is out of scope. This is why no `arc` verb is used as a
  fixture.
- Type A parity with Greek quality is explicitly not promised; Type B is the primary deliverable.

## 8. Files touched

- **new** `build/lib/macula-hebrew.mjs` — SDBH loader → `word_domain` (hbo/arc).
- `build/build-db.mjs` — call the loader after the Greek `word_domain` load.
- `build/lib/differences.mjs` — language-parameterized walk; `base()`; scheme-aware top domain;
  Hebrew content test; OT Type-A filters (no-names, diff-sense, freq floor, recalibrated cap).
- `build/lib/gloss.mjs` — Hebrew-scoped gloss cleanup helper.
- `build/test/*.test.mjs` — new unit + integration fixtures.
- `app/scripts/copy-assets.mjs` — drop `word_domain`/`word_sense` from the shipped DB.
