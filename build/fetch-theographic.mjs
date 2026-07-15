// build/fetch-theographic.mjs
// Download the Theographic Bible Metadata JSON tables into sources/theographic/ (gitignored),
// so the raw data the build depends on is reproducible. Run: node fetch-theographic.mjs
// Data: Theographic Bible Metadata by Robert Rouse, licensed CC BY-SA 4.0.
// https://github.com/robertrouse/theographic-bible-metadata
import fs from 'node:fs';

const ROOT = '/Users/justinleong/Desktop/Coding/DeepVerse';
const OUT = `${ROOT}/sources/theographic`;
const BASE = 'https://raw.githubusercontent.com/robertrouse/theographic-bible-metadata/master/json';
const FILES = ['chapters', 'verses', 'people', 'places', 'peopleGroups', 'events', 'easton', 'books'];

fs.mkdirSync(OUT, { recursive: true });
for (const name of FILES) {
  const res = await fetch(`${BASE}/${name}.json`);
  if (!res.ok) { console.error(`FAILED ${name}: ${res.status}`); process.exit(1); }
  fs.writeFileSync(`${OUT}/${name}.json`, await res.text());
  console.log('fetched', name);
}
console.log('theographic data written to', OUT);
