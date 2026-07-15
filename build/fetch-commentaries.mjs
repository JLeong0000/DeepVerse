// build/fetch-commentaries.mjs
// Download every chapter's commentary JSON from the HelloAO Free Use Bible API
// into gitignored sources/commentaries/<commentary>/<BOOK>/<chapter>.json.
//
// Source: HelloAO Free Use Bible API — https://bible.helloao.org
// Commentaries: Matthew Henry & Adam Clarke, both CC Public Domain Mark 1.0.
//
// Run: node fetch-commentaries.mjs
// Skips files that already exist (safe to re-run / resume).
import fs from 'node:fs';

const ROOT = '/Users/justinleong/Desktop/Coding/DeepVerse';
const OUT = `${ROOT}/sources/commentaries`;
const COMMENTARIES = ['matthew-henry', 'adam-clarke'];
const CONCURRENCY = 8;

async function getJson(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(url);
      if (r.status === 404) return null;
      if (r.ok) {
        // books.json metadata over-counts chapters; phantom chapters return an HTML
        // 200 page rather than a 404. Treat any non-JSON body as "no data".
        const ct = r.headers.get('content-type') || '';
        if (!ct.includes('json')) return null;
        try { return await r.json(); } catch { return null; }
      }
    } catch { /* retry transient network errors */ }
    await new Promise(res => setTimeout(res, 300 * (attempt + 1)));
  }
  throw new Error(`failed to fetch ${url}`);
}

async function run() {
  for (const commentary of COMMENTARIES) {
    const books = (await getJson(`https://bible.helloao.org/api/c/${commentary}/books.json`)).books;
    // Build the full list of (book, chapter) targets for this commentary.
    const targets = [];
    for (const b of books) {
      const first = b.firstChapterNumber ?? 1;
      const last = b.lastChapterNumber ?? b.numberOfChapters;
      for (let ch = first; ch <= last; ch++) targets.push([b.id, ch]);
    }
    console.log(`${commentary}: ${books.length} books, ${targets.length} chapters`);

    let done = 0, fetched = 0, skipped = 0;
    // minimal concurrency: process the target list in a small worker pool
    let idx = 0;
    async function worker() {
      while (idx < targets.length) {
        const [book, ch] = targets[idx++];
        const dir = `${OUT}/${commentary}/${book}`;
        const path = `${dir}/${ch}.json`;
        if (fs.existsSync(path)) { skipped++; done++; continue; }
        const data = await getJson(`https://bible.helloao.org/api/c/${commentary}/${book}/${ch}.json`);
        done++;
        if (data == null) { skipped++; continue; } // phantom chapter (metadata over-count): no data
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path, JSON.stringify(data));
        fetched++;
        if (done % 200 === 0) console.log(`  ${commentary}: ${done}/${targets.length}`);
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    console.log(`  ${commentary}: done — ${fetched} fetched, ${skipped} already present`);
  }
}

run().catch(e => { console.error(e); process.exit(1); });
