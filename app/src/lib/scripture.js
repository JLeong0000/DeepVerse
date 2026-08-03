// Turns the scripture references inside Tyndale prose into linkable spans.
import { isApocrypha } from './refs.js';
//
// Tyndale's display text mixes three abbreviation systems in the same sentence — its own compact
// forms ("Gn", "Mt", "1 Sm"), standard ones ("Gen", "Matt", "1Sam") and full names ("Genesis") —
// and separates a numbered book from its name with a NON-BREAKING space.
//
// Matching is an EXACT allowlist, never a prefix match, and that is load-bearing:
//   · "Ecclus" is Ecclesiasticus (apocryphal, absent from the corpus) and must not resolve as
//     Ecclesiastes; likewise "Jdt" (Judith) must not resolve as Jude.
//   · "In" occurs 48 times in the corpus as an ordinary English word ahead of a bare "1:1", so any
//     loose rule turns sentence openings into links to nowhere.
// A token that is not a key here simply stays plain text.
const REF_BOOKS = {
  Gn: 'Gen', Gen: 'Gen', Genesis: 'Gen',
  Ex: 'Exod', Exod: 'Exod', Exodus: 'Exod',
  Lv: 'Lev', Lev: 'Lev', Leviticus: 'Lev',
  Nm: 'Num', Num: 'Num', Numbers: 'Num',
  Dt: 'Deut', Deut: 'Deut', Deuteronomy: 'Deut',
  Jos: 'Josh', Josh: 'Josh', Joshua: 'Josh',
  Jgs: 'Judg', Judg: 'Judg', Judges: 'Judg',
  Ru: 'Ruth', Ruth: 'Ruth',
  '1Sm': '1Sam', '1Sam': '1Sam', '1Samuel': '1Sam',
  '2Sm': '2Sam', '2Sam': '2Sam', '2Samuel': '2Sam',
  '1Kgs': '1Kgs', '1Kings': '1Kgs', '2Kgs': '2Kgs', '2Kings': '2Kgs',
  '1Chr': '1Chr', '1Chronicles': '1Chr', '2Chr': '2Chr', '2Chronicles': '2Chr',
  Ezr: 'Ezra', Ezra: 'Ezra',
  Neh: 'Neh', Nehemiah: 'Neh',
  Est: 'Esth', Esth: 'Esth', Esther: 'Esth',
  Jb: 'Job', Job: 'Job',
  Ps: 'Ps', Pss: 'Ps', Psalm: 'Ps', Psalms: 'Ps',
  Prv: 'Prov', Prov: 'Prov', Proverbs: 'Prov',
  Eccl: 'Eccl', Ecclesiastes: 'Eccl',
  Sg: 'Song', Song: 'Song', Songs: 'Song',
  Is: 'Isa', Isa: 'Isa', Isaiah: 'Isa',
  Jer: 'Jer', Jeremiah: 'Jer',
  Lam: 'Lam', Lamentations: 'Lam',
  Ez: 'Ezek', Ezek: 'Ezek', Ezekiel: 'Ezek',   // Tyndale uses Ezr for Ezra, so Ez is Ezekiel
  Dn: 'Dan', Dan: 'Dan', Daniel: 'Dan',
  Hos: 'Hos', Hosea: 'Hos',
  Jl: 'Joel', Joel: 'Joel',
  Am: 'Amos', Amos: 'Amos',
  Ob: 'Obad', Obad: 'Obad', Obadiah: 'Obad',
  Jon: 'Jonah', Jonah: 'Jonah',
  Mi: 'Mic', Mic: 'Mic', Micah: 'Mic',
  Na: 'Nah', Nah: 'Nah', Nahum: 'Nah',
  Hb: 'Hab', Hab: 'Hab', Habakkuk: 'Hab',
  Zep: 'Zeph', Zeph: 'Zeph', Zephaniah: 'Zeph',
  Hg: 'Hag', Hag: 'Hag', Haggai: 'Hag',
  Zec: 'Zech', Zech: 'Zech', Zechariah: 'Zech',
  Mal: 'Mal', Malachi: 'Mal',
  Mt: 'Matt', Matt: 'Matt', Matthew: 'Matt',
  Mk: 'Mark', Mark: 'Mark',
  Lk: 'Luke', Luke: 'Luke',
  Jn: 'John', John: 'John',
  Acts: 'Acts',
  Rom: 'Rom', Romans: 'Rom',
  '1Cor': '1Cor', '1Corinthians': '1Cor', '2Cor': '2Cor', '2Corinthians': '2Cor',
  Gal: 'Gal', Galatians: 'Gal',
  Eph: 'Eph', Ephesians: 'Eph',
  Phil: 'Phil', Philippians: 'Phil',
  Col: 'Col', Colossians: 'Col',
  '1Thes': '1Thess', '1Thess': '1Thess', '2Thes': '2Thess', '2Thess': '2Thess',
  '1Tm': '1Tim', '1Tim': '1Tim', '1Timothy': '1Tim',
  '2Tm': '2Tim', '2Tim': '2Tim', '2Timothy': '2Tim',
  Ti: 'Titus', Titus: 'Titus',
  Phlm: 'Phlm', Philemon: 'Phlm',
  Heb: 'Heb', Hebrews: 'Heb',
  Jas: 'Jas', James: 'Jas',
  '1Pt': '1Pet', '1Pet': '1Pet', '1Peter': '1Pet',
  '2Pt': '2Pet', '2Pet': '2Pet', '2Peter': '2Pet',
  '1Jn': '1John', '1John': '1John',
  '2Jn': '2John', '2John': '2John',
  '3Jn': '3John', '3John': '3John',
  Jude: 'Jude',
  Rv: 'Rev', Rev: 'Rev', Revelation: 'Rev',

  // The deuterocanon, stored as the KJVA version. Tyndale cites it 648 times and marks every such
  // link class="apocrypha"; before these entries existed the citations stayed plain text, because
  // no translation DeepVerse carried had a word of it.
  //
  // "Ecclus" is Ecclesiasticus and must never collapse into Ecclesiastes; "Jdt" is Judith, not
  // Jude. Both are called out as traps in the comment above, and both are now real destinations —
  // they resolve to Sir and Jdt, never to the canonical book their abbreviation resembles.
  //
  // 3 and 4 Maccabees are cited 3 times between them but are absent from the KJV Apocrypha, so
  // they are deliberately NOT here: a key with no verses behind it would underline a link to
  // nothing.
  Tb: 'Tob', Tob: 'Tob', Tobit: 'Tob',
  Jdt: 'Jdt', Judith: 'Jdt',
  AddEst: 'AddEsth', AddEsth: 'AddEsth', AddEsther: 'AddEsth',
  Wisd: 'Wis', Wis: 'Wis', Wisdom: 'Wis',
  Ecclus: 'Sir', Sir: 'Sir', Ecclesiasticus: 'Sir',
  Bar: 'Bar', Baruch: 'Bar',
  Bel: 'Bel',
  '1Macc': '1Macc', '1Maccabees': '1Macc', '2Macc': '2Macc', '2Maccabees': '2Macc',
  '1Esd': '1Esd', '1Esdras': '1Esd', '2Esd': '2Esd', '2Esdras': '2Esd',
};

// A verse spec is everything after "chapter:" that a reader sees as one citation —
// "5", "1-20", "1\u201317:26" (cross-chapter), "13-17, 36, 39-43, 57-66". Capturing the whole thing
// keeps the link and the visible reference the same span; matching only the first number would
// underline "Luke 1:13-17, 36, 39" and leave "-43, 57-66" adrift beside it.
const VERSE_SPEC = String.raw`\d+(?:[-\u2013\u2014]\d+(?::\d+)?)?(?:,[\s\u00a0]*\d+(?:[-\u2013\u2014]\d+)?)*`;

// "1 Chr 5:3", "Gn 1:1", "1 Corinthians 11:23-34". The book is OPTIONAL so one scan also finds the
// bare "3:16" citations; which book those belong to is decided per match below. The non-breaking
// space alternative is required because Tyndale separates a book's number from its name with one.
// `Add ` is allowed as a second book word so "Add Est 11:1" reads as the Additions to Esther rather
// than as canonical Esther. It is the source's own marker and the only two-word book form it uses;
// without it, three citations pointed at an Esther chapter 11 that no Protestant Bible has.
const SCAN_RE = new RegExp(
  String.raw`(?:\b((?:Add[\s ]+)?(?:[1-4][\s ]?)?[A-Z][A-Za-z]{1,11})\.?[\s ]+)?(?<![\d:])(\d+):(${VERSE_SPEC})`,
  'g');

const SEPARATOR_ONLY = /^[;,\s ]*$/;

export function lookupRefBook(token) {
  return REF_BOOKS[String(token).replace(/[\s .]/g, '')] || null;
}

// Psalms has the most chapters (150) and Psalm 119 the most verses (176), so anything beyond these
// cannot be a real reference. It catches run-together numbers in the source: Tyndale writes
// "9:510:7-14" where it means "9:5; 10:7-14", which would otherwise link to John 9:510.
const MAX_CHAPTER = 150;
const MAX_VERSE = 176;
const plausible = (chapter, verse) =>
  chapter >= 1 && chapter <= MAX_CHAPTER && verse >= 1 && verse <= MAX_VERSE;

// text -> [{ plain } | { ref: {book, chapter, verse}, text }]
//
// A citation that names its book is unambiguous. One that does not gets a book from two sources,
// in order:
//
//   1. The reference before it, when nothing but a separator stands between them — Tyndale's dense
//      lists name the book once ("Acts 1:5; 10:37; 11:16") and let the rest inherit it.
//   2. `book`, the book the surrounding text is ABOUT — a study note on Matthew writing "3:17"
//      means Matthew, the standard commentary convention. Guarded by `exists`, so a reference that
//      is not in that book stays plain instead of pointing somewhere wrong: a Numbers note citing
//      "141:9" is a Psalm, and Numbers has 36 chapters.
//
// Callers with no single subject (a dictionary article spans the whole Bible) pass neither, and
// bare references there stay plain rather than being guessed at.
export function tokenizeRefs(text, { book: defaultBook = null, exists = null } = {}) {
  const src = String(text ?? '');
  const out = [];
  let last = 0;
  let contBook = null;          // the book a directly-following bare reference would inherit
  SCAN_RE.lastIndex = 0;
  let m;
  while ((m = SCAN_RE.exec(src))) {
    const [, token, chapterStr, spec] = m;
    const chapter = +chapterStr;
    const verse = parseInt(spec, 10);
    // when the token is not a book we know, drop it from the match and reconsider the number alone:
    // "In 2:15" opens a sentence, but its 2:15 is still a reference
    const named = token ? lookupRefBook(token) : null;
    const start = named ? m.index : m.index + m[0].length - (chapterStr.length + 1 + spec.length);
    const matched = named ? m[0] : src.slice(start, m.index + m[0].length);

    let book = named;
    if (!book) {
      const gap = src.slice(last, start);
      const inherited = contBook && SEPARATOR_ONLY.test(gap) ? contBook : null;
      // a list can change book mid-run — "Isa 1:1; ...; 147:12" ends on a Psalm — so an inherited
      // book that does not contain the verse is dropped in favour of the subject book
      if (inherited && (!exists || exists(inherited, chapter, verse))) book = inherited;
      else if (defaultBook && exists?.(defaultBook, chapter, verse)) book = defaultBook;
    }

    if (!book || !plausible(chapter, verse)) { contBook = null; continue; }
    // A named canonical book is trusted without checking the verse exists — the 66 are complete and
    // the source's own occasional bad ref is better shown than silently dropped. The deuterocanon is
    // NOT: we carry one edition of it (the KJV Apocrypha), Tyndale cites editions that number
    // differently, and a reference that lands on a real-but-wrong verse is worse than a plain one.
    // This is what stops "Apoc Bar 14:13" — the Apocalypse of Baruch, which we do not carry —
    // resolving into canonical Baruch, whose 6 chapters cannot reach 14.
    if (isApocrypha(book) && exists && !exists(book, chapter, verse)) { contBook = null; continue; }

    if (start > last) out.push({ plain: src.slice(last, start) });
    out.push({ ref: { book, chapter, verse }, text: matched });
    last = start + matched.length;
    contBook = book;
    SCAN_RE.lastIndex = last;
  }
  if (last < src.length) out.push({ plain: src.slice(last) });
  return out;
}
