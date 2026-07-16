// build/parse-studynotes.mjs
// One-time: parse Tyndale Open Study Notes XML -> committed build/data/studynotes.json.
// Source (gitignored, CC BY-SA 4.0): backup-data/tyndale/Tyndale Open Study Notes/StudyNotes.xml
// Run: node parse-studynotes.mjs
import fs from 'node:fs';
import { parseStudyNoteRef, extractRef, cleanNoteBody } from './lib/studynotes.mjs';

const XML = '../backup-data/tyndale/Tyndale Open Study Notes/StudyNotes.xml';
const OUT = './data/studynotes.json';
fs.mkdirSync('./data', { recursive: true });

const xml = fs.readFileSync(XML, 'utf8');
const out = [];
let seq = 0, skipped = 0;
const RE = /<item name="([^"]+)"[^>]*>.*?<body>(.*?)<\/body>\s*<\/item>/gs;
let m;
while ((m = RE.exec(xml))) {
  const b = parseStudyNoteRef(m[1]);
  if (!b) { skipped++; continue; }
  const body = cleanNoteBody(m[2]);
  if (!body) { skipped++; continue; }
  out.push({ ...b, ref: extractRef(m[2]) || `${b.start_chapter}:${b.start_verse}`,
    osis_ref: m[1], body, seq: seq++ });
}
fs.writeFileSync(OUT, JSON.stringify(out));
console.log('study notes parsed:', out.length, '| skipped:', skipped);
