// sql.js loader + query. bible.db is loaded once into memory; every feature is a SQL query against it.
// Query functions (getChapter, getVerseDifferences, …) are added in Milestone 1.
import initSqlJs from 'sql.js';

let db = null;

export async function loadDb(url = '/bible.db') {
  if (db) return;
  const SQL = await initSqlJs({ locateFile: () => '/sql-wasm.wasm' });
  const buf = await (await fetch(url)).arrayBuffer();
  db = new SQL.Database(new Uint8Array(buf));
}

export function isLoaded() {
  return db !== null;
}

export function query(sql, params = []) {
  if (!db) throw new Error('bible.db not loaded — call loadDb() first');
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

// test seam: let tests inject an in-memory Database
export function _setDbForTest(instance) {
  db = instance;
}
