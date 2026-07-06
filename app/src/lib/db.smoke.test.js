import { test, expect } from 'vitest';
import initSqlJs from 'sql.js';
import { query, isLoaded, _setDbForTest } from './db.js';

// M0.3 — exercises query() against an in-memory sql.js DB (the real /bible.db fetch path is
// verified in the running app; jsdom has no server to fetch a 90 MB file from).
test('query() returns row objects from a loaded db', async () => {
  const SQL = await initSqlJs();
  const d = new SQL.Database();
  d.run("CREATE TABLE verses(version TEXT, book TEXT, chapter INT, verse INT, text TEXT);");
  d.run("INSERT INTO verses VALUES ('NIV','John',3,16,'For God so loved…'),('NIV','John',1,1,'In the beginning…');");
  _setDbForTest(d);

  expect(isLoaded()).toBe(true);
  expect(query('SELECT COUNT(*) AS n FROM verses')[0].n).toBe(2);
  const rows = query('SELECT text FROM verses WHERE book=? AND chapter=? AND verse=?', ['John', 3, 16]);
  expect(rows).toHaveLength(1);
  expect(rows[0].text).toContain('loved');
});
