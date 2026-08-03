// Turns Tyndale's own "See …" links into edges between dictionary entries.
//
// The source states every cross-reference explicitly — `?item=Plants_Article_…` names the target
// entry, and its `name` is the id we store — so this module resolves nothing by text. It maps the
// link's item id to a destination, works out where in that destination the reader should land, and
// drops the links that are not edges. `extractItemLinks` in tyndale.mjs does the parsing.
//
// This replaced a resolver that reconstructed the graph from flattened prose with a clause regex
// and four tiers of fuzzy title matching. That approach could not see what the markup states: it
// got 89 edges wrong in one direction and 33 in the other, and reported 139 targets as "absent from
// the corpus" that are nothing of the kind — including "Jesus Christ, Life and Teachings of",
// cited 19 times, whose link points at the JesusChristTeachingsof article we have had all along.

const HEAD_MARK = '## ';

const isArticle = (r) => r.kind === 'article';

// Subheads, so a link reading "Animals (Cattle)" can land on the "## Cattle" block rather than the
// top of a 60-heading article. Keyed on the lower-cased subhead, valued with the source's casing.
export function buildIndex(rows) {
  const byId = new Map(), subheads = new Map();
  for (const r of rows) {
    byId.set(r.id, r);
    const hs = new Map();
    for (const line of String(r.body).split('\n')) {
      if (!line.startsWith(HEAD_MARK)) continue;
      const head = line.slice(HEAD_MARK.length).trim();
      hs.set(head.toLowerCase(), head);
    }
    if (hs.size) subheads.set(r.id, hs);
  }
  return { byId, subheads };
}

// A supplement is not a page of its own: a hosted one renders inside its host, so the link opens
// the host scrolled to the box. Only an orphan supplement, which no article embeds, is its own
// destination. A "(Subhead)" in the display text picks a block inside the destination; an
// unmatched one still yields a correct link, with the anchor simply dropped.
//
// "Birds (Fowl, Domestic; Partridge)" names two subheads in ONE link. The reader follows one link,
// so it yields one edge, anchored on the first of those subheads that exists.
export function resolveLink(link, ix) {
  const row = ix.byId.get(link.item);
  if (!row) return null;                    // a Map, or an id not in the package
  if (!isArticle(row))
    return row.host_id ? { dst: row.host_id, anchor: row.title } : { dst: row.id, anchor: null };
  const m = link.text.match(/\(([^()]*)\)\s*$/);
  if (!m) return { dst: row.id, anchor: null };
  const hs = ix.subheads.get(row.id);
  for (const part of m[1].split(';')) {
    const hit = hs?.get(part.trim().toLowerCase());
    if (hit) return { dst: row.id, anchor: hit };
  }
  return { dst: row.id, anchor: null };
}

// One row per distinct destination. `raw` is the link's display text, which is what the app matches
// against the rendered prose to decide which run to underline.
export function buildXrefRows(row, links, ix) {
  const out = [];
  const seen = new Set();
  for (const link of links) {
    const hit = resolveLink(link, ix);
    if (!hit) continue;
    // A row never links to the page it is already on — an article naming a textbox of its own, or
    // a hosted textbox naming its host. Compared after the hosted-supplement redirect, so `src`
    // and `dst` really can differ here.
    if (hit.dst === row.id || hit.dst === row.host_id) continue;
    if (seen.has(hit.dst)) continue;
    seen.add(hit.dst);
    out.push({ src: row.id, dst: hit.dst, raw: link.text, anchor: hit.anchor, seq: out.length });
  }
  return out;
}
