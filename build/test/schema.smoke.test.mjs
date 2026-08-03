// build/test/schema.smoke.test.mjs
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';

let db;
before(() => {
  execFileSync('node', ['build-db.mjs'], { cwd: process.cwd(), stdio: 'inherit' });
  db = new DatabaseSync('../data/bible.db');
});

test('Daniel 4 & 6 are present (versification bug fixed)', () => {
  const ch = db.prepare("SELECT DISTINCT chapter FROM words WHERE book='Dan' ORDER BY chapter").all().map(r=>r.chapter);
  assert.ok(ch.includes(4) && ch.includes(6), `Dan chapters: ${ch.join(',')}`);
});
test('language is 3-way; Daniel 2 is mixed hbo+arc', () => {
  const langs = db.prepare("SELECT DISTINCT lang FROM words WHERE book='Dan' AND chapter=2").all().map(r=>r.lang).sort();
  assert.deepEqual(langs, ['arc','hbo']);
});
test('new MACULA tables are populated', () => {
  // word_domain is keyed by distinct strongs (PRIMARY KEY), so ~5k Greek lemmas, not per-occurrence.
  assert.ok(db.prepare('SELECT COUNT(*) n FROM word_domain').get().n > 5000);
  assert.ok(db.prepare('SELECT COUNT(*) n FROM synonyms').get().n > 1000);
});
test('agapao has a Louw-Nida domain', () => {
  const r = db.prepare("SELECT ln FROM word_domain WHERE strongs='G0025' LIMIT 1").get();
  assert.match(r.ln, /^25\./);
});

test('dict_xref: 5164 rows, every one resolved', () => {
  const db = new DatabaseSync('../data/bible.db');
  assert.equal(db.prepare('SELECT COUNT(*) c FROM dict_xref').get().c, 5164);
  // dst is NOT NULL by construction: the graph is built from the source's own ?item= links, so a
  // row exists only where a target was found. The old title-matching resolver left 140 unresolved,
  // 139 of which were its own failures rather than gaps in the dictionary.
  assert.equal(db.prepare('SELECT COUNT(*) c FROM dict_xref WHERE dst IS NULL').get().c, 0);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM dict_xref WHERE anchor IS NOT NULL').get().c, 87);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM dict_xref WHERE src = dst').get().c, 0);
  const orphans = db.prepare(`SELECT COUNT(*) c FROM dict_xref x
    LEFT JOIN dict_articles a ON a.id = x.src
    LEFT JOIN dict_articles b ON b.id = x.dst
    WHERE a.id IS NULL OR b.id IS NULL`).get().c;
  assert.equal(orphans, 0);
  db.close();
});

// Every stored `raw` is the source's own link text, and the app finds it by literal match in the
// flattened body to decide what to underline. If one did not occur verbatim, that edge would have
// a door but no underlined text — the exact drift this design exists to prevent.
test('dict_xref: every raw occurs verbatim in its article body', () => {
  const db = new DatabaseSync('../data/bible.db');
  const bad = db.prepare(`SELECT COUNT(*) c FROM dict_xref x
    JOIN dict_articles a ON a.id = x.src
    WHERE instr(a.body, x.raw) = 0`).get().c;
  assert.equal(bad, 0);
  db.close();
});

// Formerly reported as "absent from the corpus" — the most-cited example of a supposed source
// defect, 19 times over. The link points at an article that has been there all along.
test('dict_xref: "Jesus Christ, Life and Teachings of" resolves', () => {
  const db = new DatabaseSync('../data/bible.db');
  const rows = db.prepare(`SELECT DISTINCT dst FROM dict_xref WHERE raw = ?`)
    .all('Jesus Christ, Life and Teachings of');
  assert.deepEqual(rows.map((r) => r.dst), ['JesusChristTeachingsof']);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM dict_xref WHERE raw = ?')
    .get('Jesus Christ, Life and Teachings of').c, 19);
  db.close();
});

// One link, two subheads. The old ';' split made a broken "Birds (Fowl, Domestic" target and an
// orphan "Partridge)" that the app announced as missing from the dictionary.
test('dict_xref: a link naming two subheads is one edge', () => {
  const db = new DatabaseSync('../data/bible.db');
  const rows = db.prepare('SELECT dst, raw, anchor FROM dict_xref WHERE src = ?').all('Brood');
  assert.deepEqual(rows.map((r) => `${r.dst}|${r.raw}|${r.anchor}`),
    ['Birds|Birds (Fowl, Domestic; Partridge)|Fowl, Domestic']);
  db.close();
});

// `Bible` ends on a bulleted list of the seven major Bible articles, each one a real link. While
// extraction was restricted to "See …" clauses it had NO outbound edges, so the article displayed
// "this article names no other entry" directly beneath seven of them.
test('dict_xref: links outside a "See …" clause are edges too', () => {
  const db = new DatabaseSync('../data/bible.db');
  const rows = db.prepare('SELECT dst FROM dict_xref WHERE src = ? ORDER BY seq').all('Bible');
  assert.deepEqual(rows.map((r) => r.dst), [
    'BibleCanonofthe', 'BibleInspirationofthe',
    'BibleManuscriptsandTextoftheOldTestament', 'BibleManuscriptsandTextoftheNewTestament',
    'BibleQuotationsoftheOldTestamentintheNewTestament',
    'BibleVersionsoftheAncient', 'BibleVersionsoftheEnglish',
  ]);
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
