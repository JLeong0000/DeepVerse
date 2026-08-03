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

test('dict_xref: 5240 rows — 5100 resolved, 140 naming an article that does not exist', () => {
  const db = new DatabaseSync('../data/bible.db');
  assert.equal(db.prepare('SELECT COUNT(*) c FROM dict_xref').get().c, 5240);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM dict_xref WHERE dst IS NOT NULL').get().c, 5100);
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

// The clause regex allows ')' as a sentence terminator, because the source drops the period when a
// sentence ends on a citation's closing paren. These three articles are the entire population: with
// the narrower expression they produced zero rows each, so the article showed a "dead end" notice
// under a paragraph that visibly names another entry.
test('dict_xref: a clause following a citation\'s closing paren is recorded', () => {
  const db = new DatabaseSync('../data/bible.db');
  const edges = (src) => db.prepare('SELECT dst, raw FROM dict_xref WHERE src=? ORDER BY seq')
    .all(src).map((r) => `${r.dst} <- ${r.raw}`);
  assert.deepEqual(edges('Garlic'),
    ['FoodandFoodPreparation <- Food and Food Preparation', 'Plants <- Plants (Onion)']);
  assert.deepEqual(edges('Jerubbesheth'), ['Gideon <- Gideon']);
  assert.deepEqual(edges('Jezaniah'), ['Jaazaniah <- Jaazaniah #1']);
  db.close();
});

// The counterpart guard. "See" after an OPENING paren introduces a parenthetical aside — a
// scripture citation or a pointer inside the article — never an entry, and there are 7 of them.
// Allowing '(' alongside ')' would turn every one into a bogus cross-reference.
test('dict_xref: a parenthetical "(See …)" aside is not a cross-reference', () => {
  const db = new DatabaseSync('../data/bible.db');
  const raws = (src) => db.prepare('SELECT raw FROM dict_xref WHERE src=?').all(src).map((r) => r.raw);
  // "(See also Col 4:16; Rv 1:3.)" — scripture, not entries
  assert.equal(raws('BibleCanonofthe').some((r) => /Col 4:16|Rv 1:3/.test(r)), false);
  // "(See the discussion on this manuscript above.)" — a pointer inside the article
  assert.equal(raws('BibleManuscriptsandTextoftheNewTestament')
    .some((r) => /discussion on this manuscript/.test(r)), false);
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
