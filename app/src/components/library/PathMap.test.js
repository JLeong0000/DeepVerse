import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tick } from 'svelte';
import { render, fireEvent } from '@testing-library/svelte';
import { resetLibrary, lib, pushNode, truncateTo } from '../../lib/library.svelte.js';
import PathMap from './PathMap.svelte';

// getXrefs is looked up per test from this map; anything not registered comes back empty. The
// shape here must stay exactly what db.js returns — { out, in } and nothing else. A third key
// once lived in this stub and in no real result, so the map threw on every article step while
// these tests passed.
const { xrefs } = vi.hoisted(() => ({ xrefs: new Map() }));
vi.mock('../../lib/db.js', () => ({
  getXrefs: (id) => xrefs.get(id) ?? { out: [], in: [] },
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
    xrefs.set('Beast', { out: [nbr('Antichrist')], in: [] });
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
    xrefs.set('Beast', { out: many, in: [] });
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

  it('draws a neighbour shared by two steps once, attached to the earliest step (not merely once)', () => {
    xrefs.set('Beast', { out: [nbr('Armageddon')], in: [] });
    xrefs.set('Antichrist', { out: [nbr('Armageddon')], in: [] });
    pushNode(art('Beast'));      // stack: [start, Beast]      — step index 1, x = 120+1*208 = 328
    pushNode(art('Antichrist')); // stack: [start, Beast, ...] — step index 2, x = 120+2*208 = 536
    const { container } = render(PathMap);
    const titles = [...container.querySelectorAll('title')].filter((t) => t.textContent === 'Armageddon');
    expect(titles).toHaveLength(1);
    // toHaveLength(1) alone would also pass if the node had attached to Antichrist instead of
    // Beast — pin the actual column so a regression that migrates it to the wrong step is caught.
    const circle = titles[0].nextElementSibling;
    expect(circle.getAttribute('cx')).toBe('328');   // Beast's column, not Antichrist's (536)
  });

  // Regression for a bug the reviewer reproduced on the brief's own walkthrough trail: Antichrist
  // has 9 real candidates, draws 7 and hides 2 behind "+2 more" — and one of the hidden two was
  // also a neighbour of the next step, so it resurfaced there instead of staying hidden. Cause:
  // only the 7 *drawn* branches were added to `claimed`, leaving overflow candidates free to be
  // claimed again later. Neither a revisited article nor a large neighbour count is needed — one
  // step over MAX_BRANCHES sharing a single candidate with the next step is enough.
  it('claims overflow candidates too, so a hidden one stays behind its earliest step instead of migrating to the next', () => {
    const many = Array.from({ length: 8 }, (_, i) => nbr(`N${i}`));
    xrefs.set('Beast', { out: [...many, nbr('Shared')], in: [] });   // 9 candidates
    xrefs.set('Antichrist', { out: [nbr('Shared')], in: [] });
    pushNode(art('Beast'));
    pushNode(art('Antichrist'));
    const { container, getByText } = render(PathMap);
    expect(getByText('+2 more')).toBeTruthy();   // Beast: 9 candidates, 7 shown, 2 hidden
    const titles = [...container.querySelectorAll('title')].map((t) => t.textContent);
    expect(titles).not.toContain('Shared');   // claimed-but-hidden at Beast, not drawn at Antichrist
  });

  it('clicking a branch off a middle step rewinds the trail to that step and appends the branch', async () => {
    xrefs.set('Beast', { out: [nbr('Armageddon')], in: [] });
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

  // jsdom lays out nothing (scrollWidth/clientWidth are always 0), so `pannable` never flips true
  // on its own; stub the sizes an overflowing map would report and nudge the stack so the
  // `$effect` that reads them reruns (it only reruns when `model` changes).
  async function forcePannable(scrollEl) {
    Object.defineProperty(scrollEl, 'scrollWidth', { value: 2000, configurable: true });
    Object.defineProperty(scrollEl, 'clientWidth', { value: 400, configurable: true });
    Object.defineProperty(scrollEl, 'scrollHeight', { value: 100, configurable: true });
    Object.defineProperty(scrollEl, 'clientHeight', { value: 100, configurable: true });
    const len = lib.stack.length;
    pushNode(art('Temp'));
    truncateTo(len - 1);
    await tick();
  }

  // These two tests drive PathMap's own `dragged` state machine directly via dispatchEvent —
  // jsdom implements neither PointerEvent nor Pointer Capture, so they cannot exercise (and would
  // not fail on a regression of) the browser-level behaviour where an actual captured pointer
  // retargets the resulting `click` event to a different element. That failure mode was live-only
  // and is covered by the Playwright checklist, not here. What these two confirm is the state
  // machine itself: the 3px threshold and the guard's reset. See the capture-timing test below for
  // the one piece of the pointer-capture regression that *is* reachable in jsdom.
  it('[state machine] a drag that ends on a node does not navigate, and the guard resets for the next real click', async () => {
    pushNode({ kind: 'route', route: 'dict' });
    pushNode(art('Beast'));
    pushNode(art('Antichrist'));
    const { container } = render(PathMap);
    const scrollEl = container.querySelector('.scroll');
    await forcePannable(scrollEl);
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

  it('[state machine] a movement under the 3px threshold still counts as a click, not a drag', async () => {
    pushNode({ kind: 'route', route: 'dict' });
    pushNode(art('Beast'));
    pushNode(art('Antichrist'));
    const { container } = render(PathMap);
    const scrollEl = container.querySelector('.scroll');
    await forcePannable(scrollEl);

    const beastNode = container.querySelector('circle.nd.spine');
    scrollEl.dispatchEvent(ptr('pointerdown', 0, 0));
    scrollEl.dispatchEvent(ptr('pointermove', 2, 0));   // under the threshold
    scrollEl.dispatchEvent(ptr('pointerup', 2, 0));
    await fireEvent.click(beastNode);
    expect(lib.stack).toHaveLength(3);   // navigated — this was a click, not a pan
  });

  // Regression for the critical bug: capturing the pointer on every pointerdown (rather than only
  // once a drag is confirmed) retargets the browser's own `click` event to .scroll, silently
  // disabling every node while the map is pannable — a PLAIN click, no drag at all, would do
  // nothing. jsdom has no real capture-retargeting behaviour to break, but it does let us pin the
  // one thing PathMap itself controls: *when* it calls setPointerCapture.
  it('does not acquire pointer capture on a bare pointerdown — only once the 3px threshold is crossed', async () => {
    pushNode({ kind: 'route', route: 'dict' });
    pushNode(art('Beast'));
    const { container } = render(PathMap);
    const scrollEl = container.querySelector('.scroll');
    await forcePannable(scrollEl);
    scrollEl.setPointerCapture = vi.fn();
    scrollEl.releasePointerCapture = vi.fn();

    scrollEl.dispatchEvent(ptr('pointerdown', 0, 0));
    expect(scrollEl.setPointerCapture).not.toHaveBeenCalled();   // no drag yet — must not capture

    scrollEl.dispatchEvent(ptr('pointermove', 1, 0));   // still under the threshold
    expect(scrollEl.setPointerCapture).not.toHaveBeenCalled();

    scrollEl.dispatchEvent(ptr('pointermove', 20, 0));   // now past it
    expect(scrollEl.setPointerCapture).toHaveBeenCalledTimes(1);
    expect(scrollEl.setPointerCapture).toHaveBeenCalledWith(1);   // ptr() sets pointerId: 1

    scrollEl.dispatchEvent(ptr('pointerup', 20, 0));
    expect(scrollEl.releasePointerCapture).toHaveBeenCalledWith(1);
  });
});
