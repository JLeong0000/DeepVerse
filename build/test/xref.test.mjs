import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normKey, buildIndex, resolveTarget, extractXrefs } from '../lib/xref.mjs';

const ARTICLES = [
  { id: 'Beast', title: 'Beast', sort_title: 'beast',
    body: 'Figurative usage. See Antichrist; Mark of the Beast; Prophets, False.' },   // last one absent
  { id: 'Antichrist', title: 'Antichrist', sort_title: 'antichrist', body: 'A denier.' },
  { id: 'MarkofGod', title: 'Mark of God*, Mark of the Beast', sort_title: 'mark of god, mark of the beast',
    body: 'Ensignia.' },
  { id: 'Animals', title: 'Animals', sort_title: 'animals',
    body: 'Creatures.\n## Cattle\nOxen and cows.\n## Deer\nGazelles.' },
  { id: 'Bull', title: 'Bull*, Bullock', sort_title: 'bull, bullock',
    body: 'A male ox. See Animals (Cattle).' },
  { id: 'Lord', title: 'Lord’s Supper, the', sort_title: "lord's supper, the", body: 'A meal.' },
  { id: 'Cup', title: 'Cup', sort_title: 'cup', body: 'A vessel. See Lord’s Supper, the.' },
  { id: 'Vine', title: 'Plants', sort_title: 'plants', body: 'Flora.\n## Bramble\nThorns.' },
  { id: 'Grape', title: 'Grape', sort_title: 'grape', body: 'Fruit. See Plants (Vine).' },
  { id: 'Self', title: 'Self', sort_title: 'self', body: 'Circular. See Self.' },
];
const IX = buildIndex(ARTICLES);

test('normKey: strips asterisks, sense pointers, trailing punctuation, curly apostrophes', () => {
  assert.equal(normKey('Minerals* and Metals'), 'minerals and metals');
  assert.equal(normKey('Acbor #2'), 'acbor');
  assert.equal(normKey('Sin.'), 'sin');
  assert.equal(normKey('Lord’s  Supper'), "lord's supper");
  assert.equal(normKey('Testaments (above)'), 'testaments');
});

test('tier 1: exact normalised title', () => {
  assert.deepEqual(resolveTarget('Antichrist', IX), { dst: 'Antichrist', anchor: null });
});

test('tier 3: a comma segment claimed by exactly one article', () => {
  // "Mark of the Beast" is the SECOND headword of "Mark of God*, Mark of the Beast"
  assert.deepEqual(resolveTarget('Mark of the Beast', IX), { dst: 'MarkofGod', anchor: null });
});

test('tier 3 does not fire when a segment is ambiguous or single-word', () => {
  // "the" appears as a segment of "Lord’s Supper, the" but is one word — never indexed
  assert.equal(resolveTarget('the', IX), null);
});

test('tier 4: Article (Subhead) resolves to the article plus the anchor', () => {
  assert.deepEqual(resolveTarget('Animals (Cattle)', IX), { dst: 'Animals', anchor: 'Cattle' });
});

test('tier 4 fallback: unmatched subhead still links the host, anchor dropped', () => {
  assert.deepEqual(resolveTarget('Plants (Vine)', IX), { dst: 'Vine', anchor: null });
});

test('an inverted title with a comma still resolves exactly', () => {
  assert.deepEqual(resolveTarget('Lord’s Supper, the', IX), { dst: 'Lord', anchor: null });
});

test('a target absent from the corpus resolves to null, never throws', () => {
  assert.equal(resolveTarget('Jesus Christ, Life and Teachings of', IX), null);
});

test('extractXrefs: splits a multi-target clause and RECORDS the absent one', () => {
  // "Prophets, False" is absent from this fixture. It must be kept with dst null, not dropped:
  // the UI shows these honestly, and discarding them would overstate how complete the graph is.
  const rows = extractXrefs(ARTICLES[0], IX);
  assert.deepEqual(rows, [
    { src: 'Beast', dst: 'Antichrist', raw: 'Antichrist', anchor: null, seq: 0 },
    { src: 'Beast', dst: 'MarkofGod', raw: 'Mark of the Beast', anchor: null, seq: 1 },
    { src: 'Beast', dst: null, raw: 'Prophets, False', anchor: null, seq: 2 },
  ]);
});

test('extractXrefs: honours "See also" and carries an anchor', () => {
  assert.deepEqual(extractXrefs(ARTICLES[4], IX),
    [{ src: 'Bull', dst: 'Animals', raw: 'Animals (Cattle)', anchor: 'Cattle', seq: 0 }]);
});

test('extractXrefs: deduplicates an absent target named twice', () => {
  const a = { id: 'D', body: 'One. See Nowhere At All. Two. See Nowhere At All.' };
  assert.equal(extractXrefs(a, IX).length, 1);
});

test('extractXrefs: drops self-edges', () => {
  assert.deepEqual(extractXrefs(ARTICLES[9], IX), []);
});

test('extractXrefs: skips structural pointers like "See above"', () => {
  assert.deepEqual(extractXrefs({ id: 'X', body: 'Text. See above.' }, IX), []);
});

test('extractXrefs: deduplicates a target named twice by the same article', () => {
  const a = { id: 'D', body: 'One. See Antichrist. Two. See Antichrist.' };
  assert.equal(extractXrefs(a, IX).length, 1);
});
