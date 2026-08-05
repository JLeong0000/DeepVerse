import { test, expect, beforeAll, describe } from 'vitest';
import fs from 'node:fs';
import initSqlJs from 'sql.js';
import * as db from './db.js';
import { bookOrder } from './refs.js';

// Load the real built bible.db once (fs, not fetch — vitest has no server for a 135 MB file).
beforeAll(async () => {
  const SQL = await initSqlJs();
  const path = fs.existsSync('public/bible.db') ? 'public/bible.db' : '../data/bible.db';
  const buf = fs.readFileSync(path);
  db._setDbForTest(new SQL.Database(new Uint8Array(buf)));
});

describe('1.2 reader + versions', () => {
  test('getChapter returns ordered verses', () => {
    const rows = db.getChapter('NIV', 'John', 3);
    expect(rows).toHaveLength(36);
    expect(rows[0].verse).toBe(1);
    expect(rows.at(-1).verse).toBe(36);
  });
  test('getVerseAllVersions returns all three', () => {
    const rows = db.getVerseAllVersions('John', 3, 16);
    expect(rows.map(r => r.version).sort()).toEqual(['NIV', 'NKJV', 'NLT']);
  });
  test('getChapterLanguages: Gen 1 hbo, Matt 1 grc, Dan 2 mixed', () => {
    expect(db.getChapterLanguages('Gen', 1)).toEqual(['hbo']);
    expect(db.getChapterLanguages('Matt', 1)).toEqual(['grc']);
    expect(db.getChapterLanguages('Dan', 2).sort()).toEqual(['arc', 'hbo']);
  });
});

describe('1.3 interlinear', () => {
  test('getInterlinear ordered, with transliteration', () => {
    const words = db.getInterlinear('John', 3, 16);
    expect(words[0].translit).toBe('houtōs');
    expect(words.every((w, i) => i === 0 || w.position > words[i - 1].position)).toBe(true);
  });
  test('getInterlinear returns a lang for each word', () => {
    const words = db.getInterlinear('John', 1, 1);
    expect(words.length).toBeGreaterThan(0);
    expect(words[0].lang).toBe('grc');
  });
  test('getLexicon resolves G0025 and falls back past a homograph letter', () => {
    expect(db.getLexicon('G0025').definition.toLowerCase()).toContain('love');
    expect(db.getLexicon('H0996G')).not.toBeNull(); // base H0996 lookup after stripping trailing G
    // dStrong homograph sub-spelling: words key on H2235B, whose lexicon def sits under the dStrong column
    expect(db.getLexicon('H2235B')?.definition?.toLowerCase()).toContain('vegetable');
    // bare normalized code (near-synonym) with only homograph-split entries H2654A/H2654a resolves via prefix
    expect(db.getLexicon('H2654')).not.toBeNull();
  });
  test('word strongs drop the sub-sense suffix (both _A and _a) so they key on the base lemma', () => {
    // regression: lowercase _a/_b used to slip past the uppercase-only strip, leaving unresolvable codes
    const leftover = db.query("SELECT DISTINCT strongs FROM words WHERE strongs LIKE '%\\_%' ESCAPE '\\' AND strongs NOT LIKE '%,%'");
    expect(leftover).toEqual([]);
    // John 1:18 "θεὸς" came in as G2316_b; it must resolve to G2316's lexicon entry, not an empty one
    const theos = db.getInterlinear('John', 1, 18).find(w => w.original === 'θεὸς');
    expect(theos.strongs).toBe('G2316');
    expect(db.getLexicon(theos.strongs).definition.toLowerCase()).toContain('god');
  });
});

describe('1.4 differences', () => {
  test('John 21:15 has a Type A on agapao with phileo among near-synonyms', () => {
    const diffs = db.getVerseDifferences('John', 21, 15);
    const a = diffs.find(d => d.type === 'A' && d.strongs === 'G0025');
    expect(a).toBeTruthy();
    const syns = a.detail.nearSynonyms.map(s => s.strongs);
    expect(syns).toContain('G5368'); // phileo
    expect(a.detail.nearSynonyms.find(s => s.strongs === 'G5368').lemma).toBeTruthy();
  });
  test('John 12:25 has Type B on psyche (soul/life) and Type A on phileo', () => {
    const diffs = db.getVerseDifferences('John', 12, 25);
    const b = diffs.find(d => d.type === 'B' && d.strongs === 'G5590');
    expect(b).toBeTruthy();
    const glosses = b.detail.senses.map(s => s.gloss);
    expect(glosses).toContain('soul');
    expect(glosses).toContain('life');
    expect(diffs.some(d => d.type === 'A' && d.strongs === 'G5368')).toBe(true);
  });
  test('getChapterDifferenceMap groups by verse', () => {
    const map = db.getChapterDifferenceMap('John', 12);
    expect(map.get(25).length).toBeGreaterThan(0);
  });
  test('selectUnderlines keeps one representative A + B in reading order', () => {
    const diffs = [
      { position: 2, type: 'A', gloss: 'loving' },
      { position: 4, type: 'B', gloss: 'life' },
      { position: 6, type: 'A', gloss: 'loses' },
      { position: 6, type: 'B', gloss: 'loses' },
    ];
    const sel = db.selectUnderlines(diffs);
    expect(sel).toHaveLength(2);
    expect(sel.find(d => d.type === 'A').gloss).toBe('loving'); // first A
    expect(sel.find(d => d.type === 'B').gloss).toBe('life');   // first B
  });
  test('underlineSpans marks the difference words and covers the whole text', () => {
    const text = 'Anyone who loves their life will lose it';
    const segs = db.underlineSpans(text, [{ type: 'A', gloss: 'loving' }, { type: 'B', gloss: 'life' }]);
    expect(segs.map(s => s.text).join('')).toBe(text); // lossless
    expect(segs.find(s => s.text === 'loves')?.type).toBe('A');
    expect(segs.find(s => s.text === 'life')?.type).toBe('B');
  });
});

describe('home helpers', () => {
  test('listBooks returns 66 books in canonical order', () => {
    const books = db.listBooks('NIV');
    expect(books.length).toBe(66);
    expect(books[0].book).toBe('Gen');
    expect(books.at(-1).book).toBe('Rev');
    expect(books.find(b => b.book === 'John').chapters).toBe(21);
  });
  test('getWordOfDay is deterministic per seed and returns a real Type-B word', () => {
    const w = db.getWordOfDay('2026-07-06');
    expect(w).toBeTruthy();
    expect(w.original).toBeTruthy();
    expect(w.senses.length).toBeGreaterThanOrEqual(2);
    expect(w.ref.book).toBeTruthy();
    expect(db.getWordOfDay('2026-07-06').strongs).toBe(w.strongs); // stable
  });
  test('getSenseOccurrence finds the first canonical verse rendering the sense', () => {
    // G5590 psyche rendered "soul" — first occurrence, with the interlinear word at that position
    const occ = db.getSenseOccurrence('G5590', 'soul');
    expect(occ).toBeTruthy();
    expect(occ.ref.book && occ.ref.chapter && occ.ref.verse).toBeTruthy();
    expect(Number.isInteger(occ.position)).toBe(true);
    const hit = db.getInterlinear(occ.ref.book, occ.ref.chapter, occ.ref.verse)
      .find(iw => iw.position === occ.position);
    expect(hit.strongs).toBe('G5590');
  });
  test('getSenseOccurrence returns null for an unmatched sense', () => {
    expect(db.getSenseOccurrence('G5590', 'zzznotareal gloss')).toBeNull();
  });
});

describe('word search', () => {
  test("searchWords('love') surfaces agape + phileo, ranked by frequency, capped at 12", () => {
    const hits = db.searchWords('love');
    const codes = hits.map(h => h.strongs);
    expect(codes).toContain('G0026'); // agape
    expect(codes).toContain('G5368'); // phileo
    expect(hits.length).toBeLessThanOrEqual(12);
    expect(hits.every((h, i) => i === 0 || h.total <= hits[i - 1].total)).toBe(true);
  });
  test('searchWords requires at least 2 characters', () => {
    expect(db.searchWords('l')).toEqual([]);
    expect(db.searchWords('')).toEqual([]);
  });
  test("searchWords('life') surfaces psyche via its secondary sense", () => {
    // psyche's primary lexicon gloss is "soul"; a broad gloss_norm search still finds it under "life".
    expect(db.searchWords('life').map(h => h.strongs)).toContain('G5590');
  });
  test('getWordSenses groups occurrences by sense, sorted by count desc', () => {
    const w = db.getWordSenses('G5590');
    expect(w.total).toBe(106);
    const byGloss = new Map(w.senses.map(s => [s.gloss, s.count]));
    expect(byGloss.get('soul')).toBe(41);
    expect(byGloss.get('life')).toBe(35);
    expect(w.senses[0].gloss).toBe('soul'); // most frequent sense first
    expect(w.senses.every((s, i) => i === 0 || s.count <= w.senses[i - 1].count)).toBe(true);
    // occurrences are canonical-ordered and shaped { ref, position }
    const occ = w.senses[0].occurrences;
    expect(occ[0].ref.version).toBe('NIV');
    expect(Number.isInteger(occ[0].position)).toBe(true);
    const key = (o) => [bookOrder(o.ref.book), o.ref.chapter, o.ref.verse];
    const inOrder = occ.every((o, i) => {
      if (i === 0) return true;
      const [pb, pc, pv] = key(occ[i - 1]), [b, c, v] = key(o);
      return pb < b || (pb === b && (pc < c || (pc === c && pv <= v)));
    });
    expect(inOrder).toBe(true);
  });
  test('getWordSenses resolves a disambiguated homograph (H2235B) instead of an empty lexicon', () => {
    const w = db.getWordSenses('H2235B');
    expect(w.definition.toLowerCase()).toContain('vegetable');
  });
});

describe('1.5 cross-references', () => {
  test('John 3:16 top cross-ref is Rom.5.8', () => {
    expect(db.getCrossRefs('John', 3, 16)[0].to_ref).toBe('Rom.5.8');
  });
  test('chapter cross-ref stats', () => {
    const s = db.getChapterCrossRefStats('John', 3);
    expect(s.total).toBeGreaterThan(0);
    expect(s.versesWithRefs).toBeGreaterThan(0);
  });
});

describe('1.5 chapter context (Theographic)', () => {
  test('getChapterContext returns the Ruth 1 summary row', () => {
    const c = db.getChapterContext('Ruth', 1);
    expect(c).toBeTruthy();
    expect(c.writer).toBe('Samuel');
    expect(c.people_count).toBeGreaterThan(0);
  });
  test('getChapterContext returns null for a chapter without a context row', () => {
    expect(db.getChapterContext('Nope', 999)).toBeNull();
  });
  test('getChapterEntities: Ruth 1 has Naomi/Ruth (people) and Bethlehem/Moab (places)', () => {
    const ents = db.getChapterEntities('Ruth', 1);
    const people = ents.filter(e => e.entity_type === 'person').map(e => e.name);
    const places = ents.filter(e => e.entity_type === 'place').map(e => e.name);
    expect(people).toContain('Naomi');
    expect(people).toContain('Ruth');
    expect(places).toContain('Bethlehem');
    expect(places).toContain('Moab');
  });
  test('getChapterEntities is ordered by entity_type then sort_verse', () => {
    const ents = db.getChapterEntities('Ruth', 1);
    let prevType = '', prevVerse = -Infinity;
    for (const e of ents) {
      if (e.entity_type !== prevType) { prevType = e.entity_type; prevVerse = -Infinity; }
      expect(e.sort_verse).toBeGreaterThanOrEqual(prevVerse);
      prevVerse = e.sort_verse;
    }
  });
  test("people_count equals the number of person rows", () => {
    const c = db.getChapterContext('Ruth', 1);
    const people = db.getChapterEntities('Ruth', 1).filter(e => e.entity_type === 'person');
    expect(people.length).toBe(c.people_count);
  });
});

describe('chapter recap', () => {
  const SOURCES = ['bible-summary', 'matthew-henry', 'adam-clarke', 'editorial'];
  test('getChapterRecap returns a non-empty recap with a valid source', () => {
    const r = db.getChapterRecap('John', 3);
    expect(r).toBeTruthy();
    expect(r.recap.length).toBeGreaterThan(0);
    expect(SOURCES).toContain(r.source);
  });
  test('Ruth 1 recap is sourced from Bible Summary', () => {
    expect(db.getChapterRecap('Ruth', 1).source).toBe('bible-summary');
  });
  test('Matthew 27 recap is sourced from Bible Summary', () => {
    expect(db.getChapterRecap('Matt', 27).source).toBe('bible-summary');
  });
  test('getChapterRecap returns null for a chapter without a recap', () => {
    expect(db.getChapterRecap('Nope', 999)).toBeNull();
  });
});

// The preview box falls back NIV -> NKJV -> NLT. This is a content decision, not a nicety: the
// NKJV follows the Textus Receptus, so it carries 16 verses the NIV has no row for. A dictionary
// article that links one of them ("Heart" cites Acts 8:37) used to render an empty box.
describe('getRefPreview version fallback', () => {
  test('an ordinary verse comes from the NIV', () => {
    const p = db.getRefPreview('John.3.16');
    expect(p.version).toBe('NIV');
    expect(p.text).toMatch(/For God so loved the world/);
  });
  test('a range previews its first verse', () => {
    expect(db.getRefPreview('1John.4.9-1John.4.10').text)
      .toBe(db.getRefPreview('1John.4.9').text);
  });
  test('Acts 8:37 falls back to the NKJV, which has it and the NIV does not', () => {
    expect(db.getChapter('NIV', 'Acts', 8).some((v) => v.verse === 37)).toBe(false);
    expect(db.getChapter('NKJV', 'Acts', 8).some((v) => v.verse === 37)).toBe(true);
    const p = db.getRefPreview('Acts.8.37');
    expect(p.version).toBe('NKJV');
    expect(p.text).toMatch(/I believe that Jesus Christ is the Son of God/);
  });
  test('Esther 11 and 12 are in no translation we carry — the Greek Additions', () => {
    for (const ref of ['Esth.11.1', 'Esth.12.1']) {
      expect(db.getRefPreview(ref)).toEqual({ text: '', version: null });
    }
    // Protestant Esther ends at chapter 10 in all three
    for (const v of ['NIV', 'NKJV', 'NLT']) expect(db.getChapter(v, 'Esth', 11)).toEqual([]);
  });
  test('a malformed ref yields the same empty shape, not a throw', () => {
    expect(db.getRefPreview('not-a-ref')).toEqual({ text: '', version: null });
  });
});

// The deuterocanon is carried as its own version, kept out of every reader-facing list, and since
// 2026-08-05 out of every reader-facing surface too: its only remaining job is to give verseExists
// real bounds, so an apocryphal citation cannot land on a real-but-wrong verse.
describe('deuterocanon (KJVA)', () => {
  test('KJVA holds the 14 books and no canonical one', () => {
    const books = db.query("SELECT DISTINCT book FROM verses WHERE version='KJVA'").map((r) => r.book).sort();
    expect(books).toEqual(['1Esd', '1Macc', '2Esd', '2Macc', 'AddEsth', 'Bar', 'Bel', 'Jdt',
      'PrAzar', 'PrMan', 'Sir', 'Sus', 'Tob', 'Wis']);
    expect(db.listBooks('NIV')).toHaveLength(66);
    expect(db.listBooks('KJVA')).toHaveLength(0);   // BOOKS is the canonical 66; KJVA shares none
  });

  // DeepVerse reads the 66 canonical books, so no surface may show this text (2026-08-05).
  // getRefPreview is the one function that could hand it to one, and KJVA is no longer in its
  // fallback chain — the rows are still there, and it still must not return them.
  test('no deuterocanonical verse previews, though the rows exist', () => {
    for (const ref of ['AddEsth.11.1', 'AddEsth.12.1', '1Macc.10.57', 'Tob.1.2', 'Sir.3.1']) {
      expect(db.getRefPreview(ref)).toEqual({ text: '', version: null });
      const [, book, ch, v] = ref.match(/^(\w+)\.(\d+)\.(\d+)$/);
      expect(db.query('SELECT text FROM verses WHERE version=? AND book=? AND chapter=? AND verse=?',
        ['KJVA', book, +ch, +v])[0].text.length).toBeGreaterThan(0);   // the row is there
    }
  });

  // The KJV was made from Latin manuscripts missing 2 Esd 7:36-105, so its chapter 7 renumbers
  // everything after verse 35 and cannot be matched against the numbering Tyndale quotes. The
  // chapter is dropped rather than silently shown as the wrong verse.
  test('2 Esdras 7 is absent, the rest of 2 Esdras is present', () => {
    expect(db.getChapter('KJVA', '2Esd', 7)).toEqual([]);
    expect(db.getChapter('KJVA', '2Esd', 8).length).toBeGreaterThan(0);
    expect(db.getRefPreview('2Esd.7.113')).toEqual({ text: '', version: null });
  });
});

describe('study notes', () => {
  test('getChapterStudyNoteCount: annotated chapter vs unknown book', () => {
    expect(db.getChapterStudyNoteCount('Gen', 1)).toBe(19);
    expect(db.getChapterStudyNoteCount('Nope', 999)).toBe(0);
  });
  test('getStudyNotes: verse-specific note (Ruth 2:2 gleaning)', () => {
    const notes = db.getStudyNotes('Ruth', 2, 2);
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.some(n => /glean/i.test(n.body))).toBe(true);
  });
  test('getStudyNotes: covering model — a mid-passage verse gets the passage note', () => {
    // Gen.1.1-2.3 covers Gen 1:10 even though no note starts at 1:10
    const notes = db.getStudyNotes('Gen', 1, 10);
    expect(notes.some(n => n.osis_ref === 'Gen.1.1-2.3')).toBe(true);
  });
  test('getStudyNotes: unknown book returns []', () => {
    expect(db.getStudyNotes('Nope', 999, 1)).toEqual([]);
  });
});

describe('1.6 stats + concordance', () => {
  test('countLemma(agapao) totals 143', () => {
    expect(db.countLemma('G0025').total).toBe(143);
  });
  test('countEnglishWord love > 300', () => {
    expect(db.countEnglishWord('NIV', 'love')).toBeGreaterThan(300);
  });
  test('verseWordCounts returns word + char counts', () => {
    const c = db.verseWordCounts('NIV', 'John', 11, 35); // "Jesus wept."
    expect(c.words).toBeGreaterThan(0);
    expect(c.chars).toBeGreaterThan(0);
  });
});

describe('tyndale cultural layer', () => {
  test('getDictForVerse ranks the specific article first', () => {
    const rows = db.getDictForVerse('Mark', 14, 36);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].title).toBe('Abba');
  });

  test('getDictForVerse: the lexical signal surfaces Centurion at Acts 10:1', () => {
    const titles = db.getDictForVerse('Acts', 10, 1).map(r => r.title);
    expect(titles).toContain('Cornelius');
    expect(titles).toContain('Centurion*');
    // survey articles sink: whatever cites the most verses must not lead
    expect(titles[0]).toBe('Cornelius');
  });

  test('getDictForVerse: genealogy verse ranks the name entries above the survey articles', () => {
    const titles = db.getDictForVerse('1Chr', 1, 1).map(r => r.title);
    const seth = titles.indexOf('Seth');
    const chron = titles.findIndex(t => t.startsWith('Chronology of the Bible'));
    expect(seth).toBeGreaterThanOrEqual(0);
    expect(chron).toBeGreaterThan(seth);
  });

  test('getDictForVerse: unreferenced verse returns []', () => {
    expect(db.getDictForVerse('Ps', 119, 100)).toEqual([]);
  });

  test('getDictCountForVerse matches the row count', () => {
    const count = db.getDictCountForVerse('Mark', 14, 36);
    expect(count).toBeGreaterThan(0);
    expect(count).toBe(db.getDictForVerse('Mark', 14, 36).length);
  });

  test('getTyndalePassages: themes use the covering-range model', () => {
    // "The Creation" is anchored Gen.1.1-2.25, so it must cover a mid-range verse
    const rows = db.getTyndalePassages('theme', 'Gen', 1, 10);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.map(r => r.title)).toContain('The Creation');
    expect(rows[0].ref).toBeTruthy();
  });

  test('getTyndalePassages: profiles are keyed separately from themes', () => {
    const profiles = db.getTyndalePassages('profile', 'Gen', 3, 1);
    expect(profiles.length).toBeGreaterThan(0);
    expect(profiles.map(r => r.title)).toContain('Adam and Eve');
    const themes = db.getTyndalePassages('theme', 'Gen', 3, 1);
    expect(themes.length).toBeGreaterThan(0);
    expect(themes.every(r => r.title !== 'Adam and Eve')).toBe(true);
  });

  test('getTyndalePassages: verse outside every range returns []', () => {
    expect(db.getTyndalePassages('profile', 'Obad', 1, 1)).toEqual([]);
  });

  test('getArticleSupplements returns the textboxes an article embeds', () => {
    const supps = db.getArticleSupplements('Aaron');
    expect(supps.length).toBeGreaterThan(0);
    expect(supps.map(s => s.id)).toContain('AaronThePriest');
    expect(supps[0].kind).toBe('textbox');
  });

  test('getArticleSupplements: article with no supplements returns []', () => {
    expect(db.getArticleSupplements('Abba')).toEqual([]);
  });

  test('charts are stored as html, articles are not', () => {
    // FeastsandFestivalsofIsrael (lowercase and/of) hosts the AnnualFeastsAndFestivalsOfIsrael chart.
    const supps = db.getArticleSupplements('FeastsandFestivalsofIsrael');
    expect(supps.length).toBeGreaterThan(0);
    const charts = supps.filter(s => s.kind === 'chart');
    expect(charts.length).toBeGreaterThan(0);
    for (const c of charts) expect(c.is_html).toBe(1);
  });

  test('getBookIntro returns summary and intro for all 66 books', () => {
    const gen = db.getBookIntro('Gen');
    expect(gen.summary).toContain('Purpose');
    expect(gen.intro.length).toBeGreaterThan(1000);
    for (const b of ['Gen', '1Thess', '1John', 'Hag', 'Jonah', 'Prov', 'Rev'])
      expect(db.getBookIntro(b), `${b} missing an intro`).toBeTruthy();
  });
});

describe('library explorer', () => {
  test('getDictLetters covers A–Z plus a # catch-all, with real counts', () => {
    const rows = db.getDictLetters();
    const b = rows.find((r) => r.letter === 'B');
    expect(b.n).toBe(447);
    expect(rows.find((r) => r.letter === 'A').n).toBe(666);
    // "I Am" Sayings' sort_title starts with a curly quote — SQLite's upper() is ASCII-only, so
    // without a catch-all it would form its own one-off, unreachable-from-the-A–Z-rail bucket.
    expect(rows.find((r) => r.letter === '#').n).toBe(1);
    expect(rows.reduce((sum, r) => sum + r.n, 0)).toBe(6010);
  });

  test('getDictBrowse returns full titles, ordered by sort_title', () => {
    const rows = db.getDictBrowse('B');
    expect(rows.length).toBe(447);
    // sort_title strips the parenthetical, so these three collide; the title must disambiguate
    const baals = rows.filter((r) => r.sort_title === 'baal').map((r) => r.title);
    expect(baals).toEqual(['Baal (Idol)', 'Baal (Person)', 'Baal* (Place)']);
  });

  test('getDictBrowse("#") holds the non-Latin sort_title the A–Z rail cannot reach', () => {
    expect(db.getDictBrowse('#').map((r) => r.id)).toContain('IAmSayings');
  });

  test('getDictBrowse flags bare redirect stubs', () => {
    const bed = db.getDictBrowse('B').find((r) => r.title === 'Bed');
    expect(bed.redirect).toBe('Furniture');
    expect(db.getDictBrowse('B').find((r) => r.title === 'Beast').redirect).toBeNull();
    // 121 characters — one over the length cutoff this replaced (`< 120`), which missed it. The
    // structural rule (starts "See ", ends ".", exactly one period total, no embedded newline)
    // catches it correctly; this must fail against the old length-based classifier.
    const minister = db.getDictBrowse('M').find((r) => r.title === 'Minister, Ministry');
    expect(minister.redirect).toBe(
      'Bishop; Body of Christ; Church; Deacon, Deaconess; Elder; Ordain, Ordination; Presbyter; Priesthood; Spiritual Gifts');
  });

  test('getThemeIndex returns 298 in canonical book order', () => {
    const rows = db.getThemeIndex();
    expect(rows).toHaveLength(298);
    expect(rows[0].book).toBe('Gen');
    expect(rows.at(-1).book).toBe('Rev');
    for (let i = 1; i < rows.length; i++)
      expect(bookOrder(rows[i].book)).toBeGreaterThanOrEqual(bookOrder(rows[i - 1].book));
  });

  test('getProfileIndex returns 125 alphabetically, flagging dictionary twins', () => {
    const rows = db.getProfileIndex();
    expect(rows).toHaveLength(125);
    const titles = rows.map((r) => r.title);
    expect(titles).toEqual([...titles].sort());
    expect(rows.filter((r) => r.alsoArticle).length).toBe(84);
    // regression guard: "Rahab" collides on sort_title with the mythical sea-monster article
    // (RahabMonster); an unordered LIMIT 1 picked that instead of the person profiled here
    // (RahabPerson) — the fix must keep winning even if the ORDER BY is later "simplified" away.
    expect(rows.find((r) => r.title === 'Rahab').alsoArticle).toBe('RahabPerson');
  });

  test('getBookHub assembles intro, themes, profiles and top-citing articles', () => {
    const hub = db.getBookHub('Rev');
    expect(hub.summary).toContain('Purpose');
    expect(hub.themes.length).toBe(8);
    expect(hub.profiles.map((p) => p.title)).toEqual(['Roman Emperors']);
    expect(hub.articles[0].title).toBe('Revelation, Book of');
    expect(hub.articles[0].n).toBe(81);
  });

  // Whole-branch-review Fix 3: `articles` is capped at BOOK_HUB_ARTICLE_CAP (12), same "top N, not
  // a total" gap Task 13 already fixed for search. Revelation has 263 distinct articles citing it
  // (only the top 12 come back) and 3 John has just 9 (nothing was cut) — both must be knowable
  // from the return value, not just inferred from articles.length === 12.
  test('getBookHub flags articles as truncated only when the cap actually cut rows', () => {
    const rev = db.getBookHub('Rev');
    expect(rev.articles).toHaveLength(12);
    expect(rev.articlesTruncated).toBe(true);

    const johnLetter = db.getBookHub('3John');
    expect(johnLetter.articles.length).toBeLessThan(12);
    expect(johnLetter.articlesTruncated).toBe(false);
  });

  test('searchLibrary spans all four datasets', () => {
    const r = db.searchLibrary('revelation');
    expect(r.dict.some((x) => x.title === 'Revelation, Book of')).toBe(true);
    expect(r.themes.some((x) => x.title === 'The Theater and Revelation')).toBe(true);
    expect(r.books).toContain('Rev');
  });

  test('searchLibrary ignores terms shorter than two characters', () => {
    expect(db.searchLibrary('a')).toEqual({ dict: [], themes: [], profiles: [], books: [],
      dictTruncated: false, themesTruncated: false, profilesTruncated: false });
  });

  test('searchLibrary treats % and _ as literal characters, not LIKE wildcards', () => {
    // unescaped, '_' matches any single character and would return 107 dict rows; no title
    // literally contains "a_c".
    expect(db.searchLibrary('a_c')).toEqual({ dict: [], themes: [], profiles: [], books: [],
      dictTruncated: false, themesTruncated: false, profilesTruncated: false });
  });

  // Regression: a capped group's length alone can't tell "the cap cut rows" apart from "this many
  // exist and none were cut" — "zeb" has exactly 20 real dict matches (the cap) and "pi" has
  // exactly 10 real theme matches (the cap), neither with anything hidden. Both must report
  // truncated: false, or the UI renders a false "+" on an exact count (see SearchSurface.svelte).
  test('searchLibrary reports no truncation when a capped group\'s true count exactly equals the cap', () => {
    const zeb = db.searchLibrary('zeb');
    expect(zeb.dict).toHaveLength(20);
    expect(zeb.dictTruncated).toBe(false);

    const pi = db.searchLibrary('pi');
    expect(pi.themes).toHaveLength(10);
    expect(pi.themesTruncated).toBe(false);
  });

  // "an" genuinely exceeds every cap (661 dict titles, 79 themes, 17 profiles contain "an") — the
  // rendered list still stays capped at 20/10/10, but the *Truncated flags must say so honestly.
  test('searchLibrary reports truncation when a capped group\'s true count exceeds the cap', () => {
    const r = db.searchLibrary('an');
    expect(r.dict).toHaveLength(20);
    expect(r.dictTruncated).toBe(true);
    expect(r.themes).toHaveLength(10);
    expect(r.themesTruncated).toBe(true);
    expect(r.profiles).toHaveLength(10);
    expect(r.profilesTruncated).toBe(true);
  });

  test('getXrefs returns both directions', () => {
    const x = db.getXrefs('Beast');
    expect(x.out.map((o) => o.title)).toEqual(
      ['Antichrist', 'Armageddon', 'Mark of God*, Mark of the Beast', 'Revelation, Book of']);
    expect(x.in.length).toBeGreaterThan(0);
  });

  test('getXrefs carries a subhead anchor', () => {
    const x = db.getXrefs('BullBullock');
    expect(x.out.find((o) => o.id === 'Animals').anchor).toBe('Cattle');
  });

  test('getPassage returns a theme body, keyed by kind and title', () => {
    const t = db.getPassage('theme', 'Holy War');
    expect(t.book).toBe('Deut');
    expect(t.ref).toBe('7:1-6');
    expect(t.body.length).toBeGreaterThan(200);
    expect(db.getPassage('profile', 'Holy War')).toBeNull();   // kind is part of the key
  });

  test('getPassage returns a profile body', () => {
    const p = db.getPassage('profile', 'The Philistines');
    expect(p.book).toBe('Judg');
    expect(p.body.length).toBeGreaterThan(200);
  });

  test('getStudyNoteLinks returns the passages a note names, and nothing for the 16,802 that name none', () => {
    const [blessing] = db.getStudyNoteLinks('Gen.1.22');
    expect(blessing).toMatchObject({ raw: 'Blessing', pkind: 'theme', ptitle: 'Blessing', pbook: 'Gen' });
    // keyed by osis_ref, which is the source's item name — NOT the <refs> value, which differs for
    // every numbered book ("ISam.4.1" vs "1Sam.4.1")
    expect(db.getStudyNoteLinks('ISam.15.3')[0]).toMatchObject({ ptitle: 'Complete Dedication' });
    expect(db.getStudyNoteLinks('1Sam.15.3')).toEqual([]);
    expect(db.getStudyNoteLinks('Gen.1.1')).toEqual([]);
  });

  test('every study note link resolves to a passage, and its raw text is in the note that wrote it', () => {
    // the same two invariants build/validate-db.mjs enforces, checked here against the shipped db:
    // an unresolvable target would render as a door to nothing, and a raw that has drifted from
    // the body would silently underline nothing at all
    const rows = db.query(`SELECT x.osis_ref, x.raw, x.pkind, x.ptitle FROM study_note_xref x`);
    expect(rows).toHaveLength(117);
    for (const r of rows) {
      expect(db.getPassage(r.pkind, r.ptitle)).not.toBeNull();
      const note = db.query('SELECT body FROM study_notes WHERE osis_ref=?', [r.osis_ref])[0];
      expect(note.body).toContain(`“${r.raw}”`);
    }
  });

  test('getPassageLinks returns the passages anchored over the same verses, in reading order', () => {
    const { passages } = db.getPassageLinks('theme', 'The Creation');   // Gen 1:1–2:25
    expect(passages.map((p) => p.title)).toEqual(
      ['Blessing', 'Human Sexuality', 'Adam and Eve', 'Biblical Marriage']);
    expect(passages.find((p) => p.title === 'Adam and Eve').kind).toBe('profile');
    // the anchor is the whole span, not its first verse: Lot sits at Gen 19, inside Abraham's
    // 11:26–25:11, and neither starts where the other does
    expect(db.getPassageLinks('profile', 'Lot').passages.map((p) => p.title)).toEqual(['Abraham']);
  });

  test('getPassageLinks never returns the passage itself, even when the other kind shares its title', () => {
    // "The Son of Man" is the one title that exists as both a theme and a profile
    for (const kind of ['theme', 'profile']) {
      const { passages } = db.getPassageLinks(kind, 'The Son of Man');
      expect(passages.filter((p) => p.kind === kind && p.title === 'The Son of Man')).toEqual([]);
    }
  });

  test('getPassageLinks resolves a profile to its dictionary twin, preferring the person', () => {
    // an unordered LIMIT 1 hands back RahabMonster — the sea monster, not the woman of Jericho
    expect(db.getPassageLinks('profile', 'Rahab').article.id).toBe('RahabPerson');
    expect(db.getPassageLinks('profile', 'Melchizedek').article.id).toBe('Melchizedek');
    expect(db.getPassageLinks('profile', 'Adam and Eve').article).toBeNull();   // 41 of 125 have none
  });

  test('getPassageLinks matches no article for a theme, however exact the title', () => {
    // 15 theme titles match an article. The theme "Shechem" is the altar at Josh 8:30-35, and the
    // profile tie-break would point it at Shechem (Person) — right rule, wrong corpus.
    expect(db.getPassageLinks('theme', 'Shechem').article).toBeNull();
    expect(db.getPassageLinks('theme', 'Zion').article).toBeNull();
  });

  test('every theme and profile in the index is retrievable', () => {
    for (const t of db.getThemeIndex()) expect(db.getPassage('theme', t.title)).not.toBeNull();
    for (const p of db.getProfileIndex()) expect(db.getPassage('profile', p.title)).not.toBeNull();
  });

  test('getXrefs.out carries the source wording for each target', () => {
    const beast = db.getXrefs('Beast').out;
    expect(beast.find((o) => o.id === 'MarkofGodMarkoftheBeast').raw).toBe('Mark of the Beast');
  });

  // "Advent of Christ" is nothing but a See clause. Its three targets used to be two, because
  // "Jesus Christ, Life and Teachings of" was reported as absent from the corpus — the display text
  // of a link that points, and always pointed, at the JesusChristTeachingsof article.
  test('getXrefs resolves a target whose link text differs from the article title', () => {
    const x = db.getXrefs('AdventofChrist');
    expect(x.out.length).toBe(3);
    const hit = x.out.find((o) => o.raw === 'Jesus Christ, Life and Teachings of');
    expect(hit.id).toBe('JesusChristTeachingsof');
    expect(hit.title).toBe('Jesus Christ, Teachings of');
  });

  // Every edge comes from a ?item= link that named a target we hold, so there is no unresolved
  // case to represent. A `missing` list would always be empty.
  test('getXrefs exposes only out/in, and every out edge has a real id', () => {
    const x = db.getXrefs('Beast');
    expect(Object.keys(x).sort()).toEqual(['in', 'out']);
    expect(x.out.every((o) => o.id && o.title)).toBe(true);
  });

  test('getRandomArticle only returns substantial articles', () => {
    for (let i = 0; i < 30; i++) {
      const a = db.getRandomArticle();
      const full = db.getArticle(a.id);
      expect(full.body.length).toBeGreaterThanOrEqual(500);
      expect(full.body.startsWith('See ')).toBe(false);
    }
  });

  test('getOrphanSupplements finds the 13 with no host', () => {
    expect(db.getOrphanSupplements()).toHaveLength(13);
  });
});
