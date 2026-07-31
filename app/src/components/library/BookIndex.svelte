<script>
  import { BOOKS } from '../../lib/refs.js';
  import { pushNode } from '../../lib/library.svelte.js';
</script>

<h3 class="stitle">Books</h3>
<div class="smeta">66 introductions · canonical order</div>

<div class="bookgrid">
  {#each BOOKS as [code, name]}
    <button onclick={() => pushNode({ kind: 'hub', book: code })}>{name}</button>
  {/each}
</div>

<p class="note">
  Each opens a hub: purpose, author, date and setting, plus every theme, profile and most-citing
  dictionary article anchored in that book.
</p>

<style>
  .stitle { font-size: 22px; margin: 0 0 4px; }
  .smeta { font-size: 11.5px; color: var(--dim); margin-bottom: 20px; }
  .bookgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 5px; }
  .bookgrid button { background: transparent; border: 1px solid var(--rule); border-radius: 5px;
    padding: 6px 9px; font-family: inherit; font-size: 12.5px; color: var(--ink); cursor: pointer;
    text-align: left; }
  .bookgrid button:hover { border-color: var(--a); }
  .note { font-size: 11px; color: var(--dim); line-height: 1.55; margin-top: 12px; font-style: italic; max-width: 74ch; }
</style>
