import { describe, it, expect } from 'vitest';
import { tokenize } from './vocab.js';

describe('mms hebrew tokenizer', () => {
  it('matches the captured input_ids for בראשית', () => {
    expect(tokenize('בראשית', 'heb')).toEqual([0, 8, 0, 10, 0, 3, 0, 7, 0, 2, 0, 6, 0]);
  });
  it('strips niqqud so pointed == unpointed', () => {
    expect(tokenize('בְּרֵאשִׁית', 'heb')).toEqual(tokenize('בראשית', 'heb'));
  });
  it('drops unknown characters rather than erroring', () => {
    expect(tokenize('ב!ר', 'heb')).toEqual(tokenize('בר', 'heb'));
  });
});

describe('mms greek tokenizer', () => {
  it('tokenizes a plain word (blank 0 interleaved)', () => {
    // λ=11 ό=20 γ=33 ο=57 ς=61
    expect(tokenize('λόγος', 'ell')).toEqual([0, 11, 0, 20, 0, 33, 0, 57, 0, 61, 0]);
  });
  it('folds polytonic NT text to monotonic so all letters survive', () => {
    // ἀρχῇ -> αρχή : α=56 ρ=62 χ=36 ή=2 — no letters dropped
    expect(tokenize('ἀρχῇ', 'ell')).toEqual([0, 56, 0, 62, 0, 36, 0, 2, 0]);
    // polytonic and its monotonic equivalent tokenize identically
    expect(tokenize('ἀρχῇ', 'ell')).toEqual(tokenize('αρχή', 'ell'));
  });
});
