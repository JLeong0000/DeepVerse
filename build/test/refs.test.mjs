// build/test/refs.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWordRef, STEP2OSIS } from '../lib/refs.mjs';

test('parses a plain Greek ref', () => {
  assert.deepEqual(parseWordRef('Mat.1.1#01=NKO'),
    { book: 'Matt', chapter: 1, verse: 1, position: 1 });
});

test('parses a dual-versification ref (the Daniel 4/6 bug)', () => {
  assert.deepEqual(parseWordRef('Dan.4.1(3.31)#01=L'),
    { book: 'Dan', chapter: 4, verse: 1, position: 1 });
  assert.deepEqual(parseWordRef('Dan.6.1(6.2)#02=L'),
    { book: 'Dan', chapter: 6, verse: 1, position: 2 });
});

test('returns null for non-data / unknown-book lines', () => {
  assert.equal(parseWordRef('# Mat.1.1\tΒίβλος'), null);
  assert.equal(parseWordRef('Zzz.1.1#01'), null);
});

test('STEP2OSIS covers 66 books and maps Mrk->Mark', () => {
  assert.equal(Object.keys(STEP2OSIS).length, 66);
  assert.equal(STEP2OSIS.Mrk, 'Mark');
});
