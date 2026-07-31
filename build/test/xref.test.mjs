import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normKey, buildIndex, resolveTarget, extractXrefs } from '../lib/xref.mjs';

const ARTICLES = [
  { id: 'Beast', title: 'Beast', sort_title: 'beast', kind: 'article', host_id: null,
    body: 'Figurative usage. See Antichrist; Mark of the Beast; Prophets, False.' },   // last one absent
  { id: 'Antichrist', title: 'Antichrist', sort_title: 'antichrist', kind: 'article', host_id: null,
    body: 'A denier.' },
  { id: 'MarkofGod', title: 'Mark of God*, Mark of the Beast', sort_title: 'mark of god, mark of the beast',
    kind: 'article', host_id: null, body: 'Ensignia.' },
  { id: 'Animals', title: 'Animals', sort_title: 'animals', kind: 'article', host_id: null,
    body: 'Creatures.\n## Cattle\nOxen and cows.\n## Deer\nGazelles.' },
  { id: 'Bull', title: 'Bull*, Bullock', sort_title: 'bull, bullock', kind: 'article', host_id: null,
    body: 'A male ox. See Animals (Cattle).' },
  { id: 'Lord', title: 'Lord’s Supper, the', sort_title: "lord's supper, the", kind: 'article',
    host_id: null, body: 'A meal.' },
  { id: 'Cup', title: 'Cup', sort_title: 'cup', kind: 'article', host_id: null,
    body: 'A vessel. See Lord’s Supper, the.' },
  { id: 'Vine', title: 'Plants', sort_title: 'plants', kind: 'article', host_id: null,
    body: 'Flora.\n## Bramble\nThorns.' },
  { id: 'Grape', title: 'Grape', sort_title: 'grape', kind: 'article', host_id: null,
    body: 'Fruit. See Plants (Vine).' },
  { id: 'Self', title: 'Self', sort_title: 'self', kind: 'article', host_id: null,
    body: 'Circular. See Self.' },
  // Supplements. A hosted one is rendered inside its host; an orphan has nowhere else to live.
  { id: 'CupBox', title: 'A Cup of Cold Water', sort_title: 'a cup of cold water',
    kind: 'textbox', host_id: 'Cup', body: 'Hospitality.' },
  { id: 'LooseBox', title: 'Nobody Hosts This', sort_title: 'nobody hosts this',
    kind: 'textbox', host_id: null, body: 'Adrift. See Antichrist; Grape.' },
  { id: 'BeastChart', title: 'Antichrist', sort_title: 'antichrist',
    kind: 'chart', host_id: 'Beast', body: 'A chart sharing its title with an article.' },
];
const IX = buildIndex(ARTICLES);

test('normKey: strips asterisks, sense pointers, trailing punctuation, curly apostrophes', () => {
  assert.equal(normKey('Minerals* and Metals'), 'minerals and metals');
  assert.equal(normKey('Acbor #2'), 'acbor');
  assert.equal(normKey('Sin.'), 'sin');
  assert.equal(normKey('Lord’s  Supper'), "lord's supper");
  assert.equal(normKey('Testaments (above)'), 'testaments');
});

test('normKey: unwraps a fully quoted title but leaves quotes that are part of one', () => {
  // Tyndale quotes a supplement's title when it cites one: `See “Abraham’s Bosom”.`
  assert.equal(normKey('“Abraham’s Bosom”'), "abraham's bosom");
  assert.equal(normKey('Calling Jesus “Beelzebul”'), 'calling jesus “beelzebul”');
  assert.equal(normKey('Oak, Diviners’'), "oak, diviners'");
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

test('a hosted supplement resolves to its host, anchored by its own title', () => {
  assert.deepEqual(resolveTarget('A Cup of Cold Water', IX),
    { dst: 'Cup', anchor: 'A Cup of Cold Water' });
});

test('an orphan supplement is its own destination and carries no anchor', () => {
  assert.deepEqual(resolveTarget('Nobody Hosts This', IX), { dst: 'LooseBox', anchor: null });
});

test('an article outranks a supplement that normalises to the same title', () => {
  // BeastChart is titled "Antichrist" too. The article is the entry a reader can open.
  assert.deepEqual(resolveTarget('Antichrist', IX), { dst: 'Antichrist', anchor: null });
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
  assert.deepEqual(extractXrefs(a, IX),
    [{ src: 'D', dst: null, raw: 'Nowhere At All', anchor: null, seq: 0 }]);
});

test('extractXrefs: drops self-edges', () => {
  assert.deepEqual(extractXrefs(ARTICLES[9], IX), []);
});

test('extractXrefs: reads a supplement body as a source', () => {
  assert.deepEqual(extractXrefs(ARTICLES[11], IX), [
    { src: 'LooseBox', dst: 'Antichrist', raw: 'Antichrist', anchor: null, seq: 0 },
    { src: 'LooseBox', dst: 'Grape', raw: 'Grape', anchor: null, seq: 1 },
  ]);
});

test('extractXrefs: a host citing its own supplement is a self-edge, and is dropped', () => {
  // The redirect sends the box back to the article doing the citing. This is the only shape the
  // hosted case takes anywhere in the real corpus — Flood, the names its own textbox
  // “Scientific Evidence for the Flood?” and nothing else cites a hosted supplement from outside.
  const host = { id: 'Cup', kind: 'article', body: 'A vessel. See A Cup of Cold Water.' };
  assert.deepEqual(extractXrefs(host, IX), []);
});

test('extractXrefs: skips structural pointers like "See above"', () => {
  assert.deepEqual(extractXrefs({ id: 'X', body: 'Text. See above.' }, IX), []);
});

test('extractXrefs: deduplicates a target named twice by the same article', () => {
  const a = { id: 'D', body: 'One. See Antichrist. Two. See Antichrist.' };
  assert.deepEqual(extractXrefs(a, IX),
    [{ src: 'D', dst: 'Antichrist', raw: 'Antichrist', anchor: null, seq: 0 }]);
});

test('extractXrefs: matches a "See" clause preceded by a period inside a closing curly quote', () => {
  // Tyndale often closes a sentence with the period INSIDE the quote mark, e.g.
  // `...the English word "eon." See Age.` The clause is invisible unless the quote is
  // allowed to sit between the terminator and "See".
  const a = { id: 'D', body: 'Greek word for a long period of time or age, from which comes the English word “eon.” See Antichrist.' };
  assert.deepEqual(extractXrefs(a, IX),
    [{ src: 'D', dst: 'Antichrist', raw: 'Antichrist', anchor: null, seq: 0 }]);
});

test('extractXrefs: matches a "See" clause preceded by a semicolon', () => {
  const a = { id: 'D', body: 'Several views exist; See Antichrist.' };
  assert.deepEqual(extractXrefs(a, IX),
    [{ src: 'D', dst: 'Antichrist', raw: 'Antichrist', anchor: null, seq: 0 }]);
});
