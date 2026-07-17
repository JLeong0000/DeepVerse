# Lexicon term tooltips

## Goal

The parsed lexicon definitions shown in the app are dense with scholarly
notation an English-only reader can't decode — verb stems (`Qal`, `Niphal`),
grammar terms (`accusative`, `aor.`), source sigla (`LXX`, `AS`, `MM`), and
symbols (`†`, `§`). Add hover tooltips that explain each such term in place,
across every site that renders a definition.

Desktop-only app: hover-triggered, custom-styled popover. No touch/tap logic.

## Scope

**In:** a fixed glossary of ~65 hand-authored terms (verb stems, grammar
abbreviations, source sigla, symbols) matched inside the definition text — both
bracketed labels like `(Qal)` and inline terms like `accusative`, `aor.`, `†`.

**Out (deliberately):**
- Greek classical-author citations (Homer, Plato, Euripides…) — endless tail,
  self-evident, no glossary value.
- Outline letters `(a) (b) (s)` — structural markers, not terms.
- Turning Strong's cross-refs `(H2460)` and verse refs `Mat.5:43` into links —
  a separate, later piece of work.
- SDBH uppercase domain tags (`(DANGER)` etc.) — only 4 distinct across the
  whole lexicon; folded in for free if a key happens to match, not designed for.

## Build-pipeline impact: none

The glossary is **hand-authored app source** (`app/src/lib/glossary.js`), not
corpus data. It is **not** a `bible.db` table and **not** derived from any raw
source in `backup-data/`. Therefore the `DATA-PIPELINE.md` §49 "new data source"
rule does **not** apply: no `.gz` intermediate, no `build-db.mjs` table, no
`install.sh` change. It ships like any other `.js` file via `npm install` +
Vite, and a fresh clone gets it automatically because it is committed source.
(Storing it in `bible.db` instead would drag 65 tiny UI entries through the
whole vendor pipeline for no benefit — static JS is the simpler, lower-friction
choice.)

## Architecture

Approach: **tokenize + a shared render component.** Matching is a pure data map
plus a pure function; rendering is one small component reused at all three sites.
No `{@html}` injection (can't host an interactive Svelte popover cleanly, and is
an XSS footgun even on semi-trusted text).

### 1. Glossary data — `app/src/lib/glossary.js`

A static map, surface form → `{ label, text }`:

```js
export const GLOSSARY = {
  'Qal':        { label: 'Qal',            text: 'Simple active verb stem — the basic, unmodified action ("he broke").' },
  'Niphal':     { label: 'Niphal',         text: 'Simple passive or reflexive stem ("he was broken / broke himself").' },
  'accusative': { label: 'accusative',     text: 'The direct-object case — the noun receiving the action.' },
  'LXX':        { label: 'LXX (Septuagint)', text: 'The ancient Greek translation of the Old Testament.' },
  '†':          { label: '† (dagger)',     text: 'Marks that every New Testament occurrence of the word is cited above.' },
  // …
};
```

Four categories, ~65 entries:

- **Verb stems (~22):** Hebrew Qal, Niphal, Piel, Pual, Hiphil, Hophal,
  Hithpael, Polel, Poel, Pilpel, Hithpolel, Pulal…; Aramaic Peal, Pael, Aphel,
  Ithpeal…
- **Grammar (~25):** accusative, genitive, dative; aor., impf., pf., plpf.,
  pass., mid., act.; ptcp., subst., fig., metaph., absol., comp., intr.,
  constr., abs.; cf., ib., v., q.v., SYN., denom.
- **Sigla / sources (~14):** LXX, MT, NT, AS (Abbott-Smith), MM / VGT
  (Moulton-Milligan), LS (Liddell-Scott), Thayer, Cremer, Trench, BDB, TWOT,
  Boisacq, CLBL (A Concise Lexicon of the Biblical Languages — the STEPBible
  reference). The trailing `(AS)` attribution on every Greek entry is
  tooltipped like any other siglum, **not** suppressed.
- **Symbols (2):** `†` (all-NT-occurrences), `§` (section / name meaning). Only
  standalone glyphs that never occur inside a word. `*`, `=`, and `א` are
  **excluded** — see the grounding note.

**Grounding & excluded symbols:**
- `*` — precise editorial meaning not confidently known; **left out** rather than
  guessed (per the project's anti-hallucination rule).
- `=` — a bare equals sign is too broad; underlining every `=` is noise, and the
  adjacent `§` already flags the name-meaning construction.
- `א` — Hebrew aleph as a Codex Sinaiticus siglum, but it also appears *inside*
  Hebrew words embedded in Greek entries (`אהב`), so a bare match false-underlines
  those letters. Reliable isolated-siglum matching is out of scope for v1.

Every included entry — such as `CLBL` (A Concise Lexicon of the Biblical
Languages, confirmed) — is standard, checkable fact.

### 2. Matcher — `tokenizeGlossary(text)` (same file)

Pure function, `string → segment[]`.

- Build one regex alternation from the glossary keys, **longest key first** (so
  `Hithpael` wins over any shorter overlap).
- **Pure-alphabetic keys** (`Qal`, `accusative`, `LXX`) get **both** word
  boundaries (`\bkey\b`) — the trailing `\b` prevents `Qal` matching inside
  `Qalander`.
- **Abbreviations ending in `.`** (`aor.`, `cf.`, `v.`, `SYN.`) get a **leading**
  `\b` only; the trailing `.` is a literal (itself a non-word char, so no
  trailing anchor is needed). The leading `\b` prevents `v.` matching inside
  `Rev.` (no boundary between `e` and `v`) — critical, since verse-ref book
  abbreviations are everywhere.
- **Bare symbols** (`†`, `§`, `=`, `א`) match literally, no boundary.
- **Case-sensitive**, so `AS` / `LXX` / `MT` don't fire inside lowercase words.
- Returns segments: `[{ plain: 'with ' }, { term: 'accusative' }, { plain: ' of thing(s)' }]`.
  A `term` segment carries the glossary key; the component looks up label + text.
- **Bracketed labels fall out for free:** in `1a) (Qal)`, the key `Qal` matches
  inside the parens; the parentheses remain plain text around the matched term.

### 3. Components

- **`GlossedText.svelte`** — prop `text`.
  `{#each tokenizeGlossary(text) as seg}` → render `seg.plain` as text, or a
  `<GlossTerm>` for `seg.term`.
- **`GlossTerm.svelte`** — props `term` (the key). Looks up `GLOSSARY[term]`,
  renders the surface word with a dotted underline; `mouseenter` / `focus` shows
  a positioned popover, `mouseleave` / `blur` hides it. Edge-aware: flips
  above/below (and clamps horizontally) so it doesn't clip at the viewport edge.
  Desktop hover/focus only — no tap handling.

### 4. Wire-up (three one-line swaps)

| Site | Line(s) | Change |
|---|---|---|
| `app/src/components/workbench/OriginalCard.svelte` | 66, 67 | `{s.text}` → `<GlossedText text={s.text} />` |
| `app/src/components/home/WordSearch.svelte` | 90, 92 | `{s.text}` → `<GlossedText text={s.text} />` |
| `app/src/components/home/WordOfDay.svelte` | 55 | `{def}` → `<GlossedText text={def} />` |

All three already route their text through `parseDefinition` / `shortDefinition`
(`display.js`), so `tokenizeGlossary` operates on the same already-parsed strings.

### 5. Styling

- Term: `border-bottom: 1px dotted var(--dim)`, `cursor: help`.
- Popover: `position: absolute`, app navy background, subtle border + shadow,
  `max-width: 260px`, small font; bold label line, then the explanation. Reuse
  existing card theme variables. `z-index` above the card.

## Testing

`app/src/lib/glossary.test.js` (Vitest, matching `display.test.js`):

- bracketed label match — `1a) (Qal)` → segment `{term:'Qal'}` with parens intact
- inline term — `with accusative of` → `{term:'accusative'}`
- symbol — `Mat.5:43 †` → `{term:'†'}`
- no false match inside a word — `Qalander` yields no `Qal` term
- no false match in a verse-ref abbrev — `Rev.12:11` yields no `v.` term
- multiple terms in one string, in order
- term at string start and end
- no-match string → single plain segment

## Success criteria

1. `glossary.test.js` passes (all cases above green).
2. In-app: opening the `H3372G` word card, the definition shows `(Qal)`,
   `(Niphal)`, `(Piel)`, `(TWOT)` with dotted underlines; hovering each shows the
   correct explanation popover.
3. A Greek entry (e.g. `G0025 ἀγαπάω`) shows tooltips on `accusative`, `LXX`,
   `†`, `SYN.`, etc.
4. `WordOfDay` and `WordSearch` show the same tooltips with no layout breakage.
5. No `.gz`, `build-db.mjs`, or `install.sh` change (see Build-pipeline impact).
