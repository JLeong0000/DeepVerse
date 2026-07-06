<script>
  import { getPref } from '../../lib/store.js';
  import { openStudy } from '../../lib/router.svelte.js';
  import { bookName } from '../../lib/refs.js';

  // last_position = { version, book, chapter, verse } | null
  const pos = getPref('last_position', null);
</script>

<section>
  <div class="lbl">Continue</div>
  {#if pos}
    <div class="resume">
      <span class="ref" onclick={() => openStudy(pos)} role="button" tabindex="0">{bookName(pos.book)} {pos.chapter}</span>
      <span class="meta">{pos.version}{pos.verse ? ` · v${pos.verse}` : ''}</span>
    </div>
  {:else}
    <div class="resume">
      <span class="ref" onclick={() => openStudy({ version: 'NIV', book: 'John', chapter: 1 })} role="button" tabindex="0">John 1</span>
      <span class="meta">NIV · start reading</span>
    </div>
  {/if}
</section>

<style>
  section { margin-bottom: 22px; }
  .resume { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .resume .ref { font-size: 24px; color: var(--a); cursor: pointer; }
  .resume .ref:hover { text-decoration: underline; }
  .resume .meta { color: var(--dim); font-size: 12.5px; }
</style>
