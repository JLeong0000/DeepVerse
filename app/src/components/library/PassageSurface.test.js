import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PassageSurface from './PassageSurface.svelte';

// db.js is mocked so this test doesn't need the 150 MB bible.db: PassageSurface only reads
// getPassage from it, and RefText (rendered inside ArticleView) reads verseExists — both stubbed
// with static data below.
const { passage, go } = vi.hoisted(() => ({
  passage: { kind: 'theme', title: 'Holy War', book: 'Deut', ref: '7:1-6',
    body: 'Cites Exod 19:5-6 in the body.', start_chapter: 7, start_verse: 1 },
  go: vi.fn(),
}));

vi.mock('../../lib/db.js', () => ({
  getPassage: () => passage,
  verseExists: () => true,
}));

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
});
