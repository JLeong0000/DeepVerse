import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ArticleSurface from './ArticleSurface.svelte';

// db.js is mocked so this test doesn't need the 150 MB bible.db: ArticleSurface only reads
// getArticle/getArticleSupplements/getXrefs/getRefPreview from it, and RefText (rendered inside
// ArticleView) reads verseExists — both stubbed with static data below. `current` is mutable so an
// individual test can swap in a different article/xrefs shape without a separate module registry.
const { current, supplements, go } = vi.hoisted(() => ({
  current: {
    article: { id: 'Host', title: 'Host', body: 'Cites Gen 1:1 in the body.', n_refs: 1, kind: 'article' },
    xrefs: { out: [], in: [], missing: [] },
  },
  supplements: [{ id: 's1', title: 'A Textbox', kind: 'textbox', is_html: 0, body: 'Cites Rom 5:1 in a box.' }],
  go: vi.fn(),
}));

vi.mock('../../lib/db.js', () => ({
  getArticle: () => current.article,
  getArticleSupplements: () => supplements,
  getXrefs: () => current.xrefs,
  getRefPreview: () => '',
  verseExists: () => true,
}));

// The real router.svelte.js has no DB dependency, but stubbing `go` here is what lets the test
// observe whether ArticleSurface actually wires it in, rather than inferring it from a side effect.
vi.mock('../../lib/router.svelte.js', () => ({ go }));

// jsdom has no scroll layout, so it doesn't implement scrollIntoView at all; ArticleSurface's own
// anchor-scroll effect calls it on every render regardless of this test's concerns.
Element.prototype.scrollIntoView = () => {};

// Tests below the first describe mutate `current` directly; reset to the default Host article
// before each test so ordering between describe blocks can never leak state.
beforeEach(() => {
  current.article = { id: 'Host', title: 'Host', body: 'Cites Gen 1:1 in the body.', n_refs: 1, kind: 'article' };
  current.xrefs = { out: [], in: [], missing: [] };
});

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

// Regression for the whole-branch-review fix: Garlic, Jerubbesheth and Jezaniah end their body in
// a "See X; Y" clause the build-side resolver's regex doesn't catch, so dict_xref (and therefore
// getXrefs().out) holds no rows for them — but the UI's own clause regex still renders the clause,
// as two `.xdead` spans, right above the "Where this leads" box. Before this fix that box said "A
// dead end — this article names no other entry" directly under a paragraph visibly naming two.
describe('ArticleSurface — unresolved "See …" clause with empty dict_xref (Garlic/Jerubbesheth/Jezaniah)', () => {
  it('does not claim the article names no other entry when the body visibly names two', () => {
    current.article = {
      id: 'Garlic', title: 'Garlic', n_refs: 1, kind: 'article',
      body: 'Bulbous herb cultivated for use in cooking (Nm 11:5) See Food and Food Preparation; Plants (Onion).',
    };
    current.xrefs = { out: [], in: [], missing: [] };
    const { container, queryByText } = render(ArticleSurface, { id: 'Garlic' });
    expect(queryByText(/A dead end — this article names no other entry/)).toBeNull();
    expect(container.querySelector('.xdead')).toBeTruthy();
  });

  it('still shows the genuine dead-end message for an article with no clause at all', () => {
    current.article = { id: 'Host', title: 'Host', body: 'Cites Gen 1:1 in the body.', n_refs: 1, kind: 'article' };
    current.xrefs = { out: [], in: [], missing: [] };
    const { queryByText } = render(ArticleSurface, { id: 'Host' });
    expect(queryByText(/A dead end — this article names no other entry/)).toBeTruthy();
  });
});
