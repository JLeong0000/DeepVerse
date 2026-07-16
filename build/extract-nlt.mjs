// Extract NLT PDF -> discovery pass. The NLT PDF is verse-per-line, ref-prefixed
// ("Gen 46:16 <text>"), with verses sometimes wrapping onto continuation lines.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'node:fs';

const PDF = '../backup-data/bibles-licensed/NLT-New-Living-Translation.pdf';
const data = new Uint8Array(fs.readFileSync(PDF));
const doc = await getDocument({ data, useSystemFonts: true }).promise;

// Pull every page into line-broken text (line break when y jumps).
let lines = [];
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const items = (await page.getTextContent()).items;
  let cur = '', lastY = null;
  for (const it of items) {
    const y = it.transform[5];
    if (lastY !== null && Math.abs(y - lastY) > 2) { if (cur.trim()) lines.push(cur.trim()); cur = ''; }
    cur += it.str;
    lastY = y;
  }
  if (cur.trim()) lines.push(cur.trim());
}

const VERSE = /^([1-3]?\s?[A-Z][A-Za-z]+)\.?\s+(\d+):(\d+)\s+(.*)$/;
const books = new Map();
let verseCount = 0, unmatched = 0;
const unmatchedSamples = [];
for (const ln of lines) {
  const m = ln.match(VERSE);
  if (m) { verseCount++; books.set(m[1], (books.get(m[1]) || 0) + 1); }
  else { unmatched++; if (unmatchedSamples.length < 15) unmatchedSamples.push(ln.slice(0, 70)); }
}

console.log(`total lines: ${lines.length}`);
console.log(`verse-start lines: ${verseCount}`);
console.log(`continuation/other lines: ${unmatched}`);
console.log(`distinct book tokens: ${books.size}`);
console.log('books:', [...books.entries()].map(([b, n]) => `${b}(${n})`).join(' '));
console.log('\nsample non-verse lines:'); unmatchedSamples.forEach(s => console.log('  |', s));
