// build/lib/recaps.mjs
// One plain recap per chapter -> chapter_recap.
// Primary source: Bible Summary (Chris Juby, biblesummary.info) — "every chapter in 140
// characters or less" — kept locally in the committed build/data/recaps-biblesummary.json
// (refresh with build/fetch-biblesummary.mjs; the build itself does not hit the network).
// Falls back to a committed editorial recap (build/data/recaps-editorial.json) only for a
// chapter Bible Summary is somehow missing (it covers all 1189, so this rarely fires).
import fs from 'node:fs';

const BS_FILE = new URL('../data/recaps-biblesummary.json', import.meta.url);
const EDITORIAL_FILE = new URL('../data/recaps-editorial.json', import.meta.url);

export function loadRecaps(db) {
  const targets = db.prepare('SELECT DISTINCT book, chapter FROM verses ORDER BY book, chapter').all();

  const bs = new Map();
  if (fs.existsSync(BS_FILE))
    for (const e of JSON.parse(fs.readFileSync(BS_FILE, 'utf8')))
      if (e.summary) bs.set(`${e.book}|${e.chapter}`, e.summary.trim());

  const editorial = new Map();
  if (fs.existsSync(EDITORIAL_FILE))
    for (const e of JSON.parse(fs.readFileSync(EDITORIAL_FILE, 'utf8')))
      if (e.recap) editorial.set(`${e.book}|${e.chapter}`, { recap: e.recap.trim(), source: e.source || 'editorial' });

  const ins = db.prepare('INSERT OR IGNORE INTO chapter_recap VALUES (?,?,?,?)');
  const bySource = {};
  let count = 0;
  db.exec('BEGIN');
  for (const { book, chapter } of targets) {
    const key = `${book}|${chapter}`;
    let recap = null, source = null;
    if (bs.has(key)) { recap = bs.get(key); source = 'bible-summary'; }
    else if (editorial.has(key)) { const ed = editorial.get(key); recap = ed.recap; source = ed.source; }
    if (!recap) continue;
    ins.run(book, chapter, recap, source);
    bySource[source] = (bySource[source] || 0) + 1;
    count++;
  }
  db.exec('COMMIT');
  return { count, bySource };
}
