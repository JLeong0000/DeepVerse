import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { resetLibrary, lib, pushNode } from '../lib/library.svelte.js';
import Library from './Library.svelte';

// Fixture spans all four groups so traversal has to cross group boundaries to reach the end:
// flat order (per flattenSearchResults) is D1, D2, T1, P1, Rev — 5 nodes, indices 0-4.
const { results } = vi.hoisted(() => ({
  results: {
    dict: [{ id: 'D1', title: 'D1' }, { id: 'D2', title: 'D2' }],
    themes: [{ title: 'T1', book: 'Gen', ref: '1:1' }],
    profiles: [{ title: 'P1', book: 'Josh', ref: '2:1' }],
    books: ['Rev'],
    dictTruncated: false, themesTruncated: false, profilesTruncated: false,
  },
}));
// Enter opening a result re-renders Library.svelte's surface for the pushed node — here a
// 'passage' node, so PassageSurface mounts and calls getPassage/verseExists. Stubbed minimally so
// that render doesn't throw; this test cares about which node got pushed, not PassageSurface itself.
vi.mock('../lib/db.js', () => ({
  searchLibrary: () => results,
  getRandomArticle: () => null,
  getPassage: () => ({ kind: 'theme', title: 'T1', book: 'Gen', ref: '1:1', body: '',
    start_chapter: 1, start_verse: 1 }),
  getPassageLinks: () => ({ passages: [], article: null }),
  verseExists: () => true,
  // enough for DictionaryIndex to mount when a 'route' node is the surface under test
  getDictLetters: () => [],
  getDictBrowse: () => [],
  getOrphanSupplements: () => [],
  getTitles: () => new Map(),   // StartSurface resolves recents through this
}));

// jsdom implements no scroll layout, so Element.prototype.scrollIntoView doesn't exist at all —
// same workaround ArticleSurface.test.js uses for its own scrollIntoView-calling effect.
Element.prototype.scrollIntoView = () => {};

beforeEach(() => {
  resetLibrary();
  pushNode({ kind: 'search', q: 'test' });   // current.kind === 'search' before Library even mounts
});

describe('Library.svelte search keyboard traversal', () => {
  it('ArrowDown moves the highlight forward across group boundaries (dict -> themes)', async () => {
    const { container, getByPlaceholderText } = render(Library);
    const input = getByPlaceholderText(/search the library/i);
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    const entries = [...container.querySelectorAll('.entry')];
    expect(entries.map((e) => e.classList.contains('hi'))).toEqual([false, false, true, false, false]);
  });

  it('ArrowDown clamps at the last result rather than wrapping', async () => {
    const { container, getByPlaceholderText } = render(Library);
    const input = getByPlaceholderText(/search the library/i);
    for (let i = 0; i < 8; i++) await fireEvent.keyDown(input, { key: 'ArrowDown' });   // far past the end
    const entries = [...container.querySelectorAll('.entry')];
    expect(entries.at(-1).classList.contains('hi')).toBe(true);
    expect(entries.filter((e) => e.classList.contains('hi'))).toHaveLength(1);
  });

  it('ArrowUp clamps at the first result rather than wrapping', async () => {
    const { container, getByPlaceholderText } = render(Library);
    const input = getByPlaceholderText(/search the library/i);
    for (let i = 0; i < 8; i++) await fireEvent.keyDown(input, { key: 'ArrowUp' });   // already at 0
    const entries = [...container.querySelectorAll('.entry')];
    expect(entries[0].classList.contains('hi')).toBe(true);
    expect(entries.filter((e) => e.classList.contains('hi'))).toHaveLength(1);
  });

  it('Enter pushes the node the current highlight names, not just any result', async () => {
    const { getByPlaceholderText } = render(Library);
    const input = getByPlaceholderText(/search the library/i);
    // move onto T1 (flat index 2: past both dict rows) before opening it
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(lib.stack.at(-1)).toEqual({ kind: 'passage', pkind: 'theme', title: 'T1', book: 'Gen' });
  });

  // Regression: Library.svelte's frame-level '/' focus shortcut and the new arrow/Enter handler
  // both listen for keydown (one on window, one on the input) — '/' typed while already inside the
  // field must still reach the input as a literal character, not get preventDefault()'d away.
  it('does not swallow a literal "/" typed into the search field', async () => {
    const { getByPlaceholderText } = render(Library);
    const input = getByPlaceholderText(/search the library/i);
    input.focus();
    const notPrevented = await fireEvent.keyDown(input, { key: '/' });
    expect(notPrevented).toBe(true);   // fireEvent returns false only if some handler called preventDefault()
  });
});

// Sharing the search row on every surface made ✦ Wander in read as the field's submit button —
// the thing Enter would press — when it does the opposite of searching. It now belongs to the
// start of a trail only, and the "or" is what marks the two as alternatives.
describe('Library.svelte ✦ Wander in placement', () => {
  it('offers Wander beside search, separated by "or", at the start of a trail', () => {
    resetLibrary();   // beforeEach left a search node on the stack
    const { container, getByText } = render(Library);
    expect(container.querySelector('button.wander')).toBeTruthy();
    expect(getByText('or')).toBeTruthy();
  });

  it('withdraws Wander once the trail has moved off the start', () => {
    for (const node of [{ kind: 'search', q: 'test' }, { kind: 'route', route: 'dict' }]) {
      resetLibrary();
      pushNode(node);
      const { container } = render(Library);
      expect(container.querySelector('button.wander')).toBeNull();
      expect(container.querySelector('.orsep')).toBeNull();
    }
  });
});
