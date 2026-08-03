import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, resolveLink, buildXrefRows } from '../lib/xref.mjs';
import { extractItemLinks } from '../lib/tyndale.mjs';

// Rows carry only what the resolver reads. Bodies matter for their "## " subheads.
const ARTICLES = [
  { id: 'Beast', title: 'Beast', kind: 'article', host_id: null, body: 'Figurative usage.' },
  { id: 'Antichrist', title: 'Antichrist', kind: 'article', host_id: null, body: 'A denier.' },
  { id: 'Animals', title: 'Animals', kind: 'article', host_id: null,
    body: 'Creatures.\n## Cattle\nOxen and cows.\n## Deer\nGazelles.' },
  { id: 'Birds', title: 'Birds', kind: 'article', host_id: null,
    body: 'Fowl.\n## Fowl, Domestic\nHens.\n## Partridge\nGround birds.' },
  { id: 'Cup', title: 'Cup', kind: 'article', host_id: null, body: 'A vessel.' },
  // Supplements: a hosted one renders inside its host, an orphan is its own destination.
  { id: 'CupBox', title: 'A Cup of Cold Water', kind: 'textbox', host_id: 'Cup', body: 'Hospitality.' },
  { id: 'LooseBox', title: 'Nobody Hosts This', kind: 'textbox', host_id: null, body: 'Adrift.' },
];
const IX = buildIndex(ARTICLES);
const link = (item, text, kind = 'Article') => ({ item, kind, text });

test('buildIndex: collects "## " subheads, keyed case-insensitively', () => {
  assert.deepEqual([...IX.subheads.get('Animals').keys()], ['cattle', 'deer']);
  assert.equal(IX.subheads.get('Animals').get('cattle'), 'Cattle');
  assert.equal(IX.subheads.has('Beast'), false);      // no subheads, no entry
});

test('resolveLink: a plain article link resolves to itself with no anchor', () => {
  assert.deepEqual(resolveLink(link('Antichrist', 'Antichrist'), IX),
    { dst: 'Antichrist', anchor: null });
});

test('resolveLink: "(Subhead)" in the link text anchors inside the target', () => {
  assert.deepEqual(resolveLink(link('Animals', 'Animals (Cattle)'), IX),
    { dst: 'Animals', anchor: 'Cattle' });
});

test('resolveLink: an unmatched subhead still yields a link, anchor dropped', () => {
  assert.deepEqual(resolveLink(link('Animals', 'Animals (Wolf)'), IX),
    { dst: 'Animals', anchor: null });
});

// The defect that made splitting on ';' impossible: ONE link naming TWO subheads. Splitting it
// produced a broken "Birds (Fowl, Domestic" target plus an orphan "Partridge)" reported as absent.
test('resolveLink: one link naming two subheads yields one edge, on the first that exists', () => {
  assert.deepEqual(resolveLink(link('Birds', 'Birds (Fowl, Domestic; Partridge)'), IX),
    { dst: 'Birds', anchor: 'Fowl, Domestic' });
  assert.deepEqual(resolveLink(link('Birds', 'Birds (Nonesuch; Partridge)'), IX),
    { dst: 'Birds', anchor: 'Partridge' });
});

test('resolveLink: a hosted supplement redirects to its host, anchored by its own title', () => {
  assert.deepEqual(resolveLink(link('CupBox', 'A Cup of Cold Water', 'Textbox'), IX),
    { dst: 'Cup', anchor: 'A Cup of Cold Water' });
});

test('resolveLink: an orphan supplement is its own destination', () => {
  assert.deepEqual(resolveLink(link('LooseBox', 'Nobody Hosts This', 'Textbox'), IX),
    { dst: 'LooseBox', anchor: null });
});

// The corpus has exactly one: Succoth links to the KeyPlacesintheExodus Map. Maps are not ingested.
test('resolveLink: a target that is not in the package resolves to nothing', () => {
  assert.equal(resolveLink(link('KeyPlacesintheExodus', 'map', 'Map'), IX), null);
});

test('buildXrefRows: emits one row per link, in source order, with seq', () => {
  const rows = buildXrefRows(ARTICLES[0], [link('Antichrist', 'Antichrist'), link('Animals', 'Animals (Cattle)')], IX);
  assert.deepEqual(rows, [
    { src: 'Beast', dst: 'Antichrist', raw: 'Antichrist', anchor: null, seq: 0 },
    { src: 'Beast', dst: 'Animals', raw: 'Animals (Cattle)', anchor: 'Cattle', seq: 1 },
  ]);
});

test('buildXrefRows: `raw` is the link text, not the target title', () => {
  // the real case: the link reads "Jesus Christ, Life and Teachings of" and points at an article
  // titled "Jesus Christ, Teachings of". The app matches this string against the rendered prose.
  const rows = buildXrefRows(ARTICLES[0], [link('Antichrist', 'The Man of Lawlessness')], IX);
  assert.equal(rows[0].raw, 'The Man of Lawlessness');
  assert.equal(rows[0].dst, 'Antichrist');
});

test('buildXrefRows: drops a link to the page it is already on', () => {
  assert.deepEqual(buildXrefRows(ARTICLES[0], [link('Beast', 'Beast')], IX), []);
});

test('buildXrefRows: drops a hosted supplement linking to its own host', () => {
  const box = ARTICLES.find((a) => a.id === 'CupBox');
  assert.deepEqual(buildXrefRows(box, [link('Cup', 'Cup')], IX), []);
});

test('buildXrefRows: deduplicates two links to the same destination', () => {
  const rows = buildXrefRows(ARTICLES[0],
    [link('Animals', 'Animals (Cattle)'), link('Animals', 'Animals (Deer)')], IX);
  assert.deepEqual(rows, [
    { src: 'Beast', dst: 'Animals', raw: 'Animals (Cattle)', anchor: 'Cattle', seq: 0 },
  ]);
});

// --- extractItemLinks: reading the links out of the source markup ---

const SEE = (inner) => `<p class="fl">Prose. <span class="ital">See</span> ${inner}.</p>`;
const A = (id, text, kind = 'Article') =>
  `<a href="?item=${id}_${kind}_TyndaleOpenBibleDictionary">${text}</a>`;

test('extractItemLinks: takes the item id and the display text', () => {
  assert.deepEqual(extractItemLinks(SEE(A('Antichrist', 'Antichrist'))),
    [{ item: 'Antichrist', kind: 'Article', text: 'Antichrist' }]);
});

test('extractItemLinks: several targets in one clause', () => {
  assert.deepEqual(
    extractItemLinks(SEE(`${A('FoodandFoodPreparation', 'Food and Food Preparation')}; ${A('Plants', 'Plants (Onion)')}`)),
    [{ item: 'FoodandFoodPreparation', kind: 'Article', text: 'Food and Food Preparation' },
     { item: 'Plants', kind: 'Article', text: 'Plants (Onion)' }]);
});

test('extractItemLinks: "See also" is the same clause', () => {
  const xml = `<p class="fl">Prose. <span class="ital">See also</span> ${A('Antichrist', 'Antichrist')}.</p>`;
  assert.deepEqual(extractItemLinks(xml), [{ item: 'Antichrist', kind: 'Article', text: 'Antichrist' }]);
});

// A "#Subhead" href points inside the SAME article ("Locust (below)"). The reader is already there,
// so it is not an edge — and it must never be reported as a target absent from the corpus.
test('extractItemLinks: an intra-article "#Subhead" link is not a cross-reference', () => {
  assert.deepEqual(extractItemLinks(SEE('<a href="#Locust">Locust (below)</a>')), []);
});

test('extractItemLinks: a scripture ?bref= link is not a cross-reference', () => {
  assert.deepEqual(extractItemLinks(SEE('<a href="?bref=Gen.1.1">Gn 1:1</a>')), []);
});

// The 7 parenthetical asides in the corpus. They carry no ?item= link, so no separate rule is
// needed to exclude them — which is why this replaced a regex that had to guess.
test('extractItemLinks: a parenthetical aside contributes nothing', () => {
  const xml = '<p class="fl">Read aloud. (<span class="ital">See also</span> '
    + '<a href="?bref=Col.4.16">Col 4:16</a>; <a href="?bref=Rev.1.3">Rv 1:3</a>.) More prose.</p>';
  assert.deepEqual(extractItemLinks(xml), []);
});

test('extractItemLinks: link text is normalised exactly as cleanBody normalises the body', () => {
  // a non-breaking space inside link text must survive, because the app matches this string
  // against the flattened body, where cleanBody leaves U+00A0 alone
  const xml = SEE(A('ChronologyoftheBibleOldTestament', 'Chronology of the Bible (Old Testament)'));
  assert.equal(extractItemLinks(xml)[0].text, 'Chronology of the Bible (Old Testament)');
});

test('extractItemLinks: inline markup inside the link text is stripped', () => {
  assert.deepEqual(extractItemLinks(SEE(A('Antichrist', '<span class="ital">Antichrist</span>'))),
    [{ item: 'Antichrist', kind: 'Article', text: 'Antichrist' }]);
});

// Not every cross-reference sits in a "See …" clause. `Bible` ends on a bulleted list of the seven
// major Bible articles, each a real link; restricting extraction to See clauses left that article
// with no outbound edges and a "names no other entry" notice under seven of them.
test('extractItemLinks: a link outside a "See …" clause still counts', () => {
  const xml = '<p class="fl">Several other major articles on the Bible follow:</p>'
    + `<p class="list">• ${A('BibleCanonofthe', 'Bible, Canon of the')}</p>`
    + `<p class="list">• ${A('BibleInspirationofthe', 'Bible, Inspiration of the')}</p>`;
  assert.deepEqual(extractItemLinks(xml), [
    { item: 'BibleCanonofthe', kind: 'Article', text: 'Bible, Canon of the' },
    { item: 'BibleInspirationofthe', kind: 'Article', text: 'Bible, Inspiration of the' },
  ]);
});
