// build/lib/studynotes.mjs
// Parse helpers for Tyndale Open Study Notes (CC BY-SA 4.0). loadStudyNotes is added in Task 2.

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', nbsp: ' ', '#39': "'" };
function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&(amp|lt|gt|quot|nbsp|#39);/g, (_, k) => ENT[k]);
}

// Tyndale uses non-OSIS book codes for 20 books; map them to the OSIS codes used in verses.book.
const BOOK_FIX = {
  ISam: '1Sam', IISam: '2Sam', IKgs: '1Kgs', IIKgs: '2Kgs', IChr: '1Chr', IIChr: '2Chr',
  ICor: '1Cor', IICor: '2Cor', IThes: '1Thess', IIThes: '2Thess', ITim: '1Tim', IITim: '2Tim',
  IPet: '1Pet', IIPet: '2Pet', IJn: '1John', IIJn: '2John', IIIJn: '3John',
  Hagg: 'Hag', Jon: 'Jonah', Pr: 'Prov',
};

// OSIS ref -> verse bounds. Handles "Gen.1.16", "Gen.1.6-8", "Gen.1.1-2.3". Book normalized to OSIS.
export function parseStudyNoteRef(osis) {
  const [left, right] = osis.split('-');
  const m = left.match(/^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  const book = BOOK_FIX[m[1]] || m[1], sc = +m[2], sv = +m[3];
  let ec = sc, ev = sv;
  if (right) {
    const nums = right.split('.').filter((p) => /^\d+$/.test(p)).map(Number);
    if (nums.length === 1) ev = nums[0];               // "8" -> end verse, same chapter
    else if (nums.length >= 2) { ec = nums[nums.length - 2]; ev = nums[nums.length - 1]; } // "2.3"
  }
  return { book, start_chapter: sc, start_verse: sv, end_chapter: ec, end_verse: ev };
}

export function extractRef(bodyXml) {
  const m = bodyXml.match(/<span class="sn-ref">.*?<a\b[^>]*>(.*?)<\/a>.*?<\/span>/s);
  return m ? m[1].replace(/<[^>]+>/g, '').trim() : null;
}

export function cleanNoteBody(bodyXml) {
  let b = bodyXml.replace(/<span class="sn-ref">.*?<\/span>/s, ''); // drop leading ref link
  b = b.replace(/<a\b[^>]*>(.*?)<\/a>/gs, '$1');                    // unwrap links -> text
  b = b.replace(/<[^>]+>/g, ' ');                                   // strip remaining tags
  b = decodeEntities(b);
  return b.replace(/\s+/g, ' ').trim();
}
