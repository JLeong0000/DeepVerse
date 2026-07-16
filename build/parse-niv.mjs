// Parse the NIV PDF into per-book JSON keyed by "chapter:verse".
// Structure (discovered via font size):
//   [~24] line == book title (exact book name)  OR  chapter opening ("26Now there...")
//   [~6.5] line == a verse-number superscript (pure digits)
//   [~10] line == body text, appended to the current verse
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'node:fs';

const PDF = '../backup-data/bibles-licensed/NIV-New-International-Version.pdf';
const OUT = '../data/bibles/NIV';
fs.mkdirSync(OUT, { recursive: true });

// canonical normalized-name -> [osis, display]
const CANON = {
  genesis:['Gen','Genesis'], exodus:['Exod','Exodus'], leviticus:['Lev','Leviticus'], numbers:['Num','Numbers'],
  deuteronomy:['Deut','Deuteronomy'], joshua:['Josh','Joshua'], judges:['Judg','Judges'], ruth:['Ruth','Ruth'],
  '1samuel':['1Sam','1 Samuel'], '2samuel':['2Sam','2 Samuel'], '1kings':['1Kgs','1 Kings'], '2kings':['2Kgs','2 Kings'],
  '1chronicles':['1Chr','1 Chronicles'], '2chronicles':['2Chr','2 Chronicles'], ezra:['Ezra','Ezra'], nehemiah:['Neh','Nehemiah'],
  esther:['Esth','Esther'], job:['Job','Job'], psalms:['Ps','Psalms'], proverbs:['Prov','Proverbs'],
  ecclesiastes:['Eccl','Ecclesiastes'], songofsolomon:['Song','Song of Solomon'], isaiah:['Isa','Isaiah'], jeremiah:['Jer','Jeremiah'],
  lamentations:['Lam','Lamentations'], ezekiel:['Ezek','Ezekiel'], daniel:['Dan','Daniel'], hosea:['Hos','Hosea'],
  joel:['Joel','Joel'], amos:['Amos','Amos'], obadiah:['Obad','Obadiah'], jonah:['Jonah','Jonah'],
  micah:['Mic','Micah'], nahum:['Nah','Nahum'], habakkuk:['Hab','Habakkuk'], zephaniah:['Zeph','Zephaniah'],
  haggai:['Hag','Haggai'], zechariah:['Zech','Zechariah'], malachi:['Mal','Malachi'], matthew:['Matt','Matthew'],
  mark:['Mark','Mark'], luke:['Luke','Luke'], john:['John','John'], acts:['Acts','Acts'],
  romans:['Rom','Romans'], '1corinthians':['1Cor','1 Corinthians'], '2corinthians':['2Cor','2 Corinthians'], galatians:['Gal','Galatians'],
  ephesians:['Eph','Ephesians'], philippians:['Phil','Philippians'], colossians:['Col','Colossians'], '1thessalonians':['1Thess','1 Thessalonians'],
  '2thessalonians':['2Thess','2 Thessalonians'], '1timothy':['1Tim','1 Timothy'], '2timothy':['2Tim','2 Timothy'], titus:['Titus','Titus'],
  philemon:['Phlm','Philemon'], hebrews:['Heb','Hebrews'], james:['Jas','James'], '1peter':['1Pet','1 Peter'],
  '2peter':['2Pet','2 Peter'], '1john':['1John','1 John'], '2john':['2John','2 John'], '3john':['3John','3 John'],
  jude:['Jude','Jude'], revelation:['Rev','Revelation'],
};
const norm = s => s.toLowerCase().replace(/1st|2nd|3rd/g, m => ({ '1st':'1','2nd':'2','3rd':'3' }[m])).replace(/[^a-z0-9]/g, '');

const doc = await getDocument({ data: new Uint8Array(fs.readFileSync(PDF)), useSystemFonts: true }).promise;

const bible = {};
let curBook = null, curCh = null, curVs = null;
const set = (t) => {
  if (!curBook || !curCh || curVs == null) return;
  bible[curBook].chapters[curCh] ??= {};
  bible[curBook].chapters[curCh][curVs] = (bible[curBook].chapters[curCh][curVs] || '') + t;
};
const append = (t) => {
  if (!curBook || !curCh || curVs == null) return;
  const c = bible[curBook].chapters[curCh];
  if (c[curVs] && !c[curVs].endsWith(' ')) c[curVs] += ' ';
  c[curVs] = (c[curVs] || '') + t;
};

for (let p = 1; p <= doc.numPages; p++) {
  const items = (await (await doc.getPage(p)).getTextContent()).items;
  let line = '', lastY = null, maxSize = 0;
  const lines = [];
  const flush = () => { if (line.trim()) lines.push([maxSize, line.trim()]); line = ''; maxSize = 0; };
  for (const it of items) {
    const y = it.transform[5];
    const size = Math.abs(it.transform[0]);
    if (lastY !== null && Math.abs(y - lastY) > 2) flush();
    line += it.str; maxSize = Math.max(maxSize, size); lastY = y;
  }
  flush();

  for (const [size, text] of lines) {
    const pm = text.match(/^PSALMS?\s+(\d+)$/i);    // Psalms use "PSALM N" (font ~12) headings
    if (pm && curBook === 'Ps') { curCh = pm[1]; curVs = null; continue; }

    if (size >= 18) {                              // heading: book title or chapter open
      const key = norm(text);
      if (CANON[key]) {                            // exact book-name match -> title
        const [osis, name] = CANON[key];
        bible[osis] ??= { name, chapters: {}, titles: {} };
        curBook = osis; curCh = null; curVs = null;
      } else {                                     // chapter opening: "26Now there..."
        const m = text.match(/^(\d+)\s*(.*)$/);
        if (m && curBook) { curCh = m[1]; curVs = '1'; set(m[2]); }
      }
    } else if (size <= 8 && /^\d+$/.test(text)) {   // verse-number superscript
      curVs = text; set('');
    } else if (curVs == null && curBook && curCh) { // psalm superscription before verse 1
      bible[curBook].titles ??= {};
      bible[curBook].titles[curCh] = ((bible[curBook].titles[curCh] || '') + ' ' + text).trim();
    } else {                                        // body text
      append(text);
    }
  }
}

let total = 0; const manifest = [];
for (const osis of Object.keys(bible)) {
  const b = bible[osis];
  // tidy: collapse spaces, fix hyphenation artifacts
  for (const ch of Object.values(b.chapters))
    for (const v of Object.keys(ch)) ch[v] = ch[v].replace(/\s+/g, ' ').replace(/- /g, '').trim();
  const vc = Object.values(b.chapters).reduce((n, ch) => n + Object.keys(ch).length, 0);
  total += vc;
  manifest.push({ osis, name: b.name, chapters: Object.keys(b.chapters).length, verses: vc });
  fs.writeFileSync(`${OUT}/${osis}.json`, JSON.stringify(b));
}
fs.writeFileSync(`${OUT}/_manifest.json`, JSON.stringify({ version: 'NIV', books: manifest }, null, 2));

console.log(`books: ${Object.keys(bible).length}   total verses: ${total}`);
const show = (o,c,v)=>console.log(`${o} ${c}:${v} -> ${bible[o]?.chapters[c]?.[v]?.slice(0,90)}`);
show('Gen','1','1'); show('John','3','16'); show('Ps','23','1'); show('Rev','22','21');
