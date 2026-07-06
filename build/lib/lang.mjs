// build/lib/lang.mjs
// TAHOT morph codes begin with a language marker: 'H' = Hebrew, 'A' = Aramaic. The very first
// character is the marker (NOT stripped): after the marker comes the part-of-speech, and 'A' is also
// the POS code for a Hebrew adjective — e.g. 'HAcmsc' is a HEBREW adjective, not Aramaic. So classify
// purely on the leading character.
export function deriveLang(morph, defaultLang) {
  if (defaultLang === 'grc') return 'grc';
  return String(morph || '').startsWith('A') ? 'arc' : 'hbo';
}
