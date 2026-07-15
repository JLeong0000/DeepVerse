// build/validate-recaps.mjs
// Step 2 report: validate commentary recap ALIGNMENT before any import.
// Run: node validate-recaps.mjs
import { DatabaseSync } from 'node:sqlite';
import { analyzeCommentary } from './lib/recaps.mjs';

const ROOT = '/Users/justinleong/Desktop/Coding/DeepVerse';
const DIR = `${ROOT}/sources/commentaries`;

const db = new DatabaseSync(`${ROOT}/data/bible.db`);
const targets = db.prepare('SELECT DISTINCT book, chapter FROM verses').all();
const targetSet = new Set(targets.map(t => `${t.book}|${t.chapter}`));
db.close();

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

for (const commentary of ['matthew-henry', 'adam-clarke']) {
  const { result, stats } = analyzeCommentary(DIR, commentary);
  console.log(`\n===== ${commentary} =====`);
  console.log(`total chapters with intro: ${stats.total}`);
  console.log(`aligned:      ${stats.aligned}`);
  console.log(`misaligned:   ${stats.misaligned} (EXCLUDED)`);
  console.log(`unvalidated:  ${stats.unvalidated} (no citation; imported — ${stats.unvalidatedNoCue} without a book-name cue)`);

  // Coverage vs the 1189 target: chapters we can supply a NON-misaligned recap for.
  let aligned1189 = 0, usable1189 = 0;
  for (const [key, r] of result) {
    if (!targetSet.has(key)) continue;
    if (r.status === 'aligned') aligned1189++;
    if (r.status !== 'misaligned') usable1189++;
  }
  console.log(`coverage of 1189 targets — aligned: ${aligned1189}, usable (aligned+unvalidated): ${usable1189}`);

  const L = stats.lengths;
  console.log(`recap length chars — min ${Math.min(...L)}, median ${median(L)}, max ${Math.max(...L)}`);

  console.log(`misaligned list (${stats.misalignedList.length}):`);
  for (const m of stats.misalignedList)
    console.log(`  ${m.osis} ${m.chapter}: dominant "${m.dominant}" -> ${m.pointsTo}; book modal "${m.modal}"`);
}
