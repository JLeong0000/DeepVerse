import { describe, it, expect } from 'vitest';
import { tokenize } from './vocab.js';

describe('mms hebrew tokenizer', () => {
  it('matches the captured input_ids for בראשית', () => {
    expect(tokenize('בראשית')).toEqual([0, 8, 0, 10, 0, 3, 0, 7, 0, 2, 0, 6, 0]);
  });
  it('strips niqqud so pointed == unpointed', () => {
    expect(tokenize('בְּרֵאשִׁית')).toEqual(tokenize('בראשית'));
  });
  it('drops unknown characters rather than erroring', () => {
    expect(tokenize('ב!ר')).toEqual(tokenize('בר'));
  });
});
