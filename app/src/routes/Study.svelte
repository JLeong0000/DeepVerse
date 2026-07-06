<script>
  import { onMount } from 'svelte';
  import { route } from '../lib/router.svelte.js';
  import { study, goToPassage, selectVerse } from '../lib/study.svelte.js';
  import { getPref, setPref } from '../lib/store.js';
  import Reader from '../components/reader/Reader.svelte';
  import Workbench from '../components/workbench/Workbench.svelte';

  let orientation = $state(getPref('splitOrientation', 'lr')); // 'lr' | 'tb'
  let readerFirst = $state(getPref('splitReaderFirst', true));

  onMount(() => {
    const p = route.params;
    if (p?.book) { goToPassage({ version: p.version, book: p.book, chapter: p.chapter, verse: p.verse ?? null }); }
    if (p?.verse) selectVerse(p.verse);
  });

  function cycleOrientation() { orientation = orientation === 'lr' ? 'tb' : 'lr'; setPref('splitOrientation', orientation); }
  function swapSides() { readerFirst = !readerFirst; setPref('splitReaderFirst', readerFirst); }
</script>

<div class="study">
  <div class="studybar">
    <span class="loc">Study · <b>{study.book} {study.chapter}</b></span>
    <button class="ctl" onclick={cycleOrientation} title="Toggle split orientation">
      {orientation === 'lr' ? '⇔ side-by-side' : '⇕ stacked'}
    </button>
    <button class="ctl" onclick={swapSides} title="Swap panes">⇄ swap</button>
  </div>

  <div class="split" class:tb={orientation === 'tb'} class:swap={!readerFirst}>
    <div class="pane reader-pane"><Reader /></div>
    <div class="divider"></div>
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
  .pane { flex: 1; min-width: 0; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
  .split:not(.tb) .reader-pane { flex: 0 0 42%; }
  .divider { background: var(--rule); flex: 0 0 1px; }

  @media (max-width: 720px) { .split, .split.swap { flex-direction: column; } .split:not(.tb) .reader-pane { flex: 1; } }
</style>
