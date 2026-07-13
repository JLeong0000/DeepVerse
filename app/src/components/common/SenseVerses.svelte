<script>
  // Verses that use a word, grouped by English sense — reference-only links with a per-sense
  // "and N more" fold. Shared by the Word-of-the-day search detail and the Original card's
  // "See other instances" overlay.
  import { cleanGloss } from '../../lib/display.js';
  import { formatRef } from '../../lib/refs.js';

  let { senses, onjump } = $props();

  const SHOWN = 8; // verses shown per sense before the "and N more" fold
  let expanded = $state(new Set());
  function expand(i) { expanded = new Set(expanded).add(i); }
  const refText = (ref) => formatRef(`${ref.book}.${ref.chapter}.${ref.verse}`);
</script>

<div class="senses">
  {#each senses as s, i}
    <div class="sense">
      <div class="sense-head"><b class="gloss">“{cleanGloss(s.gloss)}”</b> <span class="cnt">{s.count}×</span></div>
      <div class="verses">
        {#each (expanded.has(i) ? s.occurrences : s.occurrences.slice(0, SHOWN)) as o}
          <button class="occ" onclick={() => onjump(o)}>{refText(o.ref)} →</button>
        {/each}
        {#if s.occurrences.length > SHOWN && !expanded.has(i)}
          <button class="more" onclick={() => expand(i)}>and {s.occurrences.length - SHOWN} more</button>
        {/if}
      </div>
    </div>
  {/each}
</div>

<style>
  .senses { display: flex; flex-direction: column; gap: 12px; }
  .sense-head { display: flex; align-items: baseline; gap: 7px; margin-bottom: 5px; }
  .gloss { font-size: 14px; }
  .cnt { color: var(--dim); font-size: 12px; }
  .verses { display: flex; flex-wrap: wrap; gap: 4px 14px; }
  .occ { background: none; border: none; padding: 0; cursor: pointer; font-family: inherit;
    font-size: 12.5px; color: var(--a); }
  .occ:hover { text-decoration: underline; }
  .more { background: none; border: none; padding: 0; cursor: pointer; font-family: inherit;
    font-size: 12.5px; color: var(--dim); font-style: italic; }
  .more:hover { color: var(--ink); }
</style>
