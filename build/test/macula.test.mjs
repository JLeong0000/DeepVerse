// build/test/macula.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMaculaGreekLine, parseProximityLine, baseHeb } from '../lib/macula.mjs';

const header = ['x1','x2','x3','x4','x5','x6','x7','gloss','x9','x10','lemma','x12','strong','x14',
  'x15','x16','x17','x18','x19','x20','x21','x22','domain','ln','frame'];
const row = new Array(25).fill('');
row[7]='love'; row[10]='ἀγαπάω'; row[12]='25'; row[22]='025003'; row[23]='25.43'; row[24]='';

test('parses a MACULA Greek row into normalized strongs', () => {
  const r = parseMaculaGreekLine(row.join('\t'), header);
  assert.equal(r.strongs, 'G0025');   // zero-padded to 4 digits, matches words.strongs
  assert.equal(r.lemma, 'ἀγαπάω');
  assert.equal(r.ln, '25.43');
  assert.equal(r.domain, '025003');
});
test('skips the header row', () => {
  assert.equal(parseMaculaGreekLine(header.join('\t'), header), null);
});
test('parses a proximity row (G/H/A spanning)', () => {
  assert.deepEqual(parseProximityLine('G1236\tH2416d\t0.729886'),
    { a: 'G1236', b: 'H2416d', distance: 0.729886 });
  assert.equal(parseProximityLine('StrongNumberX1\tStrongNumberX2\tDistance'), null);
});

test('baseHeb normalizes the three Hebrew Strong key formats to H+4-digit base', () => {
  assert.equal(baseHeb('H7225G'), 'H7225');   // words.strongs (uppercase homograph suffix)
  assert.equal(baseHeb('H2416d'), 'H2416');   // Proximity.tsv (lowercase suffix)
  assert.equal(baseHeb('0871a'), 'H0871');    // macula strongnumberx (no prefix, lowercase suffix)
  assert.equal(baseHeb('4430'), 'H4430');     // Aramaic, no suffix
  assert.equal(baseHeb('H0001G, H5703'), 'H0001'); // comma-joined multi-strong -> first token
  assert.equal(baseHeb('G0025'), null);       // not Hebrew (no H, starts with letter G)
  assert.equal(baseHeb(''), null);
});
