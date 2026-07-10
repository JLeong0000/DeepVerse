// build/lib/differences.mjs
import { senseKey, hebrewSenseKey } from './gloss.mjs';
import { baseHeb } from './macula.mjs';
// Precompute the interpretive-difference table. Type A (synonym collapse): a content word whose Strong's
// has a near-synonym (different Strong's) sharing its top-level semantic domain but a different sub-domain,
// with a proximity distance in a BAND [synMin, synMax]. Type B (sense spread): a lemma whose glosses
// cluster into >=2 distinct senses, each >= SENSE_MIN_FRAC of its occurrences.
//
// The engine runs once per language group. Greek (grc) uses Louw-Nida domains (dotted, "25.43" -> top "25")
// and clean glosses. Hebrew/Aramaic (hbo/arc, added later) use SDBH lexdomain (undotted, first 3-digit group
// is the top), a base-Strong key normalizer, a Hebrew-aware content test, gloss cleanup, and extra Type-A
// precision filters. Greek behavior here is byte-identical to the pre-refactor engine.
const SYN_MIN = 0.45;        // below this a near-synonym is used near-interchangeably (trivial)
const SYN_MAX = 0.60;        // above this it is not really a synonym
const A_FREQ_MAX = 300;      // Type A: skip common words (copula/quantifiers/"say"/"God") — grammatical, not interpretive
const SENSE_MIN_FRAC = 0.05;
const SENSE_MIN_COUNT = 3;   // a sense rendered <3× is anecdotal, not a real spread — drop the sliver
const SENSE_MIN_LEMMA_OCC = 8;
const VERB_FREQ_MAX = 1000;  // Type B (OT): a predominantly-verb lemma above this is a grammatical
                             // workhorse (say/be/go) whose gloss spread is inflection, not sense — drop it

const isGreekContent = m => /^(N-|V-|A-|N|V)/.test(String(m || '')) && !/^(ADV|CONJ|PREP|PRT|T-)/.test(m);
const grcTop = ln => String(ln || '').split('.')[0];

// Hebrew/Aramaic content-word test: a leading H (Hebrew) or A (Aramaic) LANG marker is present only when
// the next char is an uppercase POS letter; strip it, then accept common noun (Nc), verb (V), adjective (A).
// This distinguishes the lang-marker 'A' from the adjective POS 'A' (which is followed by a lowercase class).
export function isHebrewContent(morph) {
  const m = String(morph || '');
  const rest = /^[HA][A-Z]/.test(m) ? m.slice(1) : m;
  return /^(Nc|V|A)/.test(rest);
}
const hebTop = ln => String(ln || '').slice(0, 3);

export function computeDifferences(db) {
  db.exec(`DROP TABLE IF EXISTS differences;
    CREATE TABLE differences (book TEXT, chapter INTEGER, verse INTEGER, position INTEGER,
      type TEXT CHECK(type IN ('A','B')), strongs TEXT, detail TEXT);`);
  const insD = db.prepare('INSERT INTO differences VALUES (?,?,?,?,?,?,?)');

  runLanguageGroup(db, insD, {
    langs: ['grc'], keyPrefix: 'G', normKey: s => s,
    isContent: isGreekContent, senseKeyFn: senseKey, topFn: grcTop,
    typeA: { synMin: SYN_MIN, synMax: SYN_MAX, freqMax: A_FREQ_MAX },
  });

  runLanguageGroup(db, insD, {
    langs: ['hbo', 'arc'], keyPrefix: 'H', normKey: baseHeb,
    isContent: isHebrewContent, senseKeyFn: hebrewSenseKey, topFn: hebTop,
    typeA: { synMin: SYN_MIN, synMax: SYN_MAX, freqMax: A_FREQ_MAX, freqMin: SENSE_MIN_LEMMA_OCC,
             excludeProperNouns: true, requireDiffSense: true },
    typeB: { suppressVerbsAboveFreq: VERB_FREQ_MAX, excludeProperNouns: true },
  });

  db.exec('CREATE INDEX idx_diff_ref ON differences(book,chapter,verse);');
}

function runLanguageGroup(db, insD, cfg) {
  const { langs, keyPrefix, normKey, isContent, senseKeyFn, topFn, typeA, typeB } = cfg;
  const inClause = langs.map(l => `'${l}'`).join(',');

  // --- domain per normalized strongs: full domain string + top-level ---
  const lnFull = new Map();
  for (const r of db.prepare("SELECT strongs, ln FROM word_domain WHERE ln<>''").all()) {
    if (!String(r.strongs).startsWith(keyPrefix)) continue;
    const k = normKey(r.strongs);
    if (k && !lnFull.has(k)) lnFull.set(k, String(r.ln).trim());
  }
  const lnTop = new Map([...lnFull].map(([s, ln]) => [s, topFn(ln)]));

  // --- symmetric synonym adjacency (normalized keys) ---
  const adj = new Map();
  const link = (a, b, d) => { if (!adj.has(a)) adj.set(a, new Map()); const m = adj.get(a); if (!m.has(b) || d < m.get(b)) m.set(b, d); };
  for (const r of db.prepare('SELECT strongs_a a, strongs_b b, distance d FROM synonyms').all()) {
    if (!String(r.a).startsWith(keyPrefix) || !String(r.b).startsWith(keyPrefix)) continue;
    const a = normKey(r.a), b = normKey(r.b);
    if (!a || !b || a === b) continue;
    link(a, b, r.d); link(b, a, r.d);
  }

  // --- frequency per normalized strongs (gates Type A; also used by the OT frequency floor later) ---
  const freq = new Map();
  for (const r of db.prepare(`SELECT strongs, COUNT(*) n FROM words WHERE lang IN (${inClause}) AND strongs<>'' GROUP BY strongs`).all()) {
    const k = normKey(r.strongs); if (k) freq.set(k, (freq.get(k) || 0) + r.n);
  }

  // --- OT-only Type-A precision filters (empty/no-op unless the group requests them) ---
  const properNoun = new Set();   // base strongs whose majority morph is a proper noun (Np)
  const repSense = new Map();     // base strongs -> representative cleaned sense key (most common gloss)
  if ((typeA && typeA.excludeProperNouns) || (typeB && typeB.excludeProperNouns)) {
    for (const r of db.prepare(`SELECT strongs, SUM(CASE WHEN morph LIKE 'Np%' OR morph LIKE 'HNp%' OR morph LIKE 'ANp%' THEN 1 ELSE 0 END) np, COUNT(*) tot
        FROM words WHERE lang IN (${inClause}) AND strongs<>'' GROUP BY strongs`).all()) {
      const k = normKey(r.strongs); if (k && r.np > r.tot / 2) properNoun.add(k);
    }
  }
  const verbLemma = new Set();    // base strongs whose majority morph is a verb (V) — for Type-B suppression
  if (typeB && typeB.suppressVerbsAboveFreq) {
    for (const r of db.prepare(`SELECT strongs, SUM(CASE WHEN morph LIKE 'V%' OR morph LIKE 'HV%' OR morph LIKE 'AV%' THEN 1 ELSE 0 END) v, COUNT(*) tot
        FROM words WHERE lang IN (${inClause}) AND strongs<>'' GROUP BY strongs`).all()) {
      const k = normKey(r.strongs); if (k && r.v > r.tot / 2) verbLemma.add(k);
    }
  }
  if (typeA && typeA.requireDiffSense) {
    const top = new Map(); // k -> {c, key}
    for (const r of db.prepare(`SELECT strongs, gloss_norm, COUNT(*) c FROM words
        WHERE lang IN (${inClause}) AND gloss_norm<>'' GROUP BY strongs, gloss_norm`).all()) {
      const k = normKey(r.strongs); if (!k) continue;
      const e = top.get(k);
      if (!e || r.c > e.c) top.set(k, { c: r.c, key: senseKeyFn(r.gloss_norm) });
    }
    for (const [k, e] of top) repSense.set(k, e.key);
  }

  // --- near-synonyms of a strongs: same top domain, different full domain, distance in band, nearest first ---
  const nearSynCache = new Map();
  function nearSyn(strongs) {
    if (nearSynCache.has(strongs)) return nearSynCache.get(strongs);
    const dom = lnTop.get(strongs), sub = lnFull.get(strongs);
    let out = [];
    if (typeA && dom && adj.has(strongs)) {
      out = [...adj.get(strongs)]
        .filter(([o, d]) => d >= typeA.synMin && d <= typeA.synMax
          && lnTop.get(o) === dom && lnFull.get(o) !== sub
          && (!typeA.freqMin || ((freq.get(o) || 0) >= typeA.freqMin && (freq.get(strongs) || 0) >= typeA.freqMin))
          && (!typeA.excludeProperNouns || (!properNoun.has(o) && !properNoun.has(strongs)))
          && (!typeA.requireDiffSense || (repSense.get(o) && repSense.get(strongs) && repSense.get(o) !== repSense.get(strongs))))
        .sort((x, y) => x[1] - y[1]).slice(0, 4)
        .map(([o, d]) => ({ strongs: o, distance: Number(d.toFixed(3)) }));
    }
    nearSynCache.set(strongs, out); return out;
  }

  // --- Type B: cluster a lemma's glosses into distinct senses (>= SENSE_MIN_FRAC each, >=2 total) ---
  const senseByStrong = new Map();
  const byStrong = new Map();
  for (const r of db.prepare(`SELECT strongs, gloss_norm, COUNT(*) c FROM words
      WHERE lang IN (${inClause}) AND strongs<>'' AND gloss_norm<>'' GROUP BY strongs, gloss_norm`).all()) {
    const k = normKey(r.strongs); if (!k) continue;
    if (!byStrong.has(k)) byStrong.set(k, new Map());
    const gm = byStrong.get(k); gm.set(r.gloss_norm, (gm.get(r.gloss_norm) || 0) + r.c);
  }
  for (const [k, gm] of byStrong) {
    if (typeB && typeB.suppressVerbsAboveFreq && verbLemma.has(k) && (freq.get(k) || 0) > typeB.suppressVerbsAboveFreq) continue;
    if (typeB && typeB.excludeProperNouns && properNoun.has(k)) continue;   // place/person names have no sense-spread
    const total = [...gm.values()].reduce((n, c) => n + c, 0);
    if (total < SENSE_MIN_LEMMA_OCC) continue;
    const clusters = new Map();
    for (const [gloss, c] of gm) {
      const key = senseKeyFn(gloss);
      if (!key) continue;   // all-stopword gloss (pronoun/auxiliary) — no lexical sense to count
      const cl = clusters.get(key) || { gloss, count: 0, top: 0 };
      cl.count += c; if (c > cl.top) { cl.top = c; cl.gloss = gloss; }
      clusters.set(key, cl);
    }
    const senses = [...clusters.values()].filter(s => s.count >= SENSE_MIN_COUNT && s.count / total >= SENSE_MIN_FRAC).sort((a, b) => b.count - a.count);
    if (senses.length >= 2) senseByStrong.set(k, { senses: senses.map(s => ({ gloss: s.gloss, count: s.count })), total });
  }

  // --- walk content words, emit A and/or B (row stores the ORIGINAL words.strongs, joined by position) ---
  const words = db.prepare(`SELECT book,chapter,verse,position,strongs,morph FROM words WHERE lang IN (${inClause}) AND strongs<>''`).all();
  db.exec('BEGIN');
  for (const w of words) {
    if (!isContent(w.morph)) continue;
    const k = normKey(w.strongs); if (!k) continue;
    const syn = (typeA && (freq.get(k) || 0) <= typeA.freqMax) ? nearSyn(k) : [];
    if (syn.length) insD.run(w.book, w.chapter, w.verse, w.position, 'A', w.strongs, JSON.stringify({ nearSynonyms: syn }));
    const b = senseByStrong.get(k);
    if (b) insD.run(w.book, w.chapter, w.verse, w.position, 'B', w.strongs, JSON.stringify(b));
  }
  db.exec('COMMIT');
}
