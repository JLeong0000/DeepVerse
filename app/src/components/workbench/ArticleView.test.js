import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import ArticleView from './ArticleView.svelte';
import { TYNDALE_DICTIONARY, TYNDALE_STUDY_NOTES, TYNDALE_CHANGES, TYNDALE_NOTES_CHANGES }
  from '../../lib/sources.js';

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
  it('linkifies both targets and keeps the "; " separator', () => {
    const xrefs = {
      out: [{ id: 'Antichrist', title: 'Antichrist', raw: 'Antichrist', anchor: null },
            { id: 'Armageddon', title: 'Armageddon', raw: 'Armageddon', anchor: null }],
      in: [],
    };
    const { getByRole, container } = render(ArticleView, { article, xrefs });
    expect(getByRole('button', { name: 'Antichrist' })).toBeTruthy();
    expect(getByRole('button', { name: 'Armageddon' })).toBeTruthy();
    expect(container.querySelector('.mbody').textContent)
      .toBe('Example prose about the topic. See Antichrist; Armageddon.');
  });

  // One link naming two subheads. The build stores it as a single edge whose `raw` contains the
  // semicolon; splitting the clause on ';' produced a broken "Birds (Fowl, Domestic" link and an
  // orphan "Partridge)" that the app announced as missing from the dictionary.
  it('renders a target whose own text contains a semicolon as one link', () => {
    const brood = {
      id: 'Brood', title: 'Brood', n_refs: 0,
      body: 'Young birds. See Birds (Fowl, Domestic; Partridge). Also used of vipers.',
    };
    const xrefs = {
      out: [{ id: 'Birds', title: 'Birds', raw: 'Birds (Fowl, Domestic; Partridge)',
              anchor: 'Fowl, Domestic' }],
      in: [],
    };
    const { container } = render(ArticleView, { article: brood, xrefs });
    expect([...container.querySelectorAll('.xref')].map((e) => e.textContent))
      .toEqual(['Birds (Fowl, Domestic; Partridge)']);
    expect(container.querySelector('.mbody').textContent).toBe(brood.body);
  });

  // The invariant that keeps this component and the build from disagreeing: linkification is driven
  // by dict_xref alone. "Armageddon" is named in the prose but recorded nowhere, so it must render
  // as ordinary text. Previously the component matched the clause itself and marked such a run as
  // an entry the corpus lacked — a claim it had no basis to make.
  it('leaves a target the build recorded nothing for as ordinary prose', () => {
    const xrefs = {
      out: [{ id: 'Antichrist', title: 'Antichrist', raw: 'Antichrist', anchor: null }],
      in: [],
    };
    const { container, getByRole } = render(ArticleView, { article, xrefs });
    expect(getByRole('button', { name: 'Antichrist' })).toBeTruthy();
    expect([...container.querySelectorAll('.xref')].map((e) => e.textContent)).toEqual(['Antichrist']);
    expect(container.querySelector('.mbody').textContent)
      .toBe('Example prose about the topic. See Antichrist; Armageddon.');
  });

  // A "(See …)" aside is a scripture citation or an in-article pointer, never an entry. The source
  // marks up no ?item= link inside one, so the build records nothing and there is nothing to match.
  // 7 in the corpus.
  it('never linkifies a parenthetical "(See …)" aside', () => {
    const aside = {
      id: 'BibleCanonofthe', title: 'Bible, Canon of the', n_refs: 0,
      body: 'Read aloud. (See also Col 4:16; Rv 1:3.) Later readers disagreed. See Antichrist.',
    };
    const xrefs = {
      out: [{ id: 'Antichrist', title: 'Antichrist', raw: 'Antichrist', anchor: null }],
      in: [],
    };
    const { container } = render(ArticleView, { article: aside, xrefs });
    // the only cross-reference link is the real clause at the end, not anything in the aside
    expect([...container.querySelectorAll('.xref')].map((e) => e.textContent)).toEqual(['Antichrist']);
    expect(container.querySelector('.mbody').textContent).toBe(aside.body);
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

  // ArticleSurface wires both onref (main-body preview) and onnavigate (supplement jump) on the
  // same ArticleView instance. A main-body ref must only ever go through onref — RefText's early
  // return means onnavigate should never fire for it — and a supplement ref must only ever go
  // through onnavigate, never onref (there is no onref to reach it after the round-1 fix). A click
  // that silently overwrote study state while looking inert (a supplement ref with no onnavigate
  // wired) is exactly the failure this pins.
  it('routes a main-body ref through onref and a supplement ref through onnavigate, never crossed', () => {
    const hostArticle = { id: 'Host', title: 'Host', n_refs: 1, body: 'Cites Gen 1:1 in the body.' };
    const supplements = [{ id: 's1', title: 'A Textbox', kind: 'textbox', is_html: 0,
      body: 'Cites Rom 5:1 in a box.' }];
    const onrefCalls = [];
    const onnavigateCalls = [];
    const { getByRole } = render(ArticleView, {
      article: hostArticle, supplements,
      onref: (ref, i) => onrefCalls.push({ ref, i }),
      onnavigate: () => onnavigateCalls.push(true),
    });

    getByRole('button', { name: 'Gen 1:1' }).click();
    expect(onrefCalls).toHaveLength(1);
    expect(onnavigateCalls).toHaveLength(0);

    getByRole('button', { name: 'Rom 5:1' }).click();
    expect(onnavigateCalls).toHaveLength(1);
    expect(onrefCalls).toHaveLength(1); // unchanged — the supplement click never reached onref
  });
  // A study note reaches ArticleView through the Context card's overlay, and writes its links in a
  // shape no dictionary article uses: a quoted “Title”, not a "See …" clause. Same underline, same
  // button, different splitter — and the note's own callback, so a passage door can never be
  // mistaken for a dict_xref id.
  it('renders a study note\u2019s quoted target as a door, and hands the passage back whole', () => {
    const note = { id: 'passage:Gen 1:22', title: 'Genesis 1:22', book: 'Gen',
      body: 'God\u2019s blessing commissions (see \u201cBlessing\u201d Theme Note). \u2022 The birds are fertile.' };
    const noteLinks = [{ raw: 'Blessing', pkind: 'theme', ptitle: 'Blessing', pbook: 'Gen' }];
    const opened = [];
    const { getByRole, queryByRole } = render(ArticleView, {
      article: note, noteLinks, onnotelink: (p) => opened.push(p),
      onxref: () => opened.push('WRONG CALLBACK'),
    });

    getByRole('button', { name: '\u201cBlessing\u201d' }).click();
    expect(opened).toEqual([expect.objectContaining({ pkind: 'theme', ptitle: 'Blessing', pbook: 'Gen' })]);
    // the bare word later in the same sentence is prose, not a second door
    expect(queryByRole('button', { name: 'blessing' })).toBeNull();
  });
  // CC BY-SA obliges the changes statement to be true of the work it sits under. It used to be
  // rendered unconditionally, so all 423 themes and profiles carried the dictionary's corrections
  // — three fixes to scripture links in articles none of them contain.
  it('states the changes of the source it was actually given, not the dictionary\u2019s', () => {
    const passage = { title: 'The Creation', body: 'A theme, from the study-notes package.', book: 'Gen' };
    const { getByText, queryByText } = render(ArticleView, { article: passage, source: TYNDALE_STUDY_NOTES });
    expect(getByText(TYNDALE_STUDY_NOTES)).toBeTruthy();
    expect(getByText(TYNDALE_NOTES_CHANGES)).toBeTruthy();
    expect(queryByText(TYNDALE_CHANGES)).toBeNull();
  });

  it('falls back to the dictionary and its changes when no source is named', () => {
    const article = { id: 'Beast', title: 'Beast', n_refs: 0, body: 'A dictionary article.' };
    const { getByText } = render(ArticleView, { article });
    expect(getByText(TYNDALE_DICTIONARY)).toBeTruthy();
    expect(getByText(TYNDALE_CHANGES)).toBeTruthy();
  });
});
