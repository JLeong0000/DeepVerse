import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { study } from '../../lib/study.svelte.js';
import { APOCRYPHA_NOTE } from '../../lib/refs.js';
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
      { text: '1 Esdras 2:13 says the same.' });
    expect(queryByRole('button', { name: /Esdras/ })).toBeNull();
    expect(getByTitle(APOCRYPHA_NOTE['1Esd'])).toBeTruthy();
    expect(study.book).toBe('Gen');   // nothing moved
  });

  // Nothing outside the 66 canonical books is a link, in any host. The citation keeps the words
  // and the explanation it already carried.
  it.each([['Compare 3 Macc 1:3 here.', '3Macc'], ['See 1 Maccabees 1:10-63.', '1Macc'],
           ['As Apoc Bar 14:13 has it.', 'ApocBar'], ['Tobit 4:15 says so.', 'Tob'],
           ['Judith 8:1 opens it.', 'Jdt'], ['1 Esdras 2:13 lists them.', '1Esd'],
           ['Baruch 3:9 pleads.', 'Bar']])(
    'never links %s, and keeps its explanation on hover', (text, code) => {
      const { queryByRole, getByTitle } = render(RefText, { text });
      expect(queryByRole('button')).toBeNull();
      expect(getByTitle(APOCRYPHA_NOTE[code])).toBeTruthy();
    });

  // ...not even where the host could have answered with a preview, which is the one thing that
  // used to keep them clickable in the library.
  it('does not link an apocryphal citation even when a preview surface is offered', () => {
    const seen = [];
    const { queryByRole } = render(RefText,
      { text: 'See 1 Maccabees 1:10-63.', onref: (r) => seen.push(r) });
    expect(queryByRole('button')).toBeNull();
    expect(seen).toEqual([]);
  });

  // The library's article surface passes onref and answers in a preview instead of jumping, so a
  // canonical citation there must stay clickable and must NOT move study state.
  it('keeps a canonical citation clickable when the host has a preview surface', async () => {
    const seen = [];
    const { getByRole } = render(RefText,
      { text: 'See Rom 5:1.', onref: (r) => seen.push(r) });
    await fireEvent.click(getByRole('button', { name: 'Rom 5:1' }));
    expect(seen).toEqual([{ book: 'Rom', chapter: 5, verse: 1 }]);
    expect(study.book).toBe('Gen');   // a preview, not a jump
  });

  it('renders the verse already on screen as plain text', () => {
    const { queryByRole, getByTitle } = render(RefText, { text: 'As Gen 1:1 says.' });
    expect(queryByRole('button', { name: 'Gen 1:1' })).toBeNull();
    expect(getByTitle('You are reading this verse')).toBeTruthy();
  });
});
