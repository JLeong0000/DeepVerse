// build/lib/macula.mjs
// STEPBible `words.strongs` are zero-padded (G0025). MACULA `strong` is bare (25). Normalize to match.
function padStrong(raw) {
  const s = String(raw || '').trim();
  const m = s.match(/^([GH])?(\d+)([A-Za-z]?)$/);
  if (!m) return '';
  const letter = m[1] || 'G';
  return letter + m[2].padStart(4, '0') + (m[3] || '');
}
export function parseMaculaGreekLine(line, header) {
  const c = String(line).split('\t');
  const col = (name) => c[header.indexOf(name)] ?? '';
  const strongRaw = col('strong');
  if (!strongRaw || strongRaw === 'strong') return null;
  const strongs = padStrong(strongRaw);
  if (!strongs) return null;
  return { strongs, lemma: col('lemma').trim(), gloss: col('gloss').trim(),
    domain: col('domain').trim(), ln: col('ln').trim(), frame: col('frame').trim() };
}
export function parseProximityLine(line) {
  const c = String(line).split('\t');
  if (c.length < 3 || c[0] === 'StrongNumberX1') return null;
  const distance = Number(c[2]);
  if (!c[0] || !c[1] || Number.isNaN(distance)) return null;
  return { a: c[0].trim(), b: c[1].trim(), distance };
}
