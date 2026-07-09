// OSIS book metadata: canonical order + display names. Book codes in bible.db are OSIS.
export const BOOKS = [
  ['Gen', 'Genesis'], ['Exod', 'Exodus'], ['Lev', 'Leviticus'], ['Num', 'Numbers'], ['Deut', 'Deuteronomy'],
  ['Josh', 'Joshua'], ['Judg', 'Judges'], ['Ruth', 'Ruth'], ['1Sam', '1 Samuel'], ['2Sam', '2 Samuel'],
  ['1Kgs', '1 Kings'], ['2Kgs', '2 Kings'], ['1Chr', '1 Chronicles'], ['2Chr', '2 Chronicles'], ['Ezra', 'Ezra'],
  ['Neh', 'Nehemiah'], ['Esth', 'Esther'], ['Job', 'Job'], ['Ps', 'Psalms'], ['Prov', 'Proverbs'],
  ['Eccl', 'Ecclesiastes'], ['Song', 'Song of Songs'], ['Isa', 'Isaiah'], ['Jer', 'Jeremiah'], ['Lam', 'Lamentations'],
  ['Ezek', 'Ezekiel'], ['Dan', 'Daniel'], ['Hos', 'Hosea'], ['Joel', 'Joel'], ['Amos', 'Amos'],
  ['Obad', 'Obadiah'], ['Jonah', 'Jonah'], ['Mic', 'Micah'], ['Nah', 'Nahum'], ['Hab', 'Habakkuk'],
  ['Zeph', 'Zephaniah'], ['Hag', 'Haggai'], ['Zech', 'Zechariah'], ['Mal', 'Malachi'],
  ['Matt', 'Matthew'], ['Mark', 'Mark'], ['Luke', 'Luke'], ['John', 'John'], ['Acts', 'Acts'],
  ['Rom', 'Romans'], ['1Cor', '1 Corinthians'], ['2Cor', '2 Corinthians'], ['Gal', 'Galatians'], ['Eph', 'Ephesians'],
  ['Phil', 'Philippians'], ['Col', 'Colossians'], ['1Thess', '1 Thessalonians'], ['2Thess', '2 Thessalonians'],
  ['1Tim', '1 Timothy'], ['2Tim', '2 Timothy'], ['Titus', 'Titus'], ['Phlm', 'Philemon'], ['Heb', 'Hebrews'],
  ['Jas', 'James'], ['1Pet', '1 Peter'], ['2Pet', '2 Peter'], ['1John', '1 John'], ['2John', '2 John'],
  ['3John', '3 John'], ['Jude', 'Jude'], ['Rev', 'Revelation'],
];

const NAME = new Map(BOOKS.map(([code, name]) => [code, name]));
const ORDER = new Map(BOOKS.map(([code], i) => [code, i]));

// Parse a free-form reference ("John 3:16", "1 John 2", "Ps 23", "gen 1:1", "Genesis") into
// { book: OSIS code, chapter, verse|null }, or null if the book can't be matched. Book is matched by
// OSIS code or display name (spaces ignored), exact first then prefix ("gen" -> Genesis, "1jo" -> 1 John).
export function parseReference(input) {
  const raw = String(input || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!raw) return null;
  const m = raw.match(/^(.*?)\s*(\d+)(?::(\d+))?\s*$/); // trailing "chapter" or "chapter:verse"
  let bookText, chapter, verse;
  if (m && m[1].trim()) { bookText = m[1].trim(); chapter = +m[2]; verse = m[3] ? +m[3] : null; }
  else { bookText = raw; chapter = 1; verse = null; } // book only -> chapter 1
  const key = bookText.replace(/\s+/g, '');
  const nn = ([, name]) => name.toLowerCase().replace(/\s+/g, '');
  let hit = BOOKS.find(([c]) => c.toLowerCase() === key) || BOOKS.find(b => nn(b) === key)
    || BOOKS.find(([c]) => c.toLowerCase().startsWith(key)) || BOOKS.find(b => nn(b).startsWith(key));
  if (!hit) return null;
  return { book: hit[0], chapter: Math.max(1, chapter), verse };
}

export function bookName(code) { return NAME.get(code) || code; }
// Compact label for headers: keep the short code but space a leading numeral ("1Cor" -> "1 Cor").
export function bookShort(code) { return String(code || '').replace(/^([1-3])(?=[A-Za-z])/, '$1 '); }
export function bookOrder(code) { return ORDER.has(code) ? ORDER.get(code) : 999; }

// Format an OSIS ref like "John.12.25" for display: "John 12:25". Handles chapter-only "John.12".
export function formatRef(ref) {
  const [book, ch, v] = String(ref).split('.');
  const name = bookName(book);
  if (v == null) return ch == null ? name : `${name} ${ch}`;
  return `${name} ${ch}:${v}`;
}

// A cross-reference target may be a range ("Luke.9.23-Luke.9.27"); render the explicit span
// ("Luke 9:23–27") rather than an abbreviation.
export function formatCrossRef(toRef) {
  const [a, b] = String(toRef).split('-');
  if (!b) return formatRef(a);
  const [ab, ac] = a.split('.');
  const [bb, bc, bv] = b.split('.');
  if (ab === bb && ac === bc) return `${formatRef(a)}–${bv}`;   // same chapter
  if (ab === bb) return `${formatRef(a)}–${bc}:${bv}`;          // same book, spans chapters
  return `${formatRef(a)}–${formatRef(b)}`;                     // spans books
}
