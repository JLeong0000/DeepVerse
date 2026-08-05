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
    xrefs: { out: [], in: [] },
  },
  supplements: [{ id: 's1', title: 'A Textbox', kind: 'textbox', is_html: 0, body: 'Cites Rom 5:1 in a box.' }],
  go: vi.fn(),
}));

vi.mock('../../lib/db.js', () => ({
  getArticle: () => current.article,
  getArticleSupplements: () => supplements,
  getXrefs: () => current.xrefs,
  getRefPreview: () => current.preview ?? { text: 'In the beginning…', version: 'NIV' },
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
  current.xrefs = { out: [], in: [] };
  current.preview = null;
});

// The preview box is where DeepVerse either surfaces a textual difference or hides it behind what
// looks like a rendering bug. Three cases, all reachable from real articles.
describe('ArticleSurface — verse preview when the NIV lacks the verse', () => {
  it('labels a fallback with the version it came from and says why', async () => {
    // "Heart" links Acts 8:37, which the NIV has no row for and the NKJV does
    current.article = { id: 'Heart', title: 'Heart', n_refs: 1, kind: 'article',
      body: 'A whole, true heart (Acts 8:37).' };
    current.preview = { text: 'Then Philip said, “If you believe…”', version: 'NKJV' };
    const { getByRole, container, queryByText } = render(ArticleSurface, { id: 'Heart' });
    await fireEvent.click(getByRole('button', { name: 'Acts 8:37' }));
    expect(container.querySelector('.pr').textContent).toContain('NKJV');
    expect(queryByText(/absent from the earliest Greek manuscripts/)).toBeTruthy();
    // still openable — we have the text, just not from the NIV
    expect(getByRole('button', { name: /Open in Study/ })).toBeTruthy();
  });

  // DeepVerse reads the 66 canonical books, so a deuterocanonical citation opens nothing here at
  // all — it is prose with the book's own note on hover (see RefText.test.js). This surface used to
  // preview it from the KJV Apocrypha; that is what the decision of 2026-08-05 withdrew, and the
  // preview must not come back for it.
  it('does not preview an apocryphal citation, because it is no longer a link', async () => {
    // "Gabatha" cites Add Est 12:1 — the Greek Additions, carried only by the KJV Apocrypha
    current.article = { id: 'Gabatha', title: 'Gabatha', n_refs: 1, kind: 'article',
      body: 'Alternate name for Bigthan (Add Est 12:1).' };
    current.preview = { text: 'And Mardocheus took his rest in the court with Gabatha…', version: 'KJVA' };
    const { queryByRole, container, getByTitle } = render(ArticleSurface, { id: 'Gabatha' });
    expect(queryByRole('button', { name: 'Add Est 12:1' })).toBeNull();
    expect(getByTitle(/Greek Additions to Esther/)).toBeTruthy();   // the explanation survives
    expect(container.querySelector('.prev')).toBeNull();            // and no preview box exists
  });

  // A guard, not a live case: of the 33,497 references this surface still links, 0 are missing from
  // every edition. This pins what the box does if a future data change breaks that.
  it('explains an absence rather than rendering an empty box', async () => {
    current.preview = { text: '', version: null };
    const { getByRole, queryByRole, queryByText } = render(ArticleSurface, { id: 'Host' });
    await fireEvent.click(getByRole('button', { name: 'Gen 1:1' }));
    expect(queryByText(/No edition DeepVerse carries has this verse/)).toBeTruthy();
    expect(queryByRole('button', { name: /Open in Study/ })).toBeNull();
  });

  it('adds no note at all when the NIV has the verse', async () => {
    current.preview = { text: 'In the beginning…', version: 'NIV' };
    const { getByRole, container } = render(ArticleSurface, { id: 'Host' });
    await fireEvent.click(getByRole('button', { name: 'Gen 1:1' }));
    expect(container.querySelector('.pnote')).toBeNull();
    expect(container.querySelector('.pr').textContent).toContain('NIV');
  });
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

// Garlic's clause follows a citation's closing paren, which the build-side regex now matches, so
// dict_xref holds its two edges and the prose underlines them. This is the article that used to
// show "no such article exists" over two entries that do exist, and "A dead end" under a paragraph
// naming them — the two halves of that contradiction came from different tasks.
describe('ArticleSurface — a clause following a citation\'s closing paren (Garlic)', () => {
  it('underlines both targets and offers both doors, with no dead-end claim', () => {
    current.article = {
      id: 'Garlic', title: 'Garlic', n_refs: 1, kind: 'article',
      body: 'Bulbous herb cultivated for use in cooking (Nm 11:5) See Food and Food Preparation; Plants (Onion).',
    };
    current.xrefs = {
      out: [{ id: 'FoodandFoodPreparation', title: 'Food and Food Preparation',
              raw: 'Food and Food Preparation', anchor: null },
            { id: 'Plants', title: 'Plants', raw: 'Plants (Onion)', anchor: null }],
      in: [],
    };
    const { container, queryByText } = render(ArticleSurface, { id: 'Garlic' });
    expect(queryByText(/A dead end — this article names no other entry/)).toBeNull();
    
    expect([...container.querySelectorAll('.xref')].map((e) => e.textContent))
      .toEqual(['Food and Food Preparation', 'Plants (Onion)']);
    // the source's own "; " spacing, and its trailing period, survive the linkified render
    expect(container.querySelector('.mbody').textContent).toBe(current.article.body);
  });

  // Ahiah's one target used to be reported as absent from the corpus. Its link points at the real
  // Ahijah article, so the article has a door like any other and no dead-end line.
  it('opens a door for a target whose link text differs from the article title', () => {
    current.article = {
      id: 'Ahiah', title: 'Ahiah', n_refs: 0, kind: 'article',
      body: 'KJV form of Ahijah. See Ahijah #1, #2, and #6.',
    };
    current.xrefs = {
      out: [{ id: 'Ahijah', title: 'Ahijah', raw: 'Ahijah #1, #2, and #6', anchor: null }],
      in: [],
    };
    const { container, queryByText } = render(ArticleSurface, { id: 'Ahiah' });
    expect(queryByText(/A dead end — this article names no other entry/)).toBeNull();
    expect(container.querySelector('.xref').textContent).toBe('Ahijah #1, #2, and #6');
    expect(container.querySelector('.door').textContent.trim()).toBe('Ahijah');
  });

  it('still shows the genuine dead-end message for an article with no clause at all', () => {
    current.article = { id: 'Host', title: 'Host', body: 'Cites Gen 1:1 in the body.', n_refs: 1, kind: 'article' };
    current.xrefs = { out: [], in: [] };
    const { queryByText } = render(ArticleSurface, { id: 'Host' });
    expect(queryByText(/A dead end — this article names no other entry/)).toBeTruthy();
  });
});
