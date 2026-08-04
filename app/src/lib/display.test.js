import { test, expect, describe } from 'vitest';
import { langLabel, testamentLabel, cleanGloss, parseDefinition, shortDefinition, readTranslit, splitNoteLinks } from './display.js';

describe('readTranslit', () => {
  test('renders the "/" morpheme boundary as a hyphen, keeps syllable dots', () => {
    expect(readTranslit("be./ta.Ba.'at")).toBe("be-ta.Ba.'at");
    expect(readTranslit("va/i.yi.ka.re.'U")).toBe("va-i.yi.ka.re.'U");
    expect(readTranslit('ha./ri.Shon')).toBe('ha-ri.Shon');
    expect(readTranslit('psy.che')).toBe('psy.che'); // Greek: no "/", unchanged
    expect(readTranslit("mit.na.ke.Rah\\׃")).toBe('mit.na.ke.Rah'); // strip trailing sof-passuq
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
    expect(cleanGloss('and/')).toBe('and'); // only a prefix -> unwrapped, slash-free fallback
    expect(cleanGloss('to/ when?')).toBe('when'); // root that is itself a particle-word survives
    expect(cleanGloss('<the>')).toBe('the'); // a pure grammatical-marker gloss unwraps, not "<the>"
  });
  test('strips trailing attached particles/pronouns and dangling slashes', () => {
    expect(cleanGloss('downfall/ your')).toBe('downfall');
    expect(cleanGloss('servants/ his')).toBe('servants');
    expect(cleanGloss('gold/ the')).toBe('gold');
    expect(cleanGloss('pay attention/')).toBe('pay attention');
    expect(cleanGloss('the signet-ring of')).toBe('the signet-ring of'); // free "of" kept (construct)
  });
  test('removes brackets/markers and outer punctuation', () => {
    expect(cleanGloss('[objects of] compassion')).toBe('objects of compassion');
    expect(cleanGloss('[man] equipped')).toBe('man equipped');
    expect(cleanGloss('¿/ have you murdered')).toBe('have you murdered');
    expect(cleanGloss('immortality.')).toBe('immortality');
    expect(cleanGloss('give thanks?')).toBe('give thanks');
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

describe('shortDefinition', () => {
  test('strips per-sense verse citations, keeps glosses and markers', () => {
    const full = 'πιστός , -ή, -όν (πείθω), [in LXX chiefly for אָמַן ;] __I. Pass., to be trusted or believed; __1. of persons, trusty, faithful : Mat.24:45 25:21, 23 Luk.12:42 , 1Co.4:2 ; __II. Act., believing, trusting, relying : Act.16:1 , Gal.3:9 .';
    const short = shortDefinition(full);
    expect(short).toBe('πιστός , -ή, -όν (πείθω), [in LXX chiefly for אָמַן ;] I. Pass., to be trusted or believed 1. of persons, trusty, faithful II. Act., believing, trusting, relying');
    expect(short).not.toMatch(/Mat\.24|Luk\.12|1Co\.4/);   // scripture refs gone ("Act." here is "Active", not Acts)
  });
  test('empty definition -> empty string', () => {
    expect(shortDefinition('')).toBe('');
  });
});

describe('splitNoteLinks', () => {
  const blessing = { raw: 'Blessing', pkind: 'theme', ptitle: 'Blessing', pbook: 'Gen' };
  const body = 'God’s blessing commissions and enables the fulfillment of what God has spoken '
    + '(see “Blessing” Theme Note). • Let the fish . . . let the birds: These directives define '
    + 'the blessing.';

  test('links the quoted target and passes every other character through verbatim', () => {
    const parts = splitNoteLinks(body, [blessing]);
    expect(parts.map(p => p.kind)).toEqual(['text', 'link', 'text']);
    expect(parts[1]).toMatchObject({ raw: '“Blessing”', pkind: 'theme', ptitle: 'Blessing', pbook: 'Gen' });
    expect(parts.map(p => p.text ?? p.raw).join('')).toBe(body);
  });

  test('never fires on the bare word, which the same note uses to mean something else', () => {
    // "blessing" appears three more times here as ordinary prose; only the quoted one is a link
    const parts = splitNoteLinks(body, [blessing]);
    expect(parts.filter(p => p.kind === 'link')).toHaveLength(1);
  });

  test('a note with no links is one text run, not a rebuilt string', () => {
    expect(splitNoteLinks(body, [])).toEqual([{ kind: 'text', text: body }]);
    expect(splitNoteLinks(body, null)).toEqual([{ kind: 'text', text: body }]);
  });

  test('links every occurrence, in reading order, when a note quotes its target twice', () => {
    const twice = 'See “Lot” Profile. Later, see “Lot” Profile again.';
    const lot = { raw: 'Lot', pkind: 'profile', ptitle: 'Lot', pbook: 'Gen' };
    const parts = splitNoteLinks(twice, [lot]);
    expect(parts.filter(p => p.kind === 'link')).toHaveLength(2);
    expect(parts.map(p => p.text ?? p.raw).join('')).toBe(twice);
  });

  test('a target the clamp cut off contributes no link and no stray text', () => {
    const cut = 'God’s blessing commissions and enables…';
    expect(splitNoteLinks(cut, [blessing])).toEqual([{ kind: 'text', text: cut }]);
  });
});
