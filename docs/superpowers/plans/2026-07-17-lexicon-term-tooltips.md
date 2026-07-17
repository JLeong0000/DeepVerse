# Lexicon Term Tooltips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add hover tooltips that explain scholarly notation (verb stems, grammar terms, source sigla, symbols) inside the lexicon definitions shown in the app.

**Architecture:** A static glossary map plus a pure `tokenizeGlossary(text)` matcher in `app/src/lib/glossary.js`; a `GlossTerm.svelte` popover component and a `GlossedText.svelte` wrapper that renders tokenized text; three one-line wire-ups at the sites that render definitions. No `{@html}`, no `bible.db`/build changes.

**Tech Stack:** Svelte 5 (runes: `$props`, `$state`), Vitest, plain ES modules.

## Global Constraints

- Svelte 5 runes only (`$props()`, `$state()`), matching existing components (see `PlayButton.svelte`).
- Tests use Vitest: `import { test, expect, describe } from 'vitest'`; run with `npm test` (= `vitest run`) from `app/`.
- Desktop-only interaction: hover + keyboard focus. No tap/touch logic.
- Styling reuses existing CSS custom properties (`--dim`, card background vars). Scoped `<style>` blocks.
- No change to `bible.db`, `build/`, `.gz` intermediates, or `install.sh` (glossary is app source, not corpus data).
- Match is **case-sensitive**. Pure-alpha keys → `\bkey\b`; `.`-suffixed abbrevs → `\bkey`; symbols → bare.

---

### Task 1: Glossary data + matcher

**Files:**
- Create: `app/src/lib/glossary.js`
- Test: `app/src/lib/glossary.test.js`

**Interfaces:**
- Produces: `GLOSSARY` (object: key → `{ label: string, text: string }`) and `tokenizeGlossary(text: string) => Array<{ plain: string } | { term: string }>`. A `term` segment's `term` is the matched surface string, which is always exactly a `GLOSSARY` key.

- [ ] **Step 1: Write the failing test**

Create `app/src/lib/glossary.test.js`:

```js
import { test, expect, describe } from 'vitest';
import { GLOSSARY, tokenizeGlossary } from './glossary.js';

describe('tokenizeGlossary', () => {
  test('matches a bracketed stem label, keeping the parens as plain text', () => {
    expect(tokenizeGlossary('1a) (Qal)')).toEqual([
      { plain: '1a) (' },
      { term: 'Qal' },
      { plain: ')' },
    ]);
  });

  test('matches an inline grammar term', () => {
    expect(tokenizeGlossary('with accusative of')).toEqual([
      { plain: 'with ' },
      { term: 'accusative' },
      { plain: ' of' },
    ]);
  });

  test('matches a symbol', () => {
    expect(tokenizeGlossary('Mat.5:43 †')).toEqual([
      { plain: 'Mat.5:43 ' },
      { term: '†' },
    ]);
  });

  test('does not match a key inside a longer word', () => {
    expect(tokenizeGlossary('Qalander')).toEqual([{ plain: 'Qalander' }]);
  });

  test('does not match "v." inside a verse-ref book abbrev "Rev."', () => {
    expect(tokenizeGlossary('Rev.12:11')).toEqual([{ plain: 'Rev.12:11' }]);
  });

  test('matches multiple terms in order', () => {
    const out = tokenizeGlossary('(Niphal) ... LXX');
    expect(out.filter(s => s.term).map(s => s.term)).toEqual(['Niphal', 'LXX']);
  });

  test('handles a term at the very start and end', () => {
    expect(tokenizeGlossary('Qal and Piel')).toEqual([
      { term: 'Qal' },
      { plain: ' and ' },
      { term: 'Piel' },
    ]);
  });

  test('a string with no glossary term is one plain segment', () => {
    expect(tokenizeGlossary('a province of Palestine')).toEqual([
      { plain: 'a province of Palestine' },
    ]);
  });

  test('every GLOSSARY entry has a non-empty label and text', () => {
    for (const [k, v] of Object.entries(GLOSSARY)) {
      expect(v.label, k).toBeTruthy();
      expect(v.text, k).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/lib/glossary.test.js`
Expected: FAIL — `Failed to resolve import "./glossary.js"` (file does not exist yet).

- [ ] **Step 3: Write the glossary data + matcher**

Create `app/src/lib/glossary.js`:

```js
// Plain-English explanations for the scholarly notation in STEPBible lexicon definitions.
// Keyed by the exact surface string as it appears in the text (case-sensitive). Shown as hover
// tooltips by GlossTerm.svelte via GlossedText.svelte. This is UI copy, not corpus data — it is
// deliberately NOT in bible.db (see docs/DATA-PIPELINE.md; a table would need the vendor pipeline).
export const GLOSSARY = {
  // --- Hebrew verb stems (binyanim) ---
  'Qal':        { label: 'Qal',        text: 'Simple active verb stem — the basic, plain action ("he broke").' },
  'Niphal':     { label: 'Niphal',     text: 'Simple passive or reflexive stem ("he was broken", "he broke himself").' },
  'Piel':       { label: 'Piel',       text: 'Intensive or resultative active stem ("he smashed").' },
  'Pual':       { label: 'Pual',       text: 'Intensive passive stem ("it was smashed").' },
  'Hiphil':     { label: 'Hiphil',     text: 'Causative active stem ("he caused/made someone break").' },
  'Hophal':     { label: 'Hophal',     text: 'Causative passive stem ("he was made to break").' },
  'Hithpael':   { label: 'Hithpael',   text: 'Reflexive or reciprocal intensive stem ("he broke himself", "they broke one another").' },
  'Polel':      { label: 'Polel',      text: 'Intensive active stem that stands in for Piel with hollow/geminate roots.' },
  'Poel':       { label: 'Poel',       text: 'A rarer active stem parallel to Piel, used with certain root types.' },
  'Polal':      { label: 'Polal',      text: 'Passive counterpart of the Polel stem.' },
  'Pilpel':     { label: 'Pilpel',     text: 'Intensive stem formed by reduplicating the root, used with certain roots.' },
  'Pulal':      { label: 'Pulal',      text: 'Passive counterpart of the Pilpel/Pilel stem.' },
  'Hithpolel':  { label: 'Hithpolel',  text: 'Reflexive stem parallel to Hithpael, used with hollow roots.' },
  'Hithpalpel': { label: 'Hithpalpel', text: 'Reflexive of the reduplicated (Pilpel) stem.' },
  'Pilel':      { label: 'Pilel',      text: 'A rare intensive active stem variant.' },
  'Palel':      { label: 'Palel',      text: 'A rare intensive stem variant.' },
  'Tiphel':     { label: 'Tiphel',     text: 'A rare stem prefixed with taw, of debated causative sense.' },
  // --- Aramaic verb stems ---
  'Pael':       { label: 'Pael',       text: 'Aramaic intensive active stem (the Aramaic counterpart of Hebrew Piel).' },
  'Aphel':      { label: 'Aphel',      text: 'Aramaic causative active stem (counterpart of Hebrew Hiphil).' },
  'Ithpael':    { label: 'Ithpael',    text: 'Aramaic reflexive/passive of the intensive stem.' },
  'Shaphel':    { label: 'Shaphel',    text: 'Aramaic causative stem formed with a shin prefix.' },

  // --- Grammar terms ---
  'accusative': { label: 'accusative', text: 'The direct-object case — the noun receiving the action.' },
  'genitive':   { label: 'genitive',   text: 'The "of" case — possession, source, or relationship.' },
  'dative':     { label: 'dative',     text: 'The "to/for" case — usually the indirect object.' },
  'aor.':       { label: 'aor. (aorist)', text: 'Greek tense for a simple, undefined past action, viewed as a whole.' },
  'impf.':      { label: 'impf. (imperfect)', text: 'Tense for ongoing or repeated past action ("was breaking").' },
  'pf.':        { label: 'pf. (perfect)', text: 'Completed past action with a continuing present result.' },
  'plpf.':      { label: 'plpf. (pluperfect)', text: 'A past action completed before another past point ("had broken").' },
  'pass.':      { label: 'pass. (passive)', text: 'Voice in which the subject receives the action.' },
  'mid.':       { label: 'mid. (middle)', text: 'Greek voice where the subject acts on or for itself.' },
  'act.':       { label: 'act. (active)', text: 'Voice in which the subject performs the action.' },
  'ptcp.':      { label: 'ptcp. (participle)', text: 'A verbal adjective ("breaking", "broken").' },
  'subst.':     { label: 'subst. (substantive)', text: 'A word used as a noun.' },
  'fig.':       { label: 'fig. (figurative)', text: 'Used non-literally, as a figure of speech.' },
  'metaph.':    { label: 'metaph. (metaphorically)', text: 'Used as a metaphor rather than literally.' },
  'absol.':     { label: 'absol. (absolutely)', text: 'Used on its own, without an object or complement.' },
  'comp.':      { label: 'comp. (comparative)', text: 'The "-er / more" form of an adjective or adverb.' },
  'intr.':      { label: 'intr. (intransitive)', text: 'A verb used without a direct object.' },
  'constr.':    { label: 'constr. (construct)', text: 'Hebrew "bound" noun form, joining to a following noun ("king-of").' },
  'abs.':       { label: 'abs. (absolute)', text: 'Hebrew free-standing noun form (opposite of construct).' },
  'denom.':     { label: 'denom. (denominative)', text: 'A verb derived from a noun.' },
  'cf.':        { label: 'cf. (confer)', text: 'Latin "compare" — see this related item.' },
  'ib.':        { label: 'ib. (ibidem)', text: 'Latin "in the same place" — the reference just cited.' },
  'q.v.':       { label: 'q.v. (quod vide)', text: 'Latin "which see" — look this term up elsewhere.' },
  'v.':         { label: 'v. (vide)', text: 'Latin "see".' },
  'SYN.':       { label: 'SYN.', text: 'Synonym — a word close in meaning, discussed for contrast.' },

  // --- Sources / sigla ---
  'LXX':    { label: 'LXX (Septuagint)', text: 'The ancient Greek translation of the Old Testament.' },
  'MT':     { label: 'MT (Masoretic Text)', text: 'The standard traditional Hebrew text of the Old Testament.' },
  'NT':     { label: 'NT', text: 'The New Testament.' },
  'AS':     { label: 'AS (Abbott-Smith)', text: 'Abbott-Smith, A Manual Greek Lexicon of the New Testament — the source of these Greek entries.' },
  'MM':     { label: 'MM (Moulton-Milligan)', text: 'Moulton & Milligan, The Vocabulary of the Greek New Testament, illustrated from the papyri.' },
  'VGT':    { label: 'VGT', text: 'The Vocabulary of the Greek Testament (Moulton & Milligan).' },
  'LS':     { label: 'LS (Liddell-Scott)', text: 'Liddell & Scott, A Greek-English Lexicon — the standard classical Greek dictionary.' },
  'Thayer': { label: 'Thayer', text: "Thayer's Greek-English Lexicon of the New Testament." },
  'Cremer': { label: 'Cremer', text: "Cremer's Biblico-Theological Lexicon of New Testament Greek." },
  'Trench': { label: 'Trench', text: "Trench's Synonyms of the New Testament." },
  'BDB':    { label: 'BDB', text: 'Brown-Driver-Briggs, A Hebrew and English Lexicon of the Old Testament.' },
  'TWOT':   { label: 'TWOT', text: 'Theological Wordbook of the Old Testament.' },
  'Boisacq':{ label: 'Boisacq', text: "Boisacq's Dictionnaire étymologique de la langue grecque (Greek etymology)." },
  'CLBL':   { label: 'CLBL', text: 'A Concise Lexicon of the Biblical Languages (the STEPBible reference lexicon).' },

  // --- Symbols (only standalone glyphs that never occur inside a word) ---
  '†': { label: '† (dagger)', text: 'Marks that every New Testament occurrence of the word is cited above.' },
  '§': { label: '§ (section)', text: 'Introduces a section — for a proper name, the traditional meaning of the name.' },
};

// Longest key first so a longer key wins over any shorter overlap (e.g. "Hithpolel" before "Polel").
const KEYS = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Pure-alpha keys need both boundaries (so "Qal" doesn't match inside "Qalander").
// Keys ending in "." need a leading boundary only (so "v." doesn't match inside "Rev.");
// the trailing "." is a literal. Symbols match bare.
function keyPattern(k) {
  if (!/^[A-Za-z]/.test(k)) return escapeRe(k);        // symbol
  if (k.endsWith('.')) return '\\b' + escapeRe(k);     // abbreviation ending in "."
  return '\\b' + escapeRe(k) + '\\b';                  // pure alphabetic
}

const RE = new RegExp('(' + KEYS.map(keyPattern).join('|') + ')', 'g');

// Split text into { plain } / { term } segments. A term segment's `term` is the exact GLOSSARY key.
export function tokenizeGlossary(text) {
  const s = String(text ?? '');
  const out = [];
  let last = 0;
  let m;
  RE.lastIndex = 0;
  while ((m = RE.exec(s)) !== null) {
    if (m.index > last) out.push({ plain: s.slice(last, m.index) });
    out.push({ term: m[0] });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ plain: s.slice(last) });
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run src/lib/glossary.test.js`
Expected: PASS (9 tests).

- [ ] **Step 5: Run the full suite to confirm nothing else broke**

Run: `cd app && npm test`
Expected: PASS (existing `display.test.js` etc. still green).

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/glossary.js app/src/lib/glossary.test.js
git commit -m "feat(glossary): term glossary + tokenizeGlossary matcher

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Tooltip components

**Files:**
- Create: `app/src/components/common/GlossTerm.svelte`
- Create: `app/src/components/common/GlossedText.svelte`

**Interfaces:**
- Consumes (from Task 1): `GLOSSARY`, `tokenizeGlossary`.
- Produces: `<GlossTerm term={string} />` and `<GlossedText text={string} />` (default exports of the two Svelte files).

- [ ] **Step 1: Create `GlossTerm.svelte`**

```svelte
<script>
  import { GLOSSARY } from '../../lib/glossary.js';

  let { term } = $props();
  const entry = GLOSSARY[term];

  let el;                                             // the underlined term span
  let open = $state(false);
  let pos = $state({ left: 0, top: 0, above: true }); // fixed-position coords for the popover

  function show() {
    if (!entry || !el) return;
    const r = el.getBoundingClientRect();
    const above = r.top > 140;                        // enough room above? else flip below
    pos = {
      left: Math.min(Math.max(8, r.left), window.innerWidth - 268),
      top: above ? r.top - 6 : r.bottom + 6,
      above,
    };
    open = true;
  }
  function hide() { open = false; }
</script>

{#if entry}
  <span
    class="gterm"
    bind:this={el}
    role="note"
    tabindex="0"
    onmouseenter={show}
    onmouseleave={hide}
    onfocus={show}
    onblur={hide}
  >{term}{#if open}
      <span class="gpop" class:above={pos.above} style="left:{pos.left}px; top:{pos.top}px;">
        <span class="glabel">{entry.label}</span>
        <span class="gtext">{entry.text}</span>
      </span>
    {/if}</span>
{:else}{term}{/if}

<style>
  .gterm {
    border-bottom: 1px dotted var(--dim);
    cursor: help;
    position: relative;
  }
  .gpop {
    position: fixed;
    z-index: 50;
    max-width: 260px;
    padding: 7px 9px;
    border-radius: 6px;
    background: var(--card, #1b2436);
    border: 1px solid var(--line, #33415c);
    box-shadow: 0 6px 20px rgba(0, 0, 0, .4);
    font-size: 12px;
    line-height: 1.45;
    color: var(--fg, #e6ecf5);
    pointer-events: none;                             /* popover never eats the hover */
    white-space: normal;
  }
  .gpop.above { transform: translateY(-100%); }       /* sit above the term */
  .glabel { display: block; font-weight: 700; margin-bottom: 2px; }
  .gtext { display: block; color: var(--dim); }
</style>
```

- [ ] **Step 2: Create `GlossedText.svelte`**

```svelte
<script>
  import { tokenizeGlossary } from '../../lib/glossary.js';
  import GlossTerm from './GlossTerm.svelte';

  let { text } = $props();
  let segments = $derived(tokenizeGlossary(text));
</script>

{#each segments as seg}{#if seg.term}<GlossTerm term={seg.term} />{:else}{seg.plain}{/if}{/each}
```

- [ ] **Step 3: Verify the app still builds**

Run: `cd app && npm run build`
Expected: build succeeds with no Svelte compile errors.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/common/GlossTerm.svelte app/src/components/common/GlossedText.svelte
git commit -m "feat(glossary): GlossTerm popover + GlossedText wrapper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Wire the three render sites

**Files:**
- Modify: `app/src/components/workbench/OriginalCard.svelte` (import + lines 66, 67)
- Modify: `app/src/components/home/WordSearch.svelte` (import + lines 90, 92)
- Modify: `app/src/components/home/WordOfDay.svelte` (import + line 55)

**Interfaces:**
- Consumes (from Task 2): `<GlossedText text={string} />`.

- [ ] **Step 1: Wire `OriginalCard.svelte`**

Add to the imports at the top of `<script>` (after the existing component imports, e.g. the `PlayButton` import line):

```svelte
  import GlossedText from '../common/GlossedText.svelte';
```

Replace the lead line (currently `<div class="lead">{s.text}</div>`):

```svelte
            <div class="lead"><GlossedText text={s.text} /></div>
```

Replace the sense line (currently `<div class="sense lv{s.level}"><span class="mk">{s.marker}</span> {s.text}</div>`):

```svelte
            <div class="sense lv{s.level}"><span class="mk">{s.marker}</span> <GlossedText text={s.text} /></div>
```

- [ ] **Step 2: Wire `WordSearch.svelte`**

Add to the imports at the top of `<script>`:

```svelte
  import GlossedText from '../common/GlossedText.svelte';
```

Replace the lead line (currently `<div class="lead">{s.text}</div>`):

```svelte
            <div class="lead"><GlossedText text={s.text} /></div>
```

Replace the sense line (currently `<div class="dsense lv{s.level}"><span class="mk">{s.marker}</span> {s.text}</div>`):

```svelte
            <div class="dsense lv{s.level}"><span class="mk">{s.marker}</span> <GlossedText text={s.text} /></div>
```

- [ ] **Step 3: Wire `WordOfDay.svelte`**

Add to the imports at the top of `<script>`:

```svelte
  import GlossedText from '../common/GlossedText.svelte';
```

Replace line 55 (currently `{#if def}<p class="def">{def}</p>{/if}`):

```svelte
            {#if def}<p class="def"><GlossedText text={def} /></p>{/if}
```

- [ ] **Step 4: Build**

Run: `cd app && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Verify in the running app**

Run: `cd app && npm run dev`, open http://localhost:5173.

Check all three sites:
1. **OriginalCard** — open a verse in Study, click a Hebrew word that resolves to `H3372G` (e.g. search leads to the "to fear" card). The definition shows `(Qal)`, `(Niphal)`, `(Piel)`, `(TWOT)` with dotted underlines; hovering each shows the correct popover; the popover does not clip at the window edge.
2. **WordOfDay** (home) — the condensed definition underlines any glossary terms it contains.
3. **WordSearch** (home) — search a Greek word (e.g. "love" → `ἀγαπάω`); its definition underlines `accusative`, `LXX`, `SYN.`, `†`, and hovering explains each.

Confirm no layout breakage (terms stay inline, lines wrap normally).

- [ ] **Step 6: Commit**

```bash
git add app/src/components/workbench/OriginalCard.svelte app/src/components/home/WordSearch.svelte app/src/components/home/WordOfDay.svelte
git commit -m "feat(glossary): show term tooltips in the three definition views

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Notes for the implementer

- **Three symbols are intentionally excluded** — do not add them without addressing the reason:
  - `*` — its precise editorial meaning in these entries could not be grounded; do not invent one.
  - `=` — a bare equals sign appears too broadly; underlining every `=` is visual noise, and the adjacent `§` already flags the name-meaning construction.
  - `א` — Hebrew aleph as a manuscript siglum, but it also occurs *inside* Hebrew words embedded in Greek entries (e.g. `אהב`), so a bare match would wrongly underline those letters. Matching only an isolated siglum reliably is out of scope for v1.
- **`bind:this` + `getBoundingClientRect`** run client-side; this app has no SSR, so `window` is always available in the handlers.
- The `.gpop` colors use `var(--card, …)` etc. with fallbacks. If the app already defines a tooltip/card surface variable, prefer it; otherwise the fallbacks match the app's navy theme.
