import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { resetLibrary, lib } from '../../lib/library.svelte.js';
import SearchSurface from './SearchSurface.svelte';

// db.js is mocked so this test controls exactly which groups are populated/capped/truncated,
// rather than depending on how many corpus rows happen to match a real term today. The truncated
// flags are set independently of array length here — same as the real searchLibrary, where a
// group's rendered length is always <= its cap, but whether that length is the TRUE total or a cut
// is a separate fact the caller can't infer from length alone.
const { results } = vi.hoisted(() => ({
  results: { dict: [], themes: [], profiles: [], books: [],
    dictTruncated: false, themesTruncated: false, profilesTruncated: false },
}));
vi.mock('../../lib/db.js', () => ({ searchLibrary: () => results }));

beforeEach(() => {
  resetLibrary();
  results.dict = [];
  results.themes = [];
  results.profiles = [];
  results.books = [];
  results.dictTruncated = false;
  results.themesTruncated = false;
  results.profilesTruncated = false;
});

describe('SearchSurface', () => {
  it('shows the "nothing matches" state when every group is empty', () => {
    const { getByText } = render(SearchSurface, { q: 'xyz' });
    expect(getByText('Nothing matches “xyz”.')).toBeTruthy();
  });

  it('de-inverts a dictionary hit\'s title, same as every other surface', () => {
    results.dict = [{ id: 'RevBook', title: 'Revelation, Book of' }];
    const { getByText } = render(SearchSurface, { q: 'revelation' });
    expect(getByText('Book of Revelation')).toBeTruthy();
  });

  // The header renders res.dict.length, but a length equal to the cap doesn't by itself mean rows
  // were cut — searchLibrary now says so explicitly via dictTruncated. Render "+" only when that
  // flag is set, not merely when the count happens to equal the cap.
  it('renders the dictionary count as a floor ("20+") when searchLibrary reports truncation', () => {
    results.dict = Array.from({ length: 20 }, (_, i) => ({ id: `d${i}`, title: `Word ${i}` }));
    results.dictTruncated = true;
    const { getByText } = render(SearchSurface, { q: 'a' });
    expect(getByText('Dictionary · 20+')).toBeTruthy();
  });

  // Regression: this is the exact shape a naive "n === cap" check gets wrong — 20 real rows, none
  // hidden. Rendering "20+" here would claim more results exist than the corpus actually has.
  it('renders the dictionary count plainly, with no "+", when the count equals the cap but nothing was truncated', () => {
    results.dict = Array.from({ length: 20 }, (_, i) => ({ id: `d${i}`, title: `Word ${i}` }));
    results.dictTruncated = false;
    const { getByText } = render(SearchSurface, { q: 'a' });
    expect(getByText('Dictionary · 20')).toBeTruthy();
  });

  it('renders an uncapped dictionary count plainly', () => {
    results.dict = [{ id: 'd1', title: 'Word' }];
    const { getByText } = render(SearchSurface, { q: 'a' });
    expect(getByText('Dictionary · 1')).toBeTruthy();
  });

  it('renders the themes count as a floor ("10+") when searchLibrary reports truncation', () => {
    results.themes = Array.from({ length: 10 }, (_, i) => ({ title: `Theme ${i}`, book: 'Gen', ref: '1:1' }));
    results.themesTruncated = true;
    const { getByText } = render(SearchSurface, { q: 'a' });
    expect(getByText('Themes · 10+')).toBeTruthy();
  });

  it('renders the themes count plainly, with no "+", when the count equals the cap but nothing was truncated', () => {
    results.themes = Array.from({ length: 10 }, (_, i) => ({ title: `Theme ${i}`, book: 'Gen', ref: '1:1' }));
    results.themesTruncated = false;
    const { getByText } = render(SearchSurface, { q: 'a' });
    expect(getByText('Themes · 10')).toBeTruthy();
  });

  // Regression: the plan's own CSS used `.reslbl:first-of-type`, which never actually matches —
  // .smeta above the results is also a <div>, so it (not whichever .reslbl is visually first)
  // permanently owns that position. The border-suppression is done with an explicit "first" class
  // computed from which group is non-empty, and that must track dict being absent correctly.
  it('marks whichever group renders first as "first", even when Dictionary has no results', () => {
    results.themes = [{ title: 'Holy War', book: 'Deut', ref: '7:1-6' }];
    results.books = ['Rev'];
    const { container } = render(SearchSurface, { q: 'a' });
    const labels = [...container.querySelectorAll('.reslbl')];
    expect(labels[0].textContent).toContain('Themes');
    expect(labels[0].classList.contains('first')).toBe(true);
    expect(labels[1].textContent).toContain('Books');
    expect(labels[1].classList.contains('first')).toBe(false);
  });

  it('pushes an article node for a dictionary hit', async () => {
    results.dict = [{ id: 'Beast', title: 'Beast' }];
    const { getByText } = render(SearchSurface, { q: 'beast' });
    await fireEvent.click(getByText('Beast'));
    expect(lib.stack.at(-1)).toEqual({ kind: 'article', id: 'Beast', title: 'Beast' });
  });

  it('pushes a passage node for a theme hit, matching PassageIndex\'s shape (kind, pkind, title, book)', async () => {
    results.themes = [{ title: 'Holy War', book: 'Deut', ref: '7:1-6' }];
    const { getByText } = render(SearchSurface, { q: 'holy' });
    await fireEvent.click(getByText('Holy War'));
    expect(lib.stack.at(-1)).toEqual({ kind: 'passage', pkind: 'theme', title: 'Holy War', book: 'Deut' });
  });

  it('pushes a passage node with pkind "profile" for a profile hit, not derived from the "Profiles" heading text', async () => {
    results.profiles = [{ title: 'Rahab', book: 'Josh', ref: '2:1' }];
    const { getByText } = render(SearchSurface, { q: 'rahab' });
    await fireEvent.click(getByText('Rahab'));
    expect(lib.stack.at(-1)).toEqual({ kind: 'passage', pkind: 'profile', title: 'Rahab', book: 'Josh' });
  });

  it('pushes a hub node for a book hit', async () => {
    results.books = ['Rev'];
    const { getByText } = render(SearchSurface, { q: 'revelation' });
    await fireEvent.click(getByText('Revelation'));
    expect(lib.stack.at(-1)).toEqual({ kind: 'hub', book: 'Rev' });
  });

  it('highlights the entry at the given flat index (dict, then themes, then profiles, then books)', () => {
    results.dict = [{ id: 'd1', title: 'D1' }];
    results.themes = [{ title: 'T1', book: 'Gen', ref: '1:1' }];
    const { container } = render(SearchSurface, { q: 'a', highlight: 1 });
    const entries = [...container.querySelectorAll('.entry')];
    expect(entries[0].classList.contains('hi')).toBe(false);
    expect(entries[1].classList.contains('hi')).toBe(true);
  });
});
