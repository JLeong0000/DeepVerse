// The MMS Greek model (mms-tts-ell) is trained on MODERN, monotonic, lowercase Greek. NT text is
// polytonic (breathing marks, iota subscripts, grave/circumflex accents) and often capitalized — none
// of which are in the model's vocab, and feeding them raw drops whole letters. Fold the text down to
// monotonic lowercase so every letter survives (pronunciation is modern/iotacized, by design).
//
// Method: NFD-decompose, then per combining mark — keep tonos (U+0301) and dialytika (U+0308),
// fold grave (U+0300) and circumflex (U+0342) into tonos, and drop the rest (breathings U+0313/U+0314,
// iota subscript U+0345, etc.). NFC-recompose back to precomposed monotonic (ά, ή, ϊ, …).
const TONOS = '́';      // combining acute (monotonic accent)
const DIALYTIKA = '̈';  // combining diaeresis
// combining mark -> what to keep; anything not listed (breathings ̓/̔, iota subscript ͅ…) is dropped
const FOLD = {
  '́': TONOS,      // acute -> keep
  '̈': DIALYTIKA,  // dialytika -> keep
  '̀': TONOS,      // grave -> tonos
  '͂': TONOS,      // circumflex (perispomeni) -> tonos
};

export function toMonotonic(text) {
  let out = '';
  for (const ch of String(text).toLowerCase().normalize('NFD')) {
    const code = ch.codePointAt(0);
    if (code >= 0x0300 && code <= 0x036f) { // a combining mark
      const kept = FOLD[ch];
      if (kept) out += kept;
      continue;
    }
    out += ch;
  }
  return out.normalize('NFC');
}
