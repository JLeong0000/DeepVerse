import { test, expect, describe } from 'vitest';
import { GLOSSARY, tokenizeGlossary } from './glossary.js';

describe('tokenizeGlossary', () => {
  test('matches a bracketed stem label, keeping the parens as plain text', () => {
    expect(tokenizeGlossary('1a) (Qal)')).toEqual([
      { plain: '1a) (' },
      { term: 'Qal' },
      { plain: ')' },
    ]);
  });

  test('matches an inline grammar term', () => {
    expect(tokenizeGlossary('with accusative of')).toEqual([
      { plain: 'with ' },
      { term: 'accusative' },
      { plain: ' of' },
    ]);
  });

  test('matches a symbol', () => {
    expect(tokenizeGlossary('Mat.5:43 †')).toEqual([
      { plain: 'Mat.5:43 ' },
      { term: '†' },
    ]);
  });

  test('does not match a key inside a longer word', () => {
    expect(tokenizeGlossary('Qalander')).toEqual([{ plain: 'Qalander' }]);
  });

  test('does not match "v." inside a verse-ref book abbrev "Rev."', () => {
    expect(tokenizeGlossary('Rev.12:11')).toEqual([{ plain: 'Rev.12:11' }]);
  });

  test('matches multiple terms in order', () => {
    const out = tokenizeGlossary('(Niphal) ... LXX');
    expect(out.filter(s => s.term).map(s => s.term)).toEqual(['Niphal', 'LXX']);
  });

  test('handles a term at the very start and end', () => {
    expect(tokenizeGlossary('Qal and Piel')).toEqual([
      { term: 'Qal' },
      { plain: ' and ' },
      { term: 'Piel' },
    ]);
  });

  test('a string with no glossary term is one plain segment', () => {
    expect(tokenizeGlossary('a province of Palestine')).toEqual([
      { plain: 'a province of Palestine' },
    ]);
  });

  test('every GLOSSARY entry has a non-empty label and text', () => {
    for (const [k, v] of Object.entries(GLOSSARY)) {
      expect(v.label, k).toBeTruthy();
      expect(v.text, k).toBeTruthy();
    }
  });
});
