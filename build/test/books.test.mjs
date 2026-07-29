import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OSIS_BOOKS, APOCRYPHA, ALIASES, toOsis, toOsisOrNull } from '../lib/books.mjs';

test('OSIS_BOOKS: canonical 66 in order', () => {
  assert.equal(OSIS_BOOKS.length, 66);
  assert.equal(OSIS_BOOKS[0], 'Gen');
  assert.equal(OSIS_BOOKS[39], 'Matt');
  assert.equal(OSIS_BOOKS[65], 'Rev');
});

test('toOsis: canonical codes pass through unchanged', () => {
  for (const b of OSIS_BOOKS) assert.equal(toOsis(b), b);
});

test('toOsis: Tyndale Arabic scheme (the 1Thes trap)', () => {
  assert.equal(toOsis('1Thes'), '1Thess');
  assert.equal(toOsis('2Thes'), '2Thess');
  assert.equal(toOsis('1Jn'), '1John');
  assert.equal(toOsis('2Jn'), '2John');
  assert.equal(toOsis('3Jn'), '3John');
  assert.equal(toOsis('Hagg'), 'Hag');
  assert.equal(toOsis('Jon'), 'Jonah');
  assert.equal(toOsis('Pr'), 'Prov');
});

test('toOsis: dictionary-only singleton variants', () => {
  assert.equal(toOsis('Jos'), 'Josh');
  assert.equal(toOsis('Mt'), 'Matt');
  assert.equal(toOsis('Esther'), 'Esth');
});

test('toOsis: Tyndale Roman scheme (StudyNotes name attribute)', () => {
  assert.equal(toOsis('ISam'), '1Sam');
  assert.equal(toOsis('IIPet'), '2Pet');
  assert.equal(toOsis('IIIJn'), '3John');
  assert.equal(toOsis('IThes'), '1Thess');
});

test('toOsis: STEPBible scheme', () => {
  assert.equal(toOsis('1Th'), '1Thess');
  assert.equal(toOsis('Sng'), 'Song');
  assert.equal(toOsis('Jhn'), 'John');
});

test('toOsis: NLT scheme', () => {
  assert.equal(toOsis('Sol'), 'Song');
  assert.equal(toOsis('Joh'), 'John');
  assert.equal(toOsis('1Sa'), '1Sam');
});

test('toOsis: THROWS on an unknown code (the regression guard)', () => {
  assert.throws(() => toOsis('Sirach'), /unknown book code: Sirach/);
  assert.throws(() => toOsis('Blah'), /unknown book code: Blah/);
});

test('toOsis: prototype-key bypass guard — rejects Object.prototype members', () => {
  assert.throws(() => toOsis('constructor'), /unknown book code: constructor/);
  assert.throws(() => toOsis('toString'), /unknown book code: toString/);
  assert.throws(() => toOsis('hasOwnProperty'), /unknown book code: hasOwnProperty/);
  assert.throws(() => toOsis('valueOf'), /unknown book code: valueOf/);
});

test('toOsisOrNull: prototype-key bypass guard — rejects Object.prototype members', () => {
  assert.throws(() => toOsisOrNull('constructor'), /unknown book code: constructor/);
  assert.throws(() => toOsisOrNull('toString'), /unknown book code: toString/);
  assert.throws(() => toOsisOrNull('hasOwnProperty'), /unknown book code: hasOwnProperty/);
  assert.throws(() => toOsisOrNull('valueOf'), /unknown book code: valueOf/);
});

test('toOsis: apocrypha throws — callers must use toOsisOrNull', () => {
  assert.throws(() => toOsis('1Macc'), /apocryphal book code: 1Macc/);
});

test('toOsisOrNull: apocrypha returns null, unknown still throws', () => {
  assert.equal(toOsisOrNull('1Macc'), null);
  assert.equal(toOsisOrNull('Tb'), null);
  assert.equal(toOsisOrNull('Ecclus'), null);
  assert.equal(toOsisOrNull('1Thes'), '1Thess');
  assert.throws(() => toOsisOrNull('Sirach'), /unknown book code/);
});

test('APOCRYPHA: the 12 codes the dictionary cites', () => {
  assert.equal(APOCRYPHA.size, 12);
  for (const c of ['1Esd', '2Esd', '1Macc', '2Macc', '3Macc', 'AddEsth',
                   'Bar', 'Bel', 'Ecclus', 'Jdt', 'Tb', 'Wisd'])
    assert.ok(APOCRYPHA.has(c), `${c} missing from APOCRYPHA`);
});

// The integrity check that makes consolidation safe: no alias may resolve to a
// non-canonical code, and no alias may collide with a different canonical book.
test('ALIASES: every alias resolves to a real OSIS book', () => {
  const canon = new Set(OSIS_BOOKS);
  for (const [alias, osis] of Object.entries(ALIASES))
    assert.ok(canon.has(osis), `alias ${alias} -> ${osis} is not a canonical OSIS book`);
});

test('ALIASES: no alias shadows a different canonical book', () => {
  const canon = new Set(OSIS_BOOKS);
  for (const [alias, osis] of Object.entries(ALIASES))
    if (canon.has(alias)) assert.equal(alias, osis, `alias ${alias} shadows canonical ${alias}`);
});
