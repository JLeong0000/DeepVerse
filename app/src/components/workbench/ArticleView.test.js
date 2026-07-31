import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import ArticleView from './ArticleView.svelte';

const article = {
  id: 'Beast', title: 'Beast', n_refs: 3,
  body: 'Example prose about the topic. See Antichrist; Armageddon.',
};

describe('ArticleView', () => {
  // ArticleModal (the Context tab's overlay) passes neither xrefs nor onxref, so this is the exact
  // shape it renders with. If the clause ever linkified without xrefs, the Context tab would grow
  // buttons it never asked for.
  it('renders the "See …" clause as plain text when no xrefs are supplied', () => {
    const { container, queryByRole } = render(ArticleView, { article });
    expect(container.textContent).toContain('See Antichrist; Armageddon.');
    expect(queryByRole('button', { name: 'Antichrist' })).toBeNull();
  });

  // Regression: {#if k > 0}; {/if} had its trailing space trimmed by Svelte, so the linkified
  // clause read "See Antichrist;Armageddon." — the plain-text path above never exercises this
  // branch, so it passed while the reconstructed clause was actually corrupting Tyndale's text.
  it('linkifies a resolved target, leaves an unresolved one as plain dead text, and keeps the "; " separator', () => {
    const xrefs = {
      out: [{ id: 'Antichrist', title: 'Antichrist', raw: 'Antichrist', anchor: null }],
      in: [], missing: [],
    };
    const { getByRole, container } = render(ArticleView, { article, xrefs });
    expect(getByRole('button', { name: 'Antichrist' })).toBeTruthy();
    expect(container.querySelector('.xdead')?.textContent).toBe('Armageddon');
    expect(container.querySelector('.mbody').textContent)
      .toBe('Example prose about the topic. See Antichrist; Armageddon.');
  });

  // Regression: the preview used to be placed with `openToken && b.text.includes(openToken)`, a
  // substring test over block TEXT rather than an identity check — so a citation repeated across
  // more than one block (routine: "Dt 14:7" appears 4× in "Animals") popped the preview under
  // every block that happened to contain the same text, not just the one that was clicked.
  it('places the preview under the opened block only, even when another block cites the same verse', () => {
    const dup = {
      id: 'Dup', title: 'Dup', n_refs: 2,
      body: 'First paragraph cites John 3:16 here.\nSecond paragraph also mentions John 3:16 again.',
    };
    const marker = createRawSnippet(() => ({
      render: () => '<div class="previewmarker">preview</div>',
    }));
    const { container } = render(ArticleView, { article: dup, openIndex: 0, preview: marker });
    expect(container.querySelectorAll('.previewmarker').length).toBe(1);
  });

  // A chart supplement passes onnavigate but never onref: it has no preview surface, so forwarding
  // onref there would silently swallow the click (RefText's early return) instead of jumping.
  it('does not forward onref into supplement RefTexts (a jump, not a dead click)', () => {
    const withSupp = { id: 'Host', title: 'Host', n_refs: 0, body: 'Plain body, no citations here.' };
    const supplements = [{ id: 's1', title: 'A Textbox', kind: 'textbox', is_html: 0,
      body: 'See John 3:16 for more.' }];
    let jumped = false;
    const { getByRole } = render(ArticleView, {
      article: withSupp, supplements,
      onnavigate: () => { jumped = true; },
      onref: () => { throw new Error('onref must not be called from a supplement'); },
    });
    getByRole('button', { name: 'John 3:16' }).click();
    expect(jumped).toBe(true);
  });
});
