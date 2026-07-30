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

test('dict_xref: 5233 rows — 5088 resolved, 145 naming an article that does not exist', () => {
  const db = new DatabaseSync('../data/bible.db');
  assert.equal(db.prepare('SELECT COUNT(*) c FROM dict_xref').get().c, 5233);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM dict_xref WHERE dst IS NOT NULL').get().c, 5088);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM dict_xref WHERE dst IS NULL').get().c, 145);
  assert.equal(db.prepare('SELECT COUNT(DISTINCT raw) c FROM dict_xref WHERE dst IS NULL').get().c, 113);
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
