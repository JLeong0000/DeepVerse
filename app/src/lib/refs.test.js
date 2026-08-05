import { test, expect, describe } from 'vitest';
import { parseReference, bookShort, matchBooks, parseRefQuery, refOverlaps } from './refs.js';

describe('bookShort', () => {
  test('spaces a leading numeral, leaves others intact', () => {
    expect(bookShort('1Cor')).toBe('1 Cor');
    expect(bookShort('2Sam')).toBe('2 Sam');
    expect(bookShort('3John')).toBe('3 John');
    expect(bookShort('Rom')).toBe('Rom');
    expect(bookShort('Song')).toBe('Song');
  });
});

describe('parseReference', () => {
  test('book name + chapter:verse', () => {
    expect(parseReference('John 3:16')).toEqual({ book: 'John', chapter: 3, verse: 16 });
    expect(parseReference('Genesis 1:1')).toEqual({ book: 'Gen', chapter: 1, verse: 1 });
  });
  test('numbered books keep their leading digit', () => {
    expect(parseReference('1 John 2:1')).toEqual({ book: '1John', chapter: 2, verse: 1 });
    expect(parseReference('2 Cor 5')).toEqual({ book: '2Cor', chapter: 5, verse: null });
  });
  test('abbreviations and prefixes', () => {
    expect(parseReference('Ps 23')).toEqual({ book: 'Ps', chapter: 23, verse: null });
    expect(parseReference('gen 1')).toEqual({ book: 'Gen', chapter: 1, verse: null });
    expect(parseReference('psalm 119:105')).toEqual({ book: 'Ps', chapter: 119, verse: 105 });
  });
  test('book only defaults to chapter 1', () => {
    expect(parseReference('John')).toEqual({ book: 'John', chapter: 1, verse: null });
  });
  test('no-space forms and OSIS codes', () => {
    expect(parseReference('gen1:1')).toEqual({ book: 'Gen', chapter: 1, verse: 1 });
    expect(parseReference('Esth 3:12')).toEqual({ book: 'Esth', chapter: 3, verse: 12 });
  });
  test('unmatchable input returns null', () => {
    expect(parseReference('')).toBe(null);
    expect(parseReference('xyzzy 3')).toBe(null);
  });
});

// The Memo filter searches; the jump box navigates. Searching needs the SET of books a query could
// mean and no chapter-1 defaulting, so it gets its own parser rather than bending parseReference.
describe('matchBooks', () => {
  test('matches anywhere in the display name, not just the start', () => {
    expect(matchBooks('psalm')).toEqual(['Ps']);
    expect(matchBooks('ohn')).toEqual(['John', '1John', '2John', '3John']);
  });
  test('narrows as more of the name is typed', () => {
    expect(matchBooks('j')).toHaveLength(12);
    expect(matchBooks('jo')).toHaveLength(8);
    expect(matchBooks('john')).toEqual(['John', '1John', '2John', '3John']);
  });
  test('spaces are significant, and OSIS codes are never consulted', () => {
    expect(matchBooks('1 Cor')).toEqual(['1Cor']);
    expect(matchBooks('1Cor')).toEqual([]);   // no display name contains it
  });
  test('a code only works when it is also a containment of the name', () => {
    expect(matchBooks('ps')).toEqual(['Ps']);      // "ps" is in "Psalms"
    expect(matchBooks('gen')).toEqual(['Gen']);    // "gen" is in "Genesis"
    expect(matchBooks('jn')).toEqual([]);          // shorthand, deliberately unsupported
    expect(matchBooks('mt')).toEqual([]);
  });
  test('empty input matches nothing', () => {
    expect(matchBooks('')).toEqual([]);
    expect(matchBooks('   ')).toEqual([]);
  });
});

describe('parseRefQuery', () => {
  test('a bare book leaves the chapter unconstrained (parseReference would say 1)', () => {
    expect(parseReference('John').chapter).toBe(1);
    expect(parseRefQuery('john')).toEqual({ books: ['John', '1John', '2John', '3John'], chapter: null, verse: null, verseEnd: null });
  });
  test('splits the trailing chapter and verse off the book text', () => {
    expect(parseRefQuery('1 Cor 13')).toEqual({ books: ['1Cor'], chapter: 13, verse: null, verseEnd: null });
    expect(parseRefQuery('psalm 23')).toEqual({ books: ['Ps'], chapter: 23, verse: null, verseEnd: null });
    expect(parseRefQuery('john 3:16')).toEqual({ books: ['John', '1John', '2John', '3John'], chapter: 3, verse: 16, verseEnd: 16 });
  });
  test('reads a verse range', () => {
    expect(parseRefQuery('john 3:16-18')).toMatchObject({ chapter: 3, verse: 16, verseEnd: 18 });
  });
  test('a leading numeral belongs to the book, not the chapter', () => {
    expect(parseRefQuery('1 john')).toMatchObject({ books: ['1John'], chapter: null });
    expect(parseRefQuery('3 john')).toMatchObject({ books: ['3John'], chapter: null });
    expect(parseRefQuery('1 john 3')).toMatchObject({ books: ['1John'], chapter: 3 });
  });
  test('a bare number is book text, matching every name that contains it', () => {
    expect(parseRefQuery('1').books).toEqual(['1Sam', '1Kgs', '1Chr', '1Cor', '1Thess', '1Tim', '1Pet', '1John']);
  });
  test('returns null when no book matches, so the caller falls back to text search', () => {
    expect(parseRefQuery('')).toBe(null);
    expect(parseRefQuery('xyzzy 3')).toBe(null);
    expect(parseRefQuery('1Cor')).toBe(null);
    expect(parseRefQuery('3:16')).toBe(null);   // no book means no reference — accepted
  });
});

describe('refOverlaps', () => {
  const q = (s) => parseRefQuery(s);
  test('an unconstrained chapter matches every memo in the book', () => {
    expect(refOverlaps('1John.3.2', q('john'))).toBe(true);
    expect(refOverlaps('John.12', q('john'))).toBe(true);
  });
  test('an unconstrained verse matches every memo in the chapter', () => {
    expect(refOverlaps('John.3.16', q('john 3'))).toBe(true);
    expect(refOverlaps('John.12', q('john 3'))).toBe(false);
  });
  test('respects verse boundaries — the false positive substring matching caused', () => {
    expect(refOverlaps('John.3.16', q('john 3:1'))).toBe(false);
    expect(refOverlaps('John.3.16', q('john 3:16'))).toBe(true);
  });
  test('a query verse inside a stored range matches', () => {
    expect(refOverlaps('John.3.16-18', q('john 3:17'))).toBe(true);
    expect(refOverlaps('John.3.16-18', q('john 3:19'))).toBe(false);
  });
  test('a chapter memo covers every verse in its chapter', () => {
    expect(refOverlaps('John.3', q('john 3:24'))).toBe(true);
  });
  test('finds the memo a spaced numbered book was hiding', () => {
    expect(refOverlaps('1Cor.13.4', q('1 Cor 13'))).toBe(true);
  });
  test('a different book never matches', () => {
    expect(refOverlaps('Rom.3.16', q('john 3:16'))).toBe(false);
  });
});
