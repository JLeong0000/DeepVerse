// Plain-English explanations for the scholarly notation in STEPBible lexicon definitions.
// Keyed by the exact surface string as it appears in the text (case-sensitive). Shown as hover
// tooltips by GlossTerm.svelte via GlossedText.svelte. This is UI copy, not corpus data — it is
// deliberately NOT in bible.db (see docs/DATA-PIPELINE.md; a table would need the vendor pipeline).
export const GLOSSARY = {
  // --- Hebrew verb stems (binyanim) ---
  'Qal':        { label: 'Qal',        text: 'Simple active verb stem — the basic, plain action ("he broke").' },
  'Niphal':     { label: 'Niphal',     text: 'Simple passive or reflexive stem ("he was broken", "he broke himself").' },
  'Piel':       { label: 'Piel',       text: 'Intensive or resultative active stem ("he smashed").' },
  'Pual':       { label: 'Pual',       text: 'Intensive passive stem ("it was smashed").' },
  'Hiphil':     { label: 'Hiphil',     text: 'Causative active stem ("he caused/made someone break").' },
  'Hophal':     { label: 'Hophal',     text: 'Causative passive stem ("he was made to break").' },
  'Hithpael':   { label: 'Hithpael',   text: 'Reflexive or reciprocal intensive stem ("he broke himself", "they broke one another").' },
  'Polel':      { label: 'Polel',      text: 'Intensive active stem that stands in for Piel with hollow/geminate roots.' },
  'Poel':       { label: 'Poel',       text: 'A rarer active stem parallel to Piel, used with certain root types.' },
  'Polal':      { label: 'Polal',      text: 'Passive counterpart of the Polel stem.' },
  'Pilpel':     { label: 'Pilpel',     text: 'Intensive stem formed by reduplicating the root, used with certain roots.' },
  'Pulal':      { label: 'Pulal',      text: 'Passive counterpart of the Pilpel/Pilel stem.' },
  'Hithpolel':  { label: 'Hithpolel',  text: 'Reflexive stem parallel to Hithpael, used with hollow roots.' },
  'Hithpalpel': { label: 'Hithpalpel', text: 'Reflexive of the reduplicated (Pilpel) stem.' },
  'Pilel':      { label: 'Pilel',      text: 'A rare intensive active stem variant.' },
  'Palel':      { label: 'Palel',      text: 'A rare intensive stem variant.' },
  'Tiphel':     { label: 'Tiphel',     text: 'A rare stem prefixed with taw, of debated causative sense.' },
  // --- Aramaic verb stems ---
  'Pael':       { label: 'Pael',       text: 'Aramaic intensive active stem (the Aramaic counterpart of Hebrew Piel).' },
  'Aphel':      { label: 'Aphel',      text: 'Aramaic causative active stem (counterpart of Hebrew Hiphil).' },
  'Ithpael':    { label: 'Ithpael',    text: 'Aramaic reflexive/passive of the intensive stem.' },
  'Shaphel':    { label: 'Shaphel',    text: 'Aramaic causative stem formed with a shin prefix.' },

  // --- Grammar terms ---
  'accusative': { label: 'accusative', text: 'The direct-object case — the noun receiving the action.' },
  'genitive':   { label: 'genitive',   text: 'The "of" case — possession, source, or relationship.' },
  'dative':     { label: 'dative',     text: 'The "to/for" case — usually the indirect object.' },
  'aor.':       { label: 'aor. (aorist)', text: 'Greek tense for a simple, undefined past action, viewed as a whole.' },
  'impf.':      { label: 'impf. (imperfect)', text: 'Tense for ongoing or repeated past action ("was breaking").' },
  'pf.':        { label: 'pf. (perfect)', text: 'Completed past action with a continuing present result.' },
  'plpf.':      { label: 'plpf. (pluperfect)', text: 'A past action completed before another past point ("had broken").' },
  'pass.':      { label: 'pass. (passive)', text: 'Voice in which the subject receives the action.' },
  'mid.':       { label: 'mid. (middle)', text: 'Greek voice where the subject acts on or for itself.' },
  'act.':       { label: 'act. (active)', text: 'Voice in which the subject performs the action.' },
  'ptcp.':      { label: 'ptcp. (participle)', text: 'A verbal adjective ("breaking", "broken").' },
  'subst.':     { label: 'subst. (substantive)', text: 'A word used as a noun.' },
  'fig.':       { label: 'fig. (figurative)', text: 'Used non-literally, as a figure of speech.' },
  'metaph.':    { label: 'metaph. (metaphorically)', text: 'Used as a metaphor rather than literally.' },
  'absol.':     { label: 'absol. (absolutely)', text: 'Used on its own, without an object or complement.' },
  'comp.':      { label: 'comp. (comparative)', text: 'The "-er / more" form of an adjective or adverb.' },
  'intr.':      { label: 'intr. (intransitive)', text: 'A verb used without a direct object.' },
  'constr.':    { label: 'constr. (construct)', text: 'Hebrew "bound" noun form, joining to a following noun ("king-of").' },
  'abs.':       { label: 'abs. (absolute)', text: 'Hebrew free-standing noun form (opposite of construct).' },
  'denom.':     { label: 'denom. (denominative)', text: 'A verb derived from a noun.' },
  'cf.':        { label: 'cf. (confer)', text: 'Latin "compare" — see this related item.' },
  'ib.':        { label: 'ib. (ibidem)', text: 'Latin "in the same place" — the reference just cited.' },
  'q.v.':       { label: 'q.v. (quod vide)', text: 'Latin "which see" — look this term up elsewhere.' },
  'v.':         { label: 'v. (vide)', text: 'Latin "see".' },
  'SYN.':       { label: 'SYN.', text: 'Synonym — a word close in meaning, discussed for contrast.' },

  // --- Sources / sigla ---
  'LXX':    { label: 'LXX (Septuagint)', text: 'The ancient Greek translation of the Old Testament.' },
  'MT':     { label: 'MT (Masoretic Text)', text: 'The standard traditional Hebrew text of the Old Testament.' },
  'NT':     { label: 'NT', text: 'The New Testament.' },
  'AS':     { label: 'AS (Abbott-Smith)', text: 'Abbott-Smith, A Manual Greek Lexicon of the New Testament — the source of these Greek entries.' },
  'MM':     { label: 'MM (Moulton-Milligan)', text: 'Moulton & Milligan, The Vocabulary of the Greek New Testament, illustrated from the papyri.' },
  'VGT':    { label: 'VGT', text: 'The Vocabulary of the Greek Testament (Moulton & Milligan).' },
  'LS':     { label: 'LS (Liddell-Scott)', text: 'Liddell & Scott, A Greek-English Lexicon — the standard classical Greek dictionary.' },
  'Thayer': { label: 'Thayer', text: "Thayer's Greek-English Lexicon of the New Testament." },
  'Cremer': { label: 'Cremer', text: "Cremer's Biblico-Theological Lexicon of New Testament Greek." },
  'Trench': { label: 'Trench', text: "Trench's Synonyms of the New Testament." },
  'BDB':    { label: 'BDB', text: 'Brown-Driver-Briggs, A Hebrew and English Lexicon of the Old Testament.' },
  'TWOT':   { label: 'TWOT', text: 'Theological Wordbook of the Old Testament.' },
  'Boisacq':{ label: 'Boisacq', text: "Boisacq's Dictionnaire étymologique de la langue grecque (Greek etymology)." },
  'CLBL':   { label: 'CLBL', text: 'A Concise Lexicon of the Biblical Languages (the STEPBible reference lexicon).' },

  // --- Symbols (only standalone glyphs that never occur inside a word) ---
  '†': { label: '† (dagger)', text: 'Marks that every New Testament occurrence of the word is cited above.' },
  '§': { label: '§ (section)', text: 'Introduces a section — for a proper name, the traditional meaning of the name.' },
};

// Longest key first so a longer key wins over any shorter overlap (e.g. "Hithpolel" before "Polel").
const KEYS = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Pure-alpha keys need both boundaries (so "Qal" doesn't match inside "Qalander").
// Keys ending in "." need a leading boundary only (so "v." doesn't match inside "Rev.");
// the trailing "." is a literal. Symbols match bare.
function keyPattern(k) {
  if (!/^[A-Za-z]/.test(k)) return escapeRe(k);        // symbol
  if (k.endsWith('.')) return '\\b' + escapeRe(k);     // abbreviation ending in "."
  return '\\b' + escapeRe(k) + '\\b';                  // pure alphabetic
}

const RE = new RegExp('(' + KEYS.map(keyPattern).join('|') + ')', 'g');

// Split text into { plain } / { term } segments. A term segment's `term` is the exact GLOSSARY key.
export function tokenizeGlossary(text) {
  const s = String(text ?? '');
  const out = [];
  let last = 0;
  let m;
  RE.lastIndex = 0;
  while ((m = RE.exec(s)) !== null) {
    if (m.index > last) out.push({ plain: s.slice(last, m.index) });
    out.push({ term: m[0] });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ plain: s.slice(last) });
  return out;
}
