import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { resetLibrary, lib } from '../../lib/library.svelte.js';
import PassageIndex from './PassageIndex.svelte';

// Only the profile route is exercised here: the theme route renders the same entry markup without
// the badge, and the grouping it adds is a projection of getThemeIndex's order, tested there.
vi.mock('../../lib/db.js', () => ({
  getThemeIndex: () => [],
  getProfileIndex: () => [
    { title: 'Rahab', book: 'Josh', ref: '2:1-21', alsoArticle: 'RahabPerson' },
    { title: 'Adam and Eve', book: 'Gen', ref: '2:7–4:2', alsoArticle: null },
  ],
}));

beforeEach(resetLibrary);

describe('PassageIndex', () => {
  // The badge announced a second door to the same subject and did nothing when clicked; the id it
  // needs was already on the row getProfileIndex returns.
  it('opens the dictionary twin from the badge, without also opening the profile', async () => {
    const { getByText } = render(PassageIndex, { kind: 'profiles' });
    await fireEvent.click(getByText('also a dictionary article'));
    expect(lib.stack.at(-1)).toMatchObject({ kind: 'article', id: 'RahabPerson', title: 'Rahab' });
    expect(lib.stack).toHaveLength(2);   // start + the article, not the profile as well
  });

  it('shows no badge for a profile with no twin', () => {
    const { getAllByText } = render(PassageIndex, { kind: 'profiles' });
    expect(getAllByText('also a dictionary article')).toHaveLength(1);
  });
});
