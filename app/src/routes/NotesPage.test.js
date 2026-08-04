import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { addNote, _clearAllForTest } from '../lib/store.js';
import NotesPage from './NotesPage.svelte';

// Seed a memo with explicit timestamps. addNote stamps "now", so overwrite afterwards through the
// same store the page reads.
async function seed({ body, created, updated = created }) {
  const note = await addNote({ target_type: 'free', ref: null, body });
  const { openDB } = await import('idb');
  const db = await openDB('deepverse', 1);
  await db.put('notes', { ...note, created_at: created, updated_at: updated });
  return note;
}

const bodies = () => screen.getAllByRole('button')
  .map((b) => b.textContent.trim())
  .filter((t) => t.startsWith('memo '));

describe('NotesPage sorting', () => {
  beforeEach(async () => {
    await _clearAllForTest();
    // "memo old" was written first but edited most recently — the two orders disagree, which is the
    // whole point of offering both.
    await seed({ body: 'memo old', created: '2026-01-01T04:00:00.000Z', updated: '2026-08-04T04:00:00.000Z' });
    await seed({ body: 'memo new', created: '2026-07-01T04:00:00.000Z' });
  });

  it('defaults to most recently updated first', async () => {
    render(NotesPage);
    await waitFor(() => expect(bodies().length).toBe(2));
    expect(bodies()[0]).toContain('memo old');
  });

  it('sorts by creation date when asked', async () => {
    render(NotesPage);
    await waitFor(() => expect(bodies().length).toBe(2));
    await fireEvent.change(screen.getByTitle('Sort memos'), { target: { value: 'created_at:desc' } });
    await waitFor(() => expect(bodies()[0]).toContain('memo new'));
  });

  it('reverses the order on an oldest-first choice', async () => {
    render(NotesPage);
    await waitFor(() => expect(bodies().length).toBe(2));
    await fireEvent.change(screen.getByTitle('Sort memos'), { target: { value: 'updated_at:asc' } });
    await waitFor(() => expect(bodies()[0]).toContain('memo new'));
  });
});
