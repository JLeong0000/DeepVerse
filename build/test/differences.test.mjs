// build/test/differences.test.mjs
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { computeDifferences } from '../lib/differences.mjs';

let db;
before(() => { db = new DatabaseSync('../data/bible.db'); computeDifferences(db); });

test('Type A fires on John 21:15 (agapao has near-synonym phileo)', () => {
  const r = db.prepare("SELECT * FROM differences WHERE book='John' AND chapter=21 AND verse=15 AND type='A'").all();
  assert.ok(r.length >= 1, 'expected a Type A difference in John 21:15');
});
test('Type B fires on psyche (soul/life sense-spread) somewhere', () => {
  const r = db.prepare("SELECT COUNT(*) n FROM differences WHERE strongs='G5590' AND type='B'").get();
  assert.ok(r.n >= 1, 'expected Type B on psyche G5590');
});
test('function words never produce a difference', () => {
  // G2532 = καί "and" — should have no differences rows
  const r = db.prepare("SELECT COUNT(*) n FROM differences WHERE strongs='G2532'").get();
  assert.equal(r.n, 0);
});
