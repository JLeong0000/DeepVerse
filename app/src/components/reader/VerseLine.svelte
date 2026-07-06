<script>
  import { underlineSpans, selectUnderlines } from '../../lib/db.js';

  let { verse, text, diffs = [], selected = false, onselect } = $props();

  // sparse underlines: one representative A + B per verse
  let segments = $derived(underlineSpans(text, selectUnderlines(diffs)));
  const cls = (t) => (t === 'A' ? 'wA' : t === 'B' ? 'wB' : t === 'AB' ? 'wAB' : '');
</script>

<div class="v" class:sel={selected} onclick={() => onselect(verse)} role="button" tabindex="0">
  <span class="n">{verse}</span>{#each segments as seg}{#if seg.type}<span class={cls(seg.type)}>{seg.text}</span>{:else}{seg.text}{/if}{/each}
</div>

<style>
  .v { margin: 8px 0; padding: 6px 10px; border-radius: 3px; cursor: pointer; }
  .v:hover { background: color-mix(in srgb, var(--panel) 50%, var(--bg)); }
  .v.sel { background: var(--sel); box-shadow: inset 2px 0 0 var(--a); }
  .n { color: var(--dim); font-size: .72em; vertical-align: super; margin-right: 3px; }
  .wA { border-bottom: 1.5px solid var(--a); }
  .wB { border-bottom: 1.5px solid var(--b); }
  .wAB { border-bottom: 1.5px solid var(--b); box-shadow: inset 0 -3.5px 0 -2px var(--a); } /* double: B over A */
</style>
