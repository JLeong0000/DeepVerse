import { test, expect, describe } from 'vitest';
import { displayTitle } from './titles.js';

describe('displayTitle', () => {
  test('rule A — a tail ending in a preposition', () => {
    expect(displayTitle('Revelation, Book of')).toBe('Book of Revelation');
    expect(displayTitle('Mark, Gospel of')).toBe('Gospel of Mark');
    expect(displayTitle('Colossians, Letter to the')).toBe('Letter to the Colossians');
    expect(displayTitle('Philemon, Letter to')).toBe('Letter to Philemon');
    expect(displayTitle('Covenant, Book of the')).toBe('Book of the Covenant');
    expect(displayTitle('Baca*, Valley of')).toBe('Valley of Baca*');
    expect(displayTitle('Oreb, Rock of')).toBe('Rock of Oreb');
    expect(displayTitle('Moses, Law of')).toBe('Law of Moses');
    expect(displayTitle('Gad, Tribe of')).toBe('Tribe of Gad');
    // this one is a cross-reference target, not an article — it must still format
    expect(displayTitle('Jesus Christ, Life and Teachings of'))
      .toBe('Life and Teachings of Jesus Christ');
  });

  test('rules B1–B3 — "the", "the …", and "Mount"', () => {
    expect(displayTitle('Devil, the')).toBe('the Devil');
    expect(displayTitle('Lord’s Supper, the')).toBe('the Lord’s Supper');
    expect(displayTitle('Commandments, the Ten')).toBe('the Ten Commandments');
    // the head's own "*" travels with it, same as "Baca*" does under rule A below
    expect(displayTitle('Adam*, the Second')).toBe('the Second Adam*');
    expect(displayTitle('Hermon, Mount')).toBe('Mount Hermon');
  });

  test('rule C — inversions with no structural marker, listed explicitly', () => {
    expect(displayTitle('Prophets, False')).toBe('False Prophets');
    expect(displayTitle('Calf, Golden')).toBe('Golden Calf');
    expect(displayTitle('Paulus, Sergius')).toBe('Sergius Paulus');
    expect(displayTitle('Sea, Red')).toBe('Red Sea');
    expect(displayTitle('Priest, High')).toBe('High Priest');
    expect(displayTitle('Pilate, Pontius')).toBe('Pontius Pilate');
    expect(displayTitle('Magdalene, Mary')).toBe('Mary Magdalene');
    expect(displayTitle('Scrolls*, Dead Sea')).toBe('Dead Sea Scrolls*');
    expect(displayTitle('Chronicles, Books of First and Second'))
      .toBe('Books of First and Second Chronicles');
  });

  // THE regression guard. An inversion and an alternate spelling are structurally identical, so
  // any future attempt to generalise these rules must break this test.
  test('leaves alternate spellings and multi-headword titles untouched', () => {
    for (const t of ['Elect, Election', 'Zidon*, Zidonian*', 'Phares*, Pharez*',
      'Banker, Banking', 'Nazarite*, Nazirite', 'Mark of God*, Mark of the Beast',
      'Babylon, Babylonia', 'Nebuchadnezzar, Nebuchadrezzar*', 'Prophet, Prophetess',
      'Accho*, Acco', 'Balm, Balsam', 'Dara*, Darda', 'Emim*, Emites', 'Ard, Ardite',
      'Vaizatha, Vajezatha*', 'Zecher*, Zeker*', 'Iye-Abarim, Iyim*'])
      expect(displayTitle(t)).toBe(t);
  });

  // All nine titles the NAMED-list build rejected as NOT inversions (see the comment above
  // titles.js's NAMED set) — asserted together here regardless of which structural reason applies.
  test('leaves the nine hand-rejected titles untouched', () => {
    for (const t of ['Philo*, Judaeus', 'Iye-Abarim, Iyim*', 'Vaizatha, Vajezatha*',
      'Zecher*, Zeker*', 'Eli, Eli, Lama Sabachthani?*', 'Eloi, Eloi, Lama Sabachthani?',
      'Mene, Mene, Tekel, Parsin', 'Shadrach, Meshach, and Abednego',
      'Bible*, Quotations of the Old Testament in the New Testament'])
      expect(displayTitle(t)).toBe(t);
  });

  test('leaves titles without a comma untouched', () => {
    expect(displayTitle('Beast')).toBe('Beast');
    expect(displayTitle('Adam (Person)')).toBe('Adam (Person)');
  });

  test('a preposition inside a word does not trigger rule A', () => {
    // "Cain" ends in "in" but there is no word boundary before it
    expect(displayTitle('Abel, Cain')).toBe('Abel, Cain');
  });
});

test('exactly 365 of the 6,010 article titles reformat', async () => {
  // guards the whole corpus, so a rule change cannot quietly widen or narrow its blast radius
  const initSqlJs = (await import('sql.js')).default;
  const fs = await import('node:fs');
  const SQL = await initSqlJs();
  const path = fs.existsSync('public/bible.db') ? 'public/bible.db' : '../data/bible.db';
  const d = new SQL.Database(new Uint8Array(fs.readFileSync(path)));
  const stmt = d.prepare("SELECT title FROM dict_articles WHERE kind='article'");
  let n = 0, total = 0;
  while (stmt.step()) {
    const { title } = stmt.getAsObject();
    total++;
    if (displayTitle(title) !== title) n++;
  }
  stmt.free();
  expect(total).toBe(6010);
  expect(n).toBe(365);
});
