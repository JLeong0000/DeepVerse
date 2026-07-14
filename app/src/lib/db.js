// sql.js loader + query. bible.db is loaded once into memory; every feature is a SQL query against it.
// Query functions (getChapter, getVerseDifferences, …) are added in Milestone 1.
import initSqlJs from 'sql.js';
import { BOOKS, bookOrder } from './refs.js';

let db = null;

export async function loadDb(url = '/bible.db') {
  if (db) return;
  const SQL = await initSqlJs({ locateFile: () => '/sql-wasm.wasm' });
  const buf = await (await fetch(url)).arrayBuffer();
  db = new SQL.Database(new Uint8Array(buf));
}

export function isLoaded() {
  return db !== null;
}

export function query(sql, params = []) {
  if (!db) throw new Error('bible.db not loaded — call loadDb() first');
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

// test seam: let tests inject an in-memory Database
export function _setDbForTest(instance) {
  db = instance;
  _wordFreq = null; // drop the memoized frequency map when the db is swapped
  _wordIndex = null;
}

// ---------------------------------------------------------------------------
// Milestone 1 — data-access layer. All synchronous after loadDb() (sql.js is in-memory).
// ---------------------------------------------------------------------------

// --- 1.2 Reader + versions ---
export function getChapter(version, book, chapter) {
  return query('SELECT verse, text FROM verses WHERE version=? AND book=? AND chapter=? ORDER BY verse',
    [version, book, chapter]);
}
export function getVerseAllVersions(book, chapter, verse) {
  return query('SELECT version, text FROM verses WHERE book=? AND chapter=? AND verse=?',
    [book, chapter, verse]);
}
export function chapterCount(version, book) {
  return query('SELECT MAX(chapter) AS n FROM verses WHERE version=? AND book=?', [version, book])[0]?.n || 0;
}
export function getChapterLanguages(book, chapter) {
  return query('SELECT DISTINCT lang FROM words WHERE book=? AND chapter=?', [book, chapter]).map(r => r.lang);
}

// Books present in a version, in canonical order, with chapter counts.
export function listBooks(version = 'NIV') {
  const counts = new Map(
    query('SELECT book, MAX(chapter) AS chapters FROM verses WHERE version=? GROUP BY book', [version])
      .map(r => [r.book, r.chapters]));
  return BOOKS.filter(([code]) => counts.has(code))
    .map(([code, name]) => ({ book: code, name, chapters: counts.get(code) }));
}

// Deterministic-per-day "word of the day": a common Type-B sense-spread word + an example occurrence.
export function getWordOfDay(seed = new Date().toISOString().slice(0, 10)) {
  const rows = query(`SELECT d.strongs, d.detail,
      MIN(d.book || '/' || d.chapter || '/' || d.verse || '/' || d.position) AS anchor
    FROM differences d WHERE d.type='B' GROUP BY d.strongs HAVING COUNT(*) > 20`);
  if (!rows.length) return null;
  let h = 2166136261;
  for (const c of String(seed)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const r = rows[h % rows.length];
  const [book, chapter, verse, position] = r.anchor.split('/');
  const w = query('SELECT original, translit, gloss, lang FROM words WHERE book=? AND chapter=? AND verse=? AND position=?',
    [book, +chapter, +verse, +position])[0] || {};
  const detail = JSON.parse(r.detail);
  return {
    strongs: r.strongs,
    lang: w.lang || '',
    original: (w.original || '').replace(/[¶.,;:·’'"]+$/u, '').trim(), // drop trailing markers for display
    translit: w.translit || '',
    position: +position,
    senses: detail.senses,
    total: detail.total, // total corpus occurrences of the lemma, for the "word count" fact
    ref: { version: 'NIV', book, chapter: +chapter, verse: +verse },
  };
}

// The first canonical verse where the word-of-day lemma is rendered with a given sense (a raw
// gloss_norm value — see build/lib/differences.mjs), for the "seen in" link on each interpretation.
// Returns { ref, position } (position pre-selects the interlinear word on jump) or null.
export function getSenseOccurrence(strongs, senseGloss) {
  if (!strongs || !senseGloss) return null;
  const r = query('SELECT book, chapter, verse, position FROM words WHERE strongs=? AND gloss_norm=?', [strongs, senseGloss])
    .sort((a, b) => bookOrder(a.book) - bookOrder(b.book) || a.chapter - b.chapter || a.verse - b.verse)[0];
  return r ? { ref: { version: 'NIV', book: r.book, chapter: r.chapter, verse: r.verse }, position: r.position } : null;
}

// --- 1.2b Word search (English gloss -> Hebrew/Greek lemma) ---
// gloss_norm has no SQL index, so scanning 447k words per keystroke would be janky. Build a
// per-lemma index once (memoized, like _wordFreq) and filter it in memory. Each entry carries the
// lemma's sense spread (grouped by raw gloss_norm) plus a lowercased searchText of every rendering.
let _wordIndex = null;
function wordIndex() {
  if (_wordIndex) return _wordIndex;
  const lex = new Map();
  for (const r of query('SELECT code, lemma, translit, lang, definition FROM lexicon')) lex.set(r.code, r);
  // homograph-letter fallback, same as getLexicon (G0996G -> G0996)
  const lexOf = (strongs) => lex.get(strongs) || lex.get(strongs.replace(/[A-Za-z]$/, '')) || null;

  _wordIndex = new Map();
  for (const r of query("SELECT strongs, gloss_norm, lang, COUNT(*) n, MIN(original) original FROM words WHERE strongs<>'' GROUP BY strongs, gloss_norm")) {
    let e = _wordIndex.get(r.strongs);
    if (!e) {
      const l = lexOf(r.strongs);
      e = { strongs: r.strongs, lang: r.lang, lemma: l?.lemma || '', translit: l?.translit || '',
        definition: l?.definition || '', original: l?.lemma || '', total: 0, senses: [], searchText: '' };
      _wordIndex.set(r.strongs, e);
    }
    e.total += r.n;
    e.senses.push({ gloss: r.gloss_norm, count: r.n, orig: r.original });
    e.searchText += ' ' + String(r.gloss_norm).toLowerCase();
  }
  for (const e of _wordIndex.values()) {
    e.senses.sort((a, b) => b.count - a.count);
    if (!e.original) e.original = e.senses[0]?.orig || ''; // no lexicon lemma -> most-common word form
    e.senses = e.senses.map(s => ({ gloss: s.gloss, count: s.count }));
  }
  return _wordIndex;
}

// English word -> up to 12 lemma suggestions whose renderings contain the term, ranked by frequency.
export function searchWords(term) {
  const q = String(term || '').trim().toLowerCase();
  if (q.length < 2) return [];
  const hits = [];
  for (const e of wordIndex().values()) if (e.searchText.includes(q)) hits.push(e);
  hits.sort((a, b) => b.total - a.total);
  return hits.slice(0, 12).map(e => ({ strongs: e.strongs, original: e.original,
    translit: e.translit, lang: e.lang, gloss: e.senses[0]?.gloss || '', total: e.total }));
}

// Full detail for one lemma: dictionary display fields + every sense (grouped by gloss_norm), each
// with its linkable occurrences in canonical order. Drives the search detail view (items 1,3,4).
export function getWordSenses(strongs) {
  if (!strongs) return null;
  const e = wordIndex().get(strongs);
  const rows = query('SELECT gloss_norm, book, chapter, verse, position FROM words WHERE strongs=?', [strongs]);
  const groups = new Map();
  for (const r of rows) {
    if (!groups.has(r.gloss_norm)) groups.set(r.gloss_norm, []);
    groups.get(r.gloss_norm).push({ ref: { version: 'NIV', book: r.book, chapter: r.chapter, verse: r.verse }, position: r.position });
  }
  const senses = [...groups.entries()].map(([gloss, occ]) => ({
    gloss, count: occ.length,
    occurrences: occ.sort((a, b) => bookOrder(a.ref.book) - bookOrder(b.ref.book) || a.ref.chapter - b.ref.chapter || a.ref.verse - b.ref.verse),
  })).sort((a, b) => b.count - a.count);
  return { original: e?.original || '', translit: e?.translit || '', lang: e?.lang || '',
    definition: e?.definition || '', total: e?.total || rows.length, senses };
}

// --- 1.3 Interlinear ---
export function getInterlinear(book, chapter, verse) {
  return query(`SELECT position, original, translit, gloss, strongs, morph, lemma, lang
    FROM words WHERE book=? AND chapter=? AND verse=? ORDER BY position`, [book, chapter, verse]);
}
export function getLexicon(strongs) {
  if (!strongs) return null;
  let rows = query('SELECT lemma, translit, gloss, definition FROM lexicon WHERE code=?', [strongs]);
  if (!rows.length) {
    const base = strongs.replace(/[A-Za-z]$/, ''); // strip a trailing homograph letter (G0996G -> G0996)
    if (base !== strongs) rows = query('SELECT lemma, translit, gloss, definition FROM lexicon WHERE code=?', [base]);
  }
  return rows[0] || null;
}

// --- 1.4 Differences (read side of the engine) ---

// Corpus frequency per Strong's (memoized, one GROUP BY). Used to rank a verse's difference words by
// rarity so the RAREST (most deliberate authorial choice) becomes the representative underline / card
// row — e.g. surface "propitiation" over "take", or Hebrew "nephesh (soul/life)" over "amar (said)".
let _wordFreq = null;
export function wordFreq(strongs) {
  if (!_wordFreq) {
    _wordFreq = new Map();
    for (const r of query("SELECT strongs, COUNT(*) n FROM words WHERE strongs<>'' GROUP BY strongs")) _wordFreq.set(r.strongs, r.n);
  }
  return _wordFreq.get(strongs) ?? Infinity; // unknown -> treat as common (never picked as the rarest)
}

export function getVerseDifferences(book, chapter, verse) {
  const rows = query(`SELECT d.position, d.type, d.strongs, d.detail, w.original, w.translit, w.gloss
    FROM differences d JOIN words w
      ON w.book=d.book AND w.chapter=d.chapter AND w.verse=d.verse AND w.position=d.position
    WHERE d.book=? AND d.chapter=? AND d.verse=? ORDER BY d.position, d.type`, [book, chapter, verse]);
  return rows.map(r => {
    const detail = JSON.parse(r.detail);
    if (r.type === 'A' && Array.isArray(detail.nearSynonyms)) {
      detail.nearSynonyms = detail.nearSynonyms.map(s => {
        const lex = getLexicon(s.strongs);
        return { ...s, lemma: lex?.lemma || '', translit: lex?.translit || '', gloss: lex?.gloss || '' };
      });
    }
    return { position: r.position, type: r.type, strongs: r.strongs, detail, freq: wordFreq(r.strongs),
      original: r.original, translit: r.translit, gloss: r.gloss };
  });
}

// Per-verse difference words for a chapter, to drive reader underlines.
// Returns Map<verse, [{position, type, gloss}]>.
export function getChapterDifferenceMap(book, chapter) {
  const rows = query(`SELECT d.verse, d.position, d.type, d.strongs, w.gloss
    FROM differences d JOIN words w
      ON w.book=d.book AND w.chapter=d.chapter AND w.verse=d.verse AND w.position=d.position
    WHERE d.book=? AND d.chapter=? ORDER BY d.verse, d.position`, [book, chapter]);
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.verse)) map.set(r.verse, []);
    map.get(r.verse).push({ position: r.position, type: r.type, gloss: r.gloss, strongs: r.strongs, freq: wordFreq(r.strongs) });
  }
  return map;
}

// Reader underlines are sparse by design (spec §7 / mockup): the full difference set is dense
// (~7 words/verse), so underline only a representative Type A and Type B per verse — the first of
// each in reading order (matches the mockup: John 12:25 -> "loves"/A + "life"/B). The Differences
// card still lists every difference for the selected verse; the interlinear exposes all words.
export function selectUnderlines(diffs) {
  const list = diffs || [];
  // rank by rarity (rarest = most deliberate) rather than reading order, so the representative is the
  // marked word, not whichever common word comes first.
  const rarest = (type, excludePos) => list
    .filter(d => d.type === type && d.position !== excludePos)
    .sort((x, y) => (x.freq ?? Infinity) - (y.freq ?? Infinity))[0];
  const a = rarest('A');
  // prefer a Type B on a DIFFERENT word than the A, so two distinct words get surfaced
  // (e.g. John 12:25 -> "loves"/A + "life"/B, not just "loves" which is both).
  const b = rarest('B', a?.position) || rarest('B');
  return [a, b].filter(Boolean);
}

const UNDERLINE_STOP = new Set(['the', 'a', 'an', 'of', 'to', 'and', 'in', 'you', 'me', 'my', 'his', 'her',
  'their', 'them', 'they', 'it', 'is', 'was', 'for', 'this', 'that', 'who', 'will', 'be', 'he', 'she', 'we',
  'your', 'i', 'as', 'then', 'so', 'not', 'but', 'with', 'on', 'up', 'do', 'did', 'have', 'has', 'son', 'may']);

// keyword(s) to search for in the English text from an original-word gloss (e.g. "[son] of John" -> ["john"]).
function glossKeywords(gloss) {
  return String(gloss || '').toLowerCase().replace(/[^\p{L}\s]/gu, ' ').split(/\s+/)
    .filter(w => w.length >= 3 && !UNDERLINE_STOP.has(w));
}
// crude English stemmer — enough to align a gloss word to a differently-inflected verse word.
function stem(w) { return w.replace(/(ing|edly|edness|ed|es|s|en)$/, ''); }
function wordMatches(englishWord, keyword) {
  if (englishWord === keyword) return true;
  const a = stem(englishWord), b = stem(keyword); // loves->love, loving->lov, life->life
  const min = Math.min(a.length, b.length);
  return min >= 3 && (a.startsWith(b) || b.startsWith(a));
}

// Does a difference word's gloss actually appear in this English verse? (Underlines can only be placed
// where the translation's wording matches the original's gloss — the card shows the difference either way.)
export function glossInText(text, gloss) {
  const keys = glossKeywords(gloss);
  if (!keys.length) return false;
  const words = String(text).toLowerCase().split(/\s+/).map(w => w.replace(/[^\p{L}]/gu, '')).filter(Boolean);
  return words.some(w => keys.some(k => wordMatches(w, k)));
}

// Map original-word differences onto the English verse (approximate: no NIV↔Greek alignment — spec §13).
// diffs: [{type:'A'|'B', gloss}]. Returns segments [{text, type:null|'A'|'B'|'AB'}] covering the full text.
export function underlineSpans(englishText, diffs) {
  const targets = (diffs || []).map(d => ({ type: d.type, keys: glossKeywords(d.gloss), used: false }))
    .filter(t => t.keys.length);
  const tokens = String(englishText).split(/(\s+)/); // keep whitespace tokens
  const segs = [];
  const push = (text, type) => {
    const last = segs[segs.length - 1];
    if (last && last.type === type) last.text += text;
    else segs.push({ text, type });
  };
  for (const tok of tokens) {
    if (/^\s+$/.test(tok) || tok === '') { push(tok, null); continue; }
    const bare = tok.toLowerCase().replace(/[^\p{L}]/gu, '');
    const types = new Set();
    for (const t of targets) {
      if (t.used) continue;
      if (bare && t.keys.some(k => wordMatches(bare, k))) { types.add(t.type); t.used = true; }
    }
    let type = null;
    if (types.has('A') && types.has('B')) type = 'AB';
    else if (types.has('A')) type = 'A';
    else if (types.has('B')) type = 'B';
    push(tok, type);
  }
  return segs;
}

// --- 1.5 Cross-references + context ---
// votes > 0 drops net-downvoted / tied links the community judged irrelevant (~1% of rows); a higher
// flat floor would gut obscure verses, whose relevant links score low only for lack of turnout.
export function getCrossRefs(book, chapter, verse) {
  return query('SELECT to_ref, votes FROM cross_refs WHERE from_book=? AND from_chapter=? AND from_verse=? AND votes>0 ORDER BY votes DESC',
    [book, chapter, verse]);
}
export function getChapterCrossRefStats(book, chapter) {
  return query(`SELECT COUNT(*) AS total, COUNT(DISTINCT from_verse) AS versesWithRefs
    FROM cross_refs WHERE from_book=? AND from_chapter=? AND votes>0`, [book, chapter])[0];
}
// NIV text of a cross-ref target's first verse (to_ref may be a range like "1John.4.9-1John.4.10").
export function getRefPreview(toRef) {
  const first = String(toRef).split('-')[0];
  const m = first.match(/^(\w+)\.(\d+)\.(\d+)$/);
  if (!m) return '';
  return query("SELECT text FROM verses WHERE version='NIV' AND book=? AND chapter=? AND verse=?",
    [m[1], +m[2], +m[3]])[0]?.text || '';
}

// --- 1.6 Stats + word-selector concordance ---
export function countEnglishWord(version, word) {
  const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
  let n = 0;
  for (const r of query('SELECT text FROM verses WHERE version=? AND text LIKE ?', [version, `%${word}%`])) {
    const m = r.text.match(re);
    if (m) n += m.length;
  }
  return n;
}
export function countLemma(strongs) {
  const byBook = query('SELECT book, COUNT(*) AS n FROM words WHERE strongs=? GROUP BY book', [strongs]);
  return { total: byBook.reduce((s, r) => s + r.n, 0), byBook };
}
export function verseWordCounts(version, book, chapter, verse) {
  const row = query('SELECT text FROM verses WHERE version=? AND book=? AND chapter=? AND verse=?',
    [version, book, chapter, verse])[0];
  const text = row?.text || '';
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return { words, chars: text.length };
}
