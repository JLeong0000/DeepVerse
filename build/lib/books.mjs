// build/lib/books.mjs
// One canonical book-code module for the whole build. Every source we import uses its own
// abbreviations; bible.db stores OSIS. Keeping the aliases in one place is what stops a new
// source from silently failing to join (Tyndale's `1Thes` did not match OSIS `1Thess`, so
// five books' worth of refs would have been dropped without an error).
//
// All aliases below were checked for conflicts across the four maps they replace: no alias
// resolves to two different OSIS codes. `books.test.mjs` re-asserts that invariant.

export const OSIS_BOOKS = [
  'Gen', 'Exod', 'Lev', 'Num', 'Deut', 'Josh', 'Judg', 'Ruth', '1Sam', '2Sam',
  '1Kgs', '2Kgs', '1Chr', '2Chr', 'Ezra', 'Neh', 'Esth', 'Job', 'Ps', 'Prov',
  'Eccl', 'Song', 'Isa', 'Jer', 'Lam', 'Ezek', 'Dan', 'Hos', 'Joel', 'Amos',
  'Obad', 'Jonah', 'Mic', 'Nah', 'Hab', 'Zeph', 'Hag', 'Zech', 'Mal',
  'Matt', 'Mark', 'Luke', 'John', 'Acts', 'Rom', '1Cor', '2Cor', 'Gal', 'Eph',
  'Phil', 'Col', '1Thess', '2Thess', '1Tim', '2Tim', 'Titus', 'Phlm', 'Heb',
  'Jas', '1Pet', '2Pet', '1John', '2John', '3John', 'Jude', 'Rev',
];

const CANON = new Set(OSIS_BOOKS);

// Books Tyndale cites that bible.db does not contain (641 of 44,132 dictionary links).
// Dropped deliberately by toOsisOrNull, never silently mis-joined.
export const APOCRYPHA = new Set([
  '1Esd', '2Esd', '1Macc', '2Macc', '3Macc', 'AddEsth',
  'Bar', 'Bel', 'Ecclus', 'Jdt', 'Tb', 'Wisd',
]);

export const ALIASES = {
  // --- STEPBible (was STEP2OSIS in refs.mjs) ---
  Exo: 'Exod', Deu: 'Deut', Jos: 'Josh', Jdg: 'Judg', Rut: 'Ruth',
  '1Sa': '1Sam', '2Sa': '2Sam', '1Ki': '1Kgs', '2Ki': '2Kgs', '1Ch': '1Chr', '2Ch': '2Chr',
  Est: 'Esth', Psa: 'Ps', Pro: 'Prov', Ecc: 'Eccl', Sng: 'Song',
  Ezk: 'Ezek', Jol: 'Joel', Amo: 'Amos', Oba: 'Obad', Jon: 'Jonah', Nam: 'Nah',
  Zep: 'Zeph', Zec: 'Zech', Mat: 'Matt', Mrk: 'Mark', Luk: 'Luke', Jhn: 'John',
  Act: 'Acts', '1Co': '1Cor', '2Co': '2Cor', Php: 'Phil',
  '1Th': '1Thess', '2Th': '2Thess', '1Ti': '1Tim', '2Ti': '2Tim', Tit: 'Titus', Phm: 'Phlm',
  '1Pe': '1Pet', '2Pe': '2Pet', '1Jn': '1John', '2Jn': '2John', '3Jn': '3John', Jud: 'Jude',

  // --- NLT tokens (was BOOKS in parse-nlt.mjs); overlaps with STEPBible are identical ---
  Sol: 'Song', Eze: 'Ezek', Joe: 'Joel', Mar: 'Mark', Joh: 'John',

  // --- Tyndale, Roman scheme: StudyNotes.xml `name` attribute (was BOOK_FIX) ---
  ISam: '1Sam', IISam: '2Sam', IKgs: '1Kgs', IIKgs: '2Kgs', IChr: '1Chr', IIChr: '2Chr',
  ICor: '1Cor', IICor: '2Cor', IThes: '1Thess', IIThes: '2Thess', ITim: '1Tim', IITim: '2Tim',
  IPet: '1Pet', IIPet: '2Pet', IJn: '1John', IIJn: '2John', IIIJn: '3John',

  // --- Tyndale, Arabic scheme: every <refs> and ?bref= link. THIS is the one BOOK_FIX missed. ---
  '1Thes': '1Thess', '2Thes': '2Thess', Hagg: 'Hag', Pr: 'Prov',
  // dictionary-only singletons, each swamped by a correct dominant form (Jos 1 vs Josh 1452,
  // Mt 1 vs Matt 2009, Esther 1 vs Esth 187) — easy to miss, so pinned by test
  Mt: 'Matt', Esther: 'Esth',
};

export function isOsis(code) {
  return CANON.has(code);
}

// Strict: the caller asserts this code must be a real book in bible.db.
export function toOsis(code) {
  if (CANON.has(code)) return code;
  if (Object.hasOwn(ALIASES, code)) return ALIASES[code];
  if (APOCRYPHA.has(code)) throw new Error(`apocryphal book code: ${code} (use toOsisOrNull)`);
  throw new Error(`unknown book code: ${code}`);
}

// Tolerant of apocrypha only. An unrecognised code is still a hard error — that is the guard
// that makes a future source revision fail loudly instead of dropping a book.
export function toOsisOrNull(code) {
  if (APOCRYPHA.has(code)) return null;
  return toOsis(code);
}
