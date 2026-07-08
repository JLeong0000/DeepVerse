// Route a language code or Strong's number to a TTS engine key.
// `lang` is authoritative: Hebrew and Aramaic share the Strong's 'H' prefix, so only
// lang==='arc' identifies Aramaic (which we cannot voice).
export function route(lang) {
  const v = String(lang || '');
  if (v === 'grc' || v[0] === 'G') return 'espeak';
  if (v === 'hbo' || v[0] === 'H') return 'mms';
  return null; // 'arc', empty, unknown -> no audio
}

export function canSpeak(lang) {
  return route(lang) !== null;
}
