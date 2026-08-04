// build/test/validate.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { validate } from '../validate-db.mjs';

test('a fully built db has no completeness problems', () => {
  const db = new DatabaseSync('../data/bible.db');
  assert.deepEqual(validate(db), []);
});
test('a db missing a chapter is reported', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE verses(version TEXT,book TEXT,chapter INTEGER,verse INTEGER,text TEXT);
           INSERT INTO verses VALUES('NIV','Gen',1,1,'x');
           CREATE TABLE dict_articles(id TEXT);
           CREATE TABLE dict_xref(src TEXT,dst TEXT,raw TEXT,anchor TEXT,seq INTEGER);
           CREATE TABLE study_notes(osis_ref TEXT, body TEXT);
           CREATE TABLE tyndale_passages(kind TEXT, title TEXT);
           CREATE TABLE study_note_xref(osis_ref TEXT,raw TEXT,pkind TEXT,ptitle TEXT,pbook TEXT,seq INTEGER);`);
  const problems = validate(db);
  assert.ok(problems.some(p => p.includes('Gen')), problems.join('\n'));
});
