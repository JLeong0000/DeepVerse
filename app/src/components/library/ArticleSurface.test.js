import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ArticleSurface from './ArticleSurface.svelte';

// db.js is mocked so this test doesn't need the 150 MB bible.db: ArticleSurface only reads
// getArticle/getArticleSupplements/getXrefs/getRefPreview from it, and RefText (rendered inside
// ArticleView) reads verseExists — both stubbed with static data below.
const { article, supplements, go } = vi.hoisted(() => ({
  article: { id: 'Host', title: 'Host', body: 'Cites Gen 1:1 in the body.', n_refs: 1, kind: 'article' },
  supplements: [{ id: 's1', title: 'A Textbox', kind: 'textbox', is_html: 0, body: 'Cites Rom 5:1 in a box.' }],
  go: vi.fn(),
}));

vi.mock('../../lib/db.js', () => ({
  getArticle: () => article,
  getArticleSupplements: () => supplements,
  getXrefs: () => ({ out: [], in: [], missing: [] }),
  getRefPreview: () => '',
  verseExists: () => true,
}));

// The real router.svelte.js has no DB dependency, but stubbing `go` here is what lets the test
// observe whether ArticleSurface actually wires it in, rather than inferring it from a side effect.
vi.mock('../../lib/router.svelte.js', () => ({ go }));

// jsdom has no scroll layout, so it doesn't implement scrollIntoView at all; ArticleSurface's own
// anchor-scroll effect calls it on every render regardless of this test's concerns.
Element.prototype.scrollIntoView = () => {};

// Regression guard for the round-2 defect (commit 4598be2): ArticleSurface used to render its
// <ArticleView> without `onnavigate`, so a scripture ref clicked inside a supplement (which has no
// preview surface, so `onref` is never forwarded to it — see ArticleView.test.js) fell through
// RefText's default jump, silently moved Study's shared state, and called `onnavigate?.()` into
// nothing. Unlike ArticleView.test.js's own dual-path test, this one renders ArticleSurface
// itself, so removing `onnavigate={() => go('study')}` from ArticleSurface.svelte turns it red.
describe('ArticleSurface', () => {
  it('wires a working onnavigate into ArticleView, so a supplement ref click actually navigates to Study', async () => {
    const { getByRole } = render(ArticleSurface, { id: 'Host' });
    await fireEvent.click(getByRole('button', { name: 'Rom 5:1' }));
    expect(go).toHaveBeenCalledWith('study');
  });
});
