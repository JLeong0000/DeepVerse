// build/parse-tyndale.mjs
// MAINTAINER ONLY — needs backup-data/. Parses the Tyndale Open packages into the committed
// intermediates in build/data/sources/, which is all build-db.mjs ever reads. Run only when the
// raw source changes:  node parse-tyndale.mjs
//
// Source (gitignored, CC BY-SA 4.0): backup-data/tyndale/
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { OSIS_BOOKS } from './lib/books.mjs';
import { iterItems, cleanBody, structureBody, parseRefRange, extractBrefs, countBrefs, extractIncludes, sortTitle, titleTerms }
  from './lib/tyndale.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYN = `${ROOT}/backup-data/tyndale`;
const DICT = `${TYN}/dictionary`;
const NOTES = `${TYN}/Tyndale Open Study Notes`;
const OUT = `${ROOT}/build/data/sources`;
fs.mkdirSync(OUT, { recursive: true });

if (!fs.existsSync(DICT)) {
  console.error(`parse-tyndale: missing ${DICT}\nThis script is maintainer-only and needs backup-data/.`);
  process.exit(1);
}
const write = (name, data) =>
  fs.writeFileSync(`${OUT}/${name}.json.gz`, zlib.gzipSync(JSON.stringify(data)));

// --- verse text, for the lexical relatedness signal (signal D in the spec) ---
// Read from the committed data/bibles/ JSON so this does not depend on bible.db existing.
const verseText = new Map();   // "Book.ch.v" -> lowercased text of all three versions
for (const version of ['NIV', 'NKJV', 'NLT']) {
  const dir = `${ROOT}/data/bibles/${version}`;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json') || f.startsWith('_')) continue;
    const book = f.replace('.json', '');
    const b = JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8'));
    for (const [ch, vs] of Object.entries(b.chapters))
      for (const [v, t] of Object.entries(vs)) {
        const k = `${book}.${ch}.${v}`;
        verseText.set(k, (verseText.get(k) || '') + ' ' + t.toLowerCase());
      }
  }
}
console.log('verse text loaded:', verseText.size, 'verses');

// An article's title word appearing in the verse text is the strongest relatedness signal.
// Prefix matching absorbs simple inflection ("glean" matching "gleaned"); it is deliberately
// crude, and only ever changes ORDER, never whether an article is shown.
function lexHit(terms, book, chapter, verse) {
  const txt = verseText.get(`${book}.${chapter}.${verse}`);
  if (!txt) return 0;
  return terms.some((w) => txt.includes(w.slice(0, Math.max(4, w.length - 3)))) ? 1 : 0;
}

// --- 1. dictionary articles ---
const articles = [];
const verseRows = [];
const hostOf = new Map();          // "textbox:AaronThePriest" -> host article id
let seq = 0, brefTotal = 0, brefKept = 0;

for (const f of fs.readdirSync(`${DICT}/Articles`).sort()) {
  if (!f.endsWith('.xml')) continue;
  const xml = fs.readFileSync(`${DICT}/Articles/${f}`, 'utf8');
  for (const it of iterItems(xml)) {
    if (it.typename !== 'Article') continue;          // skips the DictionaryLetter TOC items
    const refs = extractBrefs(it.body);
    brefTotal += countBrefs(it.body);
    brefKept += refs.length;
    const terms = titleTerms(it.title);
    articles.push([it.name, it.title, sortTitle(it.title), 'article', null,
      structureBody(it.body), 0, refs.length, seq++]);
    for (const r of refs)
      verseRows.push([it.name, r.book, r.chapter, r.verse, lexHit(terms, r.book, r.chapter, r.verse)]);
    // an article's embedded supplements name it as their host
    for (const inc of extractIncludes(it.body))
      if (!hostOf.has(`${inc.kind}:${inc.name}`)) hostOf.set(`${inc.kind}:${inc.name}`, it.name);
  }
}
const articleCount = articles.length;

// --- 2. textboxes + charts. No <refs>; each surfaces inside the article that embeds it.
// Not every supplement is embedded (100/110 textboxes, 18/21 charts) — the rest keep host_id NULL.
let orphanSupps = 0;
for (const [file, kind, isHtml] of [['Textboxes/Textboxes.xml', 'textbox', 0],
                                    ['Charts/Charts.xml', 'chart', 1]]) {
  const xml = fs.readFileSync(`${DICT}/${file}`, 'utf8');
  for (const it of iterItems(xml)) {
    const host = hostOf.get(`${kind}:${it.name}`) || null;
    if (!host) orphanSupps++;
    articles.push([it.name, it.title, sortTitle(it.title), kind, host,
      cleanBody(it.body, isHtml === 1), isHtml, 0, seq++]);
  }
}

// --- 3. theme articles + profiles (verse-ranged) ---
const passages = [];
let pseq = 0;
for (const file of ['ThemeNotes.xml', 'Profiles.xml']) {
  const xml = fs.readFileSync(`${NOTES}/${file}`, 'utf8');
  for (const it of iterItems(xml)) {
    // ThemeNotes.xml contains one misfiled Profile — route by typename, never by filename.
    const kind = it.typename === 'ThemeNote' ? 'theme'
      : it.typename === 'Profile' ? 'profile' : null;
    if (!kind) continue;
    const r = it.refs ? parseRefRange(it.refs) : null;
    if (!r) { console.warn(`parse-tyndale: unparseable refs for ${it.name}`); continue; }
    passages.push([kind, it.title, r.book, r.start_chapter, r.start_verse,
      r.end_chapter, r.end_verse, r.ref, structureBody(it.body), pseq++]);
  }
}

// --- 4. book intros + summaries, keyed by OSIS book ---
const intros = new Map();
for (const [file, field] of [['BookIntroSummaries.xml', 'summary'], ['BookIntros.xml', 'intro']]) {
  const xml = fs.readFileSync(`${NOTES}/${file}`, 'utf8');
  for (const it of iterItems(xml)) {
    const r = it.refs ? parseRefRange(it.refs) : null;
    if (!r) { console.warn(`parse-tyndale: unparseable refs for ${it.name}`); continue; }
    const rec = intros.get(r.book) || { summary: '', intro: '' };
    rec[field] = structureBody(it.body);
    intros.set(r.book, rec);
  }
}
const introRows = OSIS_BOOKS.filter((b) => intros.has(b))
  .map((b) => [b, intros.get(b).summary, intros.get(b).intro]);

write('tyndale-dictionary', { articles, verses: verseRows });
write('tyndale-passages', passages);
write('tyndale-bookintros', introRows);

console.log('dictionary articles:', articleCount);
console.log('supplements (textbox+chart):', articles.length - articleCount,
  `(${orphanSupps} never embedded, host_id NULL)`);
console.log('verse index rows:', verseRows.length,
  `(lex_hit on ${verseRows.filter((r) => r[4] === 1).length})`);
console.log('passages (theme+profile):', passages.length,
  JSON.stringify({ theme: passages.filter((p) => p[0] === 'theme').length,
                   profile: passages.filter((p) => p[0] === 'profile').length }));
console.log('book intros:', introRows.length);
console.log('bref links:', brefTotal, 'seen,', brefKept, 'kept,',
  brefTotal - brefKept, 'dropped (apocrypha + chapter-only + deduplicated within articles)');
