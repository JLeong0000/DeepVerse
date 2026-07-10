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
test('Greek Type A/B row counts stay in the expected range (regression guard)', () => {
  const a = db.prepare("SELECT COUNT(*) n FROM differences WHERE type='A' AND strongs LIKE 'G%'").get().n;
  const b = db.prepare("SELECT COUNT(*) n FROM differences WHERE type='B' AND strongs LIKE 'G%'").get().n;
  assert.ok(a > 18000 && a < 26000, `Greek Type A count ${a} out of range`);
  // Type B lowered intentionally by the Tier 1 (stronger stem) + Tier 3 (min-count) sense cleanup.
  assert.ok(b > 25000 && b < 32000, `Greek Type B count ${b} out of range`);
});

test('Type B no longer fires on pure plural/inflection residual (angel/angels G0032, agapao love G0025)', () => {
  // These "sense spreads" were only singular/plural or verb inflection of ONE meaning — now merged away.
  assert.equal(db.prepare("SELECT COUNT(*) n FROM differences WHERE type='B' AND strongs LIKE 'G0032%'").get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM differences WHERE type='B' AND strongs LIKE 'G0025%'").get().n, 0);
});
