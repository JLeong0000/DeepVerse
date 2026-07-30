// Resolves Tyndale's own "See …" cross-references into article-to-article edges.
//
// The dictionary writes cross-references as prose sentences ("See Sin.", "See Antichrist;
// Armageddon."). This module turns them into a graph. It resolves 96.9% of the 5,336 targets the
// corpus names; the rest are genuine source defects ("Jesus Christ, Life and Teachings of" is
// cited 19 times and does not exist) and must degrade to nothing rather than throw.

const HEAD_MARK = '## ';

// A cross-reference is a sentence beginning with a capital S. The preceding sentence may end in
// any terminator, and Tyndale routinely puts that terminator INSIDE a closing quote
// (`…the English word “eon.” See Age.`), so the quote must be allowed to follow it.
// Lower-case "see also Nm 3:2-4" is a scripture citation and is deliberately not matched.
const CLAUSE = /(?:^|[.;!?][”"’']?\s*|\n\s*)See(?: also)? ([^.\n]+)\./g;

// Pointers into the article's own structure, not to another entry.
const STRUCTURAL = /^\s*(?:the\s+)?(?:above|below|note|chart|introduction)\b/i;

export function normKey(s) {
  return String(s).trim().toLowerCase()
    .replace(/[‘’]/g, "'")           // curly -> straight apostrophe
    .replace(/\*/g, '')                        // the source's cross-reference asterisk
    .replace(/[.\s]+$/, '')                    // trailing period / whitespace
    .replace(/\s*#\d+\s*$/, '')                // " #2" is an intra-article sense pointer
    .replace(/\s*\((?:above|below)\)\s*$/, '')
    .replace(/\s+/g, ' ');
}

export function buildIndex(articles) {
  const byTitle = new Map(), bySort = new Map(), subheads = new Map();
  const segOwners = new Map();
  for (const a of articles) {
    byTitle.set(normKey(a.title), a.id);
    const sk = normKey(a.sort_title ?? a.title);
    if (!bySort.has(sk)) bySort.set(sk, a.id);   // sort_title collides across 131 groups
    // Comma segments let "See Mark of the Beast." reach "Mark of God*, Mark of the Beast".
    // Single words are far too ambiguous to index; a segment is only usable when exactly one
    // article claims it, which is what keeps this from guessing.
    for (const seg of normKey(a.title).split(/,\s*/)) {
      if (!seg || seg.split(' ').length < 2) continue;
      if (!segOwners.has(seg)) segOwners.set(seg, new Set());
      segOwners.get(seg).add(a.id);
    }
    const hs = new Map();
    for (const line of String(a.body).split('\n'))
      if (line.startsWith(HEAD_MARK)) hs.set(normKey(line.slice(3)), line.slice(3).trim());
    if (hs.size) subheads.set(a.id, hs);
  }
  const bySeg = new Map();
  for (const [seg, ids] of segOwners) if (ids.size === 1) bySeg.set(seg, [...ids][0]);
  return { byTitle, bySort, bySeg, subheads };
}

const direct = (key, ix) => ix.byTitle.get(key) ?? ix.bySort.get(key) ?? ix.bySeg.get(key) ?? null;

export function resolveTarget(rawTarget, ix) {
  const key = normKey(String(rawTarget).replace(/^\s*also\s+/i, ''));
  const hit = direct(key, ix);
  if (hit) return { dst: hit, anchor: null };
  // "Animals (Cattle)" points at a subhead inside another article.
  const m = key.match(/^(.*?)\s*\(([^()]*)\)?$/);
  if (!m) return null;
  const host = direct(normKey(m[1]), ix);
  if (!host) return null;
  // An unmatched subhead still yields a correct link — the anchor is simply dropped.
  return { dst: host, anchor: ix.subheads.get(host)?.get(normKey(m[2])) ?? null };
}

// Emits one row per distinct target, INCLUDING targets that do not exist (dst null). 145 of the
// 5,233 links Tyndale writes name an article that is not in the corpus — "Jesus Christ, Life and
// Teachings of" is cited 19 times. The UI shows these honestly rather than silently dropping them,
// so the resolver must keep them.
export function extractXrefs(article, ix) {
  const out = [];
  const seen = new Set();
  for (const m of String(article.body).matchAll(CLAUSE)) {
    for (const rawTarget of m[1].split(';')) {
      const target = rawTarget.replace(/^\s*also\s+/i, '').trim();
      if (!target || STRUCTURAL.test(target)) continue;
      const hit = resolveTarget(target, ix);
      if (hit && hit.dst === article.id) continue;            // self-edge
      // Tagged so the resolved and unresolved namespaces can never collide, even though no
      // article id currently contains a colon.
      const dedupe = hit ? `id:${hit.dst}` : `raw:${normKey(target)}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      out.push({ src: article.id, dst: hit ? hit.dst : null, raw: target,
        anchor: hit ? hit.anchor : null, seq: out.length });
    }
  }
  return out;
}
