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

  test('a book-less continuation stays plain rather than guessing', () => {
    const got = refs('as predicted (e.g., Zech 12:10; 13:7).');
    expect(got).toHaveLength(1);
    expect(got[0].text).toBe('Zech 12:10');
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
