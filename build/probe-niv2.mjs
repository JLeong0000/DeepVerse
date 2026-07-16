// Probe NIV body pages: show each line with its font size, so we can tell how
// chapter numbers vs verse numbers vs body text are distinguished.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'node:fs';

const PDF = '../backup-data/bibles-licensed/NIV-New-International-Version.pdf';
const doc = await getDocument({ data: new Uint8Array(fs.readFileSync(PDF)), useSystemFonts: true }).promise;

async function dump(p) {
  const items = (await (await doc.getPage(p)).getTextContent()).items;
  console.log(`\n===== PAGE ${p} =====`);
  let line = '', lastY = null, maxSize = 0;
  const out = [];
  const flush = () => { if (line.trim()) out.push([maxSize, line.trim()]); line = ''; maxSize = 0; };
  for (const it of items) {
    const y = it.transform[5];
    const size = Math.round(Math.abs(it.transform[0]) * 10) / 10;
    if (lastY !== null && Math.abs(y - lastY) > 2) flush();
    line += it.str; maxSize = Math.max(maxSize, size); lastY = y;
  }
  flush();
  out.slice(0, 24).forEach(([s, l]) => console.log(`[${s}] ${l.slice(0, 75)}`));
}
// pages: 3-4 likely Genesis opening; 40 is mid-Genesis (ch 26-29 region)
for (const p of [3, 4, 40]) await dump(p);
