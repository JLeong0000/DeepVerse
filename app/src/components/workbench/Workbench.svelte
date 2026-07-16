<script>
  import { onMount } from 'svelte';
  import { getPref, setPref } from '../../lib/store.js';
  import { study } from '../../lib/study.svelte.js';
  import Card from './Card.svelte';
  import DifferencesCard from './DifferencesCard.svelte';
  import OriginalCard from './OriginalCard.svelte';
  import ContextCard from './ContextCard.svelte';
  import StatsCard from './StatsCard.svelte';
  import NotesCard from './NotesCard.svelte';

  const DEFS = {
    differences: { title: 'Differences', component: DifferencesCard },
    original: { title: 'Original', sub: 'read the verse · tap any word', component: OriginalCard },
    context: { title: 'Context & cross-references', component: ContextCard },
    stats: { title: 'Stats · word selector', component: StatsCard },
    notes: { title: 'Memo', component: NotesCard },
  };
  const DEFAULT_ORDER = ['context', 'differences', 'original', 'stats', 'notes'];
  const DEFAULT_OPEN = { differences: true, original: false, context: false, stats: false, notes: false };

  let order = $state(getPref('cardOrder', DEFAULT_ORDER).filter(id => DEFS[id]));
  let open = $state({ ...DEFAULT_OPEN, ...getPref('cardOpen', {}) });
  let dragIndex = $state(null);

  $effect(() => { setPref('cardOrder', order); });
  $effect(() => { setPref('cardOpen', open); });
  // clicking a word (in Differences or the interlinear) reveals its meaning in the Original card
  $effect(() => { if (study.word && DEFS.original) open.original = true; });

  function toggle(id) { open[id] = !open[id]; }

  function onDragStart(i) { dragIndex = i; }
  function onDragOver(i) {
    if (dragIndex === null || dragIndex === i) return;
    const next = [...order];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(i, 0, moved);
    order = next; dragIndex = i;
  }
  function onDrop() { dragIndex = null; }

  // hotkeys 1..n toggle the card at that display position
  function onKey(e) {
    if (e.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= order.length) { toggle(order[n - 1]); e.preventDefault(); }
  }
  onMount(() => { window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); });
</script>

<div class="wb">
  {#each order as id, i (id)}
    <Card title={DEFS[id].title} sub={DEFS[id].sub || ''} hotkey={i + 1} open={open[id]} index={i}
      onToggle={() => toggle(id)} {onDragStart} {onDragOver} {onDrop}>
      {@const Content = DEFS[id].component}
      <Content verse={study.verse} />
    </Card>
  {/each}
  {#if study.verse == null}
    <div class="hint">Select a verse in the reader to drive these cards.</div>
  {/if}
</div>

<style>
  .wb { display: flex; flex-direction: column; gap: 8px; padding: 12px; overflow-y: auto; height: 100%; }
  .hint { color: var(--dim); font-size: 12px; font-style: italic; padding: 4px 2px; }
</style>
