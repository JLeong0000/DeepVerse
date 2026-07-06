// Quick extraction-quality probe: dump text from a few pages of a PDF.
// Usage: node peek-pdf.mjs <pdf-path> <startPage> <endPage>
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'node:fs';

const [path, start = '40', end = '43'] = process.argv.slice(2);
const data = new Uint8Array(fs.readFileSync(path));
const doc = await getDocument({ data, useSystemFonts: true }).promise;
console.log(`PAGES: ${doc.numPages}  |  file: ${path.split('/').pop()}`);

for (let p = Number(start); p <= Number(end) && p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const content = await page.getTextContent();
  // Reconstruct rough reading order, marking line breaks by y-position changes.
  let out = '', lastY = null;
  for (const item of content.items) {
    const y = item.transform[5];
    if (lastY !== null && Math.abs(y - lastY) > 2) out += '\n';
    out += item.str;
    lastY = y;
  }
  console.log(`\n===== PAGE ${p} =====\n${out.slice(0, 1400)}`);
}
