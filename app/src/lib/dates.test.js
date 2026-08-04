import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { localDay, memoDateLabel, inRange } from './dates.js';

// Under TZ=UTC a local day and a UTC day are the same thing, and every bug this module exists to
// prevent becomes invisible. Pin an explicit eastern zone instead of inheriting the machine's, so
// CI and a laptop agree. UTC+8 is where the shipped relDate bug was reproduced.
const ORIGINAL_TZ = process.env.TZ;
beforeAll(() => { process.env.TZ = 'Asia/Singapore'; });
afterAll(() => { process.env.TZ = ORIGINAL_TZ; });

describe('the timezone harness', () => {
  it('actually applies UTC+8 to the global Date', () => {
    const d = new Date('2026-08-04T16:54:00Z');
    expect(d.getDate()).toBe(5);    // already tomorrow in Singapore
    expect(d.getHours()).toBe(0);
  });
});

describe('localDay', () => {
  it('floors a UTC instant to LOCAL midnight, not UTC midnight', () => {
    // 16:54Z on Aug 4 is 00:54 on Aug 5 in Singapore — the local day is the 5th.
    const day = localDay('2026-08-04T16:54:00.000Z');
    expect(day.getFullYear()).toBe(2026);
    expect(day.getMonth()).toBe(7); // August, 0-indexed
    expect(day.getDate()).toBe(5);
    expect(day.getHours()).toBe(0);
    expect(day.getMinutes()).toBe(0);
  });

  it('reads a date-only string as a LOCAL day, not a UTC instant', () => {
    // The trap: bare new Date('2026-08-05') is 08:00 local under UTC+8, so any bound built from it
    // silently excludes everything written before 8am. West of Greenwich it lands a day early.
    expect(new Date('2026-08-05').getHours()).toBe(8); // the wrong way, pinned so it stays visible
    const day = localDay('2026-08-05');
    expect(day.getDate()).toBe(5);
    expect(day.getHours()).toBe(0);
  });

  it('accepts a Date', () => {
    const day = localDay(new Date('2026-08-04T16:54:00.000Z'));
    expect(day.getDate()).toBe(5);
    expect(day.getHours()).toBe(0);
  });

  it('returns a distinct value per calendar day, so two days subtract to exactly one', () => {
    const a = localDay('2026-08-05T23:00:00+08:00');
    const b = localDay('2026-08-04T00:30:00+08:00');
    expect((a - b) / 86400000).toBe(1);
  });
});

// 00:54 local on Aug 5 in Singapore — deliberately just after local midnight, where UTC is still
// on the 4th and every off-by-one hides.
const NOW = new Date('2026-08-04T16:54:00.000Z').getTime();
const memo = (created, updated = created) => ({ created_at: created, updated_at: updated });

describe('memoDateLabel', () => {
  // The shipped bug: relDate() computed elapsed-ms / 86400000, which counts durations, not days.
  it('counts calendar days, not elapsed hours', () => {
    // yesterday 8am local = 16.9 hours before NOW — under a millisecond-division it read "today"
    expect(memoDateLabel(memo('2026-08-04T00:00:00.000Z'), 'created_at', NOW)).toBe('created yesterday');
    // two days ago 11pm local = 25.9 hours before NOW — it read "yesterday"
    expect(memoDateLabel(memo('2026-08-03T15:00:00.000Z'), 'created_at', NOW)).toBe('created 2 days ago');
  });

  it('calls the current local day "today" even when UTC still says yesterday', () => {
    // 00:30 local on Aug 5 is 16:30Z on Aug 4
    expect(memoDateLabel(memo('2026-08-04T16:30:00.000Z'), 'created_at', NOW)).toBe('created today');
  });

  it.each([
    ['2026-07-30T04:00:00.000Z', '6 days ago'],   // 6
    ['2026-07-29T04:00:00.000Z', 'last week'],    // 7
    ['2026-07-23T04:00:00.000Z', 'last week'],    // 13
    ['2026-07-22T04:00:00.000Z', '2 weeks ago'],  // 14
    ['2026-07-06T04:00:00.000Z', '4 weeks ago'],  // 30
    ['2026-07-05T04:00:00.000Z', 'Jul 5'],        // 31 — falls through to a date
  ])('keeps the existing threshold at %s -> %s', (iso, expected) => {
    expect(memoDateLabel(memo(iso), 'created_at', NOW)).toBe(`created ${expected}`);
  });

  it('includes the year once the date leaves the current year', () => {
    // Today this renders a bare "Mar 4", which reads as this year.
    expect(memoDateLabel(memo('2025-03-04T04:00:00.000Z'), 'created_at', NOW)).toBe('created Mar 4, 2025');
  });

  it('says "created" for a memo that has never been edited, even when asked for updated_at', () => {
    const untouched = memo('2026-08-04T16:30:00.000Z');
    expect(memoDateLabel(untouched, 'updated_at', NOW)).toBe('created today');
  });

  it('says "edited" only when the memo really was edited', () => {
    const edited = memo('2026-07-29T04:00:00.000Z', '2026-08-04T16:30:00.000Z');
    expect(memoDateLabel(edited, 'updated_at', NOW)).toBe('edited today');
  });

  it('says "created" when showing created_at, even on an edited memo', () => {
    const edited = memo('2026-07-29T04:00:00.000Z', '2026-08-04T16:30:00.000Z');
    expect(memoDateLabel(edited, 'created_at', NOW)).toBe('created last week');
  });

  it('defaults to updated_at', () => {
    const edited = memo('2026-07-29T04:00:00.000Z', '2026-08-04T16:30:00.000Z');
    expect(memoDateLabel(edited, undefined, NOW)).toBe('edited today');
  });
});

describe('inRange', () => {
  const AUG_5_EARLY = '2026-08-04T16:30:00.000Z'; // 00:30 local on Aug 5
  const AUG_5_LATE = '2026-08-05T15:00:00.000Z';  // 23:00 local on Aug 5

  it('includes both ends of the range', () => {
    expect(inRange(AUG_5_EARLY, '2026-08-05', '2026-08-05')).toBe(true);
    expect(inRange(AUG_5_LATE, '2026-08-05', '2026-08-05')).toBe(true);
  });

  it('includes a memo written before 8am local on the from-date', () => {
    // The regression a UTC-parsed bound causes: new Date('2026-08-05') is 08:00 local under UTC+8,
    // so a 00:30 memo would fall outside its own day.
    expect(inRange(AUG_5_EARLY, '2026-08-05', '')).toBe(true);
  });

  it('excludes days outside the range', () => {
    expect(inRange('2026-08-03T04:00:00.000Z', '2026-08-05', '2026-08-05')).toBe(false);
    expect(inRange('2026-08-06T04:00:00.000Z', '2026-08-05', '2026-08-05')).toBe(false);
  });

  it('treats an empty bound as an open end', () => {
    expect(inRange(AUG_5_EARLY, '', '2026-08-05')).toBe(true);
    expect(inRange(AUG_5_EARLY, '2026-08-05', '')).toBe(true);
    expect(inRange(AUG_5_EARLY, '', '')).toBe(true);
    expect(inRange(AUG_5_EARLY, '', '2026-08-04')).toBe(false);
  });

  // The point of sharing localDay: two notions of "day" would disagree exactly at the hours a
  // person is most likely to be writing memos.
  it('agrees with memoDateLabel about which day it is', () => {
    expect(memoDateLabel(memo(AUG_5_EARLY), 'created_at', NOW)).toBe('created today');
    expect(inRange(AUG_5_EARLY, '2026-08-05', '')).toBe(true);
  });
});
