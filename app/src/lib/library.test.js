import { test, expect, describe, beforeEach } from 'vitest';
import { lib, pushNode, truncateTo, jumpFrom, replaceTop, popNode, resetLibrary,
  nodeLabel, crumbSlots, articleDepth, MAX_CRUMBS } from './library.svelte.js';

const art = (id) => ({ kind: 'article', id, title: id });

beforeEach(() => resetLibrary());

describe('the stack', () => {
  test('starts at Start', () => {
    expect(lib.stack).toEqual([{ kind: 'start' }]);
  });

  test('pushNode appends; truncateTo rewinds', () => {
    pushNode({ kind: 'route', route: 'dict' });
    pushNode(art('Beast'));
    expect(lib.stack).toHaveLength(3);
    truncateTo(1);
    expect(lib.stack).toHaveLength(2);
    expect(lib.stack.at(-1).route).toBe('dict');
  });

  test('jumpFrom rewinds to a step, then continues from it', () => {
    pushNode({ kind: 'route', route: 'dict' });
    pushNode(art('Beast'));
    pushNode(art('Antichrist'));
    pushNode(art('MarkofGod'));
    jumpFrom(2, art('Armageddon'));   // a branch hanging off Beast (index 2)
    expect(lib.stack.map((n) => n.id ?? n.kind))
      .toEqual(['start', 'route', 'Beast', 'Armageddon']);
  });

  test('replaceTop swaps the top step without changing the stack length', () => {
    pushNode({ kind: 'route', route: 'dict' });
    pushNode(art('Beast'));
    const len = lib.stack.length;
    replaceTop(art('Antichrist'));
    expect(lib.stack).toHaveLength(len);
    expect(lib.stack.at(-1).id).toBe('Antichrist');
  });

  test('articleDepth counts only article steps', () => {
    pushNode({ kind: 'route', route: 'dict' });
    pushNode(art('Beast'));
    expect(articleDepth(lib.stack)).toBe(1);
    pushNode(art('Antichrist'));
    expect(articleDepth(lib.stack)).toBe(2);
  });

  // Decision: a passage step (theme/profile essay) is a different surface from the dictionary's
  // article-to-article rabbit hole that this counter measures — it should not inflate the count.
  test('articleDepth does not count a passage step', () => {
    pushNode(art('Beast'));
    pushNode({ kind: 'passage', pkind: 'theme', title: 'Holy War', book: 'Deut' });
    expect(articleDepth(lib.stack)).toBe(1);
  });

  test('navigating re-collapses an expanded breadcrumb', () => {
    lib.crumbsOpen = true;
    pushNode(art('Beast'));
    expect(lib.crumbsOpen).toBe(false);
  });

  test('navigating also closes the path-map overlay', () => {
    lib.mapOpen = true;
    pushNode(art('Beast'));
    expect(lib.mapOpen).toBe(false);
  });

  test('replaceTop also closes the path-map overlay', () => {
    pushNode({ kind: 'search', q: 'reve' });
    lib.mapOpen = true;
    replaceTop({ kind: 'search', q: 'revel' });
    expect(lib.mapOpen).toBe(false);
  });

  test('popNode removes the top step', () => {
    pushNode({ kind: 'route', route: 'dict' });
    pushNode({ kind: 'search', q: 'reve' });
    popNode();
    expect(lib.stack.map((n) => n.kind)).toEqual(['start', 'route']);
  });

  test('popNode re-collapses an expanded breadcrumb', () => {
    pushNode({ kind: 'search', q: 'reve' });
    lib.crumbsOpen = true;
    popNode();
    expect(lib.crumbsOpen).toBe(false);
  });

  test('popNode also closes the path-map overlay', () => {
    pushNode({ kind: 'search', q: 'reve' });
    lib.mapOpen = true;
    popNode();
    expect(lib.mapOpen).toBe(false);
  });
});

describe('node labels', () => {
  test('a passage node reads by its title, same as an article', () => {
    expect(nodeLabel({ kind: 'passage', pkind: 'theme', title: 'Revelation, Book of', book: 'Rev' }))
      .toBe('Book of Revelation');
  });

  test('a hub node reads by its full book name, not its OSIS code', () => {
    expect(nodeLabel({ kind: 'hub', book: 'Rev' })).toBe('Revelation');
  });
});

describe('crumb truncation', () => {
  const build = (n) => {
    resetLibrary();
    for (let i = 1; i < n; i++) pushNode(art('A' + i));
    return lib.stack;
  };

  test('a stack of exactly MAX_CRUMBS renders in full', () => {
    const slots = crumbSlots(build(MAX_CRUMBS), false);
    expect(slots).toHaveLength(MAX_CRUMBS);
    expect(slots.some((s) => s.ellipsis)).toBe(false);
  });

  test('beyond MAX_CRUMBS: first, ellipsis, last four', () => {
    const stack = build(8);
    const slots = crumbSlots(stack, false);
    expect(slots).toHaveLength(6);
    expect(slots[0].i).toBe(0);
    expect(slots[1].ellipsis).toBe(true);
    expect(slots.slice(2).map((s) => s.i)).toEqual([4, 5, 6, 7]);
  });

  test('crumb slots carry the REAL stack index, not the rendered position', () => {
    const slots = crumbSlots(build(8), false);
    // the third rendered slot is stack index 4 — truncation must not misroute a click
    expect(slots[2].i).toBe(4);
  });

  test('the ellipsis names what it hides', () => {
    const slots = crumbSlots(build(8), false);
    expect(slots[1].hidden).toEqual(['A1', 'A2', 'A3']);
  });

  test('expanded renders every crumb', () => {
    expect(crumbSlots(build(8), true)).toHaveLength(8);
  });
});
