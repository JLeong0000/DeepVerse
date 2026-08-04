import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { localDay } from './dates.js';

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
