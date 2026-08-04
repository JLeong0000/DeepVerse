import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { resetLibrary, lib } from '../../lib/library.svelte.js';
import PassageSurface from './PassageSurface.svelte';

// db.js is mocked so this test doesn't need the 150 MB bible.db: PassageSurface reads getPassage
// and getPassageLinks from it, and RefText (rendered inside ArticleView) reads verseExists — all
// stubbed with static data below. `links` is reassigned per test; the real shapes both queries
// return are covered in db.queries.test.js.
const { passage, links, go } = vi.hoisted(() => ({
  passage: { kind: 'theme', title: 'Holy War', book: 'Deut', ref: '7:1-6',
    body: 'Cites Exod 19:5-6 in the body.', start_chapter: 7, start_verse: 1 },
  links: { current: { passages: [], article: null } },
  go: vi.fn(),
}));

vi.mock('../../lib/db.js', () => ({
  getPassage: () => passage,
  getPassageLinks: () => links.current,
  verseExists: () => true,
}));

beforeEach(() => {
  resetLibrary();
  links.current = { passages: [], article: null };
});

// The real router.svelte.js has no DB dependency, but stubbing `go` here is what lets the test
// observe whether PassageSurface actually wires it in, rather than inferring it from a side effect.
vi.mock('../../lib/router.svelte.js', () => ({ go }));

// Regression guard: PassageSurface used to render its <ArticleView> without `onnavigate`, so a
// scripture ref clicked inside a theme/profile body (which has no preview surface, so `onref` is
// never forwarded to it — see ArticleView.test.js) fell through RefText's default jump, silently
// moved Study's shared state, and called `onnavigate?.()` into nothing. Same defect Task 12 needed
// a fix round for in ArticleSurface, in a different caller of ArticleView.
describe('PassageSurface', () => {
  it('wires a working onnavigate into ArticleView, so a body scripture ref click actually navigates to Study', async () => {
    const { getByRole } = render(PassageSurface, { pkind: 'theme', title: 'Holy War' });
    await fireEvent.click(getByRole('button', { name: 'Exod 19:5-6' }));
    expect(go).toHaveBeenCalledWith('study');
  });

  it('opens an overlapping passage as a passage node, carrying the pkind the door was labelled with', async () => {
    links.current = { passages: [{ kind: 'profile', title: 'Moses', book: 'Deut', ref: '1:1' }], article: null };
    const { getByRole } = render(PassageSurface, { pkind: 'theme', title: 'Holy War' });
    await fireEvent.click(getByRole('button', { name: /Moses/ }));
    expect(lib.stack.at(-1)).toMatchObject({ kind: 'passage', pkind: 'profile', title: 'Moses', book: 'Deut' });
  });

  it('opens the dictionary twin as an article node, not as a passage', async () => {
    links.current = { passages: [], article: { id: 'RahabPerson', title: 'Rahab (Person)' } };
    const { getByRole } = render(PassageSurface, { pkind: 'profile', title: 'Rahab' });
    await fireEvent.click(getByRole('button', { name: /Rahab/ }));
    expect(lib.stack.at(-1)).toMatchObject({ kind: 'article', id: 'RahabPerson' });
  });

  it('says so plainly when the anchor leads nowhere, rather than showing an empty box', () => {
    const { getByText, queryByRole } = render(PassageSurface, { pkind: 'theme', title: 'Holy War' });
    expect(getByText(/A dead end/)).toBeTruthy();
    expect(queryByRole('button', { name: /Theme ·/ })).toBeNull();
  });
});
