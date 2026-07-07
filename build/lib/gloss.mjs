// build/lib/gloss.mjs
const LEADING = /^(the|a|an|of|to|and|in|\[the\]|\[a\])\s+/i;
export function normalizeGloss(s) {
  let g = String(s || '').toLowerCase().replace(/[\[\]]/g, '').trim();
  g = g.replace(/[.,;:!?"'’)(]+$/g, '').replace(/^[.,;:!?"'’)(]+/g, '').trim();
  while (LEADING.test(g)) g = g.replace(LEADING, '').trim();
  return g.replace(/[.,;:!?"'’)(]+$/g, '').trim();
}

// A coarse "sense key" that collapses inflections of the SAME English word, so Type-B sense-spread
// counts distinct MEANINGS, not spellings: "loving"/"loves"/"i dearly love" -> "lov"; "soul"/"souls"
// -> "soul". The last content word carries the sense; pronouns/auxiliaries are dropped, then a light
// stem. Imperfect (life/lives split on f/v) but enough to strip the gross inflectional noise.
const SENSE_STOP = new Set(['i', 'you', 'he', 'she', 'it', 'we', 'they', 'him', 'her', 'them', 'his',
  'my', 'your', 'their', 'our', 'me', 'us', 'do', 'did', 'does', 'may', 'might', 'will', 'would',
  'shall', 'should', 'can', 'could', 'be', 'being', 'been', 'is', 'was', 'are', 'were', 'that', 'this',
  'not', 'so', 'as', 'then', 'who', 'whom', 'for', 'with', 'on', 'at', 'by', 'up']);
function stemHead(w) {
  w = w.replace(/(ing|edly|ed|en|ly)$/, '');
  w = w.replace(/(?<!s)es$/, '').replace(/(?<!s)s$/, ''); // don't strip the s of kiss/class
  return w.replace(/e$/, '');
}
export function senseKey(gloss) {
  const words = normalizeGloss(gloss).split(/\s+/).filter(w => w && !SENSE_STOP.has(w));
  const head = words[words.length - 1] || normalizeGloss(gloss);
  return stemHead(head);
}

// Hebrew/Aramaic interlinear glosses carry grammatical baggage that senseKey (tuned for Greek/English)
// misreads as distinct senses: pronominal suffixes ("heart/ my"), construct particles ("god of"), and
// bracket markers ("<obj.>", "<to>"). Strip those, then reuse the shared senseKey stemmer. Used ONLY on
// the hbo/arc path so the Greek Type-B calibration and its tests are untouched.
const HEB_PRONOUN = /\/\s*(my|your|his|her|its|our|their|you|him|them|me|us)\b/g;
export function hebrewSenseKey(gloss) {
  const cleaned = String(gloss || '').toLowerCase()
    .replace(/<[^>]*>/g, ' ')     // <obj.>, <to>, <the>
    .replace(HEB_PRONOUN, ' ')    // pronominal suffix
    .replace(/\bof\b/g, ' ');     // construct chain
  return senseKey(cleaned);
}
