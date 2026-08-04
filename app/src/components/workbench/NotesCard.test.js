import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import { addNote, _clearAllForTest } from '../../lib/store.js';
import { study } from '../../lib/study.svelte.js';
import NotesCard from './NotesCard.svelte';

describe('NotesCard', () => {
  beforeEach(async () => {
    await _clearAllForTest();
    study.book = 'John';
    study.chapter = 3;
    study.verse = 16;
    study.verseEnd = null;
  });

  it('shows when each memo was last touched', async () => {
    await addNote({ target_type: 'verse', ref: 'John.3.16', body: 'the hinge of the chapter' });
    render(NotesCard);
    await waitFor(() => expect(screen.getByText('the hinge of the chapter')).toBeTruthy());
    expect(screen.getByText('created today')).toBeTruthy();
  });
});
