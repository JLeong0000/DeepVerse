import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import App from './App.svelte';

// App.svelte only needs loadDb to resolve; searchLibrary is what Library's search field and
// SearchSurface both read, and it must return enough of a shape for SearchSurface to render
// without crashing (empty result sets throughout — the history-entry count is what's under test,
// not the results themselves).
vi.mock('./lib/db.js', () => ({
  loadDb: () => Promise.resolve(),
  searchLibrary: (q) => ({
    dict: [], themes: [], profiles: [], books: [],
    dictTruncated: false, themesTruncated: false, profilesTruncated: false,
  }),
  getRandomArticle: () => null,
  verseExists: () => true,
  getTitles: () => new Map(),   // StartSurface resolves its recents through this
}));

// Regression for the whole-branch-review fix: libIdent used to fold a search node's `q` into the
// identity keyOf() compares against, so every keystroke (each one calling Library's onInput ->
// replaceTop, since a term change is deliberately not a new step) looked like a brand new library
// node to App.svelte's push-vs-replace effect, and it pushed a history entry per keystroke. The
// breadcrumb correctly held one crumb throughout; only the browser's own history spine was wrong.
describe('App — search term changes collapse to one history entry', () => {
  beforeEach(() => {
    // Land straight on the library route (rather than clicking there from Home) so the test never
    // has to stand up Home's own dependencies (WordOfDay, etc.) — App parses this hash synchronously
    // on import, before onMount, exactly the deep-link path applyHash exists for.
    history.replaceState(null, '', '#/library');
  });

  it('pushes exactly one history entry for a multi-character search term, not one per keystroke', async () => {
    const pushSpy = vi.spyOn(history, 'pushState');
    render(App);
    const input = await screen.findByPlaceholderText(/Search the library/);

    const pushesBeforeTyping = pushSpy.mock.calls.length;
    for (const ch of 'revelation') {
      await fireEvent.input(input, { target: { value: input.value + ch } });
    }

    const pushesFromTyping = pushSpy.mock.calls.length - pushesBeforeTyping;
    expect(pushesFromTyping).toBe(1);
    pushSpy.mockRestore();
  });
});
