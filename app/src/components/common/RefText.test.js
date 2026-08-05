import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { study } from '../../lib/study.svelte.js';
import RefText from './RefText.svelte';

// verseExists is the only db call RefText makes (through tokenizeRefs); the canon is complete, so
// a named book is trusted and this only gates bare "3:5"-style citations.
vi.mock('../../lib/db.js', () => ({ verseExists: () => true }));

beforeEach(() => {
  study.book = 'Gen';
  study.chapter = 1;
  study.verse = 1;
});

describe('RefText', () => {
  it('links a canonical reference and jumps to it', async () => {
    const { getByRole } = render(RefText, { text: 'See Rom 5:1 for the point.' });
    await fireEvent.click(getByRole('button', { name: 'Rom 5:1' }));
    expect(study.book).toBe('Rom');
    expect(study.chapter).toBe(5);
  });

  // Study navigates the 66 canonical books, so a jump to the deuterocanon landed the reader on a
  // blank pane with an empty book selector. 58 citations across the study notes, themes and
  // profiles could reach it — every host that renders prose without a preview surface.
  it('does not offer a jump to a book Study cannot navigate', () => {
    const { queryByRole, getByTitle } = render(RefText,
      { text: 'See 1 Maccabees 1:10-63, which describes the evils.' });
    expect(queryByRole('button', { name: /Maccabees/ })).toBeNull();
    expect(getByTitle('1 Maccabees is outside the 66 books Study reads')).toBeTruthy();
    expect(study.book).toBe('Gen');   // nothing moved
  });

  it('still shows a book we hold no text for at all as plain text, not a dead link', () => {
    const { queryByRole } = render(RefText, { text: 'Compare 3 Macc 1:3 here.' });
    expect(queryByRole('button', { name: /Macc/ })).toBeNull();
  });

  // The library's article surface passes onref and answers in a preview — the KJVA text, or the
  // reason it is absent — so there the citation must stay clickable.
  it('keeps the citation clickable when the host has a preview surface', async () => {
    const seen = [];
    const { getByRole } = render(RefText,
      { text: 'See 1 Maccabees 1:10-63.', onref: (r) => seen.push(r) });
    await fireEvent.click(getByRole('button', { name: '1 Maccabees 1:10-63' }));
    expect(seen).toEqual([{ book: '1Macc', chapter: 1, verse: 10 }]);
    expect(study.book).toBe('Gen');   // a preview, not a jump
  });

  it('renders the verse already on screen as plain text', () => {
    const { queryByRole, getByTitle } = render(RefText, { text: 'As Gen 1:1 says.' });
    expect(queryByRole('button', { name: 'Gen 1:1' })).toBeNull();
    expect(getByTitle('You are reading this verse')).toBeTruthy();
  });
});
