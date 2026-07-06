// Copy the built bible.db and the sql.js wasm into public/ so they ship as static assets.
// Run automatically before dev/build (see package.json pre-scripts).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..');
const publicDir = path.join(appRoot, 'public');
fs.mkdirSync(publicDir, { recursive: true });

const copies = [
  [path.resolve(appRoot, '../data/bible.db'), path.join(publicDir, 'bible.db')],
  [path.resolve(appRoot, 'node_modules/sql.js/dist/sql-wasm.wasm'), path.join(publicDir, 'sql-wasm.wasm')],
];

for (const [src, dest] of copies) {
  if (!fs.existsSync(src)) {
    console.error(`copy-assets: missing source ${src}`);
    process.exit(1);
  }
  fs.copyFileSync(src, dest);
  console.log(`copy-assets: ${path.basename(dest)} (${(fs.statSync(dest).size / 1e6).toFixed(1)} MB)`);
}
