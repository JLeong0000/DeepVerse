// build/build-db.mjs
// Build data/bible.db v2 — the spine that joins everything by verse ref + word position.
// Reads only committed inputs: data/bibles/ (verses), build/data/sources/*.json.gz (the parsed source
// intermediates produced once by extract-sources.mjs), and build/data/*.json (recaps, study notes).
// No backup-data/ tree needed — a fresh clone can build. Run: node build-db.mjs
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { computeDifferences } from './lib/differences.mjs';
import { loadRecaps } from './lib/recaps.mjs';
import { loadStudyNotes } from './lib/studynotes.mjs';
import { loadTyndale, loadXrefs } from './lib/tyndale.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DB = `${ROOT}/data/bible.db`;
const SRC = path.join(ROOT, 'build', 'data', 'sources');
fs.rmSync(DB, { force: true });
const db = new DatabaseSync(DB);
db.exec(`
  PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF;
  CREATE TABLE verses (version TEXT, book TEXT, chapter INTEGER, verse INTEGER, text TEXT,
    PRIMARY KEY (version,book,chapter,verse));
  CREATE TABLE words (book TEXT, chapter INTEGER, verse INTEGER, position INTEGER,
    lang TEXT, original TEXT, translit TEXT, gloss TEXT, gloss_norm TEXT,
    strongs TEXT, morph TEXT, lemma TEXT, PRIMARY KEY (book,chapter,verse,position));
  CREATE TABLE lexicon (code TEXT PRIMARY KEY, lang TEXT, lemma TEXT, translit TEXT, gloss TEXT, definition TEXT);
  CREATE TABLE cross_refs (from_book TEXT, from_chapter INTEGER, from_verse INTEGER, to_ref TEXT, votes INTEGER);
  CREATE TABLE word_domain (strongs TEXT PRIMARY KEY, lemma TEXT, gloss TEXT, ln TEXT, domain TEXT, frame TEXT);
  CREATE TABLE synonyms (strongs_a TEXT, strongs_b TEXT, distance REAL);
  CREATE TABLE word_sense (strongs TEXT, sense_id TEXT, gloss TEXT);
  CREATE TABLE chapter_context (
    book TEXT NOT NULL,
    chapter INTEGER NOT NULL,
    osis_ref TEXT NOT NULL,
    writer TEXT,
    people_count INTEGER,
    place_count INTEGER,
    PRIMARY KEY (book, chapter)
  );
  CREATE TABLE chapter_entity (
    book TEXT NOT NULL,
    chapter INTEGER NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    name TEXT NOT NULL,
    latitude REAL, longitude REAL,
    feature_type TEXT,
    blurb TEXT,
    approx_year INTEGER,
    sort_verse INTEGER,
    PRIMARY KEY (book, chapter, entity_type, entity_id)
  );
  CREATE TABLE chapter_recap (
    book TEXT NOT NULL,
    chapter INTEGER NOT NULL,
    recap TEXT NOT NULL,
    source TEXT NOT NULL,
    PRIMARY KEY (book, chapter)
  );
  CREATE TABLE study_notes (
    book TEXT NOT NULL,
    start_chapter INTEGER NOT NULL, start_verse INTEGER NOT NULL,
    end_chapter INTEGER NOT NULL, end_verse INTEGER NOT NULL,
    ref TEXT NOT NULL, osis_ref TEXT NOT NULL, body TEXT NOT NULL, seq INTEGER NOT NULL
  );
  CREATE TABLE dict_articles (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    sort_title TEXT NOT NULL,
    kind TEXT NOT NULL,
    host_id TEXT,
    body TEXT NOT NULL,
    is_html INTEGER NOT NULL,
    n_refs INTEGER NOT NULL,
    seq INTEGER NOT NULL
  );
  CREATE TABLE dict_verse (
    article_id TEXT NOT NULL,
    book TEXT NOT NULL, chapter INTEGER NOT NULL, verse INTEGER NOT NULL,
    lex_hit INTEGER NOT NULL
  );
  -- Both endpoints are dict_articles rows, which includes supplements (textboxes and charts).
  -- A supplement src is the box's own id, never its host's: the clause is written in the box's
  -- text and seq numbers that text, so collapsing it into the host would interleave two bodies.
  -- A supplement dst, by contrast, IS collapsed — a hosted box is rendered inside its host, so
  -- the edge stores the host's id and puts the box's title in anchor. Only the 13 supplements
  -- with no host appear as dst in their own right. A row never links to the page it is already
  -- on, so there are no src=dst edges and no hosted box pointing at its own host.
  CREATE TABLE dict_xref (
    src TEXT NOT NULL,          -- dict_articles.id, the citing article or supplement
    dst TEXT,                   -- dict_articles.id, or NULL when no such article exists
    raw TEXT NOT NULL,          -- the target exactly as the source wrote it
    anchor TEXT,                -- a "## Subhead" to scroll to, or a hosted supplement's title
    seq INTEGER NOT NULL);      -- order of appearance in the body
  CREATE TABLE tyndale_passages (
    kind TEXT NOT NULL, title TEXT NOT NULL, book TEXT NOT NULL,
    start_chapter INTEGER NOT NULL, start_verse INTEGER NOT NULL,
    end_chapter INTEGER NOT NULL, end_verse INTEGER NOT NULL,
    ref TEXT NOT NULL, body TEXT NOT NULL, seq INTEGER NOT NULL
  );
  CREATE TABLE book_intros (
    book TEXT PRIMARY KEY, summary TEXT NOT NULL, intro TEXT NOT NULL
  );
`);
const tx = (fn) => { db.exec('BEGIN'); fn(); db.exec('COMMIT'); };

// 1) VERSES (from the committed per-book JSON in data/bibles/)
const insV = db.prepare('INSERT OR IGNORE INTO verses VALUES (?,?,?,?,?)');
let nV=0;
for (const version of ['NIV','NKJV','NLT']) {
  const dir = `${ROOT}/data/bibles/${version}`;
  tx(() => { for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json') || f.startsWith('_')) continue;
    const book=f.replace('.json',''); const b=JSON.parse(fs.readFileSync(`${dir}/${f}`,'utf8'));
    for (const [ch,vs] of Object.entries(b.chapters)) for (const [v,t] of Object.entries(vs)) { insV.run(version,book,+ch,+v,t); nV++; }
  }});
}
console.log('verses:', nV);

// 2) SOURCE-DERIVED TABLES (from the committed intermediates built once by extract-sources.mjs)
const readRows = name => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(SRC, `${name}.json.gz`))));
function loadTable(name, insertSql) {
  const stmt = db.prepare(insertSql);
  const rows = readRows(name);
  tx(() => { for (const r of rows) stmt.run(...r); });
  return rows.length;
}
console.log('words:', loadTable('words', 'INSERT OR IGNORE INTO words VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'));
console.log('lexicon:', loadTable('lexicon', 'INSERT OR IGNORE INTO lexicon VALUES (?,?,?,?,?,?)'));
console.log('cross_refs:', loadTable('cross_refs', 'INSERT INTO cross_refs VALUES (?,?,?,?,?)'));
console.log('word_domain:', loadTable('word_domain', 'INSERT OR IGNORE INTO word_domain VALUES (?,?,?,?,?,?)'));
console.log('word_sense:', loadTable('word_sense', 'INSERT INTO word_sense VALUES (?,?,?)'));
console.log('synonyms:', loadTable('synonyms', 'INSERT INTO synonyms VALUES (?,?,?)'));
console.log('chapter_context:', loadTable('chapter_context', 'INSERT OR IGNORE INTO chapter_context VALUES (?,?,?,?,?,?)'));
console.log('chapter_entity:', loadTable('chapter_entity', 'INSERT OR IGNORE INTO chapter_entity VALUES (?,?,?,?,?,?,?,?,?,?,?)'));

// 3) DIFFERENCES (precomputed Type A/B interpretive-difference table; reads only the DB tables above)
computeDifferences(db);
console.log('differences:', db.prepare('SELECT COUNT(*) n FROM differences').get().n);

// 4) CHAPTER RECAPS: Bible Summary (Chris Juby, 140-char per-chapter), editorial fallback if missing
const recaps = loadRecaps(db);
console.log('chapter_recap:', recaps.count, JSON.stringify(recaps.bySource));

// 5) TYNDALE STUDY NOTES: per-verse-range study notes for the Context tab
const studyNotes = loadStudyNotes(db);
console.log('study_notes:', studyNotes.count);

// 6) TYNDALE CULTURAL LAYER: dictionary + themes/profiles + book intros
const tyndale = loadTyndale(db);
// `rows` carries all 6,141 parsed articles and `xrefLinks` the source's own "See …" link targets,
// both for loadXrefs to reuse; logging either would dump megabytes
const { rows: _rows, xrefLinks: _links, ...tyndaleCounts } = tyndale;
console.log('tyndale:', JSON.stringify(tyndaleCounts));
const xrefs = loadXrefs(db, tyndale.rows, tyndale.xrefLinks);
console.log('dict_xref:', JSON.stringify(xrefs));

db.exec(`
  CREATE INDEX idx_words_ref ON words(book,chapter,verse);
  CREATE INDEX idx_words_strongs ON words(strongs);
  CREATE INDEX idx_words_glossnorm ON words(gloss_norm);
  CREATE INDEX idx_xref ON cross_refs(from_book,from_chapter,from_verse);
  CREATE INDEX idx_syn_a ON synonyms(strongs_a);
  CREATE INDEX idx_wordsense ON word_sense(strongs);
  CREATE INDEX idx_chapter_context ON chapter_context(book,chapter);
  CREATE INDEX idx_chapter_entity ON chapter_entity(book,chapter);
  CREATE INDEX idx_chapter_recap ON chapter_recap(book,chapter);
  CREATE INDEX idx_study_notes ON study_notes(book, start_chapter, end_chapter);
  CREATE INDEX idx_dict_verse ON dict_verse(book, chapter, verse);
  CREATE INDEX idx_dict_sort ON dict_articles(sort_title);
  CREATE INDEX idx_dict_xref_src ON dict_xref(src);
  CREATE INDEX idx_dict_xref_dst ON dict_xref(dst);
  CREATE INDEX idx_tyndale_passages ON tyndale_passages(book, start_chapter, end_chapter);
`);
db.close();
console.log('bible.db v2 built at', DB);
