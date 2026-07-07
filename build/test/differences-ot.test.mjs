// build/test/differences-ot.test.mjs — OT (Hebrew/Aramaic) engine fixtures.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { loadHebrewDomains } from '../lib/macula-hebrew.mjs';

const HEB_DIR = '../sources/macula-hebrew/WLC/lowfat';
let db;
before(() => {
  db = new DatabaseSync('../data/bible.db');
  loadHebrewDomains(db, HEB_DIR);   // idempotent (INSERT OR IGNORE); ensures Hebrew domains present
});

test('word_domain has SDBH domains for Hebrew content words (ruach H7307)', () => {
  const r = db.prepare("SELECT ln, domain FROM word_domain WHERE strongs='H7307'").get();
  assert.ok(r, 'expected a word_domain row for H7307');
  assert.ok(/^\d{3}/.test(r.ln), 'ln should be an SDBH lexdomain string');
  assert.equal(r.domain, r.ln.slice(0, 3), 'domain should be the first 3-digit group of ln');
});

test('word_domain covers Aramaic (melek H4430)', () => {
  const r = db.prepare("SELECT ln FROM word_domain WHERE strongs='H4430'").get();
  assert.ok(r && r.ln, 'expected an SDBH domain for the Aramaic word melek H4430');
});
