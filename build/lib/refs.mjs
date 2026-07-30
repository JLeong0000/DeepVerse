// build/lib/refs.mjs
import { toOsis } from './books.mjs';

// Tolerates optional dual-versification notation like Dan.4.1(3.31) before the #position.
const RE = /^([A-Za-z0-9]+)\.(\d+)\.(\d+)(?:\([^)]*\))?#(\d+)/;
export function parseWordRef(col0) {
  const m = String(col0).match(RE);
  if (!m) return null;
  let book;
  try { book = toOsis(m[1]); } catch { return null; }  // unknown code -> skip the row, as before
  return { book, chapter: Number(m[2]), verse: Number(m[3]), position: Number(m[4]) };
}
