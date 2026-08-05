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

// The deuterocanon, stored as the KJVA version. Deliberately NOT in BOOKS: that list is the
// canonical 66 and drives every reader-facing index, chapter grid and book picker. These books are
// reachable only as the target of a Tyndale citation, so they need a display name and nothing else.
export const APOCRYPHA = [
  ['Tob', 'Tobit'], ['Jdt', 'Judith'], ['AddEsth', 'Additions to Esther'],
  ['Wis', 'Wisdom of Solomon'], ['Sir', 'Ecclesiasticus (Sirach)'], ['Bar', 'Baruch'],
  ['PrAzar', 'Prayer of Azariah'], ['Sus', 'Susanna'], ['Bel', 'Bel and the Dragon'],
  ['1Macc', '1 Maccabees'], ['2Macc', '2 Maccabees'], ['1Esd', '1 Esdras'],
  ['PrMan', 'Prayer of Manasseh'], ['2Esd', '2 Esdras'],
];

// Cited by Tyndale but NOT carried: the KJV Apocrypha, our only public-domain edition of the
// deuterocanon, never contained them. They still resolve, so the reader gets an explanation
// instead of a citation that silently does nothing.
export const APOCRYPHA_UNCARRIED = [
  ['3Macc', '3 Maccabees'], ['4Macc', '4 Maccabees'],
  ['ApocBar', 'Apocalypse of Baruch (2 Baruch)'],
];

const APOC = new Map(APOCRYPHA);
const APOC_NONE = new Map(APOCRYPHA_UNCARRIED);
export function isApocrypha(code) { return APOC.has(code) || APOC_NONE.has(code); }
// True when we hold text for the book. Drives the reference gate: a book we carry is checked
// verse-by-verse (so "Apoc Bar 14:13" cannot land in canonical Baruch), while a book we carry
// nothing of is allowed through precisely so the preview can say why it is empty.
export function apocryphaHasText(code) { return APOC.has(code); }

// What each book is, and whose Bible it is in. Shown under the verse in the preview box, because
// "1 Maccabees 16:11" means nothing to a reader raised on a 66-book Bible.
const DEUTERO = 'In Catholic and Eastern Orthodox Bibles, and in the Apocrypha section of the 1611 '
  + 'KJV; not in modern Protestant Bibles or the Hebrew Bible.';
const ORTHODOX = 'Not in Catholic or modern Protestant Bibles; carried by Orthodox traditions and '
  + 'printed as an appendix to the Latin Vulgate.';
export const APOCRYPHA_NOTE = {
  Tob: `Tobit, a tale of exile, blindness and marriage among the Jews of Assyria. ${DEUTERO}`,
  Jdt: `Judith, the story of a widow who saves her town by killing the Assyrian general Holofernes. ${DEUTERO}`,
  AddEsth: `The Greek Additions to Esther — six passages in the Septuagint's Esther that the Hebrew text lacks, numbered as chapters 11–16 after Jerome moved them to an appendix. ${DEUTERO}`,
  Wis: `The Wisdom of Solomon, a Greek work of Jewish wisdom writing. ${DEUTERO}`,
  Sir: `Ecclesiasticus, also called Sirach or Ben Sira — a book of wisdom teaching, and not the same book as Ecclesiastes. ${DEUTERO}`,
  Bar: `Baruch, attributed to Jeremiah's scribe. ${DEUTERO}`,
  PrAzar: `The Prayer of Azariah and the Song of the Three Young Men, an addition to Daniel 3. ${DEUTERO}`,
  Sus: `Susanna, an addition to Daniel in which the young Daniel exposes two false accusers. ${DEUTERO}`,
  Bel: `Bel and the Dragon, an addition to Daniel mocking Babylonian idol worship. ${DEUTERO}`,
  '1Macc': `1 Maccabees, a Jewish history of the revolt against Antiochus IV and the Seleucids in the 2nd century BC. ${DEUTERO}`,
  '2Macc': `2 Maccabees, a second account of the same revolt, condensed from a lost work by Jason of Cyrene. ${DEUTERO}`,
  '1Esd': `1 Esdras, a Greek retelling of material from Chronicles, Ezra and Nehemiah. ${ORTHODOX}`,
  '2Esd': `2 Esdras, also called 4 Ezra — an apocalypse written after the fall of Jerusalem in AD 70. ${ORTHODOX}`,
  PrMan: `The Prayer of Manasseh, a short penitential prayer put in the mouth of the king of 2 Chronicles 33. ${ORTHODOX}`,
  // carried nowhere in DeepVerse — these say what the book is AND why there is no text
  '3Macc': '3 Maccabees, which despite its name is about Ptolemy IV persecuting the Jews of Egypt, '
    + 'not the Maccabean revolt. Canonical in Eastern Orthodox churches only — not in modern '
    + 'Protestant or Catholic Bibles — and absent from the KJV Apocrypha, the public-domain edition '
    + 'DeepVerse carries, so there is no text to show.',
  '4Macc': '4 Maccabees, a philosophical essay on reason and martyrdom. In no modern Protestant or '
    + 'Catholic Bible, and canonical nowhere — it is printed in an appendix to the Greek Bible. '
    + 'Absent from the KJV Apocrypha, the public-domain edition DeepVerse carries, so there is no '
    + 'text to show.',
  ApocBar: 'The Apocalypse of Baruch, usually called 2 Baruch: a Jewish apocalypse written after '
    + 'the destruction of the Temple in AD 70 and attributed to Jeremiah\u2019s scribe. It is a '
    + 'different book from the Baruch of the Apocrypha. Not scripture for Jews or for most Christian '
    + 'churches — it survives in the Syriac Peshitta tradition — so DeepVerse carries no text for it.',
};

// Books DeepVerse names but never opens: their citations stay prose everywhere — not a jump (Study
// reads the 66), and not a preview either. The reader still gets APOCRYPHA_NOTE on hover, which is
// what those citations already explained; only the promise of text goes.
//
// Grown twice on 2026-08-05, first the Maccabees and the Apocalypse of Baruch, then Tobit, Judith
// and Sirach. 3 and 4 Maccabees and Apoc Bar are in no edition we hold at all; the other five are
// in the KJV Apocrypha, which no reader-facing list offers. Still not the whole deuterocanon —
// 1–2 Esdras, Baruch, the Additions to Esther and Bel keep their previews, 68 citations of them —
// so this list is a set of decisions, not a rule the data draws. Anything added here needs an
// APOCRYPHA_NOTE entry, which is the tooltip.
const UNREAD = new Set(['1Macc', '2Macc', '3Macc', '4Macc', 'ApocBar', 'Tob', 'Jdt', 'Sir']);
export function isUnreadBook(code) { return UNREAD.has(code); }

const NAME = new Map([...BOOKS, ...APOCRYPHA, ...APOCRYPHA_UNCARRIED].map(([code, name]) => [code, name]));
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

// ---- Searching memos by reference ----
// Distinct from parseReference above, which navigates: it resolves to ONE book and reads a bare
// book as chapter 1. Searching needs every book a query could mean and no defaulting, so it gets
// its own parser rather than bending the one the jump box depends on.

// Every book whose display name CONTAINS `text` — "psalm" finds Psalms, "ohn" finds John and the
// three numbered Johns. Spaces are significant and OSIS codes are never consulted, so "1 Cor"
// resolves and "1Cor" does not; "ps" and "gen" work only because they are containments of "Psalms"
// and "Genesis". No abbreviations: "jn" and "mt" match nothing.
export function matchBooks(text) {
  const q = String(text || '').trim().toLowerCase();
  if (!q) return [];
  return BOOKS.filter(([, name]) => name.toLowerCase().includes(q)).map(([code]) => code);
}

// Parse a filter query into the span it constrains: { books, chapter, verse, verseEnd }, where a
// null chapter or verse means UNCONSTRAINED ("john" is every John memo, not John 1). Returns null
// when no book matches, which is the caller's signal to fall back to plain text search.
export function parseRefQuery(input) {
  const raw = String(input || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!raw) return null;
  const m = raw.match(/^(.*?)\s*(\d+)(?::(\d+)(?:\s*-\s*(\d+))?)?\s*$/); // trailing "ch" or "ch:v[-v]"
  let bookText = raw, chapter = null, verse = null, verseEnd = null;
  // Requiring book text before the number keeps a leading numeral with its book: "1 john" is a
  // book, not chapter 1, and a bare "1" stays book text (every name containing "1").
  if (m && m[1].trim()) {
    bookText = m[1].trim();
    chapter = +m[2];
    verse = m[3] ? +m[3] : null;
    verseEnd = m[4] ? +m[4] : verse;
  }
  const books = matchBooks(bookText);
  return books.length ? { books, chapter, verse, verseEnd } : null;
}

// Does a memo's stored ref overlap the query span? Memo refs come in exactly three shapes, all
// built in NotesCard.svelte: "John.12" (chapter), "John.3.16" (verse), "John.3.16-18" (range,
// always inside one chapter).
export function refOverlaps(memoRef, query) {
  const [book, ch, v] = String(memoRef).split('.');
  if (!query.books.includes(book)) return false;
  if (query.chapter == null) return true;
  if (+ch !== query.chapter) return false;
  if (query.verse == null) return true;
  if (v == null) return true;                    // a chapter memo covers every verse in it
  const [lo, hi] = String(v).split('-');
  const start = +lo, end = hi ? +hi : +lo;
  return start <= query.verseEnd && end >= query.verse;   // spans intersect
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
