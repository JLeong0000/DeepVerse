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
  const edges = db.prepare('SELECT COUNT(*) c FROM dict_xref').get().c;
  if (edges < 5000) problems.push(`dict_xref: ${edges} edges, expected ~5152`);
  const unresolved = db.prepare('SELECT COUNT(*) c FROM dict_xref WHERE dst IS NULL').get().c;
  if (unresolved) problems.push(`dict_xref: ${unresolved} rows with a NULL dst; every edge comes from a ?item= link and must resolve`);
  const selfEdges = db.prepare('SELECT COUNT(*) c FROM dict_xref WHERE src = dst').get().c;
  if (selfEdges) problems.push(`dict_xref: ${selfEdges} self-edges`);
  // Both endpoints must be real articles: a row exists only where the source's own ?item= link
  // named a target we hold.
  const dangling = db.prepare(`SELECT COUNT(*) c FROM dict_xref x
    LEFT JOIN dict_articles a ON a.id = x.src
    LEFT JOIN dict_articles b ON b.id = x.dst
    WHERE a.id IS NULL OR (x.dst IS NOT NULL AND b.id IS NULL)`).get().c;
  if (dangling) problems.push(`dict_xref: ${dangling} edges reference a missing article`);
  const noRaw = db.prepare("SELECT COUNT(*) c FROM dict_xref WHERE raw IS NULL OR raw = ''").get().c;
  if (noRaw) problems.push(`dict_xref: ${noRaw} rows with no raw target text`);

  // Both endpoints of a note link must exist, and `raw` must occur in the note that wrote it —
  // the app underlines by matching that string back against the flattened prose, so a row whose
  // raw has drifted from the body renders as nothing at all rather than as a visible error.
  const noteEdges = db.prepare('SELECT COUNT(*) c FROM study_note_xref').get().c;
  if (noteEdges < 110) problems.push(`study_note_xref: ${noteEdges} edges, expected 117`);
  const danglingNote = db.prepare(`SELECT COUNT(*) c FROM study_note_xref x
    LEFT JOIN study_notes n ON n.osis_ref = x.osis_ref
    LEFT JOIN tyndale_passages p ON p.kind = x.pkind AND p.title = x.ptitle
    WHERE n.osis_ref IS NULL OR p.title IS NULL`).get().c;
  if (danglingNote) problems.push(`study_note_xref: ${danglingNote} edges reference a missing note or passage`);
  const unmatched = db.prepare(`SELECT COUNT(*) c FROM study_note_xref x
    JOIN study_notes n ON n.osis_ref = x.osis_ref
    WHERE instr(n.body, '“' || x.raw || '”') = 0`).get().c;
  if (unmatched) problems.push(`study_note_xref: ${unmatched} rows whose raw text is not in the note body`);

  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = new DatabaseSync('../data/bible.db');
  const problems = validate(db);
  if (problems.length) { console.error('VALIDATION FAILED:\n' + problems.join('\n')); process.exit(1); }
  console.log('validation OK — all books/chapters present'); process.exit(0);
}
