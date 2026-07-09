// MMS character vocabularies (token -> id), verbatim from each model's vocab.json:
//   curl -sL https://huggingface.co/facebook/mms-tts-{heb,ell}/resolve/main/vocab.json
// The blank/pad token has id 0 in both checkpoints and is interleaved around every character.
// Characters absent from a map are dropped (this is how Hebrew niqqud gets discarded, and how any
// stray non-Greek char is dropped after normalization).
import { toMonotonic } from './greek.js';

const VOCAB_HEB = {
  ' ': 31, "'": 29, '-': 30, '|': 0,
  'א': 3, 'ב': 8, 'ג': 20, 'ד': 15, 'ה': 4, 'ו': 1, 'ז': 23, 'ח': 16, 'ט': 25, 'י': 2,
  'ך': 24, 'כ': 13, 'ל': 5, 'ם': 9, 'מ': 11, 'ן': 18, 'נ': 12, 'ס': 21, 'ע': 14, 'ף': 26,
  'פ': 19, 'ץ': 27, 'צ': 22, 'ק': 17, 'ר': 10, 'ש': 7, 'ת': 6, '—': 28,
};

const VOCAB_ELL = {
  ' ': 24, "'": 17, '-': 13, '_': 58, 'b': 0,
  '0': 60, '1': 1, '2': 45, '3': 47, '4': 28, '5': 4, '6': 46, '7': 12, '8': 35, '9': 32,
  'a': 27, 'e': 48, 'h': 38, 'i': 7, 'k': 19, 'm': 43, 'n': 22, 'o': 44, 'p': 3, 't': 23,
  'x': 8, 'y': 25, 'z': 41, 'â': 30,
  'α': 56, 'β': 29, 'γ': 33, 'δ': 9, 'ε': 37, 'ζ': 40, 'η': 42, 'θ': 5, 'ι': 54, 'κ': 31,
  'λ': 11, 'μ': 55, 'ν': 39, 'ξ': 34, 'ο': 57, 'π': 15, 'ρ': 62, 'ς': 61, 'σ': 53, 'τ': 26,
  'υ': 49, 'φ': 14, 'χ': 36, 'ψ': 21, 'ω': 16,
  'ά': 10, 'έ': 52, 'ή': 2, 'ί': 6, 'ό': 20, 'ύ': 59, 'ώ': 50, 'ϊ': 18, 'ϋ': 51, 'ΐ': 63,
};

const VOCABS = { heb: VOCAB_HEB, ell: VOCAB_ELL };
const BLANK = 0;

// text -> MMS input_ids for the given model ('heb' | 'ell'). Greek is folded to modern monotonic
// lowercase first so polytonic NT letters survive; Hebrew is passed through (niqqud dropped by lookup).
export function tokenize(text, model) {
  const vocab = VOCABS[model];
  const prepared = model === 'ell' ? toMonotonic(text) : String(text);
  const ids = [BLANK];
  for (const ch of prepared) {
    const id = vocab[ch];
    if (id === undefined) continue; // drop unknown
    ids.push(id, BLANK);
  }
  return ids;
}
