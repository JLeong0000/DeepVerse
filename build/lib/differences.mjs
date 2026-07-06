// build/lib/differences.mjs
import { senseKey } from './gloss.mjs';
// Precompute the interpretive-difference table (Greek NT for v2; OT arrives with macula-hebrew).
//
// Type A (synonym collapse): a content word whose Strong's has a Greek near-synonym (different Strong's)
//   that SHARES its top-level Louw-Nida domain and sits within SYN_MAX proximity distance. Requiring a
//   shared LN domain + same language keeps the signal interpretive rather than flooding on the dense
//   proximity matrix (spec §8: "distance < threshold and/or shared Louw-Nida domain").
// Type B (semantic-range spread): a content word whose lemma maps to >=2 distinct normalized English
//   glosses across the corpus, each >= SENSE_MIN_FRAC of the lemma's occurrences.
//
// Calibrated against the spec fixtures: agapao G0025 (near-synonym phileo G5368 @0.583) fires A;
// psyche G5590 (soul/life) fires B; function words (kai G2532) never fire. See the plan's Task 6 and
// spec §13 "thresholds are tunable constants calibrated against known cases".
const SYN_MAX = 0.60;          // max proximity distance to count as a near-synonym (admits agapao↔phileo)
const SENSE_MIN_FRAC = 0.05;
const SENSE_MIN_LEMMA_OCC = 8; // ignore rare lemmas for Type B
function isContent(morph) { return /^(N-|V-|A-|N|V)/.test(String(morph||'')) && !/^(ADV|CONJ|PREP|PRT|T-)/.test(morph); }
const topDomain = ln => String(ln || '').split('.')[0];

export function computeDifferences(db) {
  db.exec(`DROP TABLE IF EXISTS differences;
    CREATE TABLE differences (book TEXT, chapter INTEGER, verse INTEGER, position INTEGER,
      type TEXT CHECK(type IN ('A','B')), strongs TEXT, detail TEXT);`);
  const insD = db.prepare('INSERT INTO differences VALUES (?,?,?,?,?,?,?)');

  // --- top-level Louw-Nida domain per strongs (Greek) ---
  const lnTop = new Map();
  for (const r of db.prepare("SELECT strongs, ln FROM word_domain WHERE ln<>''").all()) {
    if (!lnTop.has(r.strongs)) lnTop.set(r.strongs, topDomain(r.ln));
  }

  // --- symmetric Greek synonym adjacency (Proximity stores each pair once, in one direction) ---
  const adj = new Map(); // strongs -> Map(otherStrongs -> minDistance)
  const link = (a, b, d) => {
    if (!adj.has(a)) adj.set(a, new Map());
    const m = adj.get(a); if (!m.has(b) || d < m.get(b)) m.set(b, d);
  };
  for (const r of db.prepare('SELECT strongs_a a, strongs_b b, distance d FROM synonyms').all()) {
    if (!String(r.a).startsWith('G') || !String(r.b).startsWith('G') || r.a === r.b) continue;
    link(r.a, r.b, r.d); link(r.b, r.a, r.d);
  }
  // near-synonyms of a strongs: Greek, same top LN domain, within SYN_MAX, nearest first, capped
  const nearSynCache = new Map();
  function nearSyn(strongs) {
    if (nearSynCache.has(strongs)) return nearSynCache.get(strongs);
    const dom = lnTop.get(strongs);
    let out = [];
    if (dom && adj.has(strongs)) {
      out = [...adj.get(strongs)]
        .filter(([other, d]) => d <= SYN_MAX && lnTop.get(other) === dom)
        .sort((x, y) => x[1] - y[1]).slice(0, 4)
        .map(([other, d]) => ({ strongs: other, distance: Number(d.toFixed(3)) }));
    }
    nearSynCache.set(strongs, out); return out;
  }

  // --- Type B precompute: cluster a lemma's glosses into distinct senses (collapse inflections),
  //     keep senses that are >=SENSE_MIN_FRAC of the lemma's occurrences, need >=2 (grc only for v2) ---
  const senseByStrong = new Map(); // strongs -> {senses:[{gloss,count}], total}
  const byStrong = new Map();
  for (const r of db.prepare(`SELECT strongs, gloss_norm, COUNT(*) c FROM words
      WHERE lang='grc' AND strongs<>'' AND gloss_norm<>'' GROUP BY strongs, gloss_norm`).all()) {
    if (!byStrong.has(r.strongs)) byStrong.set(r.strongs, []);
    byStrong.get(r.strongs).push(r);
  }
  for (const [strongs, gs] of byStrong) {
    const total = gs.reduce((n, g) => n + g.c, 0);
    if (total < SENSE_MIN_LEMMA_OCC) continue;
    // cluster gloss_norm variants by sense key; representative gloss = most frequent member
    const clusters = new Map(); // key -> { gloss, count, top }
    for (const g of gs) {
      const key = senseKey(g.gloss_norm);
      const c = clusters.get(key) || { gloss: g.gloss_norm, count: 0, top: 0 };
      c.count += g.c;
      if (g.c > c.top) { c.top = g.c; c.gloss = g.gloss_norm; }
      clusters.set(key, c);
    }
    const senses = [...clusters.values()].filter(s => s.count / total >= SENSE_MIN_FRAC).sort((a, b) => b.count - a.count);
    if (senses.length >= 2) senseByStrong.set(strongs, { senses: senses.map(s => ({ gloss: s.gloss, count: s.count })), total });
  }

  // --- walk every Greek content word, emit A and/or B ---
  const words = db.prepare("SELECT book,chapter,verse,position,strongs,morph FROM words WHERE lang='grc' AND strongs<>''").all();
  db.exec('BEGIN');
  for (const w of words) {
    if (!isContent(w.morph)) continue;
    const syn = nearSyn(w.strongs);
    if (syn.length) insD.run(w.book, w.chapter, w.verse, w.position, 'A', w.strongs,
      JSON.stringify({ nearSynonyms: syn }));
    const b = senseByStrong.get(w.strongs);
    if (b) insD.run(w.book, w.chapter, w.verse, w.position, 'B', w.strongs, JSON.stringify(b));
  }
  db.exec('COMMIT');
  db.exec('CREATE INDEX idx_diff_ref ON differences(book,chapter,verse);');
}
