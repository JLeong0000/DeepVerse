import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
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

  it('linkifies a resolved target and leaves an unresolved one as plain dead text', () => {
    const xrefs = {
      out: [{ id: 'Antichrist', title: 'Antichrist', raw: 'Antichrist', anchor: null }],
      in: [], missing: [],
    };
    const { getByRole, container } = render(ArticleView, { article, xrefs });
    expect(getByRole('button', { name: 'Antichrist' })).toBeTruthy();
    expect(container.querySelector('.xdead')?.textContent).toBe('Armageddon');
  });
});
