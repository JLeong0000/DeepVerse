import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tick } from 'svelte';
import { render, fireEvent } from '@testing-library/svelte';
import { resetLibrary, lib, pushNode, truncateTo } from '../../lib/library.svelte.js';
import PathMap from './PathMap.svelte';

// getXrefs is looked up per test from this map; anything not registered comes back empty, same
// shape as the real db.js function returns for an article with no cross-references.
const { xrefs } = vi.hoisted(() => ({ xrefs: new Map() }));
vi.mock('../../lib/db.js', () => ({
  getXrefs: (id) => xrefs.get(id) ?? { out: [], in: [], missing: [] },
}));

const art = (id, title = id) => ({ kind: 'article', id, title });
const nbr = (id) => ({ id, title: id, raw: id, anchor: null });

beforeEach(() => {
  resetLibrary();
  xrefs.clear();
});

// dispatch a synthetic pointer event carrying just the fields PathMap's down/move handlers read —
// jsdom implements neither PointerEvent nor Pointer Capture, so a plain Event with the coordinates
// bolted on is enough to drive the same code path.
function ptr(type, x, y) {
  const e = new Event(type, { bubbles: true, cancelable: true });
  e.clientX = x; e.clientY = y; e.pointerId = 1;
  return e;
}

describe('PathMap', () => {
  it('marks a spine link solid only when the two steps are actually cross-referenced', () => {
    xrefs.set('Beast', { out: [nbr('Antichrist')], in: [], missing: [] });
    pushNode({ kind: 'route', route: 'dict', letter: 'B' });
    pushNode(art('Beast'));
    pushNode(art('Antichrist'));
    const { container } = render(PathMap);
    const links = [...container.querySelectorAll('line.lnk')];
    expect(links).toHaveLength(3);                        // start->route, route->Beast, Beast->Antichrist
    expect(links[0].classList.contains('jumped')).toBe(true);  // Start has no article to follow from
    expect(links[1].classList.contains('jumped')).toBe(true);  // route->Beast: not a cross-reference
    expect(links[2].classList.contains('path')).toBe(true);    // Beast really links to Antichrist
  });

  it('caps branches at MAX_BRANCHES and reports the remainder as hidden, inside the viewBox', () => {
    const many = Array.from({ length: 9 }, (_, i) => nbr(`N${i}`));
    xrefs.set('Beast', { out: many, in: [], missing: [] });
    pushNode(art('Beast'));
    const { container, getByText } = render(PathMap);
    const branchCircles = container.querySelectorAll('circle.nd:not(.on):not(.spine):not(.step)');
    expect(branchCircles).toHaveLength(7);
    const more = getByText('+2 more');
    const svg = container.querySelector('svg');
    const H = Number(svg.getAttribute('height'));
    const y = Number(more.getAttribute('y'));
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(H);
  });

  it('draws a neighbour shared by two steps once, attached to the earliest step', () => {
    xrefs.set('Beast', { out: [nbr('Armageddon')], in: [], missing: [] });
    xrefs.set('Antichrist', { out: [nbr('Armageddon')], in: [], missing: [] });
    pushNode(art('Beast'));
    pushNode(art('Antichrist'));
    const { container } = render(PathMap);
    const titles = [...container.querySelectorAll('title')].filter((t) => t.textContent === 'Armageddon');
    expect(titles).toHaveLength(1);
  });

  it('draws a phantom (unresolved) target as a genuinely unclickable node', async () => {
    xrefs.set('Beast', { out: [], in: [], missing: ['GhostEntry'] });
    pushNode(art('Beast'));
    const { container } = render(PathMap);
    const phantom = container.querySelector('circle.gone');
    expect(phantom).toBeTruthy();
    const before = lib.stack.length;
    await fireEvent.click(phantom);
    expect(lib.stack).toHaveLength(before);   // no navigation happened
  });

  it('clicking a branch off a middle step rewinds the trail to that step and appends the branch', async () => {
    xrefs.set('Beast', { out: [nbr('Armageddon')], in: [], missing: [] });
    pushNode({ kind: 'route', route: 'dict' });
    pushNode(art('Beast'));
    pushNode(art('Antichrist'));
    const { container } = render(PathMap);
    const branch = container.querySelector('circle.nd:not(.on):not(.spine):not(.step)');
    await fireEvent.click(branch);
    expect(lib.stack.map((n) => n.id ?? n.kind)).toEqual(['start', 'route', 'Beast', 'Armageddon']);
  });

  it('clicking a spine node truncates the trail to that step', async () => {
    pushNode({ kind: 'route', route: 'dict' });
    pushNode(art('Beast'));
    pushNode(art('Antichrist'));
    const { container } = render(PathMap);
    const beastNode = container.querySelector('circle.nd.spine');   // Beast: article, not the current step
    await fireEvent.click(beastNode);
    expect(lib.stack.map((n) => n.id ?? n.kind)).toEqual(['start', 'route', 'Beast']);
  });

  it('a drag that ends on a node does not navigate, and the guard resets for the next real click', async () => {
    pushNode({ kind: 'route', route: 'dict' });
    pushNode(art('Beast'));
    pushNode(art('Antichrist'));
    const { container } = render(PathMap);
    const scrollEl = container.querySelector('.scroll');

    // jsdom lays out nothing, so scrollWidth/clientWidth are both 0 and `pannable` would never
    // flip true on its own; stub the sizes an overflowing map would report.
    Object.defineProperty(scrollEl, 'scrollWidth', { value: 2000, configurable: true });
    Object.defineProperty(scrollEl, 'clientWidth', { value: 400, configurable: true });
    Object.defineProperty(scrollEl, 'scrollHeight', { value: 100, configurable: true });
    Object.defineProperty(scrollEl, 'clientHeight', { value: 100, configurable: true });
    // the pannable effect only reruns when `model` changes; nudge the stack to force that now
    // that the stubbed sizes are in place, then restore it.
    const len = lib.stack.length;
    pushNode(art('Temp'));
    truncateTo(len - 1);
    await tick();
    expect(scrollEl.classList.contains('pannable')).toBe(true);

    const beastNode = container.querySelector('circle.nd.spine');
    scrollEl.dispatchEvent(ptr('pointerdown', 0, 0));
    scrollEl.dispatchEvent(ptr('pointermove', 20, 0));   // well past the 3px threshold
    scrollEl.dispatchEvent(ptr('pointerup', 20, 0));
    await fireEvent.click(beastNode);
    expect(lib.stack).toHaveLength(4);   // swallowed — the drag did not truncate the trail

    await fireEvent.click(beastNode);
    expect(lib.stack).toHaveLength(3);   // the guard reset, so this click navigates normally
  });

  it('a movement under the 3px threshold still counts as a click, not a drag', async () => {
    pushNode({ kind: 'route', route: 'dict' });
    pushNode(art('Beast'));
    pushNode(art('Antichrist'));
    const { container } = render(PathMap);
    const scrollEl = container.querySelector('.scroll');
    Object.defineProperty(scrollEl, 'scrollWidth', { value: 2000, configurable: true });
    Object.defineProperty(scrollEl, 'clientWidth', { value: 400, configurable: true });
    Object.defineProperty(scrollEl, 'scrollHeight', { value: 100, configurable: true });
    Object.defineProperty(scrollEl, 'clientHeight', { value: 100, configurable: true });
    const len = lib.stack.length;
    pushNode(art('Temp'));
    truncateTo(len - 1);
    await tick();

    const beastNode = container.querySelector('circle.nd.spine');
    scrollEl.dispatchEvent(ptr('pointerdown', 0, 0));
    scrollEl.dispatchEvent(ptr('pointermove', 2, 0));   // under the threshold
    scrollEl.dispatchEvent(ptr('pointerup', 2, 0));
    await fireEvent.click(beastNode);
    expect(lib.stack).toHaveLength(3);   // navigated — this was a click, not a pan
  });
});
