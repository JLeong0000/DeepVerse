// build/test/lang.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveLang } from '../lib/lang.mjs';

test('NT stays Greek', () => {
  assert.equal(deriveLang('N-NSF', 'grc'), 'grc');
});
test('OT Hebrew morph -> hbo', () => {
  assert.equal(deriveLang('HVqp3ms', 'hbo'), 'hbo');
  assert.equal(deriveLang('HR/Ncfsa', 'hbo'), 'hbo');
});
test('OT Aramaic morph (leading A) -> arc', () => {
  assert.equal(deriveLang('AVqp3ms', 'hbo'), 'arc');
  assert.equal(deriveLang('ANgmpd/Ta', 'hbo'), 'arc'); // compound Aramaic morph
});
test('Hebrew ADJECTIVE morph (HA...) stays hbo, not arc', () => {
  // 'HAcmsc' = Hebrew(H) Adjective(A) — the leading H is the language, the A is part-of-speech.
  assert.equal(deriveLang('HAcmsc', 'hbo'), 'hbo');
  assert.equal(deriveLang('HAcfsa', 'hbo'), 'hbo');
});
