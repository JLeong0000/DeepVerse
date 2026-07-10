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

// Tier 1: a stronger stem (Porter + irregular pre-map + -im plural) merges residual "senses" the
// coarse stemmer left split — plurals, agent nouns, and irregular verbs of the SAME meaning.
test('senseKey merges plurals/derivations/irregulars the coarse stemmer missed', () => {
  assert.equal(senseKey('cherubim'), senseKey('cherub'));        // Hebrew-English -im plural
  assert.equal(senseKey('apostasies'), senseKey('apostasy'));    // -ies plural
  assert.equal(senseKey('killer'), senseKey('kill'));            // agent -er
  assert.equal(senseKey('said'), senseKey('saying'));            // irregular past normalizes to lemma
  assert.equal(senseKey('went'), senseKey('going'));             // irregular past normalizes to lemma
});
test('senseKey keeps Type-B keepers distinct (no over-merge from the stronger stem)', () => {
  assert.notEqual(senseKey('cattle'), senseKey('herd'));
  assert.notEqual(senseKey('herd'), senseKey('oxen'));
  assert.notEqual(senseKey('worship'), senseKey('kneeling'));
  assert.notEqual(senseKey('evil'), senseKey('harm'));
});

// A trailing function word (the/of/to) or a "/" morpheme boundary must never become the sense head —
// that fragments ONE meaning into stray keys like "the"/"of"/"to". Split on "/", drop function words.
test('senseKey ignores trailing function words when picking the head', () => {
  assert.equal(senseKey('having been spoken of'), senseKey('spoken'));
  assert.equal(senseKey('the temple of'), senseKey('temple'));
  assert.notEqual(senseKey('spoken'), senseKey('of'));   // must not key on the particle
});
test('hebrewSenseKey collapses "/" particle segments and trailing slashes', () => {
  assert.equal(hebrewSenseKey('and/ gold/ the'), hebrewSenseKey('gold'));
  assert.equal(hebrewSenseKey('pay attention to/'), hebrewSenseKey('be attentive'));
});
test('cleaning does not merge genuinely distinct senses (chattat sin vs sin offering)', () => {
  assert.notEqual(hebrewSenseKey('sins of'), hebrewSenseKey('a sin offering'));
});

test('reflexive pronouns are dropped, not treated as the sense', () => {
  assert.equal(senseKey('gird yourselves'), senseKey('he girded'));
  assert.equal(senseKey('gird themselves'), senseKey('he girded'));
  assert.equal(senseKey('you yourselves'), senseKey('you'));   // emphatic pronoun collapses to one sense
});
test('more irregular verbs normalize to their lemma', () => {
  assert.equal(senseKey('he flew'), senseKey('flying'));
  assert.equal(senseKey('bound'), senseKey('bind'));
  assert.equal(senseKey('they ate'), senseKey('eating'));
  assert.equal(senseKey('has'), senseKey('having'));       // has/had -> have (not the "ha" mis-stem)
  assert.equal(senseKey('they found'), senseKey('finding'));
  assert.equal(senseKey('he heard'), senseKey('hearing'));
});
test('adverbial particles of phrasal verbs are dropped (pass over/away/through)', () => {
  assert.equal(senseKey('pass away'), senseKey('passed over'));
  assert.equal(senseKey('pass through'), senseKey('passing'));
});
