// build/extract-sources.mjs
// One-time (run by the maintainer): parse the raw CC-BY sources under ../backup-data into compact, committed
// intermediates in build/data/sources/. build-db.mjs then builds bible.db from these intermediates alone,
// so a fresh clone needs no backup-data/ tree (it stays gitignored, kept locally only as a backup).
//
// Each source is parsed with the SAME code the build used to run inline, into a throwaway in-memory DB,
// then that table is dumped verbatim. So the intermediates are byte-equivalent to the old sources build.
// verses (data/bibles/), chapter_recap + study_notes (already-committed build/data JSON) and the computed
// differences table are NOT extracted here — build-db.mjs still produces those directly.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { parseWordRef } from './lib/refs.mjs';
import { deriveLang } from './lib/lang.mjs';
import { normalizeGloss } from './lib/gloss.mjs';
import { parseMaculaGreekLine, parseProximityLine, padStrong } from './lib/macula.mjs';
import { loadHebrewDomains } from './lib/macula-hebrew.mjs';
import { loadTheographic } from './lib/theographic.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'build', 'data', 'sources');
fs.mkdirSync(OUT, { recursive: true });

const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE words (book TEXT, chapter INTEGER, verse INTEGER, position INTEGER,
    lang TEXT, original TEXT, translit TEXT, gloss TEXT, gloss_norm TEXT,
    strongs TEXT, morph TEXT, lemma TEXT, PRIMARY KEY (book,chapter,verse,position));
  CREATE TABLE lexicon (code TEXT PRIMARY KEY, lang TEXT, lemma TEXT, translit TEXT, gloss TEXT, definition TEXT);
  CREATE TABLE cross_refs (from_book TEXT, from_chapter INTEGER, from_verse INTEGER, to_ref TEXT, votes INTEGER);
  CREATE TABLE word_domain (strongs TEXT PRIMARY KEY, lemma TEXT, gloss TEXT, ln TEXT, domain TEXT, frame TEXT);
  CREATE TABLE word_sense (strongs TEXT, sense_id TEXT, gloss TEXT);
  CREATE TABLE synonyms (strongs_a TEXT, strongs_b TEXT, distance REAL);
  CREATE TABLE chapter_context (book TEXT NOT NULL, chapter INTEGER NOT NULL, osis_ref TEXT NOT NULL,
    writer TEXT, people_count INTEGER, place_count INTEGER, PRIMARY KEY (book, chapter));
  CREATE TABLE chapter_entity (book TEXT NOT NULL, chapter INTEGER NOT NULL, entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL, name TEXT NOT NULL, latitude REAL, longitude REAL, feature_type TEXT,
    blurb TEXT, approx_year INTEGER, sort_verse INTEGER, PRIMARY KEY (book, chapter, entity_type, entity_id));
`);
const tx = (fn) => { db.exec('BEGIN'); fn(); db.exec('COMMIT'); };
const stripHtml = s => (s||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();

// WORDS
const insW = db.prepare('INSERT OR IGNORE INTO words VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
function loadWords(file, defaultLang) {
  const lines = fs.readFileSync(file,'utf8').split('\n');
  tx(() => { for (const line of lines) {
    const c = line.split('\t');
    const ref = parseWordRef(c[0]); if (!ref) continue;
    let original, translit, gloss, strongs, morph, lemma, morphFull;
    if (defaultLang === 'grc') {
      original=(c[1]||'').replace(/\s*\(.*\)\s*$/,'').trim();
      translit=(c[1].match(/\(([^)]*)\)/)||[])[1]||'';
      gloss=(c[2]||'').trim(); morph=((c[3]||'').split('=')[1]||'').trim(); morphFull=morph;
      lemma=((c[4]||'').split('=')[0]||'').trim();
      strongs=(c[11]||(c[3]||'').split('=')[0]||'').trim();
    } else {
      original=(c[1]||'').trim(); translit=(c[2]||'').trim(); gloss=(c[3]||'').trim();
      morphFull=(c[5]||'').trim();
      morph=(morphFull.split('/').pop()||'').trim();
      strongs=(c[8]||'').replace(/[{}]/g,'').trim() || (c[4]||'').replace(/[{}]/g,'').split('/').pop().trim();
      lemma=((c[11]||'').match(/=([^=]+)=/)||[])[1]||'';
    }
    strongs=(strongs||'').replace(/_[A-Za-z]+$/,'');
    const lang = deriveLang(morphFull, defaultLang);
    insW.run(ref.book, ref.chapter, ref.verse, ref.position, lang, original, translit, gloss,
      normalizeGloss(gloss), strongs, morph, lemma);
  }});
}
const step = `${ROOT}/backup-data/STEPBible-Data/Translators Amalgamated OT+NT`;
for (const f of ['TAGNT Mat-Jhn','TAGNT Act-Rev'])
  loadWords(`${step}/${f} - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt`, 'grc');
for (const f of ['TAHOT Gen-Deu','TAHOT Jos-Est','TAHOT Job-Sng','TAHOT Isa-Mal'])
  loadWords(`${step}/${f} - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt`, 'hbo');

// LEXICON
const insL = db.prepare('INSERT OR IGNORE INTO lexicon VALUES (?,?,?,?,?,?)');
function loadLex(file, lang) {
  const lines=fs.readFileSync(file,'utf8').split('\n');
  tx(() => { for (const line of lines) { const c=line.split('\t');
    if (!/^[GH]\d/.test(c[0]||'')) continue;
    const base=c[0].trim(), ext=(c[2]||'').trim();
    const dis=((c[1]||'').match(/^[GH]\d+[A-Za-z]*/)||[''])[0];
    for (const code of [ext,base,dis]) if (code) insL.run(code, lang, (c[3]||'').trim(), (c[4]||'').trim(), (c[6]||'').trim(), stripHtml(c[7]));
  }});
}
const lex = `${ROOT}/backup-data/STEPBible-Data/Lexicons`;
loadLex(`${lex}/TBESG - Translators Brief lexicon of Extended Strongs for Greek - STEPBible.org CC BY.txt`, 'grc');
loadLex(`${lex}/TBESH - Translators Brief lexicon of Extended Strongs for Hebrew - STEPBible.org CC BY.txt`, 'hbo');

// CROSS-REFERENCES
const insX = db.prepare('INSERT INTO cross_refs VALUES (?,?,?,?,?)');
tx(() => { for (const line of fs.readFileSync(`${ROOT}/backup-data/openbible/cross_references.txt`,'utf8').split('\n')) {
  const c=line.split('\t'); const m=(c[0]||'').match(/^(\w+)\.(\d+)\.(\d+)$/);
  if (!m || !c[1]) continue; insX.run(m[1],+m[2],+m[3],c[1].trim(),+(c[2]||0));
}});

// MACULA GREEK: word_domain + word_sense
{
  const lines = fs.readFileSync(`${ROOT}/backup-data/macula-greek/SBLGNT/tsv/macula-greek-SBLGNT.tsv`,'utf8').split('\n');
  const header = lines[0].split('\t');
  const insD = db.prepare('INSERT OR IGNORE INTO word_domain VALUES (?,?,?,?,?,?)');
  const insS = db.prepare('INSERT INTO word_sense VALUES (?,?,?)');
  const seenSense = new Set();
  tx(() => { for (let i=1;i<lines.length;i++) {
    const r = parseMaculaGreekLine(lines[i], header); if (!r) continue;
    insD.run(r.strongs, r.lemma, r.gloss, r.ln, r.domain, r.frame);
    const key = r.strongs+'|'+r.ln; if (r.ln && !seenSense.has(key)) { seenSense.add(key); insS.run(r.strongs, r.ln, r.gloss); }
  }});
}
// MACULA HEBREW: SDBH domains for Hebrew + Aramaic (word_domain hbo/arc)
loadHebrewDomains(db, `${ROOT}/backup-data/macula-hebrew/WLC/lowfat`);

// SYNONYMS (proximity)
{
  const insP = db.prepare('INSERT INTO synonyms VALUES (?,?,?)');
  tx(() => { for (const line of fs.readFileSync(`${ROOT}/backup-data/macula-greek/sources/Clear/synonyms/Proximity.tsv`,'utf8').split('\n')) {
    const p = parseProximityLine(line); if (!p) continue; insP.run(padStrong(p.a), padStrong(p.b), p.distance);
  }});
}

// THEOGRAPHIC: chapter_context + chapter_entity
loadTheographic(db, `${ROOT}/backup-data/theographic`);

// --- dump each table to build/data/sources/<table>.json.gz (rows as arrays, column order fixed) ---
const DUMP = {
  words: ['book','chapter','verse','position','lang','original','translit','gloss','gloss_norm','strongs','morph','lemma'],
  lexicon: ['code','lang','lemma','translit','gloss','definition'],
  cross_refs: ['from_book','from_chapter','from_verse','to_ref','votes'],
  word_domain: ['strongs','lemma','gloss','ln','domain','frame'],
  word_sense: ['strongs','sense_id','gloss'],
  synonyms: ['strongs_a','strongs_b','distance'],
  chapter_context: ['book','chapter','osis_ref','writer','people_count','place_count'],
  chapter_entity: ['book','chapter','entity_type','entity_id','name','latitude','longitude','feature_type','blurb','approx_year','sort_verse'],
};
for (const [table, cols] of Object.entries(DUMP)) {
  const rows = db.prepare(`SELECT ${cols.join(',')} FROM ${table}`).all().map(r => cols.map(c => r[c]));
  const dest = path.join(OUT, `${table}.json.gz`);
  fs.writeFileSync(dest, zlib.gzipSync(JSON.stringify(rows)));
  console.log(`extract: ${table} — ${rows.length} rows -> ${path.basename(dest)} (${(fs.statSync(dest).size/1e6).toFixed(1)} MB)`);
}
db.close();
