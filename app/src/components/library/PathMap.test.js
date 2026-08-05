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

// The viewBox now grows with the busiest step in the trail, so the spine's y is no longer a fixed
// 210 — read it off the render rather than restating a number that moves with the layout.
const spineY = (container) => Number(container.querySelector('circle.nd.on').getAttribute('cy'));

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

  // The bug this pins: `Shechem (Place)` has no out-links and two in-links, so the map drew
  // `Sychem*` as a branch while "Where this leads" correctly called the article a dead end. The
  // branch was real — the map deliberately shows inbound neighbours — but nothing distinguished it
  // from a door out. Direction is now carried by an arrowhead, and an inbound branch is drawn
  // spine-ward so the single marker points the right way.
  it('fans an outbound branch right of its step and fades it, leaving the spine axis alone', () => {
    xrefs.set('Shechem', { out: [nbr('Gerizim')], in: [] });
    pushNode(art('Shechem'));   // stack: [start, Shechem] — step index 1, x = 120 + 208 = 328
    const { container } = render(PathMap);
    const circle = [...container.querySelectorAll('circle.nd')]
      .find((c) => c.classList.contains('faint'));
    expect(circle.getAttribute('cx')).toBe('404');            // 328 + FAN_DX
    expect(Number(circle.getAttribute('cy'))).not.toBe(spineY(container));  // never on the spine itself
    const line = container.querySelector('line.lnk.branch');
    expect(line.classList.contains('faint')).toBe(true);
    expect(Number(line.getAttribute('x2'))).toBeGreaterThan(328);
    // the label fades with the node, or a dimmed dot keeps a full-strength caption
    expect([...container.querySelectorAll('text')].some((t) =>
      t.textContent === 'Gerizim' && t.classList.contains('faint'))).toBe(true);
  });

  // Found by auditing rendered label boxes across 14 real trails, not by eye: giving outbound and
  // inbound a slot counter each put "Canaanite Deities and…" (outbound) and "Graven Image*"
  // (inbound) on the same side at row 0, 8px apart vertically. Slots are allocated across all of a
  // step's branches at once, so no two ever share a (side, row) — only x varies by direction.
  it('never lets two branches of one step share a row, whichever direction they run', () => {
    xrefs.set('Idols', {
      out: [nbr('Canaanite Deities'), nbr('Grove')],
      in: [nbr('Graven Image'), nbr('Teraphim')],
    });
    pushNode(art('Idols'));
    const { container } = render(PathMap);
    const ys = [...container.querySelectorAll('circle.nd')]
      .filter((c) => !c.className.baseVal.match(/\b(on|spine|step)\b/))
      .map((c) => Number(c.getAttribute('cy')));
    expect(ys).toHaveLength(4);
    expect(new Set(ys).size).toBe(4);                       // four distinct rows
    // and the rows are far enough apart that a 15px-tall label cannot bridge them
    const sorted = [...ys].sort((a, b) => a - b);
    sorted.slice(1).forEach((y, i) => expect(y - sorted[i]).toBeGreaterThanOrEqual(42));
  });

  // The reported collision: `Sychem*` arrives from below and its line ran straight through the
  // "Shechem (Place)" caption at cy+24. Inbound stays on the vertical axis — it is not somewhere
  // the path can go — so the arrow has to stop under the text instead.
  it('stops an inbound arrow below the step label rather than running through it', () => {
    xrefs.set('Shechem', { out: [], in: [nbr('Sychem')] });
    pushNode(art('Shechem'));
    const { container } = render(PathMap);
    const line = container.querySelector('line.lnk.branch');
    expect(line.classList.contains('faint')).toBe(false);   // inbound is not faded
    expect(line.getAttribute('x1')).toBe('328');            // still the step's own column
    expect(line.getAttribute('x2')).toBe('328');
    expect(line.getAttribute('marker-end')).toBe('url(#arw)');
    // runs upward (y1 > y2) and halts clear of the caption baseline at cy+24
    expect(Number(line.getAttribute('y1'))).toBeGreaterThan(Number(line.getAttribute('y2')));
    expect(Number(line.getAttribute('y2'))).toBeGreaterThan(spineY(container) + 24);
  });

  // Clicking that inbound branch walks Shechem -> Sychem, against the reference. The step did
  // follow a cross-reference, so the line stays solid; the arrow is what says which way it runs.
  it('points the spine arrow backwards when the step was traversed against the reference', () => {
    xrefs.set('Sychem', { out: [nbr('Shechem')], in: [] });
    xrefs.set('Shechem', { out: [], in: [nbr('Sychem')] });
    pushNode(art('Shechem'));
    pushNode(art('Sychem'));
    const { container } = render(PathMap);
    const spine = [...container.querySelectorAll('line.lnk.path')];
    expect(spine).toHaveLength(1);
    expect(spine[0].getAttribute('marker-end')).toBe('url(#arw-a)');
    // drawn right-to-left, so the arrowhead lands on Shechem — the article being named
    expect(Number(spine[0].getAttribute('x1'))).toBeGreaterThan(Number(spine[0].getAttribute('x2')));
  });

  // Reads the cap off the render rather than restating it: MAX_BRANCHES is a tuning knob, and a
  // test that hardcodes it fails on every adjustment without anything actually being wrong. What
  // must hold at any cap is that drawn + hidden accounts for every candidate, and that the counter
  // and the deepest row it sits above both stay inside the viewBox.
  it('caps branches, accounts for the remainder, and keeps the counter inside the viewBox', () => {
    const TOTAL = 40;   // far past any plausible cap, so overflow is guaranteed
    xrefs.set('Beast', { out: Array.from({ length: TOTAL }, (_, i) => nbr(`N${i}`)), in: [] });
    pushNode(art('Beast'));
    const { container, getByText } = render(PathMap);
    const branches = [...container.querySelectorAll('circle.nd:not(.on):not(.spine):not(.step)')];
    expect(branches.length).toBeGreaterThan(0);
    expect(branches.length).toBeLessThan(TOTAL);
    const more = getByText(`+${TOTAL - branches.length} more`);

    const svg = container.querySelector('svg');
    const H = Number(svg.getAttribute('height'));
    expect(Number(more.getAttribute('y'))).toBeGreaterThan(0);
    for (const c of branches) {
      const cy = Number(c.getAttribute('cy'));
      expect(cy).toBeGreaterThan(0);
      expect(cy).toBeLessThan(H);
    }
    // every label too — the deepest row's caption reaches past its own node
    for (const t of container.querySelectorAll('text')) {
      const b = t.getBBox ? t.getBBox() : null;
      const y = Number(t.getAttribute('y'));
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(H);
      if (b) expect(b.y + b.height).toBeLessThanOrEqual(H);
    }
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
    expect(circle.getAttribute('cx')).toBe('404');   // Beast's column (328) + the outbound fan,
                                                     // not Antichrist's (536 + 76 = 612)
  });

  // Regression for a bug the reviewer reproduced on the brief's own walkthrough trail: a step that
  // overflows hides some candidates, and one of the hidden ones was also a neighbour of the next
  // step, so it resurfaced there instead of staying hidden. Cause: only the *drawn* branches were
  // added to `claimed`, leaving overflow candidates free to be claimed again later. `Shared` goes
  // last so it lands in the overflow at any cap.
  it('claims overflow candidates too, so a hidden one stays behind its earliest step instead of migrating to the next', () => {
    const many = Array.from({ length: 40 }, (_, i) => nbr(`N${i}`));
    xrefs.set('Beast', { out: [...many, nbr('Shared')], in: [] });
    xrefs.set('Antichrist', { out: [nbr('Shared')], in: [] });
    pushNode(art('Beast'));
    pushNode(art('Antichrist'));
    const { container } = render(PathMap);
    const labels = [...container.querySelectorAll('text')].map((t) => t.textContent);
    expect(labels.some((s) => /^\+\d+ more$/.test(s))).toBe(true);   // Beast overflowed
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
