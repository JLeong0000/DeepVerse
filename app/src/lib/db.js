// sql.js loader + query. bible.db is loaded once into memory; every feature is a SQL query against it.
// Query functions (getChapter, getVerseDifferences, …) are added in Milestone 1.
import initSqlJs from 'sql.js';
import { BOOKS, bookOrder } from './refs.js';

let db = null;

// bible.db is cached CacheFirst by the service worker and never revalidated, so it is requested
// with a content-hash query (`?v=…`). New data means a new URL and therefore fresh bytes; unchanged
// data keeps the hash and is served from cache instead of re-downloading 150 MB.
//
// The hash is baked in at build time by vite.config.js, deliberately NOT fetched at runtime: a
// runtime lookup has to decide what to do when it fails, and every answer is bad — trusting a
// remembered value silently serves stale data (observed: a hiccup during service-worker startup was
// enough), while failing hard breaks offline use. Baking it in removes the failure mode, because
// the constant travels with the bundle the service worker already revalidates.
const DB_VERSION = typeof __BIBLE_DB_VERSION__ === 'string' ? __BIBLE_DB_VERSION__ : '';

export async function loadDb(url = '/bible.db') {
  if (db) return;
  const SQL = await initSqlJs({ locateFile: () => '/sql-wasm.wasm' });
  const src = DB_VERSION ? `${url}?v=${encodeURIComponent(DB_VERSION)}` : url;
  const buf = await (await fetch(src)).arrayBuffer();
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
  _verseBounds = null;
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
  if (!rows.length) {
    // Normalized codes (e.g. near-synonyms) are the bare Strong's H2654, but the lexicon may only carry
    // homograph-split entries H2654A/H2654a — fall back to the first sense so the entry still resolves.
    rows = query('SELECT lemma, translit, gloss, definition FROM lexicon WHERE code LIKE ? ORDER BY code LIMIT 1', [strongs + '%']);
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
// Text of a cross-ref target's first verse (to_ref may be a range like "1John.4.9-1John.4.10"),
// with the version it came from.
//
// NIV, then NKJV, then NLT, then KJVA. The fallback is not cosmetic: the NKJV follows the Textus
// Receptus and so carries 16 verses the NIV has no row for at all (Acts 8:37, Mark 9:44, Rom 16:24
// …), and KJVA carries the deuterocanon the dictionary cites 648 times and no modern translation
// here contains. Previewing those shows the reader the verse the source article is citing, which is
// the whole point of the box; returning nothing would hide a real difference behind what looks like
// a rendering bug.
//
// { text: '', version: null } means no translation here has the verse — see ABSENT in
// ArticleSurface.svelte, which explains why rather than showing an empty box.
// KJVA last: it only holds the deuterocanon, so it is reached exactly when the reference is to a
// book the three modern translations do not contain.
const PREVIEW_VERSIONS = ['NIV', 'NKJV', 'NLT', 'KJVA'];

export function getRefPreview(toRef) {
  const first = String(toRef).split('-')[0];
  const m = first.match(/^(\w+)\.(\d+)\.(\d+)$/);
  if (!m) return { text: '', version: null };
  for (const version of PREVIEW_VERSIONS) {
    const text = query('SELECT text FROM verses WHERE version=? AND book=? AND chapter=? AND verse=?',
      [version, m[1], +m[2], +m[3]])[0]?.text;
    if (text) return { text, version };
  }
  return { text: '', version: null };
}

// Chapter-level context from the Theographic knowledge graph (people/places/events named in the
// chapter's verses). getChapterContext -> the summary row (writer + counts) or null.
export function getChapterContext(book, chapter) {
  return query('SELECT book, chapter, osis_ref, writer, people_count, place_count FROM chapter_context WHERE book=? AND chapter=?',
    [book, chapter])[0] || null;
}
// A chapter's recap — a prose overview from a public-domain commentary (Matthew Henry / Adam Clarke)
// or editorially written. Returns { recap, source } or null.
export function getChapterRecap(book, chapter) {
  return query('SELECT recap, source FROM chapter_recap WHERE book=? AND chapter=?', [book, chapter])[0] || null;
}
// All entities in a chapter, grouped-ready: ordered by type then their first appearance (sort_verse).
export function getChapterEntities(book, chapter) {
  return query(`SELECT entity_type, entity_id, name, latitude, longitude, feature_type, blurb, approx_year, sort_verse
    FROM chapter_entity WHERE book=? AND chapter=? ORDER BY entity_type, sort_verse`, [book, chapter]);
}
// Study notes covering a given verse — a note's range may span verses (or chapters), so a note
// "covers" a verse if the verse falls anywhere within [start, end], not just at its start.
export function getStudyNotes(book, chapter, verse) {
  const key = chapter * 1000 + verse;
  return query(
    `SELECT ref, osis_ref, body FROM study_notes
       WHERE book = ?
         AND (start_chapter*1000 + start_verse) <= ?
         AND (end_chapter*1000   + end_verse)   >= ?
     ORDER BY (start_chapter*1000 + start_verse), seq`,
    [book, key, key]);
}
// The themes and profiles a study note links to in its own prose — "(see “Blessing” Theme Note)".
// 117 edges over 111 of the 16,913 notes, so this returns nothing for 99% of them; the ones it
// does return are the corpus's only author-written links into a theme or profile. Every row
// resolves (build/validate-db.mjs fails the build otherwise), and `raw` is guaranteed to occur in
// the note's body, which is what splitNoteLinks matches on.
export function getStudyNoteLinks(osisRef) {
  return query(`SELECT raw, pkind, ptitle, pbook FROM study_note_xref
    WHERE osis_ref = ? ORDER BY seq`, [osisRef]);
}

export function getChapterStudyNoteCount(book, chapter) {
  return query(
    `SELECT COUNT(*) AS n FROM study_notes
       WHERE book = ? AND start_chapter <= ? AND end_chapter >= ?`,
    [book, chapter, chapter])[0].n;
}

// --- Tyndale cultural layer ---
// Dictionary articles anchored to a verse by the ?bref= links in their bodies. Ordered by
// relatedness, not by quality: an article whose title word appears in the verse text comes
// first (lex_hit), then the article citing fewest verses overall (an article citing 3 verses
// is about them; one citing 197 mentions each in passing). Nothing is filtered out — a weak
// signal costs an article its position, never its place in the list.
export function getDictForVerse(book, chapter, verse) {
  return query(
    `SELECT a.id, a.title, a.body, a.n_refs
       FROM dict_verse v JOIN dict_articles a ON a.id = v.article_id
      WHERE v.book = ? AND v.chapter = ? AND v.verse = ?
      ORDER BY v.lex_hit DESC, a.n_refs ASC, a.sort_title`,
    [book, chapter, verse]);
}

export function getDictCountForVerse(book, chapter, verse) {
  return query('SELECT COUNT(*) AS n FROM dict_verse WHERE book=? AND chapter=? AND verse=?',
    [book, chapter, verse])[0].n;
}

// Theme articles and profiles, covering-range like study notes: a passage anchored Gen.1.1-2.25
// covers every verse in that span, not just its first.
export function getTyndalePassages(kind, book, chapter, verse) {
  const key = chapter * 1000 + verse;
  return query(
    `SELECT title, ref, body, book FROM tyndale_passages
      WHERE kind = ? AND book = ?
        AND (start_chapter*1000 + start_verse) <= ?
        AND (end_chapter*1000   + end_verse)   >= ?
      ORDER BY (start_chapter*1000 + start_verse), seq`,
    [kind, book, key, key]);
}

// Does a verse actually exist? Used to decide whether a book-less citation in Tyndale prose can be
// resolved against the book its surrounding text is about — a Numbers note citing "141:9" is a
// Psalm, and linking it to Numbers would point somewhere wrong. Built once as a book -> chapter ->
// last-verse map (1,189 chapters) rather than a query per reference, since a long article can hold
// well over a hundred.
let _verseBounds = null;
export function verseExists(book, chapter, verse) {
  if (!_verseBounds) {
    _verseBounds = new Map();
    for (const r of query('SELECT book, chapter, MAX(verse) AS last FROM verses GROUP BY book, chapter')) {
      if (!_verseBounds.has(r.book)) _verseBounds.set(r.book, new Map());
      _verseBounds.get(r.book).set(r.chapter, r.last);
    }
  }
  const last = _verseBounds.get(book)?.get(chapter);
  return last != null && verse >= 1 && verse <= last;
}

// Book-level, not verse-level: intro ranges span whole books, so this is keyed on book alone.
export function getBookIntro(book) {
  return query('SELECT summary, intro FROM book_intros WHERE book=?', [book])[0] || null;
}

// Textboxes and charts embedded in an article, shown inside that article's detail. Charts carry
// real table markup (is_html = 1); everything else is plain text.
export function getArticleSupplements(hostId) {
  return query(
    `SELECT id, title, kind, body, is_html FROM dict_articles
      WHERE host_id = ? ORDER BY seq`, [hostId]);
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

// --- Library explorer (#/library) ---

// The pool `✦ Wander in` draws from. 2,271 of the 6,010 articles are under 120 characters and 577
// are bare "See X." redirects, so an unweighted random door would land on a stub about a third of
// the time and feel broken. 500 is our threshold, not a property of the data — it yields 1,839.
export const SUBSTANTIAL_CHARS = 500;

// SQLite's upper() is ASCII-only, so a sort_title starting with a non-Latin character (one article,
// a curly quote: "I Am" Sayings) passes through untouched and would form its own one-off bucket —
// invisible to a hardcoded A–Z rail. Fold anything outside A–Z into '#' so every article has a home.
const DICT_LETTER = `CASE WHEN upper(substr(sort_title,1,1)) BETWEEN 'A' AND 'Z'
  THEN upper(substr(sort_title,1,1)) ELSE '#' END`;

export function getDictLetters() {
  return query(`SELECT ${DICT_LETTER} AS letter, COUNT(*) AS n
    FROM dict_articles WHERE kind='article' GROUP BY letter ORDER BY letter`);
}

// Displays `title` and only sorts by `sort_title`: sort_title strips the disambiguating
// parenthetical, so 131 groups collide and would otherwise print the same word repeatedly.
// `redirect` is set for the 577 bodies that are nothing but a "See X[; Y; Z]." clause: starts with
// "See ", ends in a period, has no embedded newline (a longer article, not a redirect stub), and
// has exactly one period total — the terminal one — so a body with further prose after the See
// clause (more than one sentence) is correctly excluded. A length cutoff was tried first and missed
// "Minister, Ministry" by one character; this structural rule has zero false positives or negatives
// against the corpus. `redirect` may itself list several `;`-separated targets (e.g. "Advent of
// Christ*" redirects to three) — that string is for display only; a caller resolving those targets
// must go through getXrefs, never split on ';', because a target's own title can contain a comma.
// rtrim(…, '.') trims only the trailing period, not every period in the target — a plain
// replace('.', '') would also eat an internal one (an abbreviation or initialism in the target name).
export function getDictBrowse(letter) {
  return query(`SELECT id, title, sort_title,
      substr(replace(body, char(10), ' '), 1, 90) AS gloss,
      CASE WHEN body LIKE 'See %' AND body LIKE '%.' AND body NOT LIKE '%'||char(10)||'%'
                AND length(body) - length(replace(body, '.', '')) = 1
           THEN rtrim(substr(body, 5), '.') END AS redirect
    FROM dict_articles
    WHERE kind='article' AND (${DICT_LETTER}) = ?
    ORDER BY sort_title, title`, [String(letter).toUpperCase()]);
}

export function getThemeIndex() {
  const rows = query(`SELECT title, book, ref, seq, start_chapter, start_verse
    FROM tyndale_passages WHERE kind='theme'`);
  return rows.sort((a, b) => bookOrder(a.book) - bookOrder(b.book)
    || (a.start_chapter * 1000 + a.start_verse) - (b.start_chapter * 1000 + b.start_verse)
    || a.seq - b.seq);
}

// 84 of the 125 have a same-title dictionary article — a second door to the same subject. sort_title
// collides for 131 groups (Person/Place/etc. homonyms); an unordered LIMIT 1 picked the wrong twin
// for "Rahab" (the sea monster instead of the person profiled here), so ties prefer the "(Person)"
// entry — the only disambiguator that recurs across these groups — before falling back to seq.
export function getProfileIndex() {
  return query(`SELECT p.title, p.book, p.ref,
      (SELECT a.id FROM dict_articles a
        WHERE a.kind='article' AND a.sort_title = lower(p.title)
        ORDER BY a.title LIKE '%(Person)%' DESC, a.seq LIMIT 1) AS alsoArticle
    FROM tyndale_passages p WHERE p.kind='profile' ORDER BY p.title`);
}

// Same "fetch one row past the cap" trick as searchLibrary's SEARCH_DICT_CAP/SEARCH_GROUP_CAP:
// Revelation has 263 articles citing it and Genesis has 874 — this cap only ever shows the top
// slice, so the caller needs to know whether it just hid 251 more, not render 12 as if it were
// the total.
export const BOOK_HUB_ARTICLE_CAP = 12;
export function getBookHub(book) {
  const intro = query('SELECT summary, intro FROM book_intros WHERE book=?', [book])[0] || null;
  const passages = query(`SELECT kind, title, ref FROM tyndale_passages
    WHERE book=? ORDER BY start_chapter, start_verse, seq`, [book]);
  // Ranked by how many verses of this book each article cites — straight from dict_verse.
  const articleRows = query(`SELECT a.id, a.title, COUNT(*) AS n
    FROM dict_verse v JOIN dict_articles a ON a.id = v.article_id
    WHERE v.book = ? GROUP BY a.id ORDER BY n DESC, a.sort_title LIMIT ${BOOK_HUB_ARTICLE_CAP + 1}`, [book]);
  return {
    summary: intro?.summary ?? '',
    intro: intro?.intro ?? '',
    themes: passages.filter((p) => p.kind === 'theme'),
    profiles: passages.filter((p) => p.kind === 'profile'),
    articles: articleRows.slice(0, BOOK_HUB_ARTICLE_CAP),
    articlesTruncated: articleRows.length > BOOK_HUB_ARTICLE_CAP,
  };
}

// One query across all four datasets: making the user first guess which route holds the answer
// would tax the primary objective. Titles only — full-text search over 8.4 MB is not viable here.
//
// Each capped group fetches one row PAST its cap (LIMIT 21/11) so the caller can tell "the cap
// truncated more rows" apart from "this many rows exist and none were cut" — rendering a capped
// count as if it were a total (or as a floor when it's actually exact) is the same overclaim this
// project has shipped before, just moved from the count to the "+" instead of fixing it. The
// extra row is trimmed off before returning; only the `*Truncated` flag reveals it existed.
export const SEARCH_DICT_CAP = 20;
export const SEARCH_GROUP_CAP = 10;
export function searchLibrary(term) {
  const q = String(term || '').trim().toLowerCase();
  const empty = { dict: [], themes: [], profiles: [], books: [],
    dictTruncated: false, themesTruncated: false, profilesTruncated: false };
  if (q.length < 2) return empty;
  // '%' and '_' are LIKE wildcards, not literal characters a searcher typed — escape them so
  // e.g. "a_c" (0 literal matches) doesn't silently become "a<any char>c" (107 matches).
  const like = `%${q.replace(/[%_\\]/g, '\\$&')}%`;
  const dictRows = query(`SELECT id, title FROM dict_articles
    WHERE kind='article' AND lower(title) LIKE ? ESCAPE '\\' ORDER BY length(title), sort_title LIMIT ${SEARCH_DICT_CAP + 1}`, [like]);
  const themeRows = query(`SELECT title, book, ref FROM tyndale_passages
    WHERE kind='theme' AND lower(title) LIKE ? ESCAPE '\\' ORDER BY title LIMIT ${SEARCH_GROUP_CAP + 1}`, [like]);
  const profileRows = query(`SELECT title, book, ref FROM tyndale_passages
    WHERE kind='profile' AND lower(title) LIKE ? ESCAPE '\\' ORDER BY title LIMIT ${SEARCH_GROUP_CAP + 1}`, [like]);
  return {
    dict: dictRows.slice(0, SEARCH_DICT_CAP),
    dictTruncated: dictRows.length > SEARCH_DICT_CAP,
    themes: themeRows.slice(0, SEARCH_GROUP_CAP),
    themesTruncated: themeRows.length > SEARCH_GROUP_CAP,
    profiles: profileRows.slice(0, SEARCH_GROUP_CAP),
    profilesTruncated: profileRows.length > SEARCH_GROUP_CAP,
    books: BOOKS.filter(([, name]) => name.toLowerCase().includes(q)).map(([code]) => code),
  };
}

export function getArticle(id) {
  return query(`SELECT id, title, body, n_refs, kind, is_html FROM dict_articles WHERE id=?`, [id])[0] || null;
}

// A theme or profile, so the Themes and Profiles routes are readable and not just browsable.
// tyndale_passages has no id column, but titles are unique within a kind (298 themes, 125
// profiles, all distinct), so (kind, title) is a safe key.
// start_chapter/start_verse are the anchor `getThemeIndex` already sorts on — structured and
// NOT NULL for all 423 rows, so `Open in Study` reads them directly rather than re-deriving the
// same values by parsing the `ref` display string (which is a span like "7:1-6" or "1:2–9:12",
// built for reading, not parsing).
export function getPassage(kind, title) {
  return query(`SELECT kind, title, book, ref, body, start_chapter, start_verse FROM tyndale_passages
    WHERE kind = ? AND title = ?`, [kind, title])[0] || null;
}

// What a theme or profile legitimately links to. There is no edge table for it to read: the
// dictionary's 11,242 ?item= links all point at other dictionary entries, so `dict_xref` names no
// passage at either end, and the only author-written links to a theme or profile in the whole
// corpus are the 118 that study notes write (73 of the 423 passages) — an id the passage rows do
// not carry. So both links here are anchors, not text matching:
//
//   `passages` — every other theme or profile whose verse span intersects this one's, in the same
//     book. Exact, and the publisher's own anchoring on both sides: Lot resolves to Abraham,
//     Melchizedek to Abraham, Rahab to Joshua, The Creation to Blessing, Human Sexuality,
//     Biblical Marriage and Adam and Eve. 149 of 298 themes and 78 of 125 profiles have at least
//     one; 147 of those 227 have exactly one and the most any has is 14, so this is not capped.
//   `article` — the same-title dictionary article, for the 84 of 125 profiles that have one. The
//     "(Person)" tie-break is getProfileIndex's, for the same reason: sort_title collides for 131
//     groups, and an unordered LIMIT 1 hands back Rahab the sea monster instead of the woman.
//
// PROFILES ONLY on that second one. The same match fires for 15 themes and cannot be trusted
// there: the theme "Shechem" is the altar at Josh 8:30-35, and preferring "(Person)" — right for a
// profile, which is always a person, people or place — points it at the wrong Shechem entirely.
//
// chapter*1000 + verse is getThemeIndex's own sort key, safe because the longest chapter in the
// canon is Ps 119 at 176 verses.
export function getPassageLinks(kind, title) {
  const passages = query(`SELECT q.kind, q.title, q.book, q.ref
    FROM tyndale_passages p JOIN tyndale_passages q
      ON q.book = p.book AND NOT (q.kind = p.kind AND q.title = p.title)
     AND (q.start_chapter * 1000 + q.start_verse) <= (p.end_chapter * 1000 + p.end_verse)
     AND (q.end_chapter * 1000 + q.end_verse) >= (p.start_chapter * 1000 + p.start_verse)
    WHERE p.kind = ? AND p.title = ?
    ORDER BY q.start_chapter, q.start_verse, q.seq`, [kind, title]);
  const article = kind !== 'profile' ? null
    : query(`SELECT id, title FROM dict_articles WHERE kind='article' AND sort_title = lower(?)
        ORDER BY title LIKE '%(Person)%' DESC, seq LIMIT 1`, [title])[0] || null;
  return { passages, article };
}

// Both directions. Outbound feeds the doors row; inbound is what the path map can reveal and
// nothing else in the UI can. Every edge resolves — `dst` is NOT NULL — because the graph is built
// from the source's own ?item= links rather than matched by title.
export function getXrefs(id) {
  return {
    // `raw` is the source's own link text, which is what the in-prose linkifier matches against the
    // rendered clause: the link reads "Mark of the Beast" while the article it points at is titled
    // "Mark of God*, Mark of the Beast". Matching on title alone would silently miss those.
    out: query(`SELECT a.id, a.title, x.raw, x.anchor FROM dict_xref x
      JOIN dict_articles a ON a.id = x.dst
      WHERE x.src = ? ORDER BY x.seq`, [id]),
    in: query(`SELECT a.id, a.title FROM dict_xref x
      JOIN dict_articles a ON a.id = x.src WHERE x.dst = ? ORDER BY a.sort_title`, [id]),
  };
}

export function getRandomArticle() {
  return query(`SELECT id, title FROM dict_articles
    WHERE kind='article' AND length(body) >= ? AND body NOT LIKE 'See %'
    ORDER BY random() LIMIT 1`, [SUBSTANTIAL_CHARS])[0] || null;
}

// 3 charts and 10 textboxes never resolved a host, so nothing else in the app can reach them.
export function getOrphanSupplements() {
  return query(`SELECT id, title, kind FROM dict_articles
    WHERE kind <> 'article' AND host_id IS NULL ORDER BY kind, title`);
}
