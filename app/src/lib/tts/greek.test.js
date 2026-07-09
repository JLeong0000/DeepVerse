import { describe, it, expect } from 'vitest';
import { toMonotonic } from './greek.js';

describe('toMonotonic (polytonic NT Greek -> modern monotonic lowercase)', () => {
  it('strips breathing marks and iota subscript, keeps letters', () => {
    // ἐν ἀρχῇ ἦν ὁ λόγος  ->  εν αρχή ήν ο λόγος
    expect(toMonotonic('ἐν ἀρχῇ ἦν ὁ λόγος')).toBe('εν αρχή ήν ο λόγος');
  });
  it('lowercases and folds grave to acute', () => {
    expect(toMonotonic('Ἀδὰμ')).toBe('αδάμ');       // capital + grave
    expect(toMonotonic('Χριστῷ')).toBe('χριστώ');    // capital + circumflex + iota subscript
  });
  it('keeps a plain accented word unchanged', () => {
    expect(toMonotonic('λόγος')).toBe('λόγος');
  });
  it('produces only precomposed monotonic chars (NFC)', () => {
    const out = toMonotonic('ἀρχῇ');
    expect(out).toBe(out.normalize('NFC'));
    expect([...out].every(c => c.codePointAt(0) < 0x0300 || c.codePointAt(0) > 0x036f)).toBe(true);
  });
});
