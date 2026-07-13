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
