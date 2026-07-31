// Resolves Tyndale's own "See …" cross-references into edges between dictionary entries.
//
// The dictionary writes cross-references as prose sentences ("See Sin.", "See Antichrist;
// Armageddon."). This module turns them into a graph over all 6,141 dictionary rows — the 6,010
// articles and the 131 supplements (textboxes and charts) they host, which both cite and are
// cited. It resolves 97.0% of the 5,341 targets the corpus names; the rest are genuine source
// defects ("Jesus Christ, Life and Teachings of" is cited 19 times and does not exist) and must
// degrade to nothing rather than throw.

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
    .replace(/^“([^“”]*)”$/, '$1')             // Tyndale quotes a supplement it cites, whole
    .replace(/\s*#\d+\s*$/, '')                // " #2" is an intra-article sense pointer
    .replace(/\s*\((?:above|below)\)\s*$/, '')
    .replace(/\s+/g, ' ');
}

const isArticle = (r) => r.kind === 'article';

export function buildIndex(rows) {
  const byTitle = new Map(), bySort = new Map(), subheads = new Map(), byId = new Map();
  const segOwners = new Map();
  // Articles first, so a supplement can never take a key an article wants: "Followers of the Way"
  // is both a textbox and an article, and the article is the entry a reader can open on its own.
  for (const r of [...rows.filter(isArticle), ...rows.filter((x) => !isArticle(x))]) {
    byId.set(r.id, r);
    const tk = normKey(r.title);
    if (isArticle(r) || !byTitle.has(tk)) byTitle.set(tk, r.id);
    const sk = normKey(r.sort_title ?? r.title);
    if (!bySort.has(sk)) bySort.set(sk, r.id);   // sort_title collides across 131 groups
    // Comma segments let "See Mark of the Beast." reach "Mark of God*, Mark of the Beast".
    // Single words are far too ambiguous to index; a segment is only usable when exactly one
    // row claims it, which is what keeps this from guessing.
    for (const seg of tk.split(/,\s*/)) {
      if (!seg || seg.split(' ').length < 2) continue;
      if (!segOwners.has(seg)) segOwners.set(seg, new Set());
      segOwners.get(seg).add(r.id);
    }
    const hs = new Map();
    for (const line of String(r.body).split('\n'))
      if (line.startsWith(HEAD_MARK)) hs.set(normKey(line.slice(3)), line.slice(3).trim());
    if (hs.size) subheads.set(r.id, hs);
  }
  const bySeg = new Map();
  for (const [seg, ids] of segOwners) if (ids.size === 1) bySeg.set(seg, [...ids][0]);
  return { byTitle, bySort, bySeg, subheads, byId };
}

const direct = (key, ix) => ix.byTitle.get(key) ?? ix.bySort.get(key) ?? ix.bySeg.get(key) ?? null;

// Where a matched row actually sends the reader. A supplement is not a page of its own: a hosted
// one is rendered inside its host, so the link opens the host scrolled to the box — the same shape
// a "(Subhead)" match produces. Only an orphan supplement, which no article includes, is its own
// destination. `subKey` is the normalised subhead of a "Article (Subhead)" match, else null.
function destination(id, ix, subKey) {
  const row = ix.byId.get(id);
  if (!isArticle(row))
    return row.host_id ? { dst: row.host_id, anchor: row.title } : { dst: id, anchor: null };
  // An unmatched subhead still yields a correct link — the anchor is simply dropped.
  return { dst: id, anchor: subKey === null ? null : ix.subheads.get(id)?.get(subKey) ?? null };
}

export function resolveTarget(rawTarget, ix) {
  const key = normKey(String(rawTarget).replace(/^\s*also\s+/i, ''));
  const hit = direct(key, ix);
  if (hit) return destination(hit, ix, null);
  // "Animals (Cattle)" points at a subhead inside another article.
  const m = key.match(/^(.*?)\s*\(([^()]*)\)?$/);
  if (!m) return null;
  const host = direct(normKey(m[1]), ix);
  if (!host) return null;
  return destination(host, ix, normKey(m[2]));
}

// Emits one row per distinct target, INCLUDING targets that do not exist (dst null). 140 of the
// 5,236 links Tyndale writes name an article that is not in the corpus — "Jesus Christ, Life and
// Teachings of" is cited 19 times. The UI shows these honestly rather than silently dropping them,
// so the resolver must keep them.
export function extractXrefs(row, ix) {
  const out = [];
  const seen = new Set();
  for (const m of String(row.body).matchAll(CLAUSE)) {
    for (const rawTarget of m[1].split(';')) {
      const target = rawTarget.replace(/^\s*also\s+/i, '').trim();
      if (!target || STRUCTURAL.test(target)) continue;
      const hit = resolveTarget(target, ix);
      // A row never links to the page it is already on. Compared after the hosted-supplement
      // redirect, so an article naming a textbox of its own drops out (Flood, the cites
      // “Scientific Evidence for the Flood?”), and so does the mirror case: a hosted supplement
      // naming its own host (the textbox AbominationOfDesolation cites Abomination). The second
      // arm needs its own test because `src` stays the box's id, so src and dst really do differ.
      if (hit && (hit.dst === row.id || hit.dst === row.host_id)) continue;
      // Tagged so the resolved and unresolved namespaces can never collide, even though no
      // article id currently contains a colon.
      const dedupe = hit ? `id:${hit.dst}` : `raw:${normKey(target)}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      out.push({ src: row.id, dst: hit ? hit.dst : null, raw: target,
        anchor: hit ? hit.anchor : null, seq: out.length });
    }
  }
  return out;
}
