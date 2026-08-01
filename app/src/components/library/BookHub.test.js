import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import fs from 'node:fs';
import initSqlJs from 'sql.js';
import { _setDbForTest } from '../../lib/db.js';
import { lib, resetLibrary } from '../../lib/library.svelte.js';
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
  beforeEach(() => resetLibrary());

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

  // Whole-branch-review Fix 3: getBookHub's articles list is LIMIT 12, but the label used to read
  // "Dictionary articles citing this book most · 12" — the exact same "· N" grammar as the true
  // totals (Themes/Profiles) beside it, on a number that is actually just the cap. Revelation
  // really has 263 articles citing it, Genesis 874 — both silently rendered as "12".
  describe('the "Dictionary articles citing this book most" count', () => {
    it('shows a truncation marker for a book with more than 12 citing articles (Revelation: 263)', () => {
      const { getByText } = render(BookHub, { book: 'Rev' });
      expect(getByText(/Dictionary articles citing this book most/).textContent)
        .toContain('12+');
      expect(getByText(/Dictionary articles citing this book most/).textContent)
        .not.toBe('Dictionary articles citing this book most · 12');
    });

    it('shows the real, untruncated count for a book with fewer than 12 (3 John: 9)', () => {
      const { getByText } = render(BookHub, { book: '3John' });
      expect(getByText(/Dictionary articles citing this book most/).textContent)
        .toContain('· 9');
    });
  });

  // Whole-branch-review Fix 4: on every other route, a theme/profile chip opens its passage
  // (PassageIndex, SearchSurface). BookHub's own theme/profile chips predated PassageSurface and
  // were left as inert <span>s — 8 of Revelation's 9 passage items were a dead end on "the one
  // route where the data supports a destination". They must now push the same node shape
  // PassageIndex's openPassage does: { kind: 'passage', pkind, title, book }.
  describe('theme and profile chips open their passage', () => {
    it('clicking a theme chip pushes a passage node matching PassageIndex\'s shape', async () => {
      const { getByRole } = render(BookHub, { book: 'Rev' });
      const btn = getByRole('button', { name: /Symbolic Numbers/ });
      expect(btn.tagName).toBe('BUTTON');
      await fireEvent.click(btn);
      expect(lib.stack.at(-1)).toEqual({ kind: 'passage', pkind: 'theme', title: 'Symbolic Numbers', book: 'Rev' });
    });

    it('clicking a profile chip pushes a passage node matching PassageIndex\'s shape', async () => {
      const { getByRole } = render(BookHub, { book: 'Rev' });
      const btn = getByRole('button', { name: /Roman Emperors/ });
      expect(btn.tagName).toBe('BUTTON');
      await fireEvent.click(btn);
      expect(lib.stack.at(-1)).toEqual({ kind: 'passage', pkind: 'profile', title: 'Roman Emperors', book: 'Rev' });
    });
  });
});
