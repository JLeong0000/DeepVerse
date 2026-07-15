// Parse the NKJV PDF into per-book JSON keyed by "chapter:verse".
// Typography (discovered):
//   running header (top line): "<pg> GENESIS 29:33"     -> current book
//   book-intro page: title "GENESIS" ~13.5, editorial drop-cap ~21.2 (IGNORE)
//   chapter drop-cap ~16.8: DIGITS = chapter n (ch >=2); LETTER = chapter opener (ch 1),
//                           letter is the first char of verse 1 and must glue to next text
//   Psalms: "PSALM n" heading (~7.5) sets the chapter; letter drop-cap starts verse 1
//   verse number: leading integer at body size (7.5)
//   body text: the global dominant font (~7.5)
//   footnotes ~6.1 and cross-ref/footnote markers ~4.7: DROP by size (<7)
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'node:fs';

const PDF = '../sources/bibles-licensed/NKJV-New-King-James-Version.pdf';
const OUT = '../data/bibles/NKJV';
fs.mkdirSync(OUT, { recursive: true });

const CANON = {
  genesis:['Gen','Genesis'], exodus:['Exod','Exodus'], leviticus:['Lev','Leviticus'], numbers:['Num','Numbers'],
  deuteronomy:['Deut','Deuteronomy'], joshua:['Josh','Joshua'], judges:['Judg','Judges'], ruth:['Ruth','Ruth'],
  '1samuel':['1Sam','1 Samuel'], '2samuel':['2Sam','2 Samuel'], '1kings':['1Kgs','1 Kings'], '2kings':['2Kgs','2 Kings'],
  '1chronicles':['1Chr','1 Chronicles'], '2chronicles':['2Chr','2 Chronicles'], ezra:['Ezra','Ezra'], nehemiah:['Neh','Nehemiah'],
  esther:['Esth','Esther'], job:['Job','Job'], psalm:['Ps','Psalms'], psalms:['Ps','Psalms'], proverbs:['Prov','Proverbs'],
  ecclesiastes:['Eccl','Ecclesiastes'], songofsolomon:['Song','Song of Solomon'], songofsongs:['Song','Song of Solomon'],
  isaiah:['Isa','Isaiah'], jeremiah:['Jer','Jeremiah'], lamentations:['Lam','Lamentations'], ezekiel:['Ezek','Ezekiel'],
  daniel:['Dan','Daniel'], hosea:['Hos','Hosea'], joel:['Joel','Joel'], amos:['Amos','Amos'], obadiah:['Obad','Obadiah'],
  jonah:['Jonah','Jonah'], micah:['Mic','Micah'], nahum:['Nah','Nahum'], habakkuk:['Hab','Habakkuk'], zephaniah:['Zeph','Zephaniah'],
  haggai:['Hag','Haggai'], zechariah:['Zech','Zechariah'], malachi:['Mal','Malachi'], matthew:['Matt','Matthew'],
  mark:['Mark','Mark'], luke:['Luke','Luke'], john:['John','John'], acts:['Acts','Acts'], romans:['Rom','Romans'],
  '1corinthians':['1Cor','1 Corinthians'], '2corinthians':['2Cor','2 Corinthians'], galatians:['Gal','Galatians'],
  ephesians:['Eph','Ephesians'], philippians:['Phil','Philippians'], colossians:['Col','Colossians'],
  '1thessalonians':['1Thess','1 Thessalonians'], '2thessalonians':['2Thess','2 Thessalonians'], '1timothy':['1Tim','1 Timothy'],
  '2timothy':['2Tim','2 Timothy'], titus:['Titus','Titus'], philemon:['Phlm','Philemon'], hebrews:['Heb','Hebrews'],
  james:['Jas','James'], '1peter':['1Pet','1 Peter'], '2peter':['2Pet','2 Peter'], '1john':['1John','1 John'],
  '2john':['2John','2 John'], '3john':['3John','3 John'], jude:['Jude','Jude'], revelation:['Rev','Revelation'],
};
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const HEADER = /(?:\b([123])\s+)?([A-Z]{2,}(?:\s+[A-Z]{2,})*)\s+\d+(?::\d+)?/;

const doc = await getDocument({ data: new Uint8Array(fs.readFileSync(PDF)), useSystemFonts: true }).promise;
const N = doc.numPages;

// group page items into visual lines with token metadata, cached to avoid double fetch
async function pageLines(p) {
  const items = (await (await doc.getPage(p)).getTextContent()).items;
  const lines = []; let lastY = null, buf = [];
  const push = () => { if (buf.length) lines.push(buf); buf = []; };
  for (const it of items) {
    const y = it.transform[5];
    if (lastY !== null && Math.abs(y - lastY) > 2) push();
    buf.push({ str: it.str, sz: Math.abs(it.transform[0]), font: it.fontName, x: it.transform[4], w: it.width || 0 });
    lastY = y;
  }
  push();
  return lines;
}

// Reconstruct a line's text, inserting a space where there's a positional gap
// between two word tokens (the PDF sometimes emits no space token).
function joinToks(toks) {
  let out = '';
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (i > 0) {
      const prev = toks[i - 1];
      const gap = t.x - (prev.x + prev.w);
      if (/\S$/.test(prev.str) && /^\S/.test(t.str) && gap > t.sz * 0.18) out += ' ';
    }
    out += t.str;
  }
  return out;
}

// Identify the book a page ANNOUNCES from its title masthead (band 11-16), combined
// with the "The First/Second/Third Book|Epistle of ..." intro line so numbered books
// (whose title renders as a bare "SAMUEL"/"KINGS") disambiguate. A title only appears
// on a book's own first page, so this is where a new book is announced; the running
// header is not used (on a transition page it can still name the previous book).
const ORD = { first: '1', second: '2', third: '3' };
function pageBookOf(lines) {
  let title = '', ord = '';
  for (const ln of lines) {
    if (!title) {
      const tt = ln.filter(t => t.sz >= 11 && t.sz < 16 && /[A-Za-z]/.test(t.str));
      if (tt.length) title = norm(tt.map(t => t.str).join(''));
    }
    if (!ord) {   // the intro line, e.g. "The Second Book of Samuel" / "The First Epistle of John"
      const m = ln.map(t => t.str).join('').match(/\bThe\s+(First|Second|Third)\s+(?:Book|Epistle|Letter)\b/i);
      if (m) ord = ORD[m[1].toLowerCase()];
    }
  }
  if (!title) return null;
  const bare = title.startsWith('the') ? title.slice(3) : title;   // "THE REVELATION" -> revelation
  return CANON[ord + title] || CANON[title] || CANON[ord + bare] || CANON[bare] || null;
}

const bible = {};
let curBook = null, curCh = null, curVs = null, glue = false;
const setBook = ([osis, name]) => {
  bible[osis] ??= { name, chapters: {} };
  if (osis !== curBook) { curBook = osis; curCh = null; curVs = null; glue = false; }
};
const startVerse = (t) => { const c = (bible[curBook].chapters[curCh] ??= {}); c[curVs] = t; };
const append = (t) => {
  if (!curBook || !curCh || curVs == null || !t) return;
  const c = (bible[curBook].chapters[curCh] ??= {});
  if (glue) { c[curVs] = (c[curVs] || '') + t; glue = false; }
  else c[curVs] = c[curVs] ? c[curVs] + ' ' + t : t;
};

const announced = [];   // books seen by title but not yet reached in the body (FIFO)

for (let p = 1; p <= N; p++) {
  const lines = await pageLines(p);
  if (!lines.length) continue;

  // per-page body font: dominant face among tight scripture-size band (~7.5),
  // excluding intro text (~8) so book-intro pages still resolve to the scripture font
  const ff = {};
  for (const ln of lines) for (const t of ln)
    if (t.sz >= 7.2 && t.sz <= 7.8 && t.str.trim()) ff[t.font] = (ff[t.font] || 0) + t.str.length;
  const bodyFont = Object.entries(ff).sort((a, b) => b[1] - a[1])[0]?.[0];

  // Queue this page's announced book (if new). The book is NOT switched here: the
  // announcement (title/intro) can appear a page or two before the body begins, and a
  // transition page's top still belongs to the previous book. curBook advances only
  // when the announced book's body actually starts (its chapter-1 drop-cap / PSALM 1).
  const pageBook = pageBookOf(lines);
  if (pageBook && pageBook[0] !== curBook &&
      (!announced.length || announced[announced.length - 1][0] !== pageBook[0])) announced.push(pageBook);
  if (!curBook && announced.length) setBook(announced.shift());   // establish the first book (Genesis)

  // line 0 is the running header on ordinary pages (skip it); on a book-intro page it
  // can instead be the chapter-1 drop-cap or the title, so keep it when it isn't a header.
  const isHeader0 = !!lines[0].map(t => t.str).join('').replace(/\s+/g, ' ').trim().match(HEADER);
  for (let i = 0; i < lines.length; i++) {
    if (i === 0 && isHeader0) continue;
    const raw = lines[i];
    // skip book-intro furniture: title (11-16), editorial intro paragraphs (~8),
    // and the editorial intro drop-cap (>=20) — none of which are scripture body.
    if (raw.some(t => t.str.trim() && ((t.sz > 7.8 && t.sz < 14) || t.sz >= 20)) &&
        !raw.some(t => t.sz >= 14 && t.sz < 20)) continue;
    const toks = raw.filter(t => t.sz >= 7 || !t.str.trim()); // drop footnotes/markers (<7) but KEEP spaces
    if (!toks.length) continue;
    const text = joinToks(toks).replace(/\s+/g, ' ').trim();
    if (!text) continue;
    if (!curBook) continue;                          // ignore front matter before Genesis

    // Psalms chapter heading "PSALM n" (also the switch point into the book of Psalms)
    const pm = text.match(/^PSALMS?\s+(\d+)$/i);
    if (pm && (curBook === 'Ps' || (announced.length && announced[0][0] === 'Ps'))) {
      if (curBook !== 'Ps') setBook(announced.shift());
      curCh = pm[1]; curVs = null; glue = false; continue;
    }

    // chapter drop-cap (band 14-20)
    if (toks.some(t => t.sz >= 14 && t.sz < 20)) {
      if (/\d/.test(text)) {                         // numbered chapter (>=2) of the current book
        const d = text.match(/\d+/)[0];
        curCh = d; curVs = '1'; glue = false;
        const rest = text.slice(text.indexOf(d) + d.length).trim();
        startVerse(''); if (rest) append(rest);
      } else {                                        // letter drop-cap = chapter-1 opener
        // In Psalms every psalm's verse 1 also has a letter drop-cap (right after its
        // "PSALM n" heading, so curVs is null) — that must NOT consume the next book.
        const psalmOpener = curBook === 'Ps' && curVs == null;
        if (announced.length && !psalmOpener) { setBook(announced.shift()); curCh = '1'; }
        else if (curCh == null) curCh = '1';
        curVs = '1'; startVerse(text); glue = true;   // glue letter to next line
      }
      continue;
    }

    // section-heading skip: non-body font, no leading verse number
    const lf = {};
    for (const t of toks) if (t.str.trim()) lf[t.font] = (lf[t.font] || 0) + t.str.length;
    const dom = Object.entries(lf).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (dom && dom !== bodyFont && !/^\d+\s/.test(text) && !/^\d+$/.test(text)) continue;

    // verse content
    const vm = text.match(/^(\d+)\s+(.*)$/);
    if (vm && Number(vm[1]) <= 200) { curVs = vm[1]; glue = false; startVerse(''); append(vm[2]); }
    else if (/^\d+$/.test(text) && Number(text) <= 200) { curVs = text; glue = false; startVerse(''); }
    else append(text);
  }
}

// single-chapter books: fold any stray mis-detected chapter into chapter 1
for (const o of ['Obad', 'Phlm', '2John', '3John', 'Jude']) {
  const b = bible[o]; if (!b) continue;
  b.chapters['1'] ??= {};
  for (const c of Object.keys(b.chapters)) if (c !== '1') {
    for (const [v, t] of Object.entries(b.chapters[c])) b.chapters['1'][v] ??= t;
    delete b.chapters[c];
  }
}

// Ps 119:100: the PDF emits this one verse number as a detached, out-of-reading-order
// text item, so v100's text was appended to v99 and v100 came out empty. Split them
// back apart at the sentence boundary. Guarded, so it no-ops if the upstream ever changes.
{
  const c = bible['Ps']?.chapters['119'];
  const sep = ' I understand more than the ancients,';
  if (c && !c['100']?.trim() && (c['99'] || '').includes(sep)) {
    const [v99, v100] = c['99'].split(new RegExp(`(?=${sep})`));
    c['99'] = v99.trim();
    c['100'] = v100.trim();
  }
}

let total = 0; const manifest = [];
for (const osis of Object.keys(bible)) {
  const b = bible[osis];
  for (const ch of Object.values(b.chapters))
    for (const v of Object.keys(ch)) ch[v] = ch[v]
      .replace(/(\w)-\s+(\w)/g, '$1$2')       // rejoin line-break hyphenation ("acknowl- edgment")
      .replace(/\b[1-9](?=[a-z])/g, '')       // strip fused footnote numbers before a word ("1want"->"want")
      .replace(/([a-z])[1-9](?=\s|[.,;:!?”")’]|$)/g, '$1') // strip fused footnote numbers after a word ("wounded1")
      .replace(/\s+/g, ' ').trim();
  const vc = Object.values(b.chapters).reduce((n, ch) => n + Object.keys(ch).length, 0);
  total += vc;
  manifest.push({ osis, name: b.name, chapters: Object.keys(b.chapters).length, verses: vc });
  fs.writeFileSync(`${OUT}/${osis}.json`, JSON.stringify(b));
}
fs.writeFileSync(`${OUT}/_manifest.json`, JSON.stringify({ version: 'NKJV', books: manifest }, null, 2));

console.log(`books: ${Object.keys(bible).length}   total verses: ${total}`);
const show = (o,c,v)=>console.log(`${o} ${c}:${v} -> ${bible[o]?.chapters[c]?.[v]?.slice(0,92)}`);
show('Gen','1','1'); show('John','3','16'); show('Ps','23','1'); show('Obad','1','1'); show('Mark','16','9'); show('Rev','22','21');
