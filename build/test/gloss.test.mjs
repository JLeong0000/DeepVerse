// build/test/gloss.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGloss, senseKey, hebrewSenseKey } from '../lib/gloss.mjs';

test('strips brackets, articles, punctuation, case', () => {
  assert.equal(normalizeGloss('[the] flesh,'), 'flesh');
  assert.equal(normalizeGloss('[The] book'), 'book');
  assert.equal(normalizeGloss('of flesh'), 'flesh');
  assert.equal(normalizeGloss('Soul'), 'soul');
});
test('empty/whitespace -> empty', () => {
  assert.equal(normalizeGloss('  '), '');
});

test('senseKey collapses inflections of the same word', () => {
  const k = senseKey('loving');
  assert.equal(senseKey('loves'), k);
  assert.equal(senseKey('i dearly love'), k);
  assert.equal(senseKey('do you dearly love'), k);
  assert.equal(senseKey('souls'), senseKey('soul'));
  assert.equal(senseKey('your souls'), senseKey('soul'));
});
test('senseKey keeps genuinely distinct meanings apart', () => {
  assert.notEqual(senseKey('soul'), senseKey('life'));
  assert.notEqual(senseKey('love'), senseKey('kiss'));
});
test('senseKey does not over-stem double-s words', () => {
  assert.equal(senseKey('i may kiss'), senseKey('kiss')); // kiss stays kiss, not kis
});

test('hebrewSenseKey collapses construct/pronominal baggage to one sense', () => {
  const k = hebrewSenseKey('god');
  assert.equal(hebrewSenseKey('god of'), k);        // construct
  assert.equal(hebrewSenseKey('god/ your'), k);     // pronominal suffix
  assert.equal(hebrewSenseKey('<obj.> god'), k);    // bracket marker
});

test('hebrewSenseKey keeps genuinely distinct senses distinct', () => {
  assert.notEqual(hebrewSenseKey('spirit of'), hebrewSenseKey('wind'));
  assert.notEqual(hebrewSenseKey('life/ my'), hebrewSenseKey('the/ person'));
});

test('hebrewSenseKey does not alter the Greek senseKey behavior', () => {
  // sanity: the shared senseKey still stems normally
  assert.equal(senseKey('loving'), senseKey('loves'));
});

test('stemHead does not over-strip short words (king/thing keep their stems)', () => {
  assert.equal(senseKey('the king'), senseKey('the kings'));      // singular & plural collapse
  assert.equal(senseKey('a thing'), senseKey('things'));
  assert.notEqual(senseKey('king'), senseKey('kin'));             // 'king' must not become 'k'
});
test('stemHead still collapses genuine inflections', () => {
  assert.equal(senseKey('loving'), senseKey('loves'));           // -> lov
});
