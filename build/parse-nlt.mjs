// Parse the NLT PDF into per-book JSON keyed by "chapter:verse".
// Format is verse-per-line, ref-prefixed, with wrapped continuation lines.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'node:fs';

const PDF = '../sources/bibles-licensed/NLT-New-Living-Translation.pdf';
const OUT = '../data/bibles/NLT';
fs.mkdirSync(OUT, { recursive: true });

// NLT 3-letter token -> OSIS book id + display name (canonical 66).
const BOOKS = {
  Gen:['Gen','Genesis'], Exo:['Exod','Exodus'], Lev:['Lev','Leviticus'], Num:['Num','Numbers'],
  Deu:['Deut','Deuteronomy'], Jos:['Josh','Joshua'], Jdg:['Judg','Judges'], Rut:['Ruth','Ruth'],
  '1Sa':['1Sam','1 Samuel'], '2Sa':['2Sam','2 Samuel'], '1Ki':['1Kgs','1 Kings'], '2Ki':['2Kgs','2 Kings'],
  '1Ch':['1Chr','1 Chronicles'], '2Ch':['2Chr','2 Chronicles'], Ezr:['Ezra','Ezra'], Neh:['Neh','Nehemiah'],
  Est:['Esth','Esther'], Job:['Job','Job'], Psa:['Ps','Psalms'], Pro:['Prov','Proverbs'],
  Ecc:['Eccl','Ecclesiastes'], Sol:['Song','Song of Songs'], Isa:['Isa','Isaiah'], Jer:['Jer','Jeremiah'],
  Lam:['Lam','Lamentations'], Eze:['Ezek','Ezekiel'], Dan:['Dan','Daniel'], Hos:['Hos','Hosea'],
  Joe:['Joel','Joel'], Amo:['Amos','Amos'], Oba:['Obad','Obadiah'], Jon:['Jonah','Jonah'],
  Mic:['Mic','Micah'], Nah:['Nah','Nahum'], Hab:['Hab','Habakkuk'], Zep:['Zeph','Zephaniah'],
  Hag:['Hag','Haggai'], Zec:['Zech','Zechariah'], Mal:['Mal','Malachi'], Mat:['Matt','Matthew'],
  Mar:['Mark','Mark'], Luk:['Luke','Luke'], Joh:['John','John'], Act:['Acts','Acts'],
  Rom:['Rom','Romans'], '1Co':['1Cor','1 Corinthians'], '2Co':['2Cor','2 Corinthians'], Gal:['Gal','Galatians'],
  Eph:['Eph','Ephesians'], Phi:['Phil','Philippians'], Col:['Col','Colossians'], '1Th':['1Thess','1 Thessalonians'],
  '2Th':['2Thess','2 Thessalonians'], '1Ti':['1Tim','1 Timothy'], '2Ti':['2Tim','2 Timothy'], Tit:['Titus','Titus'],
  Phm:['Phlm','Philemon'], Heb:['Heb','Hebrews'], Jam:['Jas','James'], '1Pe':['1Pet','1 Peter'],
  '2Pe':['2Pet','2 Peter'], '1Jo':['1John','1 John'], '2Jo':['2John','2 John'], '3Jo':['3John','3 John'],
  Jud:['Jude','Jude'], Rev:['Rev','Revelation'],
};

const data = new Uint8Array(fs.readFileSync(PDF));
const doc = await getDocument({ data, useSystemFonts: true }).promise;
const VERSE = /^([1-3]?[A-Z][A-Za-z]+)\.?\s+(\d+):(\d+)\s+(.*)$/;

const bible = {}; // osis -> { ch -> { vs -> text } }
let cur = null;    // current verse pointer for appending wrapped lines

for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const items = (await page.getTextContent()).items;
  let line = '', lastY = null;
  const flush = () => {
    const ln = line.trim(); line = '';
    if (!ln) return;
    const m = ln.match(VERSE);
    if (m && BOOKS[m[1]]) {
      const [osis, name] = BOOKS[m[1]];
      const ch = m[2], vs = m[3];
      bible[osis] ??= { name, chapters: {} };
      bible[osis].chapters[ch] ??= {};
      bible[osis].chapters[ch][vs] = m[4].trim();
      cur = { osis, ch, vs };
    } else if (cur) {
      // wrapped continuation of the current verse
      bible[cur.osis].chapters[cur.ch][cur.vs] += ' ' + ln;
    }
  };
  for (const it of items) {
    const y = it.transform[5];
    if (lastY !== null && Math.abs(y - lastY) > 2) flush();
    line += it.str; lastY = y;
  }
  flush();
}

// Write per-book files + a manifest, and tally.
let totalVerses = 0;
const manifest = [];
for (const osis of Object.keys(bible)) {
  const b = bible[osis];
  const vcount = Object.values(b.chapters).reduce((n, ch) => n + Object.keys(ch).length, 0);
  totalVerses += vcount;
  manifest.push({ osis, name: b.name, chapters: Object.keys(b.chapters).length, verses: vcount });
  fs.writeFileSync(`${OUT}/${osis}.json`, JSON.stringify(b));
}
fs.writeFileSync(`${OUT}/_manifest.json`, JSON.stringify({ version: 'NLT', books: manifest }, null, 2));

console.log(`books written: ${Object.keys(bible).length}`);
console.log(`total verses: ${totalVerses}`);
console.log(`Gen 1:1  -> ${bible.Gen.chapters['1']['1']}`);
console.log(`John 3:16 -> ${bible.John.chapters['3']['16']}`);
console.log(`Ps 23:1  -> ${bible.Ps.chapters['23']['1']}`);
console.log(`Rev 22:21 -> ${bible.Rev.chapters['22']['21']}`);
