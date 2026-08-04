// build/extract-apocrypha.mjs
// MAINTAINER ONLY — needs backup-data/. Extracts the deuterocanonical books from the eBible.org
// King James Version + Apocrypha into the committed intermediate build/data/sources/apocrypha.json.gz,
// which is all build-db.mjs ever reads. Run only when the raw source changes:
//   node extract-apocrypha.mjs
//
// Why these books exist in DeepVerse at all: the Tyndale dictionary cites the Apocrypha constantly and
// none of NIV/NKJV/NLT carries any of it, so every one of those citations was a reference the reader
// could not follow. Two ways to count, both re-derivable:
//   641  raw ?bref= links in the raw Articles XML naming one of 12 apocryphal book codes
//   461  references the app actually linkifies in the stored bodies, across 13 books
//        (tokenizeRefs over dict_articles.body — 4 Maccabees and the Apocalypse of Baruch appear
//        only as display text, never as a ?bref= link, which is why this count spans one more book)
// The second is what a reader meets. 456 of those 461 now resolve; the 5 that do not are UNCOVERED.
//
// Source (gitignored): backup-data/ebible/eng-kjv_vpl.zip
//   King James Version + Apocrypha, standardized 1769 text — Public Domain.
//   https://ebible.org/find/details.php?id=eng-kjv
//   Letters patent give Cambridge UP, Oxford UP and Collins the exclusive right to PRINT this
//   translation in the United Kingdom; the decree has no effect on use outside the UK.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ZIP = `${ROOT}/backup-data/ebible/eng-kjv_vpl.zip`;
const OUT = `${ROOT}/build/data/sources`;

if (!fs.existsSync(ZIP)) {
  console.error(`extract-apocrypha: missing ${ZIP}\nThis script is maintainer-only and needs backup-data/.`);
  process.exit(1);
}

// eBible's SIL/UBS code -> the code we store. Ours follow the OSIS-ish style already used for the
// 66 canonical books (1Sam, 1Kgs), so nothing downstream has to learn a second convention.
const BOOKS = new Map([
  ['TOB', 'Tob'], ['JDT', 'Jdt'], ['ESG', 'AddEsth'], ['WIS', 'Wis'], ['SIR', 'Sir'],
  ['BAR', 'Bar'], ['PRA', 'PrAzar'], ['SUS', 'Sus'], ['BEL', 'Bel'],
  ['1MA', '1Macc'], ['2MA', '2Macc'], ['1ES', '1Esd'], ['PRM', 'PrMan'], ['4ES', '2Esd'],
]);

// Cited by Tyndale but absent from the KJV Apocrypha, so still unreachable: 3 Maccabees (2 verse
// citations) and 4 Maccabees (2). Both are Orthodox-canon books; the KJV never carried them. The
// Apocalypse of Baruch (1 citation, in `Apocrypha`) is a third such book, in no modern Bible at all;
// it is not listed here because it was never a candidate for this extract. app/src/lib/refs.js
// carries all three so the preview can name the book and say why it is empty.
const UNCOVERED = ['3Macc', '4Macc'];

const txt = execFileSync('unzip', ['-p', ZIP, 'eng-kjv_vpl.txt'], { encoding: 'utf8', maxBuffer: 1 << 28 });

const rows = [];
const perBook = new Map();
for (const line of txt.split('\n')) {
  const m = line.match(/^(\w+) (\d+):(\d+) (.*)$/);
  if (!m) continue;
  const book = BOOKS.get(m[1]);
  if (!book) continue;                       // the 66 canonical books; we already have three of those
  // The KJV brackets words supplied by the translators, which print as italics. We have no italic
  // channel in a preview snippet and the other three translations carry no such marks, so the
  // brackets go and the words stay. 36 occurrences across the whole Apocrypha.
  const text = m[4].replace(/\[([^\]]*)\]/g, '$1').replace(/\s+/g, ' ').trim();
  if (!text) continue;
  // 2 Esdras 7 is dropped whole. The KJV was made from Latin manuscripts missing 2 Esd 7:36-105,
  // a gap only filled in 1875, so its chapter 7 renumbers everything after verse 35: KJV 7:50 is
  // "there is promised us an everlasting hope", while every modern edition — and Tyndale, which
  // quotes it — has 7:50 as "The Most High has made not one age but two". Keeping the chapter would
  // silently show the wrong verse for the 5 links Tyndale makes into it (?bref=2Esd.7.36 twice,
  // .50, .70, .113); dropping it shows an explanation instead.
  if (book === '2Esd' && +m[2] === 7) continue;
  rows.push([book, +m[2], +m[3], text]);
  perBook.set(book, (perBook.get(book) ?? 0) + 1);
}

if (perBook.size !== BOOKS.size) {
  const missing = [...BOOKS.values()].filter((b) => !perBook.has(b));
  throw new Error(`extract-apocrypha: no verses found for ${missing.join(', ')} — the source changed.`);
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(`${OUT}/apocrypha.json.gz`, zlib.gzipSync(JSON.stringify(rows)));

console.log('apocrypha verses:', rows.length);
console.log('books:', [...perBook].map(([b, n]) => `${b}=${n}`).join(' '));
console.log('still uncovered (not in the KJV Apocrypha):', UNCOVERED.join(', '));
