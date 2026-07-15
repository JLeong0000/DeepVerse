// build/lib/recaps.mjs
// Per-chapter RECAPS for the Context tab, from public-domain commentaries fetched by
// build/fetch-commentaries.mjs (HelloAO Free Use Bible API, CC Public Domain Mark 1.0).
//
// The recap text is a chapter's `introduction` field. Matthew Henry intros cite verses with
// an idiosyncratic book abbreviation (e.g. "(Gen 1:1)", "(Rut 1:1)", "(Kg1 1:1)", "(Jo3 1:1)").
// At least one intro is MISALIGNED in the source (RUT/1's text is actually 3 John's), so we
// SELF-CALIBRATE each book's expected abbreviation from its own intros and EXCLUDE any chapter
// whose dominant citation abbreviation points at a different book. Missing recap beats wrong recap.
import fs from 'node:fs';

const stripHtml = s => (s || '')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();

// USFM (source) -> OSIS (app verses.book). 66 books.
export const USFM_TO_OSIS = {
  GEN: 'Gen', EXO: 'Exod', LEV: 'Lev', NUM: 'Num', DEU: 'Deut', JOS: 'Josh', JDG: 'Judg',
  RUT: 'Ruth', '1SA': '1Sam', '2SA': '2Sam', '1KI': '1Kgs', '2KI': '2Kgs', '1CH': '1Chr',
  '2CH': '2Chr', EZR: 'Ezra', NEH: 'Neh', EST: 'Esth', JOB: 'Job', PSA: 'Ps', PRO: 'Prov',
  ECC: 'Eccl', SNG: 'Song', ISA: 'Isa', JER: 'Jer', LAM: 'Lam', EZK: 'Ezek', DAN: 'Dan',
  HOS: 'Hos', JOL: 'Joel', AMO: 'Amos', OBA: 'Obad', JON: 'Jonah', MIC: 'Mic', NAM: 'Nah',
  HAB: 'Hab', ZEP: 'Zeph', HAG: 'Hag', ZEC: 'Zech', MAL: 'Mal', MAT: 'Matt', MRK: 'Mark',
  LUK: 'Luke', JHN: 'John', ACT: 'Acts', ROM: 'Rom', '1CO': '1Cor', '2CO': '2Cor', GAL: 'Gal',
  EPH: 'Eph', PHP: 'Phil', COL: 'Col', '1TH': '1Thess', '2TH': '2Thess', '1TI': '1Tim',
  '2TI': '2Tim', TIT: 'Titus', PHM: 'Phlm', HEB: 'Heb', JAS: 'Jas', '1PE': '1Pet', '2PE': '2Pet',
  '1JN': '1John', '2JN': '2John', '3JN': '3John', JUD: 'Jude', REV: 'Rev',
};

// Common-name cue for the "unvalidated" (no-citation) sanity check, keyed by OSIS.
const BOOK_NAME_CUE = {
  Gen: 'genesis', Exod: 'exodus', Lev: 'leviticus', Num: 'numbers', Deut: 'deuteronomy',
  Josh: 'joshua', Judg: 'judges', Ruth: 'ruth', '1Sam': 'samuel', '2Sam': 'samuel',
  '1Kgs': 'kings', '2Kgs': 'kings', '1Chr': 'chronicles', '2Chr': 'chronicles', Ezra: 'ezra',
  Neh: 'nehemiah', Esth: 'esther', Job: 'job', Ps: 'psalm', Prov: 'proverb', Eccl: 'ecclesiastes',
  Song: 'song', Isa: 'isaiah', Jer: 'jeremiah', Lam: 'lamentations', Ezek: 'ezekiel', Dan: 'daniel',
  Hos: 'hosea', Joel: 'joel', Amos: 'amos', Obad: 'obadiah', Jonah: 'jonah', Mic: 'micah',
  Nah: 'nahum', Hab: 'habakkuk', Zeph: 'zephaniah', Hag: 'haggai', Zech: 'zechariah', Mal: 'malachi',
  Matt: 'matthew', Mark: 'mark', Luke: 'luke', John: 'john', Acts: 'acts', Rom: 'romans',
  '1Cor': 'corinthians', '2Cor': 'corinthians', Gal: 'galatians', Eph: 'ephesians', Phil: 'philippians',
  Col: 'colossians', '1Thess': 'thessalonians', '2Thess': 'thessalonians', '1Tim': 'timothy',
  '2Tim': 'timothy', Titus: 'titus', Phlm: 'philemon', Heb: 'hebrews', Jas: 'james', '1Pet': 'peter',
  '2Pet': 'peter', '1John': 'john', '2John': 'john', '3John': 'john', Jude: 'jude', Rev: 'revelation',
};

// Citation abbreviations: 2-3 letters, optional leading & trailing digit, before "N:N".
const CITE_RE = /\b([1-3]?[A-Za-z]{2,3}[0-9]?)\s+\d+:\d+/g;

function extractAbbrevs(text) {
  const out = [];
  let m;
  CITE_RE.lastIndex = 0;
  while ((m = CITE_RE.exec(text)) !== null) out.push(m[1]);
  return out;
}

// Most frequent element (ties broken by first-seen order).
function mode(arr) {
  const counts = new Map();
  for (const a of arr) counts.set(a, (counts.get(a) || 0) + 1);
  let best = null, bestN = 0;
  for (const [k, n] of counts) if (n > bestN) { best = k; bestN = n; }
  return best;
}

// Read every fetched chapter intro for one commentary, keyed by OSIS book.
// Returns { chapters: [{osis, usfm, chapter, intro, abbrevs, dominant}], ... }
function readCommentary(dir, commentary) {
  const base = `${dir}/${commentary}`;
  const chapters = [];
  if (!fs.existsSync(base)) return { chapters };
  for (const usfm of fs.readdirSync(base)) {
    const osis = USFM_TO_OSIS[usfm];
    if (!osis) continue;
    const bookDir = `${base}/${usfm}`;
    for (const f of fs.readdirSync(bookDir)) {
      if (!f.endsWith('.json')) continue;
      const chapter = +f.replace('.json', '');
      const data = JSON.parse(fs.readFileSync(`${bookDir}/${f}`, 'utf8'));
      const introRaw = data?.chapter?.introduction;
      if (!introRaw) continue;
      const intro = stripHtml(introRaw);
      const abbrevs = extractAbbrevs(intro);
      chapters.push({ osis, usfm, chapter, intro, abbrevs, dominant: mode(abbrevs) });
    }
  }
  return { chapters };
}

// Full alignment analysis for one commentary.
// Returns a Map "OSIS|chapter" -> { status:'aligned'|'misaligned'|'unvalidated', intro, dominant,
//   modal, pointsTo } plus book-level modal map and summary stats.
export function analyzeCommentary(dir, commentary) {
  const { chapters } = readCommentary(dir, commentary);

  // Book modal = mode of each book's per-chapter dominant abbreviations (chapters with a citation).
  const byBook = new Map();
  for (const c of chapters) {
    if (!c.dominant) continue;
    if (!byBook.has(c.osis)) byBook.set(c.osis, []);
    byBook.get(c.osis).push(c.dominant);
  }
  const bookModal = new Map();
  for (const [osis, doms] of byBook) bookModal.set(osis, mode(doms));

  // Reverse map: a modal abbrev -> the OSIS book it identifies (to name which book a misaligned
  // intro actually points at). If two books share a modal, first wins; only used for reporting.
  const abbrevToBook = new Map();
  for (const [osis, ab] of bookModal) if (!abbrevToBook.has(ab)) abbrevToBook.set(ab, osis);

  const result = new Map();
  const stats = { total: chapters.length, aligned: 0, misaligned: 0, unvalidated: 0,
    unvalidatedNoCue: 0, misalignedList: [], lengths: [] };

  for (const c of chapters) {
    const key = `${c.osis}|${c.chapter}`;
    const modal = bookModal.get(c.osis);
    if (!c.dominant) {
      // No citation: sanity-check the book name cue; import regardless but flag no-cue ones.
      const cue = BOOK_NAME_CUE[c.osis];
      const hasCue = cue && c.intro.toLowerCase().includes(cue);
      stats.unvalidated++;
      if (!hasCue) stats.unvalidatedNoCue++;
      result.set(key, { status: 'unvalidated', intro: c.intro, dominant: null, modal, pointsTo: null, hasCue });
      stats.lengths.push(c.intro.length);
      continue;
    }
    // MISALIGNED only when ALL of: (a) the intro has citations, (b) the book's own modal abbrev
    // is cited ZERO times (no self-citation), and (c) a single OTHER book's abbrev is the strong
    // majority (>= 60%). Otherwise ALIGNED — an intro that cites its own book at all is kept even
    // when another book is numerically dominant (e.g. Gen 33 quotes "Pro 16:7" as a proof-text).
    const selfCites = modal ? c.abbrevs.filter(a => a === modal).length : 0;
    const topShare = c.dominant ? c.abbrevs.filter(a => a === c.dominant).length / c.abbrevs.length : 0;
    if (selfCites === 0 && topShare >= 0.60) {
      stats.misaligned++;
      const pointsTo = abbrevToBook.get(c.dominant) || '(unknown)';
      stats.misalignedList.push({ osis: c.osis, chapter: c.chapter, dominant: c.dominant, modal,
        pointsTo, share: topShare });
      result.set(key, { status: 'misaligned', intro: c.intro, dominant: c.dominant, modal, pointsTo });
    } else {
      stats.aligned++;
      result.set(key, { status: 'aligned', intro: c.intro, dominant: c.dominant, modal, pointsTo: null });
      stats.lengths.push(c.intro.length);
    }
  }
  stats.misalignedList.sort((a, b) => a.osis.localeCompare(b.osis) || a.chapter - b.chapter);
  return { result, bookModal, stats };
}

// Load validated-clean recaps into chapter_recap.
// For each target (book,chapter): Matthew Henry's aligned/unvalidated intro, else Adam Clarke's,
// else a committed editorial recap (build/data/recaps-editorial.json, if present).
// Misaligned intros are never imported.
const EDITORIAL_FILE = new URL('../data/recaps-editorial.json', import.meta.url);

export function loadRecaps(db, dir) {
  const targets = db.prepare('SELECT DISTINCT book, chapter FROM verses ORDER BY book, chapter').all();
  const mh = analyzeCommentary(dir, 'matthew-henry').result;
  const clarke = analyzeCommentary(dir, 'adam-clarke').result;

  // Editorial fallback: last resort for chapters no commentary covers. Skip gracefully if absent.
  // Each entry may carry its own source (default 'editorial'); some entries are a genuine
  // Matthew Henry recap the citation guard flagged as a false positive but we verified by hand.
  const editorial = new Map();
  if (fs.existsSync(EDITORIAL_FILE)) {
    for (const e of JSON.parse(fs.readFileSync(EDITORIAL_FILE, 'utf8')))
      if (e.recap) editorial.set(`${e.book}|${e.chapter}`, { recap: e.recap.trim(), source: e.source || 'editorial' });
  }

  const ins = db.prepare('INSERT OR IGNORE INTO chapter_recap VALUES (?,?,?,?)');
  const usable = (a) => a && a.status !== 'misaligned' ? a : null;
  const bySource = { 'matthew-henry': 0, 'adam-clarke': 0, 'editorial': 0 };
  let count = 0;

  db.exec('BEGIN');
  for (const { book, chapter } of targets) {
    const key = `${book}|${chapter}`;
    let recap = null, source = null;
    if (usable(mh.get(key))) { recap = mh.get(key).intro; source = 'matthew-henry'; }
    else if (usable(clarke.get(key))) { recap = clarke.get(key).intro; source = 'adam-clarke'; }
    else if (editorial.has(key)) { const ed = editorial.get(key); recap = ed.recap; source = ed.source; }
    if (!recap) continue;
    ins.run(book, chapter, recap, source);
    bySource[source] = (bySource[source] || 0) + 1;
    count++;
  }
  db.exec('COMMIT');
  return { count, bySource };
}
