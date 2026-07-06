// build/build-db.mjs
// Build data/bible.db v2 — the spine that joins everything by verse ref + word position.
// Tables: verses, words (grc/hbo/arc interlinear), lexicon, cross_refs, word_domain, synonyms, word_sense.
// Run: node build-db.mjs
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { parseWordRef } from './lib/refs.mjs';
import { deriveLang } from './lib/lang.mjs';
import { normalizeGloss } from './lib/gloss.mjs';
import { parseMaculaGreekLine, parseProximityLine } from './lib/macula.mjs';

const ROOT = '/Users/justinleong/Desktop/Coding/DeepVerse';
const DB = `${ROOT}/data/bible.db`;
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
`);
const tx = (fn) => { db.exec('BEGIN'); fn(); db.exec('COMMIT'); };
const stripHtml = s => (s||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();

// 1) VERSES (unchanged from v1)
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

// 2) WORDS (fixed refs + 3-way lang + gloss_norm)
const insW = db.prepare('INSERT OR IGNORE INTO words VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
function loadWords(file, defaultLang) {
  const lines = fs.readFileSync(file,'utf8').split('\n'); let n=0;
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
      morphFull=(c[5]||'').trim();                 // full TAHOT morph carries the H/A language marker
      morph=(morphFull.split('/').pop()||'').trim(); // stored: head-word morph
      strongs=(c[8]||'').replace(/[{}]/g,'').trim() || (c[4]||'').replace(/[{}]/g,'').split('/').pop().trim();
      lemma=((c[11]||'').match(/=([^=]+)=/)||[])[1]||'';
    }
    strongs=(strongs||'').replace(/_[A-Z]+$/,'');
    const lang = deriveLang(morphFull, defaultLang);
    insW.run(ref.book, ref.chapter, ref.verse, ref.position, lang, original, translit, gloss,
      normalizeGloss(gloss), strongs, morph, lemma);
    n++;
  }});
  return n;
}
let nW=0;
const step = `${ROOT}/sources/STEPBible-Data/Translators Amalgamated OT+NT`;
for (const f of ['TAGNT Mat-Jhn','TAGNT Act-Rev'])
  nW += loadWords(`${step}/${f} - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt`, 'grc');
for (const f of ['TAHOT Gen-Deu','TAHOT Jos-Est','TAHOT Job-Sng','TAHOT Isa-Mal'])
  nW += loadWords(`${step}/${f} - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt`, 'hbo');
console.log('words:', nW);

// 3) LEXICON (unchanged from v1)
const insL = db.prepare('INSERT OR IGNORE INTO lexicon VALUES (?,?,?,?,?,?)');
function loadLex(file, lang) {
  const lines=fs.readFileSync(file,'utf8').split('\n');
  tx(() => { for (const line of lines) { const c=line.split('\t');
    if (!/^[GH]\d/.test(c[0]||'')) continue;
    const base=c[0].trim(), ext=(c[2]||'').trim();
    for (const code of [ext,base]) if (code) insL.run(code, lang, (c[3]||'').trim(), (c[4]||'').trim(), (c[6]||'').trim(), stripHtml(c[7]));
  }});
}
const lex = `${ROOT}/sources/STEPBible-Data/Lexicons`;
loadLex(`${lex}/TBESG - Translators Brief lexicon of Extended Strongs for Greek - STEPBible.org CC BY.txt`, 'grc');
loadLex(`${lex}/TBESH - Translators Brief lexicon of Extended Strongs for Hebrew - STEPBible.org CC BY.txt`, 'hbo');
console.log('lexicon:', db.prepare('SELECT COUNT(*) n FROM lexicon').get().n);

// 4) CROSS-REFERENCES (unchanged from v1)
const insX = db.prepare('INSERT INTO cross_refs VALUES (?,?,?,?,?)');
tx(() => { for (const line of fs.readFileSync(`${ROOT}/sources/openbible/cross_references.txt`,'utf8').split('\n')) {
  const c=line.split('\t'); const m=(c[0]||'').match(/^(\w+)\.(\d+)\.(\d+)$/);
  if (!m || !c[1]) continue; insX.run(m[1],+m[2],+m[3],c[1].trim(),+(c[2]||0));
}});
console.log('cross_refs:', db.prepare('SELECT COUNT(*) n FROM cross_refs').get().n);

// 5) MACULA: word_domain + word_sense (Greek) and synonyms (proximity)
const maculaGreek = `${ROOT}/sources/macula-greek/SBLGNT/tsv/macula-greek-SBLGNT.tsv`;
{
  const lines = fs.readFileSync(maculaGreek,'utf8').split('\n');
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
console.log('word_domain:', db.prepare('SELECT COUNT(*) n FROM word_domain').get().n);

const proximity = `${ROOT}/sources/macula-greek/sources/Clear/synonyms/Proximity.tsv`;
{
  const insP = db.prepare('INSERT INTO synonyms VALUES (?,?,?)');
  tx(() => { for (const line of fs.readFileSync(proximity,'utf8').split('\n')) {
    const p = parseProximityLine(line); if (!p) continue; insP.run(p.a, p.b, p.distance);
  }});
}
console.log('synonyms:', db.prepare('SELECT COUNT(*) n FROM synonyms').get().n);

db.exec(`
  CREATE INDEX idx_words_ref ON words(book,chapter,verse);
  CREATE INDEX idx_words_strongs ON words(strongs);
  CREATE INDEX idx_words_glossnorm ON words(gloss_norm);
  CREATE INDEX idx_xref ON cross_refs(from_book,from_chapter,from_verse);
  CREATE INDEX idx_syn_a ON synonyms(strongs_a);
  CREATE INDEX idx_wordsense ON word_sense(strongs);
`);
db.close();
console.log('bible.db v2 built at', DB);
