// MMS Hebrew (facebook/mms-tts-heb) character vocabulary: token -> id.
// Verbatim contents of the model's vocab.json:
//   curl -sL https://huggingface.co/facebook/mms-tts-heb/resolve/main/vocab.json
// The blank token ("|", id 0) is interleaved around every character. Characters
// absent from the map are dropped (this is how niqqud/cantillation get discarded —
// they are not in the vocab).
const VOCAB = {
  ' ': 31,
  "'": 29,
  '-': 30,
  '|': 0,
  'א': 3,
  'ב': 8,
  'ג': 20,
  'ד': 15,
  'ה': 4,
  'ו': 1,
  'ז': 23,
  'ח': 16,
  'ט': 25,
  'י': 2,
  'ך': 24,
  'כ': 13,
  'ל': 5,
  'ם': 9,
  'מ': 11,
  'ן': 18,
  'נ': 12,
  'ס': 21,
  'ע': 14,
  'ף': 26,
  'פ': 19,
  'ץ': 27,
  'צ': 22,
  'ק': 17,
  'ר': 10,
  'ש': 7,
  'ת': 6,
  '—': 28,
};

const BLANK = VOCAB['|'];

export function tokenize(text) {
  const ids = [BLANK];
  for (const ch of String(text)) {
    const id = VOCAB[ch];
    if (id === undefined) continue; // drop unknown (incl. niqqud)
    ids.push(id, BLANK);
  }
  return ids;
}
