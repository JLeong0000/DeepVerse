import { test, expect, beforeAll, describe } from 'vitest';
import fs from 'node:fs';
import initSqlJs from 'sql.js';
import * as db from './db.js';

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
  test('underlineSpans marks the difference words and covers the whole text', () => {
    const text = 'Anyone who loves their life will lose it';
    const segs = db.underlineSpans(text, [{ type: 'A', gloss: 'loving' }, { type: 'B', gloss: 'life' }]);
    expect(segs.map(s => s.text).join('')).toBe(text); // lossless
    expect(segs.find(s => s.text === 'loves')?.type).toBe('A');
    expect(segs.find(s => s.text === 'life')?.type).toBe('B');
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
