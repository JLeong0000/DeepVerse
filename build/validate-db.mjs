// build/validate-db.mjs
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const EXPECTED = JSON.parse(fs.readFileSync(new URL('./lib/versification.json', import.meta.url)));

export function validate(db) {
  const problems = [];
  for (const [book, chapters] of Object.entries(EXPECTED)) {
    const have = db.prepare("SELECT COUNT(DISTINCT chapter) n FROM verses WHERE book=? AND version='NIV'").get(book).n;
    if (have !== chapters) problems.push(`verses: ${book} has ${have} chapters, expected ${chapters}`);
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = new DatabaseSync('../data/bible.db');
  const problems = validate(db);
  if (problems.length) { console.error('VALIDATION FAILED:\n' + problems.join('\n')); process.exit(1); }
  console.log('validation OK — all books/chapters present'); process.exit(0);
}
