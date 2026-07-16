// Probe NKJV: dump text items with font size + baseline so we can identify
// chapter numbers, verse numbers, body text, and superscript markers (cross-refs/footnotes).
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'node:fs';

const PDF = '../backup-data/bibles-licensed/NKJV-New-King-James-Version.pdf';
const doc = await getDocument({ data: new Uint8Array(fs.readFileSync(PDF)), useSystemFonts: true }).promise;
console.log('pages:', doc.numPages);

async function dump(p) {
  const items = (await (await doc.getPage(p)).getTextContent()).items;
  console.log(`\n===== PAGE ${p} (item-level: 'text' size@ySbaseline) =====`);
  // group into visual lines by y, but show each item's size
  let lastY = null, buf = [];
  const flush = () => {
    if (!buf.length) return;
    console.log(buf.map(it => `${JSON.stringify(it.str)}·${it.sz}`).join('  '));
    buf = [];
  };
  for (const it of items) {
    const y = Math.round(it.transform[5] * 10) / 10;
    const sz = Math.round(Math.abs(it.transform[0]) * 10) / 10;
    if (lastY !== null && Math.abs(y - lastY) > 2) flush();
    buf.push({ str: it.str, sz, y });
    lastY = y;
  }
  flush();
}
await dump(40);
