import { test } from 'node:test';
import assert from 'node:assert/strict';
import { structureBody, parseBlocks, classifyBlock,
  iterItems, cleanBody, parseRefRange, extractBrefs, countBrefs, extractIncludes,
  sortTitle, titleTerms } from '../lib/tyndale.mjs';

const ARTICLE = `<items release="1.6">
<item typename="Article" product="TyndaleOpenBibleDictionary" name="Abba">
  <title>Abba</title>
  <body><p class="h1">ABBA</p>
<p class="fl">Aramaic word for &#8220;father,&#8221; applied to God in
<a href="?bref=Mark.14.36">Mk 14:36</a>; <a href="?bref=Rom.8.15">Rom 8:15</a>.</p>
  </body>
</item>
<item typename="Article" product="TyndaleOpenBibleDictionary" name="Calf">
  <title>Calf</title>
  <body><p class="h1">CALF</p><p class="fl">See <a href="?item=Animals_Article">Animals</a>.</p></body>
</item>
</items>`;

test('iterItems: yields each item with typename, name, title, body', () => {
  const items = [...iterItems(ARTICLE)];
  assert.equal(items.length, 2);
  assert.equal(items[0].typename, 'Article');
  assert.equal(items[0].name, 'Abba');
  assert.equal(items[0].title, 'Abba');
  assert.ok(items[0].body.includes('Aramaic'));
});

test('iterItems: tolerates either attribute order', () => {
  const nameFirst = '<item name="X" typename="ThemeNote"><title>T</title><body><p>b</p></body></item>';
  const typeFirst = '<item typename="ThemeNote" name="X"><title>T</title><body><p>b</p></body></item>';
  for (const xml of [nameFirst, typeFirst]) {
    const [it] = [...iterItems(xml)];
    assert.equal(it.name, 'X');
    assert.equal(it.typename, 'ThemeNote');
  }
});

test('iterItems: captures <refs> when present, null when absent', () => {
  const withRefs = '<item typename="ThemeNote" name="X"><title>T</title>' +
    '<refs>Gen.1.1-2.25</refs><body><p>b</p></body></item>';
  assert.equal([...iterItems(withRefs)][0].refs, 'Gen.1.1-2.25');
  const noRefs = '<item typename="Article" name="X"><title>T</title><body><p>b</p></body></item>';
  assert.equal([...iterItems(noRefs)][0].refs, null);
});

test('cleanBody: strips tags, unwraps links, decodes entities, collapses whitespace', () => {
  const [it] = [...iterItems(ARTICLE)];
  const txt = cleanBody(it.body);
  assert.ok(!txt.includes('<'), 'tags remain');
  assert.ok(txt.includes('“father,”'), 'numeric entity not decoded');
  assert.ok(txt.includes('Mk 14:36'), 'link text lost');
  assert.ok(!txt.includes('href'), 'href leaked');
  assert.ok(!/\s{2,}/.test(txt), 'whitespace not collapsed');
});

const STRUCTURED = `<p class="h1">PROPHECY</p>
<p class="fl">Term, along with its English cognates, derived from Greek.</p>
<p class="h2">Prophecy in the Old Testament</p>
<p>The prophets spoke for God.</p>
<p class="list">• Moses</p>
<p class="h3">Types of Prophets</p>
<p class="extract">Quoted material here.</p>`;

test('structureBody: drops every title-restating block, whatever the source calls it', () => {
  // themes/profiles/intros each print their own title in the body, exactly as articles do with h1
  for (const cls of ['h1', 'theme-title', 'profile-title', 'intro-title']) {
    const out = structureBody(`<p class="${cls}">Jesus’ Final Night</p><p class="fl">Body text.</p>`);
    assert.equal(out, 'Body text.', `${cls} should not survive into the body`);
  }
});

// The complete <p class> inventory of the Tyndale corpus, counted across all six source files
// (Articles/*.xml, Textboxes, Charts, ThemeNotes, Profiles, BookIntros, BookIntroSummaries).
// It lives here as a fixture because backup-data/ is gitignored — a test that read the corpus
// could not run on a fresh clone. Regenerate with:
//   grep -ho '<p class="[^"]*"' backup-data/tyndale/**/*.xml | sort | uniq -c
const CORPUS_CLASSES = {
  head: ['h2', 'h3', 'h4', 'h5', 'h2-list', 'h2-preview', 'intro-h1', 'intro-sidebar-h1',
    'profile-h1', 'theme-h2', 'box-h2', 'box-h2-poetic', 'theme-refs-title', 'profile-refs-title'],
  title: ['h1', 'theme-title', 'profile-title', 'intro-title'],
  body: ['fl', 'sp', 'list', 'list-0', 'list-1', 'list-space', 'list-text', 'list-text-fl',
    'extract', 'extract-fl', 'extract-fl-space', 'poetry-1', 'poetry-1-sp', 'poetry-2', 'poetry-3',
    'preview-list', 'preview-list-1', 'preview-list-first', 'preview-text', 'box-extract',
    'box-first', 'td', 'td-indent', 'intro-body', 'intro-body-fl', 'intro-body-fl-sp',
    'intro-extract', 'intro-list', 'intro-list-sp', 'intro-overview', 'intro-poetry-1-sp',
    'intro-poetry-2', 'intro-sidebar-body-fl', 'theme-body', 'theme-body-fl', 'theme-body-fl-sp',
    'theme-body-sp', 'theme-list', 'theme-list-sp', 'theme-refs', 'profile-body',
    'profile-body-fl', 'profile-body-fl-sp', 'profile-refs', 'toc'],
};

// This is the regression guard for a bug that recurred three times: a subhead class nobody had
// listed fell through to body text, so a heading rendered as prose and no test noticed.
test('classifyBlock: every class in the corpus is deliberately classified', () => {
  for (const [kind, classes] of Object.entries(CORPUS_CLASSES))
    for (const cls of classes)
      assert.equal(classifyBlock(cls), kind, `${cls} should classify as ${kind}`);
});

test('classifyBlock: an unlisted class THROWS instead of defaulting to body', () => {
  // the whole point — silently treating an unknown class as prose is how headings got lost
  assert.throws(() => classifyBlock('theme-h3'), /unclassified Tyndale paragraph class/);
  assert.throws(() => classifyBlock('intro-sidebar-h2'), /unclassified/);
  assert.throws(() => classifyBlock('brand-new-class-from-a-future-release'), /unclassified/);
});

test('classifyBlock: a bare <p> with no class is prose, not an error', () => {
  assert.equal(classifyBlock(''), 'body');
  assert.equal(classifyBlock(undefined), 'body');
});

test('classifyBlock: no class is listed under two kinds', () => {
  const seen = new Map();
  for (const [kind, classes] of Object.entries(CORPUS_CLASSES))
    for (const cls of classes) {
      assert.ok(!seen.has(cls), `${cls} listed as both ${seen.get(cls)} and ${kind}`);
      seen.set(cls, kind);
    }
  assert.equal(seen.size, 63); // 64 distinct forms in the corpus, minus the bare (no class) case
});

test('structureBody: a body containing an unlisted class fails the parse', () => {
  assert.throws(() => structureBody('<p class="theme-h4">Sub</p><p class="fl">Text.</p>'),
    /unclassified Tyndale paragraph class: "theme-h4"/);
});

test('structureBody: every content type\'s subhead class is recognised as a heading', () => {
  // each Tyndale file names its subheads differently; missing one renders labels as body prose
  for (const cls of ['h2', 'h3', 'intro-h1', 'intro-sidebar-h1', 'theme-refs-title', 'profile-refs-title']) {
    const [b] = parseBlocks(structureBody(`<p class="${cls}">Purpose</p>`));
    assert.equal(b.kind, 'head', `${cls} should be a heading`);
    assert.equal(b.text, 'Purpose');
  }
});

test('structureBody: an intro summary becomes label/value pairs, not one flat run', () => {
  const xml = '<p class="intro-title">The Gospel of Matthew</p>'
    + '<p class="intro-sidebar-h1">Purpose</p><p class="intro-sidebar-body-fl">To demonstrate\u2026</p>'
    + '<p class="intro-sidebar-h1">Author</p><p class="intro-sidebar-body-fl">Matthew</p>';
  const blocks = parseBlocks(structureBody(xml));
  assert.deepEqual(blocks.map((b) => b.kind), ['head', 'para', 'head', 'para']);
  assert.deepEqual(blocks.map((b) => b.text), ['Purpose', 'To demonstrate\u2026', 'Author', 'Matthew']);
});

test('structureBody: "Passages for Further Study" is a heading, not a dropped title', () => {
  const out = structureBody('<p class="theme-refs-title">Passages for Further Study</p>'
    + '<p class="theme-refs">Matt 26:17-56; Mark 14:12-52</p>');
  const blocks = parseBlocks(out);
  assert.deepEqual(blocks.map((b) => b.kind), ['head', 'para']);
  assert.equal(blocks[0].text, 'Passages for Further Study');
});

test('structureBody: drops the h1 headword — the title column already carries it', () => {
  const out = structureBody(STRUCTURED);
  assert.ok(!out.includes('PROPHECY'), 'h1 headword should not survive into the body');
  assert.ok(out.startsWith('Term, along with'), `unexpected start: ${out.slice(0, 40)}`);
});

test('structureBody: one block per paragraph, subheads marked', () => {
  const blocks = parseBlocks(structureBody(STRUCTURED));
  assert.deepEqual(blocks.map((b) => b.kind),
    ['para', 'head', 'para', 'item', 'head', 'para']);
  assert.equal(blocks[1].text, 'Prophecy in the Old Testament');
  assert.equal(blocks[4].text, 'Types of Prophets');
  assert.equal(blocks[3].text, '• Moses');
});

test('structureBody: heading text carries no marker once parsed back', () => {
  for (const b of parseBlocks(structureBody(STRUCTURED)))
    assert.ok(!b.text.startsWith('## '), `marker leaked into ${b.kind}: ${b.text}`);
});

test('structureBody: empty paragraphs are dropped, not emitted as blank blocks', () => {
  const out = structureBody('<p class="fl">One.</p><p class="fl">   </p><p class="fl">Two.</p>');
  assert.deepEqual(parseBlocks(out).map((b) => b.text), ['One.', 'Two.']);
});

test('structureBody: body with no <p> wrapper still yields its text', () => {
  assert.equal(structureBody('Bare text with no paragraph.'), 'Bare text with no paragraph.');
});

test('structureBody: real corpus has no paragraph that would fake a heading marker', () => {
  // the "## " convention is only safe because Tyndale's prose never starts a block that way
  const out = structureBody(STRUCTURED);
  const faked = out.split('\n').filter((l) => l.startsWith('## ') && l.slice(3).startsWith('## '));
  assert.equal(faked.length, 0);
});

test('cleanBody: keepTables preserves table markup for charts', () => {
  const chart = '<p class="h1">Feasts</p><table><tr><td><p class="td">Passover</p></td></tr></table>';
  const kept = cleanBody(chart, true);
  assert.ok(kept.includes('<table>'), 'table stripped');
  assert.ok(kept.includes('<td>'), 'cell stripped');
  assert.ok(kept.includes('Passover'));
  assert.ok(!kept.includes('class='), 'class attributes should be dropped');
});

test('parseRefRange: single verse', () => {
  assert.deepEqual(parseRefRange('Gen.1.16'),
    { book: 'Gen', start_chapter: 1, start_verse: 16, end_chapter: 1, end_verse: 16, ref: '1:16' });
});

test('parseRefRange: same-chapter range', () => {
  assert.deepEqual(parseRefRange('Gen.1.6-8'),
    { book: 'Gen', start_chapter: 1, start_verse: 6, end_chapter: 1, end_verse: 8, ref: '1:6-8' });
});

test('parseRefRange: cross-chapter range', () => {
  assert.deepEqual(parseRefRange('Gen.1.1-2.25'),
    { book: 'Gen', start_chapter: 1, start_verse: 1, end_chapter: 2, end_verse: 25, ref: '1:1–2:25' });
});

test('parseRefRange: normalizes the Arabic Tyndale scheme', () => {
  assert.equal(parseRefRange('1Thes.2.6').book, '1Thess');
  assert.equal(parseRefRange('2Jn.1.7').book, '2John');
  assert.equal(parseRefRange('Hagg.1.1').book, 'Hag');
  assert.equal(parseRefRange('Pr.15.11').book, 'Prov');
});

test('parseRefRange: whole-book range (book intros)', () => {
  const r = parseRefRange('Gen.1.1-50.26');
  assert.equal(r.start_chapter, 1);
  assert.equal(r.end_chapter, 50);
  assert.equal(r.end_verse, 26);
});

test('extractBrefs: pulls verse links, deduped', () => {
  const [it] = [...iterItems(ARTICLE)];
  const refs = extractBrefs(it.body);
  assert.deepEqual(refs, [
    { book: 'Mark', chapter: 14, verse: 36 },
    { book: 'Rom', chapter: 8, verse: 15 },
  ]);
});

test('extractBrefs: drops apocrypha silently, keeps the rest', () => {
  const body = '<a href="?bref=1Macc.2.1">x</a><a href="?bref=Gen.1.1">y</a><a href="?bref=Tb.3.4">z</a>';
  assert.deepEqual(extractBrefs(body), [{ book: 'Gen', chapter: 1, verse: 1 }]);
});

test('extractBrefs: handles comma lists and ranges by taking the start verse', () => {
  assert.deepEqual(extractBrefs('<a href="?bref=Ps.115.10,12">x</a>'),
    [{ book: 'Ps', chapter: 115, verse: 10 }]);
  assert.deepEqual(extractBrefs('<a href="?bref=Gen.1.1-2.3">x</a>'),
    [{ book: 'Gen', chapter: 1, verse: 1 }]);
});

test('extractBrefs: THROWS on an unknown book code', () => {
  assert.throws(() => extractBrefs('<a href="?bref=Sirach.1.1">x</a>'), /unknown book code/);
});

test('extractBrefs: ignores chapter-only refs with no verse', () => {
  assert.deepEqual(extractBrefs('<a href="?bref=Ps.119">x</a>'), []);
});

test('countBrefs: raw link count, before apocrypha filtering', () => {
  const body = '<a href="?bref=1Macc.2.1">x</a><a href="?bref=Gen.1.1">y</a>';
  assert.equal(countBrefs(body), 2);
  assert.equal(extractBrefs(body).length, 1);
});

test('extractIncludes: resolves embedded supplements by name', () => {
  const body = '<p>text</p><include_items src="../Textboxes/Textboxes.xml" name="AaronThePriest"/>' +
    '<include_items src="../Charts/Charts.xml" name="AnnualFeasts"/>' +
    '<include_items src="../Pictures/Pictures.xml" name="ABedouin"/>';
  // Pictures and Maps are out of scope, so only textboxes and charts are returned
  assert.deepEqual(extractIncludes(body), [
    { kind: 'textbox', name: 'AaronThePriest' },
    { kind: 'chart', name: 'AnnualFeasts' },
  ]);
});

test('sortTitle: strips the variant asterisk and normalizes for A-Z ordering', () => {
  assert.equal(sortTitle('Aaronites*'), 'aaronites');
  assert.equal(sortTitle('Abel-Beth-Maacah (Maachah*)'), 'abel-beth-maacah');
  assert.equal(sortTitle('Assyria, Assyrians'), 'assyria, assyrians');
  assert.equal(sortTitle('Chaos*, Waters of'), 'chaos, waters of');
});

test('titleTerms: head words for the lexical signal, qualifiers and stopwords dropped', () => {
  assert.deepEqual(titleTerms('Abba'), ['abba']);
  assert.deepEqual(titleTerms('Abdon (Person)'), ['abdon']);
  assert.deepEqual(titleTerms('Glean, Gleaning'), ['glean', 'gleaning']);
  assert.deepEqual(titleTerms('Joshua, Book of'), ['joshua']);
  assert.deepEqual(titleTerms('Urim and Thummim'), ['urim', 'thummim']);
});

test('iterItems: nested generators do not corrupt each other via shared regex state', () => {
  const outer = `<items>
  <item typename="Article" name="A"><title>A</title><body>a1</body></item>
  <item typename="Article" name="B"><title>B</title><body>b1</body></item>
  </items>`;
  const inner = `<items>
  <item typename="ThemeNote" name="X"><title>X</title><body>x1</body></item>
  <item typename="ThemeNote" name="Y"><title>Y</title><body>y1</body></item>
  <item typename="ThemeNote" name="Z"><title>Z</title><body>z1</body></item>
  </items>`;

  // Interleave two generators: partially consume outer, fully consume inner, resume outer
  const outerGen = iterItems(outer);
  const first = outerGen.next().value;
  assert.equal(first.name, 'A', 'first outer item should be A');

  // Now fully consume inner while outer is paused mid-iteration
  const innerResults = [...iterItems(inner)];
  assert.equal(innerResults.length, 3, 'inner should yield all 3 items');
  assert.equal(innerResults[0].name, 'X');
  assert.equal(innerResults[1].name, 'Y');
  assert.equal(innerResults[2].name, 'Z');

  // Resume outer and verify it continues correctly
  const remaining = [...outerGen];
  assert.equal(remaining.length, 1, 'outer should have 1 remaining item');
  assert.equal(remaining[0].name, 'B', 'second outer item should be B');
});
