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
  'not', 'so', 'as', 'then', 'who', 'whom', 'for', 'with', 'on', 'at', 'by', 'up',
  // function words: never the "sense" of a gloss — dropped anywhere, not just leading, so a trailing
  // particle ("spoken of", "gold the", "attention to") can't become the head and split one meaning.
  'the', 'a', 'an', 'of', 'to', 'and', 'or', 'but', 'in', 'into', 'from', 'out', 'off', 'down', 'over',
  'about', 'upon', 'when', 'if', 'which',
  // adverbial/directional particles of phrasal verbs ("pass away/through", "gird about") — not the sense
  'away', 'through', 'forth', 'again', 'apart', 'aside', 'toward', 'towards', 'around', 'upward', 'downward',
  'before', 'after', 'together',
  // reflexive/emphatic pronouns — grammatical, never the "sense" ("gird yourselves" is still gird)
  'myself', 'yourself', 'yourselves', 'himself', 'herself', 'itself', 'ourselves', 'themselves', 'oneself']);
// Irregular forms Porter can't reach. Normalized to the lemma spelling BEFORE stemming, so every
// inflection lands on one key (said/saying/says all -> porter('say')). Verbs + a few noun plurals.
const IRREGULAR = {
  said: 'say', saw: 'see', seen: 'see', knew: 'know', known: 'know', went: 'go', gone: 'go',
  made: 'make', took: 'take', taken: 'take', gave: 'give', given: 'give', came: 'come',
  spoke: 'speak', spoken: 'speak', brought: 'bring', told: 'tell',
  // more strong verbs whose past/participle Porter can't reach (ambiguous ones like left/wound omitted):
  flew: 'fly', flown: 'fly', fled: 'flee', ate: 'eat', eaten: 'eat', fell: 'fall', fallen: 'fall',
  rose: 'rise', risen: 'rise', ran: 'run', sat: 'sit', drank: 'drink', sang: 'sing', sung: 'sing',
  began: 'begin', begun: 'begin', bore: 'bear', borne: 'bear', drew: 'draw', drawn: 'draw',
  threw: 'throw', thrown: 'throw', grew: 'grow', grown: 'grow', blew: 'blow', blown: 'blow',
  bound: 'bind', sought: 'seek', taught: 'teach', caught: 'catch', fought: 'fight', wept: 'weep',
  kept: 'keep', slept: 'sleep', swore: 'swear', sworn: 'swear', tore: 'tear', torn: 'tear',
  chose: 'choose', chosen: 'choose', hid: 'hide', hidden: 'hide', laid: 'lay', paid: 'pay',
  lost: 'lose', dwelt: 'dwell', felt: 'feel', has: 'have', had: 'have', found: 'find',
  heard: 'hear', led: 'lead', met: 'meet', fed: 'feed', sold: 'sell', became: 'become',
  forgave: 'forgive', forgiven: 'forgive', arose: 'arise', arisen: 'arise', drove: 'drive',
  driven: 'drive', wrote: 'write', written: 'write', understood: 'understand', stood: 'stand',
  forsook: 'forsake', forsaken: 'forsake', slew: 'slay', slain: 'slay', swept: 'sweep',
  sent: 'send', spent: 'spend', lent: 'lend', bent: 'bend', meant: 'mean', built: 'build', dug: 'dig',
  children: 'child', men: 'man', women: 'woman', feet: 'foot', teeth: 'tooth', oxen: 'ox',
  people: 'person', cherubim: 'cherub', seraphim: 'seraph',
};

// Porter stemmer (Porter 1980). Measure-based (m) suffix stripping: the m>0 / m>1 guards are what
// keep it from over-stemming short content words (king->king, water->water) — a flat length rule
// can't tell those from real inflections. Collapses loving/loves->love, mercy/mercies->merci, etc.
const cns = '[^aeiou]', vwl = '[aeiouy]', Cs = cns + '[^aeiouy]*';
const mGr0 = new RegExp('^(' + Cs + ')?' + vwl + '[aeiou]*' + Cs);
const mGr1 = new RegExp('^(' + Cs + ')?' + vwl + '[aeiou]*' + Cs + vwl + '[aeiou]*' + Cs);
const mEq1 = new RegExp('^(' + Cs + ')?' + vwl + '[aeiou]*' + Cs + '(' + vwl + '[aeiou]*)?$');
const hasVowel = new RegExp('^(' + Cs + ')?' + vwl);
const step2 = { ational: 'ate', tional: 'tion', enci: 'ence', anci: 'ance', izer: 'ize', bli: 'ble', alli: 'al', entli: 'ent', eli: 'e', ousli: 'ous', ization: 'ize', ation: 'ate', ator: 'ate', alism: 'al', iveness: 'ive', fulness: 'ful', ousness: 'ous', aliti: 'al', iviti: 'ive', biliti: 'ble', logi: 'log' };
const step3 = { icate: 'ic', ative: '', alize: 'al', iciti: 'ic', ical: 'ic', ful: '', ness: '' };
function porter(w) {
  if (w.length < 3) return w;
  let m, s;
  if (w[0] === 'y') w = 'Y' + w.slice(1);
  if ((m = /^(.+?)(ss|i)es$/.exec(w))) w = m[1] + m[2];
  else if ((m = /^(.+?)([^s])s$/.exec(w))) w = m[1] + m[2];
  if ((m = /^(.+?)eed$/.exec(w))) { if (mGr0.test(m[1])) w = w.slice(0, -1); }
  else if ((m = /^(.+?)(ed|ing)$/.exec(w)) && hasVowel.test(m[1])) {
    w = m[1];
    if (/(at|bl|iz)$/.test(w)) w += 'e';
    else if (/([^aeiouylsz])\1$/.test(w)) w = w.slice(0, -1);
    else if (new RegExp('^' + Cs + vwl + '[^aeiouwxy]$').test(w)) w += 'e';
  }
  if ((m = /^(.+?)y$/.exec(w)) && hasVowel.test(m[1])) w = m[1] + 'i';
  if ((m = /^(.+?)(ational|tional|enci|anci|izer|bli|alli|entli|eli|ousli|ization|ation|ator|alism|iveness|fulness|ousness|aliti|iviti|biliti|logi)$/.exec(w)) && mGr0.test(m[1])) w = m[1] + step2[m[2]];
  if ((m = /^(.+?)(icate|ative|alize|iciti|ical|ful|ness)$/.exec(w)) && mGr0.test(m[1])) w = m[1] + step3[m[2]];
  if ((m = /^(.+?)(al|ance|ence|er|ic|able|ible|ant|ement|ment|ent|ou|ism|ate|iti|ous|ive|ize)$/.exec(w)) && mGr1.test(m[1])) w = m[1];
  else if ((m = /^(.+?)(s|t)(ion)$/.exec(w)) && mGr1.test(m[1] + m[2])) w = m[1] + m[2];
  if ((m = /^(.+?)e$/.exec(w))) { s = m[1]; if (mGr1.test(s) || (mEq1.test(s) && !new RegExp('^' + Cs + vwl + '[^aeiouwxy]$').test(s))) w = s; }
  if (/ll$/.test(w) && mGr1.test(w)) w = w.slice(0, -1);
  return w[0] === 'Y' ? 'y' + w.slice(1) : w;
}

function stemHead(w) {
  w = IRREGULAR[w] || w;
  let s = porter(w);
  // Agent/abstract nouns Porter's m>1 guard leaves whole (killer->kill, servant->serv, judgment->judg):
  // strip one derivation suffix, re-stem. Guarded to >=3 chars so it never makes a stub.
  const d = s.replace(/(ant|ent|er|or)$/, '');
  if (d.length >= 3 && d !== s) s = porter(d);
  return s;
}
export function senseKey(gloss) {
  // Split on whitespace AND "/" (the interlinear morpheme boundary), so attached particles are their
  // own tokens and get dropped by SENSE_STOP instead of dangling onto the head ("attention to/").
  const words = normalizeGloss(gloss).split(/[\s/]+/).filter(w => w && !SENSE_STOP.has(w));
  // An all-stopword gloss ("you yourselves", "will be") carries no lexical sense -> empty key, which
  // the Type-B clusterer drops. This keeps pronouns/auxiliaries from posing as distinct senses.
  const head = words[words.length - 1] || '';
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
