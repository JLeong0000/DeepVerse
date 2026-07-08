// Copy the built bible.db and the sql.js wasm into public/ so they ship as static assets.
// The shipped DB is SLIMMED: the app queries only verses/words/lexicon/cross_refs/differences, so
// the build-only `synonyms`, `word_domain`, and `word_sense` tables and the unused gloss_norm index
// are dropped (saves ~15 MB). The full data/bible.db keeps them for the build/tests. Runs before dev/build (see package.json).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..');
const publicDir = path.join(appRoot, 'public');
fs.mkdirSync(publicDir, { recursive: true });

const wasmSrc = path.resolve(appRoot, 'node_modules/sql.js/dist/sql-wasm.wasm');
const dbSrc = path.resolve(appRoot, '../data/bible.db');
const dbDest = path.join(publicDir, 'bible.db');
const wasmDest = path.join(publicDir, 'sql-wasm.wasm');

for (const [src, dest] of [[wasmSrc, wasmDest]]) {
  if (!fs.existsSync(src)) { console.error(`copy-assets: missing source ${src}`); process.exit(1); }
  fs.copyFileSync(src, dest);
  console.log(`copy-assets: ${path.basename(dest)} (${(fs.statSync(dest).size / 1e6).toFixed(1)} MB)`);
}

if (!fs.existsSync(dbSrc)) { console.error(`copy-assets: missing ${dbSrc} — run the build in ../build first`); process.exit(1); }
fs.copyFileSync(dbSrc, dbDest);
const before = fs.statSync(dbDest).size;
const db = new DatabaseSync(dbDest);
db.exec('DROP TABLE IF EXISTS synonyms;');       // build-only: differences already embeds near-synonyms
db.exec('DROP TABLE IF EXISTS word_domain;');    // build-only: differences already embeds domains/near-synonyms
db.exec('DROP TABLE IF EXISTS word_sense;');     // build-only
db.exec('DROP INDEX IF EXISTS idx_words_glossnorm;'); // unused at runtime
db.exec('VACUUM;');
db.close();
const after = fs.statSync(dbDest).size;
console.log(`copy-assets: bible.db slimmed ${(before / 1e6).toFixed(1)} → ${(after / 1e6).toFixed(1)} MB`);

// onnxruntime-web wasm — vendored so Hebrew TTS works offline (no CDN fetch).
const ortSrc = path.resolve(appRoot, 'node_modules/onnxruntime-web/dist');
const ortDest = path.join(publicDir, 'tts', 'ort');
fs.mkdirSync(ortDest, { recursive: true });
for (const f of fs.readdirSync(ortSrc)) {
  if (f.endsWith('.wasm') || f.endsWith('.mjs')) fs.copyFileSync(path.join(ortSrc, f), path.join(ortDest, f));
}
console.log('copy-assets: onnxruntime-web wasm -> public/tts/ort/');
