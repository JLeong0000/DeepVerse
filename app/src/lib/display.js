// Display helpers for original-language words. The interlinear data is STEPBible/MACULA, which segments
// Hebrew into morphemes with "/" and packs prefixed particles (and/the/in/to) onto the root — so glosses,
// transliterations, and lexicon definitions all need a little shaping before they read cleanly in English.

// Language label from a Strong's code (G…=Greek, H…=Hebrew) or an explicit lang ('grc'/'hbo'/'arc').
// Prefer the explicit lang when known — a bare H can't tell Hebrew from Aramaic.
export function langLabel(strongsOrLang) {
  const v = String(strongsOrLang || '');
  if (v === 'grc' || v[0] === 'G') return 'Greek';
  if (v === 'arc') return 'Aramaic';
  if (v === 'hbo' || v[0] === 'H') return 'Hebrew';
  return 'original';
}

// "the NT" / "the OT" for a word, from its Strong's prefix (H = Old Testament).
export function testamentLabel(strongs) {
  return String(strongs || '')[0] === 'H' ? 'the OT' : 'the NT';
}

// Clean the interlinear-markup out of a gloss so it reads as plain English on the cards. The data
// joins a Hebrew word's morphemes with "/" — leading particle prefixes (and/the/to/in…) and trailing
// pronoun suffixes (my/his/it…) around the root — and wraps supplied/grammatical words in [..]/<..>.
// Split on "/", drop the pure-particle segments at each end (the root is what's left), then strip
// markers and outer punctuation: "with/ the signet-ring of" -> "the signet-ring of", "to the/ Tyrians"
// -> "Tyrians", "downfall/ your" -> "downfall", "[man] equipped" -> "man equipped". Never returns empty.
const PARTICLE = new Set(['and', 'but', 'or', 'the', 'a', 'an', 'of', 'to', 'into', 'in', 'on', 'onto',
  'upon', 'with', 'for', 'from', 'as', 'like', 'when', 'then', 'so', 'that', 'which', 'at', 'by',
  'my', 'your', 'his', 'her', 'its', 'our', 'their', 'me', 'him', 'them', 'us', 'it', 'i', 'he', 'she', 'we', 'they']);
const cleanSeg = seg => seg.replace(/<[^>]*>/g, ' ').replace(/[[\]]/g, '').replace(/[¿¶\\]/g, ' ').replace(/\s+/g, ' ').trim();
const isParticles = seg => seg !== '' && seg.split(/\s+/).every(w => PARTICLE.has(w.toLowerCase()));
export function cleanGloss(g) {
  const segs = String(g || '').split('/').map(cleanSeg);
  while (segs.length > 1 && (segs[0] === '' || isParticles(segs[0]))) segs.shift();
  while (segs.length > 1 && (segs.at(-1) === '' || isParticles(segs.at(-1)))) segs.pop();
  let s = segs.join(' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/^[.,;:!?"'’)(־׃]+|[.,;:!?"'’)(־׃]+$/g, '').trim();   // outer punctuation (incl. Hebrew maqaf/sof-passuq)
  // never reduce to nothing; a gloss that is ONLY markers/particles ("<the>", "and/ <obj.>") falls back
  // to its unwrapped, slash-free contents rather than showing the raw markup.
  const bare = String(g || '').replace(/[<>[\]¿¶\\]/g, '').replace(/\//g, ' ').replace(/\s+/g, ' ').trim();
  return s || bare || String(g || '').trim();
}

// Render a transliteration for pronunciation: the "/" morpheme boundary (a prefix/suffix particle
// attached to the root, matching the Hebrew script) reads better as a hyphen — "be./ta.Ba.'at" ->
// "be-ta.Ba.'at". The "." syllable separators are kept. No-op for Greek (no "/"). Also drop the
// trailing sof-passuq / pilcrow marks the interlinear leaves on the last word of a verse.
export function readTranslit(t) {
  return String(t || '').replace(/[\\׃¶]/g, '').replace(/\s*\.?\s*\/\s*/g, '-').trim();
}

// Parse a STEPBible lexicon definition into indentable {level, marker, text} rows.
// Greek definitions are "__"-delimited with Roman (I.) > arabic (1.) > lettered ((a)) markers.
// Hebrew (BDB) definitions have no "__": senses are numbered inline "1) … 1a) … 1a1) …" with (Stem)
// markers. Both collapse everything onto one line; we re-expand so the card can indent by level.
export function parseDefinition(def) {
  const d = String(def || '').trim();
  if (!d) return [];
  if (d.includes('__')) return parseGreekDef(d);
  if (/\s\d+[a-z]*\d*\)\s/.test(' ' + d + ' ')) return parseHebrewDef(d);
  return [{ level: -1, marker: '', text: d }];
}

// A scripture reference / citation run: a book-abbrev token ("Mat.", "1Co.", "III Jo") + chapter:verse,
// plus the trailing run of bare refs it drags along ("24:45 25:21, 23"). Within one lexicon sense, the
// gloss comes first and everything from here on is citations — the bulk of the entry's length.
const SCRIPTURE_REF = /\b(?:[IVX]{1,3}\s+)?\d?\s?[A-Z][A-Za-z]{1,3}\.?\s?\d+[:.]\d+(?:\s*[-,]?\s*\d+(?::\d+)?)*/;

// Condense a full lexicon definition to just the sense glosses for the Word-of-the-day card: drop the
// per-sense verse citations (keep each sense's text up to its first reference) while preserving the
// headword line and sense markers. Turns a ~1000-char wall into a couple of readable lines.
export function shortDefinition(def) {
  return parseDefinition(def)
    .map(r => {
      const m = r.text.match(SCRIPTURE_REF);
      const body = (m ? r.text.slice(0, r.text.indexOf(m[0])) : r.text).replace(/[;:,\s]+$/, '').trim();
      return body && r.marker ? `${r.marker} ${body}` : body;
    })
    .filter(Boolean)
    .join(' ');
}

function parseGreekDef(d) {
  return d.split(/\s*__\s*/).map(s => s.trim()).filter(Boolean).map((s, i) => {
    let m;
    if (i === 0) return { level: -1, marker: '', text: s };                       // lead: headword + etymology
    if ((m = s.match(/^([IVX]+)\.\s*/))) return { level: 0, marker: m[1] + '.', text: s.slice(m[0].length) };
    if ((m = s.match(/^(\d+)\.\s*/))) return { level: 1, marker: m[1] + '.', text: s.slice(m[0].length) };
    if ((m = s.match(/^\(([^)]+)\)\s*/))) return { level: 2, marker: '(' + m[1] + ')', text: s.slice(m[0].length) };
    return { level: -1, marker: '', text: s };
  });
}

function parseHebrewDef(d) {
  // Break before each BDB marker "1)" / "1a)" / "1a1)". Level = depth of the marker:
  // "1)" -> 0, "1a)" -> 1, "1a1)" -> 2.
  return d.split(/\s+(?=\d+[a-z]*\d*\)\s)/).map(s => s.trim()).filter(Boolean).map(s => {
    const m = s.match(/^(\d+)([a-z]*)(\d*)\)\s*/);
    if (!m) return { level: -1, marker: '', text: s };                            // lead: headword gloss
    const level = m[3] ? 2 : m[2] ? 1 : 0;
    return { level, marker: s.slice(0, m[0].length).trim(), text: s.slice(m[0].length).trim() };
  });
}

// Tyndale article bodies are stored as newline-separated blocks, with subheads prefixed "## "
// by build/lib/tyndale.mjs (structureBody). Splitting them back out is what lets a 20k-character
// article render as headings and paragraphs instead of one unreadable run.
const HEAD_MARK = '## ';

export function parseArticleBlocks(body) {
  return String(body || '').split('\n').filter(Boolean).map((line) =>
    line.startsWith(HEAD_MARK)
      ? { kind: 'head', text: line.slice(HEAD_MARK.length) }
      : { kind: line.startsWith('•') ? 'item' : 'para', text: line });
}

// Splits a body block into the cross-reference targets the BUILD recorded, and the prose around
// them.
//
// Which runs are cross-references is decided once, at build time, from Tyndale's own link markup —
// see build/lib/xref.mjs. This function never re-decides it. It looks only for the exact strings
// `byRaw` holds, which are the source's own link texts and are guaranteed to occur verbatim in this
// body, and only in the two positions where a match is unambiguous:
//
//   1. inside a "See …" clause
//   2. as the whole of a bulleted item ("• Bible, Canon of the")
//
// Both are whole-run matches, so they cannot fire on an ordinary mention: "Jephthah" appears
// dozens of times in `Judges, Book of`, and underlining every one because the source linked it once
// would be guessing at which. Those mid-prose links are still doors — see "Where this leads" — they
// simply carry no inline underline. Exactly 5 of the 5,164 edges are in that position; the other 7
// prose links point somewhere a See clause in the same article already reaches.
//
// Targets are matched literally, NOT by splitting on ';', because one link's text can contain one:
// "See Birds (Fowl, Domestic; Partridge)." is a single link naming two subheads of Birds, and
// splitting it produced a broken "Birds (Fowl, Domestic" target plus an orphan "Partridge)".
// Longest-first, so a raw that is a prefix of another cannot win.
//
// Every character outside a matched target is passed through verbatim, including the separators.
// Nothing is re-emitted from a template, which is why the source's own "; " spacing survives.
//
// byRaw: Map<raw, {id,title,anchor}>
// returns: [{kind:'text',text} | {kind:'link',raw,id,title,anchor}]
const SEE_CLAUSE = /\bSee(?: also)? ([^.\n]+)\./g;
const BULLET = /^([•\s]*)(.*?)\s*$/;

export function splitEntryLinks(text, byRaw) {
  const src = String(text ?? '');
  const spans = [];
  if (byRaw?.size) {
    const raws = [...byRaw.keys()].sort((a, b) => b.length - a.length);
    const find = (from, upTo) => {
      for (let i = from; i < upTo;) {
        const raw = raws.find((r) => src.startsWith(r, i) && i + r.length <= upTo);
        if (!raw) { i++; continue; }
        spans.push({ start: i, end: i + raw.length, raw, hit: byRaw.get(raw) });
        i += raw.length;
      }
    };
    SEE_CLAUSE.lastIndex = 0;
    let m;
    while ((m = SEE_CLAUSE.exec(src))) {
      const capStart = m.index + m[0].length - 1 - m[1].length;
      find(capStart, capStart + m[1].length);
    }
    if (!spans.length) {
      // a bulleted item that IS a link, whole: "• Bible, Canon of the"
      const b = src.match(BULLET);
      if (b && byRaw.has(b[2])) spans.push({ start: b[1].length, end: b[1].length + b[2].length,
        raw: b[2], hit: byRaw.get(b[2]) });
    }
  }
  const out = [];
  let last = 0;
  for (const s of spans) {
    if (s.start > last) out.push({ kind: 'text', text: src.slice(last, s.start) });
    out.push({ kind: 'link', raw: s.raw, ...s.hit });
    last = s.end;
  }
  if (last < src.length) out.push({ kind: 'text', text: src.slice(last) });
  return out;
}

// The same idea for a study note, which writes its links in one fixed shape instead of a See
// clause: (see “Blessing” Theme Note). The quotes are the disambiguator and are part of the match —
// "Blessing" as a bare word occurs in prose that means nothing of the sort, while the quoted form
// occurs exactly once per link in all 117 cases and never anywhere else. They are included in the
// underlined span too: a reader aiming at a two-character gap between quote and word is a reader
// who misses. Every occurrence is linked, not just the first — a note that quotes its target twice
// means the same passage both times.
//
// links: [{ raw, pkind, ptitle, pbook }] — build/parse-tyndale.mjs resolved every one of them
// returns: [{kind:'text',text} | {kind:'link',raw,pkind,ptitle,pbook}]
export function splitNoteLinks(text, links) {
  const src = String(text ?? '');
  if (!links?.length) return [{ kind: 'text', text: src }];
  const spans = [];
  for (const l of links) {
    const quoted = `“${l.raw}”`;
    for (let i = src.indexOf(quoted); i >= 0; i = src.indexOf(quoted, i + quoted.length))
      spans.push({ start: i, end: i + quoted.length, raw: quoted, hit: l });
  }
  spans.sort((a, b) => a.start - b.start);
  const out = [];
  let last = 0;
  for (const s of spans) {
    if (s.start < last) continue;   // a longer span already covered this one
    if (s.start > last) out.push({ kind: 'text', text: src.slice(last, s.start) });
    // hit's own `raw` is the bare title; the span that gets underlined is the quoted form, so it
    // wins here — spreading it the other way round would drop the quotes out of the prose
    out.push({ kind: 'link', ...s.hit, raw: s.raw });
    last = s.end;
  }
  if (last < src.length) out.push({ kind: 'text', text: src.slice(last) });
  return out;
}

// A one-line preview for the card: headings and bullets are structural, so drop them and run the
// prose together. Used where only the opening of an article is shown.
export function articlePreview(body, max) {
  const prose = parseArticleBlocks(body).filter((b) => b.kind === 'para').map((b) => b.text).join(' ');
  return prose.length > max ? prose.slice(0, max).trimEnd() + '…' : prose;
}
