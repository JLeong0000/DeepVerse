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

test('Type B suppressed on very-high-frequency verbs (halak H1980, amar H0559)', () => {
  // These verbs' gloss "spread" is inflection/tense (he said/saying, go/went/walk), not sense.
  for (const s of ['H1980', 'H0559']) {
    const n = db.prepare(`SELECT COUNT(*) n FROM differences WHERE type='B' AND strongs LIKE '${s}%'`).get().n;
    assert.equal(n, 0, `${s} is a >1000-occurrence verb; its Type B should be suppressed`);
  }
});

test('Type B preserved on lower-frequency verbs with real sense spread (shalach H7971 send/stretch-out)', () => {
  // shalach (~847 occ, below the ceiling) keeps a genuine causative sense (stretch out) — not suppressed.
  const row = db.prepare("SELECT detail FROM differences WHERE type='B' AND strongs LIKE 'H7971%' LIMIT 1").get();
  assert.ok(row, 'H7971 (send, below the verb-frequency ceiling) should still produce Type B');
});

test('Tier 1: Type B no longer fires when the "senses" are one meaning (cherub/cherubim H3742)', () => {
  // cherub vs cherubim is singular/plural of one word — the stronger stem merges them, so no Type B.
  assert.equal(db.prepare("SELECT COUNT(*) n FROM differences WHERE type='B' AND strongs LIKE 'H3742%'").get().n, 0);
});

test('Tier 3: Type B drops lemmas whose only extra senses are <3x slivers (mappelet H4658)', () => {
  // mappelet: "downfall" 5x + "carcass" 1x + "fallen trunk" 1x — the 1x slivers are dropped, leaving one sense.
  assert.equal(db.prepare("SELECT COUNT(*) n FROM differences WHERE type='B' AND strongs LIKE 'H4658%'").get().n, 0);
});

test('Type B excludes proper nouns (place name Ramah H7414)', () => {
  // "Ramah" vs "Ramah towards" is never interpretive sense-spread — a proper noun should not be Type B.
  assert.equal(db.prepare("SELECT COUNT(*) n FROM differences WHERE type='B' AND strongs LIKE 'H7414%'").get().n, 0);
});

test('genuine sense-spread survives the cleanup (baqar H1241: cattle/herd/oxen)', () => {
  const row = db.prepare("SELECT detail FROM differences WHERE type='B' AND strongs LIKE 'H1241%' LIMIT 1").get();
  assert.ok(row, 'baqar H1241 should still be Type B');
  const glosses = JSON.parse(row.detail).senses.map(s => s.gloss).join(' | ');
  assert.match(glosses, /cattle/i);
  assert.match(glosses, /herd/i);
  assert.match(glosses, /oxen/i);
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

test('Type A fires on virgin H1330 with young-woman H5291 as a near-synonym', () => {
  const rows = db.prepare("SELECT detail FROM differences WHERE type='A' AND strongs LIKE 'H1330%'").all();
  assert.ok(rows.length >= 1, 'expected a Type A row for virgin H1330 (Isaiah 7:14 pair)');
  const syns = rows.flatMap(r => JSON.parse(r.detail).nearSynonyms.map(s => s.strongs));
  assert.ok(syns.includes('H5291'), 'expected young-woman H5291 among near-synonyms');
});

test('Type A never fires on proper nouns (hamul H2538)', () => {
  const n = db.prepare("SELECT COUNT(*) n FROM differences WHERE type='A' AND strongs LIKE 'H2538%'").get().n;
  assert.equal(n, 0);
});

test('Type A excludes identical-gloss pairs (requireDiffSense): trembling H7578/H2731 never pair', () => {
  // Both lemmas gloss as "trembling"; the diff-sense filter must not pair them with each other.
  const h7578 = db.prepare("SELECT COUNT(*) n FROM differences WHERE type='A' AND strongs LIKE 'H7578%'").get().n;
  assert.equal(h7578, 0, 'H7578 (trembling) should not fire Type A');
  const rows = db.prepare("SELECT detail FROM differences WHERE type='A' AND strongs LIKE 'H2731%'").all();
  for (const r of rows) {
    const syns = JSON.parse(r.detail).nearSynonyms.map(s => s.strongs);
    assert.ok(!syns.includes('H7578'), 'H2731 must not list identical-gloss H7578 as a near-synonym');
  }
});

test('Type A near-synonyms: a word is never its own near-synonym, and near-synonyms are present', () => {
  // spot check: a Hebrew Type A row's near-synonym list must exclude the word itself and be non-empty.
  const row = db.prepare("SELECT strongs, detail FROM differences WHERE type='A' AND strongs LIKE 'H1330%' LIMIT 1").get();
  const synKeys = JSON.parse(row.detail).nearSynonyms.map(s => s.strongs);
  assert.ok(!synKeys.includes('H1330'), 'a word is never its own near-synonym');
  assert.ok(synKeys.length >= 1);
});
