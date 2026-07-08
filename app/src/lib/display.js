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

// Strip leading attached-particle morphemes from a gloss so the sense reads cleanly:
// "and/ he called" -> "he called", "with/ the signet-ring of" -> "the signet-ring of",
// "and/ the/ earth" -> "earth", "<the>/ first" -> "first". Display-only; never returns empty.
const LEAD_PARTICLE = /^\s*(?:<[^>]*>|and|but|or|the|a|an|of|to|into|in|on|upon|with|for|from|as|when|then|so|that|which)\s*\/\s*/i;
export function cleanGloss(g) {
  let s = String(g || '').trim();
  let prev;
  do { prev = s; s = s.replace(LEAD_PARTICLE, '').trim(); } while (s !== prev && s);
  return s || String(g || '').trim();
}

// Render a transliteration for pronunciation: the "/" morpheme boundary (a prefix/suffix particle
// attached to the root, matching the Hebrew script) reads better as a hyphen — "be./ta.Ba.'at" ->
// "be-ta.Ba.'at". The "." syllable separators are kept. No-op for Greek (no "/").
export function readTranslit(t) {
  return String(t || '').replace(/\s*\.?\s*\/\s*/g, '-');
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
