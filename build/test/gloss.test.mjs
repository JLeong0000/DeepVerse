// build/test/gloss.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGloss } from '../lib/gloss.mjs';

test('strips brackets, articles, punctuation, case', () => {
  assert.equal(normalizeGloss('[the] flesh,'), 'flesh');
  assert.equal(normalizeGloss('[The] book'), 'book');
  assert.equal(normalizeGloss('of flesh'), 'flesh');
  assert.equal(normalizeGloss('Soul'), 'soul');
});
test('empty/whitespace -> empty', () => {
  assert.equal(normalizeGloss('  '), '');
});
