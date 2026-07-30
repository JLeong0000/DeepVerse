import { test, expect, describe } from 'vitest';
import { tokenizeRefs, lookupRefBook } from './scripture.js';

const refs = (s) => tokenizeRefs(s).filter((x) => x.ref);
const plain = (s) => tokenizeRefs(s).map((x) => (x.ref ? x.text : x.plain)).join('');

describe('lookupRefBook', () => {
  test('resolves all three abbreviation systems Tyndale mixes', () => {
    for (const [tok, osis] of [['Gn', 'Gen'], ['Gen', 'Gen'], ['Genesis', 'Gen'],
      ['Mt', 'Matt'], ['Matt', 'Matt'], ['Matthew', 'Matt'],
      ['Jn', 'John'], ['Lk', 'Luke'], ['Jgs', 'Judg'], ['Prv', 'Prov'], ['Rv', 'Rev']])
      expect(lookupRefBook(tok), tok).toBe(osis);
  });

  test('numbered books resolve with a normal OR non-breaking space', () => {
    expect(lookupRefBook('1 Chr')).toBe('1Chr');
    expect(lookupRefBook('1 Chr')).toBe('1Chr');
    expect(lookupRefBook('1 Sm')).toBe('1Sam');
    expect(lookupRefBook('1 Corinthians')).toBe('1Cor');
  });

  test('Ez is Ezekiel and Ezr is Ezra — Tyndale distinguishes them', () => {
    expect(lookupRefBook('Ez')).toBe('Ezek');
    expect(lookupRefBook('Ezr')).toBe('Ezra');
  });

  // the whole reason matching is an exact allowlist rather than a prefix match
  test('apocryphal books never resolve', () => {
    for (const t of ['Ecclus', 'Jdt', 'Tb', 'Wisd', 'Bar', 'Sir', '1 Macc', '2 Esd'])
      expect(lookupRefBook(t), t).toBeNull();
  });

  test('"In" does not resolve — it is an English word before a bare chapter:verse', () => {
    expect(lookupRefBook('In')).toBeNull();
    expect(refs('In 2:15 Paul says')).toHaveLength(0);
  });
});

describe('tokenizeRefs', () => {
  test('links a plain reference and targets its verse', () => {
    const [r] = refs('he knew it (Mark 8:31).');
    expect(r.text).toBe('Mark 8:31');
    expect(r.ref).toEqual({ book: 'Mark', chapter: 8, verse: 31 });
  });

  test('the link spans a whole range, jumping to its first verse', () => {
    const [r] = refs('washing feet (John 13:1-20).');
    expect(r.text).toBe('John 13:1-20');
    expect(r.ref.verse).toBe(1);
  });

  test('cross-chapter ranges with an en dash stay intact', () => {
    const [r] = refs('prayed (John 14:1–17:26).');
    expect(r.text).toBe('John 14:1–17:26');
    expect(r.ref).toEqual({ book: 'John', chapter: 14, verse: 1 });
  });

  test('verse lists stay intact', () => {
    const [r] = refs('Pss 115:10, 12 say so');
    expect(r.text).toBe('Pss 115:10, 12');
    expect(r.ref).toEqual({ book: 'Ps', chapter: 115, verse: 10 });
  });

  test('several references in one sentence, in order', () => {
    const got = refs('Matt 26:17-56; Mark 14:12-52; 1 Cor 11:23-34.');
    expect(got.map((r) => r.ref.book)).toEqual(['Matt', 'Mark', '1Cor']);
  });

  test('a continuation separated only by "; " inherits the book', () => {
    const got = refs('as predicted (e.g., Zech 12:10; 13:7).');
    expect(got.map((r) => r.text)).toEqual(['Zech 12:10', '13:7']);
    expect(got[1].ref).toEqual({ book: 'Zech', chapter: 13, verse: 7 });
  });

  test('a whole citation list inherits from the one stated book', () => {
    // Tyndale's "Passages for Further Study" lists name the book once; this is 11,829 refs corpus-wide
    const got = refs('Matthew 3:1-15; 4:12; 9:14; 11:2-19; 14:1-12.');
    expect(got.map((r) => r.text)).toEqual(['Matthew 3:1-15', '4:12', '9:14', '11:2-19', '14:1-12']);
    expect(got.every((r) => r.ref.book === 'Matt')).toBe(true);
  });

  test('prose between references BREAKS the chain — the book is not carried across it', () => {
    // this is the guesswork guard: after a sentence, a bare ref could belong to any book in it
    const got = refs('See Zech 12:10. He also wrote about 13:7 elsewhere.');
    expect(got).toHaveLength(1);
    expect(got[0].text).toBe('Zech 12:10');
  });

  test('a comma-separated run of ranges links as one span', () => {
    const [r] = refs('Luke 1:13-17, 36, 39-43, 57-66; more');
    expect(r.text).toBe('Luke 1:13-17, 36, 39-43, 57-66');
    expect(r.ref).toEqual({ book: 'Luke', chapter: 1, verse: 13 });
  });

  test('an implausible chapter or verse stays plain', () => {
    // Tyndale writes "9:510:7-14" where it means "9:5; 10:7-14"; 510 exceeds any real chapter
    expect(refs('John 9:510:7-14')).toHaveLength(0);
    expect(refs('Gen 200:1')).toHaveLength(0);
    expect(refs('Ps 119:176')).toHaveLength(1);   // the genuine maximum still links
  });

  test('never loses or duplicates a character of the original text', () => {
    for (const s of ['he knew it (Mark 8:31).', 'Matt 26:17-56; Mark 14:12-52.',
      'no refs at all here', '', 'In 2:15 and Ecclus 3:4', 'Ps 115:10, 12 plus tail'])
      expect(plain(s), s).toBe(s);
  });

  test('no references yields a single plain segment', () => {
    expect(tokenizeRefs('nothing to link')).toEqual([{ plain: 'nothing to link' }]);
  });

  test('handles null/undefined without throwing', () => {
    expect(tokenizeRefs(null)).toEqual([]);
    expect(tokenizeRefs(undefined)).toEqual([]);
  });

  test('the module-level regex is not left with stale lastIndex between calls', () => {
    const a = refs('Mark 8:31');
    const b = refs('Mark 8:31');
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);   // would be 0 if lastIndex leaked across calls
  });
});

describe('a book-less citation resolved against the subject book', () => {
  // stand-in for db.js verseExists: Numbers ends at ch36, Matthew at ch28, Psalms run to 150
  const exists = (b, c) =>
    (b === 'Num' && c <= 36) || (b === 'Matt' && c <= 28) || (b === 'Ps' && c <= 150) ||
    (b === 'Eph' && c <= 6) || (b === 'Gen' && c <= 50);
  const withBook = (s, book) => tokenizeRefs(s, { book, exists }).filter((x) => x.ref);

  test('a note on Matthew reads a bare reference as Matthew', () => {
    const [r] = withBook('Later in 5:9 he says', 'Matt');
    expect(r.ref).toEqual({ book: 'Matt', chapter: 5, verse: 9 });
  });

  test('without a subject book the same text stays plain', () => {
    // a dictionary article spans the whole Bible, so there is nothing to resolve against
    expect(tokenizeRefs('Later in 5:9 he says').filter((x) => x.ref)).toHaveLength(0);
  });

  test('a reference the subject book cannot contain stays plain', () => {
    // Numbers has 36 chapters, so "141:9" in a Numbers note is a Psalm, not Numbers
    expect(withBook('a psalm (141:9) says', 'Num')).toHaveLength(0);
  });

  test('an explicit book always wins over the subject book', () => {
    const [r] = withBook('see Ps 23:1 here', 'Matt');
    expect(r.ref.book).toBe('Ps');
  });

  test('a sentence-opening word is not mistaken for a book, but its verse still resolves', () => {
    // "In 2:15" — In is not a book; the reference belongs to the subject book
    const [r] = withBook('In 2:15 Paul says', 'Eph');
    expect(r.text).toBe('2:15');
    expect(r.ref).toEqual({ book: 'Eph', chapter: 2, verse: 15 });
  });

  test('a list that changes book mid-run does not carry the wrong one forward', () => {
    // "Isa 1:1; 147:12" ends on a Psalm; Isaiah has 66 chapters, so the inherited book is dropped
    const got = withBook('Isa 1:1; 147:12', 'Ps');
    expect(got.map((r) => r.ref.book)).toEqual(['Isa', 'Ps']);
  });

  test('continuations still inherit when the verse does exist in that book', () => {
    const got = withBook('Matt 3:1; 4:12', 'Gen');
    expect(got.map((r) => r.ref.book)).toEqual(['Matt', 'Matt']);
  });
});
