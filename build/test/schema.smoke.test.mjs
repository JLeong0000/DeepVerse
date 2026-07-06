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
