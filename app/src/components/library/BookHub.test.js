import { describe, it, expect, beforeAll } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import fs from 'node:fs';
import initSqlJs from 'sql.js';
import { _setDbForTest } from '../../lib/db.js';
import BookHub from './BookHub.svelte';

// Load the real built bible.db once, same as db.queries.test.js (fs, not fetch — vitest has no
// server for a 150 MB file).
beforeAll(async () => {
  const SQL = await initSqlJs();
  const path = fs.existsSync('public/bible.db') ? 'public/bible.db' : '../data/bible.db';
  const buf = fs.readFileSync(path);
  _setDbForTest(new SQL.Database(new Uint8Array(buf)));
});

describe('BookHub', () => {
  // Every route into a hub today goes through the Books index or search, both of which destroy and
  // recreate BookHub (a 'route' or 'search' frame sits between one hub and the next) — so this
  // re-collapse guard is never actually exercised by clicking through the app. The path map
  // (Task 14) doesn't change that: its branches come from dict_xref, which only connects articles,
  // so jumpFrom there can never push a 'hub' node onto an already-mounted BookHub either. Nothing
  // shipped reaches this effect — it's a defensive guard. Pin it here instead.
  it('re-collapses the full introduction when the book prop changes on the same instance', async () => {
    const { getByText, rerender } = render(BookHub, { book: 'Rev' });
    await fireEvent.click(getByText('Read more'));
    expect(getByText('Read less')).toBeTruthy();

    await rerender({ book: 'Gen' });
    expect(getByText('Read more')).toBeTruthy(); // re-collapsed, not stuck open on the new book
  });

  // Regression: hub.intro carries its own '## Heading' structure (Setting, Summary, …), same as
  // a dictionary article body. The expanded view must render that structure, not dump it as text.
  it('renders the expanded introduction as structured blocks, not raw "## Heading" markdown', async () => {
    const { getByText, container } = render(BookHub, { book: 'Rev' });
    await fireEvent.click(getByText('Read more'));
    expect(container.textContent).not.toMatch(/##\s/);
  });
});
