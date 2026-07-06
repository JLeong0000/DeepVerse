// Harvest the CURRENT NLT from the official Tyndale API (api.nlt.to) into per-book
// JSON keyed by "chapter:verse". Reads the free key from .env (NLT_API_TO_API).
// Usage: node --env-file=../.env harvest-nlt.mjs [--test]
import fs from 'node:fs';

const KEY = process.env.NLT_API_TO_API;
if (!KEY) { console.error('NLT_API_TO_API not set (run with --env-file=../.env)'); process.exit(1); }
const TEST = process.argv.includes('--test');
const OUT = '../data/bibles/NLT-current';
fs.mkdirSync(OUT, { recursive: true });

// book list (osis, API ref name, chapter count) from the NLT PDF manifest
const man = JSON.parse(fs.readFileSync('../data/bibles/NLT/_manifest.json', 'utf8'));
const apiName = { Ps: 'Psalm', Song: 'Song of Songs' };  // API-preferred names
const books = man.books.map(b => ({ osis: b.osis, ref: apiName[b.osis] || b.name, chapters: b.chapters }));

const sleep = ms => new Promise(r => setTimeout(r, ms));

// remove a balanced <span class="tn">...</span> (footnote text, may nest spans)
function stripTn(html) {
  let out = html, idx;
  while ((idx = out.indexOf('<span class="tn">')) !== -1) {
    let i = idx + 1, depth = 1;               // depth of open spans starting at the tn span
    while (i < out.length && depth > 0) {
      const no = out.indexOf('<span', i), nc = out.indexOf('</span>', i);
      if (nc === -1) { i = out.length; break; }
      if (no !== -1 && no < nc) { depth++; i = no + 5; }
      else { depth--; i = nc + 7; }
    }
    out = out.slice(0, idx) + out.slice(i);
  }
  return out;
}
const decode = s => s.replace(/&nbsp;/g, ' ').replace(/&mdash;/g, '—').replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#?\w+;/g, '');

function parseChapter(html) {
  const verses = {};
  const parts = html.split('<verse_export').slice(1);
  for (const p of parts) {
    const vn = p.match(/vn="(\d+)"/)?.[1];
    if (!vn) continue;
    let body = p.slice(p.indexOf('>') + 1);
    body = body.slice(0, body.indexOf('</verse_export>'));
    body = body.replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, '');            // chapter number + subheads
    body = body.replace(/<p class="(?:psa-title|[^"]*subhead[^"]*)"[^>]*>[\s\S]*?<\/p>/gi, ''); // psalm titles
    body = stripTn(body);
    body = body.replace(/<a class="a-tn">.*?<\/a>/g, '');   // footnote markers
    body = body.replace(/<span class="vn">\d+<\/span>/g, ''); // the verse number span
    body = body.replace(/<[^>]+>/g, '');                     // remaining tags
    body = decode(body).replace(/\s+/g, ' ').trim();
    if (body) verses[vn] = body;
  }
  return verses;
}

async function fetchChapter(ref) {
  const url = `https://api.nlt.to/api/passages?ref=${encodeURIComponent(ref)}&version=NLT&key=${KEY}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url);
      if (r.status === 200) return parseChapter(await r.text());
      if (r.status === 429) { await sleep(2000); continue; }   // rate limited
    } catch { /* retry */ }
    await sleep(500);
  }
  return null;
}

const target = TEST
  ? [{ osis: 'John', ref: 'John', chapters: 3 }, { osis: 'Ps', ref: 'Psalm', chapters: 23 }, { osis: '1John', ref: '1 John', chapters: 1 }]
  : books;

let done = 0, totalCh = target.reduce((n, b) => n + (TEST ? 1 : b.chapters), 0), grand = 0;
for (const b of target) {
  const chapters = {};
  const chList = TEST ? [b.chapters] : Array.from({ length: b.chapters }, (_, i) => i + 1);
  for (const ch of chList) {
    const v = await fetchChapter(`${b.ref} ${ch}`);
    if (!v || !Object.keys(v).length) { console.error(`FAIL ${b.ref} ${ch}`); }
    else { chapters[ch] = v; grand += Object.keys(v).length; }
    done++;
    if (done % 25 === 0 || TEST) console.error(`  ${done}/${totalCh} chapters (${b.ref} ${ch})`);
    await sleep(120);
  }
  if (!TEST) fs.writeFileSync(`${OUT}/${b.osis}.json`, JSON.stringify({ name: b.ref, chapters }));
  if (TEST) console.log(`\n${b.osis} sample:`, JSON.stringify(chapters).slice(0, 320));
}
console.error(`\nDONE. ${grand} verses across ${done} chapters.`);
