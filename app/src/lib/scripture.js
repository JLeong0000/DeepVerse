// Turns the scripture references inside Tyndale prose into linkable spans.
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
};

// "1 Chr 5:3", "Gn 1:1", "1 Corinthians 11:23-34", "John 14:1–17:26", "Ps 115:10, 12".
// The trailing range/list is captured so the LINK spans the whole reference a reader sees —
// otherwise "John 13:1-20" underlines only "John 13:1" and leaves "-20" adrift — while the jump
// still targets the opening verse. The   alternative is required because
// Tyndale separates the number from the name with a non-breaking space.
const REF_RE =
  /\b((?:[1-4][  ]?)?[A-Z][A-Za-z]{1,11})\.?[  ]+(\d+):(\d+(?:[-–—]\d+(?::\d+)?)?(?:,[  ]?\d+)*)/g;

export function lookupRefBook(token) {
  return REF_BOOKS[String(token).replace(/[  .]/g, '')] || null;
}

// text -> [{ plain } | { ref: {book, chapter, verse}, text }]
// A citation that omits its book because the previous one supplied it ("; 13:7", "chs 3–4") stays
// plain: carrying the book forward is guesswork the moment a sentence breaks the chain, and a
// confidently wrong link is worse than none.
export function tokenizeRefs(text) {
  const src = String(text ?? '');
  const out = [];
  let last = 0;
  REF_RE.lastIndex = 0;
  let m;
  while ((m = REF_RE.exec(src))) {
    const book = lookupRefBook(m[1]);
    if (!book) continue;                       // not an allowlisted book — leave it as prose
    if (m.index > last) out.push({ plain: src.slice(last, m.index) });
    // m[3] is the whole verse spec ("20", "1-20", "10, 12"); the jump targets its first verse
    out.push({ ref: { book, chapter: +m[2], verse: parseInt(m[3], 10) }, text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push({ plain: src.slice(last) });
  return out;
}
