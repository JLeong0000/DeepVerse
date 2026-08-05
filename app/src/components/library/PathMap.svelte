<script>
  // The breadcrumb drawn as a spine, with each article step's untaken cross-references branching
  // off it. Clicking a branch rewinds the trail to the step it hangs off and continues from there,
  // so the breadcrumb stays a truthful account of the route rather than a log of every click.
  import { lib, jumpFrom, truncateTo, nodeLabel } from '../../lib/library.svelte.js';
  import { getXrefs } from '../../lib/db.js';
  import { displayTitle } from '../../lib/titles.js';

  // Branches drawn per step. Ours, not the data's — `Plants` has 152 neighbours (measured against
  // the resolver that indexes all 131 supplements) and would bury the spine.
  const MAX_BRANCHES = 11;
  // Slots alternate below/above and step outward by ROW_GAP; a label reaches LABEL_REACH past its
  // node. Everything below is derived from those three, because H and the "+N more" line used to be
  // hand-tuned constants (420 and cy-190) that were only correct at MAX_BRANCHES = 7 — raising the
  // cap silently pushed the deepest row and the counter outside the viewBox.
  const ROW0 = 54, ROW_GAP = 42, LABEL_REACH = 22, MORE_GAP = 16;
  const reach = (rows) => (rows < 1 ? 0 : ROW0 + (rows - 1) * ROW_GAP + LABEL_REACH);
  const reachDown = (n) => reach(Math.ceil(n / 2));
  // the "+N more" counter rides above the topmost branch label on the upper side
  const reachUp = (n) => reach(Math.floor(n / 2)) + MORE_GAP + LABEL_REACH;
  // only drawn when a step overflowed, which means it drew the full MAX_BRANCHES
  const MORE_Y = reach(Math.floor(MAX_BRANCHES / 2)) + MORE_GAP;
  // a floor, so a trail with no branches is still a map rather than a strip
  const COL = 208, MIN_H = 300;
  // How far right of its step an outbound branch sits. A centred label runs to ±57 at the 22-char
  // cap, so 76 leaves ~18px between this fan's labels and the next step's at +208 — and the same
  // margin behind it, against the previous step's fan. Pushing it further right eats that margin.
  const FAN_DX = 76;
  // An inbound arrow stops here rather than at the step's circle: the step's own label sits at
  // cy+24, and a line to the circle ran straight through the text.
  const LABEL_CLEAR = 34;

  let scrollEl = $state(null);
  let pannable = $state(false);
  let pan = null, dragged = false;

  const short = (s) => (s.length > 22 ? s.slice(0, 21).trimEnd() + '…' : s);

  let model = $derived.by(() => {
    const steps = lib.stack.map((node, i) => ({ i, node, id: node.kind === 'article' ? node.id : null }));
    const onSpine = new Set(steps.filter((s) => s.id).map((s) => s.id));
    const claimed = new Set(onSpine);
    const outs = new Map(), ins = new Map();
    for (const s of steps) {
      if (!s.id) { s.branches = []; s.hidden = 0; continue; }
      const x = getXrefs(s.id);
      // both directions: inbound is what nothing else in the UI can show. Every neighbour resolves
      // to a real article — loadXrefs drops a link it cannot resolve rather than storing a null
      // dst — so there is no unresolved-target case to draw.
      //
      // Direction rides along from here, because the two are not interchangeable and drawing them
      // alike is what made `Shechem (Place)` show a branch while its own "Where this leads" called
      // it a dead end. Out first, so a mutual link keeps `out` — the stronger claim, since it is
      // the one the article itself makes.
      const tagged = [...x.out.map((n) => ({ ...n, dir: 'out' })),
                      ...x.in.map((n) => ({ ...n, dir: 'in' }))];
      const all = tagged.filter((n, k, arr) =>
        arr.findIndex((m) => m.id === n.id) === k && !claimed.has(n.id));
      outs.set(s.id, new Set(x.out.map((n) => n.id)));
      ins.set(s.id, new Set(x.in.map((n) => n.id)));
      s.branches = all.slice(0, MAX_BRANCHES);
      s.hidden = all.length - s.branches.length;
      // Claim every candidate this step saw, not just the ones it had room to draw — otherwise an
      // overflow candidate stays unclaimed and can resurface at a later step that also neighbours
      // it, migrating away from "its earliest step" instead of staying hidden behind this step's
      // own "+N more".
      for (const n of all) claimed.add(n.id);
    }
    // Height follows the busiest step in *this* trail, not the cap. 5,850 of the 6,010 articles
    // have 7 neighbours or fewer, so sizing every map for MAX_BRANCHES would make all of them tall
    // enough for a density almost none of them reach — and a taller map is one that has to be
    // panned. Only the 160 articles that actually run deep pay for the room they use.
    const busiest = Math.max(0, ...steps.map((s) => s.branches.length));
    const H = Math.max(MIN_H, 2 * Math.max(reachDown(busiest), reachUp(busiest)) + 24);
    const cy = H / 2;
    // Only the last step's fan can overflow — every earlier one has a whole column to spill into.
    const tailFan = steps.at(-1)?.branches?.some((b) => b.dir === 'out');
    const W = Math.max(700, 120 + (steps.length - 1) * COL + (tailFan ? 190 : 120));
    const px = (i) => 120 + i * COL;
    const links = [], nodes = [];
    // a line stops short of the circle it points at, or the arrowhead hides under the fill
    const radius = (i) => (i === steps.length - 1 ? 9 : 7) + 4;
    for (const s of steps) {
      const x = px(s.i);
      const last = s.i === steps.length - 1;
      if (s.i > 0) {
        const prev = steps[s.i - 1];
        // solid when the step followed a real cross-reference; dashed when the user arrived
        // another way — search, a route, or Wander in.
        //
        // A branch click can walk the reference backwards (Shechem -> Sychem, where it is Sychem
        // that names Shechem). That still followed a cross-reference, so the line stays solid and
        // the arrow carries the direction: drawn right-to-left, it lands on the article being
        // named. `fwd` wins a mutual link, matching how the step was actually taken.
        const fwd = !!(s.id && prev.id && outs.get(prev.id)?.has(s.id));
        const back = !fwd && !!(s.id && prev.id && ins.get(prev.id)?.has(s.id));
        if (fwd || back) {
          const [from, to] = back ? [s.i, prev.i] : [prev.i, s.i];
          const dir = Math.sign(px(to) - px(from));
          links.push({ x1: px(from), y1: cy, x2: px(to) - dir * radius(to), y2: cy,
            cls: 'path', arrow: 'arw-a' });
        } else {
          links.push({ x1: px(prev.i), y1: cy, x2: x, y2: cy, cls: 'jumped' });
        }
      }
      // One slot allocator for every branch of a step, whatever its direction. Giving outbound and
      // inbound a counter each looked tidier and was wrong: both restart at row 0 on the same side,
      // so their labels landed 8px apart vertically while only FAN_DX apart horizontally, and at
      // the 22-char cap a label is wider than that. Unique (side, row) per branch is what keeps
      // them apart; direction is then free to move only x.
      s.branches.forEach((b, k) => {
        const side = k % 2 ? -1 : 1, row = Math.floor(k / 2);
        const by = cy + side * (ROW0 + row * ROW_GAP);
        const full = displayTitle(b.title);
        if (b.dir === 'out') {
          // fans right — the way the path would carry on — and faded, because a road not taken
          // drawn at full strength in the spine's own direction reads as the next real step
          const bx = x + FAN_DX, len = Math.hypot(FAN_DX, by - cy);
          links.push({ x1: x, y1: cy, x2: bx - (FAN_DX / len) * 9, y2: by - ((by - cy) / len) * 9,
            cls: 'branch faint', arrow: 'arw' });
          nodes.push({ kind: 'branch', x: bx, y: by, side, step: s.i, id: b.id, dir: 'out',
            faint: true, label: short(full), full });
        } else {
          // inbound keeps the vertical axis: it is not somewhere the path can go, so it stays off
          // the direction of travel. Drawn spine-ward rather than given a reversed marker, so one
          // marker definition serves both directions.
          links.push({ x1: x, y1: by, x2: x, cls: 'branch', arrow: 'arw',
            y2: side > 0 ? cy + LABEL_CLEAR : cy - radius(s.i) });
          nodes.push({ kind: 'branch', x, y: by, side, step: s.i, id: b.id, dir: 'in',
            label: short(full), full });
        }
      });
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
      <defs>
        <!-- orient="auto" turns the head to follow the line, so direction is expressed by which
             end the line is drawn from and no reversed twin is needed -->
        <marker id="arw" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6"
          orient="auto"><path d="M0 0 L8 4 L0 8 z" fill="var(--rule)" /></marker>
        <marker id="arw-a" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5"
          orient="auto"><path d="M0 0 L8 4 L0 8 z" fill="var(--a)" /></marker>
      </defs>
      {#each model.links as l}
        <line class="lnk {l.cls}" x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
          marker-end={l.arrow ? `url(#${l.arrow})` : null} />
      {/each}
      {#each model.nodes as n}
        {#if n.kind === 'branch'}
          {@const jump = () => jumpFrom(n.step, { kind: 'article', id: n.id, title: n.full })}
          <g>
            <title>{n.full}{n.dir === 'in' ? ' — names this article' : ''}</title>
            <circle class="nd" class:faint={n.faint} cx={n.x} cy={n.y} r="5"
              role="button" tabindex="0" onclick={guard(jump)} onkeydown={onEnter(jump)} />
            <text class:faint={n.faint} x={n.x} y={n.y + (n.side < 0 ? -11 : 17)}
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
              <text class="step" x={n.x} y={n.y - MORE_Y} text-anchor="middle">+{n.hidden} more</text>
            {/if}
          </g>
        {/if}
      {/each}
    </svg>
  </div>

  <div class="legend">
    <span><i class="path"></i> the step followed a cross-reference</span>
    <span><i class="jumped"></i> arrived another way — search, a route, or ✦ Wander in</span>
    <span><i class="arw"></i> a branch not taken</span>
    <span>every arrow points at the article being named</span>
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
  .nd { fill: var(--bg); stroke: var(--dim); stroke-width: 1.3; cursor: pointer; }
  .nd:hover { stroke: var(--a); stroke-width: 2.2; }
  /* an outbound branch is a possibility, not a step — it must not read as the spine continuing.
     opacity (not a paler stroke) so the arrowhead, which paints with the marker's own fill,
     fades with the line it belongs to. */
  .faint { opacity: .45; }
  .nd.faint:hover { opacity: 1; }
  .nd.on { fill: var(--a); stroke: var(--a); }
  .nd.spine { fill: var(--panel); stroke: var(--a); stroke-width: 1.8; }
  .nd.step { fill: var(--panel); stroke: var(--dim); stroke-dasharray: 3 2; }
  /* A fan line leaving a step passes behind that step's own caption on its way down-right. The
     inbound arrow gets real clearance because it is solid and vertical; for the faint fan a
     knockout halo is enough, and it keeps every branch radiating from one origin. */
  text { font-size: 10.5px; fill: var(--ink); pointer-events: none;
    paint-order: stroke; stroke: var(--panel); stroke-width: 3px; stroke-linejoin: round; }
  text.on { fill: var(--a); font-weight: 600; }
  text.spine { fill: var(--ink); font-weight: 600; }
  text.step { fill: var(--dim); }
  .legend { display: flex; flex-wrap: wrap; gap: 15px; padding: 9px 17px 13px; font-size: 10.5px;
    color: var(--dim); border-top: 1px solid var(--rule); }
  .legend span { display: inline-flex; align-items: center; gap: 5px; }
  .legend i { width: 17px; height: 0; border-top: 1px solid var(--rule); display: inline-block; }
  .legend i.path { border-top: 2px solid var(--a); }
  .legend i.jumped { border-top: 1px dashed var(--dim); }
  .legend i.arw { position: relative; }
  .legend i.arw::after { content: ''; position: absolute; right: -1px; top: -3px;
    border: 3px solid transparent; border-left: 4px solid var(--rule); }
</style>
