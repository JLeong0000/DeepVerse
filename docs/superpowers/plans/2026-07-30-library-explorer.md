# Library Explorer (`#/library`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browsable, search-first explorer at `#/library` over the Tyndale corpus already in `bible.db`, where the breadcrumb is the navigation stack and Tyndale's own cross-references are the way through.

**Architecture:** Single column, one surface at a time (start → a route's index → an article), under a persistent frame holding the search field and breadcrumb. A new computed `dict_xref` table (5,236 rows) powers the cross-reference doors and the path map. All rendering is Svelte 5 runes; all data is SQL against the in-memory sql.js database.

**Tech Stack:** Svelte 5 (runes), sql.js, Vite, Vitest (app), `node --test` (build), `node:sqlite` (build).

**Spec:** `docs/superpowers/specs/2026-07-30-library-explorer-design.md`
**Mockup:** `docs/mockups/library.html` — interactive, matches the approved design. Consult it for layout and copy.

## Global Constraints

- **Theme variables only.** `--dim`, `--ink`, `--rule`, `--panel`, `--bg`, `--a`, `--b`. Never hardcode a colour. Verify **both** light and dark. SVG takes colours via CSS classes, never presentation attributes.
- **Before adding any CSS class, grep that component's `<style>` for the name.** A `class:empty` collision silently inherited an unrelated rule in Phase 1.
- **Book codes are OSIS** throughout `bible.db` (`Gen`, `1Chr`, `Song`, `1Thess`, `Matt`, `Rev`).
- **Desktop-only.** Hover is fine. No touch-specific logic.
- **No new npm dependencies.** The path map is hand-rolled SVG.
- **`backup-data/` is never an install input.** A fresh clone must rebuild `bible.db` from committed files alone.
- **After any DB rebuild, run `npm run copy-assets` in `app/`** — it re-copies the slimmed DB and republishes the content hash that busts the service worker's cache.
- **Cross-references are linkified only inside a `See …` clause**, never in loose prose. `Calf`, `Clay`, `Hour`, `Evening`, `Command` are all real article titles.
- **Title de-inversion uses an exact allowlist**, never a prefix or a general rule.
- Existing suites must stay green: `npm test` in `build/` and in `app/`.

## File Structure

**Build (derives and stores the cross-reference graph):**

| File | Responsibility |
|---|---|
| `build/lib/xref.mjs` *(new)* | Pure resolver: normalisation, index building, `See …` clause parsing, 4-tier resolution, edge extraction |
| `build/test/xref.test.mjs` *(new)* | Tier-by-tier tests + regression guards |
| `build/lib/tyndale.mjs` *(modify)* | `loadXrefs(db, articles)` inserts the derived rows |
| `build/build-db.mjs` *(modify)* | `CREATE TABLE dict_xref` + indexes; call `loadXrefs` |
| `build/validate-db.mjs` *(modify)* | Post-build invariants for `dict_xref` |

**App (queries, state, UI):**

| File | Responsibility |
|---|---|
| `app/src/lib/titles.js` *(new)* | `displayTitle()` — the de-inversion allowlist |
| `app/src/lib/titles.test.js` *(new)* | De-inversion tests, including the must-not-change guards |
| `app/src/lib/db.js` *(modify)* | Browse, search, xref and random-article queries |
| `app/src/lib/library.svelte.js` *(new)* | The navigation stack: push/truncate/crumb model |
| `app/src/lib/library.test.js` *(new)* | Stack + truncation tests |
| `app/src/routes/Library.svelte` *(new)* | The frame: search, breadcrumb, surface switch |
| `app/src/components/library/Breadcrumb.svelte` *(new)* | Crumbs with middle truncation + depth badge |
| `app/src/components/library/StartSurface.svelte` *(new)* | Route cards, session stats |
| `app/src/components/library/DictionaryIndex.svelte` *(new)* | A–Z letter grid + 3-column entries |
| `app/src/components/library/PassageIndex.svelte` *(new)* | Themes (book-grouped) and Profiles (A–Z) |
| `app/src/components/library/BookIndex.svelte` *(new)* | 66-cell grid |
| `app/src/components/library/BookHub.svelte` *(new)* | Intro + themes + profiles + top-citing articles |
| `app/src/components/library/ArticleSurface.svelte` *(new)* | Article body, doors, verse previews |
| `app/src/components/library/PassageSurface.svelte` *(new)* | A theme or profile, rendered as prose |
| `app/src/components/library/SearchSurface.svelte` *(new)* | Grouped results across all four routes |
| `app/src/components/library/PathMap.svelte` *(new)* | Spine + branches modal, drag-to-pan |
| `app/src/components/workbench/ArticleView.svelte` *(new)* | Article body renderer, extracted from `ArticleModal` |
| `app/src/components/workbench/ArticleModal.svelte` *(modify)* | Delegates its body to `ArticleView` |
| `app/src/App.svelte` *(modify)* | `library` route + nav link between Study and Compare |

**Note on the data pipeline:** `dict_xref` is **computed** from the already-committed `build/data/sources/tyndale-dictionary.json.gz` (which carries article bodies), exactly as `differences` is computed rather than vendored. **No new intermediate, no `extract-sources.mjs` change, no `backup-data/` access.** `DATA-PIPELINE.md` checklist items 1 and 4 are therefore not applicable; items 2 (wire the build), 3 (setup/copy-assets), and 5 (verify a `backup-data`-less rebuild) are covered by Tasks 2 and 15.

---

### Task 1: Cross-reference resolver

Pure functions that turn Tyndale's `See …` prose into resolved edges. No database, no I/O — fully unit-testable.

**Files:**
- Create: `build/lib/xref.mjs`
- Test: `build/test/xref.test.mjs`

**Interfaces:**
- Consumes: nothing (pure).
- Produces:
  - `normKey(s: string) -> string`
  - `buildIndex(rows: {id,title,sort_title,kind,host_id,body}[]) -> Index` — every dictionary row,
    articles and supplements alike; articles are indexed first so a supplement can never take a key
    an article wants.
  - `resolveTarget(rawTarget: string, index: Index) -> { dst: string, anchor: string|null } | null`
    — a matched article resolves to itself; a matched supplement resolves to its host article with
    its own title as the anchor, or, if it has no host, to itself with no anchor.
  - `extractXrefs(row: {id,body}, index: Index) -> { src, dst: string|null, raw: string, anchor: string|null, seq: number }[]`
    — `dst` is `null` when the source names an article that does not exist; `raw` always holds the
    target as written.

- [ ] **Step 1: Write the failing test**

Create `build/test/xref.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normKey, buildIndex, resolveTarget, extractXrefs } from '../lib/xref.mjs';

const ARTICLES = [
  { id: 'Beast', title: 'Beast', sort_title: 'beast', kind: 'article', host_id: null,
    body: 'Figurative usage. See Antichrist; Mark of the Beast; Prophets, False.' },   // last one absent
  { id: 'Antichrist', title: 'Antichrist', sort_title: 'antichrist', kind: 'article', host_id: null,
    body: 'A denier.' },
  { id: 'MarkofGod', title: 'Mark of God*, Mark of the Beast', sort_title: 'mark of god, mark of the beast',
    kind: 'article', host_id: null, body: 'Ensignia.' },
  { id: 'Animals', title: 'Animals', sort_title: 'animals', kind: 'article', host_id: null,
    body: 'Creatures.\n## Cattle\nOxen and cows.\n## Deer\nGazelles.' },
  { id: 'Bull', title: 'Bull*, Bullock', sort_title: 'bull, bullock', kind: 'article', host_id: null,
    body: 'A male ox. See Animals (Cattle).' },
  { id: 'Lord', title: 'Lord’s Supper, the', sort_title: "lord's supper, the", kind: 'article',
    host_id: null, body: 'A meal.' },
  { id: 'Cup', title: 'Cup', sort_title: 'cup', kind: 'article', host_id: null,
    body: 'A vessel. See Lord’s Supper, the.' },
  { id: 'Vine', title: 'Plants', sort_title: 'plants', kind: 'article', host_id: null,
    body: 'Flora.\n## Bramble\nThorns.' },
  { id: 'Grape', title: 'Grape', sort_title: 'grape', kind: 'article', host_id: null,
    body: 'Fruit. See Plants (Vine).' },
  { id: 'Self', title: 'Self', sort_title: 'self', kind: 'article', host_id: null,
    body: 'Circular. See Self.' },
  // Supplements. A hosted one is rendered inside its host; an orphan has nowhere else to live.
  { id: 'CupBox', title: 'A Cup of Cold Water', sort_title: 'a cup of cold water',
    kind: 'textbox', host_id: 'Cup', body: 'Hospitality.' },
  { id: 'LooseBox', title: 'Nobody Hosts This', sort_title: 'nobody hosts this',
    kind: 'textbox', host_id: null, body: 'Adrift. See Antichrist; Grape.' },
  { id: 'BeastChart', title: 'Antichrist', sort_title: 'antichrist',
    kind: 'chart', host_id: 'Beast', body: 'A chart sharing its title with an article.' },
];
const IX = buildIndex(ARTICLES);

test('normKey: strips asterisks, sense pointers, trailing punctuation, curly apostrophes', () => {
  assert.equal(normKey('Minerals* and Metals'), 'minerals and metals');
  assert.equal(normKey('Acbor #2'), 'acbor');
  assert.equal(normKey('Sin.'), 'sin');
  assert.equal(normKey('Lord’s  Supper'), "lord's supper");
  assert.equal(normKey('Testaments (above)'), 'testaments');
});

test('normKey: unwraps a fully quoted title but leaves quotes that are part of one', () => {
  // Tyndale quotes a supplement's title when it cites one: `See “Abraham’s Bosom”.`
  assert.equal(normKey('“Abraham’s Bosom”'), "abraham's bosom");
  assert.equal(normKey('Calling Jesus “Beelzebul”'), 'calling jesus “beelzebul”');
  assert.equal(normKey('Oak, Diviners’'), "oak, diviners'");
});

test('tier 1: exact normalised title', () => {
  assert.deepEqual(resolveTarget('Antichrist', IX), { dst: 'Antichrist', anchor: null });
});

test('tier 3: a comma segment claimed by exactly one article', () => {
  // "Mark of the Beast" is the SECOND headword of "Mark of God*, Mark of the Beast"
  assert.deepEqual(resolveTarget('Mark of the Beast', IX), { dst: 'MarkofGod', anchor: null });
});

test('tier 3 does not fire when a segment is ambiguous or single-word', () => {
  // "the" appears as a segment of "Lord’s Supper, the" but is one word — never indexed
  assert.equal(resolveTarget('the', IX), null);
});

test('tier 4: Article (Subhead) resolves to the article plus the anchor', () => {
  assert.deepEqual(resolveTarget('Animals (Cattle)', IX), { dst: 'Animals', anchor: 'Cattle' });
});

test('tier 4 fallback: unmatched subhead still links the host, anchor dropped', () => {
  assert.deepEqual(resolveTarget('Plants (Vine)', IX), { dst: 'Vine', anchor: null });
});

test('an inverted title with a comma still resolves exactly', () => {
  assert.deepEqual(resolveTarget('Lord’s Supper, the', IX), { dst: 'Lord', anchor: null });
});

test('a hosted supplement resolves to its host, anchored by its own title', () => {
  assert.deepEqual(resolveTarget('A Cup of Cold Water', IX),
    { dst: 'Cup', anchor: 'A Cup of Cold Water' });
});

test('an orphan supplement is its own destination and carries no anchor', () => {
  assert.deepEqual(resolveTarget('Nobody Hosts This', IX), { dst: 'LooseBox', anchor: null });
});

test('an article outranks a supplement that normalises to the same title', () => {
  // BeastChart is titled "Antichrist" too. The article is the entry a reader can open.
  assert.deepEqual(resolveTarget('Antichrist', IX), { dst: 'Antichrist', anchor: null });
});

test('a target absent from the corpus resolves to null, never throws', () => {
  assert.equal(resolveTarget('Jesus Christ, Life and Teachings of', IX), null);
});

test('extractXrefs: splits a multi-target clause and RECORDS the absent one', () => {
  // "Prophets, False" is absent from this fixture. It must be kept with dst null, not dropped:
  // the UI shows these honestly, and discarding them would overstate how complete the graph is.
  const rows = extractXrefs(ARTICLES[0], IX);
  assert.deepEqual(rows, [
    { src: 'Beast', dst: 'Antichrist', raw: 'Antichrist', anchor: null, seq: 0 },
    { src: 'Beast', dst: 'MarkofGod', raw: 'Mark of the Beast', anchor: null, seq: 1 },
    { src: 'Beast', dst: null, raw: 'Prophets, False', anchor: null, seq: 2 },
  ]);
});

test('extractXrefs: honours "See also" and carries an anchor', () => {
  assert.deepEqual(extractXrefs(ARTICLES[4], IX),
    [{ src: 'Bull', dst: 'Animals', raw: 'Animals (Cattle)', anchor: 'Cattle', seq: 0 }]);
});

test('extractXrefs: deduplicates an absent target named twice', () => {
  const a = { id: 'D', body: 'One. See Nowhere At All. Two. See Nowhere At All.' };
  assert.deepEqual(extractXrefs(a, IX),
    [{ src: 'D', dst: null, raw: 'Nowhere At All', anchor: null, seq: 0 }]);
});

test('extractXrefs: drops self-edges', () => {
  assert.deepEqual(extractXrefs(ARTICLES[9], IX), []);
});

test('extractXrefs: reads a supplement body as a source', () => {
  assert.deepEqual(extractXrefs(ARTICLES[11], IX), [
    { src: 'LooseBox', dst: 'Antichrist', raw: 'Antichrist', anchor: null, seq: 0 },
    { src: 'LooseBox', dst: 'Grape', raw: 'Grape', anchor: null, seq: 1 },
  ]);
});

test('extractXrefs: a hosted supplement never links to the article it sits inside', () => {
  // The mirror of the self-edge case, and the reason it needs its own guard: `src` stays the box's
  // own id, so src and dst genuinely differ and the no-self-edges invariant cannot see it. The
  // real corpus has one — the textbox AbominationOfDesolation names Abomination, its host.
  const box = { id: 'CupBox', kind: 'textbox', host_id: 'Cup', body: 'Boxed. See Cup; Grape.' };
  assert.deepEqual(extractXrefs(box, IX),
    [{ src: 'CupBox', dst: 'Grape', raw: 'Grape', anchor: null, seq: 0 }]);
});

test('extractXrefs: a host citing its own supplement is a self-edge, and is dropped', () => {
  // The redirect sends the box back to the article doing the citing. This is the only shape the
  // hosted case takes anywhere in the real corpus — Flood, the names its own textbox
  // “Scientific Evidence for the Flood?” and nothing else cites a hosted supplement from outside.
  const host = { id: 'Cup', kind: 'article', body: 'A vessel. See A Cup of Cold Water.' };
  assert.deepEqual(extractXrefs(host, IX), []);
});

test('extractXrefs: skips structural pointers like "See above"', () => {
  assert.deepEqual(extractXrefs({ id: 'X', body: 'Text. See above.' }, IX), []);
});

test('extractXrefs: deduplicates a target named twice by the same article', () => {
  const a = { id: 'D', body: 'One. See Antichrist. Two. See Antichrist.' };
  assert.deepEqual(extractXrefs(a, IX),
    [{ src: 'D', dst: 'Antichrist', raw: 'Antichrist', anchor: null, seq: 0 }]);
});

test('extractXrefs: matches a "See" clause preceded by a period inside a closing curly quote', () => {
  // Tyndale often closes a sentence with the period INSIDE the quote mark, e.g.
  // `...the English word "eon." See Age.` The clause is invisible unless the quote is
  // allowed to sit between the terminator and "See".
  const a = { id: 'D', body: 'Greek word for a long period of time or age, from which comes the English word “eon.” See Antichrist.' };
  assert.deepEqual(extractXrefs(a, IX),
    [{ src: 'D', dst: 'Antichrist', raw: 'Antichrist', anchor: null, seq: 0 }]);
});

test('extractXrefs: matches a "See" clause preceded by a semicolon', () => {
  const a = { id: 'D', body: 'Several views exist; See Antichrist.' };
  assert.deepEqual(extractXrefs(a, IX),
    [{ src: 'D', dst: 'Antichrist', raw: 'Antichrist', anchor: null, seq: 0 }]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd build && node --test test/xref.test.mjs
```

Expected: FAIL — `Cannot find module '../lib/xref.mjs'`.

- [ ] **Step 3: Write the implementation**

Create `build/lib/xref.mjs`:

```javascript
// Resolves Tyndale's own "See …" cross-references into edges between dictionary entries.
//
// The dictionary writes cross-references as prose sentences ("See Sin.", "See Antichrist;
// Armageddon."). This module turns them into a graph over all 6,141 dictionary rows — the 6,010
// articles and the 131 supplements (textboxes and charts) they host, which both cite and are
// cited. It resolves 97.0% of the 5,341 targets the corpus names; the rest are genuine source
// defects ("Jesus Christ, Life and Teachings of" is cited 19 times and does not exist) and must
// degrade to nothing rather than throw.

const HEAD_MARK = '## ';

// A cross-reference is a sentence beginning with a capital S. The preceding sentence may end in
// any terminator, and Tyndale routinely puts that terminator INSIDE a closing quote
// (`…the English word “eon.” See Age.`), so the quote must be allowed to follow it.
// Lower-case "see also Nm 3:2-4" is a scripture citation and is deliberately not matched.
const CLAUSE = /(?:^|[.;!?][”"’']?\s*|\n\s*)See(?: also)? ([^.\n]+)\./g;

// Pointers into the article's own structure, not to another entry.
const STRUCTURAL = /^\s*(?:the\s+)?(?:above|below|note|chart|introduction)\b/i;

export function normKey(s) {
  return String(s).trim().toLowerCase()
    .replace(/[‘’]/g, "'")           // curly -> straight apostrophe
    .replace(/\*/g, '')                        // the source's cross-reference asterisk
    .replace(/[.\s]+$/, '')                    // trailing period / whitespace
    .replace(/^“([^“”]*)”$/, '$1')             // Tyndale quotes a supplement it cites, whole
    .replace(/\s*#\d+\s*$/, '')                // " #2" is an intra-article sense pointer
    .replace(/\s*\((?:above|below)\)\s*$/, '')
    .replace(/\s+/g, ' ');
}

const isArticle = (r) => r.kind === 'article';

export function buildIndex(rows) {
  const byTitle = new Map(), bySort = new Map(), subheads = new Map(), byId = new Map();
  const segOwners = new Map();
  // Articles first, so a supplement can never take a key an article wants: "Followers of the Way"
  // is both a textbox and an article, and the article is the entry a reader can open on its own.
  for (const r of [...rows.filter(isArticle), ...rows.filter((x) => !isArticle(x))]) {
    byId.set(r.id, r);
    const tk = normKey(r.title);
    if (isArticle(r) || !byTitle.has(tk)) byTitle.set(tk, r.id);
    const sk = normKey(r.sort_title ?? r.title);
    if (!bySort.has(sk)) bySort.set(sk, r.id);   // sort_title collides across 131 groups
    // Comma segments let "See Mark of the Beast." reach "Mark of God*, Mark of the Beast".
    // Single words are far too ambiguous to index; a segment is only usable when exactly one
    // row claims it, which is what keeps this from guessing.
    for (const seg of tk.split(/,\s*/)) {
      if (!seg || seg.split(' ').length < 2) continue;
      if (!segOwners.has(seg)) segOwners.set(seg, new Set());
      segOwners.get(seg).add(r.id);
    }
    const hs = new Map();
    for (const line of String(r.body).split('\n'))
      if (line.startsWith(HEAD_MARK)) hs.set(normKey(line.slice(3)), line.slice(3).trim());
    if (hs.size) subheads.set(r.id, hs);
  }
  const bySeg = new Map();
  for (const [seg, ids] of segOwners) if (ids.size === 1) bySeg.set(seg, [...ids][0]);
  return { byTitle, bySort, bySeg, subheads, byId };
}

const direct = (key, ix) => ix.byTitle.get(key) ?? ix.bySort.get(key) ?? ix.bySeg.get(key) ?? null;

// Where a matched row actually sends the reader. A supplement is not a page of its own: a hosted
// one is rendered inside its host, so the link opens the host scrolled to the box — the same shape
// a "(Subhead)" match produces. Only an orphan supplement, which no article includes, is its own
// destination. `subKey` is the normalised subhead of a "Article (Subhead)" match, else null.
function destination(id, ix, subKey) {
  const row = ix.byId.get(id);
  if (!isArticle(row))
    return row.host_id ? { dst: row.host_id, anchor: row.title } : { dst: id, anchor: null };
  // An unmatched subhead still yields a correct link — the anchor is simply dropped.
  return { dst: id, anchor: subKey === null ? null : ix.subheads.get(id)?.get(subKey) ?? null };
}

export function resolveTarget(rawTarget, ix) {
  const key = normKey(String(rawTarget).replace(/^\s*also\s+/i, ''));
  const hit = direct(key, ix);
  if (hit) return destination(hit, ix, null);
  // "Animals (Cattle)" points at a subhead inside another article.
  const m = key.match(/^(.*?)\s*\(([^()]*)\)?$/);
  if (!m) return null;
  const host = direct(normKey(m[1]), ix);
  if (!host) return null;
  return destination(host, ix, normKey(m[2]));
}

// Emits one row per distinct target, INCLUDING targets that do not exist (dst null). 140 of the
// 5,236 links Tyndale writes name an article that is not in the corpus — "Jesus Christ, Life and
// Teachings of" is cited 19 times. The UI shows these honestly rather than silently dropping them,
// so the resolver must keep them.
export function extractXrefs(row, ix) {
  const out = [];
  const seen = new Set();
  for (const m of String(row.body).matchAll(CLAUSE)) {
    for (const rawTarget of m[1].split(';')) {
      const target = rawTarget.replace(/^\s*also\s+/i, '').trim();
      if (!target || STRUCTURAL.test(target)) continue;
      const hit = resolveTarget(target, ix);
      // A row never links to the page it is already on. Compared after the hosted-supplement
      // redirect, so an article naming a textbox of its own drops out (Flood, the cites
      // “Scientific Evidence for the Flood?”), and so does the mirror case: a hosted supplement
      // naming its own host (the textbox AbominationOfDesolation cites Abomination). The second
      // arm needs its own test because `src` stays the box's id, so src and dst really do differ.
      if (hit && (hit.dst === row.id || hit.dst === row.host_id)) continue;
      // Tagged so the resolved and unresolved namespaces can never collide, even though no
      // article id currently contains a colon.
      const dedupe = hit ? `id:${hit.dst}` : `raw:${normKey(target)}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      out.push({ src: row.id, dst: hit ? hit.dst : null, raw: target,
        anchor: hit ? hit.anchor : null, seq: out.length });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd build && node --test test/xref.test.mjs
```

Expected: PASS — 23 tests.

- [ ] **Step 5: Run the whole build suite for regressions**

```bash
cd build && npm test
```

Expected: all pass, count increased by 23.

- [ ] **Step 6: Commit**

```bash
git add build/lib/xref.mjs build/test/xref.test.mjs
git commit -m "feat(build): resolve Tyndale's See-clauses into article-to-article edges"
```

---

### Task 2: `dict_xref` table in the build

Wire the resolver into the build so the graph lands in `bible.db`, with post-build invariants.

**Files:**
- Modify: `build/lib/tyndale.mjs` (add `loadXrefs`)
- Modify: `build/build-db.mjs` (create table, call loader, add indexes)
- Modify: `build/validate-db.mjs` (invariants)
- Test: `build/test/schema.smoke.test.mjs`

**Interfaces:**
- Consumes: `buildIndex`, `extractXrefs` from Task 1.
- Produces: `loadXrefs(db, articles) -> { rows: number, anchored: number }`; table `dict_xref(src, dst, anchor, seq)`.

- [ ] **Step 1: Write the failing test**

Append to `build/test/schema.smoke.test.mjs`:

```javascript
test('dict_xref: 5236 rows — 5096 resolved, 140 naming an article that does not exist', () => {
  const db = new DatabaseSync('../data/bible.db');
  assert.equal(db.prepare('SELECT COUNT(*) c FROM dict_xref').get().c, 5236);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM dict_xref WHERE dst IS NOT NULL').get().c, 5096);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM dict_xref WHERE dst IS NULL').get().c, 140);
  assert.equal(db.prepare('SELECT COUNT(DISTINCT raw) c FROM dict_xref WHERE dst IS NULL').get().c, 110);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM dict_xref WHERE anchor IS NOT NULL').get().c, 94);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM dict_xref WHERE src = dst').get().c, 0);
  // every non-null endpoint must be a real article
  const orphans = db.prepare(`SELECT COUNT(*) c FROM dict_xref x
    LEFT JOIN dict_articles a ON a.id = x.src
    LEFT JOIN dict_articles b ON b.id = x.dst
    WHERE a.id IS NULL OR (x.dst IS NOT NULL AND b.id IS NULL)`).get().c;
  assert.equal(orphans, 0);
  db.close();
});

test('dict_xref: the most-cited missing target is named 19 times', () => {
  const db = new DatabaseSync('../data/bible.db');
  const r = db.prepare(`SELECT raw, COUNT(*) c FROM dict_xref WHERE dst IS NULL
    GROUP BY raw ORDER BY c DESC LIMIT 1`).get();
  assert.equal(r.raw, 'Jesus Christ, Life and Teachings of');
  assert.equal(r.c, 19);
  db.close();
});

test('dict_xref: Beast names its four targets, in source order', () => {
  const db = new DatabaseSync('../data/bible.db');
  const rows = db.prepare('SELECT dst FROM dict_xref WHERE src=? ORDER BY seq').all('Beast');
  assert.deepEqual(rows.map((r) => r.dst),
    ['Antichrist', 'Armageddon', 'MarkofGodMarkoftheBeast', 'RevelationBookof']);
  db.close();
});

test('dict_xref: an anchored edge carries its subhead', () => {
  const db = new DatabaseSync('../data/bible.db');
  const r = db.prepare('SELECT dst, anchor FROM dict_xref WHERE src=? AND anchor IS NOT NULL').get('BullBullock');
  assert.equal(r.dst, 'Animals');
  assert.equal(r.anchor, 'Cattle');
  db.close();
});

test('dict_xref: “Abraham’s Bosom” reaches the orphaned textbox nothing else points at', () => {
  // Tyndale's `See “Abraham’s Bosom”.` is the only route to this textbox in the whole corpus:
  // it has no host article to be rendered inside, so it is its own destination and takes no anchor.
  const db = new DatabaseSync('../data/bible.db');
  const rows = db.prepare('SELECT src, dst, anchor FROM dict_xref WHERE raw = ? ORDER BY src')
    .all('“Abraham’s Bosom”');
  assert.deepEqual(rows.map((r) => [r.src, r.dst, r.anchor]), [
    ['Abraham', 'AbrahamsBosom', null],
    ['Heaven', 'AbrahamsBosom', null],
    ['Hell', 'AbrahamsBosom', null],
  ]);
  db.close();
});

test('dict_xref: a host naming its own textbox resolves back to itself and is dropped', () => {
  // “Scientific Evidence for the Flood?” is hosted by Flood, the — and Flood, the is the only
  // article that cites it. A hosted supplement redirects to its host, so this edge would point
  // Flood, the at itself; the self-edge guard removes it. It is the corpus's whole hosted case.
  const db = new DatabaseSync('../data/bible.db');
  assert.equal(db.prepare('SELECT COUNT(*) c FROM dict_xref WHERE raw LIKE ?')
    .get('%Scientific Evidence for the Flood%').c, 0);
  db.close();
});

test('dict_xref: supplements appear at both ends of the graph', () => {
  const db = new DatabaseSync('../data/bible.db');
  const q = (side) => db.prepare(`SELECT COUNT(*) c FROM dict_xref x
    JOIN dict_articles a ON a.id = x.${side} WHERE a.kind <> 'article'`).get().c;
  assert.equal(q('src'), 4);    // supplement bodies write "See …" clauses of their own
  assert.equal(q('dst'), 4);    // and four articles cite the two orphaned textboxes
  db.close();
});
```

If `schema.smoke.test.mjs` does not already import `DatabaseSync` and `assert`, add at the top:

```javascript
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import { test } from 'node:test';
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd build && node --test test/schema.smoke.test.mjs
```

Expected: FAIL — `no such table: dict_xref`.

- [ ] **Step 3: Add the loader**

In `build/lib/tyndale.mjs`, add the import at the top of the file:

```javascript
import { buildIndex, extractXrefs } from './xref.mjs';
```

Then append this exported function at the end of the file:

```javascript
// Derives the cross-reference graph from the bodies already present in the committed intermediate.
// Computed, never vendored — the same treatment `differences` gets. Supplements take part at both
// ends: they write "See …" clauses of their own, and articles cite them by title. `articles` is
// the raw row array from tyndale-dictionary.json.gz:
//   [id, title, sort_title, kind, host_id, body, is_html, n_refs, seq]
export function loadXrefs(db, articles) {
  const arts = articles.map((r) => ({ id: r[0], title: r[1], sort_title: r[2], kind: r[3],
    host_id: r[4], body: r[5] }));
  const ix = buildIndex(arts);
  const ins = db.prepare('INSERT INTO dict_xref VALUES (?,?,?,?,?)');
  let rows = 0, anchored = 0, missing = 0;
  db.exec('BEGIN');
  for (const a of arts) {
    for (const e of extractXrefs(a, ix)) {
      ins.run(e.src, e.dst, e.raw, e.anchor, e.seq);
      rows++;
      if (e.anchor) anchored++;
      if (!e.dst) missing++;
    }
  }
  db.exec('COMMIT');
  return { rows, resolved: rows - missing, missing, anchored };
}
```

- [ ] **Step 4: Expose the article rows and create the table**

In `build/lib/tyndale.mjs`, change `loadTyndale`'s return so the caller can reuse the parsed rows without re-reading the gzip. Replace the final `return` of `loadTyndale` with:

```javascript
  return { articles: dict.articles.length, verses: dict.verses.length,
    passages: passages.length, intros: intros.length, rows: dict.articles };
```

In `build/build-db.mjs`, add the table alongside the other Tyndale tables (near the existing `CREATE TABLE dict_articles` block, inside the same `db.exec` template string):

```sql
  -- Both endpoints are dict_articles rows, which includes supplements (textboxes and charts).
  -- A supplement src is the box's own id, never its host's: the clause is written in the box's
  -- text and seq numbers that text, so collapsing it into the host would interleave two bodies.
  -- A supplement dst, by contrast, IS collapsed — a hosted box is rendered inside its host, so
  -- the edge stores the host's id and puts the box's title in anchor. Only the 13 supplements
  -- with no host appear as dst in their own right. A row never links to the page it is already
  -- on, so there are no src=dst edges and no hosted box pointing at its own host.
  CREATE TABLE dict_xref (
    src TEXT NOT NULL,          -- dict_articles.id, the citing article or supplement
    dst TEXT,                   -- dict_articles.id, or NULL when no such article exists
    raw TEXT NOT NULL,          -- the target exactly as the source wrote it
    anchor TEXT,                -- a "## Subhead" to scroll to, or a hosted supplement's title
    seq INTEGER NOT NULL);      -- order of appearance in the body
```

Immediately after the existing `const tyndale = loadTyndale(db);` / `console.log('tyndale:', …)` lines, add:

```javascript
const xrefs = loadXrefs(db, tyndale.rows);
console.log('dict_xref:', JSON.stringify(xrefs));
```

`loadTyndale`'s return now carries `rows` (all 6,141 parsed articles) so `loadXrefs` can reuse them
without re-reading the gzip. The pre-existing log line one line above would serialise them — about
**8.8 MB** per build — so change it to log only the counts:

```javascript
// `rows` carries all 6,141 parsed articles for loadXrefs to reuse; logging it would dump ~9 MB
const { rows: _rows, ...tyndaleCounts } = tyndale;
console.log('tyndale:', JSON.stringify(tyndaleCounts));
```

Update the import on line 14 to bring in the new loader:

```javascript
import { loadTyndale, loadXrefs } from './lib/tyndale.mjs';
```

Add the indexes to the existing `db.exec` index block (alongside `idx_dict_sort`):

```sql
  CREATE INDEX idx_dict_xref_src ON dict_xref(src);
  CREATE INDEX idx_dict_xref_dst ON dict_xref(dst);
```

- [ ] **Step 5: Add post-build invariants**

In `build/validate-db.mjs`, inside `validate(db)` and before `return problems;`:

```javascript
  const resolved = db.prepare('SELECT COUNT(*) c FROM dict_xref WHERE dst IS NOT NULL').get().c;
  if (resolved < 5000) problems.push(`dict_xref: ${resolved} resolved edges, expected ~5096`);
  const selfEdges = db.prepare('SELECT COUNT(*) c FROM dict_xref WHERE src = dst').get().c;
  if (selfEdges) problems.push(`dict_xref: ${selfEdges} self-edges`);
  // dst may legitimately be NULL (the source names an article that does not exist); src may not,
  // and a non-null dst must point at a real article.
  const dangling = db.prepare(`SELECT COUNT(*) c FROM dict_xref x
    LEFT JOIN dict_articles a ON a.id = x.src
    LEFT JOIN dict_articles b ON b.id = x.dst
    WHERE a.id IS NULL OR (x.dst IS NOT NULL AND b.id IS NULL)`).get().c;
  if (dangling) problems.push(`dict_xref: ${dangling} edges reference a missing article`);
  const noRaw = db.prepare("SELECT COUNT(*) c FROM dict_xref WHERE raw IS NULL OR raw = ''").get().c;
  if (noRaw) problems.push(`dict_xref: ${noRaw} rows with no raw target text`);
```

- [ ] **Step 6: Rebuild the database**

```bash
cd build && npm run build
```

Expected: among the output, `dict_xref: {"rows":5236,"resolved":5096,"missing":140,"anchored":94}` and `validation OK`.

- [ ] **Step 7: Verify a fresh clone can still build**

```bash
cd /Users/justinleong/Desktop/Coding/DeepVerse
mv backup-data backup-data-hidden
cd build && npm run build
cd .. && mv backup-data-hidden backup-data
```

Expected: the build succeeds identically. `dict_xref` is computed from a committed intermediate, so `backup-data/` is not consulted.

- [ ] **Step 8: Republish the app's copy**

```bash
cd app && npm run copy-assets
```

Expected: `copy-assets: bible.db version <hash>` with a **new** hash. Confirm `dict_xref` survived the slimming:

```bash
sqlite3 app/public/bible.db "SELECT COUNT(*) FROM dict_xref;"
```

Expected: `5236`.

- [ ] **Step 9: Run the build suite**

```bash
cd build && npm test
```

Expected: all pass, including the three new schema assertions.

- [ ] **Step 10: Commit**

```bash
git add build/lib/tyndale.mjs build/build-db.mjs build/validate-db.mjs \
        build/test/schema.smoke.test.mjs build/test/validate.test.mjs
git commit -m "feat(build): store the dictionary cross-reference graph as dict_xref"
```

> Both `app/public/bible.db` (150 MB) and `app/public/bible-db.json` are gitignored — the rebuild
> and `copy-assets` are reproducible from committed inputs, so neither artifact is tracked.
> `build/test/validate.test.mjs` builds a synthetic in-memory DB; the new validator queries
> `dict_xref` and `dict_articles` unconditionally, so that fixture needs both tables added or it
> throws before reaching its assertion.

---

### Task 3: Title de-inversion

**Files:**
- Create: `app/src/lib/titles.js`
- Test: `app/src/lib/titles.test.js`

**Interfaces:**
- Produces: `displayTitle(title: string) -> string`. Reformats 365 of the 6,010 article titles, and
  also applies to cross-reference targets that are not articles at all.

- [ ] **Step 1: Write the failing test**

Create `app/src/lib/titles.test.js`:

```javascript
import { test, expect, describe } from 'vitest';
import { displayTitle } from './titles.js';

describe('displayTitle', () => {
  test('rule A — a tail ending in a preposition', () => {
    expect(displayTitle('Revelation, Book of')).toBe('Book of Revelation');
    expect(displayTitle('Mark, Gospel of')).toBe('Gospel of Mark');
    expect(displayTitle('Colossians, Letter to the')).toBe('Letter to the Colossians');
    expect(displayTitle('Philemon, Letter to')).toBe('Letter to Philemon');
    expect(displayTitle('Covenant, Book of the')).toBe('Book of the Covenant');
    expect(displayTitle('Baca*, Valley of')).toBe('Valley of Baca*');
    expect(displayTitle('Oreb, Rock of')).toBe('Rock of Oreb');
    expect(displayTitle('Moses, Law of')).toBe('Law of Moses');
    expect(displayTitle('Gad, Tribe of')).toBe('Tribe of Gad');
    // this one is a cross-reference target, not an article — it must still format
    expect(displayTitle('Jesus Christ, Life and Teachings of'))
      .toBe('Life and Teachings of Jesus Christ');
  });

  test('rules B1–B3 — "the", "the …", and "Mount"', () => {
    expect(displayTitle('Devil, the')).toBe('the Devil');
    expect(displayTitle('Lord’s Supper, the')).toBe('the Lord’s Supper');
    expect(displayTitle('Commandments, the Ten')).toBe('the Ten Commandments');
    expect(displayTitle('Adam*, the Second')).toBe('the Second Adam');
    expect(displayTitle('Hermon, Mount')).toBe('Mount Hermon');
  });

  test('rule C — inversions with no structural marker, listed explicitly', () => {
    expect(displayTitle('Prophets, False')).toBe('False Prophets');
    expect(displayTitle('Calf, Golden')).toBe('Golden Calf');
    expect(displayTitle('Paulus, Sergius')).toBe('Sergius Paulus');
    expect(displayTitle('Sea, Red')).toBe('Red Sea');
    expect(displayTitle('Priest, High')).toBe('High Priest');
    expect(displayTitle('Pilate, Pontius')).toBe('Pontius Pilate');
    expect(displayTitle('Magdalene, Mary')).toBe('Mary Magdalene');
    expect(displayTitle('Scrolls*, Dead Sea')).toBe('Dead Sea Scrolls');
    expect(displayTitle('Chronicles, Books of First and Second'))
      .toBe('Books of First and Second Chronicles');
  });

  // THE regression guard. An inversion and an alternate spelling are structurally identical, so
  // any future attempt to generalise these rules must break this test.
  test('leaves alternate spellings and multi-headword titles untouched', () => {
    for (const t of ['Elect, Election', 'Zidon*, Zidonian*', 'Phares*, Pharez*',
      'Banker, Banking', 'Nazarite*, Nazirite', 'Mark of God*, Mark of the Beast',
      'Babylon, Babylonia', 'Nebuchadnezzar, Nebuchadrezzar*', 'Prophet, Prophetess',
      'Accho*, Acco', 'Balm, Balsam', 'Dara*, Darda', 'Emim*, Emites', 'Ard, Ardite',
      'Vaizatha, Vajezatha*', 'Zecher*, Zeker*', 'Iye-Abarim, Iyim*'])
      expect(displayTitle(t)).toBe(t);
  });

  test('leaves the nine hand-rejected titles untouched', () => {
    for (const t of ['Philo*, Judaeus', 'Shadrach, Meshach, and Abednego',
      'Eloi, Eloi, Lama Sabachthani?', 'Mene, Mene, Tekel, Parsin',
      'Bible*, Quotations of the Old Testament in the New Testament'])
      expect(displayTitle(t)).toBe(t);
  });

  test('leaves titles without a comma untouched', () => {
    expect(displayTitle('Beast')).toBe('Beast');
    expect(displayTitle('Adam (Person)')).toBe('Adam (Person)');
  });

  test('a preposition inside a word does not trigger rule A', () => {
    // "Cain" ends in "in" but there is no word boundary before it
    expect(displayTitle('Abel, Cain')).toBe('Abel, Cain');
  });
});

test('exactly 365 of the 6,010 article titles reformat', async () => {
  // guards the whole corpus, so a rule change cannot quietly widen or narrow its blast radius
  const initSqlJs = (await import('sql.js')).default;
  const fs = await import('node:fs');
  const SQL = await initSqlJs();
  const path = fs.existsSync('public/bible.db') ? 'public/bible.db' : '../data/bible.db';
  const d = new SQL.Database(new Uint8Array(fs.readFileSync(path)));
  const stmt = d.prepare("SELECT title FROM dict_articles WHERE kind='article'");
  let n = 0, total = 0;
  while (stmt.step()) {
    const { title } = stmt.getAsObject();
    total++;
    if (displayTitle(title) !== title) n++;
  }
  stmt.free();
  expect(total).toBe(6010);
  expect(n).toBe(365);
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd app && npx vitest run src/lib/titles.test.js
```

Expected: FAIL — cannot resolve `./titles.js`.

- [ ] **Step 3: Write the implementation**

Create `app/src/lib/titles.js`:

```javascript
// Tyndale files entries under an inverted headword — "Revelation, Book of", "Baca*, Valley of",
// "Prophets, False" — which is right for an A–Z index and wrong everywhere the title is used as a
// name. This reads them back as names. 365 of the 6,010 titles are affected.
//
// The danger is that an inversion and an ALTERNATE SPELLING look identical: "Prophets, False" is
// an inversion, "Elect, Election" is not, and nothing in the data separates them. So nothing here
// is a general "swap around the comma" rule. Four narrow rules, each either structural and
// unambiguous, or an explicit list.

// Rule A — the tail ends in a preposition, so it cannot be an alternate spelling.
// "Valley of", "Book of the", "Letter to the", "Life and Teachings of".
const PREP_TAIL = /\b(?:of|to|for|in|with|from|concerning|against)(?:\s+the)?$/i;

// Rules B1–B3 are likewise structural: no article is ever an alternate spelling of "the", of a
// phrase starting "the ", or of "Mount".

// Rule C — inversions with no structural marker at all. Every one is listed explicitly. The list
// was built by taking every comma-title whose two halves share no word stem (alternate spellings
// nearly always do — "Accho/Acco", "Banker/Banking") and reviewing the 77 survivors by hand.
// Nine were rejected as NOT inversions and are deliberately absent:
//   Philo*, Judaeus            — already natural order ("Philo Judaeus")
//   Iye-Abarim, Iyim* · Vaizatha, Vajezatha* · Zecher*, Zeker*   — alternate names
//   Eli, Eli, Lama Sabachthani?* · Eloi, Eloi, Lama Sabachthani? · Mene, Mene, Tekel, Parsin
//   Shadrach, Meshach, and Abednego                              — quoted phrases and lists
//   Bible*, Quotations of the Old Testament in the New Testament — flips into nonsense
const NAMED = new Set([
  'Akiba*, Rabbi', 'Alexandrinus*, Codex', 'Ark*, Noah’s', 'Ben Sirach*, Jesus',
  'Birth*, New', 'Calendars, Ancient and Modern', 'Calf, Golden', 'Children*, Song of the Three',
  'Chronicles, Books of First and Second', 'Communion*, Holy', 'Convocation*, Holy',
  'Creation, New', 'Creature, New', 'Earth, New', 'Ephraemi Syri*, Codex', 'Epistles*, Apocryphal',
  'Father, God As', 'Father, Human', 'Felix, Antonius', 'Festus, Porcius', 'Ghost*, Holy',
  'Gifts, Spiritual', 'Gospels*, Apocryphal', 'Heavens, New', 'Highway*, King’s',
  'Instruments, Musical', 'Jerusalem, New', 'Jewish Literature*, Extrabiblical',
  'Josephus*, Flavius', 'Kings, Books of First and Second', 'Letter Writing*, Ancient',
  'Maccabaeus, Judas', 'Maccabees, 1 and 2', 'Maccabees*, 3 and 4', 'Maccabeus, Judas',
  'Magdalene, Mary', 'Magus*, Simon', 'Man*, Natural', 'Man, Old and New', 'Manius, Titus',
  'Mark, John', 'Marriage*, Levirate', 'Moon, New', 'Oak, Diviners’', 'Oil, Anointing',
  'Paulus, Sergius', 'Pilate, Pontius', 'Poetry, Biblical', 'Portico*, Solomon’s',
  'Possession, Demon', 'Prayer*, Lord’s', 'Priest, High', 'Prophets, False', 'Punishment, Eternal',
  'Samuel, Books of First and Second', 'Scrolls*, Dead Sea', 'Sea, Dead', 'Sea*, Molten',
  'Sea, Red', 'Seat*, Moses’', 'Serpent, Bronze', 'Spirits, Unclean', 'Stones, Precious',
  'Supper, Lord’s', 'Tacitus*, Cornelius', 'Tradition*, Oral', 'War*, Holy', 'Zealot, Simon the',
]);

export function displayTitle(title) {
  const t = String(title ?? '');
  const i = t.lastIndexOf(', ');
  if (i < 0) return t;
  const head = t.slice(0, i), tail = t.slice(i + 2);
  if (NAMED.has(t)) return `${tail} ${head}`;                    // C
  if (/^the$/i.test(tail)) return `the ${head}`;                 // B1 — "Devil, the"
  if (/^the\s/i.test(tail)) return `${tail} ${head}`;            // B2 — "Commandments, the Ten"
  if (/^(?:Mount|Mt\.?)$/i.test(tail)) return `${tail} ${head}`; // B3 — "Hermon, Mount"
  if (PREP_TAIL.test(tail)) return `${tail} ${head}`;            // A  — "Baca*, Valley of"
  return t;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd app && npx vitest run src/lib/titles.test.js
```

Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/titles.js app/src/lib/titles.test.js
git commit -m "feat(app): read inverted Tyndale headwords back as names"
```

---

### Task 4: Library queries

**Files:**
- Modify: `app/src/lib/db.js` (append a new section)
- Test: `app/src/lib/db.queries.test.js` (append a `describe` block)

**Interfaces:**
- Produces:
  - `getDictLetters() -> { letter: string, n: number }[]`
  - `getDictBrowse(letter) -> { id, title, sort_title, gloss, redirect }[]`
  - `getThemeIndex() -> { title, book, ref, seq }[]`
  - `getProfileIndex() -> { title, book, ref, alsoArticle: string|null }[]`
  - `getBookHub(book) -> { intro, summary, themes, profiles, articles }`
  - `searchLibrary(term) -> { dict, themes, profiles, books }`
  - `getXrefs(id) -> { out: {id,title,anchor}[], in: {id,title}[] }`
  - `getRandomArticle() -> { id, title }`
  - `getArticle(id) -> { id, title, body, n_refs } | null`
  - `getOrphanSupplements() -> { id, title, kind }[]`

- [ ] **Step 1: Write the failing test**

Append to `app/src/lib/db.queries.test.js`:

```javascript
describe('library explorer', () => {
  test('getDictLetters covers A–Z with real counts', () => {
    const rows = db.getDictLetters();
    const b = rows.find((r) => r.letter === 'B');
    expect(b.n).toBe(447);
    expect(rows.find((r) => r.letter === 'A').n).toBe(666);
  });

  test('getDictBrowse returns full titles, ordered by sort_title', () => {
    const rows = db.getDictBrowse('B');
    expect(rows.length).toBe(447);
    // sort_title strips the parenthetical, so these three collide; the title must disambiguate
    const baals = rows.filter((r) => r.sort_title === 'baal').map((r) => r.title);
    expect(baals).toEqual(['Baal (Idol)', 'Baal (Person)', 'Baal* (Place)']);
  });

  test('getDictBrowse flags bare redirect stubs', () => {
    const bed = db.getDictBrowse('B').find((r) => r.title === 'Bed');
    expect(bed.redirect).toBe('Furniture');
    expect(db.getDictBrowse('B').find((r) => r.title === 'Beast').redirect).toBeNull();
  });

  test('getThemeIndex returns 298 in canonical book order', () => {
    const rows = db.getThemeIndex();
    expect(rows).toHaveLength(298);
    expect(rows[0].book).toBe('Gen');
    expect(rows.at(-1).book).toBe('Rev');
  });

  test('getProfileIndex returns 125 alphabetically, flagging dictionary twins', () => {
    const rows = db.getProfileIndex();
    expect(rows).toHaveLength(125);
    expect(rows[0].title < rows[1].title).toBe(true);
    expect(rows.filter((r) => r.alsoArticle).length).toBe(84);
  });

  test('getBookHub assembles intro, themes, profiles and top-citing articles', () => {
    const hub = db.getBookHub('Rev');
    expect(hub.summary).toContain('Purpose');
    expect(hub.themes.length).toBe(8);
    expect(hub.profiles.map((p) => p.title)).toEqual(['Roman Emperors']);
    expect(hub.articles[0].title).toBe('Revelation, Book of');
    expect(hub.articles[0].n).toBe(81);
  });

  test('searchLibrary spans all four datasets', () => {
    const r = db.searchLibrary('revelation');
    expect(r.dict.some((x) => x.title === 'Revelation, Book of')).toBe(true);
    expect(r.themes.some((x) => x.title === 'The Theater and Revelation')).toBe(true);
    expect(r.books).toContain('Rev');
  });

  test('searchLibrary ignores terms shorter than two characters', () => {
    expect(db.searchLibrary('a')).toEqual({ dict: [], themes: [], profiles: [], books: [] });
  });

  test('getXrefs returns both directions', () => {
    const x = db.getXrefs('Beast');
    expect(x.out.map((o) => o.title)).toEqual(
      ['Antichrist', 'Armageddon', 'Mark of God*, Mark of the Beast', 'Revelation, Book of']);
    expect(x.in.length).toBeGreaterThan(0);
  });

  test('getXrefs carries a subhead anchor', () => {
    const x = db.getXrefs('BullBullock');
    expect(x.out.find((o) => o.id === 'Animals').anchor).toBe('Cattle');
  });

  test('getPassage returns a theme body, keyed by kind and title', () => {
    const t = db.getPassage('theme', 'Holy War');
    expect(t.book).toBe('Deut');
    expect(t.ref).toBe('7:1-6');
    expect(t.body.length).toBeGreaterThan(200);
    expect(db.getPassage('profile', 'Holy War')).toBeNull();   // kind is part of the key
  });

  test('getPassage returns a profile body', () => {
    const p = db.getPassage('profile', 'The Philistines');
    expect(p.book).toBe('Judg');
    expect(p.body.length).toBeGreaterThan(200);
  });

  test('every theme and profile in the index is retrievable', () => {
    for (const t of db.getThemeIndex()) expect(db.getPassage('theme', t.title)).not.toBeNull();
    for (const p of db.getProfileIndex()) expect(db.getPassage('profile', p.title)).not.toBeNull();
  });

  test('getXrefs.out carries the source wording for each target', () => {
    const beast = db.getXrefs('Beast').out;
    expect(beast.find((o) => o.id === 'MarkofGodMarkoftheBeast').raw).toBe('Mark of the Beast');
  });

  test('getXrefs reports targets the source names but the corpus lacks', () => {
    // "Advent of Christ" is nothing but a See clause, one of whose three targets does not exist
    const x = db.getXrefs('AdventofChrist');
    expect(x.missing).toContain('Jesus Christ, Life and Teachings of');
    expect(x.out.length).toBe(2);
  });

  test('getXrefs.missing is empty for an article whose targets all resolve', () => {
    expect(db.getXrefs('Beast').missing).toEqual([]);
  });

  test('getRandomArticle only returns substantial articles', () => {
    for (let i = 0; i < 30; i++) {
      const a = db.getRandomArticle();
      const full = db.getArticle(a.id);
      expect(full.body.length).toBeGreaterThanOrEqual(500);
      expect(full.body.startsWith('See ')).toBe(false);
    }
  });

  test('getOrphanSupplements finds the 13 with no host', () => {
    expect(db.getOrphanSupplements()).toHaveLength(13);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd app && npx vitest run src/lib/db.queries.test.js -t "library explorer"
```

Expected: FAIL — `db.getDictLetters is not a function`.

- [ ] **Step 3: Write the implementation**

Append to `app/src/lib/db.js`:

```javascript
// --- Library explorer (#/library) ---

// The pool `✦ Wander in` draws from. 2,271 of the 6,010 articles are under 120 characters and 577
// are bare "See X." redirects, so an unweighted random door would land on a stub about a third of
// the time and feel broken. 500 is our threshold, not a property of the data — it yields 1,839.
export const SUBSTANTIAL_CHARS = 500;

export function getDictLetters() {
  return query(`SELECT upper(substr(sort_title,1,1)) AS letter, COUNT(*) AS n
    FROM dict_articles WHERE kind='article' GROUP BY letter ORDER BY letter`);
}

// Displays `title` and only sorts by `sort_title`: sort_title strips the disambiguating
// parenthetical, so 131 groups collide and would otherwise print the same word repeatedly.
// `redirect` is set for the 577 bodies that are nothing but "See X." — they render as a compact
// redirect line rather than a full entry.
export function getDictBrowse(letter) {
  return query(`SELECT id, title, sort_title,
      substr(replace(body, char(10), ' '), 1, 90) AS gloss,
      CASE WHEN body LIKE 'See %' AND length(body) < 120
           THEN rtrim(replace(substr(body, 5), '.', '')) END AS redirect
    FROM dict_articles
    WHERE kind='article' AND upper(substr(sort_title,1,1)) = ?
    ORDER BY sort_title, title`, [String(letter).toUpperCase()]);
}

export function getThemeIndex() {
  const rows = query(`SELECT title, book, ref, seq, start_chapter, start_verse
    FROM tyndale_passages WHERE kind='theme'`);
  return rows.sort((a, b) => bookOrder(a.book) - bookOrder(b.book)
    || (a.start_chapter * 1000 + a.start_verse) - (b.start_chapter * 1000 + b.start_verse)
    || a.seq - b.seq);
}

// 84 of the 125 have a same-title dictionary article — a second door to the same subject.
export function getProfileIndex() {
  return query(`SELECT p.title, p.book, p.ref,
      (SELECT a.id FROM dict_articles a
        WHERE a.kind='article' AND a.sort_title = lower(p.title) LIMIT 1) AS alsoArticle
    FROM tyndale_passages p WHERE p.kind='profile' ORDER BY p.title`);
}

export function getBookHub(book) {
  const intro = query('SELECT summary, intro FROM book_intros WHERE book=?', [book])[0] || null;
  const passages = query(`SELECT kind, title, ref FROM tyndale_passages
    WHERE book=? ORDER BY start_chapter, start_verse, seq`, [book]);
  // Ranked by how many verses of this book each article cites — straight from dict_verse.
  const articles = query(`SELECT a.id, a.title, COUNT(*) AS n
    FROM dict_verse v JOIN dict_articles a ON a.id = v.article_id
    WHERE v.book = ? GROUP BY a.id ORDER BY n DESC, a.sort_title LIMIT 12`, [book]);
  return {
    summary: intro?.summary ?? '',
    intro: intro?.intro ?? '',
    themes: passages.filter((p) => p.kind === 'theme'),
    profiles: passages.filter((p) => p.kind === 'profile'),
    articles,
  };
}

// One query across all four datasets: making the user first guess which route holds the answer
// would tax the primary objective. Titles only — full-text search over 8.4 MB is not viable here.
export function searchLibrary(term) {
  const q = String(term || '').trim().toLowerCase();
  const empty = { dict: [], themes: [], profiles: [], books: [] };
  if (q.length < 2) return empty;
  const like = `%${q}%`;
  return {
    dict: query(`SELECT id, title FROM dict_articles
      WHERE kind='article' AND lower(title) LIKE ? ORDER BY length(title), sort_title LIMIT 20`, [like]),
    themes: query(`SELECT title, book, ref FROM tyndale_passages
      WHERE kind='theme' AND lower(title) LIKE ? ORDER BY title LIMIT 10`, [like]),
    profiles: query(`SELECT title, book, ref FROM tyndale_passages
      WHERE kind='profile' AND lower(title) LIKE ? ORDER BY title LIMIT 10`, [like]),
    books: BOOKS.filter(([, name]) => name.toLowerCase().includes(q)).map(([code]) => code),
  };
}

export function getArticle(id) {
  return query(`SELECT id, title, body, n_refs FROM dict_articles WHERE id=?`, [id])[0] || null;
}

// A theme or profile, so the Themes and Profiles routes are readable and not just browsable.
// tyndale_passages has no id column, but titles are unique within a kind (298 themes, 125
// profiles, all distinct), so (kind, title) is a safe key.
export function getPassage(kind, title) {
  return query(`SELECT kind, title, book, ref, body FROM tyndale_passages
    WHERE kind = ? AND title = ?`, [kind, title])[0] || null;
}

// Both directions, plus the targets the source names that do not exist. Outbound feeds the doors
// row; inbound is what the path map can reveal and nothing else in the UI can; `missing` is shown
// honestly rather than dropped, because hiding it would overstate how complete the graph is.
export function getXrefs(id) {
  return {
    // `raw` is the target exactly as the source wrote it. The in-prose linkifier needs it to match
    // the "See …" clause text: the clause says "Mark of the Beast", the article's title is
    // "Mark of God*, Mark of the Beast". Matching on title alone would silently miss those.
    out: query(`SELECT a.id, a.title, x.raw, x.anchor FROM dict_xref x
      JOIN dict_articles a ON a.id = x.dst
      WHERE x.src = ? AND x.dst IS NOT NULL ORDER BY x.seq`, [id]),
    in: query(`SELECT a.id, a.title FROM dict_xref x
      JOIN dict_articles a ON a.id = x.src WHERE x.dst = ? ORDER BY a.sort_title`, [id]),
    missing: query(`SELECT raw FROM dict_xref
      WHERE src = ? AND dst IS NULL ORDER BY seq`, [id]).map((r) => r.raw),
  };
}

export function getRandomArticle() {
  return query(`SELECT id, title FROM dict_articles
    WHERE kind='article' AND length(body) >= ? AND body NOT LIKE 'See %'
    ORDER BY random() LIMIT 1`, [SUBSTANTIAL_CHARS])[0] || null;
}

// 3 charts and 10 textboxes never resolved a host, so nothing else in the app can reach them.
export function getOrphanSupplements() {
  return query(`SELECT id, title, kind FROM dict_articles
    WHERE kind <> 'article' AND host_id IS NULL ORDER BY kind, title`);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd app && npx vitest run src/lib/db.queries.test.js -t "library explorer"
```

Expected: PASS — 13 tests.

- [ ] **Step 5: Run the whole app suite**

```bash
cd app && npm test
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/db.js app/src/lib/db.queries.test.js
git commit -m "feat(app): add the library browse, search and cross-reference queries"
```

---

### Task 5: The navigation stack

The breadcrumb *is* the stack. Pure state module, no DOM — so the truncation rule and the jump semantics are unit-testable.

**Files:**
- Create: `app/src/lib/library.svelte.js`
- Test: `app/src/lib/library.test.js`

**Interfaces:**
- Produces:
  - `lib` — `$state({ stack, crumbsOpen, mapOpen })`
  - `pushNode(node)`, `truncateTo(i)`, `jumpFrom(i, id)`, `resetLibrary()`
  - `crumbSlots(stack, crumbsOpen) -> ({ i, label } | { ellipsis: true, hidden: string[] })[]`
  - `articleDepth(stack) -> number`
  - `MAX_CRUMBS = 6`
  - Node shapes: `{kind:'start'}`, `{kind:'route', route, letter?}`, `{kind:'search', q}`, `{kind:'hub', book}`, `{kind:'article', id, title}`

- [ ] **Step 1: Write the failing test**

Create `app/src/lib/library.test.js`:

```javascript
import { test, expect, describe, beforeEach } from 'vitest';
import { lib, pushNode, truncateTo, jumpFrom, resetLibrary,
  crumbSlots, articleDepth, MAX_CRUMBS } from './library.svelte.js';

const art = (id) => ({ kind: 'article', id, title: id });

beforeEach(() => resetLibrary());

describe('the stack', () => {
  test('starts at Start', () => {
    expect(lib.stack).toEqual([{ kind: 'start' }]);
  });

  test('pushNode appends; truncateTo rewinds', () => {
    pushNode({ kind: 'route', route: 'dict' });
    pushNode(art('Beast'));
    expect(lib.stack).toHaveLength(3);
    truncateTo(1);
    expect(lib.stack).toHaveLength(2);
    expect(lib.stack.at(-1).route).toBe('dict');
  });

  test('jumpFrom rewinds to a step, then continues from it', () => {
    pushNode({ kind: 'route', route: 'dict' });
    pushNode(art('Beast'));
    pushNode(art('Antichrist'));
    pushNode(art('MarkofGod'));
    jumpFrom(2, art('Armageddon'));   // a branch hanging off Beast (index 2)
    expect(lib.stack.map((n) => n.id ?? n.kind))
      .toEqual(['start', 'route', 'Beast', 'Armageddon']);
  });

  test('articleDepth counts only article steps', () => {
    pushNode({ kind: 'route', route: 'dict' });
    pushNode(art('Beast'));
    expect(articleDepth(lib.stack)).toBe(1);
    pushNode(art('Antichrist'));
    expect(articleDepth(lib.stack)).toBe(2);
  });

  test('navigating re-collapses an expanded breadcrumb', () => {
    lib.crumbsOpen = true;
    pushNode(art('Beast'));
    expect(lib.crumbsOpen).toBe(false);
  });
});

describe('crumb truncation', () => {
  const build = (n) => {
    resetLibrary();
    for (let i = 1; i < n; i++) pushNode(art('A' + i));
    return lib.stack;
  };

  test('a stack of exactly MAX_CRUMBS renders in full', () => {
    const slots = crumbSlots(build(MAX_CRUMBS), false);
    expect(slots).toHaveLength(MAX_CRUMBS);
    expect(slots.some((s) => s.ellipsis)).toBe(false);
  });

  test('beyond MAX_CRUMBS: first, ellipsis, last four', () => {
    const stack = build(8);
    const slots = crumbSlots(stack, false);
    expect(slots).toHaveLength(6);
    expect(slots[0].i).toBe(0);
    expect(slots[1].ellipsis).toBe(true);
    expect(slots.slice(2).map((s) => s.i)).toEqual([4, 5, 6, 7]);
  });

  test('crumb slots carry the REAL stack index, not the rendered position', () => {
    const slots = crumbSlots(build(8), false);
    // the third rendered slot is stack index 4 — truncation must not misroute a click
    expect(slots[2].i).toBe(4);
  });

  test('the ellipsis names what it hides', () => {
    const slots = crumbSlots(build(8), false);
    expect(slots[1].hidden).toEqual(['A1', 'A2', 'A3']);
  });

  test('expanded renders every crumb', () => {
    expect(crumbSlots(build(8), true)).toHaveLength(8);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd app && npx vitest run src/lib/library.test.js
```

Expected: FAIL — cannot resolve `./library.svelte.js`.

- [ ] **Step 3: Write the implementation**

Create `app/src/lib/library.svelte.js`:

```javascript
// The library's navigation state. The breadcrumb IS the stack — there is no second source of
// truth, which is also what makes browser back/forward correct for free.
//
// Node shapes:
//   { kind: 'start' }
//   { kind: 'route',   route: 'dict'|'themes'|'profiles'|'books', letter?: 'B' }
//   { kind: 'search',  q: 'revelation' }
//   { kind: 'hub',     book: 'Rev' }
//   { kind: 'article', id: 'Beast', title: 'Beast' }

import { displayTitle } from './titles.js';

// Breadcrumb slots before the middle is truncated. Ours, not the data's — a tunable.
export const MAX_CRUMBS = 6;

const ROUTE_NAMES = { dict: 'Dictionary', themes: 'Themes', profiles: 'Profiles', books: 'Books' };

export const lib = $state({
  stack: [{ kind: 'start' }],
  crumbsOpen: false,   // the "…" expander
  mapOpen: false,      // the path-map overlay
  visited: 0,          // articles opened this session
  deepest: 0,          // longest article chain reached
});

export function nodeLabel(n) {
  if (n.kind === 'start') return 'Start';
  if (n.kind === 'route') return ROUTE_NAMES[n.route] + (n.letter ? ` · ${n.letter}` : '');
  if (n.kind === 'search') return `“${n.q}”`;
  if (n.kind === 'hub') return n.book;
  return displayTitle(n.title);   // 'article' and 'passage' both carry a title
}

export function articleDepth(stack) {
  return stack.filter((n) => n.kind === 'article').length;
}

export function pushNode(node) {
  lib.stack.push(node);
  lib.crumbsOpen = false;          // a new step re-collapses the trail
  lib.mapOpen = false;
  if (node.kind === 'article') lib.visited += 1;
  lib.deepest = Math.max(lib.deepest, articleDepth(lib.stack));
}

export function truncateTo(i) {
  lib.stack = lib.stack.slice(0, i + 1);
  lib.crumbsOpen = false;
  lib.mapOpen = false;
}

// A path-map branch: rewind to the step it hangs off, then continue from there. This keeps the
// breadcrumb a truthful account of the route taken rather than a log of every click.
export function jumpFrom(i, node) {
  lib.stack = lib.stack.slice(0, i + 1);
  pushNode(node);
}

// Replace the top of the stack — used when a search term changes or a dictionary letter is picked,
// neither of which is a new step.
export function replaceTop(node) {
  lib.stack[lib.stack.length - 1] = node;
  lib.crumbsOpen = false;
}

export function resetLibrary() {
  lib.stack = [{ kind: 'start' }];
  lib.crumbsOpen = false;
  lib.mapOpen = false;
  lib.visited = 0;
  lib.deepest = 0;
}

// Middle truncation: the first crumb, an expander, and the last four. Start and the current
// article always survive — where you began and where you are. Each slot carries its REAL stack
// index so a click cannot be misrouted by the rendered position.
export function crumbSlots(stack, expanded) {
  const n = stack.length;
  const all = () => stack.map((node, i) => ({ i, label: nodeLabel(node) }));
  if (expanded || n <= MAX_CRUMBS) return all();
  const tail = MAX_CRUMBS - 2;
  const hidden = stack.slice(1, n - tail).map(nodeLabel);
  return [
    { i: 0, label: nodeLabel(stack[0]) },
    { ellipsis: true, hidden },
    ...Array.from({ length: tail }, (_, k) => {
      const i = n - tail + k;
      return { i, label: nodeLabel(stack[i]) };
    }),
  ];
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd app && npx vitest run src/lib/library.test.js
```

Expected: PASS — 11 tests.

> If Vitest reports `$state is not defined`, the file must be named `*.svelte.js` (it is) **and** the project's Vitest config must run the Svelte plugin. Check `app/vite.config.js` includes `svelte({ compilerOptions: { runes: true } })` or that `.svelte.js` is in the plugin's `include`. Existing `study.svelte.js` proves the pattern already works — mirror its setup.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/library.svelte.js app/src/lib/library.test.js
git commit -m "feat(app): make the breadcrumb the library's navigation stack"
```

---

### Task 6: Extract `ArticleView` from `ArticleModal`

So the Context tab's modal and the library's article surface share one renderer instead of drifting apart.

**Files:**
- Create: `app/src/components/workbench/ArticleView.svelte`
- Modify: `app/src/components/workbench/ArticleModal.svelte`

**Interfaces:**
- Produces: `ArticleView` with props `{ article, supplements = [], source = null, onnavigate = null }`. Renders parsed blocks, supplements and the source footer — no modal chrome, no scroll container.

- [ ] **Step 1: Create `ArticleView.svelte`**

Move the body of `ArticleModal`'s `.scroll` div verbatim. Create `app/src/components/workbench/ArticleView.svelte`:

```svelte
<script>
  // The article body renderer, shared by the Context tab's modal and the library's article
  // surface. Deliberately owns no chrome — no title bar, no scroll container, no positioning —
  // so each host can frame it however it needs.
  import { parseArticleBlocks } from '../../lib/display.js';
  import RefText from '../common/RefText.svelte';

  const DICT_SOURCE = 'Tyndale Open Bible Dictionary · © 2023 Tyndale House Publishers · CC BY-SA 4.0';
  let { article, supplements = [], source = null, onnavigate = null } = $props();

  let blocks = $derived(parseArticleBlocks(article.body));
</script>

{#each blocks as b}
  {#if b.kind === 'head'}
    <h3 class="mhead">{b.text}</h3>
  {:else if b.kind === 'item'}
    <p class="mitem"><RefText text={b.text} book={article.book ?? null} onnavigate={onnavigate} /></p>
  {:else}
    <p class="mbody"><RefText text={b.text} book={article.book ?? null} onnavigate={onnavigate} /></p>
  {/if}
{/each}

{#each supplements as s (s.id)}
  <div class="supp" data-sid={s.id}>
    <div class="supptitle">{s.kind === 'chart' ? '▦' : '▤'} {s.title}</div>
    <!-- charts are the only Tyndale content that cannot flatten to text. The markup is generated
         by our own build-time parser (tags whitelisted to table/tr/td/th, every attribute
         stripped), never raw vendor input, so {@html} has no untrusted source. -->
    {#if s.is_html}
      <div class="charttbl">{@html s.body}</div>
    {:else}
      <p class="mbody"><RefText text={s.body} onnavigate={onnavigate} /></p>
    {/if}
  </div>
{/each}

<div class="src">
  <div class="srclbl">Source</div>
  {source ?? DICT_SOURCE}
</div>

<style>
  /* generous measure + spacing: these run to 20k characters and are read, not skimmed */
  .mbody { margin: 0 0 11px; font-size: 13.5px; line-height: 1.72; color: var(--ink); }
  .mhead { margin: 20px 0 7px; font-size: 12px; font-weight: 600; color: var(--b);
    font-variant: small-caps; letter-spacing: .06em; }
  .mhead:first-child { margin-top: 0; }
  .mitem { margin: 0 0 5px; padding-left: 12px; font-size: 13.5px; line-height: 1.6;
    color: var(--ink); }
  .supp { margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--rule); scroll-margin-top: 4px; }
  .supptitle { font-size: 12.5px; color: var(--b); font-weight: 600; margin-bottom: 5px; }
  /* a chart body is leading prose followed by a table; without a size here the prose inherits the
     host's base and renders noticeably larger than the article it belongs to */
  .charttbl { overflow-x: auto; font-size: 13px; line-height: 1.6; color: var(--ink); }
  .charttbl :global(table) { border-collapse: collapse; font-size: 11.5px; width: 100%; margin-top: 8px; }
  .charttbl :global(td), .charttbl :global(th) { border: 1px solid var(--rule);
    padding: 3px 6px; text-align: left; vertical-align: top; color: var(--ink); }
  .src { margin-top: 16px; padding-top: 10px; border-top: 1px solid var(--rule);
    font-size: 11px; line-height: 1.5; color: var(--dim); }
  .srclbl { font-variant: small-caps; letter-spacing: .05em; margin-bottom: 2px; }
</style>
```

- [ ] **Step 2: Make `ArticleModal` delegate**

In `app/src/components/workbench/ArticleModal.svelte`:

1. Replace the `parseArticleBlocks` / `RefText` imports with:

```javascript
  import ArticleView from './ArticleView.svelte';
```

2. Delete the `DICT_SOURCE` constant and the `blocks` `$derived` line.

3. Replace the entire contents of the `.scroll` div (the two `{#each}` blocks and the `.src` div) with:

```svelte
    <ArticleView {article} {supplements} {source} onnavigate={() => onclose?.()} />
```

4. Delete these now-unused style rules from `ArticleModal`'s `<style>`: `.mbody`, `.mhead`, `.mhead:first-child`, `.mitem`, `.supp`, `.supptitle`, `.charttbl` (and its `:global` rules), `.src`, `.srclbl`. Keep `.backdrop`, `.modal`, the keyframes, `.top`, `.mtitle`, `.close`, `.close:hover` and `.scroll`.

- [ ] **Step 3: Verify the Context tab still renders**

```bash
cd app && npm test
```

Expected: all pass — no test should change.

- [ ] **Step 4: Check it live**

```bash
cd app && npm run dev
```

Open `http://localhost:5173/#/study/Gen/1/1`, open the Workbench Context card, press `u` to expand Dictionary, click a chip, then **Read the full article**. Confirm the modal renders headings, paragraphs, any chart, and the source footer exactly as before. Toggle the theme and confirm both.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/workbench/ArticleView.svelte app/src/components/workbench/ArticleModal.svelte
git commit -m "refactor(app): extract ArticleView so the modal and library share one renderer"
```

---

### Task 7: The route, the frame and the breadcrumb

Deliverable: `#/library` renders, the nav link works, the breadcrumb navigates and truncates.

**Files:**
- Modify: `app/src/App.svelte`
- Create: `app/src/routes/Library.svelte`
- Create: `app/src/components/library/Breadcrumb.svelte`

**Interfaces:**
- Consumes: `lib`, `pushNode`, `truncateTo`, `crumbSlots`, `articleDepth`, `MAX_CRUMBS` (Task 5); `getRandomArticle`, `searchLibrary` (Task 4).
- Produces: `Breadcrumb` with props `{ onmap }`. `Library.svelte` is the route component.

- [ ] **Step 1: Add the route and the nav link**

In `app/src/App.svelte`:

1. Add the import beside the other routes:

```javascript
  import Library from './routes/Library.svelte';
```

2. In `applyHash`, add `library` to the allowed view list:

```javascript
    const view = ['home', 'study', 'compare', 'notes', 'settings', 'library'].includes(parts[0]) ? parts[0] : 'home';
```

3. Add the nav link **between Study and Compare**:

```svelte
      <button class="navlink" class:active={route.view === 'library'} onclick={() => go('library')}>Library</button>
```

4. Add the render branch beside the others:

```svelte
      {:else if route.view === 'library'}
        <Library />
```

- [ ] **Step 2: Create the breadcrumb**

Create `app/src/components/library/Breadcrumb.svelte`:

```svelte
<script>
  // The breadcrumb renders the navigation stack directly. Each slot carries its real stack index,
  // so middle truncation cannot misroute a click.
  import { lib, truncateTo, crumbSlots, articleDepth } from '../../lib/library.svelte.js';

  let { onmap } = $props();

  let slots = $derived(crumbSlots(lib.stack, lib.crumbsOpen));
  let depth = $derived(articleDepth(lib.stack));
</script>

<div class="navrow">
  <div class="crumbs">
    {#each slots as s, k}
      {#if k > 0}<span class="sep">›</span>{/if}
      {#if s.ellipsis}
        <button class="ell" title={s.hidden.join(' › ')} onclick={() => (lib.crumbsOpen = true)}>…</button>
      {:else if s.i === lib.stack.length - 1}
        <span class="cur">{s.label}</span>
      {:else}
        <button onclick={() => truncateTo(s.i)}>{s.label}</button>
      {/if}
    {/each}
    <!-- only worth remarking on once you have actually gone somewhere -->
    {#if depth >= 3}<span class="depth">{depth} deep</span>{/if}
  </div>
  {#if lib.stack.length > 1}
    <button class="mapbtn" onclick={onmap}>⁂ View path map</button>
  {/if}
</div>

<style>
  /* trail left, map link right, so the link holds one position instead of sliding as the trail grows */
  .navrow { display: flex; align-items: baseline; justify-content: space-between; gap: 16px;
    min-height: 21px; margin-top: 11px; }
  .crumbs { display: flex; align-items: baseline; gap: 7px; flex-wrap: wrap; min-width: 0;
    font-size: 14px; color: var(--dim); }
  .crumbs button { background: none; border: none; font-family: inherit; font-size: 14px;
    color: var(--b); cursor: pointer; padding: 0; }
  .crumbs button:hover { text-decoration: underline; }
  .sep { opacity: .5; font-size: 12px; }
  .cur { color: var(--ink); }
  .ell { color: var(--dim) !important; letter-spacing: .06em; }
  .ell:hover { color: var(--ink) !important; text-decoration: none !important; }
  .depth { font-size: 10px; color: var(--a); border: 1px solid var(--rule); border-radius: 9px;
    padding: 1px 7px; letter-spacing: .08em; font-variant: small-caps; }
  /* a link, not a button — it is a way of looking at the trail beside it, not an action */
  .mapbtn { background: none; border: none; padding: 0; font-family: inherit; font-size: 12px;
    color: var(--b); cursor: pointer; white-space: nowrap; }
  .mapbtn:hover { text-decoration: underline; text-underline-offset: 2px; }
</style>
```

- [ ] **Step 3: Create the frame**

Create `app/src/routes/Library.svelte`. Surface components are added in later tasks; this task stubs the surface so the frame is independently testable.

```svelte
<script>
  // The library frame: search field and breadcrumb above, one surface below. No sidebar —
  // start -> a route's index -> an article, with the breadcrumb as the way back.
  import { lib, pushNode, replaceTop, resetLibrary } from '../lib/library.svelte.js';
  import { getRandomArticle } from '../lib/db.js';
  import Breadcrumb from '../components/library/Breadcrumb.svelte';

  let term = $state('');
  let inputEl = $state(null);

  let current = $derived(lib.stack.at(-1));

  function onInput() {
    const q = term.trim();
    if (q.length < 2) {
      if (current.kind === 'search') lib.stack.pop();
      return;
    }
    if (current.kind === 'search') replaceTop({ kind: 'search', q });
    else pushNode({ kind: 'search', q });
  }

  function wander() {
    const a = getRandomArticle();
    if (a) pushNode({ kind: 'article', id: a.id, title: a.title });
  }

  function onKey(e) {
    if (e.key === '/' && e.target !== inputEl) { e.preventDefault(); inputEl?.focus(); }
    if (e.key === 'Escape') {
      if (lib.mapOpen) { lib.mapOpen = false; return; }
      if (e.target === inputEl) {
        term = '';
        if (current.kind === 'search') lib.stack.pop();
      }
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="frame">
  <div class="searchrow">
    <input bind:this={inputEl} bind:value={term} oninput={onInput} class="search" type="text"
      placeholder="Search the library — press / to focus…" autocomplete="off" />
    <button class="wander" onclick={wander}>✦ Wander in</button>
  </div>
  <Breadcrumb onmap={() => (lib.mapOpen = true)} />
</div>

<div class="surface">
  <div class="inner">
    <!-- surfaces land here in Tasks 8–13 -->
    <p class="stub">{current.kind}</p>
  </div>
</div>

<style>
  .frame { border-bottom: 1px solid var(--rule); background: var(--panel); padding: 10px 30px 12px; }
  .searchrow { display: flex; gap: 8px; }
  .search { flex: 1; font-family: inherit; font-size: 13.5px; padding: 8px 11px;
    border: 1px solid var(--rule); border-radius: 6px; background: var(--bg); color: var(--ink); }
  .search:focus { outline: none; border-color: var(--a); }
  .wander { background: transparent; border: 1px solid var(--rule); border-radius: 6px;
    padding: 0 14px; font-family: inherit; font-size: 12px; color: var(--a); cursor: pointer;
    white-space: nowrap; font-variant: small-caps; letter-spacing: .06em; }
  .wander:hover { border-color: var(--a); background: var(--bg); }
  .surface { flex: 1; min-height: 0; overflow-y: auto; padding: 22px 30px 40px; }
  /* content centres at 1100px, matching Home.svelte's .page — a 74ch measure left-aligned in a
     full-width pane leaves the right half empty and reads as broken */
  .inner { max-width: 1100px; margin: 0 auto; }
  .frame :global(.navrow) { max-width: 1100px; margin-left: auto; margin-right: auto; }
  .searchrow { max-width: 1100px; margin-left: auto; margin-right: auto; }
  .stub { color: var(--dim); font-style: italic; }
</style>
```

- [ ] **Step 4: Check it live**

```bash
cd app && npm run dev
```

Open `http://localhost:5173/#/library`. Confirm: the nav shows `Home Study Library Compare Memo` with Library between Study and Compare; the search field and breadcrumb render; typing `revelation` pushes a `"revelation"` crumb and clearing pops it; `Start` is the only crumb initially; `/` focuses the field; `✦ Wander in` pushes an article crumb. Toggle light/dark.

- [ ] **Step 5: Commit**

```bash
git add app/src/App.svelte app/src/routes/Library.svelte app/src/components/library/Breadcrumb.svelte
git commit -m "feat(app): add the #/library route, its frame and the breadcrumb"
```

---

### Task 8: Start surface

**Files:**
- Create: `app/src/components/library/StartSurface.svelte`
- Modify: `app/src/routes/Library.svelte`

**Interfaces:**
- Consumes: `lib`, `pushNode` (Task 5).
- Produces: `StartSurface` — no props.

- [ ] **Step 1: Create the surface**

Create `app/src/components/library/StartSurface.svelte`:

```svelte
<script>
  // Four routes as cards, each carrying its real count and a rotating real example so the page
  // invites rather than lists.
  import { lib, pushNode } from '../../lib/library.svelte.js';

  const ROUTES = [
    ['dict', 'Dictionary', '6,010 articles', 'Look up a person, place, object or idea. A–Z, or search.'],
    ['themes', 'Themes', '298 articles', 'Essays anchored to a passage — read them in canonical order.'],
    ['profiles', 'Profiles', '125 profiles', 'People, peoples and places, each tied to the passage they act in.'],
    ['books', 'Books', '66 introductions', 'Purpose, author, date and setting — plus everything anchored in that book.'],
  ];

  // Real items, so the start page never shows something the corpus does not contain.
  const EGS = {
    dict: [['Nazarite*, Nazirite', 'cites 19 verses'], ['Babylon, Babylonia', 'cites 118 verses'],
      ['Shepherd', 'cites 41 verses'], ['Beast', 'cites 34 verses']],
    themes: [['All Is “Vapor”', 'Ecclesiastes 1:2–9:12'], ['Holy War', 'Deuteronomy 7:1-6'],
      ['Atonement', 'Leviticus 16:1-34'], ['Bribes', 'Proverbs 17:8']],
    profiles: [['The Philistines', 'Judges 13:1–16:31'], ['Priscilla and Aquila', 'Acts 18:1-3'],
      ['Hellenistic Kingdoms', 'Daniel 11:4-45'], ['Martha, Mary, and Lazarus', 'Luke 10:38-42']],
    books: [['Revelation', 'Written to churches in Asia under persecution'],
      ['Ecclesiastes', 'Wisdom literature, authorship debated'], ['Jonah', 'A prophet and a reluctant errand']],
  };
  // rotates on each visit to the start page
  const tick = Math.floor(Math.random() * 12);
  const eg = (k) => EGS[k][tick % EGS[k].length];
</script>

<h3 class="stitle">The Library</h3>
<div class="smeta">Tyndale’s Open Bible Dictionary and companion content · 6,499 pieces, four ways in</div>

<div class="cards">
  {#each ROUTES as [key, name, count, desc]}
    <button class="card" onclick={() => pushNode({ kind: 'route', route: key })}>
      <div class="cn">{name}</div>
      <div class="cc">{count}</div>
      <div class="cd">{desc}</div>
      <span class="egline"><span class="egl">for instance</span>{eg(key)[0]}<span class="egr">{eg(key)[1]}</span></span>
    </button>
  {/each}
</div>

<div class="stats">
  <div class="stat"><div class="sv">{lib.visited}</div><div class="scap">articles this session</div></div>
  <div class="stat"><div class="sv">{lib.deepest}</div><div class="scap">deepest chain</div></div>
  <div class="stat"><div class="sv">1,839</div><div class="scap">substantial articles</div></div>
</div>

<p class="starthint">
  Search reaches all four at once. <b>✦ Wander in</b> opens a random article — weighted to
  substantial ones, because 2,271 of the 6,010 entries are under 120 characters and 577 are bare
  “See X.” redirects.
</p>

<style>
  .stitle { font-size: 22px; margin: 0 0 4px; }
  .smeta { font-size: 11.5px; color: var(--dim); margin-bottom: 20px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(232px, 1fr)); gap: 14px; }
  .card { background: var(--panel); border: 1px solid var(--rule); border-radius: 8px;
    padding: 15px 17px 16px; cursor: pointer; text-align: left; font-family: inherit;
    color: var(--ink); transition: border-color .15s, transform .15s; }
  .card:hover { border-color: var(--a); transform: translateY(-2px); }
  .cn { font-size: 16px; margin-bottom: 2px; }
  .cc { font-size: 10.5px; color: var(--dim); font-variant: small-caps; letter-spacing: .06em; }
  .cd { font-size: 12px; color: var(--dim); line-height: 1.5; margin-top: 9px; }
  .egline { display: block; margin-top: 9px; padding-top: 8px; border-top: 1px dashed var(--rule);
    font-size: 12px; color: var(--ink); }
  .egl { font-size: 9.5px; color: var(--dim); font-variant: small-caps; letter-spacing: .07em; display: block; }
  .egr { color: var(--b); font-size: 10.5px; margin-left: 6px; }
  .stats { margin-top: 24px; padding-top: 14px; border-top: 1px solid var(--rule); display: flex; gap: 30px; }
  .sv { font-size: 20px; }
  .scap { font-size: 10px; color: var(--dim); font-variant: small-caps; letter-spacing: .06em; }
  .starthint { font-size: 11.5px; color: var(--dim); font-style: italic; margin-top: 16px; line-height: 1.55; }
</style>
```

- [ ] **Step 2: Add recently-viewed**

The spec calls for a recently-viewed list persisted through the existing `setPref`, capped at 20. The approved mockup dropped it along with the sidebar; the start page is where it belongs now. Add to `app/src/lib/library.svelte.js`:

```javascript
import { getPref, setPref } from './store.js';

const RECENT_KEY = 'libraryRecent';
const RECENT_CAP = 20;

// The trail dies with the session; this is what gets you back to something from yesterday.
export function recordRecent(id, title) {
  const list = getPref(RECENT_KEY, []).filter((r) => r.id !== id);
  list.unshift({ id, title });
  setPref(RECENT_KEY, list.slice(0, RECENT_CAP));
}
export function recentArticles() { return getPref(RECENT_KEY, []); }
```

Call it from `pushNode`, inside the existing article branch:

```javascript
  if (node.kind === 'article') { lib.visited += 1; recordRecent(node.id, node.title); }
```

Then render it in `StartSurface.svelte` — add the import and the block after `.stats`:

```javascript
  import { recentArticles } from '../../lib/library.svelte.js';
```

```svelte
{#if recentArticles().length}
  <div class="recent">
    <div class="rl">Recently viewed</div>
    <div class="rchips">
      {#each recentArticles().slice(0, 12) as r (r.id)}
        <button class="rchip" onclick={() => pushNode({ kind: 'article', id: r.id, title: r.title })}>
          {displayTitle(r.title)}
        </button>
      {/each}
    </div>
  </div>
{/if}
```

with `import { displayTitle } from '../../lib/titles.js';` and these styles:

```css
  .recent { margin-top: 22px; padding-top: 13px; border-top: 1px solid var(--rule); }
  .rl { font-variant: small-caps; letter-spacing: .06em; font-size: 11px; color: var(--dim); margin-bottom: 8px; }
  .rchips { display: flex; flex-wrap: wrap; gap: 5px; }
  .rchip { background: transparent; border: 1px solid var(--rule); border-radius: 5px; padding: 4px 9px;
    font-family: inherit; font-size: 12px; color: var(--ink); cursor: pointer; }
  .rchip:hover { border-color: var(--a); }
```

Add `'prefs'` is already in `SETTINGS_KEYS` in `store.js`, so this rides the existing profile export with no change there.

- [ ] **Step 3: Wire it into the frame**

In `app/src/routes/Library.svelte`, add the import and replace the stub:

```javascript
  import StartSurface from '../components/library/StartSurface.svelte';
```

```svelte
    {#if current.kind === 'start'}
      <StartSurface />
    {:else}
      <p class="stub">{current.kind}</p>
    {/if}
```

- [ ] **Step 4: Check it live**

`http://localhost:5173/#/library` — four cards render with counts and examples; clicking one pushes a route crumb; the session stats increment after `✦ Wander in`; recently-viewed appears once you have opened an article and **survives a page reload**; both themes look right.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/library/StartSurface.svelte app/src/routes/Library.svelte app/src/lib/library.svelte.js
git commit -m "feat(app): add the library start surface with recently-viewed"
```

---

### Task 9: Dictionary index

**Files:**
- Create: `app/src/components/library/DictionaryIndex.svelte`
- Modify: `app/src/routes/Library.svelte`

**Interfaces:**
- Consumes: `getDictLetters`, `getDictBrowse`, `getOrphanSupplements` (Task 4); `lib`, `pushNode`, `replaceTop` (Task 5).
- Produces: `DictionaryIndex` with prop `{ letter }`.

- [ ] **Step 1: Create the index**

Create `app/src/components/library/DictionaryIndex.svelte`:

```svelte
<script>
  import { getDictLetters, getDictBrowse, getOrphanSupplements } from '../../lib/db.js';
  import { lib, pushNode, replaceTop } from '../../lib/library.svelte.js';

  let { letter = null } = $props();

  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  let counts = $derived(new Map(getDictLetters().map((r) => [r.letter, r.n])));
  let rows = $derived(letter ? getDictBrowse(letter) : []);
  let orphans = $derived(letter ? getOrphanSupplements() : []);

  // picking a letter refines the current step rather than adding one
  const pick = (L) => replaceTop({ kind: 'route', route: 'dict', letter: L });
  const open = (r) => pushNode({ kind: 'article', id: r.id, title: r.title });
</script>

<h3 class="stitle">Dictionary</h3>
<div class="smeta">
  6,010 articles · {letter ? `${letter} · ${counts.get(letter) ?? 0} entries` : 'pick a letter, or search'}
</div>

<div class="azgrid">
  {#each LETTERS as L}
    <button class:on={L === letter} onclick={() => pick(L)}>{L}</button>
  {/each}
</div>

{#if letter}
  <div class="cols3">
    {#each rows as r (r.id)}
      {#if r.redirect}
        <!-- 577 bodies are nothing but "See X." — a redirect line, not an entry -->
        <div class="entry redir">{r.title} <span class="arw">→</span> <span class="to">{r.redirect}</span></div>
      {:else}
        <div class="entry">
          <button class="et" onclick={() => open(r)}>{r.title}</button>
          <span class="gloss">{r.gloss}</span>
        </div>
      {/if}
    {/each}
  </div>

  <div class="orph">
    <div class="ohl">Charts &amp; textboxes with no host article · {orphans.length}</div>
    <div class="chips">
      {#each orphans as o (o.id)}
        <span class="chip">{o.kind === 'chart' ? '▦' : '▤'} {o.title}</span>
      {/each}
    </div>
    <p class="note">Their <code>host_id</code> never resolved, so nothing else in the app can reach them.</p>
  </div>
{:else}
  <p class="note">
    Titles are shown in full — <code>sort_title</code> strips the disambiguating parenthetical, and
    131 groups of articles collide once it does. This index is also the one place that keeps
    Tyndale’s inverted headwords (<i>Revelation, Book of</i>): inversion is what makes an A–Z browse
    work. Everywhere the title is used as a <i>name</i> it reads <i>Book of Revelation</i>.
  </p>
{/if}

<style>
  .stitle { font-size: 22px; margin: 0 0 4px; }
  .smeta { font-size: 11.5px; color: var(--dim); margin-bottom: 20px; }
  .azgrid { display: flex; flex-wrap: wrap; gap: 3px; margin-bottom: 18px; }
  .azgrid button { background: transparent; border: 1px solid var(--rule); border-radius: 4px;
    min-width: 26px; padding: 3px 5px; font-family: inherit; font-size: 11.5px; color: var(--dim);
    cursor: pointer; }
  .azgrid button:hover { color: var(--ink); border-color: var(--a); }
  .azgrid button.on { color: var(--bg); background: var(--a); border-color: var(--a); }
  .cols3 { columns: 3; column-gap: 34px; }
  @media (max-width: 900px) { .cols3 { columns: 1; } }
  .entry { break-inside: avoid; margin-bottom: 9px; }
  .et { background: none; border: none; font-family: inherit; font-size: 13px; color: var(--ink);
    cursor: pointer; padding: 0; text-align: left; }
  .et:hover { color: var(--a); }
  .gloss { font-size: 11px; color: var(--dim); line-height: 1.4; display: block; margin-top: 1px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .redir { font-size: 11.5px; color: var(--dim); }
  .arw { font-size: 10px; }
  .to { color: var(--a); }
  .orph { margin-top: 24px; padding-top: 13px; border-top: 1px solid var(--rule); }
  .ohl { font-variant: small-caps; letter-spacing: .06em; font-size: 11px; color: var(--dim); margin-bottom: 8px; }
  .chips { display: flex; flex-wrap: wrap; gap: 5px; }
  .chip { border: 1px solid var(--rule); border-radius: 5px; padding: 4px 9px; font-size: 12px; color: var(--ink); }
  .note { font-size: 11px; color: var(--dim); line-height: 1.55; margin-top: 8px; font-style: italic; max-width: 74ch; }
</style>
```

- [ ] **Step 2: Wire it in**

In `app/src/routes/Library.svelte` add the import and the branch:

```javascript
  import DictionaryIndex from '../components/library/DictionaryIndex.svelte';
```

```svelte
    {:else if current.kind === 'route' && current.route === 'dict'}
      <DictionaryIndex letter={current.letter ?? null} />
```

- [ ] **Step 3: Check it live**

Start → Dictionary → `B`. Confirm 447 entries in three columns; `Baal (Idol)` / `Baal (Person)` / `Baal* (Place)` all render with their parentheticals; `Bed → Furniture` renders as a redirect line; the 13 orphan supplements are listed; picking another letter **replaces** the crumb rather than stacking one; clicking an entry pushes an article crumb.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/library/DictionaryIndex.svelte app/src/routes/Library.svelte
git commit -m "feat(app): add the dictionary A-Z index"
```

---

### Task 10: Themes and Profiles indexes

One component, two modes — the shapes differ only in grouping.

**Files:**
- Create: `app/src/components/library/PassageIndex.svelte`
- Modify: `app/src/routes/Library.svelte`

**Interfaces:**
- Consumes: `getThemeIndex`, `getProfileIndex` (Task 4); `pushNode` (Task 5); `bookName` from `refs.js`.
- Produces: `PassageIndex` with prop `{ kind: 'themes' | 'profiles' }`.

- [ ] **Step 1: Create the component**

Create `app/src/components/library/PassageIndex.svelte`:

```svelte
<script>
  // Themes group under their anchor book (canonical order); profiles run A–Z. Both are passages,
  // so they share a renderer; only the grouping differs.
  import { getThemeIndex, getProfileIndex } from '../../lib/db.js';
  import { pushNode } from '../../lib/library.svelte.js';
  import { bookName } from '../../lib/refs.js';

  let { kind } = $props();

  let themeGroups = $derived.by(() => {
    if (kind !== 'themes') return [];
    const out = [];
    for (const t of getThemeIndex()) {
      if (!out.length || out.at(-1).book !== t.book) out.push({ book: t.book, items: [] });
      out.at(-1).items.push(t);
    }
    return out;
  });
  let profiles = $derived(kind === 'profiles' ? getProfileIndex() : []);

  // A theme or profile opens its own text. Its anchor passage is reachable from there — sending
  // the user to the book hub instead would make these two routes browsable but unreadable.
  const openPassage = (kindName, p) =>
    pushNode({ kind: 'passage', pkind: kindName, title: p.title, book: p.book });
</script>

{#if kind === 'themes'}
  <h3 class="stitle">Themes</h3>
  <div class="smeta">
    298 articles · canonical order, grouped by the book they are anchored in · 56 books carry themes
  </div>
  <div class="cols3">
    {#each themeGroups as g (g.book)}
      <div class="grp">
        <div class="grouphd">{bookName(g.book)} · {g.items.length}</div>
        {#each g.items as t (t.title)}
          <div class="entry">
            <button class="et" onclick={() => openPassage('theme', t)}>{t.title}</button>
            <span class="ref">{t.ref}</span>
          </div>
        {/each}
      </div>
    {/each}
  </div>
  <p class="note">
    The source carries no thematic categorisation, so these are grouped by anchor book — data that
    exists — and never by an invented subject taxonomy.
  </p>
{:else}
  <h3 class="stitle">Profiles</h3>
  <div class="smeta">125 profiles · A–Z · people, peoples and places</div>
  <div class="cols3">
    {#each profiles as p (p.title)}
      <div class="entry">
        <button class="et" onclick={() => openPassage('profile', p)}>{p.title}</button>
        {#if p.alsoArticle}<span class="also">also a dictionary article</span>{/if}
        <span class="ref">{bookName(p.book)} {p.ref}</span>
      </div>
    {/each}
  </div>
  <p class="note">
    Not 125 people: <b>The Philistines</b>, <b>Assyria</b>, <b>Corinth</b> and
    <b>Hellenistic Kingdoms</b> are all in here. 84 of the 125 also have a same-title dictionary
    article — a second door to the same subject.
  </p>
{/if}

<style>
  .stitle { font-size: 22px; margin: 0 0 4px; }
  .smeta { font-size: 11.5px; color: var(--dim); margin-bottom: 20px; }
  .cols3 { columns: 3; column-gap: 34px; }
  @media (max-width: 900px) { .cols3 { columns: 1; } }
  .grp { break-inside: avoid-column; margin-bottom: 17px; }
  .grouphd { font-variant: small-caps; letter-spacing: .06em; font-size: 11px; color: var(--b);
    margin: 0 0 6px; break-after: avoid; }
  .entry { break-inside: avoid; margin-bottom: 9px; }
  .et { background: none; border: none; font-family: inherit; font-size: 13px; color: var(--ink);
    cursor: pointer; padding: 0; text-align: left; }
  .et:hover { color: var(--a); }
  .ref { font-size: 10.5px; color: var(--b); display: block; margin-top: 1px; }
  .also { font-size: 9px; color: var(--b); border: 1px solid var(--rule); border-radius: 3px;
    padding: 0 3px; margin-left: 5px; }
  .note { font-size: 11px; color: var(--dim); line-height: 1.55; margin-top: 12px; font-style: italic; max-width: 74ch; }
</style>
```

- [ ] **Step 2: Wire it in**

```javascript
  import PassageIndex from '../components/library/PassageIndex.svelte';
```

```svelte
    {:else if current.kind === 'route' && (current.route === 'themes' || current.route === 'profiles')}
      <PassageIndex kind={current.route} />
```

- [ ] **Step 3: Check it live**

Start → Themes: groups read `Genesis · 16`, `Exodus · 9`, … in canonical order, 298 total. Start → Profiles: 125 A–Z, with `also a dictionary article` on 84 of them, and `The Philistines` / `Assyria` present.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/library/PassageIndex.svelte app/src/routes/Library.svelte
git commit -m "feat(app): add the themes and profiles indexes"
```

---

### Task 11: Books index and book hub

**Files:**
- Create: `app/src/components/library/BookIndex.svelte`
- Create: `app/src/components/library/BookHub.svelte`
- Modify: `app/src/routes/Library.svelte`

**Interfaces:**
- Consumes: `getBookHub` (Task 4); `pushNode` (Task 5); `BOOKS`, `bookName` from `refs.js`; `parseArticleBlocks`, `articlePreview` from `display.js`; `displayTitle` (Task 3).
- Produces: `BookIndex` (no props); `BookHub` with prop `{ book }`.

- [ ] **Step 1: Create the index**

Create `app/src/components/library/BookIndex.svelte`:

```svelte
<script>
  import { BOOKS } from '../../lib/refs.js';
  import { pushNode } from '../../lib/library.svelte.js';
</script>

<h3 class="stitle">Books</h3>
<div class="smeta">66 introductions · canonical order</div>

<div class="bookgrid">
  {#each BOOKS as [code, name]}
    <button onclick={() => pushNode({ kind: 'hub', book: code })}>{name}</button>
  {/each}
</div>

<p class="note">
  Each opens a hub: purpose, author, date and setting, plus every theme, profile and most-citing
  dictionary article anchored in that book.
</p>

<style>
  .stitle { font-size: 22px; margin: 0 0 4px; }
  .smeta { font-size: 11.5px; color: var(--dim); margin-bottom: 20px; }
  .bookgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 5px; }
  .bookgrid button { background: transparent; border: 1px solid var(--rule); border-radius: 5px;
    padding: 6px 9px; font-family: inherit; font-size: 12.5px; color: var(--ink); cursor: pointer;
    text-align: left; }
  .bookgrid button:hover { border-color: var(--a); }
  .note { font-size: 11px; color: var(--dim); line-height: 1.55; margin-top: 12px; font-style: italic; max-width: 74ch; }
</style>
```

- [ ] **Step 2: Create the hub**

Create `app/src/components/library/BookHub.svelte`:

```svelte
<script>
  import { getBookHub } from '../../lib/db.js';
  import { pushNode } from '../../lib/library.svelte.js';
  import { goToPassage } from '../../lib/study.svelte.js';
  import { go } from '../../lib/router.svelte.js';
  import { bookName } from '../../lib/refs.js';
  import { parseArticleBlocks, articlePreview } from '../../lib/display.js';
  import { displayTitle } from '../../lib/titles.js';

  const NOTE_SRC = 'Tyndale Open Study Notes · © 2022 Tyndale House Publishers · CC BY-SA 4.0';
  const INTRO_CLAMP = 280;

  let { book } = $props();
  let hub = $derived(getBookHub(book));
  let introOpen = $state(false);
  $effect(() => { book; introOpen = false; });

  function openInStudy() {
    goToPassage({ book, chapter: 1, verse: null });
    go('study');
  }
</script>

<h3 class="stitle">{bookName(book)}</h3>
<div class="smeta">
  Book introduction · <button class="jump" onclick={openInStudy}>Open in Study →</button>
</div>

<!-- the summary arrives as Purpose/Author/Date/Setting heading blocks -->
{#each parseArticleBlocks(hub.summary) as b}
  {#if b.kind === 'head'}
    <div class="fieldk">{b.text}</div>
  {:else}
    <div class="fieldv">{b.text}</div>
  {/if}
{/each}

{#if hub.intro}
  <div class="sec">
    <div class="hl">The full introduction</div>
    <p class="prose">{introOpen ? hub.intro : articlePreview(hub.intro, INTRO_CLAMP)}</p>
    <button class="seemore" onclick={() => (introOpen = !introOpen)}>
      {introOpen ? 'Read less' : 'Read more'}
    </button>
  </div>
{/if}

<div class="sec">
  <div class="hl">Themes anchored here · {hub.themes.length}</div>
  {#if hub.themes.length}
    <div class="chips">
      {#each hub.themes as t (t.title)}<span class="chip">{t.title}<span class="r">{t.ref}</span></span>{/each}
    </div>
  {:else}<p class="none">None.</p>{/if}
</div>

<div class="sec">
  <div class="hl">Profiles anchored here · {hub.profiles.length}</div>
  {#if hub.profiles.length}
    <div class="chips">
      {#each hub.profiles as p (p.title)}<span class="chip">{p.title}<span class="r">{p.ref}</span></span>{/each}
    </div>
  {:else}<p class="none">None.</p>{/if}
</div>

<div class="sec">
  <div class="hl">Dictionary articles citing this book most · {hub.articles.length}</div>
  <div class="chips">
    {#each hub.articles as a (a.id)}
      <button class="chip act" onclick={() => pushNode({ kind: 'article', id: a.id, title: a.title })}>
        {displayTitle(a.title)}<span class="n">{a.n}</span>
      </button>
    {/each}
  </div>
  <p class="note">
    Ranked by how many verses of {bookName(book)} each article cites — straight from
    <code>dict_verse</code>, not a hand-made list.
  </p>
</div>

<div class="src"><div class="srclbl">Source</div>{NOTE_SRC}</div>

<style>
  .stitle { font-size: 22px; margin: 0 0 4px; }
  .smeta { font-size: 11.5px; color: var(--dim); margin-bottom: 20px; }
  .jump { background: none; border: none; padding: 0; font-family: inherit; font-size: 11.5px;
    color: var(--a); cursor: pointer; }
  .jump:hover { text-decoration: underline; }
  .fieldk { font-size: 11px; color: var(--b); font-variant: small-caps; letter-spacing: .06em; margin-top: 9px; }
  .fieldv { font-size: 13.5px; line-height: 1.6; max-width: 74ch; }
  .sec { margin-top: 24px; padding-top: 13px; border-top: 1px solid var(--rule); }
  .hl { font-variant: small-caps; letter-spacing: .06em; font-size: 11px; color: var(--dim); margin-bottom: 8px; }
  .prose { font-size: 13.5px; line-height: 1.7; max-width: 74ch; margin: 0; white-space: pre-wrap; }
  .seemore { background: none; border: none; padding: 2px 0 0; font-family: inherit; font-size: 11px;
    color: var(--a); cursor: pointer; display: block; }
  .seemore:hover { text-decoration: underline; }
  .chips { display: flex; flex-wrap: wrap; gap: 5px; }
  .chip { background: transparent; border: 1px solid var(--rule); border-radius: 5px; padding: 4px 9px;
    font-family: inherit; font-size: 12px; color: var(--ink); text-align: left; }
  .chip.act { cursor: pointer; }
  .chip.act:hover { border-color: var(--a); }
  .chip .r { color: var(--b); font-size: 10px; margin-left: 5px; }
  .chip .n { color: var(--dim); font-size: 10px; margin-left: 5px; }
  .none { font-size: 12px; color: var(--dim); font-style: italic; margin: 0; }
  .note { font-size: 11px; color: var(--dim); line-height: 1.55; margin-top: 8px; font-style: italic; max-width: 74ch; }
  .src { margin-top: 24px; padding-top: 11px; border-top: 1px solid var(--rule); font-size: 11px;
    line-height: 1.5; color: var(--dim); }
  .srclbl { font-variant: small-caps; letter-spacing: .05em; }
</style>
```

- [ ] **Step 3: Wire both in**

```javascript
  import BookIndex from '../components/library/BookIndex.svelte';
  import BookHub from '../components/library/BookHub.svelte';
```

```svelte
    {:else if current.kind === 'route' && current.route === 'books'}
      <BookIndex />
    {:else if current.kind === 'hub'}
      <BookHub book={current.book} />
```

- [ ] **Step 4: Check it live**

Start → Books → Revelation. Confirm Purpose/Author/Date/Setting render as labelled fields, 8 themes, 1 profile (`Roman Emperors`), and the citing articles led by `Book of Revelation · 81` — **de-inverted**. `Open in Study →` lands on Revelation 1. Check a book with no themes (e.g. Philemon) shows `None.` rather than an empty row.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/library/BookIndex.svelte app/src/components/library/BookHub.svelte app/src/routes/Library.svelte
git commit -m "feat(app): add the books index and per-book hub"
```

---

### Task 12: Article surface

**Files:**
- Create: `app/src/components/library/ArticleSurface.svelte`
- Modify: `app/src/routes/Library.svelte`

**Interfaces:**
- Consumes: `getArticle`, `getArticleSupplements`, `getXrefs` (Task 4); `pushNode` (Task 5); `ArticleView` (Task 6); `displayTitle` (Task 3).
- Produces: `ArticleSurface` with prop `{ id }`.

- [ ] **Step 1: Create the surface**

Create `app/src/components/library/ArticleSurface.svelte`:

```svelte
<script>
  // An article, plus the doors out of it. "Where this leads" is what converts an article with
  // links buried in its last sentence into a junction with visible exits.
  import { getArticle, getArticleSupplements, getXrefs } from '../../lib/db.js';
  import { pushNode } from '../../lib/library.svelte.js';
  import { displayTitle } from '../../lib/titles.js';
  import ArticleView from '../workbench/ArticleView.svelte';

  let { id } = $props();

  let article = $derived(getArticle(id));
  let supplements = $derived(getArticleSupplements(id));
  let xrefs = $derived(getXrefs(id));
</script>

{#if article}
  <h3 class="stitle">{displayTitle(article.title)}</h3>
  <div class="smeta">Dictionary article · cites {article.n_refs} verses</div>

  <div class="body">
    <ArticleView {article} {supplements} />
  </div>

  <div class="leads">
    <div class="ll">Where this leads</div>
    {#if xrefs.out.length}
      <div class="doors">
        {#each xrefs.out as o (o.id)}
          <button class="door" onclick={() => pushNode({ kind: 'article', id: o.id, title: o.title })}>
            {displayTitle(o.title)}{#if o.anchor}<span class="anch">§ {o.anchor}</span>{/if}
          </button>
        {/each}
      </div>
    {:else}
      <!-- roughly a third of articles have no outbound links; an empty box would read as a bug -->
      <div class="deadend">
        A dead end — this article names no other entry. Search, pick another route, or ✦ Wander in.
      </div>
    {/if}
    {#if xrefs.missing.length}
      <!-- 140 of the 5,236 links name an article Tyndale never wrote. Listing them is more honest
           than hiding them, and stops the graph looking more complete than it is. -->
      <div class="absent">
        Named by the source, but absent from the corpus:
        {xrefs.missing.map(displayTitle).join(', ')}.
      </div>
    {/if}
  </div>
{:else}
  <p class="deadend">That article is not in the corpus.</p>
{/if}

<style>
  .stitle { font-size: 22px; margin: 0 0 4px; }
  .smeta { font-size: 11.5px; color: var(--dim); margin-bottom: 14px; }
  .body { max-width: 74ch; }
  .leads { margin-top: 26px; padding: 14px 16px 15px; border: 1px solid var(--rule);
    border-radius: 8px; background: var(--panel); }
  .ll { font-variant: small-caps; letter-spacing: .07em; font-size: 11px; color: var(--dim); margin-bottom: 9px; }
  .doors { display: flex; flex-wrap: wrap; gap: 6px; }
  .door { background: var(--bg); border: 1px solid var(--rule); border-radius: 6px; padding: 5px 11px;
    font-family: inherit; font-size: 12.5px; color: var(--ink); cursor: pointer; }
  .door:hover { border-color: var(--a); color: var(--a); }
  .anch { color: var(--dim); font-size: 10px; margin-left: 5px; }
  .deadend { font-size: 12px; color: var(--dim); font-style: italic; line-height: 1.55; }
  .absent { margin-top: 9px; font-size: 11px; color: var(--dim); line-height: 1.5; font-style: italic; }
</style>
```

- [ ] **Step 2: Linkify the `See …` clause inside the prose**

The doors row is the deliberate exit, but the spec keeps the prose links too. Extend `ArticleView` with two optional props rather than duplicating the renderer. In `app/src/components/workbench/ArticleView.svelte`, change the props line to:

```javascript
  let { article, supplements = [], source = null, onnavigate = null,
        xrefs = null, onxref = null } = $props();
```

Add above the markup:

```javascript
  // Only inside a "See …" clause, never in loose prose: Calf, Clay, Hour, Evening and Command are
  // all real article titles, so linkifying titles wherever they appear would make every paragraph
  // a minefield. The source wrote "See X." deliberately — that is the only context safe to trust.
  const CLAUSE = /^(.*?)(\bSee(?: also)? )([^.]+)\.\s*$/;
  function splitClause(text) {
    if (!xrefs) return null;
    const m = text.match(CLAUSE);
    if (!m) return null;
    const targets = m[3].split(';').map((t) => {
      const raw = t.trim();
      // dict_xref.raw is the source's own wording, so this is an exact match, not a guess
      const hit = xrefs.out.find((o) => o.raw === raw);
      return { raw, id: hit?.id ?? null };
    });
    return { lead: m[1], see: m[2], targets };
  }
```

Replace the plain-body branch of the `{#each blocks}` loop with:

```svelte
  {:else}
    {@const c = splitClause(b.text)}
    {#if c}
      <p class="mbody">
        <RefText text={c.lead} book={article.book ?? null} onnavigate={onnavigate} />{c.see}{#each c.targets as t, k}{#if k > 0}; {/if}{#if t.id}<button class="xref" onclick={() => onxref?.(t.id)}>{t.raw}</button>{:else}<span class="xdead" title="named by the source, but no such article exists">{t.raw}</span>{/if}{/each}.
      </p>
    {:else}
      <p class="mbody"><RefText text={b.text} book={article.book ?? null} onnavigate={onnavigate} /></p>
    {/if}
  {/if}
```

and add to `ArticleView`'s `<style>`:

```css
  .xref { background: none; border: none; font-family: inherit; font-size: inherit; padding: 0;
    color: var(--a); cursor: pointer; border-bottom: 1px dotted var(--a); }
  .xref:hover { border-bottom-style: solid; }
  .xdead { color: var(--dim); font-style: italic; cursor: help; }
```

`ArticleModal` passes neither prop, so the Context tab is unchanged.

Then in `ArticleSurface.svelte`, pass them through:

```svelte
    <ArticleView {article} {supplements} {xrefs}
      onxref={(id) => {
        const hit = xrefs.out.find((o) => o.id === id);
        pushNode({ kind: 'article', id, title: hit?.title ?? id });
      }} />
```

- [ ] **Step 3: Expand scripture references in place instead of ejecting**

Leaving for Study should be a decision, not a side effect of curiosity. `RefText` currently always navigates, so give it one opt-in prop. In `app/src/components/common/RefText.svelte`:

```javascript
  // onref, when supplied, REPLACES the jump: the caller shows a preview in place instead. Default
  // stays the jump, so every existing call site is unchanged.
  let { text, book = null, onnavigate = null, onref = null } = $props();
```

and change the button's handler to:

```svelte
    onclick={() => {
      if (onref) { onref(s.ref, s.text); return; }
      goToPassage({ book: s.ref.book, chapter: s.ref.chapter, verse: s.ref.verse });
      onnavigate?.();
    }}
```

In `ArticleView.svelte`, accept and forward it, plus an optional preview block. Add to the props:

```javascript
        onref = null, openToken = null, preview = null } = $props();
```

Pass `onref={onref}` to **every** `RefText` in the file, and render the preview after the block that named the verse — a preview at the foot of the article reads as unrelated content:

```svelte
      {#if preview && openToken && b.text.includes(openToken)}
        {@render preview()}
      {/if}
```

Place that immediately after each `<p class="mbody">` / `<p class="mitem">` inside the `{#each blocks}` loop.

In `ArticleSurface.svelte`, hold the open reference and render the preview:

```javascript
  import { getRefPreview } from '../../lib/db.js';
  import { goToPassage } from '../../lib/study.svelte.js';
  import { go } from '../../lib/router.svelte.js';
  import { bookName } from '../../lib/refs.js';

  let open = $state(null);   // { ref, token }
  $effect(() => { id; open = null; });   // a new article clears any open preview
```

```svelte
    <ArticleView {article} {supplements} {xrefs}
      onref={(ref, token) => (open = open?.token === token ? null : { ref, token })}
      openToken={open?.token ?? null}
      preview={open ? previewSnippet : null}
      onxref={(xid) => {
        const hit = xrefs.out.find((o) => o.id === xid);
        pushNode({ kind: 'article', id: xid, title: hit?.title ?? xid });
      }} />
```

and define the snippet in the same file, above the markup:

```svelte
{#snippet previewSnippet()}
  {@const r = open.ref}
  <div class="prev">
    <div class="pr">{bookName(r.book)} {r.chapter}:{r.verse} · NIV</div>
    {getRefPreview(`${r.book}.${r.chapter}.${r.verse}`)}
    <button class="popen" onclick={() => { goToPassage(r); go('study'); }}>Open in Study →</button>
  </div>
{/snippet}
```

with these styles added to `ArticleSurface`:

```css
  .prev { margin: 8px 0 13px; padding: 9px 12px; border-left: 2px solid var(--b);
    background: var(--panel); font-size: 13px; line-height: 1.6; border-radius: 0 5px 5px 0; max-width: 74ch; }
  .pr { font-size: 10.5px; color: var(--b); font-variant: small-caps; letter-spacing: .05em; }
  .popen { display: block; margin-top: 5px; background: none; border: none; font-family: inherit;
    font-size: 11px; color: var(--a); cursor: pointer; padding: 0; }
  .popen:hover { text-decoration: underline; }
```

> Check `getRefPreview`'s argument shape against its definition in `db.js` before wiring — `ContextCard` calls it with a `to_ref` string like `Gen.1.1`. If it expects a different form, match that instead.

- [ ] **Step 4: Wire it in**

```javascript
  import ArticleSurface from '../components/library/ArticleSurface.svelte';
```

```svelte
    {:else if current.kind === 'article'}
      <ArticleSurface id={current.id} />
```

- [ ] **Step 5: Check it live**

Dictionary → `B` → `Beast`. Confirm:

- four doors: `Antichrist`, `Armageddon`, `Mark of God*, Mark of the Beast`, `Book of Revelation`;
- the `See …` sentence at the end of the body has those same four as inline links, and clicking one navigates;
- no other word in the prose is linkified;
- a dead end (`✦ Wander in` until you hit one, e.g. `Shepherd`) shows the message, not an empty box;
- `#/library/article/AdventofChrist` lists `Jesus Christ, Life and Teachings of` under **absent from the corpus**, and it renders as plain italic text in the prose;
- the Context tab's article modal is visually unchanged (it passes no `xrefs`, so the clause stays plain).

- [ ] **Step 6: Commit**

```bash
git add app/src/components/library/ArticleSurface.svelte app/src/components/workbench/ArticleView.svelte app/src/routes/Library.svelte
git commit -m "feat(app): add the library article surface with its exit doors"
```

---

### Task 12b: Passage surface

Themes and profiles must be readable, not just listable. Small task, but it is what makes two of the four routes function.

**Files:**
- Create: `app/src/components/library/PassageSurface.svelte`
- Modify: `app/src/routes/Library.svelte`

**Interfaces:**
- Consumes: `getPassage` (Task 4); `ArticleView` (Task 6); `goToPassage` from `study.svelte.js`; `bookName` from `refs.js`.
- Produces: `PassageSurface` with props `{ pkind, title }`.

- [ ] **Step 1: Create the surface**

Create `app/src/components/library/PassageSurface.svelte`:

```svelte
<script>
  // A theme or profile: Tyndale's own essay, anchored to a passage. Rendered through the same
  // ArticleView as a dictionary article — these are prose in the same block format.
  import { getPassage } from '../../lib/db.js';
  import { goToPassage } from '../../lib/study.svelte.js';
  import { go } from '../../lib/router.svelte.js';
  import { bookName } from '../../lib/refs.js';
  import ArticleView from '../workbench/ArticleView.svelte';

  // themes and profiles ship in the study-notes package, not the dictionary
  const NOTE_SRC = 'Tyndale Open Study Notes · © 2022 Tyndale House Publishers · CC BY-SA 4.0';

  let { pkind, title } = $props();
  let passage = $derived(getPassage(pkind, title));

  function openInStudy() {
    // `ref` is a display span like "7:1-6"; its first chapter:verse is the anchor
    const [ch, v] = String(passage.ref).split('–')[0].split('-')[0].split(':');
    goToPassage({ book: passage.book, chapter: +ch, verse: v ? +v : null });
    go('study');
  }
</script>

{#if passage}
  <h3 class="stitle">{passage.title}</h3>
  <div class="smeta">
    {pkind === 'theme' ? 'Theme' : 'Profile'} · {bookName(passage.book)} {passage.ref} ·
    <button class="jump" onclick={openInStudy}>Open in Study →</button>
  </div>
  <div class="body">
    <ArticleView article={{ title: passage.title, body: passage.body, book: passage.book }}
      source={NOTE_SRC} />
  </div>
{:else}
  <p class="missing">That {pkind} is not in the corpus.</p>
{/if}

<style>
  .stitle { font-size: 22px; margin: 0 0 4px; }
  .smeta { font-size: 11.5px; color: var(--dim); margin-bottom: 14px; }
  .jump { background: none; border: none; padding: 0; font-family: inherit; font-size: 11.5px;
    color: var(--a); cursor: pointer; }
  .jump:hover { text-decoration: underline; }
  .body { max-width: 74ch; }
  .missing { font-size: 12px; color: var(--dim); font-style: italic; }
</style>
```

- [ ] **Step 2: Wire it in**

In `app/src/routes/Library.svelte`:

```javascript
  import PassageSurface from '../components/library/PassageSurface.svelte';
```

```svelte
    {:else if current.kind === 'passage'}
      <PassageSurface pkind={current.pkind} title={current.title} />
```

- [ ] **Step 3: Check it live**

Start → Themes → **Holy War**: the essay renders with `Theme · Deuteronomy 7:1-6` and a source footer, and `Open in Study →` lands on Deuteronomy 7:1. Start → Profiles → **The Philistines**: same shape, labelled `Profile`. The breadcrumb reads `Start › Themes › Holy War`. Both themes.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/library/PassageSurface.svelte app/src/routes/Library.svelte
git commit -m "feat(app): make themes and profiles readable, not just browsable"
```

---

### Task 13: Search surface

**Files:**
- Create: `app/src/components/library/SearchSurface.svelte`
- Modify: `app/src/routes/Library.svelte`

**Interfaces:**
- Consumes: `searchLibrary` (Task 4); `pushNode` (Task 5); `displayTitle` (Task 3); `bookName` from `refs.js`.
- Produces: `SearchSurface` with prop `{ q }`.

- [ ] **Step 1: Create the surface**

Create `app/src/components/library/SearchSurface.svelte`:

```svelte
<script>
  // One query, all four routes. Making the user first guess which route holds the answer would
  // tax the primary objective.
  import { searchLibrary } from '../../lib/db.js';
  import { pushNode } from '../../lib/library.svelte.js';
  import { displayTitle } from '../../lib/titles.js';
  import { bookName } from '../../lib/refs.js';

  let { q } = $props();
  let res = $derived(searchLibrary(q));
  let total = $derived(res.dict.length + res.themes.length + res.profiles.length + res.books.length);
</script>

<h3 class="stitle">“{q}”</h3>
<div class="smeta">one query, all four routes</div>

{#if total === 0}
  <p class="none">Nothing matches “{q}”.</p>
{:else}
  {#if res.dict.length}
    <div class="reslbl">Dictionary · {res.dict.length}</div>
    <div class="cols2">
      {#each res.dict as d (d.id)}
        <div class="entry">
          <button class="et" onclick={() => pushNode({ kind: 'article', id: d.id, title: d.title })}>
            {displayTitle(d.title)}
          </button>
        </div>
      {/each}
    </div>
  {/if}

  {#each [['Themes', res.themes], ['Profiles', res.profiles]] as [label, list]}
    {#if list.length}
      <div class="reslbl">{label} · {list.length}</div>
      <div class="cols2">
        {#each list as p (p.title)}
          <div class="entry">
            <button class="et" onclick={() => pushNode({ kind: 'passage',
              pkind: label === 'Themes' ? 'theme' : 'profile', title: p.title, book: p.book })}>{p.title}</button>
            <span class="ref">{bookName(p.book)} {p.ref}</span>
          </div>
        {/each}
      </div>
    {/if}
  {/each}

  {#if res.books.length}
    <div class="reslbl">Books · {res.books.length}</div>
    <div class="cols2">
      {#each res.books as b (b)}
        <div class="entry">
          <button class="et" onclick={() => pushNode({ kind: 'hub', book: b })}>{bookName(b)}</button>
        </div>
      {/each}
    </div>
  {/if}
{/if}

<style>
  .stitle { font-size: 22px; margin: 0 0 4px; }
  .smeta { font-size: 11.5px; color: var(--dim); margin-bottom: 20px; }
  .reslbl { font-variant: small-caps; letter-spacing: .06em; font-size: 11px; color: var(--b);
    margin: 18px 0 7px; padding-top: 11px; border-top: 1px solid var(--rule); }
  .reslbl:first-of-type { border-top: none; padding-top: 0; margin-top: 0; }
  .cols2 { columns: 2; column-gap: 34px; }
  @media (max-width: 900px) { .cols2 { columns: 1; } }
  .entry { break-inside: avoid; margin-bottom: 9px; }
  .et { background: none; border: none; font-family: inherit; font-size: 13px; color: var(--ink);
    cursor: pointer; padding: 0; text-align: left; }
  .et:hover { color: var(--a); }
  .ref { font-size: 10.5px; color: var(--b); display: block; margin-top: 1px; }
  .none { font-size: 12.5px; color: var(--dim); font-style: italic; }
</style>
```

- [ ] **Step 2: Wire it in**

```javascript
  import SearchSurface from '../components/library/SearchSurface.svelte';
```

```svelte
    {:else if current.kind === 'search'}
      <SearchSurface q={current.q} />
```

- [ ] **Step 3: Check it live**

Type `revelation`. Confirm results group across Dictionary, Themes and Books, that the dictionary hit reads **Book of Revelation**, and that clearing the field pops the search crumb and returns to the previous surface.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/library/SearchSurface.svelte app/src/routes/Library.svelte
git commit -m "feat(app): add unified library search across all four routes"
```

---

### Task 14: Path map

**Files:**
- Create: `app/src/components/library/PathMap.svelte`
- Modify: `app/src/routes/Library.svelte`

**Interfaces:**
- Consumes: `lib`, `jumpFrom`, `truncateTo`, `nodeLabel` (Task 5); `getXrefs` (Task 4); `displayTitle` (Task 3).
- Produces: `PathMap` — no props; reads `lib.stack` and closes via `lib.mapOpen = false`.

- [ ] **Step 1: Create the component**

Create `app/src/components/library/PathMap.svelte`:

```svelte
<script>
  // The breadcrumb drawn as a spine, with each article step's untaken cross-references branching
  // off it. Clicking a branch rewinds the trail to the step it hangs off and continues from there,
  // so the breadcrumb stays a truthful account of the route rather than a log of every click.
  import { lib, jumpFrom, truncateTo, nodeLabel } from '../../lib/library.svelte.js';
  import { getXrefs } from '../../lib/db.js';
  import { displayTitle } from '../../lib/titles.js';

  // Branches drawn per step. Ours, not the data's — `Plants` has 150 neighbours and would bury
  // the spine.
  const MAX_BRANCHES = 7;
  const COL = 208, H = 348;

  let scrollEl = $state(null);
  let pannable = $state(false);
  let pan = null, dragged = false;

  const short = (s) => (s.length > 22 ? s.slice(0, 21).trimEnd() + '…' : s);

  let model = $derived.by(() => {
    const cy = H / 2;
    const steps = lib.stack.map((node, i) => ({ i, node, id: node.kind === 'article' ? node.id : null }));
    const onSpine = new Set(steps.filter((s) => s.id).map((s) => s.id));
    const claimed = new Set(onSpine);
    const neighbours = new Map();
    for (const s of steps) {
      if (!s.id) { s.branches = []; s.hidden = 0; continue; }
      const x = getXrefs(s.id);
      // both directions: inbound is what nothing else in the UI can show. Phantom targets ride
      // along as unclickable nodes — hiding them would overstate how complete the graph is.
      const phantoms = x.missing.map((raw) => ({ id: `x:${raw}`, title: raw, phantom: true }));
      const all = [...x.out, ...x.in, ...phantoms].filter((n, k, arr) =>
        arr.findIndex((m) => m.id === n.id) === k && !claimed.has(n.id));
      neighbours.set(s.id, new Set([...x.out, ...x.in].map((n) => n.id)));
      s.branches = all.slice(0, MAX_BRANCHES);
      s.hidden = all.length - s.branches.length;
      for (const b of s.branches) claimed.add(b.id);
    }
    const W = Math.max(700, 120 + (steps.length - 1) * COL + 120);
    const px = (i) => 120 + i * COL;
    const links = [], nodes = [];
    for (const s of steps) {
      const x = px(s.i);
      if (s.i > 0) {
        const prev = steps[s.i - 1];
        // solid when the step followed a real cross-reference; dashed when the user arrived
        // another way — search, a route, or Wander in
        const followed = !!(s.id && prev.id && neighbours.get(prev.id)?.has(s.id));
        links.push({ x1: px(prev.i), y1: cy, x2: x, y2: cy, cls: followed ? 'path' : 'jumped' });
      }
      s.branches.forEach((b, k) => {
        const side = k % 2 ? -1 : 1, row = Math.floor(k / 2);
        const by = cy + side * (54 + row * 42);
        links.push({ x1: x, y1: cy, x2: x, y2: by, cls: b.phantom ? 'gone' : '' });
        const full = displayTitle(b.title);
        nodes.push({ kind: 'branch', x, y: by, side, step: s.i, id: b.id,
          phantom: !!b.phantom, label: short(full), full });
      });
      const last = s.i === steps.length - 1;
      nodes.push({ kind: 'step', x, y: cy, i: s.i, last, isArticle: !!s.id,
        label: short(nodeLabel(s.node)), full: nodeLabel(s.node), hidden: s.hidden });
    }
    return { W, H, links, nodes, articles: steps.filter((s) => s.id).length };
  });

  $effect(() => {
    model;
    if (!scrollEl) return;
    pannable = scrollEl.scrollWidth > scrollEl.clientWidth + 1
      || scrollEl.scrollHeight > scrollEl.clientHeight + 1;
  });

  function down(e) {
    if (!pannable) return;
    pan = { x: e.clientX, y: e.clientY, l: scrollEl.scrollLeft, t: scrollEl.scrollTop };
    dragged = false;
    scrollEl.setPointerCapture?.(e.pointerId);
    e.preventDefault();   // otherwise the pointer starts a text selection over the labels
  }
  function move(e) {
    if (!pan) return;
    const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragged = true;
    scrollEl.scrollLeft = pan.l - dx;
    scrollEl.scrollTop = pan.t - dy;
  }
  const up = () => { pan = null; };

  // a pan that ends over a node must not also open it
  function guard(fn) {
    return () => { if (dragged) { dragged = false; return; } fn(); };
  }
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') lib.mapOpen = false; }} />

<div class="backdrop" onclick={() => (lib.mapOpen = false)} role="presentation"></div>
<div class="modal" role="dialog" aria-modal="true" aria-label="Your path">
  <div class="hd">
    <span class="ll">Your path</span>
    <span class="sub">
      {model.articles} article{model.articles === 1 ? '' : 's'} · every branch you haven’t taken is clickable
    </span>
    <button class="close" onclick={() => (lib.mapOpen = false)} aria-label="Close">✕</button>
  </div>

  <div class="scroll" class:pannable bind:this={scrollEl}
    onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}>
    <svg width={model.W} height={model.H} viewBox="0 0 {model.W} {model.H}">
      {#each model.links as l}
        <line class="lnk {l.cls}" x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
      {/each}
      {#each model.nodes as n}
        {#if n.kind === 'branch'}
          <g>
            <title>{n.full}{n.phantom ? ' — named by the source, but no such article exists' : ''}</title>
            <circle class="nd" class:gone={n.phantom} cx={n.x} cy={n.y} r="5"
              onclick={n.phantom ? undefined
                : guard(() => jumpFrom(n.step, { kind: 'article', id: n.id, title: n.full }))} />
            <text class={n.phantom ? 'gone' : ''} x={n.x} y={n.y + (n.side < 0 ? -11 : 17)}
              text-anchor="middle">{n.label}</text>
          </g>
        {:else}
          <g>
            <title>{n.full}</title>
            <circle class="nd {n.last ? 'on' : n.isArticle ? 'spine' : 'step'}"
              cx={n.x} cy={n.y} r={n.last ? 9 : 7} onclick={guard(() => truncateTo(n.i))} />
            <text class={n.last ? 'on' : n.isArticle ? 'spine' : 'step'}
              x={n.x} y={n.y + 24} text-anchor="middle">{n.label}</text>
            {#if n.hidden}
              <text class="step" x={n.x} y={n.y - 190} text-anchor="middle">+{n.hidden} more</text>
            {/if}
          </g>
        {/if}
      {/each}
    </svg>
  </div>

  <div class="legend">
    <span><i class="path"></i> the step followed a cross-reference</span>
    <span><i class="jumped"></i> arrived another way — search, a route, or ✦ Wander in</span>
    <span><i></i> a branch not taken</span>
    <span><i class="jumped"></i> named by the source, absent from the corpus</span>
    {#if pannable}<span>drag to pan</span>{/if}
  </div>
</div>

<style>
  .backdrop { position: fixed; inset: 0; z-index: 80; background: rgba(0,0,0,.45); }
  .modal { position: fixed; z-index: 81; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: calc(100vw - 60px); max-height: calc(100vh - 80px); background: var(--panel);
    border: 1px solid var(--rule); border-radius: 10px; display: flex; flex-direction: column;
    box-shadow: 0 18px 60px rgba(0,0,0,.4); }
  .hd { display: flex; align-items: baseline; gap: 10px; padding: 13px 17px 9px;
    border-bottom: 1px solid var(--rule); }
  .ll { font-size: 14px; color: var(--ink); }
  .sub { font-size: 11px; color: var(--dim); }
  .close { margin-left: auto; background: transparent; border: none; color: var(--dim);
    font-family: inherit; font-size: 13px; cursor: pointer; }
  .close:hover { color: var(--ink); }
  .scroll { overflow: auto; padding: 6px 10px; }
  /* a grab cursor on content that cannot move misrepresents the control */
  .scroll.pannable { cursor: grab; }
  .scroll.pannable:active { cursor: grabbing; user-select: none; }
  svg { display: block; }
  .lnk { stroke: var(--rule); stroke-width: 1.2; }
  .lnk.path { stroke: var(--a); stroke-width: 2; }
  .lnk.jumped { stroke: var(--dim); stroke-width: 1.2; stroke-dasharray: 4 4; }
  .lnk.gone { stroke: var(--dim); stroke-dasharray: 2 3; opacity: .55; }
  .nd { fill: var(--bg); stroke: var(--dim); stroke-width: 1.3; cursor: pointer; }
  .nd:hover { stroke: var(--a); stroke-width: 2.2; }
  .nd.gone { fill: none; stroke: var(--dim); stroke-dasharray: 2 2; cursor: not-allowed; opacity: .6; }
  .nd.gone:hover { stroke: var(--dim); stroke-width: 1.3; }
  text.gone { fill: var(--dim); font-style: italic; }
  .nd.on { fill: var(--a); stroke: var(--a); }
  .nd.spine { fill: var(--panel); stroke: var(--a); stroke-width: 1.8; }
  .nd.step { fill: var(--panel); stroke: var(--dim); stroke-dasharray: 3 2; }
  text { font-size: 10.5px; fill: var(--ink); pointer-events: none; }
  text.on { fill: var(--a); font-weight: 600; }
  text.spine { fill: var(--ink); font-weight: 600; }
  text.step { fill: var(--dim); }
  .legend { display: flex; flex-wrap: wrap; gap: 15px; padding: 9px 17px 13px; font-size: 10.5px;
    color: var(--dim); border-top: 1px solid var(--rule); }
  .legend span { display: inline-flex; align-items: center; gap: 5px; }
  .legend i { width: 17px; height: 0; border-top: 1px solid var(--rule); display: inline-block; }
  .legend i.path { border-top: 2px solid var(--a); }
  .legend i.jumped { border-top: 1px dashed var(--dim); }
</style>
```

- [ ] **Step 2: Wire it in**

In `app/src/routes/Library.svelte` add the import and render it after the surface div:

```javascript
  import PathMap from '../components/library/PathMap.svelte';
```

```svelte
{#if lib.mapOpen}
  <PathMap />
{/if}
```

- [ ] **Step 3: Check it live**

Walk Dictionary → `B` → `Beast` → `Antichrist` → a third article, then click `⁂ View path map`. Confirm:

- the spine matches the breadcrumb, `Start` and the route as dashed nodes;
- `Beast ━ Antichrist` is solid (a followed cross-reference) while `Start ⇢ Dictionary · B` is dashed;
- clicking a branch off a **middle** step rewinds the trail to that step and appends the branch;
- clicking a spine node truncates to it;
- with a long trail the map pans by dragging, and a drag ending on a node does **not** navigate;
- Escape and the backdrop close it;
- both themes.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/library/PathMap.svelte app/src/routes/Library.svelte
git commit -m "feat(app): add the path map with drag-to-pan and branch jumps"
```

---

### Task 15: URL sync and full verification

Make articles bookmarkable and browser-back walk the trail, then run everything.

**Files:**
- Modify: `app/src/App.svelte`
- Modify: `app/src/routes/Library.svelte`

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Serialize the library route**

In `app/src/App.svelte`, extend `serialize()` so the library's current surface is in the URL. Add before the final `return`:

```javascript
    if (v === 'library') {
      const n = lib.stack.at(-1);
      if (n.kind === 'article') return `#/library/article/${encodeURIComponent(n.id)}`;
      if (n.kind === 'hub') return `#/library/book/${n.book}`;
      if (n.kind === 'passage') return `#/library/${n.pkind}/${encodeURIComponent(n.title)}`;
      if (n.kind === 'route') return `#/library/${n.route}${n.letter ? '/' + n.letter : ''}`;
      return '#/library';
    }
```

Add the import:

```javascript
  import { lib, pushNode, resetLibrary } from './lib/library.svelte.js';
```

In `applyHash`, restore the stack from the URL when entering the library directly:

```javascript
    if (view === 'library' && parts[1]) {
      resetLibrary();
      if (parts[1] === 'article' && parts[2]) {
        pushNode({ kind: 'article', id: decodeURIComponent(parts[2]), title: decodeURIComponent(parts[2]) });
      } else if (parts[1] === 'book' && parts[2]) {
        pushNode({ kind: 'hub', book: parts[2] });
      } else if ((parts[1] === 'theme' || parts[1] === 'profile') && parts[2]) {
        pushNode({ kind: 'passage', pkind: parts[1], title: decodeURIComponent(parts[2]) });
      } else if (['dict', 'themes', 'profiles', 'books'].includes(parts[1])) {
        pushNode({ kind: 'route', route: parts[1], letter: parts[2] ?? undefined });
      }
    }
```

Extend `keyOf()` so an article change pushes a history entry rather than replacing:

```javascript
  // keyed on the current node's identity, not stack depth: a path-map branch jump truncates then
  // pushes and can land on the same depth, which would skip the history entry.
  const libKey = () => {
    const n = lib.stack.at(-1);
    return `${lib.stack.length}:${n.kind}:${n.id ?? n.book ?? n.q ?? n.route ?? ''}${n.letter ?? ''}`;
  };
  const keyOf = () => `${route.view}/${study.book}/${study.chapter}/${route.view === 'library' ? libKey() : ''}`;
```

And add `lib.stack.length` to the effect's reactive dependencies:

```javascript
    void `${route.view}/${study.book}/${study.chapter}/${study.verse}/${lib.stack.length}/${lib.stack.at(-1)?.id ?? ''}`;
```

> A restored article node carries its id as its title until the surface loads the real one. `ArticleSurface` reads the article from the DB by id, so the heading is always correct; only the breadcrumb label is briefly the id. Fix by having `ArticleSurface` write the real title back:
>
> ```javascript
>   $effect(() => { if (article && lib.stack.at(-1)?.id === id) lib.stack.at(-1).title = article.title; });
> ```
>
> Add that to `ArticleSurface.svelte`, importing `lib` from `../../lib/library.svelte.js`.

- [ ] **Step 2: Verify URL behaviour live**

```bash
cd app && npm run dev
```

- Navigate Dictionary → `B` → `Beast`; the URL becomes `#/library/article/Beast`.
- Reload the page: it opens on the Beast article with `Start › Beast`.
- Press browser **Back**: it steps back up the trail rather than leaving the library.
- Paste `#/library/book/Rev` into the address bar: the Revelation hub opens.

- [ ] **Step 3: Run both suites**

```bash
cd build && npm test
cd ../app && npm test
```

Expected: both green, with the new tests from Tasks 1–5 included.

- [ ] **Step 4: Verify a fresh clone can still build**

```bash
cd /Users/justinleong/Desktop/Coding/DeepVerse
mv backup-data backup-data-hidden
cd build && npm run build && npm test
cd ../app && npm run copy-assets && npm test
cd .. && mv backup-data-hidden backup-data
```

Expected: everything succeeds without `backup-data/`.

- [ ] **Step 5: Full manual pass**

With `npm run dev` running, in **both light and dark**:

| check | expectation |
|---|---|
| Nav order | `Home Study Library Compare Memo` |
| Start page | 4 cards, real counts, session stats |
| `✦ Wander in` ×10 | never lands on a bare `See X.` stub |
| Dictionary `B` | 447 entries, 3 columns, `Baal (Idol)/(Person)/(Place)` distinct, `Bed → Furniture` |
| Themes | book-grouped, canonical, 298 total |
| Profiles | 125 A–Z, 84 badged |
| Books → Revelation | hub with 8 themes, 1 profile, `Book of Revelation · 81` |
| Beast article | 4 doors, `Book of Revelation` de-inverted |
| Dead end | message, not an empty box |
| Search `revelation` | groups across Dictionary, Themes, Books |
| 8-deep trail | breadcrumb truncates to `Start › … › 4 crumbs`, `…` tooltip lists hidden |
| Path map | spine matches breadcrumb, branch jump rewinds, drag pans without navigating |
| Context tab | still renders articles correctly (the `ArticleView` refactor) |

- [ ] **Step 6: Commit**

```bash
git add app/src/App.svelte app/src/routes/Library.svelte app/src/components/library/ArticleSurface.svelte
git commit -m "feat(app): sync the library route to the URL so back walks the trail"
```

---

## Follow-on, not in this plan

The **agent skill** that traverses `dict_xref` (shortest path between entries, most central articles, neighbourhood queries) gets its own spec. It lives outside the app, joins the five existing CLI skills that query `bible.db`, and is unblocked the moment Task 2 lands. When writing it, note the honest boundary: `dict_xref` grounds *how Tyndale connects topics*, not whether a claim is true — it is one publisher's citation graph, covers dictionary↔dictionary only, and 33% of articles are isolated within it.
