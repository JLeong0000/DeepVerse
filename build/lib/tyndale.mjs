// build/lib/tyndale.mjs
// Parsing helpers for the Tyndale Open packages (CC BY-SA 4.0): the Bible Dictionary,
// theme articles, profiles, book intros, textboxes and charts.
//
// Two things here are load-bearing:
//  1. Book codes in <refs> and ?bref= use Tyndale's ARABIC scheme (1Thes, 1Jn), which is NOT
//     the Roman scheme (IThes, IJn) that StudyNotes.xml's `name` attribute uses. Both route
//     through books.mjs, which throws on anything unrecognised rather than dropping it.
//  2. Item attribute order differs between files, so the item regex must not assume one.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { toOsis, toOsisOrNull } from './books.mjs';
import { buildIndex, extractXrefs } from './xref.mjs';

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', nbsp: ' ', apos: "'", '#39': "'" };
function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(amp|lt|gt|quot|nbsp|apos|#39);/g, (_, k) => ENT[k]);
}

const ITEM_RE = /<item\b([^>]*)>\s*(?:<title>(.*?)<\/title>\s*)?(?:<refs>(.*?)<\/refs>\s*)?<body>(.*?)<\/body>\s*<\/item>/gs;
// (?:^|\s) prefix matters: without it, searching for "name" matches inside "typename"
// (since "name" is a literal substring of "typename"), stealing the wrong attribute's value.
const ATTR = (attrs, key) => (attrs.match(new RegExp(`(?:^|\\s)${key}="([^"]*)"`)) || [])[1] || null;

export function* iterItems(xml) {
  // Create a fresh regex instance per call so each generator has its own lastIndex state.
  // Without this, nested iterItems calls share the same regex object and corrupt each other's
  // position via the lastIndex property. String.prototype.matchAll and .replace do not have
  // this issue, but repeated .exec() on a g-flagged regex does.
  const re = new RegExp(ITEM_RE.source, ITEM_RE.flags);
  let m;
  while ((m = re.exec(xml))) {
    yield {
      typename: ATTR(m[1], 'typename'),
      name: ATTR(m[1], 'name'),
      title: m[2] ? decodeEntities(m[2].replace(/<[^>]+>/g, '')).trim() : null,
      refs: m[3] ? m[3].trim() : null,
      body: m[4],
    };
  }
}

// Charts are the only content that cannot flatten to text — they are real tables. Everything
// else becomes plain text, matching how study_notes bodies are stored.
export function cleanBody(bodyXml, keepTables = false) {
  let b = bodyXml.replace(/<a\b[^>]*>(.*?)<\/a>/gs, '$1');   // unwrap links, keep their text
  if (keepTables) {
    b = b.replace(/<(\/?)(table|tr|td|th)\b[^>]*>/g, '<$1$2>'); // keep structure, drop attributes
    b = b.replace(/<(?!\/?(?:table|tr|td|th)>)[^>]+>/g, ' ');   // strip every other tag
  } else {
    b = b.replace(/<[^>]+>/g, ' ');
  }
  return decodeEntities(b).replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, ' ').trim();
}

// Tyndale's <p class> tells us what each block is; flattening it all into one run makes a 20k-char
// article unreadable. Keep the structure as newline-separated blocks, with subheads marked so the
// app can render them as headings. Blocks that stay prose are joined with a single \n.
const HEAD_MARK = '## ';

// EVERY <p class> that occurs anywhere in the Tyndale corpus, and what it is. Exhaustive on
// purpose: an unlisted class throws rather than defaulting to body text.
//
// Defaulting is what this replaces, and it failed silently three times — each content type names
// its subheads differently (articles h2-h5, book intros intro-h1, intro summaries intro-sidebar-h1,
// profiles profile-h1, themes theme-h2, textboxes box-h2), so a missed one renders a heading as
// ordinary prose and nothing complains. A throw turns the next such gap into a failed parse, which
// is the only moment it can be noticed — when the source changes.
//
// 'title' blocks restate the item's own <title>, which is rendered separately, so they are dropped.
const BLOCK_KIND = new Map([
  // --- headings ---
  ...['h2', 'h3', 'h4', 'h5', 'h2-list', 'h2-preview',
    'intro-h1', 'intro-sidebar-h1', 'profile-h1', 'theme-h2', 'box-h2', 'box-h2-poetic',
    'theme-refs-title', 'profile-refs-title'].map((c) => [c, 'head']),
  // --- title restatements, dropped ---
  ...['h1', 'theme-title', 'profile-title', 'intro-title'].map((c) => [c, 'title']),
  // --- prose, lists, poetry, extracts, table cells ---
  ...['fl', 'sp', 'list', 'list-0', 'list-1', 'list-space', 'list-text', 'list-text-fl',
    'extract', 'extract-fl', 'extract-fl-space', 'poetry-1', 'poetry-1-sp', 'poetry-2', 'poetry-3',
    'preview-list', 'preview-list-1', 'preview-list-first', 'preview-text',
    'box-extract', 'box-first', 'td', 'td-indent',
    'intro-body', 'intro-body-fl', 'intro-body-fl-sp', 'intro-extract', 'intro-list',
    'intro-list-sp', 'intro-overview', 'intro-poetry-1-sp', 'intro-poetry-2',
    'intro-sidebar-body-fl',
    'theme-body', 'theme-body-fl', 'theme-body-fl-sp', 'theme-body-sp', 'theme-list',
    'theme-list-sp', 'theme-refs',
    'profile-body', 'profile-body-fl', 'profile-body-fl-sp', 'profile-refs',
    // the per-letter contents lists; their items are filtered out by typename before reaching here
    'toc'].map((c) => [c, 'body']),
]);

export function classifyBlock(cls) {
  if (!cls) return 'body';                       // a bare <p> is prose
  const kind = BLOCK_KIND.get(cls);
  if (!kind) {
    throw new Error(`unclassified Tyndale paragraph class: "${cls}". Add it to BLOCK_KIND in `
      + 'build/lib/tyndale.mjs as head, title or body — defaulting silently renders headings as '
      + 'body text.');
  }
  return kind;
}

export function structureBody(bodyXml) {
  const blocks = [];
  for (const m of bodyXml.matchAll(/<p\b([^>]*)>(.*?)<\/p>/gs)) {
    const cls = (m[1].match(/class="([^"]*)"/) || [])[1] || '';
    const kind = classifyBlock(cls);
    if (kind === 'title') continue;
    const text = cleanBody(m[2]);
    if (!text) continue;
    blocks.push(kind === 'head' ? HEAD_MARK + text : text);
  }
  // an article with no <p> wrapper at all still needs its text
  if (!blocks.length) {
    const flat = cleanBody(bodyXml);
    return flat || '';
  }
  return blocks.join('\n');
}

// Split a stored body back into typed blocks. Shared with the app via the same convention.
export function parseBlocks(body) {
  return String(body).split('\n').filter(Boolean).map((line) =>
    line.startsWith(HEAD_MARK)
      ? { kind: 'head', text: line.slice(HEAD_MARK.length) }
      : { kind: line.startsWith('•') ? 'item' : 'para', text: line });
}

// "Gen.1.16" | "Gen.1.6-8" | "Gen.1.1-2.25" -> bounds + a display ref. Book normalized to OSIS.
export function parseRefRange(refs) {
  const [left, right] = String(refs).trim().split('-');
  const m = left.match(/^([A-Za-z0-9]+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  const book = toOsis(m[1]);
  const sc = +m[2], sv = +m[3];
  let ec = sc, ev = sv;
  if (right) {
    const nums = right.split('.').filter((p) => /^\d+$/.test(p)).map(Number);
    if (nums.length === 1) ev = nums[0];
    else if (nums.length >= 2) { ec = nums[nums.length - 2]; ev = nums[nums.length - 1]; }
  }
  const ref = ec === sc
    ? (ev === sv ? `${sc}:${sv}` : `${sc}:${sv}-${ev}`)
    : `${sc}:${sv}–${ec}:${ev}`;   // en dash for cross-chapter, matching study_notes display
  return { book, start_chapter: sc, start_verse: sv, end_chapter: ec, end_verse: ev, ref };
}

// Dictionary articles carry no <refs>; their verse anchors are the ?bref= links in the body.
// A link may be a single verse, a comma list ("Ps.115.10,12") or a range ("Gen.1.1-2.3") —
// in every case the start verse is what anchors it. Chapter-only refs have no verse and are skipped.
export function extractBrefs(bodyXml) {
  const seen = new Set();
  const out = [];
  for (const m of bodyXml.matchAll(/\?bref=([^"&#]+)/g)) {
    const parts = m[1].split('.');
    if (parts.length < 3) continue;                  // chapter-only, e.g. Ps.119
    const book = toOsisOrNull(parts[0]);             // null = apocrypha, throws if unknown
    if (!book) continue;
    if (!/^\d+$/.test(parts[1])) continue;
    const verse = parts[2].match(/^\d+/);
    if (!verse) continue;
    const key = `${book}.${parts[1]}.${verse[0]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ book, chapter: +parts[1], verse: +verse[0] });
  }
  return out;
}

// Raw link count, before apocrypha and malformed refs are filtered out. Used only for the
// parse log, so the maintainer can see how many links were dropped and why.
export function countBrefs(bodyXml) {
  return (bodyXml.match(/\?bref=/g) || []).length;
}

// Articles embed their supplements as
//   <include_items src="../Textboxes/Textboxes.xml" name="AaronThePriest"/>
// The `name` is what ties a textbox or chart back to its one host article. Maps and Pictures
// are out of scope (see the spec), so they are ignored here.
const INCLUDE_KIND = { Textboxes: 'textbox', Charts: 'chart' };

export function extractIncludes(bodyXml) {
  const out = [];
  for (const m of bodyXml.matchAll(/<include_items\s+src="\.\.\/(\w+)\/[^"]*"\s+name="([^"]*)"\s*\/>/g)) {
    const kind = INCLUDE_KIND[m[1]];
    if (kind) out.push({ kind, name: m[2] });
  }
  return out;
}

export function sortTitle(title) {
  return title
    .replace(/\*/g, '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')     // drop qualifiers: "Abdon (Person)" -> "Abdon"
    .replace(/’/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Head words used for the lexical relatedness signal. Structural words ("Book of", "Person")
// carry no meaning for matching a verse, so they are dropped; 4+ chars only, which is why
// short titles like "Cup" produce no terms (a known, accepted miss — see the spec).
const STOP = new Set(['book', 'of', 'the', 'and', 'person', 'place', 'city',
  'son', 'first', 'second', 'new', 'old']);

export function titleTerms(title) {
  const t = sortTitle(title);
  const out = [];
  for (const part of t.split(/[,;/]/))
    for (const w of part.match(/[a-z']+/g) || [])
      if (w.length >= 4 && !STOP.has(w)) out.push(w);
  return out;
}

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'sources');
const read = (name) => JSON.parse(zlib.gunzipSync(fs.readFileSync(`${SRC}/${name}.json.gz`)));

// Loads the four Tyndale cultural-layer tables (dictionary + themes/profiles + book intros)
// from the intermediates built once by parse-tyndale.mjs. host_id is populated from
// include_items markers in article bodies; 118 of 131 supplements have it, 13 keep it NULL.
export function loadTyndale(db) {
  const dict = read('tyndale-dictionary');
  const passages = read('tyndale-passages');
  const intros = read('tyndale-bookintros');

  const insA = db.prepare('INSERT INTO dict_articles VALUES (?,?,?,?,?,?,?,?,?)');
  const insV = db.prepare('INSERT INTO dict_verse VALUES (?,?,?,?,?)');
  const insP = db.prepare('INSERT INTO tyndale_passages VALUES (?,?,?,?,?,?,?,?,?,?)');
  const insI = db.prepare('INSERT INTO book_intros VALUES (?,?,?)');

  db.exec('BEGIN');
  for (const r of dict.articles) insA.run(...r);
  for (const r of dict.verses) insV.run(...r);
  for (const r of passages) insP.run(...r);
  for (const r of intros) insI.run(...r);
  db.exec('COMMIT');

  return { articles: dict.articles.length, verses: dict.verses.length,
    passages: passages.length, intros: intros.length, rows: dict.articles };
}

// Derives the cross-reference graph from article bodies already present in the committed
// intermediate. Computed, never vendored — the same treatment `differences` gets. `articles` is
// the raw row array from tyndale-dictionary.json.gz:
//   [id, title, sort_title, kind, host_id, body, is_html, n_refs, seq]
export function loadXrefs(db, articles) {
  const arts = articles
    .filter((r) => r[3] === 'article')
    .map((r) => ({ id: r[0], title: r[1], sort_title: r[2], body: r[5] }));
  const ix = buildIndex(arts);
  const ins = db.prepare('INSERT INTO dict_xref VALUES (?,?,?,?,?)');
  let rows = 0, anchored = 0, missing = 0;
  db.exec('BEGIN');
  for (const a of arts) {
    for (const e of extractXrefs(a, ix)) {
      ins.run(e.src, e.dst, e.raw, e.anchor, e.seq);
      rows++;
      if (e.anchor) anchored++;
      if (!e.dst) missing++;
    }
  }
  db.exec('COMMIT');
  return { rows, resolved: rows - missing, missing, anchored };
}
