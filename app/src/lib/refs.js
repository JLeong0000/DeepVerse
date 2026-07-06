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

export function bookName(code) { return NAME.get(code) || code; }
export function bookOrder(code) { return ORDER.has(code) ? ORDER.get(code) : 999; }

// Format an OSIS ref like "John.12.25" for display: "John 12:25". Handles chapter-only "John.12".
export function formatRef(ref) {
  const [book, ch, v] = String(ref).split('.');
  const name = bookName(book);
  if (v == null) return ch == null ? name : `${name} ${ch}`;
  return `${name} ${ch}:${v}`;
}
