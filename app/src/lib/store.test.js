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

describe('profile (notes + settings)', () => {
  test('export → wipe → import restores notes (merge) and settings', async () => {
    await store.addNote({ target_type: 'free', ref: null, body: 'keep me' });
    localStorage.setItem('prefs.theme', 'dark');
    store.addStudy('agape vs phileo');
    store.recordRead('John', 3);

    const json = await store.exportProfile();
    await store._clearAllForTest();
    localStorage.setItem('prefs.theme', 'light'); // a stale value the import should overwrite

    await store.importProfile(json);
    expect((await store.allNotes()).map(n => n.body)).toEqual(['keep me']);
    expect(localStorage.getItem('prefs.theme')).toBe('dark');
    expect(store.activeStudy().map(i => i.text)).toEqual(['agape vs phileo']);
    expect(store.chaptersRead()).toBe(1);
  });

  test('importProfile ignores settings keys outside the whitelist', async () => {
    const json = JSON.stringify({
      format: 'deepverse-profile', version: 1, notes: [],
      settings: { 'prefs.theme': 'dark', evil_key: 'nope' },
    });
    await store.importProfile(json);
    expect(localStorage.getItem('prefs.theme')).toBe('dark');
    expect(localStorage.getItem('evil_key')).toBeNull();
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

describe('groups (localStorage) + free notes', () => {
  test('addGroup / allGroups ordering / renameGroup', async () => {
    const a = store.addGroup('Faith');
    const b = store.addGroup();               // default name
    expect(b.name).toBe('New Group');
    const ids = store.allGroups().map(g => g.id);
    expect(ids).toEqual([a.id, b.id]);        // created_at ascending
    store.renameGroup(a.id, 'Grace');
    expect(store.allGroups().find(g => g.id === a.id).name).toBe('Grace');
  });

  test('addNote supports a free note (null ref)', async () => {
    const n = await store.addNote({ target_type: 'free', ref: null, body: 'loose thought' });
    expect(n.ref).toBeNull();
    expect((await store.allNotes()).map(x => x.id)).toContain(n.id);
  });

  test('updateNote assigns and unassigns group_id', async () => {
    const g = store.addGroup('G');
    const n = await store.addNote({ target_type: 'free', ref: null, body: 'x' });
    await store.updateNote(n.id, 'x', { group_id: g.id });
    expect((await store.allNotes()).find(x => x.id === n.id).group_id).toBe(g.id);
    await store.updateNote(n.id, 'x', { group_id: null });
    expect((await store.allNotes()).find(x => x.id === n.id).group_id).toBeNull();
  });

  test('deleteGroup unassigns member notes but keeps them', async () => {
    const g = store.addGroup('G');
    const n = await store.addNote({ target_type: 'free', ref: null, body: 'keep me' });
    await store.updateNote(n.id, 'keep me', { group_id: g.id });
    await store.deleteGroup(g.id);
    expect(store.allGroups()).toEqual([]);
    const note = (await store.allNotes()).find(x => x.id === n.id);
    expect(note).toBeTruthy();
    expect(note.group_id).toBeNull();
  });
});
