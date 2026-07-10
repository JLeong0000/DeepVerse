// Display helpers for original-language words. The interlinear data is STEPBible/MACULA, which segments
// Hebrew into morphemes with "/" and packs prefixed particles (and/the/in/to) onto the root — so glosses,
// transliterations, and lexicon definitions all need a little shaping before they read cleanly in English.

// Language label from a Strong's code (G…=Greek, H…=Hebrew) or an explicit lang ('grc'/'hbo'/'arc').
// Prefer the explicit lang when known — a bare H can't tell Hebrew from Aramaic.
export function langLabel(strongsOrLang) {
  const v = String(strongsOrLang || '');
  if (v === 'grc' || v[0] === 'G') return 'Greek';
  if (v === 'arc') return 'Aramaic';
  if (v === 'hbo' || v[0] === 'H') return 'Hebrew';
  return 'original';
}

// "the NT" / "the OT" for a word, from its Strong's prefix (H = Old Testament).
export function testamentLabel(strongs) {
  return String(strongs || '')[0] === 'H' ? 'the OT' : 'the NT';
}

// Clean the interlinear-markup out of a gloss so it reads as plain English on the cards. The data
// joins a Hebrew word's morphemes with "/" — leading particle prefixes (and/the/to/in…) and trailing
// pronoun suffixes (my/his/it…) around the root — and wraps supplied/grammatical words in [..]/<..>.
// Split on "/", drop the pure-particle segments at each end (the root is what's left), then strip
// markers and outer punctuation: "with/ the signet-ring of" -> "the signet-ring of", "to the/ Tyrians"
// -> "Tyrians", "downfall/ your" -> "downfall", "[man] equipped" -> "man equipped". Never returns empty.
const PARTICLE = new Set(['and', 'but', 'or', 'the', 'a', 'an', 'of', 'to', 'into', 'in', 'on', 'onto',
  'upon', 'with', 'for', 'from', 'as', 'like', 'when', 'then', 'so', 'that', 'which', 'at', 'by',
  'my', 'your', 'his', 'her', 'its', 'our', 'their', 'me', 'him', 'them', 'us', 'it', 'i', 'he', 'she', 'we', 'they']);
const cleanSeg = seg => seg.replace(/<[^>]*>/g, ' ').replace(/[[\]]/g, '').replace(/[¿¶\\]/g, ' ').replace(/\s+/g, ' ').trim();
const isParticles = seg => seg !== '' && seg.split(/\s+/).every(w => PARTICLE.has(w.toLowerCase()));
export function cleanGloss(g) {
  const segs = String(g || '').split('/').map(cleanSeg);
  while (segs.length > 1 && (segs[0] === '' || isParticles(segs[0]))) segs.shift();
  while (segs.length > 1 && (segs.at(-1) === '' || isParticles(segs.at(-1)))) segs.pop();
  let s = segs.join(' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/^[.,;:!?"'’)(־׃]+|[.,;:!?"'’)(־׃]+$/g, '').trim();   // outer punctuation (incl. Hebrew maqaf/sof-passuq)
  // never reduce to nothing; a gloss that is ONLY markers/particles ("<the>", "and/ <obj.>") falls back
  // to its unwrapped, slash-free contents rather than showing the raw markup.
  const bare = String(g || '').replace(/[<>[\]¿¶\\]/g, '').replace(/\//g, ' ').replace(/\s+/g, ' ').trim();
  return s || bare || String(g || '').trim();
}

// Render a transliteration for pronunciation: the "/" morpheme boundary (a prefix/suffix particle
// attached to the root, matching the Hebrew script) reads better as a hyphen — "be./ta.Ba.'at" ->
// "be-ta.Ba.'at". The "." syllable separators are kept. No-op for Greek (no "/"). Also drop the
// trailing sof-passuq / pilcrow marks the interlinear leaves on the last word of a verse.
export function readTranslit(t) {
  return String(t || '').replace(/[\\׃¶]/g, '').replace(/\s*\.?\s*\/\s*/g, '-').trim();
}

// Parse a STEPBible lexicon definition into indentable {level, marker, text} rows.
// Greek definitions are "__"-delimited with Roman (I.) > arabic (1.) > lettered ((a)) markers.
// Hebrew (BDB) definitions have no "__": senses are numbered inline "1) … 1a) … 1a1) …" with (Stem)
// markers. Both collapse everything onto one line; we re-expand so the card can indent by level.
export function parseDefinition(def) {
  const d = String(def || '').trim();
  if (!d) return [];
  if (d.includes('__')) return parseGreekDef(d);
  if (/\s\d+[a-z]*\d*\)\s/.test(' ' + d + ' ')) return parseHebrewDef(d);
  return [{ level: -1, marker: '', text: d }];
}

function parseGreekDef(d) {
  return d.split(/\s*__\s*/).map(s => s.trim()).filter(Boolean).map((s, i) => {
    let m;
    if (i === 0) return { level: -1, marker: '', text: s };                       // lead: headword + etymology
    if ((m = s.match(/^([IVX]+)\.\s*/))) return { level: 0, marker: m[1] + '.', text: s.slice(m[0].length) };
    if ((m = s.match(/^(\d+)\.\s*/))) return { level: 1, marker: m[1] + '.', text: s.slice(m[0].length) };
    if ((m = s.match(/^\(([^)]+)\)\s*/))) return { level: 2, marker: '(' + m[1] + ')', text: s.slice(m[0].length) };
    return { level: -1, marker: '', text: s };
  });
}

function parseHebrewDef(d) {
  // Break before each BDB marker "1)" / "1a)" / "1a1)". Level = depth of the marker:
  // "1)" -> 0, "1a)" -> 1, "1a1)" -> 2.
  return d.split(/\s+(?=\d+[a-z]*\d*\)\s)/).map(s => s.trim()).filter(Boolean).map(s => {
    const m = s.match(/^(\d+)([a-z]*)(\d*)\)\s*/);
    if (!m) return { level: -1, marker: '', text: s };                            // lead: headword gloss
    const level = m[3] ? 2 : m[2] ? 1 : 0;
    return { level, marker: s.slice(0, m[0].length).trim(), text: s.slice(m[0].length).trim() };
  });
}
