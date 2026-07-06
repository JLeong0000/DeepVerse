import { test, expect, beforeEach, describe } from 'vitest';
import * as store from './store.js';

beforeEach(async () => { await store._clearAllForTest(); });

describe('notes (IndexedDB)', () => {
  test('add / recent / notesForRef / export→import round-trip', async () => {
    const a = await store.addNote({ target_type: 'verse', ref: 'John.12.25', body: 'psyche' });
    await store.addNote({ target_type: 'chapter', ref: 'Gen.1', body: 'bara' });
    expect((await store.recentNotes(6)).length).toBe(2);
    expect((await store.recentNotes(1))[0].id).toBeTruthy();
    expect((await store.notesForRef('John.12.25')).map(n => n.body)).toEqual(['psyche']);

    const json = await store.exportNotes();
    await store.deleteNote(a.id);
    expect((await store.allNotes()).length).toBe(1);
    await store.importNotes(json); // merges the deleted one back by id
    expect((await store.allNotes()).length).toBe(2);
  });
  test('updateNote changes body and bumps updated_at', async () => {
    const n = await store.addNote({ target_type: 'verse', ref: 'John.3.16', body: 'x' });
    const u = await store.updateNote(n.id, 'y');
    expect(u.body).toBe('y');
    expect(u.updated_at >= n.updated_at).toBe(true);
  });
});

describe('reading activity', () => {
  test('recordRead increments today; chaptersRead + daysThisYear', () => {
    store.recordRead('John', 3);
    store.recordRead('John', 4);
    expect(store.chaptersRead()).toBe(2);
    expect(store.daysThisYear()).toBe(1);
  });
  test('streak counts consecutive days ending today/yesterday', () => {
    const iso = (d) => d.toISOString().slice(0, 10);
    const today = new Date();
    const y1 = new Date(); y1.setDate(today.getDate() - 1);
    const y2 = new Date(); y2.setDate(today.getDate() - 2);
    const gap = new Date(); gap.setDate(today.getDate() - 5);
    localStorage.setItem('reading_activity', JSON.stringify({ [iso(today)]: 1, [iso(y1)]: 2, [iso(y2)]: 1, [iso(gap)]: 1 }));
    expect(store.streak()).toBe(3);
  });
});

describe('to-study', () => {
  test('add / active / archive flow', () => {
    const it = store.addStudy('trace psyche in John');
    store.addStudy('agape vs phileo');
    expect(store.activeStudy().length).toBe(2);
    store.archiveStudy(it.id);
    expect(store.activeStudy().length).toBe(1);
    const arch = store.archivedStudy();
    expect(arch.length).toBe(1);
    expect(arch[0].completed_at).toBeTruthy();
  });
  test('edit + delete', () => {
    const it = store.addStudy('a');
    store.editStudy(it.id, 'b');
    expect(store.activeStudy()[0].text).toBe('b');
    store.deleteStudy(it.id);
    expect(store.activeStudy().length).toBe(0);
  });
});
