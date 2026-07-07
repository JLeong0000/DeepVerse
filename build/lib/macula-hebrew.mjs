// build/lib/macula-hebrew.mjs
// Load SDBH semantic domains (Hebrew + Aramaic) from macula-hebrew lowfat XML into word_domain.
// macula-hebrew uses SDBH, not Louw-Nida: `lexdomain` (hierarchical 3-digit groups, e.g. 001005002002001)
// is the LN "domain.subdomain" analog -> store the full lexdomain in `ln`, the first 3-digit group in
// `domain`. Keyed by baseHeb(strongnumberx) to share a key space with words.strongs and synonyms.
import fs from 'node:fs';
import { baseHeb } from './macula.mjs';

export function loadHebrewDomains(db, dir) {
  const insD = db.prepare('INSERT OR IGNORE INTO word_domain VALUES (?,?,?,?,?,?)');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('-lowfat.xml'));
  let inserted = 0;
  db.exec('BEGIN');
  for (const f of files) {
    const xml = fs.readFileSync(`${dir}/${f}`, 'utf8');
    const wRe = /<w\b([^>]*?)>/gs;          // <w> elements span multiple lines -> dotall
    let m;
    while ((m = wRe.exec(xml))) {
      const a = {};
      const attrRe = /([a-zA-Z:]+)="([^"]*)"/g;
      let x;
      while ((x = attrRe.exec(m[1]))) a[x[1]] = x[2];
      if (!a.strongnumberx || !a.lexdomain) continue;
      const strongs = baseHeb(a.strongnumberx);
      if (!strongs) continue;
      const ln = a.lexdomain.trim();
      const res = insD.run(strongs, a.stronglemma || a.lemma || '', a.english || a.gloss || '', ln, ln.slice(0, 3), '');
      if (res.changes) inserted++;
    }
  }
  db.exec('COMMIT');
  return inserted;
}
