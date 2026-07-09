// Route a language code or Strong's number to an MMS model key ('heb' | 'ell'), or null if we
// can't voice it. `lang` is authoritative: Hebrew and Aramaic share the Strong's 'H' prefix, so
// only lang==='arc' identifies Aramaic (which we cannot voice).
export function route(lang) {
  const v = String(lang || '');
  if (v === 'grc' || v[0] === 'G') return 'ell'; // Greek -> mms-tts-ell
  if (v === 'hbo' || v[0] === 'H') return 'heb'; // Hebrew -> mms-tts-heb
  return null; // 'arc', empty, unknown -> no audio
}

export function canSpeak(lang) {
  return route(lang) !== null;
}
