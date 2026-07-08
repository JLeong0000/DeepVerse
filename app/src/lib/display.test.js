import { test, expect, describe } from 'vitest';
import { langLabel, testamentLabel, cleanGloss, parseDefinition, readTranslit } from './display.js';

describe('readTranslit', () => {
  test('renders the "/" morpheme boundary as a hyphen, keeps syllable dots', () => {
    expect(readTranslit("be./ta.Ba.'at")).toBe("be-ta.Ba.'at");
    expect(readTranslit("va/i.yi.ka.re.'U")).toBe("va-i.yi.ka.re.'U");
    expect(readTranslit('ha./ri.Shon')).toBe('ha-ri.Shon');
    expect(readTranslit('psy.che')).toBe('psy.che'); // Greek: no "/", unchanged
  });
});

describe('langLabel', () => {
  test('from Strong prefix and explicit lang', () => {
    expect(langLabel('G5590')).toBe('Greek');
    expect(langLabel('H7121G')).toBe('Hebrew');
    expect(langLabel('grc')).toBe('Greek');
    expect(langLabel('hbo')).toBe('Hebrew');
    expect(langLabel('arc')).toBe('Aramaic');   // only distinguishable via explicit lang
  });
});

describe('testamentLabel', () => {
  test('OT for Hebrew, NT for Greek', () => {
    expect(testamentLabel('H7121G')).toBe('the OT');
    expect(testamentLabel('G5590')).toBe('the NT');
  });
});

describe('cleanGloss', () => {
  test('strips leading attached particles, keeps the root', () => {
    expect(cleanGloss('and/ he called')).toBe('he called');
    expect(cleanGloss('with/ the signet-ring of')).toBe('the signet-ring of');
    expect(cleanGloss('and/ the/ earth')).toBe('earth');
    expect(cleanGloss('<the>/ first')).toBe('first');
  });
  test('leaves clean glosses untouched and never returns empty', () => {
    expect(cleanGloss('he summoned')).toBe('he summoned');
    expect(cleanGloss('soul')).toBe('soul');
    expect(cleanGloss('and/')).toBe('and/'); // nothing after the particle -> keep original
  });
});

describe('parseDefinition', () => {
  test('Greek "__"-delimited senses become leveled rows', () => {
    const rows = parseDefinition('psyche , -ῆς, ἡ __1. breath, life __2. the soul');
    expect(rows[0].level).toBe(-1);
    expect(rows[1]).toMatchObject({ level: 1, marker: '1.' });
    expect(rows[2]).toMatchObject({ level: 1, marker: '2.' });
  });
  test('Hebrew BDB "1) / 1a) / 1a1)" numbering becomes leveled rows', () => {
    const rows = parseDefinition(': call_to/invite 1) to call, proclaim 1a) (Qal) 1a1) to cry 1b) (Niphal)');
    expect(rows[0]).toMatchObject({ level: -1 });          // lead gloss
    expect(rows.find(r => r.marker === '1)')).toMatchObject({ level: 0 });
    expect(rows.find(r => r.marker === '1a)')).toMatchObject({ level: 1, text: '(Qal)' });
    expect(rows.find(r => r.marker === '1a1)')).toMatchObject({ level: 2, text: 'to cry' });
  });
  test('empty definition -> no rows', () => {
    expect(parseDefinition('')).toEqual([]);
  });
});
