// Build data/bible.db — the spine that joins everything by verse ref + word position.
// Tables: verses (3 versions), words (Greek+Hebrew interlinear), lexicon (Strong's), cross_refs.
// Run: node build-db.mjs
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';

const ROOT = '/Users/justinleong/Desktop/Coding/DeepVerse';
const DB = `${ROOT}/data/bible.db`;
fs.rmSync(DB, { force: true });
const db = new DatabaseSync(DB);

db.exec(`
  PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF;
  CREATE TABLE verses (version TEXT, book TEXT, chapter INTEGER, verse INTEGER, text TEXT,
    PRIMARY KEY (version, book, chapter, verse));
  CREATE TABLE words (book TEXT, chapter INTEGER, verse INTEGER, position INTEGER,
    lang TEXT, original TEXT, translit TEXT, gloss TEXT, strongs TEXT, morph TEXT, lemma TEXT,
    PRIMARY KEY (book, chapter, verse, position));
  CREATE TABLE lexicon (code TEXT PRIMARY KEY, lang TEXT, lemma TEXT, translit TEXT, gloss TEXT, definition TEXT);
  CREATE TABLE cross_refs (from_book TEXT, from_chapter INTEGER, from_verse INTEGER, to_ref TEXT, votes INTEGER);
`);

// STEPBible book code -> OSIS (matches the codes used in data/bibles + OpenBible)
const STEP2OSIS = {
  Gen:'Gen',Exo:'Exod',Lev:'Lev',Num:'Num',Deu:'Deut',Jos:'Josh',Jdg:'Judg',Rut:'Ruth',
  '1Sa':'1Sam','2Sa':'2Sam','1Ki':'1Kgs','2Ki':'2Kgs','1Ch':'1Chr','2Ch':'2Chr',Ezr:'Ezra',Neh:'Neh',
  Est:'Esth',Job:'Job',Psa:'Ps',Pro:'Prov',Ecc:'Eccl',Sng:'Song',Isa:'Isa',Jer:'Jer',Lam:'Lam',
  Ezk:'Ezek',Dan:'Dan',Hos:'Hos',Jol:'Joel',Amo:'Amos',Oba:'Obad',Jon:'Jonah',Mic:'Mic',Nam:'Nah',
  Hab:'Hab',Zep:'Zeph',Hag:'Hag',Zec:'Zech',Mal:'Mal',Mat:'Matt',Mrk:'Mark',Luk:'Luke',Jhn:'John',
  Act:'Acts',Rom:'Rom','1Co':'1Cor','2Co':'2Cor',Gal:'Gal',Eph:'Eph',Php:'Phil',Col:'Col',
  '1Th':'1Thess','2Th':'2Thess','1Ti':'1Tim','2Ti':'2Tim',Tit:'Titus',Phm:'Phlm',Heb:'Heb',Jas:'Jas',
  '1Pe':'1Pet','2Pe':'2Pet','1Jn':'1John','2Jn':'2John','3Jn':'3John',Jud:'Jude',Rev:'Rev',
};
const stripHtml = s => (s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

const tx = fn => { db.exec('BEGIN'); fn(); db.exec('COMMIT'); };

// 1) VERSES ---------------------------------------------------------------
const insV = db.prepare('INSERT OR IGNORE INTO verses VALUES (?,?,?,?,?)');
let nV = 0;
for (const version of ['NIV', 'NKJV', 'NLT']) {
  const dir = `${ROOT}/data/bibles/${version}`;
  tx(() => {
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json') || f.startsWith('_')) continue;
      const book = f.replace('.json', '');
      const b = JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8'));
      for (const [ch, vs] of Object.entries(b.chapters))
        for (const [v, t] of Object.entries(vs)) { insV.run(version, book, +ch, +v, t); nV++; }
    }
  });
}
console.log('verses:', nV);

// 2) WORDS (interlinear) --------------------------------------------------
const insW = db.prepare('INSERT OR IGNORE INTO words VALUES (?,?,?,?,?,?,?,?,?,?,?)');
function loadWords(file, lang) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  let n = 0;
  tx(() => {
    for (const line of lines) {
      const c = line.split('\t');
      const m = c[0].match(/^([A-Za-z0-9]+)\.(\d+)\.(\d+)#(\d+)/);
      if (!m) continue;
      const book = STEP2OSIS[m[1]]; if (!book) continue;
      const [, , ch, vs, pos] = m;
      let original, translit, gloss, strongs, morph, lemma;
      if (lang === 'grc') {
        original = (c[1] || '').replace(/\s*\(.*\)\s*$/, '').trim();
        translit = (c[1].match(/\(([^)]*)\)/) || [])[1] || '';
        gloss = (c[2] || '').trim();
        morph = ((c[3] || '').split('=')[1] || '').trim();
        lemma = ((c[4] || '').split('=')[0] || '').trim();
        strongs = (c[11] || (c[3] || '').split('=')[0] || '').trim();
      } else {
        original = (c[1] || '').trim();
        translit = (c[2] || '').trim();
        gloss = (c[3] || '').trim();
        morph = ((c[5] || '').split('/').pop() || '').trim();
        strongs = (c[8] || '').replace(/[{}]/g, '').trim() || (c[4] || '').replace(/[{}]/g, '').split('/').pop().trim();
        lemma = ((c[11] || '').match(/=([^=]+)=/) || [])[1] || '';
      }
      strongs = (strongs || '').replace(/_[A-Z]+$/, '');   // drop homograph suffix (G3588_A -> G3588) so it joins the lexicon
      insW.run(book, +ch, +vs, +pos, lang, original, translit, gloss, strongs, morph, lemma);
      n++;
    }
  });
  return n;
}
let nW = 0;
const step = `${ROOT}/sources/STEPBible-Data/Translators Amalgamated OT+NT`;
for (const f of ['TAGNT Mat-Jhn', 'TAGNT Act-Rev'])
  nW += loadWords(`${step}/${f} - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt`, 'grc');
for (const f of ['TAHOT Gen-Deu', 'TAHOT Jos-Est', 'TAHOT Job-Sng', 'TAHOT Isa-Mal'])
  nW += loadWords(`${step}/${f} - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt`, 'hbo');
console.log('words:', nW);

// 3) LEXICON --------------------------------------------------------------
const insL = db.prepare('INSERT OR IGNORE INTO lexicon VALUES (?,?,?,?,?,?)');
function loadLex(file, lang) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  let n = 0;
  tx(() => {
    for (const line of lines) {
      const c = line.split('\t');
      if (!/^[GH]\d/.test(c[0] || '')) continue;
      const base = c[0].trim(), ext = (c[2] || '').trim();
      const lemma = (c[3] || '').trim(), translit = (c[4] || '').trim(), gloss = (c[6] || '').trim(), def = stripHtml(c[7]);
      for (const code of [ext, base]) if (code) { insL.run(code, lang, lemma, translit, gloss, def); }
      n++;
    }
  });
  return n;
}
let nL = 0;
const lex = `${ROOT}/sources/STEPBible-Data/Lexicons`;
nL += loadLex(`${lex}/TBESG - Translators Brief lexicon of Extended Strongs for Greek - STEPBible.org CC BY.txt`, 'grc');
nL += loadLex(`${lex}/TBESH - Translators Brief lexicon of Extended Strongs for Hebrew - STEPBible.org CC BY.txt`, 'hbo');
console.log('lexicon rows read:', nL, '| lexicon entries:', db.prepare('SELECT COUNT(*) n FROM lexicon').get().n);

// 4) CROSS-REFERENCES -----------------------------------------------------
const insX = db.prepare('INSERT INTO cross_refs VALUES (?,?,?,?,?)');
let nX = 0;
tx(() => {
  for (const line of fs.readFileSync(`${ROOT}/sources/openbible/cross_references.txt`, 'utf8').split('\n')) {
    const c = line.split('\t');
    const m = (c[0] || '').match(/^(\w+)\.(\d+)\.(\d+)$/);
    if (!m || !c[1]) continue;
    insX.run(m[1], +m[2], +m[3], c[1].trim(), +(c[2] || 0));
    nX++;
  }
});
console.log('cross_refs:', nX);

db.exec(`
  CREATE INDEX idx_words_ref ON words(book, chapter, verse);
  CREATE INDEX idx_words_strongs ON words(strongs);
  CREATE INDEX idx_xref ON cross_refs(from_book, from_chapter, from_verse);
`);
db.close();
console.log('\nbible.db built at', DB);
