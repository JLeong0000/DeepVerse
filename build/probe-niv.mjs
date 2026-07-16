// Discovery probe for the NIV PDF: how are book & chapter boundaries signaled?
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PDF = `${ROOT}/backup-data/bibles-licensed/NIV-New-International-Version.pdf`;
const data = new Uint8Array(fs.readFileSync(PDF));
const doc = await getDocument({ data, useSystemFonts: true }).promise;
console.log('pages:', doc.numPages);

// Dump the first page raw (front matter + how Genesis opens), then a couple pages
// around a likely book boundary, keeping per-item font-size so we can see headings.
async function dump(p) {
  const page = await doc.getPage(p);
  const items = (await page.getTextContent()).items;
  console.log(`\n===== PAGE ${p} =====`);
  let line = '', lastY = null, sizes = new Set();
  const out = [];
  for (const it of items) {
    const y = it.transform[5];
    const size = Math.round(Math.abs(it.transform[0]) * 10) / 10;
    if (lastY !== null && Math.abs(y - lastY) > 2) { if (line.trim()) out.push(line.trim()); line = ''; }
    line += it.str;
    sizes.add(size);
    lastY = y;
  }
  if (line.trim()) out.push(line.trim());
  out.slice(0, 30).forEach(l => console.log('|', l));
  console.log('font sizes on page:', [...sizes].sort((a,b)=>b-a).slice(0,6).join(', '));
}
await dump(1);
await dump(2);
