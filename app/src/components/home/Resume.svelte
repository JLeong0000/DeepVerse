<script>
  import { getPref } from '../../lib/store.js';
  import { openStudy } from '../../lib/router.svelte.js';
  import { bookName } from '../../lib/refs.js';

  // last_position = { version, book, chapter, verse } | null
  const pos = getPref('last_position', null);
  const target = pos || { version: 'NIV', book: 'John', chapter: 1 };
</script>

<section class="continue" onclick={() => openStudy(target)} role="button" tabindex="0">
  <div class="lbl">Continue</div>
  {#if pos}
    <div class="resume">
      <span class="ref">{bookName(pos.book)} {pos.chapter}</span>
      <span class="meta">{pos.version}{pos.verse ? ` · v${pos.verse}` : ''}</span>
    </div>
  {:else}
    <div class="resume">
      <span class="ref">John 1</span>
      <span class="meta">NIV · start reading</span>
    </div>
  {/if}
</section>

<style>
  /* no border/background at rest; padding + negative margins keep the text aligned while giving the
     hover shadow room to frame the content. */
  .continue { margin: -10px -12px 12px; padding: 10px 12px; border-radius: 8px; cursor: pointer;
    transition: transform .35s ease, box-shadow .35s ease; }
  .continue:hover { transform: scale(1.008); box-shadow: 0 4px 14px rgba(0, 0, 0, .14); }
  :global(html.dark) .continue:hover { box-shadow: 0 4px 14px rgba(255, 255, 255, .14); }
  .resume { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .resume .ref { font-size: 32px; color: var(--a); }
  .resume .meta { color: var(--dim); font-size: 12.5px; }
</style>
