import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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

// Full STEP2OSIS map recovered from `git show 0855615:build/lib/refs.mjs` (66 entries).
// Asserted whole, not spot-checked: a dropped token (e.g. the missing Ezr that broke
// parse-nlt.mjs) must fail this test, not slip through a handful of examples.
const STEPBIBLE_TOKENS = {
  Gen: 'Gen', Exo: 'Exod', Lev: 'Lev', Num: 'Num', Deu: 'Deut', Jos: 'Josh', Jdg: 'Judg', Rut: 'Ruth',
  '1Sa': '1Sam', '2Sa': '2Sam', '1Ki': '1Kgs', '2Ki': '2Kgs', '1Ch': '1Chr', '2Ch': '2Chr', Ezr: 'Ezra', Neh: 'Neh',
  Est: 'Esth', Job: 'Job', Psa: 'Ps', Pro: 'Prov', Ecc: 'Eccl', Sng: 'Song', Isa: 'Isa', Jer: 'Jer', Lam: 'Lam',
  Ezk: 'Ezek', Dan: 'Dan', Hos: 'Hos', Jol: 'Joel', Amo: 'Amos', Oba: 'Obad', Jon: 'Jonah', Mic: 'Mic', Nam: 'Nah',
  Hab: 'Hab', Zep: 'Zeph', Hag: 'Hag', Zec: 'Zech', Mal: 'Mal', Mat: 'Matt', Mrk: 'Mark', Luk: 'Luke', Jhn: 'John',
  Act: 'Acts', Rom: 'Rom', '1Co': '1Cor', '2Co': '2Cor', Gal: 'Gal', Eph: 'Eph', Php: 'Phil', Col: 'Col',
  '1Th': '1Thess', '2Th': '2Thess', '1Ti': '1Tim', '2Ti': '2Tim', Tit: 'Titus', Phm: 'Phlm', Heb: 'Heb', Jas: 'Jas',
  '1Pe': '1Pet', '2Pe': '2Pet', '1Jn': '1John', '2Jn': '2John', '3Jn': '3John', Jud: 'Jude', Rev: 'Rev',
};

test('toOsis: STEPBible scheme — full 66-book coverage', () => {
  assert.equal(Object.keys(STEPBIBLE_TOKENS).length, 66);
  for (const [token, osis] of Object.entries(STEPBIBLE_TOKENS))
    assert.equal(toOsis(token), osis, `STEPBible token ${token} should resolve to ${osis}`);
});

// Full NLT BOOKS map recovered from `git show 0855615:build/parse-nlt.mjs` (66 entries,
// display name dropped — only the token -> OSIS half matters here).
const NLT_TOKENS = {
  Gen: 'Gen', Exo: 'Exod', Lev: 'Lev', Num: 'Num', Deu: 'Deut', Jos: 'Josh', Jdg: 'Judg', Rut: 'Ruth',
  '1Sa': '1Sam', '2Sa': '2Sam', '1Ki': '1Kgs', '2Ki': '2Kgs', '1Ch': '1Chr', '2Ch': '2Chr', Ezr: 'Ezra', Neh: 'Neh',
  Est: 'Esth', Job: 'Job', Psa: 'Ps', Pro: 'Prov', Ecc: 'Eccl', Sol: 'Song', Isa: 'Isa', Jer: 'Jer', Lam: 'Lam',
  Eze: 'Ezek', Dan: 'Dan', Hos: 'Hos', Joe: 'Joel', Amo: 'Amos', Oba: 'Obad', Jon: 'Jonah', Mic: 'Mic', Nah: 'Nah',
  Hab: 'Hab', Zep: 'Zeph', Hag: 'Hag', Zec: 'Zech', Mal: 'Mal', Mat: 'Matt', Mar: 'Mark', Luk: 'Luke', Joh: 'John',
  Act: 'Acts', Rom: 'Rom', '1Co': '1Cor', '2Co': '2Cor', Gal: 'Gal', Eph: 'Eph', Phi: 'Phil', Col: 'Col',
  '1Th': '1Thess', '2Th': '2Thess', '1Ti': '1Tim', '2Ti': '2Tim', Tit: 'Titus', Phm: 'Phlm', Heb: 'Heb', Jam: 'Jas',
  '1Pe': '1Pet', '2Pe': '2Pet', '1Jo': '1John', '2Jo': '2John', '3Jo': '3John', Jud: 'Jude', Rev: 'Rev',
};

test('toOsis: NLT scheme — full 66-book coverage', () => {
  assert.equal(Object.keys(NLT_TOKENS).length, 66);
  for (const [token, osis] of Object.entries(NLT_TOKENS))
    assert.equal(toOsis(token), osis, `NLT token ${token} should resolve to ${osis}`);
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

test('parse-nlt.mjs BOOKS: sync with toOsis, parsed as text to avoid PDF parser side effects', () => {
  // CRITICAL: This test parses parse-nlt.mjs as text instead of importing it. The script
  // loads a large PDF file and writes output files (data/bibles/NLT/*.json) as a side effect.
  // Running that during test execution would pollute the data directory and slow tests. By
  // parsing the source text with a regex instead, we extract and validate the BOOKS map
  // without triggering the parser. If a future reader changes this to an import, they will
  // reintroduce unwanted side effects in tests.
  const src = fs.readFileSync(new URL('../parse-nlt.mjs', import.meta.url), 'utf8');
  const entries = [...src.matchAll(/([A-Za-z0-9']+)\s*:\s*\['([A-Za-z0-9]+)'/g)]
    .map((m) => [m[1].replace(/'/g, ''), m[2]]);

  assert.equal(entries.length, 66, 'parse-nlt.mjs BOOKS should have exactly 66 entries');

  for (const [token, declaredOsis] of entries) {
    const resolvedOsis = toOsis(token);
    assert.equal(
      resolvedOsis,
      declaredOsis,
      `parse-nlt token '${token}' resolves to '${resolvedOsis}' but BOOKS declares '${declaredOsis}'`
    );
  }
});
