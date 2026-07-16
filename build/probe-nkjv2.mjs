import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PDF = `${ROOT}/backup-data/bibles-licensed/NKJV-New-King-James-Version.pdf`;
const doc = await getDocument({ data: new Uint8Array(fs.readFileSync(PDF)), useSystemFonts: true }).promise;

async function lineDump(p, label) {
  const items = (await (await doc.getPage(p)).getTextContent()).items;
  console.log(`\n===== PAGE ${p} ${label || ''} =====`);
  let lastY = null, buf = [];
  const flush = () => {
    if (!buf.length) return;
    const txt = buf.map(b => b.str).join('');
    const fonts = [...new Set(buf.filter(b => b.str.trim()).map(b => b.font))];
    console.log(`${JSON.stringify(txt.trim().slice(0,60))}  <fonts: ${fonts.join(',')}>`);
    buf = [];
  };
  for (const it of items) {
    const y = it.transform[5];
    if (lastY !== null && Math.abs(y - lastY) > 2) flush();
    buf.push({ str: it.str, font: it.fontName }); lastY = y;
  }
  flush();
}
await lineDump(40, '(section heading fonts)');
// find where a new book starts: scan for a page whose header book name changes to EXODUS
for (let p = 60; p < 100; p++) {
  const t = (await (await doc.getPage(p)).getTextContent()).items.map(i => i.str).join(' ');
  if (/EXODUS\s+1:1|The Israelites Multiply|Now these are the names/i.test(t)) { await lineDump(p, '(Exodus start?)'); break; }
}
