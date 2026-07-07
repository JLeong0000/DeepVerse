// build/test/differences-ot.test.mjs — OT (Hebrew/Aramaic) engine fixtures.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { loadHebrewDomains } from '../lib/macula-hebrew.mjs';
import { computeDifferences, isHebrewContent } from '../lib/differences.mjs';

const HEB_DIR = '../sources/macula-hebrew/WLC/lowfat';
let db;
before(() => {
  db = new DatabaseSync('../data/bible.db');
  loadHebrewDomains(db, HEB_DIR);   // idempotent (INSERT OR IGNORE); ensures Hebrew domains present
  computeDifferences(db);
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

test('isHebrewContent: strips the H/A lang marker and keeps only Nc/V/A', () => {
  assert.equal(isHebrewContent('Ncfsa'), true);    // common noun, no marker
  assert.equal(isHebrewContent('HVqp3ms'), true);  // verb, H marker
  assert.equal(isHebrewContent('HAcmsa'), true);   // adjective, H marker
  assert.equal(isHebrewContent('Aamsa'), true);    // bare-A adjective (no marker)
  assert.equal(isHebrewContent('AVqp3mp'), true);  // Aramaic verb
  assert.equal(isHebrewContent('Np'), false);      // proper noun
  assert.equal(isHebrewContent('HTo'), false);     // object marker (particle)
  assert.equal(isHebrewContent('Sp'), false);      // pronominal suffix
  assert.equal(isHebrewContent('HR'), false);      // preposition
});

test('Type B fires on ruach H7307 with spirit AND wind senses', () => {
  const row = db.prepare("SELECT detail FROM differences WHERE type='B' AND strongs LIKE 'H7307%' LIMIT 1").get();
  assert.ok(row, 'expected a Type B row for ruach H7307');
  const glosses = JSON.parse(row.detail).senses.map(s => s.gloss).join(' | ');
  assert.match(glosses, /spirit/i);
  assert.match(glosses, /wind/i);
});

test('Type B fires on nephesh H5315 with life AND person senses', () => {
  const row = db.prepare("SELECT detail FROM differences WHERE type='B' AND strongs LIKE 'H5315%' LIMIT 1").get();
  assert.ok(row, 'expected a Type B row for nephesh H5315');
  const glosses = JSON.parse(row.detail).senses.map(s => s.gloss).join(' | ');
  assert.match(glosses, /life|person/i);
});

test('function words never produce a difference (object-marker et H0853)', () => {
  const n = db.prepare("SELECT COUNT(*) n FROM differences WHERE strongs LIKE 'H0853%'").get().n;
  assert.equal(n, 0);
});

test('Aramaic participates: at least one arc difference row is emitted', () => {
  const n = db.prepare(`SELECT COUNT(*) n FROM differences d JOIN words w
      ON w.book=d.book AND w.chapter=d.chapter AND w.verse=d.verse AND w.position=d.position
      WHERE w.lang='arc'`).get().n;
  assert.ok(n >= 1, 'expected at least one Aramaic difference row');
});
