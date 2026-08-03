<script>
  // The breadcrumb drawn as a spine, with each article step's untaken cross-references branching
  // off it. Clicking a branch rewinds the trail to the step it hangs off and continues from there,
  // so the breadcrumb stays a truthful account of the route rather than a log of every click.
  import { lib, jumpFrom, truncateTo, nodeLabel } from '../../lib/library.svelte.js';
  import { getXrefs } from '../../lib/db.js';
  import { displayTitle } from '../../lib/titles.js';

  // Branches drawn per step. Ours, not the data's — `Plants` has 152 neighbours (measured against
  // the resolver that indexes all 131 supplements) and would bury the spine.
  const MAX_BRANCHES = 7;
  // H=420 (not 348): at MAX_BRANCHES=7 a step's branches stack up to 4 rows deep on one side
  // (54 + 3*42 = 180px from the spine), and the "+N more" label sits at cy-190 — both need more
  // headroom than a 174px half-height (cy = H/2) leaves, or they're clipped by the viewBox.
  const COL = 208, H = 420;

  let scrollEl = $state(null);
  let pannable = $state(false);
  let pan = null, dragged = false;

  const short = (s) => (s.length > 22 ? s.slice(0, 21).trimEnd() + '…' : s);

  let model = $derived.by(() => {
    const cy = H / 2;
    const steps = lib.stack.map((node, i) => ({ i, node, id: node.kind === 'article' ? node.id : null }));
    const onSpine = new Set(steps.filter((s) => s.id).map((s) => s.id));
    const claimed = new Set(onSpine);
    const neighbours = new Map();
    for (const s of steps) {
      if (!s.id) { s.branches = []; s.hidden = 0; continue; }
      const x = getXrefs(s.id);
      // both directions: inbound is what nothing else in the UI can show. Phantom targets ride
      // along as unclickable nodes — hiding them would overstate how complete the graph is.
      const phantoms = x.missing.map((raw) => ({ id: `x:${raw}`, title: raw, phantom: true }));
      const all = [...x.out, ...x.in, ...phantoms].filter((n, k, arr) =>
        arr.findIndex((m) => m.id === n.id) === k && !claimed.has(n.id));
      neighbours.set(s.id, new Set([...x.out, ...x.in].map((n) => n.id)));
      s.branches = all.slice(0, MAX_BRANCHES);
      s.hidden = all.length - s.branches.length;
      // Claim every candidate this step saw, not just the ones it had room to draw — otherwise an
      // overflow candidate stays unclaimed and can resurface at a later step that also neighbours
      // it, migrating away from "its earliest step" instead of staying hidden behind this step's
      // own "+N more".
      for (const n of all) claimed.add(n.id);
    }
    const W = Math.max(700, 120 + (steps.length - 1) * COL + 120);
    const px = (i) => 120 + i * COL;
    const links = [], nodes = [];
    for (const s of steps) {
      const x = px(s.i);
      if (s.i > 0) {
        const prev = steps[s.i - 1];
        // solid when the step followed a real cross-reference; dashed when the user arrived
        // another way — search, a route, or Wander in
        const followed = !!(s.id && prev.id && neighbours.get(prev.id)?.has(s.id));
        links.push({ x1: px(prev.i), y1: cy, x2: x, y2: cy, cls: followed ? 'path' : 'jumped' });
      }
      s.branches.forEach((b, k) => {
        const side = k % 2 ? -1 : 1, row = Math.floor(k / 2);
        const by = cy + side * (54 + row * 42);
        links.push({ x1: x, y1: cy, x2: x, y2: by, cls: b.phantom ? 'gone' : '' });
        const full = displayTitle(b.title);
        nodes.push({ kind: 'branch', x, y: by, side, step: s.i, id: b.id,
          phantom: !!b.phantom, label: short(full), full });
      });
      const last = s.i === steps.length - 1;
      nodes.push({ kind: 'step', x, y: cy, i: s.i, last, isArticle: !!s.id,
        label: short(nodeLabel(s.node)), full: nodeLabel(s.node), hidden: s.hidden });
    }
    return { W, H, links, nodes, articles: steps.filter((s) => s.id).length };
  });

  function updatePannable() {
    if (!scrollEl) return;
    pannable = scrollEl.scrollWidth > scrollEl.clientWidth + 1
      || scrollEl.scrollHeight > scrollEl.clientHeight + 1;
  }
  $effect(() => {
    model;
    updatePannable();
  });

  function down(e) {
    if (!pannable) return;
    pan = { x: e.clientX, y: e.clientY, l: scrollEl.scrollLeft, t: scrollEl.scrollTop };
    dragged = false;
    e.preventDefault();   // otherwise the pointer starts a text selection over the labels
  }
  function move(e) {
    if (!pan) return;
    const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
    if (!dragged && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
      dragged = true;
      // Capture only once a real pan is underway, not on every pointerdown: capturing eagerly
      // retargets the eventual click to .scroll in real browsers, so a plain, undragged click on
      // a node would never reach that node's own click handler.
      scrollEl.setPointerCapture?.(e.pointerId);
    }
    scrollEl.scrollLeft = pan.l - dx;
    scrollEl.scrollTop = pan.t - dy;
  }
  function up(e) {
    if (pan) scrollEl.releasePointerCapture?.(e.pointerId);
    pan = null;
  }

  // a pan that ends over a node must not also open it
  function guard(fn) {
    return () => { if (dragged) { dragged = false; return; } fn(); };
  }

  // keyboard equivalent of a click, for the SVG circles acting as buttons — dragging has no
  // keyboard analogue, so this bypasses guard() and always activates.
  function onEnter(fn) {
    return (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };
  }
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') lib.mapOpen = false; }}
  onresize={updatePannable} />

<div class="backdrop" onclick={() => (lib.mapOpen = false)} role="presentation"></div>
<div class="modal" role="dialog" aria-modal="true" aria-label="Your path">
  <div class="hd">
    <span class="ll">Your path</span>
    <span class="sub">
      {model.articles} article{model.articles === 1 ? '' : 's'} · every branch you haven’t taken is clickable
    </span>
    <button class="close" onclick={() => (lib.mapOpen = false)} aria-label="Close">✕</button>
  </div>

  <div class="scroll" class:pannable bind:this={scrollEl} role="presentation"
    onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}>
    <svg width={model.W} height={model.H} viewBox="0 0 {model.W} {model.H}">
      {#each model.links as l}
        <line class="lnk {l.cls}" x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
      {/each}
      {#each model.nodes as n}
        {#if n.kind === 'branch'}
          {@const jump = () => jumpFrom(n.step, { kind: 'article', id: n.id, title: n.full })}
          <g>
            <title>{n.full}{n.phantom ? ' — named by the source, but no such article exists' : ''}</title>
            <circle class="nd" class:gone={n.phantom} cx={n.x} cy={n.y} r="5"
              role="button" tabindex={n.phantom ? -1 : 0} aria-disabled={n.phantom ? 'true' : undefined}
              onclick={n.phantom ? undefined : guard(jump)}
              onkeydown={n.phantom ? undefined : onEnter(jump)} />
            <text class={n.phantom ? 'gone' : ''} x={n.x} y={n.y + (n.side < 0 ? -11 : 17)}
              text-anchor="middle">{n.label}</text>
          </g>
        {:else}
          {@const activate = () => truncateTo(n.i)}
          <g>
            <title>{n.full}</title>
            <circle class="nd {n.last ? 'on' : n.isArticle ? 'spine' : 'step'}"
              cx={n.x} cy={n.y} r={n.last ? 9 : 7} role="button" tabindex="0"
              onclick={guard(activate)} onkeydown={onEnter(activate)} />
            <text class={n.last ? 'on' : n.isArticle ? 'spine' : 'step'}
              x={n.x} y={n.y + 24} text-anchor="middle">{n.label}</text>
            {#if n.hidden}
              <text class="step" x={n.x} y={n.y - 190} text-anchor="middle">+{n.hidden} more</text>
            {/if}
          </g>
        {/if}
      {/each}
    </svg>
  </div>

  <div class="legend">
    <span><i class="path"></i> the step followed a cross-reference</span>
    <span><i class="jumped"></i> arrived another way — search, a route, or ✦ Wander in</span>
    <span><i></i> a branch not taken</span>
    <span><i class="jumped"></i> named by the source, absent from the corpus</span>
    {#if pannable}<span>drag to pan</span>{/if}
  </div>
</div>

<style>
  .backdrop { position: fixed; inset: 0; z-index: 80; background: rgba(0,0,0,.45); }
  .modal { position: fixed; z-index: 81; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: calc(100vw - 60px); max-height: calc(100vh - 80px); background: var(--panel);
    border: 1px solid var(--rule); border-radius: 10px; display: flex; flex-direction: column;
    box-shadow: 0 18px 60px rgba(0,0,0,.4); }
  .hd { display: flex; align-items: baseline; gap: 10px; padding: 13px 17px 9px;
    border-bottom: 1px solid var(--rule); }
  .ll { font-size: 14px; color: var(--ink); }
  .sub { font-size: 11px; color: var(--dim); }
  .close { margin-left: auto; background: transparent; border: none; color: var(--dim);
    font-family: inherit; font-size: 13px; cursor: pointer; }
  .close:hover { color: var(--ink); }
  .scroll { overflow: auto; padding: 6px 10px; }
  /* a grab cursor on content that cannot move misrepresents the control */
  .scroll.pannable { cursor: grab; }
  .scroll.pannable:active { cursor: grabbing; user-select: none; }
  svg { display: block; }
  .lnk { stroke: var(--rule); stroke-width: 1.2; }
  .lnk.path { stroke: var(--a); stroke-width: 2; }
  .lnk.jumped { stroke: var(--dim); stroke-width: 1.2; stroke-dasharray: 4 4; }
  .lnk.gone { stroke: var(--dim); stroke-dasharray: 2 3; opacity: .55; }
  .nd { fill: var(--bg); stroke: var(--dim); stroke-width: 1.3; cursor: pointer; }
  .nd:hover { stroke: var(--a); stroke-width: 2.2; }
  .nd.gone { fill: none; stroke: var(--dim); stroke-dasharray: 2 2; cursor: not-allowed; opacity: .6; }
  .nd.gone:hover { stroke: var(--dim); stroke-width: 1.3; }
  text.gone { fill: var(--dim); font-style: italic; }
  .nd.on { fill: var(--a); stroke: var(--a); }
  .nd.spine { fill: var(--panel); stroke: var(--a); stroke-width: 1.8; }
  .nd.step { fill: var(--panel); stroke: var(--dim); stroke-dasharray: 3 2; }
  text { font-size: 10.5px; fill: var(--ink); pointer-events: none; }
  text.on { fill: var(--a); font-weight: 600; }
  text.spine { fill: var(--ink); font-weight: 600; }
  text.step { fill: var(--dim); }
  .legend { display: flex; flex-wrap: wrap; gap: 15px; padding: 9px 17px 13px; font-size: 10.5px;
    color: var(--dim); border-top: 1px solid var(--rule); }
  .legend span { display: inline-flex; align-items: center; gap: 5px; }
  .legend i { width: 17px; height: 0; border-top: 1px solid var(--rule); display: inline-block; }
  .legend i.path { border-top: 2px solid var(--a); }
  .legend i.jumped { border-top: 1px dashed var(--dim); }
</style>
