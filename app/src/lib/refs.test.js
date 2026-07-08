import { test, expect, describe } from 'vitest';
import { parseReference } from './refs.js';

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
