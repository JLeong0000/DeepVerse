// Local-first state. Notes live in IndexedDB (via idb); prefs / reading-activity / to-study are small
// and live in localStorage. No auth, no backend. Shapes follow spec §10.
import { openDB } from 'idb';

// ---------- Notes (IndexedDB) ----------
let dbPromise = null;
function notesDb() {
  if (!dbPromise) {
    dbPromise = openDB('deepverse', 1, {
      upgrade(db) {
        const store = db.createObjectStore('notes', { keyPath: 'id' });
        store.createIndex('ref', 'ref');
        store.createIndex('updated_at', 'updated_at');
      },
    });
  }
  return dbPromise;
}
const uuid = () => (crypto?.randomUUID ? crypto.randomUUID() : 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2));

export async function addNote({ target_type, ref, body }) {
  const now = new Date().toISOString();
  const note = { id: uuid(), target_type, ref, body, created_at: now, updated_at: now };
  await (await notesDb()).put('notes', note);
  return note;
}
export async function updateNote(id, body, patch = {}) {
  const db = await notesDb();
  const note = await db.get('notes', id);
  if (!note) return null;
  note.body = body;
  if (patch.ref !== undefined) note.ref = patch.ref;
  if (patch.target_type !== undefined) note.target_type = patch.target_type;
  if (patch.group_id !== undefined) note.group_id = patch.group_id;
  note.updated_at = new Date().toISOString();
  await db.put('notes', note);
  return note;
}
export async function deleteNote(id) {
  await (await notesDb()).delete('notes', id);
}
export async function allNotes() {
  return (await notesDb()).getAllFromIndex('notes', 'updated_at');
}
export async function recentNotes(n = 6) {
  const all = await allNotes();
  return all.reverse().slice(0, n); // updated_at index is ascending; newest last
}
export async function notesForRef(ref) {
  return (await notesDb()).getAllFromIndex('notes', 'ref', ref);
}
export async function exportNotes() {
  return JSON.stringify(await allNotes(), null, 2);
}
export async function importNotes(json) {
  const incoming = typeof json === 'string' ? JSON.parse(json) : json;
  const db = await notesDb();
  const tx = db.transaction('notes', 'readwrite');
  for (const note of incoming) await tx.store.put(note); // merge by id (keyPath)
  await tx.done;
  return incoming.length;
}

// ---------- Prefs (localStorage) ----------
const PREFS = 'prefs';
function readPrefs() { try { return JSON.parse(localStorage.getItem(PREFS)) || {}; } catch { return {}; } }
function writePrefs(p) { localStorage.setItem(PREFS, JSON.stringify(p)); }
export function getPref(k, fallback = null) { const v = readPrefs()[k]; return v === undefined ? fallback : v; }
export function setPref(k, v) { const p = readPrefs(); p[k] = v; writePrefs(p); }

// ---------- Reading activity (localStorage) ----------
const ACT = 'reading_activity';
const todayKey = (d = new Date()) => d.toISOString().slice(0, 10);
function readAct() { try { return JSON.parse(localStorage.getItem(ACT)) || {}; } catch { return {}; } }
function writeAct(a) { localStorage.setItem(ACT, JSON.stringify(a)); }

export function recordRead(book, chapter) {
  const a = readAct(); const k = todayKey();
  a[k] = (a[k] || 0) + 1;
  writeAct(a);
}
export function activityMap() { return readAct(); }
// map a day's chapter count to a contribution-graph intensity level 0..4
export function activityLevel(count) {
  if (!count) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  if (count <= 7) return 3;
  return 4;
}
export function chaptersRead() { return Object.values(readAct()).reduce((s, n) => s + n, 0); }
export function daysThisYear() {
  const y = new Date().getFullYear();
  return Object.keys(readAct()).filter(k => k.startsWith(String(y))).length;
}
export function streak() {
  const a = readAct(); let n = 0;
  const d = new Date();
  // if today has no reading yet, start counting from yesterday (streak not broken until a day is missed)
  if (!a[todayKey(d)]) d.setDate(d.getDate() - 1);
  while (a[todayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// ---------- To-study checklist (localStorage) ----------
const STUDY = 'to_study';
function readStudy() { try { return JSON.parse(localStorage.getItem(STUDY)) || []; } catch { return []; } }
function writeStudy(list) { localStorage.setItem(STUDY, JSON.stringify(list)); }

export function addStudy(text) {
  const list = readStudy();
  const item = { id: uuid(), text, done: false, completed_at: null };
  list.push(item); writeStudy(list);
  return item;
}
export function editStudy(id, text) {
  const list = readStudy(); const it = list.find(i => i.id === id);
  if (it) { it.text = text; writeStudy(list); }
}
export function deleteStudy(id) { writeStudy(readStudy().filter(i => i.id !== id)); }
export function setStudyDone(id, done) {
  const list = readStudy(); const it = list.find(i => i.id === id);
  if (it) { it.done = done; writeStudy(list); }
}
export function archiveStudy(id) {
  const list = readStudy(); const it = list.find(i => i.id === id);
  if (it) { it.done = true; it.completed_at = new Date().toISOString(); writeStudy(list); }
}
export function activeStudy() { return readStudy().filter(i => !i.completed_at); }
export function archivedStudy() {
  return readStudy().filter(i => i.completed_at).sort((a, b) => b.completed_at.localeCompare(a.completed_at));
}

// ---------- Note groups (localStorage) ----------
const GROUPS = 'note_groups';
function readGroups() { try { return JSON.parse(localStorage.getItem(GROUPS)) || []; } catch { return []; } }
function writeGroups(list) { localStorage.setItem(GROUPS, JSON.stringify(list)); }

export function allGroups() {
  return readGroups().sort((a, b) => a.created_at.localeCompare(b.created_at));
}
export function addGroup(name = 'New Group') {
  const now = new Date().toISOString();
  const g = { id: uuid(), name, created_at: now, updated_at: now };
  const list = readGroups(); list.push(g); writeGroups(list);
  return g;
}
export function renameGroup(id, name) {
  const list = readGroups(); const g = list.find(x => x.id === id);
  if (g) { g.name = name; g.updated_at = new Date().toISOString(); writeGroups(list); }
}
export async function deleteGroup(id) {
  writeGroups(readGroups().filter(g => g.id !== id));
  const db = await notesDb();
  for (const n of await db.getAll('notes')) {
    if (n.group_id === id) { n.group_id = null; await db.put('notes', n); }
  }
}

// test seam
export async function _clearAllForTest() {
  localStorage.clear();
  const db = await notesDb();
  await db.clear('notes');
}
