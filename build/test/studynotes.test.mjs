import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStudyNoteRef, extractRef, cleanNoteBody } from '../lib/studynotes.mjs';

test('parseStudyNoteRef: single verse', () => {
  assert.deepEqual(parseStudyNoteRef('Gen.1.16'),
    { book: 'Gen', start_chapter: 1, start_verse: 16, end_chapter: 1, end_verse: 16 });
});
test('parseStudyNoteRef: same-chapter range', () => {
  assert.deepEqual(parseStudyNoteRef('Gen.1.6-8'),
    { book: 'Gen', start_chapter: 1, start_verse: 6, end_chapter: 1, end_verse: 8 });
});
test('parseStudyNoteRef: cross-chapter range', () => {
  assert.deepEqual(parseStudyNoteRef('Gen.1.1-2.3'),
    { book: 'Gen', start_chapter: 1, start_verse: 1, end_chapter: 2, end_verse: 3 });
});
test('parseStudyNoteRef: numbered book', () => {
  assert.deepEqual(parseStudyNoteRef('1Chr.2.1'),
    { book: '1Chr', start_chapter: 2, start_verse: 1, end_chapter: 2, end_verse: 1 });
});
test('parseStudyNoteRef: normalizes non-OSIS Tyndale book codes to OSIS', () => {
  assert.equal(parseStudyNoteRef('IIPet.2.10').book, '2Pet');
  assert.equal(parseStudyNoteRef('Pr.3.5').book, 'Prov');
  assert.equal(parseStudyNoteRef('Jon.1.1').book, 'Jonah');
  assert.equal(parseStudyNoteRef('IChr.1.1').book, '1Chr');
});

const SAMPLE = '<p class="sn-text"><span class="sn-ref"><a href="?bref=Ruth.2.2">2:2</a></span> ' +
  'to pick up the stalks: Harvesters were to leave grain (see <a href="?bref=Lev.19.9-10">Lev 19:9-10</a>). &amp; God provided.</p>';

test('extractRef pulls the display span', () => {
  assert.equal(extractRef(SAMPLE), '2:2');
});
test('cleanNoteBody: strips markup, unwraps links, decodes entities, drops sn-ref', () => {
  assert.equal(cleanNoteBody(SAMPLE),
    'to pick up the stalks: Harvesters were to leave grain (see Lev 19:9-10). & God provided.');
});
