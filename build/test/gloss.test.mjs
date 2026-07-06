// build/test/gloss.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGloss, senseKey } from '../lib/gloss.mjs';

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
