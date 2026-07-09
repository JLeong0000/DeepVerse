<script>
  import { onMount } from 'svelte';
  import { route } from '../lib/router.svelte.js';
  import { study, goToPassage, selectVerse, selectWord } from '../lib/study.svelte.js';
  import { getInterlinear } from '../lib/db.js';
  import { bookShort } from '../lib/refs.js';
  import { getPref, setPref } from '../lib/store.js';
  import Reader from '../components/reader/Reader.svelte';
  import Workbench from '../components/workbench/Workbench.svelte';

  let orientation = $state(getPref('splitOrientation', 'lr')); // 'lr' | 'tb'
  let readerFirst = $state(getPref('splitReaderFirst', true));
  let splitRatio = $state(getPref('splitRatio', 0.42)); // reader-pane fraction of the split
  let splitEl = $state(null);
  let dragging = $state(false);

  onMount(() => {
    const p = route.params;
    if (p?.book) { goToPassage({ version: p.version, book: p.book, chapter: p.chapter, verse: p.verse ?? null }); }
    if (p?.verse) selectVerse(p.verse);
    if (p?.word && p?.verse) {
      const iw = getInterlinear(p.book, p.chapter, p.verse).find(x => x.position === p.word.position);
      if (iw) selectWord(iw);
    }
  });

  function cycleOrientation() { orientation = orientation === 'lr' ? 'tb' : 'lr'; setPref('splitOrientation', orientation); }
  function swapSides() { readerFirst = !readerFirst; setPref('splitReaderFirst', readerFirst); }

  // Drag the divider to resize the panes (pointer events cover mouse + touch). The ratio is measured
  // against the split container; when the panes are swapped the reader sits on the far side, so invert.
  function startDrag(e) {
    if (!splitEl) return;
    e.preventDefault();
    dragging = true;
    const onMove = (ev) => {
      const r = splitEl.getBoundingClientRect();
      let f = orientation === 'tb' ? (ev.clientY - r.top) / r.height : (ev.clientX - r.left) / r.width;
      if (!readerFirst) f = 1 - f;
      splitRatio = Math.min(0.8, Math.max(0.2, f));
    };
    const onUp = () => {
      dragging = false;
      setPref('splitRatio', splitRatio);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }
  function resetSplit() { splitRatio = 0.42; setPref('splitRatio', 0.42); }
</script>

<div class="study">
  <div class="studybar">
    <span class="loc">Study · <b>{bookShort(study.book)} {study.chapter}</b></span>
    <button class="ctl" onclick={cycleOrientation} title="Toggle split orientation">
      {orientation === 'lr' ? '⇔ side-by-side' : '⇕ stacked'}
    </button>
    <button class="ctl" onclick={swapSides} title="Swap panes">⇄ swap</button>
  </div>

  <div class="split" class:tb={orientation === 'tb'} class:swap={!readerFirst} class:dragging
    bind:this={splitEl} style="--reader-basis: {splitRatio * 100}%">
    <div class="pane reader-pane"><Reader /></div>
    <div class="divider" class:dragging onpointerdown={startDrag} ondblclick={resetSplit}
      role="separator" aria-label="Drag to resize panes (double-click to reset)"
      aria-orientation={orientation === 'tb' ? 'horizontal' : 'vertical'}>
      <span class="grip" aria-hidden="true"></span>
    </div>
    <div class="pane wb-pane"><Workbench /></div>
  </div>
</div>

<style>
  .study { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .studybar { flex: none; display: flex; align-items: center; gap: 12px; padding: 6px 14px; border-bottom: 1px solid var(--rule);
    font-size: 11px; color: var(--dim); font-variant: small-caps; letter-spacing: .05em; }
  .studybar .loc b { color: var(--ink); }
  .ctl { border: 1px solid var(--rule); background: transparent; color: var(--dim); border-radius: 4px;
    padding: 2px 8px; cursor: pointer; font-family: inherit; font-size: 11px; font-variant: small-caps; letter-spacing: .04em; }
  .ctl:hover { color: var(--ink); border-color: var(--a); }

  .split { flex: 1; min-height: 0; display: flex; }
  .split.tb { flex-direction: column; }
  .split.swap { flex-direction: row-reverse; }
  .split.tb.swap { flex-direction: column-reverse; }
  .split.dragging { user-select: none; cursor: col-resize; }
  .split.tb.dragging { cursor: row-resize; }
  .pane { flex: 1; min-width: 0; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
  .reader-pane { flex: 0 0 var(--reader-basis, 42%); }

  /* draggable divider: a hairline with a wider invisible grab zone (::before) and a visible grip tab */
  .divider { background: var(--rule); flex: 0 0 1px; position: relative; touch-action: none; z-index: 5;
    display: flex; align-items: center; justify-content: center; }
  .divider::before { content: ''; position: absolute; inset: -5px 0; cursor: row-resize; }
  .split:not(.tb) .divider::before { inset: 0 -5px; cursor: col-resize; }
  .divider:hover, .divider.dragging { background: var(--a); }
  /* the grip tab straddling the line — same ⠿ motif the draggable cards use */
  .grip { position: absolute; background: var(--panel); border: 1px solid var(--rule); border-radius: 4px;
    color: var(--dim); pointer-events: none; display: grid; place-items: center; font-size: 10px; line-height: 0; }
  .grip::before { content: '⠿'; }
  .split:not(.tb) .grip { width: 10px; height: 34px; }
  .split:not(.tb) .grip::before { transform: rotate(90deg); }
  .split.tb .grip { width: 34px; height: 10px; }
  .divider:hover .grip, .divider.dragging .grip { color: var(--a); border-color: var(--a); }

  @media (max-width: 720px) {
    .split, .split.swap { flex-direction: column; }
    .split .reader-pane { flex: 1 1 auto !important; } /* stack full-width on mobile, ignore the drag ratio */
    .divider { display: none; }
  }
</style>
